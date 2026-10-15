import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  PauseCircle, 
  HelpCircle, 
  ArrowLeft, 
  ExternalLink, 
  User, 
  Phone, 
  Mail, 
  DollarSign, 
  ShieldAlert, 
  AlertTriangle,
  Send,
  Plus,
  CreditCard,
  Hash,
  Bookmark,
  Calendar,
  Info,
  Clock,
  ArrowUpRight,
  Tag
} from 'lucide-react';
import { UnifiedRequestItem } from './types';

interface AdminRequestsViewProps {
  requests: UnifiedRequestItem[];
  selectedRequest: UnifiedRequestItem | null;
  onSelectRequest: (req: UnifiedRequestItem | null) => void;
  onExecuteAction: (action: 'approve' | 'reject' | 'hold' | 'info', request: UnifiedRequestItem, reason?: string) => Promise<void>;
  onAddNote: (req: UnifiedRequestItem, note: string) => Promise<void>;
  onViewDoc: (url: string, title: string) => void;
}

export const AdminRequestsView: React.FC<AdminRequestsViewProps> = ({
  requests,
  selectedRequest,
  onSelectRequest,
  onExecuteAction,
  onAddNote,
  onViewDoc
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | 'hold' | 'info';
  }>({
    isOpen: false,
    action: 'approve'
  });

  // Filter requests based on tab & search
  const filteredRequests = requests.filter((r) => {
    // Tab match
    const status = r.status?.toLowerCase();
    if (activeTab === 'pending') {
      if (status !== 'pending' && status !== 'hold' && status !== 'info_requested') return false;
    } else if (activeTab === 'approved') {
      if (status !== 'approved' && status !== 'confirmed') return false;
    } else if (activeTab === 'rejected') {
      if (status !== 'rejected') return false;
    }

    // Search match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.memberName?.toLowerCase().includes(q);
      const matchId = r.memberId?.toLowerCase().includes(q);
      const matchPhone = r.memberPhone?.toLowerCase().includes(q);
      const matchReqId = r.id?.toLowerCase().includes(q);
      const matchTxId = r.transactionRefId?.toLowerCase().includes(q);
      const matchMethod = r.paymentMethod?.toLowerCase().includes(q);
      const matchReason = r.loanReason?.toLowerCase().includes(q);
      return matchName || matchId || matchPhone || matchReqId || matchTxId || matchMethod || matchReason;
    }

    return true;
  });

  const pendingCount = requests.filter(r => ['pending', 'hold', 'info_requested'].includes(r.status?.toLowerCase())).length;
  const approvedCount = requests.filter(r => ['approved', 'confirmed'].includes(r.status?.toLowerCase())).length;
  const rejectedCount = requests.filter(r => r.status?.toLowerCase() === 'rejected').length;

  const handleActionClick = (action: 'approve' | 'reject' | 'hold' | 'info') => {
    setActionReason('');
    setConfirmModal({ isOpen: true, action });
  };

  const confirmActionExecution = async () => {
    if (!selectedRequest) return;
    setIsProcessing(true);
    try {
      await onExecuteAction(confirmModal.action, selectedRequest, actionReason);
      setConfirmModal({ isOpen: false, action: 'approve' });
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------
  // DETAIL VIEW (Screen 3: Request Details)
  // -------------------------------------------------------------
  if (selectedRequest) {
    const shortage = Math.max(0, (selectedRequest.requestedAmount || 0) - selectedRequest.reserveBefore);

    return (
      <div className="space-y-4 max-w-4xl mx-auto animate-fadeIn pb-8">
        {/* Top bar with back button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => onSelectRequest(null)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>Back to Loan Requests</span>
          </button>
        </div>

        {/* 1. Member Information Card */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#16274E]/70">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-amber-400" /> Member Information
            </h2>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
              selectedRequest.status === 'confirmed' || selectedRequest.status === 'approved'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : selectedRequest.status === 'rejected'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {selectedRequest.status}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3.5">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-500/20 to-blue-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-base font-bold shrink-0">
              {selectedRequest.memberPhoto ? (
                <img src={selectedRequest.memberPhoto} alt={selectedRequest.memberName} className="w-full h-full object-cover rounded-lg" />
              ) : (
                selectedRequest.memberName.charAt(0)
              )}
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-white">{selectedRequest.memberName}</div>
              <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                <span className="font-mono text-amber-400/90 font-medium">#{selectedRequest.memberId}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-500" /> {selectedRequest.memberPhone}</span>
                {selectedRequest.memberEmail && selectedRequest.memberEmail !== 'N/A' && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-500" /> {selectedRequest.memberEmail}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Request Information Card (with Payment Method, TxID, Reference, Reason for Loan) */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-[#16274E]/70">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-blue-400" /> Request Details & Payment Specifications
            </h2>
            <span className="text-[10px] font-mono text-slate-400">
              Ref: {selectedRequest.reference || selectedRequest.memoId || selectedRequest.transactionRefId || 'TUT-REF'}
            </span>
          </div>

          {/* Row 1: Type, Requested Amount, Submitted At */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-blue-400" />
                <span>Request Type</span>
              </div>
              <div className="text-xs font-semibold text-white mt-0.5 capitalize">{selectedRequest.requestTypeLabel}</div>
            </div>

            <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-amber-400" />
                <span>Requested Amount</span>
              </div>
              <div className="text-sm sm:text-base font-bold font-mono text-amber-400 mt-0.5">
                ৳ {selectedRequest.requestedAmount.toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Submitted At</span>
              </div>
              <div className="text-xs font-medium text-slate-200 mt-0.5">{selectedRequest.submittedAtStr}</div>
            </div>
          </div>

          {/* Row 2: User Payment Method, Transaction ID, Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* User Payment Method */}
            <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3 h-3 text-emerald-400" />
                <span>User Payment Method</span>
              </div>
              <div className="text-xs font-bold text-white mt-1">
                {selectedRequest.paymentMethod || 'Cash / Direct Account'}
                {selectedRequest.mobileOperator && (
                  <span className="text-slate-400 font-normal ml-1">({selectedRequest.mobileOperator})</span>
                )}
              </div>
              {selectedRequest.accountNumber && (
                <div className="text-[11px] font-mono text-emerald-400 mt-0.5">
                  A/C: {selectedRequest.accountNumber}
                </div>
              )}
            </div>

            {/* Transaction ID */}
            <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-blue-400" />
                <span>Transaction ID</span>
              </div>
              <div className="text-xs font-mono font-bold text-amber-300 mt-1 truncate" title={selectedRequest.transactionRefId || selectedRequest.id}>
                {selectedRequest.transactionRefId || selectedRequest.id || 'N/A'}
              </div>
              {selectedRequest.memoId && selectedRequest.memoId !== selectedRequest.transactionRefId && (
                <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                  Memo: {selectedRequest.memoId}
                </div>
              )}
            </div>

            {/* Reference & Repayment Date */}
            <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Bookmark className="w-3 h-3 text-purple-400" />
                <span>Reference</span>
              </div>
              <div className="text-xs font-mono font-medium text-slate-200 mt-1 truncate" title={selectedRequest.reference || selectedRequest.memoId}>
                {selectedRequest.reference || selectedRequest.memoId || selectedRequest.transactionRefId || 'TUT-REF-GENERAL'}
              </div>
              {selectedRequest.estimatedRepaymentDate && (
                <div className="text-[10.5px] font-mono text-amber-400 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span>Est. Repayment: {selectedRequest.estimatedRepaymentDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reason for Loan / Purpose */}
          {(selectedRequest.loanReason || selectedRequest.requestType === 'loan') && (
            <div className="p-3.5 rounded-lg bg-[#090F24] border border-amber-500/20">
              <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span>Reason for Loan / Stated Purpose</span>
              </div>
              <div className="text-xs text-slate-100 mt-1.5 leading-relaxed font-sans bg-[#060B1A] p-2.5 rounded-md border border-white/5 font-medium">
                {selectedRequest.loanReason ? `"${selectedRequest.loanReason}"` : 'General Zero-Usury Financial Assistance'}
              </div>
            </div>
          )}
        </div>

        {/* 3. Financial Status Card */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider pb-3 border-b border-[#16274E]/70 flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-teal-400" /> Reserve Impact
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3.5">
            <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Available Reserve</div>
              <div className="text-xs sm:text-sm font-bold font-mono text-teal-400 mt-0.5">
                ৳ {selectedRequest.reserveBefore.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Reserve After Approval</div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-200 mt-0.5">
                ৳ {selectedRequest.reserveAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Reserve Shortage</div>
              <div className={`text-xs sm:text-sm font-bold font-mono mt-0.5 ${shortage > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                ৳ {shortage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Documents Card */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#16274E]/70">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Documents</h2>
          </div>

          <div className="mt-3">
            {selectedRequest.attachedDocs && selectedRequest.attachedDocs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedRequest.attachedDocs.map((doc, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-[#090F24] border border-[#16274E]/70 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-200">{doc.name}</div>
                      <div className="text-[9px] text-slate-500 uppercase">{doc.category}</div>
                    </div>
                    <button
                      onClick={() => onViewDoc(doc.url, doc.name)}
                      className="px-2 py-1 rounded text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" /> View
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-2">No documents attached with this request.</div>
            )}
          </div>
        </div>

        {/* 5. Admin Notes Card */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider pb-3 border-b border-[#16274E]/70">
            Admin Notes
          </h2>

          <div className="mt-3 space-y-2.5">
            {selectedRequest.adminNotes ? (
              <div className="p-2.5 rounded-lg bg-[#090F24] border border-[#16274E]/70 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                {selectedRequest.adminNotes}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic py-1">No notes recorded yet.</div>
            )}

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={internalNoteText}
                onChange={(e) => setInternalNoteText(e.target.value)}
                placeholder="Append internal note..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-[#090F24] border border-[#16274E]/70 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
              <button
                onClick={async () => {
                  if (!internalNoteText.trim()) return;
                  await onAddNote(selectedRequest, internalNoteText.trim());
                  setInternalNoteText('');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#132247] hover:bg-[#1A316B] text-amber-300 border border-[#182C58] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Note
              </button>
            </div>
          </div>
        </div>

        {/* 6. Sticky / Bottom Action Bar (Approve / Reject / Hold / Request Info) */}
        <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">
            Authorization Actions
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleActionClick('approve')}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => handleActionClick('reject')}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
            <button
              onClick={() => handleActionClick('hold')}
              className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <PauseCircle className="w-3.5 h-3.5" /> Hold
            </button>
            <button
              onClick={() => handleActionClick('info')}
              className="px-3.5 py-1.5 rounded-lg bg-[#132247] hover:bg-[#1A316B] text-blue-200 border border-[#1E3A7B] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Request Info
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0B132B] border border-[#16274E] rounded-xl max-w-md w-full p-5 space-y-3.5 shadow-xl animate-scaleUp">
              <h3 className="text-sm font-semibold text-white capitalize">
                Confirm {confirmModal.action} Action
              </h3>
              <p className="text-xs text-slate-300">
                You are about to execute <span className="font-bold text-amber-400 uppercase">{confirmModal.action}</span> for request #{selectedRequest.id} ({selectedRequest.memberName}).
              </p>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Administrative Reason / Memo
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="State justification or memo instructions..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-[#16274E]/70 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setConfirmModal({ isOpen: false, action: 'approve' })}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmActionExecution}
                  disabled={isProcessing}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all cursor-pointer ${
                    confirmModal.action === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : confirmModal.action === 'reject'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  {isProcessing ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // LIST VIEW (Screen 2: Requests Section)
  // -------------------------------------------------------------
  return (
    <div className="space-y-3.5 animate-fadeIn">
      {/* Search & Tabs Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0C152E] border border-[#16274E]/80 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-[#132247] text-amber-300 border border-amber-500/35 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'approved'
                ? 'bg-[#132247] text-emerald-400 border border-emerald-500/35 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'rejected'
                ? 'bg-[#132247] text-rose-400 border border-rose-500/35 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, TxID, method..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0C152E] border border-[#16274E]/80 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>
      </div>

      {/* Requests Card List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-8 text-center text-slate-500 text-xs">
            No {activeTab} requests found matching current filters.
          </div>
        ) : (
          filteredRequests.map((req) => (
            <div
              key={req.id}
              className="bg-[#0C152E]/95 border border-[#16274E]/90 hover:border-amber-500/40 rounded-xl p-4 sm:p-4.5 transition-all shadow-xs group space-y-3"
            >
              {/* Top Row: Status pill, Request Type badge, Member Name & ID, View Details button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#16274E]/70">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase shrink-0 ${
                    req.status === 'confirmed' || req.status === 'approved'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                      : req.status === 'rejected'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                  }`}>
                    {req.status}
                  </span>

                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/25 shrink-0">
                    {req.requestTypeLabel}
                  </span>

                  <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                    <span className="text-amber-400/90 font-mono">#{req.memberId}</span>
                    <span className="text-slate-500">•</span>
                    <span className="font-medium text-slate-200">{req.memberName}</span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono hidden md:inline-block">
                    ({req.submittedAtStr})
                  </span>
                </div>

                <button
                  onClick={() => onSelectRequest(req)}
                  className="px-3 py-1 rounded-md text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
                >
                  View Details →
                </button>
              </div>

              {/* Core Financial & Transaction Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#090F24] p-3 rounded-xl border border-[#16274E]/60">
                {/* 1. Requested Amount */}
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-amber-400" />
                    <span>Amount</span>
                  </div>
                  <div className="text-sm sm:text-base font-bold font-mono text-amber-400 mt-0.5">
                    ৳ {req.requestedAmount.toLocaleString()}
                  </div>
                </div>

                {/* 2. User Payment Method */}
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-emerald-400" />
                    <span>Payment Method</span>
                  </div>
                  <div className="text-xs font-bold text-white mt-0.5 truncate" title={req.paymentMethod}>
                    {req.paymentMethod || 'Cash / Payout'}
                    {req.mobileOperator && <span className="text-slate-400 font-normal ml-1">({req.mobileOperator})</span>}
                  </div>
                  {req.accountNumber && (
                    <div className="text-[10px] font-mono text-emerald-400 truncate">
                      {req.accountNumber}
                    </div>
                  )}
                </div>

                {/* 3. Transaction ID */}
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Hash className="w-3 h-3 text-blue-400" />
                    <span>Transaction ID</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-200 mt-0.5 truncate" title={req.transactionRefId || req.id}>
                    {req.transactionRefId || req.id || 'N/A'}
                  </div>
                </div>

                {/* 4. Reference */}
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Bookmark className="w-3 h-3 text-purple-400" />
                    <span>Reference</span>
                  </div>
                  <div className="text-xs font-mono font-medium text-purple-300 mt-0.5 truncate" title={req.reference || req.memoId}>
                    {req.reference || req.memoId || req.transactionRefId || 'TUT-REF'}
                  </div>
                </div>
              </div>

              {/* Reason for Loan / Stated Purpose banner */}
              {req.loanReason && (
                <div className="px-3 py-2 rounded-lg bg-[#070D1E] border border-amber-500/15 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wider block">Reason for Loan:</span>
                    <span className="text-xs text-slate-200 font-medium leading-relaxed block truncate sm:whitespace-normal">
                      "{req.loanReason}"
                    </span>
                  </div>
                  {req.estimatedRepaymentDate && (
                    <div className="text-[10px] font-mono text-slate-400 shrink-0 self-center hidden sm:block">
                      Est. Repayment: <span className="text-amber-400 font-bold">{req.estimatedRepaymentDate}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Reserve Metrics */}
              <div className="flex items-center justify-between text-[11px] pt-1 px-0.5 border-t border-[#16274E]/40 text-slate-400">
                <div className="flex items-center gap-3">
                  <span>Available Reserve: <strong className="font-mono text-teal-400">৳ {req.reserveBefore.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
                  <span className="text-slate-600">•</span>
                  <span>Reserve After: <strong className="font-mono text-slate-300">৳ {req.reserveAfter.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
                </div>
                {req.estimatedRepaymentDate && !req.loanReason && (
                  <div className="text-[10px] font-mono text-amber-400">
                    Est. Repayment: {req.estimatedRepaymentDate}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
