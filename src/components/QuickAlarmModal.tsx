import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SoundType, RINGTONES_CATALOG } from '../types';
import { X, Clock, Zap, Volume2, RotateCcw, Check, Music } from 'lucide-react';
import { audioEngine } from '../utils/audio';
import { Language } from '../utils/translations';

interface QuickAlarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveQuickAlarm: (minutes: number, sound: SoundType, volume: number) => void;
  language?: Language;
}

export const QuickAlarmModal: React.FC<QuickAlarmModalProps> = ({
  isOpen,
  onClose,
  onSaveQuickAlarm,
  language = 'en',
}) => {
  const [minutes, setMinutes] = useState<number>(10);
  const [sound, setSound] = useState<SoundType>('radar');
  const [volume, setVolume] = useState<number>(80);
  const [vibrate, setVibrate] = useState<boolean>(true);
  const isAm = language === 'am';

  // Calculate projected ring time
  const [ringTimeStr, setRingTimeStr] = useState<string>('');

  useEffect(() => {
    const targetDate = new Date(Date.now() + minutes * 60 * 1000);
    let hours = targetDate.getHours();
    const mins = targetDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hoursStr = hours.toString().padStart(2, '0');
    setRingTimeStr(`${hoursStr}:${mins} ${ampm}`);
  }, [minutes]);

  if (!isOpen) return null;

  const handleAddMinutes = (m: number) => {
    setMinutes((prev) => Math.max(1, prev + m));
    if ('vibrate' in navigator) {
      try { navigator.vibrate(30); } catch (e) {}
    }
  };

  const handleReset = () => {
    setMinutes(0);
  };

  const handleSave = () => {
    if (minutes <= 0) return;
    onSaveQuickAlarm(minutes, sound, volume);
    if ('vibrate' in navigator) {
      try { navigator.vibrate([50, 30, 50]); } catch (e) {}
    }
    onClose();
  };

  const presets = isAm
    ? [
        { label: '1 ደቂቃ', val: 1 },
        { label: '5 ደቂቃ', val: 5 },
        { label: '10 ደቂቃ', val: 10 },
        { label: '15 ደቂቃ', val: 15 },
        { label: '30 ደቂቃ', val: 30 },
        { label: '1 ሰዓት', val: 60 },
      ]
    : [
        { label: '1 min', val: 1 },
        { label: '5 min', val: 5 },
        { label: '10 min', val: 10 },
        { label: '15 min', val: 15 },
        { label: '30 min', val: 30 },
        { label: '1 hour', val: 60 },
      ];

  const currentSoundTitle = RINGTONES_CATALOG.find((r) => r.id === sound)?.title || sound;

  return (
    <AnimatePresence>
      <div
        id="quick-alarm-backdrop"
        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="max-w-md w-full bg-[#18191d] border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-white space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold">{isAm ? 'ፈጣን ማንቂያ' : 'Quick Alarm'}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Time Counter Display */}
          <div className="text-center py-2 space-y-1">
            <div className="flex items-center justify-center space-x-3">
              <span className="text-5xl font-black font-mono tracking-tight text-white">
                + {minutes}{isAm ? 'ደቂቃ' : 'm'}
              </span>
              <button
                onClick={handleReset}
                className="p-2 text-slate-400 hover:text-white bg-slate-800/60 rounded-full transition"
                title={isAm ? 'ሰዓት እንደገና ጀምር' : 'Reset timer'}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs font-medium text-slate-400">
              {isAm ? 'በዚህ ሰዓት ይጮኻል:' : 'Rings at:'}{' '}
              <span className="text-amber-400 font-bold">{ringTimeStr}</span>
            </p>
          </div>

          {/* Quick Preset Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            {presets.map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => handleAddMinutes(p.val)}
                className="py-3 px-2 rounded-2xl bg-[#22242b] hover:bg-[#2b2d37] border border-slate-800 text-sm font-bold text-slate-200 transition active:scale-95 flex items-center justify-center"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Sound & Volume Row */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-4">
              <span className="text-slate-400 font-medium">{isAm ? 'የማንቂያ ድምፅ' : 'Alarm sound'}</span>
              <div className="flex items-center space-x-2">
                <select
                  value={sound}
                  onChange={(e) => setSound(e.target.value as SoundType)}
                  className="bg-slate-900 text-slate-200 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none"
                >
                  {RINGTONES_CATALOG.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.emoji} {r.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Volume & Vibration Toggle */}
            <div className="flex items-center space-x-3">
              <Volume2 className="w-4 h-4 text-slate-400" />
              <input
                type="range"
                min="20"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <button
                type="button"
                onClick={() => setVibrate(!vibrate)}
                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center space-x-1 ${
                  vibrate
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}
              >
                <span>📳</span>
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
            <span>{isAm ? 'ፈጣን ማንቂያውን አስቀምጥ' : 'Save Quick Alarm'}</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
