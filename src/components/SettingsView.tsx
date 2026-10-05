import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Volume2,
  Bell,
  Sliders,
  Palette,
  Globe,
  HelpCircle,
  MessageSquare,
  FileText,
  Info,
  Check,
  Moon,
  Zap,
  Power,
  Lock,
  Smartphone,
  ExternalLink,
  X,
  Star,
  BellRing,
  Send
} from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { APP_NAME, APP_VERSION } from '../constants';
import { AppMark } from './AppLogo';
import { nativeAlarmLock } from '../utils/alarmLock';
import { WakeUpReliabilityModal } from './WakeUpReliabilityModal';
import {
  getNotificationStatus,
  requestNotificationPermission,
  sendTestNotification,
  NotificationStatus
} from '../utils/notifications';

interface SettingsViewProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  onLaunchNightstand: () => void;
  onRelaunchTour: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  language,
  setLanguage,
  onLaunchNightstand,
  onRelaunchTour,
}) => {
  const t = translations[language];
  const isAm = language === 'am';
  // True only inside the Android app, where the physical volume keys and Back really are blocked.
  const nativeLock = nativeAlarmLock.isAvailable();

  // Notification status state
  const [notifStatus, setNotifStatus] = useState<NotificationStatus>({ isSupported: true, permission: 'default' });
  const [testSentMsg, setTestSentMsg] = useState<string>('');
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    setNotifStatus(getNotificationStatus());
  }, []);

  const handleAllowNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifStatus(getNotificationStatus());
    if (granted) {
      setTestSentMsg(isAm ? 'ፈቃድ ተሰጥቷል! የስርዓት ማስታወቂያዎች በርተዋል።' : 'Permission granted! System notifications active.');
    } else {
      setTestSentMsg(isAm ? 'የማስታወቂያ ፈቃድ በአሳሹ ተከልክሏል።' : 'Notification permission denied by browser.');
    }
  };

  const handleSendTestNotif = () => {
    const success = sendTestNotification();
    if (success) {
      setTestSentMsg(isAm ? 'የሙከራ ማስታወቂያ ተላከ!' : 'Test notification sent! Check your system banner.');
    } else {
      setTestSentMsg(isAm ? 'ማስታወቂያ መላክ አልተቻለም።' : 'Could not send notification. Please check browser permissions.');
    }
  };
  const [preventPowerOff, setPreventPowerOff] = useState(false);
  const [preventUninstall, setPreventUninstall] = useState(false);
  const [soundOutput, setSoundOutput] = useState('Current device');
  const [serviceNotifications, setServiceNotifications] = useState(true);
  const [promotionsUpdates, setPromotionsUpdates] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('Dark Slate');

  // Modals
  const [activeModal, setActiveModal] = useState<string | null>(null);

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 text-white font-sans">
      {/* Title */}
      <h1 className="text-3xl font-black tracking-tight px-1 text-white">
        {isAm ? 'ማስተካከያዎች' : 'Settings'}
      </h1>

      {/* Account & Pro Top Card */}
      <div className="bg-[#18191d] border border-slate-800/80 rounded-3xl p-2 divide-y divide-slate-800/60 shadow-xl">
        {/* Row 1: Sign in to account */}
        <button
          onClick={() => setActiveModal('account')}
          className="w-full p-3.5 flex items-center justify-between hover:bg-slate-800/40 rounded-2xl transition group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm text-slate-100 group-hover:text-white">
              {isSignedIn
                ? isAm ? 'የእኔ መለያ (ፕሪሚየም ተጠቃሚ)' : 'My Account (Premium User)'
                : isAm ? 'ወደ መለያዎ ይግቡ' : 'Sign In to Your Account'}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-300" />
        </button>

        {/* Row 2: Pro */}
        <button
          onClick={() => setActiveModal('pro')}
          className="w-full p-3.5 flex items-center justify-between hover:bg-slate-800/40 rounded-2xl transition group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-black">
              ✓
            </div>
            <span className="font-bold text-sm text-slate-100">{isAm ? 'ፕሮ (Pro)' : 'Pro Version'}</span>
          </div>
          <div className="flex items-center space-x-1 text-sm font-bold text-slate-300 group-hover:text-amber-400">
            <span>{isAm ? 'አሻሽል' : 'Upgrade'}</span>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>
        </button>

      </div>

      {/* Main Settings List Group 1 */}
      <div className="space-y-4 pt-1">
        {/* Alarm optimization */}
        <button
          onClick={() => setActiveModal('optimization')}
          className="w-full p-4 bg-[#18191d] hover:bg-[#202127] border border-slate-800/80 rounded-2xl flex items-center justify-between transition text-left group"
        >
          <span className="font-bold text-sm text-slate-100 group-hover:text-white">
            {isAm ? 'የማንቂያ ማሻሻያ' : 'Alarm Optimization'}
          </span>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>

        {/* Advanced alarm settings */}
        <button
          onClick={() => setActiveModal('advanced')}
          className="w-full p-4 bg-[#18191d] hover:bg-[#202127] border border-slate-800/80 rounded-2xl flex items-center justify-between transition text-left group"
        >
          <div>
            <div className="font-bold text-sm text-slate-100 group-hover:text-white">
              {isAm ? 'ከፍተኛ የማንቂያ ማስተካከያዎች' : 'Advanced Alarm Settings'}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>

        {/* Theme */}
        <button
          onClick={() => setActiveModal('theme')}
          className="w-full p-4 bg-[#18191d] hover:bg-[#202127] border border-slate-800/80 rounded-2xl flex items-center justify-between transition text-left group"
        >
          <div>
            <div className="font-bold text-sm text-slate-100 group-hover:text-white">
              {isAm ? 'ጭብጥ' : 'Theme'}
            </div>
            <div className="text-xs text-amber-400 mt-0.5 font-medium">
              {selectedTheme}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800/80 my-4" />

      {/* Main Settings List Group 2 */}
      <div className="space-y-4">
        {/* Sound output */}
        <button
          onClick={() => setActiveModal('sound_output')}
          className="w-full p-4 bg-[#18191d] hover:bg-[#202127] border border-slate-800/80 rounded-2xl flex items-center justify-between transition text-left"
        >
          <span className="font-bold text-sm text-slate-100">{isAm ? 'የድምፅ ማውጫ' : 'Sound Output'}</span>
          <span className="text-xs text-slate-400 font-medium">{soundOutput}</span>
        </button>

        {/* Notification setting */}
        <button
          onClick={() => setActiveModal('notifications')}
          className="w-full p-4 bg-[#18191d] hover:bg-[#202127] border border-slate-800/80 rounded-2xl flex items-center justify-between transition text-left group"
        >
          <div>
            <div className="font-bold text-sm text-slate-100 group-hover:text-white">
              {isAm ? 'ማሳወቂያዎች' : 'Notifications'}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>

        {/* Essential Android permission to open the alarm challenge automatically. */}
        {nativeLock && (
          <button
            onClick={() => setActiveModal('reliability')}
            className="w-full p-4 bg-[#18191d] hover:bg-[#202127] border border-slate-800/80 rounded-2xl flex items-center justify-between transition text-left"
          >
            <span className="font-bold text-sm text-slate-100">{isAm ? 'የማንቂያ ፈቃዶች' : 'Alarm permissions'}</span>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        )}

        {/* System configuration */}
        <button
          onClick={() => setActiveModal('system_config')}
          className="w-full p-4 bg-[#18191d] hover:bg-[#202127] border border-slate-800/80 rounded-2xl flex items-center justify-between transition text-left group"
        >
          <div>
            <div className="font-bold text-sm text-slate-100 group-hover:text-white">
              {isAm ? 'ቋንቋ' : 'Language'}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800/80 my-4" />

      {/* Group 3: Help, FAQ, Feedback, About */}
      <div className="space-y-3">
        {/* Notices */}
        <button
          onClick={() => setActiveModal('notices')}
          className="w-full py-3 px-2 flex items-center justify-between hover:text-white transition text-left text-slate-200"
        >
          <div className="flex items-center space-x-2 font-bold text-sm">
            <span>{isAm ? 'ማስታወቂያዎች' : 'Notices & Announcements'}</span>
            <span className="w-2 h-2 rounded-full bg-red-500" />
          </div>
        </button>

        {/* FAQ */}
        <button
          onClick={() => setActiveModal('faq')}
          className="w-full py-3 px-2 flex items-center justify-between hover:text-white transition text-left text-slate-200 font-bold text-sm"
        >
          <span>{isAm ? 'ተደጋግመው የሚጠየቁ ጥያቄዎች (FAQ)' : 'Frequently Asked Questions (FAQ)'}</span>
        </button>

        {/* Send feedback */}
        <button
          onClick={() => setActiveModal('feedback')}
          className="w-full py-3 px-2 flex items-center justify-between hover:text-white transition text-left text-slate-200 font-bold text-sm"
        >
          <span>{isAm ? 'አስተያየት ይላኩ' : 'Send Feedback'}</span>
        </button>

        {/* Copyright infringement report */}
        <button
          onClick={() => setActiveModal('copyright')}
          className="w-full py-3 px-2 flex items-center justify-between hover:text-white transition text-left text-slate-200 font-bold text-sm"
        >
          <span>{isAm ? 'የቅጂ መብት ጥሰት ሪፖርት' : 'Copyright Infringement Report'}</span>
        </button>

        {/* About */}
        <button
          onClick={() => setActiveModal('about')}
          className="w-full py-3 px-2 flex items-center justify-between hover:text-white transition text-left text-slate-200 font-bold text-sm"
        >
          <span>{isAm ? 'ስለ መተግበሪያው' : 'About Application'}</span>
        </button>
      </div>

      {/* Extra Launch Utilities */}
      <div className="pt-4 space-y-2">
        <button
          onClick={onLaunchNightstand}
          className="w-full bg-[#1e2026] border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between text-left text-xs font-bold text-red-400 hover:border-red-500/40 transition"
        >
          <div className="flex items-center space-x-2">
            <Moon className="w-4 h-4" />
            <span>{isAm ? 'የአልጋ አጠገብ ሰዓት ሁነታን ክፈት' : 'Launch Nightstand Clock Mode'}</span>
          </div>
          <span>🌙</span>
        </button>

        <button
          onClick={onRelaunchTour}
          className="w-full bg-[#1e2026] border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between text-left text-xs font-bold text-red-400 hover:border-red-500/40 transition"
        >
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>{isAm ? 'የመተግበሪያ መመሪያውን እንደገና ክፈት' : 'Relaunch Setup Wizard Tour'}</span>
          </div>
          <span>🚀</span>
        </button>
      </div>

      {/* Dynamic Settings Modals */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="max-w-md w-full bg-[#18191d] border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-white space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold capitalize">{activeModal.replace('_', ' ')}</h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Account Modal */}
              {activeModal === 'account' && (
                <div className="space-y-4 text-xs text-slate-300">
                  <div className="flex items-center space-x-4 p-4 bg-slate-900 rounded-2xl border border-slate-800">
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl">
                      👤
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">Google Cloud Sync</div>
                      <p className="text-slate-400">Back up alarms, statistics, and habit streaks across devices.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsSignedIn(!isSignedIn);
                      setActiveModal(null);
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition text-xs"
                  >
                    {isSignedIn ? 'Sign Out' : 'Sign In with Google Account'}
                  </button>
                </div>
              )}

              {/* Pro Modal */}
              {activeModal === 'pro' && (
                <div className="space-y-4 text-xs text-slate-300">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-2xl">
                      👑
                    </div>
                    <h4 className="text-base font-bold text-white">{APP_NAME} Pro</h4>
                    <p className="text-slate-400">Unlock cheat prevention, custom MP3 uploads, and unlimited habit missions.</p>
                  </div>

                  <ul className="space-y-2 bg-slate-900 p-4 rounded-2xl border border-slate-800 font-medium">
                    <li className="flex items-center space-x-2 text-amber-400">
                      <span>✓</span> <span>30s Auto-Fade Volume Ramp</span>
                    </li>
                    <li className="flex items-center space-x-2 text-amber-400">
                      <span>✓</span> <span>Hard Nuclear & Airhorn Loud Ringtones</span>
                    </li>
                    <li className="flex items-center space-x-2 text-amber-400">
                      <span>✓</span> <span>Prevent Power-Off & Cheat Shield</span>
                    </li>
                  </ul>

                  <button
                    onClick={() => setActiveModal(null)}
                    className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl transition text-xs"
                  >
                    Start 7-Day Free Trial
                  </button>
                </div>
              )}

              {/* Theme Modal */}
              {activeModal === 'theme' && (
                <div className="space-y-2">
                  {['Dark Slate', 'Midnight AMOLED', 'Sunset Amber', 'Cosmic Indigo'].map((th) => (
                    <button
                      key={th}
                      onClick={() => {
                        setSelectedTheme(th);
                        setActiveModal(null);
                      }}
                      className={`w-full p-3.5 rounded-2xl border text-left font-bold text-xs flex items-center justify-between ${
                        selectedTheme === th
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span>{th}</span>
                      {selectedTheme === th && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Wake-up reliability: exact alarms, notifications, full-screen intent */}
              {activeModal === 'reliability' && (
                <WakeUpReliabilityModal language={language} onClose={() => setActiveModal(null)} />
              )}

              {/* Strict Volume Lock Modal */}
              {activeModal === 'volume_lock' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-2xl border bg-amber-500/10 border-amber-500/30 flex items-start space-x-3">
                    <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm text-amber-300">
                        {isAm ? 'የድምፅ መቀነሻ ተቆልፏል — ፈተናውን እስኪጨርሱ ድረስ' : 'Volume down is locked until the mission is solved'}
                      </div>
                      <p className="text-slate-300 mt-1 leading-relaxed">
                        {nativeLock
                          ? (isAm
                              ? 'ማንቂያው ሲደውል የስልኩ የድምፅ መቀነሻ፣ መጨመሪያ እና የዝምታ ቁልፎች እንዲሁም ተመለስ ቁልፍ አይሰሩም፣ ስክሪኑም ብርሃኑን አይቀንስም። መቆለፊያው ደውሎ ባለው አገልግሎት ስለሚያዝ መተግበሪያው ተዘግቶ ቢጀምርም ይሠራል። ለማጥፋት ፈተናውን መፍታት ግዴታ ነው።'
                              : 'While the alarm rings, the phone\'s volume-down, volume-up and mute buttons and the Back button do nothing, and the screen stays on. The block is held by the ringing service itself, so it also holds when the alarm was started with the app closed. The only way to switch the alarm off is to solve the mission.')
                          : (isAm
                              ? 'ማንቂያው ሲደውል የድምፅ መቀነሻ እና የዝምታ ቁልፎች ተይዘው አይሰሩም። ድምፅ መቀነስ ከሞከሩ ማንቂያው ይበልጥ ይጮሃል።'
                              : 'While the alarm rings, volume-down and mute keys are swallowed and ignored. Trying to turn the alarm down makes it louder instead.')}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border bg-slate-900 border-slate-800 space-y-2">
                    <div className="font-bold text-slate-200">
                      {isAm ? 'በማንቂያ ጊዜ የሚከለከሉ' : 'Blocked while ringing'}
                    </div>
                    {[
                      ...(nativeLock
                        ? [
                            isAm ? 'የስልኩ አካላዊ የድምፅ መቀነሻ / መጨመሪያ / ዝምታ ቁልፎች (በአንድሮይድ በቀጥታ ይታገዳሉ)' : 'Physical volume-down / volume-up / mute buttons (blocked natively on Android)',
                            isAm ? 'ተመለስ ቁልፍ — ከማንቂያ ገፁ መውጣት አይቻልም' : 'Back button — the alarm screen cannot be left',
                          ]
                        : []),
                      isAm ? 'የድምፅ መቀነሻ / ዝምታ ቁልፎች (keydown, capture phase)' : 'Volume-down / mute keys (keydown, capture phase)',
                      isAm ? 'የጆሮ ማዳመጫ እና የሎክ ስክሪን መቆጣጠሪያዎች (MediaSession)' : 'Headset & lock-screen transport controls (MediaSession)',
                      isAm ? 'የድምፅ ማቀፊያ መቆም (AudioContext watchdog በየ200ms)' : 'AudioContext suspension / background throttling (200 ms watchdog)',
                      isAm ? 'የቪዲዮ/ድምፅ ኤለመንት mute እና volume መቀነስ' : 'Media element mute / volume reduction',
                      isAm ? 'በፈተና ሳይጠናቀቅ snooze ማድረግ' : 'Snoozing before the mission is solved',
                      // The unload prompt only exists in browsers; an Android WebView shows none, and
                      // nothing stops the user swiping the app away, so do not claim it there.
                      ...(nativeLock
                        ? []
                        : [isAm ? 'ማንቂያው እየደወለ ገፁን መዝጋት/መጫን' : 'Closing or reloading the page while ringing']),
                    ].map((item) => (
                      <div key={item} className="flex items-start space-x-2 text-slate-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-2xl border bg-slate-900 border-slate-800 space-y-2">
                    <div className="font-bold text-slate-200">
                      {isAm ? 'የድምፅ ጭማሪ ደረጃዎች' : 'Loudness escalation ladder'}
                    </div>
                    {[
                      isAm ? '0-30 ሰከንድ — የተቀመጠው ድምፅ' : '0-30 s — configured volume',
                      isAm ? '30 ሰከንድ — ከፍተኛ ጩኸት (+15%)' : '30 s — maximum gain (+15%)',
                      isAm ? '60 ሰከንድ — አስደንጋጭ ሲረን ይጨመራል' : '60 s — piercing siren layer added',
                      isAm ? '90 ሰከንድ — ሲረን + ከፍተኛ ጩኸት' : '90 s — siren + maximum gain',
                    ].map((item, i) => (
                      <div key={item} className="flex items-start space-x-2 text-slate-300">
                        <span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5 ${
                          ['bg-emerald-500/20 text-emerald-300', 'bg-amber-500/20 text-amber-300', 'bg-orange-500/20 text-orange-300', 'bg-rose-500/20 text-rose-300'][i]
                        }`}>{i}</span>
                        <span className="leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Honest platform limitation */}
                  <div className="p-4 rounded-2xl border bg-rose-500/10 border-rose-500/30">
                    <div className="font-bold text-rose-300 flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4" />
                      <span>{isAm ? 'ግልጽ ማብራሪያ' : 'Honest limitation'}</span>
                    </div>
                    <p className="text-slate-300 mt-1.5 leading-relaxed">
                      {nativeLock
                        ? (isAm
                            ? 'የHome፣ Recents እና የኃይል (power) ቁልፎች የአንድሮይድ ስርዓት ስለሆኑ አፕ ሊከለክላቸው አይችልም። ማንቂያው ሲጮህ ስክሪኑ ጠፍቶ ከሆነ ወይም Niqu በስክሪኑ ላይ ካልሆነ፣ የድምፅ ቁልፎችን ስርዓቱ ራሱ ይቆጣጠራቸዋል። ማንቂያውን በሚጠብቁበት ጊዜ መተግበሪያውን ክፍት እና ስክሪኑን አብርተው ያቆዩት።'
                            : 'Android itself owns the Home, Recents and power buttons, so no app can block those. If the screen is off or Niqu is not on screen when the alarm rings, the system handles the volume keys itself. While you wait for an alarm, keep the app open with the screen on.')
                        : (isAm
                            ? 'የስልኩ አካላዊ የድምፅ ቁልፍ (volume rocker) በስርዓቱ ላይ በቀጥታ ስለሚሰራ የዌብ መተግበሪያ ሊይዘው አይችልም። ይህ የሚቻለው በአንድሮይድ መተግበሪያው ብቻ ነው። ስለዚህ እዚህ መተግበሪያው የሚችለውን ሁሉ ይቆልፋል፣ እንዲሁም ድምፅ ሲቀነስ ማንቂያውን የበለጠ ያጮሃል፣ ሲረን ይጨምራል፣ ስክሪኑን አብርቶ ይይዛል እና ስልኩ ይንቀጠቀጣል።'
                            : 'The phone\'s physical volume rocker is handled by the operating system before the page ever sees it, so a web page cannot block it — only the Android app can. In a browser this app therefore blocks everything a browser exposes, and when the alarm is silenced it fights back: louder gain, a siren layer, a held screen wake lock and repeated vibration.')}
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveModal(null)}
                    className="w-full bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl font-bold text-white transition"
                  >
                    {isAm ? 'ገባኝ' : 'Got it'}
                  </button>
                </div>
              )}

              {/* Sound Output Modal */}
              {activeModal === 'sound_output' && (
                <div className="space-y-2">
                  {['Current device', 'Bluetooth Headset', 'Loud Speakerphone'].map((so) => (
                    <button
                      key={so}
                      onClick={() => {
                        setSoundOutput(so);
                        setActiveModal(null);
                      }}
                      className={`w-full p-3.5 rounded-2xl border text-left font-bold text-xs flex items-center justify-between ${
                        soundOutput === so
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span>{so}</span>
                      {soundOutput === so && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Notifications Modal */}
              {activeModal === 'notifications' && (
                <div className="space-y-4 text-xs">
                  {/* System Notification Status Banner */}
                  <div className="p-4 rounded-2xl border bg-slate-900 border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 font-bold text-sm text-white">
                        <BellRing className="w-5 h-5 text-amber-400" />
                        <span>Browser Notification Permission</span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          notifStatus.permission === 'granted'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : notifStatus.permission === 'denied'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        {notifStatus.permission}
                      </span>
                    </div>

                    <p className="text-slate-400 leading-relaxed">
                      Allowing browser notifications lets {APP_NAME} ring and pop up desktop alerts even when the tab is running in the background.
                    </p>

                    {notifStatus.permission !== 'granted' ? (
                      <button
                        type="button"
                        onClick={handleAllowNotifications}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl transition flex items-center justify-center space-x-2 text-xs shadow-lg shadow-amber-500/20"
                      >
                        <Bell className="w-4 h-4 fill-slate-950" />
                        <span>Allow Browser Notifications</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendTestNotif}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-bold py-2.5 rounded-xl transition flex items-center justify-center space-x-2 text-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Test Notification</span>
                      </button>
                    )}

                    {testSentMsg && (
                      <div className="p-2.5 bg-slate-950 rounded-xl text-amber-400 font-medium text-[11px] text-center border border-amber-500/20">
                        {testSentMsg}
                      </div>
                    )}
                  </div>

                  {/* Additional Notification Toggles */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <div>
                        <div className="font-bold text-slate-200">Service Notifications</div>
                        <div className="text-[10px] text-slate-400">Alarm trigger banners & status alerts</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={serviceNotifications}
                          onChange={(e) => setServiceNotifications(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <div>
                        <div className="font-bold text-slate-200">Promotion & Updates</div>
                        <div className="text-[10px] text-slate-400">New ringtones, wallpaper & feature releases</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={promotionsUpdates}
                          onChange={(e) => setPromotionsUpdates(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* System Config Modal */}
              {activeModal === 'system_config' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400">Select Language / ቋንቋ</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setLanguage('en')}
                        className={`p-3 rounded-xl border text-xs font-bold ${
                          language === 'en'
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        English
                      </button>
                      <button
                        onClick={() => setLanguage('am')}
                        className={`p-3 rounded-xl border text-xs font-bold ${
                          language === 'am'
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        አማርኛ (Amharic)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* About Modal */}
              {activeModal === 'about' && (
                <div className="space-y-3 text-xs text-slate-300 text-center">
                  <AppMark className="w-16 h-16 mx-auto" />
                  <h4 className="font-bold text-sm text-white">{APP_NAME} v{APP_VERSION}</h4>
                  <p className="text-slate-400">Built with React, Vite, and Web Audio API.</p>
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveModal(null)}
                      className="w-full bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl font-bold text-white transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Generic fallback for FAQ, Notices, Feedback, Advanced, Optimization */}
              {!['account', 'pro', 'theme', 'sound_output', 'system_config', 'notifications', 'about', 'reliability', 'volume_lock'].includes(activeModal) && (
                <div className="space-y-3 text-xs text-slate-300">
                  <p>Configuration updated successfully for {activeModal.replace('_', ' ')}.</p>
                  <button
                    onClick={() => setActiveModal(null)}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl transition"
                  >
                    OK
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
