import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Alarm, ChallengeType } from '../types';
import { audioEngine } from '../utils/audio';
import { WALLPAPERS } from './AlarmClock';
import { Language } from '../utils/translations';
import { BellRing, Clock, CheckCircle2, ShieldAlert, Sparkles, Smartphone, Grid, Activity, Volume2, VolumeX, Lock } from 'lucide-react';

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
  language = 'am',
}) => {
  const isAm = language === 'am';
  const [volumeAttemptBlocked, setVolumeAttemptBlocked] = useState<boolean>(false);
  const [challengePassed, setChallengePassed] = useState<boolean>(alarm.challenge === 'none');
  const [mathProblem, setMathProblem] = useState<{ question: string; answer: number }>({ question: '', answer: 0 });
  const [userMathInput, setUserMathInput] = useState<string>('');
  const [mathError, setMathError] = useState<boolean>(false);

  const [affirmation, setAffirmation] = useState<string>('');
  const [userTypingInput, setUserTypingInput] = useState<string>('');

  const [memorySequence, setMemorySequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [activePad, setActivePad] = useState<number | null>(null);

  // Shake Challenge State
  const [shakeCount, setShakeCount] = useState<number>(0);
  const targetShakes = 15;

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
      const affirmations = [
        'ነቅቻለሁ እና ለዛሬው ቀን ዝግጁ ነኝ',
        'ዛሬ አዳዲስ እድሎችን እና እድገትን ያመጣል',
        'ይህንን ጠዋት በጠራ አእምሮ እቀበላለሁ',
        'ዛሬ ግቦቼን ለማሳካት ብቃት አለኝ',
        'እያንዳንዱ ቀን አዲስ ጅምር ነው'
      ];
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

  // Intercept and disable Volume Down and Mute key presses during ringing until alarm is disabled
  useEffect(() => {
    const handleVolumeLock = (e: KeyboardEvent) => {
      const isVolKey =
        e.key === 'AudioVolumeDown' ||
        e.key === 'VolumeDown' ||
        e.key === 'AudioVolumeMute' ||
        e.key === 'VolumeMute' ||
        e.code === 'AudioVolumeDown' ||
        e.code === 'VolumeDown' ||
        e.code === 'AudioVolumeMute' ||
        e.code === 'VolumeMute' ||
        e.key === '-' ||
        e.key === 'PageDown' ||
        (e.key === 'ArrowDown' && (e.altKey || e.ctrlKey || e.metaKey));

      if (isVolKey) {
        e.preventDefault();
        e.stopPropagation();
        setVolumeAttemptBlocked(true);
        if ('vibrate' in navigator) {
          try { navigator.vibrate([150, 80, 150]); } catch (err) {}
        }
        setTimeout(() => setVolumeAttemptBlocked(false), 3000);
      }
    };

    window.addEventListener('keydown', handleVolumeLock, true);
    window.addEventListener('keyup', handleVolumeLock, true);
    return () => {
      window.removeEventListener('keydown', handleVolumeLock, true);
      window.removeEventListener('keyup', handleVolumeLock, true);
    };
  }, []);

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

  const handleSnoozeWithHaptic = (mins: number) => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(100); } catch (e) {}
    }
    audioEngine.stopAlarmSound();
    onSnooze(mins);
  };

  const handleDismissWithHaptic = () => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate([150, 50, 200]); } catch (e) {}
    }
    audioEngine.stopAlarmSound();
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
        className={`fixed inset-0 z-50 bg-gradient-to-br ${activeWallpaper.bgGradient} backdrop-blur-xl flex items-center justify-center p-4 transition-all duration-700`}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="max-w-md w-full bg-slate-900/90 border border-slate-700/60 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden backdrop-blur-md"
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
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <VolumeX className="w-4.5 h-4.5 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-300 flex items-center space-x-1">
                  <span>{isAm ? 'የድምፅ መቀነሻ ተቆልፏል' : 'Volume Down Disabled'}</span>
                  <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded uppercase">
                    {isAm ? 'ተቆልፏል' : 'LOCKED'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">
                  {isAm
                    ? 'ድምፅ መቀነስ አይቻልም። ፈተናውን ፈፅመው ማንቂያውን ሲያጠፉ ይከፈታል።'
                    : 'Volume down is locked until challenge is finished & alarm is disabled'}
                </div>
              </div>
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
                <span>
                  {challengePassed
                    ? (isAm
                        ? 'የድምፅ መቀነሻ ተቆልፏል! ድምፅ ለመክፈት "ማንቂያውን አጥፋ" የሚለውን ይጫኑ።'
                        : 'Volume Down Locked! Click "Disable Alarm" below to turn off alarm and release volume lock.')
                    : (isAm
                        ? 'የድምፅ መቀነሻ ተቆልፏል! ማንቂያውን ለማጥፋት ፈተናውን ይጨርሱ።'
                        : 'Volume Down Locked! Finish challenge & disable alarm to unlock volume.')}
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

          <h2 className="text-3xl font-extrabold text-white tracking-tight">{alarm.label || 'የመነቂያ ሰዓት!'}</h2>
          {activeWallpaper.quote && (
            <p className="text-amber-300/90 text-xs italic mt-1 px-4">"{activeWallpaper.quote}"</p>
          )}
          <p className="text-slate-400 text-xs mt-1">የተያዘለት ሰዓት: {alarm.time}</p>

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
                  <span>30 ሰከንድ የድምፅ በደረጃ መጨመሪያ</span>
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
                  ? 'ከባድ ድንጋጤን ለመከላከል ድምፁ በደረጃ እየጨመረ ነው...'
                  : 'የተፈለገው የድምፅ መጠን ላይ ደርሷል!'}
              </p>
            </div>
          )}

          {/* Challenge Section */}
          {!challengePassed ? (
            <div className="my-5 bg-slate-800/70 p-5 rounded-2xl border border-slate-700/60 text-left">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm mb-3">
                <ShieldAlert className="w-4 h-4" />
                <span>Wake-Up Challenge Required</span>
              </div>

              {alarm.challenge === 'math' && (
                <div>
                  <p className="text-xs text-slate-300 mb-2">Solve this math equation to turn off the alarm:</p>
                  <form onSubmit={handleMathSubmit} className="space-y-3">
                    <div className="text-2xl font-mono font-bold text-center text-white py-2 bg-slate-900 rounded-lg">
                      {mathProblem.question} = ?
                    </div>
                    {mathError && <p className="text-xs text-rose-400 font-medium">Incorrect answer, try this new equation!</p>}
                    <input
                      type="number"
                      value={userMathInput}
                      onChange={(e) => setUserMathInput(e.target.value)}
                      placeholder="Type answer..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center text-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition"
                    >
                      Submit Answer
                    </button>
                  </form>
                </div>
              )}

              {alarm.challenge === 'shake' && (
                <div className="text-center space-y-3">
                  <p className="text-xs text-slate-300">Tap or Shake phone {targetShakes} times to wake up your body:</p>
                  <div className="w-full bg-slate-900 rounded-full h-4 p-0.5 border border-slate-700 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-200"
                      style={{ width: `${Math.min(100, (shakeCount / targetShakes) * 100)}%` }}
                    />
                  </div>
                  <div className="text-2xl font-mono font-black text-amber-400">
                    {shakeCount} / {targetShakes} Shakes
                  </div>
                  <button
                    onClick={handleShake}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-3.5 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    <Smartphone className="w-5 h-5 animate-bounce" />
                    <span>Tap / Shake Device!</span>
                  </button>
                </div>
              )}

              {alarm.challenge === 'typing' && (
                <div>
                  <p className="text-xs text-slate-300 mb-2">Type the exact phrase below to unlock dismissal:</p>
                  <div className="text-sm font-medium text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 mb-3 italic">
                    "{affirmation}"
                  </div>
                  <input
                    type="text"
                    value={userTypingInput}
                    onChange={handleTypingChange}
                    placeholder="Type affirmation here..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    autoFocus
                  />
                </div>
              )}

              {(alarm.challenge === 'memory' || alarm.challenge === 'tiles') && (
                <div>
                  <p className="text-xs text-slate-300 mb-3">Repeat the 4-step flashing color pattern:</p>
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
                    Replay Sequence
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
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3.5 rounded-2xl transition flex items-center justify-center space-x-2 border border-slate-700/80"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{isAm ? 'አጥፋና ከ9 ደቂቃ በኋላ ድገም' : 'Snooze 9 Minutes'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
  );
};

