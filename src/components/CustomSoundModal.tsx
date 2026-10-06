import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Mic,
  Square,
  Play,
  RotateCcw,
  Check,
  Music,
  Sparkles,
  Volume2,
  Trash2,
  Radio,
  AlertCircle,
} from 'lucide-react';
import { CustomSound } from '../types';
import {
  saveCustomSoundFile,
  saveCustomSoundFromBlob,
  generateWavDataUrl,
} from '../utils/customSounds';
import { Language } from '../utils/translations';

interface CustomSoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSoundAdded: (sound: CustomSound) => void;
  language?: Language;
}

export const CustomSoundModal: React.FC<CustomSoundModalProps> = ({
  isOpen,
  onClose,
  onSoundAdded,
  language = 'en',
}) => {
  const isAm = language === 'am';
  const [activeTab, setActiveTab] = useState<'upload' | 'record' | 'preset'>('upload');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileNameInput, setFileNameInput] = useState<string>('');
  const [filePreviewAudio, setFilePreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isFilePlaying, setIsFilePlaying] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedNameInput, setRecordedNameInput] = useState<string>('');
  const [isRecordPlaying, setIsRecordPlaying] = useState<boolean>(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordAudioRef = useRef<HTMLAudioElement | null>(null);

  // Loading/saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      if (filePreviewAudio) {
        filePreviewAudio.pause();
        setFilePreviewAudio(null);
      }
      if (recordAudioRef.current) {
        recordAudioRef.current.pause();
      }
      if (isRecording && mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
      setIsFilePlaying(false);
      setIsRecordPlaying(false);
      setIsRecording(false);
      setSelectedFile(null);
      setRecordedBlob(null);
      setRecordedAudioUrl(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle File Change
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) {
      setErrorMessage(
        isAm
          ? 'እባክዎ ትክክለኛ የኦዲዮ ፋይል ይምረጡ (MP3, WAV, M4A, OGG)'
          : 'Please select a valid audio file (MP3, WAV, M4A, OGG)'
      );
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '').trim();
    setFileNameInput(cleanName || 'Custom Ringtone');

    if (filePreviewAudio) {
      filePreviewAudio.pause();
    }
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onended = () => setIsFilePlaying(false);
    setFilePreviewAudio(audio);
    setIsFilePlaying(false);
  };

  const toggleFilePreview = () => {
    if (!filePreviewAudio) return;
    if (isFilePlaying) {
      filePreviewAudio.pause();
      setIsFilePlaying(false);
    } else {
      filePreviewAudio.currentTime = 0;
      filePreviewAudio.play().then(() => setIsFilePlaying(true)).catch(() => {});
    }
  };

  const handleSaveUploadedFile = async () => {
    if (!selectedFile) return;
    try {
      setIsSaving(true);
      if (filePreviewAudio) {
        filePreviewAudio.pause();
      }
      // Create a copy with the custom name if modified
      const extMatch = selectedFile.name.match(/\.[^/.]+$/);
      const ext = extMatch ? extMatch[0] : '';
      const customFileName = (fileNameInput.trim() || 'Custom Sound') + ext;
      const fileToSave = new File([selectedFile], customFileName, { type: selectedFile.type });

      const newSound = await saveCustomSoundFile(fileToSave);
      onSoundAdded(newSound);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMessage(isAm ? 'ፋይሉን ማስቀመጥ አልተቻለም' : 'Failed to save sound file');
    } finally {
      setIsSaving(false);
    }
  };

  // Start Mic Recording
  const startRecording = async () => {
    setErrorMessage(null);
    setMicPermissionDenied(false);
    recordedChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);

        const defaultName = isAm
          ? `የድምፅ ቀረፃ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : `Voice Note ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        setRecordedNameInput(defaultName);
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordSeconds(0);

      const startTime = Date.now();
      recordTimerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startTime) / 1000);
        setRecordSeconds(secs);
        if (secs >= 30) {
          // Max 30 seconds for wake-up recording
          stopRecording();
        }
      }, 200);
    } catch (err) {
      console.warn('Microphone access denied:', err);
      setMicPermissionDenied(true);
      setErrorMessage(
        isAm
          ? 'የማይክሮፎን ፈቃድ ተከልክሏል። እባክዎ ፈቃድ ይስጡ ወይም ፋይል ይስቀሉ።'
          : 'Microphone permission denied. Please allow microphone access or upload an audio file.'
      );
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  const toggleRecordPreview = () => {
    if (!recordedAudioUrl) return;
    if (isRecordPlaying) {
      if (recordAudioRef.current) recordAudioRef.current.pause();
      setIsRecordPlaying(false);
    } else {
      if (!recordAudioRef.current) {
        recordAudioRef.current = new Audio(recordedAudioUrl);
        recordAudioRef.current.onended = () => setIsRecordPlaying(false);
      } else {
        recordAudioRef.current.src = recordedAudioUrl;
      }
      recordAudioRef.current.currentTime = 0;
      recordAudioRef.current.play().then(() => setIsRecordPlaying(true)).catch(() => {});
    }
  };

  const handleSaveRecorded = async () => {
    if (!recordedBlob) return;
    try {
      setIsSaving(true);
      if (recordAudioRef.current) {
        recordAudioRef.current.pause();
      }
      const soundName = recordedNameInput.trim() || (isAm ? 'የድምፅ ማንቂያ' : 'Voice Alarm');
      const newSound = await saveCustomSoundFromBlob(recordedBlob, soundName);
      onSoundAdded(newSound);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMessage(isAm ? 'የተቀረፀውን ድምፅ ማስቀመጥ አልተቻለም' : 'Failed to save recording');
    } finally {
      setIsSaving(false);
    }
  };

  // Add Preset Trendy Sound
  const handleAddTrendyPreset = async (preset: { title: string; synthFn: (t: number) => number; duration: number }) => {
    try {
      setIsSaving(true);
      const dataUrl = generateWavDataUrl(preset.synthFn, preset.duration);
      // Fetch as blob to store
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const sound = await saveCustomSoundFromBlob(blob, preset.title);
      onSoundAdded(sound);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to generate preset sound');
    } finally {
      setIsSaving(false);
    }
  };

  const PRESETS = [
    {
      title: '🚨 Alarmy Heavy Air Raid Drill',
      subtitle: isAm ? 'ከፍተኛ ድምፅ ያለው የአየር ጥቃት ማንቂያ' : 'High Decibel Oscillating Emergency Horn',
      duration: 3,
      synthFn: (t: number) => {
        const sweep = 450 + 350 * Math.sin(t * 5);
        return 0.5 * Math.sin(2 * Math.PI * sweep * t) + 0.3 * Math.sign(Math.sin(2 * Math.PI * (sweep * 1.5) * t));
      },
    },
    {
      title: '🗣️ WAKE UP! WAKE UP! (Vocal Pulse)',
      subtitle: isAm ? 'ንቃ ንቃ! ፈጣን የማንቂያ ድምፅ' : 'Alarmy Iconic Syncopated Wake Up Shout',
      duration: 2.8,
      synthFn: (t: number) => {
        const stabIndex = Math.floor(t * 3.5);
        const freqs = [523.25, 659.25, 783.99, 1046.5];
        const f = freqs[stabIndex % freqs.length];
        const envelope = Math.max(0, 1 - (t % 0.28) * 3.5);
        return 0.6 * Math.sin(2 * Math.PI * f * t) * envelope;
      },
    },
    {
      title: '⚡ 808 Wake Up Drill Bass Beat',
      subtitle: isAm ? 'ዘመናዊ ትራፕ ቤዝ ማንቂያ' : 'Viral 808 Sub-Bass Trap Wake Up Drop',
      duration: 3.2,
      synthFn: (t: number) => {
        const beatTime = t % 0.5;
        const kick = Math.sin(2 * Math.PI * (110 * Math.exp(-beatTime * 12)) * t) * Math.max(0, 1 - beatTime * 2);
        const hihat = (Math.random() * 2 - 1) * Math.max(0, 1 - (t % 0.125) * 15) * 0.15;
        return kick * 0.6 + hihat;
      },
    },
    {
      title: '🐓 Cock-a-Doodle Morning Screech',
      subtitle: isAm ? 'የዶሮ ጩኸት ማለዳ' : 'Barnyard Rooster Screech Wake Up Crow',
      duration: 2.6,
      synthFn: (t: number) => {
        const f = 600 + 400 * Math.min(1, t / 1.5);
        return 0.4 * Math.sin(2 * Math.PI * f * t) + 0.2 * Math.sin(2 * Math.PI * f * 2 * t);
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-[28px] sm:rounded-[32px] bg-[#17181c] border border-slate-800 p-5 sm:p-6 space-y-5 shadow-2xl text-white max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
              <Music className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-[17px] font-black tracking-tight text-white">
                {isAm ? 'ብጁ የማንቂያ ድምፅ ጨምር' : 'Add Custom Sound'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isAm ? 'የራስዎን ኦዲዮ ወይም ቀረፃ ያስገቡ' : 'Upload audio, record voice, or pick presets'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800/70 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-[#101114] p-1.5 rounded-2xl border border-slate-800/70 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
              activeTab === 'upload'
                ? 'bg-rose-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isAm ? 'ፋይል ስቀል' : 'Upload File'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('record');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
              activeTab === 'record'
                ? 'bg-rose-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{isAm ? 'ድምፅ ቅረፅ' : 'Record Voice'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('preset');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
              activeTab === 'preset'
                ? 'bg-rose-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAm ? 'ፈጣን ድምጾች' : 'Trendy Presets'}</span>
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab 1: Upload File */}
        {activeTab === 'upload' && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700/80 hover:border-rose-500/70 bg-[#121316] hover:bg-[#1a1b20] transition rounded-3xl p-8 text-center cursor-pointer space-y-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto group-hover:scale-105 transition">
                  <Upload className="w-7 h-7 stroke-[2]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {isAm ? 'የኦዲዮ ፋይል ለመምረጥ እዚህ ይጫኑ' : 'Click to browse audio file'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isAm ? 'MP3, WAV, M4A, OGG, AAC ይደግፋል' : 'Supports MP3, WAV, M4A, OGG, AAC'}
                  </p>
                </div>
                <div className="inline-block px-3 py-1 bg-slate-800 rounded-full text-[10px] font-semibold text-slate-300">
                  {isAm ? 'ማንኛውንም የዘፈን ወይም የማንቂያ ድምፅ ይምረጡ' : 'Upload any favorite song or ringtone'}
                </div>
              </div>
            ) : (
              <div className="space-y-4 bg-[#121316] border border-slate-800 rounded-3xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <button
                      type="button"
                      onClick={toggleFilePreview}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md ${
                        isFilePlaying ? 'bg-rose-500 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                      aria-label="Preview audio"
                    >
                      {isFilePlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">
                        {isAm ? 'የተመረጠ ፋይል' : 'Selected Audio'} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                      </p>
                      <p className="text-sm font-bold text-white truncate">{selectedFile.name}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (filePreviewAudio) filePreviewAudio.pause();
                      setSelectedFile(null);
                    }}
                    className="p-2 text-slate-500 hover:text-rose-400 transition"
                    title="Change file"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-400">
                    {isAm ? 'የማንቂያ ስም' : 'Alarm Sound Title'}
                  </label>
                  <input
                    type="text"
                    value={fileNameInput}
                    onChange={(e) => setFileNameInput(e.target.value)}
                    placeholder="Enter custom sound name"
                    className="w-full bg-[#18191e] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveUploadedFile}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-rose-500/20 hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isSaving ? (isAm ? 'እየተቀመጠ ነው...' : 'Saving...') : (isAm ? 'ይህን ድምፅ ተጠቀም' : 'Save & Use As Alarm Sound')}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Record Voice */}
        {activeTab === 'record' && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            {!recordedBlob ? (
              <div className="bg-[#121316] border border-slate-800 rounded-3xl p-6 text-center space-y-4">
                <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                  {isRecording && (
                    <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
                  )}
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition shadow-xl relative z-10 ${
                      isRecording
                        ? 'bg-rose-600 ring-4 ring-rose-400/40 hover:bg-rose-700'
                        : 'bg-rose-500 hover:bg-rose-600 hover:scale-105 shadow-rose-500/30'
                    }`}
                    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                  >
                    {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8 stroke-[2.5]" />}
                  </button>
                </div>

                <div>
                  <div className="text-2xl font-black font-mono tracking-wider text-white">
                    00:{recordSeconds.toString().padStart(2, '0')}
                    <span className="text-xs text-slate-500 font-sans ml-1">/ 00:30 max</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-300 mt-1">
                    {isRecording
                      ? (isAm ? '🔴 ድምፅ እየተቀረፀ ነው... "ተነሳ! ተነሳ!" ይበሉ!' : '🔴 Recording now... Shout "WAKE UP!! TIME FOR WORK!"')
                      : (isAm ? 'ቀይውን ቁልፍ በመጫን የራስዎን ድምፅ ይቅረጹ' : 'Tap the microphone to record your custom wake up message')}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {isAm ? 'የቤተሰብ ወይም የጓደኛ ድምፅ፣ ዘፈን፣ ወይም ጩኸት ይቅረጹ' : 'Record a friend, partner, energetic scream, or custom motivational mantra'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 bg-[#121316] border border-slate-800 rounded-3xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={toggleRecordPreview}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md ${
                        isRecordPlaying ? 'bg-rose-500 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                      aria-label="Preview recorded sound"
                    >
                      {isRecordPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>
                    <div>
                      <p className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>{isAm ? 'ቀረፃው ተጠናቋል' : 'Recording Ready'} ({recordSeconds}s)</span>
                      </p>
                      <p className="text-sm font-bold text-white">{recordedNameInput || 'Voice Note'}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (recordAudioRef.current) recordAudioRef.current.pause();
                      setRecordedBlob(null);
                      setRecordedAudioUrl(null);
                      setIsRecordPlaying(false);
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isAm ? 'እንደገና ቅረፅ' : 'Re-record'}</span>
                  </button>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-400">
                    {isAm ? 'የቀረፃው ስም' : 'Recording Title'}
                  </label>
                  <input
                    type="text"
                    value={recordedNameInput}
                    onChange={(e) => setRecordedNameInput(e.target.value)}
                    placeholder="e.g. Wake Up Screaming Note"
                    className="w-full bg-[#18191e] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveRecorded}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-rose-500/20 hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isSaving ? (isAm ? 'እየተቀመጠ ነው...' : 'Saving...') : (isAm ? 'ይህን ድምፅ ተጠቀም' : 'Save & Set As Alarm Sound')}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Trendy Alarm Presets */}
        {activeTab === 'preset' && (
          <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
            <p className="text-xs text-slate-400 px-1">
              {isAm ? 'የሚወዱትን ቅድመ-ዝግጅት ድምፅ በመጫን ወዲያውኑ ወደ ብጁ ድምጾችዎ ያክሉ:' : 'Tap any Alarmy style preset below to instantly add it to your custom sound library:'}
            </p>
            {PRESETS.map((preset, index) => (
              <div
                key={index}
                className="bg-[#121316] border border-slate-800 hover:border-rose-500/50 rounded-2xl p-3 flex items-center justify-between gap-3 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{preset.title}</p>
                  <p className="text-xs text-slate-400 truncate">{preset.subtitle}</p>
                </div>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleAddTrendyPreset(preset)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-bold transition shrink-0 flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAm ? 'አክል' : 'Add'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
