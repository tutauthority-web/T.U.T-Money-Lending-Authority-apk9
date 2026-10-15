import { addDoc, collection, Firestore } from 'firebase/firestore';

export type NotificationCategory = 'Membership' | 'Transaction' | 'Security' | 'System' | 'Report';

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
    subscriptionTier?: string;
    estimatedRepaymentDate?: string;
    loanReason?: string;
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

export interface EventDefinition {
  category: NotificationCategory;
  recipients: ('admin' | 'member')[];
  generateAdminContent?: (payload: NotificationPayload) => {
    title: string;
    summary: string;
    details: Record<string, string>;
    referenceId: string;
  };
  generateMemberContent?: (payload: NotificationPayload) => {
    title: string;
    summary: string;
    details: Record<string, string>;
    referenceId: string;
  };
}

// Global Event Registry - easy to extend in the future!
export const EVENT_REGISTRY: Record<string, EventDefinition> = {
  // ADMINISTRATOR & MEMBER CO-EXISTING EVENTS
  membership_request: {
    category: 'Membership',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'New Membership Application',
      summary: 'A new user has submitted their membership credentials and is waiting for your verification on the operations desk.',
      details: {
        'Applicant Name': p.user?.name || 'Unknown',
        'Email Address': p.user?.email || 'N/A',
        'Contact Phone': p.user?.phone || 'N/A',
        'NID Number': p.user?.nid || 'N/A',
        'Verification Status': 'Awaiting Admin Review',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'NEW-REG',
    }),
    generateMemberContent: (p) => ({
      title: 'Membership Request Logged',
      summary: 'Your official membership registration has been received and is currently under administrative assessment.',
      details: {
        'Applicant Name': p.user?.name || 'Valued Member',
        'Registered Email': p.user?.email || 'N/A',
        'Current Stage': 'Identity & Address Verification',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'REG-PENDING',
    }),
  },

  membership_approved: {
    category: 'Membership',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Membership Approved successfully',
      summary: `You have successfully approved and assigned a verified member profile to ${p.user?.name || 'the applicant'}.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Assigned Member ID': p.user?.memberId || 'N/A',
        'Action Decided By': 'Management Desk',
      },
      referenceId: p.user?.memberId || 'MBR-APR',
    }),
    generateMemberContent: (p) => ({
      title: 'Membership Approved & Activated',
      summary: 'Welcome to the T.U.T. Private Lending Syndicate! Your application has been approved and activated.',
      details: {
        'Member Name': p.user?.name || 'Valued Member',
        'Your Member ID': p.user?.memberId || 'N/A',
        'Borrowing Credit Limit': `৳${(p.user?.borrowingLimit || 100000).toLocaleString()} BDT`,
        'Account Status': 'Active & Verified',
      },
      referenceId: p.user?.memberId || 'WELCOME-TUT',
    }),
  },

  membership_rejected: {
    category: 'Membership',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Membership Request Rejected',
      summary: `You have declined the membership request for ${p.user?.name || 'the applicant'}.`,
      details: {
        'Applicant Name': p.user?.name || 'Unknown',
        'Rejection Notes': p.customNotes || 'Does not meet underwriting requirements.',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'MBR-REJ',
    }),
    generateMemberContent: (p) => ({
      title: 'Membership Application Status Update',
      summary: 'We regret to inform you that your T.U.T. lending application does not meet our underwriting guidelines at this time.',
      details: {
        'Rejection Notes': p.customNotes || 'Verification credentials incomplete.',
        'Next Steps': 'Please contact the support desk for details.',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'REQ-REJ',
    }),
  },

  membership_more_info: {
    category: 'Membership',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Information Audit Requested',
      summary: `You requested additional information from ${p.user?.name || 'the member'}.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Audit Message': p.customNotes || 'Please upload updated NID.',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'AUD-REQ',
    }),
    generateMemberContent: (p) => ({
      title: 'Action Required: Verify Credentials',
      summary: 'The administrative underwriters require additional information to complete your account review.',
      details: {
        'Message from Admin': p.customNotes || 'Please verify physical address.',
        'Urgency': 'High - Account is temporarily on hold',
      },
      referenceId: p.user?.uid?.substring(0, 8).toUpperCase() || 'ACTION-REQD',
    }),
  },

  new_loan_request: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'New Loan Request Awaiting Funding',
      summary: `A loan request of ৳${(p.tx?.amount || 0).toLocaleString()} BDT has been created and requires review.`,
      details: {
        'Borrower': p.user?.name || 'Unknown Member',
        'Requested Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Payout Channel': p.tx?.method || 'N/A',
        'Purpose of Loan': p.tx?.loanReason || 'N/A',
        'Est. Repayment Date': p.tx?.estimatedRepaymentDate || 'N/A',
      },
      referenceId: p.tx?.id || 'LOAN-NEW',
    }),
    generateMemberContent: (p) => ({
      title: 'Loan Request Logged successfully',
      summary: `Your request for a micro-loan of ৳${(p.tx?.amount || 0).toLocaleString()} BDT is pending admin review.`,
      details: {
        'Requested Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Payout Channel': p.tx?.method || 'N/A',
        'Est. Repayment Date': p.tx?.estimatedRepaymentDate || 'N/A',
        'Current Status': 'In Review Queue',
      },
      referenceId: p.tx?.id || 'LOAN-PENDING',
    }),
  },

  loan_approved: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Loan Request Approved & Confirmed',
      summary: `You have successfully approved the loan of ৳${(p.tx?.amount || 0).toLocaleString()} BDT for ${p.user?.name || 'member'}.`,
      details: {
        'Borrower Name': p.user?.name || 'Unknown',
        'Approved Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Memo Reference': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.id || 'LOAN-APR',
    }),
    generateMemberContent: (p) => ({
      title: 'Micro-Loan Approved & Authorized',
      summary: `Congratulations! Your micro-loan of ৳${(p.tx?.amount || 0).toLocaleString()} BDT has been approved.`,
      details: {
        'Authorized Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Disbursed To': p.tx?.method || 'N/A',
        'Memo Reference ID': p.tx?.memoId || 'N/A',
        'Repayment Term': p.tx?.estimatedRepaymentDate || 'Immediate Compliance',
      },
      referenceId: p.tx?.id || 'LOAN-VERIFIED',
    }),
  },

  loan_rejected: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Loan Request Declined',
      summary: `You have declined the loan request of ৳${(p.tx?.amount || 0).toLocaleString()} BDT for ${p.user?.name || 'member'}.`,
      details: {
        'Borrower': p.user?.name || 'Unknown',
        'Requested Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Decline Reason': p.customNotes || 'Incomplete credit profile.',
      },
      referenceId: p.tx?.id || 'LOAN-REJ',
    }),
    generateMemberContent: (p) => ({
      title: 'Loan Application Status Update',
      summary: `We regret to inform you that your loan request of ৳${(p.tx?.amount || 0).toLocaleString()} BDT has been declined.`,
      details: {
        'Decline Reason': p.customNotes || 'Does not meet credit requirements.',
        'Alternative Solutions': 'Maintain active subscription or pay existing dues.',
      },
      referenceId: p.tx?.id || 'LOAN-DEC',
    }),
  },

  loan_disbursed: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Loan Capital Disbursed',
      summary: `Capital amount of ৳${(p.tx?.amount || 0).toLocaleString()} BDT has been dispatched to ${p.user?.name || 'member'}.`,
      details: {
        'Disbursed To': p.user?.name || 'Unknown',
        'Disbursed Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Payout Channel': p.tx?.method || 'N/A',
        'Memo Reference': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.id || 'LOAN-DISB',
    }),
    generateMemberContent: (p) => ({
      title: 'Loan Funds Disbursed Successfully',
      summary: `The funds for your loan of ৳${(p.tx?.amount || 0).toLocaleString()} BDT have been sent.`,
      details: {
        'Disbursed Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Payout Channel': p.tx?.method || 'N/A',
        'Memo Reference ID': p.tx?.memoId || 'N/A',
        'Funds Status': 'Sent (Check wallet/bank balance)',
      },
      referenceId: p.tx?.id || 'DISB-CONFIRMED',
    }),
  },

  loan_cancelled: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Loan Request Cancelled by Member',
      summary: `${p.user?.name || 'A member'} has cancelled their pending loan request before processing.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Cancelled Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Status': 'Request Deleted',
      },
      referenceId: p.tx?.id || 'LOAN-CAN',
    }),
    generateMemberContent: (p) => ({
      title: 'Your Loan Request Has Been Cancelled',
      summary: `You have successfully cancelled your pending loan request of ৳${(p.tx?.amount || 0).toLocaleString()} BDT.`,
      details: {
        'Cancelled Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Status': 'Successfully Cancelled',
      },
      referenceId: p.tx?.id || 'LOAN-CANCELLED',
    }),
  },

  deposit_request: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'New Deposit Receipt Awaiting Verification',
      summary: `${p.user?.name || 'A member'} has submitted a deposit request of ৳${(p.tx?.amount || 0).toLocaleString()} BDT.`,
      details: {
        'Sender Name': p.user?.name || 'Unknown',
        'Deposit Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Payment Channel': p.tx?.method || 'N/A',
        'TXID / Ref': p.tx?.transactionId || 'N/A',
        'Sender Mobile': p.tx?.accountNumber || 'N/A',
      },
      referenceId: p.tx?.id || 'DEP-REQ',
    }),
    generateMemberContent: (p) => ({
      title: 'Deposit Payment Receipt Received',
      summary: `Your deposit request of ৳${(p.tx?.amount || 0).toLocaleString()} BDT is logged and pending admin confirmation.`,
      details: {
        'Deposit Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'TXID / Reference': p.tx?.transactionId || 'N/A',
        'Sender Mobile': p.tx?.accountNumber || 'N/A',
        'Status': 'Awaiting Treasury Check',
      },
      referenceId: p.tx?.id || 'DEP-PENDING',
    }),
  },

  repayment_request: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'New Debt Repayment Logged',
      summary: `${p.user?.name || 'A member'} has logged a repayment of ৳${(p.tx?.amount || 0).toLocaleString()} BDT.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Repayment Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Channel / Method': p.tx?.method || 'N/A',
        'TXID / Ref': p.tx?.transactionId || 'N/A',
      },
      referenceId: p.tx?.id || 'REP-REQ',
    }),
    generateMemberContent: (p) => ({
      title: 'Repayment Logged & Pending Check',
      summary: `Your repayment of ৳${(p.tx?.amount || 0).toLocaleString()} BDT is logged and awaiting administrative verification.`,
      details: {
        'Repaid Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'TXID / Reference': p.tx?.transactionId || 'N/A',
        'Status': 'Awaiting Verification',
      },
      referenceId: p.tx?.id || 'REP-PENDING',
    }),
  },

  repayment_received: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Repayment Finalized & Credited',
      summary: `You confirmed the repayment of ৳${(p.tx?.amount || 0).toLocaleString()} BDT for ${p.user?.name || 'member'}.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Amount Received': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Memo Reference': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.id || 'REP-REC',
    }),
    generateMemberContent: (p) => ({
      title: 'Repayment Received & Confirmed',
      summary: `Thank you! Your debt repayment of ৳${(p.tx?.amount || 0).toLocaleString()} BDT has been fully verified and credited.`,
      details: {
        'Repaid Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Memo Reference ID': p.tx?.memoId || 'N/A',
        'Remaining Balance Due': `৳${(p.user?.remainingDebt || 0).toLocaleString()} BDT`,
      },
      referenceId: p.tx?.id || 'REP-SUCCESS',
    }),
  },

  loan_fully_completed: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Outstanding Loan Fully Cleared',
      summary: `The borrower ${p.user?.name || 'member'} has fully cleared all remaining debt and closed their loan file.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Final Remaining Debt': '৳0 BDT (Completely Cleared)',
        'Rating Adjustment': 'Upgraded Credit Tier',
      },
      referenceId: p.user?.memberId || 'LOAN-CLEAR-ADMIN',
    }),
    generateMemberContent: (p) => ({
      title: 'Congratulations! Loan Fully Cleared',
      summary: 'You have completely paid off your outstanding micro-loan and settled your active debt ledger balance.',
      details: {
        'Member Name': p.user?.name || 'Valued Member',
        'Remaining Debt': '৳0 BDT (Completely Cleared)',
        'Credit Limit Bonus': 'Eligible for limit expansion',
      },
      referenceId: p.user?.memberId || 'LOAN-CLEARED',
    }),
  },

  // SECURITY & SYSTEM ADMIN-ONLY / MEMBER-ONLY EVENTS
  wallet_update_request: {
    category: 'Security',
    recipients: ['admin'],
    generateAdminContent: (p) => ({
      title: 'Wallet Verification Pending',
      summary: `${p.user?.name || 'A member'} has linked a new mobile digital wallet that requires verification.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Wallet Provider': p.wallet?.provider || 'N/A',
        'Wallet Holder': p.wallet?.holderName || 'N/A',
        'Wallet Number': p.wallet?.mobileNumber || 'N/A',
      },
      referenceId: 'WLT-UPD',
    }),
  },

  wallet_added: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Digital Wallet Linked to Profile',
      summary: 'A new bKash/Nagad digital wallet has been successfully linked to your secure account profile.',
      details: {
        'Wallet Provider': p.wallet?.provider || 'N/A',
        'Wallet Number': p.wallet?.mobileNumber || 'N/A',
        'Holder Registered': p.wallet?.holderName || 'N/A',
        'Status': 'Awaiting Admin Verification',
      },
      referenceId: 'WLT-ADD',
    }),
  },

  wallet_verified: {
    category: 'Security',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Digital Wallet Approved',
      summary: `You have successfully approved and verified the linked wallet number for ${p.user?.name || 'member'}.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Wallet Number': p.wallet?.mobileNumber || 'N/A',
        'Provider': p.wallet?.provider || 'N/A',
      },
      referenceId: 'WLT-APR-ADMIN',
    }),
    generateMemberContent: (p) => ({
      title: 'Digital Wallet Verified successfully',
      summary: 'Your linked digital wallet has been reviewed and verified by our underwriting team.',
      details: {
        'Wallet Provider': p.wallet?.provider || 'N/A',
        'Wallet Number': p.wallet?.mobileNumber || 'N/A',
        'Verification Status': 'Approved & Verified',
      },
      referenceId: 'WLT-VERIFIED',
    }),
  },

  profile_verification_request: {
    category: 'Membership',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Profile Verification Request',
      summary: `${p.user?.name || 'A member'} has uploaded physical documents and requested verification.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'NID Number': p.user?.nid || 'N/A',
        'Current Address': p.user?.address || 'N/A',
      },
      referenceId: 'PRF-VER',
    }),
    generateMemberContent: (p) => ({
      title: 'Profile Audit Request Registered',
      summary: 'Your request for full physical verification and profile audit has been registered.',
      details: {
        'Audit Priority': 'Standard',
        'Timeline': 'Usually verified in 24 hours',
      },
      referenceId: 'AUD-PENDING',
    }),
  },

  profile_updated: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Account Profile Updated Successfully',
      summary: 'Your secure account profile details and communications parameters have been successfully updated.',
      details: {
        'Modified Fields': p.customNotes || 'General profile information',
        'Email Statements': p.user?.emailNotificationsEnabled ? 'Active' : 'Disabled',
      },
      referenceId: 'PRF-UPDATED',
    }),
  },

  new_member_registration: {
    category: 'Membership',
    recipients: ['admin'],
    generateAdminContent: (p) => ({
      title: 'New Member Registered on System',
      summary: `A new citizen account has been successfully created under the email: ${p.user?.email}.`,
      details: {
        'Citizen Name': p.user?.name || 'Unknown',
        'Email Address': p.user?.email || 'N/A',
        'Registration Date': new Date().toLocaleString(),
      },
      referenceId: 'SYS-REG',
    }),
  },

  account_created: {
    category: 'Membership',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Welcome to T.U.T Money Lending Authority',
      summary: 'Your citizen account has been successfully registered on our secure portal.',
      details: {
        'Registered Email': p.user?.email || 'N/A',
        'Security Status': 'Initial Profile Pending Approval',
      },
      referenceId: 'TUT-WELCOME',
    }),
  },

  failed_transaction_alert: {
    category: 'System',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'FAILED TRANSACTION ALERT',
      summary: 'A secure financial transaction validation failed on the ledger desk.',
      details: {
        'Target Member': p.user?.name || 'Unknown',
        'Tx Type': p.tx?.type || 'N/A',
        'Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Error Details': p.errorDetails || 'Verification payload check failed.',
      },
      referenceId: 'FAIL-TX-ALRT',
    }),
    generateMemberContent: (p) => ({
      title: 'Transaction Error Notification',
      summary: `Your requested transaction of ৳${(p.tx?.amount || 0).toLocaleString()} BDT has failed secure checks.`,
      details: {
        'Transaction Type': p.tx?.type || 'N/A',
        'Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Error Code / Reason': p.errorDetails || 'Payment verification mismatch.',
      },
      referenceId: 'TX-ERR',
    }),
  },

  system_warning: {
    category: 'System',
    recipients: ['admin'],
    generateAdminContent: (p) => ({
      title: 'CRITICAL SYSTEM WARNING',
      summary: 'An automated security or system event has triggered a warning on the controller desk.',
      details: {
        'Warning Type': p.customNotes || 'General Alert',
        'Severity Level': p.severity?.toUpperCase() || 'WARNING',
        'Alert Context': p.errorDetails || 'N/A',
      },
      referenceId: 'SYS-WARN',
    }),
  },

  password_changed: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Security Alert: Credentials Updated',
      summary: 'The access password or credential set for your T.U.T. account was successfully changed.',
      details: {
        'Action': 'Password Changed',
        'Source Time': new Date().toLocaleString(),
        'Security Advice': 'If you did not initiate this, secure your account instantly.',
      },
      referenceId: 'SEC-PWD',
    }),
  },

  new_device_login: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Security Alert: New Device Login',
      summary: 'We detected a successful login to your T.U.T. dashboard from a new browser session.',
      details: {
        'Auth Time': new Date().toLocaleString(),
        'Status': 'Authorized Login',
      },
      referenceId: 'SEC-AUTH',
    }),
  },

  account_security_alert: {
    category: 'Security',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'SECURE PORTAL AUDIT ALERT',
      summary: `A security incident or access threshold bypass was detected for ${p.user?.name || 'member'}.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Alert Type': p.customNotes || 'Multiple failed PIN attempts',
        'Severity': p.severity?.toUpperCase() || 'CRITICAL',
      },
      referenceId: 'SEC-AUDIT',
    }),
    generateMemberContent: (p) => ({
      title: 'CRITICAL SECURITY COMPLIANCE ALERT',
      summary: 'A critical compliance alert has been triggered on your secure lending account.',
      details: {
        'Alert Type': p.customNotes || 'Account login mismatch.',
        'Recommended Action': 'Update your security PIN immediately.',
      },
      referenceId: 'SEC-ALERT',
    }),
  },

  email_verification_completed: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Secure Email verification Completed',
      summary: 'Your primary email address has been successfully verified with our secure ledger nodes.',
      details: {
        'Verified Email': p.user?.email || 'N/A',
        'Status': 'Fully Verified',
      },
      referenceId: 'SEC-VERIFIED',
    }),
  },

  daily_summary_report: {
    category: 'Report',
    recipients: ['admin'],
    generateAdminContent: (p) => ({
      title: 'Daily Financial Summary Report',
      summary: 'The automated T.U.T. ledger daily balance sheet and performance reports are compiled.',
      details: {
        'Report Date': new Date().toLocaleDateString(),
        'Active Members': String(p.reportData?.activeMembers ?? 0),
        'Total Reserve Funds': `৳${(p.reportData?.reserveFunds ?? 0).toLocaleString()} BDT`,
        'Active Disbursed Loans': `৳${(p.reportData?.disbursedLoans ?? 0).toLocaleString()} BDT`,
        'Outstanding Debt Balance': `৳${(p.reportData?.outstandingDebt ?? 0).toLocaleString()} BDT`,
      },
      referenceId: 'RPT-DAILY',
    }),
  },

  weekly_summary_report: {
    category: 'Report',
    recipients: ['admin'],
    generateAdminContent: (p) => ({
      title: 'Weekly Authority Operations Ledger',
      summary: 'The 7-day master ledger sheet containing reserve adjustments and interest ratios is compiled.',
      details: {
        'Report Period': 'Past 7 Days (Sunday - Saturday)',
        'Active Members': String(p.reportData?.activeMembers ?? 0),
        'Reserve Liquid Pool': `৳${(p.reportData?.reserveFunds ?? 0).toLocaleString()} BDT`,
        'Total Outstandings': `৳${(p.reportData?.outstandingDebt ?? 0).toLocaleString()} BDT`,
      },
      referenceId: 'RPT-WEEKLY',
    }),
  },

  deposit_confirmed: {
    category: 'Transaction',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Deposit Payment Confirmed & Credited',
      summary: `You have confirmed and credited the deposit of ৳${(p.tx?.amount || 0).toLocaleString()} BDT for ${p.user?.name || 'member'}.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Deposit Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Payment Channel': p.tx?.method || 'N/A',
        'Memo Reference': p.tx?.memoId || 'N/A',
      },
      referenceId: p.tx?.id || 'DEP-CONF',
    }),
    generateMemberContent: (p) => ({
      title: 'Deposit Received & Credited',
      summary: `Your deposit of ৳${(p.tx?.amount || 0).toLocaleString()} BDT has been verified and credited to your T.U.T. reserve account.`,
      details: {
        'Deposit Amount': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Payment Channel': p.tx?.method || 'N/A',
        'Memo Reference': p.tx?.memoId || 'N/A',
        'Account Status': 'Verified & Credited',
      },
      referenceId: p.tx?.id || 'DEP-SUCCESS',
    }),
  },

  password_reset: {
    category: 'Security',
    recipients: ['member'],
    generateMemberContent: (p) => ({
      title: 'Password Reset Initiated / Updated',
      summary: 'A password reset or credential update request was completed for your T.U.T. account.',
      details: {
        'Account Email': p.user?.email || 'N/A',
        'Action Time': new Date().toLocaleString(),
        'Security Advice': 'If you did not request this reset, please contact support immediately.',
      },
      referenceId: 'PWD-RESET',
    }),
  },

  credit_limit_adjusted: {
    category: 'System',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Credit Limit Adjusted',
      summary: `You have updated ${p.user?.name || 'the member'}'s approved borrowing limit to ৳${(p.tx?.amount || 0).toLocaleString()} BDT.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'New Borrowing Limit': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Action Status': 'Ledger Updated',
      },
      referenceId: 'LIM-UPD-ADMIN',
    }),
    generateMemberContent: (p) => ({
      title: 'Credit Limit Adjusted Successfully',
      summary: `Your approved borrowing credit limit has been adjusted to ৳${(p.tx?.amount || 0).toLocaleString()} BDT by the T.U.T. Authority.`,
      details: {
        'New Approved Limit': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Lending Allocation': 'Instantly Available',
      },
      referenceId: 'LIM-UPDATED',
    }),
  },

  debt_warning: {
    category: 'System',
    recipients: ['admin', 'member'],
    generateAdminContent: (p) => ({
      title: 'Debt Warning Dispatched',
      summary: `You have sent an outstanding debt warning to ${p.user?.name || 'member'} for ৳${(p.tx?.amount || 0).toLocaleString()} BDT.`,
      details: {
        'Member Name': p.user?.name || 'Unknown',
        'Reported Outstanding Debt': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
      },
      referenceId: 'DBT-WARN-ADMIN',
    }),
    generateMemberContent: (p) => ({
      title: 'Urgent: Outstanding Debt Notice',
      summary: `Our private lending ledgers register an active outstanding borrowing of ৳${(p.tx?.amount || 0).toLocaleString()} BDT under your national profile.`,
      details: {
        'Outstanding Debt': `৳${(p.tx?.amount || 0).toLocaleString()} BDT`,
        'Compliance Status': 'Overdue or Immediate Attention Needed',
      },
      referenceId: 'DBT-WARNING',
    }),
  },
};

// Branded Beautiful Card HTML template generator
export const generateBrandedEmailHtml = (
  title: string,
  summary: string,
  details: Record<string, string>,
  referenceId: string,
  appUrl: string = 'https://ai.studio/build'
): string => {
  const rowsHtml = Object.entries(details)
    .map(
      ([key, value]) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 0; font-weight: bold; color: #64748b; width: 45%; text-align: left; font-size: 13px;">${key}</td>
        <td style="padding: 12px 0; color: #0f172a; text-align: right; font-weight: 600; font-size: 13px;">${value}</td>
      </tr>
    `
    )
    .join('');

  return `
  <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 40px 20px; text-align: center; color: #1e293b; margin: 0; min-height: 100%;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); text-align: left;">
      <!-- Logo Banner -->
      <div style="background-color: #0f172a; padding: 24px; text-align: center; border-bottom: 3px solid #2563eb;">
        <div style="display: inline-block; background-color: #1e293b; padding: 8px 20px; border-radius: 8px; border: 1px solid #3b82f6;">
          <span style="font-size: 20px; font-weight: 900; letter-spacing: 2px; color: #ffffff;">T.U.T</span>
        </div>
        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; tracking: 2px; margin-top: 8px; font-family: monospace;">Private Lending Authority</div>
      </div>
      
      <!-- Content Body -->
      <div style="padding: 32px 24px;">
        <!-- Title -->
        <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
          ${title}
        </h2>
        
        <!-- Short Summary -->
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
          ${summary}
        </p>
        
        <!-- Key-Value Details Card -->
        <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h4 style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin: 0 0 12px 0; letter-spacing: 1px; font-family: monospace;">Details Dashboard</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
        
        <!-- Date & Reference Section -->
        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; margin-bottom: 28px; font-size: 11px; color: #94a3b8; font-family: monospace; display: block; overflow: hidden;">
          <div style="float: left;"><strong>Date:</strong> ${new Date().toLocaleString()}</div>
          <div style="float: right;"><strong>REF ID:</strong> <span style="background-color: #f1f5f9; color: #334155; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${referenceId}</span></div>
        </div>
        
        <!-- View in App Button -->
        <div style="text-align: center; margin-top: 20px; clear: both;">
          <a href="${appUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: bold; font-size: 13px; text-decoration: none; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.15);">
            View on Operations Desk
          </a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
        This is a secure automated notification from T.U.T. Private Lending Syndicate.<br/>
        Please do not reply directly to this mail.
      </div>
    </div>
  </div>
  `;
};

// Main Centralized Notification Service Class
export class NotificationService {
  private db: Firestore;
  private sendEmailRaw: (to: string, subject: string, body: string, html: string, recipientName: string, category: string) => Promise<void>;
  private addInAppNotification: (title: string, body: string, email?: string) => void;
  private adminEmail: string;
  private allUsers: any[];
  private getGmailNotificationsEnabled: () => boolean;

  constructor(config: {
    db: Firestore;
    sendEmailRaw: (to: string, subject: string, body: string, html: string, recipientName: string, category: string) => Promise<void>;
    addInAppNotification: (title: string, body: string, email?: string) => void;
    adminEmail: string;
    allUsers: any[];
    getGmailNotificationsEnabled: () => boolean;
  }) {
    this.db = config.db;
    this.sendEmailRaw = config.sendEmailRaw;
    this.addInAppNotification = config.addInAppNotification;
    this.adminEmail = config.adminEmail.toLowerCase().trim();
    this.allUsers = config.allUsers;
    this.getGmailNotificationsEnabled = config.getGmailNotificationsEnabled;
  }

  // Update dynamic context like user lists
  public updateUsersContext(users: any[]) {
    this.allUsers = users;
  }

  // Public system event dispatch interface
  public async dispatchEvent(
    eventType: string,
    payload: NotificationPayload,
    options: { forceSendEmail?: boolean } = {}
  ): Promise<boolean> {
    console.log(`[NotificationService] Processing Event: ${eventType}`, payload);

    const eventDef = EVENT_REGISTRY[eventType];
    if (!eventDef) {
      console.warn(`[NotificationService] Event Type "${eventType}" is not registered in the system.`);
      return false;
    }

    const appUrl = window.location.origin;

    // Dispatch independently for each recipient role
    for (const role of eventDef.recipients) {
      if (role === 'admin') {
        await this.handleAdminDispatch(eventType, eventDef, payload, appUrl, options.forceSendEmail);
      } else if (role === 'member') {
        await this.handleMemberDispatch(eventType, eventDef, payload, appUrl, options.forceSendEmail);
      }
    }

    return true;
  }

  private async handleAdminDispatch(
    eventType: string,
    eventDef: EventDefinition,
    payload: NotificationPayload,
    appUrl: string,
    forceSendEmail?: boolean
  ) {
    if (!eventDef.generateAdminContent) return;

    const content = eventDef.generateAdminContent(payload);
    const adminEmail = this.adminEmail;

    // 1. Generate in-app notification for Admin
    this.addInAppNotification(content.title, content.summary, adminEmail);

    // 2. Check independent Admin setting
    const adminEmailEnabled = this.getGmailNotificationsEnabled();
    if (adminEmailEnabled || forceSendEmail) {
      const htmlEmail = generateBrandedEmailHtml(
        content.title,
        content.summary,
        content.details,
        content.referenceId,
        appUrl
      );

      console.log(`[NotificationService] Delivering email to Admin: ${adminEmail}`);
      try {
        await this.sendEmailRaw(
          adminEmail,
          `[T.U.T. Admin] ${content.title}`,
          content.summary,
          htmlEmail,
          'Admin Desk',
          eventDef.category
        );
      } catch (err) {
        console.error(`[NotificationService] Failed to deliver Admin email:`, err);
      }
    } else {
      console.log(`[NotificationService] Admin email skipped (globally disabled in settings)`);
    }
  }

  private async handleMemberDispatch(
    eventType: string,
    eventDef: EventDefinition,
    payload: NotificationPayload,
    appUrl: string,
    forceSendEmail?: boolean
  ) {
    if (!eventDef.generateMemberContent) return;

    const content = eventDef.generateMemberContent(payload);
    
    // Resolve member email
    let memberEmail = payload.user?.email || payload.tx?.accountNumber;
    if (!memberEmail && payload.user?.uid) {
      const matched = this.allUsers.find((u) => u.uid === payload.user?.uid);
      if (matched?.email) memberEmail = matched.email;
    }

    if (!memberEmail) {
      console.warn(`[NotificationService] Cannot dispatch member notification, email missing for payload:`, payload);
      return;
    }

    const cleanEmail = memberEmail.toLowerCase().trim();

    // 1. Generate in-app notification for Member
    this.addInAppNotification(content.title, content.summary, cleanEmail);

    // 2. Check independent Member setting
    const memberProfile = this.allUsers.find((u) => u.email?.toLowerCase().trim() === cleanEmail);
    const memberEmailEnabled = memberProfile ? (memberProfile.emailNotificationsEnabled !== false) : true;

    if (memberEmailEnabled || forceSendEmail) {
      const htmlEmail = generateBrandedEmailHtml(
        content.title,
        content.summary,
        content.details,
        content.referenceId,
        appUrl
      );

      console.log(`[NotificationService] Delivering email to Member: ${cleanEmail}`);
      try {
        await this.sendEmailRaw(
          cleanEmail,
          `[T.U.T. Member] ${content.title}`,
          content.summary,
          htmlEmail,
          payload.user?.name || 'Valued Member',
          eventDef.category
        );
      } catch (err) {
        console.error(`[NotificationService] Failed to deliver Member email to ${cleanEmail}:`, err);
      }
    } else {
      console.log(`[NotificationService] Member email skipped (disabled by member preferences: ${cleanEmail})`);
    }
  }
}
