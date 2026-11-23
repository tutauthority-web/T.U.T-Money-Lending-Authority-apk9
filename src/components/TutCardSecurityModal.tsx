import React, { useState } from 'react';
import { Firestore } from 'firebase/firestore';
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
  ExternalLink
} from 'lucide-react';
import {
  TutPayCardRecord,
  deriveDeterministicCardNumber,
  formatCardNumberDisplay,
  normalizeExpiry,
  saveTutCardSecuritySetup,
  toggleTutCardFreeze,
  updateTutCardLimit
} from '../utils/tutPaymentEngine';
import { UserProfile } from '../App';

interface TutCardSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: Firestore;
  profile: UserProfile;
  tutCard: TutPayCardRecord | null;
  onLaunchPaymentTerminal?: () => void;
  addToast?: (title: string, msg: string, type: 'success' | 'warning' | 'danger' | 'info') => void;
}

export const TutCardSecurityModal: React.FC<TutCardSecurityModalProps> = ({
  isOpen,
  onClose,
  db,
  profile,
  tutCard,
  onLaunchPaymentTerminal,
  addToast
}) => {
  const [secretCode, setSecretCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [showPan, setShowPan] = useState(false);
  const [copiedPan, setCopiedPan] = useState(false);
  const [perTxLimit, setPerTxLimit] = useState<number>(() => tutCard?.perTxLimit || 50000);
  const [saving, setSaving] = useState(false);
  const [togglingFreeze, setTogglingFreeze] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const cardNumber =
    tutCard?.cardNumber || deriveDeterministicCardNumber(profile.uid, profile.memberId);
  const { month, year } = normalizeExpiry(profile.subscriptionExpiresAt);
  const expiryStr = tutCard?.expiryMonth && tutCard?.expiryYear
    ? `${tutCard.expiryMonth}/${tutCard.expiryYear}`
    : `${month}/${year}`;

  const handleCopyPan = () => {
    navigator.clipboard.writeText(cardNumber);
    setCopiedPan(true);
    setTimeout(() => setCopiedPan(false), 2000);
  };

  const handleSavePinAndLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!tutCard?.isActive || secretCode.length > 0) {
      if (!/^\d{6}$/.test(secretCode.trim())) {
        setErrorMsg('Secret Payment Code must be exactly 6 numeric digits.');
        return;
      }
      if (secretCode.trim() !== confirmCode.trim()) {
        setErrorMsg('Secret Code and confirmation do not match.');
        return;
      }
    }

    setSaving(true);
    try {
      if (!tutCard?.isActive || secretCode.length > 0) {
        await saveTutCardSecuritySetup(db, {
          uid: profile.uid,
          memberId: profile.memberId,
          secretCode: secretCode.trim(),
          perTxLimit,
          subscriptionExpiresAt: profile.subscriptionExpiresAt
        });
        addToast?.(
          'T.U.T. Card Activated',
          'Your 16-digit card & encrypted Secret Code are now active for app & merchant payments.',
          'success'
        );
      } else {
        await updateTutCardLimit(db, profile.uid, perTxLimit);
        addToast?.('Spend Cap Updated', `Card transaction limit set to ৳${perTxLimit.toLocaleString()}.`, 'success');
      }
      setSecretCode('');
      setConfirmCode('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not update card security settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleFreezeToggle = async () => {
    if (!tutCard?.isActive) return;
    setTogglingFreeze(true);
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0B132B] border border-[#1E3368] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 space-y-5 shadow-2xl text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">T.U.T. Card & Payment Security</h3>
              <p className="text-[11px] text-slate-400">
                Real Luhn 16-digit card & encrypted Secret Code for paying connected apps
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Card Credential Summary */}
        <div className="p-4 rounded-xl bg-[#070D1F] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Your T.U.T. Card Number
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                tutCard?.isFrozen
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : tutCard?.isActive
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}
            >
              {tutCard?.isFrozen ? 'Frozen' : tutCard?.isActive ? 'Payable Active' : 'Setup Required'}
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
              <span className="font-mono font-bold text-slate-200">{expiryStr}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Vault Wallet</span>
              <span className="font-mono font-bold text-emerald-300">
                ৳{(profile.totalDeposit || 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Per-Tx Cap</span>
              <span className="font-mono font-bold text-amber-300">
                ৳{(tutCard?.perTxLimit || perTxLimit).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Instant Freeze Toggle */}
        {tutCard?.isActive && (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-white/10">
            <div className="flex items-center gap-2.5">
              {tutCard.isFrozen ? (
                <Lock className="w-4 h-4 text-rose-400" />
              ) : (
                <Unlock className="w-4 h-4 text-emerald-400" />
              )}
              <div>
                <div className="text-xs font-bold text-white">
                  {tutCard.isFrozen ? 'Card Temporarily Frozen' : 'Card Online Payments Enabled'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Instant lock blocks new external card charges immediately
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={togglingFreeze}
              onClick={handleFreezeToggle}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                tutCard.isFrozen
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300'
              }`}
            >
              {togglingFreeze ? 'Updating...' : tutCard.isFrozen ? 'Unfreeze Card' : 'Freeze Card'}
            </button>
          </div>
        )}

        {/* Set / Rotate 6-Digit Secret Code & Spend Limit */}
        <form onSubmit={handleSavePinAndLimit} className="space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {tutCard?.isActive ? 'Rotate 6-Digit Secret Payment Code (Optional)' : 'Create 6-Digit Secret Payment Code *'}
                </span>
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
                placeholder="6-digit Secret Code"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070D1F] border border-white/10 text-white font-mono text-sm tracking-[0.25em] text-center focus:outline-none focus:border-amber-400/60"
                required={!tutCard?.isActive}
              />
              <input
                type={showCode ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Confirm Secret Code"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070D1F] border border-white/10 text-white font-mono text-sm tracking-[0.25em] text-center focus:outline-none focus:border-amber-400/60"
                required={!tutCard?.isActive}
              />
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Your Secret Code is salted & cryptographically hashed — never stored in readable form.</span>
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-white block">Per-Transaction Spend Limit (BDT)</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[500, 2500, 10000, 50000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPerTxLimit(preset)}
                  className={`py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
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

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
            {onLaunchPaymentTerminal && tutCard?.isActive && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLaunchPaymentTerminal();
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Pay Connected App</span>
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
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
                className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : tutCard?.isActive
                  ? 'Save Security Settings'
                  : 'Activate Payable Card'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
