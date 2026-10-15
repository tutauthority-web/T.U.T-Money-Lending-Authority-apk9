import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Landmark, 
  Download,
  Calendar
} from 'lucide-react';
import { Transaction, UserProfile } from '../../App';

interface AdminReportsViewProps {
  allUsers: UserProfile[];
  allTransactions: Transaction[];
  reserveFund: number; // Available Liquid Reserve
  targetReserve?: number; // Target Reserve Pool
}

export const AdminReportsView: React.FC<AdminReportsViewProps> = ({
  allUsers,
  allTransactions,
  reserveFund,
  targetReserve
}) => {
  const totalDeposited = allTransactions
    .filter(t => t.type === 'deposit' && (t.status === 'confirmed' || (t.status as string) === 'approved'))
    .reduce((s, t) => s + (t.amount || 0), 0);

  const totalDisbursed = allTransactions
    .filter(t => t.type === 'loan' && (t.status === 'confirmed' || (t.status as string) === 'approved'))
    .reduce((s, t) => s + (t.amount || 0), 0);

  const totalRepaid = allTransactions
    .filter(t => t.type === 'pay_due' && (t.status === 'confirmed' || (t.status as string) === 'approved'))
    .reduce((s, t) => s + (t.amount || 0), 0);

  const totalOutstanding = allUsers.reduce((s, u) => s + (u.remainingDebt || 0), 0);

  return (
    <div className="space-y-3.5 max-w-4xl mx-auto animate-fadeIn pb-6">
      {/* Top Banner */}
      <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">Financial Statements & Analytics</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Audited capital movements and liquidity metrics</p>
        </div>
        <button
          onClick={() => alert('Financial ledger report generated & saved.')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Download className="w-3 h-3" /> Export Ledger
        </button>
      </div>

      {/* 4 Analytics Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 sm:p-3.5 rounded-xl bg-[#0C152E]/95 border border-[#16274E]/90">
          <div className="text-[11px] font-semibold text-slate-400">Total Capital Inflow</div>
          <div className="text-base sm:text-lg font-bold font-mono text-emerald-400 mt-0.5">
            ৳ {totalDeposited.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Confirmed member deposits</div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-[#0C152E]/95 border border-[#16274E]/90">
          <div className="text-[11px] font-semibold text-slate-400">Total Loans Disbursed</div>
          <div className="text-base sm:text-lg font-bold font-mono text-amber-400 mt-0.5">
            ৳ {totalDisbursed.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Cumulative principal out</div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-[#0C152E]/95 border border-[#16274E]/90">
          <div className="text-[11px] font-semibold text-slate-400">Total Recovered</div>
          <div className="text-base sm:text-lg font-bold font-mono text-teal-400 mt-0.5">
            ৳ {totalRepaid.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Repayments settled</div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-[#0C152E]/95 border border-[#16274E]/90">
          <div className="text-[11px] font-semibold text-slate-400">Active Debt Portfolio</div>
          <div className="text-base sm:text-lg font-bold font-mono text-rose-400 mt-0.5">
            ৳ {totalOutstanding.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Current outstanding debt</div>
        </div>
      </div>

      {/* Reserve Breakdown Card */}
      <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-3.5 sm:p-4 space-y-3">
        <h3 className="text-xs font-bold text-white">Reserve Health Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 rounded-lg bg-[#090F24] border border-[#162952]/70">
            <div className="text-[11px] text-slate-400">Available Liquid Reserve</div>
            <div className="text-base font-bold font-mono text-teal-400 mt-0.5">৳ {reserveFund.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {targetReserve 
                ? `Target: ৳ ${targetReserve.toLocaleString()} • In Use: ৳ ${totalOutstanding.toLocaleString()}` 
                : 'Available for active loan underwriting'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#090F24] border border-[#162952]/70">
            <div className="text-[11px] text-slate-400">Total Member Count</div>
            <div className="text-base font-bold text-white mt-0.5">{allUsers.length} Members</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Registered and active platform participants</div>
          </div>
        </div>
      </div>
    </div>
  );
};
