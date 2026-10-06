import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Music,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { Alarm, ChallengeType, CustomSound, RINGTONES_CATALOG, SoundType, WallpaperId, WALLPAPERS_CATALOG } from '../types';
import { Language, translations } from '../utils/translations';
import { audioEngine } from '../utils/audio';
import { describeRepeat, nextOccurrence, shortDayName } from '../utils/alarmText';
import { nativeAlarmScheduler } from '../utils/alarmScheduler';
import { getCustomSounds, deleteCustomSound, getCachedCustomSounds } from '../utils/customSounds';
import { CustomSoundModal } from './CustomSoundModal';

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
  snoozeInterval?: number;
  onSnoozeIntervalChange?: (interval: number) => void;
  snoozeLimit?: number;
  onSnoozeLimitChange?: (limit: number) => void;
  wallpaper?: WallpaperId;
  onWallpaperChange?: (wallpaper: WallpaperId) => void;
  canCancel: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export interface TimeParts {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
}

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS: ('AM' | 'PM')[] = ['AM', 'PM'];

const WALLPAPER_CHOICES = WALLPAPERS_CATALOG;

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

interface WheelColumnProps<T extends string> {
  items: T[];
  selected: T;
  onSelect: (item: T) => void;
  displayFormat?: (item: T) => string;
  ariaLabel: string;
  itemHeight?: number;
  className?: string;
}

function WheelColumn<T extends string>({
  items,
  selected,
  onSelect,
  displayFormat,
  ariaLabel,
  itemHeight = 56,
  className = '',
}: WheelColumnProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);

  const selectedIndex = useMemo(() => {
    const idx = items.indexOf(selected);
    return idx >= 0 ? idx : 0;
  }, [items, selected]);

  // Sync scroll position when selected prop changes externally
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isUserScrollingRef.current || isDraggingRef.current) return;
    const targetTop = selectedIndex * itemHeight;
    if (Math.abs(el.scrollTop - targetTop) > 1) {
      el.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  }, [selectedIndex, itemHeight]);

  // Initial scroll on mount without animation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = selectedIndex * itemHeight;
  }, []);

  const updateSelectionFromScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const currentScrollTop = el.scrollTop;
    const index = Math.min(items.length - 1, Math.max(0, Math.round(currentScrollTop / itemHeight)));
    if (items[index] && items[index] !== selected) {
      onSelect(items[index]);
    }
  };

  const handleScroll = () => {
    isUserScrollingRef.current = true;
    updateSelectionFromScroll();

    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current);
    }
    scrollDebounceRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      const el = containerRef.current;
      if (el) {
        const target = Math.round(el.scrollTop / itemHeight) * itemHeight;
        if (Math.abs(el.scrollTop - target) > 1) {
          el.scrollTo({ top: target, behavior: 'smooth' });
        }
      }
    }, 150);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const direction = e.deltaY > 0 ? 1 : -1;
    const nextIdx = Math.min(items.length - 1, Math.max(0, selectedIndex + direction));
    if (nextIdx !== selectedIndex) {
      onSelect(items[nextIdx]);
      el.scrollTo({ top: nextIdx * itemHeight, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startScrollTopRef.current = containerRef.current?.scrollTop || 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const deltaY = e.clientY - startYRef.current;
    containerRef.current.scrollTop = startScrollTopRef.current - deltaY;
  };

  const handleMouseUpOrLeave = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const el = containerRef.current;
    if (el) {
      const target = Math.round(el.scrollTop / itemHeight) * itemHeight;
      el.scrollTo({ top: target, behavior: 'smooth' });
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      role="listbox"
      aria-label={ariaLabel}
      className={`h-[168px] overflow-y-auto overflow-x-hidden snap-y snap-mandatory select-none touch-pan-y overscroll-contain cursor-grab active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ scrollSnapType: 'y mandatory' }}
    >
      {/* Top spacer so index 0 is vertically centered in 168px container */}
      <div style={{ height: itemHeight }} aria-hidden="true" className="shrink-0" />

      {items.map((item, idx) => {
        const isSelected = item === selected;
        const dist = Math.abs(idx - selectedIndex);
        return (
          <div
            key={item}
            role="option"
            aria-selected={isSelected}
            onClick={() => {
              onSelect(item);
              containerRef.current?.scrollTo({ top: idx * itemHeight, behavior: 'smooth' });
            }}
            className={`flex items-center justify-center cursor-pointer snap-center shrink-0 transition-all duration-150 ${
              isSelected
                ? 'text-white text-[38px] font-normal scale-100 opacity-100'
                : dist === 1
                ? 'text-slate-500 text-[28px] font-light scale-95 opacity-60 hover:opacity-90'
                : 'text-slate-600 text-[24px] font-light scale-90 opacity-25 hover:opacity-50'
            }`}
            style={{ height: itemHeight }}
          >
            <span className="tabular-nums tracking-tight">
              {displayFormat ? displayFormat(item) : item}
            </span>
          </div>
        );
      })}

      {/* Bottom spacer so last index can be vertically centered */}
      <div style={{ height: itemHeight }} aria-hidden="true" className="shrink-0" />
    </div>
  );
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
  snoozeInterval,
  onSnoozeIntervalChange,
  snoozeLimit,
  onSnoozeLimitChange,
  wallpaper,
  onWallpaperChange,
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
  const [overlayAllowed, setOverlayAllowed] = useState(true);
  const native = nativeAlarmScheduler.isAvailable();

  // Snooze & Wallpaper Modals
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);

  const [internalSnoozeInterval, setInternalSnoozeInterval] = useState(snoozeInterval ?? 5);
  const [internalSnoozeLimit, setInternalSnoozeLimit] = useState(snoozeLimit ?? 3);
  const [internalWallpaper, setInternalWallpaper] = useState<WallpaperId>(wallpaper ?? 'wakeup_rage');
  const [soundCategoryFilter, setSoundCategoryFilter] = useState<string>('ALL');
  const [customSounds, setCustomSounds] = useState<CustomSound[]>(() => getCachedCustomSounds());
  const [showCustomSoundModal, setShowCustomSoundModal] = useState<boolean>(false);

  useEffect(() => {
    void getCustomSounds().then((sounds) => setCustomSounds(sounds));
  }, []);

  const activeSnoozeInterval = snoozeInterval !== undefined ? snoozeInterval : internalSnoozeInterval;
  const activeSnoozeLimit = snoozeLimit !== undefined ? snoozeLimit : internalSnoozeLimit;
  const activeWallpaper = wallpaper !== undefined ? wallpaper : internalWallpaper;

  const currentWallpaperChoice =
    WALLPAPER_CHOICES.find((w) => w.id === activeWallpaper) ||
    WALLPAPER_CHOICES.find((w) => w.id === 'wakeup_rage') ||
    WALLPAPER_CHOICES[0];

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

  const handleSnoozeApply = (newInterval: number, newLimit: number) => {
    setInternalSnoozeInterval(newInterval);
    setInternalSnoozeLimit(newLimit);
    onSnoozeIntervalChange?.(newInterval);
    onSnoozeLimitChange?.(newLimit);
  };

  const handleWallpaperApply = (wp: WallpaperId) => {
    setInternalWallpaper(wp);
    onWallpaperChange?.(wp);
  };

  const snoozeDisplayLabel = useMemo(() => {
    if (activeSnoozeInterval === 0 || activeSnoozeLimit === 0) {
      return amharic ? 'ጠፍቷል' : 'Off';
    }
    if (activeSnoozeLimit >= 99) {
      return amharic
        ? `${activeSnoozeInterval} ደቂቃ፣ ያልተገደበ`
        : `${activeSnoozeInterval} min, continuous`;
    }
    return amharic
      ? `${activeSnoozeInterval} ደቂቃ, ${activeSnoozeLimit} ጊዜ`
      : `${activeSnoozeInterval} min, ${activeSnoozeLimit} times`;
  }, [activeSnoozeInterval, activeSnoozeLimit, amharic]);

  const currentTone = RINGTONES_CATALOG.find((tone) => tone.id === sound);
  const customSoundMatch = customSounds.find((cs) => cs.id === sound);
  const soundTitle = customSoundMatch ? `🎵 ${customSoundMatch.name}` : currentTone?.title ?? sound;

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

  const handleCustomSoundAdded = (newSound: CustomSound) => {
    setCustomSounds((prev) => [newSound, ...prev.filter((s) => s.id !== newSound.id)]);
    onSoundChange(newSound.id as SoundType);
    setSoundCategoryFilter('Custom Sounds');
    togglePreview(newSound.id as SoundType);
  };

  const handleDeleteCustomSound = async (e: React.MouseEvent, soundId: string) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      amharic ? 'ይህንን ብጁ ድምፅ መሰረዝ ይፈልጋሉ?' : 'Are you sure you want to delete this custom sound?'
    );
    if (!confirmed) return;
    if (previewingSound === soundId) {
      stopPreview();
    }
    await deleteCustomSound(soundId);
    setCustomSounds((prev) => prev.filter((s) => s.id !== soundId));
    if (sound === soundId) {
      onSoundChange('wakeup_wakeup');
    }
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

        {/* Scrollable / Swipeable Time Wheel Picker */}
        <div className="relative mb-8 select-none" role="group" aria-label={t.alarmTimeLabel}>
          {/* Center highlight card background */}
          <div className="pointer-events-none absolute inset-x-0 top-[56px] h-[56px] rounded-[18px] bg-[#1c1c1e] z-0 shadow-inner" />

          {/* Gradient fades at top and bottom */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#0b0b0d] via-[#0b0b0d]/70 to-transparent z-20" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0b0b0d] via-[#0b0b0d]/70 to-transparent z-20" />

          {/* Wheel Columns Container */}
          <div className="relative z-10 flex items-center justify-center gap-1 sm:gap-2 px-2">
            {/* Hour Wheel Column */}
            <div className="w-20 sm:w-24">
              <WheelColumn
                items={HOURS}
                selected={timeParts.hour}
                onSelect={(hour) => commitTimeParts({ ...timeParts, hour })}
                ariaLabel={amharic ? 'የሰዓት ቁጥር' : 'Alarm hour'}
              />
            </div>

            {/* Separator Col */}
            <div className="h-[168px] flex flex-col items-center justify-around py-2 z-10 pointer-events-none select-none">
              <span className="text-[24px] font-light text-slate-600 opacity-50">:</span>
              <span className="text-[36px] font-light text-white leading-none pb-1">:</span>
              <span className="text-[24px] font-light text-slate-600 opacity-50">:</span>
            </div>

            {/* Minute Wheel Column */}
            <div className="w-20 sm:w-24">
              <WheelColumn
                items={MINUTES}
                selected={timeParts.minute}
                onSelect={(minute) => commitTimeParts({ ...timeParts, minute })}
                ariaLabel={amharic ? 'የደቂቃ ቁጥር' : 'Alarm minute'}
              />
            </div>

            {/* Period (AM/PM) Wheel Column */}
            <div className="w-20 sm:w-24">
              <WheelColumn
                items={PERIODS}
                selected={timeParts.period}
                onSelect={(period) => commitTimeParts({ ...timeParts, period })}
                displayFormat={(p) => (p === 'AM' ? 'a.m.' : 'p.m.')}
                ariaLabel="AM or PM"
              />
            </div>
          </div>

          {/* Accessible hidden inputs & AM/PM buttons for tests and accessibility */}
          <div className="sr-only">
            <input
              id="alarm-hour-input"
              type="text"
              inputMode="numeric"
              value={timeParts.hour}
              onChange={(e) => {
                const val = e.target.value.padStart(2, '0');
                commitTimeParts({ ...timeParts, hour: val });
              }}
              aria-label={amharic ? 'የሰዓት ቁጥር' : 'Alarm hour'}
              readOnly
            />
            <input
              id="alarm-minute-input"
              type="text"
              inputMode="numeric"
              value={timeParts.minute}
              onChange={(e) => {
                const val = e.target.value.padStart(2, '0');
                commitTimeParts({ ...timeParts, minute: val });
              }}
              aria-label={amharic ? 'የደቂቃ ቁጥር' : 'Alarm minute'}
              readOnly
            />
            <div role="group" aria-label="AM or PM">
              <button
                type="button"
                aria-pressed={timeParts.period === 'AM'}
                onClick={() => commitTimeParts({ ...timeParts, period: 'AM' })}
              >
                AM
              </button>
              <button
                type="button"
                aria-pressed={timeParts.period === 'PM'}
                onClick={() => commitTimeParts({ ...timeParts, period: 'PM' })}
              >
                PM
              </button>
            </div>
          </div>

          {/* Subdued minus/plus stepper row below the wheels */}
          <div className="mt-2 flex justify-center gap-10 text-[13px] font-medium text-slate-600">
            <button
              type="button"
              onClick={() => commitTimeParts(addMinutes(timeParts, -1))}
              aria-label={`Decrease ${amharic ? 'ደቂቃ' : 'Alarm minute'}`}
              className="p-1 hover:text-slate-400 active:scale-95 transition"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => commitTimeParts(addMinutes(timeParts, 1))}
              aria-label={`Increase ${amharic ? 'ደቂቃ' : 'Alarm minute'}`}
              className="p-1 hover:text-slate-400 active:scale-95 transition"
            >
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
            <div className="mb-3 space-y-2.5">
              {/* Action Button: Add Custom Sound */}
              <button
                type="button"
                onClick={() => setShowCustomSoundModal(true)}
                className="w-full p-3 rounded-2xl bg-gradient-to-r from-rose-500/15 via-amber-500/15 to-rose-500/10 border border-rose-500/40 hover:border-rose-500 hover:bg-rose-500/20 transition flex items-center justify-between text-left group shadow-sm"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20 group-hover:scale-105 transition">
                    <Plus className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white group-hover:text-rose-300 transition">
                      {amharic ? '＋ ብጁ ድምፅ ጨምር' : '＋ Add Custom Sound'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {amharic ? 'ፋይል ስቀል፣ ድምፅ ቅረፅ፣ ወይም ፈጣን ድምጾች' : 'Upload audio, record your voice, or presets'}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/25 text-rose-300 border border-rose-500/40">
                  {amharic ? 'አዲስ' : 'NEW'}
                </span>
              </button>

              {/* Category Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
                {['ALL', 'Custom Sounds', 'Wake Up Voice', 'Extreme Loud', 'Viral & Trendy', 'Motivational', 'Scenery & Relax'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSoundCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-xl whitespace-nowrap transition ${
                      soundCategoryFilter === cat
                        ? 'bg-rose-500 text-white font-black shadow-sm'
                        : 'bg-[#252528] text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat === 'ALL'
                      ? (amharic ? 'ሁሉም' : 'All')
                      : cat === 'Custom Sounds'
                      ? `${amharic ? 'የእኔ ድምጾች' : 'Custom Sounds'}${customSounds.length > 0 ? ` (${customSounds.length})` : ''}`
                      : cat}
                  </button>
                ))}
              </div>

              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1" role="group" aria-label={t.soundAndRingtone}>
                {/* 1. Custom User Sounds */}
                {(soundCategoryFilter === 'ALL' || soundCategoryFilter === 'Custom Sounds') &&
                  customSounds.map((cs) => {
                    const selected = sound === cs.id;
                    const playing = previewingSound === cs.id;
                    return (
                      <div
                        key={cs.id}
                        className={`flex items-center gap-2 rounded-2xl p-2.5 transition border ${
                          selected
                            ? 'border-rose-500/80 bg-rose-500/10'
                            : 'border-slate-800/80 bg-[#161618] hover:bg-[#202024]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => togglePreview(cs.id as SoundType)}
                          aria-label={playing ? `Stop ${cs.name} preview` : `Preview ${cs.name}`}
                          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                            playing
                              ? 'bg-rose-500 text-white animate-pulse'
                              : 'bg-[#2a2a2e] text-slate-300 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {playing ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => selectSound(cs.id as SoundType)}
                          aria-pressed={selected}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                            <span className="text-base">🎵</span>
                            <span className="text-[13px] font-bold text-white truncate">{cs.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                              {amharic ? 'ብጁ' : 'CUSTOM'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {cs.duration ? `${cs.duration}s • ` : ''}{amharic ? 'የራስዎ ድምፅ' : 'Your Custom Audio'}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomSound(e, cs.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition rounded-lg hover:bg-slate-800"
                          title={amharic ? 'ሰርዝ' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {selected && <Check className="h-4 w-4 text-rose-400 stroke-[3] shrink-0 mr-1" />}
                      </div>
                    );
                  })}

                {/* Empty State for Custom Sounds filter */}
                {soundCategoryFilter === 'Custom Sounds' && customSounds.length === 0 && (
                  <div className="p-6 rounded-2xl bg-[#161618] border border-slate-800 text-center space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                      <Music className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {amharic ? 'ምንም ብጁ ድምፅ አልተጨመረም' : 'No custom sounds yet'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {amharic
                          ? 'የሚወዱትን ዘፈን ይሰቅሉ ወይም የራስዎን ድምፅ ይቅረጹ!'
                          : 'Upload an audio file, record your voice, or pick presets!'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCustomSoundModal(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition shadow-md"
                    >
                      {amharic ? '＋ ድምፅ ጨምር' : '＋ Add Sound Now'}
                    </button>
                  </div>
                )}

                {/* 2. Built-in Catalog Tones */}
                {soundCategoryFilter !== 'Custom Sounds' &&
                  RINGTONES_CATALOG.filter((tone) => soundCategoryFilter === 'ALL' || tone.category === soundCategoryFilter).map((tone) => {
                    const selected = sound === tone.id;
                    const playing = previewingSound === tone.id;
                    return (
                      <div
                        key={tone.id}
                        className={`flex items-center gap-2 rounded-2xl p-2.5 transition border ${
                          selected
                            ? 'border-rose-500/80 bg-rose-500/10'
                            : 'border-slate-800/80 bg-[#161618] hover:bg-[#202024]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => togglePreview(tone.id)}
                          aria-label={playing ? `Stop ${tone.title} preview` : `Preview ${tone.title}`}
                          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                            playing
                              ? 'bg-rose-500 text-white animate-pulse'
                              : 'bg-[#2a2a2e] text-slate-300 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {playing ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => selectSound(tone.id)}
                          aria-pressed={selected}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                            <span className="text-base">{tone.emoji}</span>
                            <span className="text-[13px] font-bold text-white truncate">{tone.title}</span>
                            {tone.badge && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                {tone.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">{tone.subtitle}</div>
                        </button>

                        {selected && <Check className="h-4 w-4 text-rose-400 stroke-[3] shrink-0 mr-1" />}
                      </div>
                    );
                  })}
              </div>
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
        </section>

        <p className="mb-2 px-1 text-[13px] text-slate-500">{amharic ? 'ተጨማሪ ቅንብር' : 'Custom setting'}</p>
        <section className="rounded-[22px] bg-[#1c1c1e] p-4 divide-y divide-slate-800/60">
          <Row
            label={amharic ? 'እንቅልፍ' : 'Snooze'}
            value={snoozeDisplayLabel}
            onClick={() => setShowSnoozeModal(true)}
          />
          <button
            type="button"
            onClick={() => setShowWallpaperModal(true)}
            className="flex w-full items-center justify-between py-3 text-left group"
          >
            <span className="text-[15px] text-white font-medium group-hover:text-rose-400 transition">
              {amharic ? 'የማንቂያ ዳራ' : 'Alarm wallpaper'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-slate-400 group-hover:text-white transition">
                {amharic && currentWallpaperChoice.nameAm ? currentWallpaperChoice.nameAm : currentWallpaperChoice.name}
              </span>
              <div className={`h-8 w-8 overflow-hidden rounded-xl bg-gradient-to-br ${currentWallpaperChoice.bgGradient} border border-slate-700/80 flex items-center justify-center text-lg shadow-sm`}>
                {currentWallpaperChoice.emoji}
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </div>
          </button>
        </section>
      </div>

      {/* Snooze Settings Bottom Sheet Modal */}
      {showSnoozeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-t-[32px] sm:rounded-[32px] bg-[#18191d] border border-slate-800 p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {amharic ? 'የእንቅልፍ ማስተካከያ (Snooze)' : 'Snooze Settings'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSnoozeModal(false)}
                className="rounded-full bg-slate-800 p-2 text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Snooze Interval Selection */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {amharic ? 'የደቂቃ ቆይታ (Interval)' : 'Snooze Interval'}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 5, 10, 15, 20, 30, 0].map((mins) => {
                  const isSelected = activeSnoozeInterval === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleSnoozeApply(mins, activeSnoozeLimit === 0 ? 3 : activeSnoozeLimit)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold transition ${
                        isSelected
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 border border-rose-400'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50'
                      }`}
                    >
                      {mins === 0
                        ? (amharic ? 'ጠፍቷል' : 'Off')
                        : (amharic ? `${mins} ደ` : `${mins} min`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Snooze Limit Selection */}
            {activeSnoozeInterval > 0 && (
              <div className="space-y-2.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {amharic ? 'የድግግሞሽ ብዛት (Repeat Limit)' : 'Repeat Limit'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 5, 10, 99].map((limit) => {
                    const isSelected = activeSnoozeLimit === limit;
                    return (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => handleSnoozeApply(activeSnoozeInterval, limit)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition ${
                          isSelected
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 border border-rose-400'
                            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50'
                        }`}
                      >
                        {limit === 99
                          ? (amharic ? 'ያልተገደበ' : 'Continuous')
                          : (amharic ? `${limit} ጊዜ` : `${limit} times`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confirm / Done Button */}
            <button
              type="button"
              onClick={() => setShowSnoozeModal(false)}
              className="w-full py-3.5 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-2xl shadow-lg shadow-rose-500/20 transition text-sm"
            >
              {amharic ? 'አረጋግጥ' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* Wallpaper Picker Modal */}
      {showWallpaperModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-t-[32px] sm:rounded-[32px] bg-[#18191d] border border-slate-800 p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {amharic ? 'የማንቂያ ዳራ ይምረጡ' : 'Choose Alarm Wallpaper'}
                </h3>
                <p className="text-xs text-slate-400">
                  {amharic ? 'አስቂኝ እና አነቃቂ የማንቂያ ዳራዎች' : 'Funny, iconic & wake-up themed wallpapers'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWallpaperModal(false)}
                className="rounded-full bg-slate-800 p-2 text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 overflow-y-auto pr-1">
              {WALLPAPER_CHOICES.map((wp) => {
                const isSelected = activeWallpaper === wp.id;
                return (
                  <div
                    key={wp.id}
                    onClick={() => {
                      handleWallpaperApply(wp.id);
                      if (wp.soundMatchId && sound !== wp.soundMatchId) {
                        onSoundChange(wp.soundMatchId);
                      }
                      setShowWallpaperModal(false);
                    }}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer text-left ${
                      isSelected
                        ? 'border-rose-500 bg-rose-500/15 shadow-md shadow-rose-500/10'
                        : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${wp.bgGradient} flex items-center justify-center text-2xl shadow-md shrink-0 border border-white/10`}>
                          {wp.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-bold text-sm text-white">
                              {amharic && wp.nameAm ? wp.nameAm : wp.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {wp.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 italic mt-1 line-clamp-2">
                            "{amharic && wp.quoteAm ? wp.quoteAm : wp.quote}"
                          </p>
                          {wp.soundMatchId && (
                            <span className="inline-block mt-1 text-[10px] font-bold text-rose-400">
                              🎵 {amharic ? 'የሚጣጣም ድምፅ:' : 'Matches sound:'} {RINGTONES_CATALOG.find((t) => t.id === wp.soundMatchId)?.title}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check className="h-5 w-5 text-rose-400 stroke-[3] shrink-0 mt-1" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Custom Sound Add Modal */}
      <CustomSoundModal
        isOpen={showCustomSoundModal}
        onClose={() => setShowCustomSoundModal(false)}
        onSoundAdded={handleCustomSoundAdded}
        language={language}
      />

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

const Row: React.FC<{
  label: string;
  value?: string;
  onClick?: () => void;
  switchOn?: boolean;
}> = ({ label, value, onClick, switchOn }) => (
  <button
    type="button"
    role={switchOn !== undefined ? 'switch' : undefined}
    aria-checked={switchOn !== undefined ? switchOn : undefined}
    onClick={onClick}
    className="flex w-full items-center justify-between py-3 text-left"
  >
    <span className="flex items-center gap-2 text-[15px] text-white">
      {label}
    </span>
    {switchOn !== undefined ? (
      <div className="flex items-center gap-2">
        {value && <span className="text-[14px] text-slate-500">{value}</span>}
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            switchOn ? 'bg-sky-500' : 'bg-[#3a3a3e]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              switchOn ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </span>
      </div>
    ) : (
      value && (
        <span className="flex items-center gap-1 text-[14px] text-slate-500">
          {value}
          <ChevronRight className="h-4 w-4" />
        </span>
      )
    )}
  </button>
);

export default AlarmEditorScreen;
