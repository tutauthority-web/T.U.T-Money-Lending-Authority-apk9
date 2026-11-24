import React, { useEffect, useState } from 'react';
import { Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  ShieldCheck,
  CreditCard,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  KeyRound,
  AlertCircle,
  Mail,
  LifeBuoy,
  HelpCircle,
  ArrowLeft
} from 'lucide-react';
import {
  TutPayCardRecord,
  deriveDeterministicCardNumber,
  formatCardNumberDisplay,
  normalizeExpiry,
  activateCardWithInitialKey,
  recoverCardPaymentKey,
  toggleTutCardFreeze,
  updateTutCardLimit
} from '../utils/tutPaymentEngine';
import { UserProfile } from '../App';

interface TutCardKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  mandatoryMode?: boolean;
  onSignOut?: () => void;
  db: Firestore;
  user: User | null;
  profile: UserProfile;
  tutCard: TutPayCardRecord | null;
  addToast?: (title: string, msg: string, type: 'success' | 'warning' | 'danger' | 'info') => void;
}

const PRESET_SECURITY_QUESTIONS = [
  'What city were you born in?',
  'What is the name of your first school?',
  'What was your childhood nickname?',
  'What is your favorite book or childhood street?'
];

export const TutCardKeyModal: React.FC<TutCardKeyModalProps> = ({
  isOpen,
  onClose,
  mandatoryMode = false,
  onSignOut,
  db,
  user,
  profile,
  tutCard,
  addToast
}) => {
  const [enteredViaMandatoryGate, setEnteredViaMandatoryGate] = useState(false);

  useEffect(() => {
    if (isOpen && mandatoryMode) {
      setEnteredViaMandatoryGate(true);
    }
    if (!isOpen) {
      setEnteredViaMandatoryGate(false);
    }
  }, [isOpen, mandatoryMode]);
  const [secretCode, setSecretCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [showPan, setShowPan] = useState(false);
  const [copiedPan, setCopiedPan] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [perTxLimit, setPerTxLimit] = useState<number>(() => tutCard?.perTxLimit || 50000);

  // Initial setup security question (optional smart recovery backup)
  const [securityQuestion, setSecurityQuestion] = useState(PRESET_SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Revealed one-time backup key after initial activation or recovery
  const [revealedBackupKey, setRevealedBackupKey] = useState<string | null>(null);

  // Smart Recovery State (shown only when key is ALREADY set & user opens recovery)
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryMethod, setRecoveryMethod] = useState<'email_otp' | 'backup_key' | 'security_question'>(
    'email_otp'
  );
  const [backupKeyInput, setBackupKeyInput] = useState('');
  const [securityAnswerInput, setSecurityAnswerInput] = useState('');

  // Email OTP Challenge State
  const [otpChallengeToken, setOtpChallengeToken] = useState<string | null>(null);
  const [otpMaskedEmail, setOtpMaskedEmail] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [emailOtpProofToken, setEmailOtpProofToken] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Recovery new key inputs (only shown after recovery proof succeeds)
  const [newKeyInput, setNewKeyInput] = useState('');
  const [newKeyConfirm, setNewKeyConfirm] = useState('');

  const [saving, setSaving] = useState(false);
  const [togglingFreeze, setTogglingFreeze] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (tutCard?.perTxLimit) {
      setPerTxLimit(tutCard.perTxLimit);
    }
  }, [tutCard?.perTxLimit]);

  if (!isOpen) return null;

  const isKeyAlreadySet = Boolean(tutCard?.secretCodeHash && tutCard?.isActive);
  const hasSecurityQuestion = Boolean(tutCard?.securityQuestion && tutCard?.securityAnswerHash);
  const hasBackupKey = Boolean(tutCard?.recoveryKeyHash);

  const cardNumber =
    tutCard?.cardNumber || deriveDeterministicCardNumber(profile.uid, profile.memberId);
  const { month, year } = normalizeExpiry(profile.subscriptionExpiresAt);
  const expiryStr =
    tutCard?.expiryMonth && tutCard?.expiryYear
      ? `${tutCard.expiryMonth}/${tutCard.expiryYear}`
      : `${month}/${year}`;

  const resetRecoveryFlow = () => {
    setRecoveryOpen(false);
    setErrorMsg(null);
    setBackupKeyInput('');
    setSecurityAnswerInput('');
    setOtpChallengeToken(null);
    setOtpMaskedEmail(null);
    setOtpInput('');
    setEmailOtpProofToken(null);
    setNewKeyInput('');
    setNewKeyConfirm('');
  };

  const handleCopyPan = () => {
    navigator.clipboard.writeText(cardNumber);
    setCopiedPan(true);
    setTimeout(() => setCopiedPan(false), 2000);
  };

  const handleCopyBackup = (keyText: string) => {
    navigator.clipboard.writeText(keyText);
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  // First-time Key Activation (only possible when NOT set yet)
  const handleInitialActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isKeyAlreadySet) {
      setErrorMsg('Card Key is already set. Use Smart Recovery if you forgot it.');
      return;
    }
    if (!/^\d{6}$/.test(secretCode.trim())) {
      setErrorMsg('Card Payment Key must be exactly 6 numeric digits.');
      return;
    }
    if (secretCode.trim() !== confirmCode.trim()) {
      setErrorMsg('Confirmation key does not match.');
      return;
    }

    setSaving(true);
    try {
      const { rawBackupKey } = await activateCardWithInitialKey(db, {
        uid: profile.uid,
        memberId: profile.memberId,
        secretCode: secretCode.trim(),
        perTxLimit,
        subscriptionExpiresAt: profile.subscriptionExpiresAt,
        securityQuestion: securityAnswer.trim() ? securityQuestion : undefined,
        securityAnswer: securityAnswer.trim() || undefined
      });
      setRevealedBackupKey(rawBackupKey);
      setSecretCode('');
      setConfirmCode('');
      setSecurityAnswer('');
      addToast?.(
        'Card Payment Key Activated',
        'Save your one-time Master Recovery Key shown below.',
        'success'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not activate Card Payment Key.');
    } finally {
      setSaving(false);
    }
  };

  // Update spend limit only (never alters Payment Key)
  const handleSaveSpendLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isKeyAlreadySet) return;
    setErrorMsg(null);
    setSaving(true);
    try {
      await updateTutCardLimit(db, profile.uid, perTxLimit);
      addToast?.(
        'Spend Cap Updated',
        `Card per-transaction limit set to ৳${perTxLimit.toLocaleString()}.`,
        'success'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to update spend limit.');
    } finally {
      setSaving(false);
    }
  };

  const handleFreezeToggle = async () => {
    if (!tutCard?.isActive) return;
    setTogglingFreeze(true);
    setErrorMsg(null);
    try {
      const nextFrozen = !tutCard.isFrozen;
      await toggleTutCardFreeze(db, profile.uid, nextFrozen);
      addToast?.(
        nextFrozen ? 'Card Frozen' : 'Card Unfrozen',
        nextFrozen
          ? 'External card purchases are blocked until you unfreeze this card.'
          : 'Your T.U.T. Card is active for payments again.',
        nextFrozen ? 'warning' : 'success'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to update card lock state.');
    } finally {
      setTogglingFreeze(false);
    }
  };

  const handleSendRecoveryOtp = async () => {
    if (!user) {
      setErrorMsg('Active authenticated session required.');
      return;
    }
    setSendingOtp(true);
    setErrorMsg(null);
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/gateway/card-recovery/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({})
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.challengeToken) {
        throw new Error(data?.error || 'Could not send Email OTP. Try Master Backup Key instead.');
      }
      setOtpChallengeToken(data.challengeToken);
      setOtpMaskedEmail(data.maskedEmail || user.email || 'your email');
      addToast?.('Recovery Code Sent', `Check ${data.maskedEmail || 'your inbox'} for the 6-digit code.`, 'info');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to dispatch Email OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyRecoveryOtp = async () => {
    if (!user || !otpChallengeToken) return;
    if (!/^\d{6}$/.test(otpInput.trim())) {
      setErrorMsg('Enter the 6-digit code sent to your email.');
      return;
    }
    setVerifyingOtp(true);
    setErrorMsg(null);
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/gateway/card-recovery/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          challengeToken: otpChallengeToken,
          otp: otpInput.trim()
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.recoveryAuthToken) {
        throw new Error(data?.error || 'Incorrect or expired Email OTP.');
      }
      setEmailOtpProofToken(data.recoveryAuthToken);
      addToast?.('Identity Verified', 'You can now assign a new 6-digit Card Payment Key.', 'success');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not verify Email OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleExecuteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!/^\d{6}$/.test(newKeyInput.trim())) {
      setErrorMsg('New Card Payment Key must be exactly 6 numeric digits.');
      return;
    }
    if (newKeyInput.trim() !== newKeyConfirm.trim()) {
      setErrorMsg('New Card Payment Key and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      const { newRawBackupKey } = await recoverCardPaymentKey(db, {
        uid: profile.uid,
        newSecretCode: newKeyInput.trim(),
        method: recoveryMethod,
        backupKey: recoveryMethod === 'backup_key' ? backupKeyInput.trim() : undefined,
        securityAnswer:
          recoveryMethod === 'security_question' ? securityAnswerInput.trim() : undefined,
        emailOtpProofToken:
          recoveryMethod === 'email_otp' ? emailOtpProofToken || undefined : undefined
      });
      setRevealedBackupKey(newRawBackupKey);
      resetRecoveryFlow();
      addToast?.(
        'Card Key Recovered',
        'New Payment Key is active and a fresh Master Recovery Key has been issued.',
        'success'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Key recovery verification failed.');
    } finally {
      setSaving(false);
    }
  };

  const canEnterRecoveredKey =
    (recoveryMethod === 'email_otp' && Boolean(emailOtpProofToken)) ||
    (recoveryMethod === 'backup_key' && backupKeyInput.trim().length >= 10) ||
    (recoveryMethod === 'security_question' && securityAnswerInput.trim().length >= 2);

  const isStrictLock = Boolean(mandatoryMode && !isKeyAlreadySet);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
      onClick={!isStrictLock && !revealedBackupKey ? onClose : undefined}
    >
      <div
        className="bg-[#0B132B] border border-[#1E3368] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 space-y-5 shadow-2xl text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isStrictLock
                  ? 'Set Your 6-Digit Card PIN'
                  : isKeyAlreadySet
                  ? 'Card Key Management & Recovery'
                  : 'Set Card Payment Key'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isStrictLock
                  ? 'Required once to activate your card and access your dashboard'
                  : isKeyAlreadySet
                  ? 'Locked 6-digit Payment Key · Card controls & smart recovery'
                  : 'Create your mandatory 6-digit Payment Key to activate your card'}
              </p>
            </div>
          </div>
          {isStrictLock ? (
            onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer shrink-0"
              >
                Sign Out
              </button>
            ) : null
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* One-Time Master Recovery Backup Key Banner (shown immediately after initial setup or recovery) */}
        {revealedBackupKey && (
          <div className="p-4 rounded-xl bg-emerald-500/12 border border-emerald-400/35 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Save Your One-Time Master Recovery Key</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Store this backup key somewhere safe. If you ever forget your 6-digit Payment Key, you can recover your card instantly with this code. It will not be shown again.
            </p>
            <div className="p-2.5 rounded-lg bg-[#070D1F] border border-white/10 flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-amber-300 tracking-wider tabular-nums">
                {revealedBackupKey}
              </span>
              <button
                type="button"
                onClick={() => handleCopyBackup(revealedBackupKey)}
                className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedBackup ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedBackup ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setRevealedBackupKey(null);
                if (enteredViaMandatoryGate) {
                  setEnteredViaMandatoryGate(false);
                  onClose();
                }
              }}
              className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              {enteredViaMandatoryGate
                ? 'I Have Saved My Recovery Key — Continue to Dashboard'
                : 'I Have Saved My Recovery Key'}
            </button>
          </div>
        )}

        {/* Live Card Credential Summary */}
        <div className="p-4 rounded-xl bg-[#070D1F] border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-400">Your T.U.T. Card Number</span>
            <span
              className={`font-semibold ${
                tutCard?.isFrozen
                  ? 'text-rose-400'
                  : isKeyAlreadySet
                  ? 'text-emerald-400'
                  : 'text-amber-300'
              }`}
            >
              {tutCard?.isFrozen ? 'Frozen' : isKeyAlreadySet ? 'Key Active' : 'Setup Required'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm sm:text-base font-bold text-white tracking-[0.14em] tabular-nums">
              {formatCardNumberDisplay(cardNumber, !showPan)}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowPan((p) => !p)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                title={showPan ? 'Mask Number' : 'Reveal Number'}
              >
                {showPan ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleCopyPan}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                {copiedPan ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPan ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">Valid Thru</span>
              <span className="font-mono tabular-nums font-bold text-slate-200">{expiryStr}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Vault Savings</span>
              <span className="font-mono tabular-nums font-bold text-emerald-300">
                ৳{(profile.totalDeposit || 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Per-Tx Cap</span>
              <span className="font-mono tabular-nums font-bold text-amber-300">
                ৳{(tutCard?.perTxLimit || perTxLimit).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* CASE 1: KEY NOT SET YET -> MANDATORY INITIAL SETUP                    */}
        {/* ===================================================================== */}
        {!isKeyAlreadySet ? (
          <form onSubmit={handleInitialActivation} className="space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Create 6-Digit Card Payment Key</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowCode((s) => !s)}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {showCode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showCode ? 'Hide' : 'Show'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type={showCode ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit Key"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070D1F] border border-white/10 text-white font-mono text-sm tracking-[0.25em] text-center focus:outline-none focus:border-amber-400/60"
                  required
                />
                <input
                  type={showCode ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Confirm Key"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070D1F] border border-white/10 text-white font-mono text-sm tracking-[0.25em] text-center focus:outline-none focus:border-amber-400/60"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                For security, once your Card Key is created it cannot be overwritten directly—only verified recovery methods can restore access.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white block">Per-Transaction Spend Cap (BDT)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[500, 2500, 10000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPerTxLimit(preset)}
                    className={`py-2 rounded-lg text-[11px] font-mono tabular-nums font-bold border transition-colors cursor-pointer ${
                      perTxLimit === preset
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                        : 'bg-[#070D1F] border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    ৳{preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Security Question for Smart Recovery */}
            <div className="p-3.5 rounded-xl bg-[#070D1F] border border-white/10 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>Smart Recovery Security Question (Optional)</span>
              </div>
              <select
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B132B] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-amber-400/60"
              >
                {PRESET_SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Your recovery answer (leave blank to skip)"
                className="w-full px-3 py-2 rounded-lg bg-[#0B132B] border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400/60"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              {!isStrictLock && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Close
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className={isStrictLock
                  ? 'w-full px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50'
                  : 'px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50'}
              >
                {saving
                  ? 'Activating PIN...'
                  : isStrictLock
                  ? 'Set PIN & Continue to App'
                  : 'Set Key & Activate Card'}
              </button>
            </div>
          </form>
        ) : !recoveryOpen ? (
          /* =================================================================== */
          /* CASE 2: KEY ALREADY SET -> CONTROLS + SMART RECOVERY ENTRY (NO RE-SET) */
          /* =================================================================== */
          <div className="space-y-4">
            {/* Key Locked Status & Smart Recovery Trigger */}
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Payment Key Active &amp; Locked</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Key cannot be directly overwritten. Forgot your key?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setRecoveryOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-amber-200 text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                <span>Recover Key</span>
              </button>
            </div>

            {/* Instant Freeze Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-white/10">
              <div className="flex items-center gap-2.5">
                {tutCard?.isFrozen ? (
                  <Lock className="w-4 h-4 text-rose-400" />
                ) : (
                  <Unlock className="w-4 h-4 text-emerald-400" />
                )}
                <div>
                  <div className="text-xs font-bold text-white">
                    {tutCard?.isFrozen ? 'Card Temporarily Frozen' : 'Card Online Payments Active'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Block or allow external card charges immediately
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={togglingFreeze}
                onClick={handleFreezeToggle}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  tutCard?.isFrozen
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300'
                }`}
              >
                {togglingFreeze ? 'Updating...' : tutCard?.isFrozen ? 'Unfreeze Card' : 'Freeze Card'}
              </button>
            </div>

            {/* Spend Limit Controls */}
            <form onSubmit={handleSaveSpendLimit} className="space-y-3">
              <label className="text-xs font-bold text-white block">Per-Transaction Spend Cap (BDT)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[500, 2500, 10000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPerTxLimit(preset)}
                    className={`py-2 rounded-lg text-[11px] font-mono tabular-nums font-bold border transition-colors cursor-pointer ${
                      perTxLimit === preset
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                        : 'bg-[#070D1F] border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    ৳{preset.toLocaleString()}
                  </button>
                ))}
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Update Spend Cap'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* =================================================================== */
          /* CASE 3: SMART KEY RECOVERY FLOW                                     */
          /* =================================================================== */
          <form onSubmit={handleExecuteRecovery} className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={resetRecoveryFlow}
                className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Card Controls</span>
              </button>
              <span className="text-[11px] text-amber-300 font-semibold">Smart Key Recovery</span>
            </div>

            {/* Method Picker */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#070D1F] border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setRecoveryMethod('email_otp');
                  setErrorMsg(null);
                }}
                className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  recoveryMethod === 'email_otp'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span>Email OTP</span>
              </button>
              <button
                type="button"
                disabled={!hasBackupKey}
                onClick={() => {
                  setRecoveryMethod('backup_key');
                  setErrorMsg(null);
                }}
                className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-40 ${
                  recoveryMethod === 'backup_key'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span>Backup Key</span>
              </button>
              <button
                type="button"
                disabled={!hasSecurityQuestion}
                onClick={() => {
                  setRecoveryMethod('security_question');
                  setErrorMsg(null);
                }}
                className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-40 ${
                  recoveryMethod === 'security_question'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Question</span>
              </button>
            </div>

            {/* Step 1: Verification per chosen Smart Recovery Method */}
            {recoveryMethod === 'email_otp' && (
              <div className="p-3.5 rounded-xl bg-[#070D1F] border border-white/10 space-y-3">
                {!emailOtpProofToken ? (
                  <>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Send a 6-digit one-time verification code to your registered account email ({user?.email || profile.email}).
                    </p>
                    {!otpChallengeToken ? (
                      <button
                        type="button"
                        disabled={sendingOtp}
                        onClick={handleSendRecoveryOtp}
                        className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                      >
                        {sendingOtp ? 'Sending Code...' : 'Send Recovery Code to Email'}
                      </button>
                    ) : (
                      <div className="space-y-2.5">
                        <p className="text-[11px] text-emerald-300">
                          Code sent to {otpMaskedEmail}. Enter it below:
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="6-digit OTP"
                            className="flex-1 px-3 py-2 rounded-lg bg-[#0B132B] border border-white/15 text-white font-mono text-sm text-center tracking-[0.25em]"
                          />
                          <button
                            type="button"
                            disabled={verifyingOtp}
                            onClick={handleVerifyRecoveryOtp}
                            className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            {verifyingOtp ? 'Checking...' : 'Verify'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Email OTP Verified — Choose your new 6-digit Payment Key below</span>
                  </div>
                )}
              </div>
            )}

            {recoveryMethod === 'backup_key' && (
              <div className="p-3.5 rounded-xl bg-[#070D1F] border border-white/10 space-y-2">
                <label className="text-xs font-bold text-slate-200 block">
                  Enter Saved Master Recovery Backup Key
                </label>
                <input
                  type="text"
                  value={backupKeyInput}
                  onChange={(e) => setBackupKeyInput(e.target.value.toUpperCase())}
                  placeholder="TUT-REC-XXXX-XXXX-XXXX"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B132B] border border-white/15 text-amber-300 font-mono text-xs tracking-wider focus:outline-none focus:border-amber-400/60"
                  required
                />
              </div>
            )}

            {recoveryMethod === 'security_question' && (
              <div className="p-3.5 rounded-xl bg-[#070D1F] border border-white/10 space-y-2">
                <span className="text-[11px] text-slate-400 block">Your Security Question</span>
                <p className="text-xs font-bold text-white">{tutCard?.securityQuestion}</p>
                <input
                  type="text"
                  value={securityAnswerInput}
                  onChange={(e) => setSecurityAnswerInput(e.target.value)}
                  placeholder="Enter your recovery answer"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B132B] border border-white/15 text-white text-xs focus:outline-none focus:border-amber-400/60"
                  required
                />
              </div>
            )}

            {/* Step 2: Set Replacement Key (only rendered once verification proof is supplied/verified) */}
            {canEnterRecoveredKey && (
              <div className="space-y-2.5 pt-1">
                <label className="text-xs font-bold text-white block">
                  Assign New 6-Digit Card Payment Key
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type={showCode ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={newKeyInput}
                    onChange={(e) => setNewKeyInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="New 6-digit Key"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#070D1F] border border-white/15 text-white font-mono text-sm tracking-[0.25em] text-center focus:outline-none focus:border-amber-400/60"
                    required
                  />
                  <input
                    type={showCode ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={newKeyConfirm}
                    onChange={(e) => setNewKeyConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Confirm New Key"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#070D1F] border border-white/15 text-white font-mono text-sm tracking-[0.25em] text-center focus:outline-none focus:border-amber-400/60"
                    required
                  />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {canEnterRecoveredKey && (
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Restoring Card Key...' : 'Verify & Reset Card Key'}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
