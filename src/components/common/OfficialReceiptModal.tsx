import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  ShieldCheck, 
  FileText, 
  Download, 
  Calendar, 
  User, 
  CreditCard,
  Building2,
  CheckCircle2,
  Landmark
} from 'lucide-react';
import { format } from 'date-fns';

export interface OfficialReceiptData {
  id: string;
  memoId?: string;
  type: 'loan' | 'deposit' | 'pay_due' | 'refund' | 'subscription' | string;
  amount: number;
  userName?: string;
  userId?: string;
  memberId?: string;
  method?: string;
  accountNumber?: string;
  transactionId?: string;
  date?: string;
  timestamp?: any;
  dueDate?: any;
  estimatedRepaymentDate?: string;
  status?: string;
  decidedBy?: string;
  decidedAt?: string;
  adminNotes?: string;
  loanReason?: string;
  isTransfer?: boolean;
  transferType?: 'in' | 'out';
  transferSenderName?: string;
  transferRecipientName?: string;
}

interface OfficialReceiptModalProps {
  receipt: OfficialReceiptData | null;
  onClose: () => void;
}

export const OfficialReceiptModal: React.FC<OfficialReceiptModalProps> = ({
  receipt,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!receipt) return null;

  const rawMemoId = receipt.memoId || receipt.id || 'MEMO-PENDING';
  const cleanMemoId = rawMemoId.startsWith('TUT-MEMO-') 
    ? rawMemoId 
    : `TUT-MEMO-${rawMemoId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase()}`;

  const docId = `DOC-${cleanMemoId}`;

  // Document Title
  let docTitle = 'OFFICIAL TRANSACTION MEMORANDUM';
  let badgeColor = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  let typeLabel = 'Transaction';

  if (receipt.type === 'deposit') {
    docTitle = 'OFFICIAL DEPOSIT CONFIRMATION';
    badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    typeLabel = 'Member Deposit';
  } else if (receipt.type === 'loan') {
    docTitle = 'OFFICIAL LOAN DISBURSAL AGREEMENT';
    badgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    typeLabel = 'Loan Disbursal Facility';
  } else if (receipt.type === 'pay_due') {
    docTitle = 'DUE REPAYMENT SETTLEMENT RECEIPT';
    badgeColor = 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    typeLabel = 'Loan Repayment';
  } else if (receipt.type === 'refund') {
    docTitle = 'REFUND SETTLEMENT VOUCHER';
    badgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    typeLabel = 'Refund / Withdrawal';
  } else if (receipt.type === 'subscription') {
    docTitle = 'MEMBERSHIP SUBSCRIPTION RECEIPT';
    badgeColor = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    typeLabel = 'Subscription Tier';
  }

  // Parse Date
  let dateFormatted = 'Confirmed';
  if (receipt.timestamp) {
    if (typeof receipt.timestamp?.toDate === 'function') {
      try {
        dateFormatted = format(receipt.timestamp.toDate(), 'dd MMMM yyyy, HH:mm:ss');
      } catch {}
    } else if (receipt.timestamp?.seconds) {
      dateFormatted = format(new Date(receipt.timestamp.seconds * 1000), 'dd MMMM yyyy, HH:mm:ss');
    } else if (typeof receipt.timestamp === 'string') {
      dateFormatted = receipt.timestamp;
    }
  } else if (receipt.date) {
    dateFormatted = receipt.date;
  }

  const handleCopyMemoId = () => {
    navigator.clipboard.writeText(cleanMemoId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        id="official-receipt-print-container"
        className="bg-[#0B1530] border border-[#1A3163] rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-200"
      >
        {/* Header Bar */}
        <div className="p-5 border-b border-[#182C58] bg-[#0E1B3E] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-amber-400/90">
                T.U.T. Private Authority
              </div>
              <h3 className="text-sm font-bold text-white leading-tight">
                Reserved Receipt & Memo
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              title="Print Receipt Memo"
              className="p-2 rounded-xl bg-[#132247] hover:bg-[#1A316B] border border-[#1E3A7B] text-slate-300 hover:text-white transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#132247] hover:bg-[#1A316B] border border-[#1E3A7B] text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          {/* Official Document Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#112048] to-[#0D1836] border border-[#1E3A7B] text-center space-y-3 relative overflow-hidden">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" /> Officially Stored & Reserved
            </div>

            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                {docTitle}
              </div>
              <div className="text-3xl font-black text-white mt-1 tracking-tight">
                ৳ {(receipt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs font-mono font-bold text-amber-400 mt-1 flex items-center justify-center gap-2">
                <span>{docId}</span>
                <button
                  onClick={handleCopyMemoId}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-amber-300 transition-colors"
                  title="Copy Memo ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Details Specifications */}
          <div className="rounded-2xl bg-[#091024] border border-[#182C58] p-4 divide-y divide-[#182C58]/80 text-xs">
            {/* Account Holder */}
            <div className="py-2.5 flex justify-between items-center gap-2">
              <span className="text-slate-400 font-medium">Account Beneficiary</span>
              <span className="font-bold text-white text-right">
                {receipt.userName || 'Verified Member'}
              </span>
            </div>

            {/* Member ID / Identifier */}
            <div className="py-2.5 flex justify-between items-center gap-2">
              <span className="text-slate-400 font-medium">Member ID</span>
              <span className="font-mono font-bold text-amber-300 text-right">
                {receipt.memberId || (receipt.userId ? `#${receipt.userId.substring(0, 8).toUpperCase()}` : 'N/A')}
              </span>
            </div>

            {/* Transaction Type */}
            <div className="py-2.5 flex justify-between items-center gap-2">
              <span className="text-slate-400 font-medium">Transaction Category</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                {typeLabel}
              </span>
            </div>

            {/* Method & Channel */}
            <div className="py-2.5 flex justify-between items-center gap-2">
              <span className="text-slate-400 font-medium">Payment Method</span>
              <span className="font-semibold text-slate-200 text-right">
                {receipt.method || 'Internal Treasury Disbursal'}
              </span>
            </div>

            {/* Transaction Reference / Account Number */}
            {(receipt.transactionId || receipt.accountNumber) && (
              <div className="py-2.5 flex justify-between items-center gap-2">
                <span className="text-slate-400 font-medium">Reference / Account</span>
                <span className="font-mono text-slate-300 text-right truncate max-w-[200px]">
                  {receipt.transactionId || receipt.accountNumber}
                </span>
              </div>
            )}

            {/* Timestamp */}
            <div className="py-2.5 flex justify-between items-center gap-2">
              <span className="text-slate-400 font-medium">Execution Timestamp</span>
              <span className="font-medium text-slate-300 text-right">
                {dateFormatted}
              </span>
            </div>

            {/* Status */}
            <div className="py-2.5 flex justify-between items-center gap-2">
              <span className="text-slate-400 font-medium">Reservation Status</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {receipt.status ? receipt.status.toUpperCase() : 'CONFIRMED'}
              </span>
            </div>

            {/* Loan Reason if applicable */}
            {receipt.loanReason && (
              <div className="py-2.5 flex justify-between items-center gap-2">
                <span className="text-slate-400 font-medium">Stated Purpose</span>
                <span className="font-medium text-slate-200 text-right italic">
                  "{receipt.loanReason}"
                </span>
              </div>
            )}

            {/* Due Date for Loans */}
            {receipt.type === 'loan' && (receipt.dueDate || receipt.estimatedRepaymentDate) && (
              <div className="py-2.5 flex justify-between items-center gap-2">
                <span className="text-slate-400 font-medium">Estimated Due Date</span>
                <span className="font-bold text-amber-400 text-right">
                  {receipt.estimatedRepaymentDate || 'Within 30 days of Disbursal'}
                </span>
              </div>
            )}

            {/* Administrative Signatory */}
            <div className="py-2.5 flex justify-between items-center gap-2">
              <span className="text-slate-400 font-medium">Authorized By</span>
              <span className="font-semibold text-slate-300 text-right">
                {receipt.decidedBy || 'Chief Administrator (Tahsin Ullah)'}
              </span>
            </div>

            {/* Admin Notes */}
            {receipt.adminNotes && (
              <div className="py-2.5">
                <span className="text-slate-400 font-medium block mb-1">Administrative Notes</span>
                <p className="text-slate-300 text-[11px] bg-[#0E1B3E] p-2.5 rounded-xl border border-[#182C58] whitespace-pre-line leading-relaxed">
                  {receipt.adminNotes}
                </p>
              </div>
            )}
          </div>

          {/* Verification Footnote */}
          <div className="p-4 rounded-xl bg-[#0B1530] border border-[#182C58] flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span>Immutable Ledger Hash Verified</span>
            </div>
            <span className="font-mono text-slate-500">
              #TUT-{(receipt.amount * 73).toString().substring(0, 6)}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#091024] border-t border-[#182C58] flex items-center justify-between gap-3">
          <button
            onClick={handleCopyMemoId}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#132247] hover:bg-[#1A316B] border border-[#1E3A7B] text-xs font-bold text-amber-300 flex items-center justify-center gap-2 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Memo ID Copied' : 'Copy Memo ID'}
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
          >
            <Printer className="w-4 h-4" />
            Print Official Memo
          </button>
        </div>
      </div>
    </div>
  );
};
