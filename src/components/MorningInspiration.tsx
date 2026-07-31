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

export interface InspirationQuote {
  id: string;
  quote: string;
  author: string;
  category: 'Focus' | 'Discipline' | 'Energy' | 'Peace' | 'Courage' | 'Gratitude';
  tagline?: string;
}

const CURATED_QUOTES: InspirationQuote[] = [
  {
    id: 'q1',
    quote: 'An early-morning walk is a blessing for the whole day.',
    author: 'Henry David Thoreau',
    category: 'Energy',
    tagline: 'Morning Blessing',
  },
  {
    id: 'q2',
    quote: 'Today is not just another day, but another possible chance to achieve what you couldn’t achieve yesterday.',
    author: 'Unknown',
    category: 'Focus',
    tagline: 'Fresh Start',
  },
  {
    id: 'q3',
    quote: 'Discipline is choosing between what you want now and what you want most.',
    author: 'Abraham Lincoln',
    category: 'Discipline',
    tagline: 'Unshakable Will',
  },
  {
    id: 'q4',
    quote: 'Morning is an important time of day, because how you spend your morning can often tell you what kind of day you are going to have.',
    author: 'Lemony Snicket',
    category: 'Focus',
    tagline: 'Daily Momentum',
  },
  {
    id: 'q5',
    quote: 'Write it on your heart that every day is the best day in the year.',
    author: 'Ralph Waldo Emerson',
    category: 'Gratitude',
    tagline: 'Mindful Optimism',
  },
  {
    id: 'q6',
    quote: 'The secret of getting ahead is getting started.',
    author: 'Mark Twain',
    category: 'Energy',
    tagline: 'Action First',
  },
  {
    id: 'q7',
    quote: 'Peace comes from within. Do not seek it without.',
    author: 'Buddha',
    category: 'Peace',
    tagline: 'Inner Harmony',
  },
  {
    id: 'q8',
    quote: 'Courage is resistance to fear, mastery of fear - not absence of fear.',
    author: 'Mark Twain',
    category: 'Courage',
    tagline: 'Bold Steps',
  },
  {
    id: 'q9',
    quote: 'Light tomorrow with today!',
    author: 'Elizabeth Barrett Browning',
    category: 'Energy',
    tagline: 'Ignite Potential',
  },
  {
    id: 'q10',
    quote: 'When you arise in the morning think of what a privilege it is to be alive, to think, to enjoy, to love.',
    author: 'Marcus Aurelius',
    category: 'Gratitude',
    tagline: 'Stoic Clarity',
  }
];

export const MorningInspiration: React.FC = () => {
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
    const textToCopy = `"${currentQuote.quote}" — ${currentQuote.author}`;
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

    const utterance = new SpeechSynthesisUtterance(`${currentQuote.quote}. By ${currentQuote.author}`);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div id="morning-inspiration-container" className="space-y-3 my-2">
      {/* Category Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-400">
          <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20 animate-spin-slow" />
          <span className="uppercase tracking-wider font-extrabold text-[11px]">
            Morning Inspiration
          </span>
          <span className="text-slate-500 font-normal text-[10px]">• {formattedDate}</span>
        </div>

        {favorites.length > 0 && (
          <button
            onClick={() => setShowFavoritesModal(true)}
            className="text-[11px] font-bold text-slate-400 hover:text-amber-400 flex items-center space-x-1 transition"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved ({favorites.length})</span>
          </button>
        )}
      </div>

      {/* Main Inspiration Quote Card */}
      <div className="bg-gradient-to-br from-[#1c1d24] via-[#18191d] to-[#121316] border border-amber-500/20 rounded-3xl p-5 shadow-2xl relative overflow-hidden group">
        {/* Subtle Ambient Background Accent */}
        <div className="absolute -right-12 -bottom-12 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -top-12 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Tag & Actions */}
        <div className="flex items-center justify-between relative z-10 mb-3">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>{currentQuote.tagline || currentQuote.category}</span>
          </div>

          <div className="flex items-center space-x-1">
            {/* Audio Speech Toggle */}
            <button
              onClick={handleSpeak}
              title="Listen to quote"
              className={`p-2 rounded-xl transition ${
                isSpeaking
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {isSpeaking ? <Volume2 className="w-4 h-4 animate-bounce" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Favorite Bookmark */}
            <button
              onClick={toggleFavorite}
              title="Favorite quote"
              className={`p-2 rounded-xl transition ${
                isCurrentFavorite
                  ? 'text-rose-500 bg-rose-500/10'
                  : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800/60'
              }`}
            >
              <Heart className={`w-4 h-4 ${isCurrentFavorite ? 'fill-current' : ''}`} />
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              title="Copy quote"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition relative"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Fetch Next Quote */}
            <button
              onClick={handleFetchNextQuote}
              title="Get another quote"
              className={`p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-xl transition ${
                isRefreshing ? 'animate-spin text-amber-400' : ''
              }`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quote Content Body */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuote.quote}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 relative z-10"
          >
            <div className="relative">
              <Quote className="w-8 h-8 text-amber-500/20 absolute -top-3 -left-2 rotate-180 pointer-events-none" />
              <p className="text-base font-bold text-slate-100 leading-relaxed pl-4 pr-1 italic tracking-wide">
                "{currentQuote.quote}"
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <div className="text-xs font-black text-amber-400 tracking-wide flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>{currentQuote.author}</span>
              </div>

              <div className="text-[10px] text-slate-500 font-mono">
                {currentQuote.category} Mode
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Category Selector Chips */}
        <div className="flex space-x-1.5 overflow-x-auto pt-3 mt-2 border-t border-slate-800/60 scrollbar-none text-center">
          {['ALL', 'Energy', 'Focus', 'Discipline', 'Peace', 'Gratitude'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition shrink-0 ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {cat === 'ALL' ? '✨ All Topics' : cat}
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
                  <span>Favorite Quotes ({favorites.length})</span>
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
                  No saved quotes yet. Click the heart icon on any quote to bookmark it!
                </p>
              ) : (
                <div className="space-y-3">
                  {favorites.map((fq, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 relative"
                    >
                      <p className="text-xs font-semibold text-slate-200 italic">
                        "{fq.quote}"
                      </p>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-amber-400">— {fq.author}</span>
                        <button
                          onClick={() => setFavorites((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-rose-400 transition"
                        >
                          Remove
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
