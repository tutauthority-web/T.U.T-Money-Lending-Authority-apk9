import { format } from 'date-fns';
import type { OfficialReceiptData } from '../components/common/OfficialReceiptModal';

export function normalizeMemoCode(rawId?: string, memoId?: string): string {
  const source = (memoId || rawId || 'MEMO-PENDING').trim();
  if (source.startsWith('TUT-MEMO-') || source.startsWith('CERT-') || source.startsWith('STMT-')) {
    return source.toUpperCase();
  }
  const clean = source.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
  return `TUT-MEMO-${clean || 'RECORD'}`;
}

export function computeLedgerChecksum(receipt: OfficialReceiptData): string {
  const seed = [
    normalizeMemoCode(receipt.id, receipt.memoId),
    receipt.id || '0',
    Number(receipt.amount || 0).toFixed(2),
    receipt.type || 'tx',
    receipt.userId || receipt.memberId || 'member',
    (receipt.status || 'confirmed').toLowerCase()
  ].join('|');

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
  return `TUT-${part1}-${part2}`;
}

/**
 * Generates a deterministic square matrix with corner finder anchors for visual receipt verification.
 */
export function generateDeterministicMatrix(seed: string, size = 15): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const border = r === 0 || r === 4 || c === 0 || c === 4;
        const center = r === 2 && c === 2;
        if (r0 + r < size && c0 + c < size) {
          grid[r0 + r][c0 + c] = border || center;
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 5);
  drawFinder(size - 5, 0);

  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 6 && c < 6;
      const inTopRight = r < 6 && c >= size - 6;
      const inBottomLeft = r >= size - 6 && c < 6;
      if (inTopLeft || inTopRight || inBottomLeft) continue;

      state ^= (r * 31 + c * 17 + 13);
      state = Math.imul(state, 1664525) + 1013904223;
      grid[r][c] = ((state >>> 28) & 1) === 1;
    }
  }

  return grid;
}

export function formatReceiptTimestamp(receipt: OfficialReceiptData): string {
  try {
    if (receipt.timestamp) {
      if (typeof receipt.timestamp?.toDate === 'function') {
        return format(receipt.timestamp.toDate(), 'dd MMM yyyy, hh:mm a');
      }
      if (typeof receipt.timestamp?.seconds === 'number') {
        return format(new Date(receipt.timestamp.seconds * 1000), 'dd MMM yyyy, hh:mm a');
      }
      if (receipt.timestamp instanceof Date && !isNaN(receipt.timestamp.getTime())) {
        return format(receipt.timestamp, 'dd MMM yyyy, hh:mm a');
      }
      if (typeof receipt.timestamp === 'string') {
        const parsed = new Date(receipt.timestamp);
        return isNaN(parsed.getTime()) ? receipt.timestamp : format(parsed, 'dd MMM yyyy, hh:mm a');
      }
    }
    if (receipt.date) {
      const parsed = new Date(receipt.date);
      return isNaN(parsed.getTime()) ? receipt.date : format(parsed, 'dd MMM yyyy, hh:mm a');
    }
  } catch {}
  return format(new Date(), 'dd MMM yyyy, hh:mm a');
}

export interface ReceiptClassification {
  docTitle: string;
  categoryLabel: string;
  statusLabel: string;
  statusTone: 'confirmed' | 'pending' | 'rejected' | 'hold';
}

export function getReceiptMeta(receipt: OfficialReceiptData): ReceiptClassification {
  let docTitle = 'OFFICIAL TRANSACTION VOUCHER';
  let categoryLabel = 'Ledger Transaction';

  if (receipt.isTransfer) {
    docTitle = receipt.transferType === 'out' ? 'INTERNAL OUTBOUND TRANSFER ADVICE' : 'INTERNAL INBOUND CREDIT ADVICE';
    categoryLabel = receipt.transferType === 'out' ? 'Peer Transfer Out' : 'Peer Transfer In';
  } else if (receipt.type === 'deposit') {
    docTitle = 'OFFICIAL VAULT DEPOSIT RECEIPT';
    categoryLabel = 'Member Deposit';
  } else if (receipt.type === 'loan') {
    docTitle = 'OFFICIAL LOAN DISBURSAL VOUCHER';
    categoryLabel = '0% Usury Loan Disbursal';
  } else if (receipt.type === 'pay_due') {
    docTitle = 'LOAN REPAYMENT SETTLEMENT RECEIPT';
    categoryLabel = 'Debt Repayment';
  } else if (receipt.type === 'refund') {
    docTitle = 'WITHDRAWAL & REFUND SETTLEMENT ADVICE';
    categoryLabel = 'Vault Withdrawal';
  } else if (receipt.type === 'subscription') {
    docTitle = 'MEMBERSHIP TIER SUBSCRIPTION RECEIPT';
    categoryLabel = 'Charter Tier Renewal';
  } else if (receipt.type === 'merchant_payment' || receipt.type === 'card_payment' || receipt.type === 'wallet_payment') {
    docTitle = 'AUTHORIZED MERCHANT PAYMENT RECEIPT';
    categoryLabel = (receipt as any).merchantName ? `Merchant: ${(receipt as any).merchantName}` : 'External App Payment';
  } else if (receipt.type === 'certificate') {
    docTitle = 'OFFICIAL CERTIFICATE OF MEMBERSHIP';
    categoryLabel = 'Member Charter Credential';
  }

  const rawStatus = (receipt.status || 'confirmed').toLowerCase();
  let statusLabel = 'CONFIRMED';
  let statusTone: ReceiptClassification['statusTone'] = 'confirmed';

  if (rawStatus === 'pending') {
    statusLabel = 'PENDING REVIEW';
    statusTone = 'pending';
  } else if (rawStatus === 'rejected') {
    statusLabel = 'DECLINED';
    statusTone = 'rejected';
  } else if (rawStatus === 'hold' || rawStatus === 'info_requested') {
    statusLabel = rawStatus === 'hold' ? 'ON HOLD' : 'INFO REQUESTED';
    statusTone = 'hold';
  } else if (rawStatus === 'settled' || rawStatus === 'paid') {
    statusLabel = 'SETTLED';
    statusTone = 'confirmed';
  } else if (rawStatus === 'approved' || rawStatus === 'confirmed') {
    statusLabel = 'CONFIRMED';
    statusTone = 'confirmed';
  } else {
    statusLabel = rawStatus.toUpperCase();
  }

  return { docTitle, categoryLabel, statusLabel, statusTone };
}

export function buildReceiptSummaryText(receipt: OfficialReceiptData): string {
  const memoCode = normalizeMemoCode(receipt.id, receipt.memoId);
  const checksum = computeLedgerChecksum(receipt);
  const { docTitle, categoryLabel, statusLabel } = getReceiptMeta(receipt);
  const dateStr = formatReceiptTimestamp(receipt);
  const amtStr = `৳${(receipt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT`;

  const lines = [
    'T.U.T. PRIVATE LENDING AUTHORITY',
    docTitle,
    '----------------------------------------',
    `Document ID : ${memoCode}`,
    `Status      : ${statusLabel}`,
    `Category    : ${categoryLabel}`,
    ...(receipt.type !== 'certificate' ? [`Amount      : ${amtStr}`] : []),
    `Beneficiary : ${receipt.userName || 'Verified Member'} (${receipt.memberId || receipt.userId || 'N/A'})`,
    `Channel     : ${receipt.method || 'Internal Treasury'}${receipt.mobileOperator ? ` (${receipt.mobileOperator})` : ''}`,
    ...(receipt.accountNumber ? [`Account No. : ${receipt.accountNumber}`] : []),
    ...(receipt.transactionId ? [`TrxID       : ${receipt.transactionId}`] : []),
    ...(receipt.reference ? [`Reference   : ${receipt.reference}`] : []),
    ...(receipt.estimatedRepaymentDate && receipt.type === 'loan' ? [`Due Date    : ${receipt.estimatedRepaymentDate}`] : []),
    `Timestamp   : ${dateStr}`,
    `Authorized  : ${receipt.decidedBy || (statusLabel === 'PENDING REVIEW' ? 'Awaiting Officer Review' : 'Chief Administrator')}`,
    `Checksum    : ${checksum}`,
    '----------------------------------------',
    '0% Interest Sharia-Compliant Charter Pool'
  ];

  return lines.join('\n');
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

function renderVoucherCanvas(receipt: OfficialReceiptData): HTMLCanvasElement {
  const memoCode = normalizeMemoCode(receipt.id, receipt.memoId);
  const checksum = computeLedgerChecksum(receipt);
  const { docTitle, categoryLabel, statusLabel, statusTone } = getReceiptMeta(receipt);
  const dateStr = formatReceiptTimestamp(receipt);

  const width = 1240;
  const padX = 88;
  const contentWidth = width - padX * 2;

  const isCert = receipt.type === 'certificate';
  const rows: Array<{ label: string; value: string; mono?: boolean; highlight?: boolean }> = [
    { label: 'Account Holder', value: receipt.userName || 'Verified Charter Member' },
    {
      label: 'Member ID',
      value: receipt.memberId || (receipt.userId ? `TUT-${receipt.userId.substring(0, 8).toUpperCase()}` : 'N/A'),
      mono: true
    },
    { label: 'Category', value: categoryLabel },
    { label: 'Execution Date', value: dateStr, mono: true }
  ];

  if (!isCert) {
    rows.push({
      label: 'Payment Rail',
      value: `${receipt.isTransfer ? 'T.U.T. Internal Transfer' : (receipt.method || 'Internal Treasury Disbursal')}${receipt.mobileOperator ? ` (${receipt.mobileOperator})` : ''}`
    });
  } else {
    rows.push({
      label: 'Charter Tier',
      value: (receipt.subscriptionTier || 'Bronze Reserve').toString().toUpperCase(),
      highlight: true
    });
  }

  if (receipt.accountNumber) {
    rows.push({ label: 'Account / Wallet', value: receipt.accountNumber, mono: true });
  }
  if (receipt.isTransfer && receipt.transferType === 'out' && receipt.transferRecipientName) {
    rows.push({ label: 'Recipient', value: receipt.transferRecipientName });
  }
  if (receipt.isTransfer && receipt.transferType === 'in' && receipt.transferSenderName) {
    rows.push({ label: 'Sender', value: receipt.transferSenderName });
  }
  if (receipt.transactionId) {
    rows.push({ label: 'External TrxID', value: receipt.transactionId, mono: true, highlight: true });
  }
  if (receipt.reference) {
    rows.push({ label: 'Reference', value: receipt.reference, mono: true });
  }
  if (receipt.type === 'subscription' && receipt.subscriptionTier) {
    rows.push({
      label: 'Plan & Term',
      value: `${receipt.subscriptionTier.toUpperCase()}${receipt.subscriptionMonths ? ` · ${receipt.subscriptionMonths} Mo` : ''}`
    });
  }
  if (receipt.type === 'loan' && receipt.estimatedRepaymentDate) {
    rows.push({ label: 'Scheduled Due Date', value: receipt.estimatedRepaymentDate, mono: true, highlight: true });
  }
  if (receipt.loanReason) {
    rows.push({ label: 'Stated Purpose', value: receipt.loanReason });
  }
  rows.push({
    label: 'Authorized Officer',
    value: receipt.decidedBy || (statusTone === 'pending' ? 'Awaiting Underwriting Review' : 'Chief Administrator (Tahsin Ullah)')
  });

  const probeCanvas = document.createElement('canvas');
  const probeCtx = probeCanvas.getContext('2d')!;
  probeCtx.font = '500 22px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const noteLines = receipt.adminNotes
    ? wrapCanvasText(probeCtx, receipt.adminNotes.trim(), contentWidth - 48)
    : [];

  const headerH = 205;
  const heroH = 175;
  const rowH = 68;
  const tableH = rows.length * rowH + 40;
  const notesH = noteLines.length > 0 ? 84 + noteLines.length * 32 : 0;
  const footerH = 265;
  const totalHeight = Math.max(1580, headerH + heroH + tableH + notesH + footerH + 96);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  // Clean White Archival Paper
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, totalHeight);

  // Subtle Perimeter Border
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, width - 56, totalHeight - 56);

  // Airy White Letterhead (Matching Stripe / Mercury / Revolut Statement Aesthetics)
  ctx.fillStyle = '#091022';
  ctx.beginPath();
  ctx.roundRect(padX, 76, 62, 62, 12);
  ctx.fill();

  ctx.fillStyle = '#EAD39C';
  ctx.fillRect(padX + 16, 94, 30, 4);
  ctx.fillRect(padX + 19, 101, 4.5, 22);
  ctx.fillRect(padX + 28.5, 101, 4.5, 22);
  ctx.fillRect(padX + 38, 101, 4.5, 22);
  ctx.fillRect(padX + 14, 125, 34, 4);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 27px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('T.U.T. Private Lending Authority', padX + 82, 102);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 18px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('Zero-Usury Cooperative Charter · Official Ledger Voucher', padX + 82, 131);

  // Right-aligned Document Serial
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748B';
  ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('DOCUMENT SERIAL', width - padX, 95);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 21px "JetBrains Mono", monospace';
  ctx.fillText(memoCode, width - padX, 126);
  ctx.textAlign = 'left';

  // Crisp Double Editorial Rule under Header
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(padX, 168, contentWidth, 3);
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(padX, 174, contentWidth, 2);

  // Hero Settlement Row (Open typography, no box-within-box)
  let curY = headerH + 30;
  ctx.fillStyle = '#64748B';
  ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(docTitle, padX, curY);

  if (isCert) {
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 44px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(receipt.userName || 'Verified Charter Member', padX, curY + 56);
  } else {
    const amountDisplay = `৳ ${(receipt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 54px "JetBrains Mono", monospace';
    ctx.fillText(amountDisplay, padX, curY + 62);
  }

  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText(`Issued ${dateStr}`, padX, curY + 98);

  // Right-aligned Unboxed Status Stamp
  const stampColors: Record<ReceiptClassification['statusTone'], { text: string; border: string; bg: string }> = {
    confirmed: { text: '#047857', border: '#A7F3D0', bg: '#ECFDF5' },
    pending: { text: '#B45309', border: '#FDE68A', bg: '#FFFBEB' },
    hold: { text: '#1D4ED8', border: '#BFDBFE', bg: '#EFF6FF' },
    rejected: { text: '#BE123C', border: '#FECDD3', bg: '#FFF1F2' }
  };
  const sCol = stampColors[statusTone];
  ctx.font = '800 18px "JetBrains Mono", monospace';
  const sWidth = ctx.measureText(statusLabel).width + 38;
  const sX = width - padX - sWidth;
  ctx.fillStyle = sCol.bg;
  ctx.strokeStyle = sCol.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(sX, curY + 14, sWidth, 44, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = sCol.text;
  ctx.fillText(statusLabel, sX + 19, curY + 42);

  curY += heroH;

  // Hairline Divider before Particulars
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, curY);
  ctx.lineTo(padX + contentWidth, curY);
  ctx.stroke();

  curY += 12;

  rows.forEach((row) => {
    const ry = curY;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, ry + rowH);
    ctx.lineTo(padX + contentWidth, ry + rowH);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '600 21px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(row.label, padX, ry + 42);

    ctx.fillStyle = row.highlight ? '#0B3B8C' : '#0F172A';
    ctx.font = row.mono
      ? '600 21px "JetBrains Mono", monospace'
      : '700 21px "Plus Jakarta Sans", sans-serif';
    const valStr = row.value.length > 52 ? `${row.value.slice(0, 49)}...` : row.value;
    const vw = ctx.measureText(valStr).width;
    ctx.fillText(valStr, padX + contentWidth - vw, ry + 42);

    curY += rowH;
  });

  curY += 34;

  // Admin Notes Block (if present)
  if (noteLines.length > 0) {
    const boxH = 62 + noteLines.length * 32;
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(padX, curY, contentWidth, boxH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('UNDERWRITING & LEDGER REMARKS', padX + 24, curY + 34);

    ctx.fillStyle = '#1E293B';
    ctx.font = '500 21px "Plus Jakarta Sans", sans-serif';
    noteLines.forEach((line, lIdx) => {
      ctx.fillText(line, padX + 24, curY + 68 + lIdx * 32);
    });
    curY += boxH + 34;
  }

  // Verification Matrix & Signature anchored cleanly below content
  const footerBlockY = Math.max(curY + 12, totalHeight - 285);
  const matrix = generateDeterministicMatrix(`${memoCode}|${checksum}`, 15);
  const cell = 7.5;
  const qrSize = 15 * cell;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(padX, footerBlockY, qrSize + 24, qrSize + 24, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(padX + 12 + c * cell, footerBlockY + 12 + r * cell, cell - 0.8, cell - 0.8);
      }
    }
  }

  ctx.fillStyle = '#047857';
  ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('LEDGER CHECKSUM VERIFIED', padX + qrSize + 44, footerBlockY + 34);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 23px "JetBrains Mono", monospace';
  ctx.fillText(checksum, padX + qrSize + 44, footerBlockY + 70);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 17px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Electronically Authenticated · 0% Interest Cooperative Record', padX + qrSize + 44, footerBlockY + 104);

  // Signature Right Side
  const sigRight = padX + contentWidth;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'italic 600 30px Georgia, serif';
  const sigName = 'Tahsin Ullah';
  const sigNameW = ctx.measureText(sigName).width;
  ctx.fillText(sigName, sigRight - sigNameW, footerBlockY + 56);

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sigRight - 250, footerBlockY + 74);
  ctx.lineTo(sigRight, footerBlockY + 74);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  const sigTitle = 'FOUNDER & CHAIRMAN · T.U.T.';
  const sigTitleW = ctx.measureText(sigTitle).width;
  ctx.fillText(sigTitle, sigRight - sigTitleW, footerBlockY + 102);

  // Bottom Legal Hairline
  const legalY = totalHeight - 76;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, legalY - 26);
  ctx.lineTo(padX + contentWidth, legalY - 26);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    'Zero-Usury Cooperative Charter (0% Interest) · Electronically issued official voucher valid without wet stamp.',
    padX,
    legalY + 6
  );

  return canvas;
}

/**
 * Generates an executive banking-grade archival PNG voucher & downloads it directly.
 */
export async function downloadReceiptPng(receipt: OfficialReceiptData): Promise<void> {
  const memoCode = normalizeMemoCode(receipt.id, receipt.memoId);
  const canvas = renderVoucherCanvas(receipt);

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not generate PNG voucher blob.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TUT-Receipt-${memoCode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      resolve();
    }, 'image/png', 1.0);
  });
}

function buildReceiptPdfUint8Array(receipt: OfficialReceiptData, canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
  const base64 = dataUrl.split(',')[1];
  const rawBinary = atob(base64);
  const jpegBytes = new Uint8Array(rawBinary.length);
  for (let i = 0; i < rawBinary.length; i++) {
    jpegBytes[i] = rawBinary.charCodeAt(i);
  }

  // A4 Portrait in points (72 dpi): 595.28 x 841.89
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 20;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
  const drawW = (canvas.width * scale).toFixed(2);
  const drawH = (canvas.height * scale).toFixed(2);
  const drawX = ((pageW - canvas.width * scale) / 2).toFixed(2);
  const drawY = (pageH - margin - canvas.height * scale).toFixed(2);

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const pushStr = (s: string) => {
    const b = encoder.encode(s);
    chunks.push(b);
    offset += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    offset += b.length;
  };

  const offsets: number[] = [0]; // obj 0 free

  pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  offsets[1] = offset;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = offset;
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets[3] = offset;
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  offsets[4] = offset;
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream\nendobj\n');

  const contentStream = `q ${drawW} 0 0 ${drawH} ${drawX} ${drawY} cm /Im0 Do Q\n`;
  offsets[5] = offset;
  pushStr(
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`
  );

  const xrefOffset = offset;
  pushStr('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const merged = new Uint8Array(offset);
  let pos = 0;
  for (const chunk of chunks) {
    merged.set(chunk, pos);
    pos += chunk.length;
  }
  return merged;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export interface DirectMemoAttachment {
  filename: string;
  content: string;
  contentType: string;
  encoding: 'base64';
}

/**
 * Generates direct Official Transaction Memo PDF attachment
 * for attaching directly to automated request-accepted emails.
 */
export function generateDirectMemoAttachments(receipt: OfficialReceiptData): DirectMemoAttachment[] {
  if (typeof document === 'undefined') return [];
  try {
    const memoCode = normalizeMemoCode(receipt.id, receipt.memoId);
    const canvas = renderVoucherCanvas(receipt);
    const pdfBytes = buildReceiptPdfUint8Array(receipt, canvas);
    const pdfBase64 = uint8ArrayToBase64(pdfBytes);

    if (!pdfBase64) return [];
    return [
      {
        filename: `TUT-Memo-${memoCode}.pdf`,
        content: pdfBase64,
        contentType: 'application/pdf',
        encoding: 'base64'
      }
    ];
  } catch (err) {
    console.warn('[ReceiptGenerator] Direct memo PDF attachment build skipped:', err);
    return [];
  }
}

/**
 * Generates a valid single-page A4 PDF 1.4 binary containing the high-DPI voucher sheet
 * and triggers an immediate `.pdf` file download with zero external dependencies or print dialog issues.
 */
export async function downloadReceiptPdf(receipt: OfficialReceiptData): Promise<void> {
  const memoCode = normalizeMemoCode(receipt.id, receipt.memoId);
  const canvas = renderVoucherCanvas(receipt);
  const pdfBytes = buildReceiptPdfUint8Array(receipt, canvas);

  const pdfBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TUT-Voucher-${memoCode}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function printCleanReceipt(): void {
  window.print();
}
