/**
 * Small display helpers for alarm times and repeat rules.
 *
 * Kept apart from the components so the wording ("Tomorrow - Tue, 6 Oct", "Weekdays") is one
 * implementation for the editor, the alarm cards and the tests. Repeat days use the same
 * convention as the rest of the app and the native planner: 0 = Sunday ... 6 = Saturday.
 */

const DAY_INDEX_OF_JS_DAY = [0, 1, 2, 3, 4, 5, 6]; // JS getDay() is already 0 = Sunday

export interface Time12h {
  time: string; // '6:00'
  period: 'am' | 'pm';
}

/** 'HH:mm' -> parts. Junk input falls back to 07:00 rather than producing NaN. */
export function parseAlarmTime(time: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec((time ?? '').trim());
  if (!match) return { hour: 7, minute: 0 };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return { hour: 7, minute: 0 };
  }
  return { hour, minute };
}

/** '06:05' -> { time: '6:05', period: 'am' } */
export function formatTime12h(time: string): Time12h {
  const { hour, minute } = parseAlarmTime(time);
  const period: 'am' | 'pm' = hour >= 12 ? 'pm' : 'am';
  let display = hour % 12;
  if (display === 0) display = 12;
  return { time: `${display}:${String(minute).padStart(2, '0')}`, period };
}

/** 'HH:mm' back out of a Date, for the tap-to-edit input. */
export function toTimeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const SHORT_DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_DAYS_AM = ['እሁድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDayName(dayIndex: number, language: 'en' | 'am' = 'en'): string {
  const names = language === 'am' ? SHORT_DAYS_AM : SHORT_DAYS_EN;
  return names[dayIndex] ?? '';
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

const sameDays = (days: number[], wanted: number[]) =>
  days.length === wanted.length && wanted.every((day) => days.includes(day));

/** The list of repeat days as one human line: 'Once', 'Every day', 'Weekdays (Mon-Fri)', 'Mon, Wed'. */
export function describeRepeat(days: number[], language: 'en' | 'am' = 'en'): string {
  const sorted = [...new Set(days)].filter((day) => day >= 0 && day <= 6).sort();
  if (sorted.length === 0) return language === 'am' ? 'አንድ ጊዜ' : 'Once';
  if (sorted.length === 7) return language === 'am' ? 'በየቀኑ' : 'Every day';
  if (language === 'en') {
    if (sameDays(sorted, WEEKDAYS)) return 'Weekdays (Mon-Fri)';
    if (sameDays(sorted, WEEKEND)) return 'Weekends (Sat-Sun)';
  } else {
    if (sameDays(sorted, WEEKDAYS)) return 'የስራ ቀናት (ሰኞ-ዓርብ)';
    if (sameDays(sorted, WEEKEND)) return 'የእረፍት ቀናት (ቅዳሜ-እሁድ)';
  }
  return sorted.map((day) => shortDayName(day, language)).join(', ');
}

/**
 * The next moment this alarm fires, strictly after `now`. One-time alarms (no repeat days) fire at
 * their next daily occurrence; repeating alarms skip forward to the next selected weekday.
 */
export function nextOccurrence(time: string, days: number[], now: Date = new Date()): Date {
  const { hour, minute } = parseAlarmTime(time);
  const sorted = [...new Set(days)].filter((day) => day >= 0 && day <= 6);
  for (let ahead = 0; ahead <= 7; ahead++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + ahead);
    candidate.setHours(hour, minute, 0, 0);
    if (candidate.getTime() <= now.getTime()) continue;
    if (sorted.length > 0 && !sorted.includes(DAY_INDEX_OF_JS_DAY[candidate.getDay()])) continue;
    return candidate;
  }
  // Unreachable for valid input; keeps the return type honest.
  const fallback = new Date(now);
  fallback.setDate(now.getDate() + 1);
  fallback.setHours(hour, minute, 0, 0);
  return fallback;
}

/** 'Today - Mon, 5 Oct' / 'Tomorrow - Tue, 6 Oct' / 'Mon, 12 Oct' for further out. */
export function nextOccurrenceLabel(time: string, days: number[], language: 'en' | 'am' = 'en', now: Date = new Date()): string {
  const when = nextOccurrence(time, days, now);
  // Compare calendar days, not elapsed hours: 18:00 seen from 05:00 is "Today", not "Tomorrow".
  // Round (not floor) so a DST day of 23 or 25 hours still counts as one day.
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(when) - startOfDay(now)) / 86_400_000);
  const datePart = `${when.getDate()} ${MONTHS_EN[when.getMonth()]}`;
  const dayName = shortDayName(when.getDay(), language);
  if (language === 'am') {
    if (dayDiff === 0) return `ዛሬ - ${dayName}`;
    if (dayDiff === 1) return `ነገ - ${dayName}`;
    return `${dayName}, ${datePart}`;
  }
  if (dayDiff === 0) return `Today - ${dayName}`;
  if (dayDiff === 1) return `Tomorrow - ${dayName}, ${datePart}`;
  return `${dayName}, ${datePart}`;
}
