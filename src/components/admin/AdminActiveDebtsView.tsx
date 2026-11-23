import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Search,
  ShieldCheck,
  User,
  Clock
} from 'lucide-react';
import { UserProfile, Transaction } from '../../App';
import { calculateMemberLoanAllocations, AllocatedLoan } from '../../utils/loanAllocationEngine';
import { OfficialReceiptModal, OfficialReceiptData } from '../common/OfficialReceiptModal';
import { BkashLogo, NagadLogo } from '../PaymentBrandLogos';

interface AdminActiveDebtsViewProps {
  allUsers: UserProfile[];
  allTransactions: Transaction[];
  onSelectMember: (member: UserProfile) => void;
  onSettleLoan: (loan: AllocatedLoan, member: UserProfile) => Promise<void>;
}

interface ActiveDebtEntry {
  user: UserProfile;
  exactDebt: number;
  borrowLimit: number;
  utilPercent: number;
  activeTranches: AllocatedLoan[];
  primaryTranche?: AllocatedLoan;
  matchingLoanTx?: Transaction;
  memoId: string;
  isOverdue: boolean;
  isDueSoon: boolean;
  daysLeft: number | null;
}

export const AdminActiveDebtsView: React.FC<AdminActiveDebtsViewProps> = ({
  allUsers,
  allTransactions,
  onSelectMember,
  onSettleLoan
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'overdue' | 'due_soon' | 'good'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<OfficialReceiptData | null>(null);
  const [confirmSettleKey, setConfirmSettleKey] = useState<string | null>(null);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const activeDebts = useMemo<ActiveDebtEntry[]>(() => {
    const now = Date.now();
    return allUsers
      .filter((u) => (u.remainingDebt || 0) > 0)
      .map((u) => {
        const allocation = calculateMemberLoanAllocations(u.uid, allTransactions, u);
        const activeTranches = allocation.loans.filter((l) => l.remainingAmount > 0);
        const primaryTranche = activeTranches[0] || allocation.loans[0];
        const matchingLoanTx =
          primaryTranche?.rawTransaction ||
          allTransactions.find(
            (t) =>
              t.userId === u.uid &&
              t.type === 'loan' &&
              (t.status === 'confirmed' || (t.status as string) === 'approved')
          );
        const memoId =
          primaryTranche?.memoId ||
          (matchingLoanTx as any)?.memoId ||
          `TUT-MEMO-${u.uid.substring(0, 6).toUpperCase()}`;
        const exactDebt = u.remainingDebt || 0;
        const borrowLimit = u.borrowingLimit || 500;
        const utilPercent = borrowLimit > 0 ? Math.min(100, Math.round((exactDebt / borrowLimit) * 100)) : 0;

        let daysLeft: number | null = null;
        if (primaryTranche?.dueDate) {
          daysLeft = Math.ceil((primaryTranche.dueDate.getTime() - now) / (1000 * 60 * 60 * 24));
        }

        const isOverdue = activeTranches.some((l) => l.status === 'OVERDUE') || (daysLeft !== null && daysLeft < 0);
        const isDueSoon = !isOverdue && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

        return {
          user: u,
          exactDebt,
          borrowLimit,
          utilPercent,
          activeTranches,
          primaryTranche,
          matchingLoanTx,
          memoId: memoId.startsWith('TUT-MEMO-') ? memoId : `TUT-MEMO-${memoId}`,
          isOverdue,
          isDueSoon,
          daysLeft
        };
      })
      .sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return b.exactDebt - a.exactDebt;
      });
  }, [allUsers, allTransactions]);

  const filteredDebts = useMemo(() => {
    return activeDebts.filter((item) => {
      if (filterMode === 'overdue' && !item.isOverdue) return false;
      if (filterMode === 'due_soon' && !item.isDueSoon) return false;
      if (filterMode === 'good' && (item.isOverdue || item.isDueSoon)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.user.name?.toLowerCase().includes(q);
        const matchId = item.user.memberId?.toLowerCase().includes(q) || item.user.uid?.toLowerCase().includes(q);
        const matchPhone = item.user.phone?.toLowerCase().includes(q);
        const matchMemo = item.memoId.toLowerCase().includes(q);
        const matchTrx = item.matchingLoanTx?.transactionId?.toLowerCase().includes(q);
        const matchTranche = item.activeTranches.some(
          (tr) =>
            tr.memoId?.toLowerCase().includes(q) ||
            tr.merchantName?.toLowerCase().includes(q) ||
            tr.orderId?.toLowerCase().includes(q) ||
            tr.purpose?.toLowerCase().includes(q) ||
            tr.loanNumber?.toLowerCase().includes(q)
        );
        return Boolean(matchName || matchId || matchPhone || matchMemo || matchTrx || matchTranche);
      }

      return true;
    });
  }, [activeDebts, filterMode, searchQuery]);

  const summary = useMemo(() => {
    const totalDebt = activeDebts.reduce((s, d) => s + d.exactDebt, 0);
    const overdueCount = activeDebts.filter((d) => d.isOverdue).length;
    const dueSoonCount = activeDebts.filter((d) => d.isDueSoon).length;
    const trancheCount = activeDebts.reduce((s, d) => s + Math.max(1, d.activeTranches.length), 0);
    return { totalDebt, borrowersCount: activeDebts.length, overdueCount, dueSoonCount, trancheCount };
  }, [activeDebts]);

  const handleExportCSV = () => {
    try {
      const headers = ['Member Name', 'Member ID', 'Phone', 'Remaining Debt (BDT)', 'Borrow Limit (BDT)', 'Memo Code', 'Due Date', 'Status'];
      const rows = filteredDebts.map((d) => [
        `"${(d.user.name || 'Member').replace(/"/g, '""')}"`,
        `"${d.user.memberId || d.user.uid}"`,
        `"${d.user.phone || ''}"`,
        d.exactDebt,
        d.borrowLimit,
        `"${d.memoId}"`,
        `"${d.primaryTranche?.dueDateStr || d.matchingLoanTx?.estimatedRepaymentDate || 'Open'}"`,
        `"${d.isOverdue ? 'OVERDUE' : d.isDueSoon ? 'DUE SOON' : 'ACTIVE'}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csvContent));
      link.setAttribute('download', `TUT_Active_Debts_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Active debts export failed:', err);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-7xl mx-auto animate-fadeIn">
      {/* Top 4 Active Debt Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Total Active Debt</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-300 mt-1.5">
            ৳ {summary.totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            Across {summary.trancheCount} active tranche{summary.trancheCount !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Active Borrowers</span>
            <User className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white mt-1.5">
            {summary.borrowersCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Members holding open balances</div>
        </div>

        <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Overdue Accounts</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className={`text-xl sm:text-2xl font-bold font-mono tabular-nums mt-1.5 ${summary.overdueCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {summary.overdueCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Past scheduled repayment window</div>
        </div>

        <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Due Within 7 Days</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white mt-1.5">
            {summary.dueSoonCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Upcoming maturities</div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0C152E] border border-[#16274E]/80 overflow-x-auto custom-scrollbar">
          {[
            { id: 'all' as const, label: `All Active (${activeDebts.length})` },
            { id: 'overdue' as const, label: `Overdue (${summary.overdueCount})` },
            { id: 'due_soon' as const, label: `Due Soon (${summary.dueSoonCount})` },
            { id: 'good' as const, label: 'Good Standing' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-[#132247] text-amber-300 border border-amber-500/35'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search borrower, ID, memo..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0C152E] border border-[#16274E]/80 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{exportSuccess ? 'Exported' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Active Debts List */}
      {filteredDebts.length === 0 ? (
        <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-10 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <div className="text-sm font-bold text-white">No Active Debts Matching Filter</div>
          <div className="text-xs text-slate-400">
            {activeDebts.length === 0
              ? 'All member loan obligations are currently settled.'
              : 'Try adjusting your search or filter tab to inspect other open balances.'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {filteredDebts.map((item) => {
            const {
              user,
              exactDebt,
              borrowLimit,
              utilPercent,
              activeTranches,
              primaryTranche,
              matchingLoanTx,
              memoId,
              isOverdue,
              isDueSoon,
              daysLeft
            } = item;
            const methodLower = (matchingLoanTx?.method || '').toLowerCase();
            const trancheToSettle: AllocatedLoan = primaryTranche || {
              id: matchingLoanTx?.id || user.uid,
              loanNumber: `LN-${memoId.replace('TUT-MEMO-', '')}`,
              memoId,
              userId: user.uid,
              userName: user.name,
              borrowerName: user.name,
              originalAmount: exactDebt,
              paidAmount: 0,
              remainingAmount: exactDebt,
              disbursedDate: new Date(),
              disbursedDateStr: matchingLoanTx?.date || 'Confirmed',
              dueDate: new Date(),
              dueDateStr: matchingLoanTx?.estimatedRepaymentDate || 'Open Term',
              status: isOverdue ? 'OVERDUE' : 'ACTIVE',
              statusLabel: isOverdue ? 'OVERDUE' : 'ACTIVE',
              isOverdue,
              method: matchingLoanTx?.method || 'Direct Disbursal',
              rawTransaction: matchingLoanTx || null
            };
            const settleKey = `${user.uid}-${trancheToSettle.id}`;

            return (
              <div
                key={user.uid}
                className={`bg-[#0B1326] border rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors ${
                  isOverdue
                    ? 'border-rose-500/45'
                    : isDueSoon
                    ? 'border-amber-500/40'
                    : 'border-white/[0.08] hover:border-blue-500/35'
                }`}
              >
                {/* Header: Borrower + Remaining Debt */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {user.photoUrl ? (
                      <img
                        src={user.photoUrl}
                        alt={user.name}
                        className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'M'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{user.name || 'Member'}</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        #{user.memberId || user.uid.substring(0, 8).toUpperCase()} • {user.phone || 'No phone'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-amber-300">
                      ৳ {exactDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        isOverdue
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : isDueSoon
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-blue-500/10 text-blue-300 border-blue-500/25'
                      }`}
                    >
                      {isOverdue
                        ? 'Overdue'
                        : isDueSoon && daysLeft !== null
                        ? `Due in ${daysLeft}d`
                        : 'Active Debt'}
                    </span>
                  </div>
                </div>

                {/* Limit Utilization Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      Limit Utilization (<span className="font-mono text-slate-200 tabular-nums">{utilPercent}%</span> of ৳{borrowLimit.toLocaleString()})
                    </span>
                    <span className="font-mono text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Due: {primaryTranche?.dueDateStr || matchingLoanTx?.estimatedRepaymentDate || 'Open'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#070D19] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        utilPercent >= 85 ? 'bg-rose-500' : utilPercent >= 50 ? 'bg-amber-400' : 'bg-teal-400'
                      }`}
                      style={{ width: `${utilPercent}%` }}
                    />
                  </div>
                </div>

                {/* Channel & Per-Payment / Loan Tranche Breakdown */}
                <div className="bg-[#070D19] border border-white/[0.06] rounded-lg p-2.5 space-y-2 text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-slate-200 min-w-0">
                      {methodLower.includes('bkash') && <BkashLogo size="xs" variant="badge" />}
                      {methodLower.includes('nagad') && <NagadLogo size="xs" variant="badge" />}
                      <span className="truncate font-medium">
                        {activeTranches.length > 1
                          ? `${activeTranches.length} Separate Active Obligations`
                          : `${matchingLoanTx?.method || primaryTranche?.method || 'Direct Disbursal'}${matchingLoanTx?.accountNumber ? ` (${matchingLoanTx.accountNumber})` : ''}`}
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] text-amber-300/90">
                      {activeTranches.length > 1 ? `${activeTranches.length} Items` : memoId}
                    </span>
                  </div>

                  {activeTranches.length > 0 && (
                    <div className="pt-1.5 border-t border-white/[0.06] space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
                      {activeTranches.map((tr) => {
                        const raw = tr.rawTransaction || {};
                        const isCardOrWalletPay = tr.trancheType === 'merchant_payment';
                        const trMethod = tr.method || raw.method || 'Direct';
                        const trMemo = tr.memoId?.startsWith('TUT-') ? tr.memoId : `TUT-MEMO-${tr.memoId}`;
                        const trSettleKey = `${user.uid}-${tr.id}`;
                        return (
                          <div
                            key={tr.id}
                            className="p-2 rounded-md bg-[#0B1326]/90 border border-white/[0.06] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                    isCardOrWalletPay
                                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                                      : 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                                  }`}
                                >
                                  {tr.loanNumber}
                                </span>
                                <span className="text-[11px] font-semibold text-white truncate">
                                  {isCardOrWalletPay
                                    ? tr.merchantName || raw.merchantName || 'Partner Payment'
                                    : tr.purpose || 'Portal Loan'}
                                </span>
                                {tr.orderId && (
                                  <span className="text-[9.5px] font-mono text-slate-400 truncate">
                                    #{tr.orderId}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                {trMethod}
                                {tr.cardLast4 ? ` (••${tr.cardLast4})` : ''} • {tr.disbursedDateStr} • {trMemo}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="text-right">
                                <div className="font-mono tabular-nums text-amber-300 font-bold text-[11px]">
                                  ৳{tr.remainingAmount.toLocaleString()} left
                                </div>
                                {tr.originalAmount !== tr.remainingAmount && (
                                  <div className="text-[9px] font-mono text-slate-500">
                                    of ৳{tr.originalAmount.toLocaleString()}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedReceipt({
                                    id: raw.id || tr.id,
                                    memoId: trMemo,
                                    type: isCardOrWalletPay ? 'merchant_payment' : 'loan',
                                    amount: tr.originalAmount,
                                    userName: user.name,
                                    userId: user.uid,
                                    memberId: user.memberId,
                                    method: trMethod,
                                    accountNumber: raw.accountNumber,
                                    transactionId: raw.transactionId || tr.orderId || trMemo,
                                    reference: raw.reference || tr.merchantName || trMemo,
                                    estimatedRepaymentDate: raw.estimatedRepaymentDate || tr.dueDateStr,
                                    date: raw.date || tr.disbursedDateStr,
                                    timestamp: raw.timestamp,
                                    status: 'confirmed',
                                    decidedBy: raw.decidedBy || (isCardOrWalletPay ? 'T.U.T. Automated Gateway' : 'Chief Administrator'),
                                    adminNotes: raw.adminNotes,
                                    loanReason: tr.purpose || raw.loanReason || 'Active Obligation'
                                  })
                                }
                                className="p-1.5 rounded bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                                title="View Memo for this obligation"
                              >
                                <FileText className="w-3 h-3" />
                              </button>
                              {activeTranches.length > 1 && (
                                <button
                                  type="button"
                                  disabled={settlingKey === trSettleKey}
                                  onClick={async () => {
                                    setSettlingKey(trSettleKey);
                                    try {
                                      await onSettleLoan(tr, user);
                                    } finally {
                                      setSettlingKey(null);
                                    }
                                  }}
                                  className="px-1.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/25 text-emerald-300 text-[9.5px] font-bold cursor-pointer"
                                  title={`Mark ${tr.loanNumber} (৳${tr.remainingAmount.toLocaleString()}) settled`}
                                >
                                  {settlingKey === trSettleKey ? '...' : 'Settle'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(matchingLoanTx?.loanReason || (matchingLoanTx as any)?.purpose) && activeTranches.length <= 1 && (
                    <div className="pt-1 border-t border-white/[0.06] text-slate-400 italic truncate">
                      "{matchingLoanTx?.loanReason || (matchingLoanTx as any)?.purpose}"
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                {confirmSettleKey === settleKey ? (
                  <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/35 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-emerald-200 font-medium">
                      Confirm full settlement of ৳{exactDebt.toLocaleString()}?
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmSettleKey(null)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={settlingKey === settleKey}
                        onClick={async () => {
                          setSettlingKey(settleKey);
                          try {
                            await onSettleLoan(trancheToSettle, user);
                          } finally {
                            setSettlingKey(null);
                            setConfirmSettleKey(null);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold cursor-pointer"
                      >
                        {settlingKey === settleKey ? 'Settling...' : 'Confirm Settle'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onSelectMember(user)}
                      className="px-3 py-1.5 rounded-lg bg-[#0D1836] hover:bg-[#132247] border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-blue-400" />
                      <span>Member Dossier</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedReceipt({
                            id: matchingLoanTx?.id || user.uid,
                            memoId: primaryTranche?.memoId || memoId,
                            type: primaryTranche?.trancheType === 'merchant_payment' ? 'merchant_payment' : 'loan',
                            amount: exactDebt,
                            userName: user.name,
                            userId: user.uid,
                            memberId: user.memberId,
                            method: matchingLoanTx?.method || primaryTranche?.method || 'Direct Disbursal',
                            accountNumber: matchingLoanTx?.accountNumber,
                            transactionId: matchingLoanTx?.transactionId || memoId,
                            reference: (matchingLoanTx as any)?.reference || user.referenceContact || memoId,
                            estimatedRepaymentDate: matchingLoanTx?.estimatedRepaymentDate || primaryTranche?.dueDateStr,
                            date: matchingLoanTx?.date || primaryTranche?.disbursedDateStr || 'Confirmed',
                            timestamp: matchingLoanTx?.timestamp,
                            status: 'confirmed',
                            decidedBy:
                              (matchingLoanTx as any)?.decidedBy ||
                              (primaryTranche?.trancheType === 'merchant_payment'
                                ? 'T.U.T. Automated Gateway'
                                : 'Chief Administrator'),
                            adminNotes: (matchingLoanTx as any)?.adminNotes,
                            loanReason: matchingLoanTx?.loanReason || (matchingLoanTx as any)?.purpose || primaryTranche?.purpose || 'Active Loan Obligation'
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Memo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmSettleKey(settleKey)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Settle</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedReceipt && (
        <OfficialReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
};
