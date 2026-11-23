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
  const [downloadSuccess, setDownloadSuccess] = React.useState(false);

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

  // Recovery Rate & Coverage Math
  const recoveryRate = totalDisbursed > 0 ? Math.min(100, Math.round((totalRepaid / totalDisbursed) * 100)) : 100;
  const reserveCoverage = totalOutstanding > 0 ? Math.min(300, Math.round((reserveFund / totalOutstanding) * 100)) : 100;

  const handleExportLedgerCSV = () => {
    try {
      const headers = [
        'Timestamp',
        'Transaction ID',
        'Memo Code',
        'Member Name',
        'Member ID / A/C',
        'Type',
        'Amount (BDT)',
        'Payment Method',
        'Reference',
        'Status'
      ];

      const rows = allTransactions.map(tx => [
        `"${tx.date || (tx.timestamp?.toDate ? tx.timestamp.toDate().toISOString() : 'Recent')}"`,
        `"${tx.transactionId || tx.id || ''}"`,
        `"${(tx as any).memoId || ''}"`,
        `"${(tx.userName || 'Member').replace(/"/g, '""')}"`,
        `"${tx.userId || tx.accountNumber || ''}"`,
        `"${tx.type}"`,
        tx.amount || 0,
        `"${tx.method || 'Direct'}"`,
        `"${tx.reference || (tx as any).loanReason || ''}"`,
        `"${tx.status || 'confirmed'}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `TUT_Financial_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export ledger CSV:', err);
    }
  };

  return (
    <div className="space-y-3.5 w-full max-w-7xl mx-auto animate-fadeIn pb-6">
      {/* Top Banner */}
      <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">Financial Statements & Analytics</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Audited capital movements, recovery rates and liquidity metrics</p>
        </div>
        <button
          onClick={handleExportLedgerCSV}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer shadow-xs active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{downloadSuccess ? 'Ledger Downloaded!' : 'Export Ledger (CSV)'}</span>
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
          <div className="text-[10px] text-teal-400/90 font-medium mt-0.5">
            {recoveryRate}% Recovery Rate
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-[#0C152E]/95 border border-[#16274E]/90">
          <div className="text-[11px] font-semibold text-slate-400">Active Debt Portfolio</div>
          <div className="text-base sm:text-lg font-bold font-mono text-rose-400 mt-0.5">
            ৳ {totalOutstanding.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Current outstanding debt</div>
        </div>
      </div>

      {/* Reserve Breakdown & Institutional Health Card */}
      <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#16274E]/70 pb-2.5">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Reserve Liquidity & Solvency Health</h3>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            {reserveCoverage}% Reserve Coverage
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[#090F24] border border-[#162952]/70">
            <div className="text-[10px] font-semibold uppercase text-slate-400">Available Liquid Reserve</div>
            <div className="text-base font-bold font-mono text-teal-400 mt-0.5">৳ {reserveFund.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 mt-1">
              {targetReserve 
                ? `Target: ৳ ${targetReserve.toLocaleString()} • In Use: ৳ ${totalOutstanding.toLocaleString()}` 
                : 'Available for active loan underwriting'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#090F24] border border-[#162952]/70">
            <div className="text-[10px] font-semibold uppercase text-slate-400">Capital Repayment Rate</div>
            <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">{recoveryRate}%</div>
            <div className="text-[10px] text-slate-500 mt-1">
              ৳ {totalRepaid.toLocaleString()} repaid of ৳ {totalDisbursed.toLocaleString()} disbursed
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#090F24] border border-[#162952]/70">
            <div className="text-[10px] font-semibold uppercase text-slate-400">Total Member Roster</div>
            <div className="text-base font-bold font-mono text-white mt-0.5">{allUsers.length} Members</div>
            <div className="text-[10px] text-slate-500 mt-1">
              {allUsers.filter(u => u.status === 'approved').length} Active, {allUsers.filter(u => (u.remainingDebt || 0) > 0).length} with active debt
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
