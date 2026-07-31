import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Alarm, SoundType, ChallengeType, WallpaperId, WallpaperOption, RINGTONES_CATALOG, SoundCategory } from '../types';
import { audioEngine } from '../utils/audio';
import { Plus, Trash2, Volume2, Bell, Clock, Edit2, Play, Square, Shield, Sparkles, Image, Flame, Radio, ChevronRight, Music, Sliders, Calendar, Zap, X, BellRing } from 'lucide-react';
import { RingtonePickerModal } from './RingtonePickerModal';
import { QuickAlarmModal } from './QuickAlarmModal';
import { HabitAlarmWizardModal } from './HabitAlarmWizardModal';
import { getNotificationStatus, requestNotificationPermission, NotificationStatus } from '../utils/notifications';

interface AlarmClockProps {
  alarms: Alarm[];
  onAddAlarm: (alarm: Omit<Alarm, 'id' | 'snoozeCount'>) => void;
  onUpdateAlarm: (alarm: Alarm) => void;
  onDeleteAlarm: (id: string) => void;
  nextAlarmTime: string | null;
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
      {/* Announcement Banner matching Image 1 */}
      <div className="bg-[#1c1d22] border border-slate-800 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-slate-700 transition shadow-lg">
        <div className="flex items-center space-x-3">
          <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
            NEW
          </span>
          <div>
            <div className="text-sm font-bold text-white">Overslept AGAIN?</div>
            <div className="text-xs text-slate-400 font-medium">Try our new mission</div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500" />
      </div>

      {/* Notification Banner if permission not granted */}
      {notifStatus.permission !== 'granted' && (
        <div className="bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-slate-900 border border-amber-500/40 rounded-2xl p-3.5 flex items-center justify-between shadow-lg shadow-amber-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Allow Browser Notifications</div>
              <div className="text-[11px] text-amber-200/80">Get loud background popup alerts when alarms trigger</div>
            </div>
          </div>
          <button
            onClick={handleRequestNotif}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition shrink-0 shadow-md"
          >
            Allow
          </button>
        </div>
      )}

      {/* Countdown status label matching Image 1 */}
      <div className="flex items-center justify-between pt-1">
        <button className="text-xs font-bold text-slate-300 hover:text-white flex items-center space-x-1">
          <span>
            {nextAlarmTime ? `Ring in ${nextAlarmTime}` : 'No upcoming alarms'}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>

      {/* Alarm Cards List matching Image 1 */}
      <div className="space-y-3 pb-20">
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
              className={`p-5 rounded-2xl border transition-all relative ${
                isEnabled
                  ? 'bg-[#1a1b1f] border-slate-800/90 shadow-xl'
                  : 'bg-[#151619]/60 border-slate-800/40 opacity-50'
              }`}
            >
              {/* Days indicator row S M T W T F S */}
              <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-500 mb-2 tracking-widest">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayLetter, dIdx) => {
                  const active = alarm.repeatDays.includes(dIdx);
                  return (
                    <span
                      key={dIdx}
                      className={active ? 'text-slate-200' : 'text-slate-600'}
                    >
                      {dayLetter}
                    </span>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl font-extrabold text-white tracking-tight">
                      {display12h}
                    </span>
                    <span className="text-base font-bold text-slate-400 font-sans">
                      {ampm}
                    </span>
                    {/* Mission Badge */}
                    <span className="ml-1 px-1.5 py-0.5 bg-slate-800 border border-slate-700/60 rounded text-[10px] text-slate-300 font-mono">
                      {alarm.challenge === 'math' ? '+ - x ÷' : alarm.challenge !== 'none' ? alarm.challenge : '🔔'}
                    </span>
                  </div>

                  {/* Emoji Label */}
                  <div className="text-sm font-semibold text-slate-300 mt-2 flex items-center space-x-1.5">
                    <span>{alarm.label || '🐣 Wake up early'}</span>
                  </div>
                </div>

                {/* Right controls: Cyan Toggle Switch & Options menu */}
                <div className="flex items-center space-x-3">
                  <button
                    id={`toggle-alarm-${alarm.id}`}
                    type="button"
                    onClick={() => onUpdateAlarm({ ...alarm, enabled: !alarm.enabled })}
                    className={`w-14 h-8 rounded-full transition-colors p-1 flex items-center ${
                      isEnabled ? 'bg-cyan-400 justify-end' : 'bg-slate-800 justify-start'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-white shadow-md" />
                  </button>

                  <button
                    onClick={() => openEditModal(alarm)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteAlarm(alarm.id)}
                    className="p-1 text-slate-400 hover:text-red-400"
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
                <Calendar className="w-5 h-5 text-indigo-600 fill-indigo-100" />
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
                <Zap className="w-5 h-5 text-indigo-600 fill-indigo-100" />
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
                className="bg-white text-slate-900 font-bold text-sm py-3.5 px-6 rounded-2xl shadow-2xl flex items-center space-x-3 transition hover:bg-slate-50 active:scale-95 border-2 border-red-500/20"
              >
                <Bell className="w-5 h-5 text-red-500 fill-red-100" />
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
        <div id="alarm-edit-modal-backdrop" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingAlarm ? 'Edit Alarm' : 'Set New Alarm'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Time Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Time (24h)
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-3xl font-mono text-center text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              {/* Label */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Alarm Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Morning Workout"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Repeat Days */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Repeat Days
                </label>
                <div className="flex justify-between gap-1">
                  {DAYS.map((day, idx) => {
                    const selected = repeatDays.includes(idx);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleDay(idx)}
                        className={`w-9 h-9 rounded-lg text-xs font-bold transition ${
                          selected
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {day[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Wallpaper Theme Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1">
                  <Image className="w-3.5 h-3.5 text-amber-400" />
                  <span>Wake Screen Wallpaper Theme</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {WALLPAPERS.map((wp) => (
                    <button
                      type="button"
                      key={wp.id}
                      onClick={() => setWallpaper(wp.id)}
                      className={`p-2.5 rounded-2xl text-left border text-xs transition flex items-center justify-between ${
                        wallpaper === wp.id
                          ? 'bg-amber-500/10 border-amber-400 text-white font-bold ring-2 ring-amber-400/50 shadow-md shadow-amber-500/10'
                          : 'bg-slate-900 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-100 truncate">{wp.name}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">{wp.category}</div>
                      </div>
                      <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 border-slate-600">
                        {wallpaper === wp.id && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Selector with Android Ringtone Picker Trigger */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Alarm Sound Tone
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleSoundPreview(sound)}
                    className="text-xs text-amber-400 hover:underline flex items-center space-x-1"
                  >
                    {playingSound === sound ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3" />}
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
                      className="w-full bg-slate-950 hover:bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 flex items-center justify-between transition text-left group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-lg">
                          {currentRingtone.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition">
                            {currentRingtone.title}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {currentRingtone.subtitle}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 bg-amber-500/20 text-amber-400 text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-500/30">
                        <Music className="w-3.5 h-3.5" />
                        <span>Browse Picker</span>
                      </div>
                    </button>
                  );
                })()}
              </div>

              {/* Volume Slider & Gentle Wake Up */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Target Volume</span>
                    <span>{volume}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <label className="flex items-center space-x-3 cursor-pointer p-3.5 bg-slate-950 rounded-2xl border border-slate-800 hover:border-amber-500/40 transition group">
                  <input
                    type="checkbox"
                    checked={gentleWakeUp}
                    onChange={(e) => setGentleWakeUp(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-amber-400 flex items-center space-x-1.5">
                      <span>30s Auto-Fade Volume Ramp</span>
                      <span className="bg-amber-500/10 text-amber-300 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/20 font-mono">RECOMMENDED</span>
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      Gradually ramps volume from 5% to target over 30 seconds to prevent sudden wake-up shock
                    </div>
                  </div>
                </label>
              </div>

              {/* Wake Up Challenge Option */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Wake-Up Challenge (Required to Stop Alarm)
                </label>
                <select
                  value={challenge}
                  onChange={(e) => setChallenge(e.target.value as ChallengeType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="none">None (Standard Dismiss Button)</option>
                  <option value="math">Math Equations (Solves Morning Brain Fog)</option>
                  <option value="shake">Physical Phone Shake Challenge</option>
                  <option value="tiles">Color Memory Tile Pattern</option>
                  <option value="typing">Morning Affirmation Typing</option>
                </select>
              </div>

              {/* Form Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    stopPreview();
                    setIsModalOpen(false);
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-xl transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition text-sm shadow-md shadow-amber-500/10"
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
