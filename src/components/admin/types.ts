import { Firestore } from 'firebase/firestore';
import { UserProfile, Transaction } from '../../App';
import { NotificationService } from '../../services/NotificationService';

export type AdminSection = 
  | 'dashboard'
  | 'requests'
  | 'request_detail'
  | 'members'
  | 'member_profile'
  | 'transactions'
  | 'reserve'
  | 'deposits'
  | 'notifications'
  | 'settings'
  | 'workforce'
  | 'audit'
  | 'reports';

export interface UnifiedRequestItem {
  id: string;
  source: 'transaction' | 'user';
  requestType: 'loan' | 'registration' | 'deposit' | 'pay_due' | 'refund' | 'subscription' | 'wallet_verification' | 'profile_verification';
  requestTypeLabel: string;
  status: 'pending' | 'confirmed' | 'approved' | 'rejected' | 'hold' | 'info_requested';
  requestedAmount: number;
  submittedAt: Date;
  submittedAtStr: string;
  
  // Member details
  memberUid: string;
  memberName: string;
  memberId: string;
  memberPhoto: string;
  memberEmail: string;
  memberPhone: string;
  memberNid: string;
  memberOccupation: string;
  memberAddress: string;
  memberFatherName?: string;
  memberMotherName?: string;
  memberStatus: string;
  
  // Financial metrics
  currentBorrowLimit: number;
  existingOutstandingLoan: number;
  totalRepayments: number;
  totalDeposits: number;
  continuousSubscriptionMonths: number;
  creditScore: number;
  creditScoreLabel: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
  
  // Reserve Impact
  reserveBefore: number;
  reserveAfter: number;
  
  // Risk assessment
  riskLevel: 'Low' | 'Medium' | 'High';
  riskReason: string;
  
  // Files / Attachments
  attachedDocs: { name: string; url: string; category: string }[];
  
  // Notes & Assigned
  adminNotes?: string;
  assignedModerator?: string;
  loanReason?: string;
  paymentMethod?: string;
  transactionRefId?: string;
  memoId?: string;
  accountNumber?: string;
  mobileOperator?: string;
  reference?: string;
  estimatedRepaymentDate?: string;
  proofUrl?: string;
  subscriptionTier?: 'bronze' | 'silver' | 'gold' | string;
  subscriptionMonths?: number;
  
  // Raw references
  rawTx?: Transaction;
  rawUser?: UserProfile;
}

export interface AdminPortalV4Props {
  db: Firestore;
  user: any;
  profile: UserProfile | null;
  allUsers: UserProfile[];
  allTransactions: Transaction[];
  auditLogs: any[];
  emailLogs: any[];
  reserveFund: number;
  onUpdateReserveFund?: (newAmount: number) => Promise<void>;
  notificationService: NotificationService;
  sendEmail: (to: string, subject: string, body: string, customHtml?: string, recipientName?: string, category?: string) => Promise<void>;
  logAuditEvent: (action: string, details: string, severity?: 'info' | 'warning' | 'critical') => Promise<void>;
  addToast: (title: string, body: string, type?: 'info' | 'success' | 'warning') => void;
  onCloseAdmin: () => void;
}
