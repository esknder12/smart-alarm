import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Alarm } from '../types';
import { audioEngine } from '../utils/audio';
import {
  volumeLock,
  type HardwareKeysState,
  type VolumeLockBlockedDetail,
  type VolumeLockStatus,
  VOLUME_LOCK_BLOCKED_EVENT,
} from '../utils/volumeLock';
import { nativeAlarmScheduler } from '../utils/alarmScheduler';
import { WALLPAPERS } from './AlarmClock';
import { Language } from '../utils/translations';
import { getCachedCustomSound, getCustomSoundById } from '../utils/customSounds';
import { RINGTONES_CATALOG } from '../types';
import { WakeUpChallenge } from './WakeUpChallenge';
import { isOutOfBedMission } from '../utils/wakeChallenge';

interface AlarmRingingModalProps {
  alarm: Alarm;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
  language?: Language;
}

export const AlarmRingingModal: React.FC<AlarmRingingModalProps> = ({
  alarm,
  onDismiss,
  onSnooze,
  language = 'en',
}) => {
  const isAm = language === 'am';
  const [volumeAttemptBlocked, setVolumeAttemptBlocked] = useState(false);
  const [blockedKey, setBlockedKey] = useState<'volume' | 'back'>('volume');
  const [lockStatus, setLockStatus] = useState<VolumeLockStatus | null>(null);
  const [challengePassed, setChallengePassed] = useState(alarm.challenge === 'none');
  const [clock, setClock] = useState(() => new Date());
  const [fadeProgressSec, setFadeProgressSec] = useState(0);
  const [currentVolumePercent, setCurrentVolumePercent] = useState(alarm.gentleWakeUp ? 5 : alarm.volume);
  const [customSoundName, setCustomSoundName] = useState<string | null>(() => getCachedCustomSound(alarm.sound)?.name ?? null);

  const activeWallpaper =
    WALLPAPERS.find((wallpaper) => wallpaper.id === alarm.wallpaper) ||
    (alarm.wallpaper === 'capybara' ? WALLPAPERS.find((wallpaper) => wallpaper.id === 'chill_capybara') : null) ||
    (alarm.wallpaper === 'cat' ? WALLPAPERS.find((wallpaper) => wallpaper.id === 'lazy_cat') : null) ||
    (alarm.wallpaper === 'motivation' ? WALLPAPERS.find((wallpaper) => wallpaper.id === 'rise_and_grind') : null) ||
    (alarm.wallpaper === 'nature' ? WALLPAPERS.find((wallpaper) => wallpaper.id === 'cockadoodle') : null) ||
    WALLPAPERS[0];

  const catalogTone = RINGTONES_CATALOG.find((tone) => tone.id === alarm.sound);
  const soundDisplayName = customSoundName ? `🎵 ${customSoundName}` : catalogTone?.title ?? alarm.sound;
  const isPhysicalProofMission = isOutOfBedMission(alarm.challenge);
  const snoozeIsConfiguredOff = alarm.snoozeInterval === 0 || alarm.snoozeLimit === 0;
  const snoozeLimitReached = alarm.snoozeLimit !== undefined && alarm.snoozeLimit < 99 && alarm.snoozeCount >= alarm.snoozeLimit;
  const snoozeAllowed = !isPhysicalProofMission && !snoozeIsConfiguredOff && !snoozeLimitReached;
  const hardwareState: HardwareKeysState = lockStatus?.hardwareKeys ?? 'pending';
  const isNativeKeyLockHeld = hardwareState === 'locked';
  const hasAnyNativeLockStatus = hardwareState !== 'unavailable' && hardwareState !== 'inactive';

  // Keep the panel within the actually visible area when the Android keyboard opens.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateViewport = () => {
      document.documentElement.style.setProperty('--ringing-viewport-height', `${viewport.height}px`);
      document.documentElement.style.setProperty('--ringing-viewport-top', `${viewport.offsetTop}px`);
    };
    updateViewport();
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);
    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
      document.documentElement.style.removeProperty('--ringing-viewport-height');
      document.documentElement.style.removeProperty('--ringing-viewport-top');
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (alarm.sound.startsWith('custom_') && !customSoundName) {
      void getCustomSoundById(alarm.sound).then((sound) => {
        if (sound?.name) setCustomSoundName(sound.name);
      });
    }
  }, [alarm.sound, customSoundName]);

  useEffect(() => {
    setChallengePassed(alarm.challenge === 'none');
    setVolumeAttemptBlocked(false);
  }, [alarm.id, alarm.challenge]);

  useEffect(() => {
    audioEngine.startAlarmSound(
      alarm.sound,
      alarm.volume,
      alarm.gentleWakeUp,
      (elapsedSec, currentPercent) => {
        setFadeProgressSec(elapsedSec);
        setCurrentVolumePercent(currentPercent);
      }
    );

    let vibrationTimer: number | null = null;
    if ('vibrate' in navigator) {
      const vibrate = () => {
        try { navigator.vibrate([400, 150, 400, 150, 800]); } catch { /* haptics are optional */ }
      };
      vibrate();
      vibrationTimer = window.setInterval(vibrate, 2500);
    }
    return () => {
      audioEngine.stopAlarmSound();
      if (vibrationTimer !== null) window.clearInterval(vibrationTimer);
      if ('vibrate' in navigator) {
        try { navigator.vibrate(0); } catch { /* haptics are optional */ }
      }
    };
  }, [alarm]);

  useEffect(() => {
    if (challengePassed && 'vibrate' in navigator) {
      try { navigator.vibrate([100, 50, 200]); } catch { /* haptics are optional */ }
    }
  }, [challengePassed]);

  // Strict browser-side key/audio guard; Android additionally swallows the physical volume and
  // Back buttons natively for the entire ringing session.
  useEffect(() => {
    volumeLock.engage({ volumePercent: alarm.volume, escalation: true, haptics: true });
    const unsubscribe = volumeLock.subscribe(setLockStatus);
    const onBlocked = (event: Event) => {
      const detail = (event as CustomEvent<VolumeLockBlockedDetail>).detail;
      setBlockedKey(detail?.key === 'back' ? 'back' : 'volume');
      setVolumeAttemptBlocked(true);
    };
    window.addEventListener(VOLUME_LOCK_BLOCKED_EVENT, onBlocked);
    return () => {
      window.removeEventListener(VOLUME_LOCK_BLOCKED_EVENT, onBlocked);
      unsubscribe();
      volumeLock.disengage();
    };
  }, [alarm.id, alarm.volume]);

  // The foreground service keeps a native tone playing until Web Audio has actually taken over.
  useEffect(() => {
    if (!nativeAlarmScheduler.isAvailable()) return;
    let retry: number | null = null;
    let tookOver = false;
    const takeOver = () => {
      if (!audioEngine.forceLoud()) {
        if (retry === null) retry = window.setTimeout(takeOver, 300);
        return;
      }
      if (tookOver) return;
      tookOver = true;
      void nativeAlarmScheduler.takeOverRing();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      tookOver = false;
      takeOver();
    };
    takeOver();
    window.addEventListener('pointerdown', takeOver, true);
    window.addEventListener('touchstart', takeOver, true);
    window.addEventListener('keydown', takeOver, true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pointerdown', takeOver, true);
      window.removeEventListener('touchstart', takeOver, true);
      window.removeEventListener('keydown', takeOver, true);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (retry !== null) window.clearTimeout(retry);
    };
  }, [alarm.id]);

  useEffect(() => {
    if (!volumeAttemptBlocked) return;
    const timer = window.setTimeout(() => setVolumeAttemptBlocked(false), 4000);
    return () => window.clearTimeout(timer);
  }, [volumeAttemptBlocked]);

  const handleSnooze = useCallback(() => {
    if (!challengePassed || !snoozeAllowed) {
      if ('vibrate' in navigator) {
        try { navigator.vibrate([150, 80, 150]); } catch { /* haptics are optional */ }
      }
      return;
    }
    const minutes = alarm.snoozeInterval && alarm.snoozeInterval > 0 ? alarm.snoozeInterval : 9;
    if ('vibrate' in navigator) {
      try { navigator.vibrate(100); } catch { /* haptics are optional */ }
    }
    audioEngine.stopAlarmSound();
    volumeLock.disengage();
    onSnooze(minutes);
  }, [alarm.snoozeInterval, challengePassed, onSnooze, snoozeAllowed]);

  const handleDismiss = useCallback(() => {
    if (!challengePassed) return;
    if ('vibrate' in navigator) {
      try { navigator.vibrate([150, 50, 200]); } catch { /* haptics are optional */ }
    }
    audioEngine.stopAlarmSound();
    volumeLock.disengage();
    onDismiss();
  }, [challengePassed, onDismiss]);

  const lockSummary = isAm
    ? isNativeKeyLockHeld ? 'የድምፅ እና ተመለስ ቁልፎች ተቆልፈዋል' : 'የድምፅ ጥበቃ ንቁ ነው'
    : isNativeKeyLockHeld ? 'Volume & Back keys locked' : hasAnyNativeLockStatus ? 'Alarm guard is active' : 'Browser mode — hardware keys cannot be locked';
  const completedTitle = isAm ? 'ተልዕኮው ተጠናቋል' : 'Challenge complete';

  return (
    <AnimatePresence>
      <motion.div
        id="alarm-ringing-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{ top: 'var(--ringing-viewport-top, 0px)', height: 'var(--ringing-viewport-height, 100dvh)' }}
        className={`fixed inset-x-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-gradient-to-br ${activeWallpaper.bgGradient} p-3 backdrop-blur-xl sm:items-center sm:p-4`}
      >
        <motion.main
          role="dialog"
          aria-modal="true"
          aria-labelledby="ringing-alarm-title"
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 8 }}
          transition={{ type: 'spring', damping: 28, stiffness: 310 }}
          className="relative my-auto w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/95 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-5"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-rose-500/15 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-rose-100">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" /></span>
                {isAm ? 'ማንቂያ እየጮኸ ነው' : 'Alarm live'}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                <Activity className="h-3.5 w-3.5 text-cyan-300" />
                {isAm ? 'ንዝረት ንቁ' : 'Haptics on'}
              </div>
            </div>

            <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center">
              <div className="mb-1 text-4xl" aria-hidden="true">{activeWallpaper.emoji || '⏰'}</div>
              <h1 id="ringing-alarm-title" className="text-xl font-black tracking-tight text-white sm:text-2xl">
                {alarm.label || (isAm ? 'የመነቂያ ሰዓት!' : 'Wake-up Time!')}
              </h1>
              <div className="mt-3 flex items-end justify-center gap-3">
                <div className="font-mono text-5xl font-black tabular-nums tracking-tight text-amber-300" aria-live="off">
                  {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="mb-1 text-left text-[10px] leading-relaxed text-slate-500">
                  <div>{isAm ? 'የተያዘለት ሰዓት:' : 'Scheduled for:'} {alarm.time}</div>
                  <div>{isAm ? 'ከጮኸ ጀምሮ' : 'Ringing'} {formatDuration(lockStatus?.ringingSeconds ?? 0)}</div>
                </div>
              </div>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-300">
                {isAm && activeWallpaper.quoteAm ? activeWallpaper.quoteAm : activeWallpaper.quote}
              </p>
              <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-[10px] font-bold text-slate-300">
                <Volume2 className="h-3.5 w-3.5 shrink-0 text-rose-300" />
                <span className="truncate">{soundDisplayName}</span>
              </div>
            </section>

            {alarm.gentleWakeUp && (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-bold">
                  <span className="inline-flex items-center gap-1.5 text-amber-200"><Volume2 className="h-3.5 w-3.5" />{isAm ? 'ድምፅ በደረጃ እየጨመረ' : 'Gentle volume ramp'}</span>
                  <span className="font-mono text-slate-300">{currentVolumePercent}% · {Math.min(30, fadeProgressSec)}/30s</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all duration-700" style={{ width: `${Math.min(100, (fadeProgressSec / 30) * 100)}%` }} />
                </div>
              </div>
            )}

            {!challengePassed ? (
              <section className="rounded-2xl border border-amber-200/20 bg-slate-900/90 p-4 shadow-inner" aria-label={isAm ? 'የመነቂያ ፈተና ያስፈልጋል' : 'Wake-Up Challenge Required'}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                    <LockKeyhole className="h-4 w-4" />
                    {isAm ? 'የመንቂያ ፈተና ያስፈልጋል' : 'Wake-Up Challenge Required'}
                  </div>
                  {isPhysicalProofMission && (
                    <span className="shrink-0 rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-rose-200">
                      {isAm ? 'እንቅልፍ የለም' : 'No snooze'}
                    </span>
                  )}
                </div>
                <WakeUpChallenge alarm={alarm} language={language} onComplete={() => setChallengePassed(true)} />
              </section>
            ) : (
              <section className="flex items-center gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-3.5" role="status">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300" />
                <div>
                  <p className="font-extrabold text-emerald-100">{alarm.challenge === 'none' ? (isAm ? 'ማንቂያውን ለማጥፋት ዝግጁ ነዎት' : 'Alarm ready to dismiss') : completedTitle}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    {isAm ? 'ማንቂያው እስኪያጠፉት ድረስ ይቀጥላል።' : 'The alarm keeps ringing until you switch it off below.'}
                  </p>
                </div>
              </section>
            )}

            <div className="space-y-2.5">
              <button
                id="btn-dismiss-alarm"
                type="button"
                onClick={handleDismiss}
                disabled={!challengePassed}
                className={`flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-base font-black transition ${challengePassed ? 'bg-gradient-to-r from-emerald-300 to-teal-300 text-slate-950 shadow-lg shadow-emerald-500/15 hover:brightness-105 active:scale-[0.99]' : 'cursor-not-allowed border border-slate-700 bg-slate-900 text-slate-500'}`}
              >
                <ShieldCheck className="h-5 w-5" />
                {isAm ? 'ማንቂያውን አጥፋ እና ቀኑን ጀምር' : 'Disable Alarm & Start Day'}
              </button>

              {snoozeAllowed ? (
                <button
                  id="btn-snooze-alarm"
                  type="button"
                  onClick={handleSnooze}
                  disabled={!challengePassed}
                  className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition ${challengePassed ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'cursor-not-allowed border-slate-800 bg-slate-950 text-slate-600'}`}
                  aria-disabled={!challengePassed}
                >
                  <Clock3 className="h-4 w-4 text-amber-300" />
                  {challengePassed
                    ? (isAm ? `ከ${alarm.snoozeInterval || 9} ደቂቃ በኋላ አሸልብ` : `Snooze ${alarm.snoozeInterval || 9} minutes`)
                    : (isAm ? 'ማሸለብ ከፈተናው በኋላ ብቻ ነው' : 'Snooze unlocks after the challenge')}
                </button>
              ) : (
                <div className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/5 px-3 text-center text-xs font-bold text-rose-100/80">
                  <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
                  {isPhysicalProofMission
                    ? (isAm ? 'ከአልጋ ተነስተው ፈተናውን ያጠናቁ — ማሸለብ አይቻልም' : 'Get up and finish this mission — snooze is disabled')
                    : (isAm ? 'ለዚህ ማንቂያ ማሸለብ ጠፍቷል' : 'Snooze is turned off for this alarm')}
                </div>
              )}
            </div>

            {volumeAttemptBlocked && (
              <motion.p
                id="volume-lock-toast"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                role="status"
                className="rounded-xl border border-rose-300/25 bg-rose-400/15 px-3 py-2 text-center text-xs font-bold text-rose-100"
              >
                {blockedKey === 'back'
                  ? (isAm ? 'ተመለስ ቁልፍ ተቆልፏል — ፈተናውን ይጨርሱ።' : 'Back is locked. Finish the mission to switch off the alarm.')
                  : (isAm ? 'የድምፅ ቁልፎች ተቆልፈዋል — ፈተናውን ይጨርሱ።' : 'Volume keys are locked. Finish the mission to switch off the alarm.')}
              </motion.p>
            )}

            <details id="volume-lock-banner" data-hardware-keys={hardwareState} className="group rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-slate-300 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-2">
                  {isNativeKeyLockHeld ? <LockKeyhole className="h-4 w-4 shrink-0 text-emerald-300" /> : <VolumeX className="h-4 w-4 shrink-0 text-amber-300" />}
                  <span className="truncate">{lockSummary}</span>
                </span>
                <span className="shrink-0 rounded-full bg-slate-800 px-2 py-1 font-mono text-[9px] text-slate-400">{isAm ? `ደረጃ ${lockStatus?.escalationLevel ?? 0}/3` : `LOUD ${lockStatus?.escalationLevel ?? 0}/3`}</span>
              </summary>
              <div className="mt-3 space-y-2 border-t border-slate-800 pt-3 text-[10px] leading-relaxed text-slate-400">
                <p>
                  {hardwareState === 'unavailable'
                    ? (isAm ? 'ብራውዘር የስልክ አካላዊ ቁልፎችን መቆለፍ አይችልም።' : "Browser mode cannot lock physical keys. The Android app can block Volume and Back while the alarm is ringing.")
                    : hardwareState === 'failed'
                      ? (isAm ? 'የአካላዊ ቁልፎች መቆለፊያ አልተሳካም።' : "The native key lock did not confirm. Keep the app open and finish the mission.")
                      : isNativeKeyLockHeld
                        ? (isAm ? 'አካላዊ የድምፅ እና ተመለስ ቁልፎች በአንድሮይድ ተቆልፈዋል።' : 'Android confirmed that physical Volume and Back keys are blocked until the alarm is dismissed.')
                        : (isAm ? 'የሶፍትዌር ጥበቃ፣ ንዝረት እና የድምፅ ጭማሪ ንቁ ናቸው።' : 'Software key guard, haptics and loudness escalation are active while the task is open.')}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span>{isAm ? 'ቁልፍ መከላከያ ሙከራዎች' : 'Blocked key attempts'}</span>
                  <span className="font-mono font-bold text-rose-200">{lockStatus?.blockedAttempts ?? 0}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    [isAm ? 'የድምፅ ጠባቂ' : 'Audio watchdog', lockStatus?.audioWatchdogActive],
                    [isAm ? 'የማያ ጠባቂ' : 'Screen wake lock', lockStatus?.wakeLockHeld],
                    [isAm ? 'ሜዲያ መቆለፊያ' : 'Media controls', lockStatus?.mediaSessionLocked],
                    [isAm ? 'ንዝረት' : 'Haptics', lockStatus?.hapticsActive],
                  ].map(([label, active]) => (
                    <span key={String(label)} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${active ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-200' : 'border-slate-800 bg-slate-950 text-slate-500'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-300' : 'bg-slate-600'}`} />
                      <span className="truncate">{String(label)}</span>
                    </span>
                  ))}
                </div>
                <p className="text-slate-500">
                  {lockStatus && lockStatus.escalationLevel >= 2
                    ? (isAm ? 'ከጮኸ 60 ሰከንድ በኋላ የሲረን ድምፅ ተጨምሯል።' : 'The alarm adds a siren layer after 60 seconds and keeps escalating until dismissed.')
                    : (isAm ? 'ድምፁ በ30/60/90 ሰከንድ ደረጃ በደረጃ ይጨምራል።' : 'Alarm loudness steps up at 30, 60 and 90 seconds while the mission is open.')}
                </p>
              </div>
            </details>

            <p className="px-2 text-center text-[9px] leading-relaxed text-slate-500">
              {isAm ? 'የሰውነት ስሜት ወይም አደጋ ከተሰማዎት ድምፁን ይቆጣጠሩ። ማንቂያው ከፍተኛ ድምፅ ያለው ሊሆን ይችላል።' : 'Be mindful of your surroundings and hearing. Alarm loudness may escalate while the challenge is unfinished.'}
            </p>
          </div>
        </motion.main>
      </motion.div>
    </AnimatePresence>
  );
};

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}
