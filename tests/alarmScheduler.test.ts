/**
 * Runtime harness for the native alarm scheduler bridge (Phase 2).
 *
 * The Java half - AlarmManager scheduling, the ringing service, the boot re-arm - is covered by the
 * Gradle unit tests in android/app/src/test. What can only be tested here is the JS <-> native
 * contract: which alarms are sent, what the web layer does when the plugin answers, when it fails,
 * and that a plain browser is never told it has a native alarm engine.
 */
(async () => {
  const {
    nativeAlarmScheduler,
    setAlarmSchedulerBackend,
    parseAlarmTime,
    toNativeAlarm,
    toNativeAlarms,
    alarmFromRingInfo,
    unavailableState,
  } = await import('../src/utils/alarmScheduler');
  const { APP_NAME } = await import('../src/constants');

  const results: [string, boolean, string][] = [];
  const check = (name: string, ok: boolean, info = '') => results.push([name, ok, info]);
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  const realWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => warnings.push(String(args[0]));

  const alarm = (overrides: Record<string, unknown> = {}) =>
    ({
      id: '1',
      time: '06:30',
      label: 'Morning Rise & Shine',
      enabled: true,
      repeatDays: [1, 2, 3, 4, 5],
      sound: 'sunrise',
      volume: 80,
      snoozeCount: 0,
      challenge: 'math',
      challengeDifficulty: 'easy',
      ...overrides,
    }) as any;

  // --- 1. Plain browser: no plugin, no lies ---------------------------------
  check('browser: the scheduler is not available', !nativeAlarmScheduler.isAvailable());

  const browserSync = await nativeAlarmScheduler.sync([alarm()]);
  check(
    'browser: sync resolves with the unavailable state instead of throwing',
    browserSync.available === false && browserSync.scheduledCount === 0 && browserSync.nextTriggerAt === -1
  );
  check('browser: getState is harmless', (await nativeAlarmScheduler.getState()).available === false);
  check(
    'browser: stopRing / takeOverRing / cancel are harmless',
    (await nativeAlarmScheduler.stopRing()).available === false &&
      (await nativeAlarmScheduler.takeOverRing()).available === false &&
      (await nativeAlarmScheduler.cancel('1')).available === false &&
      (await nativeAlarmScheduler.cancelAll()).available === false
  );
  const browserUnsubscribe = await nativeAlarmScheduler.onAlarmTriggered(() => {
    throw new Error('a browser must never report a native ring');
  });
  const browserStopUnsubscribe = await nativeAlarmScheduler.onRingStopped(() => {
    throw new Error('a browser must never report a native ring');
  });
  browserUnsubscribe();
  browserStopUnsubscribe();
  check(
    'browser: subscribing returns no-op unsubscribes',
    typeof browserUnsubscribe === 'function' && typeof browserStopUnsubscribe === 'function'
  );
  check('browser: opening settings reports failure rather than throwing', (await nativeAlarmScheduler.openSettings('exactAlarm')) === false);
  check('browser: asking for notifications reports failure', (await nativeAlarmScheduler.requestNotificationPermission()) === false);
  check('browser: nothing was logged as a failure', warnings.length === 0, warnings.join(' | '));
  check('browser: unavailableState() is all-default', unavailableState().available === false && unavailableState().ringing === null);

  // --- 2. The mapping the native side depends on ----------------------------
  check('time: "06:30" parses', parseAlarmTime('06:30').hour === 6 && parseAlarmTime('06:30').minute === 30);
  check('time: "6:05" parses', parseAlarmTime('6:05').hour === 6 && parseAlarmTime('6:05').minute === 5);
  check('time: "23:59" parses', parseAlarmTime('23:59').hour === 23 && parseAlarmTime('23:59').minute === 59);
  check('time: out-of-range rolls over to midnight, never NaN', parseAlarmTime('24:00').hour === 0 && parseAlarmTime('24:00').minute === 0);
  check('time: garbage becomes midnight', parseAlarmTime('soon').hour === 0 && parseAlarmTime('').minute === 0);

  const mapped = toNativeAlarm(alarm({ time: '07:15', repeatDays: [6, 0, 6, 1], volume: 900 }));
  check('mapping: time is split into hour/minute', mapped.hour === 7 && mapped.minute === 15);
  check('mapping: repeat days are de-duplicated and sorted', JSON.stringify(mapped.days) === '[0,1,6]', JSON.stringify(mapped.days));
  check('mapping: volume is clamped to 0-100', mapped.volume === 100);
  check('mapping: barcode target is carried into the native scheduler', toNativeAlarm(alarm({ challengeConfig: { barcodeValue: '0012345678905' } })).barcodeValue === '0012345678905');
  check('mapping: oversized QR payloads stay within the native record limit', toNativeAlarm(alarm({ challengeConfig: { barcodeValue: 'x'.repeat(2049) } })).barcodeValue?.length === 2048);
  check('mapping: a one-time alarm sends no days', toNativeAlarm(alarm({ repeatDays: [] })).days.length === 0);
  const bare = toNativeAlarm({ id: 7, time: '05:00', enabled: false } as any);
  check(
    'mapping: missing fields get safe defaults',
    bare.id === '7' && bare.label === '' && bare.sound === 'sunrise' && bare.volume === 80 && bare.gentleWakeUp === false && bare.challenge === 'math' && bare.challengeDifficulty === 'easy' && bare.enabled === false
  );
  check('mapping: a list is mapped 1:1 and junk entries are dropped', toNativeAlarms([alarm(), null as any, alarm({ id: '2' })]).length === 2);

  const stored = alarm({ id: 'a1', label: 'Stored', wallpaper: 'space' });
  const ringInfo = {
    alarmId: 'a1', label: 'Native', time: '06:30', hour: 6, minute: 30, sound: 'nuclear', volume: 55,
    gentleWakeUp: true, challenge: 'typing', challengeDifficulty: 'hard', barcodeValue: 'saved-code', startedAt: 1, ringingSeconds: 3,
  } as any;
  check('ring: the stored alarm is used when it still exists (wallpaper & mission kept)', alarmFromRingInfo(ringInfo, [alarm(), stored]) === stored);
  const rebuilt = alarmFromRingInfo(ringInfo, [alarm({ id: 'other' })]);
  check(
    'ring: a ring survives local storage being cleared',
    rebuilt.id === 'a1' && rebuilt.time === '06:30' && rebuilt.label === 'Native' && rebuilt.challenge === 'typing' && rebuilt.challengeDifficulty === 'hard' && rebuilt.volume === 55 && rebuilt.gentleWakeUp === true && rebuilt.challengeConfig?.barcodeValue === 'saved-code'
  );
  check('ring: a missing label still yields a title', alarmFromRingInfo({ ...ringInfo, label: '' }, []).label === 'Alarm');
  check('constants: the app name resolves (used by the ringing copy)', typeof APP_NAME === 'string' && APP_NAME.length > 0);

  // --- 3. Android app: the fake plugin stands in for AlarmSchedulerPlugin ---
  type TriggerListener = (event: any) => void;
  const native = {
    log: [] as string[],
    syncPayloads: [] as any[][],
    takeOvers: 0,
    stops: 0,
    cancelled: [] as string[],
    settings: [] as string[],
    triggers: new Set<TriggerListener>(),
    stopped: new Set<() => void>(),
    removedTriggers: 0,
    failSync: false,
    failState: false,
    failTakeOver: false,
    failRequestPermission: false,
    notificationGrant: 'granted' as string,
    state: {
      scheduledCount: 2,
      nextTriggerAt: 1_770_000_000_000,
      nextAlarmId: '1',
      exactAlarmsAllowed: true,
      notificationsAllowed: true,
      fullScreenIntentAllowed: false,
      deviceModel: 'samsung SM-A155F',
      sdkInt: 34,
      ringing: null as any,
      keyBlockEngaged: false,
      keyBlockHeldByService: false,
      blockedPresses: 0,
    },
  };

  setAlarmSchedulerBackend({
    async sync({ alarms }) {
      native.log.push('sync');
      native.syncPayloads.push(alarms);
      if (native.failSync) throw new Error('sync blew up');
      return native.state;
    },
    async cancel({ id }) {
      native.cancelled.push(id);
      return native.state;
    },
    async cancelAll() {
      native.log.push('cancelAll');
      return native.state;
    },
    async getState() {
      if (native.failState) throw new Error('state blew up');
      return native.state;
    },
    async takeOverRing() {
      native.takeOvers++;
      if (native.failTakeOver) throw new Error('takeOver blew up');
      return native.state;
    },
    async stopRing() {
      native.stops++;
      return native.state;
    },
    async openSettings({ target }) {
      native.settings.push(target);
    },
    async requestPermissions() {
      if (native.failRequestPermission) throw new Error('requestPermissions blew up');
      return { notifications: native.notificationGrant };
    },
    async addListener(eventName: string, listener: any) {
      if (eventName === 'alarmTriggered') {
        native.triggers.add(listener);
        return { remove: async () => { native.triggers.delete(listener); native.removedTriggers++; } };
      }
      native.stopped.add(listener);
      return { remove: async () => { native.stopped.delete(listener); } };
    },
  } as any);

  check('android: the scheduler reports itself available', nativeAlarmScheduler.isAvailable());
  const androidSync = await nativeAlarmScheduler.sync([alarm(), alarm({ id: '2', enabled: false })]);
  check('android: the whole list is mirrored, disabled included', native.syncPayloads[0]?.length === 2 && native.syncPayloads[0][1].enabled === false);
  check('android: the payload is the mapped shape', native.syncPayloads[0][0].hour === 6 && native.syncPayloads[0][0].minute === 30 && native.syncPayloads[0][0].days.length === 5);
  check('android: sync reports the state as available', androidSync.available === true, `available=${androidSync.available}`);
  check('android: the state is passed through (device, permissions, next alarm)', androidSync.deviceModel === 'samsung SM-A155F' && androidSync.nextTriggerAt === 1_770_000_000_000 && androidSync.exactAlarmsAllowed === true && androidSync.fullScreenIntentAllowed === false);
  check('android: scheduledCount is surfaced', androidSync.scheduledCount === 2);

  // A native ring: the event must reach the caller, and unsubscribing must stop it.
  const triggered: any[] = [];
  const stoppedRings: number[] = [];
  const offTriggered = await nativeAlarmScheduler.onAlarmTriggered((event) => triggered.push(event));
  const offStopped = await nativeAlarmScheduler.onRingStopped(() => stoppedRings.push(1));
  check('android: subscribed to alarmTriggered', native.triggers.size === 1);
  native.triggers.forEach((listener) => listener({ ...ringInfo }));
  check('android: the alarmTriggered payload is handed to the app', triggered.length === 1 && triggered[0].alarmId === 'a1');
  check('android: the payload carries what the puzzle needs', triggered[0]?.challenge === 'typing' && triggered[0]?.challengeDifficulty === 'hard' && triggered[0]?.time === '06:30');
  native.stopped.forEach((listener) => listener());
  check('android: ringStopped is delivered', stoppedRings.length === 1);
  offTriggered();
  offStopped();
  await flush();
  check('android: unsubscribing removes the listeners', native.triggers.size === 0 && native.stopped.size === 0 && native.removedTriggers === 1);

  // getState for a cold start (the activity was launched by the full-screen notification).
  native.state.ringing = ringInfo;
  const coldStart = await nativeAlarmScheduler.getState();
  check('android: a cold start sees the ring the service already started', coldStart.ringing?.alarmId === 'a1' && coldStart.ringing?.ringingSeconds === 3);
  check('android: the key-block telemetry is visible to the UI', coldStart.keyBlockHeldByService === false && coldStart.blockedPresses === 0);
  native.state.ringing = null;

  await nativeAlarmScheduler.takeOverRing();
  check('android: takeOverRing is forwarded (silences the service tone)', native.takeOvers === 1);
  await nativeAlarmScheduler.stopRing();
  check('android: stopRing is forwarded (ends the ring, releases the keys)', native.stops === 1);
  await nativeAlarmScheduler.cancel('2');
  check('android: cancel is forwarded with the alarm id', native.cancelled.join(',') === '2');
  await nativeAlarmScheduler.openSettings('exactAlarm');
  await nativeAlarmScheduler.openSettings('fullScreenIntent');
  check('android: settings targets are forwarded', native.settings.join(',') === 'exactAlarm,fullScreenIntent');
  check('android: notification permission is read back from the state', (await nativeAlarmScheduler.requestNotificationPermission()) === true);
  native.notificationGrant = 'denied';
  check('android: a denied notification permission is reported as false', (await nativeAlarmScheduler.requestNotificationPermission()) === false);

  // Failures must never break the ring: every call falls back to "unavailable", loudly but safely.
  warnings.length = 0;
  native.failSync = true;
  native.failState = true;
  native.failTakeOver = true;
  native.failRequestPermission = true;
  const failedSync = await nativeAlarmScheduler.sync([alarm()]);
  const failedState = await nativeAlarmScheduler.getState();
  const failedTakeOver = await nativeAlarmScheduler.takeOverRing();
  check('failure: a failing sync is contained', failedSync.available === false);
  check('failure: a failing getState is contained', failedState.available === false && failedState.ringing === null);
  check('failure: a failing takeOverRing is contained (the service keeps ringing)', failedTakeOver.available === false);
  check('failure: a failing permission request is contained', (await nativeAlarmScheduler.requestNotificationPermission()) === false);
  check('failure: each failure is logged once', warnings.length === 4, warnings.join(' | '));
  await flush();

  // Back to normal to prove the failures left nothing behind.
  native.failSync = false;
  native.failState = false;
  native.failTakeOver = false;
  native.failRequestPermission = false;
  check('recovery: the scheduler works again after failures', (await nativeAlarmScheduler.sync([alarm()])).available === true && (await nativeAlarmScheduler.getState()).scheduledCount === 2);

  setAlarmSchedulerBackend(undefined);
  console.warn = realWarn;

  // --- Report ---------------------------------------------------------------
  let pass = 0;
  for (const [name, ok, info] of results) {
    if (ok) pass++;
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${info ? `  (${info})` : ''}`);
  }
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
})();
