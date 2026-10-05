import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Lock,
  Pencil,
  Play,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { Alarm, ChallengeType, RINGTONES_CATALOG, SoundType } from '../types';
import { Language, translations } from '../utils/translations';
import { audioEngine } from '../utils/audio';
import { describeRepeat, nextOccurrence, shortDayName } from '../utils/alarmText';
import { nativeAlarmScheduler } from '../utils/alarmScheduler';

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

function addMinutes(parts: TimeParts, delta: number): TimeParts {
  let next = { ...parts };
  const dir = delta >= 0 ? 1 : -1;
  let remaining = Math.abs(delta);
  while (remaining > 0) {
    const minute = Number.parseInt(next.minute, 10) || 0;
    if (dir > 0) {
      if (minute >= 59) next = { ...stepHour(next, 1), minute: '00' };
      else next = { ...next, minute: String(minute + 1).padStart(2, '0') };
    } else {
      if (minute <= 0) next = { ...stepHour(next, -1), minute: '59' };
      else next = { ...next, minute: String(minute - 1).padStart(2, '0') };
    }
    remaining -= 1;
  }
  return next;
}

function formatWheelRow(parts: TimeParts) {
  const period = parts.period === 'AM' ? 'a.m.' : 'p.m.';
  return { hour: parts.hour, minute: parts.minute, period };
}

function ringSoonLabel(time: string, days: number[], language: Language): string {
  const when = nextOccurrence(time, days, new Date());
  const minutes = Math.max(0, Math.round((when.getTime() - Date.now()) / 60000));
  if (language === 'am') {
    if (minutes < 1) return 'ከአንድ ደቂቃ በታች ይደውላል';
    if (minutes < 60) return `በ${minutes} ደቂቃ ውስጥ ይደውላል`;
    const hours = Math.round(minutes / 60);
    return `በ${hours} ሰዓት ውስጥ ይደውላል`;
  }
  if (minutes < 1) return 'Ring in less than a minute';
  if (minutes < 60) return `Ring in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  return `Ring in ${hours} hour${hours === 1 ? '' : 's'}`;
}

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
  const [editingLabel, setEditingLabel] = useState(false);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [previewingSound, setPreviewingSound] = useState<SoundType | null>(null);
  const [vibrate, setVibrate] = useState(true);
  const [timeReminder, setTimeReminder] = useState(false);
  const [weatherReminder, setWeatherReminder] = useState(false);
  const [overlayAllowed, setOverlayAllowed] = useState(true);
  const native = nativeAlarmScheduler.isAvailable();

  useEffect(() => () => audioEngine.stopAlarmSound(), []);

  useEffect(() => {
    setTimeParts(getTimeParts(time));
  }, [time]);

  useEffect(() => {
    if (!native) return;
    void nativeAlarmScheduler.getState().then((state) => setOverlayAllowed(Boolean(state.overlayAllowed)));
  }, [native]);

  const commitTimeParts = (parts: TimeParts) => {
    setTimeParts(parts);
    onTimeChange(to24HourTime(parts));
  };

  const prevParts = addMinutes(timeParts, -61);
  const nextParts = addMinutes(timeParts, 61);
  const prevRow = formatWheelRow(prevParts);
  const currentRow = formatWheelRow(timeParts);
  const nextRow = formatWheelRow(nextParts);

  const currentTone = RINGTONES_CATALOG.find((tone) => tone.id === sound);
  const soundTitle = currentTone?.title ?? sound;

  const dayLetters = amharic
    ? [0, 1, 2, 3, 4, 5, 6].map((index) => shortDayName(index, 'am').slice(0, 1))
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const isDaily = repeatDays.length === 7;
  const missionCount = challenge === 'none' ? 0 : 1;

  const missionOptions: { id: ChallengeType; emoji: string; title: string }[] = [
    { id: 'none', emoji: '🔔', title: amharic ? 'ማጥፊያ ብቻ' : 'Dismiss only' },
    { id: 'math', emoji: '➗', title: amharic ? 'ሂሳብ' : 'Math' },
    { id: 'shake', emoji: '📳', title: amharic ? 'አናውጥ' : 'Shake' },
    { id: 'memory', emoji: '🧠', title: amharic ? 'ትውስታ' : 'Memory' },
    { id: 'tiles', emoji: '🧩', title: amharic ? 'ቅደም ተከተል' : 'Pattern' },
    { id: 'typing', emoji: '⌨️', title: amharic ? 'ማረጋገጫ ጽሑፍ' : 'Affirmation' },
  ];

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
    setShowSoundPicker(false);
  };

  const toggleDaily = () => {
    if (isDaily) {
      [0, 1, 2, 3, 4, 5, 6].forEach((day) => {
        if (repeatDays.includes(day)) onToggleDay(day);
      });
      return;
    }
    [0, 1, 2, 3, 4, 5, 6].forEach((day) => {
      if (!repeatDays.includes(day)) onToggleDay(day);
    });
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  const ringLabel = useMemo(() => ringSoonLabel(time, repeatDays, language), [time, repeatDays, language]);

  return (
    <form onSubmit={handleSave} className="min-h-dvh bg-[#0b0b0d] text-white">
      <div className="relative mx-auto max-w-xl px-4 pb-32 pt-2">
        <header className="mb-6 flex h-12 items-center justify-between">
          <div className="w-10">
            {canCancel && (
              <button
                type="button"
                onClick={onCancel}
                aria-label={t.cancelBtn}
                className="flex h-10 w-10 items-center justify-center text-white"
              >
                <X className="h-6 w-6" />
              </button>
            )}
          </div>
          <h1 className="text-[17px] font-semibold tracking-tight text-white">
            {editingAlarm ? t.editAlarmTitle : t.addAlarmTitle}
          </h1>
          <div className="w-10" />
        </header>

        {native && !overlayAllowed && (
          <button
            type="button"
            onClick={() => void nativeAlarmScheduler.openSettings('overlay')}
            className="mb-5 w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-left"
          >
            <p className="text-sm font-semibold text-rose-200">
              {amharic ? 'ከሌሎች መተግበሪያዎች በላይ ታይ' : 'Appear on top of other apps'}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
              {amharic
                ? 'ማንቂያው ፊት ለፊት እንዲታይ ይህን ፈቃድ ይስጡ። Settings → Appear on top → Niqu።'
                : 'Turn this on so the alarm comes in front of other apps. Settings → Appear on top → Niqu.'}
            </p>
          </button>
        )}

        <div className="mb-8 flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">☀️</span>
          {editingLabel ? (
            <input
              id="alarm-label-input"
              type="text"
              value={label}
              autoFocus
              onChange={(event) => onLabelChange(event.target.value)}
              onBlur={() => setEditingLabel(false)}
              placeholder={amharic ? 'የማንቂያ ስም ይጻፉ' : 'Please fill in the alarm name'}
              aria-label={t.alarmLabelInput}
              className="min-w-0 flex-1 bg-transparent text-[16px] text-white placeholder:text-slate-500 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingLabel(true)}
              className="min-w-0 flex-1 text-left text-[16px] text-slate-500"
            >
              {label.trim() || (amharic ? 'የማንቂያ ስም ይጻፉ' : 'Please fill in the alarm name')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditingLabel(true)}
            aria-label={amharic ? 'ስም አስተካክል' : 'Edit name'}
            className="text-slate-500"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        {!editingLabel && <input id="alarm-label-input" type="hidden" value={label} readOnly aria-label={t.alarmLabelInput} />}

        <p className="mb-6 text-center text-[15px] text-slate-300">{ringLabel}</p>

        <div className="mb-8 select-none" role="group" aria-label={t.alarmTimeLabel}>
          <WheelRow parts={prevRow} muted onClick={() => commitTimeParts(prevParts)} />
          <div className="my-1 rounded-[18px] bg-[#1c1c1e] px-6 py-4">
            <WheelRow parts={currentRow} />
          </div>
          <WheelRow parts={nextRow} muted onClick={() => commitTimeParts(nextParts)} />
          <div className="mt-3 flex justify-center gap-8 text-[11px] font-medium uppercase tracking-widest text-slate-600">
            <button type="button" onClick={() => commitTimeParts(addMinutes(timeParts, -1))} aria-label={`Decrease ${amharic ? 'ደቂቃ' : 'Alarm minute'}`}>
              −
            </button>
            <input
              id="alarm-hour-input"
              type="text"
              inputMode="numeric"
              className="sr-only"
              value={timeParts.hour}
              onChange={() => {}}
              aria-label={amharic ? 'የሰዓት ቁጥር' : 'Alarm hour'}
              readOnly
            />
            <input
              id="alarm-minute-input"
              type="text"
              inputMode="numeric"
              className="sr-only"
              value={timeParts.minute}
              onChange={() => {}}
              aria-label={amharic ? 'የደቂቃ ቁጥር' : 'Alarm minute'}
              readOnly
            />
            <div className="flex gap-3" role="group" aria-label="AM or PM">
              <button type="button" aria-pressed={timeParts.period === 'AM'} onClick={() => commitTimeParts({ ...timeParts, period: 'AM' })} className="hidden">
                AM
              </button>
              <button type="button" aria-pressed={timeParts.period === 'PM'} onClick={() => commitTimeParts({ ...timeParts, period: 'PM' })} className="hidden">
                PM
              </button>
            </div>
            <button type="button" onClick={() => commitTimeParts(addMinutes(timeParts, 1))} aria-label={`Increase ${amharic ? 'ደቂቃ' : 'Alarm minute'}`}>
              +
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] text-slate-200">{amharic ? 'በየቀኑ' : 'Daily'}</span>
          <label className="flex items-center gap-2 text-[15px] text-slate-200">
            <span>{amharic ? 'በየቀኑ' : 'Daily'}</span>
            <input
              type="checkbox"
              checked={isDaily}
              onChange={toggleDaily}
              className="h-4 w-4 accent-sky-400"
            />
          </label>
        </div>

        <section className="mb-8" aria-label={t.repeatDaysLabel}>
        <div className="flex items-center justify-between gap-1.5" role="group" aria-label={t.repeatDaysLabel}>
          {dayLetters.map((letter, index) => {
            const selected = repeatDays.includes(index);
            return (
              <button
                key={`${letter}-${index}`}
                type="button"
                onClick={() => onToggleDay(index)}
                aria-pressed={selected}
                aria-label={shortDayName(index, language)}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-[15px] font-semibold transition ${
                  selected
                    ? 'border-sky-500/80 bg-[#12303a] text-sky-200'
                    : 'border-[#2a2a2e] bg-[#141416] text-slate-500'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
        <p className="sr-only">{describeRepeat(repeatDays, language)}</p>
        </section>

        <section className="mb-4 rounded-[22px] bg-[#1c1c1e] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-medium text-white">{t.wakeUpMission}</h2>
            <span className="text-[13px] text-slate-500">{missionCount}/5</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t.wakeUpMission}>
            {missionOptions.map((option) => {
              const selected = option.id === challenge;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onChallengeChange(option.id)}
                  aria-pressed={selected}
                  className={`flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center rounded-2xl border text-[11px] font-medium ${
                    selected
                      ? 'border-sky-500/70 bg-[#12303a] text-sky-100'
                      : 'border-[#2f2f33] bg-[#161618] text-slate-500'
                  }`}
                >
                  {option.id === 'none' ? <span className="text-2xl leading-none">+</span> : <span className="text-lg">{option.emoji}</span>}
                  <span className="mt-1 truncate px-1">{option.title}</span>
                </button>
              );
            })}
          </div>

          <Row label={amharic ? 'የንቃት ማረጋገጫ' : 'Wake up check'} locked hot value={amharic ? 'ጠፍቷል' : 'Off'} />
          <Row label={amharic ? 'ኃይል እንዳይጠፋ' : 'Prevent power-off'} value={amharic ? 'ጠፍቷል' : 'Off'} />
        </section>

        <p className="mb-2 px-1 text-[13px] text-slate-500">{amharic ? 'የማንቂያ ድምፅ' : 'Alarm sound'}</p>
        <section className="mb-4 rounded-[22px] bg-[#1c1c1e] p-4">
          <button
            type="button"
            onClick={() => setShowSoundPicker((open) => !open)}
            className="mb-3 flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2a2a2e] text-white">
              {previewingSound ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            </span>
            <span className="flex-1 text-[16px] font-medium">{soundTitle}</span>
            <ChevronRight className="h-5 w-5 text-slate-500" />
          </button>

          {showSoundPicker && (
            <div className="mb-3 max-h-52 space-y-1 overflow-y-auto" role="group" aria-label={t.soundAndRingtone}>
              {RINGTONES_CATALOG.map((tone) => {
                const selected = sound === tone.id;
                const playing = previewingSound === tone.id;
                return (
                  <div key={tone.id} className="flex items-center gap-2 rounded-xl px-1 py-1.5">
                    <button type="button" onClick={() => selectSound(tone.id)} aria-pressed={selected} className="min-w-0 flex-1 truncate text-left text-[13px]">
                      {tone.emoji} {tone.title}
                      {selected && <Check className="ml-2 inline h-3 w-3 text-sky-400" />}
                    </button>
                    <button type="button" onClick={() => togglePreview(tone.id)} aria-label={playing ? `Stop ${tone.title} preview` : `Preview ${tone.title}`} className="text-slate-500">
                      {playing ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {!showSoundPicker && <p className="sr-only">{t.soundAndRingtone}</p>}

          <div className="mb-4 flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-slate-400" />
            <input
              type="range"
              min="20"
              max="100"
              value={volume}
              onChange={(event) => onVolumeChange(Number(event.target.value))}
              aria-label={amharic ? 'የማንቂያ ድምፅ መጠን' : 'Alarm volume'}
              className="h-1.5 flex-1 cursor-pointer accent-white"
            />
            <span className="text-slate-400">📳</span>
            <input
              type="checkbox"
              checked={vibrate}
              onChange={() => setVibrate((value) => !value)}
              aria-label={amharic ? 'ንዝረት' : 'Vibrate'}
              className="h-4 w-4 accent-sky-400"
            />
          </div>

          <Row
            label={amharic ? 'ቀስ በቀስ መንቃት' : 'Gentle wake-up'}
            value={gentleWakeUp ? (amharic ? '30 ሰከንድ' : '30 seconds') : (amharic ? 'ጠፍቷል' : 'Off')}
            onClick={() => onGentleWakeUpChange(!gentleWakeUp)}
            switchOn={gentleWakeUp}
          />
          <ToggleRow label={amharic ? 'የሰዓት ማስታወሻ' : 'Time reminder'} sample checked={timeReminder} onChange={setTimeReminder} />
          <ToggleRow label={amharic ? 'የአየር ሁኔታ ማስታወሻ' : 'Weather reminder'} sample checked={weatherReminder} onChange={setWeatherReminder} />
          <Row label={amharic ? 'የስም ማስታወሻ' : 'Label reminder'} locked />
          <Row label={amharic ? 'ተጨማሪ ጮክ ድምፅ' : 'Extra loud effect'} locked />
        </section>

        <p className="mb-2 px-1 text-[13px] text-slate-500">{amharic ? 'ተጨማሪ ቅንብር' : 'Custom setting'}</p>
        <section className="rounded-[22px] bg-[#1c1c1e] p-4">
          <Row label={amharic ? 'እንቅልፍ' : 'Snooze'} value={amharic ? '5 ደቂቃ, 3 ጊዜ' : '5 min, 3 times'} />
          <div className="flex items-center justify-between py-3">
            <span className="text-[15px] text-white">{amharic ? 'የማንቂያ ዳራ' : 'Alarm wallpaper'}</span>
            <div className="h-12 w-12 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-900 via-fuchsia-700 to-amber-300">
              <div className="flex h-full items-end justify-center text-2xl">🐱</div>
            </div>
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-[#0b0b0d] via-[#0b0b0d] to-transparent">
        <div className="mx-auto max-w-xl px-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
          <button
            type="submit"
            id="btn-save-alarm"
            className="flex w-full items-center justify-center rounded-2xl bg-[#ff4d6d] py-[14px] text-[17px] font-semibold text-white shadow-lg shadow-rose-500/20"
          >
            {t.saveAlarmBtn}
          </button>
        </div>
      </div>
    </form>
  );
};

const WheelRow: React.FC<{
  parts: { hour: string; minute: string; period: string };
  muted?: boolean;
  onClick?: () => void;
}> = ({ parts, muted, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`grid w-full grid-cols-[1fr_auto_1fr_auto] items-baseline justify-items-center px-8 py-2 font-light tracking-tight ${
      muted ? 'text-slate-500' : 'text-white'
    }`}
  >
    <span className={`tabular-nums ${muted ? 'text-[28px]' : 'text-[40px] leading-none'}`}>{parts.hour}</span>
    <span className={`px-2 ${muted ? 'text-[28px]' : 'text-[40px] leading-none'}`}>:</span>
    <span className={`tabular-nums ${muted ? 'text-[28px]' : 'text-[40px] leading-none'}`}>{parts.minute}</span>
    <span className={`w-12 text-left text-[15px] ${muted ? 'text-slate-500' : 'text-slate-300'}`}>{parts.period}</span>
  </button>
);

const Row: React.FC<{
  label: string;
  value?: string;
  locked?: boolean;
  hot?: boolean;
  onClick?: () => void;
  switchOn?: boolean;
}> = ({ label, value, locked, hot, onClick }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center justify-between py-3 text-left">
    <span className="flex items-center gap-2 text-[15px] text-white">
      {label}
      {locked && <Lock className="h-3.5 w-3.5 text-slate-500" />}
      {hot && <span className="rounded-md bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">HOT</span>}
    </span>
    {value && (
      <span className="flex items-center gap-1 text-[14px] text-slate-500">
        {value}
        <ChevronRight className="h-4 w-4" />
      </span>
    )}
  </button>
);

const ToggleRow: React.FC<{
  label: string;
  sample?: boolean;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ label, sample, checked, onChange }) => (
  <div className="flex items-center justify-between py-3">
    <span className="flex items-center gap-2 text-[15px] text-white">
      {label}
      {sample && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#2a2a2e] px-2 py-0.5 text-[11px] text-slate-300">
          <Play className="h-2.5 w-2.5 fill-current" /> Sample
        </span>
      )}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full p-1 transition ${checked ? 'bg-sky-500' : 'bg-[#3a3a3e]'}`}
    >
      <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

export default AlarmEditorScreen;
