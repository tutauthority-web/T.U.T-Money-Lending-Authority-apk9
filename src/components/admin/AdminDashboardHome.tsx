import React, { useState, useMemo } from 'react';
import {
  Clock,
  CreditCard,
  Landmark,
  PiggyBank,
  Scale,
  Activity,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
  FileText,
  UserCheck,
  Hash,
  Info,
  Megaphone,
  Eye,
  MousePointerClick
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { format } from 'date-fns';
import { AdminSection, UnifiedRequestItem } from './types';
import { safeFormatDistance, parseSafeDate } from '../AdminPortalV4';
import { UserProfile, Transaction, SponsorshipCampaign } from '../../App';
import { OfficialReceiptModal, OfficialReceiptData } from '../common/OfficialReceiptModal';
import { calculateMemberLoanAllocations } from '../../utils/loanAllocationEngine';
import { BkashLogo, NagadLogo } from '../PaymentBrandLogos';

interface AdminDashboardHomeProps {
  onNavigate: (section: AdminSection, extra?: any) => void;
  onInspectRequest?: (req: UnifiedRequestItem) => void;
  pendingRequests?: UnifiedRequestItem[];
  pendingRequestsCount: number;
  activeLoansCount: number;
  reserveFund: number;
  targetReserve?: number;
  availableReserve?: number;
  totalDeposits: number;
  totalOutstandingDebt: number;
  todayActivityCount: number;
  recentActivities: Array<{
    id: string;
    type: 'loan_request' | 'repayment' | 'deposit' | 'loan_approved' | 'general';
    title: string;
    timestamp: any;
    meta?: string;
  }>;
  alerts: {
    pendingApprovalCount: number;
    overdueMembersCount: number;
    reserveCoveragePercent: number;
    newDepositsCount: number;
  };
  allUsers?: UserProfile[];
  allTransactions?: Transaction[];
  campaigns?: SponsorshipCampaign[];
}

export const AdminDashboardHome: React.FC<AdminDashboardHomeProps> = ({
  onNavigate,
  onInspectRequest,
  pendingRequests = [],
  pendingRequestsCount,
  activeLoansCount,
  targetReserve = 500000,
  availableReserve,
  totalDeposits,
  totalOutstandingDebt,
  todayActivityCount,
  recentActivities,
  alerts,
  allUsers = [],
  allTransactions = [],
  campaigns = []
}) => {
  const [selectedReceipt, setSelectedReceipt] = useState<OfficialReceiptData | null>(null);

  const actualTarget = targetReserve > 0 ? targetReserve : 500000;
  const actualAvailable = availableReserve !== undefined
    ? availableReserve
    : Math.max(0, actualTarget - totalOutstandingDebt);
  const netLiquidity = actualAvailable + totalDeposits;

  // Accurate active borrower ledger summary using loanAllocationEngine
  const activeLoanObligations = useMemo(() => {
    return (allUsers || [])
      .filter((u) => (u.remainingDebt || 0) > 0)
      .map((u) => {
        const allocation = calculateMemberLoanAllocations(u.uid, allTransactions, u);
        const activeAlloc = allocation.loans.find(l => l.remainingAmount > 0) || allocation.loans[0];
        const matchingLoanTx = activeAlloc?.rawTransaction || allTransactions.find(
          (t) => t.userId === u.uid && t.type === 'loan' && (t.status === 'confirmed' || (t.status as string) === 'approved')
        );
        const memoId = activeAlloc?.memoId || (matchingLoanTx as any)?.memoId || `TUT-MEMO-${u.uid.substring(0, 6).toUpperCase()}`;
        const isOverdue = allocation.loans.some(l => l.status === 'OVERDUE');
        return {
          user: u,
          exactDebt: u.remainingDebt || 0,
          loanTx: matchingLoanTx,
          activeAlloc,
          memoId,
          isOverdue
        };
      });
  }, [allUsers, allTransactions]);

  // Real cashflow series aggregated by month from Firestore transactions
  const cashflowChartData = useMemo(() => {
    const monthBuckets = new Map<string, { label: string; sortKey: number; inflows: number; disbursals: number }>();

    allTransactions.forEach((tx) => {
      const st = (tx.status || '').toLowerCase();
      if (st !== 'confirmed' && st !== 'approved' && st !== 'settled' && st !== 'paid') return;
      const dt = parseSafeDate(tx.timestamp || (tx as any).createdAt || tx.date);
      const sortKey = dt.getFullYear() * 100 + dt.getMonth();
      const label = format(dt, 'MMM yy');
      if (!monthBuckets.has(label)) {
        monthBuckets.set(label, { label, sortKey, inflows: 0, disbursals: 0 });
      }
      const b = monthBuckets.get(label)!;
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'deposit' || tx.type === 'pay_due' || tx.type === 'subscription') {
        b.inflows += amt;
      } else if (tx.type === 'loan') {
        b.disbursals += amt;
      }
    });

    const sorted = Array.from(monthBuckets.values()).sort((a, b) => a.sortKey - b.sortKey);
    return sorted.slice(-6);
  }, [allTransactions]);

  // Live Ad stats
  const adSummary = useMemo(() => {
    const active = campaigns.filter(c => c.status === 'active');
    const imps = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0);
    const clicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0);
    const value = campaigns.filter(c => c.status !== 'completed').reduce((s, c) => s + (Number(c.dealValue) || 0), 0);
    return {
      activeCount: active.length,
      totalCount: campaigns.length,
      imps,
      clicks,
      ctr: imps > 0 ? ((clicks / imps) * 100).toFixed(1) : '0.0',
      value
    };
  }, [campaigns]);

  return (
    <div className="space-y-4 lg:space-y-5 animate-fadeIn">
      {/* 1. 6 KEY EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 lg:gap-4">
        <div className="bg-[#0B1326] border border-white/[0.08] hover:border-amber-500/40 rounded-xl p-4 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Queue</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-white">{pendingRequestsCount}</span>
              <span className="text-[11px] text-amber-300 font-medium">action required</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Loans, deposits, repayments & KYC</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('requests')}
              className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              Review queue <ChevronRight className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-emerald-400">Live</span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('active_debts')}
          className="bg-[#0B1326] border border-white/[0.08] hover:border-amber-500/45 rounded-xl p-4 transition-colors flex flex-col justify-between cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Debt Portfolio</span>
              <CreditCard className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-400">
                ৳ {totalOutstandingDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                {activeLoansCount} active allocated tranche{activeLoansCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400 group-hover:text-amber-300 flex items-center gap-1">
              View active debts <ChevronRight className="w-3 h-3" />
            </span>
            <span className="text-[10px] font-mono text-slate-500">0% Usury</span>
          </div>
        </div>

        <div className="bg-[#0B1326] border border-white/[0.08] hover:border-teal-500/40 rounded-xl p-4 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Available Reserve</span>
              <Landmark className="w-4 h-4 text-teal-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono tabular-nums text-white">
                ৳ {actualAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-teal-400/90 mt-0.5 tabular-nums">
                Target: ৳{actualTarget.toLocaleString()} • {Math.min(100, Math.round((actualAvailable / (actualTarget || 1)) * 100))}% Free
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('reserve')}
              className="text-[11px] font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
            >
              Manage liquidity <ChevronRight className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-500">Pool</span>
          </div>
        </div>

        <div className="bg-[#0B1326] border border-white/[0.08] hover:border-emerald-500/40 rounded-xl p-4 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Segregated Deposits</span>
              <PiggyBank className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono tabular-nums text-white">
                ৳ {totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Ring-fenced 1:1 member vault balance</div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('deposits')}
              className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              Deposit records <ChevronRight className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-500">1:1 Vault</span>
          </div>
        </div>

        <div className="bg-[#0B1326] border border-white/[0.08] hover:border-indigo-500/40 rounded-xl p-4 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Net Liquidity Pool</span>
              <Scale className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono tabular-nums text-white">
                ৳ {netLiquidity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-indigo-300/90 mt-0.5">Available Reserve + Member Vault</div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              Financial statements <ChevronRight className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-500">Consolidated</span>
          </div>
        </div>

        <div className="bg-[#0B1326] border border-white/[0.08] hover:border-amber-500/40 rounded-xl p-4 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ad & Sponsor Engine</span>
              <Megaphone className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-white">{adSummary.activeCount}</span>
              <span className="text-xs font-mono text-emerald-400 tabular-nums">
                ৳{adSummary.value.toLocaleString()} value
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3 tabular-nums">
              <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3 text-sky-400" /> {adSummary.imps.toLocaleString()}</span>
              <span className="inline-flex items-center gap-1"><MousePointerClick className="w-3 h-3 text-teal-400" /> {adSummary.clicks.toLocaleString()} ({adSummary.ctr}%)</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('ads')}
              className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              Open Ad Studio <ChevronRight className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-500">{todayActivityCount} ops/24h</span>
          </div>
        </div>
      </div>

      {/* 2. PRIORITY PENDING QUEUE STRIP (WHEN REQUESTS ARE WAITING) */}
      {pendingRequests.length > 0 && (
        <div className="bg-[#0B1326] border border-amber-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Priority Approval Queue ({pendingRequests.length})</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('requests')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              Open Full Queue →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {pendingRequests.slice(0, 3).map((req) => (
              <div
                key={req.id}
                onClick={() => (onInspectRequest ? onInspectRequest(req) : onNavigate('requests'))}
                className="p-3 rounded-lg bg-[#070D19] border border-white/[0.08] hover:border-amber-500/45 flex items-center justify-between gap-2.5 cursor-pointer transition-colors group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
                    <span className="text-amber-400 font-mono">
                      {req.source === 'user' ? 'KYC' : `৳${req.requestedAmount.toLocaleString()}`}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="truncate">{req.memberName}</span>
                  </div>
                  <div className="text-[10.5px] text-slate-400 truncate mt-0.5">
                    {req.requestTypeLabel} {req.paymentMethod ? `(${req.paymentMethod})` : ''}
                  </div>
                </div>
                <span className="px-2 py-1 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors shrink-0">
                  Review
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. CASHFLOW ANALYTICS CHART & IMPORTANT ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-400" />
                Capital Inflows vs Loan Disbursals
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Aggregated confirmed ledger movements (BDT)</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 cursor-pointer"
            >
              Statements →
            </button>
          </div>

          <div className="h-52 w-full mt-4">
            {cashflowChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Confirmed transactions will plot monthly cashflow curves automatically.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflowChartData} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminInflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="adminDisbGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `৳${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#070D19',
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      fontSize: '11px',
                      color: '#F8FAFC'
                    }}
                    formatter={(value: any) => [`৳ ${Number(value || 0).toLocaleString()}`, undefined]}
                  />
                  <Area type="monotone" dataKey="inflows" name="Deposits & Repayments" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#adminInflowGrad)" />
                  <Area type="monotone" dataKey="disbursals" name="Loans Disbursed" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#adminDisbGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right: Important Alerts Card */}
        <div className="lg:col-span-5 bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Risk & Queue Signals</h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Real-time</span>
          </div>

          <div className="space-y-2.5 mt-3 flex-1">
            <div
              onClick={() => onNavigate('requests')}
              className="p-3 rounded-lg bg-[#070D19] border border-white/[0.07] hover:border-amber-500/40 flex items-center justify-between cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-xs font-medium text-slate-200 group-hover:text-amber-300 truncate">
                  {alerts.pendingApprovalCount} request{alerts.pendingApprovalCount !== 1 ? 's' : ''} awaiting review
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0" />
            </div>

            <div
              onClick={() => onNavigate('active_debts')}
              className="p-3 rounded-lg bg-[#070D19] border border-white/[0.07] hover:border-amber-500/40 flex items-center justify-between cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-medium text-slate-200 group-hover:text-amber-300 truncate">
                  {alerts.overdueMembersCount} active borrower{alerts.overdueMembersCount !== 1 ? 's' : ''} with open debt
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0" />
            </div>

            <div
              onClick={() => onNavigate('reserve')}
              className="p-3 rounded-lg bg-[#070D19] border border-white/[0.07] hover:border-teal-500/40 flex items-center justify-between cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Landmark className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="text-xs font-medium text-slate-200 group-hover:text-teal-300 truncate">
                  Reserve liquidity: {alerts.reserveCoveragePercent}% of ৳{actualTarget.toLocaleString()}
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 shrink-0" />
            </div>

            <div
              onClick={() => onNavigate('deposits')}
              className="p-3 rounded-lg bg-[#070D19] border border-white/[0.07] hover:border-emerald-500/40 flex items-center justify-between cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <PiggyBank className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-medium text-slate-200 group-hover:text-emerald-300 truncate">
                  {alerts.newDepositsCount} pending deposit verification{alerts.newDepositsCount !== 1 ? 's' : ''}
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. ACTIVE LOAN OBLIGATIONS (ALLOCATED LEDGER) */}
      <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              Active Loan Obligations (Stored Memos)
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Verified borrower obligations linked with official transaction memos & channel proofs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('active_debts')}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer self-start sm:self-auto"
          >
            All active debts →
          </button>
        </div>

        {activeLoanObligations.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            No active loan obligations outstanding.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeLoanObligations.map(({ user, exactDebt, loanTx, activeAlloc, memoId, isOverdue }) => {
              const cleanMemoId = memoId.startsWith('TUT-MEMO-') ? memoId : `TUT-MEMO-${memoId}`;
              const methodLower = (loanTx?.method || '').toLowerCase();

              return (
                <div
                  key={user.uid}
                  className={`bg-[#070D19] border rounded-xl p-3.5 flex flex-col justify-between gap-2.5 transition-colors ${
                    isOverdue ? 'border-rose-500/40' : 'border-white/[0.08] hover:border-amber-500/35'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'M'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{user.name || 'Member'}</div>
                        <div className="text-[10.5px] text-slate-400 font-mono truncate">
                          #{user.memberId || user.uid.substring(0, 8).toUpperCase()}
                          {activeAlloc?.dueDateStr && ` • Due ${activeAlloc.dueDateStr}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-amber-300">
                        ৳ {exactDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span className={`text-[9.5px] font-bold uppercase tracking-wider ${isOverdue ? 'text-rose-400' : 'text-amber-400/90'}`}>
                        {isOverdue ? 'Overdue' : 'Active Debt'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06] text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                      {methodLower.includes('bkash') && <BkashLogo size="xs" />}
                      {methodLower.includes('nagad') && <NagadLogo size="xs" />}
                      <span className="truncate font-medium">
                        {loanTx?.method || 'Cash / Disbursal'}
                        {loanTx?.accountNumber ? ` (${loanTx.accountNumber})` : ''}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 truncate">
                      {loanTx?.transactionId || cleanMemoId}
                    </span>
                  </div>

                  {(loanTx?.loanReason || (loanTx as any)?.purpose) && (
                    <div className="text-[11px] text-slate-300 italic truncate flex items-center gap-1.5">
                      <Info className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">"{loanTx?.loanReason || (loanTx as any)?.purpose}"</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
                    <span className="font-mono text-[10.5px] text-slate-400 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-amber-400/80" />
                      {cleanMemoId}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReceipt({
                          id: loanTx?.id || user.uid,
                          memoId: cleanMemoId,
                          type: 'loan',
                          amount: exactDebt,
                          userName: user.name,
                          userId: user.uid,
                          memberId: user.memberId,
                          method: loanTx?.method || 'Cash / Disbursal',
                          accountNumber: loanTx?.accountNumber,
                          transactionId: loanTx?.transactionId || cleanMemoId,
                          reference: (loanTx as any)?.reference || user.referenceContact || cleanMemoId,
                          estimatedRepaymentDate: loanTx?.estimatedRepaymentDate || activeAlloc?.dueDateStr,
                          date: loanTx?.date || activeAlloc?.disbursedDateStr || 'Confirmed',
                          timestamp: loanTx?.timestamp,
                          status: 'confirmed',
                          decidedBy: (loanTx as any)?.decidedBy || 'Chief Administrator',
                          adminNotes: (loanTx as any)?.adminNotes || 'Official Loan Disbursal Memo stored with exact balance.',
                          loanReason: loanTx?.loanReason || (loanTx as any)?.purpose || 'Member Loan Obligation'
                        });
                      }}
                      className="px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>View Memo</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. RECENT ACTIVITY STREAM */}
      <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 sm:p-5 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            Recent Ledger Activity
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            View all →
          </button>
        </div>

        <div className="divide-y divide-white/[0.05] mt-1">
          {recentActivities.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs">
              No recent activity recorded yet.
            </div>
          ) : (
            recentActivities.slice(0, 5).map((act) => {
              let iconEl = <Activity className="w-3.5 h-3.5 text-sky-400" />;
              if (act.type === 'loan_request') iconEl = <TrendingUp className="w-3.5 h-3.5 text-amber-400" />;
              else if (act.type === 'repayment') iconEl = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
              else if (act.type === 'deposit') iconEl = <PiggyBank className="w-3.5 h-3.5 text-teal-400" />;
              else if (act.type === 'loan_approved') iconEl = <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />;

              return (
                <div key={act.id} className="py-2.5 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#070D19] border border-white/[0.08] flex items-center justify-center shrink-0">
                      {iconEl}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">{act.title}</div>
                      <div className="text-[10.5px] text-slate-500">{safeFormatDistance(act.timestamp)}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedReceipt && (
        <OfficialReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
};
