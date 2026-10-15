import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  ArrowLeft, 
  Phone, 
  Mail, 
  Shield, 
  CreditCard, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Edit3,
  Calendar,
  DollarSign,
  FileText
} from 'lucide-react';
import { UserProfile, Transaction } from '../../App';
import { calculateMemberLoanAllocations, AllocatedLoan } from '../../utils/loanAllocationEngine';
import { OfficialReceiptModal, OfficialReceiptData } from '../common/OfficialReceiptModal';

interface AdminMembersViewProps {
  allUsers: UserProfile[];
  allTransactions: Transaction[];
  selectedMember: UserProfile | null;
  onSelectMember: (user: UserProfile | null) => void;
  onEditDossier: (user: UserProfile) => void;
  onSettleLoan: (loan: AllocatedLoan, user: UserProfile) => Promise<void>;
}

export const AdminMembersView: React.FC<AdminMembersViewProps> = ({
  allUsers,
  allTransactions,
  selectedMember,
  onSelectMember,
  onEditDossier,
  onSettleLoan
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'pending' | 'in_debt'>('all');
  const [activeProfileTab, setActiveProfileTab] = useState<'overview' | 'loans' | 'transactions' | 'details'>('overview');
  const [isSettlingId, setIsSettlingId] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<OfficialReceiptData | null>(null);

  // Filter members list
  const filteredMembers = allUsers.filter((u) => {
    // Filter type
    if (filterType === 'active' && u.status !== 'approved') return false;
    if (filterType === 'pending' && u.status !== 'pending') return false;
    if (filterType === 'in_debt' && (u.remainingDebt || 0) <= 0) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name?.toLowerCase().includes(q);
      const matchId = u.memberId?.toLowerCase().includes(q) || u.uid?.toLowerCase().includes(q);
      const matchPhone = u.phone?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      return matchName || matchId || matchPhone || matchEmail;
    }

    return true;
  });

  // -------------------------------------------------------------
  // MEMBER PROFILE VIEW (Screen 5: Member Profile)
  // -------------------------------------------------------------
  if (selectedMember) {
    const loanSummary = calculateMemberLoanAllocations(selectedMember.uid, allTransactions, selectedMember);
    const memberTransactions = allTransactions
      .filter((tx) => tx.userId === selectedMember.uid || tx.accountNumber === selectedMember.email)
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

    return (
      <div className="space-y-4 max-w-4xl mx-auto animate-fadeIn pb-8">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => onSelectMember(null)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>Back to Members</span>
          </button>
        </div>

        {/* Member Header Card */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500/20 to-blue-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-lg font-bold shrink-0">
                {selectedMember.photoUrl ? (
                  <img src={selectedMember.photoUrl} alt={selectedMember.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  selectedMember.name.charAt(0)
                )}
              </div>
              <div className="space-y-0.5">
                <div className="text-base font-bold text-white">{selectedMember.name}</div>
                <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-amber-400 font-mono">
                    #{selectedMember.memberId || selectedMember.uid.substring(0, 5).toUpperCase()}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      selectedMember.status === 'approved' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`} />
                    <span className="capitalize">{selectedMember.status === 'approved' ? 'Active' : selectedMember.status}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" /> {selectedMember.phone || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onEditDossier(selectedMember)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Edit3 className="w-3 h-3" /> Edit Dossier
            </button>
          </div>
        </div>

        {/* Member Profile Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0C152E] border border-[#16274E]/80 overflow-x-auto custom-scrollbar">
          {(['overview', 'loans', 'transactions', 'details'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveProfileTab(tab)}
              className={`px-3.5 py-1 rounded-md text-xs font-semibold transition-all capitalize whitespace-nowrap cursor-pointer ${
                activeProfileTab === tab
                  ? 'bg-[#132247] text-amber-300 border border-amber-500/35 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeProfileTab === 'overview' && (
          <div className="space-y-3.5 animate-fadeIn">
            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-3.5">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Borrowed</div>
                <div className="text-base sm:text-lg font-bold font-mono text-white mt-1">
                  ৳ {loanSummary.totalBorrowed.toLocaleString()}
                </div>
              </div>

              <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-3.5">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Repaid</div>
                <div className="text-base sm:text-lg font-bold font-mono text-emerald-400 mt-1">
                  ৳ {loanSummary.totalRepaid.toLocaleString()}
                </div>
              </div>

              <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-3.5">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Outstanding Debt</div>
                <div className="text-base sm:text-lg font-bold font-mono text-rose-400 mt-1">
                  ৳ {loanSummary.totalOutstanding.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Active & Completed Loan Counters */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Active Loans</span>
                <span className="text-sm font-bold font-mono text-amber-400">{loanSummary.activeLoans}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Completed Loans</span>
                <span className="text-sm font-bold font-mono text-emerald-400">{loanSummary.completedLoans}</span>
              </div>
            </div>

            {/* Recent Loans Card */}
            <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#16274E]/70">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Recent Loans</h3>
                <button
                  onClick={() => setActiveProfileTab('loans')}
                  className="text-xs font-medium text-amber-300 hover:text-amber-200 cursor-pointer"
                >
                  View All
                </button>
              </div>

              <div className="divide-y divide-[#16274E]/60 mt-1">
                {loanSummary.loans.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs">
                    No loans issued to this member yet.
                  </div>
                ) : (
                  loanSummary.loans.map((loan) => {
                    const rawTx = loan.rawTransaction || {};
                    const memoTag = loan.memoId || rawTx.memoId || `TUT-MEMO-${loan.id.substring(0, 6).toUpperCase()}`;

                    return (
                      <div key={loan.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-200">
                              {loan.loanNumber} - ৳ {loan.originalAmount.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-slate-400">• {loan.statusLabel}</span>
                            <button
                              onClick={() => setSelectedReceipt({
                                id: loan.id,
                                memoId: memoTag,
                                type: 'loan',
                                amount: loan.originalAmount,
                                userName: selectedMember.name,
                                userId: selectedMember.uid,
                                memberId: selectedMember.memberId,
                                method: loan.method || rawTx.method || 'Cash / bKash',
                                accountNumber: rawTx.accountNumber || selectedMember.phone,
                                transactionId: rawTx.transactionId,
                                date: loan.disbursedDateStr,
                                dueDate: loan.dueDateStr,
                                status: loan.status,
                                loanReason: loan.purpose
                              })}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-mono transition-colors cursor-pointer"
                              title="View Memo Receipt"
                            >
                              <FileText className="w-2.5 h-2.5" />
                              <span>{memoTag}</span>
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Borrowed: {loan.disbursedDateStr} • Due: {loan.dueDateStr}
                            {loan.remainingAmount > 0 && (
                              <span className="text-amber-400 ml-2 font-medium">Remaining: ৳{loan.remainingAmount.toLocaleString()}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            loan.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : loan.status === 'OVERDUE'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {loan.status}
                          </span>

                          {loan.status !== 'PAID' && loan.status !== 'CANCELLED' && (
                            <button
                              onClick={async () => {
                                setIsSettlingId(loan.id);
                                try {
                                  await onSettleLoan(loan, selectedMember);
                                } finally {
                                  setIsSettlingId(null);
                                }
                              }}
                              disabled={isSettlingId === loan.id}
                              className="px-2.5 py-1 rounded-md text-xs font-medium text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer"
                            >
                              {isSettlingId === loan.id ? 'Settling...' : 'Settle'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LOANS */}
        {activeProfileTab === 'loans' && (
          <div className="space-y-3 animate-fadeIn">
            {loanSummary.loans.length === 0 ? (
              <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-8 text-center text-slate-500 text-xs">
                No loan records found for this member.
              </div>
            ) : (
              loanSummary.loans.map((loan) => {
                const rawTx = loan.rawTransaction || {};
                const memoTag = loan.memoId || rawTx.memoId || `TUT-MEMO-${loan.id.substring(0, 6).toUpperCase()}`;

                return (
                  <div key={loan.id} className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-3.5 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#16274E]/70 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="text-xs font-semibold text-white">{loan.loanNumber}</div>
                        <button
                          onClick={() => setSelectedReceipt({
                            id: loan.id,
                            memoId: memoTag,
                            type: 'loan',
                            amount: loan.originalAmount,
                            userName: selectedMember.name,
                            userId: selectedMember.uid,
                            memberId: selectedMember.memberId,
                            method: loan.method || rawTx.method || 'Cash / bKash',
                            accountNumber: rawTx.accountNumber || selectedMember.phone,
                            transactionId: rawTx.transactionId,
                            date: loan.disbursedDateStr,
                            dueDate: loan.dueDateStr,
                            status: loan.status,
                            loanReason: loan.purpose
                          })}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[11px] font-mono transition-colors cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{memoTag}</span>
                        </button>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        loan.status === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {loan.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <div className="text-[10px] text-slate-400">Original Amount</div>
                        <div className="text-xs sm:text-sm font-bold font-mono text-white mt-0.5">৳ {loan.originalAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Paid Amount</div>
                        <div className="text-xs sm:text-sm font-bold font-mono text-emerald-400 mt-0.5">৳ {loan.paidAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Remaining Amount</div>
                        <div className="text-xs sm:text-sm font-bold font-mono text-amber-400 mt-0.5">৳ {loan.remainingAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Due Date</div>
                        <div className="text-xs font-medium text-slate-300 mt-0.5">{loan.dueDateStr}</div>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedReceipt({
                          id: loan.id,
                          memoId: memoTag,
                          type: 'loan',
                          amount: loan.originalAmount,
                          userName: selectedMember.name,
                          userId: selectedMember.uid,
                          memberId: selectedMember.memberId,
                          method: loan.method || rawTx.method || 'Cash / bKash',
                          accountNumber: rawTx.accountNumber || selectedMember.phone,
                          transactionId: rawTx.transactionId,
                          date: loan.disbursedDateStr,
                          dueDate: loan.dueDateStr,
                          status: loan.status,
                          loanReason: loan.purpose
                        })}
                        className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3 h-3 text-amber-400" />
                        <span>View Memo Receipt</span>
                      </button>

                      {loan.status !== 'PAID' && loan.status !== 'CANCELLED' && (
                        <button
                          onClick={async () => {
                            setIsSettlingId(loan.id);
                            try {
                              await onSettleLoan(loan, selectedMember);
                            } finally {
                              setIsSettlingId(null);
                            }
                          }}
                          disabled={isSettlingId === loan.id}
                          className="px-3 py-1 rounded-md text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer"
                        >
                          {isSettlingId === loan.id ? 'Processing...' : 'Settle Full Loan'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: TRANSACTIONS */}
        {activeProfileTab === 'transactions' && (
          <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5 animate-fadeIn">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Transaction History</h3>
            <div className="divide-y divide-[#16274E]/60">
              {memberTransactions.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">No transactions recorded.</div>
              ) : (
                memberTransactions.map((tx) => {
                  const memoTag = tx.memoId || `TUT-MEMO-${tx.id.substring(0, 6).toUpperCase()}`;

                  return (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2.5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-slate-200 capitalize">{tx.type?.replace('_', ' ')}</span>
                          <button
                            onClick={() => setSelectedReceipt({
                              id: tx.id,
                              memoId: memoTag,
                              type: tx.type || 'transaction',
                              amount: tx.amount || 0,
                              userName: selectedMember.name,
                              userId: selectedMember.uid,
                              memberId: selectedMember.memberId,
                              method: tx.method,
                              accountNumber: tx.accountNumber || selectedMember.phone,
                              transactionId: tx.transactionId,
                              date: tx.date,
                              timestamp: tx.timestamp,
                              status: tx.status,
                              loanReason: tx.loanReason || tx.purpose
                            })}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors cursor-pointer"
                            title="View Memo Receipt"
                          >
                            {memoTag}
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {tx.date || (tx.timestamp ? new Date(tx.timestamp?.seconds ? tx.timestamp.seconds * 1000 : tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent')} • Method: {tx.method || 'N/A'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className={`text-xs font-bold font-mono ${
                          tx.type === 'deposit' || tx.type === 'pay_due' ? 'text-emerald-400' : 'text-slate-200'
                        }`}>
                          {tx.type === 'deposit' || tx.type === 'pay_due' ? '+' : ''}৳ {(tx.amount || 0).toLocaleString()}
                        </div>
                        <button
                          onClick={() => setSelectedReceipt({
                            id: tx.id,
                            memoId: memoTag,
                            type: tx.type || 'transaction',
                            amount: tx.amount || 0,
                            userName: selectedMember.name,
                            userId: selectedMember.uid,
                            memberId: selectedMember.memberId,
                            method: tx.method,
                            accountNumber: tx.accountNumber || selectedMember.phone,
                            transactionId: tx.transactionId,
                            date: tx.date,
                            timestamp: tx.timestamp,
                            status: tx.status,
                            loanReason: tx.loanReason || tx.purpose
                          })}
                          className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/20 transition-colors cursor-pointer"
                          title="View Official Memo / Receipt"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DETAILS */}
        {activeProfileTab === 'details' && (
          <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5 space-y-3 animate-fadeIn">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Member Profile Dossier</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-[#090F24] border border-[#16274E]/70">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">National ID (NID)</div>
                <div className="text-slate-200 font-medium mt-0.5">{selectedMember.nid || 'N/A'}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#090F24] border border-[#16274E]/70">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Occupation</div>
                <div className="text-slate-200 font-medium mt-0.5">{selectedMember.occupation || 'N/A'}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#090F24] border border-[#16274E]/70">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Present Address</div>
                <div className="text-slate-200 font-medium mt-0.5">{selectedMember.address || 'N/A'}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#090F24] border border-[#16274E]/70">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Emergency Contact</div>
                <div className="text-slate-200 font-medium mt-0.5">{selectedMember.emergencyContact || 'N/A'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Official Receipt / Memo Modal */}
        <OfficialReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // LIST VIEW (Screen 4: Members Section)
  // -------------------------------------------------------------
  return (
    <div className="space-y-3.5 animate-fadeIn">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID or phone..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0C152E] border border-[#16274E]/80 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0C152E] border border-[#16274E]/80 overflow-x-auto custom-scrollbar">
          {(['all', 'active', 'pending', 'in_debt'] as const).map((ft) => (
            <button
              key={ft}
              onClick={() => setFilterType(ft)}
              className={`px-3 py-1 rounded-md text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                filterType === ft
                  ? 'bg-[#132247] text-amber-300 border border-amber-500/35 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {ft.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Member Cards List */}
      <div className="space-y-2">
        {filteredMembers.length === 0 ? (
          <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-8 text-center text-slate-500 text-xs">
            No members found matching current criteria.
          </div>
        ) : (
          filteredMembers.map((member) => {
            const memberIdStr = member.memberId || `TUT-${member.uid.substring(0, 5).toUpperCase()}`;
            const isActive = member.status === 'approved';

            return (
              <div
                key={member.uid}
                className="bg-[#0C152E]/95 border border-[#16274E]/90 hover:border-amber-500/40 rounded-xl p-3 sm:p-3.5 transition-all shadow-xs flex items-center justify-between gap-3 group"
              >
                {/* Left: Avatar, Name, Member ID, Status, Phone */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500/20 to-blue-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                    {member.photoUrl ? (
                      <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      member.name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
                      {member.name}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-slate-300">#{memberIdStr}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span>{isActive ? 'Active' : member.status}</span>
                      </span>
                      {member.phone && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline text-slate-400">{member.phone}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: View Button */}
                <button
                  onClick={() => onSelectMember(member)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors shrink-0 cursor-pointer"
                >
                  View
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
