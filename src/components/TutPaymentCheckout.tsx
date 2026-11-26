import React, { useEffect, useState } from 'react';
import { Firestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  CreditCard,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Copy,
  Check,
  KeyRound,
  LogIn,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { UserProfile } from '../App';
import {
  PRIMARY_VERCEL_GATEWAY_URL,
  TutPayCardRecord,
  formatCardNumberDisplay,
  activateCardWithInitialKey
} from '../utils/tutPaymentEngine';
import { executeAtomicMerchantPayment } from '../utils/bankingLedgerEngine';

export interface TutCheckoutRequest {
  amount?: number;
  merchantName: string;
  merchantId?: string;
  orderId: string;
  returnUrl?: string;
  reference?: string;
  sessionToken?: string;
}

interface TutPaymentCheckoutProps {
  db: Firestore;
  user: User | null;
  profile: UserProfile | null;
  checkoutRequest: TutCheckoutRequest;
  isAuthChecking?: boolean;
  payerEmailHint?: string;
  onGoogleLogin: () => Promise<void>;
  isLoggingIn?: boolean;
  sendWorkflowNotification?: (
    eventType: any,
    userEmail?: string,
    userName?: string,
    details?: any
  ) => Promise<void>;
  addToast?: (title: string, msg: string, type: 'success' | 'warning' | 'danger' | 'info') => void;
}

function sanitizeSafeReturnUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
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
  isAuthChecking = false,
  payerEmailHint,
  onGoogleLogin,
  isLoggingIn = false,
  sendWorkflowNotification,
  addToast
}) => {
  const isEmbeddedIframe = (() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const [resolvedSession, setResolvedSession] = useState<TutCheckoutRequest>(checkoutRequest);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState<boolean>(Boolean(checkoutRequest.sessionToken));

  const [fundingSource, setFundingSource] = useState<'wallet_deposit' | 'credit_line'>('wallet_deposit');
  const [customAmount, setCustomAmount] = useState<string>(
    checkoutRequest.amount && checkoutRequest.amount > 0 ? String(checkoutRequest.amount) : ''
  );
  const [cardNumberInput, setCardNumberInput] = useState<string>('');
  const [secretCodeInput, setSecretCodeInput] = useState<string>('');

  // First-time key creation inside checkout if user has not set one yet
  const [quickPinInput, setQuickPinInput] = useState<string>('');
  const [quickPinConfirm, setQuickPinConfirm] = useState<string>('');
  const [issuedBackupKey, setIssuedBackupKey] = useState<string | null>(null);

  const [tutCard, setTutCard] = useState<TutPayCardRecord | null>(null);
  const [merchantMeta, setMerchantMeta] = useState<{
    name?: string;
    allowedOrigins?: string[];
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [activatingCard, setActivatingCard] = useState(false);
  const [retryingConfirm, setRetryingConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Completed payment & server-confirmed receipt state
  const [pendingTxDocId, setPendingTxDocId] = useState<string | null>(null);
  const [receiptResult, setReceiptResult] = useState<{
    memoId: string;
    txId: string;
    amount: number;
    cardLast4: string;
    merchantName: string;
    orderId: string;
    signature: string;
    token: string;
    receiptJson: any;
    webhookDelivered: boolean;
  } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Resolve signed checkout session (?session=...) if supplied by Merchant
  useEffect(() => {
    const token = checkoutRequest.sessionToken;
    if (!token) {
      setSessionLoading(false);
      return;
    }
    setSessionLoading(true);
    fetch(`/api/gateway/parse-session?session=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data?.valid || !data?.session) {
          setSessionError(data?.error || 'Checkout session could not be verified.');
          return;
        }
        const s = data.session;
        setResolvedSession({
          amount: Number(s.amount),
          merchantId: s.merchantId || undefined,
          merchantName: s.merchantName || checkoutRequest.merchantName,
          orderId: s.orderId || checkoutRequest.orderId,
          returnUrl: s.returnUrl || checkoutRequest.returnUrl,
          reference: s.reference || checkoutRequest.reference,
          sessionToken: token
        });
        setCustomAmount(String(s.amount));
      })
      .catch(() => {
        setSessionError('Unable to reach gateway session verifier.');
      })
      .finally(() => setSessionLoading(false));
  }, [checkoutRequest]);

  // Listen to member's T.U.T. Card key record
  useEffect(() => {
    if (!user?.uid) {
      setTutCard(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'tut_cards', user.uid),
      (snap) => {
        setTutCard(snap.exists() ? (snap.data() as TutPayCardRecord) : null);
      },
      (err) => {
        console.warn('Unable to read card record:', err?.message);
      }
    );
    return () => unsub();
  }, [db, user?.uid]);

  // Fetch registered merchant metadata
  useEffect(() => {
    if (!user?.uid || !resolvedSession.merchantId) return;
    getDoc(doc(db, 'merchant_apps', resolvedSession.merchantId))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data() as any;
          setMerchantMeta({
            name: d?.name,
            allowedOrigins: Array.isArray(d?.allowedOrigins) ? d.allowedOrigins : []
          });
        }
      })
      .catch(() => {});
  }, [db, user?.uid, resolvedSession.merchantId]);

  const effectiveAmount =
    resolvedSession.amount && resolvedSession.amount > 0
      ? Number(resolvedSession.amount)
      : Number(customAmount) || 0;
  const displayMerchantName = merchantMeta?.name || resolvedSession.merchantName || 'Partner App';
  const safeReturnUrl = sanitizeSafeReturnUrl(resolvedSession.returnUrl);

  const activeTier = profile?.subscriptionTier;
  const borrowCap =
    profile?.subscriptionStatus === 'active'
      ? Number(profile?.borrowingLimit) ||
        (activeTier === 'gold'
          ? 2500
          : activeTier === 'silver'
          ? 1500
          : activeTier === 'bronze'
          ? 500
          : 0)
      : 0;
  const availableCredit = Math.max(0, borrowCap - (Number(profile?.remainingDebt) || 0));
  const vaultBalance = Number(profile?.totalDeposit) || 0;

  useEffect(() => {
    if (profile && vaultBalance < effectiveAmount && availableCredit >= effectiveAmount) {
      setFundingSource('credit_line');
    }
  }, [profile?.uid, vaultBalance, availableCredit, effectiveAmount]);

  const buildReturnHref = (resPayload: {
    memoId: string;
    amount: number;
    orderId: string;
    signature: string;
    token: string;
    cardLast4: string;
  }): string | null => {
    if (!safeReturnUrl) return null;
    try {
      const url = new URL(safeReturnUrl);
      url.searchParams.set('tut_status', 'paid');
      url.searchParams.set('tut_memo', resPayload.memoId);
      url.searchParams.set('tut_amount', String(resPayload.amount));
      url.searchParams.set('tut_order', resPayload.orderId);
      url.searchParams.set('tut_card_last4', resPayload.cardLast4);
      url.searchParams.set('tut_token', resPayload.token);
      url.searchParams.set('tut_sig', resPayload.signature);
      return url.toString();
    } catch {
      return null;
    }
  };

  // Dispatch server confirmation & notify merchant window + auto-redirect
  const confirmPaymentWithServer = async (txDocId: string) => {
    if (!user || !profile) {
      throw new Error('Session expired.');
    }
    const idToken = await user.getIdToken();
    const resp = await fetch('/api/gateway/confirm-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        txId: txDocId,
        payerMemberId: profile.memberId || ''
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.success || !data?.token || !data?.signature) {
      throw new Error(data?.error || 'Server payment verification failed. Please retry confirmation.');
    }

    const finalPayload = {
      memoId: data.receipt.memoId,
      txId: data.receipt.txId,
      amount: data.receipt.amount,
      cardLast4: data.receipt.cardLast4 || '',
      merchantName: data.receipt.merchantName,
      orderId: data.receipt.orderId,
      signature: data.signature,
      token: data.token,
      receiptJson: data.receipt,
      webhookDelivered: Boolean(data.webhookDelivered)
    };
    setReceiptResult(finalPayload);
    setPendingTxDocId(null);

    if (sendWorkflowNotification) {
      sendWorkflowNotification(
        'transaction_confirmed',
        profile.email || user.email || undefined,
        profile.name || user.displayName || 'Member',
        {
          amount: finalPayload.amount,
          type: 'merchant_payment',
          method: 'T.U.T. Card',
          memoId: finalPayload.memoId,
          transactionId: finalPayload.orderId,
          notes: `Authorized Card Payment to ${finalPayload.merchantName} (Order: ${finalPayload.orderId})`
        }
      ).catch(() => {});
    }

    // Deliver signed confirmation via postMessage strictly to validated target origin when available
    try {
      const targetOrigin = safeReturnUrl
        ? new URL(safeReturnUrl).origin
        : merchantMeta?.allowedOrigins?.[0] || null;
      if (targetOrigin) {
        const messagePayload = {
          type: 'TUT_PAYMENT_RESULT',
          status: 'paid',
          memoId: finalPayload.memoId,
          amount: finalPayload.amount,
          orderId: finalPayload.orderId,
          merchantName: finalPayload.merchantName,
          cardLast4: finalPayload.cardLast4,
          token: finalPayload.token,
          receipt: finalPayload.receiptJson,
          signature: finalPayload.signature
        };
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(messagePayload, targetOrigin);
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(messagePayload, targetOrigin);
        }
      }
    } catch {}

    // Schedule clean automatic redirect back to Merchant App if returnUrl is present
    if (safeReturnUrl) {
      setRedirectCountdown(2);
    }

    return finalPayload;
  };

  // Handle auto-redirect countdown back to merchant returnUrl
  useEffect(() => {
    if (redirectCountdown === null || !receiptResult || !safeReturnUrl) return;
    if (redirectCountdown <= 0) {
      const href = buildReturnHref(receiptResult);
      if (href) {
        window.location.assign(href);
      }
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [redirectCountdown, receiptResult, safeReturnUrl]);

  const handleInitialSetupInCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setErrorMsg(null);
    if (!/^\d{6}$/.test(quickPinInput.trim())) {
      setErrorMsg('Card Payment Key must be exactly 6 numeric digits.');
      return;
    }
    if (quickPinInput.trim() !== quickPinConfirm.trim()) {
      setErrorMsg('Confirmation key does not match.');
      return;
    }
    setActivatingCard(true);
    try {
      const { card, rawBackupKey } = await activateCardWithInitialKey(db, {
        uid: user.uid,
        memberId: profile.memberId,
        secretCode: quickPinInput.trim(),
        perTxLimit: 50000,
        subscriptionExpiresAt: profile.subscriptionExpiresAt
      });
      setCardNumberInput(card.cardNumber);
      setSecretCodeInput(quickPinInput.trim());
      setIssuedBackupKey(rawBackupKey);
      setQuickPinInput('');
      setQuickPinConfirm('');
      addToast?.('Card Activated', 'Save your one-time Master Recovery Key and complete payment.', 'success');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to activate card key.');
    } finally {
      setActivatingCard(false);
    }
  };

  const handleConfirmCardPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setErrorMsg(null);

    if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
      setErrorMsg('A valid positive BDT amount is required.');
      return;
    }

    setSubmitting(true);
    try {
      const paymentResult = await executeAtomicMerchantPayment(db, {
        userId: user.uid,
        amount: effectiveAmount,
        merchantId: resolvedSession.merchantId,
        merchantName: displayMerchantName,
        orderId: resolvedSession.orderId,
        paymentInstrument: 'tut_card',
        fundingSource,
        cardNumber: cardNumberInput,
        secretCode: secretCodeInput,
        reference: resolvedSession.reference || ''
      });

      setPendingTxDocId(paymentResult.transactionDocId);
      await confirmPaymentWithServer(paymentResult.transactionDocId);

      addToast?.(
        'Card Payment Verified',
        `৳${paymentResult.amount.toLocaleString()} paid to ${displayMerchantName}.`,
        'success'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Card payment could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryServerConfirm = async () => {
    if (!pendingTxDocId) return;
    setRetryingConfirm(true);
    setErrorMsg(null);
    try {
      await confirmPaymentWithServer(pendingTxDocId);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Confirmation retry failed.');
    } finally {
      setRetryingConfirm(false);
    }
  };

  const returnHref = receiptResult ? buildReturnHref(receiptResult) : null;

  return (
    <div className="min-h-screen bg-vault-mesh relative flex flex-col items-center justify-center p-4 sm:p-6 overflow-x-hidden">
      <div className="absolute inset-0 vault-grid-pattern opacity-35 pointer-events-none" />
      <div className="relative z-10 w-full max-w-md gold-rim-card rounded-2xl p-6 space-y-5 text-left">
        {/* Top Merchant Summary */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-[#EAD39C] block">
              T.U.T. Private Lending Authority · Card Checkout
            </span>
            <h2 className="text-lg font-bold text-white truncate mt-0.5">
              {displayMerchantName}
            </h2>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              Order: {resolvedSession.orderId}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] text-slate-400 block">Total Due</span>
            <span className="text-xl font-black font-mono tabular-nums text-white">
              ৳{effectiveAmount > 0 ? effectiveAmount.toLocaleString() : '0'}
            </span>
          </div>
        </div>

        {/* Iframe Warning */}
        {isEmbeddedIframe && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-2 text-xs">
            <p className="font-bold text-amber-200">Open in Dedicated Tab for Secure Sign-In</p>
            <button
              type="button"
              onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
              className="w-full py-2.5 rounded-lg gold-cta-gradient text-[#090E1A] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer tap-interactive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Secure Checkout Tab</span>
            </button>
          </div>
        )}

        {/* Editable Amount only when Merchant didn't specify a fixed amount */}
        {(!resolvedSession.amount || resolvedSession.amount <= 0) && !receiptResult && !sessionLoading && (
          <div className="p-3.5 rounded-xl bg-[#050A16] border border-white/10 space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 block">
              Payment Amount (BDT)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Enter amount in BDT"
              className="w-full px-3 py-2 rounded-lg bg-[#091124] border border-white/10 text-sm font-mono tabular-nums font-bold text-emerald-300 focus:outline-none focus:border-[#DFC07C]/70"
            />
          </div>
        )}

        {/* Session Error */}
        {sessionError ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Checkout Session Error</span>
            </div>
            <p>{sessionError}</p>
          </div>
        ) : sessionLoading || isAuthChecking ? (
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-8 h-8 border-2 border-[#DFC07C] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-300">Verifying secure checkout session...</p>
          </div>
        ) : !user ? (
          <div className="py-5 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#DFC07C]/15 border border-[#DFC07C]/35 flex items-center justify-center text-[#EAD39C]">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Sign In with Your T.U.T. Member Account</h3>
              <p className="text-xs text-slate-400 mt-1">
                Verify your identity to pay using your 16-digit T.U.T. Card.
                {payerEmailHint ? ` (${payerEmailHint})` : ''}
              </p>
            </div>
            <button
              type="button"
              disabled={isLoggingIn}
              onClick={onGoogleLogin}
              className="w-full py-3 rounded-xl gold-cta-gradient text-[#090E1A] font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isLoggingIn ? 'Signing In...' : 'Sign In with Gmail'}</span>
            </button>
          </div>
        ) : !profile || profile.status !== 'approved' ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4" />
              <span>Approved Membership Required</span>
            </div>
            <p className="text-slate-300">
              Your T.U.T. account must be approved by Authority Administrators before completing Card payments.
            </p>
            <a
              href={PRIMARY_VERCEL_GATEWAY_URL}
              className="inline-flex items-center gap-1.5 text-[#EAD39C] font-semibold hover:underline"
            >
              <span>Open Member Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : pendingTxDocId && !receiptResult ? (
          /* Deducted in ledger but server confirmation needs retry */
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-xs">
            <p className="font-bold text-amber-200">Finalize Merchant Confirmation</p>
            <p className="text-slate-300">
              Your card payment was recorded, but the signed confirmation token could not be issued yet. Retry below so the merchant receives your verified payment proof.
            </p>
            {errorMsg && <p className="text-rose-300 font-medium">{errorMsg}</p>}
            <button
              type="button"
              disabled={retryingConfirm}
              onClick={handleRetryServerConfirm}
              className="w-full py-2.5 rounded-xl gold-cta-gradient text-[#090E1A] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retryingConfirm ? 'animate-spin' : ''}`} />
              <span>{retryingConfirm ? 'Confirming...' : 'Verify & Notify Merchant'}</span>
            </button>
          </div>
        ) : receiptResult ? (
          /* Payment Verified & Confirmed */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Card Payment Verified</h3>
              <p className="text-xs text-slate-300 font-mono tabular-nums">
                Memo: <span className="text-emerald-300 font-bold">{receiptResult.memoId}</span> · •••• {receiptResult.cardLast4}
              </p>
              {receiptResult.webhookDelivered && (
                <p className="text-[11px] text-emerald-300">
                  Merchant server notified automatically.
                </p>
              )}
              {returnHref && redirectCountdown !== null && (
                <p className="text-[11px] text-[#EAD39C] font-semibold">
                  Returning to {receiptResult.merchantName} in {redirectCountdown}s...
                </p>
              )}
            </div>

            <div className="ticket-divider h-3" />

            <div className="p-3 rounded-xl bg-[#050A16] border border-white/10 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Signed Payment Token</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(receiptResult.token);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="text-[#EAD39C] hover:text-white flex items-center gap-1 cursor-pointer font-semibold"
                >
                  {copiedToken ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedToken ? 'Copied' : 'Copy Token'}</span>
                </button>
              </div>
              <p className="font-mono text-[10px] text-slate-400 break-all">
                {receiptResult.token.slice(0, 72)}...
              </p>
            </div>

            {returnHref && (
              <a
                href={returnHref}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <span>Return to {receiptResult.merchantName}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>
        ) : (
          /* Main Card-Only Checkout */
          <div className="space-y-4">
            {/* Member Strip */}
            <div className="px-3.5 py-2.5 rounded-xl bg-[#050A16] border border-white/10 flex items-center justify-between text-xs">
              <div className="min-w-0">
                <span className="font-bold text-white block truncate">{profile.name}</span>
                <span className="text-[11px] text-slate-400 font-mono truncate block">
                  {profile.email || user.email}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 block">Vault Balance</span>
                <span className="font-mono tabular-nums font-bold text-emerald-400">
                  ৳{vaultBalance.toLocaleString()}
                </span>
              </div>
            </div>

            {issuedBackupKey && (
              <div className="p-3.5 rounded-xl bg-emerald-500/12 border border-emerald-400/35 space-y-1.5 text-xs">
                <p className="font-bold text-emerald-300">Save Your One-Time Recovery Backup Key</p>
                <p className="font-mono text-[#EAD39C] font-bold">{issuedBackupKey}</p>
              </div>
            )}

            {/* Mandatory Initial Card Key Setup if not set yet */}
            {!tutCard?.secretCodeHash || !tutCard?.isActive ? (
              <form
                onSubmit={handleInitialSetupInCheckout}
                className="p-4 rounded-xl bg-[#DFC07C]/10 border border-[#DFC07C]/30 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-[#EAD39C] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[#FFF2CC]">
                      Set Your 6-Digit Card Payment Key First
                    </p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      You must create a 6-digit Payment Key once before paying with your T.U.T. Card.
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
                    placeholder="6-digit Key"
                    className="px-3 py-2 rounded-xl bg-[#050A16] border border-white/15 text-xs font-mono text-white text-center focus:outline-none focus:border-[#DFC07C]/70"
                    required
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={quickPinConfirm}
                    onChange={(e) => setQuickPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Confirm Key"
                    className="px-3 py-2 rounded-xl bg-[#050A16] border border-white/15 text-xs font-mono text-white text-center focus:outline-none focus:border-[#DFC07C]/70"
                    required
                  />
                </div>
                {errorMsg && <p className="text-xs text-rose-300 font-medium">{errorMsg}</p>}
                <button
                  type="submit"
                  disabled={activatingCard}
                  className="w-full py-2.5 rounded-xl gold-cta-gradient text-[#090E1A] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {activatingCard ? 'Activating Card...' : 'Set Key & Continue to Pay'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmCardPayment} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#DFC07C]" />
                      <span>16-Digit T.U.T. Card Number</span>
                    </label>
                    {tutCard?.cardNumber && (
                      <button
                        type="button"
                        onClick={() => setCardNumberInput(tutCard.cardNumber)}
                        className="text-[11px] font-semibold text-[#EAD39C] hover:text-white cursor-pointer"
                      >
                        Use My Card ({formatCardNumberDisplay(tutCard.cardNumber, true)})
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={19}
                    value={cardNumberInput}
                    onChange={(e) =>
                      setCardNumberInput(e.target.value.replace(/[^\d\s]/g, '').slice(0, 19))
                    }
                    placeholder="5488 •••• •••• ••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#050A16] border border-white/12 text-white font-mono tabular-nums text-sm tracking-wider focus:outline-none focus:border-[#DFC07C]/70"
                    required
                  />
                </div>

                {/* Funding Source Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block">
                    Card Funding Source
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFundingSource('wallet_deposit')}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer tap-interactive ${
                        fundingSource === 'wallet_deposit'
                          ? 'bg-emerald-500/15 border-emerald-400/50 text-white'
                          : 'bg-[#050A16] border-white/10 text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase block">Vault Balance</span>
                      <span className="font-mono tabular-nums text-xs font-black text-emerald-300">
                        ৳{vaultBalance.toLocaleString()}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFundingSource('credit_line')}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer tap-interactive ${
                        fundingSource === 'credit_line'
                          ? 'bg-blue-500/15 border-blue-400/50 text-white'
                          : 'bg-[#050A16] border-white/10 text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase block">0% Credit Line</span>
                      <span className="font-mono tabular-nums text-xs font-black text-blue-300">
                        {borrowCap > 0 ? `৳${availableCredit.toLocaleString()} avail` : 'Requires Charter'}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                    <Lock className="w-3 h-3 text-[#DFC07C]" />
                    <span>6-Digit Card Payment Key</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={secretCodeInput}
                    onChange={(e) => setSecretCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#050A16] border border-white/12 text-white font-mono text-sm tracking-[0.35em] text-center focus:outline-none focus:border-[#DFC07C]/70"
                    required
                  />
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl gold-cta-gradient text-[#090E1A] font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  <span>
                    {submitting
                      ? 'Verifying & Confirming Card...'
                      : `Pay ৳${effectiveAmount.toLocaleString()} with T.U.T. Card`}
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
