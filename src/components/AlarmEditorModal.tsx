import React from 'react';
import { Alarm, ChallengeType, RINGTONES_CATALOG, SoundType } from '../types';
import { Language, translations } from '../utils/translations';
import { describeRepeat, formatTime12h, nextOccurrenceLabel, shortDayName } from '../utils/alarmText';
import { ChevronRight, Music, Shield, X } from 'lucide-react';

interface AlarmEditorModalProps {
  isOpen: boolean;
  editingAlarm: Alarm | null;
  language?: Language;
  time: string;
  onTimeChange: (time: string) => void;
  label: string;
  onLabelChange: (label: string) => void;
  repeatDays: number[];
  onToggleDay: (dayIndex: number) => void;
  sound: SoundType;
  onBrowseSound: () => void;
  challenge: ChallengeType;
  onChallengeChange: (challenge: ChallengeType) => void;
  onCancel: () => void;
  onSave: () => void;
}

/**
 * The alarm editor, deliberately as short as an Android alarm screen: the time is the hero and it
 * opens the phone's own time picker when tapped, then one row of days, the name, and the two
 * choices that actually change how the alarm behaves (sound, wake-up mission). Volume, gentle
 * wake-up and the wallpaper live inside the sound picker and on the card, so a new alarm stays a
 * two-tap job.
 */
const AlarmEditorModal: React.FC<AlarmEditorModalProps> = ({
  isOpen,
  editingAlarm,
  language = 'en',
  time,
  onTimeChange,
  label,
  onLabelChange,
  repeatDays,
  onToggleDay,
  sound,
  onBrowseSound,
  challenge,
  onChallengeChange,
  onCancel,
  onSave,
  // The explicit props type matters: without it the 'en' default widens the optional language to a
  // plain string (this project compiles without strict mode) and the helpers below stop type-checking.
}: AlarmEditorModalProps) => {
  if (!isOpen) return null;

  const t = translations[language];
  const display = formatTime12h(time);
  const amharic = language === 'am';
  // Single-letter chips, like the phone dialogs: the first letter of each day. The full day name
  // stays on the button's aria-label.
  const dayLetters = amharic
    ? [0, 1, 2, 3, 4, 5, 6].map((index) => shortDayName(index, 'am').slice(0, 1))
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const currentSound = RINGTONES_CATALOG.find((ringtone) => ringtone.id === sound);
  const soundTitle = currentSound ? currentSound.title : sound;
  const soundEmoji = currentSound ? currentSound.emoji : '🎵';

  const missionOptions: { id: ChallengeType; emoji: string; label: string }[] = [
    { id: 'none', emoji: '🔔', label: amharic ? 'የማጥፊያ ቁልፍ ብቻ' : 'Dismiss button only' },
    { id: 'math', emoji: '➗', label: amharic ? 'የሂሳብ ጥያቄዎች' : 'Math equations' },
    { id: 'shake', emoji: '📳', label: amharic ? 'ስልኩን አናውጡ' : 'Shake the phone' },
    { id: 'tiles', emoji: '🧩', label: amharic ? 'የቀለም ቅደም ተከተል' : 'Memory tile pattern' },
    { id: 'typing', emoji: '⌨️', label: amharic ? 'የማረጋገጫ ጽሑፍ ይጻፉ' : 'Type an affirmation' },
  ];
  const mission = missionOptions.find((option) => option.id === challenge) ?? missionOptions[1];

  const cycleMission = () => {
    const current = missionOptions.findIndex((option) => option.id === challenge);
    const next = missionOptions[(current + 1) % missionOptions.length];
    onChallengeChange(next.id);
  };

  return (
    <div
      id="alarm-editor-backdrop"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-md sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        id="alarm-editor-sheet"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-t-[28px] border border-slate-800 bg-[#1b1c21] shadow-2xl sm:rounded-3xl"
      >
        {/* Header: close, title, save - like the phone's own alarm dialog */}
        <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            aria-label={t.cancelBtn}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <h3 className="text-base font-black tracking-tight text-white">
            {editingAlarm ? t.editAlarmTitle : t.addAlarmTitle}
          </h3>
          <button
            type="button"
            onClick={onSave}
            className="rounded-full px-4 py-2 text-sm font-black text-amber-400 transition hover:bg-amber-500/10 active:scale-95"
          >
            {t.saveAlarmBtn}
          </button>
        </div>

        {/* Time hero: tapping anywhere on it opens the phone's time picker */}
        <label className="relative block w-full cursor-pointer">
          <input
            type="time"
            value={time}
            onChange={(event) => onTimeChange(event.target.value)}
            aria-label={t.alarmTimeLabel}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div className="flex flex-col items-center pb-1 pt-5 transition active:scale-[0.98]">
            <div className="flex items-baseline">
              <span className="text-7xl font-black tracking-tighter text-white">{display.time}</span>
              <span className="ml-2 text-2xl font-black uppercase text-slate-400">{display.period}</span>
            </div>
            <span className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
              {nextOccurrenceLabel(time, repeatDays, language)} · {describeRepeat(repeatDays, language)}
            </span>
          </div>
        </label>

        {/* Day row */}
        <div className="px-5 pb-4 pt-3">
          <div className="flex items-center justify-between gap-1">
            {dayLetters.map((letter, index) => {
              const selected = repeatDays.includes(index);
              return (
                <button
                  key={`${letter}-${index}`}
                  type="button"
                  onClick={() => onToggleDay(index)}
                  aria-pressed={selected}
                  aria-label={shortDayName(index, language)}
                  className={`h-10 min-w-10 rounded-full px-2 text-xs font-black transition-all ${
                    selected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'border border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Name */}
        <div className="px-5">
          <input
            type="text"
            value={label}
            onChange={(event) => onLabelChange(event.target.value)}
            placeholder={amharic ? 'የማንቂያ ስም' : 'Alarm name'}
            aria-label={t.alarmLabelInput}
            className="w-full border-b border-slate-800 bg-transparent py-3.5 text-base font-semibold text-white placeholder-slate-500 transition focus:border-amber-500 focus:outline-none"
          />
        </div>

        {/* Sound */}
        <div className="px-5 pt-2">
          <button
            type="button"
            onClick={onBrowseSound}
            className="flex w-full items-center justify-between border-b border-slate-800 py-4 text-left"
          >
            <span className="flex items-center space-x-3">
              <Music className="h-5 w-5 text-slate-400" />
              <span className="text-base font-semibold text-white">{t.soundAndRingtone}</span>
            </span>
            <span className="flex min-w-0 items-center space-x-1.5">
              <span className="max-w-[150px] truncate text-sm font-semibold text-amber-400">
                {soundEmoji} {soundTitle}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
            </span>
          </button>

          {/* Wake-up mission */}
          <button
            type="button"
            onClick={cycleMission}
            className="flex w-full items-center justify-between py-4 text-left"
          >
            <span className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-slate-400" />
              <span className="text-base font-semibold text-white">{t.wakeUpMission}</span>
            </span>
            <span className="flex min-w-0 items-center space-x-1.5">
              <span className="max-w-[150px] truncate text-sm font-semibold text-amber-400">
                {mission.emoji} {mission.label}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
            </span>
          </button>
        </div>

        <div className="px-4 pb-5 pt-2">
          <button
            type="button"
            onClick={onSave}
            className="w-full rounded-2xl bg-amber-500 py-4 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-[0.98]"
          >
            {t.saveAlarmBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlarmEditorModal;
