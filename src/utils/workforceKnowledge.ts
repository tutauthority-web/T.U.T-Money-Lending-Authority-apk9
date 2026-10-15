/**
 * T.U.T Digital Workforce Knowledge & Fallback Intelligence Engine
 * Provides 24/7 human-like, short, and highly accurate responses
 * with member account awareness, trained FAQs, and humble dialogue handling.
 */

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
  savingsBalance?: number;
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
  ticketCategory?: string;
  ticketPriority?: string;
  ticketDescription?: string;
}

/**
 * Intelligent Rule-Based Dialogue Engine
 * Analyzes member message intent and returns precise, human-toned, professional responses.
 */
export function generateHumanEmployeeResponse(
  message: string,
  member: MemberContext = {},
  employee: EmployeeInfo = {},
  isAdmin: boolean = false
): FallbackResponse {
  const text = (message || '').trim().toLowerCase();
  
  // Member Facts
  const name = member.name || member.fullName || 'Valued Member';
  const firstName = name.split(' ')[0];
  const memberId = member.memberId || `TUT-${(member.uid || 'MEM01').substring(0, 6).toUpperCase()}`;
  const nid = member.nid || 'Verified on file';
  const phone = member.phone || 'Recorded on file';
  const email = member.email || 'Registered account';
  const address = member.address || 'Dhaka, Bangladesh';
  const remainingDebt = member.remainingDebt || 0;
  const totalLoan = member.totalLoan || 0;
  const totalDeposit = member.totalDeposit || member.savingsBalance || 0;
  const borrowingLimit = member.borrowingLimit || 100000;
  const availableBorrowingCapacity = Math.max(0, borrowingLimit - remainingDebt);
  const totalRepaid = member.totalRepaid !== undefined ? member.totalRepaid : Math.max(0, totalLoan - remainingDebt);
  const accountStatus = (member.status || 'Active').toLowerCase();
  const subTier = member.subscriptionTier ? member.subscriptionTier.toUpperCase() : 'STANDARD';
  const subMonths = member.continuousSubscriptionMonths || 0;

  // Employee Identity
  const empName = employee.name || 'Rafiqul Islam';
  const empDept = employee.department || 'Customer Support';

  // --- ADMIN WORKFLOW ---
  if (isAdmin) {
    if (text.includes('reserve') || text.includes('liquid') || text.includes('cash')) {
      return {
        response: `Greetings Admin. Liquid available cash and dual-reserve pool balances (Main Reserves & Deposit Reserves) are tracked continuously. Main Reserves bear active debt exposures while customer deposits remain ring-fenced.`,
        escalate: false
      };
    }
    if (text.includes('pending') || text.includes('queue') || text.includes('request')) {
      return {
        response: `All incoming loan applications, deposit receipts, and overdue debt warnings are lined up in the Operations Queue for sequential review and automated audit checks.`,
        escalate: false
      };
    }
    return {
      response: `Greetings Admin. I am ${empName} with the ${empDept} desk. System ledgers, digital staff, and audit pipelines are operational 24/7.`,
      escalate: false
    };
  }

  // --- MEMBER WORKFLOW (24/7 HUMAN-LIKE, SHORT, PROFESSIONAL & HUMBLE) ---

  // 1. FORBIDDEN ACTIONS & ADMINISTRATIVE ESCALATIONS
  if (
    text.includes('approve my loan now') || 
    text.includes('approve now') || 
    text.includes('give me money now') || 
    text.includes('increase my balance directly') || 
    text.includes('bypass verification') ||
    text.includes('cheat') ||
    text.includes('scam') ||
    text.includes('urgent dispute') ||
    text.includes('talk to manager') ||
    text.includes('talk to admin') ||
    text.includes('human agent') ||
    text.includes('complaint')
  ) {
    return {
      response: `I understand your concern, ${firstName}. While digital support officers cannot manually bypass underwriting audit rules, I have immediately logged an official Priority Escalation ticket for our Chief Underwriter to review your file.`,
      escalate: true,
      ticketCategory: text.includes('dispute') ? 'Security Block' : 'Loan Issue',
      ticketPriority: 'High',
      ticketDescription: `Member ${name} (${memberId}) requested administrative escalation: "${message.slice(0, 100)}"`
    };
  }

  // 2. MEMBER ACCOUNT INFORMATION / DOSSIER / "WHO AM I"
  if (
    text.includes('my info') || 
    text.includes('my information') || 
    text.includes('who am i') || 
    text.includes('amar info') || 
    text.includes('amar tothyo') || 
    text.includes('amar details') || 
    text.includes('my details') || 
    text.includes('my profile') || 
    text.includes('show my info') || 
    text.includes('tell me my info') || 
    text.includes('member info') || 
    text.includes('my record') ||
    text.includes('amar account')
  ) {
    return {
      response: `Hello ${firstName}! Here is your verified T.U.T file: Member ID: ${memberId} | Status: ${accountStatus.toUpperCase()} (${subTier} Tier) | Borrowing Limit: ৳${borrowingLimit.toLocaleString()} BDT | Active Debt: ৳${remainingDebt.toLocaleString()} BDT | Deposit Savings: ৳${totalDeposit.toLocaleString()} BDT.`,
      escalate: false
    };
  }

  // 3. SPECIFIC CREDENTIAL INQUIRIES (NID, PHONE, EMAIL, MEMBER ID)
  if (text.includes('my nid') || text.includes('what is my nid') || text.includes('amar nid') || text.includes('national id')) {
    return {
      response: `Your registered National ID (NID) on file is ${nid}, verified under your legal name ${name}.`,
      escalate: false
    };
  }

  if (text.includes('my member id') || text.includes('what is my id') || text.includes('amar id') || text.includes('membership id')) {
    return {
      response: `Your official T.U.T Syndicate Member ID is ${memberId}. Please quote this reference in all deposit and repayment vouchers.`,
      escalate: false
    };
  }

  if (text.includes('my phone') || text.includes('my mobile') || text.includes('my number') || text.includes('my email') || text.includes('amar phone')) {
    return {
      response: `Your contact dossier on file: Mobile: ${phone} | Email: ${email} | Address: ${address}.`,
      escalate: false
    };
  }

  // 4. REMAINING DEBT / DUE INQUIRIES
  if (
    text.includes('debt') || 
    text.includes('due') || 
    text.includes('baki') || 
    text.includes('koto taka baki') || 
    text.includes('how much do i owe') || 
    text.includes('remaining') ||
    text.includes('loan balance')
  ) {
    if (remainingDebt > 0) {
      return {
        response: `Hello ${firstName}, your current outstanding loan balance is ৳${remainingDebt.toLocaleString()} BDT (total repaid so far: ৳${totalRepaid.toLocaleString()} BDT). Settle anytime via the Repayment tab to refresh your borrowing limit.`,
        escalate: false
      };
    } else {
      return {
        response: `Good news, ${firstName}! You currently have ৳0 BDT in outstanding debt. Your credit standing is pristine with full borrowing capacity.`,
        escalate: false
      };
    }
  }

  // 5. BORROWING LIMIT & AVAILABLE CAPACITY
  if (
    text.includes('limit') || 
    text.includes('how much can i borrow') || 
    text.includes('capacity') || 
    text.includes('eligible') || 
    text.includes('eligibility') || 
    text.includes('koto taka loan pabo') || 
    text.includes('maximum loan') ||
    text.includes('can i get loan') ||
    text.includes('can i borrow') ||
    text.includes('loan pabo kina')
  ) {
    return {
      response: `Hello ${firstName}, your approved borrowing limit is ৳${borrowingLimit.toLocaleString()} BDT. Factoring in your active debt of ৳${remainingDebt.toLocaleString()} BDT, your currently available borrowing capacity is ৳${availableBorrowingCapacity.toLocaleString()} BDT.`,
      escalate: false
    };
  }

  // 6. HOW TO APPLY FOR A LOAN
  if (
    text.includes('how to apply') || 
    text.includes('how to get loan') || 
    text.includes('loan application') || 
    text.includes('apply for loan') || 
    text.includes('want loan') || 
    text.includes('need loan') || 
    text.includes('taka lagbe') || 
    text.includes('loan chai') || 
    text.includes('borrow money')
  ) {
    return {
      response: `To apply, open the 'Borrow' tab in your member portal, select your required amount up to ৳${availableBorrowingCapacity.toLocaleString()} BDT, and confirm. Applications undergo automated auditing and are disbursed within 2 hours.`,
      escalate: false
    };
  }

  // 7. MULTIPLE / SECOND LOAN POLICY
  if (
    text.includes('second loan') || 
    text.includes('another loan') || 
    text.includes('two loans') || 
    text.includes('2nd loan') || 
    text.includes('multiple loan') || 
    text.includes('arekta loan')
  ) {
    if (remainingDebt > 0) {
      return {
        response: `You currently have an active balance of ৳${remainingDebt.toLocaleString()} BDT. You can borrow additional funds within your remaining limit (৳${availableBorrowingCapacity.toLocaleString()} BDT), or fully settle your current loan to unlock maximum borrowing lines.`,
        escalate: false
      };
    } else {
      return {
        response: `You have ৳0 active debt, ${firstName}! You are fully cleared to apply for any loan up to your maximum limit of ৳${borrowingLimit.toLocaleString()} BDT.`,
        escalate: false
      };
    }
  }

  // 8. DEPOSIT SAVINGS & WITHDRAWAL (RING-FENCED RESERVES)
  if (
    text.includes('withdraw') || 
    text.includes('taka tulbo') || 
    text.includes('deposit tulbo') || 
    text.includes('can i withdraw') || 
    text.includes('how to withdraw') || 
    text.includes('cash out')
  ) {
    return {
      response: `Yes, ${firstName}. Member Deposit Reserves (your balance: ৳${totalDeposit.toLocaleString()} BDT) are ring-fenced in a segregated vault separate from lending operations, so you can submit a withdrawal request anytime for immediate processing.`,
      escalate: false
    };
  }

  if (
    text.includes('deposit') || 
    text.includes('savings') || 
    text.includes('wallet') || 
    text.includes('my balance') || 
    text.includes('account balance') || 
    text.includes('koto taka joma')
  ) {
    return {
      response: `Hello ${firstName}, your total verified deposit savings balance in T.U.T is ৳${totalDeposit.toLocaleString()} BDT. All member deposits are protected in a dedicated reserve vault.`,
      escalate: false
    };
  }

  // 9. REPAYMENT METHODS & INSTRUCTIONS
  if (
    text.includes('how to repay') || 
    text.includes('how to pay') || 
    text.includes('repayment') || 
    text.includes('pay due') || 
    text.includes('bkash') || 
    text.includes('nagad') || 
    text.includes('bank transfer') || 
    text.includes('payment method') || 
    text.includes('kivabe taka pathabo')
  ) {
    return {
      response: `Repayments can be completed via bKash, Nagad, or Bank Transfer under the 'Repayment' tab. Transfer to the official merchant number and submit your Transaction ID for instantaneous ledger clearance.`,
      escalate: false
    };
  }

  // 10. APPROVAL DURATION & TIMELINE
  if (
    text.includes('how long') || 
    text.includes('duration') || 
    text.includes('when will') || 
    text.includes('koto shomoy lagbe') || 
    text.includes('taka kobe pabo') || 
    text.includes('time')
  ) {
    return {
      response: `Loan requests and deposit reconciliations are completed within 30 minutes to 2 hours during operational banking cycles. You will receive an automated portal notification upon disbursement.`,
      escalate: false
    };
  }

  // 11. SUBSCRIPTION TIER & LIMIT BOOSTING
  if (
    text.includes('increase limit') || 
    text.includes('boost limit') || 
    text.includes('limit barabo') || 
    text.includes('upgrade') || 
    text.includes('tier') || 
    text.includes('gold') || 
    text.includes('subscription')
  ) {
    return {
      response: `You are currently on the ${subTier} Tier (${subMonths} active continuous months). Making regular on-time repayments and maintaining continuous monthly subscription expands your borrowing limit up to ৳500,000 BDT.`,
      escalate: false
    };
  }

  // 12. INTEREST, CHARGES & HALAL / TRANSPARENCY
  if (
    text.includes('interest') || 
    text.includes('rate') || 
    text.includes('fee') || 
    text.includes('charge') || 
    text.includes('percentage') || 
    text.includes('halal') || 
    text.includes('sharia') || 
    text.includes('sood') || 
    text.includes('sud')
  ) {
    return {
      response: `T.U.T operates transparently with 0% compound usury. We only charge standard administrative platform processing fees as specified in your subscription tier, ensuring ethical and transparent finance.`,
      escalate: false
    };
  }

  // 13. OFFICE HOURS, LOCATION & AUTHORITY FOUNDATION
  if (
    text.includes('office') || 
    text.includes('location') || 
    text.includes('address') || 
    text.includes('kothay') || 
    text.includes('open') || 
    text.includes('hours') || 
    text.includes('branch')
  ) {
    return {
      response: `T.U.T Money Lending Authority operates a 24/7 digital platform with central offices in Dhaka, Bangladesh. Our digital workforce and financial advisors are stationed online around the clock.`,
      escalate: false
    };
  }

  if (
    text.includes('who is owner') || 
    text.includes('founder') || 
    text.includes('authority') || 
    text.includes('malik k') || 
    text.includes('who made')
  ) {
    return {
      response: `T.U.T Money Lending Authority is an autonomous private lending syndicate directed by executive trustees, underwritten by institutional capital reserves and rigorous ledger audits.`,
      escalate: false
    };
  }

  // 14. ARE YOU A REAL PERSON OR AI?
  if (
    text.includes('are you real') || 
    text.includes('are you human') || 
    text.includes('are you ai') || 
    text.includes('are you bot') || 
    text.includes('tumi ki robot') || 
    text.includes('manush naki ai')
  ) {
    return {
      response: `I am ${empName}, your assigned digital operations specialist from the ${empDept} desk. I work directly inside the T.U.T system 24/7 with live access to your verified ledger to provide prompt, human-like assistance.`,
      escalate: false
    };
  }

  // 15. HUMBLE "CAN YOU HELP ME?" / "PLEASE HELP"
  if (
    text.includes('can you help') || 
    text.includes('help me') || 
    text.includes('need help') || 
    text.includes('sahajjo chai') || 
    text.includes('help lagbe') || 
    text.includes('please help') || 
    text.includes('assist me')
  ) {
    return {
      response: `Certainly, ${firstName}! It is my pleasure to assist you. I have your file open right now. Please let me know whether you need help with loan requests, account information, or repayments.`,
      escalate: false
    };
  }

  // 16. HUMBLE APOLOGY / FORGIVENESS FROM MEMBER
  if (text.includes('sorry') || text.includes('forgive') || text.includes('bhul hoyeche') || text.includes('apologize') || text.includes('mistake')) {
    return {
      response: `Please do not worry at all, ${firstName}! We are here to support you with patience and humility. How may I best assist you today?`,
      escalate: false
    };
  }

  // 17. BANGLA HUMBLE GREETINGS / INQUIRIES
  if (text.includes('kemon achen') || text.includes('bhalo achen') || text.includes('ki khobor')) {
    return {
      response: `Alhamdulillah, ami bhalo achi, ${firstName}! T.U.T 24/7 support desk theke ami ${empName} bolchi. Apnar account ba loan shomporke kono tothyo lagle janan.`,
      escalate: false
    };
  }

  // 18. HUMBLE ISLAMIC & ENGLISH GREETINGS
  if (
    text === 'hi' || 
    text === 'hello' || 
    text === 'hey' || 
    text.startsWith('salam') || 
    text.includes('assalamu') || 
    text.includes('good morning') || 
    text.includes('good evening') || 
    text.includes('good afternoon')
  ) {
    return {
      response: `Wa Alaikum Assalam and welcome, ${firstName}! I am ${empName} from the ${empDept} desk. How may I humbly assist you with your finances today?`,
      escalate: false
    };
  }

  // 19. HUMBLE THANKS & GRATITUDE
  if (
    text.includes('thank') || 
    text.includes('dhonnobad') || 
    text.includes('great') || 
    text.includes('appreciate') || 
    text.includes('helpful') ||
    text.includes('shukriya')
  ) {
    return {
      response: `You are most welcome, ${firstName}! It is an absolute honor serving you. Feel free to reach out anytime — our support desk is active 24/7.`,
      escalate: false
    };
  }

  // 20. GENERAL ENQUIRY DEFAULT (HUMBLE, REAL-HUMAN, SHORT & PROFESSIONAL WITH MEMBER FACTS)
  return {
    response: `Hello ${firstName}, I am ${empName} from the ${empDept} desk. Your account is active with an available borrowing limit of ৳${availableBorrowingCapacity.toLocaleString()} BDT (active debt: ৳${remainingDebt.toLocaleString()} BDT). How may I assist you today?`,
    escalate: false
  };
}
