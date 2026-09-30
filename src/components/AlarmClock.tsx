import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Alarm, SoundType, ChallengeType, WallpaperId, WallpaperOption, RINGTONES_CATALOG, SoundCategory } from '../types';
import { Language, translations } from '../utils/translations';
import { audioEngine } from '../utils/audio';
import { Plus, Trash2, Volume2, Bell, Clock, Edit2, Play, Square, Shield, Sparkles, Image, Flame, Radio, ChevronRight, Music, Sliders, Calendar, Zap, X, BellRing } from 'lucide-react';
import { RingtonePickerModal } from './RingtonePickerModal';
import { QuickAlarmModal } from './QuickAlarmModal';
import { HabitAlarmWizardModal } from './HabitAlarmWizardModal';
import { MorningInspiration } from './MorningInspiration';
import { getNotificationStatus, requestNotificationPermission, NotificationStatus } from '../utils/notifications';

interface AlarmClockProps {
  alarms: Alarm[];
  onAddAlarm: (alarm: Omit<Alarm, 'id' | 'snoozeCount'>) => void;
  onUpdateAlarm: (alarm: Alarm) => void;
  onDeleteAlarm: (id: string) => void;
  nextAlarmTime: string | null;
  language?: Language;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const WALLPAPERS: WallpaperOption[] = [
  { id: 'default', name: 'Cosmic Dark', category: 'Trending', bgGradient: 'bg-[#18191d]' },
  { id: 'capybara', name: 'Capybara Chill Sunrise', category: 'Trending', bgGradient: 'bg-[#18191d]', quote: 'Be like the capybara: calm, cool, and peaceful.' },
  { id: 'motivation', name: 'Daily Power Focus', category: 'Daily Motivation', bgGradient: 'bg-[#18191d]', quote: 'Small daily steps create extraordinary lifelong results.' },
  { id: 'space', name: 'Into Space Nebula', category: 'Into Space', bgGradient: 'bg-[#18191d]', quote: 'Reach for the stars; your potential is infinite.' },
  { id: 'nature', name: 'Misty Forest Dew', category: 'Trending', bgGradient: 'bg-[#18191d]', quote: 'Breathe deep and embrace nature\'s morning peace.' },
];

export const AlarmClock: React.FC<AlarmClockProps> = ({
  alarms,
  onAddAlarm,
  onUpdateAlarm,
  onDeleteAlarm,
  nextAlarmTime,
  language = 'en',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);

  // Form State
  const [time, setTime] = useState('07:00');
  const [label, setLabel] = useState('Morning Wake Up');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [sound, setSound] = useState<SoundType>('sunrise');
  const [volume, setVolume] = useState(80);
  const [gentleWakeUp, setGentleWakeUp] = useState(true);
  const [wallpaper, setWallpaper] = useState<WallpaperId>('capybara');
  const [challenge, setChallenge] = useState<ChallengeType>('math');
  const [challengeDifficulty, setChallengeDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');

  // FAB Popover Menu & Specialized Modal States
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isQuickAlarmOpen, setIsQuickAlarmOpen] = useState(false);
  const [isHabitWizardOpen, setIsHabitWizardOpen] = useState(false);

  // Notification Banner state
  const [notifStatus, setNotifStatus] = useState<NotificationStatus>({ isSupported: true, permission: 'default' });

  React.useEffect(() => {
    setNotifStatus(getNotificationStatus());
  }, []);

  const handleRequestNotif = async () => {
    await requestNotificationPermission();
    setNotifStatus(getNotificationStatus());
  };

  // Quick alarm save handler
  const handleSaveQuickAlarm = (minutes: number, quickSound: SoundType, quickVolume: number) => {
    const targetDate = new Date(Date.now() + minutes * 60 * 1000);
    const h = targetDate.getHours().toString().padStart(2, '0');
    const m = targetDate.getMinutes().toString().padStart(2, '0');
    const timeString = `${h}:${m}`;

    onAddAlarm({
      time: timeString,
      label: `⚡ Quick Alarm (+${minutes}m)`,
      enabled: true,
      repeatDays: [], // One-time
      sound: quickSound,
      volume: quickVolume,
      gentleWakeUp: true,
      wallpaper: 'capybara',
      challenge: 'math',
      challengeDifficulty: 'easy',
    });
  };

  // Habit alarm save handler
  const handleSaveHabitAlarm = (
    habitTitle: string,
    habitTime: string,
    habitDays: number[],
    habitSound: SoundType,
    habitChallenge: ChallengeType
  ) => {
    onAddAlarm({
      time: habitTime,
      label: `🔥 ${habitTitle}`,
      enabled: true,
      repeatDays: habitDays,
      sound: habitSound,
      volume: 80,
      gentleWakeUp: true,
      wallpaper: 'capybara',
      challenge: habitChallenge,
      challengeDifficulty: 'easy',
    });
  };

  // Preview Sound & Ringtone Picker State
  const [playingSound, setPlayingSound] = useState<SoundType | null>(null);
  const [isRingtonePickerOpen, setIsRingtonePickerOpen] = useState(false);

  const openAddModal = () => {
    setEditingAlarm(null);
    setTime('07:00');
    setLabel('Morning Wake Up');
    setRepeatDays([1, 2, 3, 4, 5]);
    setSound('sunrise');
    setVolume(80);
    setGentleWakeUp(true);
    setWallpaper('capybara');
    setChallenge('math');
    setChallengeDifficulty('easy');
    setIsModalOpen(true);
  };

  const openEditModal = (alarm: Alarm) => {
    setEditingAlarm(alarm);
    setTime(alarm.time);
    setLabel(alarm.label);
    setRepeatDays(alarm.repeatDays);
    setSound(alarm.sound);
    setVolume(alarm.volume);
    setGentleWakeUp(alarm.gentleWakeUp ?? true);
    setWallpaper(alarm.wallpaper ?? 'capybara');
    setChallenge(alarm.challenge);
    setChallengeDifficulty(alarm.challengeDifficulty);
    setIsModalOpen(true);
  };

  const toggleDay = (dayIndex: number) => {
    if (repeatDays.includes(dayIndex)) {
      setRepeatDays(repeatDays.filter((d) => d !== dayIndex));
    } else {
      setRepeatDays([...repeatDays, dayIndex].sort());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAlarm) {
      onUpdateAlarm({
        ...editingAlarm,
        time,
        label,
        repeatDays,
        sound,
        volume,
        gentleWakeUp,
        wallpaper,
        challenge,
        challengeDifficulty,
      });
    } else {
      onAddAlarm({
        time,
        label,
        enabled: true,
        repeatDays,
        sound,
        volume,
        gentleWakeUp,
        wallpaper,
        challenge,
        challengeDifficulty,
      });
    }
    stopPreview();
    setIsModalOpen(false);
  };

  const toggleSoundPreview = (selectedSound: SoundType) => {
    if (playingSound === selectedSound) {
      audioEngine.stopAlarmSound();
      setPlayingSound(null);
    } else {
      audioEngine.startAlarmSound(selectedSound, volume, false);
      setPlayingSound(selectedSound);
    }
  };

  const stopPreview = () => {
    if (playingSound) {
      audioEngine.stopAlarmSound();
      setPlayingSound(null);
    }
  };

  return (
    <div id="alarm-clock-view" className="space-y-6">
      {/* Centered Morning Inspiration Quote Widget */}
      <MorningInspiration language={language} />

      {/* Countdown status label with strong bold hierarchy */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2.5 text-sm font-black text-white bg-slate-800/80 border border-slate-700/70 px-4 py-2 rounded-xl shadow-md">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span>
            {nextAlarmTime
              ? language === 'am'
                ? `በ ${nextAlarmTime} ይጮኻል`
                : `Ring in ${nextAlarmTime}`
              : language === 'am'
              ? 'ምንም የሚመጣ ማንቂያ የለም'
              : 'No upcoming alarms'}
          </span>
        </div>
      </div>

      {/* Alarm Cards List with Primary Visual Hierarchy */}
      <div className="space-y-4 pb-20">
        {alarms.map((alarm) => {
          const isEnabled = alarm.enabled;
          // Format time to 12h am/pm format like 7:00 am
          const [hStr, mStr] = alarm.time.split(':');
          let h = parseInt(hStr, 10);
          const ampm = h >= 12 ? 'pm' : 'am';
          h = h % 12;
          if (h === 0) h = 12;
          const display12h = `${h}:${mStr}`;

          return (
            <div
              key={alarm.id}
              id={`alarm-card-${alarm.id}`}
              className={`p-6 rounded-3xl border transition-all relative ${
                isEnabled
                  ? 'bg-[#1f2026] border-slate-700/80 shadow-2xl ring-1 ring-white/5'
                  : 'bg-[#141518]/60 border-slate-800/40 opacity-40'
              }`}
            >
              {/* Days indicator row S M T W T F S */}
              <div className="flex items-center space-x-2 text-xs font-black text-slate-500 mb-3 tracking-widest">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayLetter, dIdx) => {
                  const active = alarm.repeatDays.includes(dIdx);
                  return (
                    <span
                      key={dIdx}
                      className={active ? 'text-white font-black' : 'text-slate-600'}
                    >
                      {dayLetter}
                    </span>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-6xl font-black text-white tracking-tighter drop-shadow-sm">
                      {display12h}
                    </span>
                    <span className="text-xl font-black text-slate-300 font-sans uppercase">
                      {ampm}
                    </span>
                    {/* Mission Badge */}
                    <span className="ml-2 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-200 font-mono">
                      {alarm.challenge === 'math' ? '+ - x ÷' : alarm.challenge !== 'none' ? alarm.challenge : '🔔'}
                    </span>
                  </div>

                  {/* Label */}
                  <div className="text-base font-bold text-slate-200 mt-2 flex items-center space-x-2">
                    <span>{alarm.label || '🐣 Wake up early'}</span>
                  </div>
                </div>

                {/* Right controls: Red Toggle Switch & Options menu */}
                <div className="flex items-center space-x-3">
                  <button
                    id={`toggle-alarm-${alarm.id}`}
                    type="button"
                    onClick={() => onUpdateAlarm({ ...alarm, enabled: !alarm.enabled })}
                    className={`w-14 h-8 rounded-full transition-colors p-1 flex items-center ${
                      isEnabled ? 'bg-red-500 justify-end shadow-lg shadow-red-500/20' : 'bg-slate-800 justify-start'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-white shadow-md" />
                  </button>

                  <button
                    onClick={() => openEditModal(alarm)}
                    className="p-1.5 text-slate-400 hover:text-white transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteAlarm(alarm.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Action Button (FAB) & Menu matching Image 1 */}
      {/* Dimmed backdrop when FAB menu is open */}
      <AnimatePresence>
        {isFabOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsFabOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs"
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-20 right-6 z-50 flex flex-col items-end space-y-3">
        {/* Stacked Menu Items matching Image 1 */}
        <AnimatePresence>
          {isFabOpen && (
            <div className="flex flex-col items-end space-y-3 pb-1">
              {/* Habit alarm pill */}
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                transition={{ duration: 0.15, delay: 0.08 }}
                onClick={() => {
                  setIsFabOpen(false);
                  setIsHabitWizardOpen(true);
                }}
                className="bg-white text-slate-900 font-bold text-sm py-3 px-5 rounded-2xl shadow-2xl flex items-center space-x-3 transition hover:bg-slate-50 active:scale-95"
              >
                <Calendar className="w-5 h-5 text-slate-900 fill-slate-300" />
                <span>Habit alarm</span>
              </motion.button>

              {/* Quick alarm pill */}
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                transition={{ duration: 0.15, delay: 0.04 }}
                onClick={() => {
                  setIsFabOpen(false);
                  setIsQuickAlarmOpen(true);
                }}
                className="bg-white text-slate-900 font-bold text-sm py-3 px-5 rounded-2xl shadow-2xl flex items-center space-x-3 transition hover:bg-slate-50 active:scale-95"
              >
                <Zap className="w-5 h-5 text-slate-900 fill-slate-300" />
                <span>Quick alarm</span>
              </motion.button>

              {/* Alarm pill */}
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                transition={{ duration: 0.15 }}
                onClick={() => {
                  setIsFabOpen(false);
                  openAddModal();
                }}
                className="bg-white text-slate-900 font-bold text-sm py-3.5 px-6 rounded-2xl shadow-2xl flex items-center space-x-3 transition hover:bg-slate-50 active:scale-95 border-2 border-slate-200"
              >
                <Bell className="w-5 h-5 text-slate-900 fill-slate-300" />
                <span>Alarm</span>
              </motion.button>
            </div>
          )}
        </AnimatePresence>

        {/* Main Red Circle FAB Button */}
        <button
          id="btn-fab-add-alarm"
          type="button"
          onClick={() => {
            setIsFabOpen(!isFabOpen);
            if ('vibrate' in navigator) {
              try { navigator.vibrate(30); } catch (e) {}
            }
          }}
          className={`w-14 h-14 rounded-full text-white flex items-center justify-center shadow-2xl transition-all duration-200 active:scale-90 ${
            isFabOpen
              ? 'bg-[#ff3b5c] rotate-90 shadow-red-500/40 ring-4 ring-red-500/20'
              : 'bg-[#ff3b5c] hover:bg-[#e02f4d] shadow-red-500/30'
          }`}
          title="Add Alarm Menu"
        >
          {isFabOpen ? (
            <X className="w-7 h-7 stroke-[2.5]" />
          ) : (
            <Plus className="w-8 h-8 stroke-[2.5]" />
          )}
        </button>
      </div>

      {/* Add / Edit Alarm Modal */}
      {isModalOpen && (
        <div id="alarm-edit-modal-backdrop" className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#18191d] border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80">
              <h3 className="text-xl font-black text-white tracking-tight">
                {editingAlarm ? 'Edit Alarm' : 'Set New Alarm'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  stopPreview();
                  setIsModalOpen(false);
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Time Selection */}
              <div>
                <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Alarm Time (24H)
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-3xl font-mono font-bold text-center text-amber-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition shadow-inner"
                  required
                />
              </div>

              {/* Label */}
              <div>
                <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Alarm Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Daily Motivation Alert"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-slate-700 transition"
                />
              </div>

              {/* Repeat Days */}
              <div>
                <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Repeat Days
                </label>
                <div className="flex justify-between gap-1.5">
                  {DAYS.map((day, idx) => {
                    const selected = repeatDays.includes(idx);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleDay(idx)}
                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                          selected
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-105'
                            : 'bg-slate-950 text-slate-400 border border-slate-800/80 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {day[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sound Selector with Android Ringtone Picker Trigger */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                    Alarm Sound Tone
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleSoundPreview(sound)}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center space-x-1.5 transition"
                  >
                    {playingSound === sound ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{playingSound === sound ? 'Stop Test' : 'Test Tone'}</span>
                  </button>
                </div>

                {/* Ringtone Picker Launch Card */}
                {(() => {
                  const currentRingtone = RINGTONES_CATALOG.find((r) => r.id === sound) || {
                    emoji: '🎵',
                    title: sound,
                    subtitle: 'Selected Tone',
                  };
                  return (
                    <button
                      type="button"
                      onClick={() => setIsRingtonePickerOpen(true)}
                      className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between transition text-left group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-white flex items-center justify-center text-lg shrink-0">
                          {currentRingtone.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate group-hover:text-slate-200 transition">
                            {currentRingtone.title}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {currentRingtone.subtitle}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 bg-slate-800 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 shrink-0">
                        <Music className="w-3.5 h-3.5 text-white" />
                        <span>Browse Picker</span>
                      </div>
                    </button>
                  );
                })()}
              </div>

              {/* Target Volume Slider */}
              <div>
                <div className="flex justify-between text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  <span>Target Volume</span>
                  <span className="font-mono text-amber-400">{volume}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
                />
              </div>

              {/* Wake Up Challenge Option */}
              <div>
                <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Wake-Up Challenge (Required to Stop Alarm)
                </label>
                <select
                  value={challenge}
                  onChange={(e) => setChallenge(e.target.value as ChallengeType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-slate-700 transition"
                >
                  <option value="none">None (Standard Dismiss Button)</option>
                  <option value="math">Math Equations (Solves Morning Brain Fog)</option>
                  <option value="shake">Physical Phone Shake Challenge</option>
                  <option value="tiles">Color Memory Tile Pattern</option>
                  <option value="typing">Morning Affirmation Typing</option>
                </select>
              </div>

              {/* Form Action Buttons */}
              <div className="flex space-x-3 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    stopPreview();
                    setIsModalOpen(false);
                  }}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold py-3.5 rounded-2xl transition text-sm border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3.5 rounded-2xl transition text-sm shadow-lg shadow-amber-500/20 active:scale-95"
                >
                  Save Alarm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Android Ringtone Picker Modal */}
      <RingtonePickerModal
        isOpen={isRingtonePickerOpen}
        onClose={() => setIsRingtonePickerOpen(false)}
        selectedSound={sound}
        onSelectSound={(newSound) => setSound(newSound)}
        volume={volume}
        onVolumeChange={(newVol) => setVolume(newVol)}
        gentleWakeUp={gentleWakeUp}
        onGentleWakeUpChange={(newGentle) => setGentleWakeUp(newGentle)}
      />

      {/* Quick Alarm Modal matching Image 5 */}
      <QuickAlarmModal
        isOpen={isQuickAlarmOpen}
        onClose={() => setIsQuickAlarmOpen(false)}
        onSaveQuickAlarm={handleSaveQuickAlarm}
      />

      {/* Habit Alarm Wizard Modal matching Images 2, 3, 4 */}
      <HabitAlarmWizardModal
        isOpen={isHabitWizardOpen}
        onClose={() => setIsHabitWizardOpen(false)}
        onSaveHabitAlarm={handleSaveHabitAlarm}
      />
    </div>
  );
};
