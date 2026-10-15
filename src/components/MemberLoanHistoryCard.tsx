import React from 'react';
import { CreditCard, CheckCircle2, Clock, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { MemberLoanSummary, AllocatedLoan, getLoanStatusConfig } from '../utils/loanAllocationEngine';

interface MemberLoanHistoryCardProps {
  summary: MemberLoanSummary;
  onPayDue?: () => void;
  onRequestLoan?: () => void;
  onViewReceipt?: (loan: AllocatedLoan) => void;
  title?: string;
  subtitle?: string;
}

export const MemberLoanHistoryCard: React.FC<MemberLoanHistoryCardProps> = ({
  summary,
  onPayDue,
  onRequestLoan,
  onViewReceipt,
  title = 'Individual Loan Ledger & Allocation',
  subtitle = 'Chronological repayment allocation with independent loan statuses'
}) => {
  return (
    <div className="space-y-4">
      {/* 1. MEMBER-LEVEL SUMMARY HEADER */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-3 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">{title}</h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            {summary.totalOutstanding > 0 && onPayDue && (
              <button
                type="button"
                onClick={onPayDue}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>Repay Due</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onRequestLoan && (
              <button
                type="button"
                onClick={onRequestLoan}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Apply Loan
              </button>
            )}
          </div>
        </div>

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          <div className="bg-slate-950/70 border border-white/5 rounded-xl p-2.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Total Borrowed</span>
            <span className="text-xs sm:text-sm font-black text-white font-mono mt-0.5 block">
              ৳{summary.totalBorrowed.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-white/5 rounded-xl p-2.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Total Repaid</span>
            <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono mt-0.5 block">
              ৳{summary.totalRepaid.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-white/5 rounded-xl p-2.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Total Outstanding</span>
            <span className={`text-xs sm:text-sm font-black font-mono mt-0.5 block ${summary.totalOutstanding > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              ৳{summary.totalOutstanding.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-white/5 rounded-xl p-2.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Active Loans</span>
            <span className="text-xs sm:text-sm font-black text-blue-400 font-mono mt-0.5 block">
              {summary.activeLoans}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-slate-950/70 border border-white/5 rounded-xl p-2.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Completed Loans</span>
            <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono mt-0.5 block">
              {summary.completedLoans}
            </span>
          </div>
        </div>
      </div>

      {/* 2. INDIVIDUAL LOANS LIST */}
      <div className="space-y-3">
        {summary.loans.length === 0 ? (
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">No Loan Obligations</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              This member has no recorded loan disbursements. All accounts are in complete compliance.
            </p>
          </div>
        ) : (
          summary.loans.map((loan) => {
            const config = getLoanStatusConfig(loan.status);
            const percentPaid = loan.originalAmount > 0 
              ? Math.min(100, Math.round((loan.paidAmount / loan.originalAmount) * 100))
              : 100;

            return (
              <div
                key={loan.id}
                className={`bg-slate-900/90 border ${config.borderClass} rounded-2xl p-4 sm:p-5 shadow-lg space-y-3 transition-all`}
              >
                {/* Loan Header: Number, Memo, Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-black text-white font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-white/10">
                      {loan.loanNumber}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      MEMO: {loan.memoId}
                    </span>
                    {loan.purpose && (
                      <span className="text-[10px] text-slate-400 hidden sm:inline">
                        • {loan.purpose}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onViewReceipt && (
                      <button
                        type="button"
                        onClick={() => onViewReceipt(loan)}
                        className="px-2 py-0.5 text-[10px] font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors cursor-pointer"
                      >
                        View Memo
                      </button>
                    )}
                    <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg ${config.badgeClass}`}>
                      {config.label}
                    </span>
                  </div>
                </div>

                {/* 4 Core Financial Metrics Required by Spec */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {/* Borrowed */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Borrowed</span>
                    <strong className="text-xs sm:text-sm font-black text-white font-mono mt-0.5 block">
                      ৳{loan.originalAmount.toLocaleString()}
                    </strong>
                  </div>

                  {/* Paid */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Paid</span>
                    <strong className="text-xs sm:text-sm font-black text-emerald-400 font-mono mt-0.5 block">
                      ৳{loan.paidAmount.toLocaleString()}
                    </strong>
                  </div>

                  {/* Remaining */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Remaining</span>
                    <strong className={`text-xs sm:text-sm font-black font-mono mt-0.5 block ${loan.remainingAmount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      ৳{loan.remainingAmount.toLocaleString()}
                    </strong>
                  </div>

                  {/* Status */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Status</span>
                    <strong className={`text-xs sm:text-sm font-black font-mono mt-0.5 block ${config.textClass}`}>
                      {loan.status}
                    </strong>
                  </div>
                </div>

                {/* Repayment Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono font-bold">
                    <span>Repayment Allocation: {percentPaid}%</span>
                    <span>
                      ৳{loan.paidAmount.toLocaleString()} / ৳{loan.originalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full transition-all duration-500 ${
                        loan.status === 'PAID'
                          ? 'bg-emerald-500'
                          : loan.status === 'OVERDUE'
                          ? 'bg-rose-500'
                          : 'bg-gradient-to-r from-blue-500 to-amber-500'
                      }`}
                      style={{ width: `${percentPaid}%` }}
                    />
                  </div>
                </div>

                {/* Timeline & Metadata Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 pt-1 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <span>Disbursed: <strong className="text-slate-200">{loan.disbursedDateStr}</strong></span>
                    <span>•</span>
                    <span className={loan.isOverdue ? 'text-rose-400 font-bold' : ''}>
                      Due: <strong className={loan.isOverdue ? 'text-rose-400' : 'text-slate-200'}>{loan.dueDateStr}</strong>
                    </span>
                  </div>

                  {loan.remainingAmount > 0 && onPayDue && (
                    <button
                      type="button"
                      onClick={onPayDue}
                      className="text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer text-[11px]"
                    >
                      Pay toward this loan →
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
