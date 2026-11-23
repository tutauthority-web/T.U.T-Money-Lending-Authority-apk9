import React, { useState, useEffect } from 'react';
import { Firestore, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import {
  ShieldCheck,
  CreditCard,
  Wallet,
  Lock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  KeyRound,
  LogIn,
  X
} from 'lucide-react';
import tutLogo from '../assets/images/tut_logo_1783437312744.jpg';
import { UserProfile } from '../App';
import { executeAtomicMerchantPayment } from '../utils/bankingLedgerEngine';
import {
  TutPayCardRecord,
  formatCardNumberDisplay,
  saveTutCardSecuritySetup
} from '../utils/tutPaymentEngine';

export interface TutCheckoutRequest {
  amount?: number;
  merchantName: string;
  merchantId?: string;
  orderId: string;
  returnUrl?: string;
  reference?: string;
}

interface TutPaymentCheckoutProps {
  db: Firestore;
  user: FirebaseUser | null;
  profile: UserProfile | null;
  checkoutRequest: TutCheckoutRequest;
  isModal?: boolean;
  isAuthChecking?: boolean;
  payerEmailHint?: string;
  onClose?: () => void;
  onGoogleLogin: () => Promise<void>;
  isLoggingIn?: boolean;
  sendWorkflowNotification?: (type: string, email?: string, name?: string, meta?: any) => Promise<void>;
  addToast?: (title: string, body: string, type?: 'info' | 'success' | 'warning') => void;
}

function sanitizeSafeReturnUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export const TutPaymentCheckout: React.FC<TutPaymentCheckoutProps> = ({
  db,
  user,
  profile,
  checkoutRequest,
  isModal = false,
  isAuthChecking = false,
  payerEmailHint,
  onClose,
  onGoogleLogin,
  isLoggingIn = false,
  sendWorkflowNotification,
  addToast
}) => {
  const isInIframe = (() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const [payMethod, setPayMethod] = useState<'tut_card' | 'tut_wallet'>('tut_card');
  const [fundingSource, setFundingSource] = useState<'wallet_deposit' | 'credit_line'>('wallet_deposit');
  const [customAmount, setCustomAmount] = useState<string>(
    checkoutRequest.amount && checkoutRequest.amount > 0 ? String(checkoutRequest.amount) : '49'
  );
  const [merchantNameInput, setMerchantNameInput] = useState<string>(checkoutRequest.merchantName || 'Partner App');
  const [cardNumberInput, setCardNumberInput] = useState<string>('');
  const [secretCodeInput, setSecretCodeInput] = useState<string>('');
  const [quickPinInput, setQuickPinInput] = useState<string>('');
  const [quickPinConfirm, setQuickPinConfirm] = useState<string>('');
  const [tutCard, setTutCard] = useState<TutPayCardRecord | null>(null);
  const [merchantVerifiedName, setMerchantVerifiedName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activatingCard, setActivatingCard] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receiptResult, setReceiptResult] = useState<{
    memoId: string;
    txId: string;
    amount: number;
    method: string;
    merchantName: string;
    orderId: string;
    signature: string;
    receiptJson: any;
  } | null>(null);
  const [copiedSig, setCopiedSig] = useState(false);

  const effectiveAmount = Number(customAmount) || 0;
  const safeReturnUrl = sanitizeSafeReturnUrl(checkoutRequest.returnUrl);

  // Load card record once authenticated
  useEffect(() => {
    if (!user?.uid) {
      setTutCard(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'tut_cards', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as TutPayCardRecord;
          setTutCard(data);
        } else {
          setTutCard(null);
        }
      },
      (err) => {
        console.warn('Unable to read card record:', err?.message);
      }
    );
    return () => unsub();
  }, [db, user?.uid]);

  // Verify merchant app display name if merchantId passed
  useEffect(() => {
    if (!user?.uid || !checkoutRequest.merchantId) return;
    getDoc(doc(db, 'merchant_apps', checkoutRequest.merchantId))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d?.name) {
            setMerchantVerifiedName(d.name);
            setMerchantNameInput(d.name);
          }
        }
      })
      .catch(() => {});
  }, [db, user?.uid, checkoutRequest.merchantId]);

  const activeTier = profile?.subscriptionTier;
  const borrowCap =
    profile?.subscriptionStatus === 'active'
      ? Number(profile?.borrowingLimit) ||
        (activeTier === 'gold' ? 2500 : activeTier === 'silver' ? 1500 : activeTier === 'bronze' ? 500 : 0)
      : 0;
  const availableCredit = Math.max(0, borrowCap - (Number(profile?.remainingDebt) || 0));
  const vaultBalance = Number(profile?.totalDeposit) || 0;

  // Auto-select available funding source nicely
  useEffect(() => {
    if (profile && vaultBalance < effectiveAmount && availableCredit >= effectiveAmount) {
      setFundingSource('credit_line');
    }
  }, [profile?.uid, vaultBalance, availableCredit, effectiveAmount]);

  const handleQuickActivateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setErrorMsg(null);
    if (!/^\d{6}$/.test(quickPinInput.trim())) {
      setErrorMsg('Secret Payment Code must be 6 digits.');
      return;
    }
    if (quickPinInput.trim() !== quickPinConfirm.trim()) {
      setErrorMsg('Secret Codes do not match.');
      return;
    }
    setActivatingCard(true);
    try {
      const created = await saveTutCardSecuritySetup(db, {
        uid: user.uid,
        memberId: profile.memberId,
        secretCode: quickPinInput.trim(),
        perTxLimit: 50000,
        subscriptionExpiresAt: profile.subscriptionExpiresAt
      });
      setCardNumberInput(created.cardNumber);
      setSecretCodeInput(quickPinInput.trim());
      setQuickPinInput('');
      setQuickPinConfirm('');
      addToast?.('Card Activated', 'Your T.U.T. Card is ready. Confirm Pay now!', 'success');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to activate card.');
    } finally {
      setActivatingCard(false);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setErrorMsg(null);

    if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
      setErrorMsg('Enter a valid positive BDT amount.');
      return;
    }

    setSubmitting(true);
    try {
      const paymentResult = await executeAtomicMerchantPayment(db, {
        userId: user.uid,
        amount: effectiveAmount,
        merchantId: checkoutRequest.merchantId,
        merchantName: merchantVerifiedName || merchantNameInput || checkoutRequest.merchantName,
        orderId: checkoutRequest.orderId,
        paymentInstrument: payMethod === 'tut_card' ? 'tut_card' : fundingSource === 'credit_line' ? 'tut_credit' : 'tut_wallet',
        fundingSource,
        cardNumber: payMethod === 'tut_card' ? cardNumberInput : undefined,
        secretCode: payMethod === 'tut_card' || tutCard?.isActive ? secretCodeInput : undefined,
        reference: checkoutRequest.reference || ''
      });

      // Sign official receipt cryptographically on the server
      const idToken = await user.getIdToken();
      let signature = '';
      let signedReceipt: any = {
        txId: paymentResult.transactionDocId,
        memoId: paymentResult.memoId,
        merchantId: checkoutRequest.merchantId || '',
        merchantName: merchantVerifiedName || merchantNameInput || checkoutRequest.merchantName,
        orderId: checkoutRequest.orderId,
        amount: paymentResult.amount,
        currency: 'BDT',
        payerUid: user.uid,
        payerEmail: user.email || profile.email || '',
        payerMemberId: profile.memberId || '',
        method: paymentResult.methodLabel,
        timestamp: new Date().toISOString()
      };

      try {
        const signResp = await fetch('/api/gateway/sign-receipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify(signedReceipt)
        });
        const signData = await signResp.json();
        if (signResp.ok && signData?.signature) {
          signature = signData.signature;
          signedReceipt = signData.receipt;
        }
      } catch (signErr) {
        console.warn('Receipt signing unavailable:', signErr);
      }

      const finalPayload = {
        memoId: paymentResult.memoId,
        txId: paymentResult.transactionDocId,
        amount: paymentResult.amount,
        method: paymentResult.methodLabel,
        merchantName: signedReceipt.merchantName,
        orderId: checkoutRequest.orderId,
        signature,
        receiptJson: signedReceipt
      };
      setReceiptResult(finalPayload);

      // Dispatch email memo notification to member & Chief Admin (tahsinullahtusher999@gmail.com)
      if (sendWorkflowNotification) {
        sendWorkflowNotification(
          'transaction_confirmed',
          profile.email || user.email || undefined,
          profile.name || user.displayName || 'Member',
          {
            amount: paymentResult.amount,
            type: 'merchant_payment',
            method: paymentResult.methodLabel,
            memoId: paymentResult.memoId,
            transactionId: checkoutRequest.orderId,
            notes: `Authorized Payment to ${signedReceipt.merchantName} (Order: ${checkoutRequest.orderId})`
          }
        ).catch(() => {});
      }

      // Notify opener window or parent iframe safely if launched from another app
      try {
        const targetOrigin = safeReturnUrl ? new URL(safeReturnUrl).origin : '*';
        const messagePayload = {
          type: 'TUT_PAYMENT_RESULT',
          status: 'paid',
          memoId: paymentResult.memoId,
          amount: paymentResult.amount,
          orderId: checkoutRequest.orderId,
          merchantName: signedReceipt.merchantName,
          receipt: signedReceipt,
          signature
        };
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(messagePayload, targetOrigin);
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(messagePayload, targetOrigin);
        }
      } catch {}

      addToast?.(
        'Payment Confirmed',
        `৳${paymentResult.amount.toLocaleString()} paid to ${signedReceipt.merchantName}. Memo: ${paymentResult.memoId}`,
        'success'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Payment could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  const buildReturnHref = (): string | null => {
    if (!safeReturnUrl || !receiptResult) return null;
    try {
      const url = new URL(safeReturnUrl);
      url.searchParams.set('tut_status', 'paid');
      url.searchParams.set('tut_memo', receiptResult.memoId);
      url.searchParams.set('tut_amount', String(receiptResult.amount));
      url.searchParams.set('tut_order', receiptResult.orderId);
      if (receiptResult.signature) {
        url.searchParams.set('tut_sig', receiptResult.signature);
      }
      return url.toString();
    } catch {
      return null;
    }
  };

  const containerClasses = isModal
    ? 'fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto'
    : 'min-h-screen bg-[#040918] text-slate-100 flex items-center justify-center p-4 py-10';

  return (
    <div className={containerClasses}>
      <div className="w-full max-w-md bg-[#0B132B] border border-[#1E3368] rounded-3xl p-6 space-y-5 shadow-2xl text-left relative">
        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Authority Gateway Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/10">
          <img
            src={tutLogo}
            alt="T.U.T. Authority"
            className="w-10 h-10 rounded-xl object-cover border border-amber-400/30"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-wide text-white">T.U.T. Pay Gateway</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              Authorized Zero-Usury Card & Wallet Checkout
            </p>
          </div>
        </div>

        {/* Order Amount Summary */}
        <div className="p-4 rounded-2xl bg-[#070D1F] border border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
              Paying Merchant / App
            </span>
            {checkoutRequest.amount ? (
              <p className="text-sm font-bold text-white truncate mt-0.5">
                {merchantVerifiedName || merchantNameInput}
              </p>
            ) : (
              <input
                type="text"
                value={merchantNameInput}
                onChange={(e) => setMerchantNameInput(e.target.value)}
                placeholder="Merchant or App Name"
                className="mt-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-white font-semibold w-full"
              />
            )}
            <span className="text-[10px] font-mono text-slate-400 block mt-0.5 truncate">
              Order: {checkoutRequest.orderId}
            </span>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Amount (BDT)
            </span>
            {checkoutRequest.amount && checkoutRequest.amount > 0 ? (
              <p className="text-2xl font-black font-mono text-white">
                ৳{checkoutRequest.amount.toLocaleString()}
              </p>
            ) : (
              <input
                type="number"
                min={1}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-24 mt-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-amber-400/40 text-right font-mono text-base font-black text-amber-300"
              />
            )}
          </div>
        </div>

        {/* Step 1: Wait smoothly while Firebase session settles, then verify sign-in on T.U.T. Domain */}
        {isAuthChecking ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-300">
              Checking your T.U.T. member session...
            </p>
          </div>
        ) : !user ? (
          <div className="space-y-3.5 py-2 text-center">
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-left space-y-1.5">
              <p className="text-xs font-bold text-blue-300">Verify Your T.U.T. Member Identity</p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Sign in securely on T.U.T. Private Lending Authority
                {payerEmailHint ? ` (${payerEmailHint})` : ''} to access your Vault Balance, Credit Line, or T.U.T. Card.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoggingIn ? 'Connecting...' : 'Sign In with Google to Pay'}</span>
            </button>
            {isInIframe && typeof window !== 'undefined' && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Open Payment Page in Full Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ) : !profile ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <p className="text-xs font-bold text-amber-300">T.U.T. Membership Not Registered Yet</p>
            <p className="text-[11px] text-slate-300">
              Signed in as {user.email}. Register your T.U.T. account on the main portal first, then return here to pay.
            </p>
          </div>
        ) : profile.status !== 'approved' ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <p className="text-xs font-bold text-amber-300">Membership Approval Pending</p>
            <p className="text-[11px] text-slate-300">
              Your account ({profile.name}) is awaiting Authority approval before external payments can be authorized.
            </p>
          </div>
        ) : receiptResult ? (
          /* ================= SUCCESS SIGNED RECEIPT SCREEN ================= */
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="text-base font-black text-white">Payment Authorized & Confirmed</h4>
              <p className="text-xs text-emerald-200/90">
                ৳{receiptResult.amount.toLocaleString()} paid via {receiptResult.method}
              </p>
              <div className="inline-block px-3 py-1 rounded-lg bg-slate-950 border border-emerald-500/30 font-mono text-xs font-bold text-emerald-300">
                Memo: {receiptResult.memoId}
              </div>
            </div>

            {receiptResult.signature && (
              <div className="p-3 rounded-xl bg-[#070D1F] border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Cryptographic Receipt Code
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify({ receipt: receiptResult.receiptJson, signature: receiptResult.signature }, null, 2)
                      );
                      setCopiedSig(true);
                      setTimeout(() => setCopiedSig(false), 2000);
                    }}
                    className="text-[11px] font-semibold text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSig ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSig ? 'Copied' : 'Copy Proof'}</span>
                  </button>
                </div>
                <p className="font-mono text-[10px] text-slate-400 break-all">
                  {receiptResult.signature}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {buildReturnHref() && (
                <a
                  href={buildReturnHref()!}
                  className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Return to {receiptResult.merchantName}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {isModal && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ================= PAYMENT FORM (CARD + WALLET DIRECT) ================= */
          <div className="space-y-4">
            {/* Authenticated Member Strip */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-white/10 flex items-center justify-between text-xs">
              <div className="min-w-0">
                <span className="font-bold text-white block truncate">{profile.name}</span>
                <span className="text-[11px] text-slate-400 font-mono truncate block">
                  {profile.email || user.email}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 block">Vault Balance</span>
                <span className="font-mono font-bold text-emerald-400">৳{vaultBalance.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Instrument Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#070D1F] border border-white/10">
              <button
                type="button"
                onClick={() => setPayMethod('tut_card')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  payMethod === 'tut_card'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>T.U.T. Card</span>
              </button>
              <button
                type="button"
                onClick={() => setPayMethod('tut_wallet')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  payMethod === 'tut_wallet'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>T.U.T. Wallet Direct</span>
              </button>
            </div>

            {/* First-time Card Activation prompt inside Checkout if paying by Card and not yet activated */}
            {payMethod === 'tut_card' && !tutCard?.isActive ? (
              <form onSubmit={handleQuickActivateCard} className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-200">Activate Your Payable T.U.T. Card</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Set a 6-digit Secret Payment Code once to generate your live 16-digit Card Number and authorize payments.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={quickPinInput}
                    onChange={(e) => setQuickPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit Secret Code"
                    className="px-3 py-2 rounded-xl bg-[#070D1F] border border-white/15 text-xs font-mono text-white text-center"
                    required
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={quickPinConfirm}
                    onChange={(e) => setQuickPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Confirm Code"
                    className="px-3 py-2 rounded-xl bg-[#070D1F] border border-white/15 text-xs font-mono text-white text-center"
                    required
                  />
                </div>
                {errorMsg && (
                  <p className="text-xs text-rose-300 font-medium">{errorMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={activatingCard}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  {activatingCard ? 'Activating Card...' : 'Activate Card & Continue'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmPayment} className="space-y-4">
                {payMethod === 'tut_card' && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300">
                          16-Digit T.U.T. Card Number
                        </label>
                        {tutCard?.cardNumber && (
                          <button
                            type="button"
                            onClick={() => setCardNumberInput(tutCard.cardNumber)}
                            className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
                          >
                            Fill My Card ({formatCardNumberDisplay(tutCard.cardNumber, true)})
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={19}
                        value={cardNumberInput}
                        onChange={(e) => setCardNumberInput(e.target.value.replace(/[^\d\s]/g, '').slice(0, 19))}
                        placeholder="5488 •••• •••• ••••"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#070D1F] border border-white/10 text-white font-mono text-sm tracking-wider focus:outline-none focus:border-amber-400/60"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Funding Source Selector (Vault Balance OR Approved 0% Credit Line) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block">Funding Source</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFundingSource('wallet_deposit')}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        fundingSource === 'wallet_deposit'
                          ? 'bg-emerald-500/15 border-emerald-400/50 text-white'
                          : 'bg-[#070D1F] border-white/10 text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase block">Vault Balance</span>
                      <span className="font-mono text-xs font-black text-emerald-300">
                        ৳{vaultBalance.toLocaleString()}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFundingSource('credit_line')}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        fundingSource === 'credit_line'
                          ? 'bg-blue-500/15 border-blue-400/50 text-white'
                          : 'bg-[#070D1F] border-white/10 text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase block">0% Credit Line</span>
                      <span className="font-mono text-xs font-black text-blue-300">
                        {borrowCap > 0 ? `৳${availableCredit.toLocaleString()} avail` : 'Requires Charter'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Secret Code Verification (always required for Card, and required for Wallet when Secret Code is set) */}
                {(payMethod === 'tut_card' || tutCard?.isActive) && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>6-Digit Secret Payment Code</span>
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={secretCodeInput}
                      onChange={(e) => setSecretCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070D1F] border border-white/10 text-white font-mono text-sm tracking-[0.35em] text-center focus:outline-none focus:border-amber-400/60"
                      required
                    />
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>
                    {submitting
                      ? 'Authorizing Ledger...'
                      : `Pay ৳${effectiveAmount.toLocaleString()} Now`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
