import { format } from 'date-fns';

export type LoanStatusCode = 'ACTIVE' | 'PARTIALLY PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface AllocatedLoan {
  id: string;
  memoId: string;
  userId: string;
  userName?: string;
  borrowerName?: string;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: LoanStatusCode;
  statusLabel: string; // 'PAID / COMPLETED' | 'PARTIALLY PAID' | 'ACTIVE' | 'OVERDUE' | 'CANCELLED'
  disbursedDate: Date;
  disbursedDateStr: string;
  dueDate: Date;
  dueDateStr: string;
  isOverdue: boolean;
  purpose?: string;
  method?: string;
  monthlyInstallment?: number;
  loanNumber: string; // e.g. "Loan #001", "Pay #001"
  trancheType?: 'loan' | 'merchant_payment';
  merchantName?: string;
  orderId?: string;
  cardLast4?: string;
  rawTransaction: any;
}

export interface MemberLoanSummary {
  userId: string;
  totalBorrowed: number;
  totalRepaid: number;
  totalOutstanding: number;
  activeLoans: number;
  completedLoans: number;
  overdueLoans: number;
  partiallyPaidLoans: number;
  loans: AllocatedLoan[];
}

/**
 * Robust date parser handling Firestore Timestamps, Date instances, ISO strings, and millisecond numbers
 */
export function parseDateSafe(val: any, fallbackDate = new Date()): Date {
  if (!val) return fallbackDate;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val?.toDate === 'function') {
    try {
      const d = val.toDate();
      if (!isNaN(d.getTime())) return d;
    } catch {}
  }
  if (typeof val?.seconds === 'number') {
    const d = new Date(val.seconds * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return fallbackDate;
}

/**
 * Derives the due date for a loan.
 * If explicit dueDate exists, uses it.
 * If estimatedRepaymentDate is a valid date, uses it.
 * Otherwise defaults to 30 days after disbursal date.
 */
export function getLoanDueDate(tx: any, disbursedDate: Date): Date {
  if (tx.dueDate) {
    const d = parseDateSafe(tx.dueDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (tx.estimatedRepaymentDate && typeof tx.estimatedRepaymentDate === 'string') {
    const parsed = new Date(tx.estimatedRepaymentDate);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  // Default: 30 days from disbursement
  return new Date(disbursedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
}

/**
 * Extracts a numeric timestamp for reliable chronological sorting
 */
function getTimestampNum(tx: any): number {
  if (typeof tx.timestamp?.seconds === 'number') return tx.timestamp.seconds * 1000;
  if (typeof tx.timestamp?.toMillis === 'function') {
    try { return tx.timestamp.toMillis(); } catch {}
  }
  const d = parseDateSafe(tx.timestamp || tx.createdAt || tx.approvedDate, new Date(0));
  return d.getTime();
}

/**
 * Identifies transactions that create active debt obligations:
 * - Standard portal loans (type === 'loan')
 * - Credit-line funded T.U.T. Card / Wallet external payments
 */
export function isCreditDebtTransaction(t: any): boolean {
  if (!t) return false;
  if (t.type === 'loan') return true;
  if (t.type === 'merchant_payment' || t.type === 'card_payment' || t.type === 'wallet_payment') {
    if (t.fundingSource === 'wallet_deposit') return false;
    if (t.fundingSource === 'credit_line' || t.isCreditLine === true || t.paymentInstrument === 'tut_credit') {
      return true;
    }
    const ref = String(t.reference || '').toLowerCase();
    const reason = String(t.loanReason || '').toLowerCase();
    if (ref.includes('credit line') || ref.includes('credit_line') || reason.includes('credit pay')) {
      return true;
    }
  }
  return false;
}

/**
 * Calculates individual loan & credit payment allocations for a single member based on their confirmed transactions.
 * 
 * CORE ALLOCATION RULE:
 * - Each loan or credit-funded payment maintains its own independent balance and status.
 * - Repayments are allocated chronologically (oldest obligation first).
 * - An obligation is never marked active simply because a member has remaining debt elsewhere.
 */
export function calculateMemberLoanAllocations(
  userId: string,
  allTransactions: any[],
  userProfile?: { remainingDebt?: number; totalLoan?: number; totalRepaid?: number }
): MemberLoanSummary {
  // 1. Gather all transactions belonging to this user
  const userTxs = allTransactions.filter((t) => t.userId === userId);

  // 2. Identify all valid debt-creating obligations (loans + credit-funded payments)
  // Exclude pending/rejected requests which haven't been disbursed/confirmed
  const isValidObligationStatus = (t: any) => {
    const st = t.status as string;
    return st === 'confirmed' || st === 'settled' || st === 'repaid' || t.isPaid === true || st === 'cancelled';
  };

  const loans = userTxs.filter((t) => isCreditDebtTransaction(t) && isValidObligationStatus(t));

  // Backward-compatibility: if member has remainingDebt from an earlier T.U.T. Card credit payment
  // recorded before fundingSource metadata was saved, include unmatched merchant payments cleanly.
  if (userProfile && typeof userProfile.remainingDebt === 'number' && userProfile.remainingDebt > 0) {
    const recognizedPrincipal = loans
      .filter((t) => t.status !== 'cancelled' && t.status !== 'settled' && t.status !== 'repaid' && !t.isPaid)
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    if (recognizedPrincipal < userProfile.remainingDebt) {
      let gap = userProfile.remainingDebt - recognizedPrincipal;
      const existingIds = new Set(loans.map((t) => t.id));
      const candidateMerchantPays = userTxs
        .filter(
          (t) =>
            !existingIds.has(t.id) &&
            (t.type === 'merchant_payment' || t.type === 'card_payment' || t.type === 'wallet_payment') &&
            t.fundingSource !== 'wallet_deposit' &&
            t.status === 'confirmed' &&
            !t.isPaid
        )
        .sort((a, b) => getTimestampNum(b) - getTimestampNum(a));
      for (const candidate of candidateMerchantPays) {
        if (gap <= 0) break;
        const amt = Number(candidate.amount) || 0;
        if (amt > 0 && amt <= gap) {
          loans.push(candidate);
          gap -= amt;
        }
      }
    }
  }

  // Sort obligations chronologically (oldest first) for allocation
  loans.sort((a, b) => getTimestampNum(a) - getTimestampNum(b));

  // 3. Identify all confirmed repayments made by the member
  // Repayment types in the system: 'pay_due', 'refund', or 'repayment'
  const repayments = userTxs.filter((t) => {
    const isRepay = t.type === 'pay_due' || t.type === 'refund' || t.type === 'repayment';
    if (!isRepay) return false;
    const st = t.status as string;
    return st === 'confirmed' || st === 'approved' || st === 'settled' || st === 'repaid';
  });

  // Sum total confirmed repayments
  const totalRepaidAmount = repayments.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);

  // Pool of funds available to allocate from oldest to newest loan
  let remainingRepayPool = totalRepaidAmount;

  let totalBorrowed = 0;
  const now = new Date();

  let loanSeq = 0;
  let paySeq = 0;

  // Baseline calculation using chronological repayment pool
  let allocatedLoans: AllocatedLoan[] = loans.map((tx) => {
    const originalAmount = Math.max(0, Number(tx.amount) || 0);
    const isCancelled = tx.status === 'cancelled';
    const isExplicitlySettled = tx.status === 'settled' || tx.status === 'repaid' || tx.isPaid === true;
    const isExternalPay = tx.type === 'merchant_payment' || tx.type === 'card_payment' || tx.type === 'wallet_payment';

    if (isExternalPay) paySeq += 1;
    else loanSeq += 1;

    const disbursedDate = parseDateSafe(tx.timestamp || tx.createdAt || tx.approvedDate);
    const dueDate = getLoanDueDate(tx, disbursedDate);
    const isPastDue = getCalendarDaysFromToday(dueDate, now) < 0;

    let paidAmount = 0;
    let remainingAmount = 0;
    let status: LoanStatusCode = 'ACTIVE';
    let statusLabel = 'ACTIVE';

    if (isCancelled) {
      status = 'CANCELLED';
      statusLabel = 'CANCELLED';
      paidAmount = 0;
      remainingAmount = 0;
    } else {
      totalBorrowed += originalAmount;

      if (isExplicitlySettled) {
        paidAmount = originalAmount;
        remainingAmount = 0;
      } else {
        // Chronological allocation: oldest obligation is filled first
        paidAmount = Math.min(originalAmount, remainingRepayPool);
        remainingRepayPool = Math.max(0, remainingRepayPool - paidAmount);
        remainingAmount = Math.max(0, originalAmount - paidAmount);
      }

      if (remainingAmount === 0) {
        status = 'PAID';
        statusLabel = 'PAID / COMPLETED';
      } else if (isPastDue) {
        status = 'OVERDUE';
        statusLabel = 'OVERDUE';
      } else if (paidAmount > 0) {
        status = 'PARTIALLY PAID';
        statusLabel = 'PARTIALLY PAID';
      } else {
        status = 'ACTIVE';
        statusLabel = 'ACTIVE';
      }
    }

    const loanNum = isExternalPay
      ? `Pay #${String(paySeq).padStart(3, '0')}`
      : `Loan #${String(loanSeq).padStart(3, '0')}`;
    let formattedDisbursed = 'Recently';
    try {
      formattedDisbursed = format(disbursedDate, 'dd MMM, yyyy');
    } catch {}

    let formattedDue = '10th of next month';
    try {
      formattedDue = format(dueDate, 'dd MMM, yyyy');
    } catch {
      if (typeof tx.estimatedRepaymentDate === 'string') {
        formattedDue = tx.estimatedRepaymentDate;
      }
    }

    const defaultPurpose = isExternalPay
      ? `${tx.merchantName || 'Partner App'}${tx.orderId ? ` • ${tx.orderId}` : ''}`
      : 'Loan Disbursal';

    return {
      id: tx.id,
      memoId: tx.memoId || tx.id,
      userId: tx.userId,
      userName: tx.userName,
      borrowerName: tx.userName || tx.borrowerName,
      originalAmount,
      paidAmount,
      remainingAmount,
      status,
      statusLabel,
      disbursedDate,
      disbursedDateStr: formattedDisbursed,
      dueDate,
      dueDateStr: formattedDue,
      isOverdue: status === 'OVERDUE',
      purpose: tx.loanReason || tx.purpose || defaultPurpose,
      method: tx.method || (isExternalPay ? 'T.U.T. Wallet' : 'bKash'),
      monthlyInstallment: tx.monthlyInstallment,
      loanNumber: loanNum,
      trancheType: isExternalPay ? 'merchant_payment' : 'loan',
      merchantName: tx.merchantName,
      orderId: tx.orderId,
      cardLast4: tx.cardLast4,
      rawTransaction: tx
    };
  });

  // If userProfile contains authoritative debt information, ensure allocatedLoans strictly reflect it
  if (userProfile && typeof userProfile.remainingDebt === 'number') {
    const targetRemainingDebt = Math.max(0, userProfile.remainingDebt);
    
    if (targetRemainingDebt === 0) {
      // Mark all non-cancelled loans as settled/paid
      allocatedLoans = allocatedLoans.map(l => {
        if (l.status === 'CANCELLED') return l;
        return {
          ...l,
          paidAmount: l.originalAmount,
          remainingAmount: 0,
          status: 'PAID',
          statusLabel: 'PAID / COMPLETED',
          isOverdue: false
        };
      });
    } else {
      // The member has an active outstanding debt of targetRemainingDebt.
      // Allocate this debt starting from the newest active loan backwards.
      let unassignedDebt = targetRemainingDebt;
      
      // Traverse from newest obligation to oldest (respecting explicitly settled rows)
      for (let i = allocatedLoans.length - 1; i >= 0; i--) {
        const l = allocatedLoans[i];
        if (l.status === 'CANCELLED') continue;
        const isRowSettled =
          l.rawTransaction?.status === 'settled' ||
          l.rawTransaction?.status === 'repaid' ||
          l.rawTransaction?.isPaid === true;
        if (isRowSettled) {
          allocatedLoans[i] = {
            ...l,
            remainingAmount: 0,
            paidAmount: l.originalAmount,
            status: 'PAID',
            statusLabel: 'PAID / COMPLETED',
            isOverdue: false
          };
          continue;
        }

        if (unassignedDebt > 0) {
          const allocDebt = Math.min(l.originalAmount, unassignedDebt);
          const newPaid = Math.max(0, l.originalAmount - allocDebt);
          unassignedDebt -= allocDebt;

          const isPastDue = getCalendarDaysFromToday(l.dueDate, now) < 0;
          let newStatus: LoanStatusCode = 'ACTIVE';
          let newStatusLabel = 'ACTIVE';

          if (allocDebt === 0) {
            newStatus = 'PAID';
            newStatusLabel = 'PAID / COMPLETED';
          } else if (isPastDue) {
            newStatus = 'OVERDUE';
            newStatusLabel = 'OVERDUE';
          } else if (newPaid > 0) {
            newStatus = 'PARTIALLY PAID';
            newStatusLabel = 'PARTIALLY PAID';
          }

          allocatedLoans[i] = {
            ...l,
            remainingAmount: allocDebt,
            paidAmount: newPaid,
            status: newStatus,
            statusLabel: newStatusLabel,
            isOverdue: newStatus === 'OVERDUE'
          };
        } else {
          // Debt requirement fulfilled; earlier loans are paid
          allocatedLoans[i] = {
            ...l,
            remainingAmount: 0,
            paidAmount: l.originalAmount,
            status: 'PAID',
            statusLabel: 'PAID / COMPLETED',
            isOverdue: false
          };
        }
      }

      // If there was debt remaining that exceeds existing transactions (or no loan tx exists)
      if (unassignedDebt > 0 && allocatedLoans.length > 0) {
        const newest = allocatedLoans[allocatedLoans.length - 1];
        const newestPastDue = getCalendarDaysFromToday(newest.dueDate, now) < 0;
        allocatedLoans[allocatedLoans.length - 1] = {
          ...newest,
          remainingAmount: newest.remainingAmount + unassignedDebt,
          status: newestPastDue ? 'OVERDUE' : 'ACTIVE',
          statusLabel: newestPastDue ? 'OVERDUE' : 'ACTIVE',
          isOverdue: newestPastDue
        };
      }
    }
  }

  // Count metrics
  let activeCount = 0;
  let completedCount = 0;
  let overdueCount = 0;
  let partiallyPaidCount = 0;

  allocatedLoans.forEach((l) => {
    if (l.status === 'CANCELLED') return;
    if (l.remainingAmount === 0) {
      completedCount++;
    } else {
      activeCount++;
      if (l.status === 'OVERDUE') overdueCount++;
      if (l.status === 'PARTIALLY PAID') partiallyPaidCount++;
    }
  });

  const totalOutstanding = userProfile && typeof userProfile.remainingDebt === 'number'
    ? userProfile.remainingDebt
    : allocatedLoans.reduce((sum, l) => sum + (l.status !== 'CANCELLED' ? l.remainingAmount : 0), 0);

  if (totalOutstanding > 0 && activeCount === 0) {
    activeCount = 1;
  }

  const totalBorrowedVal = userProfile?.totalLoan && userProfile.totalLoan > totalBorrowed
    ? userProfile.totalLoan
    : totalBorrowed;

  const finalTotalRepaid = userProfile?.totalRepaid !== undefined
    ? userProfile.totalRepaid
    : Math.max(0, totalBorrowedVal - totalOutstanding);

  // Return loans sorted NEWEST FIRST (new-to-old wise) as requested by user
  const newestFirstLoans = [...allocatedLoans].sort((a, b) => {
    const tsA = getTimestampNum(a.rawTransaction);
    const tsB = getTimestampNum(b.rawTransaction);
    return tsB - tsA;
  });

  return {
    userId,
    totalBorrowed: totalBorrowedVal,
    totalRepaid: finalTotalRepaid,
    totalOutstanding,
    activeLoans: activeCount,
    completedLoans: completedCount,
    overdueLoans: overdueCount,
    partiallyPaidLoans: partiallyPaidCount,
    loans: newestFirstLoans
  };
}

/**
 * Calculates allocation for all users across the entire system.
 */
export function calculateAllMembersLoanSummaries(
  allTransactions: any[]
): Map<string, MemberLoanSummary> {
  const map = new Map<string, MemberLoanSummary>();
  const userIds = new Set<string>();

  allTransactions.forEach((t) => {
    if (t.userId) userIds.add(t.userId);
  });

  userIds.forEach((uid) => {
    map.set(uid, calculateMemberLoanAllocations(uid, allTransactions));
  });

  return map;
}

/**
 * Returns a flattened, sorted list of all allocated loans across the system.
 * Used by the Admin Disbursed Loans Registry.
 */
export function getAllAllocatedLoans(
  allTransactions: any[]
): AllocatedLoan[] {
  const summaries = calculateAllMembersLoanSummaries(allTransactions);
  const allLoans: AllocatedLoan[] = [];

  summaries.forEach((summary) => {
    allLoans.push(...summary.loans);
  });

  // Sort by disbursed date descending (newest loans first)
  allLoans.sort((a, b) => b.disbursedDate.getTime() - a.disbursedDate.getTime());
  return allLoans;
}

/**
 * Returns styling classes and badges for loan statuses
 */
export function getLoanStatusConfig(status: LoanStatusCode): {
  label: string;
  badgeClass: string;
  textClass: string;
  borderClass: string;
  bgClass: string;
} {
  switch (status) {
    case 'PAID':
      return {
        label: 'PAID / COMPLETED',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-500/30',
        bgClass: 'bg-emerald-950/20'
      };
    case 'PARTIALLY PAID':
      return {
        label: 'PARTIALLY PAID',
        badgeClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
        textClass: 'text-cyan-400',
        borderClass: 'border-cyan-500/30',
        bgClass: 'bg-cyan-950/20'
      };
    case 'OVERDUE':
      return {
        label: 'OVERDUE',
        badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
        textClass: 'text-rose-400',
        borderClass: 'border-rose-500/40',
        bgClass: 'bg-rose-950/30'
      };
    case 'CANCELLED':
      return {
        label: 'CANCELLED',
        badgeClass: 'bg-slate-700/40 text-slate-400 border border-slate-600/40',
        textClass: 'text-slate-400',
        borderClass: 'border-slate-700',
        bgClass: 'bg-slate-900/50'
      };
    case 'ACTIVE':
    default:
      return {
        label: 'ACTIVE',
        badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500/30',
        bgClass: 'bg-amber-950/20'
      };
  }
}

export type DueUrgency = 'overdue' | 'today' | 'upcoming' | 'normal';

export interface MemberDueRadarItem {
  member: any;
  summary: MemberLoanSummary;
  openTranches: AllocatedLoan[];
  primaryTranche: AllocatedLoan | null;
  primaryLoanTx: any | null;
  activeDebt: number;
  daysDiff: number | null;
  dueDate: Date | null;
  dueDateLabel: string;
  urgency: DueUrgency;
  lastReminderSent: string | null;
  sentToday: boolean;
}

/**
 * Computes day-normalized difference between a target date and today:
 * negative => days overdue, 0 => due today, positive => days remaining.
 */
export function getCalendarDaysFromToday(targetDate: Date, referenceDate: Date = new Date()): number {
  const todayStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const dueStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  return Math.round((dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Single authoritative Due & Overdue Radar builder shared by Admin Dashboard KPIs,
 * Active Debts Portfolio, Automated Email Reminder Scanner, and Email Hub Radar.
 */
export function buildMemberDueRadar(
  allUsers: any[],
  allTransactions: any[],
  leadDays: number = 3,
  referenceDate: Date = new Date()
): MemberDueRadarItem[] {
  const todayStr = format(referenceDate, 'yyyy-MM-dd');

  const activeUsers = (allUsers || []).filter((u) => {
    if (!u || !u.uid) return false;
    return Number(u.remainingDebt || 0) > 0;
  });

  const items: MemberDueRadarItem[] = activeUsers.map((member) => {
    const summary = calculateMemberLoanAllocations(member.uid, allTransactions || [], member);
    const openTranches = summary.loans.filter((l) => l.remainingAmount > 0 && l.status !== 'CANCELLED');

    // Pick the most urgent open tranche (overdue / earliest due date first)
    const sortedOpen = [...openTranches].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const primaryTranche = sortedOpen[0] || null;
    const primaryLoanTx = primaryTranche?.rawTransaction || null;

    let dueDate: Date | null = primaryTranche?.dueDate || null;
    if (!dueDate && member.nextRepaymentDate) {
      const parsed = parseDateSafe(member.nextRepaymentDate);
      if (!isNaN(parsed.getTime())) dueDate = parsed;
    }

    const daysDiff = dueDate ? getCalendarDaysFromToday(dueDate, referenceDate) : null;
    const dueDateLabel = dueDate ? format(dueDate, 'dd MMM yyyy') : '30-Day Standard Window';

    let urgency: DueUrgency = 'normal';
    if (daysDiff !== null) {
      if (daysDiff < 0) urgency = 'overdue';
      else if (daysDiff === 0) urgency = 'today';
      else if (daysDiff <= Math.max(1, leadDays)) urgency = 'upcoming';
    } else if (summary.overdueLoans > 0) {
      urgency = 'overdue';
    }

    // Resolve most recent reminder date across open loan transactions or user profile
    let lastReminderSent: string | null = null;
    openTranches.forEach((tr) => {
      const sent = tr.rawTransaction?.lastReminderSent;
      if (typeof sent === 'string' && sent.trim()) {
        if (!lastReminderSent || sent > lastReminderSent) lastReminderSent = sent;
      }
    });
    if (!lastReminderSent && typeof member.lastReminderSent === 'string' && member.lastReminderSent.trim()) {
      lastReminderSent = member.lastReminderSent;
    }

    return {
      member,
      summary,
      openTranches,
      primaryTranche,
      primaryLoanTx,
      activeDebt: Math.max(Number(member.remainingDebt || 0), summary.totalOutstanding || 0),
      daysDiff,
      dueDate,
      dueDateLabel,
      urgency,
      lastReminderSent,
      sentToday: lastReminderSent === todayStr
    };
  });

  const priorityRank: Record<DueUrgency, number> = {
    overdue: 0,
    today: 1,
    upcoming: 2,
    normal: 3
  };

  return items.sort((a, b) => {
    const rankDiff = priorityRank[a.urgency] - priorityRank[b.urgency];
    if (rankDiff !== 0) return rankDiff;
    if (a.daysDiff !== null && b.daysDiff !== null && a.daysDiff !== b.daysDiff) {
      return a.daysDiff - b.daysDiff;
    }
    return b.activeDebt - a.activeDebt;
  });
}
