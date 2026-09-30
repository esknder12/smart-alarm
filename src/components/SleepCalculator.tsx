import React, { useState, useEffect } from 'react';
import { Sun, Moon, Clock, Check, ChevronRight, Mic, Play, Pause, Activity, Volume2 } from 'lucide-react';
import { Language } from '../utils/translations';

interface SleepCalculatorProps {
  onSetAlarm: (time: string, label: string) => void;
  language?: Language;
}

export const SleepCalculator: React.FC<SleepCalculatorProps> = ({ onSetAlarm, language = 'en' }) => {
  const isAm = language === 'am';
  const [isTracking, setIsTracking] = useState(false);
  const [trackingDuration, setTrackingDuration] = useState(0);
  const [snoreEvents, setSnoreEvents] = useState(2);
  const [showReportModal, setShowReportModal] = useState(false);

  const [mode, setMode] = useState<'wake' | 'sleep'>('wake');
  const [targetTime, setTargetTime] = useState('06:30');
  const [alarmSetTime, setAlarmSetTime] = useState<string | null>(null);

  // Timer for sleep tracking
  useEffect(() => {
    let interval: any;
    if (isTracking) {
      interval = setInterval(() => {
        setTrackingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setTrackingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isTracking]);

  const formatDuration = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate 90-min sleep cycles
  const calculateCycles = () => {
    const results: { time: string; cycles: number; hours: string; score: 'Optimal' | 'Good' | 'Minimum' }[] = [];
    const [h, m] = targetTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);

    const CYCLE_MINUTES = 90;
    const FALL_ASLEEP_BUFFER = 15;

    if (mode === 'wake') {
      [6, 5, 4, 3].forEach((cycles) => {
        const minutesToSubtract = cycles * CYCLE_MINUTES + FALL_ASLEEP_BUFFER;
        const sleepDate = new Date(date.getTime() - minutesToSubtract * 60000);
        const timeStr = sleepDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const hoursText = `${(cycles * 1.5).toFixed(1)} ${isAm ? 'ሰዓት' : 'hours'}`;
        const score = cycles >= 5 ? 'Optimal' : cycles === 4 ? 'Good' : 'Minimum';
        results.push({ time: timeStr, cycles, hours: hoursText, score });
      });
    } else {
      [3, 4, 5, 6].forEach((cycles) => {
        const minutesToAdd = cycles * CYCLE_MINUTES + FALL_ASLEEP_BUFFER;
        const wakeDate = new Date(date.getTime() + minutesToAdd * 60000);
        const timeStr = wakeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const hoursText = `${(cycles * 1.5).toFixed(1)} ${isAm ? 'ሰዓት' : 'hours'}`;
        const score = cycles >= 5 ? 'Optimal' : cycles === 4 ? 'Good' : 'Minimum';
        results.push({ time: timeStr, cycles, hours: hoursText, score });
      });
    }

    return results;
  };

  const handleQuickAlarm = (time: string, cycles: number) => {
    onSetAlarm(time, `Wakeup (${cycles} Sleep Cycles)`);
    setAlarmSetTime(time);
    setTimeout(() => setAlarmSetTime(null), 3000);
  };

  const options = calculateCycles();

  return (
    <div id="sleep-view" className="space-y-6 pb-24 max-w-md mx-auto">
      <h2 className="text-2xl font-black text-white px-1">{isAm ? 'እንቅልፍ' : 'Sleep'}</h2>

      {/* Main Sleep Tracking Banner matching Image 2 */}
      <div className="bg-[#1c1d22] border border-slate-800/90 rounded-3xl p-6 text-center space-y-4 shadow-xl">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">
            {isAm ? 'በእንቅልፍዎ ወቅት ምን እንዳደረጉ ይወቁ' : 'Find out what you did in your sleep'}
          </h3>
          <p className="text-xs text-slate-400">
            {isAm ? 'የመገልበጥ እና የእኮሮፋ ድምፆችን ይፈትሹ' : 'Track tossing, turning and snoring sounds'}
          </p>
        </div>

        {/* Audio Waveform Preview matching Image 2 */}
        <div className="bg-[#15161a] border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="text-left">
            <div className="text-xs font-mono text-slate-400">am 01:26</div>
            <div className="text-xs font-bold text-slate-200">{isAm ? 'በጣም ከፍተኛ' : 'Very High'}</div>
          </div>

          {/* Audio Waveform Visual Bars */}
          <div className="flex items-center space-x-1 h-8 px-2">
            {[4, 8, 12, 6, 18, 24, 16, 10, 20, 28, 14, 8, 18, 22, 10, 6, 12, 4].map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-300 ${
                  isTracking ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'
                }`}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        </div>

        {/* Track my sleep Big White Pill Button matching Image 2 */}
        <button
          onClick={() => setIsTracking(!isTracking)}
          className="w-full bg-white hover:bg-slate-100 text-slate-950 font-black text-base py-3.5 rounded-full shadow-lg transition active:scale-95 flex items-center justify-center space-x-2"
        >
          <Mic className="w-5 h-5 text-slate-900" />
          <span>
            {isTracking
              ? isAm
                ? `መከታተል አቁም (${formatDuration(trackingDuration)})`
                : `Stop Tracking (${formatDuration(trackingDuration)})`
              : isAm
              ? 'እንቅልፌን ተከታተል'
              : 'Track My Sleep'}
          </span>
        </button>

        {isTracking && (
          <div className="text-xs text-white font-semibold flex items-center justify-center space-x-2 animate-pulse">
            <Activity className="w-4 h-4 text-white" />
            <span>
              {isAm
                ? 'የእንቅልፍ ድምፆችን እና እኮሮፋዎችን በማዳመጥ ላይ...'
                : 'Listening for sleep sounds and snoring...'}
            </span>
          </div>
        )}
      </div>

      {/* Secondary Sleep Report Card matching Image 2 */}
      <button
        onClick={() => setShowReportModal(true)}
        className="w-full bg-[#1c1d22] border border-slate-800/90 rounded-2xl p-4 flex items-center justify-between text-left hover:border-slate-700 transition"
      >
        <div className="flex items-center space-x-3 text-sm font-bold text-white">
          <span className="text-sky-400 text-lg">🌙</span>
          <span>{isAm ? 'የእንቅልፍ ሪፖርቴ' : 'My Sleep Report'}</span>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500" />
      </button>

      {/* Sleep Cycle Calculator Section */}
      <div className="bg-[#1c1d22] p-5 rounded-3xl border border-slate-800/90 space-y-4">
        <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
          <Moon className="w-4 h-4 text-indigo-400" />
          <span>{isAm ? 'የREM ዑደት ማስተካከያ' : 'REM Cycle Calculator'}</span>
        </div>

        <div className="flex bg-[#121316] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setMode('wake')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
              mode === 'wake' ? 'bg-red-500 text-white shadow-md' : 'text-slate-400'
            }`}
          >
            {isAm ? 'በዚህ ሰዓት ንቃ' : 'Wake Up At'}
          </button>
          <button
            onClick={() => setMode('sleep')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
              mode === 'sleep' ? 'bg-red-500 text-white shadow-md' : 'text-slate-400'
            }`}
          >
            {isAm ? 'በዚህ ሰዓት ተኛ' : 'Sleep At'}
          </button>
        </div>

        <div className="text-center">
          <input
            type="time"
            value={targetTime}
            onChange={(e) => setTargetTime(e.target.value)}
            className="bg-[#121316] border border-slate-700 rounded-2xl px-4 py-2 text-2xl font-mono text-center text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 max-w-[180px] mx-auto block"
          />
        </div>

        {/* Suggested Times List */}
        <div className="space-y-2 pt-2">
          {options.map((opt, idx) => (
            <div
              key={idx}
              className="p-3 bg-[#121316] rounded-2xl border border-slate-800/80 flex items-center justify-between"
            >
              <div>
                <div className="text-lg font-mono font-bold text-white">{opt.time}</div>
                <div className="text-[11px] text-slate-400">
                  {opt.hours} ({opt.cycles} {isAm ? 'ዑደቶች' : 'cycles'})
                </div>
              </div>

              <button
                onClick={() => handleQuickAlarm(opt.time, opt.cycles)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                  alarmSetTime === opt.time
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-800 text-red-400 hover:bg-red-500 hover:text-white'
                }`}
              >
                {alarmSetTime === opt.time
                  ? isAm ? 'ተዘጋጅቷል!' : 'Set!'
                  : isAm ? 'ማንቂያ አዘጋጅ' : 'Set Alarm'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sleep Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1c1d22] border border-slate-800 rounded-3xl p-6 space-y-4 text-white">
            <h3 className="text-xl font-extrabold flex items-center space-x-2">
              <span>🌙</span>
              <span>{isAm ? 'የእንቅልፍ ሪፖርቴ' : 'My Sleep Report'}</span>
            </h3>

            <div className="bg-[#121316] p-4 rounded-2xl space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">{isAm ? 'የተመዘገበው ጠቅላላ እንቅልፍ:' : 'Total Recorded Sleep:'}</span>
                <span className="font-bold text-white">{isAm ? '7 ሰዓት ከ15 ደቂቃ' : '7h 15m'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">{isAm ? 'የተገኙ የእኮሮፋ ድምፆች:' : 'Detected Snoring:'}</span>
                <span className="font-bold text-amber-400">
                  {snoreEvents} {isAm ? 'ድምፆች' : 'events'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{isAm ? 'የእንቅልፍ ውጤት:' : 'Sleep Score:'}</span>
                <span className="font-bold text-emerald-400">88 / 100</span>
              </div>
            </div>

            <button
              onClick={() => setShowReportModal(false)}
              className="w-full py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-2xl transition"
            >
              {isAm ? 'ሪፖርቱን ዝጋ' : 'Close Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

