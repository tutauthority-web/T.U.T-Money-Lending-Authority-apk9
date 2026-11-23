import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bell, 
  BellOff,
  CheckCheck, 
  Trash2, 
  Settings, 
  ArrowRight, 
  CreditCard, 
  PiggyBank, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  X, 
  Search, 
  Award, 
  Send, 
  ChevronLeft,
  Mail,
  MailCheck,
  RefreshCw,
  Lock,
  Check,
  RotateCcw,
  Wallet
} from 'lucide-react';
import { isToday, isThisWeek } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile } from '../App';
import { 
  UserNotificationItem, 
  NotificationCategoryPreferences, 
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

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    } else {
      setIsSettingsOpen(false);
    }
  }, [isOpen]);

  // Dynamically generate notifications
  const generatedNotifications = useMemo(() => {
    return generateUserNotifications(profile, transactions, readIds, dismissedIds, categoryPrefs);
  }, [profile, transactions, readIds, dismissedIds, categoryPrefs]);

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    return generatedNotifications.filter(item => {
      if (activeFilter === 'unread' && item.read) return false;
      if (activeFilter === 'financial' && !['loan', 'repayment', 'deposit', 'transfer'].includes(item.type)) return false;
      if (activeFilter === 'charter' && item.type !== 'subscription') return false;
      if (activeFilter === 'security' && !['security', 'system'].includes(item.type)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchBody = item.body.toLowerCase().includes(q);
        const matchType = item.type.toLowerCase().includes(q);
        const matchCat = (item.categoryLabel || '').toLowerCase().includes(q);
        if (!matchTitle && !matchBody && !matchType && !matchCat) return false;
      }

      return true;
    });
  }, [generatedNotifications, activeFilter, searchQuery]);

  // Group notifications chronologically
  const groupedNotifications = useMemo(() => {
    const todayItems: UserNotificationItem[] = [];
    const weekItems: UserNotificationItem[] = [];
    const earlierItems: UserNotificationItem[] = [];

    filteredNotifications.forEach((item) => {
      const date = new Date(item.timestamp);
      if (isToday(date)) {
        todayItems.push(item);
      } else if (isThisWeek(date)) {
        weekItems.push(item);
      } else {
        earlierItems.push(item);
      }
    });

    const groups: { label: string; items: UserNotificationItem[] }[] = [];
    if (todayItems.length > 0) groups.push({ label: 'Today', items: todayItems });
    if (weekItems.length > 0) groups.push({ label: 'This Week', items: weekItems });
    if (earlierItems.length > 0) groups.push({ label: 'Earlier', items: earlierItems });
    return groups;
  }, [filteredNotifications]);

  const unreadCount = useMemo(() => {
    return generatedNotifications.filter(n => !n.read).length;
  }, [generatedNotifications]);

  const urgentItem = useMemo(() => {
    return generatedNotifications.find(n => !n.read && (n.priority === 'urgent' || n.priority === 'high'));
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

  const handleRestoreDismissed = () => {
    setDismissedIds([]);
    try {
      localStorage.removeItem('tut_user_dismissed_notifs');
      notifyNotificationsChanged();
    } catch {}
    if (addToast) {
      addToast('History Restored', 'Previously dismissed notifications are back in your feed.', 'success');
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
            addToast('Test Email Dispatched', `Test statement sent to ${targetEmail}. Check Inbox or Spam/Junk.`, 'success');
          }
        } else {
          if (addToast) {
            addToast('Dispatch Issue', 'Could not deliver test email. Please verify your mail configuration.', 'warning');
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
    } else if (item.actionType === 'view_wallets' && onNavigateTab) {
      onClose();
      onNavigateTab('wallets');
    }
  };

  const getTypeIcon = (item: UserNotificationItem) => {
    if (item.priority === 'urgent') {
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    }
    switch (item.type) {
      case 'loan':
        return <CreditCard className="w-4 h-4 text-blue-400" />;
      case 'repayment':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'deposit':
        return <PiggyBank className="w-4 h-4 text-teal-400" />;
      case 'transfer':
        return <Send className="w-4 h-4 text-sky-400" />;
      case 'subscription':
        return <Award className="w-4 h-4 text-amber-400" />;
      case 'security':
        return item.actionType === 'view_wallets'
          ? <Wallet className="w-4 h-4 text-purple-400" />
          : <ShieldCheck className="w-4 h-4 text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeStyle = (item: UserNotificationItem) => {
    if (item.priority === 'urgent') {
      return 'bg-rose-500/10 border-rose-500/25';
    }
    switch (item.type) {
      case 'loan':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'repayment':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'deposit':
        return 'bg-teal-500/10 border-teal-500/20';
      case 'transfer':
        return 'bg-sky-500/10 border-sky-500/20';
      case 'subscription':
        return 'bg-amber-500/10 border-amber-500/20';
      case 'security':
        return 'bg-purple-500/10 border-purple-500/20';
      default:
        return 'bg-slate-800/60 border-white/10';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-stretch sm:justify-end sm:p-3.5 bg-slate-950/75 backdrop-blur-sm">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      <motion.div 
        initial={{ opacity: 0, x: 24, y: 12 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: 24, y: 12 }}
        transition={{ type: 'spring', duration: 0.32, bounce: 0.08 }}
        className="relative z-10 w-full sm:w-[440px] bg-slate-950/95 backdrop-blur-2xl border border-white/10 sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[88vh] sm:max-h-full overflow-hidden"
      >
        {/* Top Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {isSettingsOpen ? (
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Back to Notifications"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Bell className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm sm:text-[15px] font-bold text-white tracking-tight truncate">
                  {isSettingsOpen ? 'Notification Settings' : 'Notifications'}
                </h3>
                {!isSettingsOpen && unreadCount > 0 && (
                  <span className="text-[11px] font-medium text-blue-400 font-mono tabular-nums">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {isSettingsOpen
                  ? 'Email alerts, push permissions & category filters'
                  : 'Account activity, limits & due reminders'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!isSettingsOpen && unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-white/5 transition-colors cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isSettingsOpen
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title={isSettingsOpen ? 'Back to feed' : 'Notification preferences'}
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {isSettingsOpen ? (
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06] custom-scrollbar">
            {/* Email Service */}
            <div className="p-4 sm:p-5 space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-semibold text-white">
                        Email Statements & Alerts
                      </h4>
                      <span className="text-[11px] text-slate-500">·</span>
                      <span className={`text-[11px] font-medium ${emailEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {emailEnabled ? 'Active' : 'Muted'}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-400 mt-0.5 leading-relaxed">
                      Transaction receipts, loan approvals, and settlement notices.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={emailEnabled}
                  disabled={isUpdatingEmail}
                  onClick={() => handleToggleEmailDispatch(!emailEnabled)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center shrink-0 cursor-pointer ${
                    emailEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-800 justify-start'
                  } ${isUpdatingEmail ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <motion.div layout className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="min-w-0">
                  <span className="text-[10.5px] text-slate-500 block">Delivery address</span>
                  <span className="text-xs font-medium text-slate-200 truncate block">
                    {profile?.email || 'No email linked — update in Profile'}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isSendingTest || !profile?.email}
                  onClick={handleSendTestDispatch}
                  className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-slate-200 font-semibold text-[11px] rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSendingTest ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <MailCheck className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span>{isSendingTest ? 'Sending...' : 'Send Test'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                Tip: If a statement doesn&apos;t appear in your main inbox, check Spam or Promotions and mark <code className="text-slate-300">noreply@tut.org</code> as safe.
              </p>
            </div>

            {/* Browser Push */}
            <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-semibold text-white">Device Push Alerts</h4>
                    <span className="text-[11px] text-slate-500">·</span>
                    <span className={`text-[11px] font-medium capitalize ${
                      notificationPermission === 'granted' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {notificationPermission === 'granted' ? 'Enabled' : notificationPermission}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-slate-400 mt-0.5">
                    Real-time desktop & mobile alerts for approvals and due dates.
                  </p>
                </div>
              </div>

              {notificationPermission !== 'granted' && onRequestPermission ? (
                <button
                  type="button"
                  onClick={onRequestPermission}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                >
                  Enable
                </button>
              ) : (
                <span className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}
            </div>

            {/* Category Toggles */}
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-200">Alert Categories</h4>
                <button
                  type="button"
                  onClick={handleResetPreferences}
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="divide-y divide-white/[0.05]">
                {[
                  {
                    key: 'loans' as const,
                    icon: <CreditCard className="w-4 h-4 text-blue-400" />,
                    title: 'Loans & Approvals',
                    desc: 'Disbursals, requests, and status updates',
                  },
                  {
                    key: 'repayments' as const,
                    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
                    title: 'Repayments & Due Dates',
                    desc: 'Upcoming reminders and settlement confirmations',
                  },
                  {
                    key: 'deposits' as const,
                    icon: <PiggyBank className="w-4 h-4 text-teal-400" />,
                    title: 'Deposits & Refunds',
                    desc: 'Reserve vault deposits and refund payouts',
                  },
                  {
                    key: 'charter' as const,
                    icon: <Award className="w-4 h-4 text-amber-400" />,
                    title: 'Plan & Credit Limits',
                    desc: 'Tier renewals and high utilization advisories',
                  },
                ].map((cat) => {
                  const enabled = categoryPrefs[cat.key];
                  return (
                    <div key={cat.key} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0">{cat.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{cat.title}</p>
                          <p className="text-[11px] text-slate-500 truncate">{cat.desc}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={() => setCategoryPrefs(prev => ({ ...prev, [cat.key]: !enabled }))}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center shrink-0 cursor-pointer ${
                          enabled ? 'bg-blue-600 justify-end' : 'bg-slate-800 justify-start'
                        }`}
                      >
                        <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between py-2.5 gap-3 opacity-80">
                  <div className="flex items-center gap-3 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-200">
                        Security & Verification <span className="text-[10.5px] text-slate-500 font-normal">· Required</span>
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">Identity and wallet security notices</p>
                    </div>
                  </div>
                  <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </div>
              </div>
            </div>

            {dismissedIds.length > 0 && (
              <div className="p-4 sm:px-5 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {dismissedIds.length} dismissed alert{dismissedIds.length === 1 ? '' : 's'} hidden
                </span>
                <button
                  type="button"
                  onClick={handleRestoreDismissed}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore all</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Search & Segmented Filter Bar */}
            <div className="px-4 py-3 border-b border-white/[0.06] space-y-2.5 shrink-0 bg-slate-900/30">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter alerts by keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-slate-900/90 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-white/[0.06] overflow-x-auto hide-scrollbar">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'unread', label: unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread' },
                    { id: 'financial', label: 'Money' },
                    { id: 'charter', label: 'Plan' },
                    { id: 'security', label: 'Security' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        activeFilter === tab.id
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {generatedNotifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] font-medium text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 shrink-0 cursor-pointer px-1.5 py-1"
                    title="Clear all notifications"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Smart Priority Advisory Strip (only when there is an unread high/urgent item on All view) */}
            {activeFilter === 'all' && !searchQuery && urgentItem && (
              <div className="px-4 py-2.5 bg-amber-500/[0.07] border-b border-amber-500/20 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-[11.5px] font-medium text-amber-200 truncate">
                    {urgentItem.title}
                  </p>
                </div>
                {urgentItem.actionType && (
                  <button
                    type="button"
                    onClick={() => handleNotificationAction(urgentItem)}
                    className="text-[11px] font-semibold text-amber-300 hover:text-white flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>{urgentItem.actionType === 'pay_due' ? 'Pay Now' : 'Review'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Chronologically Grouped Notification Feed */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[240px]">
              {filteredNotifications.length === 0 ? (
                <div className="py-16 px-6 text-center space-y-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-900 border border-white/[0.07] flex items-center justify-center text-slate-500 mx-auto">
                    <BellOff className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-300">
                    {searchQuery ? 'No matching alerts' : activeFilter === 'unread' ? 'No unread alerts' : 'You’re all caught up'}
                  </h4>
                  <p className="text-[11.5px] text-slate-500 max-w-[260px] mx-auto leading-relaxed">
                    {searchQuery
                      ? 'Try clearing your search filter or switching tabs.'
                      : 'Updates about loans, deposits, and plan limits appear here automatically.'}
                  </p>
                  {dismissedIds.length > 0 && !searchQuery && activeFilter === 'all' && (
                    <button
                      type="button"
                      onClick={handleRestoreDismissed}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 pt-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore {dismissedIds.length} dismissed alert{dismissedIds.length === 1 ? '' : 's'}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="pb-2">
                  <AnimatePresence initial={false}>
                    {groupedNotifications.map((group) => (
                      <div key={group.label}>
                        <div className="sticky top-0 z-10 px-4 py-1.5 bg-slate-950/90 backdrop-blur-md border-b border-white/[0.05] text-[11px] font-semibold text-slate-400">
                          {group.label}
                        </div>
                        <div className="divide-y divide-white/[0.06]">
                          {group.items.map((notif) => {
                            const isUnread = !notif.read;
                            const timeFormatted = safeFormatDistanceToNow(notif.timestamp);

                            return (
                              <motion.div
                                key={notif.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, height: 0 }}
                                onClick={() => handleMarkAsRead(notif.id)}
                                className={`px-4 py-3.5 transition-colors cursor-pointer group ${
                                  isUnread
                                    ? 'bg-blue-500/[0.045] hover:bg-blue-500/[0.075]'
                                    : 'hover:bg-white/[0.025]'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  {/* Category Icon */}
                                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${getTypeStyle(notif)}`}>
                                    {getTypeIcon(notif)}
                                  </div>

                                  {/* Main Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className={`text-[13px] leading-snug ${isUnread ? 'font-semibold text-white' : 'font-medium text-slate-300'}`}>
                                        {notif.title}
                                      </h4>
                                      <div className="flex items-center gap-1.5 shrink-0 pt-1">
                                        {isUnread && (
                                          <span className="w-2 h-2 rounded-full bg-blue-400" title="Unread" />
                                        )}
                                        <button
                                          type="button"
                                          onClick={(e) => handleDismiss(notif.id, e)}
                                          title="Dismiss"
                                          className="opacity-60 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity cursor-pointer"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                      {notif.body}
                                    </p>

                                    {/* Clean Typographic Meta + Action Link */}
                                    <div className="flex items-center justify-between gap-2 mt-2 text-[11px]">
                                      <div className="flex items-center gap-1.5 text-slate-500 min-w-0 truncate">
                                        {notif.categoryLabel && (
                                          <>
                                            <span className="text-slate-400 font-medium">{notif.categoryLabel}</span>
                                            <span aria-hidden="true">·</span>
                                          </>
                                        )}
                                        <span className="truncate">{timeFormatted}</span>
                                        {notif.priority === 'urgent' && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span className="text-rose-400 font-semibold">Action needed</span>
                                          </>
                                        )}
                                      </div>

                                      {notif.actionType && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleNotificationAction(notif);
                                          }}
                                          className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0 cursor-pointer"
                                        >
                                          <span>
                                            {notif.actionType === 'pay_due'
                                              ? 'Settle Balance'
                                              : notif.actionType === 'view_vault'
                                              ? 'Open Vault'
                                              : notif.actionType === 'view_wallets'
                                              ? 'View Wallets'
                                              : 'View Plan'}
                                          </span>
                                          <ArrowRight className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        )}

        {/* Quiet Footer */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span>T.U.T. Member Alerts</span>
          {!isSettingsOpen ? (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="text-slate-400 hover:text-white font-medium transition-colors cursor-pointer"
            >
              Preferences
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
