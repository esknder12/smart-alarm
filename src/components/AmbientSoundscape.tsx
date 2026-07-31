import React, { useState, useEffect } from 'react';
import { AmbientSound } from '../types';
import { audioEngine } from '../utils/audio';
import { Volume2, VolumeX, CloudRain, Waves, Trees, Wind, Sparkles, Play, Square, Timer } from 'lucide-react';

interface AmbientSoundscapeProps {
  ambients: AmbientSound[];
  onUpdateAmbients: (ambients: AmbientSound[]) => void;
}

export const AmbientSoundscape: React.FC<AmbientSoundscapeProps> = ({
  ambients,
  onUpdateAmbients,
}) => {
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    if (sleepTimerMinutes && sleepTimerMinutes > 0) {
      timer = window.setInterval(() => {
        setSleepTimerMinutes((prev) => {
          if (prev && prev <= 1) {
            stopAll();
            return null;
          }
          return prev ? prev - 1 : null;
        });
      }, 60000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [sleepTimerMinutes]);

  const toggleSound = (sound: AmbientSound) => {
    const updated = ambients.map((item) => {
      if (item.id === sound.id) {
        const nextPlaying = !item.isPlaying;
        if (nextPlaying) {
          audioEngine.startAmbientSound(item.id, item.type, item.volume);
        } else {
          audioEngine.stopAmbientSound(item.id);
        }
        return { ...item, isPlaying: nextPlaying };
      }
      return item;
    });
    onUpdateAmbients(updated);
  };

  const handleVolumeChange = (soundId: string, newVolume: number) => {
    audioEngine.setAmbientVolume(soundId, newVolume);
    const updated = ambients.map((item) => (item.id === soundId ? { ...item, volume: newVolume } : item));
    onUpdateAmbients(updated);
  };

  const stopAll = () => {
    audioEngine.stopAllAmbient();
    const updated = ambients.map((item) => ({ ...item, isPlaying: false }));
    onUpdateAmbients(updated);
    setSleepTimerMinutes(null);
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'CloudRain': return <CloudRain className="w-6 h-6 text-sky-400" />;
      case 'Waves': return <Waves className="w-6 h-6 text-teal-400" />;
      case 'Trees': return <Trees className="w-6 h-6 text-emerald-400" />;
      case 'Wind': return <Wind className="w-6 h-6 text-indigo-400" />;
      default: return <Sparkles className="w-6 h-6 text-amber-400" />;
    }
  };

  const isAnyPlaying = ambients.some((a) => a.isPlaying);

  return (
    <div id="ambient-soundscape-view" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-teal-400 font-semibold text-xs tracking-wider uppercase mb-1">
            <Volume2 className="w-4 h-4" />
            <span>Soundscape Generator</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Sleep & Wake Ambient Sounds</h2>
          <p className="text-slate-400 text-sm mt-0.5">Mix soothing natural frequencies to fall asleep smoothly or wake up refreshed</p>
        </div>

        {isAnyPlaying && (
          <button
            onClick={stopAll}
            className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold px-4 py-2.5 rounded-xl transition text-xs border border-rose-500/30 flex items-center space-x-2 shrink-0"
          >
            <VolumeX className="w-4 h-4" />
            <span>Mute All Sounds</span>
          </button>
        )}
      </div>

      {/* Sleep Timer Selector */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
          <Timer className="w-4 h-4 text-amber-400" />
          <span>Sleep Auto-Off Timer:</span>
          {sleepTimerMinutes && (
            <span className="text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {sleepTimerMinutes} min remaining
            </span>
          )}
        </div>

        <div className="flex space-x-2">
          {[15, 30, 45, 60].map((mins) => (
            <button
              key={mins}
              onClick={() => setSleepTimerMinutes(mins)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                sleepTimerMinutes === mins
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {mins}m
            </button>
          ))}
          {sleepTimerMinutes && (
            <button
              onClick={() => setSleepTimerMinutes(null)}
              className="px-2 py-1.5 text-xs text-rose-400 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Sounds Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {ambients.map((sound) => {
          const active = sound.isPlaying;
          return (
            <div
              key={sound.id}
              className={`p-5 rounded-2xl border transition-all ${
                active
                  ? 'bg-slate-900 border-teal-500/40 ring-1 ring-teal-500/20 shadow-lg'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-xl ${active ? 'bg-teal-500/20 ring-1 ring-teal-500/40' : 'bg-slate-800'}`}>
                    {getIcon(sound.iconName)}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{sound.name}</h3>
                    <span className="text-xs text-slate-400 capitalize">{sound.type}</span>
                  </div>
                </div>

                <button
                  onClick={() => toggleSound(sound)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                    active
                      ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {active ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
              </div>

              {/* Volume Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Volume</span>
                  <span>{sound.volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sound.volume}
                  onChange={(e) => handleVolumeChange(sound.id, Number(e.target.value))}
                  className="w-full accent-teal-400"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
