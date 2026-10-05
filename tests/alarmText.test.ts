/**
 * Runtime harness for the alarm editor's wording helpers.
 *
 * These strings are what the user reads while setting an alarm ("6:00 am", "Tomorrow - Tue, 6 Oct",
 * "Weekdays (Mon-Fri)"), so they are tested rather than eyeballed: 12-hour formatting, the repeat
 * summary, and above all the next-occurrence maths, which must always land strictly in the future
 * and on a selected day.
 */
(async () => {
  const {
    parseAlarmTime,
    formatTime12h,
    toTimeValue,
    shortDayName,
    describeRepeat,
    nextOccurrence,
    nextOccurrenceLabel,
  } = await import('../src/utils/alarmText');

  const results: [string, boolean, string][] = [];
  const check = (name: string, ok: boolean, info = '') => results.push([name, ok, info]);

  const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min, 0, 0);
  const stamp = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}`;

  // --- Parsing and 12-hour display -----------------------------------------
  check('parse: plain', JSON.stringify(parseAlarmTime('06:30')) === JSON.stringify({ hour: 6, minute: 30 }));
  check('parse: single digits', JSON.stringify(parseAlarmTime('7:5')) === JSON.stringify({ hour: 7, minute: 5 }));
  check('parse: junk falls back to 07:00', JSON.stringify(parseAlarmTime('not a time')) === JSON.stringify({ hour: 7, minute: 0 }));
  check('parse: empty falls back to 07:00', parseAlarmTime('').hour === 7 && parseAlarmTime('').minute === 0);
  check('parse: out-of-range falls back', parseAlarmTime('24:00').hour === 7 && parseAlarmTime('06:99').hour === 7);
  check('parse: no NaN anywhere', ['', 'abc', '99:99', '6', '6:', '::'].every((value) => Number.isFinite(parseAlarmTime(value).hour) && Number.isFinite(parseAlarmTime(value).minute)));

  check('display: morning', formatTime12h('06:05').time === '6:05' && formatTime12h('06:05').period === 'am');
  check('display: afternoon', formatTime12h('20:22').time === '8:22' && formatTime12h('20:22').period === 'pm');
  check('display: noon is 12 pm', formatTime12h('12:00').time === '12:00' && formatTime12h('12:00').period === 'pm');
  check('display: midnight is 12 am', formatTime12h('00:00').time === '12:00' && formatTime12h('00:00').period === 'am');
  check('display: minutes are padded', formatTime12h('09:07').time === '9:07');
  check('display: every hour survives', Array.from({ length: 24 }, (_, h) => formatTime12h(`${String(h).padStart(2, '0')}:00`)).every((value, h) => value.time === (h % 12 === 0 ? '12' : String(h % 12)) + ':00' && value.period === (h < 12 ? 'am' : 'pm')));
  check('toTimeValue: round trip', toTimeValue(at(2026, 5, 4, 6, 5)) === '06:05' && toTimeValue(at(2026, 5, 4, 23, 59)) === '23:59');

  check('day names: english', shortDayName(0, 'en') === 'Sun' && shortDayName(6, 'en') === 'Sat');
  check('day names: amharic', shortDayName(1, 'am').length > 0 && shortDayName(1, 'am') !== 'Mon');
  check('day names: out of range is empty', shortDayName(9, 'en') === '');

  // --- Repeat summaries -----------------------------------------------------
  check('repeat: none is Once', describeRepeat([]) === 'Once');
  check('repeat: all seven is Every day', describeRepeat([0, 1, 2, 3, 4, 5, 6]) === 'Every day');
  check('repeat: mon-fri is Weekdays', describeRepeat([1, 2, 3, 4, 5]) === 'Weekdays (Mon-Fri)');
  check('repeat: weekends', describeRepeat([0, 6]) === 'Weekends (Sat-Sun)');
  check('repeat: ordered list, no duplicates', describeRepeat([5, 3, 1, 3]) === 'Mon, Wed, Fri');
  check('repeat: order is by weekday, not input order', describeRepeat([6, 0]) === 'Weekends (Sat-Sun)');
  check('repeat: junk days are ignored', describeRepeat([9, -1]) === 'Once' && describeRepeat([9, 3]) === 'Wed');
  check('repeat: amharic', describeRepeat([]) === 'Once' && describeRepeat([1, 2, 3, 4, 5], 'am').includes('ሰኞ') && describeRepeat([0, 1, 2, 3, 4, 5, 6], 'am') !== 'Every day');

  // --- Next occurrence ------------------------------------------------------
  // Monday 4 May 2026, 05:00 local.
  const mondayEarly = at(2026, 5, 4, 5, 0);
  check('next: later today', stamp(nextOccurrence('06:30', [], mondayEarly)) === '2026-05-04 06:30 Mon');
  check('next: already passed today -> tomorrow', stamp(nextOccurrence('06:30', [], at(2026, 5, 4, 7, 0))) === '2026-05-05 06:30 Tue');
  check('next: exactly now -> tomorrow, never now', stamp(nextOccurrence('06:30', [], at(2026, 5, 4, 6, 30))) === '2026-05-05 06:30 Tue');
  check('next: one-time alarm ignores no days', stamp(nextOccurrence('23:59', [], at(2026, 5, 4, 23, 0))) === '2026-05-04 23:59 Mon');
  check('next: one-time alarm just after midnight', stamp(nextOccurrence('00:05', [], at(2026, 5, 4, 0, 6))) === '2026-05-05 00:05 Tue');

  check('next: repeating skips to the selected day', stamp(nextOccurrence('06:30', [1, 3, 5], at(2026, 5, 4, 12, 0))) === '2026-05-06 06:30 Wed');
  check('next: repeating keeps today when still ahead', stamp(nextOccurrence('18:00', [1, 3, 5], at(2026, 5, 4, 9, 0))) === '2026-05-04 18:00 Mon');
  check('next: repeating wraps a week', stamp(nextOccurrence('06:30', [1], at(2026, 5, 4, 12, 0))) === '2026-05-11 06:30 Mon');
  check('next: sunday is index 0', stamp(nextOccurrence('08:00', [0], at(2026, 5, 9, 12, 0))) === '2026-05-10 08:00 Sun');
  check('next: saturday is index 6', stamp(nextOccurrence('09:15', [6], at(2026, 5, 8, 20, 0))) === '2026-05-09 09:15 Sat');
  check('next: every day behaves like a one-time alarm', stamp(nextOccurrence('06:30', [0, 1, 2, 3, 4, 5, 6], at(2026, 5, 4, 7, 0))) === '2026-05-05 06:30 Tue');
  check('next: always strictly in the future', Array.from({ length: 14 }, (_, ahead) => at(2026, 5, 4 + ahead, 6, 30)).every((now) => nextOccurrence('06:30', [1, 3, 5], now).getTime() > now.getTime()));
  check('next: always lands on a selected day', Array.from({ length: 21 }, (_, ahead) => at(2026, 5, 4 + ahead, 6, 30)).every((now) => [0, 6].includes(nextOccurrence('06:30', [0, 6], now).getDay())));

  // --- The one-line label ---------------------------------------------------
  check('label: today', nextOccurrenceLabel('18:00', [], 'en', mondayEarly) === 'Today - Mon');
  check('label: tomorrow carries the date', nextOccurrenceLabel('06:30', [], 'en', at(2026, 5, 4, 7, 0)) === 'Tomorrow - Tue, 5 May');
  check('label: further out is day plus date', nextOccurrenceLabel('06:30', [1], 'en', at(2026, 5, 4, 12, 0)) === 'Mon, 11 May');
  check('label: amharic today/tomorrow', nextOccurrenceLabel('18:00', [], 'am', mondayEarly).startsWith('ዛሬ') && nextOccurrenceLabel('06:30', [], 'am', at(2026, 5, 4, 7, 0)).startsWith('ነገ'));
  check('label: never says NaN', Array.from({ length: 40 }, (_, i) => at(2026, 1 + (i % 12), 1 + (i % 28), i % 24, i % 60)).every((now) => !nextOccurrenceLabel('06:30', [3], 'en', now).includes('NaN')));

  // --- Report ---------------------------------------------------------------
  let pass = 0;
  for (const [name, ok, info] of results) {
    if (ok) pass++;
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${info ? `  (${info})` : ''}`);
  }
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
})();
