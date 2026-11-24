/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useId, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import tutLogo from '../assets/images/tut_logo_1783437312744.jpg';
import { TierEmblem } from './TierEmblems';
import { TutPayCardRecord, deriveDeterministicCardNumber, formatCardNumberDisplay } from '../utils/tutPaymentEngine';

export type TierType = 'gold' | 'silver' | 'bronze' | 'standard' | null;

interface BankingTierCardProps {
  tier?: TierType;
  status?: string | null;
  name: string;
  memberId?: string | null;
  memberUid?: string | null;
  totalDeposit: number;
  remainingDebt: number;
  subscriptionExpiresAt?: string | null;
  tutCard?: TutPayCardRecord | null;
  onCardClick?: () => void;
  onManageSecurity?: () => void;
  showDetailsToggle?: boolean;
  className?: string;
  isCompact?: boolean;
  borrowLimit?: number;
  isPackageCard?: boolean;
  hideBalances?: boolean;
}

interface TierMaterialTheme {
  surfaceStyle: React.CSSProperties;
  topRimGradient: string;
  borderClass: string;
  ambientRadial: string;
  spotlightColor: string;
  etchColor: string;
  etchOpacity: number;
  grainOpacity: number;
  tierLabel: string;
  tierLabelColor: string;
  kickerColor: string;
  labelColor: string;
  primaryBalanceColor: string;
  debtBalanceColor: string;
  limitAccentColor: string;
  currencyColor: string;
  cardNumberColor: string;
  chipFrameStyle: React.CSSProperties;
  chipStroke: string;
  dualityLeft: string;
  dualityRight: string;
  contactlessColor: string;
}

export const BankingTierCard: React.FC<BankingTierCardProps> = ({
  tier = 'standard',
  status = 'active',
  name,
  memberId,
  memberUid,
  totalDeposit,
  remainingDebt,
  subscriptionExpiresAt,
  tutCard,
  onCardClick,
  onManageSecurity,
  showDetailsToggle = true,
  className = '',
  borrowLimit,
  isPackageCard = false,
  hideBalances = false
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealFullPan, setRevealFullPan] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number; active: boolean }>({
    x: 72,
    y: 28,
    active: false,
  });

  const uid = useId().replace(/:/g, '');
  const brushPatternId = `brush-${uid}`;
  const dotMatrixId = `dots-${uid}`;
  const waveGradId = `wave-${uid}`;

  const effectiveTier: 'gold' | 'silver' | 'bronze' | 'standard' =
    status === 'active' && (tier === 'gold' || tier === 'silver' || tier === 'bronze')
      ? tier
      : tier === 'gold' || tier === 'silver' || tier === 'bronze'
        ? tier
        : 'standard';

  const cardNumberRaw =
    tutCard?.cardNumber ||
    deriveDeterministicCardNumber(memberUid || memberId || 'tut-member', memberId || undefined);

  const handleCopyAccount = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cardNumberRaw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setPointer({ x, y, active: true });
  };

  const handleMouseLeave = () => {
    setPointer((prev) => ({ ...prev, active: false }));
  };

  const expiryDisplay = tutCard?.expiryMonth && tutCard?.expiryYear
    ? `${tutCard.expiryMonth} / ${tutCard.expiryYear}`
    : subscriptionExpiresAt
      ? format(new Date(subscriptionExpiresAt), 'MM / yy')
      : '12 / 28';

  // Institutional Metallic Card Themes
  const tierThemes: Record<'gold' | 'silver' | 'bronze' | 'standard', TierMaterialTheme> = {
    // 18K Satin Champagne Bullion & Smoked Carbon (Private Banking Flagship)
    gold: {
      surfaceStyle: {
        background:
          'linear-gradient(132deg, #161410 0%, #242018 36%, #2F281C 62%, #17140F 100%)',
        boxShadow:
          '0 18px 40px -12px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(218, 188, 126, 0.34), inset 0 1px 0 rgba(246, 232, 198, 0.38)',
      },
      topRimGradient: 'linear-gradient(90deg, transparent 8%, rgba(236, 214, 162, 0.55) 50%, transparent 92%)',
      borderClass: 'border-[#D4B46E]/35',
      ambientRadial:
        'radial-gradient(ellipse 75% 65% at 85% 15%, rgba(214, 180, 110, 0.22) 0%, rgba(168, 134, 68, 0.06) 45%, transparent 75%)',
      spotlightColor: 'rgba(240, 219, 170, 0.16)',
      etchColor: '#DEC07C',
      etchOpacity: 0.14,
      grainOpacity: 0.055,
      tierLabel: 'SOVEREIGN GOLD',
      tierLabelColor: 'text-[#EAD39C]',
      kickerColor: 'text-[#C8A65E]',
      labelColor: 'text-[#D6C59E]/55',
      primaryBalanceColor: 'text-[#FBF7EE]',
      debtBalanceColor: 'text-[#F4A9A8]',
      limitAccentColor: 'text-[#EAD39C]',
      currencyColor: 'text-[#C8A65E]',
      cardNumberColor: 'text-[#F6EDD9]',
      chipFrameStyle: {
        background: 'linear-gradient(135deg, #F5E6C4 0%, #DFC07C 48%, #9F7C39 100%)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), 0 1px 3px rgba(0,0,0,0.45)',
      },
      chipStroke: 'rgba(54, 41, 14, 0.45)',
      dualityLeft: 'linear-gradient(135deg, rgba(234,211,156,0.85), rgba(176,139,66,0.65))',
      dualityRight: 'linear-gradient(135deg, rgba(245,235,212,0.45), rgba(140,109,50,0.55))',
      contactlessColor: 'text-[#DFC07C]/75',
    },

    // Forged Brushed Rhodium & Palladium Titanium
    silver: {
      surfaceStyle: {
        background:
          'linear-gradient(134deg, #121720 0%, #1F2837 42%, #293548 64%, #10151E 100%)',
        boxShadow:
          '0 18px 40px -12px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(203, 213, 225, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.34)',
      },
      topRimGradient: 'linear-gradient(90deg, transparent 8%, rgba(226, 232, 240, 0.48) 50%, transparent 92%)',
      borderClass: 'border-slate-300/30',
      ambientRadial:
        'radial-gradient(ellipse 75% 65% at 85% 15%, rgba(203, 213, 225, 0.16) 0%, rgba(148, 163, 184, 0.05) 45%, transparent 75%)',
      spotlightColor: 'rgba(241, 245, 249, 0.14)',
      etchColor: '#CBD5E1',
      etchOpacity: 0.12,
      grainOpacity: 0.055,
      tierLabel: 'EXECUTIVE SILVER',
      tierLabelColor: 'text-slate-200',
      kickerColor: 'text-slate-300/80',
      labelColor: 'text-slate-300/55',
      primaryBalanceColor: 'text-slate-50',
      debtBalanceColor: 'text-rose-300',
      limitAccentColor: 'text-slate-100',
      currencyColor: 'text-slate-400',
      cardNumberColor: 'text-slate-100',
      chipFrameStyle: {
        background: 'linear-gradient(135deg, #F8FAFC 0%, #CBD5E1 52%, #7C8B9E 100%)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.4)',
      },
      chipStroke: 'rgba(30, 41, 59, 0.42)',
      dualityLeft: 'linear-gradient(135deg, rgba(226,232,240,0.82), rgba(100,116,139,0.65))',
      dualityRight: 'linear-gradient(135deg, rgba(248,250,252,0.45), rgba(71,85,105,0.55))',
      contactlessColor: 'text-slate-300/75',
    },

    // Burnished Espresso Copper & Satin Bronze
    bronze: {
      surfaceStyle: {
        background:
          'linear-gradient(134deg, #16100E 0%, #231915 44%, #2B1E18 65%, #110C0A 100%)',
        boxShadow:
          '0 18px 40px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(211, 157, 115, 0.28), inset 0 1px 0 rgba(242, 210, 184, 0.26)',
      },
      topRimGradient: 'linear-gradient(90deg, transparent 8%, rgba(224, 180, 140, 0.42) 50%, transparent 92%)',
      borderClass: 'border-[#C89468]/30',
      ambientRadial:
        'radial-gradient(ellipse 75% 65% at 85% 15%, rgba(200, 144, 102, 0.17) 0%, rgba(135, 82, 46, 0.05) 45%, transparent 75%)',
      spotlightColor: 'rgba(234, 194, 160, 0.13)',
      etchColor: '#D39D73',
      etchOpacity: 0.11,
      grainOpacity: 0.05,
      tierLabel: 'BRONZE RESERVE',
      tierLabelColor: 'text-[#E6BFA0]',
      kickerColor: 'text-[#C89468]',
      labelColor: 'text-[#D6B89F]/50',
      primaryBalanceColor: 'text-[#FAF3ED]',
      debtBalanceColor: 'text-rose-300',
      limitAccentColor: 'text-[#E6BFA0]',
      currencyColor: 'text-[#C89468]',
      cardNumberColor: 'text-[#F5E7DA]',
      chipFrameStyle: {
        background: 'linear-gradient(135deg, #F5DEC9 0%, #CFA07A 52%, #8A5836 100%)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 1px 3px rgba(0,0,0,0.45)',
      },
      chipStroke: 'rgba(62, 34, 16, 0.44)',
      dualityLeft: 'linear-gradient(135deg, rgba(211,157,115,0.82), rgba(135,82,46,0.65))',
      dualityRight: 'linear-gradient(135deg, rgba(242,210,184,0.42), rgba(109,65,35,0.55))',
      contactlessColor: 'text-[#D39D73]/75',
    },

    // Deep Cobalt Obsidian (Private Bank Entry Account)
    standard: {
      surfaceStyle: {
        background:
          'linear-gradient(134deg, #09101E 0%, #101C34 46%, #142342 68%, #070B15 100%)',
        boxShadow:
          '0 18px 40px -12px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(148, 163, 184, 0.22), inset 0 1px 0 rgba(191, 219, 254, 0.22)',
      },
      topRimGradient: 'linear-gradient(90deg, transparent 8%, rgba(147, 197, 253, 0.35) 50%, transparent 92%)',
      borderClass: 'border-slate-500/25',
      ambientRadial:
        'radial-gradient(ellipse 75% 65% at 85% 15%, rgba(59, 130, 246, 0.14) 0%, rgba(30, 58, 138, 0.04) 45%, transparent 75%)',
      spotlightColor: 'rgba(147, 197, 253, 0.12)',
      etchColor: '#7AA7F8',
      etchOpacity: 0.1,
      grainOpacity: 0.045,
      tierLabel: 'STANDARD RESERVE',
      tierLabelColor: 'text-blue-200',
      kickerColor: 'text-blue-300/75',
      labelColor: 'text-slate-400/70',
      primaryBalanceColor: 'text-white',
      debtBalanceColor: 'text-rose-300',
      limitAccentColor: 'text-emerald-300',
      currencyColor: 'text-blue-300/80',
      cardNumberColor: 'text-slate-100',
      chipFrameStyle: {
        background: 'linear-gradient(135deg, #E2E8F0 0%, #94A3B8 52%, #64748B 100%)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 1px 3px rgba(0,0,0,0.45)',
      },
      chipStroke: 'rgba(15, 23, 42, 0.45)',
      dualityLeft: 'linear-gradient(135deg, rgba(96,165,250,0.75), rgba(37,99,235,0.6))',
      dualityRight: 'linear-gradient(135deg, rgba(191,219,254,0.45), rgba(30,64,175,0.55))',
      contactlessColor: 'text-blue-300/65',
    },
  };

  const theme = tierThemes[effectiveTier];

  return (
    <div className={`w-full select-none ${className}`}>
      <div
        onClick={() => {
          if (onCardClick) onCardClick();
          else if (showDetailsToggle) setIsFlipped(!isFlipped);
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative overflow-hidden rounded-[20px] text-white border ${theme.borderClass} group aspect-[1.586/1] w-full mx-auto flex flex-col justify-between p-4 sm:p-5 cursor-pointer transition-transform duration-300 hover:scale-[1.008]`}
        style={{ ...theme.surfaceStyle, perspective: 1200 }}
      >
        {/* Top Precision Metallic Chamfer Catchlight */}
        <div
          className="pointer-events-none absolute top-0 inset-x-0 h-px"
          style={{ background: theme.topRimGradient }}
        />

        {/* Ambient Metallic Radial Finish */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: theme.ambientRadial }}
        />

        {/* Interactive Cursor-Tracking Satin Light Reflection */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: pointer.active ? 1 : 0,
            background: `radial-gradient(circle 220px at ${pointer.x}% ${pointer.y}%, ${theme.spotlightColor} 0%, transparent 72%)`,
          }}
        />

        {/* Machined Anisotropic Brushed Foil + Topographic Guilloche Security Engraving */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 400 252"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Fine Anisotropic Brushed Grain */}
            <pattern id={brushPatternId} width="120" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
              <line x1="0" y1="0.8" x2="120" y2="0.8" stroke="#FFFFFF" strokeWidth="0.45" opacity={theme.grainOpacity} />
              <line x1="0" y1="2.4" x2="120" y2="2.4" stroke="#000000" strokeWidth="0.35" opacity={theme.grainOpacity * 0.8} />
            </pattern>

            {/* Micro-Etched Security Dot Matrix */}
            <pattern id={dotMatrixId} width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="0.35" fill={theme.etchColor} opacity={theme.etchOpacity * 0.55} />
            </pattern>

            <linearGradient id={waveGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.etchColor} stopOpacity="0" />
              <stop offset="45%" stopColor={theme.etchColor} stopOpacity={theme.etchOpacity * 1.4} />
              <stop offset="100%" stopColor={theme.etchColor} stopOpacity="0.04" />
            </linearGradient>
          </defs>

          <rect width="400" height="252" fill={`url(#${brushPatternId})`} />
          <rect width="400" height="252" fill={`url(#${dotMatrixId})`} />

          {/* Sweeping Architectural Banking Contour Guilloche */}
          <g fill="none" stroke={`url(#${waveGradId})`}>
            <path d="M 150 265 C 215 190, 275 140, 420 115" strokeWidth="0.65" />
            <path d="M 172 265 C 232 198, 290 150, 420 130" strokeWidth="0.6" />
            <path d="M 194 265 C 249 206, 305 162, 420 146" strokeWidth="0.55" />
            <path d="M 216 265 C 266 214, 320 174, 420 162" strokeWidth="0.5" />
            <path d="M 238 265 C 283 222, 335 186, 420 178" strokeWidth="0.45" />
            <path d="M 260 265 C 300 230, 350 198, 420 194" strokeWidth="0.45" />
            <path d="M -20 18 C 85 52, 165 -10, 285 26" strokeWidth="0.45" opacity="0.5" />
          </g>

          {/* Subtle Inner Hairline Framing */}
          <rect
            x="9"
            y="9"
            width="382"
            height="234"
            rx="13"
            fill="none"
            stroke={theme.etchColor}
            strokeWidth="0.45"
            opacity={theme.etchOpacity * 0.9}
          />
        </svg>

        <AnimatePresence mode="wait">
          {!isFlipped ? (
            isPackageCard ? (
              <motion.div
                key="card-package-front"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative z-10 flex flex-col justify-between h-full w-full"
              >
                {/* Top: Brand Lockup & Unboxed Metallic Tier Moniker */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden bg-slate-950 border border-white/15 flex-shrink-0">
                      <img src={tutLogo} alt="T.U.T. Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <p className="text-[12px] sm:text-[13px] font-black tracking-[0.18em] text-white leading-none uppercase">
                        T.U.T.
                      </p>
                      <p className={`text-[8px] font-semibold tracking-[0.18em] uppercase leading-tight mt-1 ${theme.kickerColor}`}>
                        PRIVATE RESERVE
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-0.5">
                    <TierEmblem tier={effectiveTier} size={15} />
                    <span className={`text-[10px] font-bold tracking-[0.14em] uppercase ${theme.tierLabelColor}`}>
                      {theme.tierLabel}
                    </span>
                  </div>
                </div>

                {/* Middle: Milled ISO EMV Chip & Contactless */}
                <div className="flex items-center justify-between my-auto pt-1">
                  <div
                    className="w-9 h-7 rounded-[5px] relative overflow-hidden flex-shrink-0 border border-white/20"
                    style={theme.chipFrameStyle}
                  >
                    <svg className="w-full h-full" viewBox="0 0 36 28" fill="none">
                      <rect x="0.8" y="0.8" width="34.4" height="26.4" rx="4" stroke={theme.chipStroke} strokeWidth="0.7" />
                      <path d="M12 1V27 M24 1V27 M1 9.5H12 M1 18.5H12 M24 9.5H35 M24 18.5H35 M12 14H24" stroke={theme.chipStroke} strokeWidth="0.75" />
                      <rect x="14.5" y="10" width="7" height="8" rx="1.5" stroke={theme.chipStroke} strokeWidth="0.7" fill="none" />
                    </svg>
                  </div>

                  <svg className={`w-4 h-4 rotate-90 ${theme.contactlessColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 2a10 10 0 0 1 10 10" />
                    <path d="M12 6a6 6 0 0 1 6 6" />
                    <path d="M12 10a2 2 0 0 1 2 2" />
                  </svg>
                </div>

                {/* Bottom: Clean Borrow Cap & Metallic Seal */}
                <div className="flex items-end justify-between pt-1">
                  <div>
                    <p className={`text-[9px] font-semibold uppercase tracking-[0.16em] mb-1 ${theme.labelColor}`}>
                      Authorized Borrowing Limit
                    </p>
                    <div className={`text-xl sm:text-2xl font-black tracking-tight flex items-baseline font-mono tabular-nums leading-none ${theme.primaryBalanceColor}`}>
                      <span className={`text-base font-bold mr-1 ${theme.currencyColor}`}>৳</span>
                      <span>{hideBalances ? '•••••' : (borrowLimit || (effectiveTier === 'gold' ? 2500 : effectiveTier === 'silver' ? 1500 : 500)).toLocaleString()}</span>
                      <span className={`text-[10.5px] font-medium ml-1.5 ${theme.labelColor}`}>BDT</span>
                    </div>
                  </div>

                  <div className="flex -space-x-2 items-center pb-0.5 shrink-0">
                    <div className="w-5 h-5 rounded-full border border-white/15" style={{ background: theme.dualityLeft }} />
                    <div className="w-5 h-5 rounded-full border border-white/15 backdrop-blur-xs" style={{ background: theme.dualityRight }} />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="card-front"
                initial={{ opacity: 0, rotateY: -8 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: 8 }}
                transition={{ duration: 0.22 }}
                className="relative z-10 flex flex-col justify-between h-full w-full"
              >
                {/* TOP ROW: Authority Brand, Tier Emblem & Contactless + CVV Flip */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-950 border border-white/15 flex-shrink-0">
                      <img src={tutLogo} alt="T.U.T. Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black tracking-[0.18em] text-white leading-none uppercase">T.U.T.</span>
                        <span aria-hidden="true" className="text-white/25 text-[10px]">·</span>
                        <TierEmblem tier={effectiveTier} size={13} />
                        <span className={`text-[9.5px] font-bold tracking-[0.12em] uppercase truncate ${theme.tierLabelColor}`}>
                          {theme.tierLabel}
                        </span>
                      </div>
                      <p className={`text-[8px] font-semibold tracking-[0.16em] uppercase leading-none mt-1 ${theme.kickerColor}`}>
                        Private Lending Authority
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <svg className={`w-3.5 h-3.5 rotate-90 ${theme.contactlessColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M12 2a10 10 0 0 1 10 10" />
                      <path d="M12 6a6 6 0 0 1 6 6" />
                      <path d="M12 10a2 2 0 0 1 2 2" />
                    </svg>

                    {showDetailsToggle && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsFlipped(true);
                        }}
                        className="py-1 px-2 rounded-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-300 hover:text-white transition-colors text-[9px] flex items-center gap-1 cursor-pointer"
                        title="Card Security & Controls"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span className="hidden sm:inline font-mono">
                          {tutCard?.isFrozen ? 'FROZEN' : tutCard?.isActive ? 'READY' : 'PIN'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* MIDDLE ROW: ISO EMV Chip & Tabular Ledger Balances */}
                <div className="grid grid-cols-12 gap-3 items-center my-auto py-1">
                  <div className="col-span-3">
                    <div
                      className="w-10 h-7 rounded-[5px] relative overflow-hidden flex-shrink-0 border border-white/20"
                      style={theme.chipFrameStyle}
                    >
                      <svg className="w-full h-full" viewBox="0 0 36 28" fill="none">
                        <rect x="0.8" y="0.8" width="34.4" height="26.4" rx="4" stroke={theme.chipStroke} strokeWidth="0.7" />
                        <path d="M12 1V27 M24 1V27 M1 9.5H12 M1 18.5H12 M24 9.5H35 M24 18.5H35 M12 14H24" stroke={theme.chipStroke} strokeWidth="0.75" />
                        <rect x="14.5" y="10" width="7" height="8" rx="1.5" stroke={theme.chipStroke} strokeWidth="0.7" fill="none" />
                      </svg>
                    </div>
                  </div>

                  {borrowLimit !== undefined ? (
                    <div className="col-span-9 flex items-center justify-between border-l border-white/10 pl-3.5">
                      <div>
                        <p className={`text-[8.5px] font-semibold uppercase tracking-[0.14em] mb-0.5 ${theme.labelColor}`}>
                          Max Borrow Limit
                        </p>
                        <p className={`text-base sm:text-xl font-black tracking-tight flex items-baseline leading-none font-mono tabular-nums ${theme.limitAccentColor}`}>
                          <span className={`text-xs font-semibold mr-0.5 ${theme.currencyColor}`}>৳</span>
                          {hideBalances ? '•••••' : borrowLimit.toLocaleString()}
                          <span className={`text-[10px] font-normal ml-1 ${theme.labelColor}`}>BDT</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-bold tracking-[0.12em] uppercase block ${theme.tierLabelColor}`}>
                          0% Usury
                        </span>
                        <span className={`text-[8.5px] font-mono ${theme.labelColor}`}>Perpetual</span>
                      </div>
                    </div>
                  ) : (
                    <div className="col-span-9 grid grid-cols-2 gap-3 border-l border-white/10 pl-3.5">
                      <div>
                        <p className={`text-[8.5px] font-semibold uppercase tracking-[0.12em] mb-0.5 ${theme.labelColor}`}>
                          Vault Savings
                        </p>
                        <p className={`text-sm sm:text-lg font-black tracking-tight flex items-baseline leading-none font-mono tabular-nums ${theme.primaryBalanceColor}`}>
                          <span className={`text-xs font-semibold mr-0.5 ${theme.currencyColor}`}>৳</span>
                          {hideBalances ? '•••••' : totalDeposit.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className={`text-[8.5px] font-semibold uppercase tracking-[0.12em] mb-0.5 ${theme.labelColor}`}>
                          Active Debt
                        </p>
                        <p className={`text-sm sm:text-lg font-black tracking-tight flex items-baseline leading-none font-mono tabular-nums ${theme.debtBalanceColor}`}>
                          <span className="text-xs font-semibold mr-0.5 opacity-80">৳</span>
                          {hideBalances ? '•••••' : remainingDebt.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCOUNT NUMBER ROW */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className={`text-[8px] font-semibold uppercase tracking-[0.14em] ${theme.labelColor}`}>
                        T.U.T. Card Number
                      </p>
                      {tutCard?.isFrozen ? (
                        <span className="text-[7.5px] font-bold uppercase tracking-wider text-rose-400">· FROZEN</span>
                      ) : tutCard?.isActive ? (
                        <span className="text-[7.5px] font-bold uppercase tracking-wider text-emerald-400">· PAYABLE</span>
                      ) : null}
                    </div>
                    <p className={`text-[11px] sm:text-xs font-mono tabular-nums font-bold tracking-[0.16em] leading-none uppercase truncate ${theme.cardNumberColor}`}>
                      {formatCardNumberDisplay(cardNumberRaw, !revealFullPan)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRevealFullPan((prev) => !prev);
                      }}
                      className="p-1.5 rounded-md bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title={revealFullPan ? 'Mask Card Number' : 'Reveal Full Card Number'}
                    >
                      {revealFullPan ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyAccount}
                      className="p-1.5 rounded-md bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                      title="Copy 16-Digit Card Number"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* FOOTER ROW */}
                <div className="flex justify-between items-end border-t border-white/[0.08] pt-2 mt-1">
                  <div className="min-w-0 pr-2">
                    <p className={`text-[7.5px] font-semibold uppercase tracking-[0.14em] leading-none mb-1 ${theme.labelColor}`}>
                      Cardholder
                    </p>
                    <p className="text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-white leading-none truncate max-w-[150px] sm:max-w-[205px]">
                      {name}
                    </p>
                  </div>

                  <div className="text-right px-2">
                    <p className={`text-[7.5px] font-semibold uppercase tracking-[0.14em] leading-none mb-1 ${theme.labelColor}`}>
                      Valid Thru
                    </p>
                    <p className="text-[10.5px] sm:text-[11px] font-mono tabular-nums text-slate-200 leading-none font-semibold">
                      {expiryDisplay}
                    </p>
                  </div>

                  <div className="flex -space-x-2 items-center self-end pb-0.5 shrink-0">
                    <div className="w-5 h-5 rounded-full border border-white/15" style={{ background: theme.dualityLeft }} />
                    <div className="w-5 h-5 rounded-full border border-white/15 backdrop-blur-xs" style={{ background: theme.dualityRight }} />
                  </div>
                </div>
              </motion.div>
            )
          ) : (
            /* =================== BACK CARD FACE (CVV & SECURITY) =================== */
            <motion.div
              key="card-back"
              initial={{ opacity: 0, rotateY: 8 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: -8 }}
              transition={{ duration: 0.22 }}
              className="relative z-10 flex flex-col justify-between h-full w-full"
            >
              <div className="w-full -mx-4 sm:-mx-5 -mt-1.5">
                <div className="h-8 sm:h-9 bg-gradient-to-b from-zinc-950 via-black to-zinc-900 w-[calc(100%+2rem)] sm:w-[calc(100%+2.5rem)] border-y border-white/10" />
              </div>

              <div className="space-y-2 my-auto">
                <div className="flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  <span>Authorized Signature</span>
                  <span>Secret Payment Code</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-8 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded-md border border-white/20 px-2 flex items-center justify-between overflow-hidden">
                    <span className="font-serif italic text-slate-800 text-[11px] font-bold select-none truncate">
                      {name}
                    </span>
                    <span className="text-[8px] font-mono text-slate-500 tracking-widest hidden sm:inline">
                      {memberId || 'VERIFIED'}
                    </span>
                  </div>

                  <div className="h-8 bg-slate-950/90 border border-white/15 rounded-md flex items-center justify-center gap-1.5 px-2.5 shrink-0">
                    <span className={`text-[10px] font-mono font-bold tracking-wider ${tutCard?.isActive ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {tutCard?.isActive ? '•••••• PIN' : 'NOT SET'}
                    </span>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 leading-snug">
                  {tutCard?.isActive
                    ? `Encrypted Secret Code active · Max ৳${(tutCard.perTxLimit || 50000).toLocaleString()}/tx`
                    : 'Set your 6-digit Secret Payment Code to enable online app & card checkouts.'}
                </p>
              </div>

              <div className="border-t border-white/10 pt-2 flex items-center justify-between gap-2 text-[8.5px] text-slate-400">
                <div className="flex items-center gap-1.5 truncate">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Encrypted Zero-Usury Ledger</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onManageSecurity && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onManageSecurity();
                      }}
                      className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-md text-[9px] font-semibold text-amber-300 transition-colors cursor-pointer"
                    >
                      {tutCard?.isActive ? 'Key & Recovery' : 'Set Card Key'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(false);
                    }}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/15 rounded-md text-[9px] font-semibold text-white transition-colors cursor-pointer"
                  >
                    Front
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
