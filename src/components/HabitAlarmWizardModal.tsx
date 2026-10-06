import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SoundType, ChallengeType, WallpaperId, RINGTONES_CATALOG, CustomSound } from '../types';
import { X, Flame, Plus, Check, Music, Bell, Shield, ArrowRight } from 'lucide-react';
import { WALLPAPERS } from './AlarmClock';
import { Language } from '../utils/translations';
import { getCustomSounds, getCachedCustomSounds } from '../utils/customSounds';

interface HabitAlarmWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveHabitAlarm: (
    title: string,
    timeStr: string,
    repeatDays: number[],
    sound: SoundType,
    challenge: ChallengeType
  ) => void;
  language?: Language;
}

const PRESET_HABITS_EN = [
  { emoji: '🐣', label: 'Wake up early' },
  { emoji: '💊', label: 'Take medication' },
  { emoji: '🏋️', label: '5-min stretch' },
  { emoji: '💧', label: 'Drink water' },
  { emoji: '🤲', label: 'Say prayers' },
  { emoji: '🧘', label: '1-min meditation' },
];

const PRESET_HABITS_AM = [
  { emoji: '🐣', label: 'ማለዳ መነሳት' },
  { emoji: '💊', label: 'መድኃኒት መውሰድ' },
  { emoji: '🏋️', label: 'የ5 ደቂቃ ማፍታታት' },
  { emoji: '💧', label: 'ውሃ መጠጣት' },
  { emoji: '🤲', label: 'ፀሎት ማድረግ' },
  { emoji: '🧘', label: 'የ1 ደቂቃ ማሰላሰል' },
];

export const HabitAlarmWizardModal: React.FC<HabitAlarmWizardModalProps> = ({
  isOpen,
  onClose,
  onSaveHabitAlarm,
  language = 'en',
}) => {
  const isAm = language === 'am';
  const presetHabits = isAm ? PRESET_HABITS_AM : PRESET_HABITS_EN;
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedHabit, setSelectedHabit] = useState<string>(isAm ? 'ማለዳ መነሳት' : 'Wake up early');
  const [customHabit, setCustomHabit] = useState<string>('');
  const [isCustomInput, setIsCustomInput] = useState<boolean>(false);

  // Alarm settings for Step 2
  const [alarmTime, setAlarmTime] = useState<string>('07:00');
  const [repeatDays, setRepeatDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]); // Daily
  const [isDaily, setIsDaily] = useState<boolean>(true);
  const [sound, setSound] = useState<SoundType>('wakeup_wakeup');
  const [challenge, setChallenge] = useState<ChallengeType>('math');
  const [preventPowerOff, setPreventPowerOff] = useState<boolean>(false);
  const [customSounds, setCustomSounds] = useState<CustomSound[]>(() => getCachedCustomSounds());

  useEffect(() => {
    void getCustomSounds().then((sounds) => setCustomSounds(sounds));
  }, []);

  if (!isOpen) return null;

  const handleSelectPreset = (label: string) => {
    setSelectedHabit(label);
    setIsCustomInput(false);
    setStep(2);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customHabit.trim()) {
      setSelectedHabit(customHabit.trim());
      setStep(2);
    }
  };

  const toggleDay = (dIdx: number) => {
    if (repeatDays.includes(dIdx)) {
      const next = repeatDays.filter((d) => d !== dIdx);
      setRepeatDays(next);
      setIsDaily(next.length === 7);
    } else {
      const next = [...repeatDays, dIdx].sort();
      setRepeatDays(next);
      setIsDaily(next.length === 7);
    }
  };

  const toggleDaily = (checked: boolean) => {
    setIsDaily(checked);
    if (checked) {
      setRepeatDays([0, 1, 2, 3, 4, 5, 6]);
    } else {
      setRepeatDays([]);
    }
  };

  const handleSave = () => {
    onSaveHabitAlarm(selectedHabit, alarmTime, repeatDays, sound, challenge);
    if ('vibrate' in navigator) {
      try { navigator.vibrate([60, 30, 60]); } catch (e) {}
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        id="habit-alarm-wizard-backdrop"
        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="max-w-md w-full bg-[#141518] border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-white space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {step === 1 && (
              <div className="flex items-center space-x-3">
                {/* Progress bar */}
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="w-1/3 h-full bg-amber-400 rounded-full" />
                </div>
                <span className="text-xs font-bold text-slate-400">1/3</span>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-bold text-slate-400 hover:text-white"
                >
                  {isAm ? 'ዝለል' : 'Skip'}
                </button>
              </div>
            )}

            {step === 2 && (
              <h3 className="text-base font-bold text-slate-200">{isAm ? 'የልማድ ማንቂያ' : 'Habit alarm'}</h3>
            )}
          </div>

          {/* STEP 1: Choose Habit */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {isAm ? 'ምን ዓይነት ልማድ መገንባት ይፈልጋሉ?' : 'What habit do you want to build?'}
                </h2>
              </div>

              <div className="space-y-2.5">
                {presetHabits.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSelectPreset(item.label)}
                    className="w-full bg-[#1f2026] hover:bg-[#282a33] border border-slate-800 rounded-2xl p-4 flex items-center space-x-4 transition active:scale-98 text-left group"
                  >
                    <span className="text-2xl">{item.emoji}</span>
                    <span className="text-sm font-bold text-slate-200 group-hover:text-white">
                      {item.label}
                    </span>
                  </button>
                ))}

                {/* Enter my own option */}
                {!isCustomInput ? (
                  <button
                    type="button"
                    onClick={() => setIsCustomInput(true)}
                    className="w-full bg-[#1f2026] hover:bg-[#282a33] border border-slate-800 rounded-2xl p-4 flex items-center space-x-4 transition text-white font-bold text-sm"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-white" />
                    </div>
                    <span>{isAm ? 'የራስዎን ያስገቡ' : 'Enter my own'}</span>
                  </button>
                ) : (
                  <form onSubmit={handleCustomSubmit} className="flex space-x-2 pt-1">
                    <input
                      type="text"
                      autoFocus
                      placeholder={isAm ? 'ለምሳሌ፡ በየቀኑ 10 ገጽ ማንበብ' : 'e.g. Read 10 pages daily'}
                      value={customHabit}
                      onChange={(e) => setCustomHabit(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-3 rounded-xl transition"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Configure Habit Alarm */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Habit Goal Row */}
              <div className="flex items-center space-x-3 bg-[#1e2027] p-3.5 rounded-2xl border border-slate-800">
                <span className="text-2xl">🔥</span>
                <input
                  type="text"
                  value={selectedHabit}
                  onChange={(e) => setSelectedHabit(e.target.value)}
                  className="bg-transparent text-sm font-bold text-white focus:outline-none flex-1 placeholder-slate-500"
                  placeholder={isAm ? 'የልማድ ዓላማዎን ያስገቡ' : 'Enter your habit goal'}
                />
              </div>

              {/* Time Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {isAm ? 'የማንቂያ ሰዓት' : 'Alarm time'}
                </label>
                <div className="bg-[#191b20] border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <input
                    type="time"
                    value={alarmTime}
                    onChange={(e) => setAlarmTime(e.target.value)}
                    className="bg-transparent text-3xl font-bold font-mono text-white focus:outline-none cursor-pointer"
                  />
                  <button
                    type="button"
                    className="text-xs font-bold text-white hover:text-slate-200 flex items-center space-x-1 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span>{isAm ? 'ሰዓት ጨምር' : 'Add time'}</span>
                  </button>
                </div>
              </div>

              {/* Repeat Days Row */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>{isAm ? 'በየቀኑ' : 'Daily'}</span>
                  <label className="flex items-center space-x-2 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={isDaily}
                      onChange={(e) => toggleDaily(e.target.checked)}
                      className="w-4 h-4 rounded accent-cyan-500"
                    />
                    <span>{isAm ? 'በየቀኑ' : 'Daily'}</span>
                  </label>
                </div>

                <div className="flex justify-between space-x-1">
                  {(isAm ? ['እ', 'ሰ', 'ማ', 'ረ', 'ሐ', 'ዓ', 'ቅ'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((day, idx) => {
                    const selected = repeatDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`w-10 h-10 rounded-2xl text-xs font-bold transition ${
                          selected
                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Wake-up Mission Selection */}
              <div className="bg-[#191b20] border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">{isAm ? 'የመነቂያ ፈተና' : 'Wake-up mission'}</span>
                  <span className="text-slate-500 font-mono">1/5</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'math', label: isAm ? 'ሂሳብ' : 'Math', icon: '+ -' },
                    { id: 'shake', label: isAm ? 'አናውጥ' : 'Shake', icon: '📱' },
                    { id: 'memory', label: isAm ? 'ትውስታ' : 'Memory', icon: '🧠' },
                  ].map((m) => {
                    const active = challenge === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setChallenge(m.id as ChallengeType)}
                        className={`py-3 px-2 rounded-xl text-xs font-bold border transition flex flex-col items-center space-y-1 ${
                          active
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-base">{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sound & Power-off Row */}
              <div className="bg-[#191b20] border border-slate-800 rounded-2xl p-3.5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">{isAm ? 'የማንቂያ ድምፅ' : 'Alarm sound'}</span>
                  <select
                    value={sound}
                    onChange={(e) => setSound(e.target.value as SoundType)}
                    className="bg-slate-900 text-slate-200 border border-slate-700 rounded-xl px-3 py-1 text-xs font-bold max-w-[190px] truncate"
                  >
                    {customSounds.length > 0 && (
                      <optgroup label={isAm ? 'ብጁ ድምጾች' : 'Custom Sounds'}>
                        {customSounds.map((cs) => (
                          <option key={cs.id} value={cs.id}>
                            🎵 {cs.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label={isAm ? 'የደወል ድምጾች' : 'Ringtones'}>
                      {RINGTONES_CATALOG.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.emoji} {r.title}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 font-medium">{isAm ? 'ስልክ ማጥፋትን መከልከል' : 'Prevent power-off'}</span>
                  <button
                    type="button"
                    onClick={() => setPreventPowerOff(!preventPowerOff)}
                    className={`px-3 py-1 rounded-xl font-bold transition ${
                      preventPowerOff
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-slate-500 bg-slate-900'
                    }`}
                  >
                    {preventPowerOff ? (isAm ? 'በርቷል >' : 'On >') : (isAm ? 'ጠፍቷል >' : 'Off >')}
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSave}
                className="w-full bg-[#ff3b5c] hover:bg-[#e02f4d] text-white font-black text-base py-3.5 rounded-2xl shadow-lg shadow-red-500/20 transition flex items-center justify-center space-x-2"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>{isAm ? 'ልማድ ማንቂያውን አስቀምጥ' : 'Save Habit Alarm'}</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
