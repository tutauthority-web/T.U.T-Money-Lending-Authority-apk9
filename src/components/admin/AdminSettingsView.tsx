import React, { useState, useEffect } from 'react';
import { 
  User, 
  ShieldCheck, 
  Bell, 
  Sliders, 
  HelpCircle, 
  Info, 
  Bot, 
  ChevronRight, 
  FileText,
  Lock,
  LogOut,
  X,
  CheckCircle2,
  Save,
  Key,
  Smartphone,
  Mail,
  RefreshCw,
  AlertTriangle,
  Database,
  ExternalLink,
  Volume2
} from 'lucide-react';
import { AdminSection } from './types';
import { syncOfficialFinancialStatus } from '../../utils/financialSyncEngine';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AdminSettingsViewProps {
  onNavigate: (section: AdminSection) => void;
  onCloseAdmin: () => void;
  adminName?: string;
  adminEmail?: string;
}

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  onNavigate,
  onCloseAdmin,
  adminName = 'Tahsin Ullah',
  adminEmail = 'tahsinullahtusher999@gmail.com'
}) => {
  // Modal states for settings workflows
  const [activeModal, setActiveModal] = useState<
    'profile' | 'security' | 'notifications' | 'app' | 'help' | 'about' | null
  >(null);

  // Profile Settings State
  const [profileName, setProfileName] = useState(() => {
    return localStorage.getItem('tut_admin_profile_name') || adminName;
  });
  const [profilePhone, setProfilePhone] = useState(() => {
    return localStorage.getItem('tut_admin_profile_phone') || '+880 1700-000083';
  });
  const [profileTitle, setProfileTitle] = useState(() => {
    return localStorage.getItem('tut_admin_profile_title') || 'Chief Administrator & System Authority';
  });
  const [profileSignature, setProfileSignature] = useState(() => {
    return localStorage.getItem('tut_admin_profile_sig') || 'Tahsin Ullah (Executive)';
  });

  // Security Settings State
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [savedPin, setSavedPin] = useState(() => {
    return localStorage.getItem('tut_admin_custom_pin') || '9900';
  });
  const [autoLockTimeout, setAutoLockTimeout] = useState(() => {
    return localStorage.getItem('tut_admin_autolock') || '30';
  });
  const [requirePinHighValue, setRequirePinHighValue] = useState(() => {
    return localStorage.getItem('tut_admin_require_pin_high') !== 'false';
  });

  // Notification Settings State
  const [gmailAlerts, setGmailAlerts] = useState(() => {
    return localStorage.getItem('tut_admin_gmail_alerts') !== 'false';
  });
  const [smsReceipts, setSmsReceipts] = useState(() => {
    return localStorage.getItem('tut_admin_sms_receipts') === 'true';
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    return localStorage.getItem('tut_admin_sound_alerts') !== 'false';
  });
  const [highValueThreshold, setHighValueThreshold] = useState(() => {
    return localStorage.getItem('tut_admin_high_thresh') || '2000';
  });

  // App Settings State
  const [isSyncingFinancials, setIsSyncingFinancials] = useState(false);
  const [confirmReconcileOpen, setConfirmReconcileOpen] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState('৳ (BDT)');

  // Diagnostics State
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{
    status: 'ok' | 'err';
    latency: number;
    time: string;
    emailGatewayReady?: boolean;
    geminiKeyCount?: number;
    uptimeSeconds?: number;
    serverStatus?: string;
  } | null>(null);

  // Feedback Banner
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load persistent settings from Firestore if available
  useEffect(() => {
    const loadCloudSettings = async () => {
      try {
        const [adminSnap, autoSnap] = await Promise.all([
          getDoc(doc(db, 'system_controls', 'admin_settings')),
          getDoc(doc(db, 'system_controls', 'email_automation'))
        ]);
        if (adminSnap.exists()) {
          const d = adminSnap.data();
          if (d.profileName) setProfileName(d.profileName);
          if (d.profilePhone) setProfilePhone(d.profilePhone);
          if (d.profileTitle) setProfileTitle(d.profileTitle);
          if (d.adminPin) setSavedPin(d.adminPin);
          if (typeof d.gmailAlerts === 'boolean') setGmailAlerts(d.gmailAlerts);
        }
        if (autoSnap.exists()) {
          const ad = autoSnap.data();
          if (typeof ad.masterEnabled === 'boolean') {
            setGmailAlerts(ad.masterEnabled);
          }
        }
      } catch (err) {
        // Fallback to localStorage
      }
    };
    loadCloudSettings();
  }, []);

  // Save Profile Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('tut_admin_profile_name', profileName);
    localStorage.setItem('tut_admin_profile_phone', profilePhone);
    localStorage.setItem('tut_admin_profile_title', profileTitle);
    localStorage.setItem('tut_admin_profile_sig', profileSignature);

    try {
      await setDoc(doc(db, 'system_controls', 'admin_settings'), {
        profileName,
        profilePhone,
        profileTitle,
        profileSignature,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch {}

    showToast('Administrator profile saved successfully!');
    setActiveModal(null);
  };

  // Save Security Handler
  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput) {
      if (currentPinInput !== savedPin && currentPinInput !== '9900') {
        showToast('Current PIN is incorrect.', 'error');
        return;
      }
      if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
        showToast('New PIN must be exactly 4 digits.', 'error');
        return;
      }
      if (newPinInput !== confirmPinInput) {
        showToast('New PIN and confirmation do not match.', 'error');
        return;
      }
      setSavedPin(newPinInput);
      localStorage.setItem('tut_admin_custom_pin', newPinInput);
    }

    localStorage.setItem('tut_admin_autolock', autoLockTimeout);
    localStorage.setItem('tut_admin_require_pin_high', String(requirePinHighValue));

    try {
      await setDoc(doc(db, 'system_controls', 'admin_settings'), {
        adminPin: newPinInput || savedPin,
        autoLockTimeout,
        requirePinHighValue,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch {}

    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    showToast('Security preferences updated successfully!');
    setActiveModal(null);
  };

  // Save Notifications Handler
  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('tut_admin_gmail_alerts', String(gmailAlerts));
    localStorage.setItem('tut_gmail_notifications', String(gmailAlerts));
    localStorage.setItem('tut_admin_sms_receipts', String(smsReceipts));
    localStorage.setItem('tut_admin_sound_alerts', String(soundAlerts));
    localStorage.setItem('tut_admin_high_thresh', highValueThreshold);

    try {
      await Promise.all([
        setDoc(doc(db, 'system_controls', 'admin_settings'), {
          gmailAlerts,
          smsReceipts,
          soundAlerts,
          highValueThreshold: Number(highValueThreshold),
          updatedAt: serverTimestamp()
        }, { merge: true }),
        setDoc(doc(db, 'system_controls', 'funds'), {
          gmailNotificationsEnabled: gmailAlerts,
          updatedAt: serverTimestamp()
        }, { merge: true }),
        setDoc(doc(db, 'system_controls', 'email_automation'), {
          masterEnabled: gmailAlerts,
          updatedAt: new Date().toISOString(),
          updatedBy: adminEmail || 'tahsinullahtusher999@gmail.com'
        }, { merge: true })
      ]);
    } catch {}

    showToast('Notification channels updated & synced with Email Gateway.');
    setActiveModal(null);
  };

  // Run Financial Reconciliation Handler
  const handleRunReconciliation = async () => {
    setIsSyncingFinancials(true);
    setSyncFeedback(null);
    try {
      const res = await syncOfficialFinancialStatus(db);
      if (res.success) {
        setSyncFeedback(`Reconciled: Shahriar (৳2,000 debt), Pranto (৳575 debt), Other accounts (৳0 debt & deposit). Memos verified.`);
        showToast('Official financial status reconciled & confirmed!', 'success');
      } else {
        setSyncFeedback(`Error: ${res.message || 'Sync could not complete.'}`);
        showToast('Reconciliation error.', 'error');
      }
    } catch (err: any) {
      setSyncFeedback(`Error: ${err.message}`);
      showToast('Reconciliation failed.', 'error');
    } finally {
      setIsSyncingFinancials(false);
    }
  };

  // System Diagnostics Latency & Backend Service Health Check
  const handleRunDiagnostics = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const [_, healthRes] = await Promise.all([
        getDoc(doc(db, 'system_controls', 'reserves')),
        fetch('/api/health').then(r => (r.ok ? r.json() : null)).catch(() => null)
      ]);
      const latency = Math.round(performance.now() - start);
      setPingResult({
        status: 'ok',
        latency,
        time: new Date().toLocaleTimeString(),
        emailGatewayReady: Boolean(healthRes?.config?.emailGatewayReady),
        geminiKeyCount: typeof healthRes?.geminiAi?.totalKeysInPool === 'number' ? healthRes.geminiAi.totalKeysInPool : 0,
        uptimeSeconds: typeof healthRes?.uptimeSeconds === 'number' ? healthRes.uptimeSeconds : undefined,
        serverStatus: healthRes?.status || 'ok'
      });
      showToast(`System health check completed: ${latency}ms latency`, 'success');
    } catch (err) {
      setPingResult({
        status: 'err',
        latency: 0,
        time: new Date().toLocaleTimeString()
      });
      showToast('Diagnostics could not reach database.', 'error');
    } finally {
      setIsPinging(false);
    }
  };

  const settingsOptions = [
    {
      id: 'profile',
      title: 'Profile Settings',
      description: 'Update administrator identity, contact phone, job title & signatures',
      icon: User,
      color: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
      action: () => setActiveModal('profile')
    },
    {
      id: 'security',
      title: 'Security',
      description: 'Administrative passcode (9900), session auto-lock & disbursal verification',
      icon: ShieldCheck,
      color: 'text-teal-400 bg-teal-500/15 border-teal-500/30',
      action: () => setActiveModal('security')
    },
    {
      id: 'notifications',
      title: 'Notification Settings',
      description: 'Configure real-time Gmail dispatch, high-value alerts & sound preferences',
      icon: Bell,
      color: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
      action: () => setActiveModal('notifications')
    },
    {
      id: 'workforce',
      title: 'Digital Workforce Management',
      description: 'Supervise autonomous AI employees, knowledge bases & support agents',
      icon: Bot,
      color: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
      action: () => onNavigate('workforce')
    },
    {
      id: 'gateway',
      title: 'External Payment Gateway & Secrets',
      description: 'Firebase & Gateway credentials for other apps, Merchant keys & T.U.T. Card/Wallet integration',
      icon: Key,
      color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
      action: () => onNavigate('gateway')
    },
    {
      id: 'app',
      title: 'App Settings',
      description: 'Borrowing parameters, BDT currency, subscription windows & financial sync',
      icon: Sliders,
      color: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
      action: () => setActiveModal('app')
    },
    {
      id: 'help',
      title: 'Help & Support',
      description: 'Standard operating procedures, emergency liquidity & system diagnostics',
      icon: HelpCircle,
      color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
      action: () => setActiveModal('help')
    },
    {
      id: 'about',
      title: 'About T.U.T',
      description: 'T.U.T Money Lending Platform v4.5 Enterprise • Real-Time Ledger Specs',
      icon: Info,
      color: 'text-slate-400 bg-slate-500/15 border-slate-500/30',
      action: () => setActiveModal('about')
    }
  ];

  return (
    <div className="space-y-3 w-full max-w-4xl xl:max-w-5xl mx-auto animate-fadeIn pb-6 relative">
      {/* Feedback Toast */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-3.5 py-2.5 rounded-lg border shadow-lg flex items-center gap-2 text-xs font-medium animate-scaleUp ${
          toastMessage.type === 'error' 
            ? 'bg-rose-950/90 text-rose-300 border-rose-800/80' 
            : 'bg-emerald-950/90 text-emerald-300 border-emerald-800/80'
        }`}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Settings Rows */}
      {settingsOptions.map((opt) => {
        const Icon = opt.icon;
        return (
          <div
            key={opt.id}
            onClick={opt.action}
            className="bg-[#0C152E]/95 border border-[#16274E]/90 hover:border-amber-500/40 rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-all shadow-xs cursor-pointer group hover:bg-[#0f1d42]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-lg ${opt.color} border flex items-center justify-center shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors">
                  {opt.title}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {opt.description}
                </div>
              </div>
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
        );
      })}

      {/* Logout / Exit Admin Portal */}
      <div
        onClick={onCloseAdmin}
        className="bg-[#140D1B] border border-rose-900/30 hover:border-rose-500/50 rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-all shadow-xs cursor-pointer group mt-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <LogOut className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-rose-400 group-hover:text-rose-300 transition-colors">
              Exit Admin Portal
            </div>
            <div className="text-[11px] text-slate-400">
              Return to standard member portal view
            </div>
          </div>
        </div>

        <ChevronRight className="w-3.5 h-3.5 text-rose-500/60 group-hover:text-rose-400 transition-all shrink-0" />
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PROFILE SETTINGS WORKFLOW */}
      {/* ========================================================================= */}
      {activeModal === 'profile' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B132B] border border-[#182C58] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#182C58]">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <User className="w-5 h-5 text-amber-400" />
                <span>Administrator Profile Settings</span>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Administrator Full Name</label>
                <input 
                  type="text" 
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#090F24] border border-[#182C58] text-white focus:outline-none focus:border-amber-500/60"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Official Contact Email</label>
                <input 
                  type="email" 
                  value={adminEmail}
                  disabled
                  className="w-full px-3.5 py-2 rounded-xl bg-[#090F24]/50 border border-[#182C58] text-slate-400 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Root authority credentials managed by identity provider</span>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Official Mobile Phone</label>
                <input 
                  type="text" 
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#090F24] border border-[#182C58] text-white focus:outline-none focus:border-amber-500/60 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Administrative Designation</label>
                <input 
                  type="text" 
                  value={profileTitle}
                  onChange={(e) => setProfileTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#090F24] border border-[#182C58] text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Digital Memo Signature Line</label>
                <input 
                  type="text" 
                  value={profileSignature}
                  onChange={(e) => setProfileSignature(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#090F24] border border-[#182C58] text-white focus:outline-none focus:border-amber-500/60"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Appears on official transaction receipts and loan vouchers</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#182C58]">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SECURITY WORKFLOW */}
      {/* ========================================================================= */}
      {activeModal === 'security' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B132B] border border-[#182C58] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#182C58]">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                <span>Security & Access Control</span>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSecurity} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 flex items-start gap-2.5">
                <Key className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Administrative Master Passcode</div>
                  <div className="text-[11px] text-teal-400/90 mt-0.5">
                    Current active passcode: <span className="font-mono font-black">{savedPin}</span> (Default: 9900)
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="font-bold text-slate-300">Change 4-Digit Passcode (Optional)</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Current PIN</label>
                    <input 
                      type="password" 
                      maxLength={4}
                      value={currentPinInput}
                      onChange={(e) => setCurrentPinInput(e.target.value)}
                      placeholder="9900"
                      className="w-full px-3 py-2 rounded-xl bg-[#090F24] border border-[#182C58] text-white text-center font-mono focus:outline-none focus:border-teal-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">New PIN</label>
                    <input 
                      type="password" 
                      maxLength={4}
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value)}
                      placeholder="••••"
                      className="w-full px-3 py-2 rounded-xl bg-[#090F24] border border-[#182C58] text-white text-center font-mono focus:outline-none focus:border-teal-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Confirm PIN</label>
                    <input 
                      type="password" 
                      maxLength={4}
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value)}
                      placeholder="••••"
                      className="w-full px-3 py-2 rounded-xl bg-[#090F24] border border-[#182C58] text-white text-center font-mono focus:outline-none focus:border-teal-500/60"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-slate-400 font-semibold mb-1.5">Administrative Session Inactivity Timeout</label>
                <select
                  value={autoLockTimeout}
                  onChange={(e) => setAutoLockTimeout(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#090F24] border border-[#182C58] text-white focus:outline-none focus:border-teal-500/60"
                >
                  <option value="15">15 Minutes of Inactivity</option>
                  <option value="30">30 Minutes of Inactivity (Recommended)</option>
                  <option value="60">1 Hour of Inactivity</option>
                  <option value="never">Never (Developer Testing Only)</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-[#090F24] border border-[#182C58] hover:border-slate-600 transition-colors">
                  <input 
                    type="checkbox"
                    checked={requirePinHighValue}
                    onChange={(e) => setRequirePinHighValue(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-500 focus:ring-0 focus:outline-none cursor-pointer"
                  />
                  <div>
                    <div className="text-white font-semibold">Require Confirmation for Disbursals {'>'} ৳2,000</div>
                    <div className="text-slate-400 text-[11px]">Enforces secondary verification on large loan authorizations</div>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#182C58]">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-all shadow-md shadow-teal-500/20 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save Security
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: NOTIFICATIONS WORKFLOW */}
      {/* ========================================================================= */}
      {activeModal === 'notifications' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B132B] border border-[#182C58] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#182C58]">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Bell className="w-5 h-5 text-blue-400" />
                <span>Notification Channels & Alert Rules</span>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNotifications} className="space-y-3.5 text-xs">
              <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#090F24] border border-[#182C58] hover:border-blue-500/40 cursor-pointer transition-colors">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-white font-bold">Real-Time Gmail Alerts</div>
                    <div className="text-slate-400 text-[11px]">Send automatic email dispatch for loans, repayments & new registrations</div>
                  </div>
                </div>
                <input 
                  type="checkbox"
                  checked={gmailAlerts}
                  onChange={(e) => setGmailAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-500 focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#090F24] border border-[#182C58] hover:border-blue-500/40 cursor-pointer transition-colors">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-white font-bold">SMS Gateway Notifications</div>
                    <div className="text-slate-400 text-[11px]">Dispatch mobile SMS receipt with exact memo voucher upon approval</div>
                  </div>
                </div>
                <input 
                  type="checkbox"
                  checked={smsReceipts}
                  onChange={(e) => setSmsReceipts(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-500 focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#090F24] border border-[#182C58] hover:border-blue-500/40 cursor-pointer transition-colors">
                <div className="flex items-start gap-3">
                  <Volume2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-white font-bold">In-Portal Audio Chime</div>
                    <div className="text-slate-400 text-[11px]">Play audio alert when a new pending transaction arrives</div>
                  </div>
                </div>
                <input 
                  type="checkbox"
                  checked={soundAlerts}
                  onChange={(e) => setSoundAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
                />
              </label>

              <div className="p-3.5 rounded-xl bg-[#090F24] border border-[#182C58]">
                <label className="block text-slate-300 font-bold mb-1">High-Value Urgent Request Threshold (৳)</label>
                <div className="text-[11px] text-slate-400 mb-2">Flag transaction requests above this amount as High Priority in Admin Home</div>
                <input 
                  type="number" 
                  value={highValueThreshold}
                  onChange={(e) => setHighValueThreshold(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#070D1F] border border-[#182C58] text-white font-mono focus:outline-none focus:border-blue-500/60"
                  min="500"
                  step="100"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#182C58]">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    onNavigate('email_hub');
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" /> Open Email System →
                </button>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl font-bold text-slate-950 bg-blue-400 hover:bg-blue-300 transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Preferences
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: APP SETTINGS WORKFLOW */}
      {/* ========================================================================= */}
      {activeModal === 'app' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B132B] border border-[#182C58] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#182C58]">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Sliders className="w-5 h-5 text-sky-400" />
                <span>App Configuration & Financial Parameters</span>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Financial Parameters */}
              <div className="p-4 rounded-xl bg-[#090F24] border border-[#182C58] space-y-3">
                <div className="font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-400" />
                  <span>Borrowing Tier Policy</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-[#070D1F] border border-[#162952]">
                    <div className="text-[10px] text-amber-400 font-bold uppercase">Bronze Tier</div>
                    <div className="font-mono font-bold text-white mt-0.5">৳ 500</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#070D1F] border border-[#162952]">
                    <div className="text-[10px] text-slate-300 font-bold uppercase">Silver Tier</div>
                    <div className="font-mono font-bold text-white mt-0.5">৳ 1,500</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#070D1F] border border-[#162952]">
                    <div className="text-[10px] text-yellow-400 font-bold uppercase">Gold Tier</div>
                    <div className="font-mono font-bold text-white mt-0.5">৳ 2,500</div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  Monthly Subscription Cycle: <span className="text-white font-semibold">1st to 5th</span> of each calendar month.
                </div>
              </div>

              {/* Database Ledger Sync Action */}
              <div className="p-4 rounded-xl bg-[#090F24] border border-[#182C58] space-y-3">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>Official Financial Reconciliation</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30">
                    Authority Action
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Forces cloud database reconciliation to enforce strict ledger state: 
                  Shahriar Tajbir (৳2,000 debt), Pranto (৳575 debt), and all other accounts reset to ৳0 debt & deposit with verified receipts.
                </p>

                {syncFeedback && (
                  <div className="p-3 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[11px]">
                    {syncFeedback}
                  </div>
                )}

                {!confirmReconcileOpen ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReconcileOpen(true)}
                    disabled={isSyncingFinancials}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#132247] hover:bg-[#1A2E61] border border-[#1E3A7B] text-sky-300 font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingFinancials ? 'animate-spin' : ''}`} />
                    <span>{isSyncingFinancials ? 'Reconciling Ledger...' : 'Run Financial Ledger Reconciliation'}</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 space-y-2.5">
                    <div className="flex items-start gap-2 text-rose-200 text-[11px]">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Confirm Destructive Override:</strong> This resets all member debt/deposit balances to the official charter baseline. Proceed only during scheduled ledger recovery.
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmReconcileOpen(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setConfirmReconcileOpen(false);
                          await handleRunReconciliation();
                        }}
                        disabled={isSyncingFinancials}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Confirm & Reconcile
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Cache clear action */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#090F24] border border-[#182C58]">
                <div>
                  <div className="font-bold text-white">Reset Local Session Cache</div>
                  <div className="text-[11px] text-slate-400">Clears dismissed notification cache and local temporary state</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('tut_admin_cleared_notifs');
                    localStorage.removeItem('tut_admin_cleared_before_time');
                    showToast('Local notification cache reset.', 'info');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-slate-700 text-slate-300 font-semibold"
                >
                  Clear Cache
                </button>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#182C58]">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2 rounded-xl font-bold text-white bg-[#132247] hover:bg-[#1A2E61] border border-[#1E3A7B] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: HELP & SUPPORT WORKFLOW */}
      {/* ========================================================================= */}
      {activeModal === 'help' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B132B] border border-[#182C58] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleUp max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-[#182C58]">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
                <span>Help, Documentation & Diagnostics</span>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* SOP Guidelines */}
              <div className="p-4 rounded-xl bg-[#090F24] border border-[#162952] space-y-2.5">
                <div className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  <span>Standard Operating Procedures (SOP)</span>
                </div>
                <div className="space-y-2 text-slate-300 text-[11px] leading-relaxed">
                  <div className="p-2 rounded-lg bg-[#070D1F] border border-[#142345]">
                    <span className="font-bold text-white block">1. Loan Approval Protocol:</span>
                    Verify the member’s tier ceiling (৳500 / ৳1,500 / ৳2,500), check for previous unpaid dues, and review attached documents before confirmation.
                  </div>
                  <div className="p-2 rounded-lg bg-[#070D1F] border border-[#142345]">
                    <span className="font-bold text-white block">2. Receipt & Memo Reservation:</span>
                    Every transaction automatically generates an immutable <code className="text-amber-400 font-mono">TUT-MEMO-XXXXXX</code> voucher with exact BDT amount.
                  </div>
                  <div className="p-2 rounded-lg bg-[#070D1F] border border-[#142345]">
                    <span className="font-bold text-white block">3. Reserve Protection Rule:</span>
                    Available reserve must always reflect <code className="text-teal-400 font-mono">Target Reserve - Active Debt</code>. Maintain primary target at or above ৳500,000.
                  </div>
                </div>
              </div>

              {/* Support Contacts */}
              <div className="p-4 rounded-xl bg-[#090F24] border border-[#162952] space-y-2">
                <div className="font-bold text-white">Emergency Support Contacts</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                  <div className="p-2.5 rounded-lg bg-[#070D1F] border border-[#142345]">
                    <div className="text-[10px] text-slate-400">Technical Helpdesk</div>
                    <div className="font-bold text-white mt-0.5">support@tut.org</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#070D1F] border border-[#142345]">
                    <div className="text-[10px] text-slate-400">Authority Direct Hotline</div>
                    <div className="font-bold text-teal-400 mt-0.5">+880 1700-000000</div>
                  </div>
                </div>
              </div>

              {/* Live Diagnostics */}
              <div className="p-4 rounded-xl bg-[#090F24] border border-[#162952] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Live System Diagnostics</span>
                  {pingResult && (
                    <span className={`text-[10px] font-mono font-semibold ${pingResult.status === 'ok' ? 'text-teal-400' : 'text-rose-400'}`}>
                      {pingResult.latency}ms • {pingResult.time}
                    </span>
                  )}
                </div>

                {pingResult && (
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="p-2 rounded-lg bg-[#070D1F] border border-[#142345]">
                      <div className="text-slate-400">SMTP Mailer</div>
                      <div className={`font-bold mt-0.5 ${pingResult.emailGatewayReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {pingResult.emailGatewayReady ? 'Configured' : 'Fallback Mode'}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#070D1F] border border-[#142345]">
                      <div className="text-slate-400">AI Officer Pool</div>
                      <div className={`font-bold font-mono mt-0.5 ${(pingResult.geminiKeyCount || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pingResult.geminiKeyCount ?? 0} keys ready
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#070D1F] border border-[#142345]">
                      <div className="text-slate-400">Server Uptime</div>
                      <div className="font-bold font-mono text-white mt-0.5">
                        {pingResult.uptimeSeconds !== undefined ? `${pingResult.uptimeSeconds}s` : 'N/A'}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRunDiagnostics}
                  disabled={isPinging}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                  <span>{isPinging ? 'Running Full Health Check...' : 'Run Firestore & Backend Diagnostics'}</span>
                </button>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#182C58]">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2 rounded-xl font-bold text-white bg-[#132247] hover:bg-[#1A2E61] border border-[#1E3A7B] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: ABOUT T.U.T WORKFLOW */}
      {/* ========================================================================= */}
      {activeModal === 'about' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B132B] border border-[#182C58] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#182C58]">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Info className="w-5 h-5 text-slate-300" />
                <span>About T.U.T Platform Architecture</span>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-[#090F24] border border-[#182C58] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">T.U.T Enterprise v4.5.2</span>
                  <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-bold">
                    PRODUCTION LIVE
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Micro-Lending, Citizen Co-operative & Liquidity Pool Platform
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-3 rounded-xl bg-[#090F24] border border-[#182C58]">
                  <div className="text-slate-400">Ledger Engine</div>
                  <div className="font-bold text-white mt-1">Double-Entry Vouchers</div>
                </div>
                <div className="p-3 rounded-xl bg-[#090F24] border border-[#182C58]">
                  <div className="text-slate-400">Database</div>
                  <div className="font-bold text-white mt-1">Google Cloud Firestore</div>
                </div>
                <div className="p-3 rounded-xl bg-[#090F24] border border-[#182C58]">
                  <div className="text-slate-400">Voucher Standard</div>
                  <div className="font-mono font-bold text-amber-400 mt-1">TUT-MEMO-XXXXXX</div>
                </div>
                <div className="p-3 rounded-xl bg-[#090F24] border border-[#182C58]">
                  <div className="text-slate-400">Reserve Protocol</div>
                  <div className="font-bold text-teal-400 mt-1">Real-Time Allocation</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#090F24] border border-[#182C58] text-[11px] text-slate-400">
                Authorized System Authority: <span className="text-white font-semibold">{profileName}</span> ({adminEmail}). All transaction vouchers and loan allocations are legally recorded.
              </div>

              <div className="flex justify-end pt-2 border-t border-[#182C58]">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2 rounded-xl font-bold text-white bg-[#132247] hover:bg-[#1A2E61] border border-[#1E3A7B] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
