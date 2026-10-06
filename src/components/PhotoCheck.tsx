import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, LoaderCircle } from 'lucide-react';

interface PhotoCheckProps {
  target: string;
  language?: 'en' | 'am';
  onComplete: () => void;
}

/**
 * A privacy-first live photo check for legacy/custom photo missions. The frame is never uploaded
 * or stored. This is an accountability prompt only: without on-device vision, Niqu cannot verify
 * that the chosen location is actually in the picture, so barcode missions are stronger proof.
 */
export const PhotoCheck: React.FC<PhotoCheckProps> = ({ target, language = 'en', onComplete }) => {
  const isAm = language === 'am';
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const openCamera = async () => {
    if (busy || cameraOn) return;
    setBusy(true);
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!mountedRef.current || document.visibilityState !== 'visible') {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraOn(true);
    } catch (cause) {
      if (!mountedRef.current) return;
      const name = cause instanceof Error ? cause.name : '';
      setError(name === 'NotAllowedError'
        ? (isAm ? 'ካሜራ ፈቃድ አልተሰጠም።' : 'Camera access was denied. Allow it in Settings, then retry.')
        : (isAm ? 'ካሜራውን መክፈት አልተቻለም።' : 'Could not open a camera on this device.'));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError(isAm ? 'ካሜራው እስኪዘጋጅ ይጠብቁ።' : 'Wait for the camera preview to be ready, then try again.');
      return;
    }
    // Deliberately do not call toDataURL / store the canvas. The challenge only asks the user to
    // take a live, local snapshot and immediately discards the frame.
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      canvas.width = 0;
      canvas.height = 0;
      setError(isAm ? 'የፎቶ ማረጋገጫው አልተሳካም፤ እንደገና ይሞክሩ።' : 'Could not capture a frame. Try again.');
      return;
    }
    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch {
      canvas.width = 0;
      canvas.height = 0;
      setError(isAm ? 'ካሜራው እስኪዘጋጅ ይጠብቁ።' : 'Wait for the camera preview to be ready, then try again.');
      return;
    }
    canvas.width = 0;
    canvas.height = 0;
    stopCamera();
    onComplete();
  };

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOn]);

  useEffect(() => {
    mountedRef.current = true;
    const stopWhenHidden = () => {
      if (document.visibilityState === 'visible') return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraOn(false);
    };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', stopWhenHidden);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return (
    <section className="space-y-3" aria-label={isAm ? 'የቀጥታ ፎቶ ማረጋገጫ' : 'Live photo check'}>
      <div>
        <h3 className="font-extrabold text-white">{isAm ? `አሁን የ${target} ፎቶ ያንሱ` : `Take a live photo of ${target}`}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {isAm ? 'ከአልጋ ተነስተው የመረጡት ቦታ ይሂዱ። ምስሉ አይቀመጥም።' : 'Get up and go to your chosen spot. The image is discarded immediately. This is a self-check, not automatic image matching.'}
        </p>
      </div>

      {cameraOn && (
        <video ref={videoRef} autoPlay playsInline muted aria-label={isAm ? 'የካሜራ ቅድመ እይታ' : 'Camera preview'} className="h-52 w-full rounded-2xl bg-black object-cover" />
      )}
      {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-2.5 text-xs text-rose-100">{error}</p>}
      {cameraOn ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={stopCamera} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200">
            <CameraOff className="h-4 w-4" />{isAm ? 'ካሜራ ዝጋ' : 'Close camera'}
          </button>
          <button type="button" onClick={takePhoto} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-fuchsia-300 px-3 py-2 text-xs font-extrabold text-slate-950">
            <Camera className="h-4 w-4" />{isAm ? 'ፎቶ አንሳ እና ቀጥል' : 'Take photo & finish'}
          </button>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => void openCamera()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-300 px-4 py-3 text-sm font-extrabold text-slate-950 disabled:opacity-60">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {busy ? (isAm ? 'ካሜራው እየከፈተ ነው…' : 'Opening camera…') : (isAm ? 'ካሜራ ክፈት' : 'Open camera')}
        </button>
      )}
    </section>
  );
};
