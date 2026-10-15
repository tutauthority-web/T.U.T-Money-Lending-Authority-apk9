import { format, formatDistanceToNow } from 'date-fns';

export interface UserNotificationItem {
  id: string;
  type: 'loan' | 'repayment' | 'deposit' | 'transfer' | 'subscription' | 'security' | 'system';
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  priority?: 'normal' | 'high' | 'urgent';
  actionType?: 'view_vault' | 'pay_due' | 'view_subscription' | 'view_receipt' | 'external';
  actionPayload?: any;
  amount?: number;
}

export interface NotificationCategoryPreferences {
  loans: boolean;
  repayments: boolean;
  deposits: boolean;
  charter: boolean;
  security: boolean;
}

// Safe Date & Timestamp Utility Functions to Prevent "Invalid time value" crashes
export function safeToEpoch(val: any, fallback = Date.now()): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val;
  }
  try {
    if (typeof val.toMillis === 'function') {
      const m = val.toMillis();
      if (typeof m === 'number' && !isNaN(m)) return m;
    }
    if (typeof val.toDate === 'function') {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
    }
    if (typeof val.seconds === 'number' && !isNaN(val.seconds)) {
      return val.seconds * 1000;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.getTime();
  } catch {}
  return fallback;
}

export function safeFormatDate(val: any, formatStr: string, fallback = 'Recently'): string {
  try {
    const epoch = safeToEpoch(val, 0);
    if (epoch > 0) {
      return format(new Date(epoch), formatStr);
    }
  } catch {}
  return fallback;
}

export function safeFormatDistanceToNow(val: any, fallback = 'recently'): string {
  try {
    const epoch = safeToEpoch(val, 0);
    if (epoch > 0) {
      return formatDistanceToNow(epoch, { addSuffix: true });
    }
  } catch {}
  return fallback;
}

export function getUserReadNotifIds(): string[] {
  try {
    const saved = localStorage.getItem('tut_user_read_notifs');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function getUserDismissedNotifIds(): string[] {
  try {
    const saved = localStorage.getItem('tut_user_dismissed_notifs');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function getCategoryPreferences(): NotificationCategoryPreferences {
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
}

export function notifyNotificationsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tut-notifications-updated'));
  }
}

/**
 * Generates unified, smart, realistic notifications based on user profile and transactions.
 * Single source of truth used by both the Bell icon badge and UserNotificationsModal.
 */
export function generateUserNotifications(
  profile: any,
  transactions: any[] = [],
  customReadIds?: string[],
  customDismissedIds?: string[],
  customPrefs?: NotificationCategoryPreferences
): UserNotificationItem[] {
  if (!profile) return [];

  const readIds = customReadIds || getUserReadNotifIds();
  const dismissedIds = customDismissedIds || getUserDismissedNotifIds();
  const categoryPrefs = customPrefs || getCategoryPreferences();

  const list: UserNotificationItem[] = [];
  const now = Date.now();
  const RECENT_CUTOFF_MS = 48 * 60 * 60 * 1000; // 48 hours window for active unread alerts

  // 1. Outstanding Loan / Due Alerts
  if ((profile.remainingDebt || 0) > 0 && categoryPrefs.loans) {
    const activeLoanTx = transactions.find(t => t.type === 'loan' && t.status === 'confirmed');
    const estEpoch = activeLoanTx?.estimatedRepaymentDate ? safeToEpoch(activeLoanTx.estimatedRepaymentDate, 0) : 0;
    const isOverdue = estEpoch > 0 && estEpoch < now;
    const formattedEstDate = estEpoch > 0 ? safeFormatDate(estEpoch, 'dd MMM yyyy') : '';

    if (isOverdue) {
      const id = `notif-debt-overdue-${profile.uid}`;
      list.push({
        id,
        type: 'loan',
        title: 'Immediate Action: Loan Balance Past Due',
        body: `Your zero-usury loan of ৳${(profile.remainingDebt).toLocaleString()} BDT was due on ${formattedEstDate || 'the scheduled date'}. Settle today to maintain your credit health and charter limit.`,
        timestamp: estEpoch > 0 ? estEpoch : now,
        read: readIds.includes(id),
        priority: 'urgent',
        actionType: 'pay_due',
        amount: profile.remainingDebt
      });
    } else {
      const id = `notif-debt-active-${profile.uid}`;
      const txTime = safeToEpoch(activeLoanTx?.timestamp || activeLoanTx?.createdAt, now - 3600000);
      const isRecentlyDisbursed = (now - txTime) < RECENT_CUTOFF_MS;
      list.push({
        id,
        type: 'loan',
        title: 'Active Zero-Usury Loan Outstanding',
        body: `Current active balance: ৳${(profile.remainingDebt).toLocaleString()} BDT. ${formattedEstDate ? `Estimated settlement due by ${formattedEstDate}.` : 'Zero interest or penalties applied.'}`,
        timestamp: txTime,
        read: isRecentlyDisbursed ? readIds.includes(id) : true,
        priority: 'high',
        actionType: 'pay_due',
        amount: profile.remainingDebt
      });
    }
  }

  // 2. Map real user transactions to realistic banking notifications
  transactions.slice(0, 15).forEach((tx) => {
    const txTime = safeToEpoch(tx.timestamp || tx.createdAt, now);
    const txId = tx.id || tx.transactionId || tx.memoId || `tx-${txTime}`;
    const notifId = `notif-tx-${txId}`;
    const isRecent = (now - txTime) < RECENT_CUTOFF_MS;
    const isPending = tx.status === 'pending';
    // Only pending requests or recent transactions (<48h) can be unread. Historical transactions default to read.
    const isRead = readIds.includes(notifId) || (!isPending && !isRecent);

    if (tx.type === 'loan' && categoryPrefs.loans) {
      if (tx.status === 'confirmed') {
        list.push({
          id: notifId,
          type: 'loan',
          title: 'Loan Disbursed Successfully',
          body: `৳${(tx.amount || 0).toLocaleString()} BDT has been credited to your verified ${tx.method || 'Account'} (${tx.accountNumber || 'Primary'}). Reference: ${tx.transactionId || tx.memoId || 'TUT-DISBURSE'}.`,
          timestamp: txTime,
          read: isRead,
          priority: 'normal',
          actionType: 'view_vault',
          amount: tx.amount
        });
      } else if (tx.status === 'pending') {
        list.push({
          id: notifId,
          type: 'loan',
          title: 'Loan Application Under Review',
          body: `Your request for ৳${(tx.amount || 0).toLocaleString()} BDT is being audited by the T.U.T. Executive Desk. Approval ETA: within 2 hours.`,
          timestamp: txTime,
          read: readIds.includes(notifId),
          priority: 'normal',
          actionType: 'view_vault',
          amount: tx.amount
        });
      } else if (tx.status === 'rejected') {
        list.push({
          id: notifId,
          type: 'loan',
          title: 'Loan Application Declined',
          body: `Your request for ৳${(tx.amount || 0).toLocaleString()} BDT could not be approved at this time.`,
          timestamp: txTime,
          read: isRead,
          priority: 'normal',
          actionType: 'view_vault',
          amount: tx.amount
        });
      }
    } else if (tx.type === 'deposit' && categoryPrefs.deposits) {
      list.push({
        id: notifId,
        type: 'deposit',
        title: tx.status === 'pending' ? 'Security Deposit Under Review' : 'Security Deposit Confirmed',
        body: tx.status === 'pending'
          ? `Your deposit request of ৳${(tx.amount || 0).toLocaleString()} BDT via ${tx.method || 'Payment Method'} is under administrative verification.`
          : `৳${(tx.amount || 0).toLocaleString()} BDT has been safely secured in your personal vault reserve. This reinforces your borrow eligibility.`,
        timestamp: txTime,
        read: isRead,
        priority: 'normal',
        actionType: 'view_vault',
        amount: tx.amount
      });
    } else if (tx.type === 'pay_due' && categoryPrefs.repayments) {
      list.push({
        id: notifId,
        type: 'repayment',
        title: tx.status === 'pending' ? 'Loan Repayment In Review' : 'Loan Repayment Acknowledged',
        body: `Received ৳${(tx.amount || 0).toLocaleString()} BDT via ${tx.method || 'Online Payment'}. Thank you for your integrity and community support.`,
        timestamp: txTime,
        read: isRead,
        priority: 'normal',
        actionType: 'view_vault',
        amount: tx.amount
      });
    } else if (tx.type === 'transfer' && categoryPrefs.repayments) {
      list.push({
        id: notifId,
        type: 'transfer',
        title: 'Direct Transfer Processed',
        body: `৳${(tx.amount || 0).toLocaleString()} BDT transfer completed. Reference memo: ${tx.transactionId || 'INTERNAL-TX'}.`,
        timestamp: txTime,
        read: isRead,
        priority: 'normal',
        actionType: 'view_vault',
        amount: tx.amount
      });
    } else if (tx.type === 'subscription' && categoryPrefs.charter) {
      list.push({
        id: notifId,
        type: 'subscription',
        title: 'Charter Tier Upgraded',
        body: `Your ${tx.subscriptionTier?.toUpperCase() || 'PREMIUM'} plan is active. Borrowing ceiling set to ৳${tx.subscriptionTier === 'gold' ? '100,000' : tx.subscriptionTier === 'silver' ? '45,000' : '25,000'} BDT.`,
        timestamp: txTime,
        read: isRead,
        priority: 'normal',
        actionType: 'view_subscription',
        amount: tx.amount
      });
    }
  });

  // 3. Subscription & Charter Standing
  if (profile.subscriptionStatus === 'active' && categoryPrefs.charter) {
    const tierName = profile.subscriptionTier === 'gold' 
      ? 'Gold Sovereign' 
      : profile.subscriptionTier === 'silver' 
      ? 'Silver Executive' 
      : 'Bronze Basic';
    
    const expiryEpoch = profile.subscriptionExpiresAt ? safeToEpoch(profile.subscriptionExpiresAt, 0) : 0;
    const daysLeft = expiryEpoch > 0 ? Math.ceil((expiryEpoch - now) / (1000 * 3600 * 24)) : 30;
    const isExpiringSoon = daysLeft <= 3 && daysLeft >= 0;

    const id = `notif-charter-status-${profile.uid}`;
    list.push({
      id,
      type: 'subscription',
      title: `${tierName} Charter Active`,
      body: `Continuous loyalty: ${profile.continuousSubscriptionMonths || 1} month(s). ${daysLeft > 0 ? `Renews in ${daysLeft} days.` : 'Eligible for renewal.'} Zero usury guaranteed.`,
      timestamp: now - 7200000,
      read: isExpiringSoon ? readIds.includes(id) : true,
      priority: isExpiringSoon ? 'high' : 'normal',
      actionType: 'view_subscription'
    });
  }

  // 4. Security & Account Verification
  if (categoryPrefs.security) {
    const id = `notif-sec-verified-${profile.uid}`;
    const accountAgeMs = now - safeToEpoch(profile.createdAt, now);
    const isNewAccount = accountAgeMs < RECENT_CUTOFF_MS;
    list.push({
      id,
      type: 'security',
      title: 'Institutional Verification Complete',
      body: `Account registered for ${profile.name}. Assigned Member ID: ${profile.memberId || 'TUT-MBR-2026'}. 256-Bit SSL protection is active on your session.`,
      timestamp: safeToEpoch(profile.createdAt, now - 86400000),
      read: isNewAccount ? readIds.includes(id) : true,
      priority: 'normal'
    });
  }

  // 5. Custom saved system notifications from localStorage (if any)
  try {
    const localHistory: any[] = JSON.parse(localStorage.getItem('tut_notification_history') || '[]');
    localHistory.forEach(item => {
      const id = item.id || `local-${item.timestamp}`;
      if (!list.some(l => l.id === id)) {
        const itemTime = safeToEpoch(item.timestamp, now);
        const isRecent = (now - itemTime) < RECENT_CUTOFF_MS;
        list.push({
          id,
          type: 'system',
          title: item.title || 'System Notification',
          body: item.body || item.message || '',
          timestamp: itemTime,
          read: isRecent ? readIds.includes(id) : true,
          priority: 'normal'
        });
      }
    });
  } catch {}

  // Sort descending by timestamp and filter out dismissed
  return list
    .filter(item => !dismissedIds.includes(item.id))
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Calculates exact unread notifications count for the member.
 */
export function calculateUserUnreadCount(profile: any, transactions: any[] = []): number {
  if (!profile) return 0;
  const list = generateUserNotifications(profile, transactions);
  return list.filter(n => !n.read).length;
}

export function markNotificationAsRead(id: string) {
  try {
    const readIds = getUserReadNotifIds();
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem('tut_user_read_notifs', JSON.stringify(readIds));
      notifyNotificationsChanged();
    }
  } catch {}
}

export function markAllNotificationsAsRead(notifications: UserNotificationItem[]) {
  try {
    const current = getUserReadNotifIds();
    const allIds = Array.from(new Set([...current, ...notifications.map(n => n.id)]));
    localStorage.setItem('tut_user_read_notifs', JSON.stringify(allIds));
    notifyNotificationsChanged();
  } catch {}
}

export function dismissNotification(id: string) {
  try {
    const dismissedIds = getUserDismissedNotifIds();
    if (!dismissedIds.includes(id)) {
      dismissedIds.push(id);
      localStorage.setItem('tut_user_dismissed_notifs', JSON.stringify(dismissedIds));
      notifyNotificationsChanged();
    }
  } catch {}
}

export function clearAllNotifications(notifications: UserNotificationItem[]) {
  try {
    const current = getUserDismissedNotifIds();
    const allIds = Array.from(new Set([...current, ...notifications.map(n => n.id)]));
    localStorage.setItem('tut_user_dismissed_notifs', JSON.stringify(allIds));
    notifyNotificationsChanged();
  } catch {}
}
