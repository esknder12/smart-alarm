import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  Clock3,
  Music2,
  Play,
  ShieldCheck,
  Square,
  Tag,
  Volume2,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { Alarm, ChallengeType, RINGTONES_CATALOG, SoundType } from '../types';
import { Language, translations } from '../utils/translations';
import { audioEngine } from '../utils/audio';
import { describeRepeat, nextOccurrenceLabel, shortDayName } from '../utils/alarmText';

export interface AlarmEditorScreenProps {
  editingAlarm: Alarm | null;
  language?: Language;
  time: string;
  onTimeChange: (time: string) => void;
  label: string;
  onLabelChange: (label: string) => void;
  repeatDays: number[];
  onToggleDay: (dayIndex: number) => void;
  sound: SoundType;
  onSoundChange: (sound: SoundType) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  gentleWakeUp: boolean;
  onGentleWakeUpChange: (gentle: boolean) => void;
  challenge: ChallengeType;
  onChallengeChange: (challenge: ChallengeType) => void;
  canCancel: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export interface TimeParts {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
}

export function getTimeParts(time: string): TimeParts {
  const [hourString, minuteString] = (time || '07:00').split(':');
  const hour24 = Number.parseInt(hourString, 10);
  const minute = Number.parseInt(minuteString, 10);
  const validHour = Number.isFinite(hour24) && hour24 >= 0 && hour24 <= 23 ? hour24 : 7;
  const validMinute = Number.isFinite(minute) && minute >= 0 && minute <= 59 ? minute : 0;
  const hour12 = validHour % 12 || 12;

  return {
    hour: String(hour12).padStart(2, '0'),
    minute: String(validMinute).padStart(2, '0'),
    period: validHour >= 12 ? 'PM' : 'AM',
  };
}

export function to24HourTime(parts: TimeParts): string {
  const parsedHour = Number.parseInt(parts.hour, 10);
  const parsedMinute = Number.parseInt(parts.minute, 10);
  const hour12 = Math.min(12, Math.max(1, Number.isFinite(parsedHour) ? parsedHour : 12));
  const minute = Math.min(59, Math.max(0, Number.isFinite(parsedMinute) ? parsedMinute : 0));
  const hour24 = (hour12 % 12) + (parts.period === 'PM' ? 12 : 0);

  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function stepHour(parts: TimeParts, amount: number): TimeParts {
  const parsedHour = Number.parseInt(parts.hour, 10);
  const hour = Math.min(12, Math.max(1, Number.isFinite(parsedHour) ? parsedHour : 12));
  let nextHour = hour;
  let period = parts.period;

  if (amount > 0) {
    if (hour === 12) nextHour = 1;
    else if (hour === 11) {
      nextHour = 12;
      period = period === 'AM' ? 'PM' : 'AM';
    } else nextHour = hour + 1;
  } else if (amount < 0) {
    if (hour === 1) nextHour = 12;
    else if (hour === 12) {
      nextHour = 11;
      period = period === 'AM' ? 'PM' : 'AM';
    } else nextHour = hour - 1;
  }

  return { ...parts, hour: String(nextHour).padStart(2, '0'), period };
}

const FEATURED_SOUND_IDS: SoundType[] = ['sunrise', 'goodmorning', 'piano', 'nature', 'chime', 'radar'];

const AlarmEditorScreen: React.FC<AlarmEditorScreenProps> = ({
  editingAlarm,
  language = 'en' as Language,
  time,
  onTimeChange,
  label,
  onLabelChange,
  repeatDays,
  onToggleDay,
  sound,
  onSoundChange,
  volume,
  onVolumeChange,
  gentleWakeUp,
  onGentleWakeUpChange,
  challenge,
  onChallengeChange,
  canCancel,
  onCancel,
  onSave,
}) => {
  const t = translations[language];
  const amharic = language === 'am';
  const [timeParts, setTimeParts] = useState<TimeParts>(() => getTimeParts(time));
  const [showAllSounds, setShowAllSounds] = useState(false);
  const [previewingSound, setPreviewingSound] = useState<SoundType | null>(null);

  useEffect(() => () => audioEngine.stopAlarmSound(), []);

  const commitTimeParts = (parts: TimeParts) => {
    onTimeChange(to24HourTime(parts));
  };

  const changeTimePart = (part: 'hour' | 'minute', rawValue: string) => {
    const nextValue = rawValue.replace(/\D/g, '').slice(0, 2);
    const next = { ...timeParts, [part]: nextValue };
    setTimeParts(next);
    commitTimeParts(next);
  };

  const normalizeTimePart = (part: 'hour' | 'minute') => {
    const current = Number.parseInt(timeParts[part], 10);
    const fallback = part === 'hour' ? 12 : 0;
    const maximum = part === 'hour' ? 12 : 59;
    const minimum = part === 'hour' ? 1 : 0;
    const normalized = Math.min(maximum, Math.max(minimum, Number.isFinite(current) ? current : fallback));
    const next = { ...timeParts, [part]: String(normalized).padStart(2, '0') };
    setTimeParts(next);
    commitTimeParts(next);
  };

  const adjustTimePart = (part: 'hour' | 'minute', amount: number) => {
    const current = Number.parseInt(timeParts[part], 10);
    if (part === 'hour') {
      const next = stepHour(timeParts, amount);
      setTimeParts(next);
      commitTimeParts(next);
      return;
    }

    const minute = Number.isFinite(current) ? Math.min(59, Math.max(0, current)) : 0;
    let nextMinute = minute + amount;
    let next = { ...timeParts, minute: String(Math.min(59, Math.max(0, nextMinute))).padStart(2, '0') };
    if (nextMinute >= 60) {
      nextMinute = 0;
      next = stepHour({ ...next, minute: '00' }, 1);
    } else if (nextMinute < 0) {
      nextMinute = 59;
      next = stepHour({ ...next, minute: '59' }, -1);
    }
    next = { ...next, minute: String(nextMinute).padStart(2, '0') };
    setTimeParts(next);
    commitTimeParts(next);
  };

  const setPeriod = (period: TimeParts['period']) => {
    const next = { ...timeParts, period };
    setTimeParts(next);
    commitTimeParts(next);
  };

  const currentTone = RINGTONES_CATALOG.find((tone) => tone.id === sound);
  const soundTitle = currentTone?.title ?? sound;
  const soundEmoji = currentTone?.emoji ?? '🎵';
  const featuredSounds = RINGTONES_CATALOG.filter((tone) => FEATURED_SOUND_IDS.includes(tone.id));
  const compactSounds = featuredSounds.some((tone) => tone.id === sound)
    ? featuredSounds
    : currentTone
      ? [currentTone, ...featuredSounds.slice(0, 5)]
      : featuredSounds;
  const visibleSounds = showAllSounds ? RINGTONES_CATALOG : compactSounds;

  const stopPreview = () => {
    audioEngine.stopAlarmSound();
    setPreviewingSound(null);
  };

  const togglePreview = (soundId: SoundType) => {
    if (previewingSound === soundId) {
      stopPreview();
      return;
    }
    audioEngine.stopAlarmSound();
    audioEngine.startAlarmSound(soundId, volume, false);
    setPreviewingSound(soundId);
  };

  const selectSound = (soundId: SoundType) => {
    if (previewingSound) stopPreview();
    onSoundChange(soundId);
  };

  const dayLetters = amharic
    ? [0, 1, 2, 3, 4, 5, 6].map((index) => shortDayName(index, 'am').slice(0, 1))
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const missionOptions: { id: ChallengeType; emoji: string; title: string }[] = [
    { id: 'none', emoji: '🔔', title: amharic ? 'ማጥፊያ ብቻ' : 'Dismiss only' },
    { id: 'math', emoji: '➗', title: amharic ? 'ሂሳብ' : 'Math' },
    { id: 'shake', emoji: '📳', title: amharic ? 'አናውጥ' : 'Shake' },
    { id: 'memory', emoji: '🧠', title: amharic ? 'ትውስታ' : 'Memory' },
    { id: 'tiles', emoji: '🧩', title: amharic ? 'ቅደም ተከተል' : 'Pattern' },
    { id: 'typing', emoji: '⌨️', title: amharic ? 'ማረጋገጫ ጽሑፍ' : 'Affirmation' },
  ];
  const selectedMission = missionOptions.find((option) => option.id === challenge) ?? missionOptions[1];

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The blur handlers normalize partially-entered digits before saving from the CTA.
    onSave();
  };

  return (
    <form onSubmit={handleSave} className="min-h-dvh bg-[#070914] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-36 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-red-600/10 blur-3xl" />
        <div className="absolute right-[-90px] top-[38%] h-64 w-64 rounded-full bg-amber-400/[0.04] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-xl px-4 pb-36 pt-3 sm:px-6 sm:pt-6">
        <header className="mb-5 flex h-12 items-center justify-between">
          <div className="flex w-10 justify-start">
            {canCancel && (
              <button
                type="button"
                onClick={onCancel}
                aria-label={t.cancelBtn}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900/80 text-slate-300 transition hover:border-slate-700 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-red-400">
              NIQU · ALARM
            </p>
            <h1 className="mt-0.5 text-lg font-black tracking-tight text-white">
              {editingAlarm ? t.editAlarmTitle : t.addAlarmTitle}
            </h1>
          </div>
          <div className="w-10 text-right">
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-300">
              {editingAlarm ? (amharic ? 'ማስተካከያ' : 'Edit') : (amharic ? 'አዲስ' : 'New')}
            </span>
          </div>
        </header>

        <div className="space-y-3.5">
          {/* Inline time controls — text fields and steppers only, never a native clock dialog. */}
          <section className="relative overflow-hidden rounded-[28px] border border-slate-700/80 bg-[#090d21] px-4 pb-4 pt-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:px-5 sm:pb-5">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-red-500/[0.06] via-transparent to-blue-500/[0.05]" />
            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Clock3 className="h-4 w-4 text-red-400" />
                  <span>{amharic ? 'የማንቂያ ሰዓት' : 'Alarm time'}</span>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                  12 hour
                </span>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_72px] items-center gap-2 sm:gap-3" role="group" aria-label={t.alarmTimeLabel}>
                <TimeDigitBlock
                  id="alarm-hour-input"
                  value={timeParts.hour}
                  label={amharic ? 'ሰዓት' : 'HOUR'}
                  ariaLabel={amharic ? 'የሰዓት ቁጥር' : 'Alarm hour'}
                  tone="red"
                  onChange={(value) => changeTimePart('hour', value)}
                  onBlur={() => normalizeTimePart('hour')}
                  onIncrease={() => adjustTimePart('hour', 1)}
                  onDecrease={() => adjustTimePart('hour', -1)}
                />
                <span className="mb-5 text-3xl font-black text-slate-500" aria-hidden="true">:</span>
                <TimeDigitBlock
                  id="alarm-minute-input"
                  value={timeParts.minute}
                  label={amharic ? 'ደቂቃ' : 'MIN'}
                  ariaLabel={amharic ? 'የደቂቃ ቁጥር' : 'Alarm minute'}
                  tone="white"
                  onChange={(value) => changeTimePart('minute', value)}
                  onBlur={() => normalizeTimePart('minute')}
                  onIncrease={() => adjustTimePart('minute', 1)}
                  onDecrease={() => adjustTimePart('minute', -1)}
                />
                <div className="flex h-[112px] flex-col justify-center rounded-2xl border border-slate-700 bg-slate-950/75 p-1.5" role="group" aria-label="AM or PM">
                  {(['AM', 'PM'] as const).map((period) => {
                    const selected = timeParts.period === period;
                    return (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setPeriod(period)}
                        aria-pressed={selected}
                        className={`flex flex-1 items-center justify-center rounded-xl text-sm font-black transition active:scale-95 ${
                          selected
                            ? 'bg-[#ff3347] text-white shadow-lg shadow-red-500/25'
                            : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {period}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] font-bold text-slate-400">
                <Clock3 className="h-3.5 w-3.5 shrink-0 text-red-400" />
                <span className="truncate">
                  {nextOccurrenceLabel(time, repeatDays, language)} · {describeRepeat(repeatDays, language)}
                </span>
              </div>
            </div>
          </section>

          {/* Repeat days are directly below the time card for one-pass setup. */}
          <section className="rounded-[24px] border border-slate-800 bg-[#17181d] p-4 shadow-lg shadow-black/10">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/10 text-amber-300">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-white">{amharic ? 'የሚደጋገሙበት ቀን' : 'Repeat schedule'}</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">{amharic ? 'የሚደውልባቸውን ቀናት ይምረጡ' : 'Choose the days this alarm rings'}</p>
                </div>
              </div>
              <span className="max-w-[44%] truncate rounded-full border border-amber-400/15 bg-amber-400/[0.08] px-2.5 py-1 text-[10px] font-bold text-amber-300">
                {describeRepeat(repeatDays, language)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-1 sm:gap-1.5" role="group" aria-label={t.repeatDaysLabel}>
              {dayLetters.map((letter, index) => {
                const selected = repeatDays.includes(index);
                return (
                  <button
                    key={`${letter}-${index}`}
                    type="button"
                    onClick={() => onToggleDay(index)}
                    aria-pressed={selected}
                    aria-label={shortDayName(index, language)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-black transition-all active:scale-90 sm:h-11 sm:w-11 ${
                      selected
                        ? 'border-amber-300 bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'border-slate-800 bg-[#101116] text-slate-500 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Sound choices stay inline; selecting a tone never opens a picker dialog. */}
          <section className="rounded-[24px] border border-slate-800 bg-[#17181d] p-4 shadow-lg shadow-black/10">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/10 text-amber-300">
                <Music2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black text-white">{t.soundAndRingtone}</h2>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{soundEmoji} {soundTitle}</p>
              </div>
              <span className="shrink-0 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black text-amber-300">
                {amharic ? 'ድምፅ' : 'TONE'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={t.soundAndRingtone}>
              {visibleSounds.map((tone) => {
                const selected = sound === tone.id;
                const playing = previewingSound === tone.id;
                return (
                  <div
                    key={tone.id}
                    className={`flex min-w-0 items-center rounded-2xl border transition ${
                      selected
                        ? 'border-amber-400/70 bg-amber-400/[0.10] shadow-sm shadow-amber-400/10'
                        : 'border-slate-800 bg-[#111217] hover:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectSound(tone.id)}
                      aria-pressed={selected}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left"
                    >
                      <span className="text-lg leading-none">{tone.emoji}</span>
                      <span className={`min-w-0 flex-1 truncate text-[11px] font-bold ${selected ? 'text-amber-100' : 'text-slate-300'}`}>
                        {tone.title}
                      </span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePreview(tone.id)}
                      aria-label={playing ? `Stop ${tone.title} preview` : `Preview ${tone.title}`}
                      className={`mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
                        playing ? 'bg-amber-400 text-slate-950' : 'text-slate-500 hover:bg-slate-800 hover:text-amber-300'
                      }`}
                    >
                      {playing ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowAllSounds((showAll) => !showAll)}
              aria-expanded={showAllSounds}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-black text-amber-300 transition hover:bg-amber-400/[0.06]"
            >
              {showAllSounds ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span>{showAllSounds ? (amharic ? 'ያነሱ ድምፆችን አሳይ' : 'Show fewer sounds') : (amharic ? 'ሁሉንም ድምፆች አሳይ' : `Browse all ${RINGTONES_CATALOG.length} sounds`)}</span>
            </button>

            <div className="mt-3 border-t border-slate-800/90 pt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-amber-300" />{amharic ? 'የድምፅ መጠን' : 'Alarm volume'}</span>
                <span className="font-mono text-amber-300">{volume}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                value={volume}
                onChange={(event) => onVolumeChange(Number(event.target.value))}
                aria-label={amharic ? 'የማንቂያ ድምፅ መጠን' : 'Alarm volume'}
                className="h-2 w-full cursor-pointer accent-amber-400"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-200">{amharic ? 'ቀስ በቀስ ድምፅ መጨመር' : 'Gentle wake-up'}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{amharic ? 'ድምፁ በቀስታ ይጨምራል' : 'Gradually raise the volume'}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={gentleWakeUp}
                  aria-label={amharic ? 'ቀስ በቀስ ድምፅ መጨመር' : 'Gentle wake-up'}
                  onClick={() => onGentleWakeUpChange(!gentleWakeUp)}
                  className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition ${gentleWakeUp ? 'bg-amber-400' : 'bg-slate-700'}`}
                >
                  <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${gentleWakeUp ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Mission choices are buttons in the list rather than a second screen. */}
          <section className="rounded-[24px] border border-slate-800 bg-[#17181d] p-4 shadow-lg shadow-black/10">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/10 text-amber-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black text-white">{t.wakeUpMission}</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">{amharic ? 'ለመንቃት ትንሽ ፈተና ይምረጡ' : 'Choose how you will dismiss the alarm'}</p>
              </div>
              <span className="max-w-[38%] truncate rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                {selectedMission.emoji} {selectedMission.title}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={t.wakeUpMission}>
              {missionOptions.map((option) => {
                const selected = option.id === challenge;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onChallengeChange(option.id)}
                    aria-pressed={selected}
                    className={`flex min-h-[54px] items-center gap-2 rounded-2xl border px-3 py-2 text-left transition active:scale-[0.98] ${
                      selected
                        ? 'border-amber-400/70 bg-amber-400/[0.10] text-amber-100'
                        : 'border-slate-800 bg-[#111217] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-lg leading-none">{option.emoji}</span>
                    <span className="min-w-0 truncate text-[11px] font-bold">{option.title}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[20px] border border-slate-800 bg-[#17181d] px-4 py-3.5">
            <label htmlFor="alarm-label-input" className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <Tag className="h-3.5 w-3.5 text-amber-300" />
              {amharic ? 'የማንቂያ ስም' : 'Alarm label'}
            </label>
            <input
              id="alarm-label-input"
              type="text"
              value={label}
              onChange={(event) => onLabelChange(event.target.value)}
              placeholder={amharic ? 'ለምሳሌ፡ የጠዋት መነሳት' : 'e.g. Morning Wake Up'}
              aria-label={t.alarmLabelInput}
              className="w-full border-b border-slate-800 bg-transparent pb-1.5 text-sm font-semibold text-white placeholder:text-slate-600 focus:border-amber-400 focus:outline-none"
            />
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/90 bg-[#101116]/95 shadow-[0_-12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mx-auto max-w-xl px-4 pt-3 sm:px-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
          <button
            type="submit"
            id="btn-save-alarm"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-base font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-[0.99]"
          >
            <Check className="h-5 w-5 stroke-[3]" />
            {t.saveAlarmBtn}
          </button>
        </div>
      </div>
    </form>
  );
};

interface TimeDigitBlockProps {
  id: string;
  value: string;
  label: string;
  ariaLabel: string;
  tone: 'red' | 'white';
  onChange: (value: string) => void;
  onBlur: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
}

const TimeDigitBlock: React.FC<TimeDigitBlockProps> = ({
  id,
  value,
  label,
  ariaLabel,
  tone,
  onChange,
  onBlur,
  onIncrease,
  onDecrease,
}) => (
  <div className={`min-w-0 rounded-[20px] border p-1.5 text-center shadow-inner ${tone === 'red' ? 'border-red-400/30 bg-[#11182b]' : 'border-slate-500/30 bg-[#11182b]'}`}>
    <button
      type="button"
      onClick={onIncrease}
      aria-label={`Increase ${ariaLabel}`}
      className="flex h-5 w-full items-center justify-center text-slate-500 transition hover:text-amber-300"
    >
      <ChevronUp className="h-4 w-4" />
    </button>
    <input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onIncrease();
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          onDecrease();
        }
      }}
      aria-label={ariaLabel}
      className={`block w-full min-w-0 bg-transparent py-0.5 text-center font-mono text-[clamp(2.25rem,12vw,3.5rem)] font-black leading-none tracking-tight outline-none ${tone === 'red' ? 'text-[#ff3347] drop-shadow-[0_0_10px_rgba(255,51,71,0.16)]' : 'text-white'}`}
    />
    <span className="block pt-1 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</span>
    <button
      type="button"
      onClick={onDecrease}
      aria-label={`Decrease ${ariaLabel}`}
      className="flex h-5 w-full items-center justify-center text-slate-500 transition hover:text-amber-300"
    >
      <ChevronDown className="h-4 w-4" />
    </button>
  </div>
);

export default AlarmEditorScreen;
