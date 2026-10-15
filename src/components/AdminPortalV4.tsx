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
  AdminPortalV4Props 
} from './admin/types';
import { AdminSidebar } from './admin/AdminSidebar';
import { AdminHeader } from './admin/AdminHeader';
import { AdminDashboardHome } from './admin/AdminDashboardHome';
import { AdminRequestsView } from './admin/AdminRequestsView';
import { AdminMembersView } from './admin/AdminMembersView';
import { AdminTransactionsView } from './admin/AdminTransactionsView';
import { AdminReserveView } from './admin/AdminReserveView';
import { AdminDepositsView } from './admin/AdminDepositsView';
import { AdminNotificationsView } from './admin/AdminNotificationsView';
import { AdminSettingsView } from './admin/AdminSettingsView';
import { AdminMoreMenuModal } from './admin/AdminMoreMenuModal';
import { AdminMobileBottomNav } from './admin/AdminMobileBottomNav';
import { AdminAuditView } from './admin/AdminAuditView';
import { AdminReportsView } from './admin/AdminReportsView';
import { AdminMemberDossierModal } from './AdminMemberDossierModal';
import { WorkforceManagement } from './WorkforceManagement';
import { ReserveManagement } from './ReserveManagement';
import { calculateMemberLoanAllocations, getAllAllocatedLoans, AllocatedLoan } from '../utils/loanAllocationEngine';
import { calculateComprehensiveCreditScore } from '../utils/creditScoreEngine';
import { UserProfile, Transaction } from '../App';
import { X, ExternalLink } from 'lucide-react';

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
  reserveFund,
  onUpdateReserveFund,
  notificationService,
  sendEmail,
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
      riskReason
    };
  };

  const allocatedLoans = useMemo(() => getAllAllocatedLoans(allTransactions), [allTransactions]);
  const activeLoansCount = useMemo(() => allocatedLoans.filter(l => l.remainingAmount > 0).length, [allocatedLoans]);
  
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

    // Map User Registration Requests
    allUsers.forEach((u) => {
      const isPendingReg = u.status === 'pending';
      const isVerifPending = (u.status as string) === 'verification_pending' || u.walletVerificationStatus === 'pending';

      const metrics = calculateMemberMetrics(u, 0);
      const attachedDocs: { name: string; url: string; category: string }[] = [];
      if (u.photoUrl) attachedDocs.push({ name: 'Profile Photo', url: u.photoUrl, category: 'Identity' });
      if (u.documents?.nidFront) attachedDocs.push({ name: 'NID Front', url: u.documents.nidFront, category: 'Identity' });
      if (u.documents?.nidBack) attachedDocs.push({ name: 'NID Back', url: u.documents.nidBack, category: 'Identity' });
      if (u.documents?.payslip) attachedDocs.push({ name: 'Pay Slip / Proof', url: u.documents.payslip, category: 'Financial' });

      const requestType = isPendingReg ? 'registration' : (u.walletVerificationStatus === 'pending' ? 'wallet_verification' : 'profile_verification');
      const reqTypeLabel = isPendingReg ? 'Registration Application' : 'Profile Document Audit';
      const normStatus = isPendingReg ? 'pending' : (u.status === 'approved' ? 'confirmed' : (u.status === 'rejected' ? 'rejected' : (u.status || 'confirmed')));
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
        memberFatherName: u.fatherName,
        memberMotherName: u.motherName,
        memberStatus: u.status,

        currentBorrowLimit: metrics.borrowLimit,
        existingOutstandingLoan: metrics.remainingDebt,
        totalRepayments: metrics.totalRepaid,
        totalDeposits: metrics.totalDeposit,
        continuousSubscriptionMonths: metrics.subMonths,
        creditScore: metrics.score,
        creditScoreLabel: metrics.scoreLabel,

        reserveBefore: availableReserve,
        reserveAfter: availableReserve,
        riskLevel: isPendingReg && !u.nid ? 'High' : (isPendingReg ? 'Medium' : 'Low'),
        riskReason: isPendingReg ? 'New citizen identity registration requiring primary document verification.' : 'Verification update requested.',

        attachedDocs,
        adminNotes: u.adminNotes,
        assignedModerator: u.assignedModerator,
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
        memberEmail: userMatch?.email || tx.accountNumber || 'N/A',
        memberPhone: userMatch?.phone || tx.accountNumber || 'N/A',
        memberNid: userMatch?.nid || 'N/A',
        memberOccupation: userMatch?.occupation || 'N/A',
        memberAddress: userMatch?.address || 'N/A',
        memberFatherName: userMatch?.fatherName,
        memberMotherName: userMatch?.motherName,
        memberStatus: userMatch?.status || 'approved',

        currentBorrowLimit: metrics.borrowLimit,
        existingOutstandingLoan: metrics.remainingDebt,
        totalRepayments: metrics.totalRepaid,
        totalDeposits: metrics.totalDeposit,
        continuousSubscriptionMonths: metrics.subMonths,
        creditScore: metrics.score,
        creditScoreLabel: metrics.scoreLabel,

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

        rawTx: tx,
        rawUser: userMatch
      });
    });

    return items;
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

  const overdueMembersCount = useMemo(() => {
    return allUsers.filter(u => (u.remainingDebt || 0) > 0).length;
  }, [allUsers]);

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

  const handleClearAllNotifications = () => {
    const allIds = notificationsList.map(n => n.id);
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

  // Notifications List
  const notificationsList = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'system' | 'request' | 'member';
      title: string;
      message: string;
      timestamp: any;
    }> = [];

    // Map pending requests as notifications
    unifiedRequests.filter(r => r.status === 'pending').slice(0, 8).forEach(r => {
      list.push({
        id: `notif-req-${r.id}`,
        type: 'request',
        title: `Pending ${r.requestTypeLabel}`,
        message: `${r.memberName} submitted a request for ৳${r.requestedAmount.toLocaleString()}`,
        timestamp: r.submittedAt
      });
    });

    // Map recent audit logs
    auditLogs.slice(0, 10).forEach(log => {
      list.push({
        id: `notif-log-${log.id || Math.random()}`,
        type: 'system',
        title: log.action || 'System Log',
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
  }, [unifiedRequests, auditLogs, clearedNotifIds, clearedBeforeTime]);

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

          addToast('Information Requested', `Message sent to ${request.memberName}.`, 'info');
        }
      } else {
        // Transaction source (loan, deposit, pay_due, refund)
        const txRef = doc(db, 'transactions', request.id);
        const userRef = request.memberUid ? doc(db, 'users', request.memberUid) : null;

        if (action === 'approve') {
          const cleanMemoId = request.memoId 
            ? (request.memoId.startsWith('TUT-MEMO-') ? request.memoId : `TUT-MEMO-${request.memoId}`)
            : `TUT-MEMO-${Math.floor(100000 + Math.random() * 900000)}`;

          await updateDoc(txRef, {
            status: 'confirmed',
            memoId: cleanMemoId,
            exactAmount: request.requestedAmount,
            decidedBy: adminEmail,
            decidedAt: nowStr,
            adminNotes: `${request.adminNotes || ''}\n[${new Date().toLocaleDateString()}] Confirmed by ${adminEmail}: ${reason}`,
            updatedAt: serverTimestamp()
          });

          if (request.requestType === 'loan' && userRef) {
            const newDebt = request.existingOutstandingLoan + request.requestedAmount;
            const newTotalLoan = request.rawUser?.totalLoan ? request.rawUser.totalLoan + request.requestedAmount : request.requestedAmount;
            await updateDoc(userRef, {
              remainingDebt: newDebt,
              totalLoan: newTotalLoan
            });
          } else if (request.requestType === 'pay_due' && userRef) {
            const newDebt = Math.max(0, request.existingOutstandingLoan - request.requestedAmount);
            const newRepaid = (request.rawUser?.totalRepaid || 0) + request.requestedAmount;
            await updateDoc(userRef, {
              remainingDebt: newDebt,
              totalRepaid: newRepaid
            });
          } else if (request.requestType === 'deposit' && userRef) {
            const newDeposit = (request.rawUser?.totalDeposit || 0) + request.requestedAmount;
            await updateDoc(userRef, {
              totalDeposit: newDeposit
            });
          } else if (request.requestType === 'subscription' && userRef) {
            const tier = (request as any).subscriptionTier || request.rawUser?.subscriptionTier || 'bronze';
            const months = (request as any).subscriptionMonths || 1;
            const today = new Date();
            let expiresAt = new Date();
            if (request.rawUser?.subscriptionStatus === 'active' && request.rawUser?.subscriptionExpiresAt) {
              const currentExp = new Date(request.rawUser.subscriptionExpiresAt);
              if (currentExp > today) {
                expiresAt = new Date(currentExp);
              }
            }
            expiresAt.setDate(expiresAt.getDate() + ((months || 1) * 30));
            const baseLimit = tier === 'gold' ? 2500 : tier === 'silver' ? 1500 : 500;
            await updateDoc(userRef, {
              subscriptionTier: tier,
              subscriptionStatus: 'active',
              subscriptionExpiresAt: expiresAt.toISOString(),
              borrowingLimit: baseLimit,
              updatedAt: serverTimestamp()
            });

            const fundsDocRef = doc(db, 'system_controls', 'funds');
            await setDoc(fundsDocRef, {
              personalFund: increment(request.requestedAmount),
              updatedAt: serverTimestamp()
            }, { merge: true }).catch(() => {});
          }

          let eventType = 'loan_approved';
          if (request.requestType === 'deposit') eventType = 'deposit_confirmed';
          if (request.requestType === 'pay_due') eventType = 'repayment_received';

          await logAuditEvent(
            `Transaction Confirmed (${request.requestType.toUpperCase()})`,
            `Approved ৳${request.requestedAmount.toLocaleString()} for ${request.memberName}. Memo: ${cleanMemoId}.`,
            'info'
          );

          await notificationService.dispatchEvent(eventType, {
            user: {
              uid: request.memberUid,
              name: request.memberName,
              email: request.memberEmail,
              remainingDebt: Math.max(0, request.existingOutstandingLoan - (request.requestType === 'pay_due' ? request.requestedAmount : 0))
            },
            tx: {
              id: request.id,
              amount: request.requestedAmount,
              method: request.paymentMethod,
              memoId: cleanMemoId,
              transactionId: request.transactionRefId
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
            `Declined ৳${request.requestedAmount.toLocaleString()} for ${request.memberName}.`,
            'warning'
          );

          addToast('Transaction Rejected', `Declined ৳${request.requestedAmount.toLocaleString()} for ${request.memberName}.`, 'info');
        } else if (action === 'hold') {
          await updateDoc(txRef, {
            status: 'hold',
            adminNotes: `${request.adminNotes || ''}\n[${new Date().toLocaleDateString()}] Placed on Hold by ${adminEmail}: ${reason}`,
            updatedAt: serverTimestamp()
          });

          addToast('Placed on Hold', `Request placed on hold.`, 'info');
        } else if (action === 'info') {
          await updateDoc(txRef, {
            status: 'info_requested',
            adminNotes: `${request.adminNotes || ''}\n[${new Date().toLocaleDateString()}] Info Requested by ${adminEmail}: ${reason}`,
            updatedAt: serverTimestamp()
          });

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
      const txRef = doc(db, 'transactions', loan.id);
      await updateDoc(txRef, { status: 'settled', isPaid: true });

      if (member?.uid) {
        const simulatedTxs = allTransactions.map(t => t.id === loan.id ? { ...t, status: 'settled', isPaid: true } : t);
        const summary = calculateMemberLoanAllocations(member.uid, simulatedTxs);
        const userRef = doc(db, 'users', member.uid);
        await updateDoc(userRef, { 
          remainingDebt: summary.totalOutstanding,
          totalRepaid: summary.totalRepaid
        });
      }

      await logAuditEvent('LOAN_SETTLED', `Loan ${loan.id} (৳${loan.originalAmount}) marked as settled/paid in full`, 'info');
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
        unreadNotificationsCount={notificationsList.length}
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
          unreadNotificationsCount={notificationsList.length}
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
          {/* SCREEN 1: DASHBOARD HOME */}
          {activeSection === 'dashboard' && (
            <AdminDashboardHome
              onNavigate={handleNavigateSection}
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
              <div className="space-y-4 max-w-5xl mx-auto">
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

          {/* SCREEN 9: NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <AdminNotificationsView
              notifications={notificationsList}
              onClearAll={handleClearAllNotifications}
              onDismiss={handleDismissNotification}
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

          {/* DIGITAL WORKFORCE / AI EMPLOYEES */}
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
