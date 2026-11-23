import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Printer,
  Copy,
  Check,
  Download,
  FileDown,
  Landmark,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Share2,
  Loader2,
  ShieldCheck,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { BkashLogo, NagadLogo } from '../PaymentBrandLogos';
import {
  normalizeMemoCode,
  computeLedgerChecksum,
  generateDeterministicMatrix,
  formatReceiptTimestamp,
  getReceiptMeta,
  buildReceiptSummaryText,
  downloadReceiptPng,
  downloadReceiptPdf,
  printCleanReceipt
} from '../../utils/receiptGenerator';

export interface OfficialReceiptData {
  id: string;
  memoId?: string;
  type: 'loan' | 'deposit' | 'pay_due' | 'refund' | 'subscription' | 'certificate' | string;
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
  reference?: string;
  mobileOperator?: string;
  isTransfer?: boolean;
  transferType?: 'in' | 'out';
  transferSenderName?: string;
  transferRecipientName?: string;
  subscriptionTier?: string;
  subscriptionMonths?: number;
}

interface OfficialReceiptModalProps {
  receipt: OfficialReceiptData | null;
  onClose: () => void;
  onToast?: (title: string, msg: string, type: 'success' | 'warning' | 'danger' | 'info') => void;
}

export const OfficialReceiptModal: React.FC<OfficialReceiptModalProps> = ({
  receipt,
  onClose,
  onToast
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSlip, setCopiedSlip] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [downloadedPng, setDownloadedPng] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadedPdf, setDownloadedPdf] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);

  // Close cleanly on Escape key & lock background scroll while reading
  useEffect(() => {
    if (!receipt) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [receipt, onClose]);

  const computed = useMemo(() => {
    if (!receipt) return null;
    const cleanMemoId = normalizeMemoCode(receipt.id, receipt.memoId);
    const checksum = computeLedgerChecksum(receipt);
    const matrix = generateDeterministicMatrix(`${cleanMemoId}|${checksum}`, 15);
    const meta = getReceiptMeta(receipt);
    const dateFormatted = formatReceiptTimestamp(receipt);
    return { cleanMemoId, checksum, matrix, meta, dateFormatted };
  }, [receipt]);

  if (!receipt || !computed) return null;

  const { cleanMemoId, checksum, matrix, meta, dateFormatted } = computed;
  const isCertificate = receipt.type === 'certificate';
  const railText = `${receipt.method || ''} ${receipt.mobileOperator || ''}`.toLowerCase();

  const statusToneStyles = {
    confirmed: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    pending: 'text-amber-700 bg-amber-50 border-amber-200',
    hold: 'text-blue-700 bg-blue-50 border-blue-200',
    rejected: 'text-rose-700 bg-rose-50 border-rose-200'
  }[meta.statusTone];

  const handleCopyMemoId = async () => {
    try {
      await navigator.clipboard.writeText(cleanMemoId);
      setCopiedId(true);
      onToast?.('Memo ID Copied', `${cleanMemoId} copied to clipboard.`, 'success');
      setTimeout(() => setCopiedId(false), 2000);
    } catch {}
  };

  const handleCopyOrShareSlip = async () => {
    const summary = buildReceiptSummaryText(receipt);
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSlip(true);
      onToast?.('Receipt Slip Copied', 'Formatted banking confirmation copied to clipboard.', 'success');
      setTimeout(() => setCopiedSlip(false), 2200);
    } catch {}
  };

  const handleDownloadPng = async () => {
    if (downloadingPng) return;
    setDownloadingPng(true);
    try {
      await downloadReceiptPng(receipt);
      setDownloadedPng(true);
      onToast?.('Image Downloaded', `Saved TUT-Receipt-${cleanMemoId}.png`, 'success');
      setTimeout(() => setDownloadedPng(false), 2500);
    } catch (err) {
      console.error('PNG receipt generation failed:', err);
      onToast?.('Export Notice', 'Opening Print dialog fallback.', 'warning');
      printCleanReceipt();
    } finally {
      setDownloadingPng(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await downloadReceiptPdf(receipt);
      setDownloadedPdf(true);
      onToast?.('PDF Downloaded', `Saved TUT-Voucher-${cleanMemoId}.pdf`, 'success');
      setTimeout(() => setDownloadedPdf(false), 2500);
    } catch (err) {
      console.error('PDF receipt generation failed:', err);
      onToast?.('PDF Notice', 'Opening Print / Save PDF dialog fallback.', 'warning');
      printCleanReceipt();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const detailRows: Array<{ label: string; value: React.ReactNode }> = [
    {
      label: 'Account Holder',
      value: <span className="font-semibold text-slate-900">{receipt.userName || 'Verified Charter Member'}</span>
    },
    {
      label: 'Member ID',
      value: (
        <span className="font-mono tabular-nums font-semibold text-slate-900">
          {receipt.memberId || (receipt.userId ? `TUT-${receipt.userId.substring(0, 8).toUpperCase()}` : 'N/A')}
        </span>
      )
    },
    {
      label: 'Transaction Category',
      value: <span className="font-semibold text-slate-900">{meta.categoryLabel}</span>
    },
    {
      label: 'Execution Date',
      value: <span className="font-mono tabular-nums text-slate-700">{dateFormatted}</span>
    }
  ];

  if (!isCertificate) {
    detailRows.push({
      label: 'Payment Rail',
      value: (
        <span className="inline-flex items-center justify-end gap-1.5 font-semibold text-slate-900">
          {railText.includes('bkash') && <BkashLogo size="xs" variant="badge" />}
          {railText.includes('nagad') && <NagadLogo size="xs" variant="badge" />}
          <span>
            {receipt.isTransfer ? 'T.U.T. Internal Transfer' : receipt.method || 'Internal Treasury Disbursal'}
            {receipt.mobileOperator ? ` (${receipt.mobileOperator})` : ''}
          </span>
        </span>
      )
    });
  } else if (receipt.subscriptionTier) {
    detailRows.push({
      label: 'Charter Tier',
      value: <span className="font-bold uppercase text-amber-700">{receipt.subscriptionTier}</span>
    });
  }

  if (receipt.accountNumber) {
    detailRows.push({
      label: 'Wallet / Account No.',
      value: <span className="font-mono tabular-nums font-semibold text-slate-900">{receipt.accountNumber}</span>
    });
  }

  if (receipt.isTransfer && receipt.transferType === 'out' && receipt.transferRecipientName) {
    detailRows.push({
      label: 'Transfer Recipient',
      value: <span className="font-semibold text-slate-900">{receipt.transferRecipientName}</span>
    });
  }

  if (receipt.isTransfer && receipt.transferType === 'in' && receipt.transferSenderName) {
    detailRows.push({
      label: 'Transfer Sender',
      value: <span className="font-semibold text-slate-900">{receipt.transferSenderName}</span>
    });
  }

  if (receipt.transactionId) {
    detailRows.push({
      label: 'External TrxID',
      value: <span className="font-mono tabular-nums font-semibold text-slate-900 break-all">{receipt.transactionId}</span>
    });
  }

  if (receipt.reference) {
    detailRows.push({
      label: 'Reference',
      value: <span className="font-mono text-slate-700 break-all">{receipt.reference}</span>
    });
  }

  if (receipt.type === 'subscription' && receipt.subscriptionTier) {
    detailRows.push({
      label: 'Plan & Term',
      value: (
        <span className="font-semibold text-slate-900 uppercase">
          {receipt.subscriptionTier}
          {receipt.subscriptionMonths ? ` · ${receipt.subscriptionMonths} Mo` : ''}
        </span>
      )
    });
  }

  if (receipt.type === 'loan' && (receipt.estimatedRepaymentDate || receipt.dueDate)) {
    detailRows.push({
      label: 'Scheduled Due Date',
      value: (
        <span className="font-mono tabular-nums font-semibold text-amber-700">
          {receipt.estimatedRepaymentDate || 'Standard Charter Term'}
        </span>
      )
    });
  }

  if (receipt.loanReason) {
    detailRows.push({
      label: 'Stated Purpose',
      value: <span className="text-slate-700 italic">"{receipt.loanReason}"</span>
    });
  }

  detailRows.push({
    label: 'Authorized Officer',
    value: (
      <span className="font-medium text-slate-800">
        {receipt.decidedBy || (meta.statusTone === 'pending' ? 'Awaiting Underwriting Review' : 'Chief Administrator (Tahsin Ullah)')}
      </span>
    )
  });

  const paperMaxWidth = Math.round(740 * (zoomPct / 100));

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col h-[100dvh] w-screen overflow-hidden bg-[#0B111E]"
      role="dialog"
      aria-modal="true"
      aria-label={`${meta.categoryLabel} Document Viewer`}
    >
      {/* Slim Full-Width Reader Toolbar (Hidden on Print) */}
      <header className="no-print shrink-0 min-h-[56px] pt-[env(safe-area-inset-top,0px)] px-3 sm:px-6 bg-[#0B111E] border-b border-white/[0.08] flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-slate-100 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-300 min-w-0">
            <span className="font-semibold text-white truncate">{meta.categoryLabel}</span>
            <span aria-hidden="true" className="hidden sm:inline text-slate-500">·</span>
            <button
              type="button"
              onClick={handleCopyMemoId}
              className="hidden sm:inline-flex font-mono tabular-nums text-slate-300 hover:text-amber-300 items-center gap-1 truncate cursor-pointer transition-colors"
              title="Copy Document Serial"
            >
              <span className="truncate">{cleanMemoId}</span>
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 text-slate-400 shrink-0" />}
            </button>
          </div>
        </div>

        {/* Zoom Stepper (Desktop & Tablet) */}
        <div className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setZoomPct((z) => Math.max(80, z - 10))}
            disabled={zoomPct <= 80}
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 transition-colors cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomPct(100)}
            className="px-2.5 h-8 rounded-md text-xs font-mono tabular-nums font-semibold text-slate-200 hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Reset Zoom to 100%"
          >
            {zoomPct}%
          </button>
          <button
            type="button"
            onClick={() => setZoomPct((z) => Math.min(130, z + 10))}
            disabled={zoomPct >= 130}
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-35 transition-colors cursor-pointer"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Desktop Document Action Bar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyOrShareSlip}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copiedSlip ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-sky-400" />}
            <span>{copiedSlip ? 'Copied' : 'Copy Slip'}</span>
          </button>

          <button
            type="button"
            onClick={printCleanReceipt}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={downloadingPng}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#162340] hover:bg-[#1E3057] border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            {downloadingPng ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : downloadedPng ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>{downloadedPng ? 'Saved PNG' : 'PNG'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            {downloadingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : downloadedPdf ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span>{downloadingPdf ? 'Generating...' : downloadedPdf ? 'Saved PDF' : 'Save PDF'}</span>
          </button>
        </div>

        {/* Mobile Compact Quick-Save PDF */}
        <div className="sm:hidden flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyMemoId}
            className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-[11px] font-mono text-slate-200 inline-flex items-center gap-1 cursor-pointer"
          >
            {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-300" />}
            <span>ID</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            <span>{downloadedPdf ? 'Saved' : 'PDF'}</span>
          </button>
        </div>
      </header>

      {/* Spacious Matte Reading Canvas (Click backdrop outside sheet to close) */}
      <main
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 sm:p-8 lg:p-10 bg-[#161E2E] cursor-pointer"
        onClick={onClose}
      >
        <div
          id="tut-printable-voucher"
          style={{ maxWidth: `${paperMaxWidth}px` }}
          onClick={(e) => e.stopPropagation()}
          className="w-full mx-auto bg-white text-slate-900 rounded-xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65)] border border-slate-200 p-5 sm:p-10 lg:p-12 cursor-default transition-[max-width] duration-200 animate-scaleIn"
        >
          {/* Airy White Institutional Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-slate-900">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#091022] flex items-center justify-center text-amber-300 shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
                  T.U.T. Private Lending Authority
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Zero-Usury Cooperative Charter · Official Ledger Voucher
                </p>
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Document Serial
              </div>
              <button
                type="button"
                onClick={handleCopyMemoId}
                className="font-mono tabular-nums text-xs sm:text-sm font-bold text-slate-900 hover:text-blue-700 inline-flex items-center gap-1.5 mt-0.5 cursor-pointer"
                title="Copy Document Serial"
              >
                <span>{cleanMemoId}</span>
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 no-print" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400 no-print" />
                )}
              </button>
            </div>
          </div>
          <div className="h-0.5 bg-[#D4AF37] w-full mt-1" />

          {/* Open Hero Settlement Row */}
          <div className="py-6 sm:py-8 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {meta.docTitle}
              </div>
              {isCertificate ? (
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {receipt.userName || 'Verified Charter Member'}
                </div>
              ) : (
                <div className="text-3xl sm:text-4xl font-extrabold font-mono tabular-nums text-slate-900 tracking-tight">
                  ৳ {(receipt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              <div className="text-xs font-mono tabular-nums text-slate-500">
                Issued {dateFormatted}
              </div>
            </div>

            <div
              className={`self-start sm:self-end px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide uppercase border inline-flex items-center gap-1.5 shrink-0 ${statusToneStyles}`}
            >
              {meta.statusTone === 'confirmed' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {meta.statusTone === 'pending' && <Clock className="w-3.5 h-3.5" />}
              {(meta.statusTone === 'rejected' || meta.statusTone === 'hold') && (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              <span>{meta.statusLabel}</span>
            </div>
          </div>

          {/* Open Hairline-Separated Particulars Table */}
          <div className="divide-y divide-slate-200">
            {detailRows.map((row) => (
              <div
                key={row.label}
                className="py-3.5 sm:py-4 flex items-baseline justify-between gap-6 text-[13px] sm:text-sm"
              >
                <span className="text-slate-500 font-medium shrink-0">{row.label}</span>
                <div className="text-right min-w-0 break-words">{row.value}</div>
              </div>
            ))}
          </div>

          {/* Underwriting Notes (If Present) */}
          {receipt.adminNotes && (
            <div className="mt-6 p-4 sm:p-5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Underwriting & Ledger Remarks
              </div>
              <p className="text-[13px] sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                {receipt.adminNotes}
              </p>
            </div>
          )}

          {/* Deterministic Verification Matrix & Authorized Signatory Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white border border-slate-200 rounded-lg shrink-0">
                <svg
                  width="68"
                  height="68"
                  viewBox="0 0 15 15"
                  shapeRendering="crispEdges"
                  aria-label="Ledger verification matrix"
                >
                  <rect width="15" height="15" fill="#ffffff" />
                  {matrix.map((row, r) =>
                    row.map((on, c) =>
                      on ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#0F172A" /> : null
                    )
                  )}
                </svg>
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Ledger Checksum Verified</span>
                </div>
                <div className="text-xs sm:text-sm font-mono tabular-nums font-bold text-slate-900">
                  {checksum}
                </div>
                <div className="text-[11px] text-slate-500">
                  0% Interest · Electronically Authenticated Record
                </div>
              </div>
            </div>

            <div className="sm:text-right pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <div className="font-serif italic text-lg font-semibold text-slate-900 leading-none">
                Tahsin Ullah
              </div>
              <div className="w-36 h-px bg-slate-300 sm:ml-auto my-2" />
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                Founder & Chairman · T.U.T.
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center sm:text-left">
            System-issued cooperative financial record. Valid for archive and member reconciliation without wet stamp.
          </div>
        </div>
      </main>

      {/* Comfortable Mobile Thumb Action Dock */}
      <footer className="no-print sm:hidden shrink-0 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-[#0B111E] border-t border-white/[0.08] grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={handleCopyOrShareSlip}
          className="min-h-[44px] px-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[11px] font-semibold text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
        >
          {copiedSlip ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-sky-400" />}
          <span>{copiedSlip ? 'Copied' : 'Slip'}</span>
        </button>

        <button
          type="button"
          onClick={printCleanReceipt}
          className="min-h-[44px] px-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[11px] font-semibold text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-300" />
          <span>Print</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadPng}
          disabled={downloadingPng}
          className="min-h-[44px] px-2 rounded-lg bg-[#162340] hover:bg-[#1E3057] border border-white/15 text-[11px] font-semibold text-white flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60"
        >
          {downloadingPng ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-amber-300" />}
          <span>{downloadedPng ? 'Saved' : 'PNG'}</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          className="min-h-[44px] px-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60"
        >
          {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
          <span>{downloadedPdf ? 'Saved' : 'PDF'}</span>
        </button>
      </footer>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
