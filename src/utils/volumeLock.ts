import { audioEngine } from './audio';

/**
 * Strict Volume Lock Guard
 * ----------------------------------------------------------------------------
 * While an alarm is ringing, this guard fights every attempt to silence it
 * using every mechanism a web app is allowed to use:
 *
 *  1. Hardware / keyboard media keys ("Volume Down", "Mute") that reach the
 *     page are swallowed during the capture phase (keydown, keyup, keypress,
 *     beforeinput) and never reach the OS media handler.
 *  2. A 200 ms watchdog keeps the AudioContext running: it resumes a
 *     suspended/ducked/`interrupted` context (iOS audio interruption, Chrome
 *     autoplay policy, background throttling) and re-asserts max gain.
 *  3. Any <audio>/<video> element is forced back to `muted = false`,
 *     `volume = 1` and re-played if something paused it.
 *  4. MediaSession transport buttons (pause / stop / next / prev / seek) are
 *     hijacked so lock-screen and headset controls cannot silence the alarm.
 *  5. Loudness escalation: unsolved alarms get progressively louder and add a
 *     piercing siren layer, so an alarm that has been turned down is still
 *     audible.
 *  6. Multi-channel wake-up: screen wake lock + repeating haptic vibration so
 *     the user is woken even if the speaker is muted.
 *  7. The tab cannot be closed/reloaded by accident while the alarm rings.
 *
 * IMPORTANT / HONEST LIMITATION
 * Mobile operating systems route the physical volume rocker straight to the
 * system mixer; a web page never receives that event and cannot block it (only
 * a native app with AudioManager / AVAudioSession control can). This guard
 * therefore locks everything the browser exposes, and escalates loudness and
 * haptics to defeat a manual volume-down even when the hardware event is
 * invisible to JavaScript.
 */

export interface VolumeLockStatus {
  active: boolean;
  blockedAttempts: number;
  lastAttemptAt: number | null;
  /** 0 = base, 1 = max gain, 2 = + siren layer, 3 = siren + max gain */
  escalationLevel: number;
  ringingSeconds: number;
  keyGuardActive: boolean;
  audioWatchdogActive: boolean;
  mediaSessionLocked: boolean;
  wakeLockHeld: boolean;
  hapticsActive: boolean;
}

export interface EngageOptions {
  /** Configured alarm volume (0-100) */
  volumePercent?: number;
  /** Escalate loudness while the challenge stays unsolved (default true) */
  escalation?: boolean;
  /** Repeating haptic pattern (default true) */
  haptics?: boolean;
}

/** Every `key` / `code` value browsers use for the volume-down & mute keys. */
const BLOCKED_KEYS = new Set<string>([
  'AudioVolumeDown',
  'VolumeDown',
  'LowerVolume',
  'AudioVolumeMute',
  'VolumeMute',
  'Mute',
  'MicrophoneMute',
]);

/** Legacy `keyCode` / `which` values (Firefox & old WebKit). */
const BLOCKED_KEY_CODES = new Set<number>([
  174, // AudioVolumeDown (Firefox)
  182, // VolumeDown (older WebKit)
  181, // AudioVolumeMute
]);

function emptyStatus(): VolumeLockStatus {
  return {
    active: false,
    blockedAttempts: 0,
    lastAttemptAt: null,
    escalationLevel: 0,
    ringingSeconds: 0,
    keyGuardActive: false,
    audioWatchdogActive: false,
    mediaSessionLocked: false,
    wakeLockHeld: false,
    hapticsActive: false,
  };
}

type Listener = (status: VolumeLockStatus, event: string) => void;

/** DOM event fired on `window` whenever a silencing attempt is blocked. */
export const VOLUME_LOCK_BLOCKED_EVENT = 'niqu-volume-lock-blocked';

class VolumeLockGuard {
  private status: VolumeLockStatus = emptyStatus();
  private listeners = new Set<Listener>();
  private watchdog: number | null = null;
  private escalationTimer: number | null = null;
  private startedAt = 0;
  private options: EngageOptions = {};
  /** Escalation floor raised whenever a silencing attempt is detected. */
  private manualFloor = 0;
  /** Throttles watchdog-driven UI notifications to ~1 per second. */
  private lastEmitAt = 0;
  private wakeLock: { release?: () => Promise<void>; addEventListener?: (t: string, cb: () => void) => void } | null = null;
  private gestureUnlock: (() => void) | null = null;
  private beforeUnload: ((e: BeforeUnloadEvent) => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  // ------------------------------------------------------------------ public

  public getStatus(): VolumeLockStatus {
    return { ...this.status };
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.getStatus(), 'state');
    return () => this.listeners.delete(fn);
  }

  public isActive(): boolean {
    return this.status.active;
  }



  public engage(options: EngageOptions = {}): void {
    if (this.status.active) this.disengage();
    this.options = { escalation: true, haptics: true, ...options };
    this.manualFloor = 0;
    this.status = {
      ...emptyStatus(),
      active: true,
      keyGuardActive: true,
      audioWatchdogActive: true,
    };
    this.startedAt = Date.now();

    this.attachKeyGuard();
    this.attachGestureUnlock();
    this.attachExitGuard();
    this.lockMediaSession();
    this.requestWakeLock();

    this.watchdog = window.setInterval(() => this.tick(), 200);

    if (this.options.escalation) {
      // 0s-solved? -> keep escalating: 30s max gain, 60s add siren, 90s siren+max
      this.escalationTimer = window.setInterval(() => this.escalate(), 1000);
    }

    // Push the alarm bus to full loudness right away when escalation is on.
    audioEngine.forceLoud();
    this.emit('engaged');
  }

  public disengage(): void {
    if (this.watchdog) { clearInterval(this.watchdog); this.watchdog = null; }
    if (this.escalationTimer) { clearInterval(this.escalationTimer); this.escalationTimer = null; }
    this.detachKeyGuard();
    this.detachGestureUnlock();
    this.detachExitGuard();
    this.unlockMediaSession();
    this.releaseWakeLock();
    audioEngine.stopEscalationSiren();
    if ('vibrate' in navigator) {
      try { navigator.vibrate(0); } catch { /* ignore */ }
    }
    this.manualFloor = 0;
    this.status = emptyStatus();
    this.emit('disengaged');
  }

  // -------------------------------------------------------------- key guard

  private handleKey = (e: KeyboardEvent): void => {
    if (!this.status.active) return;
    const code = typeof e.keyCode === 'number' ? e.keyCode : -1;
    const isBlocked =
      BLOCKED_KEYS.has(e.key) ||
      BLOCKED_KEYS.has((e as KeyboardEvent & { code?: string }).code ?? '') ||
      BLOCKED_KEY_CODES.has(code);

    if (!isBlocked) return;

    // Swallow it before the browser / OS media handler can see it.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    this.registerBlockedAttempt('key');
  };

  private attachKeyGuard(): void {
    window.addEventListener('keydown', this.handleKey, true);
    window.addEventListener('keyup', this.handleKey, true);
    window.addEventListener('keypress', this.handleKey, true);
    document.addEventListener('keydown', this.handleKey, true);
    document.addEventListener('keyup', this.handleKey, true);
  }

  private detachKeyGuard(): void {
    window.removeEventListener('keydown', this.handleKey, true);
    window.removeEventListener('keyup', this.handleKey, true);
    window.removeEventListener('keypress', this.handleKey, true);
    document.removeEventListener('keydown', this.handleKey, true);
    document.removeEventListener('keyup', this.handleKey, true);
  }

  // ------------------------------------------------------------- the watchdog

  private tick(): void {
    if (!this.status.active) return;

    const before = this.getStatus();

    this.status.ringingSeconds = Math.round((Date.now() - this.startedAt) / 1000);
    this.status.escalationLevel = audioEngine.getEscalationLevel();

    // 1. Keep the audio graph awake and loud.
    const running = audioEngine.forceLoud();
    this.status.audioWatchdogActive = true;

    // 2. Re-loud any media element something tried to silence.
    let mediaBlocked = false;
    try {
      document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((el) => {
        let changed = false;
        if (el.muted) { el.muted = false; changed = true; }
        if (el.volume < 1) { el.volume = 1; changed = true; }
        if (el.paused && el.currentTime > 0) {
          el.play().catch(() => { /* needs gesture */ });
          changed = true;
        }
        if (changed) mediaBlocked = true;
      });
    } catch { /* ignore */ }

    if (mediaBlocked) this.registerBlockedAttempt('media');
    if (!running) this.emit('recovered');

    // 3. Keep the screen awake so the alarm is visible.
    if (!this.status.wakeLockHeld && document.visibilityState === 'visible') {
      this.requestWakeLock();
    }

    // The watchdog runs 5x/second; only notify the UI when something actually
    // changed, or once per second so the elapsed-time readout stays live.
    const changed =
      before.escalationLevel !== this.status.escalationLevel ||
      before.blockedAttempts !== this.status.blockedAttempts ||
      before.wakeLockHeld !== this.status.wakeLockHeld ||
      before.mediaSessionLocked !== this.status.mediaSessionLocked ||
      before.hapticsActive !== this.status.hapticsActive ||
      before.audioWatchdogActive !== this.status.audioWatchdogActive;

    const now = Date.now();
    if (changed || now - this.lastEmitAt >= 1000) {
      this.lastEmitAt = now;
      this.emit('tick');
    }
  }

  // ------------------------------------------------------------- escalation

  private escalate(): void {
    if (!this.status.active) return;
    const seconds = Math.floor((Date.now() - this.startedAt) / 1000);
    this.status.ringingSeconds = seconds;

    const timeLevel =
      seconds >= 90 ? 3 : seconds >= 60 ? 2 : seconds >= 30 ? 1 : 0;
    // A detected silencing attempt can only ever raise the level, never lower it.
    const level = Math.max(timeLevel, this.manualFloor);

    if (level !== this.status.escalationLevel) {
      this.status.escalationLevel = level;
      audioEngine.setEscalationLevel(level);
      this.emit('escalation');
    }

    if (this.options.haptics && 'vibrate' in navigator) {
      try {
        // Repeat the haptic wake-up pattern at every escalation step.
        navigator.vibrate([600, 200, 600, 200, 1000]);
      } catch { /* ignore */ }
      this.status.hapticsActive = true;
    }
  }

  private registerBlockedAttempt(source: 'key' | 'media'): void {
    this.status.blockedAttempts += 1;
    this.status.lastAttemptAt = Date.now();
    // Bump loudness immediately: the alarm gets louder, not quieter.
    this.manualFloor = Math.max(1, this.manualFloor);
    audioEngine.setEscalationLevel(Math.max(1, audioEngine.getEscalationLevel()));
    this.status.escalationLevel = Math.max(this.status.escalationLevel, 1);

    if (this.options.haptics && 'vibrate' in navigator) {
      try { navigator.vibrate([250, 80, 250, 80, 400]); } catch { /* ignore */ }
    }

    // Let the ringing UI react instantly (toast + shake animation).
    try {
      window.dispatchEvent(new CustomEvent(VOLUME_LOCK_BLOCKED_EVENT, { detail: { source } }));
    } catch { /* ignore */ }

    this.emit(source === 'key' ? 'key-blocked' : 'media-blocked');
  }

  // ---------------------------------------------------------------- MediaSession

  private lockMediaSession(): void {
    if (!('mediaSession' in navigator)) return;

    const reassert = () => {
      audioEngine.forceLoud();
      try { navigator.mediaSession.playbackState = 'playing'; } catch { /* ignore */ }
      this.registerBlockedAttempt('media');
    };

    // Handlers first: hijacking the transport controls matters more than the
    // metadata, and either one may be unsupported on its own.
    let locked = false;
    (['pause', 'stop', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack'] as const).forEach((action) => {
      try {
        navigator.mediaSession.setActionHandler(action, reassert);
        locked = true;
      } catch { /* action unsupported in this browser */ }
    });

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: '🚨 Alarm Ringing — Volume Locked',
        artist: 'Niqu ንቁ',
        album: 'Solve the challenge to dismiss',
      });
    } catch { /* MediaMetadata unsupported */ }

    try { navigator.mediaSession.playbackState = 'playing'; } catch { /* ignore */ }

    this.status.mediaSessionLocked = locked;
  }

  private unlockMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('stop', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.playbackState = 'none';
    } catch { /* ignore */ }
    this.status.mediaSessionLocked = false;
  }

  // ------------------------------------------------------------------- wake lock

  private async requestWakeLock(): Promise<void> {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<typeof this.wakeLock> };
      };
      if (!nav.wakeLock?.request) return;
      const sentinel = await nav.wakeLock.request('screen');
      this.wakeLock = sentinel;
      this.status.wakeLockHeld = true;
      sentinel?.addEventListener?.('release', () => {
        this.status.wakeLockHeld = false;
        this.wakeLock = null;
      });
    } catch { /* not permitted */ }
  }

  private releaseWakeLock(): void {
    try { this.wakeLock?.release?.(); } catch { /* ignore */ }
    this.wakeLock = null;
    this.status.wakeLockHeld = false;
  }

  // --------------------------------------------------------------- autoplay unlock

  /**
   * Browsers only allow audio to start after a gesture. The first press of the
   * volume key (or any tap) is itself a gesture, so we immediately re-assert
   * playback and loudness on it.
   */
  private attachGestureUnlock(): void {
    const handler = () => {
      if (!this.status.active) return;
      audioEngine.forceLoud();
    };
    this.gestureUnlock = handler;
    window.addEventListener('pointerdown', handler, true);
    window.addEventListener('touchstart', handler, true);
    window.addEventListener('keydown', handler, true);
    window.addEventListener('click', handler, true);
    window.addEventListener('focus', handler, true);
  }

  private detachGestureUnlock(): void {
    if (!this.gestureUnlock) return;
    window.removeEventListener('pointerdown', this.gestureUnlock, true);
    window.removeEventListener('touchstart', this.gestureUnlock, true);
    window.removeEventListener('keydown', this.gestureUnlock, true);
    window.removeEventListener('click', this.gestureUnlock, true);
    window.removeEventListener('focus', this.gestureUnlock, true);
    this.gestureUnlock = null;
  }

  // ------------------------------------------------------------------ exit guard

  private attachExitGuard(): void {
    this.beforeUnload = (e: BeforeUnloadEvent) => {
      if (!this.status.active) return;
      e.preventDefault();
      e.returnValue = 'The alarm is still ringing. Complete the challenge first.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', this.beforeUnload);

    this.visibilityHandler = () => {
      if (this.status.active && document.visibilityState === 'visible') {
        audioEngine.forceLoud();
        this.requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private detachExitGuard(): void {
    if (this.beforeUnload) {
      window.removeEventListener('beforeunload', this.beforeUnload);
      this.beforeUnload = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  // --------------------------------------------------------------------- emit

  private emit(event: string): void {
    const snapshot = this.getStatus();
    this.listeners.forEach((fn) => {
      try { fn(snapshot, event); } catch { /* ignore listener errors */ }
    });
  }
}

export const volumeLock = new VolumeLockGuard();
