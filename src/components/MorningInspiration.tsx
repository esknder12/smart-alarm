import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Quote,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Heart,
  Volume2,
  VolumeX,
  Share2,
  Bookmark,
  Sun,
  Flame,
  Feather,
  Compass,
  X
} from 'lucide-react';

import { Language } from '../utils/translations';

export interface InspirationQuote {
  id: string;
  quote: string;
  quoteAm?: string;
  author: string;
  category: 'Focus' | 'Discipline' | 'Energy' | 'Peace' | 'Courage' | 'Gratitude';
  tagline?: string;
  taglineAm?: string;
}

const CURATED_QUOTES: InspirationQuote[] = [
  {
    id: 'q1',
    quote: 'An early-morning walk is a blessing for the whole day.',
    quoteAm: 'በጠዋት የእግር ጉዞ ሙሉ ቀኑን የተባረከ ያደርገዋል።',
    author: 'Henry David Thoreau',
    category: 'Energy',
    tagline: 'Morning Blessing',
    taglineAm: 'የጠዋት ምርቃት',
  },
  {
    id: 'q2',
    quote: 'Today is not just another day, but another possible chance to achieve what you couldn’t achieve yesterday.',
    quoteAm: 'ዛሬ ሌላ ተራ ቀን አይደለም፤ ትናንት ያላሳኩትን ለማሳካት አዲስ አጋጣሚ ነው።',
    author: 'Unknown',
    category: 'Focus',
    tagline: 'Fresh Start',
    taglineAm: 'አዲስ ጅምር',
  },
  {
    id: 'q3',
    quote: 'Discipline is choosing between what you want now and what you want most.',
    quoteAm: 'ዲስፕሊን ማለት አሁን ከሚፈልጉት እና አብልጠው ከሚፈልጉት መካከል መምረጥ ነው።',
    author: 'Abraham Lincoln',
    category: 'Discipline',
    tagline: 'Unshakable Will',
    taglineAm: 'የማይወላወል ፍላጎት',
  },
  {
    id: 'q4',
    quote: 'Morning is an important time of day, because how you spend your morning can often tell you what kind of day you are going to have.',
    quoteAm: 'ጠዋት የቀኑ ወሳኝ ጊዜ ነው፤ ምክንያቱም ጠዋትን እንዴት እንደሚያሳልፉ የቀንዎን አቅጣጫ ይወስናል።',
    author: 'Lemony Snicket',
    category: 'Focus',
    tagline: 'Daily Momentum',
    taglineAm: 'የዕለት ተዕለት ኃይል',
  },
  {
    id: 'q5',
    quote: 'Write it on your heart that every day is the best day in the year.',
    quoteAm: 'እያንዳንዱ ቀን በዓመቱ ውስጥ ምርጥ ቀን እንደሆነ በልብዎ ይፃፉ።',
    author: 'Ralph Waldo Emerson',
    category: 'Gratitude',
    tagline: 'Mindful Optimism',
    taglineAm: 'በጎ አመለካከት',
  },
  {
    id: 'q6',
    quote: 'The secret of getting ahead is getting started.',
    quoteAm: 'ወደፊት የመራመድ ሚስጥሩ ዛሬ መጀመር ነው።',
    author: 'Mark Twain',
    category: 'Energy',
    tagline: 'Action First',
    taglineAm: 'ቀዳሚ ተግባር',
  },
  {
    id: 'q7',
    quote: 'Peace comes from within. Do not seek it without.',
    quoteAm: 'ሰላም ከውስጥ የሚመጣ ነው፤ ከውጭ አትፈልገው።',
    author: 'Buddha',
    category: 'Peace',
    tagline: 'Inner Harmony',
    taglineAm: 'የውስጥ ሰላም',
  },
  {
    id: 'q8',
    quote: 'Courage is resistance to fear, mastery of fear - not absence of fear.',
    quoteAm: 'ጀግንነት ፍርሃትን ማሸነፍ ነው እንጂ ፍርሃት አለመኖር አይደለም።',
    author: 'Mark Twain',
    category: 'Courage',
    tagline: 'Bold Steps',
    taglineAm: 'ደፋር እርምጃ',
  },
  {
    id: 'q9',
    quote: 'Light tomorrow with today!',
    quoteAm: 'የነገውን ብርሃን በዛሬው ስራዎ ያብሩት!',
    author: 'Elizabeth Barrett Browning',
    category: 'Energy',
    tagline: 'Ignite Potential',
    taglineAm: 'ችሎታዎን ያውጡ',
  },
  {
    id: 'q10',
    quote: 'When you arise in the morning think of what a privilege it is to be alive, to think, to enjoy, to love.',
    quoteAm: 'በጠዋት ሲነቁ በሕይወት መኖር፣ ማሰብ፣ መደሰት እና መውደድ ምን ያህል ታላቅ እድል እንደሆነ ያስቡ።',
    author: 'Marcus Aurelius',
    category: 'Gratitude',
    tagline: 'Stoic Clarity',
    taglineAm: 'ጥልቅ ጥበብ',
  }
];

interface MorningInspirationProps {
  language?: Language;
}

export const MorningInspiration: React.FC<MorningInspirationProps> = ({ language = 'en' }) => {
  const isAm = language === 'am';

  // Deterministic quote calculation based on date
  const getDailyIndex = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    return dayOfYear % CURATED_QUOTES.length;
  };

  const [currentQuote, setCurrentQuote] = useState<InspirationQuote>(
    CURATED_QUOTES[getDailyIndex()]
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<InspirationQuote[]>(() => {
    try {
      const saved = localStorage.getItem('wakeup_favorite_quotes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showFavoritesModal, setShowFavoritesModal] = useState<boolean>(false);

  // Sync favorites with localStorage
  useEffect(() => {
    localStorage.setItem('wakeup_favorite_quotes', JSON.stringify(favorites));
  }, [favorites]);

  const isCurrentFavorite = favorites.some((q) => q.id === currentQuote.id || q.quote === currentQuote.quote);

  const toggleFavorite = () => {
    if (isCurrentFavorite) {
      setFavorites((prev) => prev.filter((q) => q.quote !== currentQuote.quote));
    } else {
      setFavorites((prev) => [currentQuote, ...prev]);
    }
  };

  // Get Next Random or Filtered Quote
  const handleFetchNextQuote = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      let pool = CURATED_QUOTES;
      if (selectedCategory !== 'ALL') {
        pool = CURATED_QUOTES.filter((q) => q.category === selectedCategory);
      }
      if (pool.length === 0) pool = CURATED_QUOTES;

      let nextIndex = Math.floor(Math.random() * pool.length);
      // Ensure we pick a different quote if pool > 1
      if (pool.length > 1 && pool[nextIndex].quote === currentQuote.quote) {
        nextIndex = (nextIndex + 1) % pool.length;
      }

      setCurrentQuote(pool[nextIndex]);
      setIsRefreshing(false);
    }, 300);
  };

  // Copy to clipboard
  const handleCopy = () => {
    const textToCopy = `"${isAm && currentQuote.quoteAm ? currentQuote.quoteAm : currentQuote.quote}" — ${currentQuote.author}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Read quote aloud using Web Speech API
  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = isAm && currentQuote.quoteAm ? currentQuote.quoteAm : currentQuote.quote;
    const utterance = new SpeechSynthesisUtterance(`${textToSpeak}. ${isAm ? 'በ' : 'By'} ${currentQuote.author}`);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const getCategoryLabel = (cat: string) => {
    if (!isAm) return cat === 'ALL' ? 'All' : cat;
    switch (cat) {
      case 'ALL': return 'ሁሉም';
      case 'Energy': return 'ጉልበት';
      case 'Focus': return 'ትኩረት';
      case 'Discipline': return 'ዲስፕሊን';
      case 'Peace': return 'ሰላም';
      case 'Gratitude': return 'ምስጋና';
      default: return cat;
    }
  };

  const quoteText = isAm && currentQuote.quoteAm ? currentQuote.quoteAm : currentQuote.quote;
  const taglineText = isAm && currentQuote.taglineAm ? currentQuote.taglineAm : (currentQuote.tagline || currentQuote.category);

  return (
    <div id="morning-inspiration-container" className="my-1">
      {/* Compact Minimized Inspiration Quote Banner */}
      <div className="bg-[#18191d]/90 border border-slate-800/80 rounded-2xl p-3 shadow-md relative overflow-hidden group">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Quote text & Author */}
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400">
              <span className="flex items-center space-x-1 text-slate-300">
                <Sun className="w-3 h-3 text-white fill-white/20" />
                <span className="uppercase tracking-wider font-extrabold">
                  {isAm ? 'የማለዳ አነቃቂ አባባል' : 'Morning Inspiration'}
                </span>
              </span>
              <span>•</span>
              <span className="text-slate-400 font-medium">{taglineText}</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={quoteText}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.15 }}
                className="flex items-baseline space-x-2 flex-wrap"
              >
                <p className="text-xs font-semibold text-slate-200 italic leading-snug">
                  "{quoteText}"
                </p>
                <span className="text-[11px] font-extrabold text-amber-400 whitespace-nowrap">
                  — {currentQuote.author}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: Compact Actions */}
          <div className="flex items-center space-x-0.5 shrink-0">
            <button
              onClick={handleSpeak}
              title={isAm ? 'አባባሉን አዳምጥ' : 'Listen to quote'}
              className={`p-1.5 rounded-lg transition ${
                isSpeaking ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={toggleFavorite}
              title={isAm ? 'አባባሉን ወደ ተወደዱ መዝግብ' : 'Favorite quote'}
              className={`p-1.5 rounded-lg transition ${
                isCurrentFavorite ? 'text-rose-500 bg-rose-500/10' : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isCurrentFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleFetchNextQuote}
              title={isAm ? 'ቀጣይ አባባል' : 'Next quote'}
              className={`p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition ${
                isRefreshing ? 'animate-spin text-amber-400' : ''
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {favorites.length > 0 && (
              <button
                onClick={() => setShowFavoritesModal(true)}
                title={isAm ? 'የተቀመጡ አባባሎችን ተመልከት' : 'View saved quotes'}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition text-[10px] font-bold flex items-center space-x-1"
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Minimal Topic Pills */}
        <div className="flex space-x-1 overflow-x-auto pt-2 mt-2 border-t border-slate-800/50 scrollbar-none">
          {['ALL', 'Energy', 'Focus', 'Discipline', 'Peace', 'Gratitude'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition shrink-0 ${
                selectedCategory === cat
                  ? 'bg-slate-700 text-white font-black'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Saved Favorites Modal */}
      <AnimatePresence>
        {showFavoritesModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-md w-full bg-[#18191d] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-white max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2 font-bold text-base text-amber-400">
                  <Bookmark className="w-5 h-5 fill-current" />
                  <span>
                    {isAm ? 'የተወደዱ አባባሎች' : 'Favorite Quotes'} ({favorites.length})
                  </span>
                </div>
                <button
                  onClick={() => setShowFavoritesModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {favorites.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  {isAm
                    ? 'ምንም የተቀመጡ አባባሎች የሉም።'
                    : 'No saved quotes yet. Click the heart icon on any quote to bookmark it!'}
                </p>
              ) : (
                <div className="space-y-3">
                  {favorites.map((fq, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 relative"
                    >
                      <p className="text-xs font-semibold text-slate-200 italic">
                        "{isAm && fq.quoteAm ? fq.quoteAm : fq.quote}"
                      </p>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-amber-400">— {fq.author}</span>
                        <button
                          onClick={() => setFavorites((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-rose-400 transition"
                        >
                          {isAm ? 'ሰርዝ' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
