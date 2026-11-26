import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  UserRound,
  LogIn,
  UserPlus,
  X
} from 'lucide-react';

const localCn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export const isGmailAddress = (value: string): boolean => {
  const clean = value.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@gmail\.com$/.test(clean);
};

interface LoginProps {
  tutLogo: string;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  showPassword: boolean;
  setShowPassword: (val: boolean) => void;
  authMode: 'login' | 'signup';
  setAuthMode: (val: 'login' | 'signup') => void;
  handleEmailAuth: (e: React.FormEvent) => Promise<void>;
  handleLogin: (isRetry?: boolean) => Promise<void>;
  handleForgotPassword: () => Promise<void>;
  isLoggingIn: boolean;
  setIsLoggingIn: (val: boolean) => void;
  globalError?: string | null;
  setGlobalError: (val: string | null) => void;
  externalAction?: string | null;
}

/**
 * Custom architectural neo-classical bank facade & golden floor-wave SVG artwork.
 * Gives institutional marble depth on obsidian navy without generic stock clutter.
 */
const SovereignVaultBackdrop: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true">
    {/* Architectural Grid Texture */}
    <div className="absolute inset-0 vault-grid-pattern opacity-45" />

    {/* Top-Right Neo-Classical Reserve Facade Illustration */}
    <svg
      viewBox="0 0 800 540"
      className="absolute -top-6 right-[-12%] sm:right-0 w-[640px] sm:w-[780px] h-auto opacity-[0.28] sm:opacity-[0.34]"
      fill="none"
    >
      <defs>
        <linearGradient id="tutPillarGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5DC9B" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#B88930" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#091124" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="tutPedimentGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1B2A4D" stopOpacity="0.3" />
          <stop offset="55%" stopColor="#DFB459" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#091124" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="tutArchLight" cx="65%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#F3D998" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#1E3A7B" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#040814" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="520" cy="300" rx="340" ry="220" fill="url(#tutArchLight)" />

      {/* Classical Pediment Roof */}
      <polygon
        points="240,175 565,78 780,152 780,170 240,190"
        fill="#0D162C"
        stroke="url(#tutPedimentGlow)"
        strokeWidth="1.5"
      />
      <polygon
        points="275,172 560,94 760,154"
        fill="#070D1D"
        stroke="#DFC07C"
        strokeOpacity="0.28"
        strokeWidth="1"
      />
      {/* Entablature Beam */}
      <rect
        x="248"
        y="180"
        width="525"
        height="34"
        transform="rotate(-8 248 180)"
        fill="#0A1326"
        stroke="url(#tutPedimentGlow)"
        strokeWidth="1.2"
      />
      <text
        x="485"
        y="165"
        transform="rotate(-8 485 165)"
        fill="#EAD39C"
        fillOpacity="0.72"
        fontSize="21"
        fontFamily="Playfair Display, Georgia, serif"
        letterSpacing="8"
        fontWeight="700"
      >
        T.U.T.
      </text>

      {/* Fluted Columns */}
      {[305, 395, 488, 584, 678].map((xPos, idx) => (
        <g key={xPos} opacity={0.92 - idx * 0.06}>
          <rect
            x={xPos - 14}
            y={204 - idx * 10}
            width="36"
            height="12"
            rx="2"
            fill="#14213D"
            stroke="#DFC07C"
            strokeOpacity="0.35"
          />
          <rect
            x={xPos - 10}
            y={216 - idx * 10}
            width="28"
            height="215"
            fill="url(#tutPillarGold)"
            stroke="#DFC07C"
            strokeOpacity="0.2"
          />
          {/* Column Fluting */}
          <line x1={xPos - 2} y1={220 - idx * 10} x2={xPos - 2} y2={425 - idx * 10} stroke="#F6E3B0" strokeOpacity="0.28" strokeWidth="1" />
          <line x1={xPos + 6} y1={220 - idx * 10} x2={xPos + 6} y2={425 - idx * 10} stroke="#050914" strokeOpacity="0.45" strokeWidth="1.2" />
          <line x1={xPos + 12} y1={220 - idx * 10} x2={xPos + 12} y2={425 - idx * 10} stroke="#DFC07C" strokeOpacity="0.22" strokeWidth="1" />
          <rect
            x={xPos - 16}
            y={426 - idx * 10}
            width="40"
            height="14"
            rx="2"
            fill="#0F1B35"
            stroke="#DFC07C"
            strokeOpacity="0.3"
          />
        </g>
      ))}

      {/* Grand Marble Steps */}
      <path d="M180 465 L780 390 L780 412 L180 490 Z" fill="#0B1325" stroke="#DFC07C" strokeOpacity="0.2" />
      <path d="M160 490 L780 414 L780 438 L160 515 Z" fill="#080E1D" stroke="#DFC07C" strokeOpacity="0.16" />
      <path d="M140 515 L780 438 L780 468 L140 540 Z" fill="#050914" stroke="#DFC07C" strokeOpacity="0.12" />
    </svg>

    {/* Edge Vignette Mask Blending Artwork Seamlessly */}
    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(180deg, rgba(4,8,20,0.22) 0%, rgba(4,8,20,0.58) 44%, rgba(4,8,20,0.96) 76%, #040814 100%)',
      }}
    />

    {/* Sovereign Golden Horizon Wave Lines at Base */}
    <svg
      viewBox="0 0 1440 220"
      preserveAspectRatio="none"
      className="absolute bottom-0 inset-x-0 w-full h-28 sm:h-36 opacity-75"
      fill="none"
    >
      <defs>
        <linearGradient id="tutGoldWave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C49131" stopOpacity="0.05" />
          <stop offset="32%" stopColor="#EAD39C" stopOpacity="0.6" />
          <stop offset="68%" stopColor="#DFB459" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#94681C" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="tutGoldFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DFB459" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#040814" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M-40 165 C 260 65, 580 215, 960 128 C 1180 78, 1340 145, 1490 95 L 1490 220 L -40 220 Z"
        fill="url(#tutGoldFill)"
      />
      <path
        d="M-40 165 C 260 65, 580 215, 960 128 C 1180 78, 1340 145, 1490 95"
        stroke="url(#tutGoldWave)"
        strokeWidth="1.6"
      />
      <path
        d="M-40 185 C 310 105, 640 220, 1020 148 C 1230 108, 1360 172, 1490 126"
        stroke="url(#tutGoldWave)"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
    </svg>
  </div>
);

export const LoginPage: React.FC<LoginProps> = ({
  tutLogo,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  authMode,
  setAuthMode,
  handleEmailAuth,
  handleLogin,
  handleForgotPassword,
  isLoggingIn,
  globalError,
  setGlobalError,
  externalAction
}) => {
  const [rememberEmail, setRememberEmail] = useState(() => {
    try {
      return localStorage.getItem('tut_remember_me') === 'true';
    } catch {
      return false;
    }
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  // Ensure no legacy biometric / password storage keys remain
  useEffect(() => {
    try {
      localStorage.removeItem('tut_saved_password_encoded');
      localStorage.removeItem('tut_biometric_credential_id');
    } catch {}
  }, []);

  useEffect(() => {
    if (rememberEmail && authMode === 'login' && !email) {
      try {
        const savedEmail = localStorage.getItem('tut_saved_email');
        if (savedEmail) {
          setEmail(savedEmail);
        }
      } catch {}
    }
  }, [rememberEmail, authMode, email, setEmail]);

  const handleRememberEmailChange = (checked: boolean) => {
    setRememberEmail(checked);
    try {
      localStorage.setItem('tut_remember_me', checked.toString());
      if (!checked) {
        localStorage.removeItem('tut_saved_email');
      }
    } catch {}
  };

  const trimmedEmail = email.trim().toLowerCase();
  const hasTypedNonGmailOnSignup =
    authMode === 'signup' &&
    trimmedEmail.includes('@') &&
    !isGmailAddress(trimmedEmail);

  const onSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setGlobalError(null);

    if (!trimmedEmail) {
      setValidationError('Please enter your email address.');
      return;
    }

    if (authMode === 'signup') {
      if (!isGmailAddress(trimmedEmail)) {
        setValidationError('New member accounts must use an official @gmail.com address.');
        return;
      }
      if (password.length < 6) {
        setValidationError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setValidationError('Passwords do not match.');
        return;
      }
    }

    try {
      if (rememberEmail) {
        localStorage.setItem('tut_saved_email', trimmedEmail);
      }
    } catch {}

    await handleEmailAuth(e);
  };

  const onGoogleClick = async () => {
    setValidationError(null);
    setGlobalError(null);
    await handleLogin();
  };

  const activeError = validationError || globalError;

  return (
    <div className="relative min-h-screen w-full bg-vault-mesh flex flex-col justify-between overflow-x-hidden px-4 sm:px-6 py-5 sm:py-8">
      <SovereignVaultBackdrop />

      {/* Top Institutional Motifs Row */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-end">
        <div className="text-right">
          <p className="font-serif italic text-xs sm:text-sm tracking-wide text-[#EAD39C]">
            Trust <span className="text-[#DFC07C]/60 mx-1">·</span> Unity{' '}
            <span className="text-[#DFC07C]/60 mx-1">·</span> Technology
          </p>
          <div className="mt-1 h-[1.5px] w-full bg-gradient-to-l from-[#EAD39C]/80 via-[#DFC07C]/40 to-transparent rounded-full" />
        </div>
      </div>

      {/* Center Stage: Brand Identity + Sovereign Access Card */}
      <div className="relative z-10 w-full max-w-5xl mx-auto my-auto py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-12 items-center">
        {/* Brand Identity Header Column */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 space-y-4 sm:space-y-5 text-left"
        >
          {/* Real T.U.T. Emblem Shield */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-[2px] bg-gradient-to-br from-[#F7E3AC] via-[#C9973B] to-[#6E4D12] shadow-[0_12px_32px_rgba(223,192,124,0.22)] shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#060C1A] overflow-hidden flex items-center justify-center p-0.5">
                <img
                  src={tutLogo}
                  alt="T.U.T. Official Emblem"
                  className="w-full h-full object-cover rounded-[12px]"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-white leading-none">
                T.U.T.
              </h1>
              <p className="font-serif text-lg sm:text-xl lg:text-[1.45rem] font-semibold text-gold-gradient tracking-tight mt-1 leading-snug">
                Private Lending Authority
              </p>
            </div>
          </div>

          <div className="space-y-2.5 max-w-md">
            <p className="text-xs sm:text-sm font-medium text-slate-300/90 tracking-wide">
              Secure <span className="text-[#DFC07C]/70 mx-1">·</span> Smart{' '}
              <span className="text-[#DFC07C]/70 mx-1">·</span> Member-Governed
            </p>
            <div className="h-[1.5px] w-48 sm:w-56 bg-gradient-to-r from-[#EAD39C]/85 via-[#DFC07C]/35 to-transparent rounded-full" />

            {externalAction === 'loan' && (
              <p className="text-xs font-medium text-blue-300 pt-1">
                Sign in with your Gmail member account to continue your loan request.
              </p>
            )}
          </div>

          {/* Desktop-only Concise Governance Note */}
          <div className="hidden lg:grid grid-cols-3 gap-4 pt-4 border-t border-white/[0.08] max-w-md text-left">
            <div>
              <p className="text-[11px] font-semibold text-[#EAD39C]">Zero Usury</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">1:1 member reserve</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#EAD39C]">PIN Card Vault</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Hardware-grade key lock</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#EAD39C]">Gmail Verified</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Direct account audit</p>
            </div>
          </div>
        </motion.div>

        {/* Sovereign Access Card Column */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 w-full max-w-[430px] mx-auto lg:ml-auto lg:mr-0"
        >
          <div className="gold-rim-card backdrop-blur-xl rounded-[26px] p-5 sm:p-7 space-y-4">
            {/* Segmented Mode Switch */}
            <div className="relative grid grid-cols-2 p-1 bg-[#050A17]/90 border border-white/[0.07] rounded-xl">
              {(['login', 'signup'] as const).map((modeOption) => {
                const isActive = authMode === modeOption;
                return (
                  <button
                    key={modeOption}
                    type="button"
                    onClick={() => {
                      setValidationError(null);
                      setGlobalError(null);
                      setAuthMode(modeOption);
                    }}
                    className={localCn(
                      'relative py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer z-10 whitespace-nowrap',
                      isActive ? 'text-[#EAD39C]' : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="loginModePill"
                        transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                        className="absolute inset-0 bg-[#121D36] border border-[#DFC07C]/30 rounded-lg -z-10 shadow-sm"
                      />
                    )}
                    {modeOption === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                );
              })}
            </div>

            {/* Card Header Badge */}
            <div className="flex items-center gap-3.5 pt-0.5 text-left">
              <div className="w-11 h-11 rounded-full bg-gradient-to-b from-[#251E12] to-[#0D1426] border border-[#DFC07C]/45 flex items-center justify-center text-[#EAD39C] shadow-[0_0_20px_rgba(223,192,124,0.16)] shrink-0">
                {authMode === 'login' ? (
                  <UserRound className="w-5 h-5" />
                ) : (
                  <UserPlus className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
                  {authMode === 'login' ? 'Welcome Back' : 'New Member Account'}
                </h2>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {authMode === 'login'
                    ? 'Sign in to continue with T.U.T. PLA'
                    : 'Sign up using an official @gmail.com account'}
                </p>
              </div>
            </div>

            {/* Error Notice */}
            <AnimatePresence initial={false}>
              {activeError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start justify-between gap-2 text-rose-300 text-xs text-left"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{activeError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setValidationError(null);
                      setGlobalError(null);
                    }}
                    className="text-rose-300/70 hover:text-rose-200 cursor-pointer shrink-0"
                    aria-label="Dismiss error"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form Fields */}
            <form onSubmit={onSubmitForm} className="space-y-3.5 text-left">
              <div className="space-y-1">
                {authMode === 'signup' && (
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-medium text-slate-400">Gmail Registration</span>
                    <span className="text-[11px] font-semibold text-[#EAD39C]">@gmail.com only</span>
                  </div>
                )}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setValidationError(null);
                      setGlobalError(null);
                      setEmail(e.target.value);
                    }}
                    placeholder={authMode === 'signup' ? 'yourname@gmail.com' : 'Email Address'}
                    className={localCn(
                      'w-full bg-[#091021]/90 border rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none transition-colors placeholder:text-slate-500',
                      hasTypedNonGmailOnSignup
                        ? 'border-rose-500/55 focus:border-rose-400'
                        : 'border-white/[0.11] focus:border-[#DFC07C]/65'
                    )}
                  />
                </div>
                {hasTypedNonGmailOnSignup && (
                  <p className="text-[11px] text-rose-400 px-0.5">
                    New sign-ups require a @gmail.com address.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setValidationError(null);
                      setGlobalError(null);
                      setPassword(e.target.value);
                    }}
                    placeholder="Password"
                    className="w-full bg-[#091021]/90 border border-white/[0.11] focus:border-[#DFC07C]/65 rounded-xl pl-10 pr-10 py-3 text-sm text-white focus:outline-none transition-colors placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {authMode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="relative pt-0.5">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm Password"
                        className="w-full bg-[#091021]/90 border border-white/[0.11] focus:border-[#DFC07C]/65 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none transition-colors placeholder:text-slate-500"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {authMode === 'login' && (
                <div className="flex items-center justify-between pt-0.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(e) => handleRememberEmailChange(e.target.checked)}
                      className="rounded border-[#DFC07C]/40 bg-[#091021] text-[#DFB459] accent-[#DFB459] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-slate-300 font-medium">Remember Me</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[#EAD39C] hover:text-[#FFF2CC] font-medium cursor-pointer transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn || hasTypedNonGmailOnSignup}
                className="w-full py-3.5 px-4 rounded-xl gold-cta-gradient text-[#090E1A] text-sm font-bold tracking-tight transition-all active:scale-[0.985] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap mt-1"
              >
                {isLoggingIn ? (
                  <div className="w-4 h-4 border-2 border-[#090E1A] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4 stroke-[2.25]" />
                )}
                <span>
                  {isLoggingIn
                    ? 'Authenticating...'
                    : authMode === 'login'
                    ? 'Login'
                    : 'Create Gmail Account'}
                </span>
              </button>
            </form>

            {/* Divider */}
            <div className="relative py-0.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.08]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#0B1224] px-3 text-[11px] font-medium text-slate-400">
                  or continue with
                </span>
              </div>
            </div>

            {/* Smart Single Gmail OAuth Button (Only @gmail.com accepted for new accounts) */}
            <button
              onClick={onGoogleClick}
              disabled={isLoggingIn}
              type="button"
              className="w-full flex items-center justify-center gap-2.5 bg-[#080F1E] hover:bg-[#101A33] border border-white/[0.12] hover:border-[#DFC07C]/40 text-white py-3 px-4 rounded-xl text-xs font-semibold transition-all active:scale-[0.985] cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 5.04c1.61 0 3.06.55 4.2 1.64l3.15-3.15C17.45 1.68 14.9 1 12 1 7.35 1 3.4 3.65 1.55 7.5l3.65 2.85C6.1 7.15 8.8 5.04 12 5.04z" />
                <path fill="#4285F4" d="M23.5 12.25c0-.82-.07-1.61-.21-2.38H12v4.51h6.46c-.28 1.48-1.12 2.73-2.38 3.58l3.65 2.85c2.14-1.98 3.77-4.89 3.77-8.56z" />
                <path fill="#FBBC05" d="M5.2 14.65c-.25-.75-.4-1.55-.4-2.4s.15-1.65.4-2.4L1.55 7.5C.55 9.5 0 11.7 0 14s.55 4.5 1.55 6.5l3.65-2.85z" />
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.92l-3.65-2.85c-1.1.74-2.52 1.18-4.31 1.18-3.2 0-5.9-2.11-6.8-5.31L1.55 15.95C3.4 19.8 7.35 23 12 23z" />
              </svg>
              <span>{authMode === 'signup' ? 'Sign Up with Gmail' : 'Continue with Gmail'}</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Bottom Security Guarantee & Footer */}
      <div className="relative z-10 w-full max-w-[430px] lg:max-w-5xl mx-auto pt-3 space-y-3">
        <div className="max-w-[430px] mx-auto lg:ml-auto lg:mr-0 px-4 py-3 rounded-2xl bg-[#080F1E]/90 border border-white/[0.09] backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 leading-snug text-left">
              Your information is always secure with T.U.T.
            </p>
          </div>
          <Lock className="w-4 h-4 text-[#DFC07C] shrink-0" />
        </div>

        <div className="flex items-center justify-center gap-3 text-[11px] text-[#EAD39C]/80 font-medium">
          <span className="h-px w-10 sm:w-16 bg-gradient-to-r from-transparent to-[#DFC07C]/40" />
          <span>T.U.T. Group of Services</span>
          <span className="h-px w-10 sm:w-16 bg-gradient-to-l from-transparent to-[#DFC07C]/40" />
        </div>
      </div>
    </div>
  );
};
