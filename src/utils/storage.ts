import { Alarm, RoutineStep, WakeLog, AmbientSound } from '../types';

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

const INITIAL_ROUTINE: RoutineStep[] = [
  { id: 'r1', title: 'Hydrate: Drink 500ml water', durationMinutes: 2, completed: false, category: 'body' },
  { id: 'r2', title: 'Light Sunlight Exposure (Go outside/window)', durationMinutes: 10, completed: false, category: 'body' },
  { id: 'r3', title: '5-Minute Deep Breathing / Meditation', durationMinutes: 5, completed: false, category: 'mind' },
  { id: 'r4', title: 'Review Priorities for Today', durationMinutes: 5, completed: false, category: 'prep' },
  { id: 'r5', title: 'Healthy Protein Breakfast & Coffee', durationMinutes: 15, completed: false, category: 'fuel' }
];

const INITIAL_LOGS: WakeLog[] = [
  { id: 'l1', date: '2026-07-30', wakeTime: '06:31', targetTime: '06:30', feeling: 'refreshed', onTime: true, routineCompletedPct: 100 },
  { id: 'l2', date: '2026-07-29', wakeTime: '06:30', targetTime: '06:30', feeling: 'energetic', onTime: true, routineCompletedPct: 80 },
  { id: 'l3', date: '2026-07-28', wakeTime: '06:42', targetTime: '06:30', feeling: 'groggy', onTime: false, routineCompletedPct: 60 },
  { id: 'l4', date: '2026-07-27', wakeTime: '06:30', targetTime: '06:30', feeling: 'refreshed', onTime: true, routineCompletedPct: 100 }
];

const INITIAL_AMBIENTS: AmbientSound[] = [
  { id: 'a1', name: 'Forest Rain', iconName: 'CloudRain', type: 'rain', isPlaying: false, volume: 50 },
  { id: 'a2', name: 'Ocean Waves', iconName: 'Waves', type: 'waves', isPlaying: false, volume: 45 },
  { id: 'a3', name: 'Morning Birds', iconName: 'Trees', type: 'forest', isPlaying: false, volume: 40 },
  { id: 'a4', name: 'Deep Focus White Noise', iconName: 'Wind', type: 'whitenoise', isPlaying: false, volume: 30 },
  { id: 'a5', name: '432Hz Binaural Awakening', iconName: 'Sparkles', type: 'binaural', isPlaying: false, volume: 35 }
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

export const loadRoutine = (): RoutineStep[] => {
  try {
    const saved = localStorage.getItem('wakeup_routine');
    return saved ? JSON.parse(saved) : INITIAL_ROUTINE;
  } catch {
    return INITIAL_ROUTINE;
  }
};

export const saveRoutine = (routine: RoutineStep[]) => {
  localStorage.setItem('wakeup_routine', JSON.stringify(routine));
};

export const loadLogs = (): WakeLog[] => {
  try {
    const saved = localStorage.getItem('wakeup_logs');
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  } catch {
    return INITIAL_LOGS;
  }
};

export const saveLogs = (logs: WakeLog[]) => {
  localStorage.setItem('wakeup_logs', JSON.stringify(logs));
};

export const loadAmbients = (): AmbientSound[] => {
  try {
    const saved = localStorage.getItem('wakeup_ambients');
    return saved ? JSON.parse(saved) : INITIAL_AMBIENTS;
  } catch {
    return INITIAL_AMBIENTS;
  }
};

export const saveAmbients = (ambients: AmbientSound[]) => {
  localStorage.setItem('wakeup_ambients', JSON.stringify(ambients));
};
