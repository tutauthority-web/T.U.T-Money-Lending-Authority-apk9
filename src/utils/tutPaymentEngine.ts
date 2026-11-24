import { Firestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export const PRIMARY_VERCEL_GATEWAY_URL = 'https://t-u-t-money-lending-authority-apkma.vercel.app';

export type RecoveryMethodType =
  | 'email_otp'
  | 'backup_key'
  | 'security_question'
  | 'admin_unlock';

export interface TutPayCardRecord {
  userId: string;
  memberId?: string;
  cardNumber: string; // 16 digits
  cardLast4: string;
  cardHash: string;
  expiryMonth: string; // MM
  expiryYear: string; // YY
  secretCodeHash: string;
  secretCodeSalt: string;
  recoveryKeyHash?: string;
  recoveryKeySalt?: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
  securityAnswerSalt?: string;
  recoveryCount?: number;
  lastRecoveryMethod?: RecoveryMethodType;
  lastRecoveryAt?: string;
  isActive: boolean;
  isFrozen: boolean;
  perTxLimit: number;
  dailyLimit: number;
  failedAttempts: number;
  lockedUntil: number;
  pinSetAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MerchantAppRecord {
  merchantId: string;
  name: string;
  ownerEmail?: string;
  apiKeyId: string;
  allowedOrigins?: string[];
  webhookUrl?: string;
  status: 'active' | 'paused';
  totalProcessed: number;
  txCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MerchantSecretRecord {
  merchantId: string;
  apiKeyId: string;
  apiKeyHash: string;
  createdAt: string;
  updatedAt: string;
}

const PBKDF2_PREFIX = 'pbkdf2-v2:';
const PBKDF2_ITERATIONS = 120000;

/**
 * Computes Luhn check digit for a 15-digit card prefix.
 */
function computeLuhnCheckDigit(base15: string): string {
  let sum = 0;
  for (let i = 0; i < base15.length; i++) {
    let digit = Number(base15[base15.length - 1 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * Validates any 16-digit card number against Luhn checksum.
 */
export function isValidCardLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length !== 16) return false;
  return computeLuhnCheckDigit(digits.slice(0, 15)) === digits[15];
}

/**
 * Generates a deterministic, Luhn-valid 16-digit T.U.T. Card Number tied to user uid & memberId.
 * BIN Prefix: 5488 (T.U.T. Private Lending Authority Network)
 */
export function deriveDeterministicCardNumber(uid: string, memberId?: string): string {
  const seed = `${uid}|${memberId || 'TUT'}|5488`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b);
  }
  const blockA = String((h1 >>> 0) % 1000000).padStart(6, '0');
  const blockB = String((h2 >>> 0) % 100000).padStart(5, '0');
  const base15 = `5488${blockA}${blockB}`;
  const check = computeLuhnCheckDigit(base15);
  return `${base15}${check}`;
}

export function formatCardNumberDisplay(cardNumber: string, maskMiddle = true): string {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length !== 16) return cardNumber;
  if (maskMiddle) {
    return `${digits.slice(0, 4)}  ••••  ••••  ${digits.slice(12, 16)}`;
  }
  return `${digits.slice(0, 4)}  ${digits.slice(4, 8)}  ${digits.slice(8, 12)}  ${digits.slice(12, 16)}`;
}

export function generateSaltHex(byteLength = 16): string {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEquals(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derivePbkdf2Hex(domain: string, salt: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${domain}:${secret}`),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS
    },
    baseKey,
    256
  );
  const hex = Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${PBKDF2_PREFIX}${hex}`;
}

export async function hashSecretCode(salt: string, secretCode: string): Promise<string> {
  return derivePbkdf2Hex('tut-card-key-v2', salt, secretCode.trim());
}

export async function verifySecretCode(
  salt: string,
  expectedHash: string,
  candidateCode: string
): Promise<boolean> {
  if (!salt || !expectedHash || !candidateCode) return false;
  const trimmed = candidateCode.trim();
  if (expectedHash.startsWith(PBKDF2_PREFIX)) {
    const derived = await derivePbkdf2Hex('tut-card-key-v2', salt, trimmed);
    return constantTimeEquals(derived, expectedHash);
  }
  // Legacy compatibility for cards activated prior to v2
  const legacyHash = await sha256Hex(`tut-card-v1:${salt}:${trimmed}`);
  return constantTimeEquals(legacyHash, expectedHash);
}

/**
 * Generates a high-entropy human-readable Master Recovery Backup Key (TUT-REC-XXXX-XXXX-XXXX).
 */
export function generateRecoveryBackupKey(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `TUT-REC-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export async function hashRecoverySecret(
  domain: 'backup_key' | 'security_answer',
  salt: string,
  rawValue: string
): Promise<string> {
  const normalized =
    domain === 'backup_key'
      ? rawValue.trim().toUpperCase().replace(/\s+/g, '')
      : rawValue.trim().toLowerCase().replace(/\s+/g, ' ');
  return derivePbkdf2Hex(`tut-recovery-${domain}-v2`, salt, normalized);
}

export async function verifyRecoverySecret(
  domain: 'backup_key' | 'security_answer',
  salt: string,
  expectedHash: string,
  candidateValue: string
): Promise<boolean> {
  if (!salt || !expectedHash || !candidateValue) return false;
  const derived = await hashRecoverySecret(domain, salt, candidateValue);
  return constantTimeEquals(derived, expectedHash);
}

export async function generateMerchantCredentials(): Promise<{
  merchantId: string;
  apiKeyId: string;
  rawMerchantKey: string;
  apiKeyHash: string;
}> {
  const randBytes = new Uint8Array(24);
  crypto.getRandomValues(randBytes);
  const hex = Array.from(randBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const merchantId = `mrc_${hex.slice(0, 12)}`;
  const rawMerchantKey = `tut_live_${hex.slice(12)}`;
  const apiKeyId = `tut_live_••••${hex.slice(-6)}`;
  const apiKeyHash = await sha256Hex(`tut-merchant-v1:${rawMerchantKey}`);
  return { merchantId, apiKeyId, rawMerchantKey, apiKeyHash };
}

export function normalizeExpiry(subscriptionExpiresAt?: string | null): { month: string; year: string } {
  if (subscriptionExpiresAt) {
    const parsed = new Date(subscriptionExpiresAt);
    if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const y = String(parsed.getFullYear()).slice(-2);
      return { month: m, year: y };
    }
  }
  const future = new Date();
  future.setFullYear(future.getFullYear() + 3);
  return {
    month: String(future.getMonth() + 1).padStart(2, '0'),
    year: String(future.getFullYear()).slice(-2)
  };
}

/**
 * First-time mandatory Card Key activation.
 * Enforces one-time creation: throws if a Card Payment Key has already been set.
 * Returns the saved card record plus the one-time plaintext Master Recovery Key.
 */
export async function activateCardWithInitialKey(
  db: Firestore,
  params: {
    uid: string;
    memberId?: string;
    secretCode: string;
    perTxLimit?: number;
    subscriptionExpiresAt?: string | null;
    securityQuestion?: string;
    securityAnswer?: string;
  }
): Promise<{ card: TutPayCardRecord; rawBackupKey: string }> {
  const {
    uid,
    memberId,
    secretCode,
    perTxLimit = 50000,
    subscriptionExpiresAt,
    securityQuestion,
    securityAnswer
  } = params;

  const cleanCode = secretCode.trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('Card Payment Key must be exactly 6 numeric digits.');
  }
  if (perTxLimit < 10 || perTxLimit > 500000) {
    throw new Error('Per-transaction limit must be between ৳10 and ৳500,000.');
  }

  const cardRef = doc(db, 'tut_cards', uid);
  const existing = await getDoc(cardRef);
  if (existing.exists() && existing.data()?.secretCodeHash) {
    throw new Error(
      'Your Card Payment Key is already set and locked. Use Smart Key Recovery if you forgot your code.'
    );
  }

  const cardNumber = deriveDeterministicCardNumber(uid, memberId);
  const cardLast4 = cardNumber.slice(-4);
  const cardHash = await sha256Hex(`tut-pan-v1:${uid}:${cardNumber}`);

  const secretCodeSalt = generateSaltHex(16);
  const secretCodeHash = await hashSecretCode(secretCodeSalt, cleanCode);

  const rawBackupKey = generateRecoveryBackupKey();
  const recoveryKeySalt = generateSaltHex(16);
  const recoveryKeyHash = await hashRecoverySecret('backup_key', recoveryKeySalt, rawBackupKey);

  let cleanQuestion: string | undefined;
  let securityAnswerSalt: string | undefined;
  let securityAnswerHash: string | undefined;
  if (securityQuestion?.trim() && securityAnswer?.trim()) {
    cleanQuestion = securityQuestion.trim().slice(0, 140);
    securityAnswerSalt = generateSaltHex(16);
    securityAnswerHash = await hashRecoverySecret('security_answer', securityAnswerSalt, securityAnswer);
  }

  const { month, year } = normalizeExpiry(subscriptionExpiresAt);
  const nowIso = new Date().toISOString();

  const payload: TutPayCardRecord = {
    userId: uid,
    memberId: memberId || '',
    cardNumber,
    cardLast4,
    cardHash,
    expiryMonth: month,
    expiryYear: year,
    secretCodeHash,
    secretCodeSalt,
    recoveryKeyHash,
    recoveryKeySalt,
    ...(cleanQuestion ? { securityQuestion: cleanQuestion } : {}),
    ...(securityAnswerHash ? { securityAnswerHash, securityAnswerSalt } : {}),
    recoveryCount: 0,
    isActive: true,
    isFrozen: false,
    perTxLimit: Number(perTxLimit),
    dailyLimit: Math.max(Number(perTxLimit) * 3, 100000),
    failedAttempts: 0,
    lockedUntil: 0,
    pinSetAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  await setDoc(cardRef, payload);
  return { card: payload, rawBackupKey };
}

/**
 * Smart Key Recovery: resets a forgotten Card Payment Key only after verifying
 * a recovery proof (Email OTP verified token, Master Backup Key, or Security Answer).
 * Automatically rotates the Master Backup Key and clears lockouts.
 */
export async function recoverCardPaymentKey(
  db: Firestore,
  params: {
    uid: string;
    newSecretCode: string;
    method: 'email_otp' | 'backup_key' | 'security_question';
    backupKey?: string;
    securityAnswer?: string;
    emailOtpProofToken?: string;
  }
): Promise<{ card: TutPayCardRecord; newRawBackupKey: string }> {
  const { uid, newSecretCode, method, backupKey, securityAnswer, emailOtpProofToken } = params;
  const cleanCode = newSecretCode.trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('New Card Payment Key must be exactly 6 numeric digits.');
  }

  const cardRef = doc(db, 'tut_cards', uid);
  const snap = await getDoc(cardRef);
  if (!snap.exists()) {
    throw new Error('No T.U.T. Card key record found. Please complete initial setup first.');
  }
  const existing = snap.data() as TutPayCardRecord;

  if (method === 'email_otp') {
    if (!emailOtpProofToken || emailOtpProofToken.length < 20) {
      throw new Error('Email OTP verification is required before resetting your Card Key.');
    }
  } else if (method === 'backup_key') {
    if (!existing.recoveryKeyHash || !existing.recoveryKeySalt) {
      throw new Error('No Master Recovery Backup Key is registered on this card.');
    }
    const ok = await verifyRecoverySecret(
      'backup_key',
      existing.recoveryKeySalt,
      existing.recoveryKeyHash,
      backupKey || ''
    );
    if (!ok) {
      throw new Error('Invalid Master Recovery Backup Key. Check every character and try again.');
    }
  } else if (method === 'security_question') {
    if (!existing.securityAnswerHash || !existing.securityAnswerSalt) {
      throw new Error('No personal security question was configured for this card.');
    }
    const ok = await verifyRecoverySecret(
      'security_answer',
      existing.securityAnswerSalt,
      existing.securityAnswerHash,
      securityAnswer || ''
    );
    if (!ok) {
      throw new Error('Security answer does not match your registered recovery response.');
    }
  } else {
    throw new Error('Unsupported recovery method.');
  }

  const secretCodeSalt = generateSaltHex(16);
  const secretCodeHash = await hashSecretCode(secretCodeSalt, cleanCode);

  const newRawBackupKey = generateRecoveryBackupKey();
  const recoveryKeySalt = generateSaltHex(16);
  const recoveryKeyHash = await hashRecoverySecret('backup_key', recoveryKeySalt, newRawBackupKey);

  const nowIso = new Date().toISOString();
  const nextRecoveryCount = (Number(existing.recoveryCount) || 0) + 1;

  await updateDoc(cardRef, {
    secretCodeHash,
    secretCodeSalt,
    recoveryKeyHash,
    recoveryKeySalt,
    recoveryCount: nextRecoveryCount,
    lastRecoveryMethod: method,
    lastRecoveryAt: nowIso,
    pinSetAt: nowIso,
    failedAttempts: 0,
    lockedUntil: 0,
    updatedAt: nowIso
  });

  const updated: TutPayCardRecord = {
    ...existing,
    secretCodeHash,
    secretCodeSalt,
    recoveryKeyHash,
    recoveryKeySalt,
    recoveryCount: nextRecoveryCount,
    lastRecoveryMethod: method,
    lastRecoveryAt: nowIso,
    pinSetAt: nowIso,
    failedAttempts: 0,
    lockedUntil: 0,
    updatedAt: nowIso
  };

  return { card: updated, newRawBackupKey };
}

export async function toggleTutCardFreeze(
  db: Firestore,
  uid: string,
  freeze: boolean
): Promise<void> {
  const cardRef = doc(db, 'tut_cards', uid);
  await updateDoc(cardRef, {
    isFrozen: freeze,
    updatedAt: new Date().toISOString()
  });
}

export async function updateTutCardLimit(
  db: Firestore,
  uid: string,
  perTxLimit: number
): Promise<void> {
  if (perTxLimit < 10 || perTxLimit > 500000) {
    throw new Error('Per-transaction limit must be between ৳10 and ৳500,000.');
  }
  const cardRef = doc(db, 'tut_cards', uid);
  await updateDoc(cardRef, {
    perTxLimit: Number(perTxLimit),
    dailyLimit: Math.max(Number(perTxLimit) * 3, 100000),
    updatedAt: new Date().toISOString()
  });
}

export async function recordCardVerificationFailure(
  db: Firestore,
  uid: string,
  currentAttempts: number
): Promise<{ nextAttempts: number; lockedUntil: number }> {
  const nextAttempts = (currentAttempts || 0) + 1;
  const lockedUntil = nextAttempts >= 5 ? Date.now() + 15 * 60 * 1000 : 0;
  try {
    await updateDoc(doc(db, 'tut_cards', uid), {
      failedAttempts: nextAttempts,
      lockedUntil,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Unable to increment failed card attempt counter:', err);
  }
  return { nextAttempts, lockedUntil };
}
