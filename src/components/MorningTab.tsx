import React, { useState } from 'react';
import { MapPin, ChevronRight, CheckSquare, Heart } from 'lucide-react';
import { PetState, TarotCard, RoutineStep } from '../types';
import { Language } from '../utils/translations';

interface MorningTabProps {
  routine: RoutineStep[];
  onToggleStep: (id: string) => void;
  onSelectTab: (tab: any) => void;
  language?: Language;
}

const TAROT_CARDS: TarotCard[] = [
  { id: '1', title: 'The Sun', keyword: 'Vitality & Success', symbol: '☀️', quote: 'Radiate joy, confidence, and warmth today.' },
  { id: '2', title: 'The Chariot', keyword: 'Determination & Will', symbol: '🛡️', quote: 'Stay focused on your direction and conquer any hurdle.' },
  { id: '3', title: 'The Star', keyword: 'Hope & Inspiration', symbol: '⭐', quote: 'A bright new morning brings infinite potential.' },
  { id: '4', title: 'Wheel of Fortune', keyword: 'Good Luck & Growth', symbol: '🎡', quote: 'Positive momentum is turning in your favor.' },
];

export const MorningTab: React.FC<MorningTabProps> = ({
  routine,
  onToggleStep,
  language = 'en',
}) => {
  const isAm = language === 'am';
  const [location, setLocation] = useState('Seoul');
  const [activeModal, setActiveModal] = useState<'pet' | 'feeling' | 'tarot' | null>(null);

  // Virtual Pet State
  const [pet, setPet] = useState<PetState>({
    name: 'Chickie',
    level: 3,
    xp: 65,
    happiness: 90,
    stage: 'chick',
  });

  // Mood Log State
  const [selectedFeeling, setSelectedFeeling] = useState<'great' | 'happy' | 'neutral' | 'tired' | 'groggy' | null>(null);
  const [feelingSaved, setFeelingSaved] = useState(false);

  // Tarot State
  const [drawnCard, setDrawnCard] = useState<TarotCard | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  const drawTarot = () => {
    const random = TAROT_CARDS[Math.floor(Math.random() * TAROT_CARDS.length)];
    setDrawnCard(random);
    setIsFlipped(true);
  };

  const feedPet = () => {
    setPet((prev) => ({
      ...prev,
      happiness: Math.min(100, prev.happiness + 10),
      xp: prev.xp + 15 >= 100 ? (prev.xp + 15) % 100 : prev.xp + 15,
      level: prev.xp + 15 >= 100 ? prev.level + 1 : prev.level,
    }));
  };

  return (
    <div id="morning-tab-view" className="space-y-6 pb-24 max-w-md mx-auto">
      {/* 1. Primary Feature: Weather & City Card */}
      <div className="bg-gradient-to-b from-[#2a3b5c] to-[#1c2840] border border-blue-500/20 rounded-3xl p-5 shadow-xl text-white space-y-4 relative">
        {/* Location selector header pill */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              const nextLoc = location === 'Seoul' ? 'New York' : location === 'New York' ? 'London' : 'Seoul';
              setLocation(nextLoc);
            }}
            className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-1.5 rounded-2xl backdrop-blur-md border border-white/10 transition flex items-center space-x-1"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-300" />
            <span>{location}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          </button>
          <span className="text-[11px] font-mono text-slate-300">
            {isAm ? 'የዛሬው የአየር ሁኔታ' : "Today's Weather"}
          </span>
        </div>

        <div className="flex justify-between items-end">
          <div>
            <div className="text-2xl font-black flex items-center space-x-2">
              <span>{isAm ? 'በከፊል ደመናማ 🌤️' : 'Partly Cloudy 🌤️'}</span>
            </div>
            <div className="text-xs text-slate-300 font-semibold mt-1">
              {isAm ? 'ከፍተኛ 31° | ዝቅተኛ 23°' : 'High 31° | Low 23°'}
            </div>
          </div>
        </div>

        {/* Hourly Forecast Scroll Strip */}
        <div className="flex space-x-3 overflow-x-auto pt-2 pb-1 scrollbar-none text-center border-t border-white/10">
          {[
            { hour: '11:00', temp: '29°' },
            { hour: '12:00', temp: '29°' },
            { hour: '13:00', temp: '28°' },
            { hour: '14:00', temp: '27°' },
            { hour: '15:00', temp: '26°' },
            { hour: '16:00', temp: '26°' },
            { hour: '17:00', temp: '26°' },
            { hour: '18:00', temp: '26°' },
            { hour: '19:00', temp: '25°' },
          ].map((item, idx) => (
            <div key={idx} className="shrink-0 flex flex-col items-center space-y-1">
              <span className="text-[10px] text-slate-300 font-mono">{item.hour}</span>
              <span className="text-base">🌤️</span>
              <span className="text-xs font-bold font-mono">{item.temp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Interactive Morning Tools Section */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {/* My Pet */}
        <button
          onClick={() => setActiveModal('pet')}
          className="flex flex-col items-center space-y-2 group"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#1c1d22] border border-slate-800 hover:border-amber-500/50 flex items-center justify-center text-3xl shadow-lg transition transform group-active:scale-95">
            🐣
          </div>
          <span className="text-xs font-bold text-slate-300 group-hover:text-white transition">
            {isAm ? 'የእኔ እንስሳ' : 'My pet'}
          </span>
        </button>

        {/* Morning feeling */}
        <button
          onClick={() => setActiveModal('feeling')}
          className="flex flex-col items-center space-y-2 group"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#1c1d22] border border-slate-800 hover:border-amber-500/50 flex items-center justify-center text-3xl shadow-lg transition transform group-active:scale-95">
            😀
          </div>
          <span className="text-xs font-bold text-slate-300 group-hover:text-white transition">
            {isAm ? 'የጠዋት ስሜት' : 'Morning feeling'}
          </span>
        </button>

        {/* Daily Tarot */}
        <button
          onClick={() => setActiveModal('tarot')}
          className="flex flex-col items-center space-y-2 group"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#1c1d22] border border-slate-800 hover:border-amber-500/50 flex items-center justify-center text-3xl shadow-lg transition transform group-active:scale-95">
            🎴
          </div>
          <span className="text-xs font-bold text-slate-300 group-hover:text-white transition">
            {isAm ? 'ዕለታዊ ታሮት' : 'Daily Tarot'}
          </span>
        </button>
      </div>

      {/* 3. Morning Habits & Checklist */}
      <div className="bg-[#1c1d22] border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <h3 className="text-base font-black text-white flex items-center space-x-2">
            <CheckSquare className="w-4 h-4 text-amber-400" />
            <span>{isAm ? 'የጠዋት ልማዶች' : 'Morning Habits'}</span>
          </h3>
          <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
            {routine.filter((r) => r.completed).length} / {routine.length} {isAm ? 'ተጠናቋል' : 'done'}
          </span>
        </div>

        <div className="space-y-2 pt-1">
          {routine.map((item) => (
            <button
              key={item.id}
              onClick={() => onToggleStep(item.id)}
              className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition ${
                item.completed
                  ? 'bg-slate-900/60 border-slate-800 text-slate-500 line-through'
                  : 'bg-[#151619] border-slate-800/90 text-slate-200 hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-bold">{item.title}</span>
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                  item.completed
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-black'
                    : 'border-slate-700 bg-slate-900'
                }`}
              >
                {item.completed && '✓'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modal: My Pet */}
      {activeModal === 'pet' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1c1d22] border border-slate-800 rounded-3xl p-6 text-center space-y-4 text-white">
            <h3 className="text-xl font-extrabold flex items-center justify-center space-x-2">
              <span>🐣</span>
              <span>{isAm ? `የጠዋት እንስሳዬ: ${pet.name}` : `My Morning Pet: ${pet.name}`}</span>
            </h3>

            <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-tr from-sky-400 to-amber-300 flex items-center justify-center text-6xl shadow-xl animate-bounce">
              🐣
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>{isAm ? `ደረጃ ${pet.level}` : `Level ${pet.level}`}</span>
                <span>XP: {pet.xp} / 100</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div className="bg-amber-400 h-2.5 rounded-full transition-all" style={{ width: `${pet.xp}%` }} />
              </div>

              <div className="flex justify-between text-slate-400 pt-2">
                <span>{isAm ? 'ደስታ' : 'Happiness'}</span>
                <span className="text-pink-400 font-bold">{pet.happiness}%</span>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={feedPet}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl transition flex items-center justify-center space-x-1"
              >
                <Heart className="w-4 h-4 fill-current text-slate-950" />
                <span>{isAm ? 'ምግብ ስጥ (+10)' : 'Feed Pet (+10)'}</span>
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="py-3 px-5 bg-slate-800 hover:bg-slate-700 font-bold rounded-2xl transition"
              >
                {isAm ? 'ዝጋ' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Morning Feeling */}
      {activeModal === 'feeling' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1c1d22] border border-slate-800 rounded-3xl p-6 text-center space-y-4 text-white">
            <h3 className="text-xl font-extrabold">
              {isAm ? 'ዛሬ ጠዋት ምን ይሰማዎታል?' : 'How do you feel this morning?'}
            </h3>

            <div className="grid grid-cols-5 gap-2 pt-2">
              {[
                { id: 'great', emoji: '🤩', label: isAm ? 'በጣም ጥሩ' : 'Great' },
                { id: 'happy', emoji: '😀', label: isAm ? 'ደስተኛ' : 'Happy' },
                { id: 'neutral', emoji: '😐', label: isAm ? 'ደህና' : 'Okay' },
                { id: 'tired', emoji: '🥱', label: isAm ? 'ደካክሞኛል' : 'Tired' },
                { id: 'groggy', emoji: '😴', label: isAm ? 'እንቅልፍ' : 'Groggy' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setSelectedFeeling(f.id as any);
                    setFeelingSaved(true);
                  }}
                  className={`p-3 rounded-2xl border flex flex-col items-center space-y-1 transition ${
                    selectedFeeling === f.id
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'bg-[#121316] border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-2xl">{f.emoji}</span>
                  <span className="text-[10px] font-bold">{f.label}</span>
                </button>
              ))}
            </div>

            {feelingSaved && (
              <p className="text-xs text-emerald-400 font-bold animate-pulse">
                {isAm ? '✓ የዛሬው የጠዋት ስሜትዎ ተመዝግቧል!' : '✓ Morning feeling logged for today!'}
              </p>
            )}

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-2xl transition"
            >
              {isAm ? 'ተጠናቋል' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Daily Tarot */}
      {activeModal === 'tarot' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1c1d22] border border-slate-800 rounded-3xl p-6 text-center space-y-4 text-white">
            <h3 className="text-xl font-extrabold">
              {isAm ? '🎴 ዕለታዊ የታሮት ማነቃቂያ' : '🎴 Daily Tarot Motivation'}
            </h3>

            {!isFlipped ? (
              <div className="space-y-4">
                <div className="w-40 h-60 mx-auto rounded-2xl bg-gradient-to-br from-purple-900 to-indigo-950 border-2 border-purple-500/40 flex flex-col items-center justify-center shadow-2xl">
                  <span className="text-5xl">🔮</span>
                  <span className="text-xs font-bold text-purple-300 mt-2">
                    {isAm ? 'ካርድዎን ይሳቡ' : 'Draw Your Card'}
                  </span>
                </div>
                <button
                  onClick={drawTarot}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl transition shadow-lg shadow-purple-600/30"
                >
                  {isAm ? 'የዛሬውን ካርድ ይግለጡ' : "Reveal Today's Card"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-40 h-60 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-1 shadow-2xl">
                  <div className="w-full h-full bg-[#121316] rounded-xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-4xl mb-1">{drawnCard?.symbol}</span>
                    <div className="text-sm font-extrabold text-amber-400">{drawnCard?.title}</div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-1">{drawnCard?.keyword}</div>
                    <p className="text-[11px] text-slate-200 mt-3 italic">"{drawnCard?.quote}"</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveModal(null)}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl transition"
                >
                  {isAm ? 'የዛሬውን ብርታት ተቀበሉ' : "Embrace Today's Energy"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
