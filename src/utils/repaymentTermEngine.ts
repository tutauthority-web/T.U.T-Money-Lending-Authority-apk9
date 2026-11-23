import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { calculateComprehensiveCreditScore } from './creditScoreEngine';

export interface RepaymentEligibilityBreakdown {
  baseDays: number;          // Standard baseline highest window (40 days = 1 month 10 days, or 30 if restricted)
  creditScoreBonus: number;  // Extra days unlocked by Credit Score
  historyBonus: number;      // Extra days unlocked by clean repayment & tx history
  capacityBonus: number;     // Extra days unlocked by available borrowing capacity & vault reserves
  maxDays: number;           // Total authorized repayment window in days
  defaultDays: number;       // Recommended default term (e.g. 30 days)
  minDateStr: string;        // YYYY-MM-DD (tomorrow)
  maxDateStr: string;        // YYYY-MM-DD (today + maxDays)
  defaultDateStr: string;    // YYYY-MM-DD (today + defaultDays)
  creditScore: number;
  creditLabel: string;
  settledRepaymentsCount: number;
  completedLoansCount: number;
  remainingCapacity: number;
  borrowingLimit: number;
  utilizationPct: number;
  isRestricted: boolean;
  restrictionReason?: string;
  tierSummary: string;
  presets: Array<{ days: number; label: string; isExtended: boolean }>;
}

/**
 * Formats a day count cleanly (e.g. 30 -> "1 Month", 40 -> "1 Mo 10 Days", 60 -> "2 Months")
 */
export function formatDurationLabel(days: number): string {
  if (days < 30) return `${days} Days`;
  const months = Math.floor(days / 30);
  const rem = days % 30;
  const moLabel = months === 1 ? '1 Mo' : `${months} Mos`;
  return rem === 0 ? moLabel : `${moLabel} ${rem}d`;
}

/**
 * Computes the member's dynamic maximum repayment date horizon.
 *
 * Institutional Policy:
 * - Standard ceiling: 1 month to 1 month 10 days (30–40 days).
 *   * Restricted / Overdue / Low Score (< 580): capped at 30 days (1 month).
 *   * Baseline verified member: 40 days (1 month 10 days).
 * - Dynamic extensions beyond 40 days (up to 90 days max) unlock automatically based on:
 *   1. Credit Score (up to +20 days)
 *   2. Previous Transaction & Repayment History (up to +15 days)
 *   3. Borrowing Capacity & Vault Reserve Buffer (up to +15 days)
 */
export function calculateAuthorizedRepaymentWindow(
  profile: any,
  transactions: any[] = [],
  requestedAmount: number = 0
): RepaymentEligibilityBreakdown {
  const report = calculateComprehensiveCreditScore(profile, transactions);
  const today = startOfDay(new Date());

  const userTier = profile?.subscriptionTier || 'bronze';
  const defaultTierLimit = userTier === 'gold' ? 2500 : userTier === 'silver' ? 1500 : 500;
  const borrowingLimit = Math.max(500, profile?.borrowingLimit ?? defaultTierLimit);
  const remainingDebt = Math.max(0, profile?.remainingDebt || 0);
  const projectedDebt = remainingDebt + Math.max(0, requestedAmount || 0);
  const remainingCapacity = Math.max(0, borrowingLimit - remainingDebt);
  const utilizationPct = borrowingLimit > 0
    ? Math.min(100, Math.round((projectedDebt / borrowingLimit) * 100))
    : 0;

  // Count confirmed history items directly from member's ledger
  const confirmedRepayments = transactions.filter(
    (t) => t.type === 'pay_due' && (t.status === 'confirmed' || t.status === 'completed')
  );
  const confirmedDeposits = transactions.filter(
    (t) => t.type === 'deposit' && (t.status === 'confirmed' || t.status === 'completed')
  );
  const settledCount = confirmedRepayments.length + report.completedLoansCount;

  // Restriction check (overdue loan or low credit standing)
  const isOverdue = report.isOverdue;
  const lowCredit = report.score < 580;
  const isRestricted = isOverdue || lowCredit;

  let baseDays = isRestricted ? 30 : 40;
  let creditScoreBonus = 0;
  let historyBonus = 0;
  let capacityBonus = 0;
  let restrictionReason: string | undefined;

  if (isOverdue) {
    restrictionReason = 'Active overdue balance caps maximum repayment window to 1 month (30 days).';
  } else if (lowCredit) {
    restrictionReason = 'Credit score below 580 caps maximum repayment window to 1 month (30 days).';
  } else {
    // 1. Credit Score Extension (max +20 days)
    if (report.score >= 780) {
      creditScoreBonus = 20;
    } else if (report.score >= 700) {
      creditScoreBonus = 12;
    } else if (report.score >= 640) {
      creditScoreBonus = 5;
    }

    // 2. Previous Transaction History Extension (max +15 days)
    if (settledCount >= 5) {
      historyBonus = 15;
    } else if (settledCount >= 2) {
      historyBonus = 8;
    } else if (settledCount >= 1 || confirmedDeposits.length >= 3) {
      historyBonus = 4;
    }

    // 3. Borrowing Capacity & Reserve Extension (max +15 days)
    const totalDeposit = Math.max(0, profile?.totalDeposit || 0);
    const healthyCapacity = utilizationPct <= 45;
    const highCapacityTier = borrowingLimit >= 1500;
    const strongCollateral = totalDeposit >= Math.max(1500, projectedDebt);

    if (healthyCapacity && highCapacityTier && strongCollateral) {
      capacityBonus = 15;
    } else if ((healthyCapacity && highCapacityTier) || strongCollateral) {
      capacityBonus = 8;
    } else if (utilizationPct <= 65 && remainingCapacity >= 500) {
      capacityBonus = 4;
    }
  }

  const rawMaxDays = baseDays + creditScoreBonus + historyBonus + capacityBonus;
  const maxDays = Math.min(90, Math.max(30, rawMaxDays));
  const defaultDays = Math.min(30, maxDays);

  const minDateStr = format(addDays(today, 1), 'yyyy-MM-dd');
  const maxDateStr = format(addDays(today, maxDays), 'yyyy-MM-dd');
  const defaultDateStr = format(addDays(today, defaultDays), 'yyyy-MM-dd');

  const totalBonus = creditScoreBonus + historyBonus + capacityBonus;
  const tierSummary = isRestricted
    ? 'Standard 30-day cap active'
    : totalBonus > 0
      ? `Standard 40d + ${totalBonus}d extended`
      : 'Standard 1 mo – 1 mo 10d window';

  // Smart quick-select presets tailored to member's unlocked term
  const presets: Array<{ days: number; label: string; isExtended: boolean }> = [
    { days: 15, label: '15 Days', isExtended: false },
    { days: 30, label: '1 Month (30d)', isExtended: false },
  ];

  if (maxDays >= 40) {
    presets.push({ days: 40, label: '1M 10D (40d)', isExtended: false });
  }

  if (maxDays > 40) {
    if (maxDays >= 60 && maxDays !== 60) {
      presets.push({ days: 60, label: '2 Months (60d)', isExtended: true });
    }
    presets.push({
      days: maxDays,
      label: `Max (${formatDurationLabel(maxDays)})`,
      isExtended: true,
    });
  }

  return {
    baseDays,
    creditScoreBonus,
    historyBonus,
    capacityBonus,
    maxDays,
    defaultDays,
    minDateStr,
    maxDateStr,
    defaultDateStr,
    creditScore: report.score,
    creditLabel: report.label,
    settledRepaymentsCount: settledCount,
    completedLoansCount: report.completedLoansCount,
    remainingCapacity,
    borrowingLimit,
    utilizationPct,
    isRestricted,
    restrictionReason,
    tierSummary,
    presets,
  };
}

/**
 * Validates a YYYY-MM-DD repayment date string against the authorized window.
 */
export function validateRepaymentDate(
  dateStr: string,
  eligibility: RepaymentEligibilityBreakdown
): { valid: boolean; daysSelected: number; error?: string } {
  if (!dateStr) {
    return { valid: false, daysSelected: 0, error: 'Please select a repayment date.' };
  }

  const today = startOfDay(new Date());
  const parsed = startOfDay(parseISO(dateStr));

  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, daysSelected: 0, error: 'Invalid calendar date.' };
  }

  const daysSelected = differenceInCalendarDays(parsed, today);

  if (daysSelected < 1) {
    return {
      valid: false,
      daysSelected,
      error: 'Repayment date must be at least 1 day from today.',
    };
  }

  if (daysSelected > eligibility.maxDays) {
    return {
      valid: false,
      daysSelected,
      error: `Exceeds your ${eligibility.maxDays}-day limit (max ${format(parseISO(eligibility.maxDateStr), 'dd MMM yyyy')}).`,
    };
  }

  return { valid: true, daysSelected };
}
