import React, { useState } from 'react';
import { 
  CreditCard, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCw, 
  PiggyBank, 
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  FileText
} from 'lucide-react';
import { Transaction } from '../../App';
import { OfficialReceiptModal, OfficialReceiptData } from '../common/OfficialReceiptModal';

interface AdminTransactionsViewProps {
  transactions: Transaction[];
  onViewMember?: (userId: string) => void;
}

export const AdminTransactionsView: React.FC<AdminTransactionsViewProps> = ({
  transactions,
  onViewMember
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals' | 'loans' | 'repayments'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<OfficialReceiptData | null>(null);

  const filteredTransactions = transactions.filter((tx) => {
    // Filter by tab
    if (activeTab === 'deposits' && tx.type !== 'deposit') return false;
    if (activeTab === 'withdrawals' && tx.type !== 'refund') return false;
    if (activeTab === 'loans' && tx.type !== 'loan') return false;
    if (activeTab === 'repayments' && tx.type !== 'pay_due') return false;

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchUser = tx.userName?.toLowerCase().includes(q) || tx.userId?.toLowerCase().includes(q);
      const matchMethod = tx.method?.toLowerCase().includes(q);
      const matchTxId = tx.transactionId?.toLowerCase().includes(q) || tx.id?.toLowerCase().includes(q);
      const matchMemo = (tx as any).memoId?.toLowerCase().includes(q);
      return matchUser || matchMethod || matchTxId || matchMemo;
    }

    return true;
  });

  return (
    <div className="space-y-3.5 animate-fadeIn">
      {/* Search & Tabs Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0C152E] border border-[#16274E]/80 overflow-x-auto custom-scrollbar">
          {(['all', 'deposits', 'withdrawals', 'loans', 'repayments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#132247] text-amber-300 border border-amber-500/35 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions or memo..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0C152E] border border-[#16274E]/80 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl divide-y divide-[#16274E]/60 overflow-hidden shadow-xs">
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No transactions found under {activeTab}.
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const isPositive = tx.type === 'deposit' || tx.type === 'pay_due';
            const isLoan = tx.type === 'loan';

            let icon = <CreditCard className="w-3.5 h-3.5" />;
            let iconColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            let label = 'Transaction';

            if (tx.type === 'deposit') {
              icon = <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />;
              iconColor = 'bg-emerald-500/10 border-emerald-500/20';
              label = 'Member Deposit';
            } else if (tx.type === 'pay_due') {
              icon = <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />;
              iconColor = 'bg-teal-500/10 border-teal-500/20';
              label = 'Loan Repayment';
            } else if (tx.type === 'loan') {
              icon = <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />;
              iconColor = 'bg-amber-500/10 border-amber-500/20';
              label = 'Loan Disbursement';
            } else if (tx.type === 'refund') {
              icon = <RefreshCw className="w-3.5 h-3.5 text-rose-400" />;
              iconColor = 'bg-rose-500/10 border-rose-500/20';
              label = 'Withdrawal / Refund';
            }

            const memoCode = (tx as any).memoId 
              ? (tx as any).memoId 
              : `TUT-MEMO-${tx.id.substring(0, 8).toUpperCase()}`;

            return (
              <div
                key={tx.id}
                onClick={() => setSelectedReceipt({
                  id: tx.id,
                  memoId: (tx as any).memoId,
                  type: tx.type,
                  amount: tx.amount,
                  userName: tx.userName,
                  userId: tx.userId,
                  method: tx.method,
                  accountNumber: (tx as any).accountNumber,
                  transactionId: tx.transactionId,
                  date: tx.date,
                  timestamp: tx.timestamp,
                  dueDate: (tx as any).dueDate,
                  estimatedRepaymentDate: (tx as any).estimatedRepaymentDate,
                  status: tx.status,
                  decidedBy: (tx as any).decidedBy,
                  decidedAt: (tx as any).decidedAt,
                  adminNotes: (tx as any).adminNotes,
                  loanReason: (tx as any).loanReason,
                  isTransfer: (tx as any).isTransfer,
                  transferType: (tx as any).transferType,
                  transferSenderName: (tx as any).transferSenderName,
                  transferRecipientName: (tx as any).transferRecipientName
                })}
                className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-[#0A1229] transition-colors cursor-pointer group"
              >
                {/* Left: Icon, Label, Subtitle */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg ${iconColor} border flex items-center justify-center shrink-0`}>
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
                      {label}
                    </div>
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="font-medium text-slate-300">{tx.userName || `Member #${(tx.userId || 'MEM').substring(0, 5).toUpperCase()}`}</span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-amber-400/90">{memoCode}</span>
                      <span>•</span>
                      <span>{tx.date || 'Recent'}</span>
                      {tx.method && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline font-mono text-[10px] text-slate-500">{tx.method}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Status Badge & View Memo Button */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className={`text-xs sm:text-sm font-bold font-mono ${
                      isPositive ? 'text-emerald-400' : isLoan ? 'text-rose-400' : 'text-slate-200'
                    }`}>
                      {isPositive ? '+৳ ' : '-৳ '}
                      {(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                        tx.status === 'confirmed' || (tx.status as string) === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : tx.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {tx.status || 'confirmed'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedReceipt({
                        id: tx.id,
                        memoId: (tx as any).memoId,
                        type: tx.type,
                        amount: tx.amount,
                        userName: tx.userName,
                        userId: tx.userId,
                        method: tx.method,
                        accountNumber: (tx as any).accountNumber,
                        transactionId: tx.transactionId,
                        date: tx.date,
                        timestamp: tx.timestamp,
                        dueDate: (tx as any).dueDate,
                        estimatedRepaymentDate: (tx as any).estimatedRepaymentDate,
                        status: tx.status,
                        decidedBy: (tx as any).decidedBy,
                        decidedAt: (tx as any).decidedAt,
                        adminNotes: (tx as any).adminNotes,
                        loanReason: (tx as any).loanReason,
                        isTransfer: (tx as any).isTransfer,
                        transferType: (tx as any).transferType,
                        transferSenderName: (tx as any).transferSenderName,
                        transferRecipientName: (tx as any).transferRecipientName
                      });
                    }}
                    className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#132247] hover:bg-[#1A316B] border border-[#1E3A7B] text-[11px] font-medium text-amber-300 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Memo</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Official Receipt / Memo Modal */}
      {selectedReceipt && (
        <OfficialReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
};
