import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ShieldCheck
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
  setGlobalError: (val: string | null) => void;
  externalAction?: string | null;
}

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

  // Clean up any legacy biometric / encoded password storage entries
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
        setValidationError('New member accounts require a @gmail.com address.');
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

  return (
    <div className="min-h-[calc(100vh-7.5rem)] flex items-center justify-center py-6 sm:py-10 px-2">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Private Banking Institutional Identity */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left px-1">
          <div className="inline-flex items-center gap-3.5 justify-center lg:justify-start">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0B1222] border border-[#DFC07C]/35 p-1 shadow-xl shrink-0 overflow-hidden">
              <img
                src={tutLogo}
                alt="T.U.T. Private Lending Authority"
                className="w-full h-full object-cover rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold text-[#DFC07C] tracking-[0.22em] uppercase">
                T.U.T. Reserve
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight text-balance">
                Private Lending Authority
              </h1>
            </div>
          </div>

          <div className="space-y-3 max-w-md mx-auto lg:mx-0">
            <div className="inline-flex items-center gap-2.5 text-sm sm:text-base font-semibold tracking-wide text-[#EAD39C]">
              <span>Trust</span>
              <span aria-hidden="true" className="text-[#DFC07C]/45">·</span>
              <span>Unity</span>
              <span aria-hidden="true" className="text-[#DFC07C]/45">·</span>
              <span>Technology</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-[2.15rem] font-bold text-white tracking-tight leading-[1.2] text-balance">
              Zero-usury banking built on clarity and member governance.
            </h2>
            {externalAction === 'loan' && (
              <p className="text-xs font-semibold text-blue-300 pt-1">
                Sign in with your member account to continue your loan request.
              </p>
            )}
          </div>

          {/* Crisp Architectural Pillars */}
          <div className="hidden sm:grid grid-cols-1 gap-3 max-w-md mx-auto lg:mx-0 pt-4 border-t border-white/[0.08] text-left">
            <div className="flex items-baseline justify-between gap-4 py-1">
              <span className="text-xs font-semibold text-[#EAD39C] w-24 shrink-0">Trust</span>
              <span className="text-xs text-slate-400 flex-1">
                1:1 segregated reserve ledgers with auditable receipts.
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-1 border-t border-white/[0.05]">
              <span className="text-xs font-semibold text-[#EAD39C] w-24 shrink-0">Unity</span>
              <span className="text-xs text-slate-400 flex-1">
                Member-backed cooperative liquidity with zero interest.
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-1 border-t border-white/[0.05]">
              <span className="text-xs font-semibold text-[#EAD39C] w-24 shrink-0">Technology</span>
              <span className="text-xs text-slate-400 flex-1">
                PIN-protected T.U.T. cards and verified Gmail access.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: High-Standard Banking Access Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="bg-[#0B1222] border border-white/[0.09] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
            {/* Clean Segmented Switch */}
            <div className="grid grid-cols-2 p-1 bg-[#070C18] border border-white/[0.06] rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setValidationError(null);
                  setGlobalError(null);
                  setAuthMode('login');
                }}
                className={localCn(
                  'py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                  authMode === 'login'
                    ? 'bg-[#131F3A] text-white border border-white/10 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setValidationError(null);
                  setGlobalError(null);
                  setAuthMode('signup');
                }}
                className={localCn(
                  'py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                  authMode === 'signup'
                    ? 'bg-[#131F3A] text-white border border-white/10 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                Create Account
              </button>
            </div>

            <div className="space-y-1 text-left">
              <h3 className="text-base font-bold text-white tracking-tight">
                {authMode === 'login' ? 'Member Access' : 'Open a Member Account'}
              </h3>
              <p className="text-xs text-slate-400">
                {authMode === 'login'
                  ? 'Sign in with Gmail or your registered credentials.'
                  : 'New accounts require an official @gmail.com address.'}
              </p>
            </div>

            {/* Primary Smart Gmail Button */}
            <button
              onClick={onGoogleClick}
              disabled={isLoggingIn}
              type="button"
              className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-slate-100 text-slate-900 py-3 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 5.04c1.61 0 3.06.55 4.2 1.64l3.15-3.15C17.45 1.68 14.9 1 12 1 7.35 1 3.4 3.65 1.55 7.5l3.65 2.85C6.1 7.15 8.8 5.04 12 5.04z" />
                <path fill="#4285F4" d="M23.5 12.25c0-.82-.07-1.61-.21-2.38H12v4.51h6.46c-.28 1.48-1.12 2.73-2.38 3.58l3.65 2.85c2.14-1.98 3.77-4.89 3.77-8.56z" />
                <path fill="#FBBC05" d="M5.2 14.65c-.25-.75-.4-1.55-.4-2.4s.15-1.65.4-2.4L1.55 7.5C.55 9.5 0 11.7 0 14s.55 4.5 1.55 6.5l3.65-2.85z" />
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.92l-3.65-2.85c-1.1.74-2.52 1.18-4.31 1.18-3.2 0-5.9-2.11-6.8-5.31L1.55 15.95C3.4 19.8 7.35 23 12 23z" />
              </svg>
              <span>{authMode === 'signup' ? 'Sign Up with Gmail' : 'Continue with Gmail'}</span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.08]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#0B1222] px-3 text-[11px] font-medium text-slate-500">
                  {authMode === 'signup' ? 'or register with @gmail.com' : 'or sign in with email'}
                </span>
              </div>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-start gap-2 text-rose-300 text-xs text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={onSubmitForm} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    {authMode === 'signup' ? 'Gmail Address' : 'Email Address'}
                  </label>
                  {authMode === 'signup' && (
                    <span className="text-[11px] text-[#DFC07C] font-medium">@gmail.com only</span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setValidationError(null);
                      setEmail(e.target.value);
                    }}
                    placeholder={authMode === 'signup' ? 'name@gmail.com' : 'you@gmail.com'}
                    className={localCn(
                      'w-full bg-[#070C18] border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none transition-colors placeholder:text-slate-600',
                      hasTypedNonGmailOnSignup
                        ? 'border-rose-500/50 focus:border-rose-400'
                        : 'border-white/10 focus:border-blue-500/60'
                    )}
                  />
                </div>
                {hasTypedNonGmailOnSignup && (
                  <p className="text-[11px] text-rose-400">
                    New sign-ups must end with @gmail.com.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-slate-300">Password</label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-[#070C18] border border-white/10 focus:border-blue-500/60 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white focus:outline-none transition-colors placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
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
                    className="space-y-1.5 overflow-hidden"
                  >
                    <label className="text-xs font-medium text-slate-300 block">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full bg-[#070C18] border border-white/10 focus:border-blue-500/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none transition-colors placeholder:text-slate-600"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {authMode === 'login' && (
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => handleRememberEmailChange(e.target.checked)}
                    className="rounded border-white/20 bg-[#070C18] text-blue-500 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs text-slate-400">Remember email</span>
                </label>
              )}

              <button
                type="submit"
                disabled={isLoggingIn || hasTypedNonGmailOnSignup}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {isLoggingIn ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>
                  {isLoggingIn
                    ? 'Signing in...'
                    : authMode === 'login'
                    ? 'Sign In'
                    : 'Create Gmail Account'}
                </span>
                {!isLoggingIn && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </form>

            <p className="text-[11px] text-slate-500 text-center pt-2 border-t border-white/[0.06]">
              T.U.T. Private Lending Authority · Trust, Unity &amp; Technology
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
