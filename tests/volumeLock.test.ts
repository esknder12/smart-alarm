/**
 * Runtime harness: exercises the strict volume lock with a stubbed browser
 * (window/document/navigator/AudioContext) to prove the escalation ladder,
 * key swallowing, media guard and teardown behave correctly.
 */
const listeners = new Map<string, Set<Function>>();
const timers: any[] = [];

function makeTarget() {
  return {
    addEventListener(type: string, fn: Function) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: Function) {
      listeners.get(type)?.delete(fn);
    },
    dispatch(type: string, event: any) {
      listeners.get(type)?.forEach((fn) => fn(event));
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

const win = makeTarget() as any;
win.setInterval = (fn: Function, ms: number) => {
  const t = setInterval(fn as any, ms);
  timers.push(t);
  return t;
};
win.clearInterval = (t: any) => clearInterval(t);
win.setTimeout = setTimeout;

const doc = makeTarget() as any;
doc.visibilityState = 'visible';
doc.querySelectorAll = () => [];

const mediaHandlers: Record<string, any> = {};
const mediaSession = {
  metadata: null as any,
  playbackState: 'none',
  setActionHandler(name: string, fn: any) {
    mediaHandlers[name] = fn;
  },
};

let vibrations: any[] = [];
const nav: any = {
  mediaSession,
  vibrate: (pattern: any) => {
    vibrations.push(pattern);
    return true;
  },
  wakeLock: { request: async () => ({ release: async () => {} }) },
};

(globalThis as any).window = win;
(globalThis as any).document = doc;
// Node 22 ships a read-only built-in `navigator`, so replace it via defineProperty.
Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });

// --- AudioContext stub ------------------------------------------------------
const param = () => ({
  value: 0,
  setValueAtTime(v: number) { this.value = v; },
  linearRampToValueAtTime(v: number) { this.value = v; },
  exponentialRampToValueAtTime(v: number) { this.value = v; },
  setTargetAtTime(v: number) { this.value = v; },
  cancelScheduledValues() {},
});

const startedOsc: any[] = [];
class FakeOsc {
  type = 'sine';
  frequency = param();
  connect() {}
  disconnect() {}
  start() { startedOsc.push(this); }
  stop() {}
}
class FakeGain {
  gain = param();
  connect() {}
  disconnect() {}
}
class FakeCompressor {
  threshold = param(); knee = param(); ratio = param(); attack = param(); release = param();
  connect() {}
  disconnect() {}
}
class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  createGain() { return new FakeGain() as any; }
  createOscillator() { return new FakeOsc() as any; }
  createDynamicsCompressor() { return new FakeCompressor() as any; }
  createBuffer() { return { getChannelData: () => new Float32Array(10) } as any; }
  createBufferSource() { return { buffer: null, loop: false, connect() {}, start() {}, stop() {} } as any; }
  createBiquadFilter() { return { type: 'lowpass', frequency: param(), connect() {} } as any; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
(globalThis as any).MediaMetadata = class { constructor(m: any) { Object.assign(this, m); } };
(globalThis as any).AudioContext = FakeAudioContext;
(win as any).AudioContext = FakeAudioContext;

// --- Run the test -----------------------------------------------------------
(async () => {
  const { volumeLock } = await import('../src/utils/volumeLock');
  const { audioEngine } = await import('../src/utils/audio');

  const seen: string[] = [];
  volumeLock.subscribe((_s, ev) => seen.push(ev));

  const results: [string, boolean, string][] = [];
  const check = (name: string, ok: boolean, info = '') => results.push([name, ok, info]);

  // Start an alarm like the ringing modal does, then engage the lock.
  audioEngine.startAlarmSound('nuclear', 80, false);
  volumeLock.engage({ volumePercent: 80, escalation: true, haptics: true });

    check('lock engaged', volumeLock.isActive());
  check('browser: native lock reported unavailable (never claims a hardware lock)', volumeLock.getStatus().hardwareKeys === 'unavailable', `hardwareKeys=${volumeLock.getStatus().hardwareKeys}`);
  check('keydown listener installed (window + document)', win.listenerCount('keydown') >= 1 && doc.listenerCount('keydown') >= 1);
  check('MediaSession handlers hijacked', typeof mediaHandlers.pause === 'function' && typeof mediaHandlers.stop === 'function');
  check('base escalation level is 0', (volumeLock.getStatus().escalationLevel === 0), `level=${volumeLock.getStatus().escalationLevel}`);

  // Volume must be applied exactly once (on the bus), not double-scaled.
  const busGain = (audioEngine as any).alarmBus.gain.value;
  check('bus carries the configured volume (80% -> 0.8)', Math.abs(busGain - 0.8) < 0.001, `busGain=${busGain}`);
  check('no double volume scaling on tones (base gain is 1)', (audioEngine as any).alarmBusBaseGain === 0.8, `base=${(audioEngine as any).alarmBusBaseGain}`);

  // 1. Volume-down key must be swallowed.
  let defaultPrevented = false, stopped = false;
  const fakeKeyEvent: any = {
    key: 'AudioVolumeDown', code: 'AudioVolumeDown', keyCode: 174,
    preventDefault: () => { defaultPrevented = true; },
    stopPropagation: () => { stopped = true; },
    stopImmediatePropagation: () => { stopped = true; },
  };
  win.dispatch('keydown', fakeKeyEvent);
  check('volume-down key default prevented', defaultPrevented);
  check('volume-down event propagation stopped', stopped);
  check('blocked attempt counted', volumeLock.getStatus().blockedAttempts === 1, `count=${volumeLock.getStatus().blockedAttempts}`);
  check('attempt escalated loudness immediately', audioEngine.getEscalationLevel() >= 1, `level=${audioEngine.getEscalationLevel()}`);
  check('haptic feedback fired on attempt', vibrations.length > 0);

  // Mute key + Firefox keyCode path
  win.dispatch('keydown', { key: 'VolumeMute', code: '', keyCode: 181, preventDefault: () => { defaultPrevented = true; }, stopPropagation: () => {}, stopImmediatePropagation: () => {} });
  check('mute key also blocked', volumeLock.getStatus().blockedAttempts === 2, `count=${volumeLock.getStatus().blockedAttempts}`);

  // 2. Media pause button (headset / lock screen) must not silence the alarm.
  mediaHandlers.pause();
  check('media pause hijacked -> still locked', volumeLock.isActive() && audioEngine.getEscalationLevel() >= 1);
  check('mediaSession playbackState forced back to playing', mediaSession.playbackState === 'playing');

  // 3. AudioContext suspension is recovered by the watchdog.
  (audioEngine as any).ctx.state = 'suspended';
  const running = audioEngine.forceLoud();
  check('suspended AudioContext resumed by forceLoud', (audioEngine as any).ctx.state === 'running' && running);

  // 4. Escalation ladder over time (simulate 95 s of ringing).
  const start = Date.now();
  (volumeLock as any).startedAt = start - 95_000; // pretend it has been ringing 95s
  (volumeLock as any).escalate();
  check('level 3 (siren + max) after 90 s', volumeLock.getStatus().escalationLevel === 3, `level=${volumeLock.getStatus().escalationLevel}`);
  check('siren oscillators layered in', (audioEngine as any).sirenNodes.length === 2, `sirens=${(audioEngine as any).sirenNodes.length}`);
  check('siren is wailing via LFO', (audioEngine as any).sirenLfo !== null);
  check('ringing seconds tracked', volumeLock.getStatus().ringingSeconds >= 95, `s=${volumeLock.getStatus().ringingSeconds}`);

  // 5. Dismiss releases everything.
  audioEngine.stopAlarmSound();
  volumeLock.disengage();
  check('lock released on dismiss', !volumeLock.isActive());
  check('browser: hardware-key state resets to inactive on dismiss', volumeLock.getStatus().hardwareKeys === 'inactive');
  check('siren stopped on dismiss', (audioEngine as any).sirenNodes.length === 0);
  check('MediaSession handlers released', mediaHandlers.pause === null && mediaHandlers.stop === null);
  check('escalation reset', audioEngine.getEscalationLevel() === 0);
  check('alarm bus torn down', (audioEngine as any).alarmBus === null);

  // 6. Android app: the NATIVE hardware-key lock ------------------------------
  //    A fake plugin stands in for AlarmLockPlugin.java. The physical rocker itself can only be
  //    tested on a phone, but the whole JS <-> native contract is checked here: arming, the
  //    heartbeat that keeps the lease alive, key events, release, failures and stale replies.
  const { setAlarmLockBackend } = await import('../src/utils/alarmLock');
  const { NATIVE_LEASE_MS, NATIVE_HEARTBEAT_MS } = await import('../src/utils/volumeLock');

  type NativeKeyListener = (e: { keyCode: number; key: string; blockedPresses: number }) => void;
  const native = {
    log: [] as string[],
    engageCalls: [] as number[],
    releaseCalls: 0,
    removedListeners: 0,
    listeners: new Set<NativeKeyListener>(),
    failEngage: false,
    failRelease: false,
    failAddListener: false,
    engageGate: null as Promise<void> | null,
    async engage(o: { leaseMs: number }) {
      native.log.push('engage');
      native.engageCalls.push(o.leaseMs);
      if (native.engageGate) await native.engageGate;
      if (native.failEngage) throw new Error('native engage failed');
      return { engaged: true, blockedPresses: 0, leaseRemainingMs: o.leaseMs };
    },
    async release() {
      native.log.push('release');
      native.releaseCalls++;
      if (native.failRelease) throw new Error('native release failed');
      return { engaged: false, blockedPresses: 0, leaseRemainingMs: 0 };
    },
    async getState() {
      return { engaged: true, blockedPresses: 0, leaseRemainingMs: 0 };
    },
    async addListener(_event: string, listener: NativeKeyListener) {
      if (native.failAddListener) throw new Error('native addListener failed');
      native.listeners.add(listener);
      return {
        remove: async () => {
          native.listeners.delete(listener);
          native.removedListeners++;
        },
      };
    },
    /** What the phone does when the user presses a swallowed button. */
    press(key: string, keyCode: number) {
      native.listeners.forEach((l) => l({ key, keyCode, blockedPresses: 1 }));
    },
  };

  const flush = () => new Promise<void>((r) => setImmediate(r));
  const status = () => volumeLock.getStatus();

  // Virtual clock + no real timers: tick() is driven by hand, so the checks are deterministic.
  const realNow = Date.now;
  let skew = 0;
  Date.now = () => realNow() + skew;
  const advance = async (ms: number) => {
    skew += ms;
    (volumeLock as any).tick();
    await flush();
  };
  const realSetInterval = win.setInterval;
  win.setInterval = () => 0;
  const domEvents: any[] = [];
  win.dispatchEvent = (e: any) => {
    domEvents.push(e);
    return true;
  };
  const realWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args); };

  setAlarmLockBackend(native as any);
  vibrations = [];
  audioEngine.startAlarmSound('nuclear', 80, false);
  volumeLock.engage({ volumePercent: 80, escalation: true, haptics: true });

  check('native: lock is "pending" until the phone confirms', status().hardwareKeys === 'pending', `state=${status().hardwareKeys}`);
  await flush();
  check('native: lock confirmed by the phone', status().hardwareKeys === 'locked', `state=${status().hardwareKeys}`);
  check('native: armed exactly once on engage', native.engageCalls.length === 1, `calls=${native.engageCalls.length}`);
  check(
    'native: lease is a whole number inside the range the plugin accepts (2-60 s)',
    Number.isInteger(native.engageCalls[0]) && native.engageCalls[0] >= 2000 && native.engageCalls[0] <= 60000,
    `leaseMs=${native.engageCalls[0]}`
  );
  check('native: heartbeat tolerates >= 2 missed beats per lease', NATIVE_HEARTBEAT_MS * 3 <= NATIVE_LEASE_MS, `beat=${NATIVE_HEARTBEAT_MS} lease=${NATIVE_LEASE_MS}`);
  check('native: subscribed to swallowed-key events', native.listeners.size === 1);

  // The heartbeat keeps the lease alive for as long as the alarm rings.
  await advance(100);
  check('native: no renewal before the heartbeat interval', native.engageCalls.length === 1, `calls=${native.engageCalls.length}`);
  await advance(NATIVE_HEARTBEAT_MS);
  check('native: lease renewed by the heartbeat', native.engageCalls.length === 2, `calls=${native.engageCalls.length}`);
  await advance(NATIVE_HEARTBEAT_MS);
  check('native: ...and keeps being renewed', native.engageCalls.length === 3, `calls=${native.engageCalls.length}`);
  doc.dispatch('visibilitychange', {});
  await flush();
  check('native: renewed at once when the user comes back to the app', native.engageCalls.length === 4, `calls=${native.engageCalls.length}`);

  // A button swallowed natively goes through the same pipeline as a browser-level attempt.
  const attemptsBefore = status().blockedAttempts;
  native.press('volumeDown', 25);
  check('native: swallowed volume-down counts as a blocked attempt', status().blockedAttempts === attemptsBefore + 1, `count=${status().blockedAttempts}`);
  check('native: ...and escalates loudness', audioEngine.getEscalationLevel() >= 1);
  check('native: ...and gives haptic feedback', vibrations.length > 0);
  const lastDetail = () => domEvents[domEvents.length - 1]?.detail;
  check('native: UI event says source=hardware and which key', lastDetail()?.source === 'hardware' && lastDetail()?.key === 'volumeDown', JSON.stringify(lastDetail()));
  native.press('back', 4);
  check('native: a swallowed Back press is reported to the UI as well', lastDetail()?.key === 'back', JSON.stringify(lastDetail()));

  // Failure handling: a broken plugin must neither crash the alarm nor spam the log, and it heals.
  native.failEngage = true;
  await advance(NATIVE_HEARTBEAT_MS);
  check('native: a failed renewal shows as "failed" while the JS guard keeps running', status().hardwareKeys === 'failed' && volumeLock.isActive(), `state=${status().hardwareKeys}`);
  await advance(NATIVE_HEARTBEAT_MS);
  check('native: a failing heartbeat is logged once, not on every beat', warnings.length === 1, `warnings=${warnings.length}`);
  native.failEngage = false;
  await advance(NATIVE_HEARTBEAT_MS);
  check('native: heals on the next heartbeat', status().hardwareKeys === 'locked', `state=${status().hardwareKeys}`);

  // Dismissing the alarm releases the native lock and detaches from it.
  const staleListener = [...native.listeners][0];
  const releasesBefore = native.releaseCalls;
  volumeLock.disengage();
  await flush();
  check('native: release sent when the alarm is dismissed', native.releaseCalls === releasesBefore + 1, `releases=${native.releaseCalls - releasesBefore}`);
  check('native: key subscription removed on dismiss', native.listeners.size === 0 && native.removedListeners >= 1);
  check('native: hardware-key state back to inactive', status().hardwareKeys === 'inactive');
  staleListener({ key: 'volumeDown', keyCode: 25, blockedPresses: 9 });
  check('native: a late event from the finished alarm is ignored', status().blockedAttempts === 0, `count=${status().blockedAttempts}`);
  let threw = false;
  const releasesAfterFirst = native.releaseCalls;
  try { volumeLock.disengage(); volumeLock.disengage(); } catch { threw = true; }
  await flush();
  check('native: repeated disengage() neither throws nor re-sends the release', !threw && native.releaseCalls === releasesAfterFirst, `extra releases=${native.releaseCalls - releasesAfterFirst}`);

  // Dismissed before the phone even answered: the late reply must not revive anything, and the
  // release must be queued behind the engage so the phone's final state is "released".
  let openGate!: () => void;
  native.engageGate = new Promise<void>((r) => { openGate = r; });
  native.log.length = 0;
  volumeLock.engage({ volumePercent: 80 });
  volumeLock.disengage();
  openGate();
  native.engageGate = null;
  await flush();
  check('native: a reply arriving after dismiss does not revive the lock', !volumeLock.isActive() && status().hardwareKeys === 'inactive', `state=${status().hardwareKeys}`);
  check('native: release is queued behind the pending engage', native.log.join(',') === 'engage,release', native.log.join(','));

  // A second alarm after the first works from scratch.
  volumeLock.engage({ volumePercent: 80 });
  await flush();
  check('native: a second alarm engages the lock again', status().hardwareKeys === 'locked' && native.listeners.size === 1, `state=${status().hardwareKeys}`);
  volumeLock.disengage();
  await flush();

  // Plugin hiccups: neither a failing subscription nor a failing release may break the alarm.
  native.failAddListener = true;
  native.failRelease = true;
  volumeLock.engage({ volumePercent: 80 });
  await flush();
  check('native: a failing key subscription does not break the lock', status().hardwareKeys === 'locked', `state=${status().hardwareKeys}`);
  volumeLock.disengage();
  await flush(); // an unhandled rejection from release() would crash the run right here
  check('native: a failing release() is contained (the native lease expiry is the backstop)', !volumeLock.isActive());

  // Restore the harness.
  native.failAddListener = false;
  native.failRelease = false;
  audioEngine.stopAlarmSound();
  setAlarmLockBackend(undefined);
  win.setInterval = realSetInterval;
  Date.now = realNow;
  console.warn = realWarn;

  // Print
  let pass = 0;
  for (const [name, ok, info] of results) {
    if (ok) pass++;
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${info ? `  (${info})` : ''}`);
  }
  console.log(`\n${pass}/${results.length} checks passed`);
  console.log(`events seen: ${[...new Set(seen)].join(', ')}`);
  process.exit(pass === results.length ? 0 : 1);
})();
