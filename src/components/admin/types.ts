import { Firestore } from 'firebase/firestore';
import { UserProfile, Transaction, SponsorshipCampaign } from '../../App';
import { NotificationService } from '../../services/NotificationService';

export type AdminSection = 
  | 'dashboard'
  | 'requests'
  | 'request_detail'
  | 'active_debts'
  | 'members'
  | 'member_profile'
  | 'transactions'
  | 'reserve'
  | 'deposits'
  | 'ads'
  | 'notifications'
  | 'email_hub'
  | 'gateway'
  | 'settings'
  | 'workforce'
  | 'audit'
  | 'reports';

export interface AdminAllNotificationItem {
  id: string;
  category: 'request' | 'overdue' | 'member' | 'system';
  title: string;
  message: string;
  timestamp: any;
  severity?: 'info' | 'warning' | 'critical';
  requestId?: string;
  memberUid?: string;
  actionLabel?: string;
}

export type AdPlacement = 'all' | 'entrance_popup' | 'deals_hero' | 'featured_carousel' | 'partner_grid';
export type AdTargetAudience = 'all' | 'standard' | 'bronze' | 'silver' | 'gold' | 'active_borrowers' | 'depositors';
export type AdCategory = 'Fintech' | 'Shopping' | 'Food' | 'Mobility' | 'Telecom' | 'General';

export interface AdDeliverySettings {
  entrancePopupEnabled: boolean;
  globalCooldownHours: number;
  allowHeroRotation: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

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
  memberPermanentAddress?: string;
  memberNomineeName?: string;
  memberNomineeRelation?: string;
  memberEmergencyContact?: string;
  memberFatherName?: string;
  memberMotherName?: string;
  memberStatus: string;
  memberTier?: string;
  
  // Financial metrics
  currentBorrowLimit: number;
  existingOutstandingLoan: number;
  totalRepayments: number;
  totalDeposits: number;
  continuousSubscriptionMonths: number;
  creditScore: number;
  creditScoreLabel: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
  isOverdue?: boolean;
  maxRepaymentDays?: number;
  
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
  decidedBy?: string;
  decidedAt?: string;
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

export interface AutoEmailEngineState {
  status: 'idle' | 'scanning' | 'active' | 'smtp_blocked' | 'paused';
  lastScanAt: string | null;
  nextScanAt: string | null;
  lastSentCount: number;
  lastEligibleCount: number;
  totalAutoSentSession: number;
  lastError: string | null;
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
  sponsorships?: SponsorshipCampaign[];
  notificationService: NotificationService;
  sendEmail: (
    to: string,
    subject: string,
    body: string,
    customHtml?: string,
    recipientName?: string,
    category?: string,
    forceRetry?: boolean,
    meta?: { memoId?: string; eventType?: string; recipientUid?: string; attachments?: any[] }
  ) => Promise<boolean | void>;
  autoEmailState?: AutoEmailEngineState;
  onRunAutoEmailCycle?: (forceRun?: boolean) => Promise<number>;
  logAuditEvent: (action: string, details: string, severity?: 'info' | 'warning' | 'critical') => Promise<void>;
  addToast: (title: string, body: string, type?: 'info' | 'success' | 'warning') => void;
  onCloseAdmin: () => void;
}
