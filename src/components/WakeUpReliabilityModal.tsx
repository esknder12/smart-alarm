import React, { useCallback, useEffect, useState } from 'react';
import { AlarmClock, BellRing, Check, Expand, RefreshCw, ShieldAlert, Smartphone, Volume2, X } from 'lucide-react';
import { Language } from '../utils/translations';
import { nativeAlarmScheduler, type AlarmScheduleState } from '../utils/alarmScheduler';

interface WakeUpReliabilityModalProps {
  language: Language;
  onClose: () => void;
}

/**
 * "Will my alarm actually ring?" - the honest answer.
 *
 * A page cannot ring on its own and a phone can withhold three things an alarm needs: exact alarms,
 * notification permission and (on Android 14+) the permission to show a full-screen notification
 * over the lock screen. Each row below reads the real state of the phone through the native
 * scheduler and offers the one system screen that fixes it.
 *
 * It also prints the device model and what the button lock did during the last ring, so a report
 * like "volume-down still worked on my phone" can carry the phone's name and the lock's own state.
 */
export const WakeUpReliabilityModal: React.FC<WakeUpReliabilityModalProps> = ({ language, onClose }) => {
  const isAm = language === 'am';
  const native = nativeAlarmScheduler.isAvailable();
  const [state, setState] = useState<AlarmScheduleState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState(await nativeAlarmScheduler.getState());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openSystemScreen = async (target: 'exactAlarm' | 'fullScreenIntent') => {
    setBusy(target);
    await nativeAlarmScheduler.openSettings(target);
    setBusy(null);
    // The user comes back from a settings screen; re-read the state a moment later.
    window.setTimeout(() => void refresh(), 1200);
  };

  const askNotifications = async () => {
    setBusy('notifications');
    await nativeAlarmScheduler.requestNotificationPermission();
    setBusy(null);
    void refresh();
  };

  const formatNext = (timestamp: number): string => {
    if (!timestamp || timestamp <= 0) return isAm ? 'ምንም አልተያዘም' : 'Nothing scheduled';
    const date = new Date(timestamp);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `${isAm ? 'ዛሬ' : 'Today'} ${time}`;
    return `${date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
  };

  const rows: Array<{
    key: string;
    ok: boolean;
    title: string;
    detail: string;
    action?: { label: string; run: () => void };
  }> = native
    ? [
        {
          key: 'exact',
          ok: Boolean(state?.exactAlarmsAllowed),
          title: isAm ? 'ትክክለኛ ማንቂያ (Exact alarms)' : 'Exact alarms',
          detail: state?.exactAlarmsAllowed
            ? isAm
              ? 'ስልኩ ማንቂያውን በተወሰነው ሰዓት ላይ በትክክል ያስነሳል።'
              : 'The phone fires the alarm at the exact minute.'
            : isAm
              ? 'ፈቃዱ ሳይሰጥ ማንቂያው ይሰራል ግን ሰዓቱ ሊዘገይ ይችላል።'
              : 'Without it the alarm still fires, but not to the minute.',
          action: state?.exactAlarmsAllowed
            ? undefined
            : { label: isAm ? 'ፍቃድ ስጥ' : 'Allow', run: () => void openSystemScreen('exactAlarm') },
        },
        {
          key: 'notifications',
          ok: Boolean(state?.notificationsAllowed),
          title: isAm ? 'ማስታወቂያዎች' : 'Notifications',
          detail: state?.notificationsAllowed
            ? isAm
              ? 'የማንቂያው ማስታወቂያ እና ሙሉ ስክሪን ገፁ ይታያሉ።'
              : 'The alarm notification and its full-screen screen can appear.'
            : isAm
              ? 'ፈቃዱ ሳይሰጥ ማስታወቂያው አይታይም፤ ማንቂያው ግን ይደውላል።'
              : 'Without it the alarm still rings, but no notification appears.',
          action: state?.notificationsAllowed
            ? undefined
            : { label: isAm ? 'ፍቃድ ስጥ' : 'Allow', run: () => void askNotifications() },
        },
        {
          key: 'fullscreen',
          ok: Boolean(state?.fullScreenIntentAllowed),
          title: isAm ? 'ሙሉ ስክሪን ማንቂያ ገፅ' : 'Alarm screen over the lock screen',
          detail: state?.fullScreenIntentAllowed
            ? isAm
              ? 'ማንቂያው ሲደውል የፈተናው ገፅ በሎክ ስክሪን ላይ በራሱ ይከፈታል።'
              : 'The puzzle comes up over the lock screen by itself.'
            : isAm
              ? 'የአንድሮይድ 14+ ማስተካከያ፡ ገፁ በራሱ እንዲከፈት ፍቃድ ይስጡ።'
              : 'Android 14+ setting: allow it so the puzzle opens by itself.',
          action: state?.fullScreenIntentAllowed
            ? undefined
            : { label: isAm ? 'ክፈት' : 'Open', run: () => void openSystemScreen('fullScreenIntent') },
        },
      ]
    : [];

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-sm text-slate-100">
            {isAm ? 'ማንቂያው በእርግጥ ይደውላል?' : 'Will the alarm really ring?'}
          </div>
          <p className="text-slate-400 mt-1 leading-relaxed">
            {native
              ? isAm
                ? 'በአንድሮይድ ስልክ ላይ ማንቂያዎቹ በስልኩ የማንቂያ ሰዓት ላይ ተይዘዋል፤ መተግበሪያው ተዘግቶ ሳለም ይደውላሉ።'
                : 'On Android the alarms are handed to the phone’s own alarm clock, so they ring with the app closed.'
              : isAm
                ? 'በአሳሽ ውስጥ ማንቂያው የሚደውለው ገፁ ክፍት ሆኖ ሳለ ብቻ ነው። ሙሉ ተመኩሮውን ለማግኘት የአንድሮይድ መተግበሪያውን ይጠቀሙ።'
                : 'This is the browser build: alarms only ring while the page is open. Install the Android app for the full experience.'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-slate-300 shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {native ? (
        <>
          <div className="p-4 rounded-2xl border bg-slate-900 border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <AlarmClock className="w-4 h-4 text-emerald-400" />
                {isAm ? 'የሚቀጥለው ማንቂያ' : 'Next alarm'}
              </div>
              <span className="font-mono text-[11px] text-emerald-400">
                {state ? formatNext(state.nextTriggerAt) : '…'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>{isAm ? 'የተያዙ ማንቂያዎች' : 'Armed alarms'}</span>
              <span className="font-mono text-slate-300">{state?.scheduledCount ?? 0}</span>
            </div>
            <button
              onClick={() => void refresh()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {isAm ? 'እንደገና አንብብ' : 'Refresh'}
            </button>
          </div>

          <div className="p-4 rounded-2xl border bg-slate-900 border-slate-800 space-y-3">
            <div className="font-bold text-slate-200">{isAm ? 'ፈቃዶች' : 'Permissions'}</div>
            {rows.map((row) => (
              <div key={row.key} className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 ${row.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {row.ok ? <Check className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-200">{row.title}</div>
                    <div className="text-slate-400 leading-relaxed">{row.detail}</div>
                  </div>
                </div>
                {row.action && (
                  <button
                    onClick={row.action.run}
                    disabled={busy === row.key}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold transition"
                  >
                    {busy === row.key ? '…' : row.action.label}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl border bg-slate-900 border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <Volume2 className="w-4 h-4 text-amber-400" />
              {isAm ? 'የድምፅ ቁልፎች ማስረጃ' : 'Volume-key record'}
            </div>
            <div className="text-slate-300 leading-relaxed">
              {state?.keyBlockHeldByService
                ? isAm
                  ? 'አሁን ደውሎ ያለው ማንቂያ የድምፅ ቁልፎችን ይዞ ይዟል (አገልግሎቱ ነው የያዘው)።'
                  : 'A ringing alarm is holding the volume keys right now (held by the ringing service).'
                : isAm
                  ? 'አሁን ደውሎ ያለ ማንቂያ የለም። ማንቂያው ሲደውል ቁልፎቹ በአገልግሎቱ ተይዘው ይቆለፋሉ።'
                  : 'No alarm is ringing. When one does, the ringing service holds the keys locked.'}
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>{isAm ? 'የተያዙ የቁልፍ ግፊቶች' : 'Blocked key presses'}</span>
              <span className="font-mono text-slate-300">{state?.blockedPresses ?? 0}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="p-4 rounded-2xl border bg-amber-500/10 border-amber-500/30 flex items-start gap-3">
          <BellRing className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-slate-300 leading-relaxed">
            {isAm
              ? 'ይህ ገፅ በአሳሽ ውስጥ ነው። ማንቂያ መተግበሪያው ተዘግቶ ሳለ እንዲደውል የአንድሮይድ መተግበሪያውን ይጠቀሙ።'
              : 'This is the browser build. Install the Android app to have alarms ring while the app is closed.'}
          </div>
        </div>
      )}

      {native && state?.deviceModel && (
        <div className="p-4 rounded-2xl border bg-slate-900 border-slate-800 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-200">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            {isAm ? 'የመሳሪያ መረጃ' : 'Device'}
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>{isAm ? 'ሞዴል' : 'Model'}</span>
            <span className="font-mono text-slate-300">{state.deviceModel}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Android SDK</span>
            <span className="font-mono text-slate-300">{state.sdkInt}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>{isAm ? 'የማንቂያ ስክሪን ፍቃድ' : 'Full-screen intent'}</span>
            <span className="font-mono text-slate-300">
              {state.fullScreenIntentAllowed ? 'granted' : 'off'}
            </span>
          </div>
        </div>
      )}

      {native && (
        <div className="p-4 rounded-2xl border bg-slate-900 border-slate-800 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-200">
            <Expand className="w-4 h-4 text-violet-400" />
            {isAm ? 'ማንቂያው ሲደውል ምን ይሆናል' : 'What happens while it rings'}
          </div>
          {[
            isAm ? 'ድምፁ በስልኩ የማንቂያ ድምፅ መስመር ላይ ይጮሃል' : 'The sound plays on the phone’s alarm audio stream',
            isAm ? 'የፈተናው ገፅ በሎክ ስክሪን ላይ ይታያል' : 'The puzzle opens over the lock screen',
            isAm ? 'የድምፅ ቁልፎችና ተመለስ እስኪፈቱ ድረስ ይቆለፋሉ' : 'Volume keys and Back stay locked until it is solved',
            isAm ? '30 ደቂቃ በኋላ ራሱ ይቆማል (ደህንነት)' : 'It stops by itself after 30 minutes (safety)',
            isAm ? 'ከስልክ ሪስታርት በኋላ ማንቂያዎቹ እንደገና ይያዛሉ' : 'Alarms are re-armed after a reboot',
          ].map((item) => (
            <div key={item} className="flex items-start space-x-2 text-slate-300">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
