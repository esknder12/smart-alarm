// Web Audio API Synthesizer for Alarms and Ambient Sounds

class AudioEngine {
  private ctx: AudioContext | null = null;
  private alarmOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];
  private alarmInterval: number | null = null;
  private alarmFadeInterval: number | null = null;
  private ambientSources: Map<string, { source: AudioNode; gain: GainNode; stopFn: () => void }> = new Map();
  private volumeLocked: boolean = false;
  private lockedVolumePercent: number = 100;

  // ---- Strict volume-lock loudness bus -------------------------------------
  /** Master bus every alarm tone is routed through, so loudness can be forced. */
  private alarmBus: GainNode | null = null;
  /** Alarm's configured volume as a 0-1 gain. */
  private alarmBusBaseGain: number = 1;
  /** 0 = base, 1 = max gain, 2 = + siren layer, 3 = siren + max gain. */
  private escalationLevel: number = 0;
  private sirenNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private sirenLfo: OscillatorNode | null = null;
  /** Last started alarm tone, so the watchdog can re-arm it if it is killed. */
  private currentTone: {
    type: string;
    volume: number;
    gentle: boolean;
    onFade?: (elapsedSec: number, currentPercent: number) => void;
  } | null = null;

  /** Per-level loudness multiplier applied on top of the configured volume. */
  private static readonly ESCALATION_BOOST = [1, 1.15, 1.3, 1.45];

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play alarm sound loop
  public startAlarmSound(
    type: string,
    volume: number = 80,
    gentleWakeUp: boolean = false,
    onFadeProgress?: (elapsedSec: number, currentPercent: number) => void
  ) {
    this.stopAlarmSound();
    this.volumeLocked = true;
    this.lockedVolumePercent = volume;
    this.alarmBusBaseGain = Math.max(0.05, Math.min(1, volume / 100));

    // Remember the tone so the volume-lock watchdog can re-arm it if the
    // browser kills the loop while the alarm is still ringing.
    this.currentTone = { type, volume, gentle: gentleWakeUp, onFade: onFadeProgress };

    // Alarm tones are routed through this bus instead of straight to the
    // speakers, so the lock can re-assert loudness at any time.
    const alarmOut = this.ensureAlarmBus();

    // Register MediaSession lock to prevent volume or pause suppression from media keys
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: '🚨 Alarm Ringing (Volume Locked)',
          artist: 'Alarm Security System',
          album: 'Solve Challenge To Dismiss',
        });
        const blockMediaKey = () => {
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
          }
        };
        navigator.mediaSession.setActionHandler('pause', blockMediaKey);
        navigator.mediaSession.setActionHandler('stop', blockMediaKey);
        navigator.mediaSession.setActionHandler('seekbackward', blockMediaKey);
        navigator.mediaSession.setActionHandler('seekforward', blockMediaKey);
        navigator.mediaSession.setActionHandler('previoustrack', blockMediaKey);
        navigator.mediaSession.setActionHandler('nexttrack', blockMediaKey);
      } catch (e) {}
    }

    const ctx = this.getContext();

    // Tones are synthesised at full scale; the configured volume and the
    // escalation boost are applied once, on the master alarm bus below.
    const targetVol = 1;
    let currentVol = gentleWakeUp ? 0.05 : targetVol;

    if (gentleWakeUp) {
      // Notify starting state (0s, starting percent ~5% or scaled)
      onFadeProgress?.(0, Math.round((currentVol / targetVol) * 100));

      // Gradually increase volume over 30 seconds
      const startTime = Date.now();
      this.alarmFadeInterval = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(1, elapsed / 30);
        currentVol = 0.05 + (targetVol - 0.05) * progress;
        
        onFadeProgress?.(Math.min(30, Math.floor(elapsed)), Math.round((currentVol / targetVol) * 100));

        if (progress >= 1 && this.alarmFadeInterval) {
          clearInterval(this.alarmFadeInterval);
          this.alarmFadeInterval = null;
        }
      }, 1000);
    }

    const playToneSequence = () => {
      const now = ctx.currentTime;
      const vol = currentVol;

      if (type === 'chime') {
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.25);
          gain.gain.setValueAtTime(vol * 0.3, now + i * 0.25);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.8);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.25);
          osc.stop(now + i * 0.25 + 0.8);
        });
      } else if (type === 'sunrise') {
        const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
        notes.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + i * 0.3);
          gain.gain.setValueAtTime(vol * 0.25, now + i * 0.3);
          gain.gain.linearRampToValueAtTime(0.001, now + i * 0.3 + 1.2);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.3);
          osc.stop(now + i * 0.3 + 1.2);
        });
      } else if (type === 'digital') {
        [0, 0.12, 0.24, 0.36].forEach((delay) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(987.77, now + delay);
          gain.gain.setValueAtTime(vol * 0.25, now + delay);
          gain.gain.setValueAtTime(0, now + delay + 0.08);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + delay);
          osc.stop(now + delay + 0.08);
        });
      } else if (type === 'nuclear') {
        // Dual detuned high-decibel nuclear warning siren wail
        [1000, 1015].forEach((baseFreq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(baseFreq, now);
          osc.frequency.linearRampToValueAtTime(baseFreq + 800, now + 0.3);
          osc.frequency.linearRampToValueAtTime(baseFreq, now + 0.6);
          gain.gain.setValueAtTime(vol * 0.5, now);
          gain.gain.setValueAtTime(vol * 0.5, now + 0.55);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.6);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now);
          osc.stop(now + 0.6);
        });
      } else if (type === 'airhorn') {
        // Stadium Blast Triple Piercing Airhorn
        [466.16, 587.33, 700.00].forEach((f) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f * 0.9, now);
          osc.frequency.exponentialRampToValueAtTime(f * 1.05, now + 0.05);
          gain.gain.setValueAtTime(vol * 0.45, now);
          gain.gain.setValueAtTime(vol * 0.45, now + 0.35);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now);
          osc.stop(now + 0.4);
        });
      } else if (type === 'metal') {
        // Heavy Metal Thrash Sub-Bass Blast
        [65.41, 130.81, 261.63, 1046.50].forEach((f) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(vol * 0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now);
          osc.stop(now + 0.5);
        });
      } else if (type === 'foghorn') {
        // Titanic Deep Resonant Foghorn Roar
        [82.41, 123.47, 164.81].forEach((f) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(0.01, now);
          gain.gain.linearRampToValueAtTime(vol * 0.5, now + 0.15);
          gain.gain.setValueAtTime(vol * 0.5, now + 0.9);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now);
          osc.stop(now + 1.2);
        });
      } else if (type === 'thunder') {
        // Extreme Air Raid Strobe Siren
        [0, 0.15, 0.3, 0.45].forEach((delay) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(2200, now + delay);
          osc.frequency.exponentialRampToValueAtTime(800, now + delay + 0.1);
          gain.gain.setValueAtTime(vol * 0.5, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + delay);
          osc.stop(now + delay + 0.1);
        });
      } else if (type === 'radar') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.35);
        gain.gain.setValueAtTime(vol * 0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(alarmOut);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'police') {
        // High urgency alternating siren
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1500, now + 0.25);
        osc.frequency.linearRampToValueAtTime(600, now + 0.5);
        gain.gain.setValueAtTime(vol * 0.45, now);
        gain.gain.setValueAtTime(vol * 0.45, now + 0.48);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(alarmOut);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'horn') {
        // Deep punchy brass sweep
        [130.81, 261.63, 392.00].forEach((f) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(vol * 0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now);
          osc.stop(now + 0.7);
        });
      } else if (type === 'speech') {
        // Heavy Motivational Brass fanfare
        [349.23, 440.00, 523.25, 698.46].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + i * 0.15);
          gain.gain.setValueAtTime(vol * 0.35, now + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.6);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.15);
          osc.stop(now + i * 0.15 + 0.6);
        });
      } else if (type === 'stickplan') {
        // Urgent Uplifting March
        [440, 440, 554.37, 659.25].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(f, now + i * 0.12);
          gain.gain.setValueAtTime(vol * 0.2, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.2);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.2);
        });
      } else if (type === 'capybara') {
        // Chill Groove upbeat melody
        [293.66, 369.99, 440.00, 587.33].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.2);
          gain.gain.setValueAtTime(vol * 0.25, now + i * 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.5);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.2);
          osc.stop(now + i * 0.2 + 0.5);
        });
      } else if (type === 'catmeow') {
        // Playful Rhythmic Chime Sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.15);
        osc.frequency.linearRampToValueAtTime(800, now + 0.3);
        gain.gain.setValueAtTime(vol * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(alarmOut);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'nature') {
        // Forest birds chirp
        [2400, 2900, 2600].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.1);
          gain.gain.setValueAtTime(vol * 0.15, now + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.15);
        });
      } else if (type === 'breeze') {
        // Wind chimes
        [1046.50, 1318.51, 1567.98, 2093.00].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.18);
          gain.gain.setValueAtTime(vol * 0.2, now + i * 0.18);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.9);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.18);
          osc.stop(now + i * 0.18 + 0.9);
        });
      } else if (type === 'space') {
        // Deep Ambient Outer Space drone
        [110.00, 164.81, 220.00].forEach((f) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(vol * 0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now);
          osc.stop(now + 1.8);
        });
      } else if (type === 'ocean') {
        // Wave swell synth
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(240, now + 0.8);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(vol * 0.3, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(alarmOut);
        osc.start(now);
        osc.stop(now + 1.2);
      } else if (type === 'retro') {
        // 8-bit arcade
        [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(f, now + i * 0.08);
          gain.gain.setValueAtTime(vol * 0.15, now + i * 0.08);
          gain.gain.setValueAtTime(0, now + i * 0.08 + 0.06);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.06);
        });
      } else if (type === 'guitar') {
        // Acoustic strum chords
        [220.00, 277.18, 329.63, 440.00].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + i * 0.04);
          gain.gain.setValueAtTime(vol * 0.2, now + i * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 1.2);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.04);
          osc.stop(now + i * 0.04 + 1.2);
        });
      } else if (type === 'marimba') {
        // Warm wooden percussion
        [392.00, 493.88, 587.33, 783.99].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.15);
          gain.gain.setValueAtTime(vol * 0.3, now + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.35);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.15);
          osc.stop(now + i * 0.15 + 0.35);
        });
      } else if (type === 'lazy') {
        // Deep soothing ambient synth pulse
        [196.00, 246.94, 293.66, 392.00].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.4);
          gain.gain.setValueAtTime(vol * 0.2, now + i * 0.4);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.4 + 1.5);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.4);
          osc.stop(now + i * 0.4 + 1.5);
        });
      } else if (type === 'goodmorning') {
        // Energetic bright upbeat fanfare
        [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + i * 0.12);
          gain.gain.setValueAtTime(vol * 0.3, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.5);
        });
      } else { // piano
        const chords = [261.63, 329.63, 392.00]; // C major
        chords.forEach((f) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(vol * 0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
          osc.connect(gain);
          gain.connect(alarmOut);
          osc.start(now);
          osc.stop(now + 1.5);
        });
      }
    };

    playToneSequence();
    this.alarmInterval = window.setInterval(playToneSequence, 2000);
  }

  public stopAlarmSound() {
    this.volumeLocked = false;
    this.escalationLevel = 0;
    this.currentTone = null;
    this.stopEscalationSiren();
    // Tear down the loudness bus so nothing is left connected.
    if (this.alarmBus) {
      try { this.alarmBus.disconnect(); } catch { /* ignore */ }
      this.alarmBus = null;
    }
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('stop', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      } catch (e) {}
    }
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    if (this.alarmFadeInterval) {
      clearInterval(this.alarmFadeInterval);
      this.alarmFadeInterval = null;
    }
  }

  public isAlarmVolumeLocked(): boolean {
    return this.volumeLocked;
  }

  /**
   * Creates (or returns) the master alarm bus: alarmBus -> limiter -> speakers.
   * The limiter keeps the escalating loudness loud without clipping.
   */
  private ensureAlarmBus(): GainNode {
    const ctx = this.getContext();
    if (!this.alarmBus) {
      const bus = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      bus.connect(limiter);
      limiter.connect(ctx.destination);
      this.alarmBus = bus;
    }
    this.alarmBus.gain.setValueAtTime(this.computeBusGain(), ctx.currentTime);
    return this.alarmBus;
  }

  private computeBusGain(): number {
    const level = Math.max(0, Math.min(3, this.escalationLevel));
    const boost = AudioEngine.ESCALATION_BOOST[level] ?? 1;
    return Math.max(0.05, Math.min(1, this.alarmBusBaseGain)) * boost;
  }

  /**
   * Re-asserts the alarm: resumes a suspended/ducked/interrupted AudioContext,
   * re-applies the locked gain and restarts anything that was stopped.
   * Called every 200 ms by the volume-lock watchdog.
   * @returns true when the audio context is running.
   */
  public forceLoud(): boolean {
    let running = true;
    try {
      const ctx = this.ctx;
      if (ctx) {
        if (ctx.state !== 'running') {
          ctx.resume().catch(() => { /* still blocked */ });
        }
        running = ctx.state === 'running';

        if (this.alarmBus) {
          const target = this.computeBusGain();
          this.alarmBus.gain.cancelScheduledValues(ctx.currentTime);
          this.alarmBus.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
        }
      }

      // Re-arm the tone loop if something cleared it while ringing.
      if (this.volumeLocked && !this.alarmInterval && ctx) {
        // The interval callback is intentionally not stored, so re-create it
        // from the currently configured alarm tone.
        if (this.currentTone) {
          this.startAlarmSound(
            this.currentTone.type,
            this.currentTone.volume,
            this.currentTone.gentle,
            this.currentTone.onFade
          );
        }
      }
    } catch { /* ignore */ }
    return running;
  }

  /** Sets the loudness escalation level (0-3) and toggles the piercing siren. */
  public setEscalationLevel(level: number): void {
    const next = Math.max(0, Math.min(3, Math.floor(level)));
    if (next === this.escalationLevel) {
      const ctx = this.ctx;
      if (ctx && this.alarmBus) {
        this.alarmBus.gain.setTargetAtTime(this.computeBusGain(), ctx.currentTime, 0.1);
      }
      return;
    }
    this.escalationLevel = next;

    const ctx = this.ctx;
    if (ctx && this.alarmBus) {
      this.alarmBus.gain.setTargetAtTime(this.computeBusGain(), ctx.currentTime, 0.15);
    }

    if (next >= 2) {
      this.startEscalationSiren(next === 3 ? 0.42 : 0.26);
    } else {
      this.stopEscalationSiren();
    }
  }

  public getEscalationLevel(): number {
    return this.escalationLevel;
  }

  /**
   * Extra piercing dual-oscillator siren layered on top of the alarm tone.
   * High frequency content cuts through a phone speaker even when the system
   * volume has been turned down.
   */
  private startEscalationSiren(gainValue: number): void {
    if (this.sirenNodes.length > 0) {
      const ctx = this.ctx;
      if (ctx) {
        this.sirenNodes.forEach((n) => n.gain.gain.setTargetAtTime(gainValue, ctx.currentTime, 0.1));
      }
      return;
    }
    const ctx = this.ctx;
    if (!ctx || !this.alarmBus) return;

    try {
      const now = ctx.currentTime;

      // Wailing LFO shared by both oscillators (classic air-raid sweep).
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 1.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 420;
      lfo.connect(lfoGain);

      [1750, 2210].forEach((baseFreq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, now);
        lfoGain.connect(osc.frequency);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(gainValue, now + 0.4);
        osc.connect(gain);
        gain.connect(this.alarmBus!);
        osc.start(now);
        this.sirenNodes.push({ osc, gain });
      });

      lfo.start(now);
      this.sirenLfo = lfo;
    } catch { /* ignore */ }
  }

  public stopEscalationSiren(): void {
    this.sirenNodes.forEach((n) => {
      try { n.osc.stop(); } catch { /* ignore */ }
      try { n.osc.disconnect(); } catch { /* ignore */ }
    });
    this.sirenNodes = [];
    if (this.sirenLfo) {
      try { this.sirenLfo.stop(); } catch { /* ignore */ }
      try { this.sirenLfo.disconnect(); } catch { /* ignore */ }
      this.sirenLfo = null;
    }
  }

  public getLockedVolumePercent(): number {
    return this.lockedVolumePercent;
  }

  // Play ambient sounds
  public startAmbientSound(id: string, type: string, volume: number = 50) {
    this.stopAmbientSound(id);
    const ctx = this.getContext();
    const vol = Math.max(0, Math.min(1, volume / 100));

    if (type === 'whitenoise' || type === 'rain') {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'rain') {
          // Pink-ish noise filter for rain
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        } else {
          output[i] = white * 0.2;
        }
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      whiteNoise.loop = true;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * (type === 'rain' ? 0.3 : 0.15), ctx.currentTime);

      whiteNoise.connect(gain);
      gain.connect(ctx.destination);
      whiteNoise.start();

      this.ambientSources.set(id, {
        source: whiteNoise,
        gain,
        stopFn: () => {
          try { whiteNoise.stop(); } catch {}
        }
      });
    } else if (type === 'binaural') {
      // 432 Hz + 438 Hz (6 Hz Theta Wave for deep relaxation/wakefulness)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.value = 432;
      osc2.frequency.value = 438;
      osc1.type = 'sine';
      osc2.type = 'sine';

      gain.gain.setValueAtTime(vol * 0.15, ctx.currentTime);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      this.ambientSources.set(id, {
        source: osc1,
        gain,
        stopFn: () => {
          try {
            osc1.stop();
            osc2.stop();
          } catch {}
        }
      });
    } else if (type === 'waves') {
      // Low frequency wave noise with modulation
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.2;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.2, ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();

      // LFO for ocean wave swell
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.1; // 10 second wave cycle
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 250;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      this.ambientSources.set(id, {
        source: noise,
        gain,
        stopFn: () => {
          try {
            noise.stop();
            lfo.stop();
          } catch {}
        }
      });
    } else if (type === 'forest') {
      // Soft gentle birds chirping tone + breeze
      const playChirp = () => {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const startFreq = 2200 + Math.random() * 800;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.linearRampToValueAtTime(startFreq + 500, now + 0.08);
        osc.frequency.linearRampToValueAtTime(startFreq - 200, now + 0.15);

        gain.gain.setValueAtTime(vol * 0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      };

      const interval = window.setInterval(playChirp, 1800);
      playChirp();

      const dummyNode = ctx.createGain();
      this.ambientSources.set(id, {
        source: dummyNode,
        gain: dummyNode,
        stopFn: () => {
          clearInterval(interval);
        }
      });
    }
  }

  public setAmbientVolume(id: string, volume: number) {
    const item = this.ambientSources.get(id);
    if (item && this.ctx) {
      const vol = Math.max(0, Math.min(1, volume / 100));
      item.gain.gain.setValueAtTime(vol * 0.2, this.ctx.currentTime);
    }
  }

  public stopAmbientSound(id: string) {
    const item = this.ambientSources.get(id);
    if (item) {
      item.stopFn();
      this.ambientSources.delete(id);
    }
  }

  public stopAllAmbient() {
    this.ambientSources.forEach((item) => item.stopFn());
    this.ambientSources.clear();
  }
}

export const audioEngine = new AudioEngine();
