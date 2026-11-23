import React, { useState, useEffect, useMemo } from 'react';
import { Firestore, doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  PiggyBank, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  Edit3, 
  RefreshCw, 
  X, 
  Search, 
  History, 
  Send, 
  Check, 
  ExternalLink,
  ChevronRight,
  Shield,
  HelpCircle,
  Crown,
  Sparkles,
  Receipt,
  Layers,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { format, formatDistanceToNow, addDays, isBefore, parseISO } from 'date-fns';
import { UserProfile, Transaction } from '../App';

export interface UsedDepositRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  memberId?: string;
  amountUsed: number;
  expectedReturnDate: string; // "YYYY-MM-DD"
  bonusBenefit: string;
  purpose: string;
  approvedAt: string;
  approvedBy: string;
  status: 'active' | 'restored';
  restoredAt?: string;
  restoredBy?: string;
}

export interface MemberDepositAgreement {
  userId: string;
  agreed: boolean;
  expectedRefundDate?: string; // "YYYY-MM-DD"
  notes?: string;
  agreedAt?: string;
  updatedBy?: string;
}

export interface ReservesDoc {
  primaryTarget: number;
  usedDeposits: UsedDepositRecord[];
  memberAgreements?: Record<string, MemberDepositAgreement>;
  subscriptionReserveContribution?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SubscriptionFundRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  memberId?: string;
  tier: string;
  tierName?: string;
  amount: number;
  baseRate?: number;
  discount?: number;
  lateBuffer?: number;
  durationMonths?: number;
  paymentMethod?: string;
  accountNumber?: string;
  transactionId?: string;
  memoId?: string;
  allocatedToReserve?: boolean;
  reserveDestination?: string;
  status?: string;
  timestamp?: any;
  createdAt?: string;
}

export interface ReserveManagementProps {
  db: Firestore;
  reserveFund: number;
  onUpdateReserveFund?: (newAmount: number) => Promise<void>;
  allUsers: UserProfile[];
  allTransactions: Transaction[];
  totalOutstandingDebt: number; // Allocated
  pendingDistributionAmount?: number;
  adminUser?: any;
  sendEmail: (to: string, subject: string, body: string, customHtml?: string, recipientName?: string, category?: string) => Promise<boolean | void>;
  logAuditEvent: (action: string, details: string, severity?: 'info' | 'warning' | 'critical') => Promise<void>;
  addToast: (title: string, body: string, type?: 'info' | 'success' | 'warning') => void;
  onViewMemberDossier?: (user: UserProfile) => void;
}

export const ReserveManagement: React.FC<ReserveManagementProps> = ({
  db,
  reserveFund,
  onUpdateReserveFund,
  allUsers,
  allTransactions,
  totalOutstandingDebt,
  pendingDistributionAmount = 0,
  adminUser,
  sendEmail,
  logAuditEvent,
  addToast,
  onViewMemberDossier
}) => {
  // -------------------------------------------------------------
  // FIRESTORE STATE SYNCHRONIZATION
  // -------------------------------------------------------------
  const [reservesConfig, setReservesConfig] = useState<ReservesDoc>({
    primaryTarget: reserveFund || 500000,
    usedDeposits: [],
    memberAgreements: {}
  });
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const reservesDocRef = doc(db, 'system_controls', 'reserves');
    const unsub = onSnapshot(reservesDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as ReservesDoc;
        setReservesConfig({
          primaryTarget: typeof data.primaryTarget === 'number' ? data.primaryTarget : (reserveFund || 500000),
          usedDeposits: Array.isArray(data.usedDeposits) ? data.usedDeposits : [],
          memberAgreements: data.memberAgreements || {},
          subscriptionReserveContribution: typeof data.subscriptionReserveContribution === 'number' ? data.subscriptionReserveContribution : 0
        });
      } else {
        // Initialize if not present
        setReservesConfig({
          primaryTarget: reserveFund || 500000,
          usedDeposits: [],
          memberAgreements: {},
          subscriptionReserveContribution: 0
        });
      }
      setLoadingConfig(false);
    }, (err) => {
      console.error("Error listening to reserves config:", err);
      setLoadingConfig(false);
    });

    return () => unsub();
  }, [db, reserveFund]);

  // Real-time Subscription Fee Reserve Records Listener
  const [subscriptionFunds, setSubscriptionFunds] = useState<SubscriptionFundRecord[]>([]);
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [subTierFilter, setSubTierFilter] = useState<'all' | 'gold' | 'silver' | 'bronze'>('all');

  useEffect(() => {
    const unsubSubFunds = onSnapshot(collection(db, 'subscription_funds'), (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionFundRecord));
      records.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.createdAt || 0).getTime();
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setSubscriptionFunds(records);
    }, (err) => {
      console.warn("Could not listen to subscription_funds:", err);
    });

    return () => unsubSubFunds();
  }, [db]);

  // Aggregate subscription fee money
  const totalSubscriptionFees = useMemo(() => {
    return subscriptionFunds.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  }, [subscriptionFunds]);

  // Combined Total Reserve: Base Primary Target + Total Subscription Fee Moneys
  const combinedTotalReserve = useMemo(() => {
    return (reservesConfig.primaryTarget || 500000) + totalSubscriptionFees;
  }, [reservesConfig.primaryTarget, totalSubscriptionFees]);

  const filteredSubscriptionFunds = useMemo(() => {
    return subscriptionFunds.filter(r => {
      if (subTierFilter !== 'all' && r.tier?.toLowerCase() !== subTierFilter) return false;
      if (!subSearchQuery.trim()) return true;
      const q = subSearchQuery.toLowerCase();
      return (
        r.userName?.toLowerCase().includes(q) ||
        r.memberId?.toLowerCase().includes(q) ||
        r.userPhone?.toLowerCase().includes(q) ||
        r.transactionId?.toLowerCase().includes(q) ||
        r.memoId?.toLowerCase().includes(q) ||
        r.tier?.toLowerCase().includes(q) ||
        r.paymentMethod?.toLowerCase().includes(q)
      );
    });
  }, [subscriptionFunds, subTierFilter, subSearchQuery]);

  // -------------------------------------------------------------
  // 1. PRIMARY RESERVE CALCULATIONS
  // -------------------------------------------------------------
  const primaryTarget = reservesConfig.primaryTarget;
  const allocated = totalOutstandingDebt; // Debt out on loan
  const availablePrimary = Math.max(0, primaryTarget - allocated);

  // Shortage detection:
  // Base shortage exists if distributed debt already exceeds target
  // Plus any pending distribution amount that cannot be covered by available primary
  const baseDebtShortage = allocated > primaryTarget ? (allocated - primaryTarget) : 0;
  const distributionShortage = pendingDistributionAmount > availablePrimary 
    ? (pendingDistributionAmount - availablePrimary) 
    : 0;
  const currentShortage = Math.max(baseDebtShortage, distributionShortage);

  // -------------------------------------------------------------
  // 2. MEMBER DEPOSIT RESERVE CALCULATIONS
  // -------------------------------------------------------------
  // Member deposits are completely separate and NEVER automatically used
  const membersWithDeposits = useMemo(() => {
    return allUsers.filter(u => (u.totalDeposit || 0) > 0);
  }, [allUsers]);

  const totalMemberDeposits = useMemo(() => {
    return membersWithDeposits.reduce((acc, u) => acc + (u.totalDeposit || 0), 0);
  }, [membersWithDeposits]);

  // Active used deposits in emergency backup
  const activeUsedDeposits = useMemo(() => {
    return reservesConfig.usedDeposits.filter(d => d.status === 'active');
  }, [reservesConfig.usedDeposits]);

  const totalUsedMemberDeposits = useMemo(() => {
    return activeUsedDeposits.reduce((acc, d) => acc + d.amountUsed, 0);
  }, [activeUsedDeposits]);

  // Pending refund transactions by userId
  const pendingRefundsByUser = useMemo(() => {
    const map = new Set<string>();
    allTransactions.forEach(tx => {
      if (tx.type === 'refund' && tx.status === 'pending') {
        map.add(tx.userId);
      }
    });
    return map;
  }, [allTransactions]);

  // -------------------------------------------------------------
  // 4. DEPOSIT ELIGIBILITY ENGINE
  // Condition 1: Member agreed to allow temporary use
  // Condition 2: Expected refund requirement is not too close (>14 days or not set)
  // Condition 3: Using deposit will not create a problem with expected refund
  // -------------------------------------------------------------
  const memberEligibilityMap = useMemo(() => {
    const result: Record<string, {
      eligible: boolean;
      agreed: boolean;
      refundSafe: boolean;
      noConflict: boolean;
      reason?: string;
      expectedRefundDate?: string;
    }> = {};

    membersWithDeposits.forEach(m => {
      const agreement = reservesConfig.memberAgreements?.[m.uid];
      const agreed = agreement ? agreement.agreed : false;
      const expectedRefundDate = agreement?.expectedRefundDate;

      // Check Condition 2: refund requirement not too close
      const hasPendingRefund = pendingRefundsByUser.has(m.uid);
      let refundSafe = !hasPendingRefund;
      if (refundSafe && expectedRefundDate) {
        try {
          const refundDate = parseISO(expectedRefundDate);
          const fourteenDaysAhead = addDays(new Date(), 14);
          if (isBefore(refundDate, fourteenDaysAhead)) {
            refundSafe = false;
          }
        } catch {
          // Invalid date string, treat as safe
        }
      }

      // Check Condition 3: deposit balance > 0 and not already fully used
      const usedForThisMember = activeUsedDeposits
        .filter(d => d.userId === m.uid)
        .reduce((sum, d) => sum + d.amountUsed, 0);
      const remainingDeposit = Math.max(0, (m.totalDeposit || 0) - usedForThisMember);
      const noConflict = remainingDeposit > 0 && !hasPendingRefund;

      const eligible = agreed && refundSafe && noConflict;

      let reason = 'Eligible for Emergency Backup';
      if (!agreed) reason = 'No Member Agreement On Record';
      else if (hasPendingRefund) reason = 'Pending Refund Request In Queue';
      else if (!refundSafe) reason = 'Expected Refund Due Soon (<14 days)';
      else if (!noConflict) reason = 'Deposit Already Fully Deployed';

      result[m.uid] = {
        eligible,
        agreed,
        refundSafe,
        noConflict,
        reason,
        expectedRefundDate
      };
    });

    return result;
  }, [membersWithDeposits, reservesConfig.memberAgreements, pendingRefundsByUser, activeUsedDeposits]);

  // List of members with eligible deposits
  const eligibleMembers = useMemo(() => {
    return membersWithDeposits.filter(m => memberEligibilityMap[m.uid]?.eligible);
  }, [membersWithDeposits, memberEligibilityMap]);

  const totalEligibleBackupAmount = useMemo(() => {
    return eligibleMembers.reduce((sum, m) => {
      const usedForThisMember = activeUsedDeposits
        .filter(d => d.userId === m.uid)
        .reduce((s, d) => s + d.amountUsed, 0);
      return sum + Math.max(0, (m.totalDeposit || 0) - usedForThisMember);
    }, 0);
  }, [eligibleMembers, activeUsedDeposits]);

  // -------------------------------------------------------------
  // MODALS STATE
  // -------------------------------------------------------------
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetInput, setTargetInput] = useState(primaryTarget.toString());
  const [savingTarget, setSavingTarget] = useState(false);

  // Admin Approval Modal: Use Deposit Reserve
  const [selectedMemberToUse, setSelectedMemberToUse] = useState<UserProfile | null>(null);
  const [useAmount, setUseAmount] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [approvedBonus, setApprovedBonus] = useState('5% Emergency Yield (+৳250 BDT)');
  const [usePurpose, setUsePurpose] = useState('Covering Loan Distribution Shortage');
  const [adminConsentConfirmed, setAdminConsentConfirmed] = useState(false);
  const [processingUse, setProcessingUse] = useState(false);

  // Restoration Modal
  const [recordToRestore, setRecordToRestore] = useState<UsedDepositRecord | null>(null);
  const [processingRestore, setProcessingRestore] = useState(false);

  // "View Details" Full Modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsSearch, setDetailsSearch] = useState('');
  const [detailsTab, setDetailsTab] = useState<'vault' | 'history' | 'agreements'>('vault');

  // Distribution Simulator (helps admin check loan amounts in 1 click)
  const [simulatedLoanAmount, setSimulatedLoanAmount] = useState<string>('');
  const simulatedAmountNum = parseFloat(simulatedLoanAmount) || 0;
  const simulatedShortage = simulatedAmountNum > availablePrimary ? (simulatedAmountNum - availablePrimary) : 0;

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const newTarget = parseFloat(targetInput);
    if (isNaN(newTarget) || newTarget < 0) {
      addToast('Invalid Target', 'Please enter a valid non-negative amount.', 'warning');
      return;
    }

    setSavingTarget(true);
    try {
      const updatedConfig: ReservesDoc = {
        ...reservesConfig,
        primaryTarget: newTarget,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUser?.email || 'admin'
      };

      await setDoc(doc(db, 'system_controls', 'reserves'), updatedConfig, { merge: true });

      if (onUpdateReserveFund) {
        await onUpdateReserveFund(newTarget);
      }

      await logAuditEvent(
        'RESERVE_TARGET_UPDATED',
        `Primary Reserve Target updated to ৳${newTarget.toLocaleString()} BDT`,
        'info'
      );

      addToast('Reserve Target Saved', `Primary Reserve Target is now ৳${newTarget.toLocaleString()} BDT`, 'success');
      setShowTargetModal(false);
    } catch (err: any) {
      console.error("Error updating reserve target:", err);
      addToast('Update Failed', err.message || 'Could not save reserve target.', 'warning');
    } finally {
      setSavingTarget(false);
    }
  };

  // Open Approval Modal
  const handleOpenUseDeposit = (member: UserProfile) => {
    setSelectedMemberToUse(member);
    const usedForThisMember = activeUsedDeposits
      .filter(d => d.userId === member.uid)
      .reduce((s, d) => s + d.amountUsed, 0);
    const maxAvailable = Math.max(0, (member.totalDeposit || 0) - usedForThisMember);
    
    // Default use amount: cover current shortage or max available
    const initialAmt = currentShortage > 0 
      ? Math.min(currentShortage, maxAvailable) 
      : maxAvailable;

    setUseAmount(initialAmt.toString());
    setExpectedReturnDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    setApprovedBonus('5% Emergency Yield (+৳' + Math.round(initialAmt * 0.05).toLocaleString() + ' BDT)');
    setUsePurpose(currentShortage > 0 ? `Covering Reserve Shortage of ৳${currentShortage.toLocaleString()}` : 'Emergency Liquidity Backstop');
    setAdminConsentConfirmed(false);
  };

  // Confirm and Execute: Use Deposit Reserve
  const handleConfirmUseDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberToUse) return;

    const amt = parseFloat(useAmount);
    const usedForThisMember = activeUsedDeposits
      .filter(d => d.userId === selectedMemberToUse.uid)
      .reduce((s, d) => s + d.amountUsed, 0);
    const maxAvailable = Math.max(0, (selectedMemberToUse.totalDeposit || 0) - usedForThisMember);

    if (isNaN(amt) || amt <= 0 || amt > maxAvailable) {
      addToast('Invalid Amount', `Amount must be between ৳1 and ৳${maxAvailable.toLocaleString()} BDT`, 'warning');
      return;
    }

    if (!adminConsentConfirmed) {
      addToast('Confirmation Required', 'Please confirm that member consent was verified.', 'warning');
      return;
    }

    setProcessingUse(true);
    try {
      const recordId = `emg_dep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newRecord: UsedDepositRecord = {
        id: recordId,
        userId: selectedMemberToUse.uid,
        userName: selectedMemberToUse.name,
        userEmail: selectedMemberToUse.email,
        memberId: selectedMemberToUse.memberId || `TUT-${selectedMemberToUse.uid.substring(0, 5).toUpperCase()}`,
        amountUsed: amt,
        expectedReturnDate,
        bonusBenefit: approvedBonus.trim(),
        purpose: usePurpose.trim(),
        approvedAt: new Date().toISOString(),
        approvedBy: adminUser?.email || 'admin',
        status: 'active'
      };

      const updatedUsedDeposits = [...reservesConfig.usedDeposits, newRecord];
      const updatedConfig: ReservesDoc = {
        ...reservesConfig,
        usedDeposits: updatedUsedDeposits,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUser?.email || 'admin'
      };

      await setDoc(doc(db, 'system_controls', 'reserves'), updatedConfig, { merge: true });

      // Member Notification & Chief Admin Copy
      if (selectedMemberToUse.email) {
        const reserveBody =
          `Hello ${selectedMemberToUse.name},\n\n` +
          `Under our agreed mutual emergency support guidelines, a portion of your deposit reserve has been temporarily utilized as a syndicate backstop.\n\n` +
          `• Amount Utilized: ৳${amt.toLocaleString()} BDT\n` +
          `• Expected Return / Refund Date: ${format(parseISO(expectedReturnDate), 'dd MMMM yyyy')}\n` +
          `• Approved Member Benefit: ${approvedBonus}\n\n` +
          `Your full deposit balance remains 100% guaranteed by T.U.T. Authority and will be restored immediately upon loan settlements. Thank you for your partnership.\n\n` +
          `T.U.T. Money Lending Authority`;
        await sendEmail(
          selectedMemberToUse.email,
          'Notice: Temporary Emergency Deposit Reserve Authorization',
          reserveBody,
          undefined,
          selectedMemberToUse.name,
          'System'
        );
        if (selectedMemberToUse.email.toLowerCase().trim() !== 'tahsinullahtusher999@gmail.com') {
          sendEmail(
            'tahsinullahtusher999@gmail.com',
            `[Admin Copy] Emergency Deposit Reserve Utilized — ${selectedMemberToUse.name}`,
            `Copy of reserve notice sent to ${selectedMemberToUse.name} (${selectedMemberToUse.email}):\n\n${reserveBody}`,
            undefined,
            'Chief Admin (Copy)',
            'System'
          ).catch(() => {});
        }
      }

      await logAuditEvent(
        'EMERGENCY_DEPOSIT_USED',
        `Admin approved ৳${amt.toLocaleString()} BDT from ${selectedMemberToUse.name}'s deposit reserve. Expected return: ${expectedReturnDate}. Benefit: ${approvedBonus}`,
        'warning'
      );

      addToast(
        'Deposit Reserve Approved',
        `৳${amt.toLocaleString()} BDT utilized from ${selectedMemberToUse.name}. Member has been notified.`,
        'success'
      );

      setSelectedMemberToUse(null);
    } catch (err: any) {
      console.error("Error approving deposit reserve:", err);
      addToast('Action Failed', err.message || 'Could not approve emergency deposit.', 'warning');
    } finally {
      setProcessingUse(false);
    }
  };

  // Confirm and Execute: Restore Deposit
  const handleConfirmRestore = async () => {
    if (!recordToRestore) return;

    setProcessingRestore(true);
    try {
      const updatedRecords = reservesConfig.usedDeposits.map(d => {
        if (d.id === recordToRestore.id) {
          return {
            ...d,
            status: 'restored' as const,
            restoredAt: new Date().toISOString(),
            restoredBy: adminUser?.email || 'admin'
          };
        }
        return d;
      });

      const updatedConfig: ReservesDoc = {
        ...reservesConfig,
        usedDeposits: updatedRecords,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUser?.email || 'admin'
      };

      await setDoc(doc(db, 'system_controls', 'reserves'), updatedConfig, { merge: true });

      // Member Notification: Restored & Chief Admin Copy
      if (recordToRestore.userEmail) {
        const restoreBody =
          `Hello ${recordToRestore.userName},\n\n` +
          `We are pleased to inform you that your temporary emergency deposit usage of ৳${recordToRestore.amountUsed.toLocaleString()} BDT has been fully restored to your vault.\n\n` +
          `• Amount Restored: ৳${recordToRestore.amountUsed.toLocaleString()} BDT\n` +
          `• Benefit Earned: ${recordToRestore.bonusBenefit}\n` +
          `• Restoration Status: 100% Intact & Verified\n\n` +
          `Thank you for supporting T.U.T. syndicate liquidity.\n\n` +
          `T.U.T. Money Lending Authority`;
        await sendEmail(
          recordToRestore.userEmail,
          'Deposit Reserve Restored Successfully',
          restoreBody,
          undefined,
          recordToRestore.userName,
          'System'
        );
        if (recordToRestore.userEmail.toLowerCase().trim() !== 'tahsinullahtusher999@gmail.com') {
          sendEmail(
            'tahsinullahtusher999@gmail.com',
            `[Admin Copy] Deposit Reserve Restored — ${recordToRestore.userName}`,
            `Copy of reserve restoration notice sent to ${recordToRestore.userName} (${recordToRestore.userEmail}):\n\n${restoreBody}`,
            undefined,
            'Chief Admin (Copy)',
            'System'
          ).catch(() => {});
        }
      }

      await logAuditEvent(
        'EMERGENCY_DEPOSIT_RESTORED',
        `Restored ৳${recordToRestore.amountUsed.toLocaleString()} BDT deposit to member ${recordToRestore.userName}`,
        'info'
      );

      addToast('Deposit Restored', `৳${recordToRestore.amountUsed.toLocaleString()} BDT restored to ${recordToRestore.userName}. Member notified.`, 'success');
      setRecordToRestore(null);
    } catch (err: any) {
      console.error("Error restoring deposit:", err);
      addToast('Restoration Failed', err.message || 'Could not restore deposit.', 'warning');
    } finally {
      setProcessingRestore(false);
    }
  };

  // Toggle Member Agreement
  const handleToggleAgreement = async (member: UserProfile, agreed: boolean) => {
    try {
      const currentAgreements = reservesConfig.memberAgreements || {};
      const updatedAgreements = {
        ...currentAgreements,
        [member.uid]: {
          userId: member.uid,
          agreed,
          expectedRefundDate: currentAgreements[member.uid]?.expectedRefundDate || '',
          agreedAt: agreed ? new Date().toISOString() : undefined,
          updatedBy: adminUser?.email || 'admin'
        }
      };

      const updatedConfig: ReservesDoc = {
        ...reservesConfig,
        memberAgreements: updatedAgreements,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUser?.email || 'admin'
      };

      await setDoc(doc(db, 'system_controls', 'reserves'), updatedConfig, { merge: true });
      addToast(
        'Agreement Updated',
        `${member.name} emergency backup consent: ${agreed ? 'Granted' : 'Revoked'}`,
        'info'
      );
    } catch (err: any) {
      console.error("Error updating member agreement:", err);
      addToast('Error', err.message || 'Could not update agreement.', 'warning');
    }
  };

  return (
    <div className="space-y-4 text-left">
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER: 5-SECOND EXECUTIVE SCAN                           */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-wide">T.U.T Reserve Management</h2>
            {currentShortage > 0 ? (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-md uppercase animate-pulse flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Shortage Detected
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Primary Liquidity Healthy
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Primary Reserve serves all normal distributions. Member deposits remain strictly protected as an emergency backup.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setTargetInput(primaryTarget.toString());
              setShowTargetModal(true);
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" /> Set Target
          </button>

          <button
            type="button"
            onClick={() => setShowDetailsModal(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" /> View Details
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* COMBINED RESERVE BANNER                                       */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900 border border-blue-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30">
                Calculated Together
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                100% Zero-Usury Mutual Liquidity Pool
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
              ৳{combinedTotalReserve.toLocaleString()} <span className="text-xs font-semibold text-slate-300">BDT Total Effective Reserve</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0 font-mono text-xs">
          <div className="bg-slate-950/70 border border-white/5 rounded-xl px-3 py-2 text-center">
            <span className="text-[9px] text-slate-400 block font-sans uppercase font-bold">Primary Target</span>
            <span className="font-bold text-white">৳{primaryTarget.toLocaleString()}</span>
          </div>
          <span className="text-slate-500 font-bold text-sm">+</span>
          <div className="bg-slate-950/70 border border-amber-500/20 rounded-xl px-3 py-2 text-center">
            <span className="text-[9px] text-amber-300 block font-sans uppercase font-bold">Subscription Fees</span>
            <span className="font-bold text-amber-400">৳{totalSubscriptionFees.toLocaleString()}</span>
          </div>
          <span className="text-slate-500 font-bold text-sm">=</span>
          <div className="bg-blue-600/20 border border-blue-500/40 rounded-xl px-3 py-2 text-center">
            <span className="text-[9px] text-blue-300 block font-sans uppercase font-bold">Combined Reserve</span>
            <span className="font-black text-emerald-400">৳{combinedTotalReserve.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3 MAIN CARDS: PRIMARY RESERVE, SUBSCRIPTION POOL, MEMBER DEPOSITS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CARD 1: PRIMARY RESERVE */}
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">1. Primary Capital Target</h3>
            </div>
            <span className="text-[10px] font-black uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              Lending First
            </span>
          </div>

          {/* 4 Clean Big Numbers */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Target */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Capital Target</span>
              <div className="text-base sm:text-lg font-black text-white font-mono">
                ৳{primaryTarget.toLocaleString()}
              </div>
              <span className="text-[9px] text-slate-500 block">Baseline Reserve</span>
            </div>

            {/* Allocated */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Allocated</span>
              <div className="text-base sm:text-lg font-black text-blue-400 font-mono">
                ৳{allocated.toLocaleString()}
              </div>
              <span className="text-[9px] text-slate-500 block">Out On Loan</span>
            </div>

            {/* Available */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Available</span>
              <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                ৳{availablePrimary.toLocaleString()}
              </div>
              <span className="text-[9px] text-slate-500 block">Free For Lending</span>
            </div>

            {/* Current Shortage */}
            <div className={`p-2.5 rounded-xl border space-y-0.5 ${
              currentShortage > 0 
                ? 'bg-rose-950/40 border-rose-500/40' 
                : 'bg-slate-950 border-white/5'
            }`}>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Current Shortage</span>
              <div className={`text-base sm:text-lg font-black font-mono ${
                currentShortage > 0 ? 'text-rose-400' : 'text-slate-400'
              }`}>
                {currentShortage > 0 ? `৳${currentShortage.toLocaleString()}` : '৳0'}
              </div>
              <span className={`text-[9px] font-bold block ${
                currentShortage > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {currentShortage > 0 ? 'Primary Deficit' : 'No Shortage'}
              </span>
            </div>
          </div>

          {/* Simple 2-tone bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Allocated vs Target</span>
              <span className="font-mono">{allocated.toLocaleString()} / {primaryTarget.toLocaleString()} BDT</span>
            </div>
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5 flex">
              <div 
                className={`h-full transition-all duration-300 ${allocated > primaryTarget ? 'bg-rose-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, primaryTarget > 0 ? (allocated / primaryTarget) * 100 : 0)}%` }}
              />
              <div 
                className="h-full bg-emerald-500/60 transition-all duration-300"
                style={{ width: `${Math.max(0, primaryTarget > 0 ? ((primaryTarget - allocated) / primaryTarget) * 100 : 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* CARD 2: SUBSCRIPTION FEE RESERVE POOL */}
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                <Crown className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">2. Subscription Fee Pool</h3>
            </div>
            <span className="text-[10px] font-black uppercase text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Auto-Added To Reserve
            </span>
          </div>

          {/* 4 Clean Big Numbers */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Total Collected */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Subscription Fees</span>
              <div className="text-base sm:text-lg font-black text-amber-400 font-mono">
                ৳{totalSubscriptionFees.toLocaleString()}
              </div>
              <span className="text-[9px] text-slate-500 block">100% In Reserve</span>
            </div>

            {/* Total Donors */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Contributors</span>
              <div className="text-base sm:text-lg font-black text-white font-mono">
                {subscriptionFunds.length}
              </div>
              <span className="text-[9px] text-slate-500 block">Paid Subscriptions</span>
            </div>

            {/* Combined Contribution */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Reserve Injection</span>
              <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                +৳{totalSubscriptionFees.toLocaleString()}
              </div>
              <span className="text-[9px] text-slate-500 block">Permanent Liquidity</span>
            </div>

            {/* Sharia Status */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Fund Policy</span>
              <div className="text-xs sm:text-sm font-black text-emerald-400 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Zero Usury
              </div>
              <span className="text-[9px] text-slate-500 block">Zero Profit Retained</span>
            </div>
          </div>

          {/* Status Note */}
          <div className="p-2 bg-slate-950/70 rounded-xl border border-white/5 flex items-center justify-between text-[10px] text-slate-400">
            <span>Merged into Main Reserve</span>
            <span className="text-amber-300 font-bold font-mono">Automatic Real-Time Sync</span>
          </div>
        </div>

        {/* CARD 3: MEMBER DEPOSIT RESERVE */}
        <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-500/20 text-purple-400 rounded-lg">
                <PiggyBank className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">3. Member Deposit Reserve</h3>
            </div>
            <span className="text-[10px] font-black uppercase text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              Emergency Backup Only
            </span>
          </div>

          {/* 4 Clean Big Numbers */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Total Deposits */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Deposits</span>
              <div className="text-base sm:text-lg font-black text-purple-300 font-mono">
                ৳{totalMemberDeposits.toLocaleString()}
              </div>
              <span className="text-[9px] text-slate-500 block">{membersWithDeposits.length} Savers in Vault</span>
            </div>

            {/* Emergency Available (Eligible) */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Emergency Backup</span>
              <div className="text-base sm:text-lg font-black text-indigo-400 font-mono">
                ৳{totalEligibleBackupAmount.toLocaleString()}
              </div>
              <span className="text-[9px] text-slate-500 block">{eligibleMembers.length} Eligible Consented</span>
            </div>

            {/* In Emergency Use */}
            <div className={`p-2.5 rounded-xl border space-y-0.5 ${
              totalUsedMemberDeposits > 0 ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-950 border-white/5'
            }`}>
              <span className="text-[10px] font-bold text-slate-400 uppercase">In Emergency Use</span>
              <div className={`text-base sm:text-lg font-black font-mono ${
                totalUsedMemberDeposits > 0 ? 'text-amber-400' : 'text-slate-400'
              }`}>
                ৳{totalUsedMemberDeposits.toLocaleString()}
              </div>
              <span className="text-[9px] text-slate-500 block">
                {activeUsedDeposits.length} Active Deployments
              </span>
            </div>

            {/* Protection Status */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Protection Status</span>
              <div className="text-xs sm:text-sm font-black text-emerald-400 flex items-center gap-1 mt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Ring-Fenced
              </div>
              <span className="text-[9px] text-slate-500 block">Zero Auto-Contagion</span>
            </div>
          </div>

          {/* Status Note */}
          <div className="p-2 bg-slate-950/70 rounded-xl border border-white/5 flex items-center justify-between text-[10px] text-slate-400">
            <span>Segregated from lending pool</span>
            <span className="text-purple-300 font-bold">Manual Approval Mandatory</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. SHORTAGE DETECTION & ELIGIBLE DEPOSIT BACKUP               */}
      {/* ------------------------------------------------------------- */}
      {currentShortage > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl"
        >
          {/* Header Warning */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-500/20 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">Shortage Alert</span>
                <h3 className="text-base sm:text-lg font-black text-white font-mono">
                  Reserve Shortage: <span className="text-rose-400">৳{currentShortage.toLocaleString()} BDT</span>
                </h3>
              </div>
            </div>
            <p className="text-xs text-rose-200/80 max-w-md">
              Primary Reserve is insufficient. You may manually review eligible member deposits below to cover this gap.
            </p>
          </div>

          {/* Eligible Member Deposits List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">
                Eligible Member Deposits ({eligibleMembers.length})
              </span>
              <span className="text-[10px] text-slate-400">
                Meets: 1) Member Agreed • 2) Refund Safe (&gt;14 days) • 3) No Conflict
              </span>
            </div>

            {eligibleMembers.length === 0 ? (
              <div className="p-4 bg-slate-950/60 rounded-xl border border-white/5 text-center text-xs text-slate-400">
                No member deposits currently meet all 3 eligibility safety conditions. Click "View Details" to review member agreements.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {eligibleMembers.map(m => {
                  const usedForThisMember = activeUsedDeposits
                    .filter(d => d.userId === m.uid)
                    .reduce((s, d) => s + d.amountUsed, 0);
                  const availableDeposit = Math.max(0, (m.totalDeposit || 0) - usedForThisMember);

                  return (
                    <div 
                      key={m.uid} 
                      className="bg-slate-950 p-3 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-colors flex flex-col justify-between gap-2.5"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs truncate max-w-[130px]">{m.name}</span>
                          <span className="text-[9px] font-mono text-slate-400">{m.memberId || m.uid.substring(0, 6)}</span>
                        </div>
                        <div className="text-sm font-black text-purple-300 font-mono">
                          ৳{availableDeposit.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">Available</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-bold">
                          <Check className="w-3 h-3" /> Consented • Refund Safe
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenUseDeposit(m)}
                        className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer flex items-center justify-center gap-1"
                      >
                        Use Deposit Reserve <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. RESTORATION TRACKING                                       */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Deposit Restoration Queue</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {activeUsedDeposits.length} Pending Restorations
          </span>
        </div>

        {activeUsedDeposits.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-white/5">
            <CheckCircle2 className="w-6 h-6 text-emerald-400/60 mx-auto mb-1.5" />
            <p className="font-bold text-slate-300">All Member Deposits Intact</p>
            <p className="text-[11px] text-slate-500">Zero emergency member deposits are currently in use.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeUsedDeposits.map((rec) => {
              const returnDate = parseISO(rec.expectedReturnDate);
              const daysLeft = Math.ceil((returnDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));

              return (
                <div key={rec.id} className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-xs">{rec.userName}</h4>
                      <span className="text-[9px] font-mono text-slate-400">{rec.memberId}</span>
                    </div>
                    <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      In Use
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Amount Used:</span>
                      <span className="font-mono font-black text-amber-300">৳{rec.amountUsed.toLocaleString()} BDT</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Return Date:</span>
                      <span className="font-mono text-slate-200">
                        {format(returnDate, 'dd MMM yyyy')} ({daysLeft > 0 ? `${daysLeft}d left` : 'Due'})
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Bonus Benefit:</span>
                      <span className="text-emerald-400 font-bold truncate max-w-[130px]">{rec.bonusBenefit}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRecordToRestore(rec)}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Restore Deposit to Member
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. SUBSCRIPTION FEE FUNDS RECORD & DONOR HISTORY              */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">Subscription Fee Funds & Donor History</h3>
                <span className="text-[10px] font-black uppercase text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  100% In Main Reserve
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Detailed record of all subscription moneys collected and automatically calculated together with the Main Reserve.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-amber-500/20 text-right">
              <span className="text-[9px] text-slate-400 block font-sans uppercase font-bold">Total Subscription Pool</span>
              <span className="text-sm font-black text-amber-400">৳{totalSubscriptionFees.toLocaleString()} BDT</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search member, ID, phone, TrxID..."
              value={subSearchQuery}
              onChange={(e) => setSubSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto hide-scrollbar">
            {(['all', 'gold', 'silver', 'bronze'] as const).map(tierKey => (
              <button
                key={tierKey}
                type="button"
                onClick={() => setSubTierFilter(tierKey)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  subTierFilter === tierKey
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {tierKey === 'all' ? 'All Tiers' : tierKey}
              </button>
            ))}
          </div>
        </div>

        {/* Ledger Table */}
        {filteredSubscriptionFunds.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-white/5 space-y-1">
            <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-1" />
            <p className="font-bold text-slate-300">No Subscription Fee Records Found</p>
            <p className="text-[11px] text-slate-500">
              {subscriptionFunds.length === 0 
                ? 'When members purchase subscriptions, detailed records and reserve injections appear here.'
                : 'No subscription transactions match your current search/filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 border-b border-white/10">
                <tr>
                  <th className="px-3.5 py-2.5">Date & Time</th>
                  <th className="px-3.5 py-2.5">Member Details</th>
                  <th className="px-3.5 py-2.5">Tier Plan</th>
                  <th className="px-3.5 py-2.5 text-right">Fee Paid</th>
                  <th className="px-3.5 py-2.5">Method & Reference</th>
                  <th className="px-3.5 py-2.5 text-center">Reserve Allocation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {filteredSubscriptionFunds.map((rec) => {
                  let dateStr = 'Recent';
                  try {
                    if (typeof rec.timestamp?.toDate === 'function') {
                      dateStr = format(rec.timestamp.toDate(), 'dd MMM yyyy, hh:mm a');
                    } else if (typeof rec.timestamp?.toMillis === 'function') {
                      dateStr = format(new Date(rec.timestamp.toMillis()), 'dd MMM yyyy, hh:mm a');
                    } else if (typeof rec.timestamp?.seconds === 'number') {
                      dateStr = format(new Date(rec.timestamp.seconds * 1000), 'dd MMM yyyy, hh:mm a');
                    } else if (rec.createdAt) {
                      const d = new Date(rec.createdAt);
                      if (!isNaN(d.getTime())) dateStr = format(d, 'dd MMM yyyy, hh:mm a');
                    }
                  } catch {}

                  const isGold = rec.tier?.toLowerCase() === 'gold';
                  const isSilver = rec.tier?.toLowerCase() === 'silver';

                  return (
                    <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3.5 py-3 whitespace-nowrap text-slate-400 font-sans text-[11px]">
                        {dateStr}
                      </td>

                      <td className="px-3.5 py-3 font-sans">
                        <div className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span>{rec.userName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                          <span>ID: {rec.memberId || 'N/A'}</span>
                          {rec.userPhone && <span>• {rec.userPhone}</span>}
                        </div>
                        {rec.userEmail && (
                          <div className="text-[9.5px] text-slate-500 truncate max-w-[180px]">
                            {rec.userEmail}
                          </div>
                        )}
                      </td>

                      <td className="px-3.5 py-3 whitespace-nowrap font-sans">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                          isGold 
                            ? 'bg-amber-500/20 text-amber-300 border-amber-400/40' 
                            : isSilver 
                            ? 'bg-slate-300/20 text-slate-200 border-slate-300/40' 
                            : 'bg-amber-700/20 text-amber-400 border-amber-700/40'
                        }`}>
                          <span>{isGold ? '👑 Gold' : isSilver ? '🥈 Silver' : '🥉 Bronze'}</span>
                          {rec.durationMonths && <span className="opacity-80 font-normal">({rec.durationMonths}M)</span>}
                        </span>
                      </td>

                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="text-sm font-black text-amber-400 font-mono">
                          ৳{(Number(rec.amount) || 0).toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-500 font-sans">
                          Net Contribution
                        </div>
                      </td>

                      <td className="px-3.5 py-3 font-sans">
                        <div className="font-semibold text-slate-200 text-xs">
                          {rec.paymentMethod || 'bKash'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                          Trx: {rec.transactionId || rec.memoId || 'N/A'}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 text-center whitespace-nowrap font-sans">
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Added to Reserve</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* QUICK DISTRIBUTION SIMULATOR                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Distribution Shortage Checker</h3>
            <p className="text-[11px] text-slate-400">
              Test whether the Primary Reserve can support an upcoming loan disbursal without creating a shortage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="e.g. 100000"
              value={simulatedLoanAmount}
              onChange={(e) => setSimulatedLoanAmount(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono w-36 focus:outline-none focus:border-blue-500"
            />
            {simulatedAmountNum > 0 && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                simulatedShortage > 0 
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {simulatedShortage > 0 ? `Shortage: ৳${simulatedShortage.toLocaleString()}` : '✓ Fully Covered'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* MODAL 1: SET RESERVE TARGET                                   */}
      {/* ============================================================= */}
      <AnimatePresence>
        {showTargetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white">Set Primary Reserve Target</h3>
                </div>
                <button 
                  onClick={() => setShowTargetModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTarget} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase">Reserve Target Amount (BDT)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1000"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-base font-bold font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Presets */}
                <div className="flex gap-2">
                  {[200000, 500000, 1000000, 2000000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTargetInput(val.toString())}
                      className="flex-1 py-1 text-[10px] font-bold bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-white/5 transition-colors cursor-pointer"
                    >
                      {val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}K`}
                    </button>
                  ))}
                </div>

                {/* Preview summary */}
                <div className="p-3 bg-slate-950 rounded-xl border border-white/5 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Currently Allocated Debt:</span>
                    <span className="font-mono text-white">৳{allocated.toLocaleString()} BDT</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Resulting Available Primary:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      ৳{Math.max(0, (parseFloat(targetInput) || 0) - allocated).toLocaleString()} BDT
                    </span>
                  </div>
                  {(parseFloat(targetInput) || 0) < allocated && (
                    <div className="text-[11px] text-rose-400 pt-1 font-bold">
                      ⚠️ Target is less than active debt. Will result in ৳{(allocated - (parseFloat(targetInput) || 0)).toLocaleString()} shortage.
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTargetModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTarget}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer disabled:opacity-50"
                  >
                    {savingTarget ? 'Saving...' : 'Save Target'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================= */}
      {/* MODAL 2: ADMIN APPROVAL - USE DEPOSIT RESERVE                 */}
      {/* ============================================================= */}
      <AnimatePresence>
        {selectedMemberToUse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-purple-500/30 rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <div>
                    <h3 className="text-base font-bold text-white">Approve Emergency Deposit Usage</h3>
                    <span className="text-[10px] text-purple-300 font-mono">Manual Admin Authorization</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedMemberToUse(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmUseDeposit} className="space-y-3.5">
                {/* Member Summary Header */}
                <div className="p-3 bg-slate-950 rounded-xl border border-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-xs">{selectedMemberToUse.name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ID: {selectedMemberToUse.memberId || selectedMemberToUse.uid.substring(0, 8)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 uppercase block font-bold">Total Deposit Vault</span>
                    <span className="text-sm font-black text-purple-300 font-mono">
                      ৳{(selectedMemberToUse.totalDeposit || 0).toLocaleString()} BDT
                    </span>
                  </div>
                </div>

                {/* Amount to Use */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase">Amount to Utilize (BDT)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={(selectedMemberToUse.totalDeposit || 0)}
                    value={useAmount}
                    onChange={(e) => setUseAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold font-mono text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Expected Return Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase">Expected Return / Refund Date</label>
                  <input
                    type="date"
                    required
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Approved Bonus / Benefit */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase">Approved Member Bonus / Benefit</label>
                  <input
                    type="text"
                    required
                    value={approvedBonus}
                    onChange={(e) => setApprovedBonus(e.target.value)}
                    placeholder="e.g. 5% Emergency Yield (+৳250 BDT)"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Purpose */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase">Distribution Shortage Purpose</label>
                  <input
                    type="text"
                    required
                    value={usePurpose}
                    onChange={(e) => setUsePurpose(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Admin Mandatory Consent Checkbox */}
                <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="consentCheck"
                    checked={adminConsentConfirmed}
                    onChange={(e) => setAdminConsentConfirmed(e.target.checked)}
                    className="mt-0.5 accent-purple-600 rounded"
                  />
                  <label htmlFor="consentCheck" className="text-[11px] text-purple-200/90 leading-tight cursor-pointer">
                    I confirm this member consented to temporary emergency use, their expected refund schedule is safe, and this action will immediately notify the member.
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMemberToUse(null)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processingUse || !adminConsentConfirmed}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {processingUse ? 'Authorizing...' : 'Confirm & Use Deposit'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================= */}
      {/* MODAL 3: CONFIRM RESTORATION                                  */}
      {/* ============================================================= */}
      <AnimatePresence>
        {recordToRestore && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">Restore Member Deposit</h3>
                </div>
                <button 
                  onClick={() => setRecordToRestore(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-white/5 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Member Name:</span>
                  <span className="font-bold text-white">{recordToRestore.userName}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Amount to Restore:</span>
                  <span className="font-mono font-black text-emerald-400">৳{recordToRestore.amountUsed.toLocaleString()} BDT</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Bonus Benefit Promised:</span>
                  <span className="text-purple-300 font-bold">{recordToRestore.bonusBenefit}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Confirming restoration will close this emergency deployment, restore the member's vault ledger status, and send an automated email notification confirming full recovery with bonus.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRecordToRestore(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={processingRestore}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {processingRestore ? 'Restoring...' : 'Confirm Restoration'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================= */}
      {/* MODAL 4: VIEW DETAILS (ALL VAULT DEPOSITS & AGREEMENTS)        */}
      {/* ============================================================= */}
      <AnimatePresence>
        {showDetailsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-2xl p-5 sm:p-6 w-full max-w-3xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Reserve Details & Member Vault Ledger</h3>
                  <p className="text-xs text-slate-400">Full transparency into member deposit reserves and emergency eligibility.</p>
                </div>
                <button 
                  onClick={() => setShowDetailsModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-tabs inside View Details modal */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDetailsTab('vault')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      detailsTab === 'vault' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Depositors Vault ({membersWithDeposits.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsTab('history')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      detailsTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Restoration History ({reservesConfig.usedDeposits.length})
                  </button>
                </div>

                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={detailsSearch}
                    onChange={(e) => setDetailsSearch(e.target.value)}
                    placeholder="Filter by name or ID..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 rounded-xl">
                {detailsTab === 'vault' ? (
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5">Member</th>
                        <th className="px-3 py-2.5">Deposit Balance</th>
                        <th className="px-3 py-2.5">Agreement Consent</th>
                        <th className="px-3 py-2.5">Eligibility Status</th>
                        <th className="px-3 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {membersWithDeposits
                        .filter(m => 
                          m.name.toLowerCase().includes(detailsSearch.toLowerCase()) || 
                          (m.memberId && m.memberId.toLowerCase().includes(detailsSearch.toLowerCase()))
                        )
                        .map(m => {
                          const elig = memberEligibilityMap[m.uid];
                          return (
                            <tr key={m.uid} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-3 py-2.5">
                                <div className="font-bold text-white">{m.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{m.memberId || m.uid.substring(0, 6)}</div>
                              </td>
                              <td className="px-3 py-2.5 font-mono font-black text-purple-300">
                                ৳{(m.totalDeposit || 0).toLocaleString()} BDT
                              </td>
                              <td className="px-3 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAgreement(m, !elig?.agreed)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                    elig?.agreed 
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30' 
                                      : 'bg-slate-800 text-slate-400 border-white/10 hover:text-white'
                                  }`}
                                >
                                  {elig?.agreed ? '✓ Consented' : '+ Grant Consent'}
                                </button>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                                  elig?.eligible 
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                    : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {elig?.reason}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {elig?.eligible ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowDetailsModal(false);
                                      handleOpenUseDeposit(m);
                                    }}
                                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-bold transition-all shadow"
                                  >
                                    Use Deposit
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-500">Not Eligible</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                ) : (
                  <div className="divide-y divide-white/5 text-xs">
                    {reservesConfig.usedDeposits.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs">
                        No historical emergency deposit usages logged yet.
                      </div>
                    ) : (
                      reservesConfig.usedDeposits.map(rec => (
                        <div key={rec.id} className="p-3 hover:bg-slate-800/40 flex items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{rec.userName}</span>
                              <span className={`px-1.5 py-0.2 text-[9px] rounded font-bold uppercase ${
                                rec.status === 'restored' 
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}>
                                {rec.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Approved: {format(parseISO(rec.approvedAt), 'dd MMM yyyy')} • Return: {format(parseISO(rec.expectedReturnDate), 'dd MMM yyyy')}
                            </div>
                            <div className="text-[10px] text-purple-300">
                              Bonus: {rec.bonusBenefit}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-black text-amber-300 text-sm">
                              ৳{rec.amountUsed.toLocaleString()} BDT
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
