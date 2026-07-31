import React, { useState } from 'react';
import { RoutineStep } from '../types';
import { CheckSquare, Plus, Play, Pause, RotateCcw, Flame, CheckCircle2, Circle, Sparkles, HeartPulse, Brain, Zap, Clock } from 'lucide-react';

interface MorningRoutineProps {
  routine: RoutineStep[];
  onToggleStep: (id: string) => void;
  onAddStep: (step: Omit<RoutineStep, 'id' | 'completed'>) => void;
  onDeleteStep: (id: string) => void;
  onResetRoutine: () => void;
}

export const MorningRoutine: React.FC<MorningRoutineProps> = ({
  routine,
  onToggleStep,
  onAddStep,
  onDeleteStep,
  onResetRoutine,
}) => {
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [timerInterval, setTimerIntervalState] = useState<number | null>(null);

  // New step modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [category, setCategory] = useState<'mind' | 'body' | 'fuel' | 'prep'>('body');

  const completedCount = routine.filter((r) => r.completed).length;
  const progressPct = routine.length > 0 ? Math.round((completedCount / routine.length) * 100) : 0;

  const startStepTimer = (step: RoutineStep) => {
    if (activeStepId === step.id && isTimerRunning) {
      pauseTimer();
      return;
    }

    if (activeStepId !== step.id) {
      setActiveStepId(step.id);
      setTimerSeconds(step.durationMinutes * 60);
    }

    setIsTimerRunning(true);
    const interval = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setTimerIntervalState(interval);
  };

  const pauseTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerIntervalState(null);
    }
    setIsTimerRunning(false);
  };

  const resetTimer = () => {
    pauseTimer();
    const current = routine.find((r) => r.id === activeStepId);
    if (current) {
      setTimerSeconds(current.durationMinutes * 60);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddStep({
      title,
      durationMinutes,
      category,
    });
    setTitle('');
    setIsModalOpen(false);
  };

  const formatTimerTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getCategoryIcon = (cat: RoutineStep['category']) => {
    switch (cat) {
      case 'body': return <HeartPulse className="w-4 h-4 text-emerald-400" />;
      case 'mind': return <Brain className="w-4 h-4 text-sky-400" />;
      case 'fuel': return <Zap className="w-4 h-4 text-amber-400" />;
      case 'prep': return <CheckSquare className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div id="morning-routine-view" className="space-y-6">
      {/* Banner & Progress */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs tracking-wider uppercase mb-1">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500/20" />
              <span>Optimal Morning Activation</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Morning Routine Flow</h2>
            <p className="text-slate-400 text-sm mt-0.5">Complete your habits to build momentum and mental clarity</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onResetRoutine}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-4 py-2.5 rounded-xl transition text-xs border border-slate-700 flex items-center space-x-1.5"
              title="Reset checklist for today"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Checklist</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition text-xs flex items-center space-x-1.5 shadow-md shadow-amber-500/10"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Custom Step</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-center text-sm font-semibold mb-2">
            <span className="text-slate-300 flex items-center space-x-1.5">
              <span>Overall Completion</span>
              {progressPct === 100 && <Sparkles className="w-4 h-4 text-amber-400 inline" />}
            </span>
            <span className="text-amber-400 font-mono">{completedCount} / {routine.length} ({progressPct}%)</span>
          </div>
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Active Step Timer Box (if selected) */}
      {activeStepId && (
        <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 p-5 rounded-2xl border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Active Step Focus</span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              {routine.find((r) => r.id === activeStepId)?.title}
            </h3>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-3xl font-mono font-black text-indigo-300 tracking-wider">
              {formatTimerTime(timerSeconds)}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  const step = routine.find((r) => r.id === activeStepId);
                  if (step) startStepTimer(step);
                }}
                className="p-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold transition shadow-md"
              >
                {isTimerRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
              <button
                onClick={resetTimer}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Steps List */}
      <div className="space-y-3">
        {routine.map((step) => {
          const isDone = step.completed;
          return (
            <div
              key={step.id}
              id={`routine-step-${step.id}`}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                isDone
                  ? 'bg-slate-900/40 border-slate-800/60 opacity-70'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-4 flex-1">
                <button
                  id={`toggle-routine-${step.id}`}
                  onClick={() => onToggleStep(step.id)}
                  className="text-amber-400 hover:scale-110 transition shrink-0"
                >
                  {isDone ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-400 fill-emerald-400/20" />
                  ) : (
                    <Circle className="w-7 h-7 text-slate-600 hover:text-amber-400" />
                  )}
                </button>

                <div>
                  <div className={`font-bold text-base ${isDone ? 'line-through text-slate-500' : 'text-white'}`}>
                    {step.title}
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5">
                    <span className="flex items-center space-x-1">
                      {getCategoryIcon(step.category)}
                      <span className="capitalize">{step.category}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{step.durationMinutes} min</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => startStepTimer(step)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${
                    activeStepId === step.id && isTimerRunning
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Timer</span>
                </button>
                <button
                  onClick={() => onDeleteStep(step.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                  title="Remove Step"
                >
                  &times;
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Step Modal */}
      {isModalOpen && (
        <div id="add-step-modal-backdrop" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Add Custom Morning Routine Step</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 10 Min Light Stretching"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Target Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RoutineStep['category'])}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="body">Body (Physical activation)</option>
                  <option value="mind">Mind (Mental focus & peace)</option>
                  <option value="fuel">Fuel (Hydration & Nutrition)</option>
                  <option value="prep">Prep (Day Planning)</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 text-slate-950 py-3 rounded-xl font-bold text-sm"
                >
                  Add Step
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
