import React, { useState, useEffect } from 'react';
import { Sun, Moon, AlarmClock, X, Sparkles, CloudSun } from 'lucide-react';

interface NightstandClockProps {
  onClose: () => void;
  nextAlarmTime: string | null;
}

const QUOTES = [
  "እያንዳንዱ ጠዋት የወደፊቱን ለመገንባት አዲስ እድል ነው።",
  "ተነሱ፣ በአዲስ መንፈስ ጀምሩ፣ የእያንዳንዱን ቀን ብሩህ እድል ተመልከቱ።",
  "ወደፊት የመራመድ ሚስጥር መጀመር ነው።",
  "ማለዳዎች በተስፋ እና በማነቃቃት የተሞሉ ናቸው።"
];

export const NightstandClock: React.FC<NightstandClockProps> = ({
  onClose,
  nextAlarmTime,
}) => {
  const [time, setTime] = useState<Date>(new Date());
  const [isDimmed, setIsDimmed] = useState<boolean>(false);
  const [quoteIndex, setQuoteIndex] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const qTimer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 10000);
    return () => clearInterval(qTimer);
  }, []);

  const hours = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div
      id="nightstand-clock-view"
      className={`fixed inset-0 z-50 transition-colors duration-500 flex flex-col justify-between p-6 sm:p-12 select-none ${
        isDimmed
          ? 'bg-black text-rose-950/80'
          : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-slate-200 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 text-xs font-semibold">
            <CloudSun className="w-4 h-4 text-white" />
            <span>72°F Clear & Calm</span>
          </div>
          {nextAlarmTime && (
            <div className="flex items-center space-x-2 text-slate-200 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 text-xs font-semibold">
              <AlarmClock className="w-4 h-4 text-white" />
              <span>ማንቂያ: {nextAlarmTime}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsDimmed(!isDimmed)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center space-x-1.5 border ${
              isDimmed
                ? 'bg-rose-950 text-rose-500 border-rose-900'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>{isDimmed ? 'የምሽት ማብራሪያ በርቷል' : 'ማብራሪያውን ቀንስ'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Exit Nightstand Mode"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Clock */}
      <div className="text-center my-auto">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
          {dateStr}
        </div>
        <div className={`font-mono font-black tracking-tight leading-none text-7xl sm:text-9xl md:text-[12rem] transition-colors ${
          isDimmed ? 'text-rose-900/60' : 'text-amber-400 drop-shadow-[0_0_50px_rgba(245,158,11,0.15)]'
        }`}>
          {hours}
        </div>

        {/* Motivational Ticker */}
        <div className="mt-8 max-w-lg mx-auto text-sm sm:text-base font-medium italic text-slate-400 flex items-center justify-center space-x-2">
          <Sparkles className="w-4 h-4 text-white shrink-0" />
          <span>"{QUOTES[quoteIndex]}"</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-slate-600">
        Nightstand Bedside Clock • Click top right X to exit
      </div>
    </div>
  );
};
