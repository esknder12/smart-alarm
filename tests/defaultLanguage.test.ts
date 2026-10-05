/**
 * Tests ensuring default language is English and Amharic is available as an option.
 */
(async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement: h } = React;

  const { QuickAlarmModal } = await import('../src/components/QuickAlarmModal');
  const { NightstandClock } = await import('../src/components/NightstandClock');
  const { OnboardingTour } = await import('../src/components/OnboardingTour');
  const { HabitAlarmWizardModal } = await import('../src/components/HabitAlarmWizardModal');
  const { AlarmRingingModal } = await import('../src/components/AlarmRingingModal');
  const { default: AlarmEditorScreen } = await import('../src/components/AlarmEditorScreen');

  const results: [string, boolean, string][] = [];
  const check = (name: string, ok: boolean, info = '') => results.push([name, ok, info]);

  // 1. QuickAlarmModal defaults to English
  const quickEn = renderToStaticMarkup(
    h(QuickAlarmModal, { isOpen: true, onClose: () => {}, onSaveQuickAlarm: () => {} })
  );
  check('quick alarm defaults to English title', quickEn.includes('Quick Alarm'));
  check('quick alarm defaults to English save button', quickEn.includes('Save Quick Alarm'));
  check('quick alarm defaults to English tone label', quickEn.includes('Alarm sound'));
  check('quick alarm defaults to English minutes', quickEn.includes('m</span>') || quickEn.includes('+ 10m'));

  // 2. QuickAlarmModal Amharic option
  const quickAm = renderToStaticMarkup(
    h(QuickAlarmModal, { isOpen: true, onClose: () => {}, onSaveQuickAlarm: () => {}, language: 'am' })
  );
  check('quick alarm supports Amharic title', quickAm.includes('ፈጣን ማንቂያ'));
  check('quick alarm supports Amharic save button', quickAm.includes('ፈጣን ማንቂያውን አስቀምጥ'));
  check('quick alarm supports Amharic tone label', quickAm.includes('የማንቂያ ድምፅ'));

  // 3. NightstandClock defaults to English
  const nightEn = renderToStaticMarkup(
    h(NightstandClock, { onClose: () => {}, nextAlarmTime: '07:00' })
  );
  check('nightstand clock defaults to English alarm label', nightEn.includes('Alarm: 07:00'));
  check('nightstand clock defaults to English dim button', nightEn.includes('Dim Display'));
  check('nightstand clock defaults to English footer', nightEn.includes('Nightstand Bedside Clock'));

  // 4. NightstandClock Amharic option
  const nightAm = renderToStaticMarkup(
    h(NightstandClock, { onClose: () => {}, nextAlarmTime: '07:00', language: 'am' })
  );
  check('nightstand clock supports Amharic alarm label', nightAm.includes('ማንቂያ: 07:00'));
  check('nightstand clock supports Amharic dim button', nightAm.includes('ማብራሪያውን ቀንስ'));

  // 5. OnboardingTour defaults to English without Amharic labels
  const tourEn = renderToStaticMarkup(
    h(OnboardingTour, { onComplete: () => {}, onClose: () => {}, mandatory: true })
  );
  check('onboarding tour step 1 has English Hour', tourEn.includes('Hour'));
  check('onboarding tour step 1 has English Minute', tourEn.includes('Minute'));
  check('onboarding tour step 1 has English Period', tourEn.includes('Period'));
  check('onboarding tour step 1 has English Selected time', tourEn.includes('Selected time:'));
  check('onboarding tour does not have Amharic labels in English', !tourEn.includes('ሰዓት</span>') && !tourEn.includes('ደቂቃ</span>'));

  // 6. HabitAlarmWizardModal defaults to English
  const habitEn = renderToStaticMarkup(
    h(HabitAlarmWizardModal, { isOpen: true, onClose: () => {}, onSaveHabitAlarm: () => {} })
  );
  check('habit alarm defaults to English prompt', habitEn.includes('What habit do you want to build?'));
  check('habit alarm defaults to English preset', habitEn.includes('Wake up early'));

  // 7. HabitAlarmWizardModal Amharic option
  const habitAm = renderToStaticMarkup(
    h(HabitAlarmWizardModal, { isOpen: true, onClose: () => {}, onSaveHabitAlarm: () => {}, language: 'am' })
  );
  check('habit alarm supports Amharic prompt', habitAm.includes('ምን ዓይነት ልማድ መገንባት ይፈልጋሉ?'));

  // 8. AlarmRingingModal defaults to English
  const ringEn = renderToStaticMarkup(
    h(AlarmRingingModal, {
      alarm: {
        id: '1',
        time: '07:00',
        label: '',
        enabled: true,
        repeatDays: [],
        sound: 'sunrise',
        volume: 80,
        snoozeCount: 0,
        challenge: 'math',
        challengeDifficulty: 'easy',
      },
      onDismiss: () => {},
      onSnooze: () => {},
    })
  );
  check('ringing modal defaults to English fallback title', ringEn.includes('Wake-up Time!'));
  check('ringing modal defaults to English scheduled text', ringEn.includes('Scheduled for: 07:00'));
  check('ringing modal defaults to English challenge title', ringEn.includes('Wake-Up Challenge Required'));

  // 9. AlarmEditorScreen defaults to English
  const editorEn = renderToStaticMarkup(
    h(AlarmEditorScreen, {
      editingAlarm: null,
      time: '07:00',
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
    })
  );
  check('alarm editor defaults to English title', editorEn.includes('Add New Alarm'));
  check('alarm editor defaults to English save button', editorEn.includes('Save Alarm'));
  check('alarm editor defaults to English hour/min labels', editorEn.includes('HOUR') && editorEn.includes('MIN'));

  // --- Report ---------------------------------------------------------------
  let pass = 0;
  for (const [name, ok, info] of results) {
    if (ok) pass++;
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${info ? `  (${info})` : ''}`);
  }
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
})();
