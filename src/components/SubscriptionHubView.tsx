/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  ArrowLeft, 
  Copy, 
  Check, 
  CreditCard, 
  Wallet, 
  ChevronRight, 
  AlertCircle, 
  Zap, 
  FileText, 
  Award,
  ChevronDown,
  Lock,
  ArrowRight,
  RefreshCw,
  Building2,
  Info,
  X,
  Shield,
  Layers,
  CheckCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  doc, 
  updateDoc, 
  addDoc, 
  collection, 
  serverTimestamp, 
  setDoc, 
  increment 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { BankingTierCard } from './BankingTierCard';
import { TierEmblem } from './TierEmblems';
import type { UserProfile, Transaction } from '../App';

interface SubscriptionHubViewProps {
  profile: UserProfile;
  transactions: Transaction[];
  onBack: () => void;
  addToast: (title: string, msg: string, type: 'success' | 'warning' | 'danger' | 'info') => void;
  sendWorkflowNotification?: (type: string, email?: string, name?: string, meta?: any) => Promise<void>;
  onRequestAction?: (type: 'deposit') => void;
  initialTier?: 'bronze' | 'silver' | 'gold';
}

interface TierCatalogItem {
  id: 'bronze' | 'silver' | 'gold';
  name: string;
  tier: string;
  short: string;
  limit: number;
  monthly: number;
  color: string;
  accent: string;
  glow: string;
  buttonGradient: string;
  badge: string;
  buttonLabel: string;
  features: string[];
}

const TIER_CATALOG: TierCatalogItem[] = [
  {
    id: "bronze",
    name: "Bronze Basic",
    tier: "BRONZE TIER",
    short: "BRONZE",
    limit: 500,
    monthly: 0,
    color: "#B8835A",
    accent: "#D4A57A",
    glow: "rgba(212,165,122,0.25)",
    buttonGradient: "linear-gradient(135deg, #D4A57A, #B8835A)",
    badge: "100% FREE FOR ALL",
    buttonLabel: "Select Bronze Plan",
    features: [
      "৳500 / month maximum zero-usury borrowing",
      "Standard 24-hr ledger clearing queue",
      "100% Free membership unlocked for all verified members",
      "Digital Bronze Reserve membership pass"
    ]
  },
  {
    id: "silver",
    name: "Silver Executive",
    tier: "SILVER TIER",
    short: "SILVER",
    limit: 1500,
    monthly: 50,
    color: "#C5CAD3",
    accent: "#E8EBF0",
    glow: "rgba(203,213,225,0.25)",
    buttonGradient: "linear-gradient(135deg, #E8EBF0, #CBD5E1)",
    badge: "RECOMMENDED",
    buttonLabel: "Select Silver Executive",
    features: [
      "৳1,500 / month maximum zero-usury borrowing",
      "Priority fast-track clearing queue (<4 hours)",
      "Titanium Executive digital card with credentials",
      "Eligible for 50% clean ledger no-loan rebate"
    ]
  },
  {
    id: "gold",
    name: "Gold Sovereign Elite",
    tier: "GOLD TIER",
    short: "GOLD",
    limit: 2500,
    monthly: 100,
    color: "#D4AF37",
    accent: "#FFD700",
    glow: "rgba(255,215,0,0.3)",
    buttonGradient: "linear-gradient(135deg, #FFD700, #F59E0B)",
    badge: "VIP SOVEREIGN",
    buttonLabel: "Select Gold Sovereign",
    features: [
      "৳2,500 / month maximum zero-usury borrowing",
      "Instant priority clearing (<60 minutes guarantee)",
      "24K Gold Sovereign digital card pass with member crest",
      "Eligible for 100% clean ledger no-loan rebate"
    ]
  }
];

interface DurationOption {
  dur: number;
  name: string;
  off: number;
}

const DURATION_OPTIONS: DurationOption[] = [
  { dur: 1, name: 'Monthly', off: 0 },
  { dur: 3, name: 'Quarter', off: 10 },
  { dur: 6, name: 'Semi Annual', off: 15 },
  { dur: 12, name: 'Annual', off: 20 }
];

export const SubscriptionHubView: React.FC<SubscriptionHubViewProps> = ({
  profile,
  transactions,
  onBack,
  addToast,
  sendWorkflowNotification,
  onRequestAction,
  initialTier
}) => {
  // Subscription page ALWAYS opens on its main catalog page ("Update Tier")
  const [selectedPackage, setSelectedPackage] = useState<TierCatalogItem | null>(null);

  // Flow step: 1 = Duration, 2 = Review / Invoice Summary, 3 = Payment
  const [purchaseStep, setPurchaseStep] = useState<1 | 2 | 3>(1);

  // Scroll container ref to ensure top-of-page opening on all transitions
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll window and container to top on mount, package change, or step change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    const mainEl = document.querySelector('main') || document.documentElement || document.body;
    if (mainEl) mainEl.scrollTop = 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedPackage, purchaseStep]);

  // Duration selection
  const [durationMonths, setDurationMonths] = useState<number>(1);

  // Terms & Conditions agreement system
  const [termsAgreed, setTermsAgreed] = useState<boolean>(true);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);

  // Payment gateway: balance | bkash | nagad | desk
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'bkash' | 'nagad' | 'desk'>('bkash');

  // Input states
  const [senderPhone, setSenderPhone] = useState<string>(profile.phone || '');
  const [trxId, setTrxId] = useState<string>('');
  const [cashPayerName, setCashPayerName] = useState<string>(profile.name || '');
  const [cashPayerPhone, setCashPayerPhone] = useState<string>(profile.phone || '');

  // UI state
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccessScreen, setIsSuccessScreen] = useState<boolean>(false);
  const [submittedMemoId, setSubmittedMemoId] = useState<string>('');

  // Official Gateway Accounts
  const gatewayAccounts = {
    bkash: { number: '01713710607', type: 'Personal', title: 'bKash Official' },
    nagad: { number: '01921801100', type: 'Personal', title: 'Nagad Official' },
    desk: { counter: 'Counter #2', branch: 'T.U.T. Head Office Cashier', hours: '10:00 AM - 6:00 PM' }
  };

  // Financial Calculations
  const calculations = useMemo(() => {
    if (!selectedPackage) return { baseRateTotal: 0, discountPercent: 0, discountAmount: 0, lateBuffer: 0, netReserveContribution: 0, finalPayable: 0 };
    
    if (selectedPackage.id === 'bronze') {
      return {
        baseRateTotal: 0,
        discountPercent: 0,
        discountAmount: 0,
        lateBuffer: 0,
        netReserveContribution: 0,
        finalPayable: 0
      };
    }

    const durOpt = DURATION_OPTIONS.find(d => d.dur === durationMonths) || DURATION_OPTIONS[0];
    const baseRateTotal = selectedPackage.monthly * durationMonths;
    const discountPercent = durOpt.off;
    const discountAmount = Math.round(baseRateTotal * (discountPercent / 100));
    const lateBuffer = 10; // Refundable late renewal buffer
    const netReserveContribution = Math.max(0, baseRateTotal - discountAmount);
    const finalPayable = Math.max(0, netReserveContribution + lateBuffer);

    return {
      baseRateTotal,
      discountPercent,
      discountAmount,
      lateBuffer,
      netReserveContribution,
      finalPayable
    };
  }, [selectedPackage, durationMonths]);

  const canPayWithBalance = (profile.totalDeposit || 0) >= calculations.finalPayable;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    addToast('Copied', `Number ${text} copied to clipboard`, 'info');
    setTimeout(() => setCopiedText(null), 2500);
  };

  const handleSelectPackage = (pkg: TierCatalogItem) => {
    setSelectedPackage(pkg);
    setPurchaseStep(1);
    setIsSuccessScreen(false);
  };

  const handleBackToCatalog = () => {
    setSelectedPackage(null);
    setPurchaseStep(1);
    setIsSuccessScreen(false);
  };

  // Unified Subscription Payment & Reserve Allocation Handler
  const recordSubscriptionPayment = async ({
    methodLabel,
    accountNumber,
    transactionId,
    memoId,
    targetDate
  }: {
    methodLabel: string;
    accountNumber: string;
    transactionId: string;
    memoId: string;
    targetDate: Date;
  }) => {
    if (!auth.currentUser || !selectedPackage) return;
    const uid = auth.currentUser.uid;
    const safeUserName = profile?.name || auth.currentUser.displayName || 'T.U.T. Member';
    const safeUserEmail = profile?.email || auth.currentUser.email || '';
    const safeUserPhone = profile?.phone || senderPhone || cashPayerPhone || '';
    const safeMemberId = profile?.memberId || 'N/A';
    const payableAmount = Number(calculations.finalPayable) || 0;

    // 1. Update user profile
    const userRef = doc(db, 'users', uid);
    const updates: any = {
      subscriptionTier: selectedPackage.id,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: targetDate.toISOString(),
      borrowingLimit: selectedPackage.limit,
      continuousSubscriptionMonths: (profile?.continuousSubscriptionMonths || 0) + durationMonths,
      lastSubscriptionPaidAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (paymentMethod === 'balance') {
      updates.totalDeposit = Math.max(0, (profile?.totalDeposit || 0) - payableAmount);
    }
    await updateDoc(userRef, updates);

    // 2. Add confirmed transaction
    await addDoc(collection(db, 'transactions'), {
      userId: uid,
      userName: safeUserName,
      type: 'subscription',
      amount: payableAmount,
      method: methodLabel,
      accountNumber: accountNumber || safeUserPhone || '01XXXXXXXXX',
      transactionId: transactionId,
      memoId: memoId,
      status: 'confirmed',
      subscriptionTier: selectedPackage.id,
      subscriptionMonths: durationMonths,
      timestamp: serverTimestamp()
    });

    // 3. Automatically add to Main Reserve funds & Primary Target
    if (payableAmount > 0) {
      try {
        const fundsDocRef = doc(db, 'system_controls', 'funds');
        await setDoc(fundsDocRef, {
          personalFund: increment(payableAmount),
          subscriptionFund: increment(payableAmount),
          totalReserve: increment(payableAmount),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn("Notice: funds sync:", e);
      }

      try {
        const reservesDocRef = doc(db, 'system_controls', 'reserves');
        await setDoc(reservesDocRef, {
          primaryTarget: increment(payableAmount),
          subscriptionReserveContribution: increment(payableAmount),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn("Notice: reserves sync:", e);
      }

      // 4. Record full history in subscription_funds collection (which user paid)
      try {
        await addDoc(collection(db, 'subscription_funds'), {
          userId: uid,
          userName: safeUserName,
          userEmail: safeUserEmail,
          userPhone: safeUserPhone,
          memberId: safeMemberId,
          tier: selectedPackage.id,
          tierName: selectedPackage.name,
          amount: payableAmount,
          baseRate: calculations.baseRateTotal,
          discount: calculations.discountAmount,
          lateBuffer: calculations.lateBuffer,
          durationMonths: durationMonths,
          paymentMethod: methodLabel,
          accountNumber: accountNumber || safeUserPhone || '',
          transactionId: transactionId,
          memoId: memoId,
          allocatedToReserve: true,
          reserveDestination: 'Main Zero-Usury Lending Liquidity Reserve',
          status: 'confirmed',
          timestamp: serverTimestamp(),
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Notice: subscription_funds history:", e);
      }

      // 5. Audit Log
      try {
        await addDoc(collection(db, 'audit_logs'), {
          action: 'subscription_fee_added_to_reserve',
          userId: uid,
          userName: safeUserName,
          amount: payableAmount,
          tier: selectedPackage.id,
          memoId: memoId,
          timestamp: serverTimestamp()
        });
      } catch (e) {
        console.warn("Notice: audit log:", e);
      }
    }

    // 6. Workflow Notification
    if (sendWorkflowNotification) {
      sendWorkflowNotification(
        'subscription_confirmed',
        safeUserEmail || undefined,
        safeUserName,
        { tier: selectedPackage.id, amount: payableAmount, method: methodLabel, transactionId, memoId }
      ).catch(() => {});
    }
  };

  // Submit Handler
  const handleConfirmAndPay = async () => {
    if (!selectedPackage) return;

    if (selectedPackage.id !== 'bronze' && !termsAgreed) {
      addToast('Agreement Required', 'Please agree to the Terms and Conditions to proceed.', 'warning');
      return;
    }

    const memoId = `TUT-${Date.now().toString().slice(-6)}`;
    setSubmittedMemoId(memoId);

    // Free Bronze Activation
    if (selectedPackage.id === 'bronze') {
      setIsSubmitting(true);
      try {
        if (!auth.currentUser) return;
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          subscriptionTier: 'bronze',
          subscriptionStatus: 'active',
          borrowingLimit: 500,
          updatedAt: serverTimestamp()
        });
        addToast('Bronze Activated', 'Bronze Basic charter unlocked. ৳500 BDT limit active.', 'success');
        setIsSuccessScreen(true);
      } catch (err: any) {
        addToast('Error', err?.message || 'Failed to activate tier', 'danger');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Balance Payment
    if (paymentMethod === 'balance') {
      if (!canPayWithBalance) {
        addToast('Insufficient Balance', `Your deposit balance is ৳${(profile?.totalDeposit || 0).toLocaleString()} BDT. Required ৳${calculations.finalPayable.toLocaleString()} BDT. Choose bKash or Nagad.`, 'danger');
        return;
      }

      setIsSubmitting(true);
      try {
        const today = new Date();
        let targetDate = new Date();
        if (profile?.subscriptionStatus === 'active' && profile?.subscriptionExpiresAt) {
          const currentExp = new Date(profile.subscriptionExpiresAt);
          if (currentExp > today) {
            targetDate = new Date(currentExp);
          }
        }
        targetDate.setDate(targetDate.getDate() + (durationMonths * 30));

        await recordSubscriptionPayment({
          methodLabel: 'Account Balance',
          accountNumber: profile?.memberId || profile?.phone || 'Internal Balance',
          transactionId: memoId,
          memoId,
          targetDate
        });

        addToast('Charter Activated', `${selectedPackage.name} activated! ৳${selectedPackage.limit.toLocaleString()} BDT limit unlocked. Funds allocated to Main Reserve.`, 'success');
        setIsSuccessScreen(true);
      } catch (err: any) {
        console.error("Balance subscription error:", err);
        addToast('Activation Error', err?.message || 'Payment failed', 'danger');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // bKash or Nagad Payment
    if (paymentMethod === 'bkash' || paymentMethod === 'nagad') {
      if (!senderPhone || senderPhone.trim().length < 11) {
        addToast('Missing Details', 'Please enter a valid 11-digit sender mobile number.', 'warning');
        return;
      }
      if (!trxId || trxId.trim().length < 4) {
        addToast('Missing Details', 'Please enter your Transaction ID (TrxID).', 'warning');
        return;
      }

      setIsSubmitting(true);
      try {
        const methodLabel = paymentMethod === 'bkash' ? 'Bkash' : 'Nagad';
        const transactionId = trxId.trim().toUpperCase();

        const today = new Date();
        let targetDate = new Date();
        if (profile?.subscriptionStatus === 'active' && profile?.subscriptionExpiresAt) {
          const currentExp = new Date(profile.subscriptionExpiresAt);
          if (currentExp > today) {
            targetDate = new Date(currentExp);
          }
        }
        targetDate.setDate(targetDate.getDate() + (durationMonths * 30));

        await recordSubscriptionPayment({
          methodLabel,
          accountNumber: senderPhone.trim(),
          transactionId,
          memoId,
          targetDate
        });

        addToast('Charter Activated', `${selectedPackage.name} activated! ৳${selectedPackage.limit.toLocaleString()} BDT limit unlocked. Contribution added to Main Reserve.`, 'success');
        setIsSuccessScreen(true);
      } catch (err: any) {
        console.error("Mobile banking subscription error:", err);
        addToast('Submission Error', err?.message || 'Failed to submit slip', 'danger');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Desk Cash Payment
    if (paymentMethod === 'desk') {
      if (!cashPayerName || !cashPayerPhone) {
        addToast('Missing Details', 'Please enter payer name and contact phone.', 'warning');
        return;
      }

      setIsSubmitting(true);
      try {
        const transactionId = `CASH-${Date.now().toString().slice(-6)}`;
        const today = new Date();
        let targetDate = new Date();
        if (profile?.subscriptionStatus === 'active' && profile?.subscriptionExpiresAt) {
          const currentExp = new Date(profile.subscriptionExpiresAt);
          if (currentExp > today) {
            targetDate = new Date(currentExp);
          }
        }
        targetDate.setDate(targetDate.getDate() + (durationMonths * 30));

        await recordSubscriptionPayment({
          methodLabel: 'Cash',
          accountNumber: cashPayerPhone.trim(),
          transactionId,
          memoId,
          targetDate
        });

        addToast('Charter Registered', `${selectedPackage.name} activated! Present memo at Counter #2. Funds added to Main Reserve.`, 'success');
        setIsSuccessScreen(true);
      } catch (err: any) {
        console.error("Desk cash subscription error:", err);
        addToast('Submission Error', err?.message || 'Failed to register memo', 'danger');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Helper to calculate total for any duration option
  const getDurationTotal = (dur: number) => {
    if (!selectedPackage || selectedPackage.id === 'bronze') return 0;
    const durOpt = DURATION_OPTIONS.find(d => d.dur === dur) || DURATION_OPTIONS[0];
    const base = selectedPackage.monthly * dur;
    const disc = Math.round(base * (durOpt.off / 100));
    return Math.max(0, base - disc + 10);
  };

  // =========================================================================
  // VIEW A: SUCCESS SCREEN / RECEIPT SLIP (From Meta AI design)
  // =========================================================================
  if (isSuccessScreen && selectedPackage) {
    const isGold = selectedPackage.id === 'gold';
    return (
      <div className="w-full max-w-lg mx-auto py-4 px-2 sm:px-4 text-left animate-fade-in">
        <div className="flex flex-col items-center pt-2">
          {/* Animated Green Checkmark Ring */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_32px_rgba(16,185,129,0.35)] animate-[popCheck_0.5s_ease]">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
              <path d="M5 12l5 5l10 -10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h2 className="text-[17px] sm:text-[19px] font-bold mt-4 text-center tracking-tight text-white">
            Slip Submitted to Clearing Desk
          </h2>
          <p className="text-[11px] sm:text-[12px] text-white/60 mt-1.5 text-center leading-[1.5] max-w-[340px]">
            Your <strong className="text-white">{selectedPackage.name}</strong> • {durationMonths} Month{durationMonths > 1 ? 's' : ''} subscription for <span className="text-white font-bold font-mono">৳{calculations.finalPayable.toLocaleString()} BDT</span> has been received. Clearing Desk will verify within 60 minutes.
          </p>

          {/* Detailed Receipt Card */}
          <div className="mt-5 w-full bg-[#111727]/90 border border-white/10 rounded-[18px] p-3.5 sm:p-4 backdrop-blur-xl shadow-xl space-y-2 text-xs">
            <div className="flex justify-between items-center text-[11px] text-[#8A8F9E] pb-2 border-b border-white/5 font-mono">
              <span>TIER</span>
              <span className="font-semibold text-white">
                {selectedPackage.name} • {durationMonths}mo • ৳{selectedPackage.limit.toLocaleString()} limit
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-[#8A8F9E] font-mono">
              <span>BASE RATE</span>
              <span className="font-semibold text-white">
                ৳{selectedPackage.monthly} × {durationMonths} = ৳{calculations.baseRateTotal}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-[#8A8F9E] font-mono">
              <span>DISCOUNT</span>
              <span className="font-semibold text-emerald-300">
                {calculations.discountAmount > 0 
                  ? `-৳${calculations.discountAmount} (${calculations.discountPercent}% OFF)` 
                  : '—'}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-[#8A8F9E] font-mono">
              <span>LATE BUFFER</span>
              <span className="font-semibold text-amber-200">
                {calculations.lateBuffer > 0 ? `+৳${calculations.lateBuffer}` : '৳0'}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-[#8A8F9E] font-mono">
              <span>NET RESERVE</span>
              <span className="font-semibold text-white">
                ৳{calculations.netReserveContribution.toLocaleString()} BDT
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-[#8A8F9E] font-mono">
              <span>METHOD</span>
              <span className="font-semibold text-white capitalize">
                {paymentMethod === 'bkash' ? 'bKash 01713710607' : paymentMethod === 'nagad' ? 'Nagad 01921801100' : paymentMethod === 'balance' ? 'Account Balance' : 'Desk Cash Counter #2'}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-[#8A8F9E] font-mono">
              <span>TRX / PAYER</span>
              <span className="font-semibold text-white truncate max-w-[170px]">
                {paymentMethod === 'desk' ? (cashPayerName || 'Desk Cash') : (trxId || 'Pending verification')}
              </span>
            </div>

            <div className="h-px bg-white/10 my-2" />

            <div className="flex justify-between items-center">
              <span className="text-[12px] font-bold text-white">TOTAL PAYABLE</span>
              <span className="text-[18px] font-black text-white font-mono" style={{ color: isGold ? '#FFD700' : '#34d399' }}>
                ৳{calculations.finalPayable.toLocaleString()} BDT
              </span>
            </div>

            <div className="mt-1 text-[10px] font-mono text-emerald-300/80">
              ✓ Verification queue: &lt;60 min • VIP sovereign priority • Terms: {termsAgreed ? 'AGREED' : 'PENDING'}
            </div>
          </div>

          {/* Mutual Reserve Notice Box */}
          <div className="mt-3.5 w-full rounded-[14px] bg-emerald-500/10 border border-emerald-500/20 p-3 text-[11px] leading-[1.5] text-emerald-200/90">
            <div>
              100% of your contribution is credited to T.U.T. mutual zero-usury lending liquidity reserve. You will receive confirmation once verified.
            </div>
            <div className="mt-2 text-[10px] text-white/30 font-mono">
              Ref: TUT-{submittedMemoId || Date.now().toString().slice(-6)} • Member {profile.memberId || 'TUTH-BR20 2684 91X'} • {selectedPackage.id.toUpperCase()} • {durationMonths}MO
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full space-y-2 mt-4">
            <button
              type="button"
              onClick={onBack}
              className="w-full h-[48px] rounded-[24px] bg-white text-black font-bold text-[12.5px] hover:bg-white/90 transition shadow-lg cursor-pointer"
            >
              Return to Dashboard →
            </button>
            <button
              type="button"
              onClick={handleBackToCatalog}
              className="w-full h-[44px] rounded-[24px] bg-white/[0.05] border border-white/10 font-semibold text-[11.5px] text-white/70 hover:bg-white/10 transition cursor-pointer"
            >
              View Tier Packages
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: FULL-PAGE 3-STEP FLOW (Duration -> Review -> Payment)
  // Restores all details from the design, gracefully resized!
  // =========================================================================
  if (selectedPackage) {
    const isGold = selectedPackage.id === 'gold';
    const isBronze = selectedPackage.id === 'bronze';

    return (
      <div className="w-full max-w-xl mx-auto flex flex-col min-h-[82vh] justify-between text-left animate-fade-in bg-[#080C18] border border-white/10 rounded-[28px] overflow-hidden shadow-2xl relative">
        
        {/* Top Sticky Header */}
        <div className="sticky top-0 z-30 bg-[#080C18]/90 backdrop-blur-xl border-b border-white/[0.07] px-4 py-3 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              if (purchaseStep === 3) setPurchaseStep(2);
              else if (purchaseStep === 2) setPurchaseStep(1);
              else handleBackToCatalog();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="text-[11px]">
              {purchaseStep === 3 ? 'Summary' : purchaseStep === 2 ? 'Duration' : 'Packages'}
            </span>
          </button>

          {/* Stepper Progress */}
          <div className="flex items-center gap-1.5">
            {[
              { num: 1, label: 'Duration' },
              { num: 2, label: 'Review' },
              { num: 3, label: 'Payment' }
            ].map(step => (
              <button
                key={step.num}
                type="button"
                onClick={() => {
                  if (step.num < purchaseStep) setPurchaseStep(step.num as any);
                }}
                disabled={step.num > purchaseStep}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-all ${
                  purchaseStep === step.num
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                    : purchaseStep > step.num
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-pointer'
                    : 'bg-white/[0.03] text-white/30 border border-white/5 pointer-events-none'
                }`}
              >
                <span>{step.num}.</span>
                <span>{step.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Step Content Container */}
        <div ref={scrollContainerRef} className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">

          {/* ===================================================================
              STEP 1: CHOOSE DURATION (Full details restored from Meta AI design)
              =================================================================== */}
          {purchaseStep === 1 && (
            <div className="space-y-3.5 animate-fade-in">
              <div>
                <h2 className="text-[17px] sm:text-[18px] font-bold tracking-tight text-white">
                  Choose Duration
                </h2>
                <p className="text-[11px] text-white/45 mt-0.5">
                  Smart savings for longer commitment • Cancel anytime
                </p>
              </div>

              {/* 4 Duration Cards Stack */}
              <div className="space-y-2.5">
                {DURATION_OPTIONS.map((opt) => {
                  const isSelected = durationMonths === opt.dur;
                  const isBronze = selectedPackage.id === 'bronze';
                  const baseCost = selectedPackage.monthly * opt.dur;
                  const discountAmount = Math.round(baseCost * (opt.off / 100));
                  const fullPrice = isBronze ? 0 : baseCost + 10;
                  const total = getDurationTotal(opt.dur);

                  return (
                    <button
                      key={opt.dur}
                      type="button"
                      onClick={() => setDurationMonths(opt.dur)}
                      className={`w-full text-left rounded-[16px] p-3.5 transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-slate-800/95 border-2 shadow-lg scale-[1.01]' 
                          : 'bg-slate-900/90 border border-slate-700/80 hover:border-slate-500 hover:bg-slate-800/60'
                      }`}
                      style={{
                        borderColor: isSelected ? selectedPackage.accent : undefined,
                        boxShadow: isSelected ? `0 6px 20px ${selectedPackage.glow}` : undefined
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Radio Checkmark Circle */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                            isSelected 
                              ? 'bg-emerald-500 border-emerald-400 text-black' 
                              : 'border-slate-600 bg-slate-800/80 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>

                        {/* Deal Name, Duration, Available Discount, and Saved Amount */}
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-[14px] font-bold text-white tracking-tight">
                              {opt.name}
                            </span>
                            <span className="text-[12px] text-slate-300 font-mono font-medium">
                              ({opt.dur} {opt.dur === 1 ? 'Month' : 'Months'})
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] font-bold text-emerald-400">
                              {opt.off}% off
                            </span>
                            {discountAmount > 0 && (
                              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                                Save ৳{discountAmount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Previous / Main Price (Cut, small) & New Balance (Bold) */}
                      <div className="text-right shrink-0">
                        {discountAmount > 0 && (
                          <div className="line-through text-slate-400 text-[11px] font-mono leading-none mb-1">
                            ৳{fullPrice.toLocaleString()}
                          </div>
                        )}
                        <div className="text-[17px] sm:text-[18px] font-black font-mono text-white leading-tight">
                          ৳{total.toLocaleString()}
                          <span className="text-[10px] text-slate-300 font-normal ml-1">BDT</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================================================================
              STEP 2: REVIEW / INVOICE SUMMARY
              - Made smaller card size to fit the screen
              - Exact Bengali declaration
              - Apple-style billing breakdown
              - Statutory reserve covenant toggle
              =================================================================== */}
          {purchaseStep === 2 && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <h2 className="text-[17px] sm:text-[18px] font-bold tracking-tight text-white">
                  Invoice Summary
                </h2>
                <p className="text-[11px] text-white/45 mt-0.5">
                  Apple-style breakdown • 100% to mutual reserve
                </p>
              </div>

              {/* Smaller Card Size to fit other elements on screen */}
              <div className="max-w-[275px] sm:max-w-[295px] mx-auto w-full transition-transform hover:scale-[1.01]">
                <BankingTierCard
                  tier={selectedPackage.id}
                  status="active"
                  name={profile.name}
                  memberId={profile.memberId || 'TUTH-BR20 2684 91X'}
                  totalDeposit={profile.totalDeposit || 0}
                  remainingDebt={profile.remainingDebt || 0}
                  showDetailsToggle={false}
                  borrowLimit={selectedPackage.limit}
                  isPackageCard={true}
                  className="shadow-xl"
                />
              </div>

              {/* EXACT USER-REQUESTED BENGALI TEXT */}
              <div className="rounded-[14px] bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border border-amber-500/30 p-2.5 text-center">
                <p className="text-[11px] sm:text-[12px] font-bold text-amber-200 leading-relaxed font-sans">
                  "এই অর্থ  ব্যক্তিগত/প্রাতিষ্ঠানিক মুনাফা নয়,বরং শুধুমাত্র ঋণ বিতরণ কার্যেই সীমাবদ্ধ"
                </p>
              </div>

              {/* Apple-Style Billing Breakdown Card */}
              <div className="rounded-[18px] p-[1px]" style={{ background: `linear-gradient(135deg, ${selectedPackage.accent}40, transparent)` }}>
                <div className="rounded-[17px] bg-[#111727]/90 backdrop-blur-xl p-3 sm:p-3.5 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-white/5">
                    <span className="text-[9.5px] tracking-[0.16em] text-white/50 font-semibold font-mono uppercase">
                      BILLING BREAKDOWN
                    </span>
                    <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-white/10 font-mono text-white/80">
                      {durationMonths} Month{durationMonths > 1 ? 's' : ''} • {selectedPackage.short}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center py-0.5">
                      <div>
                        <div className="text-[11.5px] font-medium text-white">Base Rate</div>
                        <div className="text-[9.5px] text-[#8A8F9E]">৳{selectedPackage.monthly}/mo × {durationMonths}mo</div>
                      </div>
                      <span className="font-mono text-[12px] font-semibold text-white">
                        ৳{calculations.baseRateTotal}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-0.5">
                      <div>
                        <div className="text-[11.5px] font-medium flex items-center gap-1.5 text-white">
                          <span>Duration Discount</span>
                          {calculations.discountPercent > 0 && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                              {calculations.discountPercent}% OFF
                            </span>
                          )}
                        </div>
                        <div className="text-[9.5px] text-[#8A8F9E]">
                          {calculations.discountPercent > 0 
                            ? `You save ৳${calculations.discountAmount}` 
                            : 'No discount for 1 month'}
                        </div>
                      </div>
                      <span className={`font-mono text-[12px] font-semibold ${calculations.discountAmount > 0 ? 'text-emerald-300' : 'text-white/30'}`}>
                        {calculations.discountAmount > 0 ? `-৳${calculations.discountAmount}` : '—'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-0.5">
                      <div>
                        <div className="text-[11.5px] font-medium text-white">Late Renewal Buffer</div>
                        <div className="text-[9.5px] text-[#8A8F9E]">Refundable if renewed on time</div>
                      </div>
                      <span className="font-mono text-[12px] font-semibold text-amber-200">
                        {calculations.lateBuffer > 0 ? `+৳${calculations.lateBuffer}` : '৳0'}
                      </span>
                    </div>

                    <div className="h-px bg-white/[0.07] my-1.5" />

                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-[#8A8F9E] font-mono">
                        Net Contribution to Mutual Lending Reserve
                      </span>
                      <span className="font-mono text-white/70">
                        ৳{calculations.netReserveContribution.toLocaleString()}
                      </span>
                    </div>

                    {/* Total Box */}
                    <div className="rounded-[12px] bg-[#0A0F1E] border border-white/[0.08] p-2.5 flex items-center justify-between mt-1">
                      <div>
                        <div className="text-[10px] font-bold tracking-wide text-white/90 uppercase">
                          TOTAL PAYABLE
                        </div>
                        <div className="text-[9.5px] font-mono text-[#8A8F9E] mt-0.5">
                          {selectedPackage.name} • {durationMonths}mo • BDT
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[18px] font-black tracking-tight font-mono" style={{ color: isGold ? '#FFD700' : '#fff' }}>
                          ৳{calculations.finalPayable.toLocaleString()}
                        </div>
                        <div className="text-[8.5px] tracking-[0.16em] text-white/35 font-mono -mt-0.5 uppercase">
                          BDT
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions Agreement System */}
              <div className="rounded-[14px] bg-slate-900/90 border border-slate-700/80 p-3 flex gap-2.5 items-start">
                <button
                  type="button"
                  onClick={() => setTermsAgreed(!termsAgreed)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                    termsAgreed 
                      ? 'bg-emerald-500 border-emerald-400 text-black' 
                      : 'border-white/30 bg-black/30 hover:border-white/50'
                  }`}
                >
                  {termsAgreed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label 
                      onClick={() => setTermsAgreed(!termsAgreed)}
                      className="text-[11.5px] font-bold text-white cursor-pointer select-none"
                    >
                      I agree to all Terms and Conditions
                    </label>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase font-mono">
                      REQUIRED
                    </span>
                  </div>
                  <p className="text-[9.5px] leading-[1.4] text-white/50 mt-0.5">
                    100% of proceeds fund the mutual zero-usury lending reserve. Members commit to scheduled repayment.
                  </p>
                  
                  {/* Option to see all terms and conditions */}
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>View all Terms and Conditions</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              STEP 3: SECURE PAYMENT
              - Full payment options (Balance, bKash, Nagad, Desk Cash)
              - Minimized spacing, full details preserved!
              =================================================================== */}
          {purchaseStep === 3 && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <h2 className="text-[17px] sm:text-[18px] font-bold tracking-tight text-white">
                  Secure Payment
                </h2>
                <p className="text-[11px] text-white/45 mt-0.5">
                  Transfer exactly <span className="text-white font-bold font-mono">৳{calculations.finalPayable.toLocaleString()} BDT</span> • Verified in &lt;60 min
                </p>
              </div>

              {/* 4 Gateway Buttons (Balance, bKash, Nagad, Desk Cash) */}
              <div className="space-y-2">
                {/* Account Balance Option */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('balance')}
                  className={`w-full text-left rounded-2xl p-3 transition-all cursor-pointer border-2 ${
                    paymentMethod === 'balance' 
                      ? 'bg-slate-800 border-emerald-400 shadow-[0_4px_16px_rgba(16,185,129,0.2)] scale-[1.01]' 
                      : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm text-emerald-400 font-bold shrink-0">
                      ◫
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-white">Account Balance</span>
                        {!canPayWithBalance && calculations.finalPayable > 0 && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold font-mono">
                            INSUFFICIENT
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono mt-0.5 font-medium">
                        Available: ৳{(profile.totalDeposit || 0).toLocaleString()} • Required: ৳{calculations.finalPayable.toLocaleString()}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      paymentMethod === 'balance' ? 'border-emerald-400 bg-emerald-500 text-black' : 'border-slate-600 bg-slate-800 text-transparent'
                    }`}>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                </button>

                {/* bKash Send Money Option */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bkash')}
                  className={`w-full text-left rounded-2xl p-3 transition-all cursor-pointer border-2 ${
                    paymentMethod === 'bkash' 
                      ? 'bg-slate-800 border-[#E2136E] shadow-[0_4px_16px_rgba(226,19,110,0.25)] scale-[1.01]' 
                      : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#E2136E] flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm">
                      bK
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-white">bKash</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#E2136E] text-white font-bold font-mono">
                          OFFICIAL
                        </span>
                      </div>
                      <div className="text-[11px] text-[#FF85B8] font-bold mt-0.5">
                        Send Money
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono font-medium">
                        01713710607 • Personal
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div 
                        onClick={(e) => { e.stopPropagation(); handleCopy('01713710607'); }}
                        className="w-7 h-7 rounded-lg bg-slate-750 hover:bg-slate-700 flex items-center justify-center text-xs text-white cursor-pointer transition shadow-sm border border-slate-600"
                        title="Copy Number"
                      >
                        {copiedText === '01713710607' ? '✓' : <Copy className="w-3.5 h-3.5" />}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        paymentMethod === 'bkash' ? 'border-[#E2136E] bg-[#E2136E] text-white' : 'border-slate-600 bg-slate-800 text-transparent'
                      }`}>
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>
                  </div>
                </button>

                {/* Nagad Send Money Option */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('nagad')}
                  className={`w-full text-left rounded-2xl p-3 transition-all cursor-pointer border-2 ${
                    paymentMethod === 'nagad' 
                      ? 'bg-slate-800 border-[#F6921E] shadow-[0_4px_16px_rgba(246,146,30,0.25)] scale-[1.01]' 
                      : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F6921E] flex items-center justify-center text-xs font-black text-black shrink-0 shadow-sm">
                      N
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-white">Nagad</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#F6921E] text-black font-bold font-mono">
                          OFFICIAL
                        </span>
                      </div>
                      <div className="text-[11px] text-[#FFA84B] font-bold mt-0.5">
                        Send Money
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono font-medium">
                        01921801100 • Personal
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div 
                        onClick={(e) => { e.stopPropagation(); handleCopy('01921801100'); }}
                        className="w-7 h-7 rounded-lg bg-slate-750 hover:bg-slate-700 flex items-center justify-center text-xs text-white cursor-pointer transition shadow-sm border border-slate-600"
                        title="Copy Number"
                      >
                        {copiedText === '01921801100' ? '✓' : <Copy className="w-3.5 h-3.5" />}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        paymentMethod === 'nagad' ? 'border-[#F6921E] bg-[#F6921E] text-black' : 'border-slate-600 bg-slate-800 text-transparent'
                      }`}>
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>
                  </div>
                </button>

                {/* Desk Cash Option */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('desk')}
                  className={`w-full text-left rounded-2xl p-3 transition-all cursor-pointer border-2 ${
                    paymentMethod === 'desk' 
                      ? 'bg-slate-800 border-blue-400 shadow-[0_4px_16px_rgba(59,130,246,0.25)] scale-[1.01]' 
                      : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-base shrink-0">
                      🏦
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-white">Desk Cash</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold font-mono">
                          BRANCH
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5 font-medium">
                        Counter #2 • 10AM-6PM • Head Office
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      paymentMethod === 'desk' ? 'border-blue-400 bg-blue-400 text-black' : 'border-slate-600 bg-slate-800 text-transparent'
                    }`}>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                </button>
              </div>

              {/* Dynamic Details Box for Selected Gateway */}
              <div className="rounded-2xl bg-slate-900 border border-slate-700/90 p-3.5 sm:p-4 shadow-xl space-y-3">
                {/* Balance View */}
                {paymentMethod === 'balance' && (
                  <div className="text-center py-2 space-y-2">
                    {!canPayWithBalance && calculations.finalPayable > 0 ? (
                      <>
                        <div className="w-9 h-9 rounded-full bg-rose-500/20 border border-rose-500/30 mx-auto flex items-center justify-center text-rose-300 font-bold text-sm">
                          !
                        </div>
                        <div className="text-sm font-bold text-white">Insufficient Balance</div>
                        <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                          Your deposit balance is <span className="text-white font-bold font-mono">৳{(profile.totalDeposit || 0).toLocaleString()} BDT</span>, but <span className="text-white font-bold font-mono">৳{calculations.finalPayable.toLocaleString()} BDT</span> is required. Please choose bKash or Nagad above.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 mx-auto flex items-center justify-center text-emerald-300 text-sm">
                          ✓
                        </div>
                        <div className="text-sm font-bold text-white">Ready for Instant Deduction</div>
                        <p className="text-xs text-slate-300">
                          <span className="text-emerald-400 font-bold font-mono">৳{calculations.finalPayable.toLocaleString()} BDT</span> will be deducted from your available ৳{(profile.totalDeposit || 0).toLocaleString()} deposit.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* bKash or Nagad View */}
                {(paymentMethod === 'bkash' || paymentMethod === 'nagad') && (
                  <div className="space-y-3">
                    {/* Transfer Callout */}
                    <div className={`rounded-xl border-2 p-3 flex items-center justify-between ${
                      paymentMethod === 'bkash' 
                        ? 'bg-pink-950/40 border-pink-500/40' 
                        : 'bg-amber-950/40 border-amber-500/40'
                    }`}>
                      <div>
                        <div className="text-[10px] tracking-wider font-bold text-slate-300 uppercase font-mono">
                          TRANSFER EXACTLY
                        </div>
                        <div className="text-lg sm:text-xl font-black font-mono mt-0.5" style={{ color: paymentMethod === 'bkash' ? '#FF6BA8' : '#FFB86B' }}>
                          ৳{calculations.finalPayable.toLocaleString()} BDT
                        </div>
                        <div className="text-[11.5px] text-slate-200 font-medium">
                          to {paymentMethod === 'bkash' ? '01713710607' : '01921801100'} via Send Money
                        </div>
                      </div>
                      <div className="text-xl text-white font-bold">↗</div>
                    </div>

                    {/* Official Account Box */}
                    <div className="rounded-xl bg-slate-950 border border-slate-700 p-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                        paymentMethod === 'bkash' ? 'bg-[#E2136E] text-white' : 'bg-[#F6921E] text-black'
                      }`}>
                        {paymentMethod === 'bkash' ? 'bK' : 'N'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-bold font-mono text-white tracking-wide">
                          {paymentMethod === 'bkash' ? '01713710607' : '01921801100'}
                        </div>
                        <div className="text-[11px] text-slate-300 font-medium">
                          Official {paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} Personal • Send Money
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(paymentMethod === 'bkash' ? '01713710607' : '01921801100')}
                        className="h-8 px-3.5 rounded-lg bg-white text-black text-xs font-bold hover:bg-slate-200 transition cursor-pointer shadow-sm"
                      >
                        {copiedText ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-2.5 pt-1">
                      <div>
                        <label className="text-[11px] tracking-wider font-bold text-slate-200 mb-1.5 block uppercase font-mono">
                          SENDER MOBILE NUMBER
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-slate-300 border-r border-slate-700 pr-2">
                            🇧🇩 +88
                          </span>
                          <input
                            type="text"
                            value={senderPhone}
                            onChange={(e) => setSenderPhone(e.target.value)}
                            placeholder="01700000000"
                            inputMode="numeric"
                            className="w-full h-[42px] rounded-xl bg-slate-950 border-2 border-slate-700 pl-[74px] pr-3 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] tracking-wider font-bold text-slate-200 mb-1.5 block uppercase font-mono">
                          TRANSACTION ID (TRXID)
                        </label>
                        <input
                          type="text"
                          value={trxId}
                          onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                          placeholder={paymentMethod === 'bkash' ? 'E.G. BL99Y72AQ' : 'E.G. NG9A2K...'}
                          className="w-full h-[42px] rounded-xl bg-slate-950 border-2 border-slate-700 px-3 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 uppercase transition-all"
                        />
                        <div className="text-[11px] font-mono text-slate-400 mt-1 font-medium">
                          Format: 8-10 chars • Example {paymentMethod === 'bkash' ? 'BL99…' : 'NG…'} • Case insensitive
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Desk Cash View */}
                {paymentMethod === 'desk' && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-blue-950/40 border border-blue-500/40 p-3.5 space-y-1.5">
                      <div className="text-sm font-bold text-white tracking-wide">
                        Visit T.U.T. Clearing Desk
                      </div>
                      <div className="text-xs text-slate-200 leading-relaxed">
                        Head Office Cashier <span className="text-white font-bold">Counter #2</span> (10AM - 6PM)<br />
                        Present Member ID: <span className="font-mono text-white font-bold">{profile.memberId || 'TUTH-BR20 2684 91X'}</span><br />
                        Deposit <span className="text-emerald-400 font-bold font-mono">৳{calculations.finalPayable.toLocaleString()} BDT</span> for {selectedPackage.name} × {durationMonths}mo
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] tracking-wider font-bold text-slate-200 mb-1.5 block uppercase font-mono">
                          PAYER NAME
                        </label>
                        <input
                          type="text"
                          value={cashPayerName}
                          onChange={(e) => setCashPayerName(e.target.value)}
                          placeholder="Full Name"
                          className="w-full h-[40px] rounded-xl bg-slate-950 border-2 border-slate-700 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] tracking-wider font-bold text-slate-200 mb-1.5 block uppercase font-mono">
                          PAYER PHONE
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-slate-300 border-r border-slate-700 pr-2">
                            🇧🇩 +88
                          </span>
                          <input
                            type="text"
                            value={cashPayerPhone}
                            onChange={(e) => setCashPayerPhone(e.target.value)}
                            placeholder="01700000000"
                            inputMode="numeric"
                            className="w-full h-[40px] rounded-xl bg-slate-950 border-2 border-slate-700 pl-[74px] pr-3 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ===================================================================
            STICKY BOTTOM ACTION BAR (Matching exact Meta AI design)
            =================================================================== */}
        <div className="shrink-0 bg-[#080C18]/95 backdrop-blur-xl border-t border-white/[0.08] px-4 py-3 space-y-2.5 z-20">
          {/* STEP 1 BUTTON */}
          {purchaseStep === 1 && (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-300 font-mono tracking-wide uppercase">
                  TOTAL PAYABLE
                </span>
                <span className="text-[17px] font-black font-mono text-white" style={{ color: isGold ? '#FFD700' : '#fff' }}>
                  ৳{calculations.finalPayable.toLocaleString()} BDT
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPurchaseStep(2)}
                className="w-full h-[50px] rounded-[25px] font-bold text-[12.5px] tracking-wide flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-lg"
                style={{
                  background: selectedPackage.buttonGradient,
                  color: selectedPackage.id === 'bronze' ? '#2E1A0D' : selectedPackage.id === 'silver' ? '#1E2128' : '#1A1500',
                  boxShadow: `0 6px 20px ${selectedPackage.glow}`
                }}
              >
                <span>Continue to Summary →</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/15 font-mono">
                  ৳{calculations.finalPayable.toLocaleString()}
                </span>
              </button>
            </>
          )}

          {/* STEP 2 BUTTONS */}
          {purchaseStep === 2 && (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-300 font-mono tracking-wide uppercase">
                  TOTAL PAYABLE
                </span>
                <span className="text-[17px] font-black font-mono text-white" style={{ color: isGold ? '#FFD700' : '#fff' }}>
                  ৳{calculations.finalPayable.toLocaleString()} BDT
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPurchaseStep(1)}
                  className="flex-1 h-[50px] rounded-[25px] bg-white/[0.06] border border-white/10 font-semibold text-[11.5px] text-white/80 hover:bg-white/10 transition cursor-pointer"
                >
                  ← Duration
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseStep(3)}
                  disabled={selectedPackage.id !== 'bronze' && !termsAgreed}
                  className="flex-[1.6] h-[50px] rounded-[25px] font-bold text-[12px] tracking-wide flex items-center justify-center gap-1.5 transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-lg"
                  style={{
                    background: selectedPackage.buttonGradient,
                    color: selectedPackage.id === 'bronze' ? '#2E1A0D' : selectedPackage.id === 'silver' ? '#1E2128' : '#1A1500',
                    boxShadow: `0 6px 20px ${selectedPackage.glow}`
                  }}
                >
                  <span>Continue to Pay ৳{calculations.finalPayable.toLocaleString()} →</span>
                </button>
              </div>
            </>
          )}

          {/* STEP 3 BUTTONS */}
          {purchaseStep === 3 && (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-300 font-mono tracking-wide uppercase">
                  TOTAL PAYABLE
                </span>
                <span className="text-[17px] font-black font-mono text-white" style={{ color: isGold ? '#FFD700' : '#fff' }}>
                  ৳{calculations.finalPayable.toLocaleString()} BDT
                </span>
              </div>

              <button
                type="button"
                disabled={isSubmitting || (paymentMethod === 'balance' && !canPayWithBalance && calculations.finalPayable > 0)}
                onClick={handleConfirmAndPay}
                className="w-full h-[50px] rounded-[25px] font-bold text-[12.5px] tracking-wide flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-lg"
                style={{
                  background: paymentMethod === 'bkash' 
                    ? 'linear-gradient(135deg, #E2136E, #FF4D8D)' 
                    : paymentMethod === 'nagad' 
                    ? 'linear-gradient(135deg, #F6921E, #FFB86B)' 
                    : paymentMethod === 'desk' 
                    ? 'linear-gradient(135deg, #3B82F6, #60A5FA)' 
                    : 'linear-gradient(135deg, #10B981, #059669)',
                  color: paymentMethod === 'nagad' ? '#111' : '#fff',
                  boxShadow: paymentMethod === 'bkash' 
                    ? '0 6px 20px rgba(226,19,110,0.35)' 
                    : paymentMethod === 'nagad' 
                    ? '0 6px 20px rgba(246,146,30,0.35)' 
                    : paymentMethod === 'desk' 
                    ? '0 6px 20px rgba(59,130,246,0.35)' 
                    : '0 6px 20px rgba(16,185,129,0.35)'
                }}
              >
                <span>🔒</span>
                <span>
                  {isSubmitting 
                    ? 'Processing...' 
                    : paymentMethod === 'desk' 
                    ? `SUBMIT CASH DEPOSIT • ৳${calculations.finalPayable.toLocaleString()} BDT`
                    : paymentMethod === 'balance'
                    ? `Confirm & Deduct ৳${calculations.finalPayable.toLocaleString()} BDT`
                    : `Confirm & Pay ৳${calculations.finalPayable.toLocaleString()} BDT`
                  }
                </span>
              </button>

              {paymentMethod === 'balance' && !canPayWithBalance && calculations.finalPayable > 0 && (
                <div className="text-center text-[10.5px] font-medium text-red-300">
                  Your balance is ৳{(profile.totalDeposit || 0).toLocaleString()}, required ৳{calculations.finalPayable.toLocaleString()}. Choose bKash/Nagad
                </div>
              )}

              <div className="flex justify-center gap-2.5 text-[9px] font-mono text-white/30">
                <span>🔒 SSL Secured</span>
                <span>•</span>
                <span>Sharia 0%</span>
                <span>•</span>
                <span>BDT • TUTH-BR20</span>
              </div>
            </>
          )}
        </div>

        {/* Terms & Conditions Modal */}
        <AnimatePresence>
          {showTermsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col text-left text-white"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">Terms & Conditions</h3>
                      <p className="text-[10px] text-slate-400 font-mono">T.U.T. Mutual Zero-Usury Lending Charter</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="overflow-y-auto py-4 space-y-3.5 text-xs text-slate-300 pr-1 leading-relaxed">
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3">
                    <p className="text-[11px] font-bold text-amber-200">
                      "এই অর্থ  ব্যক্তিগত/প্রাতিষ্ঠানিক মুনাফা নয়,বরং শুধুমাত্র ঋণ বিতরণ কার্যেই সীমাবদ্ধ"
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-[12px] flex items-center gap-1.5">
                      <span className="text-emerald-400">1.</span> Mutual Zero-Usury Reserve
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      100% of all subscription fees are pooled directly into the collective reserve. The fund is governed strictly under zero-interest principles; no commercial interest or hidden fees are ever charged.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-[12px] flex items-center gap-1.5">
                      <span className="text-emerald-400">2.</span> Non-Commercial & No Private Dividends
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      The reserve operates without private equity dividends or shareholder distributions. All liquidity is permanently locked for disbursement to verified members in need.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-[12px] flex items-center gap-1.5">
                      <span className="text-emerald-400">3.</span> Repayment Discipline & Buffer Policy
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      Borrowers are expected to maintain strict financial discipline and honor scheduled repayments. The late renewal buffer protects the fund and is credited back towards future tier renewals upon timely compliance.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-[12px] flex items-center gap-1.5">
                      <span className="text-emerald-400">4.</span> Institutional Verification
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      All transactions via bKash, Nagad, or Cash Desk are verified by the T.U.T. Clearing Desk. Providing invalid transaction IDs or false credentials may lead to suspension.
                    </p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-medium text-xs transition cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTermsAgreed(true);
                      setShowTermsModal(false);
                    }}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition cursor-pointer shadow-md"
                  >
                    I Agree to Terms
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    );
  }

  // =========================================================================
  // VIEW C: MAIN TIER CATALOG
  // - Starts directly from SELECT LENDING TIER (Upper card removed)
  // - Cards only contain the 3 items (T.U.T logo/name, Tier name, Borrow limit)
  // - Clicking opens full page
  // =========================================================================
  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 text-left animate-fade-in pb-16">
      
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
            Current Tier:
          </span>
          <span className="text-[10px] font-mono font-black text-amber-300 bg-amber-400/10 border border-amber-400/25 px-2.5 py-0.5 rounded-full uppercase">
            {profile.subscriptionTier || 'Bronze'}
          </span>
        </div>
      </div>

      {/* CATALOG HEADER - Starts directly with "Update Tier" */}
      <div className="text-center max-w-lg mx-auto pt-2">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
          Update Tier
        </h1>
      </div>

      {/* 3 TIER PACKAGES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {TIER_CATALOG.map((tierItem) => {
          const isCurrent = (profile.subscriptionTier || 'bronze').toLowerCase() === tierItem.id;
          const isGold = tierItem.id === 'gold';

          return (
            <div
              key={tierItem.id}
              className={`rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 relative border ${
                isCurrent
                  ? 'bg-slate-900/90 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
                  : isGold
                  ? 'bg-slate-900/60 border-amber-500/30 hover:border-amber-400/60 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]'
                  : 'bg-slate-900/40 border-white/10 hover:border-white/20'
              }`}
            >
              {/* Badge */}
              <div className="flex justify-between items-center mb-3">
                <span
                  className="text-[9px] font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm"
                  style={{
                    backgroundColor: `${tierItem.color}15`,
                    borderColor: `${tierItem.color}35`,
                    color: tierItem.accent
                  }}
                >
                  {tierItem.badge}
                </span>

                {isCurrent && (
                  <span className="text-[9px] font-mono font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>ACTIVE</span>
                  </span>
                )}
              </div>

              {/* CARD PREVIEW - Contains only the 3 required elements */}
              <div 
                onClick={() => handleSelectPackage(tierItem)}
                className="cursor-pointer mb-4"
              >
                <BankingTierCard
                  tier={tierItem.id}
                  status="active"
                  name={profile.name}
                  memberId={profile.memberId || 'TUTH-BR20 2684 91X'}
                  totalDeposit={profile.totalDeposit || 0}
                  remainingDebt={profile.remainingDebt || 0}
                  showDetailsToggle={false}
                  borrowLimit={tierItem.limit}
                  isPackageCard={true}
                  className="shadow-md"
                />
              </div>

              {/* Price & Monthly Commitment */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 mb-4 text-center">
                <div className="text-xl sm:text-2xl font-black font-mono tracking-tight" style={{ color: tierItem.accent }}>
                  {tierItem.monthly === 0 ? '100% FREE' : `৳${tierItem.monthly}`}
                  {tierItem.monthly > 0 && <span className="text-xs text-slate-400 font-normal"> / month</span>}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Max Cap: <strong className="text-emerald-400">৳{tierItem.limit.toLocaleString()} BDT</strong>
                </div>
              </div>

              {/* Tier Features */}
              <div className="space-y-2 mb-6 flex-1 text-left">
                {tierItem.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-snug text-[11.5px]">{feat}</span>
                  </div>
                ))}
              </div>

              {/* Action Button - Opens full page */}
              <button
                type="button"
                onClick={() => handleSelectPackage(tierItem)}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                style={{
                  background: tierItem.buttonGradient,
                  color: tierItem.id === 'bronze' ? '#2E1A0D' : tierItem.id === 'silver' ? '#1E2128' : '#1A1500'
                }}
              >
                <span>{tierItem.buttonLabel}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
};
