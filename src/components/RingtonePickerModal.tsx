import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SoundType, RINGTONES_CATALOG, RingtoneOption, SoundCategory } from '../types';
import { audioEngine } from '../utils/audio';
import {
  Music,
  Bell,
  Volume2,
  VolumeX,
  Play,
  Square,
  Search,
  Upload,
  Check,
  X,
  Radio,
  Sliders,
  Sparkles,
  Smartphone,
  FileMusic,
  Activity
} from 'lucide-react';

interface RingtonePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSound: SoundType;
  onSelectSound: (sound: SoundType) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  gentleWakeUp: boolean;
  onGentleWakeUpChange: (gentle: boolean) => void;
}

export type RingtoneTab = 'alarms' | 'ringtones' | 'notifications' | 'custom';

export const RingtonePickerModal: React.FC<RingtonePickerModalProps> = ({
  isOpen,
  onClose,
  selectedSound,
  onSelectSound,
  volume,
  onVolumeChange,
  gentleWakeUp,
  onGentleWakeUpChange,
}) => {
  const [activeTab, setActiveTab] = useState<RingtoneTab>('alarms');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingSound, setPlayingSound] = useState<SoundType | null>(null);
  const [tempSelectedSound, setTempSelectedSound] = useState<SoundType>(selectedSound);
  const [customRingtones, setCustomRingtones] = useState<RingtoneOption[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync temp selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempSelectedSound(selectedSound);
    } else {
      audioEngine.stopAlarmSound();
      setPlayingSound(null);
    }
  }, [isOpen, selectedSound]);

  // Handle Play/Pause preview sound
  const handleTogglePreview = (soundId: SoundType) => {
    if (playingSound === soundId) {
      audioEngine.stopAlarmSound();
      setPlayingSound(null);
    } else {
      audioEngine.startAlarmSound(soundId, volume, false);
      setPlayingSound(soundId);
      // Haptic feedback
      if ('vibrate' in navigator) {
        try { navigator.vibrate(40); } catch (e) {}
      }
    }
  };

  // Select sound option
  const handleSelect = (soundId: SoundType) => {
    setTempSelectedSound(soundId);
    handleTogglePreview(soundId);
  };

  // Confirm selection
  const handleConfirm = () => {
    audioEngine.stopAlarmSound();
    setPlayingSound(null);
    onSelectSound(tempSelectedSound);
    if ('vibrate' in navigator) {
      try { navigator.vibrate([60, 40, 60]); } catch (e) {}
    }
    onClose();
  };

  // Handle local audio file import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const customId = `custom_${Date.now()}` as SoundType;
      const newOption: RingtoneOption = {
        id: customId,
        title: file.name.replace(/\.[^/.]+$/, ''),
        subtitle: `Custom Local File (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
        category: 'Other',
        emoji: '📁',
      };
      setCustomRingtones((prev) => [newOption, ...prev]);
      setTempSelectedSound(customId);
      setActiveTab('custom');
    }
  };

  if (!isOpen) return null;

  // Filter ringtones based on tab & search
  const filteredCatalog = [...RINGTONES_CATALOG, ...customRingtones].filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === 'alarms') {
      return matchesSearch && (item.category === 'Loud' || item.category === 'Trending' || item.category === 'Motivational');
    }
    if (activeTab === 'ringtones') {
      return matchesSearch && (item.category === 'Scenery' || item.category === 'Trending');
    }
    if (activeTab === 'notifications') {
      return matchesSearch && (item.category === 'Other');
    }
    if (activeTab === 'custom') {
      return matchesSearch && item.id.startsWith('custom_');
    }
    return matchesSearch;
  });

  return (
    <AnimatePresence>
      <div
        id="ringtone-picker-backdrop"
        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="max-w-md w-full bg-[#18191d] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        >
          {/* Material Toolbar Header (Android Ringtone Picker Style) */}
          <div className="bg-gradient-to-r from-slate-900 via-[#1c1d23] to-slate-900 p-5 border-b border-slate-800 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center ring-1 ring-amber-500/30">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Android Ringtone Picker
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select alarm, ringtone, or custom sound tone
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  audioEngine.stopAlarmSound();
                  setPlayingSound(null);
                  onClose();
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Navigation Tabs */}
            <div className="flex bg-slate-950/70 p-1 rounded-2xl mt-4 border border-slate-800/80 text-xs font-semibold">
              {[
                { id: 'alarms', label: 'Alarms', icon: <Bell className="w-3.5 h-3.5" /> },
                { id: 'ringtones', label: 'Ringtones', icon: <Music className="w-3.5 h-3.5" /> },
                { id: 'notifications', label: 'Chimes', icon: <Sparkles className="w-3.5 h-3.5" /> },
                { id: 'custom', label: 'Custom', icon: <FileMusic className="w-3.5 h-3.5" /> },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as RingtoneTab)}
                    className={`flex-1 py-2 px-2 rounded-xl flex items-center justify-center space-x-1.5 transition ${
                      active
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Bar & Custom Upload Trigger */}
          <div className="p-3 bg-[#131417] border-b border-slate-800/80 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search sounds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {activeTab === 'custom' && (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import Custom MP3 / Audio File</span>
                </button>
              </div>
            )}
          </div>

          {/* Sound Options List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-slate-800/40">
            {filteredCatalog.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                {activeTab === 'custom'
                  ? 'No custom audio files uploaded yet. Click above to import MP3 files!'
                  : 'No sounds match your search.'}
              </div>
            ) : (
              filteredCatalog.map((item) => {
                const isSelected = tempSelectedSound === item.id;
                const isPlaying = playingSound === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`p-3 rounded-2xl transition cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-amber-500/10 border border-amber-500/40 text-white'
                        : 'hover:bg-slate-800/50 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Android-style Radio Button */}
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500 text-slate-950'
                            : 'border-slate-600 group-hover:border-slate-400'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-slate-950" />}
                      </div>

                      {/* Emoji Icon & Details */}
                      <span className="text-lg leading-none">{item.emoji}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate text-slate-100 flex items-center space-x-2">
                          <span>{item.title}</span>
                          {isPlaying && (
                            <span className="inline-flex space-x-0.5 items-end h-3">
                              <span className="w-0.5 h-2 bg-amber-400 animate-pulse" />
                              <span className="w-0.5 h-3 bg-amber-400 animate-pulse delay-75" />
                              <span className="w-0.5 h-1.5 bg-amber-400 animate-pulse delay-150" />
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    {/* Play/Pause Sound Test Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePreview(item.id);
                      }}
                      className={`p-2 rounded-xl transition ${
                        isPlaying
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:text-amber-400'
                      }`}
                      title={isPlaying ? 'Stop Preview' : 'Play Preview'}
                    >
                      {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Volume & Settings Controls */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center space-x-1.5 font-bold">
                <Volume2 className="w-4 h-4 text-amber-400" />
                <span>Ringtone Volume</span>
              </span>
              <span className="font-mono text-amber-400 font-bold">{volume}%</span>
            </div>

            <input
              type="range"
              min="20"
              max="100"
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-full accent-amber-500"
            />

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={gentleWakeUp}
                  onChange={(e) => onGentleWakeUpChange(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-amber-500"
                />
                <span>30s Auto-Fade (0-100% Volume Ramp)</span>
              </label>

              <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-1">
                <Activity className="w-3 h-3 text-amber-400" />
                <span>Haptic Active</span>
              </div>
            </div>

            {/* Material Action Buttons (CANCEL / OK) */}
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  audioEngine.stopAlarmSound();
                  setPlayingSound(null);
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition shadow-lg shadow-amber-500/10 flex items-center justify-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>APPLY TONE</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
