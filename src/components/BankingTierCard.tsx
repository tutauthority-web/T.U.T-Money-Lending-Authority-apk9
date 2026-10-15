/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, ShieldCheck, Copy, Check, Eye, EyeOff, Sparkles, Award, Lock } from 'lucide-react';
import { format } from 'date-fns';
import tutLogo from '../assets/images/tut_logo_1783437312744.jpg';
import { TierEmblem } from './TierEmblems';

export type TierType = 'gold' | 'silver' | 'bronze' | 'standard' | null;

interface BankingTierCardProps {
  tier?: TierType;
  status?: string | null;
  name: string;
  memberId?: string | null;
  totalDeposit: number;
  remainingDebt: number;
  subscriptionExpiresAt?: string | null;
  onCardClick?: () => void;
  showDetailsToggle?: boolean;
  className?: string;
  isCompact?: boolean;
  borrowLimit?: number;
  isPackageCard?: boolean;
}

export const BankingTierCard: React.FC<BankingTierCardProps> = ({
  tier = 'standard',
  status = 'active',
  name,
  memberId,
  totalDeposit,
  remainingDebt,
  subscriptionExpiresAt,
  onCardClick,
  showDetailsToggle = true,
  className = '',
  isCompact = false,
  borrowLimit,
  isPackageCard = false
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSecurityCode, setShowSecurityCode] = useState(false);

  const effectiveTier: 'gold' | 'silver' | 'bronze' | 'standard' = 
    status === 'active' && (tier === 'gold' || tier === 'silver' || tier === 'bronze')
      ? tier
      : tier === 'gold' || tier === 'silver' || tier === 'bronze'
        ? tier // For previews
        : 'standard';

  const handleCopyAccount = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!memberId) return;
    navigator.clipboard.writeText(memberId.replace(/[^a-zA-Z0-9]/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Formatted Account Digits (Bank format: 4 groups of 4)
  const rawId = (memberId || 'TUT-MBR-2026-0001').replace(/-/g, '').toUpperCase();
  const formattedCardNumber = `${rawId.slice(0, 4)}  ${rawId.slice(4, 8) || '8842'}  ${rawId.slice(8, 12) || '9120'}  ${rawId.slice(12, 16) || '7419'}`;
  
  // Expiry date format
  const expiryDisplay = subscriptionExpiresAt 
    ? format(new Date(subscriptionExpiresAt), 'MM / yy') 
    : '12 / 28';

  // Security CVV based on member ID
  const pseudoCvv = Math.abs(
    (memberId || 'TUT').split('').reduce((acc, char) => acc + char.charCodeAt(0), 173) % 900 + 100
  ).toString();

  // Tier Theme Configs
  const tierConfigs = {
    gold: {
      cardGradient: 'from-[#171103] via-[#241a05] to-[#0d0901]',
      borderStyle: 'border-amber-400/55 shadow-[0_24px_52px_rgba(245,158,11,0.28),inset_0_1.5px_2px_rgba(254,243,199,0.4)]',
      ambientGlow: 'bg-amber-500/20',
      accentColor: 'text-amber-300',
      badgeBg: 'bg-gradient-to-r from-amber-500/25 to-yellow-500/15 border-amber-400/40 text-amber-200',
      badgeTitle: 'SOVEREIGN GOLD VIP',
      chipGradient: 'from-amber-100 via-yellow-300 to-amber-600 border-amber-300/80 shadow-[0_0_14px_rgba(245,158,11,0.45)]',
      circuitColor: 'stroke-amber-950/45',
      guillocheColor: '#FBBF24',
      guillocheOpacity: 0.16,
      subText: 'text-amber-200/65',
      highlightText: 'text-amber-50 drop-shadow-[0_1px_4px_rgba(245,158,11,0.7)]',
      circleOverlap: 'from-amber-400/85 to-yellow-400/75',
      foilAccent: 'via-amber-300/30',
      contactlessColor: 'text-amber-300/85'
    },
    silver: {
      cardGradient: 'from-[#0C121F] via-[#141E33] to-[#090F1C]',
      borderStyle: 'border-slate-300/45 shadow-[0_20px_45px_rgba(203,213,225,0.2),inset_0_1px_1.5px_rgba(255,255,255,0.4)]',
      ambientGlow: 'bg-slate-300/12',
      accentColor: 'text-slate-200',
      badgeBg: 'bg-gradient-to-r from-slate-200/20 to-slate-400/15 border-slate-300/35 text-slate-200',
      badgeTitle: 'EXECUTIVE SILVER',
      chipGradient: 'from-slate-100 via-slate-300 to-slate-400 border-slate-200/60 shadow-[0_0_10px_rgba(203,213,225,0.3)]',
      circuitColor: 'stroke-slate-700/40',
      guillocheColor: '#CBD5E1',
      guillocheOpacity: 0.12,
      subText: 'text-slate-300/60',
      highlightText: 'text-slate-100 drop-shadow-[0_1px_3px_rgba(203,213,225,0.4)]',
      circleOverlap: 'from-slate-300/80 to-slate-400/70',
      foilAccent: 'via-slate-200/20',
      contactlessColor: 'text-slate-300/70'
    },
    bronze: {
      cardGradient: 'from-[#070D1E] via-[#0D1836] to-[#050A18]',
      borderStyle: 'border-blue-500/25 shadow-[0_20px_35px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(59,130,246,0.25)]',
      ambientGlow: 'bg-blue-500/10',
      accentColor: 'text-blue-400',
      badgeBg: 'bg-gradient-to-r from-blue-600/15 to-indigo-600/15 border-blue-500/25 text-blue-300',
      badgeTitle: 'BRONZE BASIC',
      chipGradient: 'from-yellow-200 via-yellow-400 to-amber-600 border-yellow-400/40',
      circuitColor: 'stroke-amber-950/40',
      guillocheColor: '#3B82F6',
      guillocheOpacity: 0.08,
      subText: 'text-blue-200/40',
      highlightText: 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]',
      circleOverlap: 'from-blue-500/75 to-indigo-500/75',
      foilAccent: 'via-blue-400/15',
      contactlessColor: 'text-blue-400/60'
    },
    standard: {
      cardGradient: 'from-[#070D1E] via-[#0D1836] to-[#050A18]',
      borderStyle: 'border-blue-500/25 shadow-[0_20px_35px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(59,130,246,0.25)]',
      ambientGlow: 'bg-blue-500/10',
      accentColor: 'text-blue-400',
      badgeBg: 'bg-gradient-to-r from-blue-600/15 to-indigo-600/15 border-blue-500/25 text-blue-300',
      badgeTitle: 'STANDARD RESERVE',
      chipGradient: 'from-yellow-200 via-yellow-400 to-amber-600 border-yellow-400/40',
      circuitColor: 'stroke-amber-950/40',
      guillocheColor: '#3B82F6',
      guillocheOpacity: 0.08,
      subText: 'text-blue-200/40',
      highlightText: 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]',
      circleOverlap: 'from-blue-500/75 to-indigo-500/75',
      foilAccent: 'via-blue-400/15',
      contactlessColor: 'text-blue-400/60'
    }
  };

  const currentTheme = tierConfigs[effectiveTier];

  return (
    <div className={`w-full select-none ${className}`}>
      {/* 3D Interactive Flippable Card Container */}
      <div 
        onClick={() => {
          if (onCardClick) onCardClick();
          else if (showDetailsToggle) setIsFlipped(!isFlipped);
        }}
        className={`relative overflow-hidden rounded-[22px] bg-gradient-to-br ${currentTheme.cardGradient} text-white border ${currentTheme.borderStyle} group aspect-[1.586/1] w-full mx-auto flex flex-col justify-between p-4 sm:p-5.5 cursor-pointer transition-all duration-300 hover:scale-[1.008]`}
        style={{ perspective: 1000 }}
      >
        {/* Dynamic Specular Sheen Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-tr from-transparent ${currentTheme.foilAccent} to-transparent transform -skew-x-12 translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-1000 pointer-events-none`} />

        {/* Ambient Radial Lighting */}
        <div className={`absolute -top-12 -right-12 w-48 h-48 ${currentTheme.ambientGlow} rounded-full blur-3xl pointer-events-none`} />
        <div className={`absolute -bottom-12 -left-12 w-48 h-48 ${currentTheme.ambientGlow} rounded-full blur-3xl pointer-events-none`} />

        {/* SVG Guilloche & Micro-Texture Security Layer */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none" 
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Fine Guilloche Pattern */}
            <pattern id={`guilloche-${effectiveTier}`} width="60" height="60" patternUnits="userSpaceOnUse">
              {/* Concentric Engine-Turned Rosettes & Lathe Geometry */}
              <circle cx="30" cy="30" r="28" fill="none" stroke={currentTheme.guillocheColor} strokeWidth="0.4" opacity={currentTheme.guillocheOpacity * 0.8} />
              <circle cx="30" cy="30" r="22" fill="none" stroke={currentTheme.guillocheColor} strokeWidth="0.5" opacity={currentTheme.guillocheOpacity} />
              <circle cx="30" cy="30" r="16" fill="none" stroke={currentTheme.guillocheColor} strokeWidth="0.6" strokeDasharray="1.5 2" opacity={currentTheme.guillocheOpacity * 1.2} />
              <circle cx="30" cy="30" r="10" fill="none" stroke={currentTheme.guillocheColor} strokeWidth="0.4" opacity={currentTheme.guillocheOpacity * 0.8} />
              <path 
                d="M0 30 Q 15 0, 30 30 T 60 30 M0 30 Q 15 60, 30 30 T 60 30 M30 0 Q 0 15, 30 30 T 30 60 M30 0 Q 60 15, 30 30 T 30 60" 
                fill="none" 
                stroke={currentTheme.guillocheColor} 
                strokeWidth="0.5" 
                opacity={currentTheme.guillocheOpacity * 0.9} 
              />
            </pattern>

            {/* Micro-Brushed Metallic Striations */}
            <pattern id={`grain-${effectiveTier}`} width="60" height="3" patternUnits="userSpaceOnUse">
              <rect width="60" height="3" fill="transparent" />
              <line x1="0" y1="0.5" x2="60" y2="0.5" stroke="white" strokeWidth="0.35" opacity="0.04" />
              <line x1="10" y1="2" x2="50" y2="2" stroke="white" strokeWidth="0.25" opacity="0.03" />
            </pattern>
          </defs>

          {/* Applied Texture Rectangles */}
          <rect width="100%" height="100%" fill={`url(#guilloche-${effectiveTier})`} />
          <rect width="100%" height="100%" fill={`url(#grain-${effectiveTier})`} />

          {/* Luxury Double Micro-Border Lines */}
          <rect x="7" y="7" width="calc(100% - 14px)" height="calc(100% - 14px)" rx="15" fill="none" stroke={currentTheme.guillocheColor} strokeWidth="0.5" strokeDasharray="3 2" opacity={currentTheme.guillocheOpacity * 1.6} />
          <rect x="10" y="10" width="calc(100% - 20px)" height="calc(100% - 20px)" rx="12" fill="none" stroke={currentTheme.guillocheColor} strokeWidth="0.35" opacity={currentTheme.guillocheOpacity * 0.9} />
        </svg>

        <AnimatePresence mode="wait">
          {!isFlipped ? (
            /* =================== FRONT CARD FACE =================== */
            isPackageCard ? (
              <motion.div
                key="card-package-front"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative z-10 flex flex-col justify-between h-full w-full"
              >
                {/* 1. T.U.T logo and name on the left top & 2. Tier name on the right top */}
                <div className="flex justify-between items-start">
                  {/* 1. T.U.T logo and name on the left top */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden bg-slate-900 border border-white/20 flex-shrink-0 shadow-md">
                      <img src={tutLogo} alt="T.U.T. Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <p className="text-[12px] sm:text-[13px] font-black tracking-[0.16em] text-white leading-none uppercase">
                        T.U.T.
                      </p>
                      <p className={`text-[8px] sm:text-[9px] font-bold tracking-[0.14em] uppercase leading-tight mt-1 ${currentTheme.accentColor}`}>
                        MONEY LENDING
                      </p>
                    </div>
                  </div>

                  {/* 2. Tier name on the right top */}
                  <div className="text-right">
                    <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border leading-none inline-flex items-center gap-1.5 shadow-sm font-mono ${currentTheme.badgeBg}`}>
                      <TierEmblem tier={effectiveTier} size={12} />
                      <span>{currentTheme.badgeTitle}</span>
                    </span>
                  </div>
                </div>

                {/* 3. Borrow limit in left middle -bottom */}
                <div className="mt-auto pb-1">
                  <p className={`text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-[0.16em] mb-1 font-mono ${currentTheme.subText}`}>
                    MAX BORROW LIMIT
                  </p>
                  <div className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-baseline font-mono leading-none">
                    <span className={`text-base sm:text-lg font-bold mr-1 ${currentTheme.accentColor}`}>৳</span>
                    <span className="text-emerald-400 font-black">{(borrowLimit || (effectiveTier === 'gold' ? 2500 : effectiveTier === 'silver' ? 1500 : 500)).toLocaleString()}</span>
                    <span className="text-[11px] sm:text-xs font-normal text-slate-300 ml-1.5">BDT</span>
                  </div>
                </div>
              </motion.div>
            ) : (
            <motion.div
              key="card-front"
              initial={{ opacity: 0, rotateY: -10 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: 10 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 flex flex-col justify-between h-full w-full"
            >
              {/* TOP ROW: Authority Emblem, Tier Moniker Badge & NFC Waves */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md overflow-hidden bg-slate-900 border border-white/15 flex-shrink-0 shadow-sm">
                    <img src={tutLogo} alt="T.U.T. Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-black tracking-[0.16em] text-white leading-none uppercase">T.U.T.</p>
                      <span className="text-[8px] font-bold text-slate-400">·</span>
                      <span className={`text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border leading-none flex items-center gap-1 ${currentTheme.badgeBg}`}>
                        <TierEmblem tier={effectiveTier} size={11} />
                        <span>{currentTheme.badgeTitle}</span>
                      </span>
                    </div>
                    <p className={`text-[8px] font-bold tracking-[0.16em] uppercase leading-none mt-1 ${currentTheme.accentColor}`}>
                      MONEY LENDING AUTHORITY
                    </p>
                  </div>
                </div>

                {/* Contactless symbol & Details toggle */}
                <div className="flex items-center gap-2">
                  {/* NFC Waves */}
                  <svg className={`w-3.5 h-3.5 rotate-90 ${currentTheme.contactlessColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
                      className="p-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-colors text-[9px] flex items-center gap-1 px-1.5"
                      title="View CVV & Security Code"
                    >
                      <Eye className="w-3 h-3" />
                      <span className="hidden sm:inline text-[9px] font-mono">CVV</span>
                    </button>
                  )}
                </div>
              </div>

              {/* MIDDLE ROW: Realistic EMV Chip & Live Ledger Balances */}
              <div className="grid grid-cols-12 gap-2 items-center my-auto py-1">
                {/* SVG-Rendered Metallic EMV Chip */}
                <div className="col-span-3">
                  <div className={`w-9 h-7 rounded-md bg-gradient-to-br ${currentTheme.chipGradient} border p-0.5 relative overflow-hidden flex-shrink-0`}>
                    <svg className="w-full h-full" viewBox="0 0 36 28" fill="none">
                      <rect x="1" y="1" width="34" height="26" rx="3" fill="transparent" stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
                      {/* Circuit traces */}
                      <path d="M0 14 H36 M18 0 V28 M12 6 H24 M12 22 H24 M6 6 V22 M30 6 V22" className={currentTheme.circuitColor} strokeWidth="0.8" />
                      <circle cx="18" cy="14" r="3.5" fill="rgba(0,0,0,0.08)" />
                    </svg>
                  </div>
                </div>

                {/* Balances / Max Limit Display */}
                {borrowLimit !== undefined ? (
                  <div className="col-span-9 flex items-center justify-between border-l border-white/10 pl-3">
                    <div>
                      <p className={`text-[8.5px] font-black uppercase tracking-[0.14em] mb-0.5 ${currentTheme.subText}`}>
                        MAX BORROW LIMIT
                      </p>
                      <p className="text-base sm:text-xl font-black tracking-tight text-emerald-400 flex items-center leading-none font-mono">
                        <span className={`text-xs font-semibold mr-0.5 ${currentTheme.accentColor}`}>৳</span>
                        {borrowLimit.toLocaleString()}
                        <span className="text-[10px] text-slate-300 font-normal ml-1">BDT</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border font-mono ${currentTheme.badgeBg}`}>
                        0% USURY
                      </span>
                      <p className="text-[8px] font-mono text-slate-400 mt-1">Perpetual</p>
                    </div>
                  </div>
                ) : (
                  <div className="col-span-9 flex justify-around border-l border-white/10 pl-3">
                    <div>
                      <p className={`text-[8.5px] font-black uppercase tracking-[0.14em] mb-0.5 ${currentTheme.subText}`}>CURRENT BALANCE</p>
                      <p className="text-sm sm:text-lg font-black tracking-tight text-white flex items-center leading-none font-mono">
                        <span className={`text-xs font-semibold mr-0.5 ${currentTheme.accentColor}`}>৳</span>
                        {totalDeposit.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[8.5px] font-black uppercase tracking-[0.14em] mb-0.5 ${currentTheme.subText}`}>REMAINING DEBT</p>
                      <p className="text-sm sm:text-lg font-black tracking-tight text-rose-400 flex items-center leading-none font-mono">
                        <span className="text-xs font-semibold mr-0.5 text-rose-500">৳</span>
                        {remainingDebt.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* CARD NUMBER ROW: Embossed Member ID with Copy Action */}
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-[8px] font-black uppercase tracking-[0.14em] mb-0.5 ${currentTheme.subText}`}>MEMBER ACCOUNT NUMBER</p>
                  <p className={`text-[11px] sm:text-xs font-mono font-bold tracking-[0.22em] leading-none uppercase ${currentTheme.highlightText}`}>
                    {formattedCardNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAccount}
                  className="p-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Copy Account Number"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              {/* FOOTER ROW: Holder Name, Expiry & Overlapping Hologram Circles */}
              <div className="flex justify-between items-end border-t border-white/10 pt-1.5 mt-1">
                <div className="min-w-0 pr-2">
                  <p className={`text-[8px] font-black uppercase tracking-[0.14em] leading-none mb-1 ${currentTheme.subText}`}>CARD HOLDER</p>
                  <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight text-white leading-none truncate max-w-[140px] sm:max-w-[200px]">
                    {name}
                  </p>
                </div>
                
                <div className="text-right px-2">
                  <p className={`text-[8px] font-black uppercase tracking-[0.14em] leading-none mb-1 ${currentTheme.subText}`}>VALID THRU</p>
                  <p className="text-[10px] sm:text-[11px] font-mono text-slate-200 leading-none font-bold">
                    {expiryDisplay}
                  </p>
                </div>

                {/* Overlapping Circles Hologram Badge */}
                <div className="flex -space-x-1.5 items-center opacity-90 self-end pb-0.5 shrink-0">
                  <div className={`w-4.5 h-4.5 rounded-full bg-gradient-to-tr ${currentTheme.circleOverlap} mix-blend-screen shadow-sm`} />
                  <div className="w-4.5 h-4.5 rounded-full bg-gradient-to-tr from-indigo-500/75 to-purple-500/75 mix-blend-screen shadow-sm" />
                </div>
              </div>
            </motion.div>
            )
          ) : (
            /* =================== BACK CARD FACE (CVV & SECURITY) =================== */
            <motion.div
              key="card-back"
              initial={{ opacity: 0, rotateY: 10 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: -10 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 flex flex-col justify-between h-full w-full"
            >
              {/* Back Top: Magnetic Stripe Simulator */}
              <div className="w-full -mx-4 sm:-mx-5.5 -mt-2">
                <div className="h-8 sm:h-9 bg-black/85 w-[calc(100%+2rem)] sm:w-[calc(100%+2.75rem)] border-y border-white/10" />
              </div>

              {/* Signature Strip & CVV Box */}
              <div className="space-y-1.5 my-auto">
                <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-slate-400">
                  <span>AUTHORIZED SIGNATURE</span>
                  <span>SECURITY CODE</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Signature Bar */}
                  <div className="flex-1 h-7 sm:h-8 bg-slate-200/90 rounded border border-white/20 p-1 flex items-center justify-between overflow-hidden">
                    <span className="font-serif italic text-slate-800 text-[11px] font-bold select-none pl-1 truncate">
                      {name}
                    </span>
                    <span className="text-[8px] font-mono text-slate-500 tracking-widest hidden sm:inline">T.U.T. VERIFIED</span>
                  </div>

                  {/* CVV Security Box with Toggle */}
                  <div className="w-16 sm:w-20 h-7 sm:h-8 bg-slate-900 border border-white/20 rounded flex items-center justify-center gap-1 px-1.5">
                    <span className="text-xs font-mono font-black text-amber-400 tracking-wider">
                      {showSecurityCode ? pseudoCvv : '•••'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSecurityCode(!showSecurityCode);
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      {showSecurityCode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Back Footer: Authority Disclaimers & Return to Front Button */}
              <div className="border-t border-white/10 pt-2 flex items-center justify-between text-[8px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Encrypted Zero-Usury Digital Ledger Token</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(false);
                  }}
                  className="px-2 py-0.5 bg-white/10 hover:bg-white/15 rounded text-[9px] font-bold text-white transition-colors"
                >
                  Flip to Front
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
