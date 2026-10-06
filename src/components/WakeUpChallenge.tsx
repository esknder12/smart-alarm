import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, LockKeyhole, ScanLine, Sparkles } from 'lucide-react';
import type { Alarm } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { MotionChallenge } from './MotionChallenge';
import { PhotoCheck } from './PhotoCheck';
import { barcodeMatches, createMathProblem, getMathQuestionCount } from '../utils/wakeChallenge';

interface WakeUpChallengeProps {
  alarm: Alarm;
  language?: 'en' | 'am';
  onComplete: () => void;
}

const affirmations = {
  en: [
    'I am awake and ready for today',
    'Today brings new opportunities and growth',
    'I embrace this morning with a clear mind',
    'Every day is a fresh beginning',
  ],
  am: [
    'ነቅቻለሁ እና ለዛሬው ቀን ዝግጁ ነኝ',
    'ዛሬ አዳዲስ እድሎችን እና እድገትን ያመጣል',
    'ይህንን ጠዋት በጠራ አእምሮ እቀበላለሁ',
    'እያንዳንዱ ቀን አዲስ ጅምር ነው',
  ],
};

const padColors = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
];

const randomSequence = (length: number) => Array.from({ length }, () => Math.floor(Math.random() * 4));

const MemoryMission: React.FC<{
  difficulty: Alarm['challengeDifficulty'];
  language: 'en' | 'am';
  onComplete: () => void;
}> = ({ difficulty, language, onComplete }) => {
  const isAm = language === 'am';
  const sequenceLength = difficulty === 'hard' ? 8 : difficulty === 'medium' ? 6 : 4;
  const [sequence, setSequence] = useState<number[]>([]);
  const [entered, setEntered] = useState<number[]>([]);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wrong, setWrong] = useState(false);
  const timersRef = useRef<number[]>([]);

  const playSequence = useCallback((next: number[]) => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    setIsPlaying(true);
    setActivePad(null);
    next.forEach((pad, index) => {
      const lightOn = window.setTimeout(() => {
        setActivePad(pad);
        if ('vibrate' in navigator) {
          try { navigator.vibrate(35); } catch { /* haptics are optional */ }
        }
        const lightOff = window.setTimeout(() => setActivePad(null), 310);
        timersRef.current.push(lightOff);
      }, 620 * (index + 1));
      timersRef.current.push(lightOn);
    });
    const finish = window.setTimeout(() => setIsPlaying(false), 620 * (next.length + 1));
    timersRef.current.push(finish);
  }, []);

  const startRound = useCallback(() => {
    const next = randomSequence(sequenceLength);
    setSequence(next);
    setEntered([]);
    setWrong(false);
    playSequence(next);
  }, [playSequence, sequenceLength]);

  useEffect(() => {
    startRound();
    return () => timersRef.current.forEach(window.clearTimeout);
  }, [startRound]);

  const handlePad = (index: number) => {
    if (isPlaying || sequence.length === 0) return;
    if ('vibrate' in navigator) {
      try { navigator.vibrate(35); } catch { /* haptics are optional */ }
    }
    const next = [...entered, index];
    setEntered(next);
    if (sequence[next.length - 1] !== index) {
      setWrong(true);
      if ('vibrate' in navigator) {
        try { navigator.vibrate([90, 50, 90]); } catch { /* haptics are optional */ }
      }
      const resetTimer = window.setTimeout(startRound, 350);
      timersRef.current.push(resetTimer);
      return;
    }
    if (next.length === sequence.length) onComplete();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-extrabold text-white">{isAm ? 'የሚበሩትን ቀለሞች ይድገሙ' : 'Repeat the light sequence'}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {isAm ? `${sequenceLength} ቀለሞችን በቅደም ተከተል ያስታውሱ። ስህተት ከሆነ ዙሩ እንደገና ይጀምራል።` : `Remember ${sequenceLength} lights in order. A mistake resets the round with a new pattern.`}
        </p>
      </div>
      <div className="grid max-w-[260px] grid-cols-2 gap-3 mx-auto">
        {padColors.map((color, index) => (
          <button
            key={index}
            type="button"
            disabled={isPlaying}
            aria-label={`${isAm ? 'ቀለም' : 'Color'} ${index + 1}`}
            onClick={() => handlePad(index)}
            className={`h-24 rounded-2xl ${color} transition duration-150 ${activePad === index ? 'scale-105 brightness-150 ring-4 ring-white' : 'opacity-80'} ${isPlaying ? 'cursor-wait' : 'active:scale-95'}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span aria-live="polite" className={wrong ? 'font-bold text-rose-300' : 'text-slate-400'}>
          {wrong ? (isAm ? 'አዲስ ቅደም ተከተል — በድጋሚ ይመልከቱ' : 'New pattern—watch again') : isPlaying ? (isAm ? 'ይመልከቱ…' : 'Watch…') : `${entered.length} / ${sequenceLength}`}
        </span>
        <button type="button" disabled={isPlaying} onClick={() => playSequence(sequence)} className="font-bold text-cyan-200 disabled:opacity-40">
          {isAm ? 'ቅደም ተከተሉን ድገም' : 'Replay pattern'}
        </button>
      </div>
    </div>
  );
};

const MathMission: React.FC<{
  alarm: Alarm;
  language: 'en' | 'am';
  progressLabel: string;
  onComplete: () => void;
}> = ({ alarm, language, progressLabel, onComplete }) => {
  const isAm = language === 'am';
  const count = getMathQuestionCount(alarm.challengeConfig);
  const [problem, setProblem] = useState(() => createMathProblem(alarm.challengeDifficulty));
  const [answer, setAnswer] = useState('');
  const [solved, setSolved] = useState(0);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (answer.trim() === String(problem.answer)) {
      const nextSolved = solved + 1;
      setError(false);
      setAnswer('');
      if (nextSolved >= count) {
        onComplete();
      } else {
        setSolved(nextSolved);
        setProblem(createMathProblem(alarm.challengeDifficulty));
        inputRef.current?.focus({ preventScroll: true });
      }
    } else {
      setError(true);
      setSolved(0);
      setAnswer('');
      setProblem(createMathProblem(alarm.challengeDifficulty));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-white">{isAm ? 'አእምሮዎን ያንቁ' : 'Wake your brain up'}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{isAm ? 'ያለ ስህተት የተከታታይ መልስ ያግኙ።' : 'Build a consecutive-answer streak. One wrong answer resets the streak.'}</p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-black text-amber-200">{progressLabel}</span>
      </div>
      <div className="flex gap-1.5" aria-label={isAm ? 'የሂሳብ እድገት' : 'Math streak progress'}>
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className={`h-1.5 flex-1 rounded-full ${index < solved ? 'bg-emerald-300' : 'bg-slate-700'}`} />
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-2xl border border-slate-700 bg-slate-950 py-4 text-center font-mono text-3xl font-black text-white" aria-live="polite">
          {problem.question} <span className="text-amber-300">= ?</span>
        </div>
        {error && <p role="alert" className="text-xs font-bold text-rose-300">{isAm ? 'አይደለም። የተከታታይ ሂሳብ ቆጠራ ወደ ዜሮ ተመልሷል።' : 'Not quite. The streak reset—take a breath and try the new one.'}</p>}
        <label className="sr-only" htmlFor="wake-math-answer">{isAm ? 'መልስዎ' : 'Your answer'}</label>
        <input
          ref={inputRef}
          id="wake-math-answer"
          inputMode="numeric"
          autoComplete="off"
          type="number"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder={isAm ? 'መልሱን ይጻፉ' : 'Type the answer'}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-xl font-bold text-white outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
        />
        <button type="submit" disabled={!answer.trim()} className="min-h-12 w-full rounded-xl bg-amber-300 px-4 py-3 font-extrabold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50">
          {isAm ? 'መልስ አረጋግጥ' : 'Check answer'}
        </button>
      </form>
    </div>
  );
};

export const WakeUpChallenge: React.FC<WakeUpChallengeProps> = ({ alarm, language = 'en', onComplete }) => {
  const isAm = language === 'am';
  const isCombo = alarm.challenge === 'combo';
  const [scanVerified, setScanVerified] = useState(false);
  const [scanError, setScanError] = useState('');
  const targetValue = alarm.challengeConfig?.barcodeValue;
  const targetLabel = alarm.challengeConfig?.barcodeTarget || (isAm ? 'ከመኝታ ክፍል ውጭ ያለው እቃ' : 'the item you left outside the bedroom');
  const needsBarcode = alarm.challenge === 'barcode' || isCombo;
  const needsMath = alarm.challenge === 'math' || (isCombo && scanVerified);
  const mathCount = useMemo(() => getMathQuestionCount(alarm.challengeConfig), [alarm.challengeConfig]);

  const handleBarcodeScan = useCallback((value: string) => {
    if (!barcodeMatches(value, targetValue)) {
      setScanError(isAm
        ? 'የተቃኘው ኮድ አይመሳሰልም። ወደ ተቀመጠው እቃ ይሂዱ እና ትክክለኛውን ኮድ ይቃኙ።'
        : 'Wrong item. Walk to the item you saved and scan its exact code.');
      if ('vibrate' in navigator) {
        try { navigator.vibrate([100, 45, 100]); } catch { /* haptics are optional */ }
      }
      return;
    }
    setScanError('');
    setScanVerified(true);
    if ('vibrate' in navigator) {
      try { navigator.vibrate([50, 40, 100]); } catch { /* haptics are optional */ }
    }
    if (!isCombo) onComplete();
  }, [isAm, isCombo, onComplete, targetValue]);

  const stageItems = isCombo
    ? [
        { done: scanVerified, title: isAm ? 'የተቀመጠውን እቃ ቃኝ' : 'Scan your saved item' },
        { done: false, title: isAm ? `${mathCount} የሂሳብ መልሶች` : `${mathCount} math answers` },
      ]
    : [];

  return (
    <section className="space-y-4" aria-label={isAm ? 'የመነቂያ ፈተና' : 'Wake-up challenge'}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-300/15 text-amber-200">
          {isCombo ? <Sparkles className="h-5 w-5" /> : needsBarcode ? <ScanLine className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-white">{isAm ? (isCombo ? 'የጠዋት ጉዞ ፈተና' : 'የመንቂያ ፈተና') : (isCombo ? 'Wake-up gauntlet' : 'Wake-up mission')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {needsBarcode
              ? (isAm ? `ከአልጋ ይነሱ፣ ወደ ${targetLabel} ይሂዱ እና ተመሳሳይ ባርኮድ ይቃኙ።` : `Get out of bed, go to ${targetLabel}, and scan the exact same item you locked in before sleep.`)
              : isAm ? 'ይህንን የንቃት ፈተና ያጠናቁ። ማንቂያው እስከዚያ ድረስ ይቀጥላል።' : 'Finish the wake-up task below. The alarm keeps ringing until you do.'}
          </p>
        </div>
      </div>

      {isCombo && (
        <ol className="grid grid-cols-2 gap-2" aria-label={isAm ? 'የጉዞ ደረጃዎች' : 'Gauntlet stages'}>
          {stageItems.map((item, index) => (
            <li key={item.title} className={`rounded-xl border px-3 py-2.5 ${item.done ? 'border-emerald-300/30 bg-emerald-300/10' : index === 0 || scanVerified ? 'border-amber-300/40 bg-amber-300/10' : 'border-slate-700 bg-slate-900/70'}`}>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
                {item.done ? <Check className="h-3 w-3 text-emerald-300" /> : <span>{index + 1}.</span>}
                {isAm ? `ደረጃ ${index + 1}` : `Stage ${index + 1}`}
              </div>
              <p className="mt-1 text-xs font-bold text-white">{item.title}</p>
            </li>
          ))}
        </ol>
      )}

      {needsBarcode && !scanVerified && (
        <div className="space-y-3">
          {!targetValue && (
            <p className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs leading-relaxed text-amber-100">
              {isAm ? 'ይህ የቆየ ቅንብር ትክክለኛ ኮድ አልያዘም። አሁን ማንኛውም ባርኮድ ይሰራል፤ ለበለጠ ደህንነት በሚቀጥለው ጊዜ ቅንብሩን ያስተካክሉ።' : 'This older alarm has no exact code saved. Any barcode will work this time; edit the alarm later to lock a specific item for stronger proof.'}
            </p>
          )}
          <BarcodeScanner
            language={language}
            title={isAm ? 'ትክክለኛውን ኮድ ይቃኙ' : 'Scan the exact item'}
            description={isAm ? `ከመኝታ ክፍል ውጭ ባለው ${targetLabel} ላይ ያለውን ኮድ ይቃኙ።` : `Scan the barcode or QR on ${targetLabel}, outside your bedroom.`}
            buttonLabel={isAm ? 'ካሜራ ክፈት እና እቃውን ቃኝ' : 'Open camera & scan item'}
            onScan={handleBarcodeScan}
          />
          {scanError && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs font-bold leading-relaxed text-rose-100">{scanError}</p>}
        </div>
      )}

      {needsMath && (
        <MathMission
          key={`${alarm.id}-gauntlet-math`}
          alarm={alarm}
          language={language}
          progressLabel={isCombo ? (isAm ? `ደረጃ 2/2 · ${mathCount} በተከታታይ` : `STAGE 2/2 · ${mathCount} in a row`) : `${mathCount} ${isAm ? 'ተከታታይ' : 'in a row'}`}
          onComplete={onComplete}
        />
      )}

      {alarm.challenge === 'steps' && (
        <MotionChallenge kind="steps" target={alarm.challengeConfig?.targetSteps ?? 30} language={language} onComplete={onComplete} />
      )}
      {alarm.challenge === 'squat' && (
        <MotionChallenge kind="squat" target={alarm.challengeConfig?.targetSquats ?? 10} language={language} onComplete={onComplete} />
      )}
      {alarm.challenge === 'shake' && (
        <MotionChallenge kind="shake" target={alarm.challengeDifficulty === 'hard' ? 40 : alarm.challengeDifficulty === 'medium' ? 25 : 15} language={language} onComplete={onComplete} />
      )}
      {(alarm.challenge === 'memory' || alarm.challenge === 'tiles') && (
        <MemoryMission key={`${alarm.id}-memory`} difficulty={alarm.challengeDifficulty} language={language} onComplete={onComplete} />
      )}
      {alarm.challenge === 'typing' && (
        <TypingMission key={`${alarm.id}-typing`} language={language} onComplete={onComplete} />
      )}
      {alarm.challenge === 'photo' && (
        <PhotoCheck target={alarm.challengeConfig?.photoTarget ?? (isAm ? 'መስተዋት' : 'the place you chose')} language={language} onComplete={onComplete} />
      )}
    </section>
  );
};

const TypingMission: React.FC<{ language: 'en' | 'am'; onComplete: () => void }> = ({ language, onComplete }) => {
  const phrase = useMemo(() => {
    const pool = affirmations[language];
    return pool[Math.floor(Math.random() * pool.length)];
  }, [language]);
  const [value, setValue] = useState('');
  const isAm = language === 'am';

  const update = (next: string) => {
    setValue(next);
    if (next.trim().toLocaleLowerCase() === phrase.toLocaleLowerCase()) onComplete();
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-extrabold text-white">{isAm ? 'የጠዋት አዎንታዊ ሐረግ' : 'Morning affirmation'}</h3>
        <p className="mt-1 text-xs text-slate-400">{isAm ? 'ሐረጉን በትክክል ይጻፉ።' : 'Type the phrase exactly to finish.'}</p>
      </div>
      <blockquote className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm font-bold leading-relaxed text-amber-100">“{phrase}”</blockquote>
      <label className="sr-only" htmlFor="wake-affirmation">{isAm ? 'አዎንታዊ ሐረግ' : 'Affirmation'}</label>
      <input id="wake-affirmation" autoComplete="off" value={value} onChange={(event) => update(event.target.value)} placeholder={isAm ? 'እዚህ ይጻፉ…' : 'Type it here…'} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30" />
    </div>
  );
};
