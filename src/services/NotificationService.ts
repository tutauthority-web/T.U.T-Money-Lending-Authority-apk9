import { Firestore } from 'firebase/firestore';
import type { OfficialReceiptData } from '../components/common/OfficialReceiptModal';
import {
  DirectMemoAttachment,
  normalizeMemoCode,
  computeLedgerChecksum,
  getReceiptMeta,
  formatReceiptTimestamp,
  generateDirectMemoAttachments
} from '../utils/receiptGenerator';

export type NotificationCategory =
  | 'Membership'
  | 'Transaction'
  | 'Due Reminder'
  | 'Security'
  | 'System'
  | 'Report'
  | 'Broadcast';

export interface EmailAutomationConfig {
  masterEnabled: boolean;
  autoTransactionMemos: boolean;
  autoMembershipUpdates: boolean;
  autoDueReminders: boolean;
  dueReminderLeadDays: number;
  overdueRepeatDays: number;
  copyAdminOnMemberMails: boolean;
  securityAlerts: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_EMAIL_AUTOMATION_CONFIG: EmailAutomationConfig = {
  masterEnabled: true,
  autoTransactionMemos: true,
  autoMembershipUpdates: true,
  autoDueReminders: true,
  dueReminderLeadDays: 3,
  overdueRepeatDays: 5,
  copyAdminOnMemberMails: true,
  securityAlerts: true,
};

export interface NotificationPayload {
  user?: {
    uid?: string;
    name?: string;
    email?: string;
    emailNotificationsEnabled?: boolean;
    phone?: string;
    nid?: string;
    occupation?: string;
    address?: string;
    memberId?: string;
    borrowingLimit?: number;
    remainingDebt?: number;
  };
  tx?: {
    id?: string;
    amount?: number;
    type?: string;
    method?: string;
    memoId?: string;
    transactionId?: string;
    accountNumber?: string;
    reference?: string;
    mobileOperator?: string;
    subscriptionTier?: string;
    subscriptionMonths?: number;
    estimatedRepaymentDate?: string;
    loanReason?: string;
    decidedBy?: string;
    decidedAt?: string;
  };
  wallet?: {
    provider?: string;
    mobileNumber?: string;
    holderName?: string;
  };
  customNotes?: string;
  customDetails?: Record<string, string>;
  severity?: 'info' | 'warning' | 'critical';
  errorDetails?: string;
  reportData?: {
    activeMembers?: number;
    reserveFunds?: number;
    disbursedLoans?: number;
    outstandingDebt?: number;
  };
}

export interface EmailContentBlock {
  title: string;
  subject?: string;
  summary: string;
  details: Record<string, string>;
  referenceId: string;
  accentTone?: 'neutral' | 'success' | 'warning' | 'danger';
  ctaLabel?: string;
  heroAmount?: string;
  heroCaption?: string;
  automationBadge?: string;
  memoNote?: string;
}

export interface EventDefinition {
  category: NotificationCategory;
  recipients: ('admin' | 'member')[];
  generateAdminContent?: (payload: NotificationPayload) => EmailContentBlock;
  generateMemberContent?: (payload: NotificationPayload) => EmailContentBlock;
}

const fmtAmt = (amount?: number) => `৳${Number(amount || 0).toLocaleString()} BDT`;

const escapeHtml = (str: string) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Clean, simple, easy-to-read professional email registry
export const EVENT_REGISTRY: Record<string, EventDefinition> = {
  membership_request: {
    category: 'Membership',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'New Membership Application',
      subject: `New membership application from ${p.user?.name || 'Applicant'}`,
      summary: `${p.user?.name || 'A new applicant'} submitted a membership registration and is awaiting identity review.`,
      details: {
        'Applicant Name': p.user?.name || 'Unknown',
        'Email': p.user?.email || 'N/A',
        'Phone': p.user?.phone || 'N/A',
        'NID Number': p.user?.nid || 'N/A',
        'Status': 'Pending Review',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'NEW-REG',
    }),
    generateMemberContent: (p) => ({
      title: 'Application Received',
      subject: 'T.U.T. — We received your membership application',
      summary: `Hi ${p.user?.name || 'there'}, thank you for applying to T.U.T. Private Authority. Your application is currently under review by our verification desk.`,
      details: {
        'Applicant Name': p.user?.name || 'Member',
        'Registered Email': p.user?.email || 'N/A',
        'Current Stage': 'Identity & Document Review',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'REG-PENDING',
    }),
  },

  membership_approved: {
    category: 'Membership',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Membership Approved',
      subject: `Membership approved for ${p.user?.name || 'Member'}`,
      summary: `Membership registration for ${p.user?.name || 'the member'} has been approved and assigned Member ID ${p.user?.memberId || 'N/A'}.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Member ID': p.user?.memberId || 'N/A',
        'Borrowing Limit': fmtAmt(p.user?.borrowingLimit || 500),
      },
      referenceId: p.user?.memberId || 'MBR-APR',
      accentTone: 'success',
    }),
    generateMemberContent: (p) => ({
      title: 'Your Membership Is Active',
      subject: `Welcome to T.U.T. — Your membership (${p.user?.memberId || 'Active'}) is approved`,
      summary: `Hi ${p.user?.name || 'there'}, good news — your T.U.T. membership application has been approved. You can now sign in to access deposits, subscriptions, and lending services.`,
      details: {
        'Member Name': p.user?.name || 'Member',
        'Member ID': p.user?.memberId || 'N/A',
        'Approved Borrowing Limit': fmtAmt(p.user?.borrowingLimit || 500),
        'Account Status': 'Active & Verified',
      },
      referenceId: p.user?.memberId || 'WELCOME-TUT',
      accentTone: 'success',
      ctaLabel: 'Open Member Dashboard',
    }),
  },

  membership_rejected: {
    category: 'Membership',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Membership Declined',
      subject: `Membership declined for ${p.user?.name || 'Applicant'}`,
      summary: `The membership application for ${p.user?.name || 'the applicant'} was declined.`,
      details: {
        'Applicant Name': p.user?.name || 'Unknown',
        'Reason': p.customNotes || 'Did not meet verification requirements.',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'MBR-REJ',
      accentTone: 'danger',
    }),
    generateMemberContent: (p) => ({
      title: 'Membership Application Update',
      subject: 'T.U.T. — Update on your membership application',
      summary: `Hi ${p.user?.name || 'there'}, thank you for your interest in T.U.T. Unfortunately, we could not approve your application at this time.`,
      details: {
        'Reason': p.customNotes || 'Verification details could not be confirmed.',
        'What You Can Do': 'Review your details or contact member support for help.',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'REQ-REJ',
      accentTone: 'danger',
    }),
  },

  membership_more_info: {
    category: 'Membership',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Additional KYC Info Requested',
      subject: `Requested additional details from ${p.user?.name || 'Applicant'}`,
      summary: `An information update request was sent to ${p.user?.name || 'the member'}.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Admin Note': p.customNotes || 'Updated documents requested.',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'AUD-REQ',
      accentTone: 'warning',
    }),
    generateMemberContent: (p) => ({
      title: 'Action Needed: Verify Your Details',
      subject: 'T.U.T. — Additional information needed for your account',
      summary: `Hi ${p.user?.name || 'there'}, our verification team needs one more detail to finish reviewing your account.`,
      details: {
        'Requested Information': p.customNotes || 'Please review and update your profile or ID documents.',
        'Next Step': 'Open your dashboard and submit the requested update.',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'ACTION-REQD',
      accentTone: 'warning',
      ctaLabel: 'Update My Details',
    }),
  },

  new_loan_request: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'New Loan Request Submitted',
      subject: `Loan request: ${fmtAmt(p.tx?.amount)} from ${p.user?.name || 'Member'}`,
      summary: `${p.user?.name || 'A member'} submitted a loan request for ${fmtAmt(p.tx?.amount)} awaiting underwriting review.`,
      details: {
        'Borrower': p.user?.name || 'Member',
        'Requested Amount': fmtAmt(p.tx?.amount),
        'Payout Method': p.tx?.method || 'N/A',
        'Purpose': p.tx?.loanReason || 'Personal Need',
        'Expected Repayment Date': p.tx?.estimatedRepaymentDate || 'Standard Term',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'LOAN-NEW',
    }),
    generateMemberContent: (p) => ({
      title: 'Loan Request Received',
      subject: `T.U.T. — Loan request received (${fmtAmt(p.tx?.amount)})`,
      summary: `Hi ${p.user?.name || 'there'}, your loan request for ${fmtAmt(p.tx?.amount)} has been logged and is now waiting for approval.`,
      details: {
        'Requested Amount': fmtAmt(p.tx?.amount),
        'Payout Method': p.tx?.method || 'N/A',
        'Expected Repayment Date': p.tx?.estimatedRepaymentDate || 'Standard Term',
        'Status': 'Pending Review',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'LOAN-PENDING',
    }),
  },

  loan_approved: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Loan Approved & Memo Issued',
      subject: `Loan approved: ${fmtAmt(p.tx?.amount)} for ${p.user?.name || 'Member'}`,
      summary: `Loan of ${fmtAmt(p.tx?.amount)} for ${p.user?.name || 'the member'} has been confirmed and official memo ${p.tx?.memoId || 'issued'}.`,
      details: {
        'Borrower': p.user?.name || 'Unknown',
        'Approved Amount': fmtAmt(p.tx?.amount),
        'Payout Method': p.tx?.method || 'N/A',
        'Official Memo ID': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'LOAN-APR',
      accentTone: 'success',
    }),
    generateMemberContent: (p) => ({
      title: 'Loan Approved & Memo Ready',
      subject: `T.U.T. — Your loan of ${fmtAmt(p.tx?.amount)} is approved (${p.tx?.memoId || 'Memo Ready'})`,
      summary: `Hi ${p.user?.name || 'there'}, your loan request of ${fmtAmt(p.tx?.amount)} has been approved. Your official memo receipt is now available in your Vault.`,
      details: {
        'Approved Amount': fmtAmt(p.tx?.amount),
        'Disbursement Method': p.tx?.method || 'N/A',
        'Official Memo ID': p.tx?.memoId || 'N/A',
        'Repayment Target': p.tx?.estimatedRepaymentDate || 'As agreed in ledger',
        ...(p.customNotes ? { 'Admin Note': p.customNotes } : {}),
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'LOAN-VERIFIED',
      accentTone: 'success',
      ctaLabel: 'Download Memo in Vault',
    }),
  },

  loan_rejected: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Loan Request Declined',
      subject: `Loan declined: ${fmtAmt(p.tx?.amount)} for ${p.user?.name || 'Member'}`,
      summary: `Loan request of ${fmtAmt(p.tx?.amount)} from ${p.user?.name || 'the member'} was declined.`,
      details: {
        'Borrower': p.user?.name || 'Unknown',
        'Requested Amount': fmtAmt(p.tx?.amount),
        'Reason': p.customNotes || 'Credit eligibility criteria not met.',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'LOAN-REJ',
      accentTone: 'danger',
    }),
    generateMemberContent: (p) => ({
      title: 'Loan Request Declined',
      subject: `T.U.T. — Update on your ${fmtAmt(p.tx?.amount)} loan request`,
      summary: `Hi ${p.user?.name || 'there'}, your loan request for ${fmtAmt(p.tx?.amount)} could not be approved at this time.`,
      details: {
        'Requested Amount': fmtAmt(p.tx?.amount),
        'Reason': p.customNotes || 'Please clear any active dues or check your borrowing limit.',
        'Need Help?': 'Message an officer inside your dashboard.',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'LOAN-DEC',
      accentTone: 'danger',
    }),
  },

  loan_disbursed: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Loan Funds Disbursed',
      subject: `Disbursed ${fmtAmt(p.tx?.amount)} to ${p.user?.name || 'Member'}`,
      summary: `Funds for loan ${p.tx?.memoId || ''} (${fmtAmt(p.tx?.amount)}) have been sent to ${p.user?.name || 'the member'}.`,
      details: {
        'Recipient': p.user?.name || 'Unknown',
        'Disbursed Amount': fmtAmt(p.tx?.amount),
        'Channel': p.tx?.method || 'N/A',
        'Official Memo ID': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'LOAN-DISB',
      accentTone: 'success',
    }),
    generateMemberContent: (p) => ({
      title: 'Loan Funds Sent',
      subject: `T.U.T. — Funds sent for your ${fmtAmt(p.tx?.amount)} loan`,
      summary: `Hi ${p.user?.name || 'there'}, we have sent ${fmtAmt(p.tx?.amount)} to your selected payout channel.`,
      details: {
        'Amount Sent': fmtAmt(p.tx?.amount),
        'Channel': p.tx?.method || 'N/A',
        'Official Memo ID': p.tx?.memoId || 'N/A',
        'Status': 'Completed',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'DISB-CONFIRMED',
      accentTone: 'success',
    }),
  },

  loan_cancelled: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Loan Request Cancelled',
      subject: `${p.user?.name || 'Member'} cancelled a ${fmtAmt(p.tx?.amount)} loan request`,
      summary: `${p.user?.name || 'A member'} cancelled their pending loan request before processing.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Amount': fmtAmt(p.tx?.amount),
        'Status': 'Cancelled by Member',
      },
      referenceId: p.tx?.id || 'LOAN-CAN',
    }),
    generateMemberContent: (p) => ({
      title: 'Loan Request Cancelled',
      subject: 'T.U.T. — Your pending loan request was cancelled',
      summary: `Hi ${p.user?.name || 'there'}, your pending loan request of ${fmtAmt(p.tx?.amount)} has been cancelled as requested.`,
      details: {
        'Cancelled Amount': fmtAmt(p.tx?.amount),
        'Status': 'Cancelled',
      },
      referenceId: p.tx?.id || 'LOAN-CANCELLED',
    }),
  },

  deposit_request: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'New Deposit Submitted',
      subject: `Deposit verification needed: ${fmtAmt(p.tx?.amount)} from ${p.user?.name || 'Member'}`,
      summary: `${p.user?.name || 'A member'} submitted a deposit of ${fmtAmt(p.tx?.amount)} awaiting TrxID check.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Deposit Amount': fmtAmt(p.tx?.amount),
        'Channel': p.tx?.method || 'N/A',
        'TrxID / Reference': p.tx?.transactionId || 'N/A',
        'Sender Number': p.tx?.accountNumber || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'DEP-REQ',
    }),
    generateMemberContent: (p) => ({
      title: 'Deposit Request Logged',
      subject: `T.U.T. — Deposit request received (${fmtAmt(p.tx?.amount)})`,
      summary: `Hi ${p.user?.name || 'there'}, we received your deposit submission of ${fmtAmt(p.tx?.amount)}. It will reflect in your Savings Vault once verified.`,
      details: {
        'Deposit Amount': fmtAmt(p.tx?.amount),
        'Channel': p.tx?.method || 'N/A',
        'TrxID / Reference': p.tx?.transactionId || 'N/A',
        'Status': 'Pending Verification',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'DEP-PENDING',
    }),
  },

  deposit_confirmed: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Deposit Confirmed & Credited',
      subject: `Deposit confirmed: ${fmtAmt(p.tx?.amount)} for ${p.user?.name || 'Member'}`,
      summary: `Deposit of ${fmtAmt(p.tx?.amount)} for ${p.user?.name || 'the member'} has been verified and credited.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Credited Amount': fmtAmt(p.tx?.amount),
        'Channel': p.tx?.method || 'N/A',
        'Official Memo ID': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'DEP-CONF',
      accentTone: 'success',
    }),
    generateMemberContent: (p) => ({
      title: 'Deposit Credited to Your Vault',
      subject: `T.U.T. — Deposit confirmed: ${fmtAmt(p.tx?.amount)} (${p.tx?.memoId || 'Receipt Ready'})`,
      summary: `Hi ${p.user?.name || 'there'}, your deposit of ${fmtAmt(p.tx?.amount)} has been verified and added to your T.U.T. Savings Vault.`,
      details: {
        'Credited Amount': fmtAmt(p.tx?.amount),
        'Payment Method': p.tx?.method || 'N/A',
        'Official Memo ID': p.tx?.memoId || 'N/A',
        'Status': 'Verified & Credited',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'DEP-SUCCESS',
      accentTone: 'success',
      ctaLabel: 'View Deposit Receipt',
    }),
  },

  repayment_request: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'New Repayment Logged',
      subject: `Repayment check: ${fmtAmt(p.tx?.amount)} from ${p.user?.name || 'Member'}`,
      summary: `${p.user?.name || 'A member'} submitted a loan repayment of ${fmtAmt(p.tx?.amount)} awaiting verification.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Repayment Amount': fmtAmt(p.tx?.amount),
        'Method': p.tx?.method || 'N/A',
        'TrxID / Reference': p.tx?.transactionId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'REP-REQ',
    }),
    generateMemberContent: (p) => ({
      title: 'Repayment Submission Received',
      subject: `T.U.T. — Repayment submitted (${fmtAmt(p.tx?.amount)})`,
      summary: `Hi ${p.user?.name || 'there'}, we received your repayment notice of ${fmtAmt(p.tx?.amount)}. Our desk will verify the transaction shortly.`,
      details: {
        'Submitted Amount': fmtAmt(p.tx?.amount),
        'TrxID / Reference': p.tx?.transactionId || 'N/A',
        'Status': 'Awaiting Confirmation',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'REP-PENDING',
    }),
  },

  repayment_received: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Repayment Verified & Credited',
      subject: `Repayment credited: ${fmtAmt(p.tx?.amount)} from ${p.user?.name || 'Member'}`,
      summary: `Repayment of ${fmtAmt(p.tx?.amount)} from ${p.user?.name || 'the member'} has been confirmed.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Amount Credited': fmtAmt(p.tx?.amount),
        'Official Memo ID': p.tx?.memoId || 'N/A',
        'Remaining Balance': fmtAmt(p.user?.remainingDebt || 0),
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'REP-REC',
      accentTone: 'success',
    }),
    generateMemberContent: (p) => ({
      title: 'Repayment Confirmed',
      subject: `T.U.T. — Payment received: ${fmtAmt(p.tx?.amount)} (${p.tx?.memoId || 'Memo Ready'})`,
      summary: `Hi ${p.user?.name || 'there'}, thank you — your repayment of ${fmtAmt(p.tx?.amount)} has been verified and applied to your loan balance.`,
      details: {
        'Amount Paid': fmtAmt(p.tx?.amount),
        'Official Memo ID': p.tx?.memoId || 'N/A',
        'Remaining Debt Balance': fmtAmt(p.user?.remainingDebt || 0),
        'Receipt Status': 'Available in Vault',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'REP-SUCCESS',
      accentTone: 'success',
      ctaLabel: 'View Official Receipt',
    }),
  },

  loan_fully_completed: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Loan Account Settled in Full',
      subject: `Loan settled in full: ${p.user?.name || 'Member'}`,
      summary: `${p.user?.name || 'Member'} has completed full repayment. Active debt balance is now ৳0 BDT.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Remaining Debt': '৳0 BDT (Cleared)',
        'Official Memo ID': p.tx?.memoId || 'SETTLED',
      },
      referenceId: p.tx?.memoId || p.user?.memberId || 'LOAN-CLEAR',
      accentTone: 'success',
    }),
    generateMemberContent: (p) => ({
      title: 'Loan Fully Paid & Closed',
      subject: 'T.U.T. — Your loan has been settled in full',
      summary: `Hi ${p.user?.name || 'there'}, thank you for settling your loan in full. Your active debt balance is now ৳0 BDT and your credit standing remains strong.`,
      details: {
        'Member': p.user?.name || 'Member',
        'Final Amount Settled': p.tx?.amount ? fmtAmt(p.tx.amount) : 'Paid in Full',
        'Remaining Debt': '৳0 BDT',
        'Official Memo ID': p.tx?.memoId || 'SETTLED',
      },
      referenceId: p.tx?.memoId || p.user?.memberId || 'LOAN-CLEARED',
      accentTone: 'success',
      ctaLabel: 'Open Member Dashboard',
    }),
  },

  refund_processed: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Refund / Withdrawal Processed',
      subject: `Withdrawal processed: ${fmtAmt(p.tx?.amount)} for ${p.user?.name || 'Member'}`,
      summary: `A withdrawal/refund of ${fmtAmt(p.tx?.amount)} for ${p.user?.name || 'the member'} has been approved.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Amount': fmtAmt(p.tx?.amount),
        'Method': p.tx?.method || 'N/A',
        'Official Memo ID': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'REF-APR',
      accentTone: 'success',
    }),
    generateMemberContent: (p) => ({
      title: 'Withdrawal Request Approved',
      subject: `T.U.T. — Withdrawal approved: ${fmtAmt(p.tx?.amount)}`,
      summary: `Hi ${p.user?.name || 'there'}, your withdrawal/refund request for ${fmtAmt(p.tx?.amount)} has been approved and processed.`,
      details: {
        'Amount': fmtAmt(p.tx?.amount),
        'Channel': p.tx?.method || 'N/A',
        'Official Memo ID': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'REF-OK',
      accentTone: 'success',
    }),
  },

  subscription_request: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'New Charter Subscription Payment',
      subject: `Subscription payment: ${p.tx?.subscriptionTier?.toUpperCase() || 'Tier'} by ${p.user?.name || 'Member'}`,
      summary: `${p.user?.name || 'A member'} submitted a ${p.tx?.subscriptionTier || 'charter'} subscription payment of ${fmtAmt(p.tx?.amount)}.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Tier': (p.tx?.subscriptionTier || 'Standard').toUpperCase(),
        'Amount': fmtAmt(p.tx?.amount),
        'Method': p.tx?.method || 'N/A',
        'TrxID': p.tx?.transactionId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'SUB-REQ',
    }),
    generateMemberContent: (p) => ({
      title: 'Charter Subscription Submitted',
      subject: `T.U.T. — ${(p.tx?.subscriptionTier || 'Charter').toUpperCase()} subscription received`,
      summary: `Hi ${p.user?.name || 'there'}, we received your ${(p.tx?.subscriptionTier || '').toUpperCase()} charter payment of ${fmtAmt(p.tx?.amount)}.`,
      details: {
        'Tier': (p.tx?.subscriptionTier || 'Standard').toUpperCase(),
        'Amount': fmtAmt(p.tx?.amount),
        'Method': p.tx?.method || 'N/A',
        'TrxID': p.tx?.transactionId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'SUB-PENDING',
    }),
  },

  subscription_confirmed: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Membership Charter Activated',
      subject: `Subscription active: ${p.user?.name || 'Member'} (${(p.tx?.subscriptionTier || 'Tier').toUpperCase()})`,
      summary: `${p.user?.name || 'Member'} activated the ${(p.tx?.subscriptionTier || 'Charter').toUpperCase()} tier (${fmtAmt(p.tx?.amount)}).`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Tier': (p.tx?.subscriptionTier || 'Charter').toUpperCase(),
        'Fee Paid': fmtAmt(p.tx?.amount),
        'Official Memo ID': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'SUB-ACT',
      accentTone: 'success',
    }),
    generateMemberContent: (p) => ({
      title: 'Subscription Activated',
      subject: `T.U.T. — Your ${(p.tx?.subscriptionTier || 'Charter').toUpperCase()} tier is now active`,
      summary: `Hi ${p.user?.name || 'there'}, your ${(p.tx?.subscriptionTier || '').toUpperCase()} subscription (${fmtAmt(p.tx?.amount)}) is confirmed. Your new borrowing benefits are live.`,
      details: {
        'Active Plan': (p.tx?.subscriptionTier || 'Charter').toUpperCase(),
        'Amount Paid': fmtAmt(p.tx?.amount),
        'Method': p.tx?.method || 'N/A',
        'Official Memo ID': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'SUB-CONFIRMED',
      accentTone: 'success',
      ctaLabel: 'View Receipt in Vault',
    }),
  },

  // Generic transaction status handlers (prevent missing-event warnings)
  transaction_request: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'New Transaction Request',
      subject: `New ${p.tx?.type || 'transaction'} request (${fmtAmt(p.tx?.amount)})`,
      summary: `${p.user?.name || 'A member'} submitted a ${p.tx?.type || 'transaction'} request for ${fmtAmt(p.tx?.amount)}.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Type': (p.tx?.type || 'Transaction').toUpperCase(),
        'Amount': fmtAmt(p.tx?.amount),
        'Method': p.tx?.method || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'TXN-NEW',
    }),
    generateMemberContent: (p) => ({
      title: 'Request Submitted',
      subject: `T.U.T. — Request submitted (${fmtAmt(p.tx?.amount)})`,
      summary: `Hi ${p.user?.name || 'there'}, we received your request for ${fmtAmt(p.tx?.amount)}. You will be notified once it is reviewed.`,
      details: {
        'Request Type': (p.tx?.type || 'Transaction').toUpperCase(),
        'Amount': fmtAmt(p.tx?.amount),
        'Status': 'Pending Review',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'TXN-PENDING',
    }),
  },

  transaction_confirmed: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Transaction Approved',
      subject: `Approved ${p.tx?.type || 'transaction'}: ${fmtAmt(p.tx?.amount)} for ${p.user?.name || 'Member'}`,
      summary: `Transaction of ${fmtAmt(p.tx?.amount)} for ${p.user?.name || 'the member'} has been confirmed.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Amount': fmtAmt(p.tx?.amount),
        'Official Memo ID': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'TXN-OK',
      accentTone: 'success',
    }),
    generateMemberContent: (p) => ({
      title: 'Transaction Confirmed',
      subject: `T.U.T. — Your transaction of ${fmtAmt(p.tx?.amount)} is confirmed`,
      summary: `Hi ${p.user?.name || 'there'}, your transaction for ${fmtAmt(p.tx?.amount)} has been approved and recorded on your account.`,
      details: {
        'Amount': fmtAmt(p.tx?.amount),
        'Method': p.tx?.method || 'N/A',
        'Official Memo ID': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'TXN-CONFIRMED',
      accentTone: 'success',
      ctaLabel: 'View Memo Receipt',
    }),
  },

  transaction_rejected: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Transaction Declined',
      subject: `Declined ${fmtAmt(p.tx?.amount)} for ${p.user?.name || 'Member'}`,
      summary: `Transaction of ${fmtAmt(p.tx?.amount)} from ${p.user?.name || 'the member'} was declined.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Amount': fmtAmt(p.tx?.amount),
        'Reason': p.customNotes || 'Verification check did not pass.',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'TXN-REJ',
      accentTone: 'danger',
    }),
    generateMemberContent: (p) => ({
      title: 'Transaction Declined',
      subject: `T.U.T. — Update on your ${fmtAmt(p.tx?.amount)} request`,
      summary: `Hi ${p.user?.name || 'there'}, your transaction request for ${fmtAmt(p.tx?.amount)} could not be approved.`,
      details: {
        'Amount': fmtAmt(p.tx?.amount),
        'Method': p.tx?.method || 'N/A',
        'Reason': p.customNotes || 'Please verify your TrxID or account details and try again.',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'TXN-DEC',
      accentTone: 'danger',
    }),
  },

  transaction_hold: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Transaction Placed On Hold',
      subject: `Request placed on hold: ${p.user?.name || 'Member'} (${fmtAmt(p.tx?.amount)})`,
      summary: `Transaction for ${p.user?.name || 'the member'} (${fmtAmt(p.tx?.amount)}) was placed on temporary hold.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Amount': fmtAmt(p.tx?.amount),
        'Hold Note': p.customNotes || 'Secondary reconciliation in progress.',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'TXN-HOLD',
      accentTone: 'warning',
    }),
    generateMemberContent: (p) => ({
      title: 'Transaction Under Temporary Hold',
      subject: `T.U.T. — Your ${fmtAmt(p.tx?.amount)} request is temporarily on hold`,
      summary: `Hi ${p.user?.name || 'there'}, your request for ${fmtAmt(p.tx?.amount)} has been placed on temporary hold while our team completes verification.`,
      details: {
        'Amount': fmtAmt(p.tx?.amount),
        'Note from Admin': p.customNotes || 'Standard verification check in progress.',
        'Status': 'On Hold',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'TXN-HOLD',
      accentTone: 'warning',
    }),
  },

  info_requested: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Proof / Clarification Requested',
      subject: `Requested info for ${p.user?.name || 'Member'} (${fmtAmt(p.tx?.amount)})`,
      summary: `Requested additional proof or clarification from ${p.user?.name || 'the member'} regarding ${fmtAmt(p.tx?.amount)}.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Amount': fmtAmt(p.tx?.amount),
        'Message Sent': p.customNotes || 'Please share valid TrxID or payment screenshot.',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'INFO-REQ',
      accentTone: 'warning',
    }),
    generateMemberContent: (p) => ({
      title: 'Additional Information Needed',
      subject: `T.U.T. — Action needed for your ${fmtAmt(p.tx?.amount)} request`,
      summary: `Hi ${p.user?.name || 'there'}, we need a quick clarification or payment proof to complete your request of ${fmtAmt(p.tx?.amount)}.`,
      details: {
        'Amount': fmtAmt(p.tx?.amount),
        'What Is Needed': p.customNotes || 'Please share your correct TrxID or payment receipt screenshot.',
        'Status': 'Waiting for Your Response',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'INFO-REQD',
      accentTone: 'warning',
      ctaLabel: 'Respond in Dashboard',
    }),
  },

  transaction_more_info: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Transaction Clarification Requested',
      subject: `Requested transaction info from ${p.user?.name || 'Member'}`,
      summary: `Requested additional transaction proof from ${p.user?.name || 'the member'}.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Amount': fmtAmt(p.tx?.amount),
        'Note': p.customNotes || 'Payment verification proof needed.',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'TXN-INFO',
      accentTone: 'warning',
    }),
    generateMemberContent: (p) => ({
      title: 'Action Needed on Your Transaction',
      subject: 'T.U.T. — Additional details needed for your transaction',
      summary: `Hi ${p.user?.name || 'there'}, please review the note below so we can finish processing your request.`,
      details: {
        'Amount': fmtAmt(p.tx?.amount),
        'Admin Note': p.customNotes || 'Please upload a clear receipt screenshot or verify your TrxID.',
      },
      referenceId: p.tx?.memoId || p.tx?.id || 'TXN-INFO',
      accentTone: 'warning',
    }),
  },

  // SECURITY & SYSTEM EVENTS
  wallet_update_request: {
    category: 'Security',
    recipients: ['admin'],
    generateAdminContent: (p) => ({
      title: 'New Wallet Verification Request',
      subject: `Wallet verification needed: ${p.user?.name || 'Member'}`,
      summary: `${p.user?.name || 'A member'} linked a new mobile wallet that needs verification.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Provider': p.wallet?.provider || 'N/A',
        'Account Holder': p.wallet?.holderName || 'N/A',
        'Mobile Number': p.wallet?.mobileNumber || 'N/A',
      },
      referenceId: 'WLT-UPD',
    }),
  },

  wallet_added: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Wallet Linked to Your Account',
      subject: 'T.U.T. — New mobile wallet linked',
      summary: `Hi ${p.user?.name || 'there'}, a ${p.wallet?.provider || 'mobile'} wallet was linked to your profile and is pending verification.`,
      details: {
        'Provider': p.wallet?.provider || 'N/A',
        'Number': p.wallet?.mobileNumber || 'N/A',
        'Holder': p.wallet?.holderName || 'N/A',
        'Status': 'Pending Review',
      },
      referenceId: 'WLT-ADD',
    }),
  },

  wallet_verified: {
    category: 'Security',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Wallet Verified',
      subject: `Verified wallet for ${p.user?.name || 'Member'}`,
      summary: `Linked wallet for ${p.user?.name || 'the member'} has been verified.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Number': p.wallet?.mobileNumber || 'N/A',
        'Provider': p.wallet?.provider || 'N/A',
      },
      referenceId: 'WLT-VER',
      accentTone: 'success',
    }),
    generateMemberContent: (p) => ({
      title: 'Your Mobile Wallet Is Verified',
      subject: 'T.U.T. — Your mobile wallet is verified',
      summary: `Hi ${p.user?.name || 'there'}, your linked ${p.wallet?.provider || 'mobile'} wallet has been verified and is ready for transactions.`,
      details: {
        'Provider': p.wallet?.provider || 'N/A',
        'Number': p.wallet?.mobileNumber || 'N/A',
        'Status': 'Verified',
      },
      referenceId: 'WLT-VERIFIED',
      accentTone: 'success',
    }),
  },

  profile_verification_request: {
    category: 'Membership',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Profile KYC Review Requested',
      subject: `Profile verification submitted by ${p.user?.name || 'Member'}`,
      summary: `${p.user?.name || 'A member'} updated documents and requested profile verification.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'NID': p.user?.nid || 'N/A',
        'Address': p.user?.address || 'N/A',
      },
      referenceId: 'PRF-VER',
    }),
    generateMemberContent: (p) => ({
      title: 'Profile Review Request Received',
      subject: 'T.U.T. — Profile verification submitted',
      summary: `Hi ${p.user?.name || 'there'}, your profile verification request has been received. We typically complete reviews within 24 hours.`,
      details: {
        'Status': 'Under Review',
        'Estimated Review Time': 'Within 24 Hours',
      },
      referenceId: 'AUD-PENDING',
    }),
  },

  profile_updated: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Profile Details Updated',
      subject: 'T.U.T. — Your account settings were updated',
      summary: `Hi ${p.user?.name || 'there'}, your account details and email preferences were successfully updated.`,
      details: {
        'Updated Section': p.customNotes || 'Profile & Notification Settings',
        'Email Notifications': p.user?.emailNotificationsEnabled ? 'Enabled' : 'Paused',
      },
      referenceId: 'PRF-UPDATED',
    }),
  },

  new_member_registration: {
    category: 'Membership',
    recipients: ['admin'],
    generateAdminContent: (p) => ({
      title: 'New Account Sign-Up',
      subject: `New account registered: ${p.user?.name || p.user?.email || 'Member'}`,
      summary: `A new member registered using email ${p.user?.email || 'N/A'}.`,
      details: {
        'Name': p.user?.name || 'Unknown',
        'Email': p.user?.email || 'N/A',
        'Registered At': new Date().toLocaleString(),
      },
      referenceId: 'SYS-REG',
    }),
  },

  account_created: {
    category: 'Membership',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Welcome to T.U.T.',
      subject: 'Welcome to T.U.T. Private Authority',
      summary: `Hi ${p.user?.name || 'there'}, your account has been created. Once your profile review is approved, full member features will unlock automatically.`,
      details: {
        'Registered Email': p.user?.email || 'N/A',
        'Account Status': 'Pending Initial Approval',
      },
      referenceId: 'TUT-WELCOME',
    }),
  },

  failed_transaction_alert: {
    category: 'System',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Transaction Validation Failed',
      subject: `Failed transaction alert (${fmtAmt(p.tx?.amount)})`,
      summary: 'A transaction check could not be completed on the ledger.',
      details: {
        'Member': p.user?.name || 'Unknown',
        'Type': p.tx?.type || 'N/A',
        'Amount': fmtAmt(p.tx?.amount),
        'Reason': p.errorDetails || 'Validation error.',
      },
      referenceId: 'FAIL-TX-ALRT',
      accentTone: 'danger',
    }),
    generateMemberContent: (p) => ({
      title: 'Transaction Could Not Be Completed',
      subject: `T.U.T. — Transaction notice (${fmtAmt(p.tx?.amount)})`,
      summary: `Hi ${p.user?.name || 'there'}, your transaction request of ${fmtAmt(p.tx?.amount)} could not be processed.`,
      details: {
        'Type': p.tx?.type || 'N/A',
        'Amount': fmtAmt(p.tx?.amount),
        'Details': p.errorDetails || 'Please check your input and try again.',
      },
      referenceId: 'TX-ERR',
      accentTone: 'danger',
    }),
  },

  system_warning: {
    category: 'System',
    recipients: ['admin'],
    generateAdminContent: (p) => ({
      title: 'System Notice',
      subject: `[Admin Alert] ${p.customNotes || 'System Warning'}`,
      summary: 'An automated system condition requires your attention.',
      details: {
        'Notice': p.customNotes || 'General Alert',
        'Severity': p.severity?.toUpperCase() || 'WARNING',
        'Context': p.errorDetails || 'N/A',
      },
      referenceId: 'SYS-WARN',
      accentTone: 'warning',
    }),
  },

  password_changed: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Password Updated',
      subject: 'T.U.T. Security Notice — Your password was changed',
      summary: `Hi ${p.user?.name || 'there'}, the password for your T.U.T. account was just updated.`,
      details: {
        'Change': 'Account Password Updated',
        'Time': new Date().toLocaleString(),
        'Did Not Do This?': 'Contact the admin desk immediately to lock your account.',
      },
      referenceId: 'SEC-PWD',
      accentTone: 'warning',
    }),
  },

  new_device_login: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'New Sign-In Detected',
      subject: 'T.U.T. Security Notice — New sign-in to your account',
      summary: `Hi ${p.user?.name || 'there'}, we noticed a sign-in to your account from a new browser session.`,
      details: {
        'Time': new Date().toLocaleString(),
        'Status': 'Signed In',
      },
      referenceId: 'SEC-AUTH',
    }),
  },

  account_security_alert: {
    category: 'Security',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Account Security Alert',
      subject: `Security alert for ${p.user?.name || 'Member'}`,
      summary: `A security check triggered for ${p.user?.name || 'a member'}.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'Event': p.customNotes || 'Repeated failed authentication attempt',
        'Severity': p.severity?.toUpperCase() || 'HIGH',
      },
      referenceId: 'SEC-AUDIT',
      accentTone: 'danger',
    }),
    generateMemberContent: (p) => ({
      title: 'Important Security Notice',
      subject: 'T.U.T. — Security notice on your account',
      summary: `Hi ${p.user?.name || 'there'}, we noticed unusual security activity on your account. Please review your credentials.`,
      details: {
        'Notice': p.customNotes || 'Unrecognized sign-in attempt.',
        'Recommended Action': 'Update your password or PIN right away.',
      },
      referenceId: 'SEC-ALERT',
      accentTone: 'danger',
    }),
  },

  email_verification_completed: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Email Verified',
      subject: 'T.U.T. — Your email address is verified',
      summary: `Hi ${p.user?.name || 'there'}, your email address has been verified for official memos and statements.`,
      details: {
        'Email Address': p.user?.email || 'N/A',
        'Status': 'Verified',
      },
      referenceId: 'SEC-VERIFIED',
      accentTone: 'success',
    }),
  },

  daily_summary_report: {
    category: 'Report',
    recipients: ['admin'],
    generateAdminContent: (p) => ({
      title: 'Daily Operations Summary',
      subject: `T.U.T. Daily Ledger Summary (${new Date().toLocaleDateString()})`,
      summary: 'Here is today’s snapshot of member counts, reserve liquidity, and active loan balances.',
      details: {
        'Date': new Date().toLocaleDateString(),
        'Active Members': String(p.reportData?.activeMembers ?? 0),
        'Reserve Pool': fmtAmt(p.reportData?.reserveFunds ?? 0),
        'Disbursed Loans': fmtAmt(p.reportData?.disbursedLoans ?? 0),
        'Outstanding Debt': fmtAmt(p.reportData?.outstandingDebt ?? 0),
      },
      referenceId: 'RPT-DAILY',
    }),
  },

  weekly_summary_report: {
    category: 'Report',
    recipients: ['admin'],
    generateAdminContent: (p) => ({
      title: 'Weekly Operations Summary',
      subject: 'T.U.T. Weekly Ledger Summary',
      summary: 'Here is your 7-day operational summary across deposits, reserves, and active borrower exposure.',
      details: {
        'Period': 'Past 7 Days',
        'Active Members': String(p.reportData?.activeMembers ?? 0),
        'Reserve Liquidity': fmtAmt(p.reportData?.reserveFunds ?? 0),
        'Outstanding Debt': fmtAmt(p.reportData?.outstandingDebt ?? 0),
      },
      referenceId: 'RPT-WEEKLY',
    }),
  },

  password_reset: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Password Reset Completed',
      subject: 'T.U.T. — Password reset confirmation',
      summary: `Hi ${p.user?.name || 'there'}, your account password reset was completed.`,
      details: {
        'Account': p.user?.email || 'N/A',
        'Completed At': new Date().toLocaleString(),
      },
      referenceId: 'PWD-RESET',
    }),
  },

  credit_limit_adjusted: {
    category: 'System',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Borrowing Limit Updated',
      subject: `Borrowing limit set to ${fmtAmt(p.tx?.amount)} for ${p.user?.name || 'Member'}`,
      summary: `You updated ${p.user?.name || 'the member'}’s borrowing limit to ${fmtAmt(p.tx?.amount)}.`,
      details: {
        'Member': p.user?.name || 'Unknown',
        'New Borrowing Limit': fmtAmt(p.tx?.amount),
      },
      referenceId: 'LIM-UPD',
    }),
    generateMemberContent: (p) => ({
      title: 'Borrowing Limit Updated',
      subject: `T.U.T. — Your borrowing limit is now ${fmtAmt(p.tx?.amount)}`,
      summary: `Hi ${p.user?.name || 'there'}, your approved borrowing limit has been updated to ${fmtAmt(p.tx?.amount)}.`,
      details: {
        'New Borrowing Limit': fmtAmt(p.tx?.amount),
        'Availability': 'Active immediately',
      },
      referenceId: 'LIM-UPDATED',
      accentTone: 'success',
    }),
  },

  debt_warning: {
    category: 'Due Reminder',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Due Reminder Notice Sent',
      subject: `Due reminder sent to ${p.user?.name || 'Member'} (${fmtAmt(p.tx?.amount)})`,
      summary: `A repayment notice for ${fmtAmt(p.tx?.amount)} was sent to ${p.user?.name || 'the member'}.`,
      heroAmount: fmtAmt(p.tx?.amount),
      heroCaption: 'Outstanding Scheduled Balance',
      details: {
        'Member': p.user?.name || 'Unknown',
        'Outstanding Balance': fmtAmt(p.tx?.amount),
      },
      referenceId: p.tx?.memoId || 'DUE-SENT',
      accentTone: 'warning',
      automationBadge: 'Automated Schedule',
    }),
    generateMemberContent: (p) => ({
      title: 'Repayment Reminder',
      subject: `T.U.T. — Repayment reminder: ${fmtAmt(p.tx?.amount)} balance due`,
      summary: `Hi ${p.user?.name || 'there'}, this is a friendly reminder regarding your active zero-usury balance of ${fmtAmt(p.tx?.amount)}. Submit your payment anytime through your member dashboard.`,
      heroAmount: fmtAmt(p.tx?.amount),
      heroCaption: p.tx?.estimatedRepaymentDate ? `Due Date: ${p.tx.estimatedRepaymentDate}` : 'Zero-Usury Active Balance',
      details: {
        'Outstanding Balance': fmtAmt(p.tx?.amount),
        ...(p.tx?.estimatedRepaymentDate ? { 'Scheduled Due Date': p.tx.estimatedRepaymentDate } : {}),
        'Payment Desk': 'bKash (01713710607) · Nagad (01921801100) · Cash Desk',
      },
      referenceId: p.tx?.memoId || 'DUE-REMINDER',
      accentTone: 'warning',
      ctaLabel: 'Open Dashboard to Repay',
      automationBadge: 'Automated Due Notice',
      memoNote: 'Once you transfer via bKash or Nagad, open your dashboard and submit "Pay Due" with your TrxID so your balance updates automatically.',
    }),
  },

  p2p_transfer_sent: {
    category: 'Transaction',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Member Transfer Sent',
      subject: `T.U.T. — Transfer sent: ${fmtAmt(p.tx?.amount)}`,
      summary: `Hi ${p.user?.name || 'there'}, your internal vault transfer of ${fmtAmt(p.tx?.amount)} has been completed and logged.`,
      heroAmount: fmtAmt(p.tx?.amount),
      heroCaption: 'Internal Ledger Debit',
      details: {
        'Amount Transferred': fmtAmt(p.tx?.amount),
        'Memo Reference': p.tx?.memoId || 'N/A',
        ...(p.customNotes ? { 'Recipient': p.customNotes } : {}),
      },
      referenceId: p.tx?.memoId || 'P2P-OUT',
      accentTone: 'success',
      ctaLabel: 'View Transfer Memo',
    }),
  },

  p2p_transfer_received: {
    category: 'Transaction',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Funds Received in Your Vault',
      subject: `T.U.T. — You received ${fmtAmt(p.tx?.amount)}`,
      summary: `Hi ${p.user?.name || 'there'}, ${fmtAmt(p.tx?.amount)} has been credited directly to your T.U.T. Savings Vault.`,
      heroAmount: fmtAmt(p.tx?.amount),
      heroCaption: 'Vault Credit Confirmed',
      details: {
        'Amount Received': fmtAmt(p.tx?.amount),
        'Memo Reference': p.tx?.memoId || 'N/A',
        ...(p.customNotes ? { 'From Member': p.customNotes } : {}),
      },
      referenceId: p.tx?.memoId || 'P2P-IN',
      accentTone: 'success',
      ctaLabel: 'Check Vault Balance',
    }),
  },
};

// High-craft editorial banking HTML template (safe for Gmail Web, Mobile & Dark Mode clients)
export const generateBrandedEmailHtml = (
  title: string,
  summary: string,
  details: Record<string, string>,
  referenceId: string,
  appUrl: string = typeof window !== 'undefined' ? window.location.origin : '',
  options: {
    accentTone?: 'neutral' | 'success' | 'warning' | 'danger';
    ctaLabel?: string;
    memoNote?: string;
    heroAmount?: string;
    heroCaption?: string;
    automationBadge?: string;
  } = {}
): string => {
  const toneColors: Record<string, { border: string; badgeBg: string; badgeText: string; label: string; heroBg: string; heroBorder: string; heroText: string }> = {
    neutral: {
      border: '#0f172a',
      badgeBg: '#f1f5f9',
      badgeText: '#334155',
      label: 'ACCOUNT NOTICE',
      heroBg: '#f8fafc',
      heroBorder: '#e2e8f0',
      heroText: '#0f172a'
    },
    success: {
      border: '#059669',
      badgeBg: '#ecfdf5',
      badgeText: '#065f46',
      label: 'CONFIRMED',
      heroBg: '#f0fdf4',
      heroBorder: '#bbf7d0',
      heroText: '#065f46'
    },
    warning: {
      border: '#d97706',
      badgeBg: '#fffbeb',
      badgeText: '#92400e',
      label: 'REMINDER',
      heroBg: '#fffbeb',
      heroBorder: '#fde68a',
      heroText: '#92400e'
    },
    danger: {
      border: '#dc2626',
      badgeBg: '#fef2f2',
      badgeText: '#991b1b',
      label: 'OVERDUE / URGENT',
      heroBg: '#fef2f2',
      heroBorder: '#fecaca',
      heroText: '#991b1b'
    },
  };
  const tone = toneColors[options.accentTone || 'neutral'] || toneColors.neutral;

  const rowsHtml = Object.entries(details || {})
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(
      ([key, value], idx, arr) => `
      <tr>
        <td style="padding: 10px 0; ${idx < arr.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''} color: #64748b; width: 42%; text-align: left; font-size: 13px; vertical-align: top;">${escapeHtml(key)}</td>
        <td style="padding: 10px 0; ${idx < arr.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''} color: #0f172a; text-align: right; font-weight: 600; font-size: 13px; vertical-align: top;">${escapeHtml(String(value))}</td>
      </tr>`
    )
    .join('');

  const safeHref = appUrl && appUrl.startsWith('http') ? appUrl : '#';
  const showButton = Boolean(options.ctaLabel && safeHref !== '#');
  const logoSrc = safeHref !== '#' ? `${safeHref.replace(/\/$/, '')}/assets/tut-authority-logo.jpg` : '';

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 28px 14px; color: #0f172a; margin: 0;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid ${tone.border}; border-radius: 12px; overflow: hidden;">
      <!-- Clean Header -->
      <div style="padding: 20px 26px 16px 26px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="text-align: left; vertical-align: middle;">
              <table style="border-collapse: collapse;">
                <tr>
                  <td style="width: 36px; height: 36px; background-color: #0f172a; border-radius: 10px; text-align: center; vertical-align: middle; color: #fbbf24; font-weight: 800; font-size: 13px; overflow: hidden;">
                    ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="T.U.T Authority" width="36" height="36" style="display: block; width: 36px; height: 36px; object-fit: cover; border-radius: 10px;" />` : 'T'}
                  </td>
                  <td style="padding-left: 10px; vertical-align: middle;">
                    <div style="font-size: 15px; font-weight: 800; letter-spacing: 0.03em; color: #0f172a; line-height: 1.15;">T.U.T Authority</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Private Lending &amp; Ledger Desk · 0% Usury</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <span style="display: inline-block; background-color: ${tone.badgeBg}; color: ${tone.badgeText}; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; padding: 4px 10px; border-radius: 4px;">${tone.label}</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Body -->
      <div style="padding: 24px 26px;">
        <h2 style="font-size: 19px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0; line-height: 1.3;">${escapeHtml(title)}</h2>
        <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 20px 0; white-space: pre-line;">${escapeHtml(summary)}</p>

        ${
          options.heroAmount
            ? `<div style="background-color: ${tone.heroBg}; border: 1px solid ${tone.heroBorder}; border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; text-align: center;">
                ${options.heroCaption ? `<div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 4px;">${escapeHtml(options.heroCaption)}</div>` : ''}
                <div style="font-size: 24px; font-weight: 800; color: ${tone.heroText}; letter-spacing: -0.01em; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;">${escapeHtml(options.heroAmount)}</div>
              </div>`
            : ''
        }

        ${
          rowsHtml
            ? `<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px;">
                <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 4px;">Statement Breakdown</div>
                <table style="width: 100%; border-collapse: collapse;">
                  <tbody>${rowsHtml}</tbody>
                </table>
              </div>`
            : ''
        }

        ${
          options.memoNote
            ? `<div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 12.5px; color: #78350f; line-height: 1.55;">
                ${escapeHtml(options.memoNote)}
              </div>`
            : ''
        }

        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; color: #64748b; margin-top: 6px;">
          <tr>
            <td style="text-align: left;">Issued: ${escapeHtml(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }))}</td>
            <td style="text-align: right;">Ref: <strong style="color: #0f172a; font-family: monospace;">${escapeHtml(referenceId)}</strong></td>
          </tr>
        </table>

        ${
          showButton
            ? `<div style="margin-top: 22px; text-align: center;">
                <a href="${safeHref}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-weight: 600; font-size: 13px; text-decoration: none; padding: 12px 26px; border-radius: 8px;">${escapeHtml(options.ctaLabel!)}</a>
              </div>`
            : ''
        }
      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; padding: 16px 26px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.55; text-align: center;">
        ${options.automationBadge ? `<div style="font-weight: 600; color: #475569; margin-bottom: 3px;">${escapeHtml(options.automationBadge)} · T.U.T. Automated Ledger</div>` : ''}
        Sent by T.U.T. Private Lending Authority. Questions or repayment adjustments? Message an officer directly inside your member portal.
      </div>
    </div>
  </div>
  `;
};

export const ACCEPTED_MEMO_EVENTS = new Set([
  'loan_approved',
  'loan_disbursed',
  'deposit_confirmed',
  'repayment_received',
  'loan_fully_completed',
  'refund_processed',
  'subscription_confirmed',
  'transaction_confirmed'
]);

const EVENT_TYPE_DEFAULT_TX_KIND: Record<string, OfficialReceiptData['type']> = {
  loan_approved: 'loan',
  loan_disbursed: 'loan',
  deposit_confirmed: 'deposit',
  repayment_received: 'pay_due',
  loan_fully_completed: 'pay_due',
  refund_processed: 'refund',
  subscription_confirmed: 'subscription',
  transaction_confirmed: 'loan'
};

export function buildOfficialReceiptFromPayload(
  eventType: string,
  payload: NotificationPayload,
  memberProfile?: any
): OfficialReceiptData {
  const txType = (payload.tx?.type || EVENT_TYPE_DEFAULT_TX_KIND[eventType] || 'loan') as OfficialReceiptData['type'];
  return {
    id: String(payload.tx?.id || payload.tx?.memoId || `REQ-${Date.now().toString().slice(-6)}`),
    memoId: payload.tx?.memoId,
    type: txType,
    amount: Number(payload.tx?.amount ?? 0),
    userName: payload.user?.name || memberProfile?.name || 'Verified Charter Member',
    userId: payload.user?.uid || memberProfile?.uid,
    memberId: payload.user?.memberId || memberProfile?.memberId,
    method: payload.tx?.method || 'Internal Treasury Disbursal',
    accountNumber: payload.tx?.accountNumber,
    transactionId: payload.tx?.transactionId,
    reference: payload.tx?.reference,
    mobileOperator: payload.tx?.mobileOperator,
    estimatedRepaymentDate: payload.tx?.estimatedRepaymentDate,
    loanReason: payload.tx?.loanReason,
    subscriptionTier: payload.tx?.subscriptionTier || memberProfile?.subscriptionTier,
    subscriptionMonths: payload.tx?.subscriptionMonths,
    status: eventType === 'loan_fully_completed' ? 'settled' : 'confirmed',
    decidedBy: payload.tx?.decidedBy || 'Tahsin Ullah (Administrator)',
    decidedAt: payload.tx?.decidedAt || new Date().toISOString(),
    adminNotes: payload.customNotes || undefined,
    timestamp: new Date()
  };
}

/**
 * Direct visual Official Transaction Memo Voucher embedded cleanly inside the accepted email
 * (with official PDF voucher attachment sent directly alongside it).
 */
export function generateDirectMemoEmailHtml(
  receipt: OfficialReceiptData,
  acceptedHeading: string,
  acceptedMessage: string,
  appUrl: string = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const memoCode = normalizeMemoCode(receipt.id, receipt.memoId);
  const checksum = computeLedgerChecksum(receipt);
  const meta = getReceiptMeta(receipt);
  const issuedStr = formatReceiptTimestamp(receipt);
  const amountFormatted = `৳${Number(receipt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT`;

  const rows: Array<[string, string]> = [
    ['Account Holder', receipt.userName || 'Verified Charter Member'],
    ['Member ID', receipt.memberId || (receipt.userId ? `TUT-${receipt.userId.substring(0, 8).toUpperCase()}` : 'N/A')],
    ['Transaction Category', meta.categoryLabel],
    ['Execution Date', issuedStr],
    ['Payment Rail', `${receipt.method || 'Internal Treasury Disbursal'}${receipt.mobileOperator ? ` (${receipt.mobileOperator})` : ''}`]
  ];
  if (receipt.accountNumber) rows.push(['Wallet / Account No.', receipt.accountNumber]);
  if (receipt.transactionId) rows.push(['External TrxID', receipt.transactionId]);
  if (receipt.reference) rows.push(['Reference', receipt.reference]);
  if (receipt.type === 'subscription' && receipt.subscriptionTier) {
    rows.push(['Charter Tier', `${receipt.subscriptionTier.toUpperCase()}${receipt.subscriptionMonths ? ` · ${receipt.subscriptionMonths} Mo` : ''}`]);
  }
  if (receipt.type === 'loan' && receipt.estimatedRepaymentDate) {
    rows.push(['Scheduled Due Date', receipt.estimatedRepaymentDate]);
  }
  if (receipt.loanReason) rows.push(['Purpose', receipt.loanReason]);
  rows.push(['Authorized Officer', receipt.decidedBy || 'Tahsin Ullah (Administrator)']);

  const rowsHtml = rows
    .map(
      ([k, v], idx) => `
      <tr>
        <td style="padding: 9px 0; ${idx < rows.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''} color: #64748b; width: 42%; font-size: 13px; text-align: left; vertical-align: top;">${escapeHtml(k)}</td>
        <td style="padding: 9px 0; ${idx < rows.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''} color: #0f172a; font-weight: 600; font-size: 13px; text-align: right; vertical-align: top;">${escapeHtml(v)}</td>
      </tr>`
    )
    .join('');

  const safeHref = appUrl && appUrl.startsWith('http') ? appUrl : '#';

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px 12px; color: #0f172a; margin: 0;">
    <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid #059669; border-radius: 12px; overflow: hidden;">
      <!-- Request Accepted Intro Banner -->
      <div style="padding: 16px 24px; background-color: #ecfdf5; border-bottom: 1px solid #bbf7d0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle;">
              <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #065f46; text-transform: uppercase;">Request Accepted</div>
              <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(acceptedHeading)}</div>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <span style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; padding: 5px 10px; border-radius: 4px;">${escapeHtml(meta.statusLabel)}</span>
            </td>
          </tr>
        </table>
        <p style="font-size: 13.5px; line-height: 1.55; color: #1e293b; margin: 10px 0 0 0;">${escapeHtml(acceptedMessage)}</p>
      </div>

      <!-- Direct Official Memo Sheet -->
      <div style="padding: 24px;">
        <!-- Institutional Letterhead -->
        <table style="width: 100%; border-collapse: collapse; padding-bottom: 14px; border-bottom: 2px solid #0f172a;">
          <tr>
            <td style="vertical-align: middle; padding-bottom: 14px;">
              <table style="border-collapse: collapse;">
                <tr>
                  <td style="width: 36px; height: 36px; background-color: #0f172a; border-radius: 10px; text-align: center; vertical-align: middle; color: #fbbf24; font-weight: 800; font-size: 14px; overflow: hidden;">
                    ${safeHref !== '#' ? `<img src="${escapeHtml(`${safeHref.replace(/\/$/, '')}/assets/tut-authority-logo.jpg`)}" alt="T.U.T Authority" width="36" height="36" style="display: block; width: 36px; height: 36px; object-fit: cover; border-radius: 10px;" />` : 'T'}
                  </td>
                  <td style="padding-left: 10px; vertical-align: middle;">
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a; line-height: 1.15;">T.U.T Authority</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Zero-Usury Cooperative Charter · Official Ledger Voucher</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="text-align: right; vertical-align: middle; padding-bottom: 14px;">
              <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b;">Document Serial</div>
              <div style="font-size: 12px; font-weight: 800; color: #0f172a; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; margin-top: 2px;">${escapeHtml(memoCode)}</div>
            </td>
          </tr>
        </table>
        <div style="height: 2px; background-color: #D4AF37; width: 100%; margin-top: 2px; margin-bottom: 18px;"></div>

        <!-- Confirmed Settlement Row -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b;">${escapeHtml(meta.docTitle)}</div>
          <div style="font-size: 26px; font-weight: 800; color: #0f172a; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; margin: 4px 0;">${escapeHtml(amountFormatted)}</div>
          <div style="font-size: 11.5px; color: #64748b;">Issued ${escapeHtml(issuedStr)}</div>
        </div>

        <!-- Particulars Breakdown -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tbody>${rowsHtml}</tbody>
        </table>

        ${
          receipt.adminNotes
            ? `<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b; margin-bottom: 4px;">Authorized Officer Note</div>
                <div style="font-size: 12.5px; color: #334155; line-height: 1.5; white-space: pre-line;">${escapeHtml(receipt.adminNotes)}</div>
              </div>`
            : ''
        }

        <!-- Checksum & Founder Signature Block -->
        <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 8px;">
          <tr>
            <td style="padding-top: 16px; vertical-align: bottom;">
              <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #047857;">Ledger Checksum Verified</div>
              <div style="font-size: 12px; font-weight: 700; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; color: #0f172a; margin-top: 2px;">${escapeHtml(checksum)}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">0% Interest · Electronically Authenticated Record</div>
            </td>
            <td style="padding-top: 16px; text-align: right; vertical-align: bottom;">
              <div style="font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 17px; font-weight: 700; color: #0f172a;">Tahsin Ullah</div>
              <div style="border-top: 1px solid #cbd5e1; width: 140px; margin: 5px 0 4px auto;"></div>
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">Founder & Chairman · T.U.T.</div>
            </td>
          </tr>
        </table>

        <div style="margin-top: 18px; padding: 10px 14px; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 12px; color: #78350f; text-align: center;">
          An official PDF copy of this transaction memo is attached directly to this email.
        </div>

        ${
          safeHref !== '#'
            ? `<div style="margin-top: 18px; text-align: center;">
                <a href="${safeHref}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-weight: 600; font-size: 13px; text-decoration: none; padding: 11px 24px; border-radius: 8px;">Open Member Portal</a>
              </div>`
            : ''
        }
      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5;">
        System-issued cooperative financial memo. Valid for member archive and reconciliation without wet stamp.
      </div>
    </div>
  </div>
  `;
}

export type RawEmailSenderFn = (
  to: string,
  subject: string,
  body: string,
  html: string,
  recipientName: string,
  category: string,
  forceRetry?: boolean,
  meta?: { memoId?: string; eventType?: string; recipientUid?: string; attachments?: DirectMemoAttachment[] }
) => Promise<boolean | void>;

// Main Centralized Notification Service Class
export class NotificationService {
  private db: Firestore;
  private sendEmailRaw: RawEmailSenderFn;
  private addInAppNotification: (title: string, body: string, email?: string) => void;
  private adminEmail: string;
  private allUsers: any[];
  private getGmailNotificationsEnabled: () => boolean;
  private getAutomationConfig?: () => EmailAutomationConfig;

  constructor(config: {
    db: Firestore;
    sendEmailRaw: RawEmailSenderFn;
    addInAppNotification: (title: string, body: string, email?: string) => void;
    adminEmail: string;
    allUsers: any[];
    getGmailNotificationsEnabled: () => boolean;
    getAutomationConfig?: () => EmailAutomationConfig;
  }) {
    this.db = config.db;
    this.sendEmailRaw = config.sendEmailRaw;
    this.addInAppNotification = config.addInAppNotification;
    this.adminEmail = config.adminEmail.toLowerCase().trim();
    this.allUsers = config.allUsers;
    this.getGmailNotificationsEnabled = config.getGmailNotificationsEnabled;
    this.getAutomationConfig = config.getAutomationConfig;
  }

  public updateUsersContext(users: any[]) {
    this.allUsers = users;
  }

  private isCategoryAutomated(category: NotificationCategory, isAdminAlert: boolean = false): boolean {
    const cfg = this.getAutomationConfig?.();
    // Respect explicit admin pause in Firestore config
    if (cfg && cfg.masterEnabled === false) return false;
    // Only block on client localStorage flag if no Firestore automation config has explicitly enabled master
    const master = this.getGmailNotificationsEnabled();
    if (!cfg && !master) return false;

    if (category === 'Due Reminder') return cfg ? cfg.autoDueReminders !== false : true;

    // For Chief Admin operational notifications, deliver whenever master automation is active
    // unless admin explicitly disabled non-critical admin telemetry.
    if (isAdminAlert) return true;

    if (!cfg) return true;
    if (category === 'Transaction') return cfg.autoTransactionMemos !== false;
    if (category === 'Membership') return cfg.autoMembershipUpdates !== false;
    if (category === 'Security') return cfg.securityAlerts !== false;
    return true;
  }

  public async dispatchEvent(
    eventType: string,
    payload: NotificationPayload,
    options: { forceSendEmail?: boolean } = {}
  ): Promise<boolean> {
    const eventDef = EVENT_REGISTRY[eventType];
    if (!eventDef) {
      console.warn(`[NotificationService] Unregistered event type: "${eventType}".`);
      return false;
    }

    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    let deliveredAnyOrSkippedCleanly = true;

    for (const role of eventDef.recipients) {
      if (role === 'admin') {
        const ok = await this.handleAdminDispatch(eventType, eventDef, payload, appUrl, options.forceSendEmail);
        if (!ok) deliveredAnyOrSkippedCleanly = false;
      } else if (role === 'member') {
        const ok = await this.handleMemberDispatch(eventType, eventDef, payload, appUrl, options.forceSendEmail);
        if (!ok) deliveredAnyOrSkippedCleanly = false;
      }
    }

    return deliveredAnyOrSkippedCleanly;
  }

  private async handleAdminDispatch(
    eventType: string,
    eventDef: EventDefinition,
    payload: NotificationPayload,
    appUrl: string,
    forceSendEmail?: boolean
  ): Promise<boolean> {
    if (!eventDef.generateAdminContent) return true;

    const content = eventDef.generateAdminContent(payload);
    const adminEmail = this.adminEmail;

    // 1. In-app notification
    this.addInAppNotification(content.title, content.summary, adminEmail);

    // 2. Check Master + Rule toggle for Chief Admin delivery
    const ruleAllowed = this.isCategoryAutomated(eventDef.category, true);
    if (ruleAllowed || forceSendEmail) {
      let adminAttachments: DirectMemoAttachment[] | undefined;
      if (ACCEPTED_MEMO_EVENTS.has(eventType) && this.getAutomationConfig?.()?.copyAdminOnMemberMails !== false) {
        const matchedMember = this.allUsers.find((u) =>
          (payload.user?.uid && u.uid === payload.user.uid) ||
          (payload.user?.email && u.email?.toLowerCase().trim() === payload.user.email.toLowerCase().trim())
        );
        const receiptData = buildOfficialReceiptFromPayload(eventType, payload, matchedMember);
        const builtFiles = generateDirectMemoAttachments(receiptData);
        if (builtFiles.length > 0) {
          adminAttachments = builtFiles;
        }
      }

      const htmlEmail = generateBrandedEmailHtml(
        content.title,
        content.summary,
        content.details,
        content.referenceId,
        appUrl,
        {
          accentTone: content.accentTone,
          ctaLabel: content.ctaLabel,
          heroAmount: content.heroAmount,
          heroCaption: content.heroCaption,
          automationBadge: content.automationBadge || `Automated ${eventDef.category} Alert`,
          memoNote: content.memoNote
        }
      );

      try {
        const res = await this.sendEmailRaw(
          adminEmail,
          content.subject || `[Admin] ${content.title}`,
          content.summary,
          htmlEmail,
          'Admin Desk',
          eventDef.category,
          Boolean(forceSendEmail),
          {
            memoId: payload.tx?.memoId,
            eventType,
            recipientUid: 'admin',
            ...(adminAttachments ? { attachments: adminAttachments } : {})
          }
        );
        return res !== false;
      } catch (err) {
        console.warn(`[NotificationService] Admin email skipped:`, err);
        return false;
      }
    }
    return true;
  }

  private async handleMemberDispatch(
    eventType: string,
    eventDef: EventDefinition,
    payload: NotificationPayload,
    appUrl: string,
    forceSendEmail?: boolean
  ): Promise<boolean> {
    if (!eventDef.generateMemberContent) return true;

    const content = eventDef.generateMemberContent(payload);

    // Resolve member email cleanly (never treat N/A or a phone number as email)
    let memberEmail = payload.user?.email;
    if ((!memberEmail || !memberEmail.includes('@')) && payload.user?.uid) {
      const matched = this.allUsers.find((u) => u.uid === payload.user?.uid);
      if (matched?.email) memberEmail = matched.email;
    }

    if (!memberEmail || !memberEmail.includes('@')) {
      return true;
    }

    const cleanEmail = memberEmail.toLowerCase().trim();

    // 1. In-app notification
    this.addInAppNotification(content.title, content.summary, cleanEmail);

    // 2. Check Member preference + Admin automation rules
    const memberProfile = this.allUsers.find((u) => u.email?.toLowerCase().trim() === cleanEmail);
    const memberEmailEnabled = memberProfile ? (memberProfile.emailNotificationsEnabled !== false) : true;
    const ruleAllowed = this.isCategoryAutomated(eventDef.category, false);
    const copyAdmin = this.getAutomationConfig?.()?.copyAdminOnMemberMails !== false;
    const isAdminOnlyEventMissing = !eventDef.recipients.includes('admin');
    const shouldSendMember = (memberEmailEnabled && ruleAllowed) || Boolean(forceSendEmail);
    const shouldCopyAdmin =
      copyAdmin &&
      isAdminOnlyEventMissing &&
      cleanEmail !== this.adminEmail &&
      (this.isCategoryAutomated(eventDef.category, true) || Boolean(forceSendEmail));

    if (shouldSendMember || shouldCopyAdmin) {
      let htmlEmail: string;
      let subjectToSend = content.subject || `T.U.T. — ${content.title}`;
      let attachments: DirectMemoAttachment[] | undefined;

      if (ACCEPTED_MEMO_EVENTS.has(eventType)) {
        const receiptData = buildOfficialReceiptFromPayload(eventType, payload, memberProfile);
        const memoCode = normalizeMemoCode(receiptData.id, receiptData.memoId);
        htmlEmail = generateDirectMemoEmailHtml(
          receiptData,
          content.title,
          content.summary,
          appUrl
        );
        subjectToSend = `T.U.T. — Request Accepted · Official Memo (${memoCode})`;
        const builtFiles = generateDirectMemoAttachments(receiptData);
        if (builtFiles.length > 0) {
          attachments = builtFiles;
        }
      } else {
        htmlEmail = generateBrandedEmailHtml(
          content.title,
          content.summary,
          content.details,
          content.referenceId,
          appUrl,
          {
            accentTone: content.accentTone,
            ctaLabel: content.ctaLabel,
            heroAmount: content.heroAmount,
            heroCaption: content.heroCaption,
            automationBadge: content.automationBadge || `Automated ${eventDef.category} Notice`,
            memoNote: content.memoNote
          }
        );
      }

      let memberOk = true;
      if (shouldSendMember) {
        try {
          const res = await this.sendEmailRaw(
            cleanEmail,
            subjectToSend,
            content.summary,
            htmlEmail,
            payload.user?.name || memberProfile?.name || 'Valued Member',
            eventDef.category,
            Boolean(forceSendEmail),
            {
              memoId: payload.tx?.memoId,
              eventType,
              recipientUid: payload.user?.uid || memberProfile?.uid,
              ...(attachments ? { attachments } : {})
            }
          );
          memberOk = res !== false;
        } catch (err) {
          console.warn(`[NotificationService] Member email skipped (${cleanEmail}):`, err);
          memberOk = false;
        }
      }

      // Copy Chief Admin on member-only workflow events (e.g. P2P transfer, wallet added, profile updated, password alerts)
      if (shouldCopyAdmin) {
        const copySubject = `[Admin Copy] ${subjectToSend.replace(/^T\.U\.T\.\s*[—:-]\s*/i, '')} — ${payload.user?.name || memberProfile?.name || cleanEmail}`;
        const adminCopyHtml = generateBrandedEmailHtml(
          `Admin Copy: ${content.title}`,
          `Chief Admin telemetry copy for ${payload.user?.name || memberProfile?.name || 'Member'} (${cleanEmail}). ${content.summary}`,
          {
            'Member': payload.user?.name || memberProfile?.name || 'Member',
            'Member Email': cleanEmail,
            ...content.details
          },
          content.referenceId,
          appUrl,
          {
            accentTone: content.accentTone,
            heroAmount: content.heroAmount,
            heroCaption: content.heroCaption,
            automationBadge: 'Chief Admin Copy'
          }
        );
        this.sendEmailRaw(
          this.adminEmail,
          copySubject,
          `[Admin Copy for ${cleanEmail}] ${content.summary}`,
          adminCopyHtml,
          'Admin Desk (Copy)',
          eventDef.category,
          Boolean(forceSendEmail),
          {
            memoId: payload.tx?.memoId,
            eventType: `${eventType}_admin_copy`,
            recipientUid: 'admin',
            ...(attachments ? { attachments } : {})
          }
        ).catch(() => {});
      }

      return memberOk;
    }
    return true;
  }
}
