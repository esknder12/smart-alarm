/**
 * First-run state for the mandatory "set your first alarm" wizard.
 *
 * The app ships with two demo alarms, so "the alarm list is empty" cannot be the signal that
 * somebody is new - `hasUserSetOwnAlarm` (in storage.ts) is. A user is considered new until they
 * either finish the wizard or already own an alarm they set themselves, which is what
 * `shouldShowFirstRunAlarmSetup` decides. The flag is only written once the alarm really exists,
 * so quitting halfway through the wizard brings it back on the next launch.
 */

import type { Alarm, ChallengeType, SoundType, WallpaperId } from '../types';

export const FIRST_RUN_FLAG = 'niqu_first_alarm_set';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

let store: KeyValueStore | null | undefined;

function defaultStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null; // storage can be blocked entirely (private mode, embedded webviews)
  }
}

function currentStore(): KeyValueStore | null {
  if (store === undefined) store = defaultStore();
  return store;
}

/** Test seam, mirroring `setAlarmSchedulerBackend`: pass `undefined` to go back to real storage. */
export function setFirstRunStorage(next: KeyValueStore | null | undefined): void {
  store = next;
}

export interface FirstRunInputs {
  /** The wizard was finished before (the flag is in storage). */
  completed: boolean;
  /** The alarm list already contains an alarm the user set themselves. */
  hasOwnAlarm: boolean;
}

/** True while the very first thing the app must do is let the user set an alarm. */
export function shouldShowFirstRunAlarmSetup({ completed, hasOwnAlarm }: FirstRunInputs): boolean {
  return !completed && !hasOwnAlarm;
}

/** Only the exact stored value counts, so a half-written or foreign value re-runs the wizard. */
export function hasCompletedFirstRun(): boolean {
  try {
    return currentStore()?.getItem(FIRST_RUN_FLAG) === 'true';
  } catch {
    return false;
  }
}

/**
 * Remembers that the wizard is done. Returns false when it could not be stored (storage blocked) -
 * that is not an error worth interrupting the user for: the alarm they just set is the real record,
 * and `hasOwnAlarm` will keep the wizard away on the next launch.
 */
export function markFirstRunComplete(): boolean {
  try {
    const target = currentStore();
    if (!target) return false; // nowhere to write: report it instead of pretending it worked
    target.setItem(FIRST_RUN_FLAG, 'true');
    return true;
  } catch {
    return false;
  }
}

/** Everything the wizard collects before an alarm exists. */
export interface FirstAlarmDraft {
  /** The hour as typed in the 12-hour field ('7', '07'); the wizard keeps it as text. */
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
  mission: ChallengeType;
  sound: SoundType;
  volume: number;
  gentleWakeUp: boolean;
  wallpaper: WallpaperId;
}

const clampInt = (value: string, min: number, max: number, fallback: number): number => {
  const parsed = parseInt((value ?? '').trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

/**
 * Turn the wizard's answers into the alarm that gets saved. The time is the part that matters -
 * 12:00 AM is midnight and 12:00 PM is noon - and a garbled field must still produce a sane alarm
 * rather than one at an impossible hour, because this alarm is the only record of what the user set.
 */
export function buildFirstAlarm(draft: FirstAlarmDraft): Omit<Alarm, 'id' | 'snoozeCount'> {
  const twelveHour = clampInt(draft.hour, 1, 12, 7);
  const minute = clampInt(draft.minute, 0, 59, 0);
  const period = draft.period === 'PM' ? 'PM' : 'AM';

  let hour24 = twelveHour % 12; // 12 AM -> 0
  if (period === 'PM') hour24 += 12; // 12 PM -> 12

  const time = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    time,
    label: 'Daily Motivation Alert',
    enabled: true,
    repeatDays: [1, 2, 3, 4, 5], // weekdays, matching the wizard's promise
    sound: draft.sound,
    volume: Math.min(100, Math.max(0, Math.round(draft.volume))),
    gentleWakeUp: draft.gentleWakeUp,
    wallpaper: draft.wallpaper,
    challenge: draft.mission,
    challengeDifficulty: 'easy',
  };
}
