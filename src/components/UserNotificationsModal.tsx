import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Settings, 
  ArrowRight, 
  CreditCard, 
  PiggyBank, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  X, 
  Search, 
  Award, 
  Send, 
  AlertCircle,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  Mail,
  MailCheck,
  MailQuestion,
  RefreshCw,
  Lock,
  Shield,
  Check,
  Sliders,
  Zap
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile } from '../App';
import { 
  UserNotificationItem, 
  NotificationCategoryPreferences, 
  safeToEpoch, 
  safeFormatDate, 
  safeFormatDistanceToNow,
  generateUserNotifications,
  notifyNotificationsChanged
} from '../utils/userNotificationsEngine';

export type { UserNotificationItem };

interface UserNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  transactions?: any[];
  onNavigateTab?: (tab: 'dashboard' | 'memos' | 'subscription' | 'partners' | 'profile' | 'wallets') => void;
  onRequestAction?: (type: 'loan' | 'deposit' | 'refund' | 'pay_due' | 'transfer' | 'subscription') => void;
  notificationPermission?: NotificationPermission;
  onRequestPermission?: () => void;
  addToast?: (title: string, msg: string, type: 'success' | 'warning' | 'info') => void;
  onUpdateEmailNotifications?: (enabled: boolean) => Promise<void>;
  onSendTestEmail?: (email: string) => Promise<boolean>;
}

export const UserNotificationsModal: React.FC<UserNotificationsModalProps> = ({
  isOpen,
  onClose,
  profile,
  transactions = [],
  onNavigateTab,
  onRequestAction,
  notificationPermission = 'default',
  onRequestPermission,
  addToast,
  onUpdateEmailNotifications,
  onSendTestEmail
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'financial' | 'charter' | 'security'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // Email Notification Toggle State
  const [emailEnabled, setEmailEnabled] = useState<boolean>(() => {
    return profile?.emailNotificationsEnabled !== false;
  });

  useEffect(() => {
    if (profile) {
      setEmailEnabled(profile.emailNotificationsEnabled !== false);
    }
  }, [profile?.emailNotificationsEnabled]);

  // Category Preferences with persistent memory
  const [categoryPrefs, setCategoryPrefs] = useState<NotificationCategoryPreferences>(() => {
    try {
      const saved = localStorage.getItem('tut_user_notif_prefs');
      return saved ? JSON.parse(saved) : {
        loans: true,
        repayments: true,
        deposits: true,
        charter: true,
        security: true
      };
    } catch {
      return { loans: true, repayments: true, deposits: true, charter: true, security: true };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('tut_user_notif_prefs', JSON.stringify(categoryPrefs));
    } catch {}
  }, [categoryPrefs]);

  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tut_user_dismissed_notifs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tut_user_read_notifs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save read/dismissed states
  useEffect(() => {
    try {
      localStorage.setItem('tut_user_read_notifs', JSON.stringify(readIds));
    } catch {}
  }, [readIds]);

  useEffect(() => {
    try {
      localStorage.setItem('tut_user_dismissed_notifs', JSON.stringify(dismissedIds));
    } catch {}
  }, [dismissedIds]);

  useEffect(() => {
    if (isOpen) {
      try {
        const savedRead = localStorage.getItem('tut_user_read_notifs');
        if (savedRead) setReadIds(JSON.parse(savedRead));
        const savedDismissed = localStorage.getItem('tut_user_dismissed_notifs');
        if (savedDismissed) setDismissedIds(JSON.parse(savedDismissed));
      } catch {}
      notifyNotificationsChanged();
    }
  }, [isOpen]);

  // Dynamically generate realistic, smart notifications based on user's real transactions, debt, and charter profile
  const generatedNotifications = useMemo(() => {
    return generateUserNotifications(profile, transactions, readIds, dismissedIds, categoryPrefs);
  }, [profile, transactions, readIds, dismissedIds, categoryPrefs]);

  // Filtered Notifications based on tabs and search
  const filteredNotifications = useMemo(() => {
    return generatedNotifications.filter(item => {
      // Tab filter
      if (activeFilter === 'unread' && item.read) return false;
      if (activeFilter === 'financial' && !['loan', 'repayment', 'deposit', 'transfer'].includes(item.type)) return false;
      if (activeFilter === 'charter' && item.type !== 'subscription') return false;
      if (activeFilter === 'security' && !['security', 'system'].includes(item.type)) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchBody = item.body.toLowerCase().includes(q);
        const matchType = item.type.toLowerCase().includes(q);
        if (!matchTitle && !matchBody && !matchType) return false;
      }

      return true;
    });
  }, [generatedNotifications, activeFilter, searchQuery]);

  const unreadCount = useMemo(() => {
    return generatedNotifications.filter(n => !n.read).length;
  }, [generatedNotifications]);

  // Actions
  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      setReadIds(updated);
      try {
        localStorage.setItem('tut_user_read_notifs', JSON.stringify(updated));
        notifyNotificationsChanged();
      } catch {}
    }
  };

  const handleMarkAllRead = () => {
    const allIds = Array.from(new Set([...readIds, ...generatedNotifications.map(n => n.id)]));
    setReadIds(allIds);
    try {
      localStorage.setItem('tut_user_read_notifs', JSON.stringify(allIds));
      notifyNotificationsChanged();
    } catch {}
    if (addToast) {
      addToast('All Caught Up', 'All notifications have been marked as read.', 'success');
    }
  };

  const handleDismiss = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      localStorage.setItem('tut_user_dismissed_notifs', JSON.stringify(updated));
      notifyNotificationsChanged();
    } catch {}
    if (addToast) {
      addToast('Notification Dismissed', 'Item removed from your feed.', 'info');
    }
  };

  const handleClearAll = () => {
    const allIds = Array.from(new Set([...dismissedIds, ...generatedNotifications.map(n => n.id)]));
    setDismissedIds(allIds);
    try {
      localStorage.setItem('tut_user_dismissed_notifs', JSON.stringify(allIds));
      notifyNotificationsChanged();
    } catch {}
    if (addToast) {
      addToast('Notifications Cleared', 'All current notifications have been cleared.', 'info');
    }
  };

  const handleResetPreferences = () => {
    setCategoryPrefs({
      loans: true,
      repayments: true,
      deposits: true,
      charter: true,
      security: true
    });
    setDismissedIds([]);
    try {
      localStorage.removeItem('tut_user_dismissed_notifs');
      notifyNotificationsChanged();
    } catch {}
    if (addToast) {
      addToast('Preferences Reset', 'All notification categories and history have been restored.', 'success');
    }
  };

  const handleToggleEmailDispatch = async (newVal: boolean) => {
    setIsUpdatingEmail(true);
    setEmailEnabled(newVal);
    try {
      if (onUpdateEmailNotifications) {
        await onUpdateEmailNotifications(newVal);
      }
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleSendTestDispatch = async () => {
    const targetEmail = profile?.email;
    if (!targetEmail || !targetEmail.includes('@')) {
      if (addToast) {
        addToast('Email Required', 'Please ensure a verified email address is linked to your member account.', 'warning');
      }
      return;
    }

    setIsSendingTest(true);
    try {
      if (onSendTestEmail) {
        const ok = await onSendTestEmail(targetEmail);
        if (ok) {
          if (addToast) {
            addToast('Test Email Dispatched', `Test statement sent to ${targetEmail}. Please check your inbox or Spam/Junk folder.`, 'success');
          }
        } else {
          if (addToast) {
            addToast('Dispatch Issue', 'Could not deliver test dispatch. Please verify your mail configurations.', 'warning');
          }
        }
      }
    } catch (err: any) {
      if (addToast) {
        addToast('Transmission Error', err?.message || 'Failed to dispatch test.', 'warning');
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleNotificationAction = (item: UserNotificationItem) => {
    handleMarkAsRead(item.id);
    if (item.actionType === 'pay_due' && onRequestAction) {
      onClose();
      onRequestAction('pay_due');
    } else if (item.actionType === 'view_vault' && onNavigateTab) {
      onClose();
      onNavigateTab('memos');
    } else if (item.actionType === 'view_subscription' && onNavigateTab) {
      onClose();
      onNavigateTab('subscription');
    }
  };

  const getTypeIcon = (type: UserNotificationItem['type']) => {
    switch (type) {
      case 'loan':
        return <CreditCard className="w-4 h-4 text-blue-400" />;
      case 'repayment':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'deposit':
        return <PiggyBank className="w-4 h-4 text-indigo-400" />;
      case 'transfer':
        return <Send className="w-4 h-4 text-sky-400" />;
      case 'subscription':
        return <Award className="w-4 h-4 text-amber-400" />;
      case 'security':
        return <ShieldCheck className="w-4 h-4 text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeStyle = (type: UserNotificationItem['type']) => {
    switch (type) {
      case 'loan':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'repayment':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'deposit':
        return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'transfer':
        return 'bg-sky-500/10 border-sky-500/20 text-sky-400';
      case 'subscription':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'security':
        return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      default:
        return 'bg-slate-800/40 border-white/5 text-slate-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={onClose} />

      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.98 }}
        transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
        className="relative z-10 w-full sm:max-w-xl bg-slate-900 border border-white/10 sm:rounded-3xl rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.8)] sm:shadow-[0_25px_60px_rgba(0,0,0,0.9)] flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white shrink-0">
              {isSettingsOpen ? <Sliders className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              {!isSettingsOpen && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-mono text-[9px] font-black flex items-center justify-center border-2 border-slate-950 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  {isSettingsOpen ? 'Notification Preferences & Delivery' : 'Notifications & Alerts'}
                </h3>
                {!isSettingsOpen && unreadCount > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-full">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[220px] sm:max-w-xs">
                {isSettingsOpen 
                  ? 'Manage automated email statements, device alerts, and spam filters' 
                  : 'Real-time updates on your loans, vault, and charter'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isSettingsOpen 
                  ? 'bg-blue-600 border-blue-500 text-white shadow-md' 
                  : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
              title={isSettingsOpen ? "Back to Notification Feed" : "Notification Settings"}
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-950 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings Panel Mode: Enhanced, Professional & Realistic */}
        {isSettingsOpen ? (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
            {/* Top Sub-Header & Navigation */}
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-blue-400 font-bold">
                COMMUNICATION GATEWAYS
              </span>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Back to Feed</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* FACILITY 1: OFFICIAL EMAIL NOTIFICATION SERVICE */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-blue-500/20 shadow-md space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-indigo-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                        Automated Email Notification Service
                      </h4>
                      <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                        emailEnabled 
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                          : 'bg-slate-800 text-slate-400 border-white/10'
                      }`}>
                        {emailEnabled ? 'Active' : 'Muted'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Instant transaction vouchers, loan disbursement confirmations, and monthly charter statements.
                    </p>
                  </div>
                </div>

                {/* Master Switch */}
                <button
                  type="button"
                  disabled={isUpdatingEmail}
                  onClick={() => handleToggleEmailDispatch(!emailEnabled)}
                  className={`w-12 h-6.5 rounded-full p-1 transition-colors flex items-center shrink-0 cursor-pointer ${
                    emailEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-800 justify-start'
                  } ${isUpdatingEmail ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <motion.div 
                    layout 
                    className="w-4.5 h-4.5 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>

              {/* Recipient Address Lockup */}
              <div className="p-3 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block">
                      Target Delivery Address
                    </span>
                    <span className="text-xs font-medium text-slate-200 truncate block">
                      {profile?.email || 'No email attached — update in Profile'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSendingTest || !profile?.email}
                  onClick={handleSendTestDispatch}
                  className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 hover:border-blue-500/50 text-blue-300 font-bold text-[10.5px] rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSendingTest ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <MailCheck className="w-3.5 h-3.5" />
                  )}
                  <span>{isSendingTest ? 'Dispatching...' : 'Send Test Dispatch'}</span>
                </button>
              </div>

              {/* HIGH-PRIORITY DELIVERY ADVISORY / SPAM FOLDER NOTICE */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex gap-3.5 text-left">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-300 mt-0.5">
                  <MailQuestion className="w-4.5 h-4.5" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-bold text-amber-300 tracking-wide uppercase">
                      Delivery & Spam Folder Advisory
                    </h5>
                    <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 font-bold">
                      Important
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-[11.5px] text-slate-300 leading-relaxed font-sans">
                    All financial notices and verification memos are transmitted via our certified mail gateway.
                  </p>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed font-sans space-y-1">
                    <p>
                      <strong>Can't find an expected email in your primary inbox?</strong> Please check your <span className="underline font-bold text-white">Spam</span>, <span className="underline font-bold text-white">Junk</span>, or <span className="underline font-bold text-white">Promotions</span> folder.
                    </p>
                    <p className="text-slate-400 text-[10.5px]">
                      Select the message and click <strong>'Report Not Spam'</strong> or add <code>noreply@tut.org</code> to your contacts to ensure future priority dispatches arrive directly in your main inbox.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* FACILITY 2: BROWSER & SYSTEM PUSH ALERTS */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                    <Bell className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                        Browser & Device Push Alerts
                      </h4>
                      <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                        notificationPermission === 'granted' 
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        {notificationPermission === 'granted' ? 'Authorized' : notificationPermission}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Instant audio-visual notifications on your device screen for urgent loan reviews and balance alerts.
                    </p>
                  </div>
                </div>

                {notificationPermission !== 'granted' && onRequestPermission ? (
                  <button
                    type="button"
                    onClick={onRequestPermission}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
                  >
                    Enable
                  </button>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </div>

              <p className="text-[10px] text-slate-500 pt-1">
                Tip: If running inside a sandboxed preview window, launch the app in a new tab to grant full OS-level notification permissions.
              </p>
            </div>

            {/* FACILITY 3: GRANULAR CATEGORY SUBSCRIPTION CONTROLS */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3.5">
              <div className="flex items-center justify-between pb-1 border-b border-white/5">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    Alert Category Subscriptions
                  </h4>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                    Customize which transaction events trigger notifications
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetPreferences}
                  className="text-[10.5px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="divide-y divide-white/5 space-y-1">
                {/* Loan Disbursals */}
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 pr-2">
                    <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-slate-200">Loan Disbursals & Status Audits</p>
                      <p className="text-[10px] text-slate-500">Approvals, transfers, and executive desk review status</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={categoryPrefs.loans}
                    onChange={(e) => setCategoryPrefs(prev => ({ ...prev, loans: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-white/20 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Repayments & Dues */}
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 pr-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-slate-200">Repayment & Due Date Reminders</p>
                      <p className="text-[10px] text-slate-500">Advance notices 3 days and 24 hours prior to deadline</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={categoryPrefs.repayments}
                    onChange={(e) => setCategoryPrefs(prev => ({ ...prev, repayments: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-white/20 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Vault & Deposits */}
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 pr-2">
                    <PiggyBank className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-slate-200">Vault Reserves & Deposit Receipts</p>
                      <p className="text-[10px] text-slate-500">Security deposits, reserve growth, and refund vouchers</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={categoryPrefs.deposits}
                    onChange={(e) => setCategoryPrefs(prev => ({ ...prev, deposits: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-white/20 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Charter Standing */}
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 pr-2">
                    <Award className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-slate-200">Charter Tiers & Borrow Limits</p>
                      <p className="text-[10px] text-slate-500">Tier renewals, ceiling expansions, and loyalty streaks</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={categoryPrefs.charter}
                    onChange={(e) => setCategoryPrefs(prev => ({ ...prev, charter: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-white/20 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Security (Locked) */}
                <div className="flex items-center justify-between py-2.5 opacity-90">
                  <div className="flex items-center gap-3 pr-2">
                    <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-slate-200">Account Security & Verification</p>
                        <span className="text-[8.5px] font-mono uppercase px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">
                          Mandatory
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">Login audits and identity verification memos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Institutional Security Commitment */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Zero-usury charter protected under 256-bit SSL encryption.</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 uppercase">T.U.T. PRIVACY</span>
            </div>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Save Preferences & Return to Feed
            </button>
          </div>
        ) : (
          <>
            {/* Filter Tabs & Search Bar */}
            <div className="p-3 sm:p-4 border-b border-white/10 bg-slate-950/40 space-y-2.5 shrink-0">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search updates (e.g. loan, deposit, due, gold)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto hide-scrollbar pt-0.5">
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'all', label: 'All', count: generatedNotifications.length },
                    { id: 'unread', label: 'Unread', count: unreadCount },
                    { id: 'financial', label: 'Financial' },
                    { id: 'charter', label: 'Charter' },
                    { id: 'security', label: 'Security' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                        activeFilter === tab.id
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-slate-950/70 text-slate-400 hover:text-white border border-white/5'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                          activeFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {generatedNotifications.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[10.5px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Mark all as read"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Mark all read</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-[10.5px] font-bold text-rose-400/80 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Clear all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notification Items List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar min-h-[220px]">
              {filteredNotifications.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-center text-slate-600 mx-auto">
                    <Sparkles className="w-6 h-6 text-slate-500" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {searchQuery ? 'No matching notifications' : 'All caught up!'}
                  </h4>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    {searchQuery 
                      ? 'Try another search term or switch categories.'
                      : 'You have zero unread alerts. All transactions and charter operations are up to date.'}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const isUnread = !notif.read;
                  const timeFormatted = safeFormatDistanceToNow(notif.timestamp);

                  return (
                    <motion.div
                      key={notif.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      onClick={() => handleMarkAsRead(notif.id)}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                        isUnread 
                          ? 'bg-slate-950/90 border-blue-500/30 hover:border-blue-500/50 shadow-sm' 
                          : 'bg-slate-950/50 border-white/5 hover:border-white/10 opacity-85 hover:opacity-100'
                      }`}
                    >
                      {/* Unread Accent Pill */}
                      {isUnread && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                      )}

                      <div className="flex items-start gap-3">
                        {/* Type Icon */}
                        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${getTypeStyle(notif.type)}`}>
                          {getTypeIcon(notif.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-baseline gap-2 justify-between">
                            <h4 className={`text-xs font-bold truncate ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                              {notif.title}
                            </h4>
                          </div>

                          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                            {notif.body}
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2 border-t border-white/5">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                              <Clock className="w-3 h-3" />
                              <span>{timeFormatted}</span>
                              {notif.priority === 'urgent' && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold uppercase text-[8.5px]">
                                  Urgent
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {notif.actionType && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNotificationAction(notif);
                                  }}
                                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg border border-blue-500/20 transition-all cursor-pointer"
                                >
                                  <span>
                                    {notif.actionType === 'pay_due' ? 'Settle Balance' : notif.actionType === 'view_vault' ? 'View in Vault' : 'View Plan'}
                                  </span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => handleDismiss(notif.id, e)}
                                title="Dismiss"
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Footer info bar */}
        <div className="p-3 bg-slate-950 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-500 px-4 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono">Live Institutional Sync</span>
          </div>
          <div className="flex items-center gap-2">
            <span>T.U.T. Zero-Usury Lending Authority</span>
            {!isSettingsOpen && (
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="text-blue-400 hover:underline cursor-pointer"
              >
                Settings
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
