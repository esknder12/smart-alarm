/**
 * Runtime harness for the first-run gate.
 *
 * The rule the app must never get wrong: a user who has not set an alarm of their own cannot reach
 * the dashboard, and a user who has one is never forced through the wizard again. Storage is faked
 * here, because the real one is the thing that can be missing, full, or blocked.
 */
(async () => {
  const {
    FIRST_RUN_FLAG,
    setFirstRunStorage,
    hasCompletedFirstRun,
    markFirstRunComplete,
    shouldShowFirstRunAlarmSetup,
    buildFirstAlarm,
  } = await import('../src/utils/firstRun');
  const { hasUserSetOwnAlarm, loadAlarms } = await import('../src/utils/storage');

  const draft = (overrides: Record<string, unknown> = {}) => ({
    hour: '7',
    minute: '00',
    period: 'AM' as const,
    mission: 'math' as const,
    sound: 'sunrise' as const,
    volume: 80,
    gentleWakeUp: true,
    wallpaper: 'nature' as const,
    ...overrides,
  });
  const userAlarm = (id: string, overrides: Record<string, unknown> = {}) => ({
    ...buildFirstAlarm(draft(overrides)),
    id,
    snoozeCount: 0,
  });

  const results: [string, boolean, string][] = [];
  const check = (name: string, ok: boolean, info = '') => results.push([name, ok, info]);

  const fakeStore = (initial: Record<string, string> = {}) => {
    const data = { ...initial };
    return {
      data,
      getItem: (key: string) => (key in data ? data[key] : null),
      setItem: (key: string, value: string) => {
        data[key] = value;
      },
    };
  };

  // --- the decision ---------------------------------------------------------
  check('new user: no flag, no own alarm -> wizard', shouldShowFirstRunAlarmSetup({ completed: false, hasOwnAlarm: false }));
  check('finished before -> no wizard', !shouldShowFirstRunAlarmSetup({ completed: true, hasOwnAlarm: false }));
  check('has an alarm of their own -> no wizard', !shouldShowFirstRunAlarmSetup({ completed: false, hasOwnAlarm: true }));
  check('both true -> no wizard', !shouldShowFirstRunAlarmSetup({ completed: true, hasOwnAlarm: true }));

  // --- what counts as "an alarm of their own" -------------------------------
  const seeded = loadAlarms();
  check('the seeded demo alarms do not count', !hasUserSetOwnAlarm(seeded));
  check('an empty list does not count', !hasUserSetOwnAlarm([]));
  check('a user-created alarm counts', hasUserSetOwnAlarm([userAlarm('1759600000000')]));
  check('a user alarm next to the demo ones counts', hasUserSetOwnAlarm([...seeded, userAlarm('1759600000000')]));
  check('a seeded alarm left alone still counts as demo', !hasUserSetOwnAlarm([seeded[0]]));
  check('a seeded alarm that was edited still counts as demo', !hasUserSetOwnAlarm([{ ...seeded[1], enabled: false }]));

  // --- the alarm the wizard actually creates --------------------------------
  check('wizard alarm: 7:00 AM', buildFirstAlarm(draft()).time === '07:00');
  check('wizard alarm: 12:00 AM is midnight', buildFirstAlarm(draft({ hour: '12' })).time === '00:00');
  check('wizard alarm: 12:30 PM is noon', buildFirstAlarm(draft({ hour: '12', minute: '30', period: 'PM' })).time === '12:30');
  check('wizard alarm: 1:15 PM is 13:15', buildFirstAlarm(draft({ hour: '1', minute: '15', period: 'PM' })).time === '13:15');
  check('wizard alarm: 11:59 PM is 23:59', buildFirstAlarm(draft({ hour: '11', minute: '59', period: 'PM' })).time === '23:59');
  check('wizard alarm: a one-digit hour still pads', buildFirstAlarm(draft({ hour: '9' })).time === '09:00');
  check('wizard alarm: empty minute means on the hour', buildFirstAlarm(draft({ minute: '' })).time === '07:00');
  check('wizard alarm: a garbled hour falls back to 07:00', buildFirstAlarm(draft({ hour: 'nonsense' })).time === '07:00');
  check('wizard alarm: hour 25 clamps to 12, still AM', buildFirstAlarm(draft({ hour: '25' })).time === '00:00');
  check('wizard alarm: minute 99 clamps to 59', buildFirstAlarm(draft({ hour: '6', minute: '99' })).time === '06:59');
  check('wizard alarm: an unknown period reads as AM', buildFirstAlarm(draft({ period: 'XX' as 'AM' })).time === '07:00');
  check('wizard alarm: weekdays, enabled, easy challenge', (() => {
    const alarm = buildFirstAlarm(draft());
    return JSON.stringify(alarm.repeatDays) === JSON.stringify([1, 2, 3, 4, 5]) && alarm.enabled === true && alarm.challengeDifficulty === 'easy';
  })());
  check('wizard alarm: carries the chosen mission and sound', (() => {
    const alarm = buildFirstAlarm(draft({ mission: 'typing', sound: 'nuclear' }));
    return alarm.challenge === 'typing' && alarm.sound === 'nuclear';
  })());
  check('wizard alarm: volume is clamped and rounded', buildFirstAlarm(draft({ volume: 120 })).volume === 100 && buildFirstAlarm(draft({ volume: -5 })).volume === 0 && buildFirstAlarm(draft({ volume: 72.6 })).volume === 73);
  check('wizard alarm: gentle wake-up follows the toggle', buildFirstAlarm(draft({ gentleWakeUp: false })).gentleWakeUp === false);
  check('wizard alarm: has no id yet', !('id' in buildFirstAlarm(draft())));
  check('wizard alarm: is a real, enabled alarm', (() => {
    const alarm = buildFirstAlarm(draft());
    return alarm.label.length > 0 && alarm.time.includes(':') && alarm.wallpaper === 'nature';
  })());

  // --- the flag -------------------------------------------------------------
  setFirstRunStorage(fakeStore());
  check('fresh storage: not completed', !hasCompletedFirstRun());
  check('fresh storage: the wizard shows', shouldShowFirstRunAlarmSetup({ completed: hasCompletedFirstRun(), hasOwnAlarm: false }));
  check('writing the flag succeeds', markFirstRunComplete());
  check('after writing: completed', hasCompletedFirstRun());
  check('after writing: the wizard stays away', !shouldShowFirstRunAlarmSetup({ completed: hasCompletedFirstRun(), hasOwnAlarm: false }));
  check('the flag is the documented key', FIRST_RUN_FLAG === 'niqu_first_alarm_set');

  // A re-run from Settings must still mark it complete without breaking anything.
  check('writing twice is harmless', markFirstRunComplete() && hasCompletedFirstRun());

  // Half-written or foreign values must not count as done, so the wizard still comes back.
  const junk = fakeStore({ [FIRST_RUN_FLAG]: 'yes' });
  setFirstRunStorage(junk);
  check('junk value: not completed', !hasCompletedFirstRun());
  const emptyString = fakeStore({ [FIRST_RUN_FLAG]: '' });
  setFirstRunStorage(emptyString);
  check('empty value: not completed', !hasCompletedFirstRun());

  // --- storage that is blocked or broken ------------------------------------
  const exploding = {
    getItem: () => {
      throw new Error('storage disabled');
    },
    setItem: () => {
      throw new Error('quota exceeded');
    },
  };
  setFirstRunStorage(exploding);
  check('blocked storage: reading never throws', hasCompletedFirstRun() === false);
  check('blocked storage: writing reports failure without throwing', markFirstRunComplete() === false);
  check('blocked storage: the wizard still shows', shouldShowFirstRunAlarmSetup({ completed: hasCompletedFirstRun(), hasOwnAlarm: false }));

  setFirstRunStorage(null);
  check('missing storage: reading never throws', hasCompletedFirstRun() === false);
  check('missing storage: writing reports failure', markFirstRunComplete() === false);
  check(
    'missing storage: with an alarm set the user is not trapped in the wizard',
    !shouldShowFirstRunAlarmSetup({ completed: hasCompletedFirstRun(), hasOwnAlarm: true })
  );

  // Back to the real store, so nothing leaks into other tests.
  setFirstRunStorage(undefined);

  // --- Report ---------------------------------------------------------------
  let pass = 0;
  for (const [name, ok, info] of results) {
    if (ok) pass++;
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${info ? `  (${info})` : ''}`);
  }
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
})();
