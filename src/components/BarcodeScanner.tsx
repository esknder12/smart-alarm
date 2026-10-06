import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, LoaderCircle, ScanLine } from 'lucide-react';

export interface BarcodeScannerProps {
  onScan: (value: string) => void;
  language?: 'en' | 'am';
  title?: string;
  description?: string;
  buttonLabel?: string;
  className?: string;
  /** Render the scanner immediately instead of showing the start-camera button first. */
  autoStart?: boolean;
}

/**
 * A small, on-device barcode / QR reader shared by alarm setup and the ringing challenge. The
 * scanner uses the rear camera when available, never uploads a frame, and stops every media track
 * as soon as the user closes it or navigates away.
 */
export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  language = 'en',
  title,
  description,
  buttonLabel,
  className = '',
  autoStart = false,
}) => {
  const isAm = language === 'am';
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const activeRef = useRef(false);
  const mountedRef = useRef(true);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const autoStartRef = useRef(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopScanning = useCallback(() => {
    activeRef.current = false;
    controlsRef.current?.stop();
    controlsRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject;
    if (stream && typeof stream === 'object' && 'getTracks' in stream) {
      (stream as MediaStream).getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
    if (mountedRef.current) setIsScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    if (isStarting || isScanning) return;
    setCameraError(null);
    setIsStarting(true);
    activeRef.current = true;
    lastScanRef.current = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('CAMERA_UNAVAILABLE');
      }
      // Lazy loading keeps the decoder out of the initial app bundle and prevents camera code from
      // being evaluated at all unless someone picks a camera mission.
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (!activeRef.current || !videoRef.current) return;
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result) => {
          if (!activeRef.current || !result) return;
          const value = result.getText().trim();
          if (!value) return;
          const now = Date.now();
          const previous = lastScanRef.current;
          if (previous?.value === value && now - previous.at < 1800) return;
          lastScanRef.current = { value, at: now };
          onScan(value);
        }
      );
      controlsRef.current = controls;
      if (!activeRef.current) {
        controls.stop();
        return;
      }
      setIsScanning(true);
    } catch (error) {
      activeRef.current = false;
      if (!mountedRef.current) return;
      const errorName = error instanceof Error ? error.name : '';
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage === 'CAMERA_UNAVAILABLE') {
        setCameraError(isAm ? 'ይህ መሣሪያ ካሜራ ማንበብን አይደግፍም።' : 'Camera scanning is not available on this device.');
      } else if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
        setCameraError(isAm ? 'ካሜራ ፈቃድ አልተሰጠም። በቅንብሮች ውስጥ ፈቃድ ይስጡና እንደገና ይሞክሩ።' : 'Camera access was denied. Allow camera access in Settings, then try again.');
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setCameraError(isAm ? 'ካሜራ አልተገኘም።' : 'No camera was found on this device.');
      } else {
        setCameraError(isAm ? 'ካሜራው ሊከፈት አልቻለም። እንደገና ይሞክሩ።' : 'Could not start the camera. Close other camera apps and retry.');
      }
      stopScanning();
    } finally {
      if (mountedRef.current) setIsStarting(false);
    }
  }, [isAm, isScanning, isStarting, onScan, stopScanning]);

  useEffect(() => {
    if (!autoStart) {
      autoStartRef.current = false;
      return;
    }
    if (autoStartRef.current) return;
    autoStartRef.current = true;
    void startScanning();
  }, [autoStart, startScanning]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') stopScanning();
    };
    mountedRef.current = true;
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <div className={`rounded-2xl border border-slate-700/80 bg-slate-950/70 p-3.5 ${className}`}>
      {title && <h3 className="text-sm font-extrabold text-white">{title}</h3>}
      {description && <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>}

      <div className={isScanning ? 'mt-3 space-y-3' : 'pointer-events-none fixed left-[-9999px] top-0 h-px w-px overflow-hidden opacity-0'}>
        <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label={isAm ? 'የካሜራ ቅድመ እይታ' : 'Camera preview'}
            className={isScanning ? 'h-52 w-full object-cover' : 'h-px w-px'}
          />
          {isScanning && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative h-28 w-56 rounded-2xl border-2 border-amber-300/90 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]">
                <span className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 -translate-y-1/2 bg-rose-400/80" />
                <ScanLine className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-amber-300 p-1 text-slate-950" />
              </div>
            </div>
          )}
        </div>
        {isScanning && (
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              {isAm ? 'ኮዱን በፍሬሙ ውስጥ ያስቀምጡ' : 'Line the barcode up inside the frame'}
            </p>
            <button
              type="button"
              onClick={stopScanning}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200"
            >
              <CameraOff className="h-3.5 w-3.5" />
              {isAm ? 'ጨርስ' : 'Stop'}
            </button>
          </div>
        )}
      </div>

      {!isScanning && (
        <div className="mt-3 space-y-2">
          {cameraError && (
            <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs leading-relaxed text-rose-200">
              {cameraError}
            </p>
          )}
          <button
            type="button"
            disabled={isStarting}
            onClick={() => void startScanning()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-70"
          >
            {isStarting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {isStarting ? (isAm ? 'ካሜራው እየከፈተ ነው…' : 'Opening camera…') : (buttonLabel || (isAm ? 'ካሜራ ክፈት' : 'Open camera'))}
          </button>
          <p className="text-[10px] leading-relaxed text-slate-500">
            {isAm ? 'ካሜራው በመሣሪያዎ ላይ ብቻ ይሰራል፤ ምስሎች አይቀመጡም።' : 'Camera runs on this device only. No photo or video is saved.'}
          </p>
        </div>
      )}
    </div>
  );
};
