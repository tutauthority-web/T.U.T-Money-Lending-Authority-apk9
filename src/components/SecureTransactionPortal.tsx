import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Lock,
  Search,
  Building2,
  Wallet,
  Calendar,
  User,
  Hash,
  FileText,
  Coins,
  AlertCircle,
  ArrowRight,
  Smartphone,
  Fingerprint,
  Info,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { db, auth } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { executeAtomicP2PTransfer } from '../utils/bankingLedgerEngine';
import { cn, getSubscriptionPricing } from '../App';
import { BkashLogo, NagadLogo } from './PaymentBrandLogos';
import {
  calculateAuthorizedRepaymentWindow,
  formatDurationLabel,
  validateRepaymentDate
} from '../utils/repaymentTermEngine';

interface SecureTransactionPortalProps {
  type: 'loan' | 'deposit' | 'pay_due' | 'refund' | 'transfer' | 'subscription';
  profile: any;
  transactions?: any[];
  onClose: () => void;
  addToast: (title: string, description: string, variant: 'success' | 'danger' | 'warning' | 'info') => void;
  sendNotification: (subject: string, message: string, targetEmail: string) => void;
  sendWorkflowNotification?: (
    eventType: any,
    memberEmail: string | undefined,
    memberName: string,
    details?: any
  ) => Promise<void>;

  // Subscription specific props
  selectedSubTier?: 'bronze' | 'silver' | 'gold' | null;
  setSelectedSubTier?: (tier: 'bronze' | 'silver' | 'gold' | null) => void;
  subSenderMobile?: string;
  setSubSenderMobile?: (val: string) => void;
  subTrxId?: string;
  setSubTrxId?: (val: string) => void;
  subWallet?: 'Bkash' | 'Nagad' | 'Recharge' | 'Cash';
  setSubWallet?: (val: 'Bkash' | 'Nagad' | 'Recharge' | 'Cash') => void;
  handleBuySubscription?: (e: React.FormEvent) => void;
}

const CopyBtn = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shrink-0',
        copied
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
          : 'bg-white/5 text-slate-200 border-white/15 hover:bg-white/10 hover:border-white/25'
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

export const SecureTransactionPortal: React.FC<SecureTransactionPortalProps> = ({
  type,
  profile,
  transactions = [],
  onClose,
  addToast,
  sendNotification,
  sendWorkflowNotification,
  selectedSubTier = 'bronze',
  subSenderMobile: propSubSenderMobile = '',
  setSubSenderMobile: propSetSubSenderMobile,
  subTrxId: propSubTrxId = '',
  setSubTrxId: propSetSubTrxId,
  subWallet: propSubWallet = 'Bkash',
  setSubWallet: propSetSubWallet,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Default Wallet States
  const [hasDefaultWallet, setHasDefaultWallet] = useState(false);
  const [defaultWalletName, setDefaultWalletName] = useState('');

  // Form Field States
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'Cash' | 'Bkash' | 'Nagad' | 'Recharge'>('Bkash');
  const [mobileOperator, setMobileOperator] = useState<string>('Grameenphone');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [trxId, setTrxId] = useState('');
  const [loanReason, setLoanReason] = useState('Education Support');
  const [showRepaymentFactors, setShowRepaymentFactors] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cash payment fields
  const [cashPayerName, setCashPayerName] = useState('');
  const [cashPayerPhone, setCashPayerPhone] = useState('');
  const [confirmCashPayerPhone, setConfirmCashPayerPhone] = useState('');

  // Transfer peer specifics
  const [transferIdentifier, setTransferIdentifier] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifiedRecipient, setVerifiedRecipient] = useState<any | null>(null);
  const [transferError, setTransferError] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [transferSuccess, setTransferSuccess] = useState<any | null>(null);

  // Subscription locals
  const [localSubSenderMobile, setLocalSubSenderMobile] = useState('');
  const [localSubTrxId, setLocalSubTrxId] = useState('');
  const [localSubWallet, setLocalSubWallet] = useState<'Bkash' | 'Nagad' | 'Recharge' | 'Cash'>('Bkash');

  const subSenderMobile = propSetSubSenderMobile ? propSubSenderMobile : localSubSenderMobile;
  const setSubSenderMobile = propSetSubSenderMobile ? propSetSubSenderMobile : setLocalSubSenderMobile;
  const subTrxId = propSetSubTrxId ? propSubTrxId : localSubTrxId;
  const setSubTrxId = propSetSubTrxId ? propSetSubTrxId : setLocalSubTrxId;
  const subWallet = propSetSubWallet ? propSubWallet : localSubWallet;
  const setSubWallet = propSetSubWallet ? propSetSubWallet : setLocalSubWallet;

  // Dynamic Repayment Window Engine
  const parsedAmount = parseFloat(amount) || 0;
  const repaymentEligibility = useMemo(
    () => calculateAuthorizedRepaymentWindow(profile, transactions, parsedAmount),
    [profile, transactions, parsedAmount]
  );

  const [estimatedRepaymentDate, setEstimatedRepaymentDate] = useState(() =>
    repaymentEligibility.defaultDateStr
  );

  // Stable preview reference code so it never flickers on animation frames
  const previewRefCode = useMemo(
    () => `TUT-TX-${Math.floor(100000 + Math.random() * 900000)}`,
    []
  );

  // Hold-and-Press Animation Refs & State (Silky 60fps requestAnimationFrame)
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [earlyReleaseHint, setEarlyReleaseHint] = useState(false);
  const [goalCelebration, setGoalCelebration] = useState(false);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const holdStartTimeRef = useRef<number>(0);
  const releaseStartTimeRef = useRef<number>(0);
  const releaseStartValRef = useRef<number>(0);
  const isSubmittingRef = useRef(false);

  const HOLD_DURATION_MS = 1050;
  const RELEASE_DRAIN_MS = 220;

  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.25);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.34);
      gain2.gain.setValueAtTime(0.1, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.32);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.4);
    } catch {
      // audio context blocked
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    setMethod('Bkash');

    const fetchDefaultWallet = async () => {
      const currentUserUid = auth.currentUser?.uid;
      if (!currentUserUid) return;

      if (type === 'loan' || type === 'refund') {
        try {
          const walletsRef = collection(db, `users/${currentUserUid}/wallets`);
          const q = query(walletsRef, where('isVerified', '==', true), where('isDefault', '==', true));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const defaultW = snap.docs[0].data();
            const mappedMethod = defaultW.provider === 'bKash' ? 'Bkash' : 'Nagad';
            setMethod(mappedMethod as any);
            setAccountNumber(defaultW.mobileNumber);
            setConfirmAccountNumber(defaultW.mobileNumber);
            setHasDefaultWallet(true);
            setDefaultWalletName(`${defaultW.provider} • ${defaultW.mobileNumber}`);
          } else {
            setHasDefaultWallet(false);
            setDefaultWalletName('');
          }
        } catch (err) {
          console.error('Error loading default wallet: ', err);
        }
      } else {
        setHasDefaultWallet(false);
        setDefaultWalletName('');
      }
    };

    fetchDefaultWallet();
  }, [type]);

  // Compute Step 1 Limit & Utilization
  const userTier = profile.subscriptionTier || 'bronze';
  const defaultTierLimit = userTier === 'gold' ? 2500 : userTier === 'silver' ? 1500 : 500;
  const borrowingLimit = profile.borrowingLimit ?? defaultTierLimit;
  const remainingDebt = Math.max(0, profile.remainingDebt || 0);
  const availableBorrowCapacity = Math.max(0, borrowingLimit - remainingDebt);
  const usedPercentage =
    type === 'loan' || type === 'pay_due'
      ? Math.min(100, Math.max(0, (remainingDebt / Math.max(1, borrowingLimit)) * 100))
      : 0;

  const utilizationStrokeColor =
    usedPercentage <= 30
      ? 'stroke-emerald-400'
      : usedPercentage <= 60
        ? 'stroke-amber-400'
        : usedPercentage <= 80
          ? 'stroke-orange-400'
          : 'stroke-rose-500';

  const repaymentDateValidation = useMemo(
    () => validateRepaymentDate(estimatedRepaymentDate, repaymentEligibility),
    [estimatedRepaymentDate, repaymentEligibility]
  );

  // Validation routines per step
  const step1ValidationError = useMemo(() => {
    if (type === 'subscription') return '';
    if (!amount.trim()) return '';
    if (isNaN(parsedAmount) || parsedAmount <= 0) return 'Enter a valid amount greater than ৳0.';

    if (type === 'loan' && parsedAmount > availableBorrowCapacity) {
      return `Exceeds your available borrow capacity (৳${availableBorrowCapacity.toLocaleString()}).`;
    }
    if (type === 'pay_due' && parsedAmount > remainingDebt) {
      return `Cannot exceed your outstanding due of ৳${remainingDebt.toLocaleString()}.`;
    }
    if ((type === 'refund' || type === 'transfer') && parsedAmount > (profile.totalDeposit || 0)) {
      return `Exceeds your available vault balance (৳${(profile.totalDeposit || 0).toLocaleString()}).`;
    }
    return '';
  }, [type, amount, parsedAmount, availableBorrowCapacity, remainingDebt, profile.totalDeposit]);

  const isStep1Valid = useCallback(() => {
    if (type === 'subscription') return true;
    if (isNaN(parsedAmount) || parsedAmount <= 0) return false;
    if (step1ValidationError) return false;

    if (type === 'transfer') {
      if (!verifiedRecipient) return false;
      if (transferPassword.trim().length === 0) return false;
    }
    if (type === 'loan') {
      if (loanReason.trim().length < 3) return false;
      if (!repaymentDateValidation.valid) return false;
    }
    return true;
  }, [
    type,
    parsedAmount,
    step1ValidationError,
    verifiedRecipient,
    transferPassword,
    loanReason,
    repaymentDateValidation.valid,
  ]);

  const isStep2Valid = useCallback(() => {
    if (!isStep1Valid()) return false;
    if (type === 'transfer') return true;

    const currentWallet = type === 'subscription' ? subWallet : method;

    if (currentWallet === 'Cash') {
      if (type === 'loan' || type === 'refund') return true;
      if (type === 'subscription') {
        return subSenderMobile.trim().length > 0 && subTrxId.trim().length > 0;
      }
      return (
        cashPayerName.trim().length > 0 &&
        cashPayerPhone.trim().length > 0 &&
        cashPayerPhone.trim() === confirmCashPayerPhone.trim()
      );
    }

    const currentAcct = (type === 'subscription' ? subSenderMobile : accountNumber).trim();
    const currentConfirm = (type === 'subscription' ? subSenderMobile : confirmAccountNumber).trim();

    if (!currentAcct) return false;
    if (type !== 'subscription' && currentAcct !== currentConfirm) return false;
    if (type === 'subscription' && !subTrxId.trim()) return false;

    return true;
  }, [
    isStep1Valid,
    type,
    subWallet,
    method,
    subSenderMobile,
    subTrxId,
    cashPayerName,
    cashPayerPhone,
    confirmCashPayerPhone,
    accountNumber,
    confirmAccountNumber,
  ]);

  const isStep2Invalid = useCallback(() => !isStep2Valid(), [isStep2Valid]);

  const handlePresetSelect = (val: number) => {
    setAmount(val.toString());
  };

  const handleVerifyRecipient = async () => {
    if (!transferIdentifier.trim()) {
      setTransferError('Enter Member ID, Phone, or Email.');
      return;
    }

    setVerifyLoading(true);
    setTransferError('');
    setVerifiedRecipient(null);

    try {
      const identifierClean = transferIdentifier.trim();
      const currentUserUid = auth.currentUser?.uid;

      if (!currentUserUid) {
        setTransferError('You must be logged in to transfer.');
        return;
      }

      const candidates = new Set<string>();
      candidates.add(identifierClean);
      candidates.add(identifierClean.toLowerCase());
      candidates.add(identifierClean.toUpperCase());

      const digits = identifierClean.replace(/\D/g, '');
      if (digits) {
        candidates.add(digits);
        let base11 = '';
        if (digits.length === 11 && digits.startsWith('0')) {
          base11 = digits;
        } else if (digits.length === 13 && digits.startsWith('880')) {
          base11 = '0' + digits.substring(3);
        } else if (digits.length === 14 && digits.startsWith('880')) {
          base11 = '0' + digits.substring(4);
        } else if (digits.length === 10 && !digits.startsWith('0')) {
          base11 = '0' + digits;
        }

        if (base11 && base11.length === 11) {
          candidates.add(base11);
          candidates.add(`${base11.substring(0, 5)}-${base11.substring(5)}`);
          candidates.add(`${base11.substring(0, 4)}-${base11.substring(4)}`);
          candidates.add(`+88${base11.substring(0, 5)}-${base11.substring(5)}`);
          candidates.add(`+88${base11}`);
          candidates.add(`88${base11}`);
        }
      }

      const numSuffixMatch = identifierClean.match(/\d+$/);
      if (numSuffixMatch) {
        const suffix = numSuffixMatch[0];
        candidates.add(`TUT-MBR-2026-${suffix}`);
        candidates.add(`TUT-MBR-2026-${suffix.padStart(4, '0')}`);
        candidates.add(`MBR-${suffix}`);
        candidates.add(`TUT-${suffix}`);
        candidates.add(`TUT-MBR-${suffix}`);
      }

      const uniqueCandidates = Array.from(candidates);
      let foundUser: any = null;

      const queriesToRun: any[] = [];
      uniqueCandidates.forEach((cand) => {
        queriesToRun.push(query(collection(db, 'users'), where('memberId', '==', cand)));
        queriesToRun.push(query(collection(db, 'users'), where('phone', '==', cand)));
        if (cand.includes('@')) {
          queriesToRun.push(query(collection(db, 'users'), where('email', '==', cand.toLowerCase())));
        }
      });

      if (queriesToRun.length > 0) {
        const chunkSize = 10;
        for (let i = 0; i < queriesToRun.length; i += chunkSize) {
          const chunk = queriesToRun.slice(i, i + chunkSize);
          const snaps = await Promise.all(chunk.map((q) => getDocs(q)));
          for (const snap of snaps) {
            if (!snap.empty) {
              foundUser = { uid: snap.docs[0].id, ...(snap.docs[0].data() as any) };
              break;
            }
          }
          if (foundUser) break;
        }
      }

      if (!foundUser && /^[a-zA-Z\s.-]+$/.test(identifierClean) && identifierClean.length >= 3) {
        const titleCase = identifierClean
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        const nameCandidates = Array.from(
          new Set([identifierClean, titleCase, identifierClean.toUpperCase(), identifierClean.toLowerCase()])
        );
        const nameSnaps = await Promise.all(
          nameCandidates.map((nc) => getDocs(query(collection(db, 'users'), where('name', '==', nc))))
        );
        for (const snap of nameSnaps) {
          if (!snap.empty) {
            foundUser = { uid: snap.docs[0].id, ...(snap.docs[0].data() as any) };
            break;
          }
        }

        if (!foundUser) {
          const prefixSnap = await getDocs(
            query(
              collection(db, 'users'),
              where('name', '>=', titleCase),
              where('name', '<=', titleCase + '\uf8ff')
            )
          );
          if (!prefixSnap.empty) {
            foundUser = { uid: prefixSnap.docs[0].id, ...(prefixSnap.docs[0].data() as any) };
          }
        }
      }

      if (!foundUser) {
        setTransferError('No T.U.T. account found matching that ID, phone, email, or name.');
      } else if (foundUser.uid === currentUserUid) {
        setTransferError('You cannot transfer funds to your own account.');
      } else if (foundUser.status !== 'approved') {
        setTransferError('Recipient account is not approved yet.');
      } else {
        setVerifiedRecipient(foundUser);
        addToast('Recipient Verified', `Ready to send to ${foundUser.name}`, 'success');
      }
    } catch (err) {
      console.error('Error verifying recipient:', err);
      setTransferError('Failed to verify recipient. Try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const executeTransferSubmit = async () => {
    if (!verifiedRecipient || !auth.currentUser) return;
    const transferAmt = parseFloat(amount);

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (user && user.email) {
        let authPassword = transferPassword;
        if (user.email === 'tahsinullahtusher999@gmail.com' && transferPassword === '9900') {
          authPassword = '9900_TUT2026_ADMIN';
        }
        const credential = EmailAuthProvider.credential(user.email, authPassword);
        await reauthenticateWithCredential(user, credential);
      } else {
        throw new Error('Email authentication missing.');
      }

      const result = await executeAtomicP2PTransfer(db, {
        senderUid: user.uid,
        recipientUid: verifiedRecipient.uid,
        amount: transferAmt,
        senderName: profile.name,
        recipientName: verifiedRecipient.name,
        senderMemberId: profile.memberId || 'Approved Member',
        recipientMemberId: verifiedRecipient.memberId || 'Approved Member',
        reference: transferReference.trim(),
      });

      setTransferSuccess({
        amount: result.transferredAmount,
        recipientName: verifiedRecipient.name,
        recipientId: verifiedRecipient.memberId || 'Approved Member',
        memoId: result.senderMemoId,
        date: new Date(),
        reference: transferReference.trim(),
      });

      addToast('Transfer Completed', `Successfully sent ৳${transferAmt.toLocaleString()} BDT`, 'success');
      if (sendWorkflowNotification) {
        await sendWorkflowNotification('p2p_transfer_sent', user.email || undefined, profile.name, {
          amount: transferAmt,
          type: 'transfer',
          memoId: result.senderMemoId,
          notes: `${verifiedRecipient.name} (${verifiedRecipient.memberId || 'Member'})`
        });
        if (verifiedRecipient.email) {
          await sendWorkflowNotification('p2p_transfer_received', verifiedRecipient.email, verifiedRecipient.name, {
            amount: transferAmt,
            type: 'transfer',
            memoId: result.recipientMemoId || result.senderMemoId,
            notes: `${profile.name} (${profile.memberId || 'Member'})`
          });
        }
      } else {
        sendNotification(
          'T.U.T. Ledger Funds Dispatched',
          `You have sent ৳${transferAmt.toLocaleString()} to ${verifiedRecipient.name}.`,
          user.email
        );
        if (verifiedRecipient.email) {
          sendNotification(
            'T.U.T. Ledger Funds Received',
            `You have received ৳${transferAmt.toLocaleString()} from ${profile.name}.`,
            verifiedRecipient.email
          );
        }
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Incorrect account password. Please try again.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMsg = 'Incorrect password. Enter the password you use to sign into your T.U.T. account.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      addToast('Verification Failed', errorMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleStandardRequestSubmit = async (isBackground = false) => {
    if (!auth.currentUser || !profile) return;
    const reqAmt = parseFloat(amount);

    if (type === 'loan') {
      const proposedTotalDebt = (profile.remainingDebt || 0) + reqAmt;
      if (proposedTotalDebt > borrowingLimit) {
        addToast(
          'Borrowing Limit Exceeded',
          `Your total debt with this request (৳${proposedTotalDebt.toLocaleString()}) exceeds your ${userTier.toUpperCase()} tier limit (৳${borrowingLimit.toLocaleString()}).`,
          'warning'
        );
        return;
      }
      if (!repaymentDateValidation.valid) {
        addToast(
          'Invalid Repayment Date',
          repaymentDateValidation.error || 'Selected date exceeds your authorized repayment term.',
          'warning'
        );
        return;
      }
    }

    setLoading(true);
    try {
      const txMemoId = `TUT-TX-${Math.floor(100000 + Math.random() * 900000)}`;
      const payload: any = {
        userId: auth.currentUser.uid,
        userName: profile.name,
        userEmail: profile.email || auth.currentUser.email || '',
        userPhone: profile.phone || '',
        memberId: profile.memberId || 'N/A',
        type: type === 'pay_due' ? 'pay_due' : type,
        amount: reqAmt,
        method,
        status: 'pending',
        memoId: txMemoId,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      };

      if (type === 'loan' || type === 'refund') {
        if (method === 'Cash') {
          payload.accountNumber = 'Cash';
          payload.transactionId = 'CASH-PAYOUT';
        } else {
          payload.accountNumber = accountNumber.trim();
          payload.transactionId = trxId.trim() || txMemoId;
          if (method === 'Recharge') {
            payload.mobileOperator = mobileOperator;
          }
        }
      } else {
        if (method === 'Cash') {
          payload.accountNumber = cashPayerPhone.trim();
          payload.transactionId = cashPayerName.trim() || 'CASH-HANDOVER';
          payload.cashPayerName = cashPayerName.trim();
          payload.cashPayerPhone = cashPayerPhone.trim();
        } else {
          payload.accountNumber = accountNumber.trim();
          payload.transactionId = trxId.trim() || txMemoId;
        }
      }

      if (type === 'loan') {
        const finalReason = loanReason.trim() || 'Education Support';
        payload.loanReason = finalReason;
        payload.reason = finalReason;
        payload.purpose = finalReason;
        payload.estimatedRepaymentDate = estimatedRepaymentDate;
        payload.authorizedMaxRepaymentDays = repaymentEligibility.maxDays;
      }

      await addDoc(collection(db, 'transactions'), payload);
      if (sendWorkflowNotification) {
        await sendWorkflowNotification('transaction_request', profile.email || auth.currentUser.email || undefined, profile.name, {
          amount: reqAmt,
          type,
          method,
          memoId: txMemoId,
          transactionId: payload.transactionId,
          accountNumber: payload.accountNumber,
          estimatedRepaymentDate: type === 'loan' ? estimatedRepaymentDate : undefined,
          notes: type === 'loan' ? payload.loanReason : undefined,
        });
      } else {
        await sendNotification(
          'New Transaction Request',
          `${profile.name} submitted a ${type} request for ৳${reqAmt.toLocaleString()}.`,
          'tahsinullahtusher999@gmail.com'
        );
      }

      addToast(
        'Request Submitted',
        `Your ${type.replace('_', ' ')} request of ৳${reqAmt.toLocaleString()} is now pending verification.`,
        'success'
      );
      if (!isBackground) onClose();
    } catch (err) {
      console.error(err);
      addToast('Submission Failed', 'Failed to submit transaction. Please try again.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionRequestSubmit = async (isBackground = false) => {
    if (!auth.currentUser || !profile) return;

    setLoading(true);
    try {
      const pricing = getSubscriptionPricing(selectedSubTier || 'bronze', profile);
      const months = pricing.months || 1;
      const today = new Date();
      let expiresAt = new Date();
      if (profile.subscriptionStatus === 'active' && profile.subscriptionExpiresAt) {
        const currentExp = new Date(profile.subscriptionExpiresAt);
        if (currentExp > today) expiresAt = new Date(currentExp);
      }
      expiresAt.setDate(expiresAt.getDate() + months * 30);
      const tierLimit = selectedSubTier === 'gold' ? 2500 : selectedSubTier === 'silver' ? 1500 : 500;

      const safeUserName = profile?.name || auth.currentUser.displayName || 'Member';
      const safeAccountNumber = subSenderMobile || profile?.phone || '01XXXXXXXXX';
      const subMemoId = `TUT-SUB-${Date.now().toString().slice(-6)}`;

      await addDoc(collection(db, 'transactions'), {
        userId: auth.currentUser.uid,
        userName: safeUserName,
        type: 'subscription',
        amount: pricing.price,
        method: subWallet || 'Bkash',
        accountNumber: safeAccountNumber,
        transactionId: subTrxId || subMemoId,
        memoId: subMemoId,
        status: 'confirmed',
        subscriptionTier: selectedSubTier,
        subscriptionMonths: months,
        timestamp: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        subscriptionStatus: 'active',
        subscriptionTier: selectedSubTier,
        subscriptionExpiresAt: expiresAt.toISOString(),
        borrowingLimit: tierLimit,
        continuousSubscriptionMonths: (profile?.continuousSubscriptionMonths || 0) + months,
        lastSubscriptionPaidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (pricing.price > 0) {
        try {
          await setDoc(
            doc(db, 'system_controls', 'funds'),
            {
              personalFund: increment(pricing.price),
              subscriptionFund: increment(pricing.price),
              totalReserve: increment(pricing.price),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          await setDoc(
            doc(db, 'system_controls', 'reserves'),
            {
              primaryTarget: increment(pricing.price),
              subscriptionReserveContribution: increment(pricing.price),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          await addDoc(collection(db, 'subscription_funds'), {
            userId: auth.currentUser.uid,
            userName: safeUserName,
            userEmail: profile?.email || auth.currentUser.email || '',
            userPhone: profile?.phone || subSenderMobile || '',
            memberId: profile?.memberId || 'N/A',
            tier: selectedSubTier,
            tierName: selectedSubTier === 'gold' ? 'Gold Sovereign' : selectedSubTier === 'silver' ? 'Silver Executive' : 'Bronze',
            amount: pricing.price,
            durationMonths: months,
            paymentMethod: subWallet || 'Bkash',
            accountNumber: safeAccountNumber,
            transactionId: subTrxId || subMemoId,
            memoId: subMemoId,
            allocatedToReserve: true,
            reserveDestination: 'Main Zero-Usury Lending Liquidity Reserve',
            status: 'confirmed',
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Reserve sync note:', e);
        }
      }

      if (sendWorkflowNotification) {
        await sendWorkflowNotification('subscription_confirmed', profile.email || auth.currentUser.email || undefined, safeUserName, {
          amount: pricing.price,
          type: 'subscription',
          tier: selectedSubTier,
          memoId: subMemoId,
          method: subWallet || 'Bkash',
          transactionId: subTrxId || subMemoId,
          accountNumber: safeAccountNumber
        });
      } else {
        await sendNotification(
          'Subscription Activated',
          `${profile.name} activated ${selectedSubTier} subscription tier.`,
          'tahsinullahtusher999@gmail.com'
        );
      }

      addToast(
        'Charter Activated',
        `Your ${selectedSubTier?.toUpperCase()} tier is active! Limit: ৳${tierLimit.toLocaleString()} BDT.`,
        'success'
      );
      if (!isBackground) onClose();
    } catch (err) {
      console.error(err);
      addToast('Submission Failed', 'Failed to complete subscription request.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const triggerSuccessCelebration = useCallback(() => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      navigator.vibrate?.([18, 35, 25]);
    } catch {
      // ignore vibration unsupported
    }

    playSuccessSound();
    setGoalCelebration(true);

    let submissionPromise: Promise<any>;
    if (type === 'transfer') {
      submissionPromise = executeTransferSubmit();
    } else if (type === 'subscription') {
      submissionPromise = handleSubscriptionRequestSubmit(true);
    } else {
      submissionPromise = handleStandardRequestSubmit(true);
    }

    setTimeout(async () => {
      try {
        await submissionPromise;
      } catch (err) {
        console.error('Secure submit error during celebration:', err);
      }
      setGoalCelebration(false);
      isSubmittingRef.current = false;
      if (type !== 'transfer') {
        onClose();
      }
    }, 1500);
  }, [
    type,
    amount,
    method,
    accountNumber,
    trxId,
    loanReason,
    estimatedRepaymentDate,
    cashPayerName,
    cashPayerPhone,
    verifiedRecipient,
    transferPassword,
    transferReference,
    selectedSubTier,
    subWallet,
    subSenderMobile,
    subTrxId,
  ]);

  // Smooth 60fps Hold-and-Press Loop
  const startHolding = useCallback(() => {
    if (isStep2Invalid() || isSubmittingRef.current || goalCelebration) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    try {
      navigator.vibrate?.(10);
    } catch {
      // ignore
    }

    setEarlyReleaseHint(false);
    setIsHolding(true);
    const startOffset = (progressRef.current / 100) * HOLD_DURATION_MS;
    holdStartTimeRef.current = performance.now() - startOffset;

    const tick = (now: number) => {
      const elapsed = now - holdStartTimeRef.current;
      const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      progressRef.current = pct;
      setHoldProgress(pct);

      if (pct >= 100) {
        setIsHolding(false);
        rafRef.current = null;
        triggerSuccessCelebration();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [isStep2Invalid, goalCelebration, triggerSuccessCelebration]);

  const stopHolding = useCallback(() => {
    setIsHolding(false);
    if (progressRef.current >= 100 || isSubmittingRef.current) return;

    if (progressRef.current > 8) {
      setEarlyReleaseHint(true);
      setTimeout(() => setEarlyReleaseHint(false), 1800);
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    releaseStartValRef.current = progressRef.current;
    releaseStartTimeRef.current = performance.now();

    const drain = (now: number) => {
      const elapsed = now - releaseStartTimeRef.current;
      const ratio = Math.max(0, 1 - elapsed / RELEASE_DRAIN_MS);
      const nextVal = releaseStartValRef.current * ratio;
      progressRef.current = nextVal;
      setHoldProgress(nextVal);

      if (ratio > 0) {
        rafRef.current = requestAnimationFrame(drain);
      } else {
        progressRef.current = 0;
        setHoldProgress(0);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(drain);
  }, []);

  const getPersonalNumber = () => {
    const activeMethod = type === 'subscription' ? subWallet : method;
    return activeMethod === 'Bkash' ? '01713710607' : '01921801100';
  };

  const getTransactionLabel = () => {
    switch (type) {
      case 'loan': return 'Request Loan';
      case 'deposit': return 'Deposit Funds';
      case 'refund': return 'Request Refund';
      case 'pay_due': return 'Repay Due';
      case 'transfer': return 'Send Money';
      case 'subscription': return 'Upgrade Plan';
      default: return 'Transaction';
    }
  };

  const getBalanceCardMeta = () => {
    switch (type) {
      case 'loan':
        return {
          title: 'Available Borrow Capacity',
          amount: availableBorrowCapacity,
          subtitle: `Limit ৳${borrowingLimit.toLocaleString()} • Used ৳${remainingDebt.toLocaleString()}`,
          showRing: true,
        };
      case 'pay_due':
        return {
          title: 'Outstanding Loan Due',
          amount: remainingDebt,
          subtitle: `Limit ৳${borrowingLimit.toLocaleString()} • Repayment clears credit line`,
          showRing: true,
        };
      case 'deposit':
        return {
          title: 'Current Vault Balance',
          amount: profile.totalDeposit || 0,
          subtitle: 'Added funds strengthen borrowing reserves',
          showRing: false,
        };
      case 'refund':
      case 'transfer':
        return {
          title: type === 'refund' ? 'Withdrawable Vault Balance' : 'Sendable Vault Balance',
          amount: profile.totalDeposit || 0,
          subtitle: 'Available instantly for verified requests',
          showRing: false,
        };
      case 'subscription':
        return {
          title: 'Active Tier Limit',
          amount: borrowingLimit,
          subtitle: `Current plan: ${(profile.subscriptionTier || 'Standard').toUpperCase()}`,
          showRing: false,
        };
      default:
        return { title: 'Available Balance', amount: 0, subtitle: '', showRing: false };
    }
  };

  const balanceCard = getBalanceCardMeta();

  const amountPresets = useMemo(() => {
    if (type === 'loan' && availableBorrowCapacity > 0 && availableBorrowCapacity < 1500) {
      const cap = Math.floor(availableBorrowCapacity);
      return Array.from(new Set([200, 300, Math.min(500, cap), cap])).filter((v) => v > 0 && v <= cap);
    }
    if (type === 'pay_due' && remainingDebt > 0 && remainingDebt < 1500) {
      const due = Math.floor(remainingDebt);
      return Array.from(new Set([200, 500, Math.min(1000, due), due])).filter((v) => v > 0 && v <= due);
    }
    return [500, 1000, 1500, 5000];
  }, [type, availableBorrowCapacity, remainingDebt]);

  const RechargeMobileIcon = (
    <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0">
      <Smartphone className="w-5 h-5 text-sky-400" />
    </div>
  );

  const CashNoteIcon = (
    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
      <Coins className="w-5 h-5 text-emerald-400" />
    </div>
  );

  const activeDigitalMethod = type === 'subscription' ? subWallet : method;

  // Radial SVG ring constants for Hold Button
  const ringRadius = 15;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - holdProgress / 100);

  return (
    <div className="fixed inset-0 z-50 w-full h-screen bg-[#020612] flex flex-col text-slate-100 overflow-hidden font-sans">
      {/* Subtle Ambient Depth */}
      <div className="absolute -top-24 left-1/3 w-[380px] h-[380px] bg-blue-600/[0.06] rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[320px] h-[320px] bg-emerald-600/[0.04] rounded-full blur-[110px] pointer-events-none" />

      {/* HEADER BAR */}
      <header className="w-full bg-[#050b1c]/95 backdrop-blur-xl border-b border-white/[0.07] py-3 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
        <button
          type="button"
          onClick={() => {
            if (step === 3) {
              setStep(type === 'transfer' ? 1 : 2);
            } else if (step === 2) {
              setStep(1);
            } else {
              onClose();
            }
          }}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
            step > 1
              ? 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-200'
              : 'border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300'
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{step > 1 ? 'Back' : 'Cancel'}</span>
        </button>

        <div className="text-center">
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-white leading-none">
            {getTransactionLabel()}
          </h1>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            Step {type === 'transfer' ? (step === 3 ? 2 : 1) : step} of {type === 'transfer' ? 2 : 3}
          </p>
        </div>

        <a
          href="https://wa.me/8801713710607"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Support</span>
        </a>
      </header>

      {/* CLEAN STEPPER INDICATOR */}
      {!transferSuccess && (
        <div className="w-full max-w-md mx-auto px-5 pt-3 pb-2 shrink-0 z-20">
          <div className="flex items-center justify-between gap-2">
            {[
              { id: 1, label: 'Details' },
              ...(type !== 'transfer'
                ? [
                    {
                      id: 2,
                      label:
                        type === 'deposit' || type === 'pay_due' || type === 'subscription'
                          ? 'Payment'
                          : 'Receiving',
                    },
                  ]
                : []),
              { id: 3, label: 'Authorize' },
            ].map((item, idx, arr) => {
              const displayIdx = idx + 1;
              const isCompleted = step > item.id;
              const isCurrent = step === item.id;

              return (
                <React.Fragment key={item.id}>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-200',
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : isCurrent
                            ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                            : 'bg-slate-900 border-white/10 text-slate-500'
                      )}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : displayIdx}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-semibold transition-colors',
                        isCurrent ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-[2px] rounded-full transition-colors duration-300',
                        isCompleted ? 'bg-emerald-500/80' : 'bg-white/10'
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* MAIN CONTENT CONTAINER */}
      <div className="flex-1 w-full max-w-md mx-auto px-4 sm:px-5 pb-4 overflow-hidden flex flex-col z-10">
        {transferSuccess ? (
          <div className="w-full flex-1 flex flex-col justify-center py-2 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="w-full bg-[#070d1e] border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col items-center text-center space-y-4"
            >
              <div className="w-12 h-12 bg-emerald-500/15 rounded-full flex items-center justify-center border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">
                  Transfer Confirmed
                </p>
                <h3 className="text-3xl font-black font-mono tabular-nums text-white mt-1">
                  ৳{transferSuccess.amount.toLocaleString()}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Ledger balances updated immediately</p>
              </div>

              <div className="w-full p-4 bg-slate-950/80 rounded-xl border border-white/[0.07] text-xs text-left space-y-3">
                <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                  <span className="text-slate-400 font-medium">Recipient</span>
                  <span className="text-white font-semibold">{transferSuccess.recipientName}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                  <span className="text-slate-400 font-medium">Member ID</span>
                  <span className="text-amber-300 font-mono font-semibold">{transferSuccess.recipientId}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                  <span className="text-slate-400 font-medium">Reference ID</span>
                  <span className="text-blue-400 font-mono font-semibold">{transferSuccess.memoId}</span>
                </div>
                {transferSuccess.reference && (
                  <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                    <span className="text-slate-400 font-medium">Note</span>
                    <span className="text-slate-200 font-medium max-w-[190px] truncate">{transferSuccess.reference}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Date & Time</span>
                  <span className="text-slate-200 font-mono">{format(transferSuccess.date, 'dd MMM yyyy, HH:mm')}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl uppercase tracking-wider transition-all cursor-pointer"
              >
                Done
              </button>
            </motion.div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
            <AnimatePresence>
              {loading && !goalCelebration && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[#020612]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center space-y-3"
                >
                  <div className="w-12 h-12 rounded-full border-3 border-blue-500/20 border-t-blue-500 animate-spin" />
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Processing Request...</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {/* ============================================================
                  STEP 1: AMOUNT, PURPOSE & DYNAMIC REPAYMENT TERM
                 ============================================================ */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ x: -16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 16, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="flex-1 flex flex-col justify-between overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 pb-2">
                    {/* CONTEXTUAL CAPACITY / BALANCE SUMMARY */}
                    <div className="p-4 bg-[#070d1e] border border-white/[0.07] rounded-2xl flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          {balanceCard.title}
                        </span>
                        <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums leading-tight">
                          ৳{balanceCard.amount.toLocaleString()}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{balanceCard.subtitle}</p>
                      </div>

                      {balanceCard.showRing && (
                        <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r="22" className="stroke-slate-800" strokeWidth="4.5" fill="transparent" />
                            <circle
                              cx="28"
                              cy="28"
                              r="22"
                              className={cn('transition-all duration-300', utilizationStrokeColor)}
                              strokeWidth="4.5"
                              strokeLinecap="round"
                              fill="transparent"
                              strokeDasharray={2 * Math.PI * 22}
                              strokeDashoffset={2 * Math.PI * 22 * (1 - usedPercentage / 100)}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                            <span className="text-[10px] font-bold font-mono tabular-nums text-white">
                              {Math.round(usedPercentage)}%
                            </span>
                            <span className="text-[8px] font-medium text-slate-400 uppercase mt-0.5">Used</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AMOUNT CARD */}
                    <div className="bg-[#070d1e] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-blue-400" />
                          <h3 className="text-xs font-bold uppercase text-white tracking-wider">
                            {type === 'loan' ? 'Loan Amount (BDT)' : 'Amount (BDT)'}
                          </h3>
                        </div>
                        {type !== 'subscription' && (
                          <button
                            type="button"
                            onClick={() => {
                              const maxVal =
                                type === 'loan'
                                  ? availableBorrowCapacity
                                  : type === 'pay_due'
                                    ? remainingDebt
                                    : type === 'refund' || type === 'transfer'
                                      ? profile?.totalDeposit || 0
                                      : 0;
                              if (maxVal > 0) handlePresetSelect(maxVal);
                            }}
                            className={cn(
                              type === 'deposit' ? 'hidden' : 'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border transition-all cursor-pointer',
                              'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/25'
                            )}
                          >
                            Use Max
                          </button>
                        )}
                      </div>

                      {type !== 'subscription' ? (
                        <div className="space-y-2.5">
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">৳</span>
                            <input
                              type="number"
                              min="1"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              placeholder="Enter amount"
                              className={cn(
                                'w-full bg-slate-950/90 border rounded-xl pl-8 pr-4 py-2.5 text-base text-white font-mono tabular-nums font-bold focus:outline-none transition-all placeholder:text-slate-500',
                                step1ValidationError
                                  ? 'border-rose-500/60 focus:border-rose-400'
                                  : 'border-white/10 focus:border-blue-500'
                              )}
                            />
                          </div>

                          {step1ValidationError && (
                            <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{step1ValidationError}</span>
                            </p>
                          )}

                          <div className="grid grid-cols-4 gap-2">
                            {amountPresets.map((val) => {
                              const isSelected = parsedAmount === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handlePresetSelect(val)}
                                  className={cn(
                                    'py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer font-mono tabular-nums',
                                    isSelected
                                      ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_12px_rgba(37,99,235,0.28)]'
                                      : 'bg-slate-950/80 border-white/[0.08] text-slate-300 hover:border-white/20 hover:text-white'
                                  )}
                                >
                                  ৳{val.toLocaleString()}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-950/70 rounded-xl border border-white/[0.07] flex justify-between items-center">
                          <div>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Selected Tier</p>
                            <h4 className="text-xs font-bold text-white mt-0.5">
                              {getSubscriptionPricing(selectedSubTier || 'bronze', profile).label}
                            </h4>
                          </div>
                          <span className="text-sm font-bold text-blue-400 font-mono tabular-nums">
                            ৳{getSubscriptionPricing(selectedSubTier || 'bronze', profile).price.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* PURPOSE OR RECIPIENT CARD */}
                    <div className="bg-[#070d1e] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        {type === 'loan' ? (
                          <FileText className="w-4 h-4 text-blue-400" />
                        ) : (
                          <User className="w-4 h-4 text-blue-400" />
                        )}
                        <h3 className="text-xs font-bold uppercase text-white tracking-wider">
                          {type === 'loan'
                            ? 'Loan Purpose'
                            : type === 'transfer'
                              ? 'Recipient & Verification'
                              : 'Next Step'}
                        </h3>
                      </div>

                      {type === 'transfer' && (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                              <input
                                type="text"
                                value={transferIdentifier}
                                onChange={(e) => {
                                  setTransferIdentifier(e.target.value);
                                  setVerifiedRecipient(null);
                                  setTransferError('');
                                }}
                                placeholder="Member ID, Phone, or Email"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleVerifyRecipient}
                              disabled={verifyLoading || !transferIdentifier.trim()}
                              className="px-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition-all disabled:opacity-40 cursor-pointer shrink-0"
                            >
                              {verifyLoading ? 'Checking...' : 'Verify'}
                            </button>
                          </div>

                          {transferError && (
                            <p className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{transferError}</span>
                            </p>
                          )}

                          {verifiedRecipient && (
                            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex justify-between items-center">
                              <div className="flex items-center gap-2 text-emerald-300">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span className="text-xs font-semibold">{verifiedRecipient.name}</span>
                              </div>
                              <span className="text-xs font-mono text-amber-300 font-semibold">
                                {verifiedRecipient.memberId || 'Verified'}
                              </span>
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-slate-400">Reference Note (Optional)</label>
                            <input
                              type="text"
                              value={transferReference}
                              onChange={(e) => setTransferReference(e.target.value.slice(0, 100))}
                              placeholder="Add an optional note"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-slate-400">Account Password</label>
                            <input
                              type="password"
                              value={transferPassword}
                              onChange={(e) => setTransferPassword(e.target.value)}
                              placeholder="Confirm your login password"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
                            />
                          </div>
                        </div>
                      )}

                      {type === 'loan' && (
                        <div className="space-y-2.5">
                          <textarea
                            value={loanReason}
                            onChange={(e) => setLoanReason(e.target.value.slice(0, 120))}
                            placeholder="Briefly describe the purpose of this loan..."
                            rows={2}
                            maxLength={120}
                            className="w-full bg-slate-950/90 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-500 resize-none h-14"
                          />
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1.5">
                              {['Education Support', 'Emergency Needs', 'Medical Expense', 'Family Support'].map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setLoanReason(r)}
                                  className={cn(
                                    'px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer',
                                    loanReason === r
                                      ? 'bg-blue-600 border-blue-400 text-white'
                                      : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200'
                                  )}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {loanReason.length}/120
                            </span>
                          </div>
                        </div>
                      )}

                      {type !== 'transfer' && type !== 'loan' && (
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {type === 'deposit' || type === 'pay_due' || type === 'subscription'
                            ? 'In the next step, choose bKash, Nagad, or Cash and enter your payment confirmation.'
                            : 'In the next step, select how you would like to receive your funds.'}
                        </p>
                      )}
                    </div>

                    {/* SMART DYNAMIC REPAYMENT DATE SECTION (LOAN ONLY) */}
                    {type === 'loan' && (
                      <div className="bg-[#070d1e] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <h3 className="text-xs font-bold uppercase text-white tracking-wider">
                              Estimated Repayment Date
                            </h3>
                          </div>
                          <span className="text-[11px] font-mono font-semibold text-emerald-400">
                            Max: {formatDurationLabel(repaymentEligibility.maxDays)}
                          </span>
                        </div>

                        <div className="relative">
                          <input
                            type="date"
                            min={repaymentEligibility.minDateStr}
                            max={repaymentEligibility.maxDateStr}
                            value={estimatedRepaymentDate}
                            onChange={(e) => setEstimatedRepaymentDate(e.target.value)}
                            className={cn(
                              'w-full bg-slate-950/90 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-all font-mono font-semibold',
                              repaymentDateValidation.valid
                                ? 'border-white/10 focus:border-blue-500'
                                : 'border-rose-500/60 focus:border-rose-400'
                            )}
                          />
                        </div>

                        {!repaymentDateValidation.valid && repaymentDateValidation.error && (
                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-rose-300 font-medium flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              {repaymentDateValidation.error}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEstimatedRepaymentDate(repaymentEligibility.maxDateStr)}
                              className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[10px] font-semibold shrink-0 cursor-pointer"
                            >
                              Set Max
                            </button>
                          </div>
                        )}

                        {/* Quick Term Buttons Tailored to Eligibility */}
                        <div className="flex flex-wrap gap-1.5">
                          {repaymentEligibility.presets.map((preset) => {
                            const dStr = format(addDays(new Date(), preset.days), 'yyyy-MM-dd');
                            const isActive = estimatedRepaymentDate === dStr;
                            return (
                              <button
                                key={preset.days}
                                type="button"
                                onClick={() => setEstimatedRepaymentDate(dStr)}
                                className={cn(
                                  'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer',
                                  isActive
                                    ? 'bg-blue-600 border-blue-400 text-white'
                                    : preset.isExtended
                                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20'
                                      : 'bg-slate-950 border-white/10 text-slate-300 hover:border-white/25'
                                )}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Transparent Repayment Limit Advisor Toggle */}
                        <div className="pt-1 border-t border-white/[0.06]">
                          <button
                            type="button"
                            onClick={() => setShowRepaymentFactors((prev) => !prev)}
                            className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-0.5"
                          >
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-400" />
                              <span>
                                {repaymentEligibility.tierSummary} • Latest:{' '}
                                <strong className="text-slate-200 font-mono">
                                  {format(parseISO(repaymentEligibility.maxDateStr), 'dd MMM yyyy')}
                                </strong>
                              </span>
                            </span>
                            {showRepaymentFactors ? (
                              <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                            )}
                          </button>

                          {showRepaymentFactors && (
                            <div className="mt-2 p-3 rounded-xl bg-slate-950/90 border border-white/[0.07] space-y-2 text-[11px]">
                              {repaymentEligibility.isRestricted ? (
                                <p className="text-amber-300 leading-relaxed">
                                  {repaymentEligibility.restrictionReason}
                                </p>
                              ) : (
                                <>
                                  <div className="flex justify-between items-center text-slate-400">
                                    <span>Standard Member Ceiling</span>
                                    <span className="font-mono text-slate-200">{repaymentEligibility.baseDays} days (1 Mo 10d)</span>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-400">
                                    <span>Credit Score ({repaymentEligibility.creditScore})</span>
                                    <span className={cn('font-mono font-semibold', repaymentEligibility.creditScoreBonus > 0 ? 'text-emerald-400' : 'text-slate-500')}>
                                      +{repaymentEligibility.creditScoreBonus} days
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-400">
                                    <span>Transaction History ({repaymentEligibility.settledRepaymentsCount} settled)</span>
                                    <span className={cn('font-mono font-semibold', repaymentEligibility.historyBonus > 0 ? 'text-emerald-400' : 'text-slate-500')}>
                                      +{repaymentEligibility.historyBonus} days
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-400">
                                    <span>Capacity & Vault Buffer ({100 - repaymentEligibility.utilizationPct}% free)</span>
                                    <span className={cn('font-mono font-semibold', repaymentEligibility.capacityBonus > 0 ? 'text-emerald-400' : 'text-slate-500')}>
                                      +{repaymentEligibility.capacityBonus} days
                                    </span>
                                  </div>
                                  <div className="pt-1.5 border-t border-white/[0.07] flex justify-between items-center font-semibold text-white">
                                    <span>Total Authorized Window</span>
                                    <span className="font-mono text-emerald-400">Up to {repaymentEligibility.maxDays} days</span>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* STEP 1 FOOTER */}
                  <div className="pt-2.5 border-t border-white/[0.06] shrink-0 bg-[#020612] space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isStep1Valid()) {
                          setStep(type === 'transfer' ? 3 : 2);
                        }
                      }}
                      disabled={!isStep1Valid()}
                      className={cn(
                        'w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                        !isStep1Valid()
                          ? 'bg-slate-900 border border-white/5 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.99] cursor-pointer'
                      )}
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
                      <Lock className="w-3 h-3 text-blue-400" />
                      <span>256-bit encrypted member session</span>
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ============================================================
                  STEP 2: PAYMENT METHOD SELECTION (REAL bKash & Nagad LOGOS)
                 ============================================================ */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ x: 16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -16, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="flex-1 flex flex-col justify-between overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 pb-2">
                    {/* METHOD SELECTOR */}
                    <div className="bg-[#070d1e] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold uppercase text-white tracking-wider">
                          {type === 'loan' || type === 'refund' ? 'Select Receiving Method' : 'Select Payment Method'}
                        </h3>
                      </div>

                      <div
                        className={cn(
                          'grid gap-2.5',
                          type === 'loan' || type === 'refund' ? 'grid-cols-4' : 'grid-cols-3'
                        )}
                      >
                        {/* bKash */}
                        <button
                          type="button"
                          onClick={() => {
                            if (type === 'subscription') {
                              setSubWallet?.('Bkash');
                            } else {
                              setMethod('Bkash');
                            }
                          }}
                          className={cn(
                            'py-2.5 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[80px]',
                            activeDigitalMethod === 'Bkash'
                              ? 'bg-[#E2136E]/15 border-[#E2136E]/70 text-white shadow-[0_0_16px_rgba(226,19,110,0.22)]'
                              : 'bg-slate-950/70 border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-slate-200'
                          )}
                        >
                          <BkashLogo size="md" />
                          <span className="text-[11px] font-bold tracking-tight leading-none">bKash</span>
                        </button>

                        {/* Nagad */}
                        <button
                          type="button"
                          onClick={() => {
                            if (type === 'subscription') {
                              setSubWallet?.('Nagad');
                            } else {
                              setMethod('Nagad');
                            }
                          }}
                          className={cn(
                            'py-2.5 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[80px]',
                            activeDigitalMethod === 'Nagad'
                              ? 'bg-[#F6921E]/15 border-[#F6921E]/70 text-white shadow-[0_0_16px_rgba(246,146,30,0.22)]'
                              : 'bg-slate-950/70 border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-slate-200'
                          )}
                        >
                          <NagadLogo size="md" />
                          <span className="text-[11px] font-bold tracking-tight leading-none">Nagad</span>
                        </button>

                        {/* Mobile Recharge */}
                        {(type === 'loan' || type === 'refund') && (
                          <button
                            type="button"
                            onClick={() => setMethod('Recharge')}
                            className={cn(
                              'py-2.5 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[80px]',
                              method === 'Recharge'
                                ? 'bg-sky-500/15 border-sky-400/70 text-white shadow-[0_0_16px_rgba(56,189,248,0.2)]'
                                : 'bg-slate-950/70 border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-slate-200'
                            )}
                          >
                            {RechargeMobileIcon}
                            <span className="text-[11px] font-bold tracking-tight leading-none">Recharge</span>
                          </button>
                        )}

                        {/* Cash */}
                        <button
                          type="button"
                          onClick={() => {
                            if (type === 'subscription') {
                              setSubWallet?.('Cash');
                            } else {
                              setMethod('Cash');
                            }
                          }}
                          className={cn(
                            'py-2.5 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[80px]',
                            activeDigitalMethod === 'Cash'
                              ? 'bg-emerald-500/15 border-emerald-400/70 text-white shadow-[0_0_16px_rgba(16,185,129,0.2)]'
                              : 'bg-slate-950/70 border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-slate-200'
                          )}
                        >
                          {CashNoteIcon}
                          <span className="text-[11px] font-bold tracking-tight leading-none">Cash</span>
                        </button>
                      </div>

                      {/* Authority Wallet Instructions for Outgoing Payments */}
                      {type !== 'loan' &&
                        type !== 'refund' &&
                        (activeDigitalMethod === 'Bkash' || activeDigitalMethod === 'Nagad') && (
                          <div
                            className={cn(
                              'p-3.5 rounded-xl border flex items-center justify-between gap-3',
                              activeDigitalMethod === 'Bkash'
                                ? 'bg-[#E2136E]/[0.08] border-[#E2136E]/30'
                                : 'bg-[#F6921E]/[0.08] border-[#F6921E]/30'
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {activeDigitalMethod === 'Bkash' ? (
                                <BkashLogo size="sm" />
                              ) : (
                                <NagadLogo size="sm" />
                              )}
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                                  Send Money ({activeDigitalMethod === 'Bkash' ? 'bKash' : 'Nagad'} Personal)
                                </p>
                                <p className="text-sm font-mono font-bold text-white tracking-wide mt-0.5 select-all">
                                  {getPersonalNumber()}
                                </p>
                              </div>
                            </div>
                            <CopyBtn text={getPersonalNumber()} />
                          </div>
                        )}
                    </div>

                    {/* METHOD DETAILS FORM */}
                    <div className="bg-[#070d1e] border border-white/[0.07] rounded-2xl p-4 space-y-3.5">
                      {activeDigitalMethod === 'Cash' ? (
                        type === 'loan' || type === 'refund' ? (
                          <div className="p-4 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl space-y-2 text-center">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                              <Coins className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                              In-Person Cash Payout
                            </h4>
                            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                              No digital wallet required. Collect your approved cash directly from the desk upon authorization.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-emerald-400" />
                                Payer Full Name
                              </label>
                              <input
                                type="text"
                                value={type === 'subscription' ? subTrxId : cashPayerName}
                                onChange={(e) => {
                                  if (type === 'subscription') setSubTrxId?.(e.target.value);
                                  else setCashPayerName(e.target.value);
                                }}
                                placeholder="Full name of person handing cash"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-500"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                                Payer Mobile Number
                              </label>
                              <input
                                type="tel"
                                value={type === 'subscription' ? subSenderMobile : cashPayerPhone}
                                onChange={(e) => {
                                  if (type === 'subscription') setSubSenderMobile?.(e.target.value);
                                  else setCashPayerPhone(e.target.value);
                                }}
                                placeholder="01XXXXXXXXX"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-semibold focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-500"
                              />
                            </div>

                            {type !== 'subscription' && (
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  Confirm Mobile Number
                                </label>
                                <input
                                  type="tel"
                                  value={confirmCashPayerPhone}
                                  onChange={(e) => setConfirmCashPayerPhone(e.target.value)}
                                  placeholder="Re-enter mobile number"
                                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-semibold focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-500"
                                />
                                {cashPayerPhone &&
                                  confirmCashPayerPhone &&
                                  cashPayerPhone.trim() !== confirmCashPayerPhone.trim() && (
                                    <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1 mt-1">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      Mobile numbers do not match
                                    </p>
                                  )}
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        <>
                          {method === 'Recharge' && (type === 'loan' || type === 'refund') && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                                Mobile Operator
                              </label>
                              <select
                                value={mobileOperator}
                                onChange={(e) => setMobileOperator(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
                              >
                                <option value="Grameenphone">Grameenphone</option>
                                <option value="Robi">Robi</option>
                                <option value="Airtel">Airtel</option>
                                <option value="Banglalink">Banglalink</option>
                                <option value="Teletalk">Teletalk</option>
                              </select>
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                              {method === 'Recharge'
                                ? 'Recipient Mobile Number'
                                : type === 'loan' || type === 'refund'
                                  ? `Your ${activeDigitalMethod === 'Bkash' ? 'bKash' : 'Nagad'} Account Number`
                                  : `Sender ${activeDigitalMethod === 'Bkash' ? 'bKash' : 'Nagad'} Number`}
                            </label>
                            <input
                              type="tel"
                              value={type === 'subscription' ? subSenderMobile : accountNumber}
                              onChange={(e) => {
                                if (type === 'subscription') setSubSenderMobile?.(e.target.value);
                                else setAccountNumber(e.target.value);
                              }}
                              placeholder={
                                method === 'Recharge'
                                  ? '01XXXXXXXXX'
                                  : `Enter ${activeDigitalMethod === 'Bkash' ? 'bKash' : 'Nagad'} number`
                              }
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-semibold focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
                            />
                            {hasDefaultWallet &&
                              (type === 'loan' || type === 'refund') &&
                              (method === 'Bkash' || method === 'Nagad') && (
                                <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5 mt-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Verified primary wallet pre-filled ({defaultWalletName})</span>
                                </p>
                              )}
                          </div>

                          {type !== 'subscription' && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-blue-400" />
                                {method === 'Recharge' ? 'Confirm Mobile Number' : 'Confirm Account Number'}
                              </label>
                              <input
                                type="tel"
                                value={confirmAccountNumber}
                                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                                placeholder={
                                  method === 'Recharge'
                                    ? 'Re-enter mobile number'
                                    : `Re-enter ${method === 'Bkash' ? 'bKash' : 'Nagad'} number`
                                }
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-semibold focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
                              />
                              {accountNumber &&
                                confirmAccountNumber &&
                                accountNumber.trim() !== confirmAccountNumber.trim() && (
                                  <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1 mt-1">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Numbers do not match</span>
                                  </p>
                                )}
                            </div>
                          )}

                          {type !== 'loan' && type !== 'refund' && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5 text-blue-400" />
                                Transaction ID (TrxID)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={type === 'subscription' ? subTrxId : trxId}
                                  onChange={(e) => {
                                    if (type === 'subscription') setSubTrxId?.(e.target.value);
                                    else setTrxId(e.target.value);
                                  }}
                                  placeholder="e.g. 9J28AB72K"
                                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-500 uppercase"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const gen = `TX${Math.floor(10000000 + Math.random() * 90000000)}`;
                                    if (type === 'subscription') setSubTrxId?.(gen);
                                    else setTrxId(gen);
                                  }}
                                  className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl text-[11px] font-semibold text-slate-200 shrink-0 cursor-pointer transition-colors"
                                >
                                  Auto-Fill
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="p-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Double-check your wallet number carefully before continuing. Discrepancies can delay processing.
                      </p>
                    </div>
                  </div>

                  {/* STEP 2 FOOTER */}
                  <div className="pt-2.5 border-t border-white/[0.06] shrink-0 bg-[#020612] space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isStep2Valid()) setStep(3);
                      }}
                      disabled={isStep2Invalid()}
                      className={cn(
                        'w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                        isStep2Invalid()
                          ? 'bg-slate-900 border border-white/5 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.99] cursor-pointer'
                      )}
                    >
                      <span>Review Summary</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ============================================================
                  STEP 3: REVIEW & TACTILE HOLD-AND-PRESS AUTHORIZATION
                 ============================================================ */}
              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ x: 16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -16, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="flex-1 flex flex-col justify-between overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 pb-2">
                    {/* REVIEW SUMMARY TICKET */}
                    <div className="relative bg-[#070d1e] border border-white/[0.09] rounded-2xl p-4 sm:p-5 shadow-2xl overflow-hidden">
                      <div className="flex items-center justify-between pb-3 border-b border-white/[0.07] mb-3.5">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <h3 className="text-xs font-bold uppercase text-white tracking-wider">
                            {type === 'transfer'
                              ? 'Transfer Summary'
                              : type === 'loan'
                                ? 'Loan Request Summary'
                                : 'Transaction Summary'}
                          </h3>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">{previewRefCode}</span>
                      </div>

                      <div className="space-y-3 text-xs">
                        {/* Amount */}
                        <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                          <span className="text-slate-400 font-medium">
                            {type === 'transfer' ? 'Transfer Amount' : type === 'loan' ? 'Loan Amount' : 'Amount'}
                          </span>
                          <span className="text-base text-white font-bold font-mono tabular-nums">
                            ৳
                            {type === 'subscription'
                              ? getSubscriptionPricing(selectedSubTier || 'bronze', profile).price.toLocaleString()
                              : parsedAmount.toLocaleString()}{' '}
                            BDT
                          </span>
                        </div>

                        {/* Recipient for transfers */}
                        {type === 'transfer' && verifiedRecipient && (
                          <>
                            <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                              <span className="text-slate-400 font-medium">Recipient</span>
                              <span className="text-white font-semibold truncate max-w-[200px]">
                                {verifiedRecipient.name}
                              </span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                              <span className="text-slate-400 font-medium">Member ID</span>
                              <span className="text-blue-400 font-mono font-semibold">
                                {verifiedRecipient.memberId || 'Verified'}
                              </span>
                            </div>
                          </>
                        )}

                        {/* Loan Reason & Repayment Date */}
                        {type === 'loan' && (
                          <>
                            <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                              <span className="text-slate-400 font-medium">Loan Purpose</span>
                              <span className="text-white font-semibold truncate max-w-[200px]">
                                {loanReason || 'Education Support'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                              <span className="text-slate-400 font-medium">Repayment Date</span>
                              <div className="text-right">
                                <span className="text-white font-mono font-semibold block">
                                  {estimatedRepaymentDate
                                    ? format(parseISO(estimatedRepaymentDate), 'dd MMM yyyy')
                                    : 'N/A'}
                                </span>
                                {repaymentDateValidation.valid && (
                                  <span className="text-[10px] text-emerald-400 font-mono">
                                    {repaymentDateValidation.daysSelected} days term
                                  </span>
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Payment Method with Real bKash / Nagad Logos */}
                        {type !== 'transfer' && (
                          <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                            <span className="text-slate-400 font-medium">Payment Channel</span>
                            <div className="flex items-center gap-2">
                              {activeDigitalMethod === 'Bkash' && <BkashLogo size="xs" />}
                              {activeDigitalMethod === 'Nagad' && <NagadLogo size="xs" />}
                              <span className="text-white font-semibold">
                                {activeDigitalMethod === 'Bkash'
                                  ? 'bKash'
                                  : activeDigitalMethod === 'Recharge'
                                    ? 'Mobile Recharge'
                                    : activeDigitalMethod}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Account / Payer Details */}
                        {type !== 'transfer' &&
                          (activeDigitalMethod === 'Cash' ? (
                            type === 'loan' || type === 'refund' ? (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-medium">Disbursement</span>
                                <span className="text-emerald-400 font-semibold">Physical Cash Handover</span>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                                  <span className="text-slate-400 font-medium">Payer Name</span>
                                  <span className="text-white font-semibold">
                                    {(type === 'subscription' ? subTrxId : cashPayerName) || 'N/A'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400 font-medium">Payer Mobile</span>
                                  <span className="text-emerald-400 font-mono font-semibold">
                                    {(type === 'subscription' ? subSenderMobile : cashPayerPhone) || 'N/A'}
                                  </span>
                                </div>
                              </>
                            )
                          ) : (
                            <>
                              <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                                <span className="text-slate-400 font-medium">
                                  {method === 'Recharge' ? 'Mobile Number' : 'Account Number'}
                                </span>
                                <span className="text-blue-300 font-mono font-semibold">
                                  {type === 'subscription' ? subSenderMobile : accountNumber}
                                </span>
                              </div>

                              {method === 'Recharge' && (type === 'loan' || type === 'refund') && (
                                <div className="flex justify-between items-center border-b border-white/[0.06] pb-2.5">
                                  <span className="text-slate-400 font-medium">Operator</span>
                                  <span className="text-sky-300 font-semibold">{mobileOperator}</span>
                                </div>
                              )}

                              {type !== 'loan' && type !== 'refund' && (
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400 font-medium">Transaction ID</span>
                                  <span className="text-amber-300 font-mono font-semibold uppercase">
                                    {(type === 'subscription' ? subTrxId : trxId) || 'Auto-Generated'}
                                  </span>
                                </div>
                              )}
                            </>
                          ))}
                      </div>
                    </div>

                    {/* Integrity notice */}
                    <div className="p-3 bg-slate-900/70 border border-white/[0.06] rounded-xl flex items-start gap-2.5">
                      <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Verify all details above before authorizing. Submitting false transaction IDs violates member policy.
                      </p>
                    </div>
                  </div>

                  {/* TACTILE HOLD & PRESS TO AUTHORIZE BAR */}
                  <div className="pt-3 border-t border-white/[0.07] shrink-0 bg-[#020612] space-y-2.5">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Press and hold to authorize and submit request"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        try {
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        } catch {
                          // ignore capture fallback
                        }
                        startHolding();
                      }}
                      onPointerUp={(e) => {
                        e.preventDefault();
                        stopHolding();
                      }}
                      onPointerCancel={() => stopHolding()}
                      onPointerLeave={() => {
                        if (isHolding) stopHolding();
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                          e.preventDefault();
                          startHolding();
                        }
                      }}
                      onKeyUp={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          stopHolding();
                        }
                      }}
                      className={cn(
                        'relative w-full h-14 rounded-2xl border flex items-center justify-between px-3 overflow-hidden select-none touch-none transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                        isStep2Invalid()
                          ? 'bg-slate-950 border-white/5 opacity-50 cursor-not-allowed'
                          : isHolding
                            ? 'bg-slate-950 border-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.22)] scale-[0.99] cursor-grabbing'
                            : 'bg-slate-950 border-white/15 hover:border-emerald-400/45 shadow-lg cursor-pointer'
                      )}
                    >
                      {/* Smooth Progress Sweep Fill */}
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600/30 via-emerald-500/45 to-emerald-400/65 pointer-events-none"
                        style={{ width: `${holdProgress}%` }}
                      />

                      {/* Crisp Leading Edge Glow Line */}
                      {holdProgress > 1 && holdProgress < 100 && (
                        <div
                          className="absolute inset-y-0 w-0.5 bg-emerald-300 shadow-[0_0_12px_2px_rgba(52,211,153,0.8)] pointer-events-none"
                          style={{ left: `${holdProgress}%` }}
                        />
                      )}

                      {/* Left Circular Fingerprint + Live Radial Progress Gauge */}
                      <div className="relative z-10 w-9 h-9 flex items-center justify-center shrink-0">
                        <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r={ringRadius}
                            strokeWidth="2.5"
                            fill="transparent"
                            className="stroke-white/10"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r={ringRadius}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            fill="transparent"
                            className="stroke-emerald-400"
                            strokeDasharray={ringCircumference}
                            strokeDashoffset={ringOffset}
                          />
                        </svg>
                        <div
                          className={cn(
                            'absolute inset-1 rounded-full flex items-center justify-center transition-colors duration-150',
                            holdProgress >= 99
                              ? 'bg-emerald-500 text-slate-950'
                              : isHolding
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-white/5 text-slate-300'
                          )}
                        >
                          {holdProgress >= 99 ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <Fingerprint className="w-4 h-4" />
                          )}
                        </div>
                      </div>

                      {/* Center Instructional Text */}
                      <div className="relative z-10 flex-1 text-center px-2 pointer-events-none">
                        <span
                          className={cn(
                            'text-xs font-bold tracking-wide transition-colors',
                            holdProgress >= 99
                              ? 'text-emerald-200'
                              : isHolding
                                ? 'text-white'
                                : 'text-slate-200'
                          )}
                        >
                          {holdProgress >= 99
                            ? 'Authorized — Submitting...'
                            : isHolding
                              ? `Hold Steady · ${Math.round(holdProgress)}%`
                              : 'Press & Hold to Submit Request'}
                        </span>
                      </div>

                      {/* Right Amount Confirmation Tag */}
                      <div className="relative z-10 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] font-mono font-semibold text-slate-200 shrink-0 pointer-events-none">
                        ৳
                        {type === 'subscription'
                          ? getSubscriptionPricing(selectedSubTier || 'bronze', profile).price.toLocaleString()
                          : parsedAmount.toLocaleString()}
                      </div>
                    </div>

                    <p className="text-[11px] text-center flex items-center justify-center gap-1.5 min-h-[16px]">
                      {earlyReleaseHint ? (
                        <span className="text-amber-400 font-medium">
                          Released too early — keep pressing until 100% to confirm
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Lock className="w-3 h-3 text-emerald-400" />
                          Hold for 1 second to authorize and send request
                        </span>
                      )}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* CLEAN VERIFICATION CONFIRMATION OVERLAY */}
      <AnimatePresence>
        {goalCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center space-y-5 px-6"
          >
            <motion.div
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-400/60 flex items-center justify-center shadow-[0_0_32px_rgba(16,185,129,0.3)]"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </motion.div>

            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-center space-y-1.5"
            >
              <h2 className="text-xl font-bold text-white tracking-tight">Request Authorized</h2>
              <p className="text-xs text-slate-400">
                Logging your transaction securely to the T.U.T. ledger...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
