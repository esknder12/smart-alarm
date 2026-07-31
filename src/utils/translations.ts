export type Language = 'en' | 'am';

export const translations = {
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

    // Morning tab
    isThisYourLocation: 'Is this your location?',
    myPet: 'My pet',
    morningFeeling: 'Morning feeling',
    dailyTarot: 'Daily Tarot',
    morningHabits: 'Morning Habits',
    vibeCodeTitle: 'Vibe code your app idea.',

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

    // General & Onboarding
    undo: 'Undo',
    allow: 'Allow',
    dontAllow: 'Don\'t Allow',
    allowNotifications: 'Allow Notifications',
    allowNotificationsSub: 'See Motivation Alerts. If alerts are off, you won\'t get your daily missions.',
    next: 'Next',
    getStarted: 'Get Started',
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

    // Morning tab
    isThisYourLocation: 'ይህ የእርስዎ ቦታ ነው?',
    myPet: 'የእኔ የቤት እንስሳ',
    morningFeeling: 'የጠዋት ስሜት',
    dailyTarot: 'ዕለታዊ ታሮት',
    morningHabits: 'የጠዋት ልማዶች',
    vibeCodeTitle: 'የመተግበሪያ ሃሳብዎን በኮድ ይገንቡ',

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

    // General & Onboarding
    undo: 'ተመለስ',
    allow: 'ፍቀድ',
    dontAllow: 'አትፍቀድ',
    allowNotifications: 'ማሳወቂያዎችን ፍቀድ',
    allowNotificationsSub: 'የማነቃቂያ ጥሪዎችን ያግኙ። ማሳወቂያ ካልተፈቀደ ዕለታዊ ተልእኮዎችን አያገኙም።',
    next: 'ቀጣይ',
    getStarted: 'ጀምር',
  },
};
