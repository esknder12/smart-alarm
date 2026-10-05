import { Alarm } from '../types';

const INITIAL_ALARMS: Alarm[] = [
  {
    id: '1',
    time: '06:30',
    label: 'Morning Rise & Shine',
    enabled: true,
    repeatDays: [1, 2, 3, 4, 5], // Mon-Fri
    sound: 'sunrise',
    volume: 80,
    snoozeCount: 0,
    challenge: 'math',
    challengeDifficulty: 'easy'
  },
  {
    id: '2',
    time: '07:15',
    label: 'Weekend Workout Wakeup',
    enabled: false,
    repeatDays: [0, 6], // Sat, Sun
    sound: 'chime',
    volume: 75,
    snoozeCount: 0,
    challenge: 'typing',
    challengeDifficulty: 'easy'
  }
];

/**
 * True once the alarm list holds an alarm the user created, as opposed to the demo alarms every
 * fresh install starts with. The first-run wizard uses this (plus its own flag) to decide whether
 * the user still has to set an alarm - see utils/firstRun.ts.
 */
export const hasUserSetOwnAlarm = (alarms: Alarm[]): boolean => {
  const seeded = new Set<string>(INITIAL_ALARMS.map((alarm) => alarm.id));
  return alarms.some((alarm) => !seeded.has(alarm.id));
};

export const loadAlarms = (): Alarm[] => {
  try {
    const saved = localStorage.getItem('wakeup_alarms');
    return saved ? JSON.parse(saved) : INITIAL_ALARMS;
  } catch {
    return INITIAL_ALARMS;
  }
};

export const saveAlarms = (alarms: Alarm[]) => {
  localStorage.setItem('wakeup_alarms', JSON.stringify(alarms));
};
