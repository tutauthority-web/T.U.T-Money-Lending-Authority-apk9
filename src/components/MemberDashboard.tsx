import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  Shield, 
  Tag, 
  User, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History as HistoryIcon, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Lock, 
  Play, 
  ExternalLink,
  Copy,
  X,
  Menu,
  Activity,
  FileText,
  Briefcase,
  Home,
  TrendingUp,
  Award,
  Crown,
  Zap,
  HelpCircle,
  MessageSquare,
  Send,
  Eye,
  EyeOff,
  Search,
  Filter,
  Download,
  Check,
  Database,
  Cpu,
  Fingerprint,
  Plus,
  Trash2,
  Smartphone,
  Sparkles,
  Calendar,
  RotateCw,
  ChevronRight,
  PieChart,
  PiggyBank,
  FileCheck,
  Banknote,
  PlusCircle,
  ChevronDown,
  ArrowLeft,
  ShieldCheck,
  LogOut,
  Bell,
  ChevronLeft,
  KeyRound
} from 'lucide-react';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  cn, 
  Button, 
  Card, 
  getSubscriptionPricing, 
  SubscriptionBadge, 
  UserProfile,
  Transaction,
  SponsorshipCampaign,
  Modal
} from '../App';
import { calculateMemberLoanAllocations } from '../utils/loanAllocationEngine';
import { calculateComprehensiveCreditScore } from '../utils/creditScoreEngine';
import { executeAtomicP2PTransfer } from '../utils/bankingLedgerEngine';
import { OfficialReceiptModal, OfficialReceiptData } from './common/OfficialReceiptModal';
import { downloadReceiptPng, normalizeMemoCode } from '../utils/receiptGenerator';
import { CreditScoreModal } from './CreditScoreModal';
import { MemberLoanHistoryCard } from './MemberLoanHistoryCard';
import { BankingTierCard } from './BankingTierCard';
import { TutCardKeyModal } from './TutCardKeyModal';
import {
  TutPayCardRecord,
  deriveDeterministicCardNumber
} from '../utils/tutPaymentEngine';
import { SubscriptionHubView } from './SubscriptionHubView';
import { TierEmblem } from './TierEmblems';
import { BkashLogo, NagadLogo } from './PaymentBrandLogos';
import { db, auth } from '../firebase';
import tutLogo from '../assets/images/tut_logo_1783437312744.jpg';
import { 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  GoogleAuthProvider, 
  reauthenticateWithPopup,
  signOut
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  increment,
  onSnapshot,
  deleteDoc,
  setDoc
} from 'firebase/firestore';

// CopyButton component
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Clipboard access limited:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-300 shrink-0 cursor-pointer",
        copied
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-white/5 text-blue-400 border-white/10 hover:bg-white/10 hover:border-white/25"
      )}
      title="Copy to Clipboard"
    >
      <Copy className="w-3 h-3" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

// Circular Quick Operation Button
const QuickActionCircle = ({ icon: Icon, label, onClick, variant = 'blue' }: { icon: any, label: string, onClick: () => void, variant?: 'blue' | 'indigo' | 'rose' | 'amber' }) => {
  const variants = {
    blue: 'bg-blue-600/10 text-blue-400 border-blue-500/20 hover:bg-blue-600/20',
    indigo: 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-600/20',
    rose: 'bg-rose-600/10 text-rose-400 border-rose-500/20 hover:bg-rose-600/20',
    amber: 'bg-amber-600/10 text-amber-400 border-amber-500/20 hover:bg-amber-600/20'
  };

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 group cursor-pointer active:scale-95"
    >
      <div className={cn(
        "w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-300 shadow-md group-hover:shadow-lg group-hover:scale-105",
        variants[variant]
      )}>
        <Icon className="w-6 h-6 transition-transform group-hover:scale-110" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-300/80 group-hover:text-white transition-colors text-center truncate w-20">{label}</span>
    </button>
  );
};

// Spending statistics area chart using Recharts
const SpendChart = ({ transactions, profile }: { transactions: Transaction[]; profile: UserProfile }) => {
  const confirmedTx = [...transactions]
    .filter(t => t.status === 'confirmed')
    .sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeA - timeB;
    });

  // Construct nice chronological points based entirely on actual user data
  let chartData: any[] = [];

  // Start with a Base Period
  chartData.push({
    name: 'Cycle Start',
    Savings: 0,
    Lending: 0
  });

  if (confirmedTx.length > 0) {
    let cumulativeSavings = 0;
    let cumulativeLending = 0;
    confirmedTx.forEach((tx, idx) => {
      if (tx.type === 'deposit' || tx.type === 'refund') {
        cumulativeSavings += tx.amount;
      } else if (tx.type === 'loan' || tx.type === 'pay_due') {
        cumulativeLending += tx.amount;
      } else if (tx.type === 'subscription') {
        cumulativeSavings = Math.max(0, cumulativeSavings - tx.amount);
      }
      
      const label = tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd MMM') : `Tx ${idx + 1}`;
      chartData.push({
        name: label,
        Savings: cumulativeSavings,
        Lending: cumulativeLending,
        amount: tx.amount,
        type: tx.type
      });
    });

    // Make sure we end precisely on the user's current live total savings/loans from profile
    if (cumulativeSavings !== profile.totalDeposit || cumulativeLending !== profile.totalLoan) {
      chartData.push({
        name: 'Live Balance',
        Savings: profile.totalDeposit,
        Lending: profile.totalLoan
      });
    }
  } else {
    // No confirmed transactions, plot the actual live profile numbers directly
    if (profile.totalDeposit > 0 || profile.totalLoan > 0) {
      chartData.push({
        name: 'Live Balance',
        Savings: profile.totalDeposit,
        Lending: profile.totalLoan
      });
    } else {
      chartData.push({
        name: 'Ledger Standby',
        Savings: 0,
        Lending: 0
      });
    }
  }

  return (
    <div className="p-6 bg-slate-900/40 border border-white/5 rounded-3xl text-left space-y-4 shadow-xl">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Lending & Saving Analytics
          </h4>
          <p className="text-[9px] text-blue-400/50 uppercase tracking-widest mt-0.5">
            Active Verified Ledger Flow
          </p>
        </div>
        <span className="text-[9px] font-mono font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
          <Fingerprint className="w-3 h-3 text-emerald-400 animate-pulse" />
          LIVE SECURE SYNC
        </span>
      </div>

      <div className="h-44 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="colorLending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="rgba(255,255,255,0.2)" 
              fontSize={8} 
              fontFamily="monospace"
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.2)" 
              fontSize={8} 
              fontFamily="monospace"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `৳${v}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-950 border border-white/10 rounded-2xl p-3 shadow-2xl space-y-1.5 backdrop-blur-md">
                      <p className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-wider">{payload[0].payload.name}</p>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Savings: ৳ {Number(payload[0].value).toLocaleString()}
                        </p>
                        <p className="text-xs font-bold text-blue-400 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          Lending: ৳ {Number(payload[1]?.value || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="Savings" 
              stroke="#10b981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorSavings)" 
            />
            <Area 
              type="monotone" 
              dataKey="Lending" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorLending)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 pt-1 border-t border-white/[0.03]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/20 border border-emerald-500" />
            <span>Savings Flow (৳ {profile.totalDeposit.toLocaleString()})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/20 border border-blue-500" />
            <span>Lending Flow (৳ {profile.totalLoan.toLocaleString()})</span>
          </div>
        </div>
        <span className="text-emerald-400 font-bold uppercase tracking-widest text-[8px] animate-pulse">
          AUDITED STATUS: OK
        </span>
      </div>
    </div>
  );
};

// Custom QR Code simulated block for official documents
const CustomQRCode = ({ value }: { value: string }) => {
  return (
    <svg width="48" height="48" viewBox="0 0 16 16" className="text-slate-900 fill-current">
      <path d="M0 0h5v1H1v4H0zm11 0h5v5h-1V1h-4zm-11 11h1v4h4v1H0zm15 0v4h-4v1h5z" />
      <rect x="2" y="2" width="2" height="2" />
      <rect x="12" y="2" width="2" height="2" />
      <rect x="2" y="12" width="2" height="2" />
      <rect x="6" y="2" width="1" height="1" />
      <rect x="8" y="2" width="2" height="1" />
      <rect x="6" y="4" width="2" height="1" />
      <rect x="9" y="5" width="1" height="2" />
      <rect x="11" y="6" width="1" height="1" />
      <rect x="2" y="7" width="2" height="1" />
      <rect x="5" y="8" width="1" height="3" />
      <rect x="7" y="10" width="3" height="1" />
      <rect x="12" y="8" width="1" height="2" />
      <rect x="11" y="11" width="2" height="1" />
      <rect x="9" y="12" width="1" height="3" />
      <rect x="13" y="13" width="1" height="1" />
    </svg>
  );
};

// Circular progress indicator component for budgets/stats
const BudgetCircle = ({ percentage, label, amount, color = 'blue' }: { percentage: number, label: string, amount: string, color?: 'blue' | 'emerald' | 'amber' }) => {
  const strokeColorClass = {
    blue: 'stroke-blue-500',
    emerald: 'stroke-emerald-500',
    amber: 'stroke-amber-500'
  }[color];

  return (
    <div className="flex items-center gap-4 p-5 bg-slate-900/40 border border-white/5 rounded-3xl">
      <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="28" cy="28" r="24" className="stroke-slate-800 fill-none" strokeWidth="3" />
          <motion.circle 
            cx="28" cy="28" r="24" 
            className={cn("fill-none", strokeColorClass)} 
            strokeWidth="3" 
            strokeDasharray="150" 
            initial={{ strokeDashoffset: 150 }}
            animate={{ strokeDashoffset: 150 - (150 * percentage) / 100 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-[10px] font-mono font-black text-white">{percentage}%</span>
      </div>
      <div className="min-w-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">{label}</span>
        <h5 className="text-sm font-black text-white tracking-tight truncate mt-1">{amount}</h5>
      </div>
    </div>
  );
};

// Premium Virtual Luxury Card
const VirtualBankCard = ({ profile, mode, setMode }: { profile: UserProfile, mode: 'debit' | 'credit', setMode: (m: 'debit' | 'credit') => void }) => {
  const formatCardNumber = (memberId: string) => {
    const rawId = memberId.replace(/\D/g, ''); 
    const padded = (rawId + "8840127845689101").substring(0, 12);
    return `5432 1278 ${padded.substring(0, 4)} ${padded.substring(4, 8)}`;
  };

  return (
    <div className="space-y-5">
      {/* Selector Pill - Matches Image #2 Debit/Credit tab exactly */}
      <div className="flex justify-center">
        <div className="bg-slate-900/80 p-1.5 rounded-full border border-white/5 flex gap-1 shadow-inner relative">
          <button 
            type="button"
            onClick={() => setMode('debit')}
            className={cn(
              "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer relative z-10",
              mode === 'debit' ? "text-white bg-blue-600 shadow-md shadow-blue-900/40" : "text-blue-400/60 hover:text-white"
            )}
          >
            Debit Card
          </button>
          <button 
            type="button"
            onClick={() => setMode('credit')}
            className={cn(
              "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer relative z-10",
              mode === 'credit' ? "text-white bg-indigo-600 shadow-md shadow-indigo-900/40" : "text-blue-400/60 hover:text-white"
            )}
          >
            Credit Card
          </button>
        </div>
      </div>

      {/* Luxury Animated Metallic Card Mockup */}
      <motion.div 
        whileHover={{ scale: 1.01, y: -2 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          "relative overflow-hidden rounded-[24px] p-6 text-white shadow-2xl transition-all duration-500 border border-white/10 group aspect-[1.586/1] w-full max-w-sm mx-auto flex flex-col justify-between",
          mode === 'debit' 
            ? "bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-900 shadow-blue-900/30" 
            : "bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 shadow-indigo-950/40"
        )}
      >
        {/* Holographic Mesh Glow & Vector Rings */}
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-44 h-44 bg-white/10 rounded-full blur-2xl group-hover:bg-white/15 transition-all duration-700" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-44 h-44 bg-blue-400/10 rounded-full blur-2xl" />
        
        <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <path d="M-50 120 C 50 60, 150 180, 400 90" stroke="white" strokeWidth="2.5" fill="none" />
          <path d="M-50 150 C 70 80, 130 210, 400 120" stroke="white" strokeWidth="2" fill="none" />
        </svg>

        <div className="relative z-10 h-full flex flex-col justify-between">
          {/* Card Top Block */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-blue-200/70 uppercase font-black">
                T.U.T. PRIVATE RESERVE
              </p>
              <p className="text-[9px] font-mono tracking-[0.2em] text-amber-400 uppercase font-black mt-1">
                {mode === 'debit' ? "SAVINGS PLATINUM" : "SECURED CAPITAL"}
              </p>
            </div>
            
            {/* Wireless & Shield Emblem */}
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10" strokeLinecap="round" />
                <path d="M16 4a19.3 19.3 0 0 1 3 8 19.3 19.3 0 0 1-3 8" strokeLinecap="round" />
                <path d="M8 8a9.3 9.3 0 0 1 1.5 4A9.3 9.3 0 0 1 8 16" strokeLinecap="round" />
              </svg>
              <div className="w-6 h-6 bg-white/10 rounded-md flex items-center justify-center border border-white/10 backdrop-blur-md">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>

          {/* SIM Chip mockup */}
          <div className="self-start my-1">
            <div className="w-8 h-6 rounded-md bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 p-0.5 border border-amber-500/20 relative shadow-inner">
              <div className="absolute inset-x-2 inset-y-1.5 border-l border-r border-amber-600/30" />
              <div className="absolute inset-y-2 inset-x-1.5 border-t border-b border-amber-600/30" />
            </div>
          </div>

          {/* Core Balance Info */}
          <div className="text-left">
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-200/50">
              {mode === 'debit' ? "Deposit & Savings" : "Outstanding Payable Debt"}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-black text-white/70">৳</span>
              <h2 className="text-2xl font-black tracking-tight font-mono leading-none">
                {mode === 'debit' ? profile.totalDeposit.toLocaleString() : profile.remainingDebt.toLocaleString()}
              </h2>
            </div>
            {mode === 'credit' && (
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider mt-1">
                Limit: <span className="text-white">৳ {(profile.borrowingLimit ?? 100000).toLocaleString()}</span>
              </p>
            )}
          </div>

          {/* Card Footer Block */}
          <div className="flex justify-between items-end mt-3 border-t border-white/5 pt-2.5">
            <div>
              <p className="text-[9px] font-black text-blue-200/40 uppercase tracking-[0.12em] leading-none mb-1">
                MEMBER ID
              </p>
              <p className="text-[10px] font-mono font-bold tracking-[0.1em] text-blue-100">
                {formatCardNumber(profile.memberId)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-blue-200/40 uppercase tracking-[0.12em] leading-none mb-1">
                CARDHOLDER
              </p>
              <p className="text-[9px] font-bold uppercase tracking-tight text-white truncate max-w-[120px]">
                {profile.name}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const DealCountdownBadge = () => {
  const [countdown, setCountdown] = useState({ h: 14, m: 32, s: 58 });

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) {
          s = 59;
          m--;
        }
        if (m < 0) {
          m = 59;
          h--;
        }
        if (h < 0) {
          return { h: 0, m: 0, s: 0 };
        }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-[10px] font-mono tabular-nums text-slate-200 inline-flex items-center gap-1.5 bg-slate-950/75 border border-white/10 px-2 py-0.5 rounded-md">
      <Clock className="w-2.5 h-2.5 text-rose-400" />
      <span>{String(countdown.h).padStart(2, '0')}:{String(countdown.m).padStart(2, '0')}:{String(countdown.s).padStart(2, '0')}</span>
    </span>
  );
};

interface MemberDashboardProps {
  profile: UserProfile;
  transactions: Transaction[];
  activeSponsorships: SponsorshipCampaign[];
  
  // State from App.tsx
  selectedSubTier: 'bronze' | 'silver' | 'gold';
  setSelectedSubTier: (tier: 'bronze' | 'silver' | 'gold') => void;
  subSenderMobile: string;
  setSubSenderMobile: (val: string) => void;
  subTrxId: string;
  setSubTrxId: (val: string) => void;
  subWallet: 'Bkash' | 'Nagad' | 'Recharge' | 'Cash';
  setSubWallet: (val: 'Bkash' | 'Nagad' | 'Recharge' | 'Cash') => void;
  showSubPaymentMode: boolean;
  setShowSubPaymentMode: (val: boolean) => void;
  
  // Callbacks
  handleBuySubscription: (e: React.FormEvent) => void;
  onRequestAction: (type: 'loan' | 'deposit' | 'refund' | 'pay_due' | 'transfer' | 'subscription') => void;
  setShowProfileModal: (show: boolean) => void;
  setShowAdminLogin: (show: boolean) => void;
  handleAdClick: (id: string) => void;
  addToast?: (title: string, msg: string, type: 'success' | 'warning' | 'danger' | 'info') => void;
  sendWorkflowNotification?: (type: string, email?: string, name?: string, meta?: any) => Promise<void>;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  activeTab?: 'dashboard' | 'memos' | 'subscription' | 'partners' | 'profile' | 'wallets';
  onTabChange?: (tab: 'dashboard' | 'memos' | 'subscription' | 'partners' | 'profile' | 'wallets') => void;
}

export function MemberDashboard({
  profile,
  transactions,
  activeSponsorships,
  selectedSubTier,
  setSelectedSubTier,
  subSenderMobile,
  setSubSenderMobile,
  subTrxId,
  setSubTrxId,
  subWallet,
  setSubWallet,
  showSubPaymentMode,
  setShowSubPaymentMode,
  handleBuySubscription,
  onRequestAction,
  setShowProfileModal,
  setShowAdminLogin,
  handleAdClick,
  addToast,
  sendWorkflowNotification,
  onOpenNotifications,
  unreadNotificationsCount,
  activeTab,
  onTabChange
}: MemberDashboardProps) {
  const [internalMemberTab, setInternalMemberTab] = useState<'dashboard' | 'memos' | 'subscription' | 'partners' | 'profile' | 'wallets'>('dashboard');
  const memberTab = activeTab ?? internalMemberTab;

  const [hideBalances, setHideBalances] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tut_hide_balances') === 'true';
    } catch {
      return false;
    }
  });

  const togglePrivacyMode = useCallback(() => {
    setHideBalances((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tut_hide_balances', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Instant scroll reset on tab change prevents layout-vs-scroll stutter
  const navigateTab = useCallback((newTab: 'dashboard' | 'memos' | 'subscription' | 'partners' | 'profile' | 'wallets') => {
    if (memberTab === newTab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (onTabChange) {
      onTabChange(newTab);
    } else {
      setInternalMemberTab(newTab);
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [memberTab, onTabChange]);

  const setMemberTab = navigateTab;

  // Listen for cross-component tab navigation (e.g. from Notification Center)
  useEffect(() => {
    const handleExternalTabNav = (e: Event) => {
      const customEvent = e as CustomEvent<'dashboard' | 'memos' | 'subscription' | 'partners' | 'profile' | 'wallets'>;
      if (customEvent.detail) {
        navigateTab(customEvent.detail);
      }
    };
    window.addEventListener('tut-navigate-member-tab', handleExternalTabNav);
    return () => window.removeEventListener('tut-navigate-member-tab', handleExternalTabNav);
  }, [navigateTab]);
  
  // Memoized transaction splits for high-performance zero-lag rendering
  const pendingTransactions = useMemo(() => transactions.filter(t => t.status === 'pending'), [transactions]);
  const confirmedTransactions = useMemo(() => transactions.filter(t => t.status === 'confirmed'), [transactions]);

  // Wallet & Card Management States
  const [wallets, setWallets] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [tutCard, setTutCard] = useState<TutPayCardRecord | null>(null);
  const [tutCardLoaded, setTutCardLoaded] = useState(false);
  const [showCardSecurityModal, setShowCardSecurityModal] = useState(false);
  const [pinGateOpen, setPinGateOpen] = useState(false);

  useEffect(() => {
    if (tutCardLoaded && !tutCard?.secretCodeHash) {
      setPinGateOpen(true);
    }
  }, [tutCardLoaded, tutCard?.secretCodeHash]);

  useEffect(() => {
    if (!profile?.uid) return;

    // Real-time listener for wallets subcollection
    const walletsRef = collection(db, 'users', profile.uid, 'wallets');
    const unsubscribeWallets = onSnapshot(walletsRef, (snapshot) => {
      const walletsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        let dateLinkedObj = new Date();
        if (data.dateLinked) {
          if (typeof data.dateLinked.toDate === 'function') {
            dateLinkedObj = data.dateLinked.toDate();
          } else {
            dateLinkedObj = new Date(data.dateLinked);
          }
        }
        return {
          id: docSnapshot.id,
          ...data,
          dateLinked: dateLinkedObj
        };
      });
      setWallets(walletsList);
      setWalletLoading(false);
    }, (error) => {
      console.error("Error listening to wallets:", error);
      setWalletLoading(false);
    });

    // Real-time listener for cards subcollection
    const cardsRef = collection(db, 'users', profile.uid, 'cards');
    const unsubscribeCards = onSnapshot(cardsRef, (snapshot) => {
      const cardsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        let dateAddedObj = new Date();
        if (data.dateAdded) {
          if (typeof data.dateAdded.toDate === 'function') {
            dateAddedObj = data.dateAdded.toDate();
          } else {
            dateAddedObj = new Date(data.dateAdded);
          }
        }
        return {
          id: docSnapshot.id,
          ...data,
          dateAdded: dateAddedObj
        };
      });
      setCards(cardsList);
    }, (error) => {
      console.error("Error listening to cards:", error);
    });

    // Real-time listener for payable T.U.T. Card security record
    const tutCardRef = doc(db, 'tut_cards', profile.uid);
    const unsubscribeTutCard = onSnapshot(tutCardRef, (snap) => {
      if (snap.exists()) {
        setTutCard(snap.data() as TutPayCardRecord);
      } else {
        setTutCard(null);
      }
      setTutCardLoaded(true);
    }, (error) => {
      console.warn("Notice listening to T.U.T. Card:", error);
      setTutCardLoaded(true);
    });

    return () => {
      unsubscribeWallets();
      unsubscribeCards();
      unsubscribeTutCard();
    };
  }, [profile?.uid]);

  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [cardMode, setCardMode] = useState<'debit' | 'credit'>('debit');

  // Vaultspecific states
  const [docSearch, setDocSearch] = useState('');
  const [docFilter, setDocFilter] = useState<'all' | 'vouchers' | 'receipts' | 'loans' | 'deposits' | 'certificates' | 'subscriptions'>('all');
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [showCert, setShowCert] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [vaultModalType, setVaultModalType] = useState<'credit_score' | 'total_loan' | 'total_deposits' | 'upcoming_repayment' | 'available_limit' | 'total_repaid' | 'reserve_fund' | 'total_documents' | null>(null);

  // Transfer States
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferIdentifier, setTransferIdentifier] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [showTransferPassword, setShowTransferPassword] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifiedRecipient, setVerifiedRecipient] = useState<UserProfile | null>(null);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState<any | null>(null);

  // New smart subscription checkout states
  const [subCheckoutMethod, setSubCheckoutMethod] = useState<'bkash' | 'nagad' | 'cash'>('bkash');
  const [subBillingMonths, setSubBillingMonths] = useState<number>(1);
  const [subPaymentMethod, setSubPaymentMethod] = useState<'balance' | 'gateway'>('balance');
  const [isProcessingInstantBuy, setIsProcessingInstantBuy] = useState(false);
  const [instantBuySuccess, setInstantBuySuccess] = useState(false);
  const [instantBuyError, setInstantBuyError] = useState<string | null>(null);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [cardTextureMode, setCardTextureMode] = useState<'auto' | 'standard' | 'bronze' | 'silver' | 'gold'>('auto');
  const [lockedSheenTier, setLockedSheenTier] = useState<'bronze' | 'silver' | 'gold' | null>(null);
  const [targetSubscriptionTier, setTargetSubscriptionTier] = useState<'bronze' | 'silver' | 'gold' | undefined>(undefined);

  // Deals & Partner Network state
  const [dealCategory, setDealCategory] = useState<string>('All');
  const [activeStoryModal, setActiveStoryModal] = useState<any | null>(null);
  const [activePromoVideoModal, setActivePromoVideoModal] = useState<{ title: string; brand: string; url?: string } | null>(null);
  const [selectedDealMemo, setSelectedDealMemo] = useState<any | null>(null);
  const featuredDropsScrollRef = useRef<HTMLDivElement>(null);

  // Instant 100% working subscription purchase with account deposit balance
  const handleInstantBalancePurchase = async (tier: 'bronze' | 'silver' | 'gold', monthsCount: number) => {
    if (!profile?.uid) return;
    const pricing = getSubscriptionPricing(tier, profile, monthsCount);
    
    if ((profile.totalDeposit || 0) < pricing.price) {
      setInstantBuyError(`Insufficient account balance. Required: ৳${pricing.price.toLocaleString()} BDT, Available: ৳${(profile.totalDeposit || 0).toLocaleString()} BDT. Please deposit balance or use mobile banking.`);
      return;
    }
    
    setIsProcessingInstantBuy(true);
    setInstantBuyError(null);
    try {
      const today = new Date();
      let expiresAt = new Date();
      
      // If user has active subscription, extend from existing expiry date
      if (profile.subscriptionStatus === 'active' && profile.subscriptionExpiresAt) {
        const currentExp = new Date(profile.subscriptionExpiresAt);
        if (currentExp > today) {
          expiresAt = new Date(currentExp);
        }
      }
      
      // Add months
      expiresAt.setMonth(expiresAt.getMonth() + monthsCount);
      
      // Calculate borrowing limit
      let baseLimit = 500;
      if (tier === 'silver') baseLimit = 1500;
      if (tier === 'gold') baseLimit = 2500;
      
      const wasOnTime = today.getDate() <= 5;
      const currentStreak = profile.continuousSubscriptionMonths || 0;
      const newStreak = currentStreak + (wasOnTime ? monthsCount : 1);
      if (newStreak >= 3) {
        baseLimit += 500;
      }
      if (monthsCount === 12) {
        baseLimit += 500; // Annual VIP loyalty bonus
      }
      
      const newDeposit = Math.max(0, (profile.totalDeposit || 0) - pricing.price);
      
      // 1. Update user profile in Firestore
      await updateDoc(doc(db, 'users', profile.uid), {
        totalDeposit: newDeposit,
        subscriptionStatus: 'active',
        subscriptionTier: tier,
        subscriptionExpiresAt: expiresAt.toISOString(),
        continuousSubscriptionMonths: newStreak,
        borrowingLimit: baseLimit,
        autoRenewSubscription: true,
        lastSubscriptionPaidAt: serverTimestamp()
      });
      
      // 2. Add approved transaction with unified IDs
      const subTrxId = `SUB-AUTO-${Date.now().toString(36).toUpperCase()}`;
      const subMemoId = `TUT-SUB-${Date.now().toString().slice(-6)}`;
      await addDoc(collection(db, 'transactions'), {
        userId: profile.uid,
        userName: profile.name,
        type: 'subscription',
        amount: pricing.price,
        method: 'Account Balance',
        accountNumber: profile.memberId || 'INTERNAL-WALLET',
        transactionId: subTrxId,
        memoId: subMemoId,
        status: 'confirmed',
        subscriptionTier: tier,
        subscriptionMonths: monthsCount,
        approvedAt: serverTimestamp(),
        timestamp: serverTimestamp()
      });
      
      // 3. Update system reserve
      try {
        const fundsDocRef = doc(db, 'system_controls', 'funds');
        await setDoc(fundsDocRef, {
          personalFund: increment(pricing.price),
          subscriptionFund: increment(pricing.price),
          totalReserve: increment(pricing.price),
          lastUpdated: serverTimestamp()
        }, { merge: true });

        const reservesDocRef = doc(db, 'system_controls', 'reserves');
        await setDoc(reservesDocRef, {
          primaryTarget: increment(pricing.price),
          subscriptionReserveContribution: increment(pricing.price),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn("Reserve funds sync note:", e);
      }
      
      // 4. Record detailed subscription fee fund entry (which user paid)
      try {
        await addDoc(collection(db, 'subscription_funds'), {
          userId: profile.uid,
          userName: profile.name || 'Member',
          userEmail: profile.email || '',
          userPhone: profile.phone || '',
          memberId: profile.memberId || 'N/A',
          tier: tier,
          tierName: tier === 'gold' ? 'Gold Sovereign' : tier === 'silver' ? 'Silver Executive' : 'Bronze',
          amount: pricing.price,
          durationMonths: monthsCount,
          paymentMethod: 'Account Balance',
          accountNumber: profile.memberId || 'INTERNAL-WALLET',
          transactionId: subTrxId,
          memoId: subMemoId,
          allocatedToReserve: true,
          reserveDestination: 'Main Zero-Usury Lending Liquidity Reserve',
          status: 'confirmed',
          timestamp: serverTimestamp(),
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Subscription funds record note:", e);
      }

      // 5. Audit log
      try {
        await addDoc(collection(db, 'audit_logs'), {
          action: 'instant_subscription_activated',
          performedBy: profile.uid,
          actorEmail: profile.email || 'member@tut.org',
          userName: profile.name,
          amount: pricing.price,
          tier: tier,
          timestamp: serverTimestamp()
        });
      } catch (e) {
        console.warn("Audit log note:", e);
      }

      // 6. Email notification & Chief Admin copy
      if (sendWorkflowNotification) {
        sendWorkflowNotification(
          'subscription_confirmed',
          profile.email || auth.currentUser?.email || undefined,
          profile.name,
          {
            uid: profile.uid,
            memberId: profile.memberId,
            type: 'subscription',
            tier,
            amount: pricing.price,
            method: 'Account Balance',
            accountNumber: profile.memberId || 'INTERNAL-WALLET',
            transactionId: subTrxId,
            memoId: subMemoId,
            subscriptionMonths: monthsCount
          }
        ).catch(() => {});
      }
      
      setInstantBuySuccess(true);
      setShowSubPaymentMode(false);
      if (addToast) {
        addToast('Charter Activated', `Congratulations! Your ${tier.toUpperCase()} tier is active! ৳${baseLimit.toLocaleString()} BDT limit unlocked.`, 'success');
      }
    } catch (err: any) {
      console.error("Instant subscription purchase failed:", err);
      setInstantBuyError(err?.message || "Failed to process instant subscription activation. Please try again.");
    } finally {
      setIsProcessingInstantBuy(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        autoRenewSubscription: false
      });
      setShowCancelConfirmModal(false);
    } catch (err) {
      console.error("Cancel subscription error:", err);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!profile?.uid) return;
    const current = profile.autoRenewSubscription ?? true;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        autoRenewSubscription: !current
      });
    } catch (err) {
      console.error("Toggle auto-renew error:", err);
    }
  };

  // Redesigned profile interactive states
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSecuritySettingsModal, setShowSecuritySettingsModal] = useState(false);
  const [showLinkedAccountsModal, setShowLinkedAccountsModal] = useState(false);

  // New Wallet & Card Management Form States
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);
  const [addWalletProvider, setAddWalletProvider] = useState<'bKash' | 'Nagad'>('bKash');
  const [addWalletHolder, setAddWalletHolder] = useState('');
  const [addWalletMobile, setAddWalletMobile] = useState('');
  const [addWalletDefault, setAddWalletDefault] = useState(false);

  const [showEditWalletModal, setShowEditWalletModal] = useState(false);
  const [editWalletId, setEditWalletId] = useState('');
  const [editWalletProvider, setEditWalletProvider] = useState<'bKash' | 'Nagad'>('bKash');
  const [editWalletHolder, setEditWalletHolder] = useState('');
  const [editWalletMobile, setEditWalletMobile] = useState('');

  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [addCardType, setAddCardType] = useState<'Visa' | 'Mastercard'>('Visa');
  const [addCardHolder, setAddCardHolder] = useState('');
  const [addCardNumber, setAddCardNumber] = useState('');
  const [addCardExpiry, setAddCardExpiry] = useState('');

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpWallet, setOtpWallet] = useState<any | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpTimer, setOtpTimer] = useState(120);
  const [otpResendDisabled, setOtpResendDisabled] = useState(true);

  const [localToast, setLocalToast] = useState<{ message: string, type: 'success' | 'danger' | 'info' } | null>(null);
  
  const showLocalToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setLocalToast({ message, type });
    setTimeout(() => setLocalToast(null), 4000);
  };

  // Global Escape key listener for smart instant modal dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedDealMemo) setSelectedDealMemo(null);
        else if (activeStoryModal) setActiveStoryModal(null);
        else if (activePromoVideoModal) setActivePromoVideoModal(null);
        else if (selectedDoc) setSelectedDoc(null);
        else if (vaultModalType) setVaultModalType(null);
        else if (showTransferModal) setShowTransferModal(false);
        else if (showQrModal) setShowQrModal(false);
        else if (showPinModal) setShowPinModal(false);
        else if (showAddWalletModal) setShowAddWalletModal(false);
        else if (showEditWalletModal) setShowEditWalletModal(false);
        else if (showAddCardModal) setShowAddCardModal(false);
        else if (showOtpModal) setShowOtpModal(false);
        else if (showCancelConfirmModal) setShowCancelConfirmModal(false);
        else if (lockedSheenTier) setLockedSheenTier(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedDealMemo, activeStoryModal, activePromoVideoModal, selectedDoc,
    vaultModalType, showTransferModal, showQrModal, showPinModal,
    showAddWalletModal, showEditWalletModal, showAddCardModal, showOtpModal,
    showCancelConfirmModal, lockedSheenTier
  ]);

  // Member Loan Summary using individual loan payment allocation engine
  const memberLoanSummary = useMemo(() => {
    return calculateMemberLoanAllocations(profile?.uid || '', transactions || [], profile);
  }, [profile?.uid, transactions, profile]);

  // Top-Level Vault Financial Calculations (Source of truth: loan allocation engine + profile)
  const remainingDebtVal = profile?.remainingDebt !== undefined 
    ? profile.remainingDebt 
    : memberLoanSummary.totalOutstanding;
  const totalLoanVal = memberLoanSummary.totalBorrowed > 0 
    ? memberLoanSummary.totalBorrowed 
    : (profile?.totalLoan || 0);
  const totalRepaidVal = profile?.totalRepaid !== undefined 
    ? profile.totalRepaid 
    : memberLoanSummary.totalRepaid;
  const outstandingPctVal = totalLoanVal > 0 ? Math.min(100, Math.max(0, Math.round((remainingDebtVal / totalLoanVal) * 100))) : 0;
  const totalDepositsVal = profile?.totalDeposit || 0;
  const reserveContribVal = profile?.reserveContribution || 0;
  const borrowLimitVal = profile?.borrowingLimit || 45000;
  const availableLimitVal = Math.max(0, borrowLimitVal - remainingDebtVal);
  const utilizationPctVal = borrowLimitVal > 0 ? Math.min(100, Math.round((remainingDebtVal / borrowLimitVal) * 100)) : 0;

  // Active confirmed loan that repayment will be allocated to next
  const activeAllocatedLoan = memberLoanSummary.loans.find(l => l.remainingAmount > 0);
  const activeLoan = activeAllocatedLoan 
    ? activeAllocatedLoan.rawTransaction 
    : transactions?.find(t => t.type === 'loan' && t.status === 'confirmed');

  // Dynamic Comprehensive Credit Score Calculation (Unified 300 to 850 Engine)
  const creditReport = useMemo(() => {
    return calculateComprehensiveCreditScore(profile, transactions);
  }, [profile, transactions]);

  const dynamicScore = creditReport.score;
  const scoreLabel = creditReport.label;
  const scoreBadgeStyle = creditReport.badgeStyle;
  const activeScoreSegments = Math.min(5, Math.max(1, Math.round((dynamicScore - 300) / 110)));

  // Real confirmed transactions & document counts (sorted newest-first: new-to-old wise)
  const userConfirmedTxs = useMemo(() => {
    if (!transactions) return [];
    return [...transactions]
      .filter((t) => t.status === 'confirmed')
      .sort((a, b) => {
        const getTs = (item: any) => {
          const t = item.timestamp || item.createdAt || item.date;
          if (!t) return 0;
          if (typeof t.toMillis === 'function') return t.toMillis();
          if (typeof t.toDate === 'function') return t.toDate().getTime();
          if (t.seconds) return t.seconds * 1000;
          const d = new Date(t);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getTs(b) - getTs(a);
      });
  }, [transactions]);
  const totalDocsCount = userConfirmedTxs.length + (profile?.status === 'approved' ? 1 : 0);

  useEffect(() => {
    if (!showOtpModal || otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setOtpResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showOtpModal, otpTimer]);

  const handleResendOtp = () => {
    setOtpTimer(120);
    setOtpResendDisabled(true);
    setOtpCode('');
    setOtpError('');
    showLocalToast("A new verification code has been dispatched via SMS!", "info");
  };

  // 1. Add Wallet
  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    if (addWalletMobile.length !== 11 || !addWalletMobile.startsWith('01')) {
      showLocalToast("Mobile number must be a valid 11-digit Bangladeshi number.", "danger");
      return;
    }
    if (!addWalletHolder.trim()) {
      showLocalToast("Account holder name is required.", "danger");
      return;
    }

    try {
      const isFirst = wallets.length === 0;
      const shouldBeDefault = addWalletDefault || isFirst;

      const walletPayload = {
        provider: addWalletProvider,
        holderName: addWalletHolder.trim(),
        mobileNumber: addWalletMobile.trim(),
        isVerified: false,
        isDefault: shouldBeDefault,
        dateLinked: serverTimestamp()
      };

      if (shouldBeDefault) {
        // Clear defaults on existing wallets
        for (const w of wallets) {
          if (w.isDefault) {
            await updateDoc(doc(db, 'users', profile.uid, 'wallets', w.id), { isDefault: false });
          }
        }
      }

      const docRef = await addDoc(collection(db, 'users', profile.uid, 'wallets'), walletPayload);
      
      if (sendWorkflowNotification) {
        sendWorkflowNotification(
          'wallet_added',
          profile.email || auth.currentUser?.email || undefined,
          profile.name,
          {
            uid: profile.uid,
            memberId: profile.memberId,
            wallet: {
              provider: walletPayload.provider,
              mobileNumber: walletPayload.mobileNumber,
              holderName: walletPayload.holderName
            }
          }
        ).catch(() => {});
      }

      // Auto-launch OTP Modal for the newly added wallet
      setOtpWallet({ id: docRef.id, ...walletPayload, dateLinked: new Date() });
      setOtpTimer(120);
      setOtpCode('');
      setOtpError('');
      setShowAddWalletModal(false);
      setShowOtpModal(true);
      
      // Clear fields
      setAddWalletHolder('');
      setAddWalletMobile('');
      setAddWalletDefault(false);
      
      showLocalToast(`${addWalletProvider} wallet added. Please verify ownership.`, "success");
    } catch (err) {
      console.error("Error adding wallet:", err);
      showLocalToast("Could not save wallet. Check permissions.", "danger");
    }
  };

  // 2. Edit Wallet
  const handleEditWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid || !editWalletId) return;
    if (editWalletMobile.length !== 11 || !editWalletMobile.startsWith('01')) {
      showLocalToast("Mobile number must be a valid 11-digit Bangladeshi number.", "danger");
      return;
    }
    if (!editWalletHolder.trim()) {
      showLocalToast("Account holder name is required.", "danger");
      return;
    }

    try {
      await updateDoc(doc(db, 'users', profile.uid, 'wallets', editWalletId), {
        holderName: editWalletHolder.trim(),
        mobileNumber: editWalletMobile.trim()
      });
      setShowEditWalletModal(false);
      showLocalToast("Wallet information updated successfully.", "success");
    } catch (err) {
      console.error("Error updating wallet:", err);
      showLocalToast("Failed to update wallet.", "danger");
    }
  };

  // 3. Delete Wallet
  const handleRemoveWallet = async (walletId: string) => {
    if (!profile?.uid) return;
    if (!confirm("Are you sure you want to unlink this payment wallet?")) return;
    try {
      await deleteDoc(doc(db, 'users', profile.uid, 'wallets', walletId));
      showLocalToast("Wallet unlinked successfully.", "success");
    } catch (err) {
      console.error("Error removing wallet:", err);
      showLocalToast("Failed to remove wallet.", "danger");
    }
  };

  // 4. Set Wallet as Default
  const handleSetDefaultWallet = async (walletId: string) => {
    if (!profile?.uid) return;
    try {
      // Step 1: Set target wallet as default
      await updateDoc(doc(db, 'users', profile.uid, 'wallets', walletId), { isDefault: true });
      // Step 2: Remove default from others
      for (const w of wallets) {
        if (w.id !== walletId && w.isDefault) {
          await updateDoc(doc(db, 'users', profile.uid, 'wallets', w.id), { isDefault: false });
        }
      }
      showLocalToast("Designated as primary receiving wallet.", "success");
    } catch (err) {
      console.error("Error setting default:", err);
      showLocalToast("Failed to update default receiving wallet.", "danger");
    }
  };

  // 5. Submit OTP Verification (UI-only backend)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid || !otpWallet) return;
    if (otpCode.trim().length !== 6) {
      setOtpError("Please enter a valid 6-digit authentication token.");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', profile.uid, 'wallets', otpWallet.id), { isVerified: true });
      if (sendWorkflowNotification) {
        sendWorkflowNotification(
          'wallet_verified',
          profile.email || auth.currentUser?.email || undefined,
          profile.name,
          {
            uid: profile.uid,
            memberId: profile.memberId,
            wallet: {
              provider: otpWallet.provider,
              mobileNumber: otpWallet.mobileNumber,
              holderName: otpWallet.holderName
            }
          }
        ).catch(() => {});
      }
      setShowOtpModal(false);
      setOtpWallet(null);
      showLocalToast(`${otpWallet.provider} wallet has been fully verified and bonded!`, "success");
    } catch (err) {
      console.error("Error verifying OTP in Firestore:", err);
      setOtpError("Authentication failed. Ensure database connections are active.");
    }
  };

  // 6. Add Bank Card (Beta Waitlist)
  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    
    // Simple validation
    const digitsOnly = addCardNumber.replace(/\s/g, '');
    if (digitsOnly.length < 12 || digitsOnly.length > 19) {
      showLocalToast("Invalid credit card number.", "danger");
      return;
    }
    if (!addCardHolder.trim()) {
      showLocalToast("Cardholder name is required.", "danger");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(addCardExpiry)) {
      showLocalToast("Expiry date must be in MM/YY format.", "danger");
      return;
    }

    try {
      const last4 = digitsOnly.slice(-4);
      // Mask card with standard banking bullet circles as requested
      const maskedCard = `${addCardType === 'Visa' ? '4' : '5'}••• •••• •••• ${last4}`;

      const cardPayload = {
        cardType: addCardType,
        holderName: addCardHolder.toUpperCase().trim(),
        cardNumber: maskedCard,
        expiryDate: addCardExpiry.trim(),
        dateAdded: serverTimestamp()
      };

      await addDoc(collection(db, 'users', profile.uid, 'cards'), cardPayload);
      setShowAddCardModal(false);
      
      // Clear inputs
      setAddCardHolder('');
      setAddCardNumber('');
      setAddCardExpiry('');

      showLocalToast("Your account has been added to the Visa/Mastercard Beta waitlist!", "success");
    } catch (err) {
      console.error("Error adding card:", err);
      showLocalToast("Could not submit card. Check security protocols.", "danger");
    }
  };

  // 7. Remove Card waitlist
  const handleRemoveCard = async (cardId: string) => {
    if (!profile?.uid) return;
    if (!confirm("Remove this card from the Beta waitlist?")) return;
    try {
      await deleteDoc(doc(db, 'users', profile.uid, 'cards', cardId));
      showLocalToast("Card waitlist entry cancelled.", "success");
    } catch (err) {
      console.error("Error removing card:", err);
    }
  };
  
  // Custom states for security toggles
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [alertLogsEnabled, setAlertLogsEnabled] = useState(true);
  
  // Custom state for security pin simulation
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  const handleVerifyRecipient = async () => {
    if (!transferIdentifier.trim()) {
      setTransferError('Please enter a Member ID, Phone number, or Email.');
      return;
    }
    
    setVerifyLoading(true);
    setTransferError('');
    setVerifiedRecipient(null);

    try {
      const identifierClean = transferIdentifier.trim();
      const currentUserUid = auth.currentUser?.uid;

      if (!currentUserUid) {
        setTransferError('You must be logged in to transfer.');
        setVerifyLoading(false);
        return;
      }

      // Generate smart candidate variations for Member ID, Phone, and Email
      const candidates = new Set<string>();
      candidates.add(identifierClean);
      candidates.add(identifierClean.toLowerCase());
      candidates.add(identifierClean.toUpperCase());

      // Phone number variations
      const digits = identifierClean.replace(/\D/g, '');
      if (digits) {
        candidates.add(digits);
        
        let base11 = '';
        if (digits.length === 11 && digits.startsWith('0')) {
          base11 = digits;
        } else if (digits.length === 13 && digits.startsWith('880')) {
          base11 = '0' + digits.substring(3);
        } else if (digits.length === 14 && digits.startsWith('880')) {
          base11 = '0' + digits.substring(4);
        } else if (digits.length === 10 && !digits.startsWith('0')) {
          base11 = '0' + digits;
        }

        if (base11 && base11.length === 11) {
          candidates.add(base11);
          // Standard Bangladeshi splits
          candidates.add(`${base11.substring(0, 5)}-${base11.substring(5)}`);
          candidates.add(`${base11.substring(0, 4)}-${base11.substring(4)}`);
          candidates.add(`+88${base11.substring(0, 5)}-${base11.substring(5)}`);
          candidates.add(`+88${base11}`);
          candidates.add(`88${base11}`);
        }
      }

      // Member ID suffix matching
      const numSuffixMatch = identifierClean.match(/\d+$/);
      if (numSuffixMatch) {
        const suffix = numSuffixMatch[0];
        candidates.add(`TUT-MBR-2026-${suffix}`);
        candidates.add(`TUT-MBR-2026-${suffix.padStart(4, '0')}`);
        candidates.add(`MBR-${suffix}`);
        candidates.add(`TUT-${suffix}`);
        candidates.add(`TUT-MBR-${suffix}`);
      }

      const uniqueCandidates = Array.from(candidates);
      let foundUser: UserProfile | null = null;

      // 1. Query by unique identifier candidates (Member ID, Phone, Email)
      const queriesToRun: any[] = [];
      uniqueCandidates.forEach(cand => {
        queriesToRun.push(query(collection(db, 'users'), where('memberId', '==', cand)));
        queriesToRun.push(query(collection(db, 'users'), where('phone', '==', cand)));
        if (cand.includes('@')) {
          queriesToRun.push(query(collection(db, 'users'), where('email', '==', cand.toLowerCase())));
        }
      });

      if (queriesToRun.length > 0) {
        // Query up to 30 queries in parallel chunks of 10
        const chunkSize = 10;
        for (let i = 0; i < queriesToRun.length; i += chunkSize) {
          const chunk = queriesToRun.slice(i, i + chunkSize);
          const snaps = await Promise.all(chunk.map(q => getDocs(q)));
          for (const snap of snaps) {
            if (!snap.empty) {
              foundUser = { uid: snap.docs[0].id, ...(snap.docs[0].data() as any) } as UserProfile;
              break;
            }
          }
          if (foundUser) break;
        }
      }

      // 2. Query by Name (Case-insensitive matching / Prefix check) if still not found and input looks like a name
      if (!foundUser && /^[a-zA-Z\s.-]+$/.test(identifierClean) && identifierClean.length >= 3) {
        const titleCase = identifierClean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        const upper = identifierClean.toUpperCase();
        const lower = identifierClean.toLowerCase();

        const nameCandidates = Array.from(new Set([identifierClean, titleCase, upper, lower]));
        const nameQueries = nameCandidates.map(nc => 
          query(collection(db, 'users'), where('name', '==', nc))
        );
        
        const nameSnaps = await Promise.all(nameQueries.map(q => getDocs(q)));
        for (const snap of nameSnaps) {
          if (!snap.empty) {
            foundUser = { uid: snap.docs[0].id, ...(snap.docs[0].data() as any) } as UserProfile;
            break;
          }
        }

        // If still not found, do a prefix query on "name"
        if (!foundUser) {
          const prefixQuery = query(
            collection(db, 'users'),
            where('name', '>=', titleCase),
            where('name', '<=', titleCase + '\uf8ff')
          );
          const prefixSnap = await getDocs(prefixQuery);
          if (!prefixSnap.empty) {
            foundUser = { uid: prefixSnap.docs[0].id, ...(prefixSnap.docs[0].data() as any) } as UserProfile;
          }
        }
      }

      if (!foundUser) {
        setTransferError('No T.U.T. account found with this identifier.');
      } else if (foundUser.uid === currentUserUid) {
        setTransferError('You cannot transfer money to your own account.');
      } else if (foundUser.status !== 'approved') {
        setTransferError('Recipient account is registered but not approved by the Authority.');
      } else {
        setVerifiedRecipient(foundUser);
      }
    } catch (err: any) {
      console.error('Error verifying recipient:', err);
      setTransferError('Failed to verify recipient. Try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const executeTransfer = async (amount: number) => {
    if (!verifiedRecipient || !auth.currentUser) return;
    const senderUid = auth.currentUser.uid;
    const recipientUid = verifiedRecipient.uid;

    const result = await executeAtomicP2PTransfer(db, {
      senderUid,
      recipientUid,
      amount,
      senderName: profile.name,
      recipientName: verifiedRecipient.name,
      senderMemberId: profile.memberId || 'Approved Member',
      recipientMemberId: verifiedRecipient.memberId || 'Approved Member',
      reference: transferReference.trim()
    });

    // Record successful state
    setTransferSuccess({
      amount: result.transferredAmount,
      recipientName: verifiedRecipient.name,
      recipientId: verifiedRecipient.memberId || 'Approved Member',
      memoId: result.senderMemoId,
      date: new Date(),
      reference: transferReference.trim()
    });
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedRecipient || !auth.currentUser) return;

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransferError('Please enter a valid transfer amount.');
      return;
    }

    if (amount > profile.totalDeposit) {
      setTransferError(`Insufficient balance. Your current Total Deposit is ৳${profile.totalDeposit.toLocaleString()}`);
      return;
    }

    if (!transferPassword) {
      setTransferError('Please enter your account password to authorize this transfer.');
      return;
    }

    setTransferLoading(true);
    setTransferError('');

    try {
      const user = auth.currentUser;
      if (user && user.email) {
        let authPassword = transferPassword;
        // Check if admin credentials override is active
        if (user.email === 'tahsinullahtusher999@gmail.com' && transferPassword === '9900') {
          authPassword = '9900_TUT2026_ADMIN';
        }
        const credential = EmailAuthProvider.credential(user.email, authPassword);
        await reauthenticateWithCredential(user, credential);
      } else {
        throw new Error('No registered email found for authentication.');
      }

      // Success, perform transfer!
      await executeTransfer(amount);
    } catch (authErr: any) {
      console.error('Password verification failed:', authErr);
      let errorMsg = 'Incorrect account password. Please try again.';
      if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
        errorMsg = 'Incorrect password. Please enter the password you use to log into your T.U.T. account.';
      } else if (authErr.code === 'auth/user-mismatch') {
        errorMsg = 'Credential mismatch. Please use the password for this specific logged-in account.';
      } else if (authErr.code === 'auth/too-many-requests') {
        errorMsg = 'Too many failed attempts. Your account has been temporarily locked. Please try again later.';
      } else if (authErr.message) {
        errorMsg = authErr.message;
      }
      setTransferError(errorMsg);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleGoogleVerify = async () => {
    if (!verifiedRecipient || !auth.currentUser) return;

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransferError('Please enter a valid transfer amount.');
      return;
    }

    if (amount > profile.totalDeposit) {
      setTransferError(`Insufficient balance. Your current Total Deposit is ৳${profile.totalDeposit.toLocaleString()}`);
      return;
    }

    setTransferLoading(true);
    setTransferError('');

    try {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(auth.currentUser, provider);
      
      // If successful, execute the transfer
      await executeTransfer(amount);
    } catch (authErr: any) {
      console.error('Google reauthentication failed:', authErr);
      setTransferError('Google authentication failed. Please try again.');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCloseTransferModal = () => {
    setShowTransferModal(false);
    setTransferIdentifier('');
    setTransferAmount('');
    setTransferPassword('');
    setShowTransferPassword(false);
    setVerifiedRecipient(null);
    setTransferError('');
    setTransferSuccess(null);
    setTransferReference('');
  };

  return (
    <div className={cn(
      "space-y-4 pb-24 md:pb-8 text-left mx-auto px-1 sm:px-3 lg:px-4 relative",
      memberTab === 'partners'
        ? "w-full max-w-5xl xl:max-w-6xl"
        : (memberTab === 'memos' || memberTab === 'subscription')
          ? "w-full max-w-6xl xl:max-w-7xl"
          : memberTab === 'wallets'
            ? "w-full max-w-4xl xl:max-w-5xl"
            : "w-full max-w-lg lg:max-w-5xl xl:max-w-6xl"
    )}>
      
      {/* Top Executive Banking Bar - Visible on Home (dashboard) tab */}
      {memberTab === 'dashboard' && (() => {
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        return (
          <div className="p-3.5 sm:px-4 sm:py-3.5 bg-[#0B1222] border border-white/[0.07] rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Identity Row */}
            <div className="flex items-center justify-between gap-3 min-w-0 flex-1">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setMemberTab('profile')}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-white/15 overflow-hidden bg-slate-900 cursor-pointer hover:border-blue-400/50 transition-colors active:scale-95 flex items-center justify-center flex-shrink-0"
                  title="View Profile"
                >
                  {profile.photoUrl ? (
                    <img src={profile.photoUrl} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-blue-400" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-400 leading-none mb-1">{timeGreeting}</p>
                  <h2 className="text-sm sm:text-[15px] font-bold text-white tracking-tight truncate">
                    {profile.name}
                  </h2>
                  <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-mono mt-0.5 truncate">
                    <span className="truncate">{profile.memberId || 'Verified Member'}</span>
                    <span aria-hidden="true" className="text-slate-600 shrink-0">·</span>
                    <span className="capitalize text-slate-300 shrink-0">{profile.subscriptionTier || 'Standard'}</span>
                  </div>
                </div>
              </div>

              {/* Mobile Privacy Balance Mask Toggle */}
              <button
                type="button"
                onClick={togglePrivacyMode}
                className="sm:hidden w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer tap-interactive shrink-0"
                title={hideBalances ? 'Show balances' : 'Hide balances'}
                aria-label={hideBalances ? 'Show balances' : 'Hide balances'}
              >
                {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Credit Score & Desktop Privacy Toggle */}
            <div className="flex items-center justify-between sm:justify-end gap-2 pt-2.5 sm:pt-0 border-t border-white/[0.06] sm:border-t-0 shrink-0">
              <button
                type="button"
                onClick={togglePrivacyMode}
                className="hidden sm:flex w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.08] text-slate-400 hover:text-white items-center justify-center transition-colors cursor-pointer tap-interactive shrink-0"
                title={hideBalances ? 'Show balances' : 'Hide balances'}
                aria-label={hideBalances ? 'Show balances' : 'Hide balances'}
              >
                {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setShowCreditModal(true)}
                className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.08] hover:border-white/15 flex sm:block items-center justify-between text-left sm:text-right cursor-pointer group transition-colors tap-interactive"
                title="View credit scorecard"
              >
                <span className="text-[11px] sm:text-[10px] font-medium text-slate-400 sm:block leading-none sm:mb-1">
                  Credit Score
                </span>
                <div className="flex items-center justify-end gap-1.5 font-mono tabular-nums leading-none">
                  <span className={cn(
                    "text-sm sm:text-[15px] font-bold",
                    dynamicScore >= 640 ? "text-emerald-400" :
                    dynamicScore >= 580 ? "text-amber-300" :
                    "text-rose-400"
                  )}>
                    {dynamicScore}
                  </span>
                  <span aria-hidden="true" className="text-slate-600 text-[10px]">·</span>
                  <span className={cn(
                    "text-[11px] sm:text-[10px] font-semibold",
                    dynamicScore >= 640 ? "text-emerald-400/90" :
                    dynamicScore >= 580 ? "text-amber-300/90" :
                    "text-rose-400"
                  )}>
                    {dynamicScore < 580 ? 'Low' : scoreLabel}
                  </span>
                </div>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Dynamic Tab Panel Views */}
      <div key={memberTab} className="mt-1 min-h-[40vh] animate-fade-in">
        
        {/* TAB 1: HOME (Dashboard, virtual card, toggles, recent activity) */}
        {memberTab === 'dashboard' && (
          <div className="space-y-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0 items-start">
            {/* Left Executive Column: Virtual Card, Limits & Actions */}
            <div className="lg:col-span-5 space-y-4">
              {/* Card Finish Selector & Tier Upgrade */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Card Finish</span>
                <div className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded-lg border border-white/[0.08] text-[10px] font-semibold">
                  {(['auto', 'bronze', 'silver', 'gold'] as const).map((mode) => {
                    const tierRankMap: Record<string, number> = { standard: 0, bronze: 1, silver: 2, gold: 3 };
                    const userCurrentTier = (profile.subscriptionTier || (profile.subscriptionStatus === 'active' ? 'bronze' : 'standard'));
                    const isMaxTierUser = userCurrentTier === 'gold';
                    const isLocked = mode !== 'auto' && !isMaxTierUser && (tierRankMap[mode] > tierRankMap[userCurrentTier]);

                    const handleSheenClick = () => {
                      if (mode === 'auto') {
                        setCardTextureMode('auto');
                        return;
                      }
                      if (isMaxTierUser || tierRankMap[mode] <= tierRankMap[userCurrentTier]) {
                        setCardTextureMode(mode);
                      } else {
                        setLockedSheenTier(mode);
                      }
                    };

                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={handleSheenClick}
                        className={cn(
                          "px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 capitalize",
                          cardTextureMode === mode
                            ? "bg-slate-800 text-white shadow-xs border border-white/10"
                            : isLocked
                            ? "text-slate-500 hover:text-[#DFC07C]"
                            : "text-slate-400 hover:text-white"
                        )}
                        title={isLocked ? `Upgrade to ${mode} to unlock finish` : undefined}
                      >
                        <span>{mode === 'auto' ? 'Auto' : mode}</span>
                        {isLocked && <Lock className="w-2.5 h-2.5 text-[#C8A65E]/80" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {profile.subscriptionStatus !== 'active' && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetSubscriptionTier(undefined);
                    setMemberTab('subscription');
                  }}
                  className="text-[10px] font-semibold text-[#EAD39C] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Crown className="w-3 h-3 text-[#DFC07C]" />
                  <span>Unlock Tiers</span>
                </button>
              )}
            </div>

            {/* Premium Banking Virtual Card with Tier Textures */}
            <BankingTierCard
              tier={cardTextureMode === 'auto' ? (profile.subscriptionTier || 'standard') : cardTextureMode}
              status={profile.subscriptionStatus}
              name={profile.name}
              memberId={profile.memberId}
              memberUid={profile.uid}
              totalDeposit={profile.totalDeposit}
              remainingDebt={profile.remainingDebt}
              subscriptionExpiresAt={profile.subscriptionExpiresAt}
              tutCard={tutCard}
              showDetailsToggle={true}
              hideBalances={hideBalances}
              onCardClick={() => setMemberTab('subscription')}
              onManageSecurity={() => setMemberTab('memos')}
            />

            {/* Membership & Limits Box - Smart Color-Changing Borrowing Limit System */}
            {(() => {
              const activeTier = profile.subscriptionTier || 'standard';
              const maxBorrowCap = (profile.subscriptionStatus === 'active' || profile.subscriptionStatus === 'pending_approval')
                ? (profile.borrowingLimit || (activeTier === 'gold' ? 2500 : activeTier === 'silver' ? 1500 : activeTier === 'bronze' ? 500 : 0))
                : (activeTier === 'gold' ? 2500 : activeTier === 'silver' ? 1500 : activeTier === 'bronze' ? 500 : 0);

              const usedDebt = profile.remainingDebt || 0;
              const usedPercent = maxBorrowCap > 0 ? Math.min(100, Math.round((usedDebt / maxBorrowCap) * 100)) : 0;
              const availableBorrow = Math.max(0, maxBorrowCap - usedDebt);

              const planDisplayName = activeTier === 'gold' ? 'Gold Sovereign' : activeTier === 'silver' ? 'Silver Executive' : activeTier === 'bronze' ? 'Bronze Reserve' : 'Standard Member';
              const planColor = activeTier === 'gold' ? '#DFC07C' : activeTier === 'silver' ? '#CBD5E1' : activeTier === 'bronze' ? '#D39D73' : '#64748B';

              // Smart usage-based color theme: Low (Emerald) -> Moderate (Amber/Yellow) -> Elevated (Orange) -> High/Critical (Crimson Red)
              const usageTheme = maxBorrowCap <= 0
                ? {
                    barGradient: 'from-slate-600 to-slate-500',
                    barGlow: '',
                    textColor: 'text-slate-400',
                    statusLabel: 'No active limit',
                    cardBorder: 'border-slate-700/40 hover:border-slate-600/70',
                    ambientGlow: 'from-slate-500/[0.03] to-transparent',
                    badgeText: 'text-slate-400',
                  }
                : usedPercent <= 30
                ? {
                    barGradient: 'from-emerald-500 via-emerald-400 to-teal-400',
                    barGlow: 'shadow-[0_0_12px_rgba(16,185,129,0.55)]',
                    textColor: 'text-emerald-400',
                    statusLabel: usedPercent === 0 ? 'Full capacity ready' : 'Low usage · Healthy',
                    cardBorder: 'border-emerald-500/20 hover:border-emerald-500/45',
                    ambientGlow: 'from-emerald-500/[0.06] to-transparent',
                    badgeText: 'text-emerald-400/90',
                  }
                : usedPercent <= 60
                ? {
                    barGradient: 'from-lime-400 via-amber-400 to-yellow-400',
                    barGlow: 'shadow-[0_0_12px_rgba(250,204,21,0.45)]',
                    textColor: 'text-amber-300',
                    statusLabel: 'Moderate usage',
                    cardBorder: 'border-amber-500/25 hover:border-amber-500/50',
                    ambientGlow: 'from-amber-500/[0.06] to-transparent',
                    badgeText: 'text-amber-300/90',
                  }
                : usedPercent <= 80
                ? {
                    barGradient: 'from-amber-500 via-orange-500 to-orange-400',
                    barGlow: 'shadow-[0_0_12px_rgba(249,115,22,0.55)]',
                    textColor: 'text-orange-400',
                    statusLabel: 'Elevated usage',
                    cardBorder: 'border-orange-500/30 hover:border-orange-500/55',
                    ambientGlow: 'from-orange-500/[0.07] to-transparent',
                    badgeText: 'text-orange-400/90',
                  }
                : {
                    barGradient: 'from-orange-500 via-rose-500 to-red-500',
                    barGlow: 'shadow-[0_0_14px_rgba(244,63,94,0.65)]',
                    textColor: 'text-rose-400',
                    statusLabel: usedPercent >= 95 ? 'Limit nearly full' : 'High usage',
                    cardBorder: 'border-rose-500/35 hover:border-rose-500/60',
                    ambientGlow: 'from-rose-500/[0.09] to-transparent',
                    badgeText: 'text-rose-400',
                  };

              const renewalDateDisplay = profile.subscriptionExpiresAt
                ? format(new Date(profile.subscriptionExpiresAt), 'dd MMM yyyy')
                : profile.subscriptionStatus === 'active'
                ? 'Active'
                : 'N/A';

              return (
                <div 
                  onClick={() => setMemberTab('subscription')}
                  className={cn(
                    "relative overflow-hidden rounded-2xl bg-[#0B1222] border transition-colors duration-200 cursor-pointer p-4 group active:scale-[0.99]",
                    usageTheme.cardBorder
                  )}
                >
                  {/* Subtle smart ambient wash reflecting utilization level */}
                  <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br transition-colors duration-300", usageTheme.ambientGlow)} />

                  <div className="relative space-y-2.5">
                    {/* Top Row: Current Plan & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: planColor }}
                        />
                        <span className="text-xs font-semibold text-slate-300 tracking-tight shrink-0">
                          Current Plan
                        </span>
                        <span aria-hidden="true" className="text-slate-600 text-xs">·</span>
                        <span 
                          className="text-xs font-bold tracking-tight truncate"
                          style={{ color: planColor }}
                        >
                          {planDisplayName}
                        </span>
                      </div>

                      <span className={cn(
                        "text-[10.5px] font-bold uppercase tracking-wider font-mono shrink-0",
                        profile.subscriptionStatus === 'active'
                          ? "text-emerald-400"
                          : profile.subscriptionStatus === 'pending_approval'
                          ? "text-amber-400"
                          : "text-slate-400"
                      )}>
                        {profile.subscriptionStatus === 'active' ? 'Active' : profile.subscriptionStatus === 'pending_approval' ? 'Pending' : 'Inactive'}
                      </span>
                    </div>

                    {/* Middle Row: Max Borrow Cap & Remaining Available */}
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400 font-medium block">
                          Max Borrow Cap
                        </span>
                        {maxBorrowCap > 0 && (
                          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                            {hideBalances ? '৳ •••••' : `৳${availableBorrow.toLocaleString()}`} available
                          </span>
                        )}
                      </div>
                      <span className="text-lg sm:text-xl font-extrabold font-mono tabular-nums text-white tracking-tight">
                        {hideBalances ? '৳ •••••' : `৳${maxBorrowCap.toLocaleString()}`}
                      </span>
                    </div>

                    {/* Smart Color-Shifting Progress Track with Subtle Threshold Markers */}
                    <div className="relative w-full h-2 bg-slate-950/90 rounded-full overflow-hidden border border-white/[0.07] p-[1px]">
                      <div className="pointer-events-none absolute inset-y-0 left-[30%] w-px bg-white/10 z-10" />
                      <div className="pointer-events-none absolute inset-y-0 left-[60%] w-px bg-white/10 z-10" />
                      <div className="pointer-events-none absolute inset-y-0 left-[80%] w-px bg-white/10 z-10" />

                      <div 
                        className={cn(
                          "h-full bg-gradient-to-r transition-all duration-500 ease-out rounded-full",
                          usageTheme.barGradient,
                          usedPercent > 0 ? usageTheme.barGlow : ''
                        )}
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>

                    {/* Bottom Row: Dynamic Usage % & Next Renewal Date */}
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn("font-bold font-mono tabular-nums transition-colors duration-300", usageTheme.textColor)}>
                          {usedPercent}% used
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className={cn("font-medium truncate transition-colors duration-300", usageTheme.badgeText)}>
                          {usageTheme.statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-slate-400 font-medium">Renewal</span>
                        <span className="font-semibold text-slate-200 font-mono tabular-nums">
                          {renewalDateDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Quick Actions Rail — Modern Revolut/Wise Inspired */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-slate-400 tracking-wide px-0.5">Quick Actions</h4>
              <div className="p-2.5 rounded-2xl border border-white/[0.07] bg-[#0B1222] grid grid-cols-5 gap-1.5">
                {[
                  {
                    action: 'loan' as const,
                    label: 'Borrow',
                    icon: ArrowUpRight,
                    ring: 'bg-blue-500/12 border-blue-500/25 text-blue-400 group-hover:bg-blue-500/20',
                  },
                  {
                    action: 'pay_due' as const,
                    label: 'Repay',
                    icon: CreditCard,
                    ring: 'bg-rose-500/12 border-rose-500/25 text-rose-400 group-hover:bg-rose-500/20',
                  },
                  {
                    action: 'deposit' as const,
                    label: 'Deposit',
                    icon: Wallet,
                    ring: 'bg-emerald-500/12 border-emerald-500/25 text-emerald-400 group-hover:bg-emerald-500/20',
                  },
                  {
                    action: 'refund' as const,
                    label: 'Withdraw',
                    icon: ArrowDownLeft,
                    ring: 'bg-amber-500/12 border-amber-500/25 text-amber-300 group-hover:bg-amber-500/20',
                  },
                  {
                    action: 'transfer' as const,
                    label: 'Transfer',
                    icon: Send,
                    ring: 'bg-indigo-500/12 border-indigo-500/25 text-indigo-300 group-hover:bg-indigo-500/20',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.action}
                      type="button"
                      onClick={() => onRequestAction(item.action)}
                      className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer group tap-interactive"
                    >
                      <div className={cn("w-10 h-10 rounded-2xl border flex items-center justify-center transition-transform duration-150 group-hover:-translate-y-0.5", item.ring)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white transition-colors whitespace-nowrap mt-1.5">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direct Concierge Support Link */}
            <a 
              href="https://wa.me/8801713710607" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-3 rounded-2xl border border-white/[0.07] bg-[#0B1222] hover:border-emerald-500/30 hover:bg-slate-900/90 transition-colors group flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Direct Member Desk</p>
                  <p className="text-[11px] text-slate-400">WhatsApp concierge support</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </a>
            </div>

            {/* Right Operations Column: Pending Queue & Activity Ledger */}
            <div className="lg:col-span-7 space-y-4">
            {/* Awaiting Pending Verification Queue */}
            {pendingTransactions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <h4 className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Awaiting Verification</span>
                  </h4>
                  <span className="text-[11px] font-mono tabular-nums text-amber-300/80">
                    {pendingTransactions.length} pending
                  </span>
                </div>
                <div className="space-y-2">
                  {pendingTransactions.map(tx => (
                    <div key={tx.id} className="bg-[#0B1222] border border-amber-500/25 rounded-2xl p-3.5 flex justify-between items-center group hover:border-amber-400/45 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border", 
                          tx.type === 'loan' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : 
                          tx.type === 'refund' ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : 
                          tx.type === 'subscription' ? "bg-[#DFC07C]/10 text-[#EAD39C] border-[#DFC07C]/25" :
                          "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        )}>
                          {tx.type === 'loan' ? <ArrowUpRight className="w-4 h-4" /> : 
                           tx.type === 'refund' ? <ArrowUpRight className="w-4 h-4" /> :
                           tx.type === 'subscription' ? <Award className="w-4 h-4" /> :
                           <ArrowDownLeft className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold capitalize text-white truncate">
                            {tx.type === 'loan' ? 'Loan Request' : tx.type === 'deposit' ? 'Security Deposit' : tx.type === 'refund' ? 'Refund Request' : tx.type === 'pay_due' ? 'Due Repayment' : tx.type}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {tx.method ? `Via ${tx.method}` : 'Processing'} · {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd MMM, HH:mm') : 'Just now'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        <p className="text-sm font-bold text-amber-300 font-mono tabular-nums">
                          {hideBalances ? '৳ •••••' : `৳${tx.amount.toLocaleString()}`}
                        </p>
                        <span className="text-[10.5px] font-semibold text-amber-400/85 block mt-0.5">
                          Pending
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Latest Transactions Activity Ledger */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center px-0.5">
                <h4 className="text-xs font-semibold text-slate-300">Latest Transactions</h4>
                <button
                  type="button"
                  onClick={() => setMemberTab('memos')}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>See Vault</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="bg-[#0B1222] rounded-2xl border border-white/[0.07] divide-y divide-white/[0.05] overflow-hidden">
                {confirmedTransactions.slice(0, 5).map((tx) => {
                  let sign = '+';
                  let colorClass = 'text-emerald-400';
                  let title = '';
                  let subtitle = '';
                  let IconComponent = ArrowDownLeft;
                  let iconStyle = 'bg-emerald-500/12 border-emerald-500/20 text-emerald-400';

                  switch (tx.type) {
                    case 'deposit':
                      sign = '+';
                      colorClass = 'text-emerald-400';
                      title = 'Portal Deposit';
                      subtitle = `Via ${tx.method}`;
                      IconComponent = ArrowDownLeft;
                      iconStyle = 'bg-emerald-500/12 border-emerald-500/20 text-emerald-400';
                      break;
                    case 'loan':
                      sign = '+';
                      colorClass = 'text-blue-400';
                      title = 'Loan Disbursed';
                      subtitle = tx.method === 'Recharge' 
                        ? `Recharge (${tx.mobileOperator || 'GP'})` 
                        : `Via ${tx.method}`;
                      IconComponent = ArrowUpRight;
                      iconStyle = 'bg-blue-500/12 border-blue-500/20 text-blue-400';
                      break;
                    case 'refund':
                      sign = '+';
                      colorClass = 'text-emerald-400';
                      title = 'Deposit Refund';
                      subtitle = tx.method === 'Recharge' 
                        ? `Recharge (${tx.mobileOperator || 'GP'})` 
                        : `Via ${tx.method}`;
                      IconComponent = ArrowDownLeft;
                      iconStyle = 'bg-teal-500/12 border-teal-500/20 text-teal-400';
                      break;
                    case 'pay_due':
                      sign = '-';
                      colorClass = 'text-slate-200';
                      title = 'Due Repayment';
                      subtitle = `Via ${tx.method}`;
                      IconComponent = CreditCard;
                      iconStyle = 'bg-rose-500/12 border-rose-500/20 text-rose-400';
                      break;
                    case 'subscription':
                      sign = '-';
                      colorClass = 'text-[#EAD39C]';
                      title = `${tx.subscriptionMonths ? tx.subscriptionMonths + '-Month' : 'Tier'} Membership`;
                      subtitle = 'Plan activation';
                      IconComponent = Award;
                      iconStyle = 'bg-[#DFC07C]/12 border-[#DFC07C]/25 text-[#EAD39C]';
                      break;
                    case 'merchant_payment':
                    case 'card_payment':
                    case 'wallet_payment':
                      sign = '-';
                      colorClass = 'text-amber-300';
                      title = tx.merchantName ? `Paid ${tx.merchantName}` : 'Connected App Payment';
                      subtitle = tx.method ? `Via ${tx.method}${tx.cardLast4 ? ` (••${tx.cardLast4})` : ''}` : 'T.U.T. Gateway';
                      IconComponent = Zap;
                      iconStyle = 'bg-amber-500/12 border-amber-500/25 text-amber-300';
                      break;
                    default:
                      title = 'Transaction';
                      subtitle = `${tx.method || 'Ledger'}`;
                      IconComponent = FileText;
                      iconStyle = 'bg-slate-500/12 border-slate-500/20 text-slate-300';
                  }

                  if (tx.isTransfer) {
                    IconComponent = Send;
                    iconStyle = 'bg-cyan-500/12 border-cyan-500/20 text-cyan-400';
                    if (tx.transferType === 'out') {
                      sign = '-';
                      colorClass = 'text-slate-200';
                      title = `Transfer to ${tx.transferRecipientName || 'Member'}`;
                      subtitle = 'Peer Transfer';
                    } else {
                      sign = '+';
                      colorClass = 'text-emerald-400';
                      title = `Transfer from ${tx.transferSenderName || 'Member'}`;
                      subtitle = 'Peer Transfer';
                    }
                  }

                  const txTime = tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd MMM, HH:mm') : 'Just now';

                  return (
                    <button
                      type="button"
                      key={tx.id} 
                      onClick={() => {
                        setSelectedDoc(tx);
                        setMemberTab('memos');
                      }}
                      className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 group cursor-pointer hover:bg-white/[0.03] transition-colors"
                      title="View verified transaction receipt & memo"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0", iconStyle)}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        
                        <div className="min-w-0">
                          <h5 className="text-[13px] font-semibold text-white tracking-tight truncate group-hover:text-blue-300 transition-colors">
                            {title}
                          </h5>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {subtitle} · {txTime}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn("text-sm font-bold font-mono tabular-nums tracking-tight", colorClass)}>
                          {hideBalances ? '•••••' : `${sign}৳${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  );
                })}

                {confirmedTransactions.length === 0 && (
                  <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-400 border border-white/[0.07]">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 max-w-[280px]">
                      <p className="text-xs font-semibold text-slate-200">No Confirmed Transactions Yet</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Once your deposit, loan, or repayment requests are verified, they will appear here automatically.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        )}

        {/* TAB 2: VAULT (Premium Banking-Style Financial Overview) */}
        {memberTab === 'memos' && (
          <div className="space-y-3 pb-12 select-none font-sans text-left w-full max-w-6xl xl:max-w-7xl mx-auto">
              
              {/* Clean Editorial Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMemberTab('dashboard')}
                    className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <div>
                    <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">My Vault</h1>
                    <p className="text-xs text-slate-400 leading-tight">Financial ledger, balances, and verified statements</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setDocFilter('all');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Sync Ledger</span>
                </button>
              </div>

              {/* 1. UPCOMING REPAYMENT - FEATURED AT TOP OF VAULT */}
              <div 
                onClick={() => setVaultModalType('upcoming_repayment')}
                className="p-3 rounded-xl bg-gradient-to-r from-[#17122B] via-[#0E1528] to-[#0B1222] border border-purple-500/30 hover:border-purple-400/55 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase text-purple-300 tracking-wider">UPCOMING REPAYMENT</span>
                      <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                        <Clock className="w-2 h-2" /> {remainingDebtVal > 0 ? 'Active Due' : 'Zero Debt'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <h3 className="text-xs sm:text-sm font-black text-white tracking-tight group-hover:text-purple-300 transition-colors">
                        {remainingDebtVal > 0 ? (activeLoan?.estimatedRepaymentDate || 'Pending Schedule') : 'No Outstanding Debt'}
                      </h3>
                      <span className="text-[10px] font-semibold text-slate-300">
                        Amount: <strong className={cn("font-black font-mono text-xs ml-0.5", remainingDebtVal > 0 ? "text-rose-400" : "text-emerald-400")}>৳ {remainingDebtVal.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {remainingDebtVal > 0 ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRequestAction('pay_due'); }}
                      className="w-full sm:w-auto py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer shadow-md"
                    >
                      <span>Pay Repayment Now</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRequestAction('loan'); }}
                      className="w-full sm:w-auto py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer shadow-md"
                    >
                      <span>Apply For Loan</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                  <span className="text-[9px] font-bold text-purple-300 underline uppercase tracking-wider hidden sm:inline ml-1">Details →</span>
                </div>
              </div>

              {/* 2. CARD KEY MANAGEMENT SECTION (DIRECTLY UNDER REPAYMENT CARD) */}
              {(() => {
                const pan =
                  tutCard?.cardNumber || deriveDeterministicCardNumber(profile.uid, profile.memberId);
                const last4 = pan.slice(-4);
                const hasPin = Boolean(tutCard?.secretCodeHash);
                return (
                  <div className="p-3.5 rounded-xl bg-[#0B1222] border border-white/10 hover:border-amber-400/35 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg border flex items-center justify-center shrink-0',
                          tutCard?.isFrozen
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            : hasPin
                            ? 'bg-amber-500/10 border-amber-400/30 text-amber-300'
                            : 'bg-amber-500/15 border-amber-400/45 text-amber-300'
                        )}
                      >
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <h3 className="font-bold text-white">Card Key Management</h3>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="font-mono tabular-nums text-[11px] text-slate-300">
                            •••• {last4}
                          </span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span
                            className={cn(
                              'text-[11px] font-semibold',
                              tutCard?.isFrozen
                                ? 'text-rose-400'
                                : hasPin
                                ? 'text-emerald-400'
                                : 'text-amber-300'
                            )}
                          >
                            {tutCard?.isFrozen ? 'Frozen' : hasPin ? 'PIN Active & Locked' : 'PIN Required'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {hasPin
                            ? `Per-transaction cap ৳${(tutCard?.perTxLimit || 50000).toLocaleString()} · Direct overwrite locked, smart recovery available`
                            : 'Set your mandatory 6-digit Card PIN and save a Master Recovery Key'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCardSecurityModal(true)}
                      className="w-full sm:w-auto py-2 px-3.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      <span>{hasPin ? 'Manage Key & Recovery' : 'Set Card PIN'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })()}

              {/* Grid 1: 3-COLUMN STATS OVERVIEW (TOTAL LOAN, TOTAL DEPOSITS, CREDIT SCORE) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                
                {/* Card 1: TOTAL LOAN */}
                <div 
                  onClick={() => setVaultModalType('total_loan')}
                  className="p-3 rounded-xl bg-[#0B1222] border border-blue-500/20 hover:border-blue-500/45 hover:bg-[#0F172A] transition-colors relative overflow-hidden group flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5.5 h-5.5 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner group-hover:scale-105 transition-transform">
                          <Wallet className="w-3 h-3" />
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-300 tracking-wider group-hover:text-blue-400 transition-colors">TOTAL LOAN</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-black text-white font-mono tracking-tight truncate">
                          ৳ {totalLoanVal.toLocaleString()}
                        </h3>
                        <div className="space-y-0.5 text-[9.5px] font-semibold">
                          <div className="flex items-center gap-1">
                            <span className="text-[8.5px] text-slate-400 font-medium">Due:</span>
                            <span className="text-[10px] font-black text-amber-400 font-mono">
                              ৳{remainingDebtVal.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[8.5px] text-slate-400 font-medium">Repaid:</span>
                            <span className="text-[10px] font-black text-emerald-400 font-mono">
                              ৳{totalRepaidVal.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Circular Progress Gauge */}
                      <div className="relative w-13 h-13 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-slate-800"
                            strokeWidth="3.8"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-amber-500 transition-all duration-1000 ease-out"
                            strokeDasharray={`${outstandingPctVal}, 100`}
                            strokeWidth="3.8"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-xs font-black text-white font-mono leading-none">{outstandingPctVal}%</span>
                          <span className="text-[6.5px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Due</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: TOTAL DEPOSITS */}
                <div 
                  onClick={() => setVaultModalType('total_deposits')}
                  className="p-3 rounded-xl bg-[#0B1222] border border-emerald-500/20 hover:border-emerald-500/45 hover:bg-[#0F172A] transition-colors flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5.5 h-5.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-105 transition-transform">
                          <ArrowDownLeft className="w-3 h-3" />
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-300 tracking-wider group-hover:text-emerald-400 transition-colors">TOTAL DEPOSITS</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <div className="space-y-0.5">
                      <h3 className="text-base sm:text-lg font-black text-white font-mono tracking-tight truncate">
                        ৳ {totalDepositsVal.toLocaleString()}
                      </h3>
                      <p className="text-[9px] text-slate-400 font-medium">All time verified deposits</p>
                    </div>
                  </div>

                  <div className="pt-1.5 mt-1.5 border-t border-white/5 flex items-center justify-between text-[9px]">
                    <span className="text-slate-400 font-semibold">Status Account</span>
                    <span className="text-emerald-400 font-black font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Verified</span>
                  </div>
                </div>

                {/* Card 3: CREDIT SCORE */}
                <div 
                  onClick={() => setShowCreditModal(true)}
                  className="p-3 rounded-xl bg-[#0B1222] border border-[#DFC07C]/25 hover:border-[#DFC07C]/50 hover:bg-[#0F172A] transition-colors flex flex-col justify-between space-y-1.5 group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5.5 h-5.5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner group-hover:scale-105 transition-transform">
                          <Award className="w-3 h-3" />
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-300 tracking-wider group-hover:text-amber-400 transition-colors">CREDIT SCORE</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">{dynamicScore}</span>
                        <span className={cn("text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border", scoreBadgeStyle)}>
                          {scoreLabel}
                        </span>
                      </div>

                      {/* Segmented Bar */}
                      <div className="flex gap-1 h-1.5 w-full rounded-full overflow-hidden bg-slate-800/80 p-0.5">
                        {[
                          { seg: 1, color: 'bg-rose-500' },
                          { seg: 2, color: 'bg-amber-500' },
                          { seg: 3, color: 'bg-blue-500' },
                          { seg: 4, color: 'bg-teal-400' },
                          { seg: 5, color: 'bg-emerald-400' }
                        ].map(({ seg, color }) => (
                          <div 
                            key={seg} 
                            className={cn(
                              "flex-1 rounded-full transition-all",
                              seg <= activeScoreSegments 
                                ? `${color} shadow-[0_0_6px_rgba(255,255,255,0.2)]` 
                                : "bg-slate-800 opacity-40"
                            )} 
                          />
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[8px] font-mono text-slate-400">Scale: 300–850</span>
                        <span className="text-[8px] text-amber-400/90 font-bold hover:underline flex items-center gap-0.5">
                          Audit & Rules →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Quick Actions Bar */}
              <div className="space-y-1 pt-0.5">
                <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400">Quick Actions</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {/* Repayment */}
                  <button 
                    onClick={() => onRequestAction('pay_due')}
                    className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 hover:border-rose-500/30 transition-all flex items-center gap-2 text-left cursor-pointer group shadow-sm"
                  >
                    <div className="w-6.5 h-6.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Banknote className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white uppercase tracking-tight truncate">Repayment</p>
                      <p className="text-[8.5px] text-slate-400 truncate">Pay loan dues</p>
                    </div>
                  </button>

                  {/* Deposit */}
                  <button 
                    onClick={() => onRequestAction('deposit')}
                    className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 hover:border-emerald-500/30 transition-all flex items-center gap-2 text-left cursor-pointer group shadow-sm"
                  >
                    <div className="w-6.5 h-6.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <PlusCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white uppercase tracking-tight truncate">Deposit</p>
                      <p className="text-[8.5px] text-slate-400 truncate">Add vault funds</p>
                    </div>
                  </button>

                  {/* Statement */}
                  <button 
                    onClick={() => {
                      if (userConfirmedTxs.length > 0) {
                        setSelectedDoc(userConfirmedTxs[0]);
                      } else {
                        setSelectedDoc({
                          id: 'STMT-OFFICIAL-2026',
                          type: 'certificate',
                          amount: profile.totalDeposit || 0,
                          method: 'Bank Sync',
                          status: 'confirmed',
                          memoId: `STMT-${profile.memberId || '2026'}`
                        });
                      }
                    }}
                    className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 hover:border-blue-500/30 transition-all flex items-center gap-2 text-left cursor-pointer group shadow-sm"
                  >
                    <div className="w-6.5 h-6.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white uppercase tracking-tight truncate">Statement</p>
                      <p className="text-[8.5px] text-slate-400 truncate">PDF & PNG</p>
                    </div>
                  </button>

                  {/* History */}
                  <button 
                    onClick={() => {
                      setDocFilter('all');
                      const el = document.getElementById('recent-activity-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 hover:border-purple-500/30 transition-all flex items-center gap-2 text-left cursor-pointer group shadow-sm"
                  >
                    <div className="w-6.5 h-6.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <HistoryIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white uppercase tracking-tight truncate">History</p>
                      <p className="text-[8.5px] text-slate-400 truncate">Activity logs</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Four Metric Strip Card */}
              <div className="p-2 rounded-xl bg-[#0B1222] border border-white/[0.08] grid grid-cols-2 md:grid-cols-4 gap-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
                {/* Available Limit */}
                <div 
                  onClick={() => setVaultModalType('available_limit')}
                  className="space-y-0.5 pr-2 cursor-pointer hover:bg-white/5 p-1.5 rounded-lg transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <PieChart className="w-3 h-3" />
                      </div>
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-400 transition-colors">Available Limit</span>
                    </div>
                    <ChevronRight className="w-2.5 h-2.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <p className="text-xs sm:text-sm font-black text-white font-mono">৳ {availableLimitVal.toLocaleString()}</p>
                  <p className="text-[8.5px] text-blue-400 font-semibold">Utilization {utilizationPctVal}%</p>
                </div>

                {/* Total Repaid */}
                <div 
                  onClick={() => setVaultModalType('total_repaid')}
                  className="space-y-0.5 pt-1.5 md:pt-0 md:px-2 cursor-pointer hover:bg-white/5 p-1.5 rounded-lg transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">Total Repaid</span>
                    </div>
                    <ChevronRight className="w-2.5 h-2.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <p className="text-xs sm:text-sm font-black text-white font-mono">৳ {totalRepaidVal.toLocaleString()}</p>
                  <p className="text-[8.5px] text-emerald-400 font-semibold">Verified Total</p>
                </div>

                {/* Reserve Fund */}
                <div 
                  onClick={() => setVaultModalType('reserve_fund')}
                  className="space-y-0.5 pt-1.5 md:pt-0 md:px-2 cursor-pointer hover:bg-white/5 p-1.5 rounded-lg transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded bg-purple-500/10 text-purple-400 flex items-center justify-center">
                        <Shield className="w-3 h-3" />
                      </div>
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-purple-400 transition-colors">Reserve Fund</span>
                    </div>
                    <ChevronRight className="w-2.5 h-2.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                  </div>
                  <p className="text-xs sm:text-sm font-black text-white font-mono">৳ {reserveContribVal.toLocaleString()}</p>
                  <p className="text-[8.5px] text-purple-400 font-semibold">Your contribution</p>
                </div>

                {/* Total Documents */}
                <div 
                  onClick={() => setVaultModalType('total_documents')}
                  className="space-y-0.5 pt-1.5 md:pt-0 md:pl-2 flex flex-col justify-between cursor-pointer hover:bg-white/5 p-1.5 rounded-lg transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded bg-amber-500/10 text-amber-400 flex items-center justify-center">
                        <FileText className="w-3 h-3" />
                      </div>
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-400 transition-colors">Total Documents</span>
                    </div>
                    <ChevronRight className="w-2.5 h-2.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs sm:text-sm font-black text-white font-mono">{totalDocsCount}</p>
                    <span className="text-[8.5px] font-black text-blue-400 uppercase group-hover:underline">
                      View all
                    </span>
                  </div>
                </div>
              </div>

              {/* Smart Recent Activity & Ledger History Section matching user image */}
              <div id="recent-activity-section" className="space-y-2 pt-1 select-none">
                {/* Search Bar at top */}
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input 
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search statements by ID, type, method..."
                    className="w-full bg-slate-900/90 border border-slate-800 focus:border-blue-500 rounded-xl py-2 pl-9 pr-7 text-[11px] font-mono font-medium text-white placeholder:text-slate-500 focus:outline-none transition-all shadow-inner"
                  />
                  {docSearch && (
                    <button 
                      onClick={() => setDocSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full bg-slate-800/80 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  {[
                    { id: 'all', label: 'ALL' },
                    { id: 'vouchers', label: 'VOUCHERS' },
                    { id: 'loans', label: 'LOANS' },
                    { id: 'deposits', label: 'DEPOSITS' },
                    { id: 'certificates', label: 'CERTIFICATES' }
                  ].map((tab) => {
                    const isActive = docFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDocFilter(tab.id as any)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 shadow-sm",
                          isActive 
                            ? "bg-blue-600 text-white shadow-md shadow-blue-900/50" 
                            : "bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                        )}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-header Bar */}
                {(() => {
                  // Compile smart ledger entries list
                  const combinedLedger: any[] = [];

                  // 1. Always include Membership Certificate
                  combinedLedger.push({
                    id: `CERT-${profile.memberId || 'MEMB-2026'}`,
                    title: 'Membership Certificate',
                    subtitle: `CERT-${profile.memberId || 'N/A'} • T.U.T OFFICIAL`,
                    category: 'certificates',
                    type: 'certificate',
                    avatarType: 'crown',
                    isBadge: true,
                    badgeText: 'SECURED',
                    amountVal: 0,
                    timestamp: profile.createdAt || new Date(),
                    memoId: `CERT-${profile.memberId || 'MEMB-2026'}`,
                    method: 'T.U.T Official'
                  });

                  // 2. Add user transactions if available
                  userConfirmedTxs.forEach((tx) => {
                    let title = 'Deposit Entry';
                    let category = 'deposits';
                    let avatarType = 'letter_D';
                    let sign = '+';
                    let colorClass = 'text-emerald-400';

                    if (tx.type === 'loan') {
                      title = 'Loan Disbursement';
                      category = 'loans';
                      avatarType = 'letter_L';
                      sign = '+';
                      colorClass = 'text-emerald-400';
                    } else if (tx.type === 'pay_due') {
                      title = 'Repayment Voucher';
                      category = 'vouchers';
                      avatarType = 'letter_P';
                      sign = '-';
                      colorClass = 'text-rose-400';
                    } else if (tx.type === 'refund') {
                      title = 'Refund Settlement';
                      category = 'vouchers';
                      avatarType = 'letter_R';
                      sign = '+';
                      colorClass = 'text-emerald-400';
                    } else if (tx.type === 'subscription') {
                      title = 'Membership Subscription';
                      category = 'vouchers';
                      avatarType = 'letter_S';
                      sign = '-';
                      colorClass = 'text-rose-400';
                    } else if (tx.type === 'merchant_payment' || tx.type === 'card_payment' || tx.type === 'wallet_payment') {
                      title = tx.merchantName ? `Payment — ${tx.merchantName}` : 'Connected App Payment';
                      category = 'vouchers';
                      avatarType = 'letter_P';
                      sign = '-';
                      colorClass = 'text-amber-300';
                    }

                    const txDateStr = tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd MMM, HH:mm') : 'Recent';
                    const memoCode = (tx.memoId || tx.id).substring(0, 10).toUpperCase();

                    combinedLedger.push({
                      id: tx.id,
                      title,
                      subtitle: `${txDateStr.toUpperCase()} • DOC-TUT-MEMO-${memoCode}`,
                      category,
                      type: tx.type,
                      avatarType,
                      isBadge: false,
                      sign,
                      colorClass,
                      amountVal: tx.amount,
                      amountFormatted: `${sign}৳${tx.amount.toLocaleString()}`,
                      timestamp: tx.timestamp,
                      rawTx: tx
                    });
                  });

                  // Apply Filter & Search
                  const filteredLedger = combinedLedger.filter((item) => {
                    // Category filter check
                    if (docFilter !== 'all') {
                      if (docFilter === 'vouchers' && item.category !== 'vouchers') return false;
                      if (docFilter === 'loans' && item.category !== 'loans') return false;
                      if (docFilter === 'deposits' && item.category !== 'deposits') return false;
                      if (docFilter === 'certificates' && item.category !== 'certificates') return false;
                    }

                    // Search query check
                    if (docSearch.trim()) {
                      const q = docSearch.toLowerCase().trim();
                      const matchTitle = item.title.toLowerCase().includes(q);
                      const matchSubtitle = item.subtitle.toLowerCase().includes(q);
                      const matchId = item.id.toLowerCase().includes(q);
                      const matchAmount = item.amountFormatted?.toLowerCase().includes(q) || item.amountVal?.toString().includes(q);
                      return matchTitle || matchSubtitle || matchId || matchAmount;
                    }

                    return true;
                  });

                  return (
                    <div className="space-y-1.5">
                      {docFilter === 'loans' && (
                        <div className="mb-3">
                          <MemberLoanHistoryCard 
                            summary={memberLoanSummary} 
                            title="T.U.T Individual Loan Allocation & Repayment Status"
                            onViewReceipt={(loan) => setSelectedDoc(loan.rawTransaction || loan)}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[9.5px] font-mono font-bold tracking-wider px-1 pt-0.5">
                        <span className="text-slate-400 uppercase tracking-widest font-black">LEDGER ENTRIES</span>
                        <span className="text-slate-400">Showing <strong className="text-slate-200 font-mono font-black">{filteredLedger.length}</strong> verified</span>
                      </div>

                      {/* List of Entries */}
                      <div className="space-y-1.5">
                        {filteredLedger.length > 0 ? (
                          filteredLedger.map((item) => {
                            // Render avatar icon box matching screenshot
                            let avatarBox = null;
                            if (item.avatarType === 'crown') {
                              avatarBox = (
                                <div className="w-8.5 h-8.5 sm:w-9.5 sm:h-9.5 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base shadow-md shrink-0">
                                  👑
                                </div>
                              );
                            } else if (item.avatarType === 'letter_R') {
                              avatarBox = (
                                <div className="w-8.5 h-8.5 sm:w-9.5 sm:h-9.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-base sm:text-lg flex items-center justify-center shadow-md shrink-0">
                                  R
                                </div>
                              );
                            } else if (item.avatarType === 'letter_P') {
                              avatarBox = (
                                <div className="w-8.5 h-8.5 sm:w-9.5 sm:h-9.5 rounded-xl bg-rose-500 text-white font-black text-base sm:text-lg flex items-center justify-center shadow-md shrink-0">
                                  P
                                </div>
                              );
                            } else if (item.avatarType === 'letter_D') {
                              avatarBox = (
                                <div className="w-8.5 h-8.5 sm:w-9.5 sm:h-9.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-base sm:text-lg flex items-center justify-center shadow-md shrink-0">
                                  D
                                </div>
                              );
                            } else if (item.avatarType === 'letter_L') {
                              avatarBox = (
                                <div className="w-8.5 h-8.5 sm:w-9.5 sm:h-9.5 rounded-xl bg-blue-600 text-white font-black text-base sm:text-lg flex items-center justify-center shadow-md shrink-0">
                                  L
                                </div>
                              );
                            } else {
                              avatarBox = (
                                <div className="w-8.5 h-8.5 sm:w-9.5 sm:h-9.5 rounded-xl bg-purple-600 text-white font-black text-base sm:text-lg flex items-center justify-center shadow-md shrink-0">
                                  S
                                </div>
                              );
                            }

                            return (
                              <div
                                key={item.id}
                                onClick={() => setSelectedDoc(item.rawTx || item)}
                                className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between cursor-pointer group shadow-sm"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  {avatarBox}
                                  <div className="min-w-0">
                                    <h4 className="text-xs sm:text-sm font-black text-white group-hover:text-blue-300 transition-colors truncate">
                                      {item.title}
                                    </h4>
                                    <p className="text-[9px] text-slate-400 font-mono font-bold tracking-tight truncate mt-0.5">
                                      {item.subtitle}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">
                                    {item.isBadge ? (
                                      <span className="inline-block bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-md">
                                        {item.badgeText}
                                      </span>
                                    ) : (
                                      <span className={cn("font-black font-mono tabular-nums text-xs sm:text-sm tracking-tight", item.colorClass)}>
                                        {item.amountFormatted}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const src = item.rawTx || item;
                                      const payload: OfficialReceiptData = {
                                        id: String(src.id || item.id),
                                        memoId: src.memoId,
                                        type: src.type || 'deposit',
                                        amount: Number(src.amount ?? src.originalAmount ?? src.amountVal ?? 0),
                                        userName: src.userName || profile.name,
                                        userId: src.userId || profile.uid,
                                        memberId: src.memberId || profile.memberId,
                                        method: src.method,
                                        accountNumber: src.accountNumber,
                                        transactionId: src.transactionId,
                                        date: src.date,
                                        timestamp: src.timestamp || (src.type === 'certificate' ? profile.createdAt : undefined),
                                        dueDate: src.dueDate,
                                        estimatedRepaymentDate: src.estimatedRepaymentDate,
                                        status: src.status || 'confirmed',
                                        decidedBy: src.decidedBy,
                                        adminNotes: src.adminNotes,
                                        loanReason: src.loanReason,
                                        reference: src.reference,
                                        mobileOperator: src.mobileOperator,
                                        isTransfer: src.isTransfer,
                                        transferType: src.transferType,
                                        transferSenderName: src.transferSenderName,
                                        transferRecipientName: src.transferRecipientName,
                                        subscriptionTier: src.subscriptionTier || profile.subscriptionTier,
                                        subscriptionMonths: src.subscriptionMonths
                                      };
                                      downloadReceiptPng(payload)
                                        .then(() => {
                                          if (addToast) {
                                            addToast('Voucher Downloaded', `Saved TUT-Receipt-${normalizeMemoCode(payload.id, payload.memoId)}.png`, 'success');
                                          }
                                        })
                                        .catch(() => {
                                          setSelectedDoc(src);
                                        });
                                    }}
                                    className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-amber-400/15 border border-white/10 hover:border-amber-400/40 text-slate-300 hover:text-amber-300 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Download PNG Voucher"
                                    aria-label={`Download receipt for ${item.title}`}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-6 px-4 text-center space-y-1.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                            <Search className="w-5 h-5 text-slate-500 mx-auto" />
                            <p className="text-[11px] font-bold text-slate-300">No ledger entries match your filter or search query</p>
                            <button 
                              onClick={() => { setDocSearch(''); setDocFilter('all'); }} 
                              className="text-[9.5px] font-black text-blue-400 uppercase hover:underline cursor-pointer"
                            >
                              Reset Search Filters
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
        )}

            {/* Institutional Archival Voucher & Statement Viewer */}
            <OfficialReceiptModal
              receipt={
                selectedDoc
                  ? ({
                      id: String(selectedDoc.id || selectedDoc.memoId || 'MEMO'),
                      memoId: selectedDoc.memoId,
                      type: selectedDoc.type || 'loan',
                      amount: Number(selectedDoc.amount ?? selectedDoc.originalAmount ?? selectedDoc.amountVal ?? 0),
                      userName: selectedDoc.userName || profile.name,
                      userId: selectedDoc.userId || profile.uid,
                      memberId: selectedDoc.memberId || profile.memberId,
                      method: selectedDoc.method,
                      accountNumber: selectedDoc.accountNumber,
                      transactionId: selectedDoc.transactionId,
                      date: selectedDoc.date ?? selectedDoc.disbursedDateStr,
                      timestamp: selectedDoc.timestamp || (selectedDoc.type === 'certificate' ? profile.createdAt : undefined),
                      dueDate: selectedDoc.dueDate,
                      estimatedRepaymentDate: selectedDoc.estimatedRepaymentDate ?? selectedDoc.dueDateStr,
                      status:
                        selectedDoc.status ||
                        (selectedDoc.statusLabel === 'Settled' ? 'confirmed' : selectedDoc.statusLabel) ||
                        'confirmed',
                      decidedBy: selectedDoc.decidedBy,
                      decidedAt: selectedDoc.decidedAt,
                      adminNotes: selectedDoc.adminNotes,
                      loanReason: selectedDoc.loanReason ?? selectedDoc.purpose,
                      reference: selectedDoc.reference,
                      mobileOperator: selectedDoc.mobileOperator,
                      isTransfer: selectedDoc.isTransfer,
                      transferType: selectedDoc.transferType,
                      transferSenderName: selectedDoc.transferSenderName,
                      transferRecipientName: selectedDoc.transferRecipientName,
                      subscriptionTier: selectedDoc.subscriptionTier || profile.subscriptionTier,
                      subscriptionMonths: selectedDoc.subscriptionMonths
                    } as OfficialReceiptData)
                  : null
              }
              onClose={() => setSelectedDoc(null)}
              onToast={addToast}
            />

            {/* Comprehensive Vault Metric Details Modal Overlay */}
            <AnimatePresence>
              {vaultModalType && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col text-left"
                  >
                    {/* Modal Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border shadow-inner",
                          vaultModalType === 'credit_score' ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                          vaultModalType === 'total_loan' ? "bg-blue-500/10 border-blue-500/30 text-blue-400" :
                          vaultModalType === 'total_deposits' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                          vaultModalType === 'upcoming_repayment' ? "bg-purple-500/10 border-purple-500/30 text-purple-300" :
                          vaultModalType === 'available_limit' ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" :
                          vaultModalType === 'total_repaid' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                          vaultModalType === 'reserve_fund' ? "bg-purple-500/10 border-purple-500/30 text-purple-400" :
                          "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        )}>
                          {vaultModalType === 'credit_score' && <Award className="w-5 h-5" />}
                          {vaultModalType === 'total_loan' && <Wallet className="w-5 h-5" />}
                          {vaultModalType === 'total_deposits' && <ArrowDownLeft className="w-5 h-5" />}
                          {vaultModalType === 'upcoming_repayment' && <Calendar className="w-5 h-5" />}
                          {vaultModalType === 'available_limit' && <PieChart className="w-5 h-5" />}
                          {vaultModalType === 'total_repaid' && <CheckCircle2 className="w-5 h-5" />}
                          {vaultModalType === 'reserve_fund' && <Shield className="w-5 h-5" />}
                          {vaultModalType === 'total_documents' && <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                            {vaultModalType === 'credit_score' && 'Credit Score Analysis & History'}
                            {vaultModalType === 'total_loan' && 'Total Loan Portfolio & Repayment Audit'}
                            {vaultModalType === 'total_deposits' && 'Verified Savings & Deposits Breakdown'}
                            {vaultModalType === 'upcoming_repayment' && 'Upcoming Repayment Schedule'}
                            {vaultModalType === 'available_limit' && 'Available Credit Limit Calculation'}
                            {vaultModalType === 'total_repaid' && 'Total Repayments History'}
                            {vaultModalType === 'reserve_fund' && 'Emergency Reserve Fund Account'}
                            {vaultModalType === 'total_documents' && 'Official Vault Document Repository'}
                          </h3>
                          <p className="text-[10px] text-slate-400 font-medium">Detailed statement & transaction drivers</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setVaultModalType(null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" /> Back
                        </button>
                        <button 
                          onClick={() => setVaultModalType(null)}
                          className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Modal Body Content */}
                    <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">

                      {/* 1. CREDIT SCORE MODAL DETAILS */}
                      {vaultModalType === 'credit_score' && (
                        <div className="space-y-4">
                          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl font-black text-amber-400 font-mono">{dynamicScore}</span>
                              <div>
                                <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border", scoreBadgeStyle)}>
                                  {scoreLabel}
                                </span>
                                <p className="text-[10px] text-slate-300 font-medium mt-1">Calculated via central member credit ledger</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block font-semibold">Institutional Scale:</span>
                              <span className="text-xs font-black text-white font-mono">300 to 850 (FICO)</span>
                            </div>
                          </div>

                          {/* Score Drivers Breakdown */}
                          <div className="space-y-2">
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                              Key Credit Drivers & Weight Factor
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="font-bold text-white">On-Time Repayments (35%)</span>
                                  <span className="font-black text-emerald-400 font-mono">High Positive (+40 pts)</span>
                                </div>
                                <p className="text-[9.5px] text-slate-400">Zero default records on loan schedules boost your trust rating.</p>
                              </div>

                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="font-bold text-white">Deposit Consistency (30%)</span>
                                  <span className="font-black text-emerald-400 font-mono">Verified Active (+35 pts)</span>
                                </div>
                                <p className="text-[9.5px] text-slate-400">Regular monthly subscription deposits maintain strong score stability.</p>
                              </div>

                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="font-bold text-white">Loan Utilization (20%)</span>
                                  <span className={cn("font-black font-mono", utilizationPctVal > 80 ? "text-amber-400" : "text-emerald-400")}>
                                    {utilizationPctVal}% Utilized
                                  </span>
                                </div>
                                <p className="text-[9.5px] text-slate-400">Lower loan debt utilization preserves a higher safety margin.</p>
                              </div>

                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="font-bold text-white">Membership History (15%)</span>
                                  <span className="font-black text-blue-400 font-mono">Established (+15 pts)</span>
                                </div>
                                <p className="text-[9.5px] text-slate-400">Active member account verified by T.U.T Authority.</p>
                              </div>
                            </div>
                          </div>

                          {/* Recent Score Activity Log */}
                          <div className="space-y-2">
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-300">Score Audit Logs</h4>
                            <div className="space-y-1.5">
                              <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <div>
                                    <span className="font-bold text-white">Monthly Deposit Verified</span>
                                    <span className="text-[9px] text-slate-400 block">System auto-audit credit bump</span>
                                  </div>
                                </div>
                                <span className="font-mono font-black text-emerald-400">+15 Points</span>
                              </div>

                              <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                  <div>
                                    <span className="font-bold text-white">Timely Loan Installment Repayment</span>
                                    <span className="text-[9px] text-slate-400 block">Recorded on-time installment payment</span>
                                  </div>
                                </div>
                                <span className="font-mono font-black text-emerald-400">+25 Points</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. TOTAL LOAN MODAL DETAILS */}
                      {vaultModalType === 'total_loan' && (
                        <div className="space-y-4">
                          <MemberLoanHistoryCard 
                            summary={memberLoanSummary} 
                            title="T.U.T Individual Loan Portfolio & Payment Allocations"
                            onViewReceipt={(loan) => { setVaultModalType(null); setSelectedDoc(loan.rawTransaction || loan); }}
                          />

                          {/* Actions */}
                          <div className="flex gap-2 pt-2">
                            {remainingDebtVal > 0 && (
                              <button 
                                onClick={() => { setVaultModalType(null); onRequestAction('pay_due'); }}
                                className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer text-center shadow-lg"
                              >
                                Pay Repayment Now (৳{remainingDebtVal.toLocaleString()})
                              </button>
                            )}
                            <button 
                              onClick={() => { setVaultModalType(null); onRequestAction('loan'); }}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer text-center shadow-lg"
                            >
                              Apply For New Loan
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 3. TOTAL DEPOSITS MODAL DETAILS */}
                      {vaultModalType === 'total_deposits' && (
                        <div className="space-y-4">
                          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Verified Savings</span>
                              <span className="text-xl font-black text-white font-mono">৳ {totalDepositsVal.toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 uppercase">
                              100% Audit Verified
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-300">Verified Deposits Ledger</h4>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {userConfirmedTxs.filter(t => t.type === 'deposit').length > 0 ? (
                                userConfirmedTxs.filter(t => t.type === 'deposit').map(tx => (
                                  <div key={tx.id} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-mono font-bold text-[9px]">
                                        DEP
                                      </div>
                                      <div>
                                        <div className="font-bold text-white text-[10px]">{tx.title || 'Monthly Vault Deposit'}</div>
                                        <div className="text-[9px] text-slate-400 font-mono">{tx.date} • {tx.method || 'bkash'}</div>
                                      </div>
                                    </div>
                                    <span className="font-mono font-black text-emerald-400 text-xs">
                                      +৳{(tx.amount || 0).toLocaleString()}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                                  <div>
                                    <div className="font-bold text-white text-[10px]">Initial Vault Deposit</div>
                                    <div className="text-[9px] text-slate-400 font-mono">2026-01-01 • Direct System Sync</div>
                                  </div>
                                  <span className="font-mono font-black text-emerald-400 text-xs">
                                    +৳{totalDepositsVal.toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => { setVaultModalType(null); onRequestAction('deposit'); }}
                            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer text-center"
                          >
                            + Make New Vault Deposit
                          </button>
                        </div>
                      )}

                      {/* 4. UPCOMING REPAYMENT MODAL DETAILS */}
                      {vaultModalType === 'upcoming_repayment' && (
                        <div className="space-y-4">
                          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-purple-300 font-bold uppercase">Target Loan For Payment</span>
                              <span className="font-mono font-black text-amber-300">
                                {activeAllocatedLoan ? `${activeAllocatedLoan.loanNumber} (${activeAllocatedLoan.memoId})` : 'Oldest Outstanding Loan'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-purple-300 font-bold uppercase">Repayment Due Date</span>
                              <span className="font-mono font-black text-white">{activeAllocatedLoan?.dueDateStr || activeLoan?.estimatedRepaymentDate || '10th of every month'}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-purple-500/20">
                              <span className="text-slate-400 font-semibold text-[10px]">Total Outstanding Debt</span>
                              <span className="text-lg font-black text-rose-400 font-mono">৳ {remainingDebtVal.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-[10px]">
                            <h4 className="font-bold text-white uppercase flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              Individual Loan Payment Allocation Rule
                            </h4>
                            <p className="text-slate-400">
                              Every payment you make is automatically allocated chronologically to your oldest outstanding loan until it is fully <strong>PAID / COMPLETED</strong>. Any excess payment automatically flows to subsequent loans.
                            </p>
                          </div>

                          {remainingDebtVal > 0 ? (
                            <button 
                              onClick={() => { setVaultModalType(null); onRequestAction('pay_due'); }}
                              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer text-center"
                            >
                              Pay Repayment Now (৳{remainingDebtVal.toLocaleString()})
                            </button>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-emerald-400 font-bold text-[10px]">
                              ✓ No pending repayments due at this time!
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5. AVAILABLE LIMIT MODAL DETAILS */}
                      {vaultModalType === 'available_limit' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Available Credit Limit</span>
                              <span className="text-base font-black text-cyan-400 font-mono">৳ {availableLimitVal.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Utilization Rate</span>
                              <span className="text-base font-black text-amber-400 font-mono">{utilizationPctVal}%</span>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-[10px]">
                            <h4 className="font-bold text-white uppercase">How Your Borrowing Limit Is Calculated</h4>
                            <ul className="space-y-1 text-slate-300 list-disc list-inside">
                              <li>Base Credit Multiplier: 3x of total verified vault deposits (৳{totalDepositsVal.toLocaleString()})</li>
                              <li>Credit Score Bonus: Applied based on your {dynamicScore} point score</li>
                              <li>Current Active Debt: Subtracted from total sanctioned credit allowance</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* 6. TOTAL REPAID MODAL DETAILS */}
                      {vaultModalType === 'total_repaid' && (
                        <div className="space-y-4">
                          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Verified Repayments</span>
                              <span className="text-xl font-black text-emerald-400 font-mono">৳ {totalRepaidVal.toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 uppercase">
                              Zero Default Record
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-300">Repayments History</h4>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {userConfirmedTxs.filter(t => t.type === 'loan' || t.type === 'subscription').length > 0 ? (
                                userConfirmedTxs.filter(t => t.type === 'loan' || t.type === 'subscription').map(tx => (
                                  <div key={tx.id} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                                    <div>
                                      <div className="font-bold text-white text-[10px]">{tx.title || 'Loan Installment Repayment'}</div>
                                      <div className="text-[9px] text-slate-400 font-mono">{tx.date} • {tx.method || 'bKash'}</div>
                                    </div>
                                    <span className="font-mono font-black text-emerald-400 text-xs">
                                      ৳{(tx.amount || 0).toLocaleString()}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-slate-400 text-[10px]">
                                  No past repayment records logged yet.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 7. RESERVE FUND MODAL DETAILS */}
                      {vaultModalType === 'reserve_fund' && (
                        <div className="space-y-4">
                          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Your Reserve Contribution</span>
                              <span className="text-xl font-black text-purple-300 font-mono">৳ {reserveContribVal.toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] font-black text-purple-300 bg-purple-500/20 px-2.5 py-1 rounded-lg border border-purple-500/30 uppercase">
                              Active Backup
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-[10px]">
                            <h4 className="font-bold text-white uppercase">Emergency Reserve Fund Policy</h4>
                            <p className="text-slate-400">
                              The Reserve Fund is pooled by T.U.T members to guarantee micro-loans, cover emergency medical grants, and protect member equity during unforeseen hardships.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 8. TOTAL DOCUMENTS MODAL DETAILS */}
                      {vaultModalType === 'total_documents' && (
                        <div className="space-y-4">
                          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Digital Certificates & Vouchers</span>
                              <span className="text-xl font-black text-amber-400 font-mono">{totalDocsCount} Documents</span>
                            </div>
                            <button 
                              onClick={() => { setVaultModalType(null); setDocFilter('certificates'); }}
                              className="text-[10px] font-black text-blue-400 underline uppercase cursor-pointer"
                            >
                              Filter Ledger →
                            </button>
                          </div>

                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {userConfirmedTxs.map(tx => (
                              <div 
                                key={tx.id} 
                                onClick={() => { setVaultModalType(null); setSelectedDoc(tx); }}
                                className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:bg-slate-800/80 transition-all cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                                  <div>
                                    <div className="font-bold text-white text-[10px]">{tx.title || 'Official Transaction Document'}</div>
                                    <div className="text-[9px] text-slate-400 font-mono">{tx.id} • {tx.date}</div>
                                  </div>
                                </div>
                                <span className="text-[9.5px] font-black text-blue-400 uppercase hover:underline">
                                  View Official Document →
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Modal Footer */}
                    <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end shrink-0">
                      <button 
                        onClick={() => setVaultModalType(null)}
                        className="py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Close Details
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

        {/* TAB 3: PREMIUM SUBSCRIPTION (Smart Tier System & Complete Purchasing Hub) */}
        {memberTab === 'subscription' && (
          <SubscriptionHubView
            profile={profile}
            transactions={transactions}
            onBack={() => setMemberTab('dashboard')}
            addToast={addToast || ((title: string, msg: string, type: any) => console.log(title, msg, type))}
            sendWorkflowNotification={sendWorkflowNotification}
            onRequestAction={onRequestAction}
            initialTier={targetSubscriptionTier}
          />
        )}

        {/* TAB 4: PARTNERS & BRANDS (Redesigned Deals & Partner Network) */}
        {memberTab === 'partners' && (() => {
          const partnerOffers = [
            {
              id: "1",
              name: "Daraz",
              category: "Shopping",
              color: "#FF6801",
              logoLetter: "D",
              discount: "15% OFF",
              title: "Daraz Exclusive",
              subtitle: "Shop & Earn Cashback",
              desc: "Up to ৳500 off on ৳1,500+ shopping cart",
              code: "TUTDAR15",
              valid: "31 Jul 2026",
              saving: "৳500",
              url: "https://www.daraz.com.bd"
            },
            {
              id: "2",
              name: "Foodpanda",
              category: "Food",
              color: "#FF2B85",
              logoLetter: "FP",
              discount: "FREE DEL",
              title: "Foodpanda Feast",
              subtitle: "Free Delivery x5",
              desc: "On ৳250+ restaurant & pandamart orders",
              code: "TUTFPDEL",
              valid: "15 Aug 2026",
              saving: "৳250",
              url: "https://www.foodpanda.com.bd"
            },
            {
              id: "3",
              name: "Pathao",
              category: "Mobility",
              color: "#E3333B",
              logoLetter: "P",
              discount: "20% OFF",
              title: "Pathao Rides",
              subtitle: "Ride More Pay Less",
              desc: "20% off on daily bike & car commute",
              code: "TUTPATH20",
              valid: "30 Jul 2026",
              saving: "৳180",
              url: "https://pathao.com"
            },
            {
              id: "4",
              name: "bKash",
              category: "Fintech",
              color: "#E2136E",
              logoLetter: "B",
              discount: "1.5% BONUS",
              title: "bKash Bonus",
              subtitle: "Deposit Extra",
              desc: "1.5% instant bonus on personal deposit",
              code: "TUTBKASH",
              valid: "31 Dec 2026",
              saving: "৳300",
              url: "https://www.bkash.com"
            },
            {
              id: "5",
              name: "Nagad",
              category: "Fintech",
              color: "#F6921E",
              logoLetter: "N",
              discount: "৳100 BACK",
              title: "Nagad Cashback",
              subtitle: "Flat Cashback",
              desc: "First add money via verified Nagad wallet",
              code: "TUTNAGAD",
              valid: "20 Aug 2026",
              saving: "৳100",
              url: "https://www.nagad.com.bd"
            },
            {
              id: "6",
              name: "Grameenphone",
              category: "Telecom",
              color: "#00A8E8",
              logoLetter: "GP",
              discount: "5GB FREE",
              title: "GP Data Blast",
              subtitle: "Free Internet Pack",
              desc: "5GB 4G pack on ৳99 recharge through app",
              code: "TUTGP5GB",
              valid: "10 Sep 2026",
              saving: "৳99",
              url: "https://www.grameenphone.com"
            }
          ];

          // Merge & target active sponsorships from Firestore Admin Ad Control Studio
          const memberTierLower = (profile.subscriptionTier || 'standard').toLowerCase();
          const hasMemberDebt = (profile.remainingDebt || 0) > 0;
          const hasMemberDeposit = (profile.totalDeposit || 0) > 0;

          const eligibleSponsorships = activeSponsorships
            .filter(s => {
              if (s.status !== 'active') return false;
              if (s.maxImpressions && s.maxImpressions > 0 && (s.impressions || 0) >= s.maxImpressions) return false;
              const audience = s.targetAudience || 'all';
              if (audience === 'all') return true;
              if (audience === 'active_borrowers') return hasMemberDebt;
              if (audience === 'depositors') return hasMemberDeposit;
              return audience === memberTierLower;
            })
            .sort((a, b) => {
              if (Boolean(b.isPinned) !== Boolean(a.isPinned)) return b.isPinned ? 1 : -1;
              return (b.priority || 0) - (a.priority || 0);
            });

          const heroCampaign = eligibleSponsorships.find(s => (s.placement || 'all') === 'deals_hero')
            || eligibleSponsorships.find(s => s.isPinned && (s.placement || 'all') === 'all');

          const dynamicOffers = eligibleSponsorships.map(s => ({
            id: `sponsor-${s.id}`,
            name: s.companyName,
            category: s.category || (s.campaignType?.includes('Partner') ? 'Fintech' : s.campaignType?.includes('Collab') ? 'Shopping' : 'General'),
            color: s.accentColor || '#3B82F6',
            logoLetter: s.companyName.charAt(0).toUpperCase(),
            discount: s.discountBadge || (s.specialOffer ? 'EXCLUSIVE' : 'PARTNER'),
            title: s.companyName,
            subtitle: s.campaignType,
            desc: s.promotionText,
            code: s.specialOffer || 'TUTVIP',
            ctaLabel: s.ctaLabel || 'Use Now',
            placement: s.placement || 'all',
            isPinned: Boolean(s.isPinned),
            valid: s.endDate || 'Active',
            saving: s.dealValue ? `৳${Math.min(1000, Math.round(s.dealValue * 0.05))}` : '৳300',
            url: s.targetUrl,
            videoUrl: s.videoUrl,
            imageUrl: s.imageUrl,
            logoUrl: s.logoUrl
          }));

          const featuredOffers = [
            ...dynamicOffers.filter(o => o.placement === 'all' || o.placement === 'featured_carousel'),
            ...partnerOffers
          ];
          const gridDynamicOffers = dynamicOffers.filter(o => o.placement === 'all' || o.placement === 'partner_grid');
          const allOffers = [...gridDynamicOffers, ...partnerOffers];
          const filteredOffers = dealCategory === 'All' 
            ? allOffers 
            : allOffers.filter(o => o.category.toLowerCase() === dealCategory.toLowerCase());

          const partnerStories = [
            { id: "s1", label: "New", emoji: "✨", active: true, tag: "Exclusive", info: "Exclusive zero-interest merchant perks just dropped!" },
            { id: "s2", label: "TUT Pay", emoji: "💳", active: false, tag: "Fintech", info: "Pay zero processing fees on all portal transactions." },
            { id: "s3", label: "Ramadan", emoji: "🌙", active: false, tag: "Special", info: "Special charity & groceries bundle with up to 25% off." },
            { id: "s4", label: "Eid Offer", emoji: "🎉", active: true, tag: "Festival", info: "Mega Eid cashbacks on all partner brands." },
            { id: "s5", label: "Refer & Earn", emoji: "🤝", active: false, tag: "Bonus", info: "Earn ৳500 instant vault credit per 3 member invites." }
          ];

          const promotionalCampaigns = [
            {
              id: "c1",
              brand: "bKash",
              color: "#E2136E",
              title: "Zero Interest Week",
              desc: "Pay with bKash via T.U.T. and get 0% for 7 days + vault x2 reserve return.",
              tag: "FINTECH WEEK",
              cta: "Join Now",
              time: "3 days left",
              code: "BKASHZERO"
            },
            {
              id: "c2",
              brand: "Daraz",
              color: "#FF6801",
              title: "Mega 11.11 Pre-Launch",
              desc: "Early access for Authority members, extra ৳300 stackable coupon voucher.",
              tag: "SHOPPING FEST",
              cta: "Unlock",
              time: "Live now",
              code: "DARAZ1111"
            },
            {
              id: "c3",
              brand: "Pathao",
              color: "#E3333B",
              title: "Commute Cashback",
              desc: "10 rides = ৳400 back, tracked automatically in portal with instant ledger settlement.",
              tag: "MOBILITY",
              cta: "Start Riding",
              time: "Ends 31 Jul",
              code: "PATHAORIDE"
            }
          ];

          const dealCategoriesList = ["All", "Shopping", "Food", "Mobility", "Telecom", "Fintech"];

          const copyCodeWithToast = async (code: string, label: string = 'Coupon Code') => {
            try {
              await navigator.clipboard.writeText(code);
              addToast?.('Code Copied', `${code} copied to clipboard for ${label}.`, 'success');
            } catch (e) {
              addToast?.('Code Display', `${code} is ready to use!`, 'info');
            }
          };

          const scrollFeatured = (direction: 'left' | 'right') => {
            if (!featuredDropsScrollRef.current) return;
            const scrollAmount = 280;
            featuredDropsScrollRef.current.scrollBy({
              left: direction === 'left' ? -scrollAmount : scrollAmount,
              behavior: 'smooth'
            });
          };

          return (
            <div className="space-y-3.5 text-left pb-20 md:pb-8 max-w-4xl mx-auto select-none">
              
              {/* Clean Editorial Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMemberTab('dashboard')}
                    className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <div>
                    <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">Partner Offers</h1>
                    <p className="text-xs text-slate-400 leading-tight">{allOffers.length} active member privileges</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <span className={cn(
                    "font-semibold",
                    profile.subscriptionTier === 'gold'
                      ? "text-[#EAD39C]"
                      : profile.subscriptionTier === 'silver'
                      ? "text-slate-200"
                      : "text-[#E6BFA0]"
                  )}>
                    {profile.subscriptionTier === 'gold' ? 'Gold Perks' : profile.subscriptionTier === 'silver' ? 'Silver Perks' : 'Bronze Member'}
                  </span>
                </div>
              </div>

              {/* 1. HERO SPONSORED PROMO BANNER (Dynamic Admin Ad Studio Hero or Default Showcase) */}
              <div
                className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0B1222] p-4 shadow-lg"
                style={heroCampaign?.accentColor ? { borderColor: `${heroCampaign.accentColor}40` } : undefined}
              >
                <div
                  className="absolute inset-0 pointer-events-none opacity-25"
                  style={{
                    background: `radial-gradient(ellipse at top left, ${heroCampaign?.accentColor || '#DFC07C'}33, transparent 70%)`
                  }}
                />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {heroCampaign ? heroCampaign.campaignType : 'Sponsored'}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#EAD39C]">
                        {heroCampaign?.discountBadge || 'Live Campaign'}
                      </span>
                      <DealCountdownBadge />
                    </div>

                    <div>
                      <div className="text-xs sm:text-sm font-black text-amber-300 tracking-tight flex items-center gap-1.5">
                        <span>{heroCampaign ? `T.U.T. Authority × ${heroCampaign.companyName}` : 'T.U.T. Authority × bKash Exclusive'}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-tight">
                        {heroCampaign ? (heroCampaign.specialOffer ? `Promo: ${heroCampaign.specialOffer}` : `${heroCampaign.companyName} Priority Offer`) : 'Zero Interest Week'}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-slate-300/80 mt-0.5 font-medium truncate">
                        {heroCampaign ? heroCampaign.promotionText : '0% fee on ৳5,000+ • Vault 2x reserve return • Verified charter perk'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(heroCampaign?.videoUrl || !heroCampaign) && (
                      <button
                        type="button"
                        onClick={() => setActivePromoVideoModal({
                          title: heroCampaign ? `${heroCampaign.companyName} Partner Showcase` : 'bKash Zero Interest Week Launch Ceremony',
                          brand: heroCampaign ? heroCampaign.companyName : 'bKash Official',
                          url: heroCampaign?.videoUrl || 'https://www.youtube.com'
                        })}
                        className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white flex items-center justify-center shadow-md transition-all cursor-pointer"
                        title="Play Promotional Video"
                      >
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedDealMemo(heroCampaign ? {
                        id: `sponsor-${heroCampaign.id}`,
                        name: heroCampaign.companyName,
                        category: heroCampaign.category || 'Fintech',
                        color: heroCampaign.accentColor || '#D97706',
                        logoLetter: heroCampaign.companyName.charAt(0).toUpperCase(),
                        discount: heroCampaign.discountBadge || 'EXCLUSIVE',
                        title: heroCampaign.companyName,
                        subtitle: heroCampaign.campaignType,
                        desc: heroCampaign.promotionText,
                        code: heroCampaign.specialOffer || 'TUTVIP',
                        valid: heroCampaign.endDate || 'Active',
                        saving: '৳500',
                        url: heroCampaign.targetUrl,
                        imageUrl: heroCampaign.imageUrl,
                        logoUrl: heroCampaign.logoUrl
                      } : {
                        id: "promo-bkash",
                        name: "bKash Official",
                        category: "Fintech",
                        color: "#E2136E",
                        logoLetter: "B",
                        discount: "0% INTEREST",
                        title: "Zero Interest Week Campaign",
                        subtitle: "T.U.T. Authority Charter Perk",
                        desc: "Exclusive zero interest borrowing voucher for verified members on personal deposit additions of ৳5,000 or above.",
                        code: "BKASHZERO",
                        valid: "31 Dec 2026",
                        saving: "৳750",
                        url: "https://www.bkash.com"
                      })}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-blue-500/30 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Memo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (heroCampaign) {
                          handleAdClick(heroCampaign.id);
                          if (heroCampaign.targetUrl) {
                            try { window.open(heroCampaign.targetUrl, '_blank', 'noopener,noreferrer'); } catch {}
                          }
                          copyCodeWithToast(heroCampaign.specialOffer || 'TUTVIP', heroCampaign.companyName);
                        } else {
                          copyCodeWithToast('BKASHZERO', 'bKash Zero Interest Week');
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black tracking-wider uppercase shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      {heroCampaign?.ctaLabel || 'Claim'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. STORY HIGHLIGHTS CAROUSEL */}
              <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar py-1">
                {partnerStories.map((story) => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => setActiveStoryModal(story)}
                    className="shrink-0 flex flex-col items-center gap-1.5 cursor-pointer group active:scale-95 transition-all"
                  >
                    <div className={cn(
                      "w-13 h-13 sm:w-14 sm:h-14 rounded-full p-[2px] transition-all duration-300 shadow-md",
                      story.active
                        ? "bg-gradient-to-br from-amber-400 via-amber-200 to-amber-500 shadow-amber-500/20 group-hover:scale-105"
                        : "bg-slate-800 border border-slate-700"
                    )}>
                      <div className="w-full h-full rounded-full bg-slate-900 border-2 border-slate-950 flex items-center justify-center text-lg sm:text-xl">
                        {story.emoji}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 tracking-tight max-w-[62px] truncate text-center">
                      {story.label}
                    </span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => addToast?.('More Drops Coming', 'Follow our official channel for Ramadan and Eid partner perks.', 'info')}
                  className="shrink-0 flex flex-col items-center gap-1.5 cursor-pointer group"
                >
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 transition-all shadow-sm">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">More</span>
                </button>
              </div>

              {/* 3. QUICK STATS PILL ROW */}
              <div className="flex gap-2">
                {[
                  { label: `${allOffers.length} Partners`, icon: "✓", color: "text-emerald-400" },
                  { label: "5 Categories", icon: "📁", color: "text-blue-400" },
                  { label: "৳2,500+ Saved", icon: "💎", color: "text-amber-400" }
                ].map((stat, idx) => (
                  <div 
                    key={idx}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm text-center"
                  >
                    <span className={cn("text-xs font-bold", stat.color)}>{stat.icon}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-slate-200">{stat.label}</span>
                  </div>
                ))}
              </div>

              {/* 4. REFERRAL BLITZ CARD (With Back Button) */}
              <div className="rounded-2xl bg-slate-900/80 border border-amber-500/25 p-3.5 relative overflow-hidden shadow-lg shadow-black/40">
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-amber-500/5 blur-xl pointer-events-none -mr-6 -mt-6" />
                <div className="flex gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl shrink-0">
                    🚀
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-white">Referral Blitz</span>
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                          2/3 Active
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {/* Back button on Card */}
                        <button
                          type="button"
                          onClick={() => setMemberTab('dashboard')}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-[9.5px] font-semibold transition-all cursor-pointer"
                          title="Back to Dashboard"
                        >
                          <ArrowLeft className="w-2.5 h-2.5" />
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => copyCodeWithToast(profile.memberId || profile.phone || 'TUT-VIP', 'Referral Code')}
                          className="text-[10px] font-black text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                        >
                          Invite →
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Invite 3 friends to get an instant ৳500 ledger vault bonus credited to your account.
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full w-[66%] bg-gradient-to-r from-amber-500 to-amber-300 rounded-full" />
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                      <span>1 more member registration to unlock</span>
                      <span className="text-amber-400 font-bold">Reward: ৳500 BDT</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. FEATURED DROPS CAROUSEL (With Back Buttons & Deal Memo View) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⭐</span>
                    <span className="text-xs font-black tracking-wider uppercase text-white">Featured Drops</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      {allOffers.length} NEW
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => scrollFeatured('left')}
                      className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollFeatured('right')}
                      className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div 
                  ref={featuredDropsScrollRef}
                  className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 snap-x snap-mandatory"
                >
                  {featuredOffers.map((offer) => (
                    <div
                      key={`feat-${offer.id}`}
                      className="snap-start shrink-0 w-[270px] sm:w-[290px] h-[155px] rounded-2xl border border-slate-800/80 relative overflow-hidden shadow-lg shadow-black/40 group flex flex-col justify-between p-3 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950"
                    >
                      {/* Ambient background glow */}
                      <div 
                        className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-25 pointer-events-none"
                        style={{ backgroundColor: offer.color }}
                      />

                      {/* Card Top */}
                      <div className="relative z-10 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white border border-white/20 shadow-sm"
                            style={{ backgroundColor: offer.color }}
                          >
                            {offer.logoLetter}
                          </div>
                          <div>
                            <div className="text-[11px] font-black text-white leading-none flex items-center gap-1">
                              <span>{offer.name}</span>
                              <CheckCircle2 className="w-3 h-3 text-blue-400" />
                            </div>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 block">
                              {offer.category}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Back Button on Card */}
                          <button
                            type="button"
                            onClick={() => setMemberTab('dashboard')}
                            className="p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                            title="Back to Dashboard"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-sm">
                            {offer.discount}
                          </span>
                        </div>
                      </div>

                      {/* Card Middle */}
                      <div className="relative z-10 my-1">
                        <div className="text-xs font-black text-white leading-tight truncate">{offer.title}</div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">{offer.subtitle}</div>
                      </div>

                      {/* Card Bottom */}
                      <div className="relative z-10 flex items-center justify-between pt-1.5 border-t border-white/5">
                        <span className="text-[9px] font-mono text-slate-400">Till {offer.valid}</span>
                        <div className="flex items-center gap-2">
                          {/* Deal Memo Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedDealMemo(offer)}
                            className="text-[9.5px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5 cursor-pointer"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            <span>Memo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (offer.url) handleAdClick(offer.id);
                              copyCodeWithToast(offer.code, offer.name);
                            }}
                            className="text-[9.5px] font-black text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>Save {offer.saving}</span>
                            <span>→</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. URGENT FLASH SALE BANNER (With Back Button) */}
              <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/30 p-3 flex items-center gap-3 relative overflow-hidden shadow-lg shadow-black/40">
                <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 text-lg shadow-md shadow-rose-500/30 animate-pulse">
                  ⚡
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider text-white">Flash Sale</span>
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white">
                      LIVE
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-300 font-medium truncate mt-0.5">
                    Daraz + Foodpanda bundle extra 10% - next 2h only
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <DealCountdownBadge />
                  <button
                    type="button"
                    onClick={() => copyCodeWithToast('FLASH10', 'Flash Sale Bundle')}
                    className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    Grab →
                  </button>
                </div>
              </div>

              {/* 7. SPOTLIGHT EXECUTIVE PARTNER INTERVIEW CARD (With Back Button) */}
              <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-3.5 flex gap-3 items-center relative overflow-hidden shadow-lg shadow-black/40">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 font-black text-sm text-[#E2136E] shadow-md">
                  bK
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                      Spotlight
                    </span>
                    <span className="text-[9px] text-slate-400">CEO Interview</span>
                  </div>
                  <p className="text-[11px] text-slate-200 italic leading-snug mt-1 line-clamp-2">
                    “T.U.T. Authority members are our highest LTV - we built Zero Interest Week just for them.”
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[9px] font-bold text-amber-400">— Kamal Quadir, bKash</span>
                    <button
                      type="button"
                      onClick={() => setActivePromoVideoModal({
                        title: 'Executive Interview: Kamal Quadir (bKash) on Zero Usury Lending',
                        brand: 'bKash Leadership',
                        url: 'https://www.youtube.com'
                      })}
                      className="text-[9px] font-semibold text-blue-400 hover:underline cursor-pointer"
                    >
                      Watch 45s
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Back button on Card */}
                  <button
                    type="button"
                    onClick={() => setMemberTab('dashboard')}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-[9.5px] font-semibold flex items-center gap-1 cursor-pointer"
                    title="Back to Dashboard"
                  >
                    <ArrowLeft className="w-2.5 h-2.5" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePromoVideoModal({
                      title: 'Executive Interview: Kamal Quadir (bKash) on Zero Usury Lending',
                      brand: 'bKash Leadership',
                      url: 'https://www.youtube.com'
                    })}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 flex items-center justify-center shrink-0 text-white transition-all cursor-pointer"
                    title="Watch Video"
                  >
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                  </button>
                </div>
              </div>

              {/* 8. PARTNER OFFERS WITH FILTER CATEGORY TABS & 2-COLUMN GRID */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">Partner Offers</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{filteredOffers.length} active</span>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                  {dealCategoriesList.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDealCategory(cat)}
                      className={cn(
                        "shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer border",
                        dealCategory === cat
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/10"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Offers Grid: 2 columns on desktop, 1 on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-3 flex flex-col justify-between relative overflow-hidden hover:border-slate-700 transition-all shadow-md group"
                    >
                      <div 
                        className="absolute top-0 right-0 w-20 h-20 rounded-full blur-xl opacity-15 pointer-events-none"
                        style={{ backgroundColor: offer.color }}
                      />

                      <div className="relative z-10 space-y-2">
                        {/* Top: Brand info, Back Button & discount badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white border border-white/10 shadow-sm"
                              style={{ backgroundColor: offer.color }}
                            >
                              {offer.logoLetter}
                            </div>
                            <div>
                              <div className="text-xs font-black text-white flex items-center gap-1">
                                <span>{offer.name}</span>
                                <CheckCircle2 className="w-3 h-3 text-blue-400" />
                              </div>
                              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                                {offer.category}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Back button on Card */}
                            <button
                              type="button"
                              onClick={() => setMemberTab('dashboard')}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/5 text-[9px] font-semibold transition-all cursor-pointer"
                              title="Back to Dashboard"
                            >
                              <ArrowLeft className="w-2.5 h-2.5" />
                              <span>Back</span>
                            </button>

                            <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                              {offer.discount}
                            </span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <div className="text-xs font-black text-slate-100 truncate">{offer.title}</div>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug line-clamp-2">{offer.desc}</p>
                        </div>

                        {/* Coupon Code Strip */}
                        <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-950/80 border border-white/5 font-mono">
                          <span className="text-[10px] font-bold text-amber-300 tracking-wider truncate px-1">
                            {offer.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (offer.url) handleAdClick(offer.id);
                              copyCodeWithToast(offer.code, offer.name);
                            }}
                            className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                            title="Copy Coupon Code"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Action Buttons: Back, Deal Memo, and Use Now */}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDealMemo(offer)}
                          className="flex-1 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-blue-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Memo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (offer.url) {
                              handleAdClick(offer.id);
                              try {
                                window.open(offer.url, '_blank', 'noopener,noreferrer');
                              } catch (e) {
                                console.warn('Could not open external link:', e);
                              }
                            }
                            copyCodeWithToast(offer.code, offer.name);
                          }}
                          className="flex-1 py-2 rounded-xl bg-white hover:bg-slate-200 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>{(offer as any).ctaLabel || 'Use Now'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 9. PROMOTIONAL CAMPAIGNS SECTION (With Back Buttons) */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">Promotional Campaigns</span>
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      3 LIVE
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToast?.('Campaign Vault', 'All 3 campaigns are currently active for verified charter members.', 'info')}
                    className="text-[9px] font-bold text-slate-400 hover:text-white transition-colors"
                  >
                    View all
                  </button>
                </div>

                <div className="space-y-2">
                  {promotionalCampaigns.map((camp) => (
                    <div
                      key={camp.id}
                      className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-3 flex items-center gap-3 relative overflow-hidden shadow-md group hover:border-slate-700 transition-all"
                    >
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm text-white border border-white/10 shrink-0 shadow-md"
                        style={{ backgroundColor: camp.color }}
                      >
                        {camp.brand[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5 tracking-wider">
                            {camp.tag}
                          </span>
                          <span className="text-[8.5px] font-mono text-slate-400">• {camp.time}</span>
                        </div>
                        <div className="text-xs font-black text-white truncate mt-0.5">{camp.title}</div>
                        <p className="text-[10px] text-slate-300/80 mt-0.5 line-clamp-1">{camp.desc}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Back button on Card */}
                        <button
                          type="button"
                          onClick={() => setMemberTab('dashboard')}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer border border-white/5"
                          title="Back to Dashboard"
                        >
                          <ArrowLeft className="w-2.5 h-2.5" /> Back
                        </button>
                        <button
                          type="button"
                          onClick={() => copyCodeWithToast(camp.code, camp.title)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-black text-[10px] uppercase tracking-wider shrink-0 transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          {camp.cta}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 10. HOW IT WORKS 3-STEP FOOTER BAR */}
              <div className="rounded-2xl bg-slate-900/40 border border-white/5 p-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400">
                  <span className="font-mono text-amber-400">01</span>
                  <span>Browse Deals</span>
                  <span className="text-white/20">•</span>
                  <span className="font-mono text-amber-400">02</span>
                  <span>Copy Code</span>
                  <span className="text-white/20">•</span>
                  <span className="font-mono text-amber-400">03</span>
                  <span>Earn Vault Credit</span>
                </div>
                <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-widest text-slate-500 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>KYC Verified Merchant Gateway</span>
                </div>
              </div>

              {/* OFFICIAL DEAL MEMO MODAL (Every Deal Has A Certified Memo with Back Buttons) */}
              {selectedDealMemo && (
                <Modal
                  isOpen={!!selectedDealMemo}
                  onClose={() => setSelectedDealMemo(null)}
                  title={`Deal Memo: ${selectedDealMemo.name}`}
                >
                  <div className="space-y-4 text-left p-1 select-none">
                    {/* Memo Top Navigation with Back Buttons */}
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <button
                        type="button"
                        onClick={() => setSelectedDealMemo(null)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Deals</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDealMemo(null);
                          setMemberTab('dashboard');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Dashboard</span>
                      </button>
                    </div>

                    {/* Certified Paper Memo Document Container */}
                    <div className="relative bg-white text-slate-950 rounded-2xl p-5 shadow-xl border border-blue-100 overflow-hidden">
                      {/* Watermark */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] rotate-[-25deg] select-none text-center">
                        <span className="text-2xl font-black text-blue-900 tracking-widest leading-none">
                          T.U.T. OFFICIAL DEAL VOUCHER
                        </span>
                      </div>

                      {/* Header of Document */}
                      <div className="relative border-b border-blue-100 pb-3 flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base shadow"
                            style={{ backgroundColor: selectedDealMemo.color || '#3B82F6' }}
                          >
                            {selectedDealMemo.logoLetter || selectedDealMemo.name[0]}
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-blue-900/50 uppercase tracking-[0.2em] block">
                              OFFICIAL PARTNER VOUCHER MEMO
                            </span>
                            <h4 className="text-base font-black text-blue-950 leading-tight">
                              {selectedDealMemo.name}
                            </h4>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-600 text-white px-2 py-0.5 rounded shadow">
                            Verified
                          </span>
                          <span className="text-[9px] font-mono font-bold text-slate-400 block mt-1">
                            Ref: MEMO-{selectedDealMemo.id}
                          </span>
                        </div>
                      </div>

                      {/* Memo Details Body */}
                      <div className="py-3 space-y-3 font-sans text-xs">
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="font-bold text-slate-400 uppercase text-[9px]">Offer Title</span>
                          <span className="font-bold text-blue-950">{selectedDealMemo.title}</span>
                        </div>

                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="font-bold text-slate-400 uppercase text-[9px]">Perk Discount</span>
                          <span className="font-black text-emerald-600 font-mono text-sm">{selectedDealMemo.discount}</span>
                        </div>

                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="font-bold text-slate-400 uppercase text-[9px]">Potential Saving</span>
                          <span className="font-black text-amber-600 font-mono text-xs">{selectedDealMemo.saving || '৳300+'}</span>
                        </div>

                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="font-bold text-slate-400 uppercase text-[9px]">Validity Expiration</span>
                          <span className="font-mono text-slate-700">{selectedDealMemo.valid || 'Active'}</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Terms & Conditions</span>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {selectedDealMemo.desc || "Verified T.U.T. Authority member partnership benefit. Guaranteed usury-free zero interest savings."}
                          </p>
                        </div>

                        {/* Voucher Code Box */}
                        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[8px] font-black uppercase tracking-wider text-blue-800/70 block">
                              EXCLUSIVE VOUCHER PROMO CODE
                            </span>
                            <span className="font-mono font-black text-sm tracking-wider text-blue-950">
                              {selectedDealMemo.code}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyCodeWithToast(selectedDealMemo.code, selectedDealMemo.name)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </button>
                        </div>
                      </div>

                      {/* Footer Stamp & Chairman Signature */}
                      <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between items-end gap-3">
                        <div className="p-1.5 bg-slate-950 rounded-lg">
                          <CustomQRCode value={`TUT-DEAL-${selectedDealMemo.id}-${selectedDealMemo.code}`} />
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-bold text-slate-400 uppercase block">Authorized Signatory</span>
                          <span className="font-serif text-xs text-blue-950 font-medium italic block">Tahsin Ullah Tusher</span>
                          <span className="text-[7px] font-black text-blue-900/40 uppercase tracking-widest block">T.U.T. Authority Chairman</span>
                        </div>
                      </div>
                    </div>

                    {/* Memo Action Buttons */}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDealMemo(null);
                          setMemberTab('dashboard');
                        }}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-white/10"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Dashboard</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedDealMemo.url) {
                            handleAdClick(selectedDealMemo.id);
                            try {
                              window.open(selectedDealMemo.url, '_blank', 'noopener,noreferrer');
                            } catch (e) {
                              console.warn('Could not open external link:', e);
                            }
                          }
                          copyCodeWithToast(selectedDealMemo.code, selectedDealMemo.name);
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        <span>Redeem on Site</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </Modal>
              )}

              {/* STORY HIGHLIGHTS DETAIL MODAL (With Back Buttons) */}
              {activeStoryModal && (
                <Modal
                  isOpen={!!activeStoryModal}
                  onClose={() => setActiveStoryModal(null)}
                  title={`Story: ${activeStoryModal.label}`}
                >
                  <div className="space-y-4 text-center p-2">
                    {/* Top Back Buttons */}
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <button
                        type="button"
                        onClick={() => setActiveStoryModal(null)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveStoryModal(null);
                          setMemberTab('dashboard');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Dashboard</span>
                      </button>
                    </div>

                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-3xl mx-auto shadow-xl shadow-amber-500/20">
                      {activeStoryModal.emoji}
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {activeStoryModal.tag}
                      </span>
                      <h3 className="text-base font-black text-white mt-2">{activeStoryModal.label} Highlights</h3>
                      <p className="text-xs text-slate-300 mt-1">{activeStoryModal.info}</p>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-white/10 text-xs font-mono text-amber-400">
                      Active for verified T.U.T. Members • 100% Zero Usury Policy
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveStoryModal(null);
                          setMemberTab('dashboard');
                        }}
                        className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-white/10"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Dashboard</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveStoryModal(null)}
                        className="flex-1 py-2.5 rounded-xl bg-white text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all cursor-pointer"
                      >
                        Close Story
                      </button>
                    </div>
                  </div>
                </Modal>
              )}

              {/* VIDEO CLIP PREVIEW MODAL (With Back Buttons) */}
              {activePromoVideoModal && (
                <Modal
                  isOpen={!!activePromoVideoModal}
                  onClose={() => setActivePromoVideoModal(null)}
                  title={activePromoVideoModal.brand}
                >
                  <div className="space-y-4 text-center p-2">
                    {/* Top Back Buttons */}
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <button
                        type="button"
                        onClick={() => setActivePromoVideoModal(null)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActivePromoVideoModal(null);
                          setMemberTab('dashboard');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Dashboard</span>
                      </button>
                    </div>

                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                      <Play className="w-6 h-6 fill-current" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">{activePromoVideoModal.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">Official broadcast partnership clip from T.U.T. Clearing Vault</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-2">
                      <div className="text-[10px] font-mono text-slate-400">VIDEO STREAMING PROTOCOL</div>
                      <div className="text-xs text-emerald-400 font-bold">HD 1080p Encrypted Feed Active</div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-emerald-500 rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePromoVideoModal(null);
                          setMemberTab('dashboard');
                        }}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer border border-white/10"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Dashboard</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          copyCodeWithToast('BKASHZERO', 'Sponsored Deal');
                          setActivePromoVideoModal(null);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-amber-300 transition-all cursor-pointer"
                      >
                        Claim Perk
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePromoVideoModal(null)}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 text-white font-bold text-xs uppercase tracking-wider hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </Modal>
              )}

            </div>
          );
        })()}

        {/* TAB: WALLETS & PAYMENT METHODS PROTOCOL */}
        {memberTab === 'wallets' && (
          <div className="space-y-6 text-left animate-fade-in select-none pb-24">
            
            {/* Header Workspace */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 border border-white/5 rounded-3xl p-5 relative overflow-hidden shadow-xl">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMemberTab('profile')}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all cursor-pointer text-xs"
                    title="Back to Profile"
                  >
                    ←
                  </button>
                  <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                    Financial Accounts
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Payment Methods Workspace</h2>
                <p className="text-[10px] sm:text-xs text-slate-400 font-bold">Securely configure your payout networks, automate receipts, and manage beta products.</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setMemberTab('dashboard')}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-black text-[9.5px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                >
                  Home Console
                </button>
                <button
                  onClick={() => setShowAddWalletModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9.5px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/15 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Link Wallet
                </button>
              </div>
            </div>

            {/* Dynamic Local Alerts bar */}
            {localToast && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "p-3 rounded-2xl border text-xs font-black uppercase tracking-wide flex items-center gap-2 shadow-lg",
                  localToast.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                  localToast.type === 'danger' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                  "bg-amber-500/10 border-amber-500/20 text-amber-400"
                )}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-ping shrink-0 bg-current" />
                <span>{localToast.message}</span>
              </motion.div>
            )}

            {/* Dual Column Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              
              {/* LEFT COLUMN: ACTIVE DIGITAL WALLETS (bKash / Nagad only) */}
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shadow-inner">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">Active Payment Wallets</h3>
                      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-0.5">Automated local remittance nodes</p>
                    </div>
                  </div>
                  <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">BANGLADESH</span>
                </div>

                <div className="space-y-4">
                  {walletLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="animate-pulse bg-slate-900/60 border border-white/5 rounded-2xl p-4.5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 w-full">
                            <div className="w-10 h-10 rounded-xl bg-slate-800/60 shrink-0" />
                            <div className="space-y-2 w-full">
                              <div className="h-3.5 bg-slate-800/60 rounded w-1/3" />
                              <div className="h-3 bg-slate-800/40 rounded w-1/2" />
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-slate-800/40 shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : wallets.length === 0 ? (
                    <div className="py-16 text-center bg-slate-950/20 border border-dashed border-white/5 rounded-3xl space-y-4">
                      <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-600 mx-auto text-lg border border-white/5">৳</div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">No wallets linked yet</h4>
                        <p className="text-[10.5px] text-slate-500 max-w-xs mx-auto leading-normal">Link your verified bKash or Nagad mobile personal wallets to authorize instant digital loans and deposits.</p>
                      </div>
                      <button
                        onClick={() => setShowAddWalletModal(true)}
                        className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/25 text-indigo-400 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                      >
                        + Configure Wallet Now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {wallets.map((w) => {
                        const isbKash = w.provider === 'bKash';
                        const colorClass = isbKash ? '#e2136e' : '#f64a1e';
                        const maskNum = w.mobileNumber.slice(0, 3) + '***' + w.mobileNumber.slice(-4);
                        return (
                          <div 
                            key={w.id} 
                            className={cn(
                              "relative overflow-hidden rounded-2xl border p-4.5 transition-all shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4",
                              w.isDefault 
                                ? "bg-slate-900/60 border-indigo-500/30 shadow-[0_4px_15px_rgba(99,102,241,0.08)]" 
                                : "bg-slate-950/30 border-white/5 hover:border-white/15"
                            )}
                          >
                            {/* Decorative ambient provider background highlight */}
                            <div 
                              className="absolute top-0 right-0 w-28 h-28 rounded-full blur-2xl opacity-[0.03] pointer-events-none"
                              style={{ backgroundColor: colorClass }}
                            />

                            <div className="flex items-start gap-3.5 min-w-0">
                              {/* Provider Brand Logo */}
                              {isbKash ? <BkashLogo size="md" /> : <NagadLogo size="md" />}

                              <div className="min-w-0 space-y-1.5 text-left">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">{w.provider} Node</h4>
                                  
                                  {w.isDefault && (
                                    <span className="text-[7.5px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                                      ★ Primary Receiving
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[10.5px] font-bold text-slate-300 truncate font-mono">{w.holderName.toUpperCase()}</p>
                                  <p className="text-[10px] font-mono font-bold text-slate-400">Mobile: <strong className="text-white">{maskNum}</strong></p>
                                  <p className="text-[8px] text-slate-500">Linked: {w.dateLinked ? format(w.dateLinked, 'MMMM dd, yyyy') : 'Recently'}</p>
                                </div>
                              </div>
                            </div>

                            {/* Verification & Action Suite */}
                            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0 border-t md:border-t-0 border-white/5 pt-3.5 md:pt-0">
                              <div className="flex items-center gap-1.5">
                                {w.isVerified ? (
                                  <span className="inline-flex items-center gap-1 text-[7.5px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                                    ✓ Bonded & Verified
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setOtpWallet(w);
                                      setOtpTimer(120);
                                      setOtpCode('');
                                      setOtpError('');
                                      setShowOtpModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 text-[7.5px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 px-2.5 py-1 rounded transition-colors cursor-pointer animate-pulse"
                                    title="Verify ownership with secure OTP challenge"
                                  >
                                    ⚠ Pending Verification
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Set default receiving channel trigger */}
                                {!w.isDefault && (
                                  <button
                                    onClick={() => handleSetDefaultWallet(w.id)}
                                    className="text-[8px] font-black text-slate-400 hover:text-white uppercase tracking-widest bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/5 transition-all cursor-pointer"
                                  >
                                    Set Primary
                                  </button>
                                )}

                                {/* Edit account details */}
                                <button
                                  onClick={() => {
                                    setEditWalletId(w.id);
                                    setEditWalletProvider(w.provider);
                                    setEditWalletHolder(w.holderName);
                                    setEditWalletMobile(w.mobileNumber);
                                    setShowEditWalletModal(true);
                                  }}
                                  className="p-1 text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer"
                                  title="Edit account name & mobile node"
                                >
                                  ✎
                                </button>

                                {/* Unlink wallet */}
                                <button
                                  onClick={() => handleRemoveWallet(w.id)}
                                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer font-black"
                                  title="Unlink and disconnect node"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Wallet Dotted Entrypoint Card */}
                  <button
                    onClick={() => setShowAddWalletModal(true)}
                    className="w-full py-5 border-2 border-dashed border-white/5 hover:border-indigo-500/20 hover:bg-indigo-500/[0.02] rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer select-none"
                  >
                    <Plus className="w-5 h-5 text-indigo-400/60" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Link New Mobile Wallet</span>
                  </button>

                </div>
              </div>

              {/* RIGHT COLUMN: BANK CARDS (BETA WAITLIST SECTION) */}
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-inner">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">Bank Cards Protocol</h3>
                        <span className="text-[7.5px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/15 px-1.5 py-0.5 rounded leading-none border border-amber-500/20">BETA</span>
                      </div>
                      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-0.5">International Visa/Mastercard Integration</p>
                    </div>
                  </div>
                  <span className="text-[8px] font-mono text-amber-500 font-extrabold uppercase tracking-widest">COMING SOON</span>
                </div>

                {/* Active Payable T.U.T. Card Security Shortcut */}
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-between gap-3 text-left">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-[11px] font-black text-emerald-300 uppercase tracking-wider leading-none">
                        T.U.T. Member Card & Wallet Pay Active
                      </h4>
                      <p className="text-[10px] text-slate-300 font-semibold leading-normal">
                        Your 16-digit T.U.T. Card is live for paying partner apps using your Card Number & 6-digit Secret Code or direct Wallet balance.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCardSecurityModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-[10px] uppercase tracking-wider shrink-0 cursor-pointer transition-colors"
                  >
                    Manage Card
                  </button>
                </div>

                {/* Professional Beta restriction notification banner */}
                <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl flex gap-3 text-left">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-[10.5px] font-black text-amber-400 uppercase tracking-wider leading-none">External Bank Cards Beta</h4>
                    <p className="text-[10px] text-slate-300 font-bold leading-normal">
                      Third-party Visa/Mastercard linking is in waitlist Beta. Use your T.U.T. Card above for instant verified transactions.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {cards.length === 0 ? (
                    <div className="py-12 text-center bg-slate-950/20 border border-dashed border-white/5 rounded-3xl space-y-3">
                      <CreditCard className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-[10.5px] text-slate-400 font-bold">No debit or credit cards linked</p>
                      <button
                        onClick={() => setShowAddCardModal(true)}
                        className="px-4 py-2 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/25 text-orange-400 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                      >
                        Join Beta Waitlist
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {cards.map((c) => {
                        const isVisa = c.cardType === 'Visa';
                        return (
                          <div 
                            key={c.id}
                            className="h-32 rounded-2xl p-4.5 flex flex-col justify-between relative overflow-hidden shadow-xl border border-white/10 group select-none"
                            style={{
                              background: isVisa 
                                ? 'linear-gradient(135deg, #091a45 0%, #163c96 50%, #06102b 100%)' 
                                : 'linear-gradient(135deg, #1f1406 0%, #3e2608 50%, #120b02 100%)'
                            }}
                          >
                            {/* Card Chip decoration */}
                            <div className="absolute top-4 left-4 w-7 h-5.5 rounded bg-amber-500/25 border border-amber-400/25 flex items-center justify-center overflow-hidden">
                              <div className="grid grid-cols-3 gap-[1px] w-full h-full p-0.5 opacity-60">
                                <div className="border-r border-amber-400/20"></div>
                                <div className="border-r border-amber-400/20"></div>
                                <div></div>
                              </div>
                            </div>

                            {/* Watermark branding */}
                            <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-white/5 rounded-full blur-xl group-hover:scale-110 transition-transform pointer-events-none" />

                            {/* Beta label on upper right */}
                            <div className="flex justify-between items-start self-end leading-none">
                              <span className="text-[8px] font-black text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/20 select-none uppercase tracking-widest">BETA</span>
                            </div>

                            {/* Masked Card Number */}
                            <div className="text-left font-mono font-black text-[13px] text-white tracking-widest my-2 drop-shadow-md select-none">
                              {c.cardNumber}
                            </div>

                            {/* Holder & Expiry details */}
                            <div className="flex justify-between items-end border-t border-white/5 pt-2 select-none">
                              <div className="text-left min-w-0">
                                <span className="text-[6.5px] font-black text-white/45 uppercase tracking-widest block leading-none">Cardholder</span>
                                <span className="text-[9.5px] font-mono font-black text-white truncate block uppercase leading-none mt-1">{c.holderName}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[6.5px] font-black text-white/45 uppercase tracking-widest block leading-none">Expires</span>
                                <span className="text-[9.5px] font-mono font-black text-white block leading-none mt-1">{c.expiryDate}</span>
                              </div>
                            </div>

                            {/* Unlink Beta Waitlist trigger */}
                            <button
                              onClick={() => handleRemoveCard(c.id)}
                              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-950/40 hover:bg-rose-500/20 border border-white/5 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer text-[9px] font-bold"
                              title="Cancel waitlist status"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Join Beta Waitlist Dotted trigger */}
                  <button
                    onClick={() => setShowAddCardModal(true)}
                    className="w-full py-5 border-2 border-dashed border-white/5 hover:border-orange-500/20 hover:bg-orange-500/[0.01] rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer select-none"
                  >
                    <Plus className="w-5 h-5 text-orange-400/60" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Join Bank Cards Waitlist</span>
                  </button>

                </div>
              </div>

            </div>

            {/* OTP VERIFICATION FLOATING MODAL OVERLAY (UI ONLY VALIDATION) */}
            <AnimatePresence>
              {showOtpModal && otpWallet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl text-left"
                  >
                    <button
                      onClick={() => {
                        setShowOtpModal(false);
                        setOtpWallet(null);
                      }}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">{otpWallet.provider} OTP Verification</h4>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Dual-Factor Ledger Handshake</p>
                      </div>
                    </div>

                    <div className="space-y-4 text-center">
                      <div className="py-2.5 px-3 bg-slate-950 border border-white/5 rounded-2xl text-left space-y-1">
                        <span className="text-[7px] text-slate-500 font-black uppercase tracking-widest leading-none block">Target Mobile Node</span>
                        <span className="text-xs font-mono font-bold text-white block">{otpWallet.mobileNumber}</span>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-normal text-left">
                        A secure 6-digit authentication token has been generated. For testing validation, enter any 6 digits (e.g. <strong className="text-indigo-400">123456</strong>) to securely bond this node.
                      </p>

                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div className="space-y-1 text-left">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Authentication Token</label>
                          <input
                            type="text"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="------"
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-3 text-center text-lg font-mono font-black text-white tracking-widest focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-800"
                            autoFocus
                          />
                          {otpError && (
                            <p className="text-[9.5px] text-rose-400 font-black uppercase mt-1 text-center">⚠️ {otpError}</p>
                          )}
                        </div>

                        {/* Countdown ticker & Resend Controls */}
                        <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-wider text-slate-500 border-t border-white/5 pt-3">
                          <span>Expiry: <strong className="text-white font-mono">{Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}</strong></span>
                          <button
                            type="button"
                            disabled={otpResendDisabled}
                            onClick={handleResendOtp}
                            className={cn(
                              "text-[9px] uppercase tracking-widest cursor-pointer",
                              otpResendDisabled ? "text-slate-700 cursor-not-allowed" : "text-sky-400 hover:underline"
                            )}
                          >
                            Resend Token
                          </button>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
                        >
                          Bond & Verify Wallet
                        </button>
                      </form>
                    </div>

                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* ADD WALLET MODAL */}
            <AnimatePresence>
              {showAddWalletModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl text-left"
                  >
                    <button
                      onClick={() => setShowAddWalletModal(false)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight font-sans">Link Payment Wallet</h4>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Establish physical remittance gateway</p>
                      </div>
                    </div>

                    <form onSubmit={handleAddWallet} className="space-y-4 font-sans">
                      {/* Provider Select */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Wallet Operator</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setAddWalletProvider('bKash')}
                            className={cn(
                              "py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer",
                              addWalletProvider === 'bKash' 
                                ? "bg-[#e2136e]/15 border-[#e2136e]/50 text-white" 
                                : "bg-slate-950 border-white/10 text-slate-400 hover:border-white/20"
                            )}
                          >
                            <BkashLogo size="xs" />
                            <span>bKash</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddWalletProvider('Nagad')}
                            className={cn(
                              "py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer",
                              addWalletProvider === 'Nagad' 
                                ? "bg-[#f64a1e]/15 border-[#f64a1e]/50 text-white" 
                                : "bg-slate-950 border-white/10 text-slate-400 hover:border-white/20"
                            )}
                          >
                            <NagadLogo size="xs" />
                            <span>Nagad</span>
                          </button>
                        </div>
                      </div>

                      {/* Holder Name */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Account Holder Name</label>
                        <input
                          type="text"
                          required
                          value={addWalletHolder}
                          onChange={(e) => setAddWalletHolder(e.target.value)}
                          placeholder="e.g. TASIN ULLAH TUSHER"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-bold uppercase tracking-wide focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                        />
                      </div>

                      {/* Mobile Number */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">11-Digit Mobile Number</label>
                        <input
                          type="text"
                          required
                          maxLength={11}
                          value={addWalletMobile}
                          onChange={(e) => setAddWalletMobile(e.target.value.replace(/\D/g, ''))}
                          placeholder="e.g. 01713710607"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono font-black text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                        />
                      </div>

                      {/* Default receiving toggle */}
                      <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={addWalletDefault}
                          onChange={(e) => setAddWalletDefault(e.target.checked)}
                          className="rounded border-white/10 bg-slate-950 text-indigo-600 focus:ring-0 w-4 h-4"
                        />
                        <span className="text-[9.5px] font-black uppercase tracking-wide text-slate-400">Designate as default receiving channel</span>
                      </label>

                      <button
                        type="submit"
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-[0.98] cursor-pointer mt-2"
                      >
                        Add & Send SMS Verification
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* EDIT WALLET MODAL */}
            <AnimatePresence>
              {showEditWalletModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl text-left"
                  >
                    <button
                      onClick={() => setShowEditWalletModal(false)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">Edit Wallet Info</h4>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Modify database node settings</p>
                      </div>
                    </div>

                    <form onSubmit={handleEditWallet} className="space-y-4">
                      {/* Operator text */}
                      <div className="py-2 px-3 bg-slate-950 rounded-xl border border-white/5 text-[11px] font-black uppercase text-white/50">
                        Operator: <strong className="text-white">{editWalletProvider}</strong>
                      </div>

                      {/* Holder Name */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Account Holder Name</label>
                        <input
                          type="text"
                          required
                          value={editWalletHolder}
                          onChange={(e) => setEditWalletHolder(e.target.value)}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-bold uppercase tracking-wide focus:outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>

                      {/* Mobile Number */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">11-Digit Mobile Number</label>
                        <input
                          type="text"
                          required
                          maxLength={11}
                          value={editWalletMobile}
                          onChange={(e) => setEditWalletMobile(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono font-black text-white focus:outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-md cursor-pointer mt-2"
                      >
                        Save Wallet Node
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* ADD BANK CARD (BETA) MODAL */}
            <AnimatePresence>
              {showAddCardModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl text-left"
                  >
                    <button
                      onClick={() => setShowAddCardModal(false)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">Join Bank Card Beta</h4>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">International Gateway Waitlist Registration</p>
                      </div>
                    </div>

                    <form onSubmit={handleAddCard} className="space-y-4 font-sans">
                      {/* Card Type */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Card Issuer</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setAddCardType('Visa')}
                            className={cn(
                              "py-2.5 rounded-xl border font-black text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                              addCardType === 'Visa' 
                                ? "bg-sky-500/15 border-sky-500/40 text-sky-400" 
                                : "bg-slate-950 border-white/5 text-slate-400 hover:border-white/10"
                            )}
                          >
                            Visa
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddCardType('Mastercard')}
                            className={cn(
                              "py-2.5 rounded-xl border font-black text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                              addCardType === 'Mastercard' 
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-500" 
                                : "bg-slate-950 border-white/5 text-slate-400 hover:border-white/10"
                            )}
                          >
                            Mastercard
                          </button>
                        </div>
                      </div>

                      {/* Cardholder Name */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cardholder Name (Uppercase)</label>
                        <input
                          type="text"
                          required
                          value={addCardHolder}
                          onChange={(e) => setAddCardHolder(e.target.value)}
                          placeholder="TASIN ULLAH TUSHER"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono font-black uppercase tracking-wide focus:outline-none focus:border-orange-500 transition-all placeholder:text-slate-700"
                        />
                      </div>

                      {/* Card Number */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">16-Digit Card Number</label>
                        <input
                          type="text"
                          required
                          maxLength={19}
                          value={addCardNumber}
                          onChange={(e) => {
                            // Automatically format card digits in clusters of 4
                            let v = e.target.value.replace(/\D/g, '');
                            let formatted = v.match(/.{1,4}/g)?.join(' ') || v;
                            setAddCardNumber(formatted);
                          }}
                          placeholder="4111 2222 3333 4444"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono font-black text-white focus:outline-none focus:border-orange-500 transition-all placeholder:text-slate-700"
                        />
                      </div>

                      {/* Expiry MM/YY */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Expiry Date (MM/YY)</label>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          value={addCardExpiry}
                          onChange={(e) => {
                            let v = e.target.value.replace(/\D/g, '');
                            if (v.length > 2) {
                              v = v.slice(0, 2) + '/' + v.slice(2, 4);
                            }
                            setAddCardExpiry(v);
                          }}
                          placeholder="09/30"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono font-black text-white focus:outline-none focus:border-orange-500 transition-all placeholder:text-slate-700"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-md cursor-pointer mt-2"
                      >
                        Register Waitlist Position
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        )}

        {/* TAB 5: PROFILE & SETTINGS (Redesigned with user reference layout) */}
        {memberTab === 'profile' && (() => {
          const limit = profile.borrowingLimit ?? (profile.subscriptionTier === 'gold' ? 2500 : profile.subscriptionTier === 'silver' ? 1500 : profile.subscriptionTier === 'bronze' ? 500 : 0);
          const remainingDebt = remainingDebtVal;
          const availableBorrow = Math.max(0, limit - remainingDebt);
          const usagePercent = limit > 0 ? Math.min(100, Math.round((remainingDebt / limit) * 100)) : 0;
          const joinedDate = profile.createdAt?.toDate ? format(profile.createdAt.toDate(), 'dd MMM yyyy') : '21 Sep 2026';
          
          const tierDisplayName = profile.subscriptionTier === 'gold' ? 'Gold Sovereign' : profile.subscriptionTier === 'silver' ? 'Silver Executive' : profile.subscriptionTier === 'bronze' ? 'Bronze Reserve' : 'Standard Member';
          const tierColor = profile.subscriptionTier === 'gold' ? '#DFC07C' : profile.subscriptionTier === 'silver' ? '#CBD5E1' : profile.subscriptionTier === 'bronze' ? '#D39D73' : '#64748B';
          const tierEmoji = profile.subscriptionTier === 'gold' ? '🥇' : profile.subscriptionTier === 'silver' ? '🥈' : profile.subscriptionTier === 'bronze' ? '🥉' : '🛡️';

          const fields = [profile.name, profile.nid, profile.address, profile.occupation, profile.phone, profile.email, profile.photoUrl, profile.fatherName, profile.motherName, profile.dob, profile.bloodGroup, profile.emergencyContact, profile.nomineeName, profile.nomineeRelation, profile.permanentAddress, profile.referenceContact];
          const filled = fields.filter(Boolean).length;
          const completeness = Math.round((filled / fields.length) * 100);
          const healthScore = remainingDebt > 0 ? Math.max(60, 100 - Math.floor((remainingDebt / limit) * 40)) : 100;

          return (
            <div className="space-y-4 text-left select-none pb-20 md:pb-8 max-w-md lg:max-w-lg mx-auto">
              
              {/* Clean Profile Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMemberTab('dashboard')}
                    className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <div>
                    <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">Member Profile</h1>
                    <p className="text-xs text-slate-400 leading-tight">Identity, security, and linked wallets</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>

              {/* HERO CARD */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950 border border-white/10 p-3.5 sm:p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative w-13 h-13 rounded-full flex-shrink-0 flex items-center justify-center border-2" style={{ borderColor: tierColor }}>
                    {profile.photoUrl ? (
                      <img src={profile.photoUrl} alt={profile.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xl font-black text-blue-400">
                        {profile.name.charAt(0)}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
                  </div>

                  {/* Name and Badges */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-sm sm:text-base font-black text-white tracking-tight truncate leading-tight">
                      {profile.name}
                    </h2>
                    
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-md leading-none font-mono">
                        <ShieldCheck className="w-2.5 h-2.5" /> VERIFIED KYC L3
                      </span>
                      <span 
                        className="inline-flex items-center gap-0.5 text-[8.5px] font-bold tracking-wider px-1.5 py-0.5 rounded-md leading-none uppercase font-mono"
                        style={{ color: tierColor, backgroundColor: `${tierColor}15`, border: `1px solid ${tierColor}35` }}
                      >
                        {tierEmoji} {tierDisplayName}
                      </span>
                      <button
                        onClick={() => {
                          if (profile.memberId) {
                            navigator.clipboard.writeText(profile.memberId);
                            if (addToast) addToast('Copied', `Member ID ${profile.memberId} copied to clipboard!`, 'success');
                          }
                        }}
                        className="inline-flex items-center gap-0.5 text-[8.5px] font-mono text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                        title="Click to copy ID"
                      >
                        <span>{profile.memberId || 'TUT-MBR-PENDING'}</span>
                        <Copy className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[9.5px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-white/5">
                  {profile.occupation || 'Member'} &nbsp;•&nbsp; Joined {joinedDate} &nbsp;•&nbsp; <span className="text-emerald-400 font-bold">Lifetime Active</span>
                </p>
              </div>

              {/* LEDGER STATS CARD */}
              <div className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-white/10 p-3 sm:p-3.5 shadow-lg space-y-2.5">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
                      TOTAL<br />DEPOSITS
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-emerald-400 mt-1 block">
                      ৳{(profile.totalDeposit || 0).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
                      OUTSTANDING<br />DEBT
                    </span>
                    <span className={cn("text-xs sm:text-sm font-black font-mono mt-1 block", remainingDebt > 0 ? "text-rose-400" : "text-white")}>
                      ৳{remainingDebt.toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
                      BORROW<br />CAPACITY
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-blue-400 mt-1 block">
                      ৳{availableBorrow.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="h-[1px] bg-white/5" />

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[8.5px] font-bold uppercase text-slate-400 tracking-wider">
                    <span>RESERVE LIMIT USED</span>
                    <span className="font-mono text-emerald-400">{usagePercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950/80 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        usagePercent > 75 ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" : "bg-gradient-to-r from-blue-500 to-sky-400 shadow-[0_0_6px_rgba(59,130,246,0.4)]"
                      )}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* QUICK ACTIONS */}
              <div className="space-y-1.5 pt-0.5">
                <h3 className="text-[9.5px] font-black uppercase tracking-[0.18em] text-slate-400 ml-1">
                  QUICK ACTIONS
                </h3>
                
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {/* Action 1: Edit Profile */}
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-white/5 hover:border-blue-500/30 hover:bg-slate-800/60 transition-all cursor-pointer group active:scale-95 text-center"
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform mb-1 shadow-sm">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[8.5px] font-bold text-slate-300 group-hover:text-white leading-tight">Edit<br />Profile</span>
                  </button>

                  {/* Action 2: QR Verify */}
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/30 hover:bg-slate-800/60 transition-all cursor-pointer group active:scale-95 text-center"
                  >
                    <div className="w-9 h-9 rounded-full bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform mb-1 shadow-sm">
                      <Fingerprint className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[8.5px] font-bold text-slate-300 group-hover:text-white leading-tight">QR<br />Verify</span>
                  </button>

                  {/* Action 3: Admin Entrance (Visible ONLY for authorized Admin role) */}
                  {(profile?.role === 'admin' || profile?.email?.toLowerCase() === 'tahsinullahtusher999@gmail.com') && (
                    <button
                      onClick={() => setShowAdminLogin(true)}
                      className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-white/5 hover:border-amber-500/30 hover:bg-slate-800/60 transition-all cursor-pointer group active:scale-95 text-center"
                    >
                      <div className="w-9 h-9 rounded-full bg-amber-600/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform mb-1 shadow-sm">
                        <Cpu className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[8.5px] font-bold text-slate-300 group-hover:text-white leading-tight">Admin<br />Entrance</span>
                    </button>
                  )}

                  {/* Action 4: Download Card */}
                  <button
                    onClick={() => {
                      setSelectedDoc({
                        id: 'CERT-MEMB-2026',
                        type: 'certificate',
                        amount: 0,
                        method: 'Cash',
                        status: 'confirmed',
                        memoId: `CERT-${profile.memberId}`
                      });
                    }}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-white/5 hover:border-teal-500/30 hover:bg-slate-800/60 transition-all cursor-pointer group active:scale-95 text-center"
                  >
                    <div className="w-9 h-9 rounded-full bg-teal-600/15 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform mb-1 shadow-sm">
                      <Download className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[8.5px] font-bold text-slate-300 group-hover:text-white leading-tight">Download<br />Card</span>
                  </button>

                  {/* Action 5: Change PIN */}
                  <button
                    onClick={() => setShowPinModal(true)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-white/5 hover:border-purple-500/30 hover:bg-slate-800/60 transition-all cursor-pointer group active:scale-95 text-center"
                  >
                    <div className="w-9 h-9 rounded-full bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform mb-1 shadow-sm">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[8.5px] font-bold text-slate-300 group-hover:text-white leading-tight">Change<br />PIN</span>
                  </button>

                  {/* Action 6: Manage Wallets */}
                  <button
                    onClick={() => setMemberTab('wallets')}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-white/5 hover:border-pink-500/30 hover:bg-slate-800/60 transition-all cursor-pointer group active:scale-95 text-center"
                  >
                    <div className="w-9 h-9 rounded-full bg-pink-600/15 border border-pink-500/30 flex items-center justify-center text-pink-400 group-hover:scale-105 transition-transform mb-1 shadow-sm">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[8.5px] font-bold text-slate-300 group-hover:text-white leading-tight">Manage<br />Accounts</span>
                  </button>
                </div>
              </div>

              {/* ACCOUNT SETTINGS GROUPS */}
              <div className="space-y-2 pt-1">
                <h3 className="text-[9.5px] font-black uppercase tracking-[0.18em] text-slate-400 ml-1">
                  ACCOUNT SETTINGS
                </h3>

                {/* Group 1: Personal Information */}
                <details open className="group rounded-2xl bg-slate-900/40 border border-white/10 hover:border-slate-700/80 transition-all overflow-hidden">
                  <summary className="list-none cursor-pointer p-3 sm:p-3.5 flex items-center gap-2.5 select-none transition-colors hover:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-white tracking-tight">Personal Information</div>
                      <div className="text-[9px] text-slate-400 font-medium">Demographics · Contact · Address</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform duration-200 shrink-0" />
                  </summary>
                  <div className="px-3 sm:px-3.5 pb-3 pt-1 border-t border-white/5 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Father's Name</span>
                      <span className="font-semibold text-white text-[11px]">{profile.fatherName || 'Not Specified'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Mother's Name</span>
                      <span className="font-semibold text-white text-[11px]">{profile.motherName || 'Not Specified'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Date of Birth</span>
                      <span className="font-semibold font-mono text-white text-[11px]">{profile.dob || 'Not Specified'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Blood Group</span>
                      <span className={cn("font-semibold font-mono text-[11px]", profile.bloodGroup ? "text-rose-400" : "text-slate-400")}>
                        {profile.bloodGroup || 'Not Specified'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Occupation</span>
                      <span className="font-semibold text-white text-[11px]">{profile.occupation || 'Chief Admin'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Phone Line</span>
                      <span className="font-semibold font-mono text-white text-[11px]">{profile.phone}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Email</span>
                      <span className="font-semibold text-white text-[11px] truncate max-w-[170px]">{profile.email || 'Not Specified'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Registered Address</span>
                      <span className="font-semibold text-slate-200 text-[11px] truncate max-w-[170px]">{profile.address}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Permanent Address</span>
                      <span className="font-semibold text-slate-300 text-[11px] truncate max-w-[170px]">{profile.permanentAddress || 'Same as Registered'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Emergency Contact</span>
                      <span className="font-semibold font-mono text-white text-[11px]">{profile.emergencyContact || 'Not Specified'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Reference Contact</span>
                      <span className="font-semibold font-mono text-white text-[11px]">{profile.referenceContact || 'Not Specified'}</span>
                    </div>

                    <button 
                      onClick={() => setShowProfileModal(true)}
                      className="w-full flex items-center justify-between pt-2 pb-0.5 border-t border-white/5 text-blue-400 hover:text-blue-300 font-bold text-[11px] cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5" /> Edit Profile Info
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>
                </details>

                {/* Group 2: Government ID Verification */}
                <details className="group rounded-2xl bg-slate-900/40 border border-white/10 hover:border-slate-700/80 transition-all overflow-hidden">
                  <summary className="list-none cursor-pointer p-3 sm:p-3.5 flex items-center gap-2.5 select-none transition-colors hover:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-white tracking-tight">Government ID Verification</div>
                      <div className="text-[9px] text-slate-400 font-medium">KYC Approved · Level 3</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform duration-200 shrink-0" />
                  </summary>
                  <div className="px-3 sm:px-3.5 pb-3 pt-1 border-t border-white/5 space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">National ID / Passport</span>
                      <span className="font-bold font-mono text-white text-[11px]">{profile.nid}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">KYC Status</span>
                      <span className="text-[8.5px] font-bold uppercase text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                        Approved Level 3
                      </span>
                    </div>

                    {/* Government ID Visual Representation */}
                    <div className="rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 border border-blue-500/20 p-2.5 space-y-1.5">
                      <p className="text-[7px] font-bold text-slate-400 tracking-wider uppercase">
                        GOVERNMENT IDENTIFICATION · PEOPLE'S REPUBLIC OF BANGLADESH
                      </p>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-[9px] font-black text-blue-400 shrink-0">
                          NID
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-white truncate">{profile.name}</p>
                          <p className="text-[8.5px] font-mono text-slate-400">No: {profile.nid}</p>
                          <p className="text-[7.5px] font-bold text-emerald-400 mt-0.5">● System Compliant</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>

                {/* Group 3: Membership & Limits */}
                <details className="group rounded-2xl bg-slate-900/40 border border-white/10 hover:border-slate-700/80 transition-all overflow-hidden">
                  <summary className="list-none cursor-pointer p-3 sm:p-3.5 flex items-center gap-2.5 select-none transition-colors hover:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-white tracking-tight">Membership & Limits</div>
                      <div className="text-[9px] text-slate-400 font-medium">{tierDisplayName} · Lifetime Active</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform duration-200 shrink-0" />
                  </summary>
                  <div className="px-3 sm:px-3.5 pb-3 pt-1 border-t border-white/5 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Active Tier Level</span>
                      <span className="font-bold flex items-center gap-1.5 text-[11px]" style={{ color: tierColor }}>
                        <span>{tierEmoji}</span>
                        <span>{tierDisplayName}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Reserve Credit Limit</span>
                      <span className="font-bold font-mono text-white text-[11px]">৳{limit.toLocaleString()} BDT</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Membership Validity</span>
                      <span className="font-bold text-purple-400 text-[11px]">
                        {profile.subscriptionStatus === 'active' && profile.subscriptionExpiresAt 
                          ? `Valid till ${format(new Date(profile.subscriptionExpiresAt), 'dd MMM yyyy')}`
                          : 'Lifetime Active'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Interest Concession</span>
                      <span className="font-bold text-emerald-400 text-[11px]">
                        {profile.subscriptionTier === 'gold' ? '-5.0% Reduced' :
                         profile.subscriptionTier === 'silver' ? '-3.0% Reduced' :
                         profile.subscriptionTier === 'bronze' ? '-1.5% Reduced' : 'Base Rate'}
                      </span>
                    </div>

                    <div className="pt-1 space-y-0.5">
                      <button
                        onClick={() => {
                          setMemberTab('memos');
                          setDocFilter('loans');
                        }}
                        className="w-full flex items-center justify-between py-1 text-slate-300 hover:text-white font-semibold text-[10.5px] cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <TrendingUp className="w-3.5 h-3.5 text-blue-400" /> Loan History
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button
                        onClick={() => {
                          setMemberTab('memos');
                          setDocFilter('all');
                        }}
                        className="w-full flex items-center justify-between py-1 text-slate-300 hover:text-white font-semibold text-[10.5px] cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-blue-400" /> Ledger Statements
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  </div>
                </details>

                {/* Group 4: Security & Sessions */}
                <details className="group rounded-2xl bg-slate-900/40 border border-white/10 hover:border-slate-700/80 transition-all overflow-hidden">
                  <summary className="list-none cursor-pointer p-3 sm:p-3.5 flex items-center gap-2.5 select-none transition-colors hover:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-white tracking-tight">Security & Sessions</div>
                      <div className="text-[9px] text-slate-400 font-medium">Health {healthScore}% · Device Bonded</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform duration-200 shrink-0" />
                  </summary>
                  <div className="px-3 sm:px-3.5 pb-3 pt-1 border-t border-white/5 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Account Health Score</span>
                      <span className="font-bold text-emerald-400 text-[11px]">{healthScore}% {healthScore >= 90 ? 'Excellent' : 'Good'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Profile Completion</span>
                      <span className="font-bold font-mono text-blue-400 text-[11px]">{completeness}%</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Device Enclave Shield</span>
                      <span className="font-bold text-emerald-400 uppercase tracking-wider text-[10px]">Active & Bonded</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-[9.5px] font-bold uppercase text-slate-400">Device IP Node</span>
                      <span className="font-bold font-mono text-slate-400 text-[11px]">103.14.24.72</span>
                    </div>

                    <div className="pt-1 space-y-0.5">
                      <button
                        onClick={() => setShowSecuritySettingsModal(true)}
                        className="w-full flex items-center justify-between py-1 text-slate-300 hover:text-white font-semibold text-[10.5px] cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-blue-400" /> Security Settings
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button
                        onClick={() => setShowPinModal(true)}
                        className="w-full flex items-center justify-between py-1 text-slate-300 hover:text-white font-semibold text-[10.5px] cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-blue-400" /> Change PIN
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>

                    {/* Timeline */}
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <div className="flex gap-2 items-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                        <div>
                          <p className="text-[9.5px] font-bold text-white leading-tight">Authentication Successful</p>
                          <p className="text-[8px] text-slate-400">Chrome session verified via secure key exchange · Just now</p>
                        </div>
                      </div>
                      <div className="flex gap-2 items-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0" />
                        <div>
                          <p className="text-[9.5px] font-bold text-white leading-tight">Identity Keys Signed</p>
                          <p className="text-[8px] text-slate-400">Authority handshake validated · 3 hours ago</p>
                        </div>
                      </div>
                      <div className="flex gap-2 items-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1 shrink-0" />
                        <div>
                          <p className="text-[9.5px] font-bold text-slate-400 leading-tight">Session Key Refreshed</p>
                          <p className="text-[8px] text-slate-500">Ledger session auto-rolled for privacy · 24 hours ago</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>

                {/* Group 5: Linked Payment Wallets */}
                <details className="group rounded-2xl bg-slate-900/40 border border-white/10 hover:border-slate-700/80 transition-all overflow-hidden">
                  <summary className="list-none cursor-pointer p-3 sm:p-3.5 flex items-center gap-2.5 select-none transition-colors hover:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-xl bg-pink-600/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-white tracking-tight">Linked Payment Wallets</div>
                      <div className="text-[9px] text-slate-400 font-medium">3 gateways · Nagad, bKash, Cash</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform duration-200 shrink-0" />
                  </summary>
                  <div className="px-3 sm:px-3.5 pb-3 pt-1 border-t border-white/5 space-y-2 text-xs">
                    {/* Wallets list */}
                    {wallets.length === 0 ? (
                      <div className="py-2 text-center text-slate-400 text-[10px]">
                        No external digital wallets linked yet.
                      </div>
                    ) : (
                      wallets.map((w) => {
                        const isbKash = w.provider === 'bKash';
                        const colorClass = isbKash ? '#e2136e' : '#f64a1e';
                        const maskNum = w.mobileNumber.slice(0, 3) + '***' + w.mobileNumber.slice(-4);
                        return (
                          <div key={w.id} className="flex items-center justify-between py-1 border-b border-white/5">
                            <div className="flex items-center gap-2 min-w-0">
                              {isbKash ? <BkashLogo size="xs" /> : <NagadLogo size="xs" />}
                              <div className="min-w-0">
                                <div className="font-bold text-white truncate text-[10.5px]">
                                  {w.provider} Wallet Node {w.isDefault && <span className="text-amber-400">★</span>}
                                </div>
                                <div className="text-[8.5px] font-mono text-slate-400">{maskNum}</div>
                              </div>
                            </div>
                            <span className="text-[7.5px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded uppercase font-mono">
                              {w.isVerified ? 'Bonded' : 'Pending'}
                            </span>
                          </div>
                        );
                      })
                    )}

                    {/* Physical Reserve Cash */}
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-emerald-700/80 flex items-center justify-center text-white font-black text-[11px] shrink-0">
                          ৳
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-white text-[10.5px]">Physical Reserve Ledger</div>
                          <div className="text-[8.5px] text-slate-400">Over-the-counter handover</div>
                        </div>
                      </div>
                      <span className="text-[7.5px] font-bold text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded font-mono">
                        Always Active
                      </span>
                    </div>

                    <button
                      onClick={() => setMemberTab('wallets')}
                      className="w-full mt-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-[9.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>MANAGE PAYMENT METHODS</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </details>

                {/* Group 6: Manage Accounts */}
                <details className="group rounded-2xl bg-slate-900/40 border border-white/10 hover:border-slate-700/80 transition-all overflow-hidden">
                  <summary className="list-none cursor-pointer p-3 sm:p-3.5 flex items-center gap-2.5 select-none transition-colors hover:bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-xl bg-sky-600/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-white tracking-tight">Manage Accounts & Documents</div>
                      <div className="text-[9px] text-slate-400 font-medium">Cards · Linked bank accounts</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform duration-200 shrink-0" />
                  </summary>
                  <div className="px-3 sm:px-3.5 pb-3 pt-1 border-t border-white/5 space-y-1 text-xs">
                    <button
                      onClick={() => setMemberTab('wallets')}
                      className="w-full flex items-center justify-between py-1.5 text-slate-300 hover:text-white font-semibold text-[10.5px] cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-blue-400" /> Manage Accounts
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDoc({
                          id: 'CERT-MEMB-2026',
                          type: 'certificate',
                          amount: 0,
                          method: 'Cash',
                          status: 'confirmed',
                          memoId: `CERT-${profile.memberId}`
                        });
                      }}
                      className="w-full flex items-center justify-between py-1.5 text-slate-300 hover:text-white font-semibold text-[10.5px] cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Download className="w-3.5 h-3.5 text-teal-400" /> Download Card
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>
                </details>
              </div>

              {/* DANGER ZONE */}
              <div className="pt-2.5 space-y-1.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-rose-400/90 ml-1">
                  DANGER ZONE
                </div>
                <button
                  onClick={() => signOut(auth)}
                  className="w-full py-3 rounded-2xl bg-rose-950/20 border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Secure Ledger Log Out</span>
                </button>
              </div>

              {/* QR Modal Overlay */}
            <AnimatePresence>
              {showQrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 text-center space-y-5 shadow-2xl"
                  >
                    <button
                      onClick={() => setShowQrModal(false)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-white uppercase tracking-widest">Digital Identity Pass</h4>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">T.U.T Money Authority Ledger</p>
                    </div>

                    {/* QR Code Graphic Container */}
                    <div className="relative mx-auto w-48 h-48 bg-white p-4 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
                      {/* Active scanning bar animation */}
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-60 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-bounce" style={{ animationDuration: '3s' }} />
                      
                      {/* High resolution simulated vector QR Code using custom SVG */}
                      <svg className="w-full h-full text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                        {/* Position detection patterns (Three corners) */}
                        <path d="M0,0 h25 v25 h-25 z M5,5 h15 v15 h-15 z M8,8 h9 v9 h-9 z" />
                        <path d="M75,0 h25 v25 h-25 z M80,5 h15 v15 h-15 z M83,8 h9 v9 h-9 z" />
                        <path d="M0,75 h25 v25 h-25 z M5,80 h15 v15 h-15 z M8,83 h9 v9 h-9 z" />
                        {/* Alignment pattern (bottom-right) */}
                        <path d="M72,72 h12 v12 h-12 z M75,75 h6 v6 h-6 z" />
                        {/* Random pseudo-QR dots */}
                        <path d="M30,2 h4 v4 h-4 z M38,0 h6 v2 h-6 z M48,4 h4 v4 h-4 z M32,10 h2 v6 h-2 z M40,12 h6 v2 h-6 z M30,20 h6 v4 h-6 z M44,22 h8 v2 h-8 z" />
                        <path d="M2,30 h4 v4 h-4 z M10,32 h6 v2 h-6 z M2,40 h4 v4 h-4 z M12,42 h4 v2 h-4 z M22,30 h4 v6 h-4 z M20,44 h6 v2 h-6 z" />
                        <path d="M30,30 h8 v8 h-8 z M32,32 h4 v4 h-4 z M42,32 h8 v4 h-8 z M34,42 h6 v6 h-6 z M44,40 h4 v8 h-4 z" />
                        <path d="M55,2 h4 v10 h-4 z M62,0 h8 v4 h-8 z M55,16 h12 v4 h-12 z M60,22 h4 v4 h-4 z" />
                        <path d="M2,55 h4 v12 h-4 z M12,58 h6 v4 h-6 z M22,55 h4 v10 h-4 z M10,64 h10 v4 h-10 z" />
                        <path d="M30,55 h12 v4 h-12 z M34,62 h6 v4 h-6 z M30,70 h8 v4 h-8 z M42,66 h6 v8 h-6 z" />
                        <path d="M55,55 h8 v8 h-8 z M57,57 h4 v4 h-4 z M68,55 h6 v4 h-6 z M55,66 h10 v4 h-10 z M68,68 h4 v6 h-4 z" />
                        <path d="M55,30 h8 v4 h-8 z M66,32 h6 v6 h-6 z M58,40 h12 v4 h-12 z M55,46 h4 v4 h-4 z" />
                        <path d="M78,30 h10 v4 h-10 z M80,38 h6 v4 h-6 z M76,44 h12 v4 h-12 z M88,48 h4 v4 h-4 z" />
                        <path d="M78,55 h10 v4 h-10 z M82,62 h6 v4 h-6 z M88,60 h4 v4 h-4 z" />
                      </svg>
                    </div>

                    <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-white/5">
                      <p className="text-xs font-black text-white">{profile.name.toUpperCase()}</p>
                      <p className="text-[10px] font-mono font-bold text-amber-400">{profile.memberId}</p>
                      <div className="text-[7px] font-mono text-slate-500 uppercase tracking-widest break-all">
                        SIGN: {profile.uid.substring(0, 16).toUpperCase()}...
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-400 font-medium leading-relaxed">
                      Present this secure pass at physical T.U.T Money Lending Authority reserves to verify identity signature instantly.
                    </div>

                    <Button
                      onClick={() => setShowQrModal(false)}
                      variant="outline"
                      className="w-full py-3 text-[10px] uppercase tracking-widest font-black"
                    >
                      Close Identity Pass
                    </Button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* PIN Change Modal Overlay */}
            <AnimatePresence>
              {showPinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl text-left"
                  >
                    <button
                      onClick={() => {
                        setShowPinModal(false);
                        setPinChangeSuccess(false);
                        setNewPin('');
                        setConfirmNewPin('');
                      }}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">Security PIN Update</h4>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Change digital signature PIN</p>
                      </div>
                    </div>

                    {pinChangeSuccess ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2.5"
                      >
                        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                        <h5 className="text-xs font-black text-white uppercase tracking-wider">PIN Code Updated</h5>
                        <p className="text-[9px] text-slate-400 leading-relaxed">
                          Your ledger security PIN has been encrypted and rotated successfully. Future withdrawals and transfers will require this new signature.
                        </p>
                        <Button
                          onClick={() => {
                            setShowPinModal(false);
                            setPinChangeSuccess(false);
                          }}
                          className="w-full text-[10px] uppercase font-black tracking-widest mt-2"
                        >
                          Acknowledge & Close
                        </Button>
                      </motion.div>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (newPin.length !== 4 || isNaN(Number(newPin))) {
                            if (addToast) addToast('PIN Format Error', 'PIN must be exactly 4 numeric digits.', 'warning');
                            return;
                          }
                          if (newPin !== confirmNewPin) {
                            if (addToast) addToast('PIN Mismatch', 'PINs do not match! Please re-enter identical codes.', 'danger');
                            return;
                          }
                          setPinChangeSuccess(true);
                          if (addToast) addToast('PIN Updated', 'Your security authorization PIN has been successfully rotated.', 'success');
                        }}
                        className="space-y-4"
                      >
                        <p className="text-[9.5px] text-slate-400 leading-normal">
                          Rotates your 4-digit ledger authorization code. Keep this PIN private to secure your outstanding deposits and reserve balances.
                        </p>

                        <div className="space-y-1.5">
                          <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">New 4-Digit Security PIN</label>
                          <input
                            type="password"
                            maxLength={4}
                            pattern="[0-9]*"
                            inputMode="numeric"
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value)}
                            placeholder="••••"
                            className="w-full bg-slate-950 border border-white/5 focus:border-indigo-500/40 rounded-xl px-3 py-2.5 text-center text-lg font-mono font-black text-white outline-none transition-colors"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Confirm Security PIN</label>
                          <input
                            type="password"
                            maxLength={4}
                            pattern="[0-9]*"
                            inputMode="numeric"
                            value={confirmNewPin}
                            onChange={(e) => setConfirmNewPin(e.target.value)}
                            placeholder="••••"
                            className="w-full bg-slate-950 border border-white/5 focus:border-indigo-500/40 rounded-xl px-3 py-2.5 text-center text-lg font-mono font-black text-white outline-none transition-colors"
                            required
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full py-3.5 text-[10px] uppercase tracking-widest font-black bg-gradient-to-r from-indigo-600 to-blue-600"
                        >
                          Encrypt & Save New PIN
                        </Button>
                      </form>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Advanced Security Settings Modal */}
            <AnimatePresence>
              {showSecuritySettingsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl text-left"
                  >
                    <button
                      onClick={() => setShowSecuritySettingsModal(false)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">Advanced Security Settings</h4>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Configure hardware & ledger guards</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[9.5px] text-slate-400 leading-normal">
                        Toggle advanced cryptographical safeguards. Enabling these layers ensures strict compliance with physical reserve policies.
                      </p>

                      {/* Toggle 1 */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-white uppercase tracking-tight">Two-Factor (2FA) Logs</p>
                          <p className="text-[8px] text-slate-500">Require email tokens for withdrawals</p>
                        </div>
                        <button
                          onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                          className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none ${twoFactorEnabled ? 'bg-blue-600' : 'bg-slate-800'}`}
                        >
                          <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${twoFactorEnabled ? 'translate-x-4.5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Toggle 2 */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-white uppercase tracking-tight">Biometric Device Bond</p>
                          <p className="text-[8px] text-slate-500">Enforce Touch ID / Face ID hardware keys</p>
                        </div>
                        <button
                          onClick={() => setBiometricsEnabled(!biometricsEnabled)}
                          className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none ${biometricsEnabled ? 'bg-blue-600' : 'bg-slate-800'}`}
                        >
                          <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${biometricsEnabled ? 'translate-x-4.5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Toggle 3 */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-white uppercase tracking-tight">WhatsApp Audit Alerts</p>
                          <p className="text-[8px] text-slate-500">Ping real-time transaction ledger updates</p>
                        </div>
                        <button
                          onClick={() => setAlertLogsEnabled(!alertLogsEnabled)}
                          className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none ${alertLogsEnabled ? 'bg-blue-600' : 'bg-slate-800'}`}
                        >
                          <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${alertLogsEnabled ? 'translate-x-4.5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <Button
                        onClick={() => setShowSecuritySettingsModal(false)}
                        className="w-full py-3.5 text-[10px] uppercase tracking-widest font-black mt-2"
                      >
                        Apply and Save Changes
                      </Button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Linked Payment Accounts Manager */}
            <AnimatePresence>
              {showLinkedAccountsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl text-left"
                  >
                    <button
                      onClick={() => setShowLinkedAccountsModal(false)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">Linked Payment Accounts</h4>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Manage automated wallet nodes</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[9.5px] text-slate-400 leading-normal">
                        Verify and link digital wallet numbers. Automated deposits and loan payoffs will deduct directly from these verified nodes.
                      </p>

                      <div className="space-y-3">
                        {/* Option 1: bKash */}
                        <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded bg-[#e2136e] flex items-center justify-center text-white text-[9px] font-black">bK</span>
                            <div>
                              <p className="text-[10px] font-black text-white leading-none">bKash Account Number</p>
                              <p className="text-[8px] font-mono text-slate-400 mt-1">{profile.phone}</p>
                            </div>
                          </div>
                          <span className="text-[7.5px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded leading-none">PRIMARY</span>
                        </div>

                        {/* Option 2: Nagad */}
                        <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded bg-[#f64a1e] flex items-center justify-center text-white text-[9px] font-black">Ng</span>
                            <div>
                              <p className="text-[10px] font-black text-white leading-none">Nagad Account Number</p>
                              <p className="text-[8px] font-mono text-slate-500 mt-1">Not Fully Bonded</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (addToast) addToast('Wallet Verification', 'Nagad linking has been initiated! Our verification department will complete the handshake within 30 minutes.', 'info');
                            }}
                            className="text-[7.5px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 px-2 py-1 rounded leading-none cursor-pointer"
                          >
                            LINK WALLET
                          </button>
                        </div>

                        {/* Option 3: Card */}
                        <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2.5 opacity-50">
                            <span className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-white text-[9px] font-black">💳</span>
                            <div>
                              <p className="text-[10px] font-black text-white leading-none">Visa / Mastercard Card</p>
                              <p className="text-[8px] font-mono text-slate-500 mt-1">No Card Connected</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (addToast) addToast('Gateway Tier Notice', 'Credit card gateway is currently restricted to T.U.T Gold Elite Tier members. Standard tier must use local wallets.', 'warning');
                            }}
                            className="text-[7.5px] font-black text-slate-400 bg-white/5 border border-white/5 hover:bg-white/10 px-2 py-1 rounded leading-none cursor-pointer"
                          >
                            RESTRICTED
                          </button>
                        </div>
                      </div>

                      <Button
                        onClick={() => setShowLinkedAccountsModal(false)}
                        className="w-full py-3.5 text-[10px] uppercase tracking-widest font-black mt-2"
                      >
                        Done & Close
                      </Button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        );
      })()}

      </div>

      {/* Mobile Floating Bottom Navigation Dock — Desktop uses Top Navigation Bar */}
      <nav 
        aria-label="User Dashboard Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/92 backdrop-blur-xl border-t border-white/[0.08] py-1.5 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around max-w-lg mx-auto sm:rounded-t-2xl sm:border-x shadow-[0_-10px_30px_rgba(0,0,0,0.8)] select-none"
      >
        {[
          { id: 'dashboard', label: 'Home', icon: Home },
          { id: 'memos', label: 'Vault', icon: FileText, badge: pendingTransactions.length },
          { id: 'subscription', label: 'Premium', icon: Award },
          { id: 'partners', label: 'Deals', icon: Briefcase },
          { id: 'profile', label: 'Profile', icon: User }
        ].map(item => {
          const Icon = item.icon;
          const isSelected = memberTab === item.id || (item.id === 'profile' && memberTab === 'wallets');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTab(item.id as any)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-h-[48px] px-3 transition-colors relative cursor-pointer text-center min-w-[60px] tap-interactive rounded-xl",
                isSelected ? "text-blue-400 bg-blue-500/10" : "text-slate-400 hover:text-slate-200"
              )}
            >
              {isSelected && (
                <motion.div 
                  layoutId="activeTabIndicator" 
                  className="absolute bottom-0 inset-x-3 h-[2.5px] bg-blue-400 rounded-full" 
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              <div className="relative flex items-center justify-center">
                <Icon className={cn("w-4.5 h-4.5 transition-transform duration-150", isSelected ? "text-blue-400 scale-105" : "text-current")} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-amber-500 text-slate-950 font-mono text-[9px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center border-2 border-slate-950 tabular-nums">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px] font-semibold tracking-tight transition-colors", isSelected ? "text-blue-300" : "text-slate-400")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Real-Life Bank Style Transfer Modal */}
      <Modal isOpen={showTransferModal} onClose={handleCloseTransferModal} title="T.U.T. Funds Transfer">
        {transferSuccess ? (
          <div className="text-center py-6 space-y-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mx-auto animate-bounce shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Transfer Successful</p>
              <h4 className="text-2xl font-black font-mono text-white">৳ {transferSuccess.amount.toLocaleString()}</h4>
              <p className="text-xs text-slate-400">Instantly transferred to verified account</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/5 space-y-2.5 text-left text-xs font-sans">
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="text-slate-500 font-bold">Recipient Account</span>
                <span className="text-white font-black truncate">{transferSuccess.recipientName}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="text-slate-500 font-bold">Recipient Member ID</span>
                <span className="text-amber-400 font-mono font-bold">{transferSuccess.recipientId}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="text-slate-500 font-bold">Transaction Reference</span>
                <span className="text-blue-400 font-mono font-bold">{transferSuccess.memoId}</span>
              </div>
              {transferSuccess.reference && (
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-slate-500 font-bold">Transfer Memo</span>
                  <span className="text-blue-300 font-bold max-w-[180px] truncate text-right">{transferSuccess.reference}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-500 font-bold">Settlement Date</span>
                <span className="text-white font-medium">{format(transferSuccess.date, 'dd MMM yyyy, HH:mm')}</span>
              </div>
            </div>

            <Button 
              onClick={handleCloseTransferModal} 
              variant="glass" 
              className="w-full py-3.5 uppercase text-xs tracking-wider font-black"
            >
              Done & Dismiss
            </Button>
          </div>
        ) : (
          <form onSubmit={handleTransferSubmit} className="space-y-5 text-left font-sans">
            {transferError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{transferError}</span>
              </div>
            )}

            {/* Recipient Lookup */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Recipient Identifier</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    disabled={verifiedRecipient !== null || verifyLoading}
                    value={transferIdentifier}
                    onChange={(e) => setTransferIdentifier(e.target.value)}
                    placeholder="Enter Member ID, Phone or Email"
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                  />
                  {verifiedRecipient && (
                    <span className="absolute right-3 top-3.5 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  )}
                </div>
                {verifiedRecipient ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setVerifiedRecipient(null);
                      setTransferIdentifier('');
                      setTransferError('');
                    }}
                    variant="outline"
                    className="px-4 text-xs h-auto"
                  >
                    Clear
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={verifyLoading}
                    onClick={handleVerifyRecipient}
                    variant="glass"
                    className="px-4 text-xs h-auto uppercase font-black"
                  >
                    {verifyLoading ? 'Checking...' : 'Verify'}
                  </Button>
                )}
              </div>
              <p className="text-[9px] text-slate-500 leading-normal">
                Lookup any verified T.U.T. account securely by Member ID (e.g. <code>TUT-MBR-8833</code>), phone number, or login email address.
              </p>
            </div>

            {verifiedRecipient && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between"
              >
                <div>
                  <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400 block leading-none mb-1">
                    Verified Recipient Account
                  </span>
                  <h5 className="text-xs font-black text-white">{verifiedRecipient.name}</h5>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-mono font-bold text-amber-400">{verifiedRecipient.memberId || 'APPROVED'}</span>
                </div>
              </motion.div>
            )}

            {/* Transfer Amount */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Transfer Amount (BDT)</label>
                <button
                  type="button"
                  onClick={() => setTransferAmount(profile.totalDeposit.toString())}
                  className="text-[9px] font-black text-blue-400 hover:underline uppercase tracking-wider cursor-pointer"
                >
                  Send Max (৳{profile.totalDeposit.toLocaleString()})
                </button>
              </div>
              <input
                type="number"
                disabled={!verifiedRecipient || transferLoading}
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0.00"
                min="1"
                className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Reference (Optional)</label>
              <input
                type="text"
                disabled={!verifiedRecipient || transferLoading}
                value={transferReference}
                onChange={(e) => setTransferReference(e.target.value.slice(0, 100))}
                placeholder="Enter transfer reference or memo note"
                className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 font-medium"
              />
            </div>

            {/* Account Password Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Account Password</label>
              <div className="relative">
                <input
                  type={showTransferPassword ? "text" : "password"}
                  disabled={!verifiedRecipient || transferLoading}
                  value={transferPassword}
                  onChange={(e) => setTransferPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-4 pr-11 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={!verifiedRecipient || transferLoading}
                  onClick={() => setShowTransferPassword(!showTransferPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                >
                  {showTransferPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[8px] text-slate-500 uppercase tracking-wide">
                Verify authority. Enter your current account login password to authorize this transfer.
              </p>
            </div>

            {auth.currentUser?.providerData.some(p => p.providerId === 'google.com') && (
              <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-2">
                <p className="text-[9px] font-black uppercase text-blue-400 tracking-wider">Google Quick Verification</p>
                <p className="text-[10px] text-slate-400 leading-normal">
                  You logged in via Google. Authorize this transfer instantly by re-verifying your active Google session.
                </p>
                <Button
                  type="button"
                  disabled={!verifiedRecipient || transferLoading || !transferAmount}
                  onClick={handleGoogleVerify}
                  variant="glass"
                  className="w-full py-2.5 uppercase text-[10px] tracking-wider font-black text-blue-400 border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10"
                >
                  {transferLoading ? 'Authorizing...' : 'Verify with Google'}
                </Button>
              </div>
            )}

            {/* Confirm Actions */}
            <div className="pt-4 border-t border-white/5 flex gap-3">
              <Button
                type="button"
                onClick={handleCloseTransferModal}
                variant="outline"
                className="flex-1 py-3.5 uppercase text-xs tracking-wider font-black"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!verifiedRecipient || transferLoading || !transferAmount || !transferPassword}
                variant="glass"
                className="flex-1 py-3.5 uppercase text-xs tracking-wider font-black text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 disabled:opacity-40"
              >
                {transferLoading ? 'Processing...' : 'Send Transfer'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Locked Tier Sheen Upgrade Prompt Modal */}
      <AnimatePresence>
        {lockedSheenTier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm rounded-2xl bg-slate-950 border border-white/10 p-5 shadow-2xl space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-white/10 mx-auto flex items-center justify-center">
                <TierEmblem tier={lockedSheenTier} size={28} />
              </div>
              <div className="space-y-1">
                <span
                  className={`text-[10px] font-black uppercase tracking-widest font-mono ${
                    lockedSheenTier === 'gold'
                      ? 'text-[#EAD39C]'
                      : lockedSheenTier === 'silver'
                        ? 'text-slate-300'
                        : 'text-[#E6BFA0]'
                  }`}
                >
                  Tier Upgrade Required
                </span>
                <h3 className="text-base font-black text-white uppercase">
                  Unlock {lockedSheenTier === 'gold' ? 'Sovereign Gold' : lockedSheenTier === 'silver' ? 'Executive Silver' : 'Bronze Reserve'} Finish
                </h3>
                <p className="text-xs text-slate-300">
                  This card finish and its authorized credit limit of <strong className="text-emerald-400 font-mono">৳{lockedSheenTier === 'gold' ? '2,500' : lockedSheenTier === 'silver' ? '1,500' : '500'} BDT</strong> require an active {lockedSheenTier.toUpperCase()} membership plan.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setTargetSubscriptionTier(lockedSheenTier);
                    setLockedSheenTier(null);
                    setMemberTab('subscription');
                  }}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_16px_rgba(37,99,235,0.3)] cursor-pointer"
                >
                  <span>Upgrade to {lockedSheenTier.toUpperCase()}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLockedSheenTier(null)}
                  className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold text-xs uppercase transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showCancelConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">
                    Cancel Subscription Plan?
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Are you sure you want to cancel your <strong className="text-white uppercase">{profile.subscriptionTier || 'active'} tier</strong>?
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-white/5 space-y-2 text-xs text-slate-300">
                <p>• Your plan will remain active until: <strong className="text-white">{profile.subscriptionExpiresAt ? format(new Date(profile.subscriptionExpiresAt), 'dd MMMM yyyy') : 'end of billing cycle'}</strong></p>
                <p>• Auto-renewal from wallet will be switched off immediately.</p>
                <p>• Your borrowing limit will reset to baseline after expiration.</p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirmModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Keep My Plan
                </button>
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  Confirm Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unified Institutional Credit Score & Risk Analysis Modal */}
      <CreditScoreModal
        isOpen={showCreditModal || vaultModalType === 'credit_score'}
        onClose={() => {
          setShowCreditModal(false);
          if (vaultModalType === 'credit_score') setVaultModalType(null);
        }}
        profile={profile}
        transactions={transactions}
        onRequestAction={onRequestAction}
      />

      {/* Initial Card PIN Verification Loading Guard */}
      {!tutCardLoaded && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-300">Verifying card security...</p>
        </div>
      )}

      {/* T.U.T. Card Key Setup & Smart Recovery Modal */}
      <TutCardKeyModal
        isOpen={showCardSecurityModal || pinGateOpen}
        onClose={() => {
          if (!tutCard?.secretCodeHash) return;
          setShowCardSecurityModal(false);
          setPinGateOpen(false);
        }}
        mandatoryMode={tutCardLoaded && !tutCard?.secretCodeHash}
        onSignOut={() => signOut(auth)}
        db={db}
        user={auth.currentUser}
        profile={profile}
        tutCard={tutCard}
        addToast={addToast}
      />

    </div>
  );
}
