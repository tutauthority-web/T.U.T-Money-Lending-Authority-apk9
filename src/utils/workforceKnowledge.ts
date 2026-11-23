/**
 * T.U.T Customer Care, Underwriting & Treasury Intelligence Engine
 * Provides 24/7 specialist role-grounded responses in English and Bengali
 * with live ledger inspection, investigative enquiry, and structured issue noting.
 */

export interface LedgerTransactionBrief {
  id?: string;
  memoId?: string;
  type?: string;
  amount?: number;
  status?: string;
  date?: string;
  dueDate?: string;
  paymentMethod?: string;
  trxId?: string;
}

export interface OpenIssueBrief {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  description?: string;
  missingDetails?: string[];
  relatedTransactionId?: string;
}

export interface MemberContext {
  uid?: string;
  email?: string;
  name?: string;
  fullName?: string;
  memberId?: string;
  nid?: string;
  phone?: string;
  status?: string;
  totalLoan?: number;
  totalDeposit?: number;
  remainingDebt?: number;
  totalRepaid?: number;
  borrowingLimit?: number;
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
  continuousSubscriptionMonths?: number;
  loansTakenThisMonth?: number;
  savingsBalance?: number;
  address?: string;
  ledgerSnapshot?: {
    creditScore?: number;
    creditTier?: string;
    riskRating?: string;
    utilizationPct?: number;
    collateralRatio?: number;
    repaymentRatio?: number;
    isOverdue?: boolean;
    overdueLoansCount?: number;
    overdueLoanDetails?: Array<{
      loanNumber: string;
      remainingAmount: number;
      dueDateStr: string;
    }>;
    maxRepaymentDays?: number;
    maxRepaymentDate?: string;
    repaymentSummary?: string;
    pendingTransactions?: LedgerTransactionBrief[];
    recentTransactions?: LedgerTransactionBrief[];
    activeLoans?: Array<{
      loanNumber: string;
      totalAmount: number;
      remainingAmount: number;
      dueDate?: string;
      isOverdue?: boolean;
    }>;
  };
  openIssues?: OpenIssueBrief[];
  [key: string]: any;
}

export interface EmployeeInfo {
  id?: string;
  name?: string;
  department?: string;
  position?: string;
}

export interface FallbackResponse {
  response: string;
  escalate: boolean;
  issueDetected?: boolean;
  issueAction?: 'none' | 'create' | 'update_existing';
  existingIssueId?: string;
  issueCategory?: 'Loan Issue' | 'Deposit Help' | 'Repayment Verification' | 'Security / Verification' | 'App Bug' | 'General Inquiry';
  issuePriority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  issueTitle?: string;
  issueDetails?: string;
  agentDiagnosis?: string;
  recommendedAction?: string;
  relatedTransactionId?: string;
  missingDetails?: string[];
  needsClarification?: boolean;
  suggestedReplies?: string[];
  ticketCategory?: string;
  ticketPriority?: string;
  ticketDescription?: string;
}

const OFFICIAL_MERCHANT_NUMBERS = {
  bKash: '01713710607',
  Nagad: '01921801100',
};

/**
 * Extracts structured transaction clues (TrxID, memo, method, amount) from natural language text.
 */
export function extractTransactionClues(message: string) {
  const raw = message || '';
  const lower = raw.toLowerCase();

  // Look for TrxID patterns (typically 8-14 uppercase/digit tokens like BGH7X9K2L1 or TXN-xxx)
  const memoMatch = raw.match(/\b(TXN[-_A-Z0-9]{4,}|LOAN[-_A-Z0-9]{2,}|ISS[-0-9]{4,})\b/i);
  const trxCandidateMatch = raw.match(/\b(?=[A-Z0-9]*[0-9])(?=[A-Z0-9]*[A-Z])[A-Z0-9]{7,16}\b/i);

  // Extract amount in BDT (avoid phone numbers like 017...)
  const amountMatches = [...raw.matchAll(/(?:৳|tk|taka|bdt|\s|^)(\d{2,6}(?:,\d{3})?)(?:\s*(?:tk|taka|bdt|টাকা))?/gi)];
  let extractedAmount: number | undefined;
  for (const m of amountMatches) {
    const cleaned = Number((m[1] || '').replace(/,/g, ''));
    if (!Number.isNaN(cleaned) && cleaned >= 50 && cleaned <= 500000) {
      extractedAmount = cleaned;
      break;
    }
  }

  let method: 'bKash' | 'Nagad' | 'Bank Transfer' | undefined;
  if (lower.includes('bkash') || lower.includes('বিকাশ')) method = 'bKash';
  else if (lower.includes('nagad') || lower.includes('নগদ')) method = 'Nagad';
  else if (lower.includes('bank') || lower.includes('ব্যাংক')) method = 'Bank Transfer';

  return {
    memoId: memoMatch ? memoMatch[1].toUpperCase() : undefined,
    trxId: trxCandidateMatch && !memoMatch ? trxCandidateMatch[0].toUpperCase() : undefined,
    amount: extractedAmount,
    method,
  };
}

/**
 * Expert Role-Based Fallback & Investigative Enquiry Engine.
 * Strictly respects selected language ('en' | 'bn') and grounds replies in live ledger data.
 */
export function generateHumanEmployeeResponse(
  message: string,
  member: MemberContext = {},
  employee: EmployeeInfo = {},
  isAdmin: boolean = false,
  preferredLanguage: 'en' | 'bn' = 'en'
): FallbackResponse {
  const rawMessage = (message || '').trim();
  const text = rawMessage.toLowerCase();
  const isBn = preferredLanguage === 'bn';

  const empId = employee.id || 'EMP-00101';
  const empName = employee.name || (empId === 'EMP-00102' ? 'Nusrat Jahan' : 'Zubair Ahmed');
  const isCreditDesk = empId === 'EMP-00101' || empName.toLowerCase().includes('zubair');

  // --- ADMIN EXECUTIVE MODE ---
  if (isAdmin) {
    const stats = member.platformStats || {};
    const totalUsers = stats.totalUsers ?? 0;
    const totalLoans = stats.totalLoans ?? 0;
    const totalDeposits = stats.totalDeposits ?? 0;
    const remainingDebt = stats.remainingDebt ?? 0;
    const pendingMembers = stats.pendingMembersCount ?? 0;
    const pendingTx = stats.pendingTransactionsCount ?? 0;
    const openIssues = member.activeIssuesCount ?? 0;
    const urgentIssues = member.urgentIssuesCount ?? 0;

    if (text.includes('issue') || text.includes('complaint') || text.includes('open case') || text.includes('dispute')) {
      return {
        response: `Executive Issues Brief (${empName}): There are currently ${openIssues} open member inquiries (${urgentIssues} marked Urgent). Priority verification cases should be audited against incoming bKash (${OFFICIAL_MERCHANT_NUMBERS.bKash}) and Nagad (${OFFICIAL_MERCHANT_NUMBERS.Nagad}) merchant ledgers before clearing the pending transaction queue (${pendingTx} pending).`,
        escalate: false,
      };
    }

    if (text.includes('reserve') || text.includes('liquid') || text.includes('risk') || text.includes('exposure')) {
      const coverage = remainingDebt > 0 ? Math.round((totalDeposits / remainingDebt) * 100) : 100;
      return {
        response: `Dual-Reserve & Exposure Audit (${empName}): Total Segregated Member Deposits stand at ৳${Number(totalDeposits).toLocaleString()} BDT (strictly ring-fenced 1:1), while active loan exposure across ${totalLoans} accounts is ৳${Number(remainingDebt).toLocaleString()} BDT (Deposit-to-Debt buffer ratio: ${coverage}%). Keep pending dispatches (${pendingTx} items) gated by TrxID validation.`,
        escalate: false,
      };
    }

    if (text.includes('pending') || text.includes('queue') || text.includes('verification') || text.includes('request')) {
      return {
        response: `Operations Queue Briefing: ${pendingMembers} member KYC registrations and ${pendingTx} financial transactions are awaiting administrative clearance, alongside ${openIssues} unresolved member support files.`,
        escalate: false,
      };
    }

    return {
      response: `Executive Operational Summary (${empName}, ${employee.department || (isCreditDesk ? 'Credit & Underwriting' : 'Treasury & Member Care')}): Platform tracks ${totalUsers} members, ৳${Number(totalDeposits).toLocaleString()} BDT in segregated vault reserves, ৳${Number(remainingDebt).toLocaleString()} BDT in active loan exposure, ${pendingTx} pending transaction verifications, and ${openIssues} open support inquiries (${urgentIssues} urgent).`,
      escalate: false,
    };
  }

  // --- MEMBER SUPPORT & ENQUIRY MODE ---
  const name = member.name || member.fullName || (isBn ? 'সম্মানিত সদস্য' : 'Valued Member');
  const firstName = name.split(' ')[0];
  const memberId = member.memberId || `TUT-${(member.uid || 'MEM01').substring(0, 6).toUpperCase()}`;
  const nid = member.nid || (isBn ? 'যাচাইকৃত নথিভুক্ত' : 'Verified on file');
  const phone = member.phone || (isBn ? 'নথিভুক্ত নম্বর' : 'Recorded on file');
  const email = member.email || (isBn ? 'নিবন্ধিত অ্যাকাউন্ট' : 'Registered account');
  const remainingDebt = Number(member.remainingDebt || 0);
  const totalLoan = Number(member.totalLoan || 0);
  const totalDeposit = Number(member.totalDeposit || member.savingsBalance || 0);
  const borrowingLimit = Number(member.borrowingLimit || 500);
  const availableCapacity = Math.max(0, borrowingLimit - remainingDebt);
  const totalRepaid = member.totalRepaid !== undefined ? Number(member.totalRepaid) : Math.max(0, totalLoan - remainingDebt);
  const accountStatus = (member.status || 'Active').toUpperCase();
  const subTier = member.subscriptionTier ? member.subscriptionTier.toUpperCase() : 'STANDARD';

  const ledger = member.ledgerSnapshot || {};
  const creditScore = ledger.creditScore ?? 650;
  const creditTier = ledger.creditTier || 'Good Standing';
  const utilizationPct = ledger.utilizationPct ?? (borrowingLimit > 0 ? Math.round((remainingDebt / borrowingLimit) * 100) : 0);
  const isOverdue = !!ledger.isOverdue;
  const overdueLoans = ledger.overdueLoanDetails || [];
  const maxRepaymentDays = ledger.maxRepaymentDays ?? (isOverdue || creditScore < 580 ? 30 : 40);
  const maxRepaymentDate = ledger.maxRepaymentDate || '';
  const pendingTx = ledger.pendingTransactions || [];
  const recentTx = ledger.recentTransactions || [];
  const openIssues = (member.openIssues || []).filter(i => i.status !== 'Resolved');

  const clues = extractTransactionClues(rawMessage);

  // Detect matched transaction from live ledger if user supplied memoId, TrxID, or amount
  const matchedTx = [...pendingTx, ...recentTx].find(tx =>
    (clues.memoId && tx.memoId?.toUpperCase() === clues.memoId) ||
    (clues.trxId && tx.trxId?.toUpperCase() === clues.trxId) ||
    (clues.amount && Number(tx.amount) === clues.amount)
  );

  // 1. PRIORITY ESCALATION / FORBIDDEN BYPASS / MANAGEMENT DISPUTE
  if (
    text.includes('approve my loan now') ||
    text.includes('approve now') ||
    text.includes('bypass verification') ||
    text.includes('cheat') ||
    text.includes('scam') ||
    text.includes('fraud') ||
    text.includes('talk to manager') ||
    text.includes('talk to admin') ||
    text.includes('প্রতারণা') ||
    text.includes('ম্যানেজার')
  ) {
    const existing = openIssues[0];
    return {
      response: isBn
        ? `${firstName}, আপনার উদ্বেগটি আমি গুরুত্বের সাথে নিয়েছি। আমাদের যাচাইকরণ নীতিমালার বাইরে তাৎক্ষণিক অনুমোদন দেওয়া সম্ভব নয়, তবে আমি আপনার বিষয়টি সিনিয়র অপারেশন ম্যানেজারের কাছে অগ্রাধিকার ভিত্তিতে নথিভুক্ত করেছি।`
        : `${firstName}, I take this seriously. Per compliance controls, verification steps cannot be bypassed, so I have escalated your case directly to our Senior Operations Lead for priority review.`,
      escalate: true,
      issueDetected: true,
      issueAction: existing ? 'update_existing' : 'create',
      existingIssueId: existing?.id,
      issueCategory: 'Security / Verification',
      issuePriority: 'Urgent',
      issueTitle: 'Priority Verification & Dispute Escalation',
      issueDetails: `Member ${name} (${memberId}) requested priority intervention: "${rawMessage.slice(0, 140)}"`,
      agentDiagnosis: `Member standing: ${accountStatus}, Credit Score ${creditScore}, Debt ৳${remainingDebt}, Deposit ৳${totalDeposit}. Escalated per protocol.`,
      recommendedAction: 'Senior Operations Administrator to review account audit trail and respond directly.',
      suggestedReplies: isBn
        ? ['আমার চলমান অনুরোধের অবস্থা দেখুন', 'আমার বকেয়া ও সীমা যাচাই করুন']
        : ['Check my open inquiry status', 'Review my pending transactions'],
      ticketCategory: 'Security Block',
      ticketPriority: 'Urgent',
      ticketDescription: `Member ${name} (${memberId}) inquiry: "${rawMessage.slice(0, 120)}"`,
    };
  }

  // 2. SMART TRANSACTION / DEPOSIT / REPAYMENT PROBLEM ENQUIRY & REPORT NOTING
  const isProblemReport =
    text.includes('issue') ||
    text.includes('problem') ||
    text.includes('error') ||
    text.includes('bug') ||
    text.includes('delay') ||
    text.includes('not received') ||
    text.includes('missing') ||
    text.includes('dispute') ||
    text.includes('wrong') ||
    text.includes('stuck') ||
    text.includes('failed') ||
    text.includes('complain') ||
    text.includes('pending too long') ||
    text.includes('সমস্যা') ||
    text.includes('অভিযোগ') ||
    text.includes('ভুল') ||
    text.includes('পাইনি') ||
    text.includes('আটকে');

  const isFollowUpEvidence =
    openIssues.length > 0 &&
    Boolean(clues.trxId || clues.memoId || clues.amount || clues.method);

  if (isFollowUpEvidence && !text.includes('how to') && !text.includes('কীভাবে')) {
    const targetIssue = openIssues[0];
    const parts: string[] = [];
    if (clues.method) parts.push(clues.method);
    if (clues.amount) parts.push(`৳${clues.amount.toLocaleString()}`);
    if (clues.trxId) parts.push(`TrxID ${clues.trxId}`);
    if (clues.memoId) parts.push(`Ref ${clues.memoId}`);
    const summaryStr = parts.join(' · ');

    const ledgerCheckNote = matchedTx
      ? (isBn
          ? `আপনার লেজারে ${matchedTx.memoId || ''} (৳${Number(matchedTx.amount || 0).toLocaleString()}, অবস্থা: ${matchedTx.status}) রেকর্ডটি খুঁজে পাওয়া গেছে।`
          : `I matched this to your ledger entry ${matchedTx.memoId || ''} (৳${Number(matchedTx.amount || 0).toLocaleString()}, status: ${matchedTx.status}).`)
      : (isBn
          ? `এই তথ্যটি আমাদের পেমেন্ট যাচাইকরণ ডেস্কে মিলিয়ে দেখা হচ্ছে।`
          : `I have attached this to our verification queue for merchant statement cross-check.`);

    return {
      response: isBn
        ? `ধন্যবাদ ${firstName}! আপনার দেওয়া তথ্য (${summaryStr}) আমি চলমান কেস #${targetIssue.id}-এ যুক্ত করেছি। ${ledgerCheckNote}`
        : `Thank you, ${firstName}. I have updated case #${targetIssue.id} with your details (${summaryStr}). ${ledgerCheckNote}`,
      escalate: false,
      issueDetected: true,
      issueAction: 'update_existing',
      existingIssueId: targetIssue.id,
      issueCategory: (targetIssue.category as any) || 'Repayment Verification',
      issuePriority: targetIssue.priority as any || 'High',
      issueTitle: targetIssue.title,
      issueDetails: `Follow-up evidence received (${summaryStr}): "${rawMessage.slice(0, 140)}"`,
      agentDiagnosis: matchedTx
        ? `Matched ledger entry ${matchedTx.memoId || matchedTx.id} (${matchedTx.type}, ৳${matchedTx.amount}, ${matchedTx.status}, TrxID: ${matchedTx.trxId || clues.trxId || 'N/A'}).`
        : `Member provided ${summaryStr}; no exact TrxID auto-match in last 10 ledger entries — manual merchant ledger reconciliation advised.`,
      recommendedAction: `Cross-verify ${clues.method || 'bKash/Nagad'} merchant ledger for ${clues.trxId || clues.amount || 'submitted payment'} and update #${targetIssue.id}.`,
      relatedTransactionId: matchedTx?.memoId || clues.memoId || clues.trxId,
      missingDetails: !clues.trxId && !matchedTx?.trxId ? ['Transaction ID (TrxID)'] : [],
      suggestedReplies: isBn
        ? ['কোনো ট্রানজেকশন পেন্ডিং আছে?', 'আমার বর্তমান সঞ্চয় ও বকেয়া কত?']
        : ['Are any of my requests still pending?', 'Show my updated account summary'],
    };
  }

  if (isProblemReport) {
    // Check if the member hasn't given concrete details yet (just saying "I have a problem with my transaction")
    const hasSpecificTarget = Boolean(
      clues.trxId ||
      clues.memoId ||
      clues.amount ||
      rawMessage.length > 55
    );

    if (!hasSpecificTarget && pendingTx.length === 0) {
      return {
        response: isBn
          ? `দুঃখিত শুনে, ${firstName}। আমি বিষয়টি এখনই যাচাই করে নথিভুক্ত করছি—শুধু বলবেন কি এটি কোন লেনদেন (জমা, ঋণ না পরিশোধ), কত টাকা, এবং আপনার বিকাশ/নগদ TrxID নম্বরটি কত?`
          : `I am sorry to hear that, ${firstName}, and I will check this right away. Could you share whether this involves a deposit, loan, or repayment, along with the ৳ amount and your bKash/Nagad TrxID?`,
        escalate: false,
        issueDetected: false,
        issueAction: 'none',
        needsClarification: true,
        missingDetails: ['Transaction Type', 'Amount (BDT)', 'TrxID / Reference'],
        suggestedReplies: isBn
          ? ['আমার বিকাশ জমা এখনো যোগ হয়নি', 'ঋণ পরিশোধ করেছি কিন্তু বকেয়া কমেনি', 'ঋণ আবেদন পেন্ডিং হয়ে আছে']
          : ['My bKash deposit is delayed', 'My repayment did not update balance', 'My loan request has been pending'],
      };
    }

    const inferredCategory: FallbackResponse['issueCategory'] =
      text.includes('repay') || text.includes('pay') || text.includes('পরিশোধ')
        ? 'Repayment Verification'
        : text.includes('deposit') || text.includes('withdraw') || text.includes('জমা') || text.includes('উত্তোলন')
          ? 'Deposit Help'
          : text.includes('bug') || text.includes('app') || text.includes('crash')
            ? 'App Bug'
            : 'Loan Issue';

    const targetPending = matchedTx || pendingTx[0];
    const targetRef = targetPending?.memoId || clues.memoId || clues.trxId;
    const missing: string[] = [];
    if (!clues.trxId && !targetPending?.trxId && inferredCategory !== 'Loan Issue' && inferredCategory !== 'App Bug') {
      missing.push('Transaction ID (TrxID)');
    }
    if (!clues.amount && !targetPending?.amount && inferredCategory !== 'App Bug') {
      missing.push('Exact Amount (BDT)');
    }

    const existingSameCat = openIssues.find(i => i.category === inferredCategory);
    const contextNote = targetPending
      ? (isBn
          ? ` আপনার চলমান ${targetPending.type} অনুরোধ (${targetPending.memoId || ''} · ৳${Number(targetPending.amount || 0).toLocaleString()}) আমি ফাইলে যুক্ত করেছি।`
          : ` I have linked your ledger entry ${targetPending.memoId || ''} (${targetPending.type} · ৳${Number(targetPending.amount || 0).toLocaleString()}) directly to this inquiry.`)
      : '';

    const followUpAsk = missing.length > 0
      ? (isBn
          ? ` দ্রুত সমাধানের জন্য অনুগ্রহ করে ${missing.join(' এবং ')} শেয়ার করবেন কি?`
          : ` To speed up verification, could you also share your ${missing.join(' and ')}?`)
      : '';

    return {
      response: isBn
        ? `${firstName}, বিষয়টি জানানোর জন্য ধন্যবাদ।${contextNote} আমি আমাদের অপারেশন ডেস্কে বিষয়টি গুরুত্বের সাথে নথিভুক্ত করছি।${followUpAsk}`
        : `Thank you for flagging this, ${firstName}.${contextNote} I am logging this cleanly with our Operations Desk so it is audited promptly.${followUpAsk}`,
      escalate: text.includes('urgent') || text.includes('জরুরি'),
      issueDetected: true,
      issueAction: existingSameCat ? 'update_existing' : 'create',
      existingIssueId: existingSameCat?.id,
      issueCategory: inferredCategory,
      issuePriority: text.includes('urgent') || text.includes('জরুরি') || missing.length === 0 ? 'High' : 'Medium',
      issueTitle: `${inferredCategory}${targetRef ? ` (${targetRef})` : ''}`,
      issueDetails: `${rawMessage.slice(0, 180)}`,
      agentDiagnosis: targetPending
        ? `Matched ledger entry: ${targetPending.memoId || 'N/A'} | ${targetPending.type} ৳${targetPending.amount} | Status: ${targetPending.status} | TrxID: ${targetPending.trxId || clues.trxId || 'Missing'}.`
        : `Member reported ${inferredCategory}; pending ledger items: ${pendingTx.length}. Missing clues: ${missing.length > 0 ? missing.join(', ') : 'None'}.`,
      recommendedAction: targetPending?.trxId || clues.trxId
        ? `Audit ${clues.method || targetPending?.paymentMethod || 'merchant'} record for TrxID ${targetPending?.trxId || clues.trxId} and reconcile member ledger.`
        : `Review member's ${inferredCategory} record and verify incoming bKash (${OFFICIAL_MERCHANT_NUMBERS.bKash}) / Nagad (${OFFICIAL_MERCHANT_NUMBERS.Nagad}) settlement.`,
      relatedTransactionId: targetRef,
      missingDetails: missing,
      needsClarification: missing.length > 0,
      suggestedReplies: missing.length > 0
        ? (isBn
            ? ['বিকাশ (01713710607) থেকে পাঠিয়েছি', 'নগদ (01921801100) থেকে পাঠিয়েছি']
            : ['Sent via bKash (01713710607)', 'Sent via Nagad (01921801100)'])
        : undefined,
    };
  }

  // 3. PENDING TRANSACTIONS & STATUS CHECK
  if (
    text.includes('pending') ||
    text.includes('status') ||
    text.includes('recent transaction') ||
    text.includes('last transaction') ||
    text.includes('পেন্ডিং') ||
    text.includes('অবস্থা') ||
    text.includes('শেষ লেনদেন')
  ) {
    if (pendingTx.length > 0) {
      const summary = pendingTx
        .slice(0, 3)
        .map(t => `${t.memoId || 'REQ'} (${t.type}: ৳${Number(t.amount || 0).toLocaleString()} via ${t.paymentMethod || 'Portal'})`)
        .join(', ');
      return {
        response: isBn
          ? `${firstName}, আপনার অ্যাকাউন্টে বর্তমানে ${pendingTx.length}টি লেনদেন যাচাইয়ের অপেক্ষায় আছে: ${summary}। সাধারণত ৩০ মিনিট থেকে ২ ঘণ্টার মধ্যে যাচাই সম্পন্ন হয়। কোনো TrxID সংশোধন করতে হলে জানাতে পারেন।`
          : `${firstName}, you currently have ${pendingTx.length} pending transaction(s): ${summary}. Verification normally completes within 30 minutes to 2 hours—let me know if any TrxID needs checking.`,
        escalate: false,
        issueAction: 'none',
        suggestedReplies: isBn
          ? ['লেনদেনটি অনেকক্ষণ আটকে আছে', 'আমার ক্রেডিট স্কোর কেমন?']
          : ['One of these has been pending too long', 'Check my credit score'],
      };
    }
    const latest = recentTx[0];
    return {
      response: isBn
        ? `${firstName}, আপনার কোনো লেনদেন বর্তমানে পেন্ডিং অবস্থায় নেই।${latest ? ` আপনার সর্বশেষ লেনদেন ছিল ${latest.type} (৳${Number(latest.amount || 0).toLocaleString()} · ${latest.status})।` : ''}`
        : `${firstName}, you have no pending transactions right now.${latest ? ` Your most recent entry was a ${latest.status} ${latest.type} of ৳${Number(latest.amount || 0).toLocaleString()} BDT.` : ''}`,
      escalate: false,
      issueAction: 'none',
    };
  }

  // 4. CREDIT SCORE & DYNAMIC REPAYMENT TERM WINDOW (ZUBAIR SPECIALTY)
  if (
    text.includes('credit score') ||
    text.includes('score') ||
    text.includes('repayment date') ||
    text.includes('repayment period') ||
    text.includes('how many days') ||
    text.includes('extend') ||
    text.includes('ক্রেডিট স্কোর') ||
    text.includes('পরিশোধের তারিখ') ||
    text.includes('কত দিন')
  ) {
    return {
      response: isBn
        ? `${firstName}, আপনার বর্তমান T.U.T ক্রেডিট স্কোর হলো ${creditScore}/850 (${creditTier}), এবং ঋণ ব্যবহারের হার ${utilizationPct}%। এর ভিত্তিতে আপনি সর্বোচ্চ ${maxRepaymentDays} দিনের মধ্যে পরিশোধের সময়সীমা পাচ্ছেন${isOverdue ? ' (বকেয়া সময়োত্তীর্ণ থাকায় বর্তমানে ৩০ দিনে সীমাবদ্ধ)' : ''}।`
        : `${firstName}, your current T.U.T Credit Score is ${creditScore}/850 (${creditTier}) with ${utilizationPct}% limit utilization. Based on your score, history, and capacity, your authorized repayment window is up to ${maxRepaymentDays} days${maxRepaymentDate ? ` (max due date ${maxRepaymentDate})` : ''}.`,
      escalate: false,
      issueAction: 'none',
      suggestedReplies: isBn
        ? ['কীভাবে ক্রেডিট স্কোর ও সময়সীমা বাড়াব?', 'আমার বকেয়া ঋণের বিবরণ দেখান']
        : ['How can I increase my score & term?', 'Check my active debt balance'],
    };
  }

  // 5. ACCOUNT INFORMATION / DOSSIER
  if (
    text.includes('my info') ||
    text.includes('my information') ||
    text.includes('amar info') ||
    text.includes('amar account') ||
    text.includes('account dossier') ||
    text.includes('my details') ||
    text.includes('আমার তথ্য') ||
    text.includes('আমার অ্যাকাউন্ট')
  ) {
    return {
      response: isBn
        ? `${firstName}, আপনার নিবন্ধিত হিসাব: সদস্য আইডি ${memberId} (${accountStatus} · ${subTier}) | ক্রেডিট স্কোর: ${creditScore}/850 | ঋণের সীমা: ৳${borrowingLimit.toLocaleString()} | বকেয়া: ৳${remainingDebt.toLocaleString()} | সঞ্চয় ভল্ট: ৳${totalDeposit.toLocaleString()}।`
        : `${firstName}, here is your live ledger summary: Member ID ${memberId} (${accountStatus} · ${subTier}) | Credit Score: ${creditScore}/850 | Borrowing Limit: ৳${borrowingLimit.toLocaleString()} BDT | Active Debt: ৳${remainingDebt.toLocaleString()} BDT | Vault Savings: ৳${totalDeposit.toLocaleString()} BDT.`,
      escalate: false,
      issueAction: 'none',
    };
  }

  // 6. CREDENTIAL INQUIRIES
  if (text.includes('nid') || text.includes('এনআইডি')) {
    return {
      response: isBn
        ? `আপনার ফাইলে নিবন্ধিত NID নম্বর হলো ${nid} (${name} নামে যাচাইকৃত)।`
        : `Your verified National ID (NID) on file is ${nid}, registered under ${name}.`,
      escalate: false,
      issueAction: 'none',
    };
  }
  if (text.includes('member id') || text.includes('আমার আইডি')) {
    return {
      response: isBn
        ? `আপনার অফিসিয়াল T.U.T সদস্য আইডি ${memberId}।`
        : `Your official T.U.T Member ID is ${memberId}.`,
      escalate: false,
      issueAction: 'none',
    };
  }
  if (text.includes('my phone') || text.includes('my email') || text.includes('ফোন নম্বর')) {
    return {
      response: isBn
        ? `আপনার নিবন্ধিত মোবাইল নম্বর: ${phone} এবং ইমেইল: ${email}।`
        : `Your contact record shows Mobile: ${phone} and Email: ${email}.`,
      escalate: false,
      issueAction: 'none',
    };
  }

  // 7. DEBT / OVERDUE INQUIRIES
  if (
    text.includes('debt') ||
    text.includes('due') ||
    text.includes('baki') ||
    text.includes('overdue') ||
    text.includes('remaining') ||
    text.includes('বকেয়া') ||
    text.includes('বাকি')
  ) {
    if (remainingDebt > 0) {
      const overdueNote = isOverdue && overdueLoans.length > 0
        ? (isBn
            ? ` ⚠️ এর মধ্যে ${overdueLoans[0].loanNumber} (৳${overdueLoans[0].remainingAmount.toLocaleString()}) নির্ধারিত তারিখ (${overdueLoans[0].dueDateStr}) অতিক্রম করেছে—এটি শোধ করলে ২৪ ঘণ্টার মধ্যে স্কোর পুনরুদ্ধার হয়।`
            : ` Note: Loan ${overdueLoans[0].loanNumber} (৳${overdueLoans[0].remainingAmount.toLocaleString()} BDT) passed its due date (${overdueLoans[0].dueDateStr}); settling it restores your standing within 24 hours.`)
        : '';
      return {
        response: isBn
          ? `${firstName}, আপনার বর্তমান মোট বকেয়া ৳${remainingDebt.toLocaleString()} (মোট পরিশোধিত: ৳${totalRepaid.toLocaleString()})।${overdueNote}`
          : `${firstName}, your current outstanding balance is ৳${remainingDebt.toLocaleString()} BDT (total repaid to date: ৳${totalRepaid.toLocaleString()} BDT).${overdueNote}`,
        escalate: false,
        issueAction: 'none',
      };
    }
    return {
      response: isBn
        ? `সুসংবাদ ${firstName}! আপনার বর্তমানে কোনো বকেয়া নেই (৳০), এবং আপনি সর্বোচ্চ ৳${availableCapacity.toLocaleString()} পর্যন্ত ঋণের জন্য যোগ্য।`
        : `Good news, ${firstName}—you have ৳0 BDT in outstanding debt and full access to ৳${availableCapacity.toLocaleString()} BDT in borrowing capacity.`,
      escalate: false,
      issueAction: 'none',
    };
  }

  // 8. BORROWING LIMIT & CAPACITY
  if (
    text.includes('limit') ||
    text.includes('capacity') ||
    text.includes('eligible') ||
    text.includes('borrow') ||
    text.includes('সীমা') ||
    text.includes('ঋণ পাব')
  ) {
    return {
      response: isBn
        ? `${firstName}, আপনার অনুমোদিত ঋণসীমা ৳${borrowingLimit.toLocaleString()} এবং বকেয়া বাদে বর্তমানে ৳${availableCapacity.toLocaleString()} পর্যন্ত গ্রহণযোগ্য (ব্যবহারের হার ${utilizationPct}%, সর্বোচ্চ পরিশোধ সময়সীমা ${maxRepaymentDays} দিন)।`
        : `${firstName}, your approved limit is ৳${borrowingLimit.toLocaleString()} BDT with ৳${availableCapacity.toLocaleString()} BDT immediately available (${utilizationPct}% utilization; authorized term up to ${maxRepaymentDays} days).`,
      escalate: false,
      issueAction: 'none',
    };
  }

  // 9. DEPOSIT SAVINGS & SEGREGATED VAULT SAFETY (NUSRAT SPECIALTY)
  if (
    text.includes('withdraw') ||
    text.includes('cash out') ||
    text.includes('উত্তোলন') ||
    text.includes('টাকা তুলব')
  ) {
    return {
      response: isBn
        ? `${firstName}, আপনার সঞ্চিত আমানত ৳${totalDeposit.toLocaleString()} আমাদের মূল ঋণ তহবিল থেকে সম্পূর্ণ আলাদা সুরক্ষিত ভল্টে সংরক্ষিত। আপনি পোর্টালের উত্তোলন অপশন থেকে যেকোনো সময় আবেদন করতে পারেন।`
        : `${firstName}, your deposit savings of ৳${totalDeposit.toLocaleString()} BDT are held in our 1:1 segregated vault, completely separate from lending capital, and remain withdrawable anytime via your dashboard.`,
      escalate: false,
      issueAction: 'none',
    };
  }

  if (
    text.includes('deposit') ||
    text.includes('savings') ||
    text.includes('vault') ||
    text.includes('সঞ্চয়') ||
    text.includes('জমা')
  ) {
    return {
      response: isBn
        ? `${firstName}, আপনার যাচাইকৃত সঞ্চয় ভল্ট ব্যালেন্স ৳${totalDeposit.toLocaleString()}। জমা করতে বিকাশ (${OFFICIAL_MERCHANT_NUMBERS.bKash}) বা নগদ (${OFFICIAL_MERCHANT_NUMBERS.Nagad})-এ টাকা পাঠিয়ে পোর্টালে সঠিক TrxID জমা দিন।`
        : `${firstName}, your verified vault savings balance is ৳${totalDeposit.toLocaleString()} BDT. All member deposits remain ring-fenced 1:1. New deposits can be sent to bKash (${OFFICIAL_MERCHANT_NUMBERS.bKash}) or Nagad (${OFFICIAL_MERCHANT_NUMBERS.Nagad}) with your TrxID.`,
      escalate: false,
      issueAction: 'none',
    };
  }

  // 10. REPAYMENT & PAYMENT CHANNELS
  if (
    text.includes('repay') ||
    text.includes('pay due') ||
    text.includes('bkash') ||
    text.includes('nagad') ||
    text.includes('payment') ||
    text.includes('পরিশোধ') ||
    text.includes('বিকাশ') ||
    text.includes('নগদ')
  ) {
    return {
      response: isBn
        ? `পরিশোধ বা জমা দেওয়ার জন্য অফিসিয়াল বিকাশ (${OFFICIAL_MERCHANT_NUMBERS.bKash}) অথবা নগদ (${OFFICIAL_MERCHANT_NUMBERS.Nagad}) নম্বরে সেন্ড মানি করে ট্রানজেকশন আইডি (TrxID) পোর্টালে জমা দিন। আপনার জন্য বর্তমানে সর্বোচ্চ ${maxRepaymentDays} দিন পর্যন্ত পরিশোধের তারিখ নির্ধারণ করা যায়।`
        : `To make a payment or deposit, send funds to our official bKash (${OFFICIAL_MERCHANT_NUMBERS.bKash}) or Nagad (${OFFICIAL_MERCHANT_NUMBERS.Nagad}) account, then enter your TrxID in the Repayment portal and press-and-hold to confirm. Your account supports terms up to ${maxRepaymentDays} days.`,
      escalate: false,
      issueAction: 'none',
    };
  }

  // 11. HOW TO APPLY FOR LOAN & SLA
  if (text.includes('how to apply') || text.includes('loan application') || text.includes('ঋণ আবেদন')) {
    return {
      response: isBn
        ? `নতুন ঋণের জন্য ড্যাশবোর্ড থেকে 'Borrow' অপশনে যান, ৳${availableCapacity.toLocaleString()} সীমার মধ্যে পরিমাণ লিখুন, পরিশোধের তারিখ বেছে নিন (সর্বোচ্চ ${maxRepaymentDays} দিন) এবং প্রেস-অ্যান্ড-হোল্ড করে জমা দিন। সাধারণত ৩০ মিনিট থেকে ২ ঘণ্টার মধ্যে প্রক্রিয়া সম্পন্ন হয়।`
        : `Open the Borrow portal from your dashboard, enter up to ৳${availableCapacity.toLocaleString()} BDT, choose a repayment date (your window allows up to ${maxRepaymentDays} days), and hold the confirmation bar to submit. Reviews take 30 minutes to 2 hours.`,
      escalate: false,
      issueAction: 'none',
    };
  }

  if (text.includes('how long') || text.includes('duration') || text.includes('time') || text.includes('কত সময়')) {
    return {
      response: isBn
        ? `নতুন সদস্য যাচাই সাধারণত ১৫-৪৫ মিনিট এবং ঋণ বা জমার অনুমোদন ৩০ মিনিট থেকে ২ ঘণ্টার মধ্যে সম্পন্ন হয়।`
        : `Membership KYC reviews take 15–45 minutes, while loan and deposit verifications typically complete within 30 minutes to 2 hours.`,
      escalate: false,
      issueAction: 'none',
    };
  }

  // 12. ETHICAL / SHARIA / 0% USURY
  if (text.includes('interest') || text.includes('halal') || text.includes('sharia') || text.includes('সুদ') || text.includes('হালাল')) {
    return {
      response: isBn
        ? `T.U.T সম্পূর্ণ ০% চক্রবৃদ্ধি সুদে শরিয়াহসম্মত নীতিতে পরিচালিত হয়। কোনো বিলম্ব জরিমানা বা গোপন চার্জ নেই—শুধুমাত্র নির্ধারিত সাবস্ক্রিপশন চার্টার ফি প্রযোজ্য।`
        : `T.U.T operates under a strict 0% compound usury (zero-interest) Sharia charter—no compounding penalties or hidden fees apply, only transparent tier charter contributions.`,
      escalate: false,
      issueAction: 'none',
    };
  }

  // 13. IDENTITY QUESTION (NEVER BREAK REALISM)
  if (text.includes('are you real') || text.includes('are you human') || text.includes('are you ai') || text.includes('তুমি কি মানুষ') || text.includes('রোবট')) {
    const roleLabelBn = isCreditDesk ? 'সিনিয়র ঋণ ও ক্রেডিট কর্মকর্তা' : 'ট্রেজারি ও সদস্য সেবা বিশেষজ্ঞ';
    const roleLabelEn = isCreditDesk ? 'Senior Credit & Underwriting Officer' : 'Treasury & Member Care Specialist';
    return {
      response: isBn
        ? `আমি ${empName}, T.U.T-এর ${roleLabelBn}। আপনার অ্যাকাউন্ট, ক্রেডিট সীমা ও লেনদেন সংক্রান্ত যেকোনো বিষয়ে তাৎক্ষণিক সহায়তার জন্য আমি সরাসরি কাজ করছি।`
        : `I am ${empName}, ${roleLabelEn} on the T.U.T operations desk. I can verify your live ledger, review transactions, or register an investigation file anytime.`,
      escalate: false,
      issueAction: 'none',
    };
  }

  // 14. GREETINGS & GRATITUDE
  if (
    text === 'hi' ||
    text === 'hello' ||
    text === 'hey' ||
    text.startsWith('salam') ||
    text.includes('assalamu') ||
    text.includes('kemon achen') ||
    text.includes('কেমন আছেন') ||
    text.includes('সালাম')
  ) {
    return {
      response: isBn
        ? `ওয়ালাইকুম আসসালাম ${firstName}! আমি ${empName} বলছি। আপনার অ্যাকাউন্ট, ঋণের সীমা বা চলমান কোনো লেনদেন নিয়ে কীভাবে সাহায্য করতে পারি?`
        : `Welcome, ${firstName}! This is ${empName}. How can I assist you with your account, limits, or any recent transactions today?`,
      escalate: false,
      issueAction: 'none',
    };
  }

  if (text.includes('thank') || text.includes('dhonnobad') || text.includes('shukriya') || text.includes('ধন্যবাদ')) {
    return {
      response: isBn
        ? `আপনাকেও ধন্যবাদ, ${firstName}! আর কোনো তথ্য বা সহায়তার প্রয়োজন হলে জানাবেন।`
        : `You are very welcome, ${firstName}! Let me know anytime if you need another check.`,
      escalate: false,
      issueAction: 'none',
    };
  }

  // 15. PROACTIVE ENQUIRY DEFAULT
  return {
    response: isBn
      ? `হ্যালো ${firstName}, আমি ${empName} বলছি। আপনার বর্তমান সঞ্চয় ৳${totalDeposit.toLocaleString()}, বকেয়া ৳${remainingDebt.toLocaleString()}, এবং ক্রেডিট স্কোর ${creditScore}/850। কোন নির্দিষ্ট লেনদেন, ঋণ বা সমস্যার বিষয়ে সাহায্য করব বলবেন কি?`
      : `Hello ${firstName}, I am ${empName}. Your account currently shows ৳${totalDeposit.toLocaleString()} BDT in savings, ৳${remainingDebt.toLocaleString()} BDT active debt, and a ${creditScore}/850 credit score. Which transaction, limit, or question would you like me to look into?`,
    escalate: false,
    issueAction: 'none',
    suggestedReplies: isBn
      ? ['আমার পেন্ডিং লেনদেন চেক করুন', 'আমার ক্রেডিট স্কোর ও সীমা দেখুন', 'একটি লেনদেনের সমস্যা জানাব']
      : ['Check my pending transactions', 'Explain my credit score & term limit', 'Report a transaction issue'],
  };
}
