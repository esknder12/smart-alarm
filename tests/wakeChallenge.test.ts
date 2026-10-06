import {
  barcodeMatches,
  createMathProblem,
  getMathQuestionCount,
  isOutOfBedMission,
  MotionPulseCounter,
  normalizeBarcodeValue,
  SquatMotionCounter,
} from '../src/utils/wakeChallenge';

const results: Array<[string, boolean, string]> = [];
const check = (name: string, ok: boolean, info = '') => results.push([name, ok, info]);

check('barcode normalization trims whitespace but keeps leading zeroes', normalizeBarcodeValue(' 0012345678905 ') === '0012345678905');
check('barcode target must match exactly', barcodeMatches('0012345678905', '0012345678905') && !barcodeMatches('12345678905', '0012345678905'));
check('legacy barcode mission can accept a scan without a saved target', barcodeMatches('https://niqu.app/wake', ''));
check('empty scan cannot pass a barcode mission', !barcodeMatches('   ', undefined));

const easy = createMathProblem('easy', () => 0.5);
check('math problem has a correct numeric answer', Number.isFinite(easy.answer) && easy.question.length > 0);
const medium = createMathProblem('medium', () => 0.1);
check('medium math can create a multiplication warm-up', medium.question.includes('×') && medium.answer > 0);
check('question count is clamped to one through five', getMathQuestionCount({ mathCount: 99 }) === 5 && getMathQuestionCount({ mathCount: -4 }) === 1);
check('default math streak has three consecutive questions', getMathQuestionCount() === 3);

const steps = new MotionPulseCounter('steps');
check('step detector ignores a small stationary sample', !steps.push({ x: 0.1, y: 0, z: 0, linear: true }, 100));
check('step detector counts a motion pulse', steps.push({ x: 1.5, y: 0, z: 0, linear: true }, 500));
check('step detector debounces sensor frames from one pulse', !steps.push({ x: 1.8, y: 0, z: 0, linear: true }, 620));
check('step detector counts the next physically separated pulse', steps.push({ x: 1.4, y: 0, z: 0, linear: true }, 900));

const shakes = new MotionPulseCounter('shake');
check('shake detector requires a clear acceleration', !shakes.push({ x: 3, y: 0, z: 0, linear: true }, 100));
check('shake detector counts stronger movement', shakes.push({ x: 3.6, y: 0, z: 0, linear: true }, 400));

const gravitySteps = new MotionPulseCounter('steps');
check('gravity-inclusive sensor establishes a still baseline', !gravitySteps.push({ x: 0, y: 0, z: 9.8 }, 100));
check('gravity-inclusive sensor detects change from baseline', gravitySteps.push({ x: 0, y: 0, z: 11.5 }, 500));

const squat = new SquatMotionCounter(0);
check('squat tilt enters lowered phase', !squat.push(25, 1000));
check('squat detector rejects an implausibly fast return', !squat.push(0, 1200));
check('squat detector counts a complete slow down-and-up tilt', squat.push(0, 1600));
const wrappedSquat = new SquatMotionCounter(175);
check('squat tilt correctly wraps across the orientation angle boundary', !wrappedSquat.push(-160, 1000) && wrappedSquat.push(176, 1600));
check('barcode, gauntlet, step walk and movement reps are no-snooze missions', isOutOfBedMission('barcode') && isOutOfBedMission('combo') && isOutOfBedMission('steps') && isOutOfBedMission('squat') && !isOutOfBedMission('math'));

let passed = 0;
for (const [name, ok, info] of results) {
  if (ok) passed++;
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${info ? `  (${info})` : ''}`);
}
console.log(`\n${passed}/${results.length} wake-challenge checks passed`);
if (passed !== results.length) process.exit(1);
