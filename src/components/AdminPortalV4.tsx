import React, { useState, useMemo, useEffect } from 'react';
import { 
  doc, 
  updateDoc, 
  setDoc,
  increment,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  AdminSection, 
  UnifiedRequestItem, 
  AdminPortalV4Props,
  AdDeliverySettings,
  AdminAllNotificationItem
} from './admin/types';
import { AdminSidebar } from './admin/AdminSidebar';
import { AdminHeader } from './admin/AdminHeader';
import { AdminDashboardHome } from './admin/AdminDashboardHome';
import { AdminRequestsView } from './admin/AdminRequestsView';
import { AdminActiveDebtsView } from './admin/AdminActiveDebtsView';
import { AdminMembersView } from './admin/AdminMembersView';
import { AdminTransactionsView } from './admin/AdminTransactionsView';
import { AdminReserveView } from './admin/AdminReserveView';
import { AdminDepositsView } from './admin/AdminDepositsView';
import { AdminAdsView } from './admin/AdminAdsView';
import { AdminNotificationsView, AdminNotificationItem } from './admin/AdminNotificationsView';
import { AdminAllNotificationsView } from './admin/AdminAllNotificationsView';
import { AdminSettingsView } from './admin/AdminSettingsView';
import { AdminPaymentGatewayView } from './admin/AdminPaymentGatewayView';
import { AdminMoreMenuModal } from './admin/AdminMoreMenuModal';
import { AdminMobileBottomNav } from './admin/AdminMobileBottomNav';
import { AdminAuditView } from './admin/AdminAuditView';
import { AdminReportsView } from './admin/AdminReportsView';
import { AdminMemberDossierModal } from './AdminMemberDossierModal';
import { WorkforceManagement } from './WorkforceManagement';
import { ReserveManagement } from './ReserveManagement';
import { calculateMemberLoanAllocations, getAllAllocatedLoans, AllocatedLoan, buildMemberDueRadar } from '../utils/loanAllocationEngine';
import { calculateComprehensiveCreditScore } from '../utils/creditScoreEngine';
import { calculateAuthorizedRepaymentWindow } from '../utils/repaymentTermEngine';
import { executeAtomicAdminApproval, executeAtomicLoanSettlement } from '../utils/bankingLedgerEngine';
import { UserProfile, Transaction, SponsorshipCampaign } from '../App';
import { X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Robust date parser
 */
export function parseSafeDate(val: any, fallbackDate = new Date()): Date {
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

export function safeFormatDistance(val: any): string {
  try {
    const d = parseSafeDate(val);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return 'Recently';
  }
}

export const AdminPortalV4: React.FC<AdminPortalV4Props> = ({
  db,
  user,
  profile,
  allUsers,
  allTransactions,
  auditLogs,
  emailLogs = [],
  sponsorships = [],
  reserveFund,
  onUpdateReserveFund,
  notificationService,
  sendEmail,
  autoEmailState,
  onRunAutoEmailCycle,
  logAuditEvent,
  addToast,
  onCloseAdmin
}) => {
  // Navigation State - STRICTLY ONE active section at a time
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [selectedRequest, setSelectedRequest] = useState<UnifiedRequestItem | null>(null);
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  
  // Overlays / Modals
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [showAdvancedReserve, setShowAdvancedReserve] = useState(false);
  const [docPreview, setDocPreview] = useState<{ url: string; title: string } | null>(null);

  // Live Global Ad Delivery Settings Listener
  const [adSettings, setAdSettings] = useState<AdDeliverySettings>({
    entrancePopupEnabled: true,
    globalCooldownHours: 12,
    allowHeroRotation: true
  });

  useEffect(() => {
    const unsubAds = onSnapshot(doc(db, 'system_controls', 'ad_settings'), (snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        setAdSettings({
          entrancePopupEnabled: d.entrancePopupEnabled !== false,
          globalCooldownHours: typeof d.globalCooldownHours === 'number' ? d.globalCooldownHours : 12,
          allowHeroRotation: d.allowHeroRotation !== false,
          updatedAt: d.updatedAt,
          updatedBy: d.updatedBy
        });
      }
    }, (err) => {
      console.warn("Could not listen to system_controls/ad_settings:", err);
    });
    return () => unsubAds();
  }, [db]);

  const liveCampaigns = useMemo<SponsorshipCampaign[]>(() => {
    const legacyIds = new Set(['sp-apex', 'sp-tusher', 'sp-bicon']);
    return sponsorships.filter(s => s.id !== 'config_seeded' && !legacyIds.has(s.id));
  }, [sponsorships]);

  const activeAdsCount = useMemo(() => liveCampaigns.filter(c => c.status === 'active').length, [liveCampaigns]);

  // -------------------------------------------------------------
  // Calculate Member Metrics for Queue
  // -------------------------------------------------------------
  const calculateMemberMetrics = (uProfile?: UserProfile, currentLoanRequestAmt: number = 0) => {
    const report = calculateComprehensiveCreditScore(uProfile, allTransactions, currentLoanRequestAmt);
    const borrowLimit = report.effectiveLimitCeiling || uProfile?.borrowingLimit || 100000;
    const remainingDebt = report.remainingDebt;
    const totalDeposit = report.totalDeposit;
    const totalLoan = uProfile?.totalLoan || 0;
    const totalRepaid = report.totalRepaid;
    const subMonths = uProfile?.continuousSubscriptionMonths || 0;
    
    const score = report.score;
    let scoreLabel: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention' = 'Excellent';
    if (score >= 780) scoreLabel = 'Excellent';
    else if (score >= 640) scoreLabel = 'Good';
    else if (score >= 580) scoreLabel = 'Fair';
    else scoreLabel = 'Needs Attention';

    let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
    let riskReason = 'Member displays clean repayment record and strong credit profile.';

    if (report.isOverdue) {
      riskLevel = 'High';
      riskReason = `Maturity overdue alert: Active debt of ৳${remainingDebt.toLocaleString()} BDT is past settlement deadline.`;
    } else if (remainingDebt > 0 && currentLoanRequestAmt > 0) {
      riskLevel = 'High';
      riskReason = `Member already holds an active outstanding debt of ৳${remainingDebt.toLocaleString()} BDT.`;
    } else if (currentLoanRequestAmt > borrowLimit) {
      riskLevel = 'High';
      riskReason = `Requested amount ৳${currentLoanRequestAmt.toLocaleString()} BDT exceeds current borrow limit of ৳${borrowLimit.toLocaleString()} BDT.`;
    } else if (score < 580) {
      riskLevel = 'High';
      riskReason = `Credit score (${score}) is in the 'Needs Attention' bracket.`;
    } else if (subMonths < 2 && currentLoanRequestAmt > 20000) {
      riskLevel = 'Medium';
      riskReason = `New member account (${subMonths} months active) requesting ৳${currentLoanRequestAmt.toLocaleString()} BDT.`;
    } else if (remainingDebt > 0) {
      riskLevel = 'Medium';
      riskReason = `Existing active debt balance of ৳${remainingDebt.toLocaleString()} BDT.`;
    }

    const repaymentWindow = calculateAuthorizedRepaymentWindow(uProfile, allTransactions, currentLoanRequestAmt);

    return {
      borrowLimit,
      remainingDebt,
      totalDeposit,
      totalLoan,
      totalRepaid,
      subMonths,
      score,
      scoreLabel,
      riskLevel,
      riskReason,
      isOverdue: Boolean(report.isOverdue),
      maxRepaymentDays: repaymentWindow.maxDays
    };
  };

  const allocatedLoans = useMemo(() => getAllAllocatedLoans(allTransactions), [allTransactions]);
  const activeLoansCount = useMemo(() => allocatedLoans.filter(l => l.remainingAmount > 0).length, [allocatedLoans]);
  const activeDebtsCount = useMemo(() => allUsers.filter(u => (u.remainingDebt || 0) > 0).length, [allUsers]);
  
  const totalDeposits = useMemo(() => {
    return allUsers.reduce((sum, u) => sum + (u.totalDeposit || 0), 0);
  }, [allUsers]);

  const totalOutstandingDebt = useMemo(() => {
    return allUsers.reduce((sum, u) => sum + (u.remainingDebt || 0), 0);
  }, [allUsers]);

  // -------------------------------------------------------------
  // Dynamic Target Reserve & Available Reserve Synchronization
  // -------------------------------------------------------------
  const [targetReserve, setTargetReserve] = useState<number>(() => {
    return typeof reserveFund === 'number' && reserveFund > 0 ? reserveFund : 500000;
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_controls', 'reserves'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (typeof d?.primaryTarget === 'number' && d.primaryTarget > 0) {
          setTargetReserve(d.primaryTarget);
        }
      }
    }, (err) => {
      console.warn("Could not listen to system_controls/reserves", err);
    });
    return () => unsub();
  }, [db]);

  const handleUpdateReserveTarget = async (newAmount: number) => {
    setTargetReserve(newAmount);
    try {
      await setDoc(doc(db, 'system_controls', 'reserves'), {
        primaryTarget: newAmount,
        updatedAt: serverTimestamp()
      }, { merge: true });
      await setDoc(doc(db, 'system_controls', 'funds'), {
        personalFund: newAmount,
        updatedAt: serverTimestamp()
      }, { merge: true });
      if (onUpdateReserveFund) {
        await onUpdateReserveFund(newAmount);
      }
      addToast('Reserve Target Updated', `Target reserve fund set to ৳${newAmount.toLocaleString()}.`, 'success');
    } catch (err: any) {
      console.error("Error updating reserve:", err);
      addToast('Update Failed', err.message || 'Could not update reserve.', 'warning');
    }
  };

  // Exact mathematical logic: Live Available Reserve = Target Reserve - Active Outstanding Debt
  const availableReserve = useMemo(() => {
    return Math.max(0, targetReserve - totalOutstandingDebt);
  }, [targetReserve, totalOutstandingDebt]);

  const reserveCoveragePercent = useMemo(() => {
    if (targetReserve <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((availableReserve / targetReserve) * 100)));
  }, [targetReserve, availableReserve]);

  const newDepositsCount = useMemo(() => {
    return allTransactions.filter(t => t.type === 'deposit' && t.status === 'pending').length;
  }, [allTransactions]);

  // -------------------------------------------------------------
  // UNIFIED REQUESTS QUEUE (Using Live Available Reserve)
  // -------------------------------------------------------------
  const unifiedRequests = useMemo<UnifiedRequestItem[]>(() => {
    const items: UnifiedRequestItem[] = [];

    // Map User Registration / Verification Requests (only actionable or rejected KYC cases, not active approved members)
    allUsers.forEach((u) => {
      const isPendingReg = u.status === 'pending';
      const isVerifPending = (u.status as string) === 'verification_pending' || u.walletVerificationStatus === 'pending';
      const isActionableUser =
        isPendingReg ||
        (u.status as string) === 'info_requested' ||
        u.status === 'rejected' ||
        isVerifPending;

      if (!isActionableUser) return;

      const metrics = calculateMemberMetrics(u, 0);
      const attachedDocs: { name: string; url: string; category: string }[] = [];
      if (u.photoUrl) attachedDocs.push({ name: 'Profile Photo', url: u.photoUrl, category: 'Identity' });
      if (u.documents?.nidFront) attachedDocs.push({ name: 'NID Front', url: u.documents.nidFront, category: 'Identity' });
      if (u.documents?.nidBack) attachedDocs.push({ name: 'NID Back', url: u.documents.nidBack, category: 'Identity' });
      if (u.documents?.payslip) attachedDocs.push({ name: 'Pay Slip / Proof', url: u.documents.payslip, category: 'Financial' });

      const requestType = isPendingReg ? 'registration' : (u.walletVerificationStatus === 'pending' ? 'wallet_verification' : 'profile_verification');
      const reqTypeLabel = isPendingReg ? 'Registration Application' : (u.walletVerificationStatus === 'pending' ? 'Wallet Verification' : 'Profile KYC Review');
      const normStatus = isPendingReg ? 'pending' : (u.status === 'rejected' ? 'rejected' : (u.status || 'pending'));
      const submittedDate = parseSafeDate(u.registeredAt || (u as any).createdAt);

      items.push({
        id: `USER-${u.uid}`,
        source: 'user',
        requestType,
        requestTypeLabel: reqTypeLabel,
        status: normStatus as any,
        requestedAmount: 0,
        submittedAt: submittedDate,
        submittedAtStr: format(submittedDate, 'dd MMM yyyy, HH:mm'),
        
        memberUid: u.uid,
        memberName: u.name || 'Applicant',
        memberId: u.memberId || `TUT-${u.uid.substring(0, 5).toUpperCase()}`,
        memberPhoto: u.photoUrl || '',
        memberEmail: u.email || 'N/A',
        memberPhone: u.phone || 'N/A',
        memberNid: u.nid || 'N/A',
        memberOccupation: u.occupation || 'N/A',
        memberAddress: u.address || 'N/A',
        memberPermanentAddress: u.permanentAddress,
        memberFatherName: u.fatherName,
        memberMotherName: u.motherName,
        memberNomineeName: u.nomineeName,
        memberNomineeRelation: u.nomineeRelation,
        memberEmergencyContact: u.emergencyContact,
        memberTier: u.subscriptionTier,
        memberStatus: u.status,

        currentBorrowLimit: metrics.borrowLimit,
        existingOutstandingLoan: metrics.remainingDebt,
        totalRepayments: metrics.totalRepaid,
        totalDeposits: metrics.totalDeposit,
        continuousSubscriptionMonths: metrics.subMonths,
        creditScore: metrics.score,
        creditScoreLabel: metrics.scoreLabel,
        isOverdue: metrics.isOverdue,
        maxRepaymentDays: metrics.maxRepaymentDays,

        reserveBefore: availableReserve,
        reserveAfter: availableReserve,
        riskLevel: isPendingReg && !u.nid ? 'High' : (isPendingReg ? 'Medium' : 'Low'),
        riskReason: isPendingReg ? 'New citizen identity registration requiring primary document verification.' : 'Verification update requested.',

        attachedDocs,
        adminNotes: u.adminNotes,
        assignedModerator: u.assignedModerator,
        reference: u.referenceContact || 'N/A',
        paymentMethod: 'Membership Registration',
        transactionRefId: `REG-${u.memberId || u.uid.substring(0, 8).toUpperCase()}`,
        memoId: `MEMO-REG-${u.uid.substring(0, 6).toUpperCase()}`,
        loanReason: u.occupation ? `Applicant Profession: ${u.occupation}` : 'New Citizen Membership Verification',
        decidedBy: (u as any).decidedBy,
        decidedAt: (u as any).decidedAt,
        rawUser: u
      });
    });

    // Map Transaction Requests (Loan, Deposit, Pay Due / Repayment, Refund)
    allTransactions.forEach((tx) => {
      const userMatch = allUsers.find((u) => u.uid === tx.userId || u.email?.toLowerCase() === tx.accountNumber?.toLowerCase());
      const metrics = calculateMemberMetrics(userMatch, tx.type === 'loan' ? tx.amount : 0);

      const attachedDocs: { name: string; url: string; category: string }[] = [];
      if (tx.proofUrl) attachedDocs.push({ name: 'Payment Receipt / Slip', url: tx.proofUrl, category: 'Proof' });
      if (userMatch?.photoUrl) attachedDocs.push({ name: 'Profile Photo', url: userMatch.photoUrl, category: 'Identity' });

      let reqTypeLabel = 'Transaction Request';
      if (tx.type === 'loan') reqTypeLabel = 'Loan Application';
      else if (tx.type === 'deposit') reqTypeLabel = 'Deposit Verification';
      else if (tx.type === 'pay_due') reqTypeLabel = 'Debt Repayment';
      else if (tx.type === 'refund') reqTypeLabel = 'Refund Request';
      else if (tx.type === 'subscription') reqTypeLabel = 'Subscription Tier Upgrade';

      // Use live available reserve
      const reserveBefore = availableReserve;
      const reserveAfter = tx.type === 'loan' 
        ? Math.max(0, availableReserve - tx.amount) 
        : (tx.type === 'deposit' || tx.type === 'pay_due' ? availableReserve + tx.amount : availableReserve);

      const timestampDate = parseSafeDate(tx.timestamp || (tx as any).createdAt || tx.date);

      items.push({
        id: tx.id,
        source: 'transaction',
        requestType: tx.type === 'pay_due' ? 'pay_due' : (tx.type as any),
        requestTypeLabel: reqTypeLabel,
        status: tx.status as any,
        requestedAmount: tx.amount || 0,
        submittedAt: timestampDate,
        submittedAtStr: format(timestampDate, 'dd MMM yyyy, HH:mm'),

        memberUid: tx.userId || userMatch?.uid || '',
        memberName: tx.userName || userMatch?.name || 'Member',
        memberId: userMatch?.memberId || `TUT-${(tx.userId || 'MEM').substring(0, 5).toUpperCase()}`,
        memberPhoto: tx.userPhoto || userMatch?.photoUrl || '',
        memberEmail: userMatch?.email || (tx as any).userEmail || (tx.accountNumber?.includes('@') ? tx.accountNumber : 'N/A'),
        memberPhone: userMatch?.phone || tx.accountNumber || 'N/A',
        memberNid: userMatch?.nid || 'N/A',
        memberOccupation: userMatch?.occupation || 'N/A',
        memberAddress: userMatch?.address || 'N/A',
        memberPermanentAddress: userMatch?.permanentAddress,
        memberFatherName: userMatch?.fatherName,
        memberMotherName: userMatch?.motherName,
        memberNomineeName: userMatch?.nomineeName,
        memberNomineeRelation: userMatch?.nomineeRelation,
        memberEmergencyContact: userMatch?.emergencyContact,
        memberTier: userMatch?.subscriptionTier,
        memberStatus: userMatch?.status || 'approved',

        currentBorrowLimit: metrics.borrowLimit,
        existingOutstandingLoan: metrics.remainingDebt,
        totalRepayments: metrics.totalRepaid,
        totalDeposits: metrics.totalDeposit,
        continuousSubscriptionMonths: metrics.subMonths,
        creditScore: metrics.score,
        creditScoreLabel: metrics.scoreLabel,
        isOverdue: metrics.isOverdue,
        maxRepaymentDays: metrics.maxRepaymentDays,

        reserveBefore,
        reserveAfter,
        riskLevel: metrics.riskLevel,
        riskReason: metrics.riskReason,

        attachedDocs,
        adminNotes: tx.adminNotes,
        loanReason: tx.loanReason || (tx as any).reason || tx.purpose,
        paymentMethod: tx.method,
        transactionRefId: tx.transactionId || tx.id,
        memoId: tx.memoId || tx.id,
        accountNumber: tx.accountNumber,
        mobileOperator: tx.mobileOperator,
        reference: tx.reference || tx.transactionId || tx.memoId,
        estimatedRepaymentDate: tx.estimatedRepaymentDate,
        proofUrl: tx.proofUrl,
        subscriptionTier: (tx as any).subscriptionTier,
        subscriptionMonths: (tx as any).subscriptionMonths,
        decidedBy: (tx as any).decidedBy,
        decidedAt: (tx as any).decidedAt,

        rawTx: tx,
        rawUser: userMatch
      });
    });

    return items.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }, [allUsers, allTransactions, availableReserve]);

  // Keep selectedRequest synchronized with fresh unifiedRequests data
  const liveSelectedRequest = useMemo(() => {
    if (!selectedRequest) return null;
    return unifiedRequests.find((r) => r.id === selectedRequest.id) || selectedRequest;
  }, [selectedRequest, unifiedRequests]);

  // Keep selectedMember synchronized with live allUsers state
  const liveSelectedMember = useMemo(() => {
    if (!selectedMember) return null;
    return allUsers.find((u) => u.uid === selectedMember.uid) || selectedMember;
  }, [selectedMember, allUsers]);

  // -------------------------------------------------------------
  // Dashboard Metrics & Recent Activities
  // -------------------------------------------------------------
  const pendingRequestsCount = useMemo(() => {
    return unifiedRequests.filter(r => ['pending', 'hold', 'info_requested'].includes(r.status?.toLowerCase())).length;
  }, [unifiedRequests]);

  const todayActivityCount = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return auditLogs.filter(l => l.timestamp && format(parseSafeDate(l.timestamp), 'yyyy-MM-dd') === todayStr).length;
  }, [auditLogs]);

  const recentActivities = useMemo(() => {
    const activities: Array<{
      id: string;
      type: 'loan_request' | 'repayment' | 'deposit' | 'loan_approved' | 'general';
      title: string;
      timestamp: any;
    }> = [];

    // Recent transactions
    allTransactions.slice(0, 10).forEach(tx => {
      let type: 'loan_request' | 'repayment' | 'deposit' | 'loan_approved' | 'general' = 'general';
      let title = `Transaction from ${tx.userName || 'Member'}`;

      if (tx.type === 'loan') {
        type = tx.status === 'confirmed' ? 'loan_approved' : 'loan_request';
        title = tx.status === 'confirmed' ? `Loan approved for ${tx.userName}` : `Loan request from ${tx.userName} (৳${tx.amount?.toLocaleString()})`;
      } else if (tx.type === 'pay_due') {
        type = 'repayment';
        title = `Repayment of ৳${tx.amount?.toLocaleString()} received from ${tx.userName}`;
      } else if (tx.type === 'deposit') {
        type = 'deposit';
        title = `Deposit of ৳${tx.amount?.toLocaleString()} added by ${tx.userName}`;
      }

      activities.push({
        id: tx.id,
        type,
        title,
        timestamp: parseSafeDate(tx.timestamp || (tx as any).createdAt || tx.date)
      });
    });

    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [allTransactions]);

  const dueRadarItems = useMemo(() => {
    return buildMemberDueRadar(allUsers, allTransactions);
  }, [allUsers, allTransactions]);

  const overdueMembersCount = useMemo(() => {
    return dueRadarItems.filter(item => item.urgency === 'overdue').length;
  }, [dueRadarItems]);

  const failedEmailsCount = useMemo(() => {
    return (emailLogs || []).filter((l: any) => l.status === 'failed').length;
  }, [emailLogs]);

  // Notifications Clearing & Dismissing State with persistent localStorage
  const [clearedNotifIds, setClearedNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tut_admin_cleared_notifs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [clearedBeforeTime, setClearedBeforeTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tut_admin_cleared_before_time');
      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });

  // Unified All System Notifications List (Pending Requests, Overdue Alerts, Member KYC, System Audit Logs)
  const allNotificationsList = useMemo<AdminAllNotificationItem[]>(() => {
    const list: AdminAllNotificationItem[] = [];

    // 1. Pending, Hold, and Info-Requested Operations
    unifiedRequests
      .filter(r => ['pending', 'hold', 'info_requested'].includes((r.status || '').toLowerCase()))
      .slice(0, 15)
      .forEach(r => {
        const isAmount = r.requestedAmount > 0;
        list.push({
          id: `notif-req-${r.id}`,
          category: 'request',
          severity: r.riskLevel === 'High' ? 'warning' : 'info',
          title: `${r.requestTypeLabel} · ${r.status === 'pending' ? 'Awaiting Review' : r.status.toUpperCase()}`,
          message: isAmount
            ? `${r.memberName} submitted ৳${r.requestedAmount.toLocaleString()} (${r.paymentMethod || 'Vault'})`
            : `${r.memberName} submitted ${r.requestTypeLabel} for administrative review.`,
          timestamp: r.submittedAt,
          requestId: r.id,
          memberUid: r.memberUid,
          actionLabel: 'Review Request'
        });
      });

    // 2. Overdue & Due Maturity Radar Alerts
    dueRadarItems
      .filter(item => item.urgency === 'overdue')
      .forEach(item => {
        const overdueDays = item.daysDiff !== null && item.daysDiff < 0 ? Math.abs(item.daysDiff) : 1;
        list.push({
          id: `notif-overdue-${item.member.uid}`,
          category: 'overdue',
          severity: 'critical',
          title: `Overdue Loan Alert · ${item.member.name}`,
          message: `৳${(item.activeDebt || 0).toLocaleString()} outstanding is ${overdueDays} day(s) past due deadline.`,
          timestamp: item.dueDate || new Date(),
          memberUid: item.member.uid,
          actionLabel: 'View Borrower'
        });
      });

    // 3. New / Pending Member Registrations & KYC Updates
    allUsers
      .filter(u => u.status === 'pending' || (u.status as string) === 'verification_pending' || u.walletVerificationStatus === 'pending')
      .slice(0, 10)
      .forEach(u => {
        list.push({
          id: `notif-member-${u.uid}`,
          category: 'member',
          severity: 'info',
          title: u.status === 'pending' ? `New Citizen Application · ${u.name}` : `KYC Verification Pending · ${u.name}`,
          message: `${u.occupation || 'Applicant'} · ${u.email || u.phone || 'Identity record submitted'}`,
          timestamp: parseSafeDate(u.registeredAt || (u as any).createdAt),
          memberUid: u.uid,
          actionLabel: 'Inspect Member'
        });
      });

    // 4. Recent System & Audit Trail Events
    auditLogs.slice(0, 15).forEach((log, idx) => {
      list.push({
        id: `notif-log-${log.id || idx}`,
        category: 'system',
        severity: log.severity === 'critical' ? 'critical' : log.severity === 'warning' ? 'warning' : 'info',
        title: log.action || 'System Audit Event',
        message: log.details || '',
        timestamp: parseSafeDate(log.timestamp)
      });
    });

    return list
      .filter(item => {
        if (clearedNotifIds.includes(item.id)) return false;
        const timeNum = item.timestamp instanceof Date
          ? item.timestamp.getTime()
          : (item.timestamp ? new Date(item.timestamp).getTime() : 0);
        if (clearedBeforeTime > 0 && !isNaN(timeNum) && timeNum <= clearedBeforeTime) return false;
        return true;
      })
      .sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
  }, [unifiedRequests, dueRadarItems, allUsers, auditLogs, clearedNotifIds, clearedBeforeTime]);

  const legacyNotificationsList = useMemo<AdminNotificationItem[]>(() => {
    return allNotificationsList.map(item => ({
      id: item.id,
      type: item.category === 'request' ? 'request' : item.category === 'member' ? 'member' : 'system',
      title: item.title,
      message: item.message,
      timestamp: item.timestamp
    }));
  }, [allNotificationsList]);

  const handleClearAllNotifications = () => {
    const allIds = allNotificationsList.map(n => n.id);
    const now = Date.now();
    setClearedNotifIds(prev => {
      const merged = Array.from(new Set([...prev, ...allIds]));
      localStorage.setItem('tut_admin_cleared_notifs', JSON.stringify(merged));
      return merged;
    });
    setClearedBeforeTime(now);
    localStorage.setItem('tut_admin_cleared_before_time', String(now));
    addToast('Notifications Cleared', 'All current notifications have been cleared.', 'info');
  };

  const handleDismissNotification = (id: string) => {
    setClearedNotifIds(prev => {
      const updated = [...prev, id];
      localStorage.setItem('tut_admin_cleared_notifs', JSON.stringify(updated));
      return updated;
    });
  };

  // -------------------------------------------------------------
  // BACKEND HANDLERS (Preserved exactly as requested)
  // -------------------------------------------------------------
  const handleExecuteRequestAction = async (
    action: 'approve' | 'reject' | 'hold' | 'info',
    request: UnifiedRequestItem,
    reason: string = ''
  ) => {
    const adminEmail = user?.email || 'Administrator';
    const nowStr = new Date().toISOString();

    try {
      if (request.source === 'user') {
        const userRef = doc(db, 'users', request.memberUid);

        if (action === 'approve') {
          const memberId = request.rawUser?.memberId || `TUT-${Math.floor(10000 + Math.random() * 90000)}`;
          await updateDoc(userRef, {
            status: 'approved',
            memberId,
            approvedAt: nowStr,
            adminNotes: `${request.adminNotes || ''}\n[${new Date().toLocaleDateString()}] Approved by ${adminEmail}: ${reason}`,
            updatedAt: serverTimestamp()
          });

          await logAuditEvent(
            'Membership Approved',
            `Approved registration for ${request.memberName} (ID: ${memberId}). Reason: ${reason}`,
            'info'
          );

          await notificationService.dispatchEvent('membership_approved', {
            user: {
              uid: request.memberUid,
              name: request.memberName,
              email: request.memberEmail,
              memberId,
              borrowingLimit: request.currentBorrowLimit
            },
            customNotes: reason
          });

          addToast('Registration Approved', `${request.memberName} is now active.`, 'success');
        } else if (action === 'reject') {
          await updateDoc(userRef, {
            status: 'rejected',
            adminNotes: `${request.adminNotes || ''}\n[${new Date().toLocaleDateString()}] Rejected by ${adminEmail}: ${reason}`,
            updatedAt: serverTimestamp()
          });

          await logAuditEvent(
            'Membership Rejected',
            `Declined registration for ${request.memberName}. Reason: ${reason}`,
            'warning'
          );

          await notificationService.dispatchEvent('membership_rejected', {
            user: {
              uid: request.memberUid,
              name: request.memberName,
              email: request.memberEmail
            },
            customNotes: reason
          });

          addToast('Registration Rejected', `Application declined for ${request.memberName}.`, 'info');
        } else if (action === 'info') {
          await updateDoc(userRef, {
            status: 'info_requested',
            adminNotes: `${request.adminNotes || ''}\n[${new Date().toLocaleDateString()}] Info Requested by ${adminEmail}: ${reason}`,
            updatedAt: serverTimestamp()
          });

          await logAuditEvent(
            'Membership Information Requested',
            `Requested additional verification info from ${request.memberName}: ${reason}`,
            'info'
          );

          await notificationService.dispatchEvent('membership_more_info', {
            user: {
              uid: request.memberUid,
              name: request.memberName,
              email: request.memberEmail
            },
            customNotes: reason
          });

          addToast('Information Requested', `Message sent to ${request.memberName}.`, 'info');
        }
      } else {
        // Transaction source (loan, deposit, pay_due, refund, subscription)
        const txRef = doc(db, 'transactions', request.id);
        const userRef = request.memberUid ? doc(db, 'users', request.memberUid) : null;

        if (action === 'approve') {
          const { cleanMemoId } = await executeAtomicAdminApproval(db, {
            request,
            adminEmail,
            reason
          });

          let eventType = 'loan_approved';
          if (request.requestType === 'deposit') eventType = 'deposit_confirmed';
          else if (request.requestType === 'pay_due') eventType = 'repayment_received';
          else if (request.requestType === 'refund') eventType = 'refund_processed';
          else if (request.requestType === 'subscription') eventType = 'subscription_confirmed';

          await logAuditEvent(
            `Transaction Confirmed (${request.requestType.toUpperCase()})`,
            `Approved ৳${request.requestedAmount.toLocaleString()} for ${request.memberName}. Memo: ${cleanMemoId}.`,
            'info'
          );

          const nextRemainingDebt =
            request.requestType === 'pay_due'
              ? Math.max(0, request.existingOutstandingLoan - request.requestedAmount)
              : request.requestType === 'loan'
              ? request.existingOutstandingLoan + request.requestedAmount
              : request.existingOutstandingLoan;

          await notificationService.dispatchEvent(eventType, {
            user: {
              uid: request.memberUid,
              name: request.memberName,
              email: request.memberEmail,
              memberId: request.memberId,
              remainingDebt: nextRemainingDebt
            },
            tx: {
              id: request.id,
              type: request.requestType,
              amount: request.requestedAmount,
              method: request.paymentMethod,
              memoId: cleanMemoId,
              transactionId: request.transactionRefId,
              accountNumber: request.accountNumber,
              reference: request.reference,
              mobileOperator: request.mobileOperator,
              subscriptionTier: request.subscriptionTier || request.memberTier,
              subscriptionMonths: request.subscriptionMonths,
              estimatedRepaymentDate: request.estimatedRepaymentDate,
              loanReason: request.loanReason,
              decidedBy: adminEmail,
              decidedAt: nowStr
            },
            customNotes: reason
          });

          addToast('Transaction Confirmed', `Approved ৳${request.requestedAmount.toLocaleString()} for ${request.memberName}.`, 'success');
        } else if (action === 'reject') {
          await updateDoc(txRef, {
            status: 'rejected',
            decidedBy: adminEmail,
            decidedAt: nowStr,
            adminNotes: `${request.adminNotes || ''}\n[${new Date().toLocaleDateString()}] Rejected by ${adminEmail}: ${reason}`,
            updatedAt: serverTimestamp()
          });

          await logAuditEvent(
            `Transaction Rejected (${request.requestType.toUpperCase()})`,
            `Declined ৳${request.requestedAmount.toLocaleString()} for ${request.memberName}. Reason: ${reason}`,
            'warning'
          );

          try {
            await notificationService.dispatchEvent('transaction_rejected', {
              user: { uid: request.memberUid, name: request.memberName, email: request.memberEmail },
              tx: { id: request.id, amount: request.requestedAmount, method: request.paymentMethod, memoId: request.memoId },
              customNotes: reason
            });
          } catch {}

          addToast('Transaction Rejected', `Declined ৳${request.requestedAmount.toLocaleString()} for ${request.memberName}.`, 'info');
        } else if (action === 'hold') {
          await updateDoc(txRef, {
            status: 'hold',
            adminNotes: `${request.adminNotes || ''}\n[${new Date().toLocaleDateString()}] Placed on Hold by ${adminEmail}: ${reason}`,
            updatedAt: serverTimestamp()
          });

          await logAuditEvent(
            `Transaction On Hold (${request.requestType.toUpperCase()})`,
            `Placed ৳${request.requestedAmount.toLocaleString()} for ${request.memberName} on hold. Note: ${reason}`,
            'info'
          );

          try {
            await notificationService.dispatchEvent('transaction_hold', {
              user: { uid: request.memberUid, name: request.memberName, email: request.memberEmail },
              tx: { id: request.id, amount: request.requestedAmount, method: request.paymentMethod, memoId: request.memoId },
              customNotes: reason
            });
          } catch {}

          addToast('Placed on Hold', `Request placed on hold.`, 'info');
        } else if (action === 'info') {
          await updateDoc(txRef, {
            status: 'info_requested',
            adminNotes: `${request.adminNotes || ''}\n[${new Date().toLocaleDateString()}] Info Requested by ${adminEmail}: ${reason}`,
            updatedAt: serverTimestamp()
          });

          await logAuditEvent(
            `Information Requested (${request.requestType.toUpperCase()})`,
            `Requested additional proof/details from ${request.memberName}: ${reason}`,
            'info'
          );

          try {
            await notificationService.dispatchEvent('info_requested', {
              user: { uid: request.memberUid, name: request.memberName, email: request.memberEmail },
              tx: { id: request.id, amount: request.requestedAmount, method: request.paymentMethod, memoId: request.memoId },
              customNotes: reason
            });
          } catch {}

          addToast('Info Requested', `Instructions sent to ${request.memberName}.`, 'info');
        }
      }

      setSelectedRequest(null);
    } catch (err: any) {
      console.error('Failed to execute admin action:', err);
      addToast('Action Failed', err.message || 'Error updating Firestore.', 'warning');
    }
  };

  const handleAddInternalNote = async (req: UnifiedRequestItem, note: string) => {
    const adminEmail = user?.email || 'Administrator';
    const noteText = `[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}] Note by ${adminEmail}: ${note}`;

    try {
      if (req.source === 'user') {
        const userRef = doc(db, 'users', req.memberUid);
        await updateDoc(userRef, {
          adminNotes: req.adminNotes ? `${req.adminNotes}\n${noteText}` : noteText
        });
      } else {
        const txRef = doc(db, 'transactions', req.id);
        await updateDoc(txRef, {
          adminNotes: req.adminNotes ? `${req.adminNotes}\n${noteText}` : noteText
        });
      }
      addToast('Note Appended', 'Administrative note saved.', 'success');
    } catch (err: any) {
      console.error('Failed to append note:', err);
      addToast('Note Failed', err.message || 'Could not save note.', 'warning');
    }
  };

  const handleSettleLoan = async (loan: AllocatedLoan, member: UserProfile) => {
    try {
      const settleAmount = loan.remainingAmount ?? loan.originalAmount ?? 0;
      await executeAtomicLoanSettlement(db, {
        loanId: loan.id,
        memberUid: member.uid,
        adminEmail: profile?.email || user?.email || 'admin@tut.org',
        settleAmount
      });

      const remainingAfter = Math.max(0, (member.remainingDebt || 0) - settleAmount);
      await logAuditEvent('LOAN_SETTLED', `Loan ${loan.id} (৳${loan.originalAmount}) marked as settled/paid in full`, 'info');

      const settledAdmin = profile?.email || user?.email || 'admin@tut.org';
      await notificationService.dispatchEvent(
        remainingAfter <= 0 ? 'loan_fully_completed' : 'repayment_received',
        {
          user: {
            uid: member.uid,
            name: member.name,
            email: member.email,
            memberId: member.memberId,
            remainingDebt: remainingAfter
          },
          tx: {
            id: loan.id,
            type: 'pay_due',
            amount: settleAmount,
            method: 'Ledger Settlement',
            memoId: loan.memoId || loan.id,
            transactionId: loan.id,
            decidedBy: settledAdmin,
            decidedAt: new Date().toISOString()
          }
        }
      );

      addToast('Loan Settled', 'Loan status updated to Paid & Settled.', 'success');
    } catch (err: any) {
      console.error('Error settling loan:', err);
      addToast('Action Failed', err.message || 'Could not mark loan as settled.', 'warning');
    }
  };

  const handleUpdateMemberDossier = async (updatedPayload: Partial<UserProfile>) => {
    if (!editingMember) return;
    try {
      const userRef = doc(db, 'users', editingMember.uid);
      await updateDoc(userRef, updatedPayload as any);
      await logAuditEvent('MEMBER_DOSSIER_UPDATED', `Admin updated dossier for member ${editingMember.uid}`, 'info');
      addToast('Dossier Saved', 'Member dossier successfully updated.', 'success');
      
      // Instantly synchronize selectedMember state so profile view reflects new values immediately
      setSelectedMember((prev) => (prev && prev.uid === editingMember.uid ? { ...prev, ...updatedPayload } : prev));
      
      setEditingMember(null);
    } catch (err: any) {
      console.error('Error updating dossier:', err);
      addToast('Save Failed', err.message || 'Could not update dossier.', 'warning');
    }
  };

  // Safe navigation helper ensuring ONE active section at a time
  const handleNavigateSection = (section: AdminSection) => {
    if (section === 'requests') {
      setSelectedRequest(null);
    }
    if (section === 'members') {
      setSelectedMember(null);
    }
    setActiveSection(section);
    setShowAdvancedReserve(false);
  };

  return (
    <div className="flex h-screen w-screen bg-[#070D19] text-slate-100 font-sans antialiased overflow-hidden select-none">
      {/* 1. Permanent Desktop Sidebar & Mobile Drawer */}
      <AdminSidebar
        activeSection={activeSection}
        onSelectSection={handleNavigateSection}
        pendingRequestsCount={pendingRequestsCount}
        activeDebtsCount={activeDebtsCount}
        unreadNotificationsCount={allNotificationsList.length}
        failedEmailsCount={failedEmailsCount}
        activeAdsCount={activeAdsCount}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        adminName={profile?.name || user?.displayName || 'Tahsin Ullah'}
        adminRole="Founder & Chairman"
        adminPhoto={profile?.photoUrl}
      />

      {/* 2. Main Application Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#070D19]">
        {/* Top Navigation Header */}
        <AdminHeader
          activeSection={activeSection}
          onSelectSection={handleNavigateSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onToggleMoreMenu={() => setMoreMenuOpen(!moreMenuOpen)}
          onCloseAdmin={onCloseAdmin}
          unreadNotificationsCount={allNotificationsList.length}
          adminName={profile?.name || user?.displayName || 'Tahsin Ullah'}
          detailBackAction={
            activeSection === 'request_detail' ? () => {
              setSelectedRequest(null);
              setActiveSection('requests');
            } : activeSection === 'member_profile' ? () => {
              setSelectedMember(null);
              setActiveSection('members');
            } : undefined
          }
          detailTitle={
            activeSection === 'request_detail' ? 'Request Details' :
            activeSection === 'member_profile' ? (liveSelectedMember?.name ? `${liveSelectedMember.name}'s Profile` : 'Member Profile') :
            undefined
          }
        />

        {/* Scrollable Main Content: EXACTLY ONE ACTIVE SECTION AT A TIME */}
        <main className="flex-1 overflow-y-auto px-3.5 sm:px-5 lg:px-6 py-4 lg:py-5 pb-20 lg:pb-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
          {/* SCREEN 1: DASHBOARD HOME */}
          {activeSection === 'dashboard' && (
            <AdminDashboardHome
              onNavigate={handleNavigateSection}
              onInspectRequest={(req) => {
                setSelectedRequest(req);
                setActiveSection('request_detail');
              }}
              pendingRequests={unifiedRequests.filter(r => ['pending', 'hold', 'info_requested'].includes(r.status?.toLowerCase()))}
              pendingRequestsCount={pendingRequestsCount}
              activeLoansCount={activeLoansCount}
              reserveFund={reserveFund}
              targetReserve={targetReserve}
              availableReserve={availableReserve}
              totalDeposits={totalDeposits}
              totalOutstandingDebt={totalOutstandingDebt}
              todayActivityCount={todayActivityCount}
              recentActivities={recentActivities}
              alerts={{
                pendingApprovalCount: pendingRequestsCount,
                overdueMembersCount,
                reserveCoveragePercent,
                newDepositsCount
              }}
              allUsers={allUsers}
              allTransactions={allTransactions}
              campaigns={liveCampaigns}
            />
          )}

          {/* SCREEN 2 & 3: REQUESTS & REQUEST DETAILS */}
          {(activeSection === 'requests' || activeSection === 'request_detail') && (
            <AdminRequestsView
              requests={unifiedRequests}
              selectedRequest={liveSelectedRequest}
              onSelectRequest={(req) => {
                setSelectedRequest(req);
                setActiveSection(req ? 'request_detail' : 'requests');
              }}
              onExecuteAction={handleExecuteRequestAction}
              onAddNote={handleAddInternalNote}
              onViewDoc={(url, title) => setDocPreview({ url, title })}
              onViewMember={(uid) => {
                const found = allUsers.find(u => u.uid === uid);
                if (found) {
                  setSelectedMember(found);
                  setActiveSection('member_profile');
                }
              }}
            />
          )}

          {/* DEDICATED ACTIVE DEBTS REGISTRY */}
          {activeSection === 'active_debts' && (
            <AdminActiveDebtsView
              allUsers={allUsers}
              allTransactions={allTransactions}
              onSelectMember={(member) => {
                setSelectedMember(member);
                setActiveSection('member_profile');
              }}
              onSettleLoan={handleSettleLoan}
            />
          )}

          {/* SCREEN 4 & 5: MEMBERS & MEMBER PROFILE */}
          {(activeSection === 'members' || activeSection === 'member_profile') && (
            <AdminMembersView
              allUsers={allUsers}
              allTransactions={allTransactions}
              selectedMember={liveSelectedMember}
              onSelectMember={(member) => {
                setSelectedMember(member);
                setActiveSection(member ? 'member_profile' : 'members');
              }}
              onEditDossier={(userToEdit) => setEditingMember(userToEdit)}
              onSettleLoan={handleSettleLoan}
            />
          )}

          {/* SCREEN 6: TRANSACTIONS */}
          {activeSection === 'transactions' && (
            <AdminTransactionsView
              transactions={allTransactions}
              onViewMember={(uid) => {
                const found = allUsers.find(u => u.uid === uid);
                if (found) {
                  setSelectedMember(found);
                  setActiveSection('member_profile');
                }
              }}
            />
          )}

          {/* SCREEN 7: RESERVE MANAGEMENT */}
          {activeSection === 'reserve' && (
            showAdvancedReserve ? (
              <div className="space-y-4 w-full max-w-7xl mx-auto">
                <button
                  onClick={() => setShowAdvancedReserve(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-[#132247] hover:bg-[#1A316B] border border-[#182C58]"
                >
                  ← Back to Standard Reserve Overview
                </button>
                <ReserveManagement
                  db={db}
                  reserveFund={reserveFund}
                  onUpdateReserveFund={onUpdateReserveFund}
                  allUsers={allUsers}
                  allTransactions={allTransactions}
                  totalOutstandingDebt={totalOutstandingDebt}
                  sendEmail={sendEmail}
                  logAuditEvent={logAuditEvent}
                  addToast={addToast}
                  onViewMemberDossier={(user) => {
                    setSelectedMember(user);
                    setActiveSection('member_profile');
                  }}
                />
              </div>
            ) : (
              <AdminReserveView
                reserveFund={availableReserve}
                totalAllocated={totalOutstandingDebt}
                targetAmount={targetReserve}
                totalDeposits={totalDeposits}
                onUpdateReserveFund={handleUpdateReserveTarget}
                onOpenAdvancedReserve={() => setShowAdvancedReserve(true)}
              />
            )
          )}

          {/* SCREEN 8: MEMBER DEPOSITS */}
          {activeSection === 'deposits' && (
            <AdminDepositsView
              transactions={allTransactions}
              allUsers={allUsers}
              onViewMember={(uid) => {
                const found = allUsers.find(u => u.uid === uid);
                if (found) {
                  setSelectedMember(found);
                  setActiveSection('member_profile');
                }
              }}
            />
          )}

          {/* ADVERTISEMENT & PARTNER PERKS CONTROL STUDIO */}
          {activeSection === 'ads' && (
            <AdminAdsView
              db={db}
              campaigns={liveCampaigns}
              adSettings={adSettings}
              adminEmail={profile?.email || user?.email || 'Administrator'}
              logAuditEvent={logAuditEvent}
              addToast={addToast}
            />
          )}

          {/* SCREEN 9A: ALL SYSTEM NOTIFICATIONS (BELL ICON) */}
          {activeSection === 'notifications' && (
            <AdminAllNotificationsView
              notifications={allNotificationsList}
              onClearAll={handleClearAllNotifications}
              onDismiss={handleDismissNotification}
              onOpenRequest={(reqId) => {
                const found = unifiedRequests.find(r => r.id === reqId);
                if (found) {
                  setSelectedRequest(found);
                  setActiveSection('request_detail');
                } else {
                  setActiveSection('requests');
                }
              }}
              onOpenMember={(uid) => {
                const found = allUsers.find(u => u.uid === uid);
                if (found) {
                  setSelectedMember(found);
                  setActiveSection('member_profile');
                }
              }}
              onSelectSection={handleNavigateSection}
            />
          )}

          {/* SCREEN 9B: EMAIL NOTIFICATION SYSTEM (MAIL ICON / SIDEBAR EMAIL SYSTEM) */}
          {activeSection === 'email_hub' && (
            <AdminNotificationsView
              notifications={legacyNotificationsList}
              onClearAll={handleClearAllNotifications}
              onDismiss={handleDismissNotification}
              db={db}
              allUsers={allUsers}
              allTransactions={allTransactions}
              emailLogs={emailLogs}
              adminEmail="tahsinullahtusher999@gmail.com"
              adminPhoto={profile?.photoUrl}
              sendEmail={sendEmail}
              autoEmailState={autoEmailState}
              onRunAutoEmailCycle={onRunAutoEmailCycle}
              notificationService={notificationService}
              logAuditEvent={logAuditEvent}
              addToast={addToast}
              onInspectMember={(member) => {
                setSelectedMember(member);
                setActiveSection('member_profile');
              }}
              onNavigateSection={handleNavigateSection}
            />
          )}

          {/* SCREEN 9C: PAYMENT GATEWAY & APP SECRETS HUB */}
          {activeSection === 'gateway' && (
            <AdminPaymentGatewayView
              db={db}
              adminEmail={profile?.email || user?.email || 'tahsinullahtusher999@gmail.com'}
              allTransactions={allTransactions}
              logAuditEvent={logAuditEvent}
              addToast={addToast}
            />
          )}

          {/* SCREEN 10: SETTINGS */}
          {activeSection === 'settings' && (
            <AdminSettingsView
              onNavigate={handleNavigateSection}
              onCloseAdmin={onCloseAdmin}
              adminName={profile?.name || user?.displayName || 'Tahsin Ullah'}
              adminEmail={user?.email}
            />
          )}

          {/* DIGITAL WORKFORCE / BANKING OFFICERS */}
          {activeSection === 'workforce' && (
            <div className="max-w-6xl mx-auto animate-fadeIn">
              <WorkforceManagement
                systemStats={{
                  totalUsers: allUsers.length,
                  totalLoans: allTransactions.filter(t => t.type === 'loan').length,
                  totalDeposits,
                  remainingDebt: totalOutstandingDebt,
                  pendingMembersCount: allUsers.filter(u => u.status === 'pending').length,
                  pendingTransactionsCount: pendingRequestsCount
                }}
                recentTransactions={allTransactions.slice(0, 25)}
                reserveSummary={{
                  availableReserve,
                  targetReserve
                }}
                currentUser={profile as any}
              />
            </div>
          )}

          {/* SYSTEM AUDIT LOGS */}
          {activeSection === 'audit' && (
            <AdminAuditView auditLogs={auditLogs} />
          )}

          {/* REPORTS & STATEMENTS */}
          {activeSection === 'reports' && (
            <AdminReportsView
              allUsers={allUsers}
              allTransactions={allTransactions}
              reserveFund={availableReserve}
              targetReserve={targetReserve}
            />
          )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* 3. Mobile Bottom Navigation Bar (Screen 12 in visual reference) */}
        <AdminMobileBottomNav
          activeSection={activeSection}
          onSelectSection={handleNavigateSection}
          pendingRequestsCount={pendingRequestsCount}
          onOpenMoreMenu={() => setMoreMenuOpen(true)}
        />
      </div>

      {/* 4. More Menu Popover / Modal (Screen 11 in visual reference) */}
      <AdminMoreMenuModal
        isOpen={moreMenuOpen}
        onClose={() => setMoreMenuOpen(false)}
        onSelectSection={handleNavigateSection}
        onCloseAdmin={onCloseAdmin}
      />

      {/* 5. Member Dossier Editor Modal */}
      {editingMember && (
        <AdminMemberDossierModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={handleUpdateMemberDossier}
          allTransactions={allTransactions}
          db={db}
          onSettleDebt={async (userId) => {
            const memberObj = allUsers.find(u => u.uid === userId);
            if (memberObj) {
              const userRef = doc(db, 'users', userId);
              await updateDoc(userRef, { remainingDebt: 0 });
              addToast('Debt Settled', 'Member outstanding debt cleared.', 'success');
            }
          }}
        />
      )}

      {/* 6. Document Viewer Overlay */}
      {docPreview && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDocPreview(null)}
        >
          <div 
            className="bg-[#0B132B] border border-[#182C58] rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#182C58]">
              <span className="text-sm font-bold text-white">{docPreview.title}</span>
              <button
                onClick={() => setDocPreview(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black/50 max-h-[70vh] flex items-center justify-center">
              <img 
                src={docPreview.url} 
                alt={docPreview.title} 
                className="max-h-[65vh] w-auto object-contain rounded-lg"
              />
            </div>
            <div className="flex justify-end">
              <a
                href={docPreview.url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
