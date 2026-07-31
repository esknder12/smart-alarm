import React, { useState } from 'react';
import { Alarm, SoundType, ChallengeType, WallpaperId, RINGTONES_CATALOG, SoundCategory } from '../types';
import { audioEngine } from '../utils/audio';
import {
  Trophy,
  Star,
  Brain,
  X,
  Play,
  Square,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Volume2,
  Wind,
  Target,
  FileText,
  Activity,
  RotateCcw,
  Check,
  Bell,
  Clock,
  Sparkles
} from 'lucide-react';

interface OnboardingTourProps {
  onComplete: (newAlarm?: Omit<Alarm, 'id' | 'snoozeCount'>) => void;
  onClose: () => void;
}

export interface ThemeOption {
  id: WallpaperId;
  name: string;
  category: 'Trending' | 'Goal Focus';
  bgGradient: string;
  soundTag: string;
  soundId: SoundType;
  imageEmoji: string;
}

export const THEMES_DATA: ThemeOption[] = [
  {
    id: 'nature',
    name: 'A sunrise over misty forest',
    category: 'Trending',
    bgGradient: 'bg-[#18191d]',
    soundTag: 'Sunrise Birds',
    soundId: 'birds' as SoundType,
    imageEmoji: '🌅',
  },
  {
    id: 'motivation',
    name: 'A discipline archway',
    category: 'Trending',
    bgGradient: 'bg-[#18191d]',
    soundTag: 'Heavy Brass',
    soundId: 'radar' as SoundType,
    imageEmoji: '🏛️',
  },
  {
    id: 'capybara',
    name: 'Mindful Peace pose',
    category: 'Trending',
    bgGradient: 'bg-[#18191d]',
    soundTag: 'Gentle Flute',
    soundId: 'chime' as SoundType,
    imageEmoji: '🧘',
  },
  {
    id: 'space',
    name: 'Goal Focus Lotus Lake',
    category: 'Goal Focus',
    bgGradient: 'bg-[#18191d]',
    soundTag: 'Focus Ambient',
    soundId: 'digital' as SoundType,
    imageEmoji: '🪷',
  },
  {
    id: 'cat',
    name: 'Mountain Peak Dawn',
    category: 'Goal Focus',
    bgGradient: 'bg-[#18191d]',
    soundTag: 'Morning Breeze',
    soundId: 'sunrise' as SoundType,
    imageEmoji: '🏔️',
  },
  {
    id: 'default',
    name: 'Cosmic Horizon',
    category: 'Goal Focus',
    bgGradient: 'bg-[#18191d]',
    soundTag: 'Deep Space',
    soundId: 'chime' as SoundType,
    imageEmoji: '🌌',
  },
];

export const AUDIO_TRACKS = [
  {
    id: 'goodmorning' as SoundType,
    title: 'Motivational Speech',
    subtitle: 'Motivational Speech',
    tag: 'Currently Using',
    emoji: '🎙️',
  },
  {
    id: 'sunrise' as SoundType,
    title: 'Inspirational Music',
    subtitle: 'Calming Nature',
    tag: 'Calming',
    emoji: '🌲',
  },
  {
    id: 'piano' as SoundType,
    title: 'Inspiring Piano',
    subtitle: 'Inspiring Piano',
    tag: 'Calming',
    emoji: '🎹',
  },
  {
    id: 'digital' as SoundType,
    title: 'Uplifting Beats',
    subtitle: 'Uplifting Beats',
    tag: 'Uplifting',
    emoji: '🎧',
  },
  {
    id: 'chime' as SoundType,
    title: 'Motivational Sounds',
    subtitle: 'Energetic Chime',
    tag: 'Uplifting',
    emoji: '🔔',
  },
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, onClose }) => {
  // Steps:
  // 0: Tour 1 - Most Motivating Companion
  // 1: Tour 2 - End Demotivation
  // 2: Tour 3 - Medical Mindfulness
  // 3: Step 1/6 - Set start time
  // 4: Step 2/6 - Notification delivery
  // 5: Step 3/6 - Inspiration theme
  // 6: Step 4/6 - Mission category
  // 7: Step 5/6 - Wake-up audio
  // 8: Step 6/6 - Finalize alert
  const [step, setStep] = useState<number>(0);

  // Timepicker state
  const [hour, setHour] = useState<string>('07');
  const [minute, setMinute] = useState<string>('00');
  const [period, setPeriod] = useState<'AM' | 'p.m.'>('AM');

  // Permission Modal state
  const [notificationAllowed, setNotificationAllowed] = useState<boolean>(true);

  // Theme state
  const [selectedTheme, setSelectedTheme] = useState<WallpaperId>('nature');
  const [themeCategoryFilter, setThemeCategoryFilter] = useState<'ALL' | 'Trending' | 'Goal Focus'>('ALL');
  const [previewingThemeId, setPreviewingThemeId] = useState<WallpaperId | null>(null);

  // Mission state
  const [selectedMission, setSelectedMission] = useState<ChallengeType>('math');

  // Audio state
  const [audioCategory, setAudioCategory] = useState<SoundCategory>('Trending');
  const [selectedAudio, setSelectedAudio] = useState<SoundType>('goodmorning');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  // Alert settings state
  const [volume, setVolume] = useState<number>(95);
  const [gentleMotivation, setGentleMotivation] = useState<boolean>(true);

  const handleToggleThemeAudio = (e: React.MouseEvent, theme: ThemeOption) => {
    e.stopPropagation();
    if (previewingThemeId === theme.id) {
      audioEngine.stopAlarmSound();
      setPreviewingThemeId(null);
    } else {
      audioEngine.startAlarmSound(theme.soundId, 85, false);
      setPreviewingThemeId(theme.id);
    }
  };

  const handleToggleAudio = (snd: SoundType) => {
    if (isPlayingAudio && selectedAudio === snd) {
      audioEngine.stopAlarmSound();
      setIsPlayingAudio(false);
    } else {
      setSelectedAudio(snd);
      audioEngine.startAlarmSound(snd, volume, false);
      setIsPlayingAudio(true);
    }
  };

  const handleNext = () => {
    if (isPlayingAudio || previewingThemeId) {
      audioEngine.stopAlarmSound();
      setIsPlayingAudio(false);
      setPreviewingThemeId(null);
    }

    if (step < 8) {
      setStep(step + 1);
    } else {
      // Step 8: Set and Go
      let hInt = parseInt(hour, 10);
      if (period === 'p.m.' && hInt < 12) hInt += 12;
      if (period === 'AM' && hInt === 12) hInt = 0;
      const formattedTime = `${hInt.toString().padStart(2, '0')}:${minute}`;

      onComplete({
        time: formattedTime,
        label: 'Daily Motivation Alert',
        enabled: true,
        repeatDays: [1, 2, 3, 4, 5],
        sound: selectedAudio,
        volume,
        gentleWakeUp: gentleMotivation,
        wallpaper: selectedTheme,
        snoozeCount: 0,
        challenge: selectedMission,
        challengeDifficulty: 'easy',
      });
    }
  };

  const handleBack = () => {
    if (isPlayingAudio) {
      audioEngine.stopAlarmSound();
      setIsPlayingAudio(false);
    }
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between p-5 sm:p-8 select-none overflow-y-auto font-sans">
      {/* Background Star Dots Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff22_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-40" />

      {/* Top Bar Header */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-md mx-auto pt-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center space-x-1 text-xs font-bold text-slate-400 hover:text-white transition px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Undo</span>
          </button>
        ) : (
          <div className="w-12" />
        )}

        {step >= 3 ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-red-500 h-full transition-all duration-300"
                style={{ width: `${((step - 2) / 6) * 100}%` }}
              />
            </div>
            <div className="text-xs font-mono font-extrabold text-slate-400">
              {step - 2}/6
            </div>
          </div>
        ) : (
          <div className="flex space-x-2 mx-auto">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  step === i ? 'bg-red-500 w-5' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white p-1 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Body */}
      <div className="relative z-10 max-w-md w-full mx-auto my-auto py-4">
        {/* ================= TOUR 1 ================= */}
        {step === 0 && (
          <div className="text-center space-y-8 animate-fadeIn">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Trophy className="w-12 h-12 stroke-[1.75]" />
            </div>

            <h1 className="text-3xl font-black tracking-tight leading-snug px-4">
              The most motivating companion worldwide
            </h1>

            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-lg">
                <div className="text-sm text-slate-400 font-semibold">🌿 #1 Inspiration & Achievement App 🌿</div>
                <div className="text-xs text-slate-500 mt-1">in 110 countries</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-center">
                  <div className="text-2xl font-black text-white flex items-center justify-center space-x-1">
                    <span>4.9</span>
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Rating</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-center">
                  <div className="text-2xl font-black text-white">250M+</div>
                  <div className="text-[11px] text-slate-400 mt-1">Inspired Users</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TOUR 2 ================= */}
        {step === 1 && (
          <div className="text-center space-y-6 animate-fadeIn">
            <h1 className="text-3xl font-black tracking-tight leading-snug">
              End the cycle of demotivation.<br />Own your success.
            </h1>

            <div className="grid grid-cols-2 gap-3 pt-3">
              {/* Left Column: Other Tools */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left space-y-3">
                <div className="text-xs font-bold text-slate-400 border-b border-slate-800 pb-2">Other Tools</div>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Read a quote</span>
                    <span className="w-7 h-4 bg-emerald-500/80 rounded-full inline-block" />
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Watch a video</span>
                    <span className="w-7 h-4 bg-emerald-500/80 rounded-full inline-block" />
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Watch a note</span>
                    <span className="w-7 h-4 bg-emerald-500/80 rounded-full inline-block" />
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Write a note</span>
                    <span className="w-7 h-4 bg-emerald-500/80 rounded-full inline-block" />
                  </div>
                </div>
              </div>

              {/* Right Column: InspireMe */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-red-500/50 text-left space-y-3 ring-1 ring-red-500/30">
                <div className="text-xs font-bold text-red-400 border-b border-slate-800 pb-2">InspireMe</div>
                <div className="space-y-3 pt-1">
                  <div className="text-xs font-extrabold text-white leading-snug">
                    Complete a Mindful Mission
                  </div>
                  <div className="text-[10px] text-slate-400">InspireMe</div>
                  <div className="pt-4 flex justify-end">
                    <span className="w-8 h-4 bg-red-500 rounded-full inline-block shadow-md shadow-red-500/40" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TOUR 3 ================= */}
        {step === 2 && (
          <div className="text-center space-y-6 animate-fadeIn">
            <h1 className="text-3xl font-black tracking-tight leading-snug">
              The only mindfulness tool referenced in medical studies
            </h1>

            <div className="relative py-4 flex flex-col items-center">
              <div className="w-32 h-32 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-6 relative">
                <Brain className="w-16 h-16 stroke-[1.5]" />
                <div className="absolute -top-2 -left-6 bg-slate-900 border border-slate-700 px-3 py-1 rounded-full text-xs font-extrabold text-white shadow-lg">
                  Morning Focus <span className="text-red-400">2.5x</span>
                </div>
                <div className="absolute -top-2 -right-6 bg-slate-900 border border-slate-700 px-3 py-1 rounded-full text-xs font-extrabold text-white shadow-lg">
                  Goal Completion <span className="text-red-400">+20%</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 leading-relaxed max-w-xs">
                Referenced in leading journals: Journal of Clinical Psychology, and mindfulness studies
              </div>
            </div>
          </div>
        )}

        {/* ================= CREATE 1/6: Set Start Time ================= */}
        {step === 3 && (
          <div className="text-center space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-black tracking-tight text-white">Set your start time</h2>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 relative my-4 shadow-xl">
              <div className="flex items-center justify-center space-x-3 font-mono">
                {/* Hours Picker */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => {
                      let h = parseInt(hour, 10);
                      h = h >= 12 ? 1 : h + 1;
                      setHour(h.toString().padStart(2, '0'));
                    }}
                    className="p-2 text-slate-400 hover:text-amber-400 active:scale-95 transition"
                  >
                    <ChevronUp className="w-6 h-6" />
                  </button>
                  <div className="bg-slate-900 border border-slate-700 w-20 py-3 rounded-2xl text-3xl font-black text-amber-400 shadow-inner text-center">
                    {hour}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      let h = parseInt(hour, 10);
                      h = h <= 1 ? 12 : h - 1;
                      setHour(h.toString().padStart(2, '0'));
                    }}
                    className="p-2 text-slate-400 hover:text-amber-400 active:scale-95 transition"
                  >
                    <ChevronDown className="w-6 h-6" />
                  </button>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-sans font-bold mt-1">Hour</span>
                </div>

                <span className="text-3xl font-black text-slate-500 pb-5">:</span>

                {/* Minutes Picker */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => {
                      let m = parseInt(minute, 10);
                      m = (m + 5) % 60;
                      setMinute(m.toString().padStart(2, '0'));
                    }}
                    className="p-2 text-slate-400 hover:text-amber-400 active:scale-95 transition"
                  >
                    <ChevronUp className="w-6 h-6" />
                  </button>
                  <div className="bg-slate-900 border border-slate-700 w-20 py-3 rounded-2xl text-3xl font-black text-amber-400 shadow-inner text-center">
                    {minute}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      let m = parseInt(minute, 10);
                      m = (m - 5 + 60) % 60;
                      setMinute(m.toString().padStart(2, '0'));
                    }}
                    className="p-2 text-slate-400 hover:text-amber-400 active:scale-95 transition"
                  >
                    <ChevronDown className="w-6 h-6" />
                  </button>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-sans font-bold mt-1">Minute</span>
                </div>

                {/* AM / PM Toggle */}
                <div className="flex flex-col items-center justify-center pb-5 pl-2">
                  <button
                    type="button"
                    onClick={() => setPeriod(period === 'AM' ? 'p.m.' : 'AM')}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-bold px-3 py-2 rounded-xl text-sm transition active:scale-95 shadow-md"
                  >
                    {period}
                  </button>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-sans font-bold mt-2">Period</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-center space-x-2 overflow-x-auto pb-1">
                {[
                  { h: '06', m: '00', p: 'AM' as const },
                  { h: '07', m: '00', p: 'AM' as const },
                  { h: '08', m: '00', p: 'AM' as const },
                  { h: '09', m: '30', p: 'AM' as const },
                ].map((preset) => (
                  <button
                    key={`${preset.h}:${preset.m}-${preset.p}`}
                    type="button"
                    onClick={() => {
                      setHour(preset.h);
                      setMinute(preset.m);
                      setPeriod(preset.p);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                      hour === preset.h && minute === preset.m && period === preset.p
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {preset.h}:{preset.m} {preset.p}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400 flex items-center justify-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Selected Start Time: <strong className="text-amber-400 font-extrabold">{hour}:{minute} {period}</strong></span>
            </p>
          </div>
        )}

        {/* ================= CREATE 2/6: Notification Modal ================= */}
        {step === 4 && (
          <div className="text-center space-y-6 animate-fadeIn relative">
            <h2 className="text-2xl font-black tracking-tight text-white">Ensure essential motivation delivery</h2>

            {/* Centered System Notification Dialog Modal matching screenshot */}
            <div className="my-6 bg-[#1b1d22] border border-slate-700/80 rounded-3xl p-6 text-center space-y-4 shadow-2xl relative">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
                <Bell className="w-6 h-6 animate-pulse" />
              </div>

              <h3 className="text-lg font-bold text-white tracking-tight">Allow Notifications</h3>
              <p className="text-xs text-slate-300 leading-relaxed px-2">
                See Motivation Alerts. If alerts are off, you won't get your daily missions.
              </p>

              {notificationAllowed ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center justify-center space-x-2">
                  <Check className="w-4 h-4" />
                  <span>Notifications Allowed for Motivation Alerts</span>
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-medium">
                  Alerts are currently disabled. Tap Allow below to enable daily missions.
                </div>
              )}

              <div className="pt-3 flex items-center justify-around border-t border-slate-700/60 font-semibold text-xs">
                <button
                  type="button"
                  onClick={() => setNotificationAllowed(false)}
                  className={`px-4 py-2.5 rounded-xl transition ${!notificationAllowed ? 'text-red-400 font-bold bg-red-500/10 ring-1 ring-red-500/30' : 'text-slate-400 hover:text-white'}`}
                >
                  Don't Allow
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setNotificationAllowed(true);
                    if ('Notification' in window) {
                      try {
                        const perm = await Notification.requestPermission();
                        if (perm === 'granted') {
                          setNotificationAllowed(true);
                        }
                      } catch (err) {
                        console.log('Notification permission request handled');
                      }
                    }
                  }}
                  className={`relative px-5 py-2.5 rounded-xl font-bold transition flex items-center space-x-1.5 active:scale-95 ${
                    notificationAllowed ? 'text-white bg-sky-500 shadow-lg shadow-sky-500/30 ring-2 ring-sky-400' : 'text-slate-300 bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Allow</span>
                  <div className="absolute -bottom-3 -right-2 pointer-events-none animate-bounce">
                    <span className="text-2xl">👆</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= CREATE 3/6: Inspiration Theme ================= */}
        {step === 5 && (
          <div className="space-y-4 animate-fadeIn">
            {/* Header Badge & Title */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Inspiration Gallery</span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Choose your inspiration theme</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Select an immersive aesthetic wallpaper & soundscape for your alarm
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex justify-center space-x-2 pt-1">
              {[
                { id: 'ALL', label: 'All Themes' },
                { id: 'Trending', label: '💖 Trending' },
                { id: 'Goal Focus', label: '🔥 Goal Focus' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setThemeCategoryFilter(cat.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    themeCategoryFilter === cat.id
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-extrabold'
                      : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Modern Theme Card Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[48vh] overflow-y-auto pr-1 pb-2">
              {THEMES_DATA.filter(
                (t) => themeCategoryFilter === 'ALL' || t.category === themeCategoryFilter
              ).map((wp) => {
                const isSelected = selectedTheme === wp.id;
                const isPlaying = previewingThemeId === wp.id;

                return (
                  <div
                    key={wp.id}
                    onClick={() => {
                      setSelectedTheme(wp.id);
                      if ('vibrate' in navigator) {
                        try { navigator.vibrate(40); } catch (e) {}
                      }
                    }}
                    className={`group relative p-3 rounded-2xl border text-left flex flex-col justify-between h-36 cursor-pointer transition-all duration-200 overflow-hidden bg-[#18191d] ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/80 shadow-xl shadow-amber-500/20 scale-[1.02] bg-[#22242a]'
                        : 'border-slate-800/90 hover:border-slate-700 hover:bg-[#1f2026] hover:scale-[1.01]'
                    }`}
                  >
                    {/* Top row: Emoji avatar + Selection checkmark */}
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-2xl bg-slate-950/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-xl shadow-md">
                        {wp.imageEmoji}
                      </div>

                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center shadow-lg shadow-amber-500/30">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-white/20 group-hover:border-slate-400 transition" />
                      )}
                    </div>

                    {/* Middle: Theme Name */}
                    <div className="my-auto pt-1">
                      <div className="text-xs font-bold text-white leading-snug truncate">
                        {wp.name}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {wp.category}
                      </div>
                    </div>

                    {/* Bottom Row: Sound tag & preview button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleThemeAudio(e, wp)}
                      className={`w-full py-1.5 px-2 rounded-xl text-[10px] font-bold border transition flex items-center justify-between ${
                        isPlaying
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-950/60 backdrop-blur-md text-slate-300 border-white/10 hover:border-amber-500/40 hover:text-amber-400'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <Volume2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">{wp.soundTag}</span>
                      </div>
                      {isPlaying ? (
                        <Square className="w-3 h-3 fill-current shrink-0 animate-pulse" />
                      ) : (
                        <Play className="w-3 h-3 shrink-0" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= CREATE 4/6: Mission Category ================= */}
        {step === 6 && (
          <div className="space-y-4 animate-fadeIn">
            <h2 className="text-2xl font-black text-center text-white">Choose a mission category</h2>

            <div className="space-y-2.5">
              {[
                { id: 'math', name: 'Mindful Breathing', icon: <Wind className="w-5 h-5 text-sky-400" /> },
                { id: 'tiles', name: 'Focus Game', icon: <Target className="w-5 h-5 text-teal-400" /> },
                { id: 'typing', name: 'Gratitude Journaling', icon: <FileText className="w-5 h-5 text-amber-400" /> },
                { id: 'shake', name: 'Active Stretching', icon: <Activity className="w-5 h-5 text-purple-400" /> },
                { id: 'none', name: 'No Mission', icon: <X className="w-5 h-5 text-slate-500" /> },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedMission(m.id as ChallengeType)}
                  className={`p-4 rounded-2xl border flex items-center space-x-4 cursor-pointer transition ${
                    selectedMission === m.id
                      ? 'bg-slate-900 border-red-500 ring-1 ring-red-500/40'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-slate-800/80 shrink-0">
                    {m.icon}
                  </div>
                  <div className="font-bold text-white text-sm">{m.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= CREATE 5/6: Wake-Up Audio ================= */}
        {step === 7 && (
          <div className="space-y-4 animate-fadeIn">
            <h2 className="text-2xl font-black text-center text-white">Select your wake-up audio</h2>

            {/* Tags Header Filter: Trending, Motivational, Loud, Scenery, Other */}
            <div className="flex space-x-1.5 justify-center overflow-x-auto pb-1 no-scrollbar">
              {(['Trending', 'Motivational', 'Loud', 'Scenery', 'Other'] as const).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setAudioCategory(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap shrink-0 ${
                    audioCategory === tag
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/30 ring-1 ring-red-400'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Track List */}
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {RINGTONES_CATALOG.filter((tr) => tr.category === audioCategory).map((tr) => (
                <div
                  key={tr.id}
                  onClick={() => handleToggleAudio(tr.id)}
                  className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
                    selectedAudio === tr.id
                      ? 'bg-slate-900 border-red-500 ring-1 ring-red-500/30'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0">
                      {tr.emoji}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">{tr.title}</div>
                      <div className="text-[10px] text-slate-400">{tr.subtitle}</div>
                    </div>
                  </div>

                  <button className="p-2 text-slate-400 hover:text-white">
                    {isPlayingAudio && selectedAudio === tr.id ? (
                      <Square className="w-4 h-4 text-red-400 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= CREATE 6/6: Finalize Motivation Alert ================= */}
        {step === 8 && (
          <div className="space-y-5 animate-fadeIn">
            <h2 className="text-2xl font-black text-center text-white">Finalize your motivation alert</h2>

            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-5">
              {/* Volume Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>Volume</span>
                  <span>{volume}%</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Volume2 className="w-4 h-4 text-slate-400" />
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full accent-red-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Gentle Motivation Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <div className="font-bold text-xs text-slate-200">Gentle Motivation</div>
                  <div className="text-[10px] text-slate-400">Gradually increase for 1 minute</div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gentleMotivation}
                    onChange={(e) => setGentleMotivation(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                </label>
              </div>

              {/* Preview Button */}
              <button
                type="button"
                onClick={() => handleToggleAudio(selectedAudio)}
                className="w-full py-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 transition flex items-center justify-center space-x-2 text-xs font-bold"
              >
                {isPlayingAudio ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlayingAudio ? 'Stop Preview' : '▶ Preview'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Main Action Bar */}
      <div className="relative z-10 max-w-md w-full mx-auto pt-2 pb-1 flex items-center space-x-3">
        {step > 0 && (
          <button
            id="btn-onboarding-back"
            type="button"
            onClick={handleBack}
            className="w-1/3 bg-slate-900 hover:bg-slate-800 text-slate-200 font-extrabold text-sm py-3.5 rounded-2xl border border-slate-700/80 transition active:scale-95 flex items-center justify-center space-x-1.5 shadow-md"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span>Undo</span>
          </button>
        )}

        <button
          id="btn-onboarding-next"
          type="button"
          onClick={handleNext}
          className={`${
            step > 0 ? 'w-2/3' : 'w-full'
          } bg-red-500 hover:bg-red-400 text-white font-extrabold text-base py-3.5 rounded-2xl shadow-lg shadow-red-500/30 transition active:scale-95 flex items-center justify-center space-x-2`}
        >
          <span>
            {step === 2
              ? 'Begin Your Journey'
              : step === 8
              ? 'Set and Go'
              : 'Next'}
          </span>
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
