import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Shield, 
  CheckCircle2, 
  Copy, 
  Check,
  Lock,
  Search,
  Building2,
  Wallet,
  CircleDollarSign,
  Calendar,
  ChevronRight,
  User,
  Hash,
  FileText,
  Coins,
  AlertCircle,
  ArrowRight,
  Smartphone,
  Fingerprint
} from 'lucide-react';
import { format } from 'date-fns';
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
import { cn, getSubscriptionPricing } from '../App';

interface SecureTransactionPortalProps {
  type: 'loan' | 'deposit' | 'pay_due' | 'refund' | 'transfer' | 'subscription';
  profile: any;
  onClose: () => void;
  addToast: (title: string, description: string, variant: 'success' | 'danger' | 'warning' | 'info') => void;
  sendNotification: (subject: string, message: string, targetEmail: string) => void;
  
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

// Custom Copy Button
const CopyBtn = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0",
        copied
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
          : "bg-white/5 text-blue-400 border-white/10 hover:bg-white/10 hover:border-white/20"
      )}
    >
      <Copy className="w-3.5 h-3.5" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

export const SecureTransactionPortal: React.FC<SecureTransactionPortalProps> = ({
  type,
  profile,
  onClose,
  addToast,
  sendNotification,
  selectedSubTier = 'bronze',
  setSelectedSubTier,
  subSenderMobile: propSubSenderMobile = '',
  setSubSenderMobile: propSetSubSenderMobile,
  subTrxId: propSubTrxId = '',
  setSubTrxId: propSetSubTrxId,
  subWallet: propSubWallet = 'Bkash',
  setSubWallet: propSetSubWallet,
  handleBuySubscription
}) => {
  // 3-STEP INTEGRATED SECURE FLOW (Perfect Screen Fitting, High Legibility, No Empty Gaps)
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
  const defaultRepaymentDate = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const [trxId, setTrxId] = useState('');
  const [loanReason, setLoanReason] = useState('Education Support');
  const [estimatedRepaymentDate, setEstimatedRepaymentDate] = useState(defaultRepaymentDate);
  const [loading, setLoading] = useState(false);

  // Cash payment fields
  const [cashPayerName, setCashPayerName] = useState('');
  const [cashPayerPhone, setCashPayerPhone] = useState('');
  const [confirmCashPayerPhone, setConfirmCashPayerPhone] = useState('');

  // Active Preset Highlight state
  const [activePreset, setActivePreset] = useState<number | null>(null);

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

  // Touch & Hold Soccer Progress States
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [goalCelebration, setGoalCelebration] = useState(false);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef(0);

  // Play audio synthesize chime & whistle
  const playSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.38);
      gain2.gain.setValueAtTime(0.12, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start(now);
      osc1.stop(now + 0.4);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.45);

      setTimeout(() => {
        const ctx2 = new AudioContext();
        const now2 = ctx2.currentTime;
        const osc3 = ctx2.createOscillator();
        const gain3 = ctx2.createGain();
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(2200, now2);
        osc3.frequency.linearRampToValueAtTime(2250, now2 + 0.08);
        osc3.frequency.linearRampToValueAtTime(2180, now2 + 0.16);
        gain3.gain.setValueAtTime(0.06, now2);
        gain3.gain.exponentialRampToValueAtTime(0.001, now2 + 0.3);
        osc3.connect(gain3);
        gain3.connect(ctx2.destination);
        osc3.start(now2);
        osc3.stop(now2 + 0.35);
      }, 400);
    } catch (e) {
      // Context not allowed or initialized
    }
  };

  useEffect(() => {
    const handleGlobalRelease = () => {
      if (isHolding) stopHolding();
    };
    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('touchend', handleGlobalRelease);
    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('touchend', handleGlobalRelease);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, [isHolding]);

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
            setDefaultWalletName(`${defaultW.provider} (${defaultW.mobileNumber})`);
          } else {
            setHasDefaultWallet(false);
            setDefaultWalletName('');
          }
        } catch (err) {
          console.error("Error loading default wallet: ", err);
        }
      } else {
        setHasDefaultWallet(false);
        setDefaultWalletName('');
      }
    };
    
    fetchDefaultWallet();
  }, [type]);

  const handlePresetSelect = (val: number) => {
    setActivePreset(val);
    setAmount(val.toString());
  };

  const handleCustomSelect = () => {
    setActivePreset(null);
    setAmount('');
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

      // Generate smart candidate variations for Member ID, Phone, and Email
      const candidates = new Set<string>();
      candidates.add(identifierClean);
      candidates.add(identifierClean.toLowerCase());
      candidates.add(identifierClean.toUpperCase());

      // Phone number variations
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
          // Standard Bangladeshi splits
          candidates.add(`${base11.substring(0, 5)}-${base11.substring(5)}`);
          candidates.add(`${base11.substring(0, 4)}-${base11.substring(4)}`);
          candidates.add(`+88${base11.substring(0, 5)}-${base11.substring(5)}`);
          candidates.add(`+88${base11}`);
          candidates.add(`88${base11}`);
        }
      }

      // Member ID suffix matching
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

      // 1. Query by unique identifier candidates (Member ID, Phone, Email)
      const queriesToRun: any[] = [];
      uniqueCandidates.forEach(cand => {
        queriesToRun.push(query(collection(db, 'users'), where('memberId', '==', cand)));
        queriesToRun.push(query(collection(db, 'users'), where('phone', '==', cand)));
        if (cand.includes('@')) {
          queriesToRun.push(query(collection(db, 'users'), where('email', '==', cand.toLowerCase())));
        }
      });

      if (queriesToRun.length > 0) {
        // Query up to 30 queries in parallel chunks of 10
        const chunkSize = 10;
        for (let i = 0; i < queriesToRun.length; i += chunkSize) {
          const chunk = queriesToRun.slice(i, i + chunkSize);
          const snaps = await Promise.all(chunk.map(q => getDocs(q)));
          for (const snap of snaps) {
            if (!snap.empty) {
              foundUser = { uid: snap.docs[0].id, ...(snap.docs[0].data() as any) };
              break;
            }
          }
          if (foundUser) break;
        }
      }

      // 2. Query by Name (Case-insensitive matching / Prefix check) if still not found and input looks like a name
      if (!foundUser && /^[a-zA-Z\s.-]+$/.test(identifierClean) && identifierClean.length >= 3) {
        const titleCase = identifierClean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        const upper = identifierClean.toUpperCase();
        const lower = identifierClean.toLowerCase();

        const nameCandidates = Array.from(new Set([identifierClean, titleCase, upper, lower]));
        const nameQueries = nameCandidates.map(nc => 
          query(collection(db, 'users'), where('name', '==', nc))
        );
        
        const nameSnaps = await Promise.all(nameQueries.map(q => getDocs(q)));
        for (const snap of nameSnaps) {
          if (!snap.empty) {
            foundUser = { uid: snap.docs[0].id, ...(snap.docs[0].data() as any) };
            break;
          }
        }

        // If still not found, do a prefix query on "name"
        if (!foundUser) {
          const prefixQuery = query(
            collection(db, 'users'),
            where('name', '>=', titleCase),
            where('name', '<=', titleCase + '\uf8ff')
          );
          const prefixSnap = await getDocs(prefixQuery);
          if (!prefixSnap.empty) {
            foundUser = { uid: prefixSnap.docs[0].id, ...(prefixSnap.docs[0].data() as any) };
          }
        }
      }

      if (!foundUser) {
        setTransferError('No T.U.T. account found.');
      } else if (foundUser.uid === currentUserUid) {
        setTransferError('You cannot transfer money to yourself.');
      } else if (foundUser.status !== 'approved') {
        setTransferError('Recipient account is not approved yet.');
      } else {
        setVerifiedRecipient(foundUser);
        addToast('Recipient Verified', `Ready to send to ${foundUser.name}`, 'success');
      }
    } catch (err: any) {
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

      const senderUid = user.uid;
      const recipientUid = verifiedRecipient.uid;

      await updateDoc(doc(db, 'users', senderUid), {
        totalDeposit: increment(-transferAmt)
      });

      await updateDoc(doc(db, 'users', recipientUid), {
        totalDeposit: increment(transferAmt)
      });

      const senderTxMemoId = `TUT-TX-${Math.floor(100000 + Math.random() * 900000)}`;
      const recipientTxMemoId = `TUT-TX-${Math.floor(100000 + Math.random() * 900000)}`;

      await addDoc(collection(db, 'transactions'), {
        userId: senderUid,
        userName: profile.name,
        type: 'refund',
        isTransfer: true,
        transferType: 'out',
        transferRecipientName: verifiedRecipient.name,
        transferRecipientId: verifiedRecipient.memberId || 'Approved Member',
        amount: transferAmt,
        method: 'Cash',
        status: 'confirmed',
        timestamp: serverTimestamp(),
        memoId: senderTxMemoId,
        accountNumber: verifiedRecipient.memberId || 'N/A',
        reference: transferReference.trim()
      });

      await addDoc(collection(db, 'transactions'), {
        userId: recipientUid,
        userName: verifiedRecipient.name,
        type: 'deposit',
        isTransfer: true,
        transferType: 'in',
        transferSenderName: profile.name,
        transferSenderId: profile.memberId || 'Approved Member',
        amount: transferAmt,
        method: 'Cash',
        status: 'confirmed',
        timestamp: serverTimestamp(),
        memoId: recipientTxMemoId,
        accountNumber: profile.memberId || 'N/A',
        reference: transferReference.trim()
      });

      setTransferSuccess({
        amount: transferAmt,
        recipientName: verifiedRecipient.name,
        recipientId: verifiedRecipient.memberId || 'Approved Member',
        memoId: senderTxMemoId,
        date: new Date(),
        reference: transferReference.trim()
      });

      addToast('Transfer Completed', `Successfully sent ৳${transferAmt.toLocaleString()} BDT`, 'success');
      sendNotification('T.U.T. Ledger Funds Dispatched', `You have sent ৳${transferAmt.toLocaleString()} to ${verifiedRecipient.name}.`, user.email);
      
      if (verifiedRecipient.email) {
        sendNotification('T.U.T. Ledger Funds Received', `You have received ৳${transferAmt.toLocaleString()} from ${profile.name}.`, verifiedRecipient.email);
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Incorrect account password. Please try again.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMsg = 'Incorrect password. Enter the password you use to log into your T.U.T. account.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      addToast('Verification Failed', errorMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleStandardRequestSubmit = async (isBackground: boolean = false) => {
    if (!auth.currentUser || !profile) return;
    const reqAmt = parseFloat(amount);

    if (type === 'loan') {
      const currentDebt = profile.remainingDebt || 0;
      const proposedTotalDebt = currentDebt + reqAmt;
      const userTier = profile.subscriptionTier || 'bronze';
      const defaultTierLimit = userTier === 'gold' ? 2500 : userTier === 'silver' ? 1500 : 500;
      const limit = profile.borrowingLimit ?? defaultTierLimit;
      if (proposedTotalDebt > limit) {
        addToast('Borrowing Limit Exceeded', `Your total debt with this request (৳${proposedTotalDebt.toLocaleString()}) would exceed your approved ${userTier.toUpperCase()} tier credit limit (৳${limit.toLocaleString()} BDT).`, 'warning');
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
        method: method,
        status: 'pending',
        memoId: txMemoId,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      };

      if (type === 'loan' || type === 'refund') {
        if (method === 'Cash') {
          payload.accountNumber = 'Cash';
          payload.transactionId = 'CASH-PAYOUT';
        } else {
          payload.accountNumber = accountNumber;
          payload.transactionId = trxId || txMemoId;
          if (method === 'Recharge') {
            payload.mobileOperator = mobileOperator;
          }
        }
      } else {
        if (method === 'Cash') {
          payload.accountNumber = cashPayerPhone;
          payload.transactionId = cashPayerName || 'CASH-HANDOVER';
          payload.cashPayerName = cashPayerName;
          payload.cashPayerPhone = cashPayerPhone;
        } else {
          payload.accountNumber = accountNumber;
          payload.transactionId = trxId || txMemoId;
        }
      }

      if (type === 'loan') {
        const finalReason = loanReason.trim() || 'Education Support';
        payload.loanReason = finalReason;
        payload.reason = finalReason;
        payload.purpose = finalReason;
        payload.estimatedRepaymentDate = estimatedRepaymentDate;
      }

      await addDoc(collection(db, 'transactions'), payload);
      await sendNotification('New Transaction Request', `${profile.name} submitted a ${type} request for ৳${reqAmt.toLocaleString()}.`, 'tahsinullahtusher999@gmail.com');
      
      addToast('Request Dispatched', `Your ${type.replace('_', ' ')} request of ৳${reqAmt.toLocaleString()} was successfully logged in the secure queue.`, 'success');
      if (!isBackground) {
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      addToast('Submission Failed', 'Failed to submit transaction to secure database.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionRequestSubmit = async (isBackground: boolean = false) => {
    if (!auth.currentUser || !profile) return;
    
    setLoading(true);
    try {
      const pricing = getSubscriptionPricing(selectedSubTier || 'bronze', profile);
      const months = pricing.months || 1;
      const today = new Date();
      let expiresAt = new Date();
      if (profile.subscriptionStatus === 'active' && profile.subscriptionExpiresAt) {
        const currentExp = new Date(profile.subscriptionExpiresAt);
        if (currentExp > today) {
          expiresAt = new Date(currentExp);
        }
      }
      expiresAt.setDate(expiresAt.getDate() + (months * 30));
      const tierLimit = selectedSubTier === 'gold' ? 2500 : selectedSubTier === 'silver' ? 1500 : 500;

      const safeUserName = profile?.name || auth.currentUser.displayName || 'Member';
      const safeAccountNumber = subSenderMobile || profile?.phone || '01XXXXXXXXX';
      const subMemoId = `TUT-SUB-${Date.now().toString().slice(-6)}`;

      const payload: any = {
        userId: auth.currentUser.uid,
        userName: safeUserName,
        type: 'subscription',
        amount: pricing.price,
        method: subWallet || 'bKash',
        accountNumber: safeAccountNumber,
        transactionId: subTrxId || subMemoId,
        memoId: subMemoId,
        status: 'confirmed',
        subscriptionTier: selectedSubTier,
        subscriptionMonths: months,
        timestamp: serverTimestamp()
      };
      
      await addDoc(collection(db, 'transactions'), payload);
      
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        subscriptionStatus: 'active',
        subscriptionTier: selectedSubTier,
        subscriptionExpiresAt: expiresAt.toISOString(),
        borrowingLimit: tierLimit,
        continuousSubscriptionMonths: (profile?.continuousSubscriptionMonths || 0) + months,
        lastSubscriptionPaidAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (pricing.price > 0) {
        try {
          const fundsDocRef = doc(db, 'system_controls', 'funds');
          await setDoc(fundsDocRef, {
            personalFund: increment(pricing.price),
            subscriptionFund: increment(pricing.price),
            totalReserve: increment(pricing.price),
            updatedAt: serverTimestamp()
          }, { merge: true });

          const reservesDocRef = doc(db, 'system_controls', 'reserves');
          await setDoc(reservesDocRef, {
            primaryTarget: increment(pricing.price),
            subscriptionReserveContribution: increment(pricing.price),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn("Reserve funds sync note:", e);
        }

        try {
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
            paymentMethod: subWallet || 'bKash',
            accountNumber: safeAccountNumber,
            transactionId: subTrxId || subMemoId,
            memoId: subMemoId,
            allocatedToReserve: true,
            reserveDestination: 'Main Zero-Usury Lending Liquidity Reserve',
            status: 'confirmed',
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString()
          });
        } catch (e) {
          console.warn("Subscription funds record note:", e);
        }
      }
      
      await sendNotification('Subscription Activated', `${profile.name} activated ${selectedSubTier} subscription tier.`, 'tahsinullahtusher999@gmail.com');
      
      addToast('Charter Activated', `Your ${selectedSubTier?.toUpperCase()} subscription tier is active! Limit: ৳${tierLimit.toLocaleString()} BDT.`, 'success');
      if (!isBackground) {
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      addToast('Submission Failed', 'Failed to secure subscription request.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Touch/Hold Soccer ball confirmation handler
  const startHolding = () => {
    if (isStep2Invalid()) return;
    setIsHolding(true);
    progressRef.current = 0;
    setHoldProgress(0);

    holdIntervalRef.current = setInterval(() => {
      progressRef.current += 4.5; // snaps to 100 in about 0.9 seconds
      if (progressRef.current >= 100) {
        progressRef.current = 100;
        setHoldProgress(100);
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        triggerSuccessCelebration();
      } else {
        setHoldProgress(progressRef.current);
      }
    }, 40);
  };

  const stopHolding = () => {
    setIsHolding(false);
    if (progressRef.current < 100) {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      let bounceBack = progressRef.current;
      holdIntervalRef.current = setInterval(() => {
        bounceBack -= 10;
        if (bounceBack <= 0) {
          bounceBack = 0;
          if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        }
        progressRef.current = bounceBack;
        setHoldProgress(bounceBack);
      }, 15);
    }
  };

  const triggerSuccessCelebration = () => {
    playSuccessSound();
    setGoalCelebration(true);

    // Immediately trigger backend submission concurrently during the celebration animation
    let submissionPromise: Promise<any>;
    if (type === 'transfer') {
      submissionPromise = executeTransferSubmit();
    } else if (type === 'subscription') {
      submissionPromise = handleSubscriptionRequestSubmit(true);
    } else {
      submissionPromise = handleStandardRequestSubmit(true);
    }

    // Keep celebration on screen for at least 2000ms
    setTimeout(async () => {
      try {
        await submissionPromise;
      } catch (err) {
        console.error("Secure background submit error during celebration:", err);
      }
      setGoalCelebration(false);
      if (type !== 'transfer') {
        onClose();
      }
    }, 2000);
  };

  // Validation routines per step
  const isStep1Valid = () => {
    if (type === 'subscription') return true;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return false;

    if (type === 'pay_due') {
      const remaining = profile.remainingDebt || 0;
      if (numAmount > remaining) return false;
    }
    if (type === 'refund') {
      const balance = profile.totalDeposit || 0;
      if (numAmount > balance) return false;
    }
    if (type === 'transfer') {
      const balance = profile.totalDeposit || 0;
      if (numAmount > balance) return false;
      if (!verifiedRecipient) return false;
      if (transferPassword.trim().length === 0) return false;
    }
    if (type === 'loan') {
      if (loanReason.trim().length < 3 || !estimatedRepaymentDate) return false;
    }

    return true;
  };

  const isStep2Valid = () => {
    if (!isStep1Valid()) return false;

    if (type === 'transfer') return true; // peer ledger does not need external phone verification logs

    const currentWallet = type === 'subscription' ? subWallet : method;

    if (currentWallet === 'Cash') {
      // If receiving money, Cash method asks nothing
      if (type === 'loan' || type === 'refund') {
        return true;
      }
      // If giving money, Cash method asks for name and phone
      if (type === 'subscription') {
        return subSenderMobile.trim().length > 0 && subTrxId.trim().length > 0;
      } else {
        return (
          cashPayerName.trim().length > 0 &&
          cashPayerPhone.trim().length > 0 &&
          cashPayerPhone === confirmCashPayerPhone
        );
      }
    }

    // For digital payment (bKash, Nagad, Recharge)
    const currentAcct = type === 'subscription' ? subSenderMobile : accountNumber;
    const currentConfirm = type === 'subscription' ? subSenderMobile : confirmAccountNumber;

    if (!currentAcct.trim()) return false;
    if (type !== 'subscription' && currentAcct !== currentConfirm) return false;

    if (type === 'subscription') {
      if (!subTrxId.trim()) return false;
    }

    return true;
  };

  const isStep2Invalid = () => {
    return !isStep2Valid();
  };

  const getPersonalNumber = () => {
    const activeMethod = type === 'subscription' ? subWallet : method;
    return activeMethod === 'Bkash' ? '01713710607' : '01921801100';
  };

  const getTransactionLabel = () => {
    switch (type) {
      case 'loan': return 'Request New Loan';
      case 'deposit': return 'Deposit Funds';
      case 'refund': return 'Request Refund';
      case 'pay_due': return 'Repay Due';
      case 'transfer': return 'Send Money';
      case 'subscription': return 'Upgrade Membership';
      default: return 'Secure Transaction';
    }
  };

  const getLimitLabel = () => {
    const userTier = profile.subscriptionTier || 'bronze';
    const defaultTierLimit = userTier === 'gold' ? 2500 : userTier === 'silver' ? 1500 : 500;
    const tierLimit = profile.borrowingLimit ?? defaultTierLimit;
    switch (type) {
      case 'loan':
        return `Borrow Capacity: ৳${Math.max(0, tierLimit - (profile.remainingDebt || 0)).toLocaleString()}`;
      case 'deposit':
        return `Current Balance: ৳${(profile.totalDeposit || 0).toLocaleString()}`;
      case 'refund':
        return `Refundable Balance: ৳${(profile.totalDeposit || 0).toLocaleString()}`;
      case 'pay_due':
        return `Outstanding Debt: ৳${(profile.remainingDebt || 0).toLocaleString()}`;
      case 'transfer':
        return `Sendable Balance: ৳${(profile.totalDeposit || 0).toLocaleString()}`;
      case 'subscription':
        return `Active Plan: ${(profile.subscriptionTier || 'NONE').toUpperCase()} (Limit: ৳${tierLimit.toLocaleString()})`;
      default:
        return '';
    }
  };

  // SVG Brand icon components to match mockup exactly
  const bKashOrigamiIcon = (
    <svg className="w-8 h-8 shrink-0 text-[#E2136E]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 12 L88 44 L70 88 L50 64 L30 88 L12 44 Z" fill="currentColor" />
      <path d="M50 32 L68 48 L50 64 L32 48 Z" fill="white" opacity="0.9" />
    </svg>
  );

  const NagadFlameIcon = (
    <svg className="w-8 h-8 shrink-0 text-[#F15A22]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 80C25 80 40 45 50 45C60 45 75 80 75 80C75 80 62 68 50 68C38 68 25 80 25 80Z" fill="currentColor" />
      <circle cx="50" cy="28" r="14" fill="currentColor" />
    </svg>
  );

  const BankColumnsIcon = (
    <svg className="w-8 h-8 shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M4 10l8-7 8 7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const RechargeMobileIcon = (
    <svg className="w-8 h-8 shrink-0 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <path d="M12 18h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const CashNoteIcon = (
    <svg className="w-8 h-8 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 12h.01M18 12h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const confettiParticles = React.useMemo(() => {
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      x: Math.random() * 320 - 160,
      y: Math.random() * -240 - 100,
      size: Math.random() * 8 + 4,
      color: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'][Math.floor(Math.random() * 6)],
      delay: Math.random() * 0.3,
      duration: Math.random() * 1.3 + 1.1
    }));
  }, [goalCelebration]);

  // Calculations for Step 1 Info Box Chart Ring
  const userTier = profile.subscriptionTier || 'bronze';
  const defaultTierLimit = userTier === 'gold' ? 2500 : userTier === 'silver' ? 1500 : 500;
  const borrowingLimit = profile.borrowingLimit ?? defaultTierLimit;
  const remainingDebt = profile.remainingDebt || 0;
  const usedPercentage = type === 'loan' 
    ? Math.min(100, Math.max(0, (remainingDebt / borrowingLimit) * 100))
    : type === 'pay_due'
      ? Math.min(100, Math.max(0, (remainingDebt / borrowingLimit) * 100))
      : 0;

  return (
    <div className="fixed inset-0 z-50 w-full h-screen bg-[#02050e] flex flex-col text-slate-100 overflow-hidden font-sans select-none">
      
      {/* Background glowing effects */}
      <div className="absolute top-0 left-1/4 w-[350px] h-[350px] bg-blue-600/5 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-purple-600/5 rounded-full blur-[90px] pointer-events-none" />

      {/* HEADER BAR */}
      <div className="w-full bg-[#04091a]/95 backdrop-blur-xl border-b border-white/5 py-3 px-5 flex items-center justify-between shrink-0 z-30">
        <button 
          onClick={() => {
            if (step === 3) {
              if (type === 'transfer') {
                setStep(1);
              } else {
                setStep(2);
              }
            } else if (step === 2) {
              setStep(1);
            } else {
              onClose();
            }
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-black uppercase tracking-wider cursor-pointer",
            step > 1 
              ? "border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white" 
              : "border-red-500/30 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white hover:border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
          )}
        >
          <ArrowLeft className={cn("w-4 h-4 transition-colors", step > 1 ? "text-blue-500" : "text-red-400 group-hover:text-white")} /> 
          {step > 1 ? 'Back' : 'Exit'}
        </button>

        <div className="text-center">
          <h1 className="text-base font-black tracking-wider text-white uppercase leading-none">
            {getTransactionLabel()}
          </h1>
          <p className="text-[10px] text-slate-400 font-extrabold tracking-widest mt-1 uppercase">
            Step {type === 'transfer' ? (step === 3 ? 2 : 1) : step} of {type === 'transfer' ? 2 : 3}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 text-xs font-black tracking-widest text-emerald-400">
            <Shield className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            SECURE
          </div>
          <a
            href="https://wa.me/8801713710607"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-black text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider underline decoration-blue-500/30 underline-offset-4 cursor-pointer shrink-0"
          >
            Need Help?
          </a>
        </div>
      </div>

      {/* STEPPER PROGRESS CIRCLES */}
      <div className="w-full max-w-sm mx-auto px-5 py-3 shrink-0 flex items-center justify-center gap-3.5 z-20">
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border transition-all",
            step === 1 
              ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
              : "bg-emerald-500 text-white border-emerald-400"
          )}>
            {step > 1 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '1'}
          </span>
          <span className={cn(
            "text-xs font-black uppercase tracking-wider transition-all",
            step === 1 ? "text-blue-400" : "text-emerald-400"
          )}>
            Details
          </span>
        </div>

        {type !== 'transfer' && (
          <>
            <div className={cn("h-0.5 w-6 transition-all", step > 1 ? "bg-emerald-500" : "bg-white/10")} />

            <div className="flex items-center gap-2">
              <span className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border transition-all",
                step === 2 
                  ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
                  : step === 3
                    ? "bg-emerald-500 text-white border-emerald-400"
                    : "bg-slate-900 text-slate-500 border-white/5"
              )}>
                {step > 2 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '2'}
              </span>
              <span className={cn(
                "text-xs font-black uppercase tracking-wider transition-all",
                step === 2 ? "text-blue-400" : step === 3 ? "text-emerald-400" : "text-slate-500"
              )}>
                {type === 'deposit' || type === 'pay_due' || type === 'subscription' ? 'Payment' : 'Receiving'}
              </span>
            </div>
          </>
        )}

        <div className={cn("h-0.5 w-6 transition-all", (type === 'transfer' ? step === 3 : step > 2) ? "bg-emerald-500" : "bg-white/10")} />

        <div className="flex items-center gap-2">
          <span className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border transition-all",
            step === 3 
              ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
              : "bg-slate-900 text-slate-500 border-white/5"
          )}>
            {type === 'transfer' ? '2' : '3'}
          </span>
          <span className={cn(
            "text-xs font-black uppercase tracking-wider transition-all",
            step === 3 ? "text-blue-400" : "text-slate-500"
          )}>
            Confirm
          </span>
        </div>
      </div>

      {/* VIEW WORKSPACE WRAPPER */}
      <div className="flex-1 w-full max-w-md mx-auto px-5 pb-5 overflow-hidden flex flex-col z-10 justify-between">
        
        {transferSuccess ? (
          /* TRANSACTION COMPLETED RECEIPT BOARDING PASS */
          <div className="w-full flex-1 flex flex-col justify-center py-2 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full bg-[#050a17] border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              
              <div className="space-y-1">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">TRANSACTION APPROVED</p>
                <h3 className="text-2xl font-black font-mono text-white mt-1">৳ {transferSuccess.amount.toLocaleString()}</h3>
                <p className="text-xs text-slate-400 mt-1">Ledger funds updated instantly</p>
              </div>

              <div className="relative w-full p-4 bg-slate-950/70 rounded-xl border border-white/5 text-xs text-left space-y-3 overflow-hidden">
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#02050e] border-r border-white/5" />
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#02050e] border-l border-white/5" />
                
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Beneficiary</span>
                  <span className="text-white font-bold">{transferSuccess.recipientName}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">ID Code</span>
                  <span className="text-amber-400 font-mono font-bold uppercase">{transferSuccess.recipientId}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Reference ID</span>
                  <span className="text-blue-400 font-mono font-bold">{transferSuccess.memoId}</span>
                </div>
                {transferSuccess.reference && (
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Reference</span>
                    <span className="text-blue-300 font-bold max-w-[180px] truncate">{transferSuccess.reference}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Timestamp</span>
                  <span className="text-white font-medium">{format(transferSuccess.date, 'dd MMM yyyy, HH:mm')}</span>
                </div>

                <div className="border-t border-dashed border-white/10 pt-3 flex flex-col items-center">
                  <div className="flex gap-[1.5px] h-5 opacity-25">
                    {[1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3].map((w, i) => (
                      <div key={i} className="bg-white h-full" style={{ width: `${w}px` }} />
                    ))}
                  </div>
                  <span className="text-[8px] text-slate-500 font-mono tracking-widest uppercase mt-1">SECURED LEDGER TRANSACTION</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
              >
                Close Portal
              </button>
            </motion.div>
          </div>
        ) : (
          /* WORKSPACE PORTAL SCREEN WITH 3 OPTIMIZED WIZARD VIEWS */
          <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
            
            {/* Premium, High-Fidelity Ledger Sync Overlay */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[#02050e]/96 backdrop-blur-md z-50 flex flex-col items-center justify-center space-y-4"
                >
                  <div className="relative flex items-center justify-center w-16 h-16">
                    <div className="w-12 h-12 rounded-full border-4 border-blue-500/10 border-t-blue-500 animate-spin" />
                    <Lock className="w-5 h-5 text-blue-400 absolute animate-pulse" />
                  </div>
                  <div className="text-center space-y-1.5 px-6">
                    <p className="text-xs font-black text-white uppercase tracking-widest">Securing Ledger Connection...</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Synchronizing dual-signature verification tickets</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <AnimatePresence mode="wait">
              
              {/* STEP 1: TRANSACTION DETAILS & PARAMETERS */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  className="flex-1 flex flex-col justify-between overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 scrollbar-thin scrollbar-thumb-white/10 pb-2">
                    
                    {/* LIMIT INFORMATION BADGE with Circular ring */}
                    <div className="p-4 bg-slate-900/60 border border-white/5 rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">Your Borrow Limit</span>
                          <span className="text-slate-500 text-xs cursor-pointer">ⓘ</span>
                        </div>
                        <h4 className="text-2xl font-black text-emerald-400 font-mono">
                          ৳{(type === 'loan' ? borrowingLimit : type === 'deposit' || type === 'refund' || type === 'transfer' ? (profile.totalDeposit || 0) : remainingDebt).toLocaleString()}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">Available to transact</p>
                      </div>

                      {/* Circle Ring Progress Indicator */}
                      <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="28" cy="28" r="22" className="stroke-slate-800" strokeWidth="4.5" fill="transparent" />
                          <circle cx="28" cy="28" r="22" className="stroke-blue-500 transition-all duration-300" strokeWidth="4.5" fill="transparent"
                            strokeDasharray={2 * Math.PI * 22}
                            strokeDashoffset={2 * Math.PI * 22 * (1 - (usedPercentage / 100))} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                          <span className="text-[10px] font-black font-mono text-white">{Math.round(usedPercentage)}%</span>
                          <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Used</span>
                        </div>
                      </div>
                    </div>

                    {/* MAIN INPUT GROUP - AMOUNT & PRESETS */}
                    <div className="bg-[#050a17]/90 border border-white/5 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        {type === 'loan' ? <Coins className="w-4 h-4 text-amber-400" /> : <Wallet className="w-4 h-4 text-blue-400" />}
                        <h3 className="text-xs font-black uppercase text-white tracking-widest">
                          {type === 'loan' ? 'Loan Amount (BDT)' : 'Transaction Amount'}
                        </h3>
                      </div>

                      {type !== 'subscription' && (
                        <div className="space-y-2">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">৳</span>
                            <input
                              type="number"
                              value={amount}
                              onChange={(e) => {
                                setAmount(e.target.value);
                                setActivePreset(null);
                              }}
                              placeholder="0"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-7 pr-16 py-2.5 text-base text-white font-mono font-black focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                            />
                            {type === 'refund' || type === 'transfer' ? (
                              <button
                                type="button"
                                onClick={() => handlePresetSelect(profile?.totalDeposit || 0)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer"
                              >
                                Max
                              </button>
                            ) : type === 'pay_due' ? (
                              <button
                                type="button"
                                onClick={() => handlePresetSelect(profile?.remainingDebt || 0)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer"
                              >
                                Max
                              </button>
                            ) : null}
                          </div>

                          {/* Presets Grid: Recommended 500, 1000, 1500 */}
                          <div className="grid grid-cols-4 gap-2">
                            {[500, 1000, 1500, 5000].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handlePresetSelect(val)}
                                className={cn(
                                  "py-1.5 rounded-lg text-xs font-black border transition-all cursor-pointer text-center font-mono leading-none",
                                  activePreset === val
                                    ? "bg-blue-600 border-blue-500 text-white shadow-[0_0_6px_rgba(37,99,235,0.3)]"
                                    : "bg-slate-950 border-white/5 text-slate-400 hover:border-white/15"
                                )}
                              >
                                ৳{val.toLocaleString()}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={handleCustomSelect}
                              className={cn(
                                "py-1.5 rounded-lg text-xs font-black border transition-all cursor-pointer text-center leading-none",
                                activePreset === null && amount !== ''
                                  ? "bg-blue-600 border-blue-500 text-white"
                                  : "bg-slate-950 border-white/5 text-slate-400 hover:border-white/15"
                              )}
                            >
                              Custom
                            </button>
                          </div>
                        </div>
                      )}

                      {type === 'subscription' && (
                        <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 flex justify-between items-center leading-none">
                          <div className="space-y-1">
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Upgrade Tier</p>
                            <h4 className="text-xs font-black text-white font-mono">{getSubscriptionPricing(selectedSubTier || 'bronze', profile).label}</h4>
                          </div>
                          <span className="text-sm font-black text-blue-400 font-mono">৳{getSubscriptionPricing(selectedSubTier || 'bronze', profile).price.toLocaleString()} BDT</span>
                        </div>
                      )}
                    </div>

                    {/* RECIPIENT / DETAILS SPECIFIC FOR TRANSFERS OR LOANS */}
                    <div className="bg-[#050a17]/90 border border-white/5 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <User className="w-4 h-4 text-blue-400" />
                        <h3 className="text-xs font-black uppercase text-white tracking-widest">
                          {type === 'loan' ? 'Reason for Loan' : 'Auth & Receiver Details'}
                        </h3>
                      </div>

                      {type === 'transfer' && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={transferIdentifier}
                                onChange={(e) => {
                                  setTransferIdentifier(e.target.value);
                                  setVerifiedRecipient(null);
                                  setTransferError('');
                                }}
                                placeholder="Member ID, Phone, or Email"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                              />
                              <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-600" />
                            </div>
                            <button
                              type="button"
                              onClick={handleVerifyRecipient}
                              disabled={verifyLoading || !transferIdentifier}
                              className="px-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase rounded-xl tracking-wider transition-all disabled:opacity-30 cursor-pointer flex items-center justify-center shrink-0"
                            >
                              {verifyLoading ? '...' : 'Verify'}
                            </button>
                          </div>
                          
                          {transferError && (
                            <p className="text-xs text-rose-400 font-bold uppercase mt-1.5 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {transferError}
                            </p>
                          )}
                          
                          {verifiedRecipient && (
                            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex justify-between items-center leading-none">
                              <div className="flex items-center gap-1.5 text-emerald-400">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-black uppercase">Recipient: {verifiedRecipient.name}</span>
                              </div>
                              <span className="text-xs font-mono text-amber-400 font-bold">{verifiedRecipient.memberId || 'Active'}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {type === 'loan' && (
                        <div className="space-y-3">
                          <textarea
                            value={loanReason}
                            onChange={(e) => setLoanReason(e.target.value.slice(0, 120))}
                            placeholder="Write the reason for your loan..."
                            rows={2}
                            maxLength={120}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-600 resize-none h-14"
                          />
                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-1.5">
                              {['Education Support', 'Emergency Needs', 'Medical Expense', 'Family Support'].map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setLoanReason(r)}
                                  className={cn(
                                    "px-2 py-0.5 rounded-lg text-[9.5px] font-bold border transition-all cursor-pointer",
                                    loanReason === r
                                      ? "bg-blue-600 border-blue-500 text-white"
                                      : "bg-slate-950 border-white/10 text-slate-400 hover:border-white/20"
                                  )}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold leading-none shrink-0 ml-1">
                              {loanReason.length}/120
                            </span>
                          </div>
                        </div>
                      )}

                      {type === 'transfer' && (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Reference (Optional)</label>
                            <input
                              type="text"
                              value={transferReference}
                              onChange={(e) => setTransferReference(e.target.value.slice(0, 100))}
                              placeholder="Enter optional transfer note / reference"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700 font-medium"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Account PIN/Password</label>
                            <input
                              type="password"
                              value={transferPassword}
                              onChange={(e) => setTransferPassword(e.target.value)}
                              placeholder="Enter account login password"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                            />
                          </div>
                        </div>
                      )}

                      {type !== 'transfer' && type !== 'loan' && (
                        <p className="text-xs text-slate-400 leading-relaxed uppercase font-semibold">
                          {type === 'deposit' || type === 'pay_due' || type === 'subscription'
                            ? 'Please provide correct payment details in the next step for verification logs.'
                            : 'Please provide correct payout/receiving details in the next step for verification logs.'}
                        </p>
                      )}
                    </div>

                    {/* ESTIMATED REPAYMENT DATE (LOAN ONLY) */}
                    {type === 'loan' && (
                      <div className="bg-[#050a17]/90 border border-white/5 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2 text-white">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          <label className="text-xs font-black uppercase tracking-widest">Estimated Repayment Date</label>
                        </div>
                        <input
                          type="date"
                          value={estimatedRepaymentDate}
                          onChange={(e) => setEstimatedRepaymentDate(e.target.value)}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-all font-mono font-bold"
                        />
                        <div className="flex items-center gap-1.5 pt-1">
                          {[30, 60, 90].map((days) => {
                            const dStr = format(new Date(Date.now() + days * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
                            return (
                              <button
                                key={days}
                                type="button"
                                onClick={() => setEstimatedRepaymentDate(dStr)}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer",
                                  estimatedRepaymentDate === dStr
                                    ? "bg-blue-600 border-blue-500 text-white"
                                    : "bg-slate-950 border-white/10 text-slate-400 hover:border-white/20"
                                )}
                              >
                                {days === 30 ? '+1 Month' : days === 60 ? '+2 Months' : '+3 Months'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>

                  {/* STEP 1 ACTION FOOTER */}
                  <div className="pt-2 border-t border-white/5 shrink-0 bg-[#02050e] space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isStep1Valid()) {
                          if (type === 'transfer') {
                            setStep(3);
                          } else {
                            setStep(2);
                          }
                        }
                      }}
                      disabled={!isStep1Valid()}
                      className={cn(
                        "w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg",
                        !isStep1Valid()
                          ? "bg-slate-950 border border-white/5 text-slate-600 cursor-not-allowed opacity-40"
                          : "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/30 active:scale-98"
                      )}
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-500" /> Your information is safe and encrypted
                    </p>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: PAYMENT/PAYOUT GATEWAY & DATA */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="flex-1 flex flex-col justify-between overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 scrollbar-thin scrollbar-thumb-white/10 pb-2">
                    
                    {/* SELECT METHOD CARDS */}
                    <div className="bg-[#050a17]/90 border border-white/5 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-black uppercase text-white tracking-widest">
                          {type === 'loan' || type === 'refund' ? 'Select Payout Method' : 'Select Payment Method'}
                        </h3>
                      </div>

                      {/* Brand Grid */}
                      <div className={cn(
                        "grid gap-2",
                        (type === 'loan' || type === 'refund') ? "grid-cols-4" : "grid-cols-3"
                      )}>
                        {/* bKash */}
                        <button
                          type="button"
                          onClick={() => {
                            if (type === 'subscription') {
                              if (setSubWallet) setSubWallet('Bkash');
                            } else {
                              setMethod('Bkash');
                            }
                          }}
                          className={cn(
                            "py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer min-h-[75px]",
                            (type === 'subscription' ? subWallet : method) === 'Bkash'
                              ? "bg-pink-500/10 border-pink-500/50 text-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.25)]"
                              : "bg-slate-950/60 border-white/5 text-slate-400 hover:border-white/10"
                          )}
                        >
                          {bKashOrigamiIcon}
                          <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 leading-none">bKash</span>
                        </button>

                        {/* Nagad */}
                        <button
                          type="button"
                          onClick={() => {
                            if (type === 'subscription') {
                              if (setSubWallet) setSubWallet('Nagad');
                            } else {
                              setMethod('Nagad');
                            }
                          }}
                          className={cn(
                            "py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer min-h-[75px]",
                            (type === 'subscription' ? subWallet : method) === 'Nagad'
                              ? "bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                              : "bg-slate-950/60 border-white/5 text-slate-400 hover:border-white/10"
                          )}
                        >
                          {NagadFlameIcon}
                          <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 leading-none">Nagad</span>
                        </button>

                        {/* Mobile Recharge (Only for loan & refund) */}
                        {(type === 'loan' || type === 'refund') && (
                          <button
                            type="button"
                            onClick={() => {
                              setMethod('Recharge');
                            }}
                            className={cn(
                              "py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer min-h-[75px]",
                              method === 'Recharge'
                                ? "bg-sky-500/10 border-sky-500/50 text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.25)]"
                                : "bg-slate-950/60 border-white/5 text-slate-400 hover:border-white/10"
                            )}
                          >
                            {RechargeMobileIcon}
                            <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 leading-none">Recharge</span>
                          </button>
                        )}

                        {/* Cash Note */}
                        <button
                          type="button"
                          onClick={() => {
                            if (type === 'subscription') {
                              if (setSubWallet) setSubWallet('Cash');
                            } else {
                              setMethod('Cash');
                            }
                          }}
                          className={cn(
                            "py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer min-h-[75px]",
                            (type === 'subscription' ? subWallet : method) === 'Cash'
                              ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)]"
                              : "bg-slate-950/60 border-white/5 text-slate-400 hover:border-white/10"
                          )}
                        >
                          {CashNoteIcon}
                          <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 leading-none">Cash</span>
                        </button>
                      </div>

                      {/* Display send money details if manual cash logs - only for giving money */}
                      {type !== 'loan' && type !== 'refund' && ((type === 'subscription' ? subWallet : method) === 'Bkash' || (type === 'subscription' ? subWallet : method) === 'Nagad') && (
                        <div className="p-3 bg-slate-950 rounded-xl border border-white/5 flex items-center justify-between leading-none mt-1.5">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest leading-none block">
                              Send Money Authority Wallet
                            </span>
                            <span className="text-sm font-mono font-black text-white leading-none select-all">{getPersonalNumber()}</span>
                          </div>
                          <CopyBtn text={getPersonalNumber()} />
                        </div>
                      )}
                    </div>

                    {/* INPUTS: ACCOUNT NUMBER, CONFIRM ACCOUNT, TRXID */}
                    <div className="bg-[#050a17]/90 border border-white/5 rounded-xl p-4 space-y-3.5">
                      
                      {/* CASE 1: Cash method */}
                      {((type === 'subscription' ? subWallet : method) === 'Cash') ? (
                        (type === 'loan' || type === 'refund') ? (
                          // Receiving cash - no fields needed
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl space-y-2 text-center my-2">
                            <Coins className="w-8 h-8 text-emerald-400 mx-auto animate-pulse" />
                            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest leading-none">In-Person Cash Payout</h4>
                            <p className="text-[11px] text-slate-300 font-bold leading-normal max-w-xs mx-auto">
                              No digital wallet details required. You will receive the cash amount physically from the authority upon authorization.
                            </p>
                          </div>
                        ) : (
                          // Giving cash - asks for name & number who is giving money
                          <div className="space-y-3.5">
                            {type === 'subscription' ? (
                              <>
                                {/* Subscription Payer Name */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-slate-400">
                                    <User className="w-3.5 h-3.5 text-emerald-400" />
                                    <label className="text-xs font-black uppercase tracking-wider">Person's Name (Payer)</label>
                                  </div>
                                  <input
                                    type="text"
                                    value={subTrxId}
                                    onChange={(e) => {
                                      if (setSubTrxId) setSubTrxId(e.target.value);
                                    }}
                                    placeholder="Enter full name of the person giving cash"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                                  />
                                </div>

                                {/* Subscription Payer Phone */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-slate-400">
                                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                                    <label className="text-xs font-black uppercase tracking-wider">Person's Mobile Number</label>
                                  </div>
                                  <input
                                    type="text"
                                    value={subSenderMobile}
                                    onChange={(e) => {
                                      if (setSubSenderMobile) setSubSenderMobile(e.target.value);
                                    }}
                                    placeholder="Enter 11-digit mobile number"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                {/* General Cash Payer Name */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-slate-400">
                                    <User className="w-3.5 h-3.5 text-emerald-400" />
                                    <label className="text-xs font-black uppercase tracking-wider">Person's Name (Payer)</label>
                                  </div>
                                  <input
                                    type="text"
                                    value={cashPayerName}
                                    onChange={(e) => setCashPayerName(e.target.value)}
                                    placeholder="Enter full name of the person giving cash"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                                  />
                                </div>

                                {/* General Cash Payer Phone */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-slate-400">
                                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                                    <label className="text-xs font-black uppercase tracking-wider">Person's Mobile Number</label>
                                  </div>
                                  <input
                                    type="text"
                                    value={cashPayerPhone}
                                    onChange={(e) => setCashPayerPhone(e.target.value)}
                                    placeholder="Enter 11-digit mobile number"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                                  />
                                </div>

                                {/* General Cash Payer Phone Confirm */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-slate-400">
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <label className="text-xs font-black uppercase tracking-wider">Confirm Mobile Number</label>
                                  </div>
                                  <input
                                    type="text"
                                    value={confirmCashPayerPhone}
                                    onChange={(e) => setConfirmCashPayerPhone(e.target.value)}
                                    placeholder="Re-enter mobile number"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                                  />
                                  {cashPayerPhone && confirmCashPayerPhone && cashPayerPhone !== confirmCashPayerPhone && (
                                    <p className="text-[10px] text-rose-400 font-extrabold uppercase mt-1 leading-none">
                                      ⚠️ Mobile numbers do not match!
                                    </p>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )
                      ) : (
                        // CASE 2: Digital methods (bKash, Nagad, Recharge)
                        <>
                          {/* Mobile Operator Selector (Only when Recharge is chosen) */}
                          {method === 'Recharge' && (type === 'loan' || type === 'refund') && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                                <label className="text-xs font-black uppercase tracking-wider">Mobile Operator</label>
                              </div>
                              <select
                                value={mobileOperator}
                                onChange={(e) => setMobileOperator(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-black uppercase focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
                              >
                                <option value="Grameenphone" className="bg-slate-950 text-white font-bold">Grameenphone</option>
                                <option value="Robi" className="bg-slate-950 text-white font-bold">Robi</option>
                                <option value="Airtel" className="bg-slate-950 text-white font-bold">Airtel</option>
                                <option value="Banglalink" className="bg-slate-950 text-white font-bold">Banglalink</option>
                                <option value="Teletalk" className="bg-slate-950 text-white font-bold">Teletalk</option>
                              </select>
                            </div>
                          )}

                          {/* Account Number input */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                              <label className="text-xs font-black uppercase tracking-wider">
                                {method === 'Recharge' ? 'Recipient Mobile Number' : 'Account Number'}
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={type === 'subscription' ? subSenderMobile : accountNumber}
                                onChange={(e) => {
                                  if (type === 'subscription') {
                                    if (setSubSenderMobile) setSubSenderMobile(e.target.value);
                                  } else {
                                    setAccountNumber(e.target.value);
                                  }
                                }}
                                placeholder={method === 'Recharge' ? 'Enter 11-digit mobile number' : `Enter ${type === 'subscription' ? subWallet : method} account number`}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                              />
                              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-lg">
                                ✈
                              </span>
                            </div>
                            {hasDefaultWallet && (type === 'loan' || type === 'refund') && (method === 'Bkash' || method === 'Nagad') && (
                              <p className="text-[9px] text-amber-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5 mt-1.5 leading-none">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                ★ Pre-filled verified primary wallet: {defaultWalletName}
                              </p>
                            )}
                          </div>

                          {/* Confirm Account Number */}
                          {type !== 'subscription' && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <Check className="w-3.5 h-3.5 text-blue-400" />
                                <label className="text-xs font-black uppercase tracking-wider">
                                  {method === 'Recharge' ? 'Confirm Mobile Number' : 'Confirm Account Number'}
                                </label>
                              </div>
                              <input
                                type="text"
                                value={confirmAccountNumber}
                                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                                placeholder={method === 'Recharge' ? 'Re-enter mobile number' : `Re-enter ${method} account number`}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                              />
                              {accountNumber && confirmAccountNumber && accountNumber !== confirmAccountNumber && (
                                <p className="text-[10px] text-rose-400 font-extrabold uppercase mt-1 leading-none">
                                  ⚠️ {method === 'Recharge' ? 'Mobile numbers do not match!' : 'Account numbers do not match!'}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Transaction ID only shown for types that require it (deposit, pay_due, subscription) */}
                          {type !== 'loan' && type !== 'refund' && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <FileText className="w-3.5 h-3.5 text-blue-400" />
                                <label className="text-xs font-black uppercase tracking-wider">
                                  Transaction ID (TrxID)
                                </label>
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={type === 'subscription' ? subTrxId : trxId}
                                  onChange={(e) => {
                                    if (type === 'subscription') {
                                      if (setSubTrxId) setSubTrxId(e.target.value);
                                    } else {
                                      setTrxId(e.target.value);
                                    }
                                  }}
                                  placeholder="Enter SMS TrxID (e.g. 9J28AB72K)"
                                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700 uppercase"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const gen = `TX${Math.floor(10000000 + Math.random() * 90000000)}`;
                                    if (type === 'subscription') {
                                      if (setSubTrxId) setSubTrxId(gen);
                                    } else {
                                      setTrxId(gen);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase text-blue-400 shrink-0 cursor-pointer"
                                >
                                  Auto-Gen
                                </button>
                              </div>
                              <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">From your bKash/Nagad SMS confirmation, or tap Auto-Gen</p>
                            </div>
                          )}
                        </>
                      )}

                    </div>

                    {/* SECURITY NOTE CONTAINER MATCHING MOCKUP */}
                    <div className="p-3 bg-amber-500/5 border border-amber-500/25 rounded-xl flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 shrink-0">
                        <Shield className="w-5 h-5 text-amber-400 stroke-[2.5]" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black text-amber-500 uppercase tracking-wide">Security Note</h4>
                        <p className="text-[10.5px] text-slate-300 font-bold leading-normal">
                          Make sure the account number is correct. Wrong number may cause payment failure.
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* STEP 2 ACTION FOOTER */}
                  <div className="pt-2 border-t border-white/5 shrink-0 bg-[#02050e] space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isStep2Valid()) setStep(3);
                      }}
                      disabled={isStep2Invalid()}
                      className={cn(
                        "w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg",
                        isStep2Invalid()
                          ? "bg-slate-950 border border-white/5 text-slate-600 cursor-not-allowed opacity-40"
                          : "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/30 active:scale-98"
                      )}
                    >
                      Continue to Review
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-500" /> Your information is safe and encrypted
                    </p>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: REVIEW & SOCCER BALL SLIDER SUBMIT */}
              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="flex-1 flex flex-col justify-between overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 scrollbar-thin scrollbar-thumb-white/10 pb-2">
                    
                    {/* REVIEW DETAILS CARD */}
                    <div className="bg-[#050a17]/90 border border-white/5 rounded-2xl p-4 overflow-hidden shadow-2xl flex flex-col">
                      
                      {/* Left & Right side notches to match boarding ticket */}
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#02050e] border-r border-white/5 z-20" />
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#02050e] border-l border-white/5 z-20" />

                      <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <h3 className="text-xs font-black uppercase text-white tracking-widest">
                            {type === 'transfer' ? 'Review Transfer Details' : type === 'loan' ? 'Review Your Loan Request' : 'Review Transaction Details'}
                          </h3>
                        </div>
                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-emerald-400 font-extrabold uppercase tracking-widest">SECURE</span>
                      </div>

                      <p className="text-xs text-slate-400 mb-4 font-bold uppercase tracking-wider text-center block">
                        Please review all information before submitting
                      </p>

                      {/* Detail Rows Matching Screen 3 table design exactly */}
                      <div className="space-y-3.5 text-xs">
                        
                        {/* Row 1: Amount */}
                        <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Shield className="w-4 h-4 text-blue-500/60" />
                            <span className="font-bold uppercase tracking-wider text-[10px]">
                              {type === 'transfer' ? 'Transfer Amount' : type === 'loan' ? 'Loan Amount' : 'Amount'}
                            </span>
                          </div>
                          <span className="text-white font-black font-mono">
                            ৳ {type === 'subscription' ? getSubscriptionPricing(selectedSubTier || 'bronze', profile).price.toLocaleString() : parseFloat(amount).toLocaleString()} BDT
                          </span>
                        </div>

                        {/* Recipient details for transfers */}
                        {type === 'transfer' && verifiedRecipient && (
                          <>
                            <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                              <div className="flex items-center gap-2 text-slate-400">
                                <User className="w-4 h-4 text-emerald-400/60" />
                                <span className="font-bold uppercase tracking-wider text-[10px]">Recipient Name</span>
                              </div>
                              <span className="text-white font-bold truncate max-w-[200px]">
                                {verifiedRecipient.name}
                              </span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                              <div className="flex items-center gap-2 text-slate-400">
                                <Shield className="w-4 h-4 text-blue-400/60" />
                                <span className="font-bold uppercase tracking-wider text-[10px]">Recipient Member ID</span>
                              </div>
                              <span className="text-blue-400 font-mono font-bold">
                                {verifiedRecipient.memberId || 'Approved Member'}
                              </span>
                            </div>
                          </>
                        )}

                        {/* Row 2: Reason for Loan */}
                        {type === 'loan' && (
                          <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                            <div className="flex items-center gap-2 text-slate-400">
                              <FileText className="w-4 h-4 text-purple-400/60" />
                              <span className="font-bold uppercase tracking-wider text-[10px]">Reason for Loan</span>
                            </div>
                            <span className="text-white font-bold truncate max-w-[200px]">{loanReason || 'Education'}</span>
                          </div>
                        )}

                        {/* Row 3: Repayment Date */}
                        {type === 'loan' && (
                          <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                            <div className="flex items-center gap-2 text-slate-400">
                              <Calendar className="w-4 h-4 text-sky-400/60" />
                              <span className="font-bold uppercase tracking-wider text-[10px]">Repayment Date</span>
                            </div>
                            <span className="text-white font-bold font-mono">
                              {estimatedRepaymentDate ? format(new Date(estimatedRepaymentDate), 'dd MMM yyyy') : '30 Jul 2026'}
                            </span>
                          </div>
                        )}

                        {/* Row 4: Payment Method */}
                        {type !== 'transfer' && (
                          <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                            <div className="flex items-center gap-2 text-slate-400">
                              {((type === 'subscription' ? subWallet : method) === 'Bkash' || (type === 'subscription' ? subWallet : method) === 'Nagad') ? (
                                <span className="text-xs">📱</span>
                              ) : <Coins className="w-4 h-4 text-amber-500/60" />}
                              <span className="font-bold uppercase tracking-wider text-[10px]">Payment Method</span>
                            </div>
                            <span className="text-white font-black uppercase tracking-widest">
                              {type === 'subscription' ? subWallet : (method === 'Recharge' ? 'Mobile Recharge' : method)}
                            </span>
                          </div>
                        )}

                        {/* Dynamic Row for Account Info / Payer Info */}
                        {(() => {
                          if (type === 'transfer') return null;
                          const currentWallet = type === 'subscription' ? subWallet : method;
                          if (currentWallet === 'Cash') {
                            if (type === 'loan' || type === 'refund') {
                              return (
                                <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                                  <div className="flex items-center gap-2 text-slate-400">
                                    <Coins className="w-4 h-4 text-emerald-400/60" />
                                    <span className="font-bold uppercase tracking-wider text-[10px]">Payout Method</span>
                                  </div>
                                  <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider">
                                    Physical Cash Handover
                                  </span>
                                </div>
                              );
                            } else {
                              // Giving cash
                              const nameVal = type === 'subscription' ? subTrxId : cashPayerName;
                              const phoneVal = type === 'subscription' ? subSenderMobile : cashPayerPhone;
                              return (
                                <>
                                  <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                                    <div className="flex items-center gap-2 text-slate-400">
                                      <User className="w-4 h-4 text-emerald-400/60" />
                                      <span className="font-bold uppercase tracking-wider text-[10px]">Payer Name</span>
                                    </div>
                                    <span className="text-white font-bold truncate max-w-[200px]">
                                      {nameVal || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-slate-400">
                                      <Smartphone className="w-4 h-4 text-emerald-400/60" />
                                      <span className="font-bold uppercase tracking-wider text-[10px]">Payer Mobile</span>
                                    </div>
                                    <span className="text-emerald-400 font-mono font-bold">
                                      {phoneVal || 'N/A'}
                                    </span>
                                  </div>
                                </>
                              );
                            }
                          } else {
                            // Digital methods
                            return (
                              <>
                                <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                                  <div className="flex items-center gap-2 text-slate-400">
                                    <Smartphone className="w-4 h-4 text-blue-400/60" />
                                    <span className="font-bold uppercase tracking-wider text-[10px]">
                                      {method === 'Recharge' ? 'Recipient Mobile' : 'Account Number'}
                                    </span>
                                  </div>
                                  <span className="text-blue-400 font-mono font-bold">
                                    {type === 'subscription' ? subSenderMobile : accountNumber}
                                  </span>
                                </div>

                                {method === 'Recharge' && (type === 'loan' || type === 'refund') && (
                                  <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                                    <div className="flex items-center gap-2 text-slate-400">
                                      <Building2 className="w-4 h-4 text-sky-400/60" />
                                      <span className="font-bold uppercase tracking-wider text-[10px]">Mobile Operator</span>
                                    </div>
                                    <span className="text-sky-400 font-bold uppercase tracking-wider">
                                      {mobileOperator}
                                    </span>
                                  </div>
                                )}

                                {type !== 'loan' && type !== 'refund' && type !== 'subscription' && (
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-slate-400">
                                      <Hash className="w-4 h-4 text-amber-400/60" />
                                      <span className="font-bold uppercase tracking-wider text-[10px]">Transaction ID</span>
                                    </div>
                                    <span className="text-amber-400 font-mono font-black uppercase">
                                      {trxId || 'TRX123456789'}
                                    </span>
                                  </div>
                                )}
                              </>
                            );
                          }
                        })()}
                      </div>

                      {/* Barcode on bottom */}
                      <div className="border-t border-dashed border-white/10 pt-3.5 mt-3.5 flex flex-col items-center">
                        <div className="flex gap-[1px] h-4 opacity-15">
                          {[2, 1, 3, 1, 4, 2, 1, 3, 2, 1, 4, 1, 3, 2, 1].map((w, i) => (
                            <div key={i} className="bg-white h-full" style={{ width: `${w}px` }} />
                          ))}
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase mt-1">
                          TUT-LEDG-TX-{Math.floor(1000 + Math.random() * 9000)}
                        </span>
                      </div>

                    </div>

                    {/* RED NOTICE */}
                    <div className="p-3 bg-rose-500/5 border border-rose-500/15 rounded-xl flex items-start gap-2">
                      <Shield className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-slate-400 uppercase leading-normal font-bold tracking-wide">
                        NOTICE: Providing fraudulent ledger verification tickets will generate system alerts and lead to instant account ban.
                      </p>
                    </div>

                  </div>

                  {/* PREMIUM HIGH-SECURITY BIOMETRIC CONFIRM SLIDER */}
                  <div className="pt-2 border-t border-white/5 shrink-0 z-20 bg-[#02050e] space-y-3">
                    
                    {/* BIOMETRIC TRACK */}
                    <div 
                      className="relative w-full h-14 rounded-2xl border flex items-center justify-between px-4 overflow-hidden select-none"
                      style={{
                        background: '#030712',
                        borderColor: '#1e293b'
                      }}
                    >
                      {/* Filling scan trail visual */}
                      <div 
                        className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-500/10 via-emerald-500/20 to-emerald-500/40 border-r border-emerald-500/40 pointer-events-none"
                        style={{ width: `${holdProgress}%` }}
                      />

                      {/* Floating overlay prompt label */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-xs font-black text-white/50 tracking-widest uppercase text-center px-10 select-none leading-none">
                          {isHolding ? 'AUTHORIZING SECURITY TOKEN...' : 'Hold & Slide to Authorize'}
                        </span>
                      </div>

                      {/* Shield Check on Extreme Right */}
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-150",
                          holdProgress >= 90 
                            ? "bg-emerald-500 border-emerald-400 text-white scale-110 shadow-[0_0_15px_#10b981]" 
                            : "bg-slate-950 border-white/10 text-slate-500"
                        )}>
                          <Shield className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Touch/Hold biometric handle */}
                      <div
                        onMouseDown={startHolding}
                        onMouseUp={stopHolding}
                        onMouseLeave={stopHolding}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          startHolding();
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          stopHolding();
                        }}
                        style={{ 
                          left: `calc(${holdProgress}% * 0.81 + 4px)`,
                        }}
                        className={cn(
                          "absolute top-1.5 w-10 h-10 rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing select-none z-20 border transition-[transform,background-color,border-color,box-shadow] duration-200",
                          isHolding 
                            ? "scale-110 bg-emerald-500 border-emerald-300 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]" 
                            : "bg-slate-900 border-white/20 text-slate-400 hover:scale-105 hover:border-slate-400"
                        )}
                      >
                        <Fingerprint className="w-5 h-5 animate-pulse" />
                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        triggerSuccessCelebration();
                      }}
                      className="w-full py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      One-Tap Instant Authorization
                    </button>

                    <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest text-center flex items-center justify-center gap-1 leading-none mt-0.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      Authorized Signature Required to Submit
                    </p>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

          </div>
        )}

      </div>

      {/* HIGH-SECURITY VERIFICATION SUCCESS CELEBRATION */}
      <AnimatePresence>
        {goalCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/98 flex flex-col items-center justify-center space-y-6 overflow-hidden"
          >
            {/* Spotlight blur glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Confetti Explosion particles */}
            {confettiParticles.map((p) => (
              <motion.div
                key={p.id}
                initial={{ x: 0, y: 120, rotate: 0, scale: 0, opacity: 1 }}
                animate={{ 
                  x: p.x, 
                  y: [120, p.y, p.y + 320], 
                  rotate: 360 * (Math.random() > 0.5 ? 2.5 : -2.5),
                  scale: [0, 1.4, 0.7],
                  opacity: [1, 1, 0]
                }}
                transition={{ 
                  duration: p.duration, 
                  delay: p.delay, 
                  ease: "easeOut" 
                }}
                className="absolute w-2.5 h-2.5 rounded-full"
                style={{ 
                  width: p.size, 
                  height: p.size, 
                  backgroundColor: p.color,
                  left: '50%',
                  top: '50%'
                }}
              />
            ))}

            <div className="relative flex items-center justify-center w-32 h-32">
              <motion.div
                animate={{ 
                  scale: [0.8, 1.1, 0.95, 1.05, 1],
                  rotate: [0, 15, -15, 0]
                }}
                transition={{ duration: 1.0, ease: "easeOut" }}
                className="w-24 h-24 rounded-full border-4 border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center filter drop-shadow-[0_0_20px_rgba(16,185,129,0.4)] z-10"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </motion.div>
              </motion.div>
              
              {/* Outer scanning rotating rings */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-2 border-dashed border-emerald-500/20 rounded-full"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-2 border border-dotted border-emerald-500/30 rounded-full"
              />
            </div>

            <motion.div
              initial={{ scale: 0.8, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-center space-y-3 px-6"
            >
              <h1 className="text-3xl font-black text-emerald-400 font-mono tracking-widest uppercase leading-none">
                VERIFICATION SECURED
              </h1>
              <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-emerald-400 to-transparent mx-auto" />
              <p className="text-sm font-black text-white/95 tracking-widest uppercase animate-pulse mt-2 leading-none">
                TRANSACTION RECORD SUBMITTED
              </p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">
                Committing records securely to T.U.T. Private Ledger...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
