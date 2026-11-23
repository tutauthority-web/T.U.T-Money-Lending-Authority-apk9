import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
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
  Plus,
  CreditCard,
  Hash,
  Bookmark,
  Calendar,
  Info,
  Clock,
  Tag,
  Copy,
  Check,
  ShieldCheck,
  TrendingUp,
  Award,
  MapPin,
  Briefcase,
  UserCheck,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';
import { UnifiedRequestItem } from './types';
import { BkashLogo, NagadLogo } from '../PaymentBrandLogos';

interface AdminRequestsViewProps {
  requests: UnifiedRequestItem[];
  selectedRequest: UnifiedRequestItem | null;
  onSelectRequest: (req: UnifiedRequestItem | null) => void;
  onExecuteAction: (action: 'approve' | 'reject' | 'hold' | 'info', request: UnifiedRequestItem, reason?: string) => Promise<void>;
  onAddNote: (req: UnifiedRequestItem, note: string) => Promise<void>;
  onViewDoc: (url: string, title: string) => void;
  onViewMember?: (memberUid: string) => void;
}

const QUICK_REASONS: Record<'approve' | 'reject' | 'hold' | 'info', string[]> = {
  approve: [
    'TrxID verified against official merchant ledger.',
    'All KYC documents and borrowing capacity confirmed.',
    'Approved under standard Zero-Usury Charter guidelines.'
  ],
  reject: [
    'TrxID not found or mismatched in bKash/Nagad statement.',
    'Requested amount exceeds available borrowing limit.',
    'Active unpaid loan debt must be settled prior to disbursal.',
    'Incomplete or unclear KYC / payment proof image.'
  ],
  hold: [
    'Queued for secondary reconciliation check.',
    'Awaiting liquidity pool top-up before disbursal.',
    'Flagged for senior administrator verification.'
  ],
  info: [
    'Please re-upload a clear screenshot showing TrxID and sender number.',
    'Confirm your registered bKash/Nagad wallet number.',
    'Provide valid NID front/back photo for KYC verification.'
  ]
};

function renderChannelLogo(method?: string, operator?: string) {
  const m = `${method || ''} ${operator || ''}`.toLowerCase();
  if (m.includes('bkash')) return <BkashLogo size="xs" variant="badge" />;
  if (m.includes('nagad')) return <NagadLogo size="xs" variant="badge" />;
  return null;
}

export const AdminRequestsView: React.FC<AdminRequestsViewProps> = ({
  requests,
  selectedRequest,
  onSelectRequest,
  onExecuteAction,
  onAddNote,
  onViewDoc,
  onViewMember
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'loan' | 'deposit' | 'pay_due' | 'subscription' | 'registration' | 'refund'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | 'hold' | 'info';
  }>({
    isOpen: false,
    action: 'approve'
  });

  const handleCopy = (val: string, key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!val || val === 'N/A') return;
    navigator.clipboard.writeText(val).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 1800);
  };

  // Status counts
  const pendingCount = useMemo(
    () => requests.filter(r => ['pending', 'hold', 'info_requested'].includes(r.status?.toLowerCase())).length,
    [requests]
  );
  const approvedCount = useMemo(
    () => requests.filter(r => ['approved', 'confirmed'].includes(r.status?.toLowerCase())).length,
    [requests]
  );
  const rejectedCount = useMemo(
    () => requests.filter(r => r.status?.toLowerCase() === 'rejected').length,
    [requests]
  );

  // Filter requests based on status tab, category chip, and search
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const status = r.status?.toLowerCase();
      if (activeTab === 'pending') {
        if (status !== 'pending' && status !== 'hold' && status !== 'info_requested') return false;
      } else if (activeTab === 'approved') {
        if (status !== 'approved' && status !== 'confirmed') return false;
      } else if (activeTab === 'rejected') {
        if (status !== 'rejected') return false;
      }

      if (categoryFilter !== 'all') {
        if (categoryFilter === 'registration') {
          if (!['registration', 'wallet_verification', 'profile_verification'].includes(r.requestType)) return false;
        } else if (r.requestType !== categoryFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.memberName?.toLowerCase().includes(q) ||
          r.memberId?.toLowerCase().includes(q) ||
          r.memberPhone?.toLowerCase().includes(q) ||
          r.id?.toLowerCase().includes(q) ||
          r.transactionRefId?.toLowerCase().includes(q) ||
          r.memoId?.toLowerCase().includes(q) ||
          r.accountNumber?.toLowerCase().includes(q) ||
          r.paymentMethod?.toLowerCase().includes(q) ||
          r.loanReason?.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [requests, activeTab, categoryFilter, searchQuery]);

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
  // DETAIL VIEW (Institutional 2-Column Underwriting View)
  // -------------------------------------------------------------
  if (selectedRequest) {
    const isFinalized = ['confirmed', 'approved', 'rejected'].includes((selectedRequest.status || '').toLowerCase());
    const isRegistration = selectedRequest.source === 'user';
    const isSubscription = selectedRequest.requestType === 'subscription';
    const shortage = selectedRequest.requestType === 'loan'
      ? Math.max(0, (selectedRequest.requestedAmount || 0) - selectedRequest.reserveBefore)
      : 0;

    const scorePercent = Math.min(100, Math.max(0, Math.round(((selectedRequest.creditScore - 300) / 550) * 100)));
    const utilPercent = selectedRequest.currentBorrowLimit > 0
      ? Math.min(100, Math.round((selectedRequest.existingOutstandingLoan / selectedRequest.currentBorrowLimit) * 100))
      : 0;

    const statusColor =
      selectedRequest.status === 'confirmed' || selectedRequest.status === 'approved'
        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
        : selectedRequest.status === 'rejected'
        ? 'text-rose-400 bg-rose-500/10 border-rose-500/25'
        : selectedRequest.status === 'hold'
        ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
        : selectedRequest.status === 'info_requested'
        ? 'text-sky-300 bg-sky-500/15 border-sky-500/30'
        : 'text-amber-400 bg-amber-500/10 border-amber-500/25';

    return (
      <div className="space-y-4 w-full max-w-7xl mx-auto animate-fadeIn pb-10">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => onSelectRequest(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>Back to Requests Queue</span>
          </button>

          {onViewMember && selectedRequest.memberUid && (
            <button
              type="button"
              onClick={() => onViewMember(selectedRequest.memberUid)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Open Member Dossier →</span>
            </button>
          )}
        </div>

        {/* 2-Column Institutional Underwriting Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT MAIN COLUMN (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* 1. Request Identity & Header Card */}
            <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 text-lg font-bold shrink-0 overflow-hidden">
                    {selectedRequest.memberPhoto ? (
                      <img src={selectedRequest.memberPhoto} alt={selectedRequest.memberName} className="w-full h-full object-cover" />
                    ) : (
                      selectedRequest.memberName.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-white truncate">{selectedRequest.memberName}</h2>
                      <span className="font-mono text-xs font-semibold text-amber-400">#{selectedRequest.memberId}</span>
                      {selectedRequest.memberTier && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          • {selectedRequest.memberTier} tier
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span className="font-mono">{selectedRequest.memberPhone}</span>
                      </span>
                      {selectedRequest.memberEmail && selectedRequest.memberEmail !== 'N/A' && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{selectedRequest.memberEmail}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>
                    {selectedRequest.status.replace('_', ' ')}
                  </span>
                  <span className="text-[10.5px] font-mono text-slate-500">
                    {selectedRequest.submittedAtStr}
                  </span>
                </div>
              </div>

              {/* Specifications Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3 h-3 text-sky-400" />
                    <span>Classification</span>
                  </div>
                  <div className="text-sm font-bold text-white mt-1">{selectedRequest.requestTypeLabel}</div>
                  {isSubscription && (
                    <div className="text-[11px] font-semibold text-amber-300 mt-0.5 capitalize">
                      {(selectedRequest.subscriptionTier || 'bronze').toUpperCase()} Charter • {selectedRequest.subscriptionMonths || 1} mo
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-amber-400" />
                    <span>{isRegistration ? 'Application Scope' : 'Requested Amount'}</span>
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-amber-400 mt-0.5">
                    {isRegistration
                      ? 'KYC Onboarding'
                      : `৳ ${selectedRequest.requestedAmount.toLocaleString()}`}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-emerald-400" />
                    <span>Channel & Wallet</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {renderChannelLogo(selectedRequest.paymentMethod, selectedRequest.mobileOperator)}
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">
                        {selectedRequest.paymentMethod || 'Direct Portal'}
                        {selectedRequest.mobileOperator && (
                          <span className="text-slate-400 font-normal ml-1">({selectedRequest.mobileOperator})</span>
                        )}
                      </div>
                      {selectedRequest.accountNumber && (
                        <button
                          type="button"
                          onClick={(e) => handleCopy(selectedRequest.accountNumber!, 'ac', e)}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 cursor-pointer"
                          title="Copy account number"
                        >
                          <span>{selectedRequest.accountNumber}</span>
                          {copiedKey === 'ac' ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5 opacity-70" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* IDs, Reference & Repayment Date Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3 border-t border-white/[0.06] text-xs">
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Hash className="w-3 h-3 text-blue-400" />
                    <span>Transaction / TrxID</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(selectedRequest.transactionRefId || selectedRequest.id, 'trx', e)}
                    className="mt-1 inline-flex items-center gap-1.5 font-mono font-bold text-amber-300 hover:text-amber-200 max-w-full cursor-pointer"
                    title="Copy Transaction ID"
                  >
                    <span className="truncate">{selectedRequest.transactionRefId || selectedRequest.id || 'N/A'}</span>
                    {copiedKey === 'trx' ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 opacity-70 shrink-0" />}
                  </button>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Bookmark className="w-3 h-3 text-indigo-400" />
                    <span>Memo / Reference</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(selectedRequest.reference || selectedRequest.memoId || '', 'ref', e)}
                    className="mt-1 inline-flex items-center gap-1.5 font-mono font-medium text-slate-200 hover:text-white max-w-full cursor-pointer"
                    title="Copy Reference"
                  >
                    <span className="truncate">{selectedRequest.reference || selectedRequest.memoId || 'TUT-REF'}</span>
                    {copiedKey === 'ref' ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 opacity-60 shrink-0" />}
                  </button>
                  {selectedRequest.memoId && selectedRequest.memoId !== selectedRequest.reference && (
                    <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                      Memo: {selectedRequest.memoId}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-400" />
                    <span>{selectedRequest.requestType === 'loan' ? 'Repayment Window' : 'Processed / Target'}</span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-200">
                    {selectedRequest.estimatedRepaymentDate
                      ? selectedRequest.estimatedRepaymentDate
                      : selectedRequest.maxRepaymentDays
                      ? `Up to ${selectedRequest.maxRepaymentDays} days`
                      : 'Standard Cycle'}
                  </div>
                </div>
              </div>

              {/* Stated Reason / Purpose Callout */}
              {(selectedRequest.loanReason || selectedRequest.requestType === 'loan') && (
                <div className="pt-3 border-t border-white/[0.06]">
                  <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>Stated Purpose / Loan Justification</span>
                  </div>
                  <p className="text-xs text-slate-100 mt-1.5 leading-relaxed font-medium">
                    {selectedRequest.loanReason ? `"${selectedRequest.loanReason}"` : 'Standard Zero-Usury Financial Assistance'}
                  </p>
                </div>
              )}
            </div>

            {/* 2. KYC & Member Identity Verification Card */}
            <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  <span>Identity & KYC Particulars</span>
                </h3>
                <span className="text-[10.5px] font-mono text-slate-400">
                  Member Status: <strong className="text-slate-200 capitalize">{selectedRequest.memberStatus}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">National ID (NID)</span>
                  <span className="font-mono font-semibold text-slate-200 mt-0.5 block">{selectedRequest.memberNid || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Occupation</span>
                  <span className="font-medium text-slate-200 mt-0.5 block">{selectedRequest.memberOccupation || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Emergency / Reference</span>
                  <span className="font-mono text-slate-200 mt-0.5 block">
                    {selectedRequest.memberEmergencyContact || selectedRequest.reference || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Father's Name</span>
                  <span className="font-medium text-slate-300 mt-0.5 block">{selectedRequest.memberFatherName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Mother's Name</span>
                  <span className="font-medium text-slate-300 mt-0.5 block">{selectedRequest.memberMotherName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Nominee</span>
                  <span className="font-medium text-slate-300 mt-0.5 block">
                    {selectedRequest.memberNomineeName
                      ? `${selectedRequest.memberNomineeName}${selectedRequest.memberNomineeRelation ? ` (${selectedRequest.memberNomineeRelation})` : ''}`
                      : 'N/A'}
                  </span>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Present & Permanent Address</span>
                  <span className="font-medium text-slate-300 mt-0.5 block">
                    {selectedRequest.memberAddress || 'N/A'}
                    {selectedRequest.memberPermanentAddress && selectedRequest.memberPermanentAddress !== selectedRequest.memberAddress
                      ? ` • Permanent: ${selectedRequest.memberPermanentAddress}`
                      : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Attached Visual Proof & KYC Documents */}
            <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <span>Submitted Proofs & KYC Documents</span>
                </h3>
                <span className="text-[10.5px] font-mono text-slate-400">
                  {selectedRequest.attachedDocs?.length || 0} file{(selectedRequest.attachedDocs?.length || 0) !== 1 ? 's' : ''}
                </span>
              </div>

              {selectedRequest.attachedDocs && selectedRequest.attachedDocs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedRequest.attachedDocs.map((doc, idx) => (
                    <div
                      key={idx}
                      onClick={() => onViewDoc(doc.url, doc.name)}
                      className="rounded-xl bg-[#070D19] border border-white/[0.08] hover:border-amber-500/40 overflow-hidden cursor-pointer group transition-colors"
                    >
                      <div className="h-32 bg-black/50 relative overflow-hidden flex items-center justify-center">
                        <img
                          src={doc.url}
                          alt={doc.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-2.5">
                          <div>
                            <div className="text-xs font-semibold text-white">{doc.name}</div>
                            <div className="text-[9.5px] uppercase tracking-wider text-slate-300">{doc.category}</div>
                          </div>
                          <span className="px-2 py-1 rounded bg-slate-900/90 text-amber-300 text-[10px] font-semibold flex items-center gap-1 border border-white/10">
                            <ExternalLink className="w-3 h-3" /> Enlarge
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-xs text-slate-500">
                  No receipt image or KYC scan attached to this record. Verify via TrxID / mobile number above.
                </div>
              )}
            </div>

            {/* 4. Internal Audit Notes */}
            <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 sm:p-5 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2.5 border-b border-white/[0.06]">
                Administrative Audit Notes
              </h3>

              {selectedRequest.adminNotes ? (
                <div className="p-3 rounded-lg bg-[#070D19] border border-white/[0.06] text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                  {selectedRequest.adminNotes}
                </div>
              ) : (
                <div className="text-xs text-slate-500">No internal officer notes recorded yet.</div>
              )}

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={internalNoteText}
                  onChange={(e) => setInternalNoteText(e.target.value)}
                  placeholder="Append internal verification note..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[#070D19] border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!internalNoteText.trim()) return;
                    await onAddNote(selectedRequest, internalNoteText.trim());
                    setInternalNoteText('');
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#132247] hover:bg-[#1A316B] text-amber-300 border border-[#1E3A7B] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Note
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT STICKY UNDERWRITING & DECISION RAIL (4 cols) */}
          <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
            {/* 1. Credit Score & Risk Assessment Card */}
            <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <span>Credit Underwriting</span>
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  selectedRequest.riskLevel === 'High'
                    ? 'text-rose-400'
                    : selectedRequest.riskLevel === 'Medium'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {selectedRequest.riskLevel} Risk
                </span>
              </div>

              {/* Credit Score Meter */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">Credit Score</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold font-mono tabular-nums text-white">{selectedRequest.creditScore}</span>
                    <span className="text-[11px] font-semibold text-teal-400">/ 850 ({selectedRequest.creditScoreLabel})</span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-[#070D19] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      selectedRequest.creditScore >= 700
                        ? 'bg-emerald-400'
                        : selectedRequest.creditScore >= 580
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
              </div>

              {/* Automated Risk Reason */}
              <div className={`p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-start gap-2 ${
                selectedRequest.riskLevel === 'High'
                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-200'
                  : selectedRequest.riskLevel === 'Medium'
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
              }`}>
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{selectedRequest.riskReason}</span>
              </div>

              {/* Financial Standing Breakdown */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/[0.06] text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Borrow Limit</span>
                  <span className="font-mono font-bold tabular-nums text-white mt-0.5 block">
                    ৳ {selectedRequest.currentBorrowLimit.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Active Debt ({utilPercent}%)</span>
                  <span className={`font-mono font-bold tabular-nums mt-0.5 block ${
                    selectedRequest.existingOutstandingLoan > 0 ? 'text-rose-400' : 'text-slate-300'
                  }`}>
                    ৳ {selectedRequest.existingOutstandingLoan.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Vault Deposits</span>
                  <span className="font-mono font-bold tabular-nums text-emerald-400 mt-0.5 block">
                    ৳ {selectedRequest.totalDeposits.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total Repaid</span>
                  <span className="font-mono font-bold tabular-nums text-teal-400 mt-0.5 block">
                    ৳ {selectedRequest.totalRepayments.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-white/[0.06] flex items-center justify-between">
                <span>Subscription Loyalty Streak</span>
                <span className="font-mono font-semibold text-amber-300">{selectedRequest.continuousSubscriptionMonths} mo</span>
              </div>
            </div>

            {/* 2. Reserve Liquidity Impact Card */}
            <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-white/[0.06] flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-teal-400" />
                <span>Reserve Liquidity Impact</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Available Reserve Before</span>
                  <span className="font-mono font-bold tabular-nums text-teal-400">
                    ৳ {selectedRequest.reserveBefore.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Projected After Approval</span>
                  <span className="font-mono font-bold tabular-nums text-white">
                    ৳ {selectedRequest.reserveAfter.toLocaleString()}
                  </span>
                </div>
                {shortage > 0 && (
                  <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-semibold flex items-center justify-between">
                    <span>Pool Shortage Warning</span>
                    <span className="font-mono">-৳ {shortage.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Authorization Decision Desk */}
            <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-white/[0.06]">
                {isFinalized ? 'Audited Decision Record' : 'Authorization Decision Desk'}
              </div>

              {isFinalized ? (
                <div className="space-y-2 text-xs">
                  <div className={`p-3 rounded-lg border flex items-center gap-2.5 ${statusColor}`}>
                    {selectedRequest.status === 'rejected' ? (
                      <XCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold uppercase tracking-wider text-[11px]">
                        Request {selectedRequest.status}
                      </div>
                      <div className="text-[11px] opacity-90 mt-0.5">
                        Decided by: <span className="font-mono">{selectedRequest.decidedBy || 'Administrator'}</span>
                      </div>
                      {selectedRequest.decidedAt && (
                        <div className="text-[10px] font-mono opacity-75 mt-0.5">
                          {new Date(selectedRequest.decidedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleActionClick('approve')}
                    className="col-span-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve & Commit Ledger
                  </button>

                  <button
                    type="button"
                    onClick={() => handleActionClick('hold')}
                    className="py-2 px-3 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PauseCircle className="w-3.5 h-3.5" /> Hold
                  </button>

                  <button
                    type="button"
                    onClick={() => handleActionClick('info')}
                    className="py-2 px-3 rounded-lg bg-[#132247] hover:bg-[#1A316B] border border-[#1E3A7B] text-sky-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> Request Info
                  </button>

                  <button
                    type="button"
                    onClick={() => handleActionClick('reject')}
                    className="col-span-2 py-2 px-3 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Decline Request
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Modal with Quick-Reason Templates */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0B1326] border border-white/15 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scaleUp">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
                <h3 className="text-sm font-bold text-white capitalize">
                  Confirm {confirmModal.action === 'info' ? 'Information Request' : confirmModal.action}
                </h3>
                <span className="font-mono text-xs text-amber-400">
                  {selectedRequest.requestedAmount > 0 ? `৳${selectedRequest.requestedAmount.toLocaleString()}` : `#${selectedRequest.memberId}`}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Executing <span className="font-bold text-amber-300 uppercase">{confirmModal.action}</span> on{' '}
                <strong className="text-white">{selectedRequest.requestTypeLabel}</strong> for{' '}
                <strong className="text-white">{selectedRequest.memberName}</strong>.
              </p>

              {/* Quick Reason Templates */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Quick Officer Templates
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REASONS[confirmModal.action].map((tpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActionReason(tpl)}
                      className="text-left px-2.5 py-1 rounded-md bg-[#070D19] hover:bg-[#132247] border border-white/10 text-[11px] text-slate-300 hover:text-amber-200 transition-colors cursor-pointer"
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Administrative Reason / Memo
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Enter reason or verification memo..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[#070D19] border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: false, action: 'approve' })}
                  disabled={isProcessing}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmActionExecution}
                  disabled={isProcessing}
                  className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer ${
                    confirmModal.action === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : confirmModal.action === 'reject'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  {isProcessing ? 'Processing...' : 'Confirm Decision'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // LIST VIEW (Clean Banking Queue Cards)
  // -------------------------------------------------------------
  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Status Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1326] border border-white/[0.08] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-[#132247] text-amber-300 border border-amber-500/35'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'approved'
                ? 'bg-[#132247] text-emerald-400 border border-emerald-500/35'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rejected')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'rejected'
                ? 'bg-[#132247] text-rose-400 border border-rose-500/35'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        <div className="relative sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, #ID, TrxID, A/C, memo..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#0B1326] border border-white/[0.08] text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>
      </div>

      {/* Category Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'All Requests' },
          { id: 'loan', label: 'Loans' },
          { id: 'deposit', label: 'Deposits' },
          { id: 'pay_due', label: 'Repayments' },
          { id: 'subscription', label: 'Subscriptions' },
          { id: 'registration', label: 'KYC & Registration' },
          { id: 'refund', label: 'Withdrawals' }
        ].map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryFilter(cat.id as any)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
              categoryFilter === cat.id
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-[#0B1326] border-white/[0.06] text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Queue List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-10 text-center text-slate-400 text-xs">
            No {activeTab} requests matching the selected category or search query.
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isReg = req.source === 'user';
            const isSub = req.requestType === 'subscription';
            const statusDot =
              req.status === 'confirmed' || req.status === 'approved'
                ? 'bg-emerald-400'
                : req.status === 'rejected'
                ? 'bg-rose-400'
                : req.status === 'info_requested'
                ? 'bg-sky-400'
                : 'bg-amber-400';

            return (
              <div
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className="bg-[#0B1326] border border-white/[0.08] hover:border-amber-500/45 rounded-xl p-4 transition-colors cursor-pointer group space-y-3"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-white/[0.06]">
                  <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-200">
                      <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                      {req.status.replace('_', ' ')}
                    </span>

                    <span className="text-slate-600">•</span>

                    <span className="text-xs font-bold text-sky-300">{req.requestTypeLabel}</span>

                    {req.riskLevel !== 'Low' && !isReg && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          req.riskLevel === 'High' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {req.riskLevel} Risk
                        </span>
                      </>
                    )}

                    <span className="text-slate-600 hidden sm:inline">•</span>

                    <div className="flex items-center gap-1.5 text-xs min-w-0">
                      <span className="font-mono text-amber-400 font-semibold">#{req.memberId}</span>
                      <span className="font-semibold text-white truncate">{req.memberName}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-slate-500">{req.submittedAtStr}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRequest(req);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 group-hover:bg-amber-400 group-hover:text-slate-950 border border-amber-500/25 transition-colors cursor-pointer"
                    >
                      Inspect Details →
                    </button>
                  </div>
                </div>

                {/* Specifications Row (Clean Flat Grid — Zero Nested Double-Cards) */}
                {isReg ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">National ID</span>
                      <span className="font-mono font-semibold text-white mt-0.5 block truncate">{req.memberNid || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Occupation</span>
                      <span className="font-medium text-slate-200 mt-0.5 block truncate">{req.memberOccupation || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Contact</span>
                      <span className="font-mono text-emerald-400 mt-0.5 block truncate">{req.memberPhone}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">KYC Files</span>
                      <span className="font-mono font-semibold text-amber-300 mt-0.5 block">
                        {req.attachedDocs.length} attached
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                        {isSub ? 'Charter & Fee' : 'Amount'}
                      </span>
                      <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-amber-400 mt-0.5">
                        ৳ {req.requestedAmount.toLocaleString()}
                      </div>
                      {isSub && (
                        <div className="text-[10.5px] font-semibold text-sky-300 capitalize">
                          {(req.subscriptionTier || 'bronze').toUpperCase()} • {req.subscriptionMonths || 1} mo
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Channel & Wallet</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {renderChannelLogo(req.paymentMethod, req.mobileOperator)}
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">{req.paymentMethod || 'Direct Portal'}</div>
                          {req.accountNumber && (
                            <div className="text-[10.5px] font-mono text-emerald-400 truncate">{req.accountNumber}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Transaction / TrxID</span>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(req.transactionRefId || req.id, `list-trx-${req.id}`, e)}
                        className="mt-0.5 inline-flex items-center gap-1 font-mono font-bold text-slate-200 hover:text-amber-300 max-w-full cursor-pointer"
                        title="Click to copy TrxID"
                      >
                        <span className="truncate">{req.transactionRefId || req.id}</span>
                        {copiedKey === `list-trx-${req.id}` ? (
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-50 shrink-0" />
                        )}
                      </button>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Credit & Debt Context</span>
                      <div className="font-mono text-slate-200 mt-0.5">
                        Score: <strong className="text-teal-400">{req.creditScore}</strong>
                      </div>
                      <div className="text-[10.5px] font-mono text-slate-400">
                        Debt: <span className={req.existingOutstandingLoan > 0 ? 'text-rose-400 font-semibold' : ''}>৳{req.existingOutstandingLoan.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stated Reason Strip */}
                {req.loanReason && !isReg && (
                  <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                      <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate italic">"{req.loanReason}"</span>
                    </div>
                    {req.estimatedRepaymentDate && (
                      <span className="text-[10.5px] font-mono text-amber-300 shrink-0">
                        Due: {req.estimatedRepaymentDate}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
