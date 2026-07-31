import React, { useState } from 'react';
import { WakeLog } from '../types';
import { ChevronLeft, ChevronRight, Info, Plus, Sun, FileText } from 'lucide-react';

interface WakeStatsProps {
  logs: WakeLog[];
  onAddLog: (log: Omit<WakeLog, 'id'>) => void;
  onSetAlarmClick?: () => void;
}

export const WakeStats: React.FC<WakeStatsProps> = ({ logs, onAddLog, onSetAlarmClick }) => {
  const [reportType, setReportType] = useState<'wakeup' | 'sleep' | 'habit'>('wakeup');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wakeTime, setWakeTime] = useState('06:30');
  const [targetTime, setTargetTime] = useState('06:30');
  const [feeling, setFeeling] = useState<WakeLog['feeling']>('refreshed');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().split('T')[0];
    const isOnTime = wakeTime <= targetTime;

    onAddLog({
      date: today,
      wakeTime,
      targetTime,
      feeling,
      onTime: isOnTime,
      routineCompletedPct: 100,
    });
    setIsModalOpen(false);
  };

  return (
    <div id="report-view" className="space-y-6 pb-24 max-w-md mx-auto">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-black text-white">Report</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="text-xs text-amber-400 font-bold hover:underline"
        >
          + Log Entry
        </button>
      </div>

      {/* Date Range Navigator matching Image 4 */}
      <div className="flex items-center justify-center space-x-4 text-slate-300 font-bold text-sm">
        <button className="p-1 hover:text-white transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span>This week Jul 26 - Aug 1</span>
        <button className="p-1 hover:text-white transition">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Pill Tabs matching Image 4 */}
      <div className="flex items-center justify-center space-x-2">
        <button
          onClick={() => setReportType('wakeup')}
          className={`px-4 py-2 rounded-full font-bold text-xs transition ${
            reportType === 'wakeup'
              ? 'bg-white text-slate-950 shadow-md'
              : 'bg-[#1c1d22] text-slate-400 hover:text-white'
          }`}
        >
          Wake up report
        </button>

        <button
          onClick={() => setReportType('sleep')}
          className={`px-4 py-2 rounded-full font-bold text-xs transition ${
            reportType === 'sleep'
              ? 'bg-white text-slate-950 shadow-md'
              : 'bg-[#1c1d22] text-slate-400 hover:text-white'
          }`}
        >
          Sleep report
        </button>

        <button
          onClick={() => setReportType('habit')}
          className={`px-4 py-2 rounded-full font-bold text-xs transition ${
            reportType === 'habit'
              ? 'bg-white text-slate-950 shadow-md'
              : 'bg-[#1c1d22] text-slate-400 hover:text-white'
          }`}
        >
          Habit report
        </button>
      </div>

      {/* Average Metrics Row matching Image 4 */}
      <div className="grid grid-cols-2 gap-3 text-center pt-2">
        <div className="bg-[#1c1d22] border border-slate-800/80 rounded-2xl p-4">
          <div className="text-2xl font-mono font-bold text-white mb-1">
            {logs.length > 0 ? logs[0].wakeTime : '-'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center space-x-1">
            <span>Avg. wake-up time</span>
            <Info className="w-3 h-3 text-slate-500" />
          </div>
        </div>

        <div className="bg-[#1c1d22] border border-slate-800/80 rounded-2xl p-4">
          <div className="text-2xl font-mono font-bold text-white mb-1">
            {logs.length > 0 ? '4 min' : '-'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center space-x-1">
            <span>Avg. time to wake up</span>
            <Info className="w-3 h-3 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Main Records Box matching Image 4 */}
      <div className="bg-[#1c1d22] border border-slate-800/80 rounded-3xl p-8 text-center space-y-4 shadow-xl my-4">
        {logs.length === 0 ? (
          <>
            <div className="w-16 h-12 mx-auto rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500">
              <FileText className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-300">No alarm record</div>
            <button
              onClick={onSetAlarmClick}
              className="bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-sm px-6 py-2.5 rounded-full shadow-md transition active:scale-95 inline-flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Set alarm</span>
            </button>
          </>
        ) : (
          <div className="space-y-2 text-left">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Records</div>
            {logs.map((log) => (
              <div key={log.id} className="p-3 bg-[#121316] rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white font-mono">{log.wakeTime} (Target {log.targetTime})</div>
                  <div className="text-[10px] text-slate-400">{log.date}</div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${log.onTime ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {log.onTime ? 'On Time' : 'Snoozed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Secondary Card: View daily report matching Image 4 */}
      <div className="bg-[#1c1d22] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between text-left hover:border-slate-700 transition cursor-pointer">
        <div className="flex items-center space-x-3 text-sm font-bold text-white">
          <Sun className="w-5 h-5 text-orange-400" />
          <span>View daily report</span>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500" />
      </div>

      {/* Log Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1c1d22] border border-slate-800 rounded-3xl p-6 space-y-4 text-white">
            <h3 className="text-xl font-bold">Log Wake-Up Time</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Actual Wake Time</label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full bg-[#121316] border border-slate-700 rounded-2xl px-4 py-2 text-xl font-mono text-center text-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Target Time</label>
                <input
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="w-full bg-[#121316] border border-slate-700 rounded-2xl px-4 py-2 text-xl font-mono text-center text-white"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-800 font-bold rounded-2xl text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-red-500 hover:bg-red-400 font-bold rounded-2xl text-white shadow-lg"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
