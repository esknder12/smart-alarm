import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { Alarm, ChallengeType } from '../types';

/**
 * Bridge to the native alarm engine of the Android app (Phase 2).
 *
 * Why this exists: a web page cannot ring when it is not running. The Android build therefore
 * mirrors every alarm into `AlarmManager` as an exact alarm
 * (android/app/src/main/java/com/esknder/niqu/AlarmScheduler.java). When one fires, a foreground
 * service rings (audio on the alarm stream, vibration, escalation), posts a full-screen
 * notification that brings the puzzle up over the lock screen, and holds the volume-key block
 * through `RingSession` - see android/app/src/main/java/com/esknder/niqu/AlarmRingService.java and
 * AlarmKeyLock.java. This module is the web half of that contract:
 *
 *  - `sync(alarms)`          - mirror the alarm list into the phone's scheduler (called on change)
 *  - `getState()`            - armed alarms, permissions, device model, current ring
 *  - `onAlarmTriggered(cb)`  - a native ring started: open the puzzle, even on a cold start
 *  - `stopRing()`            - the puzzle was solved: end the ring and release the key lock
 *  - `takeOverRing()`        - the app is playing the alarm: silence the service's own tone
 *
 * In a plain browser (dev server, PWA) the plugin does not exist: `isAvailable()` is false, every
 * call resolves with `available: false`, and the JS alarm timer in App.tsx keeps working exactly as
 * before. Nothing here throws - the ring must never depend on a plugin call succeeding.
 */

const PLUGIN_NAME = 'AlarmScheduler';

/** One alarm as the native scheduler wants it: a flat, JSON-friendly shape. */
export interface NativeAlarm {
  id: string;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday; empty means every day (same as the web matcher). */
  days: number[];
  label: string;
  sound: string;
  volume: number;
  gentleWakeUp: boolean;
  challenge: ChallengeType;
  challengeDifficulty: Alarm['challengeDifficulty'];
  enabled: boolean;
}

/** What the native side is ringing right now. */
export interface RingingAlarmInfo {
  alarmId: string;
  label: string;
  /** "HH:mm" in the phone's own time zone. */
  time: string;
  hour: number;
  minute: number;
  sound: string;
  volume: number;
  gentleWakeUp: boolean;
  challenge: ChallengeType;
  challengeDifficulty: Alarm['challengeDifficulty'];
  /** Epoch millis when the ring started. */
  startedAt: number;
  ringingSeconds: number;
}

/** The phone's real scheduling state; also the answer to "will my alarm actually ring?". */
export interface AlarmScheduleState {
  /** False in a browser, or when the Android plugin is missing - everything else is then a stub. */
  available: boolean;
  /** How many enabled alarms AlarmManager has armed. */
  scheduledCount: number;
  /** Epoch millis of the next alarm, or -1 when nothing is scheduled. */
  nextTriggerAt: number;
  nextAlarmId: string | null;
  /** False on Android 12 without the permission: alarms still fire, but not to the minute. */
  exactAlarmsAllowed: boolean;
  notificationsAllowed: boolean;
  /** Android 14+ lets the user switch the full-screen (over-the-lock-screen) notification off. */
  fullScreenIntentAllowed: boolean;
  /** SYSTEM_ALERT_WINDOW / “Appear on top” — alarm can come in front of other apps. */
  overlayAllowed: boolean;
  /** e.g. "samsung SM-A155F" - shown in the reliability panel so device bugs are reportable. */
  deviceModel: string;
  sdkInt: number;
  ringing: RingingAlarmInfo | null;
  /** True while the volume keys & Back are swallowed. */
  keyBlockEngaged: boolean;
  /** True when the ringing service (not the page's own lease) is holding the block. */
  keyBlockHeldByService: boolean;
  /** Button presses swallowed during the current ring; 0 when the app was not in the foreground. */
  blockedPresses: number;
}

export interface AlarmSchedulerBackend {
  sync(options: { alarms: NativeAlarm[] }): Promise<Partial<AlarmScheduleState>>;
  cancel(options: { id: string }): Promise<Partial<AlarmScheduleState>>;
  cancelAll(): Promise<Partial<AlarmScheduleState>>;
  getState(): Promise<Partial<AlarmScheduleState>>;
  takeOverRing(): Promise<Partial<AlarmScheduleState>>;
  stopRing(): Promise<Partial<AlarmScheduleState>>;
  openSettings(options: { target: 'exactAlarm' | 'fullScreenIntent' }): Promise<void>;
  requestPermissions(options?: { permissions?: string[] }): Promise<Record<string, string> | void>;
  addListener(eventName: 'alarmTriggered', listener: (event: RingingAlarmInfo) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'ringStopped', listener: (event: unknown) => void): Promise<PluginListenerHandle>;
}

/** What a browser (or a failed plugin call) reports: nothing is armed natively. */
export function unavailableState(): AlarmScheduleState {
  return {
    available: false,
    scheduledCount: 0,
    nextTriggerAt: -1,
    nextAlarmId: null,
    exactAlarmsAllowed: false,
    notificationsAllowed: false,
    fullScreenIntentAllowed: false,
    overlayAllowed: false,
    deviceModel: '',
    sdkInt: 0,
    ringing: null,
    keyBlockEngaged: false,
    keyBlockHeldByService: false,
    blockedPresses: 0,
  };
}

// undefined = not resolved yet, null = no native scheduler on this platform.
let backend: AlarmSchedulerBackend | null | undefined;

function getBackend(): AlarmSchedulerBackend | null {
  if (backend === undefined) {
    // registerPlugin() must only run once per plugin name, hence the cache.
    backend =
      Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(PLUGIN_NAME)
        ? registerPlugin<AlarmSchedulerBackend>(PLUGIN_NAME)
        : null;
  }
  return backend;
}

/**
 * Test seam: swap in a fake backend (or `null` to simulate a browser). Pass `undefined` to go back
 * to detecting the real platform.
 */
export function setAlarmSchedulerBackend(next: AlarmSchedulerBackend | null | undefined): void {
  backend = next;
}

// --------------------------------------------------------------------------------- pure helpers

/** "06:30" -> { hour: 6, minute: 30 }; anything unparseable becomes midnight. */
export function parseAlarmTime(time: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim());
  if (!match) return { hour: 0, minute: 0 };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return { hour: 0, minute: 0 };
  }
  return { hour, minute };
}

/** Turns one web alarm into the flat shape the native scheduler reads. */
export function toNativeAlarm(alarm: Alarm): NativeAlarm {
  const { hour, minute } = parseAlarmTime(alarm.time);
  const days = Array.from(new Set((alarm.repeatDays ?? []).filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b);
  return {
    id: String(alarm.id),
    hour,
    minute,
    days,
    label: alarm.label ?? '',
    sound: alarm.sound ?? 'sunrise',
    volume: Math.max(0, Math.min(100, Math.round(alarm.volume ?? 80))),
    gentleWakeUp: Boolean(alarm.gentleWakeUp),
    challenge: alarm.challenge ?? 'math',
    challengeDifficulty: alarm.challengeDifficulty ?? 'easy',
    enabled: Boolean(alarm.enabled),
  };
}

export function toNativeAlarms(alarms: Alarm[]): NativeAlarm[] {
  return (alarms ?? []).filter(Boolean).map(toNativeAlarm);
}

/**
 * The alarm to put on the ringing screen for a native ring: the stored alarm when it still exists
 * (so its wallpaper, tone and mission come along), otherwise one rebuilt from the native payload -
 * a ring started while the app was closed must open the puzzle even if local storage was cleared.
 */
export function alarmFromRingInfo(info: RingingAlarmInfo, alarms: Alarm[]): Alarm {
  const stored = (alarms ?? []).find((alarm) => String(alarm.id) === String(info.alarmId));
  if (stored) return stored;
  return {
    id: String(info.alarmId),
    time: info.time,
    label: info.label || 'Alarm',
    enabled: true,
    repeatDays: [],
    sound: (info.sound || 'sunrise') as Alarm['sound'],
    volume: info.volume ?? 80,
    gentleWakeUp: Boolean(info.gentleWakeUp),
    snoozeCount: 0,
    challenge: info.challenge ?? 'math',
    challengeDifficulty: info.challengeDifficulty ?? 'easy',
  };
}

function normalise(state: Partial<AlarmScheduleState> | null | undefined): AlarmScheduleState {
  return { ...unavailableState(), available: true, ...(state ?? {}) };
}

// ------------------------------------------------------------------------------------ the API

export const nativeAlarmScheduler = {
  /** True only inside the Android app, where alarms can really ring with the app closed. */
  isAvailable(): boolean {
    return getBackend() !== null;
  },

  /** Mirrors the alarm list into the phone's scheduler. Never rejects. */
  async sync(alarms: Alarm[]): Promise<AlarmScheduleState> {
    const native = getBackend();
    if (!native) return unavailableState();
    try {
      return normalise(await native.sync({ alarms: toNativeAlarms(alarms) }));
    } catch (error) {
      console.warn('[alarmScheduler] sync failed', error);
      return unavailableState();
    }
  },

  async cancel(id: string): Promise<AlarmScheduleState> {
    const native = getBackend();
    if (!native) return unavailableState();
    try {
      return normalise(await native.cancel({ id }));
    } catch (error) {
      console.warn('[alarmScheduler] cancel failed', error);
      return unavailableState();
    }
  },

  async cancelAll(): Promise<AlarmScheduleState> {
    const native = getBackend();
    if (!native) return unavailableState();
    try {
      return normalise(await native.cancelAll());
    } catch (error) {
      console.warn('[alarmScheduler] cancelAll failed', error);
      return unavailableState();
    }
  },

  /** What the phone really has armed right now (permissions, next trigger, current ring). */
  async getState(): Promise<AlarmScheduleState> {
    const native = getBackend();
    if (!native) return unavailableState();
    try {
      return normalise(await native.getState());
    } catch (error) {
      console.warn('[alarmScheduler] getState failed', error);
      return unavailableState();
    }
  },

  /** The app is playing the alarm itself; silence the service's tone (notification stays). */
  async takeOverRing(): Promise<AlarmScheduleState> {
    const native = getBackend();
    if (!native) return unavailableState();
    try {
      return normalise(await native.takeOverRing());
    } catch (error) {
      console.warn('[alarmScheduler] takeOverRing failed', error);
      return unavailableState();
    }
  },

  /** The puzzle is solved: end the ring, drop the notification and release the hardware keys. */
  async stopRing(): Promise<AlarmScheduleState> {
    const native = getBackend();
    if (!native) return unavailableState();
    try {
      return normalise(await native.stopRing());
    } catch (error) {
      console.warn('[alarmScheduler] stopRing failed', error);
      return unavailableState();
    }
  },

  /** Opens the Android screen where exact alarms / full-screen notifications are granted. */
  async openSettings(target: 'exactAlarm' | 'fullScreenIntent' | 'overlay'): Promise<boolean> {
    const native = getBackend();
    if (!native) return false;
    try {
      await native.openSettings({ target });
      return true;
    } catch (error) {
      console.warn('[alarmScheduler] openSettings failed', error);
      return false;
    }
  },

  /** Asks for POST_NOTIFICATIONS (Android 13+); resolves with the granted/denied map. */
  async requestNotificationPermission(): Promise<boolean> {
    const native = getBackend();
    if (!native) return false;
    try {
      const result = await native.requestPermissions({ permissions: ['notifications'] });
      const state = await native.getState();
      if (typeof result === 'object' && result !== null && 'notifications' in result) {
        return result.notifications === 'granted';
      }
      return Boolean(state?.notificationsAllowed);
    } catch (error) {
      console.warn('[alarmScheduler] requestNotificationPermission failed', error);
      return false;
    }
  },

  /**
   * Subscribes to native rings. Resolves with an unsubscribe function (a no-op in a browser).
   * The payload is the ringing alarm, so the caller can open the puzzle immediately.
   */
  async onAlarmTriggered(listener: (event: RingingAlarmInfo) => void): Promise<() => void> {
    const native = getBackend();
    if (!native) return () => {};
    try {
      const handle = await native.addListener('alarmTriggered', listener);
      return () => {
        void Promise.resolve(handle.remove()).catch(() => {});
      };
    } catch (error) {
      console.warn('[alarmScheduler] could not subscribe to alarmTriggered', error);
      return () => {};
    }
  },

  /** Subscribes to the end of a native ring (it also ends by itself after 30 minutes). */
  async onRingStopped(listener: () => void): Promise<() => void> {
    const native = getBackend();
    if (!native) return () => {};
    try {
      const handle = await native.addListener('ringStopped', listener);
      return () => {
        void Promise.resolve(handle.remove()).catch(() => {});
      };
    } catch (error) {
      console.warn('[alarmScheduler] could not subscribe to ringStopped', error);
      return () => {};
    }
  },
};
