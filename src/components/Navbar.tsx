import React, { useState, useEffect } from 'react';
import { TabType } from '../types';
import { AlarmClock, Sun, Moon, Settings, FileText, Sparkles, ChevronRight, Globe } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  nextAlarmTime: string | null;
  toggleNightstand: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  nextAlarmTime,
  toggleNightstand,
  language,
  setLanguage,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const t = translations[language];

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: boolean }[] = [
    { id: 'alarm', label: t.alarm, icon: <AlarmClock className="w-5 h-5" /> },
    { id: 'sleep', label: t.sleep, icon: <Moon className="w-5 h-5" /> },
    { id: 'morning', label: t.morning, icon: <Sun className="w-5 h-5" /> },
    { id: 'settings', label: t.setting, icon: <Settings className="w-5 h-5" />, badge: true },
  ];

  return (
    <>
      {/* Top Header Status Bar */}
      <header id="app-header" className="bg-[#121316] border-b border-slate-800/80 text-slate-100 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* Top Left: App Brand Badge */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800 text-white border border-slate-700 font-black text-xs">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>WakeUp Alarm</span>
            </div>
          </div>

          {/* Top Right: Language Switcher, Clock & Nightstand mode toggle */}
          <div className="flex items-center space-x-2 text-xs font-mono">
            <button
              onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition border border-slate-700/60 flex items-center space-x-1"
              title="Switch Language / ቋንቋ ይቀይሩ"
            >
              <Globe className="w-3.5 h-3.5 text-slate-200" />
              <span>{language === 'en' ? 'አማርኛ' : 'English'}</span>
            </button>
            <span className="text-slate-400 font-sans text-xs hidden sm:inline">{currentTime}</span>
            <button
              onClick={toggleNightstand}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-red-400 transition"
              title="Nightstand Clock Mode"
            >
              <Moon className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Fixed Navigation Bar (Alarmy Style) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#121316]/95 backdrop-blur-md border-t border-slate-800/80 select-none">
        <div className="max-w-md mx-auto flex items-center justify-around py-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-3 transition rounded-xl ${
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <div className="relative">
                  {tab.icon}
                  {tab.badge && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#121316]" />
                  )}
                </div>
                <span className={`text-[11px] mt-1 font-medium ${isActive ? 'font-bold text-white' : 'text-slate-400'}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 w-8 h-0.5 bg-red-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Simulated Ad Banner Strip */}
        <div className="bg-[#0b0c0e] py-1 px-3 border-t border-slate-900 text-center flex items-center justify-center space-x-2 text-[10px] text-slate-500">
          <span className="bg-slate-800 text-slate-400 px-1 rounded font-bold">AD</span>
          <span>MEXC</span>
          <span className="text-slate-400 font-semibold flex items-center">
            INSTALL <ChevronRight className="w-3 h-3 ml-0.5 inline" />
          </span>
        </div>
      </div>
    </>
  );
};

