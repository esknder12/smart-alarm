/**
 * Render harness for the single-screen alarm setup flow.
 *
 * The time is edited with inline digit fields/steppers (never the platform's radial picker), while
 * repeat, sound and mission choices remain visible in the same page. This test pins down that
 * shape, the essential controls, and the English/Amharic labels.
 */
(async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: AlarmEditorScreen, getTimeParts, stepHour, to24HourTime } = await import('../src/components/AlarmEditorScreen');
  const { createElement: h } = React;

  const results: [string, boolean, string][] = [];
  const check = (name: string, ok: boolean, info = '') => results.push([name, ok, info]);

  const render = (overrides: Record<string, unknown> = {}) => {
    const props: Record<string, unknown> = {
      editingAlarm: null,
      language: 'en',
      time: '06:30',
      onTimeChange: () => {},
      label: 'Morning Wake Up',
      onLabelChange: () => {},
      repeatDays: [1, 2, 3, 4, 5],
      onToggleDay: () => {},
      sound: 'sunrise',
      onSoundChange: () => {},
      volume: 80,
      onVolumeChange: () => {},
      gentleWakeUp: true,
      onGentleWakeUpChange: () => {},
      challenge: 'math',
      onChallengeChange: () => {},
      canCancel: true,
      onCancel: () => {},
      onSave: () => {},
      ...overrides,
    };
    return renderToStaticMarkup(h(AlarmEditorScreen, props));
  };

  const html = render();
  const repeatMarkup = html.match(/aria-label="Repeat Days">([\s\S]*?)<\/section>/)?.[1] ?? '';

  // --- One page, no OS time picker or modal backdrop ------------------------
  check('add mode title', html.includes('Wake-up alarm'));
  check('edit mode title', render({ editingAlarm: { id: '1' } }).includes('Wake-up alarm'));
  check('inline hour and minute digit fields', html.includes('id="alarm-hour-input"') && html.includes('id="alarm-minute-input"'));
  check('time fields are numeric text inputs', html.toLowerCase().includes('inputmode="numeric"') && !html.includes('type="time"'));
  check('time digits are shown as 12-hour values', html.includes('value="06"') && html.includes('value="30"') && html.includes('>AM<'));
  check('dedicated AM/PM controls are present', html.includes('aria-label="AM or PM"') && html.includes('>PM<'));
  check('no editor or ringtone modal backdrop', !html.includes('alarm-editor-backdrop') && !html.includes('ringtone-picker-backdrop'));
  check('bottom save CTA is present once', (html.match(/>Save</g) || []).length === 1);
  check('cancel is hidden for mandatory first setup', !render({ canCancel: false }).includes('aria-label="Cancel"'));

  // --- The configuration stays available below the time card ----------------
  check('repeat summary and all seven day buttons', html.includes('Weekdays (Mon-Fri)') && (repeatMarkup.match(/aria-label="(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)"/g) || []).length === 7);
  check('five weekday buttons are selected', (repeatMarkup.match(/aria-pressed="true"/g) || []).length === 5);
  check('alarm name field', html.includes('id="alarm-label-input"') && html.includes('value="Morning Wake Up"'));
  check('sound row displays the chosen tone', html.includes('Sound &amp; Ringtone') && html.includes('Inspirational Sunrise'));
  check('sound choices are available inline', html.includes('Sound &amp; Ringtone') && html.includes('Inspirational Sunrise'));
  check('wake-up mission is selectable inline', html.includes('Wake-up mission') && html.includes('aria-label="Wake-up mission"'));
  check('volume and gentle wake-up controls are retained', html.includes('type="range"') && html.includes('role="switch"'));

  // --- Special values, language, and editing modes --------------------------
  const amharic = render({ language: 'am' });
  check('amharic title and save CTA', amharic.includes('አዲስ ማንቂያ ጨምር') && amharic.includes('ማንቂያውን አስቀምጥ'));
  check('amharic repeat summary and accessible day chips', amharic.includes('የስራ ቀናት') && amharic.includes('aria-label="ሰኞ"'));
  check('one-time repeat label', render({ repeatDays: [] }).includes('Once'));
  check('every-day repeat label', render({ repeatDays: [0, 1, 2, 3, 4, 5, 6] }).includes('Every day'));
  check('weekend repeat label', render({ repeatDays: [0, 6] }).includes('Weekends (Sat-Sun)'));
  check('dismiss-only mission is labelled', render({ challenge: 'none' }).includes('Dismiss only'));
  check('affirmation mission is available', render({ challenge: 'typing' }).includes('Affirmation'));
  check('unknown sound falls back to its id', render({ sound: 'unknown-tone' }).includes('unknown-tone'));
  check('empty label remains editable', render({ label: '' }).includes('id="alarm-label-input"'));
  check('midnight is represented as 12 AM', render({ time: '00:00' }).includes('value="12"') && render({ time: '00:00' }).includes('>AM<'));
  check('midday is represented as 12 PM', render({ time: '12:00' }).includes('value="12"') && render({ time: '12:00' }).includes('>PM<'));
  check('12 AM converts to midnight', to24HourTime({ hour: '12', minute: '00', period: 'AM' }) === '00:00');
  check('12 PM converts to noon', to24HourTime({ hour: '12', minute: '00', period: 'PM' }) === '12:00');
  check('afternoon input converts to 24-hour storage', to24HourTime({ hour: '1', minute: '15', period: 'PM' }) === '13:15');
  check('display fields split stored 24-hour time', JSON.stringify(getTimeParts('23:09')) === JSON.stringify({ hour: '11', minute: '09', period: 'PM' }));
  check('stepping from 11 AM advances to 12 PM', JSON.stringify(stepHour({ hour: '11', minute: '00', period: 'AM' }, 1)) === JSON.stringify({ hour: '12', minute: '00', period: 'PM' }));
  check('stepping back from 12 AM reaches 11 PM', JSON.stringify(stepHour({ hour: '12', minute: '00', period: 'AM' }, -1)) === JSON.stringify({ hour: '11', minute: '00', period: 'PM' }));
  check('invalid digits are clamped safely', to24HourTime({ hour: '25', minute: '99', period: 'PM' }) === '12:59');

  // --- Report ---------------------------------------------------------------
  let pass = 0;
  for (const [name, ok, info] of results) {
    if (ok) pass++;
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${info ? `  (${info})` : ''}`);
  }
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
})();
