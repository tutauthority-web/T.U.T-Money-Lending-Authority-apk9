import { Firestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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
  apiKeyHash: string;
  allowedOrigins?: string[];
  status: 'active' | 'paused';
  totalProcessed: number;
  txCount: number;
  createdAt?: string;
  updatedAt?: string;
}

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

export async function hashSecretCode(salt: string, secretCode: string): Promise<string> {
  return sha256Hex(`tut-card-v1:${salt}:${secretCode.trim()}`);
}

export async function verifySecretCode(salt: string, expectedHash: string, candidateCode: string): Promise<boolean> {
  if (!salt || !expectedHash || !candidateCode) return false;
  const candidateHash = await hashSecretCode(salt, candidateCode);
  if (candidateHash.length !== expectedHash.length) return false;
  // Constant-time string comparison
  let diff = 0;
  for (let i = 0; i < candidateHash.length; i++) {
    diff |= candidateHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
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
    year: String(future.getFullYear()).slice(-2),
  };
}

/**
 * Activates or rotates the 6-digit Secret Payment Code for a member's T.U.T. Card.
 * Never persists the plaintext Secret Code to Firestore — only the salted SHA-256 digest.
 */
export async function saveTutCardSecuritySetup(
  db: Firestore,
  params: {
    uid: string;
    memberId?: string;
    secretCode: string;
    perTxLimit?: number;
    subscriptionExpiresAt?: string | null;
  }
): Promise<TutPayCardRecord> {
  const { uid, memberId, secretCode, perTxLimit = 50000, subscriptionExpiresAt } = params;
  const cleanCode = secretCode.trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('Secret Payment Code must be exactly 6 numeric digits.');
  }
  if (perTxLimit < 10 || perTxLimit > 500000) {
    throw new Error('Per-transaction limit must be between ৳10 and ৳500,000.');
  }

  const cardNumber = deriveDeterministicCardNumber(uid, memberId);
  const cardLast4 = cardNumber.slice(-4);
  const cardHash = await sha256Hex(`tut-pan-v1:${uid}:${cardNumber}`);
  const salt = generateSaltHex(16);
  const secretCodeHash = await hashSecretCode(salt, cleanCode);
  const { month, year } = normalizeExpiry(subscriptionExpiresAt);
  const nowIso = new Date().toISOString();

  const cardRef = doc(db, 'tut_cards', uid);
  const existing = await getDoc(cardRef);

  const payload: TutPayCardRecord = {
    userId: uid,
    memberId: memberId || '',
    cardNumber,
    cardLast4,
    cardHash,
    expiryMonth: month,
    expiryYear: year,
    secretCodeHash,
    secretCodeSalt: salt,
    isActive: true,
    isFrozen: existing.exists() ? Boolean(existing.data()?.isFrozen) : false,
    perTxLimit: Number(perTxLimit),
    dailyLimit: Math.max(Number(perTxLimit) * 3, 100000),
    failedAttempts: 0,
    lockedUntil: 0,
    pinSetAt: nowIso,
    createdAt: existing.exists() ? existing.data()?.createdAt || nowIso : nowIso,
    updatedAt: nowIso,
  };

  await setDoc(cardRef, payload, { merge: true });
  return payload;
}

export async function toggleTutCardFreeze(
  db: Firestore,
  uid: string,
  freeze: boolean
): Promise<void> {
  const cardRef = doc(db, 'tut_cards', uid);
  await updateDoc(cardRef, {
    isFrozen: freeze,
    updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString(),
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
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Unable to increment failed card attempt counter:', err);
  }
  return { nextAttempts, lockedUntil };
}
