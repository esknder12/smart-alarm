import type { Alarm, ChallengeType } from '../types';

export const MAX_BARCODE_VALUE_LENGTH = 2048;

export interface MathProblem {
  question: string;
  answer: number;
}

export type MotionSample = {
  x: number;
  y: number;
  z: number;
  /** True when the sample is linear acceleration rather than gravity-inclusive. */
  linear?: boolean;
};

/**
 * Keep the exact text returned by the camera: leading zeroes are meaningful in product barcodes.
 * Whitespace around QR payloads is the only thing we ignore.
 */
export function normalizeBarcodeValue(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function barcodeMatches(scannedValue: string, expectedValue?: string | null): boolean {
  const scanned = normalizeBarcodeValue(scannedValue);
  const expected = normalizeBarcodeValue(expectedValue);
  return scanned.length > 0 && (expected.length === 0 || scanned === expected);
}

export function getMathQuestionCount(config?: Alarm['challengeConfig']): number {
  const count = Number(config?.mathCount ?? 3);
  return Number.isFinite(count) ? Math.max(1, Math.min(5, Math.round(count))) : 3;
}

function randomInt(min: number, max: number, random: () => number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

/** Build a fresh, non-negative arithmetic problem without requiring a keyboard of symbols. */
export function createMathProblem(
  difficulty: Alarm['challengeDifficulty'] = 'easy',
  random: () => number = Math.random
): MathProblem {
  const roll = random();
  let a = 0;
  let b = 0;
  let operator = '+';

  if (difficulty === 'easy') {
    a = randomInt(12, 49, random);
    b = randomInt(8, 36, random);
    operator = roll < 0.72 ? '+' : '−';
  } else if (difficulty === 'medium') {
    if (roll < 0.28) {
      a = randomInt(3, 12, random);
      b = randomInt(3, 12, random);
      operator = '×';
    } else {
      a = randomInt(25, 89, random);
      b = randomInt(12, 59, random);
      operator = roll < 0.65 ? '+' : '−';
    }
  } else if (roll < 0.46) {
    a = randomInt(6, 18, random);
    b = randomInt(4, 14, random);
    operator = '×';
  } else {
    a = randomInt(60, 189, random);
    b = randomInt(25, 99, random);
    operator = roll < 0.74 ? '+' : '−';
  }

  if (operator === '−' && b > a) [a, b] = [b, a];
  const answer = operator === '+' ? a + b : operator === '−' ? a - b : a * b;
  return { question: `${a} ${operator} ${b}`, answer };
}

export type MotionMission = 'steps' | 'shake';

/**
 * Counts acceleration pulses with a refractory window so one physical step cannot be counted once
 * per sensor frame. Linear acceleration is preferred; gravity-inclusive samples use a gentle
 * moving baseline to separate hand movement from the static gravity vector.
 */
export class MotionPulseCounter {
  private baseline: number | null = null;
  private lastPulseAt = Number.NEGATIVE_INFINITY;
  private readonly threshold: number;
  private readonly refractoryMs: number;

  constructor(mission: MotionMission) {
    this.threshold = mission === 'steps' ? 1.15 : 3.4;
    this.refractoryMs = mission === 'steps' ? 360 : 190;
  }

  push(sample: MotionSample, timestamp: number): boolean {
    if (![sample.x, sample.y, sample.z, timestamp].every(Number.isFinite)) return false;
    const magnitude = Math.hypot(sample.x, sample.y, sample.z);
    if (!Number.isFinite(magnitude)) return false;

    let pulse: number;
    if (sample.linear) {
      // Linear acceleration should sit near zero while the phone is still.
      pulse = magnitude;
    } else {
      if (this.baseline === null) {
        this.baseline = magnitude;
        return false;
      }
      this.baseline += (magnitude - this.baseline) * 0.12;
      pulse = Math.abs(magnitude - this.baseline);
    }

    if (pulse < this.threshold || timestamp - this.lastPulseAt < this.refractoryMs) return false;
    this.lastPulseAt = timestamp;
    return true;
  }
}

/** A slow, upright → lowered → upright device tilt is used as a rough squat-rep signal. */
export class SquatMotionCounter {
  private phase: 'upright' | 'lowered' = 'upright';
  private loweredAt = 0;

  constructor(private readonly uprightBeta: number) {}

  push(beta: number, timestamp: number): boolean {
    if (!Number.isFinite(beta) || !Number.isFinite(timestamp)) return false;
    const signedDelta = ((((beta - this.uprightBeta) % 360) + 540) % 360) - 180;
    const delta = Math.abs(signedDelta);
    if (this.phase === 'upright' && delta >= 22) {
      this.phase = 'lowered';
      this.loweredAt = timestamp;
      return false;
    }
    if (this.phase === 'lowered' && delta <= 10 && timestamp - this.loweredAt >= 500) {
      this.phase = 'upright';
      return true;
    }
    return false;
  }
}

export function isOutOfBedMission(challenge: ChallengeType): boolean {
  return challenge === 'barcode' || challenge === 'combo' || challenge === 'steps' || challenge === 'squat';
}

export function getMissionDisplayName(challenge: ChallengeType, language: 'en' | 'am' = 'en'): string {
  const names: Record<string, [string, string]> = {
    none: ['No mission', 'ምንም ተልዕኮ የለም'],
    barcode: ['Scan your saved item', 'የተቀመጠውን እቃ ይቃኙ'],
    combo: ['Out-of-bed gauntlet', 'ከአልጋ የመነሳት ፈተና'],
    steps: ['Walk it off', 'በእርምጃ ይንቁ'],
    squat: ['Movement reps', 'የእንቅስቃሴ ድግግሞሽ'],
    shake: ['Shake to wake', 'ስልኩን ያናውጡ'],
    math: ['Quick brain warm-up', 'የአእምሮ ማሞቂያ'],
    memory: ['Memory sequence', 'የትውስታ ቅደም ተከተል'],
    tiles: ['Memory sequence', 'የትውስታ ቅደም ተከተል'],
    typing: ['Morning affirmation', 'የጠዋት ማበረታቻ'],
    photo: ['Live photo check', 'የቀጥታ ፎቶ ማረጋገጫ'],
  };
  const pair = names[challenge] ?? ['Wake-up mission', 'የመንቂያ ተልዕኮ'];
  return language === 'am' ? pair[1] : pair[0];
}
