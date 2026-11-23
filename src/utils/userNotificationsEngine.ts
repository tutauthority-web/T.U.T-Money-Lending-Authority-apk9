import { format, formatDistanceToNow } from 'date-fns';
import { calculateMemberLoanAllocations, getCalendarDaysFromToday } from './loanAllocationEngine';

export interface UserNotificationItem {
  id: string;
  type: 'loan' | 'repayment' | 'deposit' | 'transfer' | 'subscription' | 'security' | 'system';
  categoryLabel?: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  priority?: 'normal' | 'high' | 'urgent';
  actionType?: 'view_vault' | 'pay_due' | 'view_subscription' | 'view_wallets' | 'view_receipt' | 'external';
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

  const activeTier = profile.subscriptionTier || 'standard';
  const borrowLimit =
    profile.borrowingLimit ??
    (activeTier === 'gold' ? 2500 : activeTier === 'silver' ? 1500 : activeTier === 'bronze' ? 500 : 0);
  const remainingDebt = profile.remainingDebt || 0;
  const utilizationPct = borrowLimit > 0 ? Math.min(100, Math.round((remainingDebt / borrowLimit) * 100)) : 0;

  // 1. Outstanding Loan / Due Date Intelligence (strictly synced with loanAllocationEngine)
  if (remainingDebt > 0 && categoryPrefs.loans) {
    const allocation = calculateMemberLoanAllocations(profile.uid || '', transactions || [], profile);
    const openLoans = allocation.loans
      .filter((l) => l.remainingAmount > 0 && l.status !== 'CANCELLED')
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const primaryLoan = openLoans[0];

    const dueEpoch = primaryLoan?.dueDate ? primaryLoan.dueDate.getTime() : 0;
    const daysUntilDue = primaryLoan?.dueDate ? getCalendarDaysFromToday(primaryLoan.dueDate, new Date(now)) : null;
    const isOverdue = Boolean(primaryLoan?.isOverdue || (daysUntilDue !== null && daysUntilDue < 0));
    const isDueSoon = !isOverdue && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3;
    const formattedEstDate = primaryLoan?.dueDateStr || (dueEpoch > 0 ? safeFormatDate(dueEpoch, 'dd MMM yyyy') : '');

    if (isOverdue) {
      const id = `notif-debt-overdue-${profile.uid}`;
      const overdueDays = daysUntilDue !== null ? Math.abs(daysUntilDue) : 0;
      list.push({
        id,
        type: 'loan',
        categoryLabel: 'Repayment Overdue',
        title: overdueDays > 0 ? `Loan payment ${overdueDays}d overdue` : 'Loan balance is past due',
        body: `Your zero-usury balance of ৳${remainingDebt.toLocaleString()} BDT was scheduled for ${formattedEstDate || 'settlement'}. Clear this balance to protect your credit standing.`,
        timestamp: now - 60000,
        read: readIds.includes(id),
        priority: 'urgent',
        actionType: 'pay_due',
        amount: remainingDebt
      });
    } else if (isDueSoon && categoryPrefs.repayments) {
      const id = `notif-debt-duesoon-${profile.uid}-${formattedEstDate}`;
      list.push({
        id,
        type: 'repayment',
        categoryLabel: 'Upcoming Due',
        title: daysUntilDue === 0 ? 'Loan repayment due today' : `Repayment due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
        body: `Scheduled settlement of ৳${remainingDebt.toLocaleString()} BDT is approaching (${formattedEstDate}). Settle early to earn credit standing points.`,
        timestamp: now - 120000,
        read: readIds.includes(id),
        priority: 'high',
        actionType: 'pay_due',
        amount: remainingDebt
      });
    } else {
      const id = `notif-debt-active-${profile.uid}`;
      const txTime = primaryLoan?.disbursedDate
        ? primaryLoan.disbursedDate.getTime()
        : safeToEpoch(profile.updatedAt, now - 3600000);
      const isRecentlyDisbursed = (now - txTime) < RECENT_CUTOFF_MS;
      list.push({
        id,
        type: 'loan',
        categoryLabel: 'Active Loan',
        title: 'Active zero-usury balance',
        body: `Current outstanding balance: ৳${remainingDebt.toLocaleString()} BDT. ${formattedEstDate ? `Scheduled settlement: ${formattedEstDate}.` : '0% interest applied.'}`,
        timestamp: txTime,
        read: isRecentlyDisbursed ? readIds.includes(id) : true,
        priority: 'normal',
        actionType: 'pay_due',
        amount: remainingDebt
      });
    }
  }

  // 2. Smart Borrowing Limit Utilization Advisory (>= 80% used)
  if (borrowLimit > 0 && utilizationPct >= 80 && categoryPrefs.charter) {
    const id = `notif-limit-high-${profile.uid}-${utilizationPct >= 95 ? 'crit' : 'high'}`;
    list.push({
      id,
      type: 'subscription',
      categoryLabel: 'Credit Limit',
      title: utilizationPct >= 95 ? `Borrowing limit nearly full (${utilizationPct}%)` : `High borrowing limit usage (${utilizationPct}%)`,
      body: `You are using ৳${remainingDebt.toLocaleString()} of your ৳${borrowLimit.toLocaleString()} BDT cap. Repay part of your balance or upgrade your tier to restore headroom.`,
      timestamp: now - 180000,
      read: readIds.includes(id),
      priority: utilizationPct >= 95 ? 'urgent' : 'high',
      actionType: 'pay_due',
      amount: remainingDebt
    });
  }

  // 3. Map real user transactions to clean, accurate notifications
  transactions.slice(0, 20).forEach((tx) => {
    const txTime = safeToEpoch(tx.timestamp || tx.createdAt, now);
    const txId = tx.id || tx.transactionId || tx.memoId || `tx-${txTime}`;
    const notifId = `notif-tx-${txId}`;
    const isRecent = (now - txTime) < RECENT_CUTOFF_MS;
    const isPending = tx.status === 'pending' || tx.status === 'more_info';
    const isRead = readIds.includes(notifId) || (!isPending && !isRecent);
    const adminNote = tx.adminNotes ? ` Note: ${tx.adminNotes}` : '';

    if (tx.type === 'loan' && categoryPrefs.loans) {
      if (tx.status === 'confirmed') {
        list.push({
          id: notifId,
          type: 'loan',
          categoryLabel: 'Loan',
          title: 'Loan disbursed',
          body: `৳${(tx.amount || 0).toLocaleString()} BDT credited to ${tx.method || 'Account'}${tx.accountNumber ? ` (${tx.accountNumber})` : ''}.`,
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
          categoryLabel: 'Loan',
          title: 'Loan request under review',
          body: `Your request for ৳${(tx.amount || 0).toLocaleString()} BDT is queued for verification.`,
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
          categoryLabel: 'Loan',
          title: 'Loan request declined',
          body: `Your loan request for ৳${(tx.amount || 0).toLocaleString()} BDT was not approved.${adminNote}`,
          timestamp: txTime,
          read: isRead,
          priority: 'high',
          actionType: 'view_vault',
          amount: tx.amount
        });
      } else if (tx.status === 'more_info') {
        list.push({
          id: notifId,
          type: 'loan',
          categoryLabel: 'Action Needed',
          title: 'Additional details needed for loan',
          body: `Admin requested clarification on your ৳${(tx.amount || 0).toLocaleString()} BDT loan request.${adminNote}`,
          timestamp: txTime,
          read: readIds.includes(notifId),
          priority: 'urgent',
          actionType: 'view_vault',
          amount: tx.amount
        });
      }
    } else if (tx.type === 'deposit' && categoryPrefs.deposits) {
      list.push({
        id: notifId,
        type: 'deposit',
        categoryLabel: 'Deposit',
        title:
          tx.status === 'pending'
            ? 'Deposit awaiting verification'
            : tx.status === 'rejected'
            ? 'Deposit request declined'
            : 'Security deposit confirmed',
        body:
          tx.status === 'pending'
            ? `Deposit of ৳${(tx.amount || 0).toLocaleString()} BDT via ${tx.method || 'payment'} is being verified.`
            : tx.status === 'rejected'
            ? `Deposit of ৳${(tx.amount || 0).toLocaleString()} BDT could not be verified.${adminNote}`
            : `৳${(tx.amount || 0).toLocaleString()} BDT added to your segregated reserve vault.`,
        timestamp: txTime,
        read: isRead,
        priority: tx.status === 'rejected' ? 'high' : 'normal',
        actionType: 'view_vault',
        amount: tx.amount
      });
    } else if (tx.type === 'refund' && categoryPrefs.deposits) {
      list.push({
        id: notifId,
        type: 'deposit',
        categoryLabel: 'Refund',
        title:
          tx.status === 'pending'
            ? 'Deposit refund in review'
            : tx.status === 'rejected'
            ? 'Deposit refund declined'
            : 'Deposit refund processed',
        body:
          tx.status === 'pending'
            ? `Your refund request of ৳${(tx.amount || 0).toLocaleString()} BDT via ${tx.method || 'Account'} is pending approval.`
            : tx.status === 'rejected'
            ? `Your refund request of ৳${(tx.amount || 0).toLocaleString()} BDT was declined.${adminNote}`
            : `৳${(tx.amount || 0).toLocaleString()} BDT refunded to your ${tx.method || 'account'}.`,
        timestamp: txTime,
        read: isRead,
        priority: tx.status === 'rejected' ? 'high' : 'normal',
        actionType: 'view_vault',
        amount: tx.amount
      });
    } else if (tx.type === 'pay_due' && categoryPrefs.repayments) {
      list.push({
        id: notifId,
        type: 'repayment',
        categoryLabel: 'Repayment',
        title:
          tx.status === 'pending'
            ? 'Repayment awaiting verification'
            : tx.status === 'rejected'
            ? 'Repayment verification failed'
            : 'Repayment confirmed',
        body:
          tx.status === 'pending'
            ? `Repayment of ৳${(tx.amount || 0).toLocaleString()} BDT via ${tx.method || 'online transfer'} is under review.`
            : tx.status === 'rejected'
            ? `Repayment of ৳${(tx.amount || 0).toLocaleString()} BDT could not be confirmed.${adminNote}`
            : `৳${(tx.amount || 0).toLocaleString()} BDT credited toward your active balance.`,
        timestamp: txTime,
        read: isRead,
        priority: tx.status === 'rejected' ? 'high' : 'normal',
        actionType: 'view_vault',
        amount: tx.amount
      });
    } else if ((tx.type === 'transfer' || tx.isTransfer) && categoryPrefs.repayments) {
      const isOut = tx.transferType === 'out';
      list.push({
        id: notifId,
        type: 'transfer',
        categoryLabel: 'Transfer',
        title: isOut ? 'Transfer sent' : 'Transfer received',
        body: isOut
          ? `Sent ৳${(tx.amount || 0).toLocaleString()} BDT to ${tx.transferRecipientName || 'member'}.`
          : `Received ৳${(tx.amount || 0).toLocaleString()} BDT from ${tx.transferSenderName || 'member'}.`,
        timestamp: txTime,
        read: isRead,
        priority: 'normal',
        actionType: 'view_vault',
        amount: tx.amount
      });
    } else if (tx.type === 'subscription' && categoryPrefs.charter) {
      const tier = tx.subscriptionTier || 'bronze';
      const tierCap = tx.borrowingLimit || (tier === 'gold' ? 2500 : tier === 'silver' ? 1500 : 500);
      list.push({
        id: notifId,
        type: 'subscription',
        categoryLabel: 'Plan',
        title: tx.status === 'pending' ? 'Plan upgrade under review' : 'Membership plan activated',
        body:
          tx.status === 'pending'
            ? `Your ${tier.toUpperCase()} tier upgrade request (৳${(tx.amount || 0).toLocaleString()} BDT) is being reviewed.`
            : `${tier.toUpperCase()} tier active. Borrowing limit set to ৳${tierCap.toLocaleString()} BDT.`,
        timestamp: txTime,
        read: isRead,
        priority: 'normal',
        actionType: 'view_subscription',
        amount: tx.amount
      });
    }
  });

  // 4. Subscription & Charter Standing
  if (profile.subscriptionStatus === 'active' && categoryPrefs.charter) {
    const tierName = activeTier === 'gold' 
      ? 'Gold Sovereign' 
      : activeTier === 'silver' 
      ? 'Silver Executive' 
      : 'Bronze Premier';
    
    const expiryEpoch = profile.subscriptionExpiresAt ? safeToEpoch(profile.subscriptionExpiresAt, 0) : 0;
    const daysLeft = expiryEpoch > 0 ? Math.ceil((expiryEpoch - now) / (1000 * 3600 * 24)) : 30;
    const isExpiringSoon = daysLeft <= 3 && daysLeft >= 0;

    const id = `notif-charter-status-${profile.uid}`;
    list.push({
      id,
      type: 'subscription',
      categoryLabel: 'Plan',
      title: isExpiringSoon ? `${tierName} renews soon` : `${tierName} plan active`,
      body: `Loyalty streak: ${profile.continuousSubscriptionMonths || 1} month(s). ${daysLeft > 0 ? `Renews in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.` : 'Ready for renewal.'}`,
      timestamp: now - 7200000,
      read: isExpiringSoon ? readIds.includes(id) : true,
      priority: isExpiringSoon ? 'high' : 'normal',
      actionType: 'view_subscription'
    });
  }

  // 5. Security, Wallet & Account Verification
  if (categoryPrefs.security) {
    if (profile.status === 'pending') {
      const id = `notif-sec-pending-${profile.uid}`;
      list.push({
        id,
        type: 'security',
        categoryLabel: 'Verification',
        title: 'Membership application in review',
        body: 'Your identity details are under review by T.U.T. Operations. Full borrowing and deposit access unlocks upon approval.',
        timestamp: safeToEpoch(profile.createdAt, now - 300000),
        read: readIds.includes(id),
        priority: 'high'
      });
    } else {
      const id = `notif-sec-verified-${profile.uid}`;
      const accountAgeMs = now - safeToEpoch(profile.createdAt, now);
      const isNewAccount = accountAgeMs < RECENT_CUTOFF_MS;
      list.push({
        id,
        type: 'security',
        categoryLabel: 'Security',
        title: 'Account verified',
        body: `Verified profile for ${profile.name} (${profile.memberId || 'TUT-MBR'}). Session protected with encrypted access.`,
        timestamp: safeToEpoch(profile.createdAt, now - 86400000),
        read: isNewAccount ? readIds.includes(id) : true,
        priority: 'normal'
      });
    }

    if (profile.walletVerificationStatus === 'pending') {
      const id = `notif-wallet-pending-${profile.uid}`;
      list.push({
        id,
        type: 'security',
        categoryLabel: 'Wallets',
        title: 'Wallet verification pending',
        body: 'Your linked payout wallet details are under review.',
        timestamp: now - 900000,
        read: readIds.includes(id),
        priority: 'normal',
        actionType: 'view_wallets'
      });
    }
  }

  // 6. Custom saved system notifications from localStorage (if any)
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
          categoryLabel: 'System',
          title: item.title || 'System Notice',
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

export function restoreDismissedNotifications() {
  try {
    localStorage.removeItem('tut_user_dismissed_notifs');
    notifyNotificationsChanged();
  } catch {}
}
