import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TabType, Alarm, RoutineStep, WakeLog, AmbientSound } from './types';
import { Language, translations } from './utils/translations';
import { sendAlarmNotification } from './utils/notifications';
import { APP_NAME } from './constants';
import {
  loadAlarms,
  saveAlarms,
  hasUserSetOwnAlarm,
  loadRoutine,
  saveRoutine,
  loadLogs,
  saveLogs,
  loadAmbients,
  saveAmbients,
} from './utils/storage';
import {
  nativeAlarmScheduler,
  alarmFromRingInfo,
  type RingingAlarmInfo,
} from './utils/alarmScheduler';
import { Navbar } from './components/Navbar';
import { AlarmClock } from './components/AlarmClock';
import { AlarmRingingModal } from './components/AlarmRingingModal';
import { MorningRoutine } from './components/MorningRoutine';
import { MorningTab } from './components/MorningTab';
import { SleepCalculator } from './components/SleepCalculator';
import { AmbientSoundscape } from './components/AmbientSoundscape';
import { NightstandClock } from './components/NightstandClock';
import { OnboardingTour } from './components/OnboardingTour';
import {
  hasCompletedFirstRun,
  markFirstRunComplete,
  shouldShowFirstRunAlarmSetup,
} from './utils/firstRun';
import { SettingsView } from './components/SettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('alarms');
  const [isNightstandMode, setIsNightstandMode] = useState<boolean>(false);
  // First launch ends with an alarm: the wizard is the only screen until the user sets one, and it
  // stops coming back afterwards (it is still reachable from Settings for a re-run).
  const [firstAlarmRequired, setFirstAlarmRequired] = useState<boolean>(() =>
    shouldShowFirstRunAlarmSetup({
      completed: hasCompletedFirstRun(),
      hasOwnAlarm: hasUserSetOwnAlarm(loadAlarms()),
    })
  );
  const [showTour, setShowTour] = useState<boolean>(firstAlarmRequired);
  // Briefly rings the card of the alarm the wizard just created, so the user sees it landed.
  const [highlightAlarmId, setHighlightAlarmId] = useState<string | null>(null);

  // Language state
  const [language, setLanguage] = useState<Language>(() => {
    return 'am';
  });

  useEffect(() => {
    localStorage.setItem('alarmy_language', language);
  }, [language]);

  const t = translations[language];

  // Core State
  const [alarms, setAlarms] = useState<Alarm[]>(loadAlarms);
  const [routine, setRoutine] = useState<RoutineStep[]>(loadRoutine);
  const [logs, setLogs] = useState<WakeLog[]>(loadLogs);
  const [ambients, setAmbients] = useState<AmbientSound[]>(loadAmbients);

  // Active Ringing Alarm
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
  const [lastTriggeredTime, setLastTriggeredTime] = useState<string>('');

  // Persist State Updates
  useEffect(() => saveAlarms(alarms), [alarms]);
  useEffect(() => saveRoutine(routine), [routine]);
  useEffect(() => saveLogs(logs), [logs]);
  useEffect(() => saveAmbients(ambients), [ambients]);

  // --- Native alarm engine (Android app only) -------------------------------
  // The JS timer below only ticks while this page is alive. On a phone the alarms are mirrored
  // into AlarmManager by the AlarmScheduler plugin, so they ring with the app closed; this effect
  // keeps that mirror in step with the alarm list, and opens the puzzle when the ringing service
  // says an alarm is firing - including a cold start from its full-screen notification.
  const alarmsRef = useRef(alarms);
  useEffect(() => {
    alarmsRef.current = alarms;
  }, [alarms]);

  useEffect(() => {
    // While the first-run wizard is up there is no real alarm yet: the two demo alarms every fresh
    // install starts with must not be armed on the phone before the user picks a time themselves.
    if (firstAlarmRequired) return;
    void nativeAlarmScheduler.sync(alarms);
  }, [alarms, firstAlarmRequired]);

  useEffect(() => {
    if (!highlightAlarmId) return;
    const timeout = setTimeout(() => setHighlightAlarmId(null), 6000);
    return () => clearTimeout(timeout);
  }, [highlightAlarmId]);

  const openNativeRing = useCallback((info: RingingAlarmInfo) => {
    const alarm = alarmFromRingInfo(info, alarmsRef.current);
    // Stop the once-a-minute JS checker from "discovering" the same alarm a second time.
    setLastTriggeredTime(alarm.time);
    setRingingAlarm(alarm);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsubscribes: Array<() => void> = [];
    void (async () => {
      const offTriggered = await nativeAlarmScheduler.onAlarmTriggered((info) => openNativeRing(info));
      const offStopped = await nativeAlarmScheduler.onRingStopped(() => setRingingAlarm(null));
      if (cancelled) {
        offTriggered();
        offStopped();
        return;
      }
      unsubscribes.push(offTriggered, offStopped);
      // Cold start: the activity may have been launched by the full-screen notification while the
      // service was already ringing (screen off, app closed, lockscreen up).
      const state = await nativeAlarmScheduler.getState();
      if (!cancelled && state.ringing) openNativeRing(state.ringing);
    })();
    return () => {
      cancelled = true;
      unsubscribes.forEach((off) => off());
    };
  }, [openNativeRing]);

  // Global Alarm Checker Loop (runs every second)
  useEffect(() => {
    const interval = setInterval(() => {
      // Nothing may ring while the user is still setting their first alarm: the seeded demo alarms
      // are placeholders, not times anybody chose.
      if (firstAlarmRequired) return;
      const now = new Date();
      const currentHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const currentDay = now.getDay(); // 0-6

      if (currentHHMM !== lastTriggeredTime) {
        // Check if any enabled alarm matches current time and day
        const matchingAlarm = alarms.find((a) => {
          if (!a.enabled) return false;
          if (a.time !== currentHHMM) return false;
          if (a.repeatDays.length > 0 && !a.repeatDays.includes(currentDay)) return false;
          return true;
        });

        if (matchingAlarm) {
          setRingingAlarm(matchingAlarm);
          setLastTriggeredTime(currentHHMM);
          sendAlarmNotification(matchingAlarm.label || APP_NAME, matchingAlarm.time);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [alarms, lastTriggeredTime, firstAlarmRequired]);

  // Next Alarm Time helper
  const getNextAlarmTime = (): string | null => {
    const enabledAlarms = alarms.filter((a) => a.enabled);
    if (enabledAlarms.length === 0) return null;
    const sorted = [...enabledAlarms].sort((a, b) => a.time.localeCompare(b.time));
    return sorted[0].time;
  };

  // Handlers for Alarms
  const buildAlarm = (newAlarmData: Omit<Alarm, 'id' | 'snoozeCount'>): Alarm => ({
    ...newAlarmData,
    id: Date.now().toString(),
    snoozeCount: 0,
  });

  const handleAddAlarm = (newAlarmData: Omit<Alarm, 'id' | 'snoozeCount'>) => {
    setAlarms([...alarms, buildAlarm(newAlarmData)]);
  };

  /**
   * The wizard finished. On the mandatory first run the alarm the user just configured replaces the
   * seeded demo alarms (nothing may ring at a time they never chose); a re-run from Settings simply
   * adds it. The flag is written last and never blocks the alarm itself.
   */
  const handleTourComplete = (newAlarmData?: Omit<Alarm, 'id' | 'snoozeCount'>) => {
    if (newAlarmData) {
      const created = buildAlarm(newAlarmData);
      setAlarms(firstAlarmRequired ? [created] : [...alarms, created]);
      setHighlightAlarmId(created.id);
      setActiveTab('alarm');
    }
    markFirstRunComplete();
    setFirstAlarmRequired(false);
    setShowTour(false);
  };

  const handleUpdateAlarm = (updatedAlarm: Alarm) => {
    setAlarms(alarms.map((a) => (a.id === updatedAlarm.id ? updatedAlarm : a)));
  };

  const handleDeleteAlarm = (id: string) => {
    setAlarms(alarms.filter((a) => a.id !== id));
  };

  const handleSetQuickAlarm = (time: string, label: string) => {
    const existing = alarms.find((a) => a.time === time);
    if (existing) {
      setAlarms(alarms.map((a) => (a.id === existing.id ? { ...a, enabled: true, label } : a)));
    } else {
      handleAddAlarm({
        time,
        label,
        enabled: true,
        repeatDays: [0, 1, 2, 3, 4, 5, 6],
        sound: 'sunrise',
        volume: 80,
        challenge: 'math',
        challengeDifficulty: 'easy',
      });
    }
  };

  // Handlers for Routine
  const handleToggleStep = (id: string) => {
    setRoutine(routine.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r)));
  };

  const handleAddStep = (stepData: Omit<RoutineStep, 'id' | 'completed'>) => {
    const newStep: RoutineStep = {
      ...stepData,
      id: Date.now().toString(),
      completed: false,
    };
    setRoutine([...routine, newStep]);
  };

  const handleDeleteStep = (id: string) => {
    setRoutine(routine.filter((r) => r.id !== id));
  };

  const handleResetRoutine = () => {
    setRoutine(routine.map((r) => ({ ...r, completed: false })));
  };

  // Handlers for Logs
  const handleAddLog = (logData: Omit<WakeLog, 'id'>) => {
    const newLog: WakeLog = {
      ...logData,
      id: Date.now().toString(),
    };
    setLogs([newLog, ...logs]);
  };

  // Snooze Alarm
  const handleSnooze = (minutes: number) => {
    if (!ringingAlarm) return;
    const now = new Date();
    const future = new Date(now.getTime() + minutes * 60000);
    const snoozeTime = `${future.getHours().toString().padStart(2, '0')}:${future.getMinutes().toString().padStart(2, '0')}`;

    const snoozedAlarm: Alarm = {
      ...ringingAlarm,
      id: Date.now().toString(),
      time: snoozeTime,
      label: `${ringingAlarm.label} (Snoozed)`,
      enabled: true,
      snoozeCount: ringingAlarm.snoozeCount + 1,
    };

    setAlarms([...alarms, snoozedAlarm]);
    setRingingAlarm(null);
    // The ringing service knows nothing about snoozing: end its ring (the snoozed alarm is armed
    // by the sync above, because it becomes part of the alarm list).
    void nativeAlarmScheduler.stopRing();
  };

  // Dismiss = puzzle solved: stop the ring in both worlds, then close the screen.
  const handleDismissRing = () => {
    setRingingAlarm(null);
    void nativeAlarmScheduler.stopRing();
  };

  // First launch (and any re-run from Settings): the wizard comes before the dashboard.
  // A ringing alarm always wins: the phone may have been opened by its notification.
  if (showTour && !ringingAlarm) {
    return (
      <OnboardingTour
        mandatory={firstAlarmRequired}
        onComplete={handleTourComplete}
        onClose={() => setShowTour(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0f12] text-slate-100 font-sans antialiased selection:bg-red-500 selection:text-white">
      {/* Navbar Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        nextAlarmTime={getNextAlarmTime()}
        toggleNightstand={() => setIsNightstandMode(true)}
        language={language}
        setLanguage={setLanguage}
      />

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-hidden">
        <AnimatePresence mode="wait">
          {(activeTab === 'alarm' || activeTab === 'alarms') && (
            <motion.div
              key="alarm"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <AlarmClock
                alarms={alarms}
                onAddAlarm={handleAddAlarm}
                onUpdateAlarm={handleUpdateAlarm}
                onDeleteAlarm={handleDeleteAlarm}
                nextAlarmTime={getNextAlarmTime()}
                language={language}
                highlightAlarmId={highlightAlarmId}
              />
            </motion.div>
          )}

          {activeTab === 'sleep' && (
            <motion.div
              key="sleep"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <SleepCalculator onSetAlarm={handleSetQuickAlarm} language={language} />
            </motion.div>
          )}

          {(activeTab === 'morning' || activeTab === 'routine') && (
            <motion.div
              key="morning"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <MorningTab
                routine={routine}
                onToggleStep={handleToggleStep}
                onSelectTab={setActiveTab}
                language={language}
              />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <SettingsView
                language={language}
                setLanguage={setLanguage}
                onLaunchNightstand={() => setIsNightstandMode(true)}
                onRelaunchTour={() => {
                  setFirstAlarmRequired(false); // a voluntary re-run is always closable
                  setShowTour(true);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Fullscreen Nightstand Clock Overlay */}
      {isNightstandMode && (
        <NightstandClock
          onClose={() => setIsNightstandMode(false)}
          nextAlarmTime={getNextAlarmTime()}
          language={language}
        />
      )}

      {/* Ringing Alarm Modal */}
      {ringingAlarm && (
        <AlarmRingingModal
          alarm={ringingAlarm}
          onDismiss={handleDismissRing}
          onSnooze={handleSnooze}
          language={language}
        />
      )}
    </div>
  );
}
