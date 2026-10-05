import { audioEngine } from './audio';
import { nativeAlarmLock, type HardwareKey } from './alarmLock';

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
 *  8. Android app only: the NATIVE hardware-key lock (see below).
 *
 * HARDWARE BUTTONS
 * The phone's physical volume rocker never reaches a web page: Android's WebView
 * hands it straight to the system mixer, so no JavaScript can block it. In the
 * Android app that job is done natively - while this guard is engaged it keeps
 * a short native lease alive (alarmLock.ts -> AlarmLockPlugin.java), and for as
 * long as the lease lives MainActivity swallows volume-down / volume-up / mute
 * and Back before the system sees them. The lease is renewed from tick(); if
 * this page dies the buttons come back by themselves.
 *
 * Points 1-7 stay as the fallback for browsers - where the physical keys cannot
 * be blocked at all - and as defence in depth: loudness and haptics escalate so
 * an alarm that somehow got turned down is still audible.
 *
 * What no app can block: Home, Recents and the power button, and the volume
 * keys while the screen is off or another window has focus (system handles them).
 */

/**
 * State of the native (Android) hardware-key lock:
 *  - inactive:    no alarm is ringing
 *  - unavailable: not running in the Android app (browser / dev server) - the physical keys cannot be blocked
 *  - pending:     engaging, waiting for the native side to confirm
 *  - locked:      confirmed - volume keys and Back are being swallowed natively
 *  - failed:      the native side did not confirm (retried on every heartbeat)
 */
export type HardwareKeysState = 'inactive' | 'unavailable' | 'pending' | 'locked' | 'failed';

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
  /** Native hardware-key lock (volume keys + Back); only ever `locked` inside the Android app. */
  hardwareKeys: HardwareKeysState;
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
    hardwareKeys: 'inactive',
  };
}

type Listener = (status: VolumeLockStatus, event: string) => void;

/**
 * How long the native lock survives without a renewal, and how often we renew it. The ratio
 * tolerates ~3 missed heartbeats (a slow frame, a throttled background timer) before the
 * buttons would come back; a dead page releases them within one lease.
 */
export const NATIVE_LEASE_MS = 6000;
export const NATIVE_HEARTBEAT_MS = 1500;

/** DOM event fired on `window` whenever a silencing attempt is blocked. */
export const VOLUME_LOCK_BLOCKED_EVENT = 'niqu-volume-lock-blocked';

/** `detail` of {@link VOLUME_LOCK_BLOCKED_EVENT}. */
export interface VolumeLockBlockedDetail {
  /** `hardware` = a physical button swallowed by the native lock; `key`/`media` = browser-level guards. */
  source: 'key' | 'media' | 'hardware';
  /** Which physical button, for `hardware` attempts. */
  key?: HardwareKey;
}

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
  /** Bumped on every engage/disengage so late native replies from an old session are ignored. */
  private nativeSession = 0;
  private lastNativeBeatAt = 0;
  private unlistenNative: (() => void) | null = null;
  /** True from engage() until its release has been sent, so a repeated disengage() sends nothing. */
  private nativeArmed = false;

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

    // Android app: arm the native lock that swallows the physical volume keys and Back.
    this.engageNativeLock();
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
    this.releaseNativeLock();
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

    // 4. Heartbeat for the native hardware-key lease (no-op outside the Android app). If these
    //    renewals ever stop, the native side lets go of the buttons on its own.
    if (Date.now() - this.lastNativeBeatAt >= NATIVE_HEARTBEAT_MS) this.renewNativeLock();

    // The watchdog runs 5x/second; only notify the UI when something actually
    // changed, or once per second so the elapsed-time readout stays live.
    const changed =
      before.escalationLevel !== this.status.escalationLevel ||
      before.blockedAttempts !== this.status.blockedAttempts ||
      before.wakeLockHeld !== this.status.wakeLockHeld ||
      before.mediaSessionLocked !== this.status.mediaSessionLocked ||
      before.hapticsActive !== this.status.hapticsActive ||
      before.audioWatchdogActive !== this.status.audioWatchdogActive ||
      before.hardwareKeys !== this.status.hardwareKeys;

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

  private registerBlockedAttempt(source: VolumeLockBlockedDetail['source'], key?: HardwareKey): void {
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
      window.dispatchEvent(
        new CustomEvent<VolumeLockBlockedDetail>(VOLUME_LOCK_BLOCKED_EVENT, { detail: { source, key } })
      );
    } catch { /* ignore */ }

    this.emit(source === 'key' ? 'key-blocked' : source === 'media' ? 'media-blocked' : 'hardware-blocked');
  }

  // ------------------------------------------------- native hardware-key lock

  /** Starts a native lock session (Android app only). Called once per engage(). */
  private engageNativeLock(): void {
    const session = ++this.nativeSession;
    this.lastNativeBeatAt = 0;

    if (!nativeAlarmLock.isAvailable()) {
      this.status.hardwareKeys = 'unavailable';
      return;
    }
    this.status.hardwareKeys = 'pending';
    this.nativeArmed = true;

    // Physical presses swallowed natively feed the same pipeline as browser-level attempts:
    // loudness bump, haptics, and the toast in the ringing UI.
    nativeAlarmLock
      .onKeyBlocked((event) => {
        if (session === this.nativeSession) this.registerBlockedAttempt('hardware', event.key);
      })
      .then((unlisten) => {
        if (session === this.nativeSession && this.status.active) this.unlistenNative = unlisten;
        else unlisten(); // the alarm ended while we were still subscribing
      })
      .catch((err) => console.warn('[volumeLock] could not subscribe to native key events', err));

    this.renewNativeLock();
  }

  /** (Re)arms the native lease: on engage, from the tick() heartbeat, and on returning to the app. */
  private renewNativeLock(): void {
    if (!this.status.active || !nativeAlarmLock.isAvailable()) return;
    const session = this.nativeSession;
    this.lastNativeBeatAt = Date.now();
    nativeAlarmLock.engage(NATIVE_LEASE_MS).then(
      (state) => this.setHardwareKeys(session, state.engaged ? 'locked' : 'failed'),
      (err) => {
        // A failing heartbeat is retried every beat; only log the first failure.
        if (this.status.hardwareKeys !== 'failed') console.warn('[volumeLock] native hardware-key lock failed', err);
        this.setHardwareKeys(session, 'failed');
      }
    );
  }

  private setHardwareKeys(session: number, next: HardwareKeysState): void {
    // Replies that belong to an alarm session which has already ended must not touch the status.
    if (session !== this.nativeSession || !this.status.active) return;
    if (this.status.hardwareKeys === next) return;
    this.status.hardwareKeys = next;
    this.emit('hardware-keys');
  }

  /** Ends the native lock session. Safe to call repeatedly, and when no lock was ever engaged. */
  private releaseNativeLock(): void {
    this.nativeSession++; // from now on, every in-flight reply and event of the old session is ignored
    if (this.unlistenNative) {
      this.unlistenNative();
      this.unlistenNative = null;
    }
    if (!this.nativeArmed) return; // nothing engaged by this session, or already released
    this.nativeArmed = false;
    // If this call is somehow lost, the native lease lapses by itself within NATIVE_LEASE_MS.
    nativeAlarmLock.release().catch((err) => console.warn('[volumeLock] native release failed', err));
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
        this.renewNativeLock();
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
