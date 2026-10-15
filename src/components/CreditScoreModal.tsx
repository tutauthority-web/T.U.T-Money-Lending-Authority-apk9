import React, { useState, useMemo } from 'react';
import { 
  Award, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Sliders, 
  BookOpen, 
  FileText, 
  History, 
  ArrowRight, 
  ChevronRight, 
  Lock, 
  Sparkles, 
  X,
  CreditCard,
  PiggyBank,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Zap,
  Check,
  Percent,
  Download,
  Share2,
  ExternalLink,
  Shield,
  Layers,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  calculateComprehensiveCreditScore, 
  simulateCreditScore,
  ComprehensiveCreditReport,
  CREDIT_REGULATIONS,
  CreditRegulation
} from '../utils/creditScoreEngine';

interface CreditScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  transactions?: any[];
  onRequestAction?: (type: 'loan' | 'deposit' | 'refund' | 'pay_due' | 'transfer' | 'subscription') => void;
}

export const CreditScoreModal: React.FC<CreditScoreModalProps> = ({
  isOpen,
  onClose,
  profile,
  transactions = [],
  onRequestAction
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'factors' | 'simulator' | 'regulations' | 'audit' | 'certificate'>('overview');
  
  // Regulation filter
  const [regFilter, setRegFilter] = useState<string>('all');

  // Simulator States
  const [simRepayAmount, setSimRepayAmount] = useState<number>(0);
  const [simDepositAmount, setSimDepositAmount] = useState<number>(0);
  const [simTier, setSimTier] = useState<'standard' | 'bronze' | 'silver' | 'gold'>((profile?.subscriptionTier || 'standard') as any);
  const [simKyc, setSimKyc] = useState<boolean>(!!profile?.nid);

  const report: ComprehensiveCreditReport = useMemo(() => {
    return calculateComprehensiveCreditScore(profile, transactions);
  }, [profile, transactions]);

  // Simulator Result calculation
  const simulationResult = useMemo(() => {
    return simulateCreditScore(profile, transactions, {
      simulatedRepayAmount: simRepayAmount,
      simulatedDepositAmount: simDepositAmount,
      simulatedTier: simTier,
      simulatedKycComplete: simKyc
    });
  }, [profile, transactions, simRepayAmount, simDepositAmount, simTier, simKyc]);

  if (!isOpen) return null;

  // Arc math for 300 to 850
  const normalizedRatio = Math.max(0, Math.min(1, (report.score - 300) / 550));
  const arcLength = Math.PI * 75; // Circumference of half-circle R=75 (~235.6)
  const strokeDashoffset = arcLength * (1 - normalizedRatio);
  // Needle angle (-90 deg at left, +90 deg at right)
  const needleAngle = -90 + (normalizedRatio * 180);

  // Filtered regulations
  const filteredRegulations = regFilter === 'all' 
    ? report.regulations 
    : report.regulations.filter(r => r.category === regFilter);

  const regCategories = ['all', 'Sharia & Usury', 'Utilization', 'Collateral', 'Rehabilitation', 'Charter', 'Governance'];

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={onClose} />

      <motion.div 
        initial={{ opacity: 0, y: 35, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 35, scale: 0.98 }}
        transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
        className="relative z-10 w-full sm:max-w-2xl bg-slate-900 border border-white/10 sm:rounded-3xl rounded-t-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.85)] sm:shadow-[0_25px_70px_rgba(0,0,0,0.9)] flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  T.U.T. Credit Score & Risk Scorecard
                </h3>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  FICO-300 Standard
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                <span>Sharia Non-Usury Protocol</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span className="text-emerald-400">Live Ledger Synced</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-950 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-2 px-3 sm:px-4 border-b border-white/10 bg-slate-950/40 overflow-x-auto hide-scrollbar shrink-0">
          {[
            { id: 'overview', label: 'Scorecard', icon: Award },
            { id: 'factors', label: '5-Pillar Factors', icon: Sliders },
            { id: 'simulator', label: 'Simulator', icon: TrendingUp },
            { id: 'regulations', label: 'Statutory Rules', icon: BookOpen },
            { id: 'audit', label: 'Audit Trail', icon: History },
            { id: 'certificate', label: 'Certificate', icon: ShieldCheck }
          ].map(tab => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSel 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                    : 'bg-slate-950/60 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar text-xs">
          
          {/* TAB 1: OVERVIEW & GAUGE SCORECARD */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Main Gauge Visual Card */}
              <div className="p-5 sm:p-6 rounded-3xl bg-slate-950/90 border border-white/10 shadow-xl flex flex-col items-center relative overflow-hidden">
                {/* Background ambient radial glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* SVG Semi-Circle Speedometer Gauge */}
                <div className="relative w-64 h-36 flex items-end justify-center">
                  <svg className="w-64 h-64 overflow-visible" viewBox="0 0 200 110">
                    <defs>
                      <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="25%" stopColor="#f59e0b" />
                        <stop offset="50%" stopColor="#3b82f6" />
                        <stop offset="75%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                      <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Background Arc */}
                    <path
                      d="M 25 100 A 75 75 0 0 1 175 100"
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="14"
                      strokeLinecap="round"
                    />

                    {/* Animated Value Arc */}
                    <path
                      d="M 25 100 A 75 75 0 0 1 175 100"
                      fill="none"
                      stroke="url(#gaugeGradient)"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={arcLength}
                      strokeDashoffset={strokeDashoffset}
                      filter="url(#gaugeGlow)"
                      className="transition-all duration-1000 ease-out"
                    />

                    {/* Gauge needle / pointer */}
                    <g transform={`translate(100, 100) rotate(${needleAngle})`}>
                      <line 
                        x1="0" 
                        y1="0" 
                        x2="0" 
                        y2="-70" 
                        stroke="#ffffff" 
                        strokeWidth="3" 
                        strokeLinecap="round"
                        className="drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                      />
                      <circle cx="0" cy="0" r="7" fill="#3b82f6" stroke="#ffffff" strokeWidth="2.5" />
                    </g>
                  </svg>

                  {/* Min / Max labels */}
                  <div className="absolute left-2 bottom-0 text-[10px] font-mono text-slate-500 font-bold">300</div>
                  <div className="absolute right-2 bottom-0 text-[10px] font-mono text-slate-500 font-bold">850</div>
                </div>

                {/* Score Number & Classification */}
                <div className="text-center mt-2 space-y-1 relative z-10">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white drop-shadow-md">
                      {report.score}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">/ 850 Max</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-0.5 rounded-full border ${report.badgeStyle}`}>
                      {report.label}
                    </span>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${report.riskColor}`}>
                      {report.riskRating}
                    </span>
                  </div>

                  {/* Borrowing Expansion Unlocked */}
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                      <Zap className="w-3.5 h-3.5" />
                      <span>{report.borrowingStatusLabel}</span>
                    </span>
                  </div>

                  <p className="text-[11.5px] text-slate-400 max-w-md mx-auto pt-1 leading-relaxed">
                    {report.isOverdue
                      ? '⚠️ Delinquency alert: Active loan has passed scheduled settlement. Settle now to instantly recover up to 75 points.'
                      : report.score >= 780
                      ? 'Your institutional score is in the top-tier sovereign bracket. Maximum loan limits and expedited zero-hold approvals are active.'
                      : 'Your score reflects positive contract fulfillment. Keeping utilization below 30% advances your profile to Prime status.'}
                  </p>
                </div>
              </div>

              {/* OVERDUE DELINQUENCY ALERT BANNER (If applicable) */}
              {report.isOverdue && (
                <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/30 text-rose-200 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Maturity Overdue Detected
                        </h4>
                        <p className="text-[11px] text-rose-300/90 mt-0.5">
                          Active balance of ৳{report.remainingDebt.toLocaleString()} BDT is past the agreed maturity date.
                        </p>
                      </div>
                    </div>
                    {onRequestAction && (
                      <button
                        type="button"
                        onClick={() => { onClose(); onRequestAction('pay_due'); }}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                      >
                        Settle Balance Now
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-rose-300/80 pt-1 border-t border-rose-500/20 flex items-center justify-between">
                    <span>Statutory Rehabilitation: Up to 80% of score penalty restored upon settlement.</span>
                    <span className="font-mono">REG-404</span>
                  </div>
                </div>
              )}

              {/* 4 Connected Financial Pillar Stat Boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 space-y-1 text-left">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block">
                    Credit Limit
                  </span>
                  <p className="text-sm font-black font-mono text-white">
                    ৳{report.totalBorrowLimit.toLocaleString()}
                  </p>
                  <span className="text-[8.5px] text-emerald-400 font-bold block">
                    Ceiling: ৳{report.effectiveLimitCeiling.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 space-y-1 text-left">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block">
                    Debt Utilization
                  </span>
                  <p className="text-sm font-black font-mono text-white">
                    {report.utilizationPct}%
                  </p>
                  <span className={`text-[8.5px] font-bold block ${report.utilizationPct > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    Active: ৳{report.remainingDebt.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 space-y-1 text-left">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block">
                    Vault Collateral
                  </span>
                  <p className="text-sm font-black font-mono text-white">
                    ৳{report.totalDeposit.toLocaleString()}
                  </p>
                  <span className="text-[8.5px] text-blue-400 font-bold block">
                    Coverage: {report.collateralRatio}%
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 space-y-1 text-left">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block">
                    Repayment Record
                  </span>
                  <p className="text-sm font-black font-mono text-white">
                    {report.repaymentRatio}%
                  </p>
                  <span className="text-[8.5px] text-emerald-400 font-bold block">
                    Repaid: ৳{report.totalRepaid.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Segmented Tier Visual Strip */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Institutional Scale Bands</span>
                  <span className="font-mono text-slate-500">Current: {report.score} pts</span>
                </div>
                <div className="flex gap-1.5 h-2.5 w-full rounded-full overflow-hidden bg-slate-900 p-0.5 border border-white/5">
                  {[
                    { label: 'Attention', range: '300-579', color: 'bg-rose-500', active: report.score < 580 },
                    { label: 'Fair', range: '580-639', color: 'bg-amber-500', active: report.score >= 580 && report.score < 640 },
                    { label: 'Good', range: '640-699', color: 'bg-blue-500', active: report.score >= 640 && report.score < 700 },
                    { label: 'Prime', range: '700-779', color: 'bg-teal-400', active: report.score >= 700 && report.score < 780 },
                    { label: 'Exceptional', range: '780-850', color: 'bg-emerald-400', active: report.score >= 780 }
                  ].map((band, idx) => (
                    <div 
                      key={idx}
                      className={`flex-1 rounded-full transition-all duration-300 relative ${
                        band.active 
                          ? `${band.color} shadow-[0_0_10px_rgba(255,255,255,0.4)] ring-1 ring-white/60` 
                          : 'bg-slate-800/40 opacity-40'
                      }`}
                      title={`${band.label} (${band.range})`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[8px] font-mono text-slate-500 px-0.5">
                  <span>300 (Needs Attn)</span>
                  <span>580 (Fair)</span>
                  <span>640 (Good)</span>
                  <span>700 (Prime)</span>
                  <span>780+ (Exceptional)</span>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-[11px] text-slate-300">
                    Want to increase your score? Review your interactive <strong>What-If Simulator</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab('simulator')}
                    className="flex-1 sm:flex-initial px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Open Simulator</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('certificate')}
                    className="px-3 py-1.5 bg-slate-950 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1"
                    title="View Official Certificate"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Card</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 5-PILLAR DETAILED BREAKDOWN */}
          {activeTab === 'factors' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="pb-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-400" />
                  <span>Institutional 5-Pillar Weight Model</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Strictly mathematically weighted based on your verified T.U.T. financial activities.
                </p>
              </div>

              <div className="space-y-3">
                {report.factors.map((f) => {
                  const factorPct = Math.round((f.earnedPoints / f.maxPoints) * 100);
                  const isOpt = f.status === 'optimal';
                  const isCrit = f.status === 'critical';

                  return (
                    <div 
                      key={f.id}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-white">{f.name}</h5>
                            <span className="text-[9px] font-mono text-slate-400 font-bold bg-slate-900 px-1.5 py-0.2 rounded border border-white/5">
                              Weight: {f.weightPct}%
                            </span>
                            <span className={`text-[8.5px] font-mono font-bold uppercase px-1.5 py-0.2 rounded ${
                              isCrit ? 'bg-rose-500/20 text-rose-400' :
                              isOpt ? 'bg-emerald-500/20 text-emerald-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {f.status}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black font-mono text-white">
                            {f.earnedPoints} <span className="text-[10px] text-slate-500 font-normal">/ {f.maxPoints} pts</span>
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-white/5">
                        <div 
                          className={`h-full rounded-full transition-all duration-800 ${
                            isCrit 
                              ? 'bg-rose-500' 
                              : isOpt 
                              ? 'bg-gradient-to-r from-teal-400 to-emerald-400' 
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.max(5, factorPct)}%` }}
                        />
                      </div>

                      <div className="space-y-1 pt-1 text-[11px]">
                        <p className="text-slate-300 leading-relaxed font-sans">
                          {f.summary}
                        </p>
                        <p className="text-amber-400/90 font-medium text-[10.5px] flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 shrink-0" />
                          <span>Advisory: {f.tip}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: SMART INTERACTIVE SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/20 space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Interactive "What-If" Credit Simulator
                  </h4>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Adjust simulated repayments, vault capital, and charter standing below to calculate your projected score and credit ceiling expansion in real time.
                </p>
              </div>

              {/* Dynamic Projection Result Card */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 shadow-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Projected Credit Impact</span>
                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                    simulationResult.pointsDelta > 0 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : simulationResult.pointsDelta < 0
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {simulationResult.pointsDelta > 0 ? `+${simulationResult.pointsDelta} Pts Gain` : `${simulationResult.pointsDelta} Pts`}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-900/70 border border-white/5">
                    <span className="text-[8.5px] uppercase font-mono text-slate-500 block">Current Score</span>
                    <span className="text-xl font-black font-mono text-slate-300">{simulationResult.currentScore}</span>
                    <span className="text-[9px] text-slate-400 block">{simulationResult.currentTierLabel}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                    <span className="text-[8.5px] uppercase font-mono text-emerald-400 block">Projected Score</span>
                    <span className="text-xl font-black font-mono text-emerald-300">{simulationResult.projectedScore}</span>
                    <span className="text-[9px] text-emerald-400 font-bold block">{simulationResult.projectedTierLabel}</span>
                  </div>

                  <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/30">
                    <span className="text-[8.5px] uppercase font-mono text-blue-400 block">Authorized Ceiling</span>
                    <span className="text-xl font-black font-mono text-white">৳{simulationResult.projectedBorrowLimit.toLocaleString()}</span>
                    <span className="text-[9px] text-blue-300 font-bold block">
                      {simulationResult.projectedBorrowLimit > simulationResult.currentBorrowLimit 
                        ? `+৳${(simulationResult.projectedBorrowLimit - simulationResult.currentBorrowLimit).toLocaleString()} Expansion`
                        : 'Standard Authorized Limit'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed font-sans bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  {simulationResult.summary}
                </p>
              </div>

              {/* SIMULATION CONTROLS */}
              <div className="space-y-3">
                {/* Control 1: Repay Active Debt */}
                {report.remainingDebt > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Simulate Loan Repayment</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        ৳{simRepayAmount.toLocaleString()} BDT
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={report.remainingDebt}
                      step={Math.max(50, Math.floor(report.remainingDebt / 20))}
                      value={simRepayAmount}
                      onChange={(e) => setSimRepayAmount(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />

                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                      <span>৳0 (No repayment)</span>
                      <div className="flex gap-1.5">
                        <button 
                          type="button" 
                          onClick={() => setSimRepayAmount(Math.round(report.remainingDebt * 0.5))}
                          className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                        >
                          50%
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setSimRepayAmount(report.remainingDebt)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white font-bold"
                        >
                          100% (Full Settlement)
                        </button>
                      </div>
                      <span>৳{report.remainingDebt.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Control 2: Vault Collateral Deposit */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-white">Simulate Vault Deposit Infusion</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-blue-400">
                      +৳{simDepositAmount.toLocaleString()} BDT
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={50000}
                    step={1000}
                    value={simDepositAmount}
                    onChange={(e) => setSimDepositAmount(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />

                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                    <span>+৳0</span>
                    <div className="flex gap-1.5">
                      <button 
                        type="button" 
                        onClick={() => setSimDepositAmount(2000)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                      >
                        +2K
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setSimDepositAmount(5000)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                      >
                        +5K
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setSimDepositAmount(20000)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white font-bold"
                      >
                        +20K
                      </button>
                    </div>
                    <span>+৳50,000</span>
                  </div>
                </div>

                {/* Control 3: Subscription Tier Upgrade */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">Simulate Charter Subscription Tier</span>
                    </div>
                    <span className="font-mono text-xs font-bold uppercase text-amber-400">
                      {simTier}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {(['standard', 'bronze', 'silver', 'gold'] as const).map((tierKey) => (
                      <button
                        key={tierKey}
                        type="button"
                        onClick={() => setSimTier(tierKey)}
                        className={`p-2 rounded-xl text-center capitalize text-xs font-bold transition-all border ${
                          simTier === tierKey 
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm' 
                            : 'bg-slate-900 text-slate-400 border-white/5 hover:text-white'
                        }`}
                      >
                        {tierKey}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Control 4: Complete KYC Toggle (if missing) */}
                {!profile?.nid && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-teal-400" />
                      <div>
                        <span className="text-xs font-bold text-white block">Complete National ID Verification</span>
                        <span className="text-[10px] text-slate-400">Simulate verified NID and emergency contact</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={simKyc}
                      onChange={(e) => setSimKyc(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-white/20 focus:ring-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Reset Simulator or Execute Real Actions */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSimRepayAmount(0);
                    setSimDepositAmount(0);
                    setSimTier((profile?.subscriptionTier || 'standard') as any);
                    setSimKyc(!!profile?.nid);
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset Simulator</span>
                </button>

                {onRequestAction && simRepayAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onRequestAction('pay_due'); }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    Execute Settlement Now →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: OFFICIAL RULES & REGULATIONS */}
          {activeTab === 'regulations' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="pb-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>T.U.T. Statutory Credit Governance Charter</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Official statutory guidelines governing member credit evaluation under the 2026 Charter.
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar pb-1">
                {regCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setRegFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all capitalize cursor-pointer ${
                      regFilter === cat 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-950/60 text-slate-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredRegulations.map((reg) => (
                  <div 
                    key={reg.code}
                    className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                          {reg.code}
                        </span>
                        <h5 className="text-xs font-bold text-white">{reg.title}</h5>
                      </div>
                      <span className="text-[8.5px] font-mono text-slate-500 uppercase">
                        {reg.category}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                      {reg.summary}
                    </p>

                    <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5 text-[10.5px] text-amber-300/90 leading-relaxed">
                      <strong>Member Benefit / Impact:</strong> {reg.practicalImpact}
                    </div>

                    <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-slate-500">
                      <span>Authority Clause</span>
                      <span className="text-slate-400">{reg.authorityClause}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT LOGS TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="pb-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  <span>Centralized Ledger Audit Trail</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Point adjustments automatically recorded from verified ledger transactions.
                </p>
              </div>

              <div className="space-y-2">
                {report.auditLogs.map((log) => (
                  <div 
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between gap-3 text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        log.type === 'positive' 
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                          : log.type === 'negative' 
                          ? 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse' 
                          : 'bg-blue-400'
                      }`} />
                      <div>
                        <h6 className="text-xs font-bold text-white">{log.title}</h6>
                        <p className="text-[10px] text-slate-400">{log.detail}</p>
                      </div>
                    </div>

                    <span className={`font-mono text-xs font-black shrink-0 ${
                      log.pointsDelta > 0 
                        ? 'text-emerald-400' 
                        : log.pointsDelta < 0 
                        ? 'text-rose-400' 
                        : 'text-slate-400'
                    }`}>
                      {log.pointsDelta > 0 ? `+${log.pointsDelta}` : log.pointsDelta} Pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: OFFICIAL MEMBER CREDIT CERTIFICATE */}
          {activeTab === 'certificate' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-950 to-slate-900 border border-amber-500/30 shadow-2xl relative overflow-hidden text-center space-y-4">
                {/* Background watermarked emblem */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 border-4 border-amber-500/5 rounded-full pointer-events-none flex items-center justify-center">
                  <Award className="w-48 h-48 text-amber-500/5" />
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[9px] font-bold uppercase tracking-widest">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Official Institutional Accreditation</span>
                  </div>
                  
                  <h3 className="text-lg font-black text-white uppercase tracking-wider">
                    Certificate of Credit Standing
                  </h3>
                  <p className="text-[10px] text-slate-400 max-w-sm mx-auto">
                    Issued under the authority of T.U.T. Private Lending Authority in accordance with the 2026 Sharia Mutual Risk Charter.
                  </p>
                </div>

                {/* Score & Member Box */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 max-w-md mx-auto grid grid-cols-2 gap-3 relative z-10 text-left">
                  <div>
                    <span className="text-[8.5px] uppercase font-mono text-slate-500 block">Accredited Member</span>
                    <span className="text-xs font-black text-white uppercase truncate block">{profile?.name || 'Authorized Member'}</span>
                    <span className="text-[9px] font-mono text-blue-400">{profile?.memberId || 'TUT-MBR-2026'}</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[8.5px] uppercase font-mono text-slate-500 block">Verified Score</span>
                    <span className="text-2xl font-black font-mono text-amber-400">{report.score}</span>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase block">{report.label}</span>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <span className="text-[8.5px] uppercase font-mono text-slate-500 block">Authorized Credit Line</span>
                    <span className="text-xs font-bold font-mono text-white">৳{report.effectiveLimitCeiling.toLocaleString()} BDT</span>
                  </div>

                  <div className="pt-2 border-t border-white/5 text-right">
                    <span className="text-[8.5px] uppercase font-mono text-slate-500 block">Risk Rating</span>
                    <span className="text-xs font-bold text-emerald-400">{report.riskRating}</span>
                  </div>
                </div>

                <div className="relative z-10 pt-2 flex items-center justify-between text-[9px] font-mono text-slate-500 max-w-md mx-auto border-t border-white/5">
                  <span>256-BIT SSL ENCRYPTED</span>
                  <span>VERIFICATION: TUT-AUDIT-{report.score}</span>
                  <span>ZERO-USURY COMPLIANT</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer info bar */}
        <div className="p-3.5 bg-slate-950 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-500 px-5 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono">Audited under Section 4.1 T.U.T. Charter</span>
          </div>
          <span>T.U.T. Money Lending Authority</span>
        </div>
      </motion.div>
    </div>
  );
};
