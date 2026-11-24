import { 
  Firestore, 
  doc, 
  collection, 
  runTransaction, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { UnifiedRequestItem } from '../components/admin/types';
import { UserProfile } from '../App';

export interface P2PTransferParams {
  senderUid: string;
  recipientUid: string;
  amount: number;
  senderName: string;
  recipientName: string;
  senderMemberId: string;
  recipientMemberId: string;
  reference?: string;
}

export interface P2PTransferResult {
  success: boolean;
  senderMemoId: string;
  recipientMemoId: string;
  transferredAmount: number;
}

/**
 * Executes a bank-grade Atomic Peer-to-Peer Transfer between two approved members.
 * Guarantees zero race conditions, atomicity, and ledger integrity.
 * If any check or step fails, NO balances are touched.
 */
export async function executeAtomicP2PTransfer(
  db: Firestore,
  params: P2PTransferParams
): Promise<P2PTransferResult> {
  const {
    senderUid,
    recipientUid,
    amount,
    senderName,
    recipientName,
    senderMemberId,
    recipientMemberId,
    reference = ''
  } = params;

  if (amount <= 0 || isNaN(amount)) {
    throw new Error('Transfer amount must be a positive number.');
  }

  if (senderUid === recipientUid) {
    throw new Error('Self-transfer is not permitted.');
  }

  const senderMemoId = `TUT-TX-${Math.floor(100000 + Math.random() * 900000)}`;
  const recipientMemoId = `TUT-TX-${Math.floor(100000 + Math.random() * 900000)}`;

  const senderRef = doc(db, 'users', senderUid);
  const recipientRef = doc(db, 'users', recipientUid);
  const senderTxRef = doc(collection(db, 'transactions'));
  const recipientTxRef = doc(collection(db, 'transactions'));
  const auditLogRef = doc(collection(db, 'audit_logs'));

  await runTransaction(db, async (t) => {
    // 1. Read sender
    const senderDoc = await t.get(senderRef);
    if (!senderDoc.exists()) {
      throw new Error('Sender account record was not found in the Authority database.');
    }
    const senderData = senderDoc.data() as UserProfile;
    if (senderData.status !== 'approved') {
      throw new Error('Sender account is not in an active approved status.');
    }

    const currentSenderDeposit = Number(senderData.totalDeposit) || 0;
    if (currentSenderDeposit < amount) {
      throw new Error(
        `Insufficient funds: Your available deposit is ৳${currentSenderDeposit.toLocaleString()}, but you requested to transfer ৳${amount.toLocaleString()}.`
      );
    }

    // 2. Read recipient
    const recipientDoc = await t.get(recipientRef);
    if (!recipientDoc.exists()) {
      throw new Error('Recipient account was not found.');
    }
    const recipientData = recipientDoc.data() as UserProfile;
    if (recipientData.status !== 'approved') {
      throw new Error('Recipient account is not approved by Authority.');
    }

    const currentRecipientDeposit = Number(recipientData.totalDeposit) || 0;

    // 3. Update Sender Balance
    t.update(senderRef, {
      totalDeposit: currentSenderDeposit - amount,
      updatedAt: serverTimestamp()
    });

    // 4. Update Recipient Balance
    t.update(recipientRef, {
      totalDeposit: currentRecipientDeposit + amount,
      updatedAt: serverTimestamp()
    });

    // 5. Create Outbound Transaction Document
    t.set(senderTxRef, {
      userId: senderUid,
      userName: senderName,
      type: 'refund', // Bookkeeping internal type: debit deposit
      isTransfer: true,
      transferType: 'out',
      transferRecipientName: recipientName,
      transferRecipientId: recipientMemberId || 'Approved Member',
      amount: amount,
      method: 'Cash',
      status: 'confirmed',
      timestamp: serverTimestamp(),
      memoId: senderMemoId,
      accountNumber: recipientMemberId || 'N/A',
      reference: reference.trim() || 'P2P Member Transfer'
    });

    // 6. Create Inbound Transaction Document
    t.set(recipientTxRef, {
      userId: recipientUid,
      userName: recipientName,
      type: 'deposit', // Bookkeeping internal type: credit deposit
      isTransfer: true,
      transferType: 'in',
      transferSenderName: senderName,
      transferSenderId: senderMemberId || 'Approved Member',
      amount: amount,
      method: 'Cash',
      status: 'confirmed',
      timestamp: serverTimestamp(),
      memoId: recipientMemoId,
      accountNumber: senderMemberId || 'N/A',
      reference: reference.trim() || 'P2P Member Transfer'
    });

    // 7. Write Immutable Audit Trail
    t.set(auditLogRef, {
      timestamp: serverTimestamp(),
      actorEmail: senderData.email || 'member@tut.org',
      actorName: senderName,
      action: 'P2P_TRANSFER_COMMITTED',
      details: `Transferred ৳${amount} from ${senderName} (#${senderMemberId}) to ${recipientName} (#${recipientMemberId}). Ref: ${reference || 'N/A'}`,
      severity: 'info'
    });
  });

  return {
    success: true,
    senderMemoId,
    recipientMemoId,
    transferredAmount: amount
  };
}

export interface AdminApprovalParams {
  request: UnifiedRequestItem;
  adminEmail: string;
  reason?: string;
}

/**
 * Executes an Atomic Admin Approval for loan, deposit, repayment, or subscription.
 * Validates request state, calculates live balances, and commits all document changes atomically.
 */
export async function executeAtomicAdminApproval(
  db: Firestore,
  params: AdminApprovalParams
): Promise<{ success: boolean; cleanMemoId: string }> {
  const { request, adminEmail, reason = 'Official Approval' } = params;

  if (request.source !== 'transaction') {
    throw new Error('Atomic transaction approval is only applicable to transaction records.');
  }

  const txRef = doc(db, 'transactions', request.id);
  const userRef = request.memberUid ? doc(db, 'users', request.memberUid) : null;
  const fundsDocRef = doc(db, 'system_controls', 'funds');
  const auditLogRef = doc(collection(db, 'audit_logs'));

  const cleanMemoId = request.memoId 
    ? (request.memoId.startsWith('TUT-MEMO-') ? request.memoId : `TUT-MEMO-${request.memoId}`)
    : `TUT-MEMO-${Math.floor(100000 + Math.random() * 900000)}`;

  const nowStr = new Date().toISOString();

  await runTransaction(db, async (t) => {
    // 1. Read live transaction
    const txSnap = await t.get(txRef);
    if (!txSnap.exists()) {
      throw new Error(`Transaction ${request.id} does not exist in database.`);
    }
    const currentTxData = txSnap.data();
    if (currentTxData.status === 'confirmed') {
      throw new Error('This request has already been approved and confirmed by another administrator.');
    }

    // 2. Read live user document (if present) and authority funds document (reads must precede writes)
    const fundsSnap = request.requestType === 'subscription' ? await t.get(fundsDocRef) : null;
    const currentPersonalFund = fundsSnap && fundsSnap.exists() ? (Number(fundsSnap.data()?.personalFund) || 0) : 0;

    let currentDebt = 0;
    let currentTotalLoan = 0;
    let currentDeposit = 0;
    let currentRepaid = 0;
    let currentSubTier = 'bronze';
    let currentSubStatus = 'active';
    let currentSubExpiresAt: string | null = null;
    let currentSubMonths = 0;

    if (userRef) {
      const userSnap = await t.get(userRef);
      if (userSnap.exists()) {
        const uData = userSnap.data() as UserProfile;
        currentDebt = Number(uData.remainingDebt) || 0;
        currentTotalLoan = Number(uData.totalLoan) || 0;
        currentDeposit = Number(uData.totalDeposit) || 0;
        currentRepaid = Number(uData.totalRepaid) || 0;
        currentSubTier = uData.subscriptionTier || 'bronze';
        currentSubStatus = uData.subscriptionStatus || 'active';
        currentSubExpiresAt = uData.subscriptionExpiresAt || null;
        currentSubMonths = Number(uData.continuousSubscriptionMonths) || 0;
      }
    }

    // 3. Atomically update transaction status
    t.update(txRef, {
      status: 'confirmed',
      memoId: cleanMemoId,
      exactAmount: request.requestedAmount,
      decidedBy: adminEmail,
      decidedAt: nowStr,
      adminNotes: `${request.adminNotes || ''}\n[${new Date().toLocaleDateString()}] Confirmed by ${adminEmail}: ${reason}`,
      updatedAt: serverTimestamp()
    });

    // 4. Atomically apply balance updates to User
    if (userRef) {
      if (request.requestType === 'loan') {
        t.update(userRef, {
          remainingDebt: currentDebt + request.requestedAmount,
          totalLoan: currentTotalLoan + request.requestedAmount,
          updatedAt: serverTimestamp()
        });
      } else if (request.requestType === 'pay_due') {
        t.update(userRef, {
          remainingDebt: Math.max(0, currentDebt - request.requestedAmount),
          totalRepaid: currentRepaid + request.requestedAmount,
          updatedAt: serverTimestamp()
        });
      } else if (request.requestType === 'deposit') {
        t.update(userRef, {
          totalDeposit: currentDeposit + request.requestedAmount,
          updatedAt: serverTimestamp()
        });
      } else if (request.requestType === 'refund') {
        t.update(userRef, {
          totalDeposit: Math.max(0, currentDeposit - request.requestedAmount),
          updatedAt: serverTimestamp()
        });
      } else if (request.requestType === 'subscription') {
        const tier = (request as any).subscriptionTier || currentSubTier || 'bronze';
        const months = Number((request as any).subscriptionMonths) || 1;
        const today = new Date();
        let expiresAt = new Date();

        if (currentSubStatus === 'active' && currentSubExpiresAt) {
          const currentExp = new Date(currentSubExpiresAt);
          if (currentExp > today) {
            expiresAt = new Date(currentExp);
          }
        }
        expiresAt.setDate(expiresAt.getDate() + (months * 30));
        const baseLimit = tier === 'gold' ? 2500 : tier === 'silver' ? 1500 : 500;

        t.update(userRef, {
          subscriptionTier: tier,
          subscriptionStatus: 'active',
          subscriptionExpiresAt: expiresAt.toISOString(),
          continuousSubscriptionMonths: currentSubMonths + months,
          lastSubscriptionPaidAt: nowStr,
          borrowingLimit: baseLimit,
          updatedAt: serverTimestamp()
        });

        // Safely increment authority capital fund without overwriting existing reserve capital
        const revenueAmount = Number(currentTxData.amount || request.requestedAmount) || 0;
        t.set(fundsDocRef, {
          personalFund: currentPersonalFund + revenueAmount,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    }

    // 5. Audit Log Entry
    t.set(auditLogRef, {
      timestamp: serverTimestamp(),
      actorEmail: adminEmail,
      actorName: 'Administrator',
      action: `ADMIN_APPROVED_${request.requestType.toUpperCase()}`,
      details: `Approved ${request.requestType} for ৳${request.requestedAmount.toLocaleString()} to ${request.memberName}. Memo: ${cleanMemoId}. Reason: ${reason}`,
      severity: 'info'
    });
  });

  return { success: true, cleanMemoId };
}

export interface LoanSettlementParams {
  loanId: string;
  memberUid: string;
  adminEmail: string;
  settleAmount: number;
}

/**
 * Settles a loan atomically, marking the transaction as paid and updating member debt & repaid records.
 */
export async function executeAtomicLoanSettlement(
  db: Firestore,
  params: LoanSettlementParams
): Promise<{ success: boolean }> {
  const { loanId, memberUid, adminEmail, settleAmount } = params;

  const txRef = doc(db, 'transactions', loanId);
  const userRef = doc(db, 'users', memberUid);
  const auditLogRef = doc(collection(db, 'audit_logs'));

  await runTransaction(db, async (t) => {
    const txSnap = await t.get(txRef);
    if (!txSnap.exists()) {
      throw new Error(`Loan transaction ${loanId} not found.`);
    }

    const userSnap = await t.get(userRef);
    if (!userSnap.exists()) {
      throw new Error(`Member ${memberUid} not found.`);
    }

    const userData = userSnap.data() as UserProfile;
    const currentDebt = Number(userData.remainingDebt) || 0;
    const currentRepaid = Number(userData.totalRepaid) || 0;

    // Mark loan settled
    t.update(txRef, {
      status: 'settled',
      isPaid: true,
      settledAt: serverTimestamp(),
      settledBy: adminEmail,
      updatedAt: serverTimestamp()
    });

    // Update user debt & repaid
    t.update(userRef, {
      remainingDebt: Math.max(0, currentDebt - settleAmount),
      totalRepaid: currentRepaid + settleAmount,
      updatedAt: serverTimestamp()
    });

    // Audit log
    t.set(auditLogRef, {
      timestamp: serverTimestamp(),
      actorEmail: adminEmail,
      actorName: 'Administrator',
      action: 'LOAN_SETTLED_ATOMIC',
      details: `Loan ${loanId} (৳${settleAmount}) settled in full for member ${userData.name} (#${userData.memberId || memberUid})`,
      severity: 'info'
    });
  });

  return { success: true };
}

export interface MerchantPaymentParams {
  userId: string;
  amount: number;
  merchantId?: string;
  merchantName: string;
  orderId?: string;
  paymentInstrument: 'tut_card';
  fundingSource: 'wallet_deposit' | 'credit_line';
  cardNumber: string;
  secretCode: string;
  reference?: string;
}

export interface MerchantPaymentResult {
  success: boolean;
  transactionDocId: string;
  memoId: string;
  amount: number;
  methodLabel: string;
  cardLast4: string;
  newTotalDeposit: number;
  newRemainingDebt: number;
}

/**
 * Executes an atomic Card-Only payment from a member's T.U.T. Card
 * (funded by Vault Savings or Approved Credit Line) to an external merchant / app.
 */
export async function executeAtomicMerchantPayment(
  db: Firestore,
  params: MerchantPaymentParams
): Promise<MerchantPaymentResult> {
  const {
    userId,
    amount,
    merchantId,
    merchantName,
    orderId = `ORD-${Date.now().toString(36).toUpperCase()}`,
    paymentInstrument,
    fundingSource,
    cardNumber,
    secretCode,
    reference = ''
  } = params;

  const {
    verifySecretCode,
    sha256Hex,
    recordCardVerificationFailure
  } = await import('./tutPaymentEngine');

  if (!userId) {
    throw new Error('Authentication required to process T.U.T. Card payment.');
  }
  if (paymentInstrument !== 'tut_card') {
    throw new Error('Only T.U.T. Card payments are accepted by this gateway.');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be greater than ৳0.');
  }
  const cleanMerchantName = (merchantName || 'Authorized Partner App').trim().slice(0, 120);
  const memoId = `TUT-PAY-${Math.floor(100000 + Math.random() * 900000)}`;

  const userRef = doc(db, 'users', userId);
  const cardRef = doc(db, 'tut_cards', userId);
  const txRef = doc(collection(db, 'transactions'));
  const auditLogRef = doc(collection(db, 'audit_logs'));
  const cleanMerchantId = merchantId ? merchantId.trim().slice(0, 80) : '';
  const merchantRef = cleanMerchantId ? doc(db, 'merchant_apps', cleanMerchantId) : null;

  const { getDoc } = await import('firebase/firestore');
  const preCardSnap = await getDoc(cardRef);
  if (!preCardSnap.exists()) {
    throw new Error('Your T.U.T. Card Key is not set up yet. Set your 6-digit Payment Key first.');
  }
  const cardData = preCardSnap.data() as any;
  if (!cardData.isActive || !cardData.secretCodeHash) {
    throw new Error('This T.U.T. Card is not active yet.');
  }
  if (cardData.isFrozen) {
    throw new Error('This T.U.T. Card is currently frozen. Unfreeze it from Card Key Management to pay.');
  }
  if (cardData.lockedUntil && Number(cardData.lockedUntil) > Date.now()) {
    const minsLeft = Math.max(1, Math.ceil((Number(cardData.lockedUntil) - Date.now()) / 60000));
    throw new Error(`Card temporarily locked after repeated incorrect Key attempts. Try again in ${minsLeft} min or use Smart Recovery.`);
  }

  const cleanPan = (cardNumber || '').replace(/\D/g, '');
  if (cleanPan.length !== 16) {
    throw new Error('Enter your valid 16-digit T.U.T. Card Number.');
  }
  const candidatePanHash = await sha256Hex(`tut-pan-v1:${userId}:${cleanPan}`);
  if (candidatePanHash !== cardData.cardHash) {
    await recordCardVerificationFailure(db, userId, Number(cardData.failedAttempts) || 0);
    throw new Error('Card Number does not match your T.U.T. Authority Card.');
  }

  if (!secretCode || !/^\d{6}$/.test(secretCode.trim())) {
    throw new Error('Enter your 6-digit Card Payment Key.');
  }
  const codeOk = await verifySecretCode(cardData.secretCodeSalt, cardData.secretCodeHash, secretCode);
  if (!codeOk) {
    const failRes = await recordCardVerificationFailure(db, userId, Number(cardData.failedAttempts) || 0);
    if (failRes.lockedUntil > 0) {
      throw new Error('Too many incorrect Card Key attempts. Card locked for 15 minutes.');
    }
    throw new Error(`Incorrect Card Payment Key (${5 - failRes.nextAttempts} attempts remaining).`);
  }

  if (amount > (Number(cardData.perTxLimit) || 50000)) {
    throw new Error(`Amount exceeds your Card per-transaction limit of ৳${Number(cardData.perTxLimit).toLocaleString()}.`);
  }

  const verifiedCardLast4: string = cardData.cardLast4 || cleanPan.slice(-4);
  const shouldResetFailedAttempts = (Number(cardData.failedAttempts) || 0) > 0;

  let newTotalDeposit = 0;
  let newRemainingDebt = 0;
  const methodLabel = 'T.U.T. Card';

  await runTransaction(db, async (t) => {
    const userSnap = await t.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('T.U.T. member profile not found.');
    }
    const userData = userSnap.data() as UserProfile;
    if (userData.status !== 'approved') {
      throw new Error('Your T.U.T. membership must be approved before making Card payments.');
    }

    const merchantSnap = merchantRef ? await t.get(merchantRef) : null;
    if (merchantSnap && merchantSnap.exists() && merchantSnap.data()?.status === 'paused') {
      throw new Error(`Merchant "${cleanMerchantName}" is currently paused by T.U.T. Authority.`);
    }

    const currentDeposit = Number(userData.totalDeposit) || 0;
    const currentDebt = Number(userData.remainingDebt) || 0;
    const currentTotalLoan = Number(userData.totalLoan) || 0;

    if (fundingSource === 'wallet_deposit') {
      if (currentDeposit < amount) {
        throw new Error(
          `Insufficient Vault balance (Available: ৳${currentDeposit.toLocaleString()}, Needed: ৳${amount.toLocaleString()}). Deposit funds or pay via 0% Credit Line.`
        );
      }
      newTotalDeposit = currentDeposit - amount;
      newRemainingDebt = currentDebt;
      t.update(userRef, {
        totalDeposit: newTotalDeposit,
        updatedAt: serverTimestamp()
      });
    } else {
      const subActive = userData.subscriptionStatus === 'active';
      const activeTier = userData.subscriptionTier;
      const fallbackCap = activeTier === 'gold' ? 2500 : activeTier === 'silver' ? 1500 : activeTier === 'bronze' ? 500 : 0;
      const borrowCap = subActive ? (Number(userData.borrowingLimit) || fallbackCap) : 0;
      const availableCredit = Math.max(0, borrowCap - currentDebt);
      if (!subActive || borrowCap <= 0) {
        throw new Error('An active T.U.T. Membership Charter is required to use 0% Credit Line funding.');
      }
      if (availableCredit < amount) {
        throw new Error(
          `Insufficient available Credit Line (Available: ৳${availableCredit.toLocaleString()}, Needed: ৳${amount.toLocaleString()}).`
        );
      }
      newTotalDeposit = currentDeposit;
      newRemainingDebt = currentDebt + amount;
      t.update(userRef, {
        remainingDebt: newRemainingDebt,
        totalLoan: currentTotalLoan + amount,
        updatedAt: serverTimestamp()
      });
    }

    if (shouldResetFailedAttempts) {
      t.update(cardRef, {
        failedAttempts: 0,
        lockedUntil: 0,
        updatedAt: new Date().toISOString()
      });
    }

    if (merchantRef && merchantSnap && merchantSnap.exists()) {
      const mData = merchantSnap.data() as any;
      t.update(merchantRef, {
        totalProcessed: (Number(mData.totalProcessed) || 0) + amount,
        txCount: (Number(mData.txCount) || 0) + 1,
        updatedAt: new Date().toISOString()
      });
    }

    const dueDateIso =
      fundingSource === 'credit_line'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : undefined;
    const creditReason =
      fundingSource === 'credit_line'
        ? `T.U.T. Card Credit Pay — ${cleanMerchantName} (Order: ${orderId})`
        : undefined;
    const normalizedReference =
      fundingSource === 'credit_line'
        ? reference
          ? reference.toLowerCase().includes('credit line')
            ? reference
            : `${reference} (0% Credit Line)`
          : `${cleanMerchantName} (0% Credit Line)`
        : reference || `${cleanMerchantName} (Vault Balance)`;

    t.set(txRef, {
      userId,
      userName: userData.name || 'T.U.T. Member',
      type: 'merchant_payment',
      amount,
      method: methodLabel,
      accountNumber: `****-${verifiedCardLast4}`,
      transactionId: orderId,
      memoId,
      status: 'confirmed',
      ...(cleanMerchantId ? { merchantId: cleanMerchantId } : {}),
      merchantName: cleanMerchantName,
      orderId,
      paymentInstrument: 'tut_card',
      fundingSource,
      cardLast4: verifiedCardLast4,
      ...(dueDateIso ? { estimatedRepaymentDate: dueDateIso } : {}),
      ...(creditReason ? { loanReason: creditReason, purpose: `${cleanMerchantName} (${orderId})` } : {}),
      reference: normalizedReference,
      timestamp: serverTimestamp()
    });

    t.set(auditLogRef, {
      timestamp: serverTimestamp(),
      actorEmail: userData.email || 'member@tut.org',
      actorName: userData.name || 'Member',
      action: 'EXTERNAL_CARD_PAYMENT',
      details: `Paid ৳${amount.toLocaleString()} to "${cleanMerchantName}" (Order: ${orderId}) via T.U.T. Card ****${verifiedCardLast4} [${fundingSource}]. Memo: ${memoId}`,
      severity: 'info'
    });
  });

  return {
    success: true,
    transactionDocId: txRef.id,
    memoId,
    amount,
    methodLabel,
    cardLast4: verifiedCardLast4,
    newTotalDeposit,
    newRemainingDebt
  };
}

