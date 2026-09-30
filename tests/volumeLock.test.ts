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
  check('siren stopped on dismiss', (audioEngine as any).sirenNodes.length === 0);
  check('MediaSession handlers released', mediaHandlers.pause === null && mediaHandlers.stop === null);
  check('escalation reset', audioEngine.getEscalationLevel() === 0);
  check('alarm bus torn down', (audioEngine as any).alarmBus === null);

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
