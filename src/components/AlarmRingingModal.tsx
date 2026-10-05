import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Alarm, ChallengeType } from '../types';
import { audioEngine } from '../utils/audio';
import {
  volumeLock,
  VolumeLockStatus,
  VolumeLockBlockedDetail,
  HardwareKeysState,
  VOLUME_LOCK_BLOCKED_EVENT,
} from '../utils/volumeLock';
import { nativeAlarmScheduler } from '../utils/alarmScheduler';
import { WALLPAPERS } from './AlarmClock';
import { Language } from '../utils/translations';
import { BellRing, Clock, CheckCircle2, ShieldAlert, Sparkles, Smartphone, Grid, Activity, Volume2, VolumeX, Lock, ShieldX } from 'lucide-react';

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
  const [volumeAttemptBlocked, setVolumeAttemptBlocked] = useState<boolean>(false);
  const [blockedKey, setBlockedKey] = useState<'volume' | 'back'>('volume');
  const [lockStatus, setLockStatus] = useState<VolumeLockStatus | null>(null);
  const [snoozeBlocked, setSnoozeBlocked] = useState<boolean>(false);
  const [challengePassed, setChallengePassed] = useState<boolean>(alarm.challenge === 'none');
  const [mathProblem, setMathProblem] = useState<{ question: string; answer: number }>({ question: '', answer: 0 });
  const [userMathInput, setUserMathInput] = useState<string>('');
  const [mathError, setMathError] = useState<boolean>(false);
  const ringingPanelRef = useRef<HTMLDivElement>(null);

  // Android's keyboard can shrink the visual viewport without changing the WebView's layout
  // viewport. Track it so the challenge panel remains scrollable above the keyboard.
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

  const keepFocusedFieldVisible = (event: React.FocusEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    window.setTimeout(() => {
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  };

  const [affirmation, setAffirmation] = useState<string>('');
  const [userTypingInput, setUserTypingInput] = useState<string>('');

  const [memorySequence, setMemorySequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [activePad, setActivePad] = useState<number | null>(null);

  // Shake Challenge State
  const [shakeCount, setShakeCount] = useState<number>(0);
  // Shake mission scales with the difficulty the user picked.
  const targetShakes =
    alarm.challengeDifficulty === 'hard' ? 40 : alarm.challengeDifficulty === 'medium' ? 25 : 15;

  // Auto-fade progress tracking
  const [fadeProgressSec, setFadeProgressSec] = useState<number>(0);
  const [currentVolumePercent, setCurrentVolumePercent] = useState<number>(alarm.gentleWakeUp ? 5 : alarm.volume);

  const activeWallpaper = WALLPAPERS.find((w) => w.id === alarm.wallpaper) || WALLPAPERS[0];

  useEffect(() => {
    // Start playing alarm audio with optional gentle fade-in
    audioEngine.startAlarmSound(
      alarm.sound,
      alarm.volume,
      alarm.gentleWakeUp,
      (elapsedSec, currentPercent) => {
        setFadeProgressSec(elapsedSec);
        setCurrentVolumePercent(currentPercent);
      }
    );

    // Setup Haptic Vibration Pattern
    let vibrateInterval: any = null;
    if ('vibrate' in navigator) {
      const triggerVibratePattern = () => {
        try {
          // Distinct wake-up haptic rhythm: [vibrate, pause, vibrate, pause, long-vibrate]
          navigator.vibrate([400, 150, 400, 150, 800]);
        } catch (e) {
          // ignore if browser blocks auto-vibration without gesture
        }
      };
      triggerVibratePattern();
      vibrateInterval = setInterval(triggerVibratePattern, 2500);
    }

    // Setup Challenge
    if (alarm.challenge === 'math') {
      generateMathProblem();
    } else if (alarm.challenge === 'typing') {
      const affirmationsAm = [
        'ነቅቻለሁ እና ለዛሬው ቀን ዝግጁ ነኝ',
        'ዛሬ አዳዲስ እድሎችን እና እድገትን ያመጣል',
        'ይህንን ጠዋት በጠራ አእምሮ እቀበላለሁ',
        'ዛሬ ግቦቼን ለማሳካት ብቃት አለኝ',
        'እያንዳንዱ ቀን አዲስ ጅምር ነው'
      ];
      const affirmationsEn = [
        'I am awake and ready for today',
        'Today brings new opportunities and growth',
        'I embrace this morning with a clear mind',
        'I have the power to accomplish my goals today',
        'Every day is a fresh beginning'
      ];
      const affirmations = isAm ? affirmationsAm : affirmationsEn;
      setAffirmation(affirmations[Math.floor(Math.random() * affirmations.length)]);
    } else if (alarm.challenge === 'memory' || alarm.challenge === 'tiles') {
      generateMemorySequence();
    }

    return () => {
      audioEngine.stopAlarmSound();
      if (vibrateInterval) clearInterval(vibrateInterval);
      if ('vibrate' in navigator) {
        try { navigator.vibrate(0); } catch (e) {}
      }
    };
  }, [alarm]);

  // Stop vibration when challenge passes
  useEffect(() => {
    if (challengePassed && 'vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 200]); // victory haptic pulse
      } catch (e) {}
    }
  }, [challengePassed]);

  /**
   * Strict Volume Lock.
   * In the Android app the physical volume keys and Back are swallowed natively
   * (see utils/alarmLock.ts); everywhere it also swallows volume-down/mute keys
   * the browser exposes, keeps the AudioContext awake and loud, re-mute-proofs
   * media elements, hijacks MediaSession controls, holds a screen wake lock and
   * escalates loudness while the challenge is unsolved.
   */
  useEffect(() => {
    volumeLock.engage({
      volumePercent: alarm.volume,
      escalation: true,
      haptics: true,
    });

    const unsubscribe = volumeLock.subscribe((status) => {
      setLockStatus(status);
    });

    // Fired once per blocked attempt. (Do NOT derive the toast from `blockedAttempts > 0`
    // in the subscription above: it emits every second, so the toast would never go away.)
    const onBlocked = (e: Event) => {
      const detail = (e as CustomEvent<VolumeLockBlockedDetail>).detail;
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

  /**
   * Phase 2 sound hand-off.
   *
   * When the ring came from the Android service (alarm fired while the app was closed), the phone
   * is already playing its own alarm tone on the alarm stream. This screen plays the user's chosen
   * theme through Web Audio instead, so as soon as that is really running the native tone is
   * silenced - never before it, so an alarm is never left silent. In a browser this whole effect is
   * skipped (there is no native engine to hand over from).
   */
  const tookOverNativeAudio = useRef(false);
  useEffect(() => {
    if (!nativeAlarmScheduler.isAvailable()) return;
    let retry: number | null = null;
    const takeOver = () => {
      if (!audioEngine.forceLoud()) {
        // Still suspended (no user gesture yet) - the native tone keeps ringing. Try once more.
        if (retry === null) retry = window.setTimeout(takeOver, 300);
        return;
      }
      if (tookOverNativeAudio.current) return;
      tookOverNativeAudio.current = true;
      void nativeAlarmScheduler.takeOverRing();
    };
    // Coming back to the app after it was in the background: the service rang natively again (it
    // must, the WebView is silenced there), so hand the sound back over.
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      tookOverNativeAudio.current = false;
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

  // Auto-hide the "volume locked" toast after a few seconds
  useEffect(() => {
    if (!volumeAttemptBlocked) return;
    const timer = setTimeout(() => setVolumeAttemptBlocked(false), 4000);
    return () => clearTimeout(timer);
  }, [volumeAttemptBlocked, lockStatus?.blockedAttempts]);

  const handleShake = () => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(60); } catch (e) {}
    }
    setShakeCount((prev) => {
      const next = prev + 1;
      if (next >= targetShakes) {
        setChallengePassed(true);
      }
      return next;
    });
  };

  const generateMathProblem = () => {
    let a = 12, b = 15;
    if (alarm.challengeDifficulty === 'easy') {
      a = Math.floor(Math.random() * 20) + 10;
      b = Math.floor(Math.random() * 20) + 10;
    } else if (alarm.challengeDifficulty === 'medium') {
      a = Math.floor(Math.random() * 40) + 15;
      b = Math.floor(Math.random() * 40) + 15;
    } else {
      a = Math.floor(Math.random() * 80) + 20;
      b = Math.floor(Math.random() * 80) + 20;
    }
    setMathProblem({ question: `${a} + ${b}`, answer: a + b });
    setUserMathInput('');
    setMathError(false);
  };

  const handleMathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(userMathInput, 10) === mathProblem.answer) {
      setChallengePassed(true);
    } else {
      if ('vibrate' in navigator) {
        try { navigator.vibrate([100, 50, 100]); } catch (e) {}
      }
      setMathError(true);
      generateMathProblem();
    }
  };

  const handleTypingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserTypingInput(e.target.value);
    if (e.target.value.trim().toLowerCase() === affirmation.toLowerCase()) {
      setChallengePassed(true);
    }
  };

  const generateMemorySequence = () => {
    const seq = Array.from({ length: 4 }, () => Math.floor(Math.random() * 4));
    setMemorySequence(seq);
    setUserSequence([]);
    playSequence(seq);
  };

  const playSequence = (seq: number[]) => {
    seq.forEach((pad, index) => {
      setTimeout(() => {
        setActivePad(pad);
        if ('vibrate' in navigator) {
          try { navigator.vibrate(40); } catch (e) {}
        }
        setTimeout(() => setActivePad(null), 300);
      }, (index + 1) * 600);
    });
  };

  const handleMemoryClick = (padIndex: number) => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(40); } catch (e) {}
    }
    const newSeq = [...userSequence, padIndex];
    setUserSequence(newSeq);

    if (newSeq[newSeq.length - 1] !== memorySequence[newSeq.length - 1]) {
      // Wrong sequence
      if ('vibrate' in navigator) {
        try { navigator.vibrate([100, 50, 100]); } catch (e) {}
      }
      generateMemorySequence();
      return;
    }

    if (newSeq.length === memorySequence.length) {
      setChallengePassed(true);
    }
  };

  // What the button lock can honestly promise right now. Until the first status arrives (a few ms)
  // we assume the lock is arming, so the banner does not flash a "browser only" warning.
  const hardwareState: HardwareKeysState =
    lockStatus && lockStatus.hardwareKeys !== 'inactive' ? lockStatus.hardwareKeys : 'pending';
  const buttonsLocked = hardwareState === 'locked' || hardwareState === 'pending';
  const tone = buttonsLocked
    ? { box: 'bg-amber-500/10 border-amber-500/30', icon: 'bg-amber-500/20 text-amber-400', title: 'text-amber-300', pill: 'bg-amber-500', divider: 'border-amber-500/20' }
    : hardwareState === 'failed'
      ? { box: 'bg-rose-500/10 border-rose-500/30', icon: 'bg-rose-500/20 text-rose-400', title: 'text-rose-300', pill: 'bg-rose-500', divider: 'border-rose-500/20' }
      : { box: 'bg-slate-800/60 border-slate-600/40', icon: 'bg-slate-700/60 text-slate-300', title: 'text-slate-200', pill: 'bg-slate-400', divider: 'border-slate-600/30' };
  const banner = buttonsLocked
    ? {
        title: isAm ? 'የድምፅ መቀነሻ ተቆልፏል' : 'Volume Down Disabled',
        pill: isAm ? 'ተቆልፏል' : 'LOCKED',
        body: isAm
          ? 'የድምፅ እና ተመለስ ቁልፎች ተቆልፈዋል። ፈተናውን ፈፅመው ማንቂያውን ሲያጠፉ ይከፈታሉ።'
          : 'Volume buttons & Back are locked until the challenge is finished & the alarm is disabled',
      }
    : hardwareState === 'failed'
      ? {
          title: isAm ? 'የቁልፍ መቆለፊያ አልተሳካም' : 'Button lock failed',
          pill: isAm ? 'ስህተት' : 'ERROR',
          body: isAm
            ? 'አካላዊ ቁልፎችን መቆለፍ አልተቻለም። ድምፅ ለመቀነስ ቢሞክሩ ማንቂያው ይጨምራል።'
            : "Couldn't lock the phone's buttons. Trying to turn the alarm down will make it louder instead.",
        }
      : {
          title: isAm ? 'የሶፍትዌር መቆለፊያ ብቻ' : 'Software lock only',
          pill: isAm ? 'ብራውዘር' : 'BROWSER',
          body: isAm
            ? 'ብራውዘር የስልክ የድምፅ ቁልፎችን መቆለፍ አይችልም። ሙሉ መቆለፊያ ለማግኘት የአንድሮይድ መተግበሪያውን ይጠቀሙ።'
            : "A browser can't lock the phone's volume buttons. Use the Android app for the full lock.",
        };

  const handleSnoozeWithHaptic = (mins: number) => {
    // Anti-cheat: snoozing without solving the mission is just going back to
    // sleep, so snooze stays locked until the challenge is passed.
    if (!challengePassed) {
      if ('vibrate' in navigator) {
        try { navigator.vibrate([150, 80, 150]); } catch (e) {}
      }
      setSnoozeBlocked(true);
      return;
    }
    if ('vibrate' in navigator) {
      try { navigator.vibrate(100); } catch (e) {}
    }
    audioEngine.stopAlarmSound();
    volumeLock.disengage();
    onSnooze(mins);
  };

  const handleDismissWithHaptic = () => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate([150, 50, 200]); } catch (e) {}
    }
    audioEngine.stopAlarmSound();
    // Release the strict volume lock only once the user has solved the
    // challenge and switched the alarm off.
    volumeLock.disengage();
    onDismiss();
  };

  return (
    <AnimatePresence>
      <motion.div
        id="alarm-ringing-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          top: 'var(--ringing-viewport-top, 0px)',
          height: 'var(--ringing-viewport-height, 100dvh)',
        }}
        className={`fixed inset-x-0 z-50 bg-gradient-to-br ${activeWallpaper.bgGradient} backdrop-blur-xl flex items-start justify-center overflow-y-auto overscroll-contain p-3 sm:items-center sm:p-4 transition-all duration-700`}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          ref={ringingPanelRef}
          className="max-w-md w-full my-auto bg-slate-900/90 border border-slate-700/60 rounded-3xl p-4 sm:p-8 text-center shadow-2xl relative overflow-visible backdrop-blur-md"
        >
        {/* Animated Background Ring */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />

        <div className="relative z-10">
          {/* Haptic Vibration Active Badge */}
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold mb-3 animate-pulse">
            <Activity className="w-3.5 h-3.5 text-white" />
            <span>Haptic Vibration & Audio Signal Active 📳</span>
          </div>

          {/* High Security Volume Lock Badge */}
          <div id="volume-lock-banner" data-hardware-keys={hardwareState} className={`mb-4 p-3 border rounded-2xl text-left shadow-md space-y-2.5 ${tone.box}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tone.icon}`}>
                  <VolumeX className={`w-4.5 h-4.5 ${buttonsLocked ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className={`text-xs font-bold flex items-center space-x-1 ${tone.title}`}>
                    <span>{banner.title}</span>
                    <span className={`text-[9px] text-slate-950 font-black px-1.5 py-0.5 rounded uppercase ${tone.pill}`}>
                      {banner.pill}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 mt-0.5">{banner.body}</div>
                </div>
              </div>
            </div>

            {/* Live lock telemetry: proof the guard is actually running */}
            <div className="grid grid-cols-2 gap-1.5 text-[9px] font-bold">
              {[
                // Lit only once the phone has confirmed it: proof for the user that the buttons are dead.
                { label: isAm ? 'የድምፅ እና ተመለስ ቁልፎች (ናቲቭ)' : 'Volume & Back buttons (native)', on: hardwareState === 'locked', wide: true },
                { label: isAm ? 'የቁልፍ ጠባቂ' : 'Key guard', on: lockStatus?.keyGuardActive ?? false, wide: false },
                { label: isAm ? 'የድምፅ ጠባቂ' : 'Audio watchdog', on: lockStatus?.audioWatchdogActive ?? false, wide: false },
                { label: isAm ? 'ሜዲያ መቆለፊያ' : 'MediaSession lock', on: lockStatus?.mediaSessionLocked ?? false, wide: false },
                { label: isAm ? 'ማያ ጠባቂ' : 'Screen wake lock', on: lockStatus?.wakeLockHeld ?? false, wide: false },
              ].map((item) => (
                <span
                  key={item.label}
                  className={`${item.wide ? 'col-span-2 ' : ''}flex items-center space-x-1 px-1.5 py-1 rounded-lg border ${
                    item.on
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${item.on ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
              ))}
            </div>

            {/* Loudness escalation ladder */}
            <div className={`pt-1 border-t ${tone.divider}`}>
              <div className="flex items-center justify-between text-[9px] font-bold mb-1">
                <span className={`flex items-center space-x-1 ${tone.title}`}>
                  <ShieldX className="w-3 h-3" />
                  <span>{isAm ? 'የድምፅ ጭማሪ ደረጃ' : 'Loudness escalation'}</span>
                </span>
                <span className="font-mono text-slate-300">
                  {isAm ? 'ደረጃ' : 'Level'} {lockStatus?.escalationLevel ?? 0}/3
                  {lockStatus && lockStatus.blockedAttempts > 0 && (
                    <span className="text-rose-400"> · {lockStatus.blockedAttempts} {isAm ? 'እገዳ' : 'blocked'}</span>
                  )}
                </span>
              </div>
              <div className="flex space-x-1">
                {[0, 1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 flex-1 rounded-full ${
                      (lockStatus?.escalationLevel ?? 0) >= step
                        ? ['bg-emerald-400', 'bg-amber-400', 'bg-orange-500', 'bg-rose-500'][step]
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                {isAm
                  ? 'ማንቂያው ሳይጠፋ ሲቀር 30 ሰከንድ ሲሞላ ድምፁ ይጨምራል፣ 60 ሰከንድ ሲሞላ አስደንጋጭ ሲረን ይጨመራል።'
                  : 'Loudness rises at 30s and a piercing siren layer kicks in at 60s until the alarm is dismissed.'}
              </p>
            </div>
          </div>

          {/* Toast Alert on Volume Down Attempt */}
          <AnimatePresence>
            {volumeAttemptBlocked && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                className="mb-4 p-3 bg-rose-500 text-white rounded-2xl font-bold text-xs shadow-xl flex items-center justify-center space-x-2 animate-bounce border border-rose-300"
              >
                <ShieldAlert className="w-4 h-4 shrink-0 text-white" />
                <span id="volume-lock-toast">
                  {blockedKey === 'back'
                    ? (challengePassed
                        ? (isAm
                            ? 'ተመለስ ቁልፍ ተቆልፏል! ለመክፈት "ማንቂያውን አጥፋ" የሚለውን ይጫኑ።'
                            : 'Back is locked! Click "Disable Alarm" below to turn off the alarm.')
                        : (isAm
                            ? 'ተመለስ ቁልፍ ተቆልፏል! ማንቂያውን ለማጥፋት ፈተናውን ይጨርሱ።'
                            : 'Back is locked! Finish the challenge to turn off the alarm.'))
                    : (challengePassed
                        ? (isAm
                            ? 'የድምፅ ቁልፎች ተቆልፈዋል! ለመክፈት "ማንቂያውን አጥፋ" የሚለውን ይጫኑ።'
                            : 'Volume buttons locked! Click "Disable Alarm" below to turn off the alarm and unlock them.')
                        : (isAm
                            ? 'የድምፅ ቁልፎች ተቆልፈዋል! ማንቂያውን ለማጥፋት ፈተናውን ይጨርሱ።'
                            : 'Volume buttons locked! Finish the challenge & disable the alarm to unlock them.'))}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bell Icon with Visual Haptic Ripple Rings */}
          <div className="relative mx-auto w-20 h-20 mb-4">
            <span className="absolute inset-0 rounded-full bg-slate-700/30 animate-ping pointer-events-none" />
            <div className="w-20 h-20 rounded-full bg-slate-800 text-white flex items-center justify-center ring-8 ring-slate-700/30 animate-bounce relative z-10">
              <BellRing className="w-10 h-10 text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-extrabold text-white tracking-tight">{alarm.label || (isAm ? 'የመነቂያ ሰዓት!' : 'Wake-up Time!')}</h2>
          {activeWallpaper.quote && (
            <p className="text-amber-300/90 text-xs italic mt-1 px-4">"{activeWallpaper.quote}"</p>
          )}
          <p className="text-slate-400 text-xs mt-1">{isAm ? 'የተያዘለት ሰዓት:' : 'Scheduled for:'} {alarm.time}</p>

          {/* Current Time Big Display */}
          <div className="my-5 py-4 bg-slate-950/70 rounded-2xl border border-slate-800/80 shadow-inner">
            <span className="text-5xl font-mono font-black text-amber-400 tracking-wider">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Auto-Fade Volume Ramp Progress Indicator */}
          {alarm.gentleWakeUp && (
            <div className="mb-5 bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3 text-left space-y-1.5 shadow-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-400 font-bold flex items-center space-x-1.5">
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  <span>{isAm ? '30 ሰከንድ የድምፅ በደረጃ መጨመሪያ' : '30s Auto-Fade Volume Ramp'}</span>
                </span>
                <span className="font-mono text-slate-300 font-bold text-[11px]">
                  {currentVolumePercent}% ({fadeProgressSec}s / 30s)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-emerald-400 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${Math.min(100, Math.max(5, (fadeProgressSec / 30) * 100))}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                {fadeProgressSec < 30
                  ? (isAm ? 'ከባድ ድንጋጤን ለመከላከል ድምፁ በደረጃ እየጨመረ ነው...' : 'Gradually ramping up volume to prevent shock...')
                  : (isAm ? 'የተፈለገው የድምፅ መጠን ላይ ደርሷል!' : 'Target volume reached!')}
              </p>
            </div>
          )}

          {/* Challenge Section */}
          {!challengePassed ? (
            <div className="my-5 bg-slate-800/70 p-5 rounded-2xl border border-slate-700/60 text-left">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm mb-3">
                <ShieldAlert className="w-4 h-4" />
                <span>{isAm ? 'የመንቂያ ፈተና ያስፈልጋል' : 'Wake-Up Challenge Required'}</span>
              </div>

              {alarm.challenge === 'math' && (
                <div>
                  <p className="text-xs text-slate-300 mb-2">
                    {isAm ? 'ማንቂያውን ለማጥፋት ይህንን የሂሳብ ጥያቄ ይመልሱ:' : 'Solve this math equation to turn off the alarm:'}
                  </p>
                  <form onSubmit={handleMathSubmit} className="space-y-3">
                    <div className="text-2xl font-mono font-bold text-center text-white py-2 bg-slate-900 rounded-lg">
                      {mathProblem.question} = ?
                    </div>
                    {mathError && (
                      <p className="text-xs text-rose-400 font-medium">
                        {isAm ? 'ትክክል አይደለም፣ አዲሱን ጥያቄ ይሞክሩ!' : 'Incorrect answer, try this new equation!'}
                      </p>
                    )}
                    <input
                      type="number"
                      inputMode="numeric"
                      onFocus={keepFocusedFieldVisible}
                      value={userMathInput}
                      onChange={(e) => setUserMathInput(e.target.value)}
                      placeholder={isAm ? 'መልሱን ይፃፉ...' : 'Type answer...'}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center text-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition"
                    >
                      {isAm ? 'መልስ አስገባ' : 'Submit Answer'}
                    </button>
                  </form>
                </div>
              )}

              {alarm.challenge === 'shake' && (
                <div className="text-center space-y-3">
                  <p className="text-xs text-slate-300">
                    {isAm ? `ስልክዎን ${targetShakes} ጊዜ ይንቀጥቅጡ:` : `Tap or Shake phone ${targetShakes} times to wake up your body:`}
                  </p>
                  <div className="w-full bg-slate-900 rounded-full h-4 p-0.5 border border-slate-700 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-200"
                      style={{ width: `${Math.min(100, (shakeCount / targetShakes) * 100)}%` }}
                    />
                  </div>
                  <div className="text-2xl font-mono font-black text-amber-400">
                    {shakeCount} / {targetShakes} {isAm ? 'መንቀጥቀጦች' : 'Shakes'}
                  </div>
                  <button
                    onClick={handleShake}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-3.5 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    <Smartphone className="w-5 h-5 animate-bounce" />
                    <span>{isAm ? 'መሣሪያውን ንካ / አንቀጥቅጥ!' : 'Tap / Shake Device!'}</span>
                  </button>
                </div>
              )}

              {alarm.challenge === 'typing' && (
                <div>
                  <p className="text-xs text-slate-300 mb-2">
                    {isAm ? 'ማንቂያውን ለማጥፋት ከታች ያለውን ሐረግ በትክክል ይፃፉ:' : 'Type the exact phrase below to unlock dismissal:'}
                  </p>
                  <div className="text-sm font-medium text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 mb-3 italic">
                    "{affirmation}"
                  </div>
                  <input
                    type="text"
                    onFocus={keepFocusedFieldVisible}
                    value={userTypingInput}
                    onChange={handleTypingChange}
                    placeholder={isAm ? 'ሐረጉን እዚህ ይፃፉ...' : 'Type affirmation here...'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    autoFocus
                  />
                </div>
              )}

              {(alarm.challenge === 'memory' || alarm.challenge === 'tiles') && (
                <div>
                  <p className="text-xs text-slate-300 mb-3">
                    {isAm ? 'የሚበሩትን 4 ቀለሞች ቅደም ተከተል ይድገሙ:' : 'Repeat the 4-step flashing color pattern:'}
                  </p>
                  <div className="grid grid-cols-2 gap-3 max-w-[200px] mx-auto mb-3">
                    {['bg-emerald-500', 'bg-sky-500', 'bg-amber-500', 'bg-rose-500'].map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleMemoryClick(idx)}
                        className={`h-16 rounded-xl transition ${color} ${
                          activePad === idx ? 'brightness-150 ring-4 ring-white scale-105' : 'opacity-80 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={generateMemorySequence}
                    className="w-full text-xs text-slate-400 hover:text-slate-200 py-1"
                  >
                    {isAm ? 'ቅደም ተከተሉን በድጋሚ አሳይ' : 'Replay Sequence'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="my-5 bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center space-x-3 text-emerald-400 text-sm">
              <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-400" />
              <div className="text-left">
                <div className="font-bold">
                  {isAm ? 'ፈተናው በስኬት ተጠናቋል!' : 'Challenge Completed!'}
                </div>
                <div className="text-xs text-emerald-300/80">
                  {isAm
                    ? 'ማንቂያውን ለማጥፋት እና ድምፅ ቁልፉን ለመክፈት ከታች ያለውን አዝራር ይጫኑ።'
                    : 'Click "Disable Alarm" below to turn off alarm sound and release volume lock.'}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            {challengePassed ? (
              <button
                id="btn-dismiss-alarm"
                onClick={handleDismissWithHaptic}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-base py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center space-x-2"
              >
                <Sparkles className="w-5 h-5" />
                <span>
                  {isAm ? 'ማንቂያውን አጥፋ እና ቀኑን ጀምር' : 'Disable Alarm & Start Day'}
                </span>
              </button>
            ) : (
              <div className="text-xs text-slate-400 italic text-center">
                {isAm
                  ? 'ማንቂያውን ለማጥፋት እና ድምፅ መቀነሻውን ለመክፈት ከላይ ያለውን ፈተና ይጨርሱ'
                  : 'Complete the challenge above to disable alarm & unlock volume controls'}
              </div>
            )}

            <button
              id="btn-snooze-alarm"
              onClick={() => handleSnoozeWithHaptic(9)}
              aria-disabled={!challengePassed}
              className={`w-full font-semibold py-3.5 rounded-2xl transition flex items-center justify-center space-x-2 border ${
                challengePassed
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/80'
                  : 'bg-slate-900/80 text-slate-500 border-slate-800 cursor-not-allowed'
              }`}
            >
              {challengePassed ? (
                <Clock className="w-4 h-4 text-amber-400" />
              ) : (
                <Lock className="w-4 h-4 text-rose-400" />
              )}
              <span>
                {challengePassed
                  ? (isAm ? 'አጥፋና ከ9 ደቂቃ በኋላ ድገም' : 'Snooze 9 Minutes')
                  : (isAm ? 'ድጋሚ ማንቂያ ተቆልፏል — ፈተናውን ይጨርሱ' : 'Snooze locked — solve the mission first')}
              </span>
            </button>

            {snoozeBlocked && !challengePassed && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] text-rose-300 font-bold text-center"
              >
                {isAm
                  ? 'ያለ ፈተና መተኛት አይቻልም! አእምሮዎን ለማንቃት ፈተናውን ይጨርሱ።'
                  : 'No sleep without the mission! Finish the challenge to wake your brain up.'}
              </motion.p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
  );
};

