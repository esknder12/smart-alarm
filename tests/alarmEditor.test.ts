/**
 * Render harness for the simplified alarm editor.
 *
 * The editor is deliberately small - time, days, name, sound, mission - so this test renders it to
 * static markup and pins that shape down: the 12-hour time and its tap-to-edit picker, the day
 * chips, the two rows, and the absence of the sections that used to bloat the screen (a volume
 * slider, a wallpaper picker, a tone test button). It also proves the wiring survives both
 * languages and both add and edit mode.
 */
(async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: AlarmEditorModal } = await import('../src/components/AlarmEditorModal');
  const { createElement: h } = React;

  const results: [string, boolean, string][] = [];
  const check = (name: string, ok: boolean, info = '') => results.push([name, ok, info]);

  const render = (overrides: Record<string, unknown> = {}) => {
    const props: Record<string, unknown> = {
      isOpen: true,
      editingAlarm: null,
      language: 'en',
      time: '06:30',
      onTimeChange: () => {},
      label: 'Morning Wake Up',
      onLabelChange: () => {},
      repeatDays: [1, 2, 3, 4, 5],
      onToggleDay: () => {},
      sound: 'sunrise',
      onBrowseSound: () => {},
      challenge: 'math',
      onChallengeChange: () => {},
      onCancel: () => {},
      onSave: () => {},
      ...overrides,
    };
    return renderToStaticMarkup(h(AlarmEditorModal, props));
  };

  const html = render();

  // --- What must be there: the essentials ----------------------------------
  check('add mode title', html.includes('Add New Alarm'));
  check('edit mode title', render({ editingAlarm: { id: '1' } }).includes('Edit Alarm'));
  check('time shown 12-hour', html.includes('>6:30<') && html.includes('>am<'));
  check("time opens the phone's own picker", html.includes('type="time"') && html.includes('value="06:30"'));
  check('next-up summary line', html.includes('Weekdays (Mon-Fri)'));
  check('day chips selected state', (html.match(/aria-pressed="true"/g) || []).length === 5);
  check('day chips total', (html.match(/aria-pressed="/g) || []).length === 7);
  check('name field', html.includes('value="Morning Wake Up"'));
  check('sound row with the chosen tone', html.includes('Sound &amp; Ringtone') && html.includes('Inspirational Sunrise'));
  check('mission row with the chosen mission', html.includes('Wake-up Mission') && html.includes('Math equations'));
  check('save button in the header and at the bottom', (html.match(/Save Alarm/g) || []).length === 2);

  // --- What must not be there any more -------------------------------------
  check('no volume slider', !html.includes('type="range"'));
  check('no target volume section', !html.includes('Target Volume'));
  check('no wallpaper picker', !html.includes('Wallpaper'));
  check('no tone test button', !html.includes('Test Tone') && !html.includes('Browse Picker'));
  check('no debugger of raw sections', !html.includes('Gentle Wake'));

  // --- Language and modes ---------------------------------------------------
  const amharic = render({ language: 'am' });
  check('amharic title', amharic.includes('አዲስ ማንቂያ ጨምር'));
  check('amharic save', amharic.includes('ማንቂያውን አስቀምጥ'));
  check('amharic repeat summary', amharic.includes('የስራ ቀናት'));
  check('amharic day chips', amharic.includes('ሰኞ'));

  check('one-time alarm says Once', render({ repeatDays: [] }).includes('Once'));
  check('every-day alarm says Every day', render({ repeatDays: [0, 1, 2, 3, 4, 5, 6] }).includes('Every day'));
  check('rest-day alarm says Weekends', render({ repeatDays: [0, 6] }).includes('Weekends (Sat-Sun)'));
  check('dismiss-only mission is labelled', render({ challenge: 'none' }).includes('Dismiss button only'));
  check('a custom mission label appears', render({ challenge: 'typing' }).includes('Type an affirmation'));
  check('unknown sound falls back to its id', render({ sound: 'unknown-tone' }).includes('unknown-tone'));
  check('empty name still renders', render({ label: '' }).includes('Alarm name'));
  check('midnight formats as 12 am', render({ time: '00:00' }).includes('>12:00<') && render({ time: '00:00' }).includes('>am<'));
  check('midday formats as 12 pm', render({ time: '12:00' }).includes('>12:00<') && render({ time: '12:00' }).includes('>pm<'));
  check('closed renders nothing', render({ isOpen: false }) === '');

  // --- Report ---------------------------------------------------------------
  let pass = 0;
  for (const [name, ok, info] of results) {
    if (ok) pass++;
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${info ? `  (${info})` : ''}`);
  }
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
})();
