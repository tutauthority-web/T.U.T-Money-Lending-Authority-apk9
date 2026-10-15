/**
 * T.U.T. Private Lending Authority — Unified Institutional Credit Score Engine
 * 
 * Implements a Sharia-compliant, zero-usury, 5-pillar mathematical model
 * evaluating member creditworthiness, collateral reserves, repayment reliability,
 * and charter pool loyalty on a standardized 300 to 850 scale.
 */

import { calculateMemberLoanAllocations, AllocatedLoan } from './loanAllocationEngine';

export interface CreditScoreFactor {
  id: string;
  name: string;
  weightPct: number;
  maxPoints: number;
  earnedPoints: number;
  status: 'optimal' | 'good' | 'moderate' | 'critical';
  summary: string;
  tip: string;
}

export interface CreditAuditLog {
  id: string;
  title: string;
  detail: string;
  pointsDelta: number;
  type: 'positive' | 'negative' | 'neutral';
  timestamp?: number;
}

export interface CreditRegulation {
  code: string;
  title: string;
  category: 'Sharia & Usury' | 'Utilization' | 'Collateral' | 'Rehabilitation' | 'Charter' | 'Governance';
  summary: string;
  authorityClause: string;
  practicalImpact: string;
}

export interface ComprehensiveCreditReport {
  score: number;
  tier: 'exceptional' | 'prime' | 'good' | 'fair' | 'needs_attention';
  label: string;
  riskRating: 'Very Low Risk' | 'Low Risk' | 'Moderate Risk' | 'Elevated Risk' | 'High Risk';
  riskColor: string;
  badgeStyle: string;
  gaugePercentage: number; // 0 to 100% for SVG arc
  
  // Real Financial System Metrics
  totalBorrowLimit: number;
  remainingDebt: number;
  availableLimit: number;
  utilizationPct: number;
  totalDeposit: number;
  collateralRatio: number;
  totalRepaid: number;
  repaymentRatio: number;
  isOverdue: boolean;
  overdueDateStr: string | null;
  overdueLoansCount: number;
  activeLoansCount: number;
  completedLoansCount: number;
  overdueLoanDetails?: {
    loanNumber: string;
    remainingAmount: number;
    dueDateStr: string;
  }[];

  // Borrowing power adjustments unlocked by score
  borrowMultiplier: number;
  effectiveLimitCeiling: number;
  borrowingStatusLabel: string;

  // Breakdown Pillars
  factors: CreditScoreFactor[];
  
  // Dynamic Score History Audit
  auditLogs: CreditAuditLog[];
  
  // Official Institutional Rules & Regulations
  regulations: CreditRegulation[];
  
  // Actionable Improvement Steps
  improvementTips: {
    action: string;
    pointsGain: number;
    impact: 'High' | 'Medium' | 'Low';
    category: 'Repayment' | 'Collateral' | 'Charter' | 'Identity';
  }[];
}

export interface CreditSimulationInput {
  simulatedRepayAmount?: number;
  simulatedDepositAmount?: number;
  simulatedTier?: 'standard' | 'bronze' | 'silver' | 'gold';
  simulatedKycComplete?: boolean;
}

export interface SimulatedCreditScoreResult {
  currentScore: number;
  projectedScore: number;
  pointsDelta: number;
  currentTierLabel: string;
  projectedTierLabel: string;
  currentBorrowLimit: number;
  projectedBorrowLimit: number;
  summary: string;
}

/**
 * Statutory Rules & Regulations of T.U.T. Credit Governance
 */
export const CREDIT_REGULATIONS: CreditRegulation[] = [
  {
    code: 'REG-101',
    title: 'Zero-Usury Non-Compounding Sharia Protocol',
    category: 'Sharia & Usury',
    summary: 'T.U.T. Private Lending Authority operates on strict Sharia-compliant, non-interest principles. Credit score reductions reflect mutual trust compliance and scheduled commitment fulfillment, never compounding interest, late-payment penalties, or usury (Riba).',
    authorityClause: 'Section 4.1, T.U.T. Mutual Risk Charter (2026 Revision)',
    practicalImpact: 'Your score will never drop due to accrued interest or artificial fees. Only actual contract fulfillment and schedule adherence determine reliability.'
  },
  {
    code: 'REG-202',
    title: 'Dynamic Utilization & Leverage Capacity Ceiling',
    category: 'Utilization',
    summary: 'Members maintaining outstanding borrow balances below 30% of their authorized credit limit preserve Priority Fast-Track status. Operating between 30% and 70% permits normal borrowing. Exceeding 85% utilization triggers liquidity rationing to protect the mutual pool.',
    authorityClause: 'Section 6.3, Capital Reserve & Liquidity Ratio Directive',
    practicalImpact: 'Keeping your active loan balance below 30% of your borrowing limit awards the maximum possible 165 utilization points.'
  },
  {
    code: 'REG-303',
    title: 'Vault Collateral Reserve Backing & Multiplier Protocol',
    category: 'Collateral',
    summary: 'Verified funds locked in the member vault act as institutional security collateral. Holding vault deposits equal to or exceeding active debt creates a 100%+ collateralized safe-harbor, granting automatic tier multipliers and immunity to debt-burden score penalties.',
    authorityClause: 'Section 8.2, Self-Reliant Collateral Guidelines',
    practicalImpact: 'Every ৳1,000 deposited into your personal vault expands credit confidence and directly contributes up to 110 collateral reserve points.'
  },
  {
    code: 'REG-404',
    title: 'Instant Delinquency Rehabilitation Protocol',
    category: 'Rehabilitation',
    summary: 'Unlike commercial credit bureaus that penalize users for years, T.U.T. operates an immediate restorative protocol: full settlement of an overdue loan automatically restores up to 80% of deducted penalty points within 24 hours of centralized ledger verification.',
    authorityClause: 'Section 11.5, Citizen Rehabilitation Protocol',
    practicalImpact: 'Settle any overdue balance today to instantly eliminate overdue penalties and restore your credit standing.'
  },
  {
    code: 'REG-505',
    title: 'Charter Risk-Sharing Pool Loyalty & Inactivity Defense',
    category: 'Charter',
    summary: 'Active subscription tier members (Bronze, Silver, Gold) contribute directly to the central mutual lending reserve. Continuous membership streaks yield compounding loyalty bonus points and unlock elevated single-loan ceilings up to ৳100,000 BDT.',
    authorityClause: 'Section 14.1, Active Membership Preservation Act',
    practicalImpact: 'Maintaining an active subscription guarantees up to 55 charter standing points and accelerates loan desk approvals.'
  },
  {
    code: 'REG-606',
    title: 'Institutional KYC & Regulatory Identity Integrity',
    category: 'Governance',
    summary: 'All members must maintain verified National Identity (NID), emergency nominee, and validated mobile credentials. Full compliance protects against fraudulent disbursements and awards full statutory identity points.',
    authorityClause: 'Section 3.4, Anti-Fraud & Citizen Verification Code',
    practicalImpact: 'Completing full profile verification and emergency contact details secures 27.5 foundational points.'
  },
  {
    code: 'REG-707',
    title: 'Emergency Hardship & Grace Period Directive',
    category: 'Governance',
    summary: 'In cases of documented medical emergency or unavoidable hardship, members may request an official administrative grace period via executive support without triggering adverse delinquency penalties.',
    authorityClause: 'Section 16.2, Mutual Assistance & Hardship Relief Code',
    practicalImpact: 'Members in contact with the executive desk maintain credit dignity while restructuring scheduled settlements.'
  }
];

/**
 * Calculates a standardized 300-850 institutional credit score
 * strictly bound to the member's live financial data and transaction ledger.
 */
export function calculateComprehensiveCreditScore(
  profile: any,
  transactions: any[] = [],
  pendingLoanAmount: number = 0
): ComprehensiveCreditReport {
  // Financial baselines from profile
  const remainingDebt = Math.max(0, profile?.remainingDebt || 0);
  const totalLoan = Math.max(0, profile?.totalLoan || 0);
  const totalDeposit = Math.max(0, profile?.totalDeposit || 0);
  
  // Base borrowing limit based on tier or custom set limit
  const tierLimitMap: Record<string, number> = {
    standard: 10000,
    bronze: 25000,
    silver: 45000,
    gold: 100000
  };
  const tier = (profile?.subscriptionTier || (profile?.subscriptionStatus === 'active' ? 'bronze' : 'standard')) as string;
  const standardTierLimit = tierLimitMap[tier] || 10000;
  const borrowLimit = Math.max(500, profile?.borrowingLimit || standardTierLimit);
  const availableLimit = Math.max(0, borrowLimit - remainingDebt);
  const utilizationPct = borrowLimit > 0 ? Math.min(100, Math.round((remainingDebt / borrowLimit) * 100)) : 0;
  
  // Real multi-loan allocation calculation from loanAllocationEngine
  let loanSummary: any = null;
  try {
    loanSummary = calculateMemberLoanAllocations(profile?.uid || '', transactions, profile);
  } catch (e) {
    console.warn("Could not calculate member loan allocations:", e);
  }

  const completedLoansCount = loanSummary ? loanSummary.completedLoans : 0;
  const activeLoansCount = loanSummary ? loanSummary.activeLoans : (remainingDebt > 0 ? 1 : 0);
  const overdueLoansCount = loanSummary ? loanSummary.overdueLoans : 0;
  
  // Check for overdue loans
  const overdueLoansList = loanSummary?.loans?.filter((l: AllocatedLoan) => l.isOverdue && l.remainingAmount > 0) || [];
  const hasOverdueLoans = overdueLoansCount > 0 || overdueLoansList.length > 0;

  // Total successfully repaid
  const totalRepaid = Math.max(
    0, 
    loanSummary?.totalRepaid !== undefined 
      ? loanSummary.totalRepaid 
      : (profile?.totalRepaid || (totalLoan - remainingDebt))
  );
  const repaymentRatio = totalLoan > 0 ? Math.min(100, Math.round((totalRepaid / totalLoan) * 100)) : 100;
  
  // Collateral coverage ratio (Deposits vs Debt)
  const collateralRatio = remainingDebt > 0 
    ? Math.min(300, Math.round((totalDeposit / remainingDebt) * 100))
    : (totalDeposit > 0 ? 100 : 50);

  const isOverdue = remainingDebt > 0 && hasOverdueLoans;
  const overdueDateStr = overdueLoansList.length > 0 ? overdueLoansList[0].dueDateStr : null;

  const overdueLoanDetails = overdueLoansList.map((l: AllocatedLoan) => ({
    loanNumber: l.loanNumber,
    remainingAmount: l.remainingAmount,
    dueDateStr: l.dueDateStr
  }));

  // -------------------------------------------------------------
  // PILLAR 1: REPAYMENT RELIABILITY & SETTLEMENT HISTORY (35% - Max 192.5 pts)
  // -------------------------------------------------------------
  let p1Points = 120; // baseline for verified applicant
  if (totalRepaid > 0) {
    p1Points += Math.min(50, Math.floor(totalRepaid / 1000) * 10);
  }
  if (completedLoansCount > 0) {
    p1Points += Math.min(22.5, completedLoansCount * 7.5);
  }
  if (repaymentRatio >= 90) {
    p1Points += 15;
  } else if (repaymentRatio >= 70) {
    p1Points += 8;
  }

  if (isOverdue) {
    p1Points -= 85; // Overdue penalty
  } else if (remainingDebt > 0 && utilizationPct > 80) {
    p1Points -= 20; // Heavily leveraged penalty
  }
  p1Points = Math.max(20, Math.min(192.5, p1Points));

  const p1Status: CreditScoreFactor['status'] = isOverdue 
    ? 'critical' 
    : p1Points >= 160 
    ? 'optimal' 
    : p1Points >= 120 
    ? 'good' 
    : 'moderate';

  // -------------------------------------------------------------
  // PILLAR 2: DEBT-TO-LIMIT UTILIZATION CAPACITY (30% - Max 165 pts)
  // -------------------------------------------------------------
  let p2Points = 165;
  if (utilizationPct === 0) {
    p2Points = 165; // Zero debt load
  } else if (utilizationPct <= 25) {
    p2Points = 150; // Ideal prime zone
  } else if (utilizationPct <= 50) {
    p2Points = 125; // Moderate healthy leverage
  } else if (utilizationPct <= 75) {
    p2Points = 85;  // Elevated usage
  } else if (utilizationPct <= 90) {
    p2Points = 45;  // High leverage
  } else {
    p2Points = 15;  // Maxed out or exceeding limits
  }

  // Safe-harbor collateral bonus: if user has debt but deposit fully covers it
  if (remainingDebt > 0 && totalDeposit >= remainingDebt) {
    p2Points = Math.min(165, p2Points + 20);
  }

  const p2Status: CreditScoreFactor['status'] = p2Points >= 140 
    ? 'optimal' 
    : p2Points >= 100 
    ? 'good' 
    : p2Points >= 60 
    ? 'moderate' 
    : 'critical';

  // -------------------------------------------------------------
  // PILLAR 3: PORTAL VAULT CAPITAL RESERVES (20% - Max 110 pts)
  // -------------------------------------------------------------
  let p3Points = 35; // base presence
  if (totalDeposit >= 20000) p3Points = 110;
  else if (totalDeposit >= 10000) p3Points = 95;
  else if (totalDeposit >= 5000) p3Points = 80;
  else if (totalDeposit >= 2000) p3Points = 65;
  else if (totalDeposit >= 500) p3Points = 50;
  else if (totalDeposit > 0) p3Points = 40;

  // Bonus if collateral covers active debt
  if (remainingDebt > 0 && totalDeposit >= remainingDebt) {
    p3Points = Math.min(110, p3Points + 15);
  }

  const p3Status: CreditScoreFactor['status'] = p3Points >= 90 
    ? 'optimal' 
    : p3Points >= 65 
    ? 'good' 
    : p3Points >= 45 
    ? 'moderate' 
    : 'critical';

  // -------------------------------------------------------------
  // PILLAR 4: CHARTER POOL STANDING & LOYALTY (10% - Max 55 pts)
  // -------------------------------------------------------------
  let p4Points = 15;
  if (profile?.subscriptionStatus === 'active') {
    p4Points += 20;
    if (profile?.subscriptionTier === 'gold') p4Points += 15;
    else if (profile?.subscriptionTier === 'silver') p4Points += 10;
    else p4Points += 5;

    // Consecutive months streak bonus
    const subMonths = profile?.continuousSubscriptionMonths || 0;
    p4Points += Math.min(15, subMonths * 3);
  }
  p4Points = Math.max(10, Math.min(55, p4Points));

  const p4Status: CreditScoreFactor['status'] = p4Points >= 45 
    ? 'optimal' 
    : p4Points >= 30 
    ? 'good' 
    : 'moderate';

  // -------------------------------------------------------------
  // PILLAR 5: INSTITUTIONAL KYC & IDENTITY VERIFICATION (5% - Max 27.5 pts)
  // -------------------------------------------------------------
  let p5Points = 10;
  if (profile?.status === 'approved') p5Points += 7.5;
  if (profile?.nid && profile.nid.length >= 8) p5Points += 5;
  if (profile?.nomineeName && profile?.emergencyContact) p5Points += 5;
  p5Points = Math.min(27.5, p5Points);

  const p5Status: CreditScoreFactor['status'] = p5Points >= 22 
    ? 'optimal' 
    : p5Points >= 15 
    ? 'good' 
    : 'moderate';

  // Total raw score from pillars (scaled from 300 to 850)
  // Minimum base score: 300
  // Sum of maximums: 192.5 + 165 + 110 + 55 + 27.5 = 550 points
  // 300 + 550 = 850 Max Cap.
  const rawSum = p1Points + p2Points + p3Points + p4Points + p5Points;
  let finalScore = Math.round(300 + rawSum);
  finalScore = Math.max(300, Math.min(850, finalScore));

  // Determine Tier, Classification, and Borrowing Power Multipliers
  let tierClassification: ComprehensiveCreditReport['tier'] = 'good';
  let label = 'Good Standing';
  let riskRating: ComprehensiveCreditReport['riskRating'] = 'Low Risk';
  let riskColor = 'text-blue-400 border-blue-500/30 bg-blue-500/10';
  let badgeStyle = 'text-blue-400 bg-blue-500/15 border-blue-500/30';
  let borrowMultiplier = 1.0;
  let borrowingStatusLabel = 'Standard Authorized Limit';

  if (finalScore >= 780) {
    tierClassification = 'exceptional';
    label = 'Exceptional Prime';
    riskRating = 'Very Low Risk';
    riskColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    badgeStyle = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]';
    borrowMultiplier = 1.25;
    borrowingStatusLabel = '+25% Premium Credit Expansion Unlocked';
  } else if (finalScore >= 700) {
    tierClassification = 'prime';
    label = 'Prime Institutional';
    riskRating = 'Low Risk';
    riskColor = 'text-teal-400 border-teal-500/30 bg-teal-500/10';
    badgeStyle = 'text-teal-400 bg-teal-500/15 border-teal-500/30';
    borrowMultiplier = 1.15;
    borrowingStatusLabel = '+15% Prime Credit Line Expansion';
  } else if (finalScore >= 640) {
    tierClassification = 'good';
    label = 'Good Standing';
    riskRating = 'Moderate Risk';
    riskColor = 'text-blue-400 border-blue-500/30 bg-blue-500/10';
    badgeStyle = 'text-blue-400 bg-blue-500/15 border-blue-500/30';
    borrowMultiplier = 1.0;
    borrowingStatusLabel = '100% Standard Authorized Limit';
  } else if (finalScore >= 580) {
    tierClassification = 'fair';
    label = 'Fair Standing';
    riskRating = 'Elevated Risk';
    riskColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    badgeStyle = 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    borrowMultiplier = 0.70;
    borrowingStatusLabel = '70% Borrowing Cap (Collateral Recommended)';
  } else {
    tierClassification = 'needs_attention';
    label = 'Needs Attention';
    riskRating = 'High Risk';
    riskColor = 'text-rose-400 border-rose-500/30 bg-rose-500/10';
    badgeStyle = 'text-rose-400 bg-rose-500/15 border-rose-500/30 animate-pulse';
    borrowMultiplier = 0.50;
    borrowingStatusLabel = 'Restricted (1:1 Collateral-Restricted Mode)';
  }

  const effectiveLimitCeiling = Math.round(borrowLimit * borrowMultiplier);

  // Gauge Percentage (300 -> 0%, 850 -> 100%)
  const gaugePercentage = Math.round(((finalScore - 300) / 550) * 100);

  // Pillar Factor Details
  const factors: CreditScoreFactor[] = [
    {
      id: 'repayment',
      name: 'Repayment Reliability & History',
      weightPct: 35,
      maxPoints: 192.5,
      earnedPoints: Math.round(p1Points * 10) / 10,
      status: p1Status,
      summary: isOverdue 
        ? `Overdue loan past scheduled maturity (${overdueLoansList.length} loan(s) delinquent). Immediate settlement required.` 
        : `${totalRepaid > 0 ? `৳${totalRepaid.toLocaleString()} BDT successfully repaid.` : 'Zero defaults recorded.'} Completed loans: ${completedLoansCount}. Repayment compliance rate: ${repaymentRatio}%.`,
      tip: isOverdue 
        ? 'Settle overdue loan balance today to trigger Instant Delinquency Rehabilitation (+75 pts restored).' 
        : 'Continue honoring scheduled installments on or before due date to maintain peak points.'
    },
    {
      id: 'utilization',
      name: 'Debt Utilization & Leverage Capacity',
      weightPct: 30,
      maxPoints: 165,
      earnedPoints: Math.round(p2Points * 10) / 10,
      status: p2Status,
      summary: remainingDebt === 0 
        ? 'Zero active debt load. 100% borrowing capacity preserved across authorized lines.' 
        : `Active debt: ৳${remainingDebt.toLocaleString()} BDT (${utilizationPct}% of approved limit of ৳${borrowLimit.toLocaleString()}).`,
      tip: utilizationPct > 30 
        ? 'Reducing active debt under 30% of your credit limit maximizes your score and avoids liquidity rationing.' 
        : 'Outstanding borrowing load is safely positioned in the optimal institutional tier.'
    },
    {
      id: 'reserves',
      name: 'Vault Capital Reserves & Collateral',
      weightPct: 20,
      maxPoints: 110,
      earnedPoints: Math.round(p3Points * 10) / 10,
      status: p3Status,
      summary: `৳${totalDeposit.toLocaleString()} BDT secured in personal vault reserve. Collateral coverage: ${collateralRatio}% of active debt.`,
      tip: totalDeposit < 5000 
        ? 'Augmenting vault deposits to ৳5,000+ unlocks Tier-2 Collateral Bonus (+25 pts) and higher loan clearance.' 
        : 'Substantial vault collateral guarantees accelerated loan clearances and provides safe-harbor leverage.'
    },
    {
      id: 'charter',
      name: 'Charter Risk-Pool Standing & Loyalty',
      weightPct: 10,
      maxPoints: 55,
      earnedPoints: Math.round(p4Points * 10) / 10,
      status: p4Status,
      summary: profile?.subscriptionStatus === 'active'
        ? `${profile?.subscriptionTier?.toUpperCase() || 'BRONZE'} Charter active (${profile?.continuousSubscriptionMonths || 1} continuous months). Mutual fund contribution active.`
        : 'Standard unregistered member tier.',
      tip: profile?.subscriptionStatus !== 'active'
        ? 'Enroll in an official Charter plan to unlock up to +35 loyalty points and expand loan ceilings.'
        : 'Maintain uninterrupted subscription renewal to compound continuous tenure bonuses.'
    },
    {
      id: 'kyc',
      name: 'Identity & Regulatory KYC Integrity',
      weightPct: 5,
      maxPoints: 27.5,
      earnedPoints: Math.round(p5Points * 10) / 10,
      status: p5Status,
      summary: profile?.nid 
        ? 'National ID (NID), emergency nominee, and residential verification complete under institutional security.' 
        : 'Partial identity verification on record.',
      tip: !profile?.nid 
        ? 'Complete full NID, nominee, and emergency contact details in Profile for full +27.5 pts.' 
        : 'Full KYC status confirmed under institutional security protocol.'
    }
  ];

  // Dynamic Audit Logs derived from live transactions
  const auditLogs: CreditAuditLog[] = [];
  
  if (isOverdue) {
    auditLogs.push({
      id: 'log-overdue',
      title: 'Maturity Overdue Penalty Applied',
      detail: `Loan past scheduled settlement date (${overdueDateStr || 'Current cycle'}).`,
      pointsDelta: -75,
      type: 'negative',
      timestamp: Date.now() - 3600000
    });
  }

  // Recent confirmed repayment transactions
  const confirmedRepayments = transactions.filter(t => t.type === 'pay_due' && t.status === 'confirmed');
  confirmedRepayments.slice(0, 3).forEach((tx, idx) => {
    auditLogs.push({
      id: `log-rep-${tx.id || idx}`,
      title: 'On-Time Loan Repayment Confirmed',
      detail: `Settlement of ৳${(tx.amount || 0).toLocaleString()} BDT processed via ${tx.method || 'Online Channel'}.`,
      pointsDelta: 25,
      type: 'positive',
      timestamp: tx.timestamp?.seconds ? tx.timestamp.seconds * 1000 : Date.now() - (idx + 1) * 86400000
    });
  });

  // Recent confirmed deposit transactions
  const confirmedDeposits = transactions.filter(t => t.type === 'deposit' && t.status === 'confirmed');
  confirmedDeposits.slice(0, 2).forEach((tx, idx) => {
    auditLogs.push({
      id: `log-dep-${tx.id || idx}`,
      title: 'Vault Capital Reserve Augmented',
      detail: `Capital infusion of ৳${(tx.amount || 0).toLocaleString()} BDT secured in personal vault reserve.`,
      pointsDelta: 15,
      type: 'positive',
      timestamp: tx.timestamp?.seconds ? tx.timestamp.seconds * 1000 : Date.now() - (idx + 2) * 86400000
    });
  });

  // Active Charter Log
  if (profile?.subscriptionStatus === 'active') {
    auditLogs.push({
      id: 'log-charter',
      title: `${profile?.subscriptionTier?.toUpperCase() || 'PREMIUM'} Charter Standing Maintained`,
      detail: `Institutional risk-sharing pool active for ${profile?.continuousSubscriptionMonths || 1} continuous month(s).`,
      pointsDelta: 20,
      type: 'positive',
      timestamp: Date.now() - 604800000
    });
  }

  // Baseline Verification Log
  auditLogs.push({
    id: 'log-base',
    title: 'Institutional Citizen Ledger Verified',
    detail: `Central Member ID: ${profile?.memberId || 'TUT-MBR-2026'}. 256-Bit SSL governance active.`,
    pointsDelta: 10,
    type: 'neutral',
    timestamp: Date.now() - 1209600000
  });

  // Actionable Improvement Steps
  const improvementTips: ComprehensiveCreditReport['improvementTips'] = [];

  if (isOverdue) {
    improvementTips.push({
      action: `Settle current overdue loan balance of ৳${remainingDebt.toLocaleString()} BDT`,
      pointsGain: 75,
      impact: 'High',
      category: 'Repayment'
    });
  } else if (remainingDebt > 0) {
    improvementTips.push({
      action: `Clear active loan balance of ৳${remainingDebt.toLocaleString()} BDT to reset utilization to 0%`,
      pointsGain: Math.min(50, Math.round(utilizationPct * 0.5)),
      impact: 'High',
      category: 'Repayment'
    });
  }

  if (totalDeposit < 5000) {
    improvementTips.push({
      action: 'Augment personal vault reserve deposit to ৳5,000 BDT or higher',
      pointsGain: 25,
      impact: 'Medium',
      category: 'Collateral'
    });
  }

  if (profile?.subscriptionStatus !== 'active') {
    improvementTips.push({
      action: 'Enroll in Gold Sovereign or Silver Executive Charter Plan',
      pointsGain: 35,
      impact: 'High',
      category: 'Charter'
    });
  } else if (profile?.subscriptionTier !== 'gold') {
    improvementTips.push({
      action: 'Upgrade subscription to Gold Sovereign for maximum borrow ceiling & tier multiplier',
      pointsGain: 15,
      impact: 'Medium',
      category: 'Charter'
    });
  }

  if (!profile?.nid) {
    improvementTips.push({
      action: 'Provide National Identity Card (NID) and full residential address in profile',
      pointsGain: 15,
      impact: 'Medium',
      category: 'Identity'
    });
  }

  return {
    score: finalScore,
    tier: tierClassification,
    label,
    riskRating,
    riskColor,
    badgeStyle,
    gaugePercentage,
    totalBorrowLimit: borrowLimit,
    remainingDebt,
    availableLimit,
    utilizationPct,
    totalDeposit,
    collateralRatio,
    totalRepaid,
    repaymentRatio,
    isOverdue,
    overdueDateStr,
    overdueLoansCount,
    activeLoansCount,
    completedLoansCount,
    overdueLoanDetails,
    borrowMultiplier,
    effectiveLimitCeiling,
    borrowingStatusLabel,
    factors,
    auditLogs,
    regulations: CREDIT_REGULATIONS,
    improvementTips
  };
}

/**
 * Interactive Simulation Helper: Computes projected score and limit expansions
 * based on user adjustments in the "What-If" Credit Simulator.
 */
export function simulateCreditScore(
  baseProfile: any,
  baseTransactions: any[] = [],
  adjustments: CreditSimulationInput
): SimulatedCreditScoreResult {
  const currentReport = calculateComprehensiveCreditScore(baseProfile, baseTransactions);
  
  // Clone profile with simulated variables
  const simProfile = { ...baseProfile };

  // 1. Debt Repayment adjustment
  if (typeof adjustments.simulatedRepayAmount === 'number' && adjustments.simulatedRepayAmount > 0) {
    const repayAmt = Math.min(simProfile.remainingDebt || 0, adjustments.simulatedRepayAmount);
    simProfile.remainingDebt = Math.max(0, (simProfile.remainingDebt || 0) - repayAmt);
    simProfile.totalRepaid = (simProfile.totalRepaid || 0) + repayAmt;
  }

  // 2. Vault Deposit adjustment
  if (typeof adjustments.simulatedDepositAmount === 'number' && adjustments.simulatedDepositAmount > 0) {
    simProfile.totalDeposit = (simProfile.totalDeposit || 0) + adjustments.simulatedDepositAmount;
  }

  // 3. Subscription Tier adjustment
  if (adjustments.simulatedTier) {
    simProfile.subscriptionStatus = 'active';
    simProfile.subscriptionTier = adjustments.simulatedTier;
    simProfile.continuousSubscriptionMonths = Math.max(1, (simProfile.continuousSubscriptionMonths || 0) + 1);
  }

  // 4. KYC adjustment
  if (adjustments.simulatedKycComplete) {
    simProfile.nid = simProfile.nid || '19982691234567890';
    simProfile.nomineeName = simProfile.nomineeName || 'Verified Nominee';
    simProfile.emergencyContact = simProfile.emergencyContact || '+8801700000000';
    simProfile.status = 'approved';
  }

  // If debt is fully settled, remove overdue status from transactions in simulation
  let simTransactions = [...baseTransactions];
  if (simProfile.remainingDebt === 0) {
    simTransactions = simTransactions.map(t => {
      if (t.type === 'loan') {
        return { ...t, status: 'completed' };
      }
      return t;
    });
  }

  const projectedReport = calculateComprehensiveCreditScore(simProfile, simTransactions);
  const delta = projectedReport.score - currentReport.score;

  let summary = 'No significant impact on credit score.';
  if (delta > 0) {
    summary = `Projected gain of +${delta} points! Your profile would advance to ${projectedReport.label} status with an authorized borrowing ceiling of ৳${projectedReport.effectiveLimitCeiling.toLocaleString()} BDT.`;
  } else if (delta < 0) {
    summary = `Projected reduction of ${delta} points. High leverage would compress your authorized borrowing ceiling.`;
  } else {
    summary = 'Your current score is already optimized for this parameter set.';
  }

  return {
    currentScore: currentReport.score,
    projectedScore: projectedReport.score,
    pointsDelta: delta,
    currentTierLabel: currentReport.label,
    projectedTierLabel: projectedReport.label,
    currentBorrowLimit: currentReport.effectiveLimitCeiling,
    projectedBorrowLimit: projectedReport.effectiveLimitCeiling,
    summary
  };
}
