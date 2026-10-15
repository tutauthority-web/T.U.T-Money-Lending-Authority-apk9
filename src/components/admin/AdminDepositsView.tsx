import React, { useState } from 'react';
import { 
  PiggyBank, 
  Search, 
  ArrowDownLeft, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User,
  FileText
} from 'lucide-react';
import { Transaction, UserProfile } from '../../App';
import { OfficialReceiptModal, OfficialReceiptData } from '../common/OfficialReceiptModal';

interface AdminDepositsViewProps {
  transactions: Transaction[];
  allUsers: UserProfile[];
  onViewMember: (userId: string) => void;
}

export const AdminDepositsView: React.FC<AdminDepositsViewProps> = ({
  transactions,
  allUsers,
  onViewMember
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'used' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<OfficialReceiptData | null>(null);

  // Extract all deposit transactions
  const depositList = transactions.filter((tx) => tx.type === 'deposit');

  const filteredDeposits = depositList.filter((tx) => {
    // Filter by tab
    if (activeTab === 'active' && tx.status !== 'confirmed' && (tx.status as string) !== 'approved') return false;
    if (activeTab === 'pending' && tx.status !== 'pending') return false;
    if (activeTab === 'used' && (tx as any).isUsedInReserve !== true) return false;

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchUser = tx.userName?.toLowerCase().includes(q) || tx.userId?.toLowerCase().includes(q);
      const matchId = tx.id?.toLowerCase().includes(q);
      const matchMemo = (tx as any).memoId?.toLowerCase().includes(q);
      return matchUser || matchId || matchMemo;
    }

    return true;
  });

  return (
    <div className="space-y-3.5 animate-fadeIn">
      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0C152E] border border-[#16274E]/80 overflow-x-auto custom-scrollbar">
          {(['all', 'active', 'used', 'pending'] as const).map((tab) => (
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

        {/* Search */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deposits or memo..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0C152E] border border-[#16274E]/80 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>
      </div>

      {/* Deposits List */}
      <div className="space-y-2">
        {filteredDeposits.length === 0 ? (
          <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-8 text-center text-slate-500 text-xs">
            No deposits found under {activeTab}.
          </div>
        ) : (
          filteredDeposits.map((dep) => {
            const memberObj = allUsers.find(u => u.uid === dep.userId);
            const memberIdStr = memberObj?.memberId || (dep.userId ? dep.userId.substring(0, 5).toUpperCase() : 'MEM');
            const memoCode = (dep as any).memoId || `TUT-MEMO-${dep.id.substring(0, 8).toUpperCase()}`;

            return (
              <div
                key={dep.id}
                className="bg-[#0C152E]/95 border border-[#16274E]/90 hover:border-emerald-500/35 rounded-xl p-3 sm:p-3.5 transition-all shadow-xs flex items-center justify-between gap-3 group"
              >
                {/* Left: Icon, Member Name, Status, Date */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                      Member #{memberIdStr} <span className="font-normal text-slate-300 ml-1">{dep.userName || memberObj?.name || 'Member'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="font-semibold font-mono text-emerald-400">
                        ৳ {(dep.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-amber-400/90">{memoCode}</span>
                      <span>•</span>
                      <span className="capitalize">{dep.status === 'confirmed' ? 'Active' : dep.status || 'Active'}</span>
                      <span>•</span>
                      <span>{dep.date || 'Recent'}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setSelectedReceipt({
                      id: dep.id,
                      memoId: (dep as any).memoId,
                      type: 'deposit',
                      amount: dep.amount,
                      userName: dep.userName || memberObj?.name,
                      userId: dep.userId,
                      memberId: memberIdStr,
                      method: dep.method,
                      accountNumber: (dep as any).accountNumber,
                      transactionId: dep.transactionId,
                      date: dep.date,
                      timestamp: dep.timestamp,
                      status: dep.status,
                      decidedBy: (dep as any).decidedBy,
                      decidedAt: (dep as any).decidedAt,
                      adminNotes: (dep as any).adminNotes
                    })}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-amber-300 bg-[#12224A] hover:bg-[#1A316B] border border-[#1E3A7B] transition-colors cursor-pointer"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Receipt</span>
                  </button>

                  <button
                    onClick={() => onViewMember(dep.userId)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium text-blue-300 bg-[#12224A] hover:bg-[#1A316B] border border-[#1E3A7B] transition-colors cursor-pointer"
                  >
                    Member
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
