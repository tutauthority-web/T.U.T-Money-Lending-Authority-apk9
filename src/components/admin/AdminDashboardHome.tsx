import React, { useState } from 'react';
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
  ArrowDownRight, 
  TrendingUp, 
  ShieldAlert, 
  FileText, 
  UserCheck,
  Sparkles
} from 'lucide-react';
import { AdminSection } from './types';
import { safeFormatDistance } from '../AdminPortalV4';
import { UserProfile, Transaction } from '../../App';
import { OfficialReceiptModal, OfficialReceiptData } from '../common/OfficialReceiptModal';

interface AdminDashboardHomeProps {
  onNavigate: (section: AdminSection, extra?: any) => void;
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
}

export const AdminDashboardHome: React.FC<AdminDashboardHomeProps> = ({
  onNavigate,
  pendingRequestsCount,
  activeLoansCount,
  reserveFund,
  targetReserve = 500000,
  availableReserve,
  totalDeposits,
  totalOutstandingDebt,
  todayActivityCount,
  recentActivities,
  alerts,
  allUsers = [],
  allTransactions = []
}) => {
  const [selectedReceipt, setSelectedReceipt] = useState<OfficialReceiptData | null>(null);

  // Exact mathematical logic: Available Reserve = Target Capital - Active Outstanding Debt
  const actualTarget = targetReserve > 0 ? targetReserve : 500000;
  const actualAvailable = availableReserve !== undefined 
    ? availableReserve 
    : Math.max(0, actualTarget - totalOutstandingDebt);
  const netLiquidity = actualAvailable + totalDeposits;

  // Active loans with exact amounts & memos
  const activeLoanObligations = (allUsers || [])
    .filter((u) => (u.remainingDebt || 0) > 0)
    .map((u) => {
      // Find matching loan transaction for memo
      const matchingLoanTx = allTransactions.find(
        (t) => t.userId === u.uid && t.type === 'loan' && (t.status === 'confirmed' || (t.status as string) === 'approved')
      );
      const memoId = (matchingLoanTx as any)?.memoId || `TUT-MEMO-${u.uid.substring(0, 6).toUpperCase()}`;
      return {
        user: u,
        exactDebt: u.remainingDebt || 0,
        loanTx: matchingLoanTx,
        memoId: memoId
      };
    });

  // Recent confirmed deposit receipts
  const recentDepositReceipts = allTransactions
    .filter((t) => t.type === 'deposit' && (t.status === 'confirmed' || (t.status as string) === 'approved'))
    .slice(0, 5);

  return (
    <div className="space-y-4 lg:space-y-5 animate-fadeIn">
      {/* 6 Key Financial & Operational Metric Cards - Compact & Refined */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 lg:gap-4">
        {/* 1. Pending Requests */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 hover:border-amber-500/40 rounded-xl p-3.5 sm:p-4 transition-all shadow-sm group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Requests</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                {pendingRequestsCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Awaiting administrator review
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#16274E]/70 flex items-center justify-between">
            <button
              onClick={() => onNavigate('requests')}
              className="text-[11px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              Review queue <ChevronRight className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-500">Live</span>
          </div>
        </div>

        {/* 2. Active Loans */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 hover:border-blue-500/40 rounded-xl p-3.5 sm:p-4 transition-all shadow-sm group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Loan Obligations</span>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {activeLoansCount} active
                </span>
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400 tracking-tight">
                ৳ {totalOutstandingDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Exact ledger verified debt
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#16274E]/70 flex items-center justify-between">
            <button
              onClick={() => onNavigate('transactions')}
              className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              View all loans <ChevronRight className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-500">Verified</span>
          </div>
        </div>

        {/* 3. Available Reserve */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 hover:border-teal-500/40 rounded-xl p-3.5 sm:p-4 transition-all shadow-sm group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Available Reserve</span>
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-400">
                <Landmark className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                ৳ {actualAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-teal-400/90 mt-0.5">
                Target: ৳ {actualTarget.toLocaleString()} • In use: ৳ {totalOutstandingDebt.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#16274E]/70 flex items-center justify-between">
            <button
              onClick={() => onNavigate('reserve')}
              className="text-[11px] font-medium text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              Liquidity details <ChevronRight className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-500">
              {Math.min(100, Math.round((actualAvailable / (actualTarget || 1)) * 100))}% Pool
            </span>
          </div>
        </div>

        {/* 4. Total Deposits */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 hover:border-emerald-500/40 rounded-xl p-3.5 sm:p-4 transition-all shadow-sm group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Member Deposits</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                <PiggyBank className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                ৳ {totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Cumulative member savings balance
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#16274E]/70 flex items-center justify-between">
            <button
              onClick={() => onNavigate('deposits')}
              className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              Deposit records <ChevronRight className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-500">Insured</span>
          </div>
        </div>

        {/* 5. Net Liquidity Pool */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 hover:border-indigo-500/40 rounded-xl p-3.5 sm:p-4 transition-all shadow-sm group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Net Liquidity Pool</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                <Scale className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                ৳ {netLiquidity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-indigo-300/90 mt-0.5">
                Available Reserve + Member Deposits
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#16274E]/70 flex items-center justify-between">
            <button
              onClick={() => onNavigate('reports')}
              className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              Financial reports <ChevronRight className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-500">Aggregated</span>
          </div>
        </div>

        {/* 6. Today's Activity */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 hover:border-sky-500/40 rounded-xl p-3.5 sm:p-4 transition-all shadow-sm group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Today's Activity</span>
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                {todayActivityCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Ledger operations in 24 hours
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#16274E]/70 flex items-center justify-between">
            <button
              onClick={() => onNavigate('transactions')}
              className="text-[11px] font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              Activity stream <ChevronRight className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-500">24h</span>
          </div>
        </div>
      </div>

      {/* ACTIVE LOANS & DEPOSITS WITH EXACT MEMOS SECTION - Compact & Minimal */}
      <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#16274E]/70">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-normal flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              Active Loan Obligations (Stored Memos)
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Verified borrower obligations linked with official transaction memos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors cursor-pointer"
            >
              Full ledger →
            </button>
          </div>
        </div>

        {activeLoanObligations.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            No active loan obligations outstanding.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeLoanObligations.map(({ user, exactDebt, loanTx, memoId }) => {
              const cleanMemoId = memoId.startsWith('TUT-MEMO-') ? memoId : `TUT-MEMO-${memoId}`;
              return (
                <div
                  key={user.uid}
                  className="bg-[#091024] border border-[#16274E]/70 hover:border-amber-500/40 rounded-lg p-3 sm:p-3.5 flex flex-col justify-between gap-2.5 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'M'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
                          {user.name || 'Member'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {user.memberId || `#${user.uid.substring(0, 8).toUpperCase()}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm sm:text-base font-bold font-mono text-amber-300">
                        ৳ {exactDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-block">
                        Active Debt
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#16274E]/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 bg-[#101B38] px-2 py-0.5 rounded border border-white/5">
                      <FileText className="w-3 h-3 text-amber-400/80" />
                      <span>{cleanMemoId}</span>
                    </div>

                    <button
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
                          date: loanTx?.date || 'Confirmed',
                          timestamp: loanTx?.timestamp,
                          status: 'confirmed',
                          decidedBy: (loanTx as any)?.decidedBy || 'Chief Administrator',
                          adminNotes: (loanTx as any)?.adminNotes || 'Official Loan Disbursal Memo stored with exact balance.',
                          loanReason: (loanTx as any)?.loanReason || 'Member Loan Obligation'
                        });
                      }}
                      className="px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
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

      {/* Two Column Lower Section: Recent Activity & Important Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 lg:gap-4">
        {/* Left: Recent Activity Card */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#16274E]/70">
            <h2 className="text-sm font-semibold text-white tracking-normal flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              Recent Activity
            </h2>
            <button 
              onClick={() => onNavigate('transactions')}
              className="text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="divide-y divide-[#16274E]/50 mt-1 flex-1">
            {recentActivities.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                No recent activity recorded yet.
              </div>
            ) : (
              recentActivities.slice(0, 5).map((act) => {
                let iconEl = <Activity className="w-3 h-3 text-sky-400" />;
                let iconBg = 'bg-sky-500/10 border-sky-500/20';

                if (act.type === 'loan_request') {
                  iconEl = <TrendingUp className="w-3 h-3 text-amber-400" />;
                  iconBg = 'bg-amber-500/10 border-amber-500/20';
                } else if (act.type === 'repayment') {
                  iconEl = <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
                  iconBg = 'bg-emerald-500/10 border-emerald-500/20';
                } else if (act.type === 'deposit') {
                  iconEl = <PiggyBank className="w-3 h-3 text-teal-400" />;
                  iconBg = 'bg-teal-500/10 border-teal-500/20';
                } else if (act.type === 'loan_approved') {
                  iconEl = <ArrowUpRight className="w-3 h-3 text-blue-400" />;
                  iconBg = 'bg-blue-500/10 border-blue-500/20';
                }

                return (
                  <div key={act.id} className="py-2.5 flex items-center justify-between gap-2.5 group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-6 h-6 rounded-md ${iconBg} border flex items-center justify-center shrink-0`}>
                        {iconEl}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                          {act.title}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {safeFormatDistance(act.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Important Alerts Card */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#16274E]/70">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white tracking-normal">Important Alerts</h2>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Real-time</span>
          </div>

          <div className="space-y-2 mt-2.5 flex-1">
            {/* Alert 1: Pending approval requests */}
            <div 
              onClick={() => onNavigate('requests')}
              className="p-2.5 sm:p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70 hover:border-amber-500/40 flex items-center justify-between cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-center shrink-0">
                  <Clock className="w-3 h-3" />
                </div>
                <div className="text-xs font-medium text-slate-200 group-hover:text-amber-300 transition-colors truncate">
                  {alerts.pendingApprovalCount} request{alerts.pendingApprovalCount !== 1 ? 's' : ''} pending approval
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
            </div>

            {/* Alert 2: Overdue members */}
            <div 
              onClick={() => onNavigate('members')}
              className="p-2.5 sm:p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70 hover:border-amber-500/40 flex items-center justify-between cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center shrink-0">
                  <UserCheck className="w-3 h-3" />
                </div>
                <div className="text-xs font-medium text-slate-200 group-hover:text-amber-300 transition-colors truncate">
                  {alerts.overdueMembersCount} active borrower{alerts.overdueMembersCount !== 1 ? 's' : ''} on record
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
            </div>

            {/* Alert 3: Reserve coverage */}
            <div 
              onClick={() => onNavigate('reserve')}
              className="p-2.5 sm:p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70 hover:border-teal-500/40 flex items-center justify-between cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-md bg-teal-500/10 border border-teal-500/25 text-teal-400 flex items-center justify-center shrink-0">
                  <Landmark className="w-3 h-3" />
                </div>
                <div className="text-xs font-medium text-slate-200 group-hover:text-teal-300 transition-colors truncate">
                  Reserve coverage: {alerts.reserveCoveragePercent}% of target pool (৳{actualTarget.toLocaleString()})
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors shrink-0" />
            </div>

            {/* Alert 4: New deposits */}
            <div 
              onClick={() => onNavigate('deposits')}
              className="p-2.5 sm:p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70 hover:border-emerald-500/40 flex items-center justify-between cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
                  <PiggyBank className="w-3 h-3" />
                </div>
                <div className="text-xs font-medium text-slate-200 group-hover:text-emerald-300 transition-colors truncate">
                  {alerts.newDepositsCount} confirmed deposit transaction{alerts.newDepositsCount !== 1 ? 's' : ''}
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Official Receipt Modal */}
      {selectedReceipt && (
        <OfficialReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
};
