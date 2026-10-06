export type TabType = 'alarm' | 'settings';

export interface PetState {
  name: string;
  level: number;
  xp: number;
  happiness: number; // 0 to 100
  stage: 'egg' | 'chick' | 'bird';
}

export interface MoodLog {
  id: string;
  date: string;
  feeling: 'great' | 'happy' | 'neutral' | 'tired' | 'groggy';
  note?: string;
}

export interface TarotCard {
  id: string;
  title: string;
  keyword: string;
  quote: string;
  symbol: string;
}

export type SoundCategory = 'Wake Up Voice' | 'Extreme Loud' | 'Viral & Trendy' | 'Motivational' | 'Scenery & Relax' | 'Custom Sounds' | 'Other';

export interface CustomSound {
  id: string;
  name: string;
  dataUrl: string;
  duration?: number;
  size?: number;
  createdAt: number;
}

export type SoundType =
  | 'wakeup_wakeup'
  | 'lazy'
  | 'lazy_alarm'
  | 'cockadoodledoo'
  | 'rise_shine'
  | 'are_you_sleeping'
  | 'end_of_world'
  | 'nuclear'
  | 'air_raid'
  | 'airhorn'
  | 'first_of_month'
  | 'goodmorning'
  | 'capybara'
  | 'catmeow'
  | 'speech'
  | 'stickplan'
  | 'sunrise'
  | 'piano'
  | 'radar'
  | 'digital'
  | 'police'
  | 'horn'
  | 'metal'
  | 'foghorn'
  | 'thunder'
  | 'nature'
  | 'breeze'
  | 'space'
  | 'ocean'
  | 'chime'
  | 'retro'
  | 'guitar'
  | 'marimba'
  | `custom_${string}`
  | (string & {});

export interface RingtoneOption {
  id: SoundType;
  title: string;
  subtitle: string;
  category: SoundCategory;
  emoji: string;
  badge?: string;
}

export const RINGTONES_CATALOG: RingtoneOption[] = [
  // Wake Up Voice (Iconic Alarmy Styles)
  { id: 'wakeup_wakeup', title: 'WAKE UP! WAKE UP!', subtitle: 'Official Alarmy Iconic Wake Up Call', category: 'Wake Up Voice', emoji: '🗣️', badge: '🔥 TOP TRENDING' },
  { id: 'cockadoodledoo', title: 'Cock-a-Doodle-Doo Rooster', subtitle: 'Loud Barnyard Morning Crow', category: 'Wake Up Voice', emoji: '🐓', badge: '⚡ VIRAL' },
  { id: 'lazy', title: 'Wake Up You Lazy!', subtitle: 'Insistent Vocal & Heavy Bass Pulse', category: 'Wake Up Voice', emoji: '😴', badge: '📢 BEST SELLER' },
  { id: 'rise_shine', title: 'Rise & Shine Mothertrucker', subtitle: 'High-Energy Funky Wake Up Brass', category: 'Wake Up Voice', emoji: '🎺', badge: '💥 LOUD' },
  { id: 'are_you_sleeping', title: 'Are You Still Sleeping?!', subtitle: 'Urgent Comedic Voice Alerts', category: 'Wake Up Voice', emoji: '👀' },
  { id: 'goodmorning', title: 'Gooooood Morninggggg', subtitle: 'Triumphant Morning Fanfare', category: 'Wake Up Voice', emoji: '☀️' },

  // Extreme Loud (Heavy Sleepers)
  { id: 'nuclear', title: 'Nuclear Warning Siren', subtitle: 'Dual Sawtooth Wail Max Decibel', category: 'Extreme Loud', emoji: '☢️', badge: '⚠️ NUCLEAR' },
  { id: 'air_raid', title: 'Extreme Air Raid Siren', subtitle: 'Emergency Strobe Oscillating Alarm', category: 'Extreme Loud', emoji: '🚨', badge: '🛑 MAX LOUD' },
  { id: 'airhorn', title: 'Stadium Blast Airhorn', subtitle: 'Triple Piercing Heavy Air Blast', category: 'Extreme Loud', emoji: '📢' },
  { id: 'end_of_world', title: 'End of the World Apocalypse', subtitle: 'Sub-Bass Doomsday Synth Scream', category: 'Extreme Loud', emoji: '💥' },
  { id: 'metal', title: 'Heavy Metal Thrash', subtitle: 'Distorted Metal Guitar & Sub-Kick', category: 'Extreme Loud', emoji: '⚡' },
  { id: 'police', title: 'Extreme Police Siren', subtitle: 'Urgent High-Low Patrol Wail', category: 'Extreme Loud', emoji: '🚓' },
  { id: 'foghorn', title: 'Titanic Deep Foghorn', subtitle: 'Sub-Sonic Resonant Ship Horn', category: 'Extreme Loud', emoji: '🚢' },

  // Viral & Trendy
  { id: 'capybara', title: 'Capybara Sunrise Groove', subtitle: 'Viral Chill Bouncy Synth-Pop', category: 'Viral & Trendy', emoji: '🦫', badge: '✨ VIRAL' },
  { id: 'catmeow', title: 'Kiwi Cat Meow Remix', subtitle: 'Playful Melodic Kitten Drop', category: 'Viral & Trendy', emoji: '🐱' },
  { id: 'first_of_month', title: 'First of the Month Drill Beat', subtitle: 'Trendy 808 Drill Trap Pulse', category: 'Viral & Trendy', emoji: '🔊' },
  { id: 'digital', title: '808 Digital Rhythm Alarm', subtitle: 'High Power Modern Sync Beat', category: 'Viral & Trendy', emoji: '🎛️' },
  { id: 'retro', title: '8-Bit Retro Arcade Hero', subtitle: 'Nostalgic High-Score Chiptune', category: 'Viral & Trendy', emoji: '👾' },

  // Motivational
  { id: 'speech', title: 'Motivational Champion Fanfare', subtitle: 'Cinematic Orchestral Victory', category: 'Motivational', emoji: '🎙️', badge: '🏆 FOCUS' },
  { id: 'stickplan', title: 'Stick To The Plan March', subtitle: 'Military Discipline Momentum', category: 'Motivational', emoji: '✊' },
  { id: 'sunrise', title: 'Inspirational Golden Sunrise', subtitle: 'Warm Soaring Harmony Chords', category: 'Motivational', emoji: '🌅' },
  { id: 'piano', title: 'Inspiring Classical Piano', subtitle: 'Lyrical Uplifting Acoustic Run', category: 'Motivational', emoji: '🎹' },

  // Scenery & Relax
  { id: 'nature', title: 'Forest Birds & Stream', subtitle: 'Natural Forest Morning Awakening', category: 'Scenery & Relax', emoji: '🌲' },
  { id: 'breeze', title: 'Morning Breeze Chimes', subtitle: 'Soft Wind Chimes & Glass Bells', category: 'Scenery & Relax', emoji: '🍃' },
  { id: 'space', title: 'Cosmic Space Harmony', subtitle: 'Deep Ambient Astral Soundscape', category: 'Scenery & Relax', emoji: '🪐' },
  { id: 'ocean', title: 'Ocean Waves Wake', subtitle: 'Rhythmic Coastal Swell', category: 'Scenery & Relax', emoji: '🌊' },
  { id: 'chime', title: 'Classic Bell Cascade', subtitle: 'Traditional Bright Crisp Chime', category: 'Scenery & Relax', emoji: '🔔' },
  { id: 'guitar', title: 'Soft Acoustic Strum', subtitle: 'Gentle Wooden Fingerpicking', category: 'Scenery & Relax', emoji: '🎸' },
  { id: 'marimba', title: 'Marimba Morning Dance', subtitle: 'Warm Tropical Wooden Percussion', category: 'Scenery & Relax', emoji: '🪵' },
];

export type ChallengeType =
  | 'none'
  | 'barcode'
  | 'photo'
  | 'squat'
  | 'steps'
  | 'math'
  | 'typing'
  | 'memory'
  | 'shake'
  | 'tiles'
  | 'combo';

export type WallpaperId =
  | 'wakeup_rage'
  | 'lazy_cat'
  | 'cockadoodle'
  | 'coffee_emergency'
  | 'bed_is_trap'
  | 'chill_capybara'
  | 'rise_and_grind'
  | 'nuclear_warning'
  | 'default'
  | 'capybara'
  | 'motivation'
  | 'space'
  | 'cat'
  | 'nature';

export interface WallpaperOption {
  id: WallpaperId;
  name: string;
  nameAm?: string;
  category: 'Wake Up Alarm' | 'Funny Meme' | 'Trending' | 'Daily Motivation';
  bgGradient: string;
  emoji: string;
  badge: string;
  quote: string;
  quoteAm?: string;
  soundMatchId?: SoundType;
}

export const WALLPAPERS_CATALOG: WallpaperOption[] = [
  {
    id: 'wakeup_rage',
    name: 'WAKE UP! WAKE UP!',
    nameAm: 'ንቃ! አሁኑኑ ንቃ!',
    category: 'Wake Up Alarm',
    bgGradient: 'from-rose-600 via-red-600 to-amber-500',
    emoji: '🚨',
    badge: '🔥 NO SNOOZE ALLOWED',
    quote: 'THIS IS NOT A DRILL! Get your body out of bed right now!',
    quoteAm: 'ይህ ማስመሰል አይደለም! አሁኑኑ ከአልጋዎ ይነሱ!',
    soundMatchId: 'wakeup_wakeup',
  },
  {
    id: 'lazy_cat',
    name: 'Five More Minutes? NO!',
    nameAm: 'ተጨማሪ 5 ደቂቃ? ፈጽሞ!',
    category: 'Funny Meme',
    bgGradient: 'from-purple-900 via-violet-700 to-pink-500',
    emoji: '😼',
    badge: '🛑 TRAP DETECTED',
    quote: 'The blankets are lying to you. Wake up before the cat judges you!',
    quoteAm: 'ሞቃታማው ብርድ ልብስ እያታለለዎት ነው። ወጥመዱን አትመኑ!',
    soundMatchId: 'catmeow',
  },
  {
    id: 'cockadoodle',
    name: 'Screaming Rooster Call',
    nameAm: 'የማለዳ ዶሮ ጩኸት',
    category: 'Funny Meme',
    bgGradient: 'from-amber-600 via-orange-600 to-red-600',
    emoji: '🐓',
    badge: '☀️ SUN IS ALREADY UP',
    quote: 'Cock-a-doodle-doo! Even the rooster is wondering why you are still in bed!',
    quoteAm: 'ኩኩሉኩኩ! ዶሮውም እንኳ አልጋ ላይ በመቆየትዎ ተገርሟል!',
    soundMatchId: 'cockadoodledoo',
  },
  {
    id: 'coffee_emergency',
    name: 'Code Red: Needs Coffee',
    nameAm: 'አስቸኳይ ቡና ያስፈልጋል',
    category: 'Wake Up Alarm',
    bgGradient: 'from-amber-950 via-yellow-800 to-amber-600',
    emoji: '☕',
    badge: '⚡ CAFFEINE CODE RED',
    quote: 'Coffee is brewing, greatness is waiting. Open your eyes!',
    quoteAm: 'ቡናው እየፈላ ነው፣ ታላቅነት እየጠበቀዎት ነው። አይንዎን ይክፈቱ!',
    soundMatchId: 'lazy',
  },
  {
    id: 'bed_is_trap',
    name: 'The Bed Is Lava!',
    nameAm: 'አልጋው እሳት ነው!',
    category: 'Funny Meme',
    bgGradient: 'from-red-950 via-red-800 to-orange-600',
    emoji: '🌋',
    badge: '⚠️ EVACUATE IMMEDIATELY',
    quote: 'Staying in bed burns your dreams. Launch yourself out!',
    quoteAm: 'አልጋ ላይ መቆየት ህልምዎን ያቃጥላል። ወዲያውኑ ይዝለሉ!',
    soundMatchId: 'end_of_world',
  },
  {
    id: 'chill_capybara',
    name: 'Capybara Zen Sunrise',
    nameAm: 'የካፒባራ ረጋ ያለ ጀምበር',
    category: 'Trending',
    bgGradient: 'from-teal-950 via-cyan-900 to-emerald-600',
    emoji: '🦫',
    badge: '✨ UNBOTHERED & AWAKE',
    quote: 'Be like the capybara: calm, cool, and already out of bed.',
    quoteAm: 'እንደ ካፒባራ ይሁኑ፡ በማለዳ በሰላም እና በረጋ መንፈስ ይንቁ።',
    soundMatchId: 'capybara',
  },
  {
    id: 'rise_and_grind',
    name: 'Rise & Grind Rocket',
    nameAm: 'የስኬት ጉዞ ሮኬት',
    category: 'Daily Motivation',
    bgGradient: 'from-slate-950 via-indigo-950 to-sky-500',
    emoji: '🚀',
    badge: '🏆 1% MORNING CLUB',
    quote: 'Future champions do not press snooze. Conquer your day!',
    quoteAm: 'የነገ ባለስኬቶች አሸልበው አይተኙም። ቀንዎን በድል ይጀምሩ!',
    soundMatchId: 'speech',
  },
  {
    id: 'nuclear_warning',
    name: 'DEFCON 1: Biohazard Alarm',
    nameAm: 'ደረጃ 1፡ የኒውክሌር ማንቂያ',
    category: 'Wake Up Alarm',
    bgGradient: 'from-lime-950 via-emerald-950 to-yellow-600',
    emoji: '☢️',
    badge: '☣️ DEFCON 1 PROTOCOL',
    quote: 'Critical sleep override active. Mission: Dismiss alarm now!',
    quoteAm: 'ከፍተኛ ማንቂያ ተነስቷል፡ አሁኑኑ ከአልጋ የመነሳት ፕሮቶኮል!',
    soundMatchId: 'nuclear',
  },
  {
    id: 'default',
    name: 'Cosmic Awakening Horizon',
    nameAm: 'ጥልቅ ጠፈር ጽልመት',
    category: 'Daily Motivation',
    bgGradient: 'from-slate-950 via-purple-950 to-slate-900',
    emoji: '🌌',
    badge: '🪐 INFINITE HORIZON',
    quote: 'Small morning disciplines yield extraordinary lifelong victories.',
    quoteAm: 'ትናንሽ የጠዋት ልማዶች ታላቅ የህይወት ውጤት ያመጣሉ።',
    soundMatchId: 'sunrise',
  },
];

export interface Alarm {
  id: string;
  time: string; // HH:mm format in 24h
  label: string;
  enabled: boolean;
  repeatDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  sound: SoundType;
  volume: number; // 0 to 100
  gentleWakeUp?: boolean; // Gradually increase volume
  wallpaper?: WallpaperId;
  snoozeCount: number;
  snoozeInterval?: number; // e.g. 1, 3, 5, 10, 15, 20, 25, 30 min (default 5)
  snoozeLimit?: number; // e.g. 1, 2, 3, 5, 10, 99=unlimited (default 3)
  challenge: ChallengeType;
  challengeDifficulty: 'easy' | 'medium' | 'hard';
  challengeConfig?: {
    /** Exact barcode / QR payload saved before bed; compared locally when the alarm rings. */
    barcodeValue?: string;
    barcodeTarget?: string;
    targetSquats?: number;
    targetSteps?: number;
    photoTarget?: string;
    mathCount?: number;
  };
}

export interface RoutineStep {
  id: string;
  title: string;
  durationMinutes: number;
  completed: boolean;
  category: 'mind' | 'body' | 'fuel' | 'prep';
  notes?: string;
}

export interface WakeLog {
  id: string;
  date: string; // YYYY-MM-DD
  wakeTime: string; // HH:mm
  targetTime: string; // HH:mm
  feeling: 'energetic' | 'refreshed' | 'tired' | 'groggy';
  onTime: boolean;
  routineCompletedPct: number;
}

export interface AmbientSound {
  id: string;
  name: string;
  iconName: string;
  type: 'rain' | 'waves' | 'forest' | 'whitenoise' | 'binaural';
  isPlaying: boolean;
  volume: number;
}
