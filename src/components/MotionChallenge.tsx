import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Footprints, LoaderCircle, RotateCcw, Smartphone } from 'lucide-react';
import type { Alarm } from '../types';
import { MotionPulseCounter, SquatMotionCounter } from '../utils/wakeChallenge';

export type MotionChallengeKind = 'steps' | 'shake' | 'squat';

interface MotionChallengeProps {
  kind: MotionChallengeKind;
  target: number;
  language?: 'en' | 'am';
  onComplete: () => void;
}

type PermissionState = 'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported';

/**
 * Sensor-backed wake-up task. It never substitutes button taps for sensor readings: if this
 * device/browser cannot provide motion data, the user gets an honest recovery message instead of
 * fake progress. On iOS the permission request is made directly from the Start button gesture.
 */
export const MotionChallenge: React.FC<MotionChallengeProps> = ({
  kind,
  target,
  language = 'en',
  onComplete,
}) => {
  const isAm = language === 'am';
  const [permissionState, setPermissionState] = useState<PermissionState>('idle');
  const [count, setCount] = useState(0);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [calibrated, setCalibrated] = useState(false);
  const [sensorReady, setSensorReady] = useState(false);
  const latestBetaRef = useRef<number | null>(null);
  const pulseCounterRef = useRef<MotionPulseCounter | null>(null);
  const squatCounterRef = useRef<SquatMotionCounter | null>(null);
  const completeRef = useRef(false);
  const targetCount = Number.isFinite(target) ? Math.max(1, Math.min(100, Math.round(target))) : 10;

  const requestSensorPermission = useCallback(async () => {
    if (permissionState === 'requesting' || permissionState === 'ready') return;
    setSensorError(null);
    setPermissionState('requesting');

    try {
      const motionApi = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      const orientationApi = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      const requiredSensorMissing = kind === 'squat'
        ? typeof window.DeviceOrientationEvent === 'undefined'
        : typeof window.DeviceMotionEvent === 'undefined';
      if (requiredSensorMissing) {
        setPermissionState('unsupported');
        setSensorError(isAm ? 'ይህ መሣሪያ የሚያስፈልገውን የእንቅስቃሴ ዳሳሽ አይሰጥም። ከአልጋ የሚያነሳ ሌላ ተልዕኮ ይምረጡ።' : 'This device exposes no compatible motion sensor. Choose a different mission that gets you out of bed.');
        return;
      }

      if (typeof motionApi?.requestPermission === 'function') {
        const permission = await motionApi.requestPermission();
        if (permission !== 'granted') throw new Error('PERMISSION_DENIED');
      }
      if (kind === 'squat' && typeof orientationApi?.requestPermission === 'function') {
        const permission = await orientationApi.requestPermission();
        if (permission !== 'granted') throw new Error('PERMISSION_DENIED');
      }
      setPermissionState('ready');
    } catch (error) {
      const denied = error instanceof Error && error.message === 'PERMISSION_DENIED';
      setPermissionState(denied ? 'denied' : 'unsupported');
      setSensorError(denied
        ? (isAm ? 'የእንቅስቃሴ ፈቃድ አልተሰጠም። ፈቃዱን ከከፈቱ በኋላ ይህን ፈተና እንደገና ይጀምሩ።' : 'Motion access was denied. Allow motion access in your browser settings, then retry.')
        : (isAm ? 'ዳሳሹን ማግኘት አልተቻለም። የእንቅስቃሴ ተልዕኮ በሌላ መሣሪያ ሊሰራ ይችላል።' : 'Could not access the motion sensor. A different mission may work better on this device.'));
    }
  }, [isAm, kind, permissionState]);

  useEffect(() => {
    if (permissionState !== 'ready') return;
    setCount(0);
    setCalibrated(false);
    setSensorReady(false);
    completeRef.current = false;
    pulseCounterRef.current = kind === 'squat' ? null : new MotionPulseCounter(kind === 'steps' ? 'steps' : 'shake');

    const noSensorTimer = window.setTimeout(() => {
      setSensorReady((ready) => {
        if (ready) return ready;
        setSensorError(isAm ? 'ዳሳሽ ምልክት አልተገኘም። ስልኩን ይክፈቱት፣ ፈቃዱን ይመልከቱ እና እንደገና ይሞክሩ።' : 'No sensor readings yet. Wake the phone screen, check sensor permission, and retry.');
        return ready;
      });
    }, 5000);

    const onMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.acceleration;
      const gravity = event.accelerationIncludingGravity;
      const sample = acceleration && [acceleration.x, acceleration.y, acceleration.z].every((value) => typeof value === 'number')
        ? { x: acceleration.x ?? 0, y: acceleration.y ?? 0, z: acceleration.z ?? 0, linear: true }
        : gravity && [gravity.x, gravity.y, gravity.z].every((value) => typeof value === 'number')
          ? { x: gravity.x ?? 0, y: gravity.y ?? 0, z: gravity.z ?? 0 }
          : null;
      if (!sample) return;
      setSensorReady(true);
      setSensorError(null);
      const detector = pulseCounterRef.current;
      if (!detector) return;
      if (detector.push(sample, event.timeStamp || performance.now())) {
        setCount((current) => Math.min(targetCount, current + 1));
        if ('vibrate' in navigator) {
          try { navigator.vibrate(35); } catch { /* vibration is optional */ }
        }
      }
    };

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (typeof event.beta !== 'number') return;
      latestBetaRef.current = event.beta;
      setSensorReady(true);
      setSensorError(null);
      const detector = squatCounterRef.current;
      if (!detector || !calibrated) return;
      if (detector.push(event.beta, event.timeStamp || performance.now())) {
        setCount((current) => Math.min(targetCount, current + 1));
        if ('vibrate' in navigator) {
          try { navigator.vibrate([50, 30, 50]); } catch { /* vibration is optional */ }
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') return;
      setCount(0);
      setCalibrated(false);
      setPermissionState('idle');
    };

    window.addEventListener('devicemotion', onMotion, true);
    window.addEventListener('deviceorientation', onOrientation, true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(noSensorTimer);
      window.removeEventListener('devicemotion', onMotion, true);
      window.removeEventListener('deviceorientation', onOrientation, true);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [calibrated, isAm, kind, permissionState, targetCount]);

  useEffect(() => {
    if (count >= targetCount && !completeRef.current) {
      completeRef.current = true;
      onComplete();
    }
  }, [count, onComplete, targetCount]);

  const calibrateStanding = () => {
    const beta = latestBetaRef.current;
    if (beta === null) {
      setSensorError(isAm ? 'ዳሳሹ እስኪነቃ ይጠብቁ፤ ከዚያ እንደገና ይንኩ።' : 'Waiting for the orientation sensor. Try again in a moment.');
      return;
    }
    squatCounterRef.current = new SquatMotionCounter(beta);
    setSensorError(null);
    setCalibrated(true);
  };

  const title = kind === 'steps'
    ? (isAm ? 'ከአልጋ ውጭ ይራመዱ' : 'Walk away from bed')
    : kind === 'squat'
      ? (isAm ? 'የሰውነት እንቅስቃሴ' : 'Movement reps')
      : (isAm ? 'ስልክዎን ያናውጡ' : 'Shake the sleep off');
  const instruction = kind === 'steps'
    ? (isAm ? 'ስልኩን በእጅዎ ይያዙ እና ከአልጋ ርቀው ይራመዱ። የስልክ ዳሳሽ የእርምጃ ምቶችን ይቆጥራል።' : 'Hold your phone and walk away from the bed. The motion sensor counts step-like movement pulses; it is not a medical pedometer.')
    : kind === 'squat'
      ? (isAm ? 'ከአልጋ ተነስተው ስልኩን ከደረትዎ ጋር ይያዙ። ቆሞ እያሉ ያስተካክሉ፣ ከዚያ በቀስታ ወደ ታች እና ወደ ላይ ይንቀሳቀሱ።' : 'Get up first. Hold the phone against your chest, calibrate while standing, then move slowly down and back upright. This reads phone tilt—not exercise form.')
      : (isAm ? 'ስልኩን በእጅዎ ይያዙ እና በደህና በተቀመጡበት ቦታ ያናውጡት።' : 'Hold your phone securely and shake it in a clear, controlled motion. Keep it over a safe surface.');

  const progress = Math.min(100, Math.round((count / targetCount) * 100));

  return (
    <section className="space-y-4" aria-label={title}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-200">
          {kind === 'steps' ? <Footprints className="h-5 w-5" /> : kind === 'squat' ? <Activity className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
        </div>
        <div>
          <h3 className="font-extrabold text-white">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{instruction}</p>
        </div>
      </div>

      {permissionState === 'idle' || permissionState === 'requesting' || permissionState === 'denied' || permissionState === 'unsupported' ? (
        <button
          type="button"
          onClick={() => void requestSensorPermission()}
          disabled={permissionState === 'requesting'}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 font-extrabold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
        >
          {permissionState === 'requesting' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          {permissionState === 'requesting'
            ? (isAm ? 'ዳሳሽን በመክፈት ላይ…' : 'Starting motion sensor…')
            : (isAm ? 'ዳሳሽን አንቃ እና ጀምር' : 'Enable motion & start')}
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {isAm ? 'የዳሳሽ እንቅስቃሴ' : 'Sensor progress'}
              </p>
              <p aria-live="polite" className="mt-1 font-mono text-3xl font-black tabular-nums text-white">
                <span className="text-cyan-300">{count}</span><span className="text-slate-500"> / {targetCount}</span>
              </p>
            </div>
            <div className={`rounded-xl border px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide ${sensorReady ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
              {sensorReady ? (isAm ? 'ዳሳሽ ንቁ' : 'Sensor live') : (isAm ? 'ዳሳሽ በመፈለግ ላይ' : 'Waiting for sensor')}
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          {kind === 'squat' && (
            <button
              type="button"
              onClick={calibrateStanding}
              disabled={calibrated}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100 disabled:cursor-default disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              {calibrated ? (isAm ? 'በቆመ አቀማመጥ ተስተካክሏል' : 'Standing position calibrated') : (isAm ? 'ቆመው ሳሉ አስተካክል' : 'Calibrate while standing')}
            </button>
          )}
        </div>
      )}

      {sensorError && (
        <div className="space-y-2">
          <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs leading-relaxed text-rose-100">
            {sensorError}
          </p>
          {permissionState === 'ready' && (
            <button
              type="button"
              onClick={() => {
                setSensorError(null);
                setCount(0);
                setCalibrated(false);
                setPermissionState('idle');
              }}
              className="min-h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200"
            >
              {isAm ? 'ዳሳሹን እንደገና ሞክር' : 'Restart motion sensor'}
            </button>
          )}
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-slate-500">
        {isAm ? 'ምስል ወይም የአካባቢ መረጃ አይቀመጥም። ዳሳሹ በማያ ገጹ ላይ ሳለ ብቻ ይነበባል።' : 'No location or camera data is collected. Motion is read only while this alarm screen is open.'}
      </p>
    </section>
  );
};
