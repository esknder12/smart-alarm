export type Language = 'en' | 'am';

export interface TranslationKeys {
  // Nav tabs
  alarm: string;
  sleep: string;
  morning: string;
  report: string;
  setting: string;

  // Alarm tab
  oversleptBannerTitle: string;
  oversleptBannerSub: string;
  ringIn: string;
  noUpcomingAlarms: string;
  wakeUpEarly: string;
  setNewAlarm: string;
  quickAlarm: string;
  habitAlarm: string;
  addAlarmTitle: string;
  editAlarmTitle: string;
  alarmTimeLabel: string;
  alarmLabelInput: string;
  repeatDaysLabel: string;
  soundAndRingtone: string;
  wakeUpMission: string;
  wallpaperTheme: string;
  snoozeSettings: string;
  saveAlarmBtn: string;
  cancelBtn: string;
  deleteAlarmBtn: string;

  // Notification Banner
  allowNotifTitle: string;
  allowNotifSub: string;
  allowBtn: string;

  // Morning Inspiration
  morningInspiration: string;
  allTopics: string;
  savedQuotes: string;
  favoriteQuotes: string;
  listenToQuote: string;
  favoriteQuote: string;
  copyQuote: string;
  anotherQuote: string;
  removeQuote: string;

  // Quote Categories
  catEnergy: string;
  catFocus: string;
  catDiscipline: string;
  catPeace: string;
  catCourage: string;
  catGratitude: string;

  // Sleep tab
  sleepTitle: string;
  sleepBannerTitle: string;
  sleepBannerSub: string;
  trackMySleep: string;
  stopTracking: string;
  mySleepReport: string;
  remCycleTitle: string;
  wakeUpAt: string;
  sleepAt: string;
  setAlarmBtn: string;
  setDone: string;
  ifYouSleepNow: string;
  ifYouWakeAt: string;

  // Morning tab
  isThisYourLocation: string;
  myPet: string;
  morningFeeling: string;
  dailyTarot: string;
  morningHabits: string;
  vibeCodeTitle: string;
  weatherTitle: string;
  markComplete: string;
  completed: string;
  resetRoutine: string;

  // Report tab
  reportTitle: string;
  logEntry: string;
  thisWeek: string;
  wakeUpReport: string;
  sleepReport: string;
  habitReport: string;
  avgWakeTime: string;
  avgTimeToWake: string;
  noAlarmRecord: string;
  setAlarm: string;
  viewDailyReport: string;
  wakeStreak: string;
  successRate: string;

  // Auto-Fade
  autoFadeTitle: string;
  autoFadeSub: string;
  autoFadingLabel: string;

  // Settings
  settingsTitle: string;
  languageLabel: string;
  nightstandClockMode: string;
  nightstandClockSub: string;
  relaunchSetupTour: string;
  relaunchSetupSub: string;
  appVersion: string;
  testNotifBtn: string;
  soundTestBtn: string;

  // Onboarding & Theme Gallery
  inspirationGallery: string;
  chooseThemeTitle: string;
  chooseThemeSub: string;
  allThemes: string;
  trendingThemes: string;
  goalFocusThemes: string;
  nextBtn: string;
  getStartedBtn: string;
  backBtn: string;
  skipBtn: string;

  // Alarm Ringing Modal
  wakeUpNow: string;
  alarmRinging: string;
  snoozeBtn: string;
  dismissBtn: string;
  completeMissionToStop: string;

  // General & Days
  undo: string;
  allow: string;
  dontAllow: string;
  allowNotifications: string;
  allowNotificationsSub: string;
  daysShort: string[];
}

export const translations: Record<Language, TranslationKeys> = {
  en: {
    // Nav tabs
    alarm: 'Alarm',
    sleep: 'Sleep',
    morning: 'Morning',
    report: 'Report',
    setting: 'Setting',

    // Alarm tab
    oversleptBannerTitle: 'Overslept AGAIN?',
    oversleptBannerSub: 'Try our new mission',
    ringIn: 'Ring in',
    noUpcomingAlarms: 'No upcoming alarms',
    wakeUpEarly: 'Wake up early',
    setNewAlarm: 'Set New Alarm',
    quickAlarm: 'Quick Alarm',
    habitAlarm: 'Habit Alarm',
    addAlarmTitle: 'Wake-up alarm',
    editAlarmTitle: 'Wake-up alarm',
    alarmTimeLabel: 'Alarm Time',
    alarmLabelInput: 'Alarm Label (e.g. Work, Gym)',
    repeatDaysLabel: 'Repeat Days',
    soundAndRingtone: 'Sound & Ringtone',
    wakeUpMission: 'Wake-up mission',
    wallpaperTheme: 'Wallpaper & Theme',
    snoozeSettings: 'Snooze Settings',
    saveAlarmBtn: 'Save',
    cancelBtn: 'Cancel',
    deleteAlarmBtn: 'Delete Alarm',

    // Notification Banner
    allowNotifTitle: 'Allow Browser Notifications',
    allowNotifSub: 'Get loud background popup alerts when alarms trigger',
    allowBtn: 'Allow',

    // Morning Inspiration
    morningInspiration: 'Morning Inspiration',
    allTopics: '✨ All Topics',
    savedQuotes: 'Saved Quotes',
    favoriteQuotes: 'Favorite Quotes',
    listenToQuote: 'Listen to quote',
    favoriteQuote: 'Favorite quote',
    copyQuote: 'Copy quote',
    anotherQuote: 'Get another quote',
    removeQuote: 'Remove',

    // Quote Categories
    catEnergy: 'Energy',
    catFocus: 'Focus',
    catDiscipline: 'Discipline',
    catPeace: 'Peace',
    catCourage: 'Courage',
    catGratitude: 'Gratitude',

    // Sleep tab
    sleepTitle: 'Sleep',
    sleepBannerTitle: 'Find out what you did in your sleep',
    sleepBannerSub: 'Check your tossing, snoring sounds',
    trackMySleep: 'Track my sleep',
    stopTracking: 'Stop Tracking',
    mySleepReport: 'My sleep report',
    remCycleTitle: 'REM Cycle Optimization',
    wakeUpAt: 'Wake Up At',
    sleepAt: 'Sleep At',
    setAlarmBtn: 'Set Alarm',
    setDone: 'Set!',
    ifYouSleepNow: 'If you sleep NOW, best wake-up times:',
    ifYouWakeAt: 'If you want to wake up at this time, sleep at:',

    // Morning tab
    isThisYourLocation: 'Is this your location?',
    myPet: 'My pet',
    morningFeeling: 'Morning feeling',
    dailyTarot: 'Daily Tarot',
    morningHabits: 'Morning Habits',
    vibeCodeTitle: 'Vibe code your app idea.',
    weatherTitle: 'Morning Weather',
    markComplete: 'Mark Complete',
    completed: 'Completed',
    resetRoutine: 'Reset Routine',

    // Report tab
    reportTitle: 'Report',
    logEntry: '+ Log Entry',
    thisWeek: 'This week Jul 26 - Aug 1',
    wakeUpReport: 'Wake up report',
    sleepReport: 'Sleep report',
    habitReport: 'Habit report',
    avgWakeTime: 'Avg. wake-up time',
    avgTimeToWake: 'Avg. time to wake up',
    noAlarmRecord: 'No alarm record',
    setAlarm: 'Set alarm',
    viewDailyReport: 'View daily report',
    wakeStreak: 'Wake-up Streak',
    successRate: 'Success Rate',

    // Auto-Fade
    autoFadeTitle: '30s Auto-Fade Volume Ramp',
    autoFadeSub: 'Ramps volume smoothly from 5% to target over 30 seconds to prevent shock.',
    autoFadingLabel: 'Auto-Fade Ramping',

    // Settings
    settingsTitle: 'Settings',
    languageLabel: 'App Language / ቋንቋ',
    nightstandClockMode: 'Nightstand Clock Mode',
    nightstandClockSub: 'Launch ambient full-screen bed clock',
    relaunchSetupTour: 'Relaunch Setup Wizard Tour',
    relaunchSetupSub: 'Revisit the 9-screen onboarding setup wizard',
    appVersion: 'Alarmy App Version',
    testNotifBtn: 'Test Notification',
    soundTestBtn: 'Sound & Volume Test',

    // Onboarding & Theme Gallery
    inspirationGallery: 'Inspiration Gallery',
    chooseThemeTitle: 'Choose your inspiration theme',
    chooseThemeSub: 'Select an immersive aesthetic wallpaper & soundscape for your alarm',
    allThemes: 'All Themes',
    trendingThemes: '💖 Trending',
    goalFocusThemes: '🔥 Goal Focus',
    nextBtn: 'Next',
    getStartedBtn: 'Get Started',
    backBtn: 'Back',
    skipBtn: 'Skip',

    // Alarm Ringing Modal
    wakeUpNow: 'WAKE UP!',
    alarmRinging: 'Alarm Ringing',
    snoozeBtn: 'Snooze',
    dismissBtn: 'Dismiss',
    completeMissionToStop: 'Complete Mission to Stop Alarm',

    // General & Days
    undo: 'Undo',
    allow: 'Allow',
    dontAllow: 'Don\'t Allow',
    allowNotifications: 'Allow Notifications',
    allowNotificationsSub: 'See Motivation Alerts. If alerts are off, you won\'t get your daily missions.',
    daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  am: {
    // Nav tabs
    alarm: 'ማንቂያ',
    sleep: 'እንቅልፍ',
    morning: 'ጠዋት',
    report: 'ሪፖርት',
    setting: 'መቼቶች',

    // Alarm tab
    oversleptBannerTitle: 'እንደገና ተኝተው አመሹ?',
    oversleptBannerSub: 'አዲሱን ተልእኳችንን ይሞክሩ',
    ringIn: 'የሚጮኸው በ',
    noUpcomingAlarms: 'ምንም የሚመጣ ማንቂያ የለም',
    wakeUpEarly: 'ማለዳ መንቃት',
    setNewAlarm: 'አዲስ ማንቂያ አዘጋጅ',
    quickAlarm: 'ፈጣን ማንቂያ',
    habitAlarm: 'የልማድ ማንቂያ',
    addAlarmTitle: 'አዲስ ማንቂያ ጨምር',
    editAlarmTitle: 'ማንቂያ አስተካክል',
    alarmTimeLabel: ' የማንቂያ ሰዓት',
    alarmLabelInput: 'የማንቂያ ስም (ምሳሌ፡ ስራ፣ ጂም)',
    repeatDaysLabel: 'የሚደጋገሙባቸው ቀናት',
    soundAndRingtone: 'ድምፅ እና የደወል ዜማ',
    wakeUpMission: 'የመነሻ ተልእኮ',
    wallpaperTheme: 'የጀርባ ምስል እና ጭብጥ',
    snoozeSettings: 'የእንቅልፍ ማራዘሚያ መቼቶች',
    saveAlarmBtn: 'ማንቂያውን አስቀምጥ',
    cancelBtn: 'ሰርዝ',
    deleteAlarmBtn: 'ማንቂያውን ሰርዝ',

    // Notification Banner
    allowNotifTitle: 'የብራውዘር ማሳወቂያዎችን ይፍቀዱ',
    allowNotifSub: 'ማንቂያው ሲጮህ ከበስተጀርባ የሚመጡ ጠንካራ ማሳወቂያዎችን ያግኙ',
    allowBtn: 'ፍቀድ',

    // Morning Inspiration
    morningInspiration: 'የጠዋት ማነቃቂያ',
    allTopics: '✨ ሁሉም ርዕሶች',
    savedQuotes: 'የተቀመጡ ጥቅሶች',
    favoriteQuotes: 'የተወደዱ ጥቅሶች',
    listenToQuote: 'ጥቅሱን ያዳምጡ',
    favoriteQuote: 'በጥቅስ ወደዱት',
    copyQuote: 'ጥቅሱን ቅዳ',
    anotherQuote: 'ሌላ ጥቅስ አሳይ',
    removeQuote: 'አስወግድ',

    // Quote Categories
    catEnergy: 'ኃይል',
    catFocus: 'ትኩረት',
    catDiscipline: 'ዲሲፕሊን',
    catPeace: 'ሰላም',
    catCourage: 'ፅናት',
    catGratitude: 'ምስጋና',

    // Sleep tab
    sleepTitle: 'እንቅልፍ',
    sleepBannerTitle: 'በእንቅልፍዎ ወቅት ምን እንዳደረጉ ይወቁ',
    sleepBannerSub: 'የመገልበጥ እና የእኮሮፋ ድምፆችን ይፈትሹ',
    trackMySleep: 'እንቅልፌን ተከታተል',
    stopTracking: 'መከታተል አቁም',
    mySleepReport: 'የእንቅልፍ ሪፖርቴ',
    remCycleTitle: 'የREM ዑደት ማስተካከያ',
    wakeUpAt: 'በዚህ ሰዓት ንቃ',
    sleepAt: 'በዚህ ሰዓት ተኛ',
    setAlarmBtn: 'ማንቂያ አዘጋጅ',
    setDone: 'ተዘጋጅቷል!',
    ifYouSleepNow: 'አሁን ቢተኙ ለመነሳት የተሻሉ ሰዓቶች፡',
    ifYouWakeAt: 'በዚህ ሰዓት ለመነሳት ከፈለጉ መተኛት ያለብዎት፡',

    // Morning tab
    isThisYourLocation: 'ይህ የእርስዎ ቦታ ነው?',
    myPet: 'የእኔ የቤት እንስሳ',
    morningFeeling: 'የጠዋት ስሜት',
    dailyTarot: 'ዕለታዊ ታሮት',
    morningHabits: 'የጠዋት ልማዶች',
    vibeCodeTitle: 'የመተግበሪያ ሃሳብዎን በኮድ ይገንቡ',
    weatherTitle: 'የጠዋት አየር ሁኔታ',
    markComplete: 'ተጠናቋል በል',
    completed: 'ተጠናቋል',
    resetRoutine: 'ልማዱን እንደገና ጀምር',

    // Report tab
    reportTitle: 'ሪፖርት',
    logEntry: '+ መዝገብ አስገባ',
    thisWeek: 'በዚህ ሳምንት ከሐምሌ 19 - ነሐሴ 2',
    wakeUpReport: 'የመነሻ ሪፖርት',
    sleepReport: 'የእንቅልፍ ሪፖርት',
    habitReport: 'የልማድ ሪፖርት',
    avgWakeTime: 'አማካይ የመነሻ ሰዓት',
    avgTimeToWake: 'ለመነሳት የፈጀው አማካይ ሰዓት',
    noAlarmRecord: 'ምንም የማንቂያ መዝገብ የለም',
    setAlarm: 'ማንቂያ አዘጋጅ',
    viewDailyReport: 'ዕለታዊ ሪፖርት ተመልከት',
    wakeStreak: 'ተከታታይ የመነሳት ቀናት',
    successRate: 'የውጤታማነት መጠን',

    // Auto-Fade
    autoFadeTitle: 'የ30 ሰከንድ ቀስ በቀስ የሚጨምር ድምፅ',
    autoFadeSub: 'ከድንገተኛ ድንጋጤ ለመጠበቅ በ30 ሰከንድ ውስጥ ድምፁን ከ5% ወደ ዒላማው ቀስ በቀስ ይጨምራል።',
    autoFadingLabel: 'ድምፅ ቀስ በቀስ እየጨመረ ነው',

    // Settings
    settingsTitle: 'መቼቶች',
    languageLabel: 'የመተግበሪያ ቋንቋ / App Language',
    nightstandClockMode: 'የአልጋ አጠገብ ሰዓት ሁነታ',
    nightstandClockSub: 'ሙሉ ስክሪን የሚያምር ሰዓት ክፈት',
    relaunchSetupTour: 'የማዋቀሪያ መመሪያውን እንደገና ክፈት',
    relaunchSetupSub: 'የ9-ገጽ የማዋቀሪያ መመሪያውን እንደገና ይጎብኙ',
    appVersion: 'የማንቂያ መተግበሪያ ስሪት',
    testNotifBtn: 'ማሳወቂያን ፈትሽ',
    soundTestBtn: 'የድምፅ ፍተሻ',

    // Onboarding & Theme Gallery
    inspirationGallery: 'የማነቃቂያ ጭብጦች ጋለሪ',
    chooseThemeTitle: 'የልብ መነቃቃት ጭብጥዎን ይምረጡ',
    chooseThemeSub: 'ለማንቂያዎ ማራኪ የመነሻ ምስል እና የተረጋጋ ድምፅ ይምረጡ',
    allThemes: 'ሁሉም ጭብጦች',
    trendingThemes: '💖 ታዋቂ',
    goalFocusThemes: '🔥 የግብ ትኩረት',
    nextBtn: 'ቀጣይ',
    getStartedBtn: 'ጀምር',
    backBtn: 'ተመለስ',
    skipBtn: 'እለፍ',

    // Alarm Ringing Modal
    wakeUpNow: 'ንቃ!',
    alarmRinging: 'ማንቂያው እየጮኸ ነው',
    snoozeBtn: 'አራዝም (አሸልብ)',
    dismissBtn: 'አጥፋ',
    completeMissionToStop: 'ማንቂያውን ለማቆም ተልእኮውን ይጨርሱ',

    // General & Days
    undo: 'ተመለስ',
    allow: 'ፍቀድ',
    dontAllow: 'አትፍቀድ',
    allowNotifications: 'ማሳወቂያዎችን ፍቀድ',
    allowNotificationsSub: 'የማነቃቂያ ጥሪዎችን ያግኙ። ማሳወቂያ ካልተፈቀደ ዕለታዊ ተልእኮዎችን አያገኙም።',
    daysShort: ['እሁድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'],
  },
};
