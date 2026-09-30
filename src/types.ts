export type TabType = 'alarm' | 'sleep' | 'morning' | 'settings';

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

export type SoundCategory = 'Trending' | 'Motivational' | 'Loud' | 'Scenery' | 'Other';

export type SoundType =
  | 'goodmorning'
  | 'lazy'
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
  | 'nuclear'
  | 'airhorn'
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
  | 'marimba';

export interface RingtoneOption {
  id: SoundType;
  title: string;
  subtitle: string;
  category: SoundCategory;
  emoji: string;
}

export const RINGTONES_CATALOG: RingtoneOption[] = [
  // Trending
  { id: 'goodmorning', title: 'Gooooood Morninggggg', subtitle: 'Upbeat Morning Fanfare', category: 'Trending', emoji: '🗣️' },
  { id: 'lazy', title: 'Wake Up You Lazy', subtitle: 'Deep Rhythmic Pulse', category: 'Trending', emoji: '😴' },
  { id: 'capybara', title: 'Capybara Sunrise Beat', subtitle: 'Trending Chill Groove', category: 'Trending', emoji: '🦫' },
  { id: 'catmeow', title: 'Kiwi Cat Meow Beat', subtitle: 'Playful Rhythmic Chime', category: 'Trending', emoji: '🐱' },

  // Motivational
  { id: 'speech', title: 'Motivational Speech', subtitle: 'Heavy Brass Fanfare', category: 'Motivational', emoji: '🎙️' },
  { id: 'stickplan', title: 'Stick To The Plan', subtitle: 'Urgent Uplifting March', category: 'Motivational', emoji: '✊' },
  { id: 'sunrise', title: 'Inspirational Sunrise', subtitle: 'Warm Inspiring Chords', category: 'Motivational', emoji: '🌅' },
  { id: 'piano', title: 'Inspiring Piano', subtitle: 'Lyrical Uplifting Harmony', category: 'Motivational', emoji: '🎹' },

  // Loud & Hard Ringtones
  { id: 'nuclear', title: 'Nuclear Warning Siren', subtitle: 'Maximum Decibel Dual Sawtooth Wail', category: 'Loud', emoji: '⚠️' },
  { id: 'airhorn', title: 'Stadium Blast Airhorn', subtitle: 'Ultra Heavy Triple Piercing Blast', category: 'Loud', emoji: '📢' },
  { id: 'metal', title: 'Heavy Metal Thrash', subtitle: 'Hard Distorted Sub-Bass Pulse', category: 'Loud', emoji: '⚡' },
  { id: 'foghorn', title: 'Titanic Deep Foghorn', subtitle: 'Ultra Deep Resonant Brass Roar', category: 'Loud', emoji: '🚢' },
  { id: 'thunder', title: 'Extreme Air Raid Siren', subtitle: 'High Frequency Strobe Alarm', category: 'Loud', emoji: '💥' },
  { id: 'radar', title: 'Urgent Radar Horn', subtitle: 'Rapid High-Frequency Alert', category: 'Loud', emoji: '🚨' },
  { id: 'digital', title: 'First of the Month Beats', subtitle: 'High Power Digital Pulse', category: 'Loud', emoji: '🔊' },
  { id: 'police', title: 'Extreme Siren Alarm', subtitle: 'Maximum Intensity Alert', category: 'Loud', emoji: '🚓' },
  { id: 'horn', title: 'Loud Heavy Horn', subtitle: 'Deep Punchy Brass Sweep', category: 'Loud', emoji: '📯' },

  // Scenery
  { id: 'nature', title: 'Forest Birds & Stream', subtitle: 'Nature Birds Chirping', category: 'Scenery', emoji: '🌲' },
  { id: 'breeze', title: 'Morning Breeze Chimes', subtitle: 'Soft Wind & Bell Tones', category: 'Scenery', emoji: '🍃' },
  { id: 'space', title: 'Cosmic Space Nebula', subtitle: 'Deep Ambient Outer Space', category: 'Scenery', emoji: '🪐' },
  { id: 'ocean', title: 'Ocean Waves Wake', subtitle: 'Rhythmic Wave Swells', category: 'Scenery', emoji: '🌊' },

  // Other
  { id: 'chime', title: 'Classic Bell Cascade', subtitle: 'Traditional Bright Chime', category: 'Other', emoji: '🔔' },
  { id: 'retro', title: '8-Bit Retro Arcade', subtitle: 'Nostalgic Game Beeps', category: 'Other', emoji: '👾' },
  { id: 'guitar', title: 'Soft Acoustic Strum', subtitle: 'Gentle Wooden Strings', category: 'Other', emoji: '🎸' },
  { id: 'marimba', title: 'Marimba Morning Dance', subtitle: 'Warm Wooden Percussion', category: 'Other', emoji: '🪵' },
];

export type ChallengeType = 'none' | 'math' | 'typing' | 'memory' | 'shake' | 'tiles';

export type WallpaperId = 'default' | 'capybara' | 'motivation' | 'space' | 'cat' | 'nature';

export interface WallpaperOption {
  id: WallpaperId;
  name: string;
  category: 'Trending' | 'Daily Motivation' | 'Into Space';
  bgGradient: string;
  imageTag?: string;
  quote?: string;
}

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
  challenge: ChallengeType;
  challengeDifficulty: 'easy' | 'medium' | 'hard';
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
