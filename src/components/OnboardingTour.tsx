import React, { useState } from 'react';
import { Alarm, SoundType, ChallengeType, WallpaperId, RINGTONES_CATALOG, SoundCategory } from '../types';
import type { AlarmScheduleState } from '../utils/alarmScheduler';
import { audioEngine } from '../utils/audio';
import { nativeAlarmScheduler } from '../utils/alarmScheduler';
import { buildFirstAlarm } from '../utils/firstRun';
import { formatTime12h } from '../utils/alarmText';
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
  /**
   * First launch: the wizard is the only way into the app, so there is no close button and the last
   * step spells out the alarm it is about to create. Re-opened from Settings it is optional.
   */
  mandatory?: boolean;
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

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, onClose, mandatory = false }) => {
  // Steps: 0 to 3 (4 setup steps)
  // 0: Step 1/4 - Set start time
  // 1: Step 2/4 - Mission category
  // 2: Step 3/4 - Wake-up audio
  // 3: Step 4/4 - Finalize alert
  const [step, setStep] = useState<number>(0);

  // Timepicker state
  const [hour, setHour] = useState<string>('07');
  const [minute, setMinute] = useState<string>('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  // Permissions the alarm needs to ring with the screen off (Android only; a browser reports
  // `available: false` and the card stays hidden).
  const [permissions, setPermissions] = useState<AlarmScheduleState | null>(null);
  const [permissionBusy, setPermissionBusy] = useState<boolean>(false);

  const refreshPermissions = async () => {
    setPermissions(await nativeAlarmScheduler.getState());
  };

  React.useEffect(() => {
    void refreshPermissions();
  }, []);

  const askForNotifications = async () => {
    setPermissionBusy(true);
    await nativeAlarmScheduler.requestNotificationPermission();
    await refreshPermissions();
    setPermissionBusy(false);
  };

  const askForExactAlarms = async () => {
    setPermissionBusy(true);
    await nativeAlarmScheduler.openSettings('exactAlarm');
    await refreshPermissions();
    setPermissionBusy(false);
  };

  const permissionsMissing =
    !!permissions &&
    permissions.available &&
    (!permissions.notificationsAllowed || !permissions.exactAlarmsAllowed);

  // Theme state
  const [selectedTheme] = useState<WallpaperId>('nature');

  // Mission state
  const [selectedMission, setSelectedMission] = useState<ChallengeType>('math');

  // Audio state
  const [audioCategory, setAudioCategory] = useState<SoundCategory>('Trending');
  const [selectedAudio, setSelectedAudio] = useState<SoundType>('goodmorning');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  // Alert settings state
  const [volume, setVolume] = useState<number>(95);
  const [gentleMotivation, setGentleMotivation] = useState<boolean>(true);

  const missionNames: Record<string, string> = {
    math: 'Mindful Breathing',
    tiles: 'Focus Game',
    typing: 'Gratitude Journaling',
    shake: 'Active Stretching',
    none: 'No Mission',
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

  // The same builder that writes the alarm, so step 4 cannot promise a different time than the one
  // that ends up in the list.
  const firstAlarmPreview = formatTime12h(
    buildFirstAlarm({
      hour,
      minute,
      period,
      mission: selectedMission,
      sound: selectedAudio,
      volume,
      gentleWakeUp: gentleMotivation,
      wallpaper: selectedTheme,
    }).time
  );

  const handleNext = () => {
    if (isPlayingAudio) {
      audioEngine.stopAlarmSound();
      setIsPlayingAudio(false);
    }

    if (step < 3) {
      setStep(step + 1);
    } else {
      // Step 4 is the one that writes the alarm; the maths lives in utils/firstRun.ts so it is
      // tested on its own (12:00 AM is midnight, not noon).
      onComplete(
        buildFirstAlarm({
          hour,
          minute,
          period,
          mission: selectedMission,
          sound: selectedAudio,
          volume,
          gentleWakeUp: gentleMotivation,
          wallpaper: selectedTheme,
        })
      );
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
            <RotateCcw className="w-3.5 h-3.5 text-red-400" />
            <span>Undo</span>
          </button>
        ) : (
          <div className="w-12" />
        )}

        <div className="flex items-center justify-center space-x-2">
          <div className="w-28 bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-red-500 h-full transition-all duration-300"
              style={{ width: `${((step + 1) / 4) * 100}%` }}
            />
          </div>
          <div className="text-xs font-mono font-extrabold text-slate-400">
            {step + 1}/4
          </div>
        </div>

        {mandatory ? (
          // Nothing to close on first launch: the alarm has to exist before the app opens. The
          // space is kept so the progress bar stays centred.
          <div className="w-7" aria-hidden="true" />
        ) : (
          <button
            id="btn-onboarding-close"
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Content Body */}
      <div className="relative z-10 max-w-md w-full mx-auto my-auto py-4">
        {/* ================= CREATE 1/4: Set Start Time ================= */}
        {step === 0 && (
          <div className="text-center space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-black tracking-tight text-white">Set your start time</h2>
            <p className="text-xs font-semibold text-slate-400 -mt-3">
              {mandatory
                ? 'Pick the time you want to wake up - your first alarm is created at the end of these four steps.'
                : 'Pick the time you want this alarm to ring.'}
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 relative my-4 shadow-xl">
              <div className="flex items-center justify-center space-x-3 font-mono">
                {/* Direct Hours Input */}
                <div className="flex flex-col items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={hour}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setHour(val);
                    }}
                    onBlur={() => {
                      let num = parseInt(hour, 10);
                      if (isNaN(num) || num < 1) num = 7;
                      if (num > 12) num = 12;
                      setHour(num.toString().padStart(2, '0'));
                    }}
                    className="bg-slate-900 border border-slate-700 w-24 py-3 rounded-2xl text-4xl font-black text-red-500 shadow-inner text-center focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30 transition"
                  />
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-sans font-bold mt-2">ሰዓት</span>
                </div>

                <span className="text-4xl font-black text-slate-500 pb-5">:</span>

                {/* Direct Minutes Input */}
                <div className="flex flex-col items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={minute}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setMinute(val);
                    }}
                    onBlur={() => {
                      let num = parseInt(minute, 10);
                      if (isNaN(num) || num < 0) num = 0;
                      if (num > 59) num = 59;
                      setMinute(num.toString().padStart(2, '0'));
                    }}
                    className="bg-slate-900 border border-slate-700 w-24 py-3 rounded-2xl text-4xl font-black text-red-500 shadow-inner text-center focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30 transition"
                  />
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-sans font-bold mt-2">ደቂቃ</span>
                </div>

                {/* AM / PM Toggle */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setPeriod(period === 'AM' ? 'PM' : 'AM')}
                    className="bg-red-500 hover:bg-red-600 text-white font-black h-[66px] w-20 rounded-2xl text-2xl transition active:scale-95 shadow-md shadow-red-500/20 flex items-center justify-center"
                  >
                    {period}
                  </button>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-sans font-bold mt-2">ክፍለ-ጊዜ</span>
                </div>
              </div>


            </div>

            <p className="text-xs text-slate-400 flex items-center justify-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-red-400" />
              <span>የተመረጠው ሰዓት: <strong className="text-red-400 font-extrabold">{hour}:{minute} {period}</strong></span>
            </p>
          </div>
        )}

        {/* ================= CREATE 2/4: Mission Category ================= */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <h2 className="text-2xl font-black text-center text-white">Choose a mission category</h2>

            <div className="space-y-2.5">
              {[
                { id: 'math', icon: <Wind className="w-5 h-5 text-white" /> },
                { id: 'tiles', icon: <Target className="w-5 h-5 text-white" /> },
                { id: 'typing', icon: <FileText className="w-5 h-5 text-white" /> },
                { id: 'shake', icon: <Activity className="w-5 h-5 text-white" /> },
                { id: 'none', icon: <X className="w-5 h-5 text-slate-400" /> },
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
                  <div className="font-bold text-white text-sm">{missionNames[m.id]}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= CREATE 3/4: Wake-Up Audio ================= */}
        {step === 2 && (
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

        {/* ================= CREATE 4/4: Finalize Motivation Alert ================= */}
        {step === 3 && (
          <div className="space-y-5 animate-fadeIn">
            <h2 className="text-2xl font-black text-center text-white">Finalize your motivation alert</h2>

            {/* What the button below is about to create */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center space-y-1">
              <div className="text-[10px] uppercase tracking-widest font-black text-slate-500">
                Your alarm
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {firstAlarmPreview.time} {firstAlarmPreview.period.toUpperCase()}
              </div>
              <div className="text-[11px] font-semibold text-slate-400">
                Weekdays · {selectedMission === 'none' ? 'Dismiss button only' : missionNames[selectedMission] || selectedMission} ·{' '}
                {RINGTONES_CATALOG.find((tone) => tone.id === selectedAudio)?.title || selectedAudio}
              </div>
            </div>

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

            {/* Android asks for these itself; a browser never shows this card */}
            {permissionsMissing && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-bold text-amber-300">
                  One more thing - so this alarm really rings with the phone locked
                </div>
                {permissions && !permissions.notificationsAllowed && (
                  <button
                    id="btn-onboarding-allow-notifications"
                    type="button"
                    disabled={permissionBusy}
                    onClick={() => void askForNotifications()}
                    className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs transition active:scale-95 disabled:opacity-60"
                  >
                    Allow notifications
                  </button>
                )}
                {permissions && !permissions.exactAlarmsAllowed && (
                  <button
                    id="btn-onboarding-allow-exact-alarms"
                    type="button"
                    disabled={permissionBusy}
                    onClick={() => void askForExactAlarms()}
                    className="w-full py-2.5 rounded-xl bg-slate-900 text-amber-300 border border-amber-500/40 font-bold text-xs transition active:scale-95 disabled:opacity-60"
                  >
                    Allow exact alarms
                  </button>
                )}
              </div>
            )}
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
            <RotateCcw className="w-4 h-4 text-white" />
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
            {step === 3
              ? mandatory
                ? 'Set my alarm'
                : 'Set alarm & close'
              : 'Next'}
          </span>
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
