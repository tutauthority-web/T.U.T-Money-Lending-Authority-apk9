import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { generateHumanEmployeeResponse } from "../src/utils/workforceKnowledge";

dotenv.config();

export interface CreateApiAppOptions {
  serverless?: boolean;
}

interface FirebasePublicConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
  apiKey?: string;
  authDomain?: string;
  appId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const loadFirebasePublicConfig = (): FirebasePublicConfig => {
  const candidates = [
    path.join(process.cwd(), "firebase-applet-config.json"),
    path.join(process.cwd(), "..", "firebase-applet-config.json"),
    ...(typeof __dirname !== "undefined"
      ? [
          path.resolve(__dirname, "../firebase-applet-config.json"),
          path.resolve(__dirname, "../../firebase-applet-config.json")
        ]
      : [])
  ];

  let fromFile: FirebasePublicConfig = {};
  for (const candidatePath of candidates) {
    try {
      if (fs.existsSync(candidatePath)) {
        const raw = fs.readFileSync(candidatePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          fromFile = parsed;
          break;
        }
      }
    } catch {
      // try next path
    }
  }

  return {
    projectId: process.env.TUT_FIREBASE_PROJECT_ID?.trim() || fromFile.projectId || "",
    firestoreDatabaseId:
      process.env.TUT_FIREBASE_DATABASE_ID?.trim() || fromFile.firestoreDatabaseId || "",
    apiKey: process.env.TUT_FIREBASE_API_KEY?.trim() || fromFile.apiKey || "",
    authDomain: process.env.TUT_FIREBASE_AUTH_DOMAIN?.trim() || fromFile.authDomain || "",
    appId: process.env.TUT_FIREBASE_APP_ID?.trim() || fromFile.appId || "",
    storageBucket: process.env.TUT_FIREBASE_STORAGE_BUCKET?.trim() || fromFile.storageBucket || "",
    messagingSenderId:
      process.env.TUT_FIREBASE_MESSAGING_SENDER_ID?.trim() || fromFile.messagingSenderId || ""
  };
};

// Cryptographic signing secret for payment receipts (reads env secret or generates ephemeral 256-bit secret in memory)
const HAS_PERSISTENT_SIGNING_SECRET = Boolean(process.env.TUT_GATEWAY_SIGNING_SECRET?.trim());
const GATEWAY_SIGNING_SECRET =
  process.env.TUT_GATEWAY_SIGNING_SECRET?.trim() || crypto.randomBytes(32).toString("hex");

// Helper wrapper to protect Express 4 async routes from uncaught exceptions
export const safeAsync = (fn: express.RequestHandler): express.RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export function mountBaseSecurityMiddleware(app: express.Express): void {
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Safe JSON body parser: Vercel @vercel/node may pre-parse req.body before Express sees it
  const jsonMiddleware = express.json({ limit: "8mb" });
  app.use((req, res, next) => {
    if (
      req.body !== undefined &&
      req.body !== null &&
      typeof req.body === "object" &&
      !Buffer.isBuffer(req.body)
    ) {
      return next();
    }
    return jsonMiddleware(req, res, next);
  });
}

export function mountApiRoutes(
  app: express.Express,
  options: CreateApiAppOptions = {}
): void {
  const isServerless = Boolean(options.serverless || process.env.VERCEL);
  const FIREBASE_PUBLIC_CONFIG = loadFirebasePublicConfig();

  // ==============================================================================
  // GEMINI AI MULTI-KEY POOL & DEDICATED CHATBOT CREDITS MANAGER
  // ==============================================================================
  interface KeyCandidate {
    key: string;
    label: string;
    assignedAgentId?: string;
  }

  const cleanKey = (k?: string): string | null => {
    const trimmed = k?.trim();
    if (!trimmed || trimmed === "MY_GEMINI_API_KEY" || trimmed.length < 10) return null;
    return trimmed;
  };

  const getAvailableGeminiKeys = (forAgentId?: string, forAgentName?: string): KeyCandidate[] => {
    const candidates: KeyCandidate[] = [];

    // Dedicated keys for each officer (saves credits across separate accounts/projects)
    const keyOfficer1 = cleanKey(
      process.env.GEMINI_API_KEY_OFFICER_1 || process.env.GEMINI_API_KEY_ZUBAIR
    );
    const keyOfficer2 = cleanKey(
      process.env.GEMINI_API_KEY_OFFICER_2 || process.env.GEMINI_API_KEY_NUSRAT
    );

    // Primary & backup keys
    const keyMain = cleanKey(process.env.GEMINI_API_KEY);
    const key2 = cleanKey(process.env.GEMINI_API_KEY_2);
    const key3 = cleanKey(process.env.GEMINI_API_KEY_3);
    const key4 = cleanKey(process.env.GEMINI_API_KEY_4);

    // Comma-delimited pool
    const rawList = process.env.GEMINI_API_KEYS || "";
    const poolKeys = rawList
      .split(",")
      .map((s) => cleanKey(s))
      .filter((s): s is string => !!s);

    const isOfficer1 =
      forAgentId === "EMP-00101" ||
      (forAgentName && forAgentName.toLowerCase().includes("zubair"));
    const isOfficer2 =
      forAgentId === "EMP-00102" ||
      (forAgentName && forAgentName.toLowerCase().includes("nusrat"));

    if (isOfficer1 && keyOfficer1) {
      candidates.push({
        key: keyOfficer1,
        label: "Dedicated Key for Zubair Ahmed (EMP-00101)",
        assignedAgentId: "EMP-00101"
      });
    }
    if (isOfficer2 && keyOfficer2) {
      candidates.push({
        key: keyOfficer2,
        label: "Dedicated Key for Nusrat Jahan (EMP-00102)",
        assignedAgentId: "EMP-00102"
      });
    }

    if (keyMain) {
      candidates.push({ key: keyMain, label: "Primary Default GEMINI_API_KEY" });
    }

    if (!isOfficer1 && keyOfficer1) {
      candidates.push({
        key: keyOfficer1,
        label: "Shared Failover Pool (Officer 1 Key)",
        assignedAgentId: "EMP-00101"
      });
    }
    if (!isOfficer2 && keyOfficer2) {
      candidates.push({
        key: keyOfficer2,
        label: "Shared Failover Pool (Officer 2 Key)",
        assignedAgentId: "EMP-00102"
      });
    }

    if (key2) candidates.push({ key: key2, label: "Secondary GEMINI_API_KEY_2" });
    if (key3) candidates.push({ key: key3, label: "Tertiary GEMINI_API_KEY_3" });
    if (key4) candidates.push({ key: key4, label: "Quaternary GEMINI_API_KEY_4" });

    poolKeys.forEach((k, idx) => {
      candidates.push({ key: k, label: `Pooled Key #${idx + 1}` });
    });

    const seen = new Set<string>();
    return candidates.filter((c) => {
      if (seen.has(c.key)) return false;
      seen.add(c.key);
      return true;
    });
  };

  const executeWithGeminiPool = async <T>(
    agentId: string | undefined,
    agentName: string | undefined,
    operation: (ai: GoogleGenAI, keyLabel: string) => Promise<T>
  ): Promise<T> => {
    const keys = getAvailableGeminiKeys(agentId, agentName);
    if (keys.length === 0) {
      throw new Error("No active GEMINI_API_KEY configured in environment variables or secrets.");
    }

    let lastError: any = null;
    for (let i = 0; i < keys.length; i++) {
      const candidate = keys[i];
      try {
        const ai = new GoogleGenAI({
          apiKey: candidate.key,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build"
            }
          }
        });
        return await operation(ai, candidate.label);
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const hasNext = i < keys.length - 1;
        console.warn(
          `[Gemini Multi-Key Failover] ${candidate.label} encountered issue: ${errMsg}. ${
            hasNext ? `Switching to next key (${keys[i + 1].label})...` : "All available keys attempted."
          }`
        );
      }
    }
    throw lastError;
  };

  const generateWithModelFallback = async (ai: GoogleGenAI, contents: any, config: any) => {
    const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let lastErr: any = null;
    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      try {
        return await ai.models.generateContent({
          model,
          contents,
          config
        });
      } catch (err: any) {
        lastErr = err;
        const errMsg = err?.message || String(err);
        const isTemporarySpike =
          err?.status === 503 ||
          errMsg.includes("503") ||
          errMsg.includes("high demand") ||
          errMsg.includes("UNAVAILABLE");

        if (isTemporarySpike && i < candidateModels.length - 1) {
          console.warn(
            `[Gemini Model Auto-Fallback] ${model} experiencing temporary demand spike. Automatically routing to ${candidateModels[i + 1]}...`
          );
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  };

  // Live SMTP Verification State
  let cachedAuthFailure: { fingerprint: string; message: string; timestamp: number } | null = null;
  let lastSmtpCheck: {
    checked: boolean;
    connected: boolean | null;
    code: string;
    error: string | null;
    latencyMs: number;
    checkedAt: string | null;
  } = {
    checked: false,
    connected: null,
    code: "UNCHECKED",
    error: null,
    latencyMs: 0,
    checkedAt: null
  };

  const getGmailCreds = () => {
    const authUser = (
      process.env.TUT_AUTHORITY_GMAIL_USER || process.env.AUTHORITY_GMAIL_USER
    )?.trim();
    const authPass = (
      process.env.TUT_AUTHORITY_GMAIL_APP_PASSWORD || process.env.AUTHORITY_GMAIL_APP_PASSWORD
    )
      ?.replace(/\s+/g, "")
      .trim();
    if (authUser && authPass) {
      return {
        gmailUser: authUser,
        gmailPass: authPass,
        senderSource: process.env.TUT_AUTHORITY_GMAIL_USER
          ? "TUT_AUTHORITY_GMAIL_USER"
          : "AUTHORITY_GMAIL_USER"
      };
    }
    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "").trim();
    return {
      gmailUser,
      gmailPass,
      senderSource: gmailUser ? "GMAIL_USER" : null
    };
  };

  const maskEmail = (email?: string) => {
    if (!email) return null;
    const parts = email.split("@");
    if (parts.length !== 2) return email;
    const local = parts[0];
    const shown = local.length > 3 ? `${local.slice(0, 3)}***` : `${local.slice(0, 1)}***`;
    return `${shown}@${parts[1]}`;
  };

  const verifyGmailSmtpNow = async () => {
    const { gmailUser, gmailPass, senderSource } = getGmailCreds();
    const checkedAt = new Date().toISOString();

    if (!gmailUser || !gmailPass) {
      lastSmtpCheck = {
        checked: true,
        connected: false,
        code: "NOT_CONFIGURED",
        error:
          "Missing GMAIL_USER or GMAIL_APP_PASSWORD in AI Studio Secrets / Vercel Environment Variables.",
        latencyMs: 0,
        checkedAt
      };
      return { ...lastSmtpCheck, gmailUser, gmailPass, senderSource };
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass }
    });

    const startedAt = Date.now();
    try {
      await transporter.verify();
      const latencyMs = Date.now() - startedAt;
      cachedAuthFailure = null;
      lastSmtpCheck = {
        checked: true,
        connected: true,
        code: "OK",
        error: null,
        latencyMs,
        checkedAt
      };
      return { ...lastSmtpCheck, gmailUser, gmailPass, senderSource };
    } catch (error: any) {
      const latencyMs = Date.now() - startedAt;
      const isAuthError =
        error?.code === "EAUTH" ||
        error?.responseCode === 535 ||
        String(error?.message || "").includes("535-5.7.8") ||
        String(error?.message || "").includes("Username and Password not accepted");

      const errorMessage = isAuthError
        ? "Gmail rejected the App Password (535-5.7.8). Ensure 2-Step Verification is active on the Google account and generate a fresh 16-character App Password."
        : error?.message || "Unable to reach Gmail SMTP server.";

      const credFingerprint = `${gmailUser}:${gmailPass.length}:${gmailPass.slice(0, 2)}`;
      if (isAuthError) {
        cachedAuthFailure = {
          fingerprint: credFingerprint,
          message: errorMessage,
          timestamp: Date.now()
        };
      }

      lastSmtpCheck = {
        checked: true,
        connected: false,
        code: isAuthError ? "EAUTH" : error?.code || "VERIFY_FAILED",
        error: errorMessage,
        latencyMs,
        checkedAt
      };
      return { ...lastSmtpCheck, gmailUser, gmailPass, senderSource: getGmailCreds().senderSource };
    }
  };

  // Run boot-time SMTP verification only on persistent Node server, never blocking serverless cold starts
  if (!isServerless) {
    verifyGmailSmtpNow().catch(() => {});
  }

  // Health Check
  app.get("/api/health", (_req, res) => {
    const { gmailUser, gmailPass, senderSource } = getGmailCreds();
    const resendConfigured = !!cleanKey(process.env.RESEND_API_KEY);
    const officer1KeySet = !!cleanKey(
      process.env.GEMINI_API_KEY_OFFICER_1 || process.env.GEMINI_API_KEY_ZUBAIR
    );
    const officer2KeySet = !!cleanKey(
      process.env.GEMINI_API_KEY_OFFICER_2 || process.env.GEMINI_API_KEY_NUSRAT
    );
    const primaryKeySet = !!cleanKey(process.env.GEMINI_API_KEY);
    const secondaryKeySet = !!cleanKey(process.env.GEMINI_API_KEY_2);
    const allKeys = getAvailableGeminiKeys();
    const credsPresent = !!gmailUser && gmailPass?.length === 16;

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      hostingMode: isServerless ? "vercel-serverless" : "node-server",
      vercelEnv: process.env.VERCEL_ENV || null,
      config: {
        gmailUserSet: !!gmailUser,
        gmailAppPasswordSet: !!gmailPass,
        gmailAppPasswordLength: gmailPass?.length || 0,
        isCorrectLength: gmailPass?.length === 16,
        senderEmail: maskEmail(gmailUser),
        activeSenderEmail: gmailUser || null,
        senderDisplayName: "T.U.T Authority",
        senderAvatarUrl: "/assets/tut-authority-logo.jpg",
        senderSource,
        emailGatewayReady: lastSmtpCheck.checked
          ? Boolean(lastSmtpCheck.connected || resendConfigured)
          : Boolean(credsPresent || resendConfigured),
        smtpVerified: lastSmtpCheck.connected,
        smtpCode: lastSmtpCheck.code,
        smtpError: lastSmtpCheck.error,
        smtpLatencyMs: lastSmtpCheck.latencyMs,
        smtpCheckedAt: lastSmtpCheck.checkedAt,
        hasResendFallback: resendConfigured,
        adminEmail: process.env.ADMIN_EMAIL?.trim() || "tahsinullahtusher999@gmail.com",
        persistentSigningSecretConfigured: HAS_PERSISTENT_SIGNING_SECRET,
        firebaseConfigLoaded: Boolean(FIREBASE_PUBLIC_CONFIG.projectId && FIREBASE_PUBLIC_CONFIG.apiKey)
      },
      geminiAi: {
        totalKeysInPool: allKeys.length,
        officer1DedicatedKey: officer1KeySet,
        officer2DedicatedKey: officer2KeySet,
        primaryKeySet,
        secondaryKeySet,
        multiKeyPoolActive: allKeys.length > 1
      }
    });
  });

  // Banking Ledger System Status & Security Endpoint
  app.get(
    "/api/banking/system-status",
    safeAsync(async (_req, res) => {
      res.json({
        status: "operational",
        hostingMode: isServerless ? "vercel-serverless" : "node-server",
        architecture: "Google Cloud Firestore Enterprise with Atomic ACID Transactions",
        security: {
          atomicTransactions: true,
          p2pTransferAtomicProtection: true,
          adminApprovalAtomicProtection: true,
          loanSettlementAtomicProtection: true,
          dataEncryptedAtRest: true,
          dataEncryptedInTransit: true,
          immutableAuditTrail: true
        },
        timestamp: new Date().toISOString()
      });
    })
  );

  // ==============================================================================
  // T.U.T. PAYMENT GATEWAY: PUBLIC DISCOVERY, ID TOKEN GUARDED RECEIPT SIGNING & VERIFY
  // ==============================================================================
  const gatewayRateBuckets = new Map<string, { count: number; resetAt: number }>();
  const checkGatewayRateLimit = (ipKey: string, maxPerMin = 40): boolean => {
    const now = Date.now();
    const bucket = gatewayRateBuckets.get(ipKey);
    if (!bucket || now > bucket.resetAt) {
      gatewayRateBuckets.set(ipKey, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (bucket.count >= maxPerMin) return false;
    bucket.count += 1;
    return true;
  };

  const canonicalReceiptMessage = (p: {
    txId: string;
    memoId: string;
    merchantId?: string;
    merchantName: string;
    orderId: string;
    amount: number;
    currency: string;
    payerUid: string;
    payerMemberId?: string;
    method: string;
    timestamp: string;
  }) => {
    return [
      "TUT-RECEIPT-V1",
      String(p.txId || "").trim(),
      String(p.memoId || "").trim(),
      String(p.merchantId || "").trim(),
      String(p.merchantName || "").trim(),
      String(p.orderId || "").trim(),
      Number(p.amount || 0).toFixed(2),
      String(p.currency || "BDT").toUpperCase(),
      String(p.payerUid || "").trim(),
      String(p.payerMemberId || "").trim(),
      String(p.method || "").trim(),
      String(p.timestamp || "").trim()
    ].join("|");
  };

  const signReceiptPayload = (payload: Parameters<typeof canonicalReceiptMessage>[0]) => {
    const msg = canonicalReceiptMessage(payload);
    return crypto.createHmac("sha256", GATEWAY_SIGNING_SECRET).update(msg).digest("hex");
  };

  const resolveRequestBaseUrl = (req: express.Request): string => {
    const rawProto = req.headers["x-forwarded-proto"];
    const hostProto =
      String(Array.isArray(rawProto) ? rawProto[0] : rawProto || req.protocol || "https")
        .split(",")[0]
        .trim() || "https";
    const rawHost = req.headers["x-forwarded-host"] || req.get("host") || "";
    const host = String(Array.isArray(rawHost) ? rawHost[0] : rawHost)
      .split(",")[0]
      .trim();
    return host ? `${hostProto}://${host}` : "";
  };

  // Public Gateway Config (zero secrets, strictly Firebase public client keys + gateway URLs)
  app.options("/api/gateway/public-config", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });

  app.get("/api/gateway/public-config", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    const baseUrl = resolveRequestBaseUrl(req);

    res.json({
      provider: "T.U.T. Private Lending Authority",
      currency: "BDT",
      hostingMode: isServerless ? "vercel-serverless" : "node-server",
      persistentSigningSecretConfigured: HAS_PERSISTENT_SIGNING_SECRET,
      firebase: {
        projectId: FIREBASE_PUBLIC_CONFIG.projectId || "",
        firestoreDatabaseId: FIREBASE_PUBLIC_CONFIG.firestoreDatabaseId || "",
        apiKey: FIREBASE_PUBLIC_CONFIG.apiKey || "",
        authDomain: FIREBASE_PUBLIC_CONFIG.authDomain || "",
        appId: FIREBASE_PUBLIC_CONFIG.appId || "",
        storageBucket: FIREBASE_PUBLIC_CONFIG.storageBucket || "",
        messagingSenderId: FIREBASE_PUBLIC_CONFIG.messagingSenderId || ""
      },
      gateway: {
        checkoutUrl: `${baseUrl}/pay`,
        queryCheckoutUrl: `${baseUrl}/?tut_pay=1`,
        verifyReceiptUrl: `${baseUrl}/api/gateway/verify-receipt`,
        publicConfigUrl: `${baseUrl}/api/gateway/public-config`,
        supportedInstruments: ["tut_card", "tut_wallet", "tut_credit"]
      }
    });
  });

  app.options("/api/gateway/sign-receipt", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });

  // Issues an unforgeable HMAC-SHA256 signed receipt after Firebase ID token verification
  app.post(
    "/api/gateway/sign-receipt",
    safeAsync(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
      if (!checkGatewayRateLimit(`sign:${clientIp}`, 30)) {
        return res
          .status(429)
          .json({ success: false, error: "Too many gateway requests. Please wait a minute." });
      }

      const authHeader = String(req.headers.authorization || "");
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!idToken) {
        return res
          .status(401)
          .json({ success: false, error: "Missing Firebase Authorization Bearer token." });
      }

      const {
        txId,
        memoId,
        merchantId = "",
        merchantName,
        orderId,
        amount,
        payerUid,
        payerMemberId = "",
        method
      } = req.body || {};
      if (
        !txId ||
        !memoId ||
        !merchantName ||
        !orderId ||
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0 ||
        !payerUid
      ) {
        return res.status(400).json({ success: false, error: "Invalid receipt payload." });
      }

      const firebaseApiKey = FIREBASE_PUBLIC_CONFIG.apiKey;
      if (!firebaseApiKey) {
        return res
          .status(500)
          .json({ success: false, error: "Firebase public configuration missing." });
      }

      const verifyResp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
          firebaseApiKey
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken })
        }
      );
      const verifyData = await verifyResp.json().catch(() => ({}));
      const tokenUser = Array.isArray(verifyData?.users) ? verifyData.users[0] : null;
      if (!verifyResp.ok || !tokenUser || tokenUser.localId !== payerUid) {
        return res
          .status(403)
          .json({ success: false, error: "Caller identity could not be verified." });
      }

      const timestamp = new Date().toISOString();
      const receipt = {
        txId: String(txId),
        memoId: String(memoId),
        merchantId: String(merchantId || ""),
        merchantName: String(merchantName).slice(0, 120),
        orderId: String(orderId).slice(0, 120),
        amount: Number(amount),
        currency: "BDT",
        payerUid: String(payerUid),
        payerEmail: String(tokenUser.email || ""),
        payerMemberId: String(payerMemberId || ""),
        method: String(method || "T.U.T. Wallet"),
        timestamp
      };

      const signature = signReceiptPayload(receipt);
      res.json({ success: true, receipt, signature });
    })
  );

  // Allows external apps to cryptographically verify a T.U.T. payment receipt
  app.options("/api/gateway/verify-receipt", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });

  app.post(
    "/api/gateway/verify-receipt",
    safeAsync(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
      if (!checkGatewayRateLimit(`verify:${clientIp}`, 60)) {
        return res.status(429).json({ valid: false, error: "Rate limit exceeded." });
      }

      const { receipt, signature } = req.body || {};
      if (!receipt || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature.trim())) {
        return res
          .status(400)
          .json({ valid: false, error: "Receipt payload and 64-char hex signature are required." });
      }

      const expectedSig = signReceiptPayload(receipt);
      const sigBuf = Buffer.from(signature.trim().toLowerCase(), "hex");
      const expectedBuf = Buffer.from(expectedSig.toLowerCase(), "hex");
      const isMatch =
        sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);

      if (!isMatch) {
        return res.status(401).json({ valid: false, error: "Invalid receipt signature." });
      }

      res.json({
        valid: true,
        verifiedAt: new Date().toISOString(),
        memoId: receipt.memoId,
        amount: receipt.amount,
        currency: receipt.currency || "BDT",
        orderId: receipt.orderId,
        merchantName: receipt.merchantName,
        payerEmail: receipt.payerEmail || null
      });
    })
  );

  // Optional secondary HTTP relay if RESEND_API_KEY is configured
  const tryResendFallback = async (params: {
    to: string;
    subject: string;
    text: string;
    html: string;
    attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  }) => {
    const resendKey = cleanKey(process.env.RESEND_API_KEY);
    if (!resendKey) return null;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL?.trim() || "T.U.T Authority <onboarding@resend.dev>";
    const startedAt = Date.now();
    try {
      const resendAttachments =
        Array.isArray(params.attachments) && params.attachments.length > 0
          ? params.attachments.map((att) => ({
              filename: att.filename,
              content: att.content
            }))
          : undefined;

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [params.to],
          subject: params.subject,
          text: params.text,
          html: params.html,
          ...(resendAttachments ? { attachments: resendAttachments } : {})
        })
      });
      const json = await resp.json().catch(() => ({}));
      const latencyMs = Date.now() - startedAt;
      if (resp.ok && json?.id) {
        return { success: true, latencyMs, messageId: json.id, provider: "resend" };
      }
      return { success: false, latencyMs, error: json?.message || "Resend fallback failed" };
    } catch (e: any) {
      return {
        success: false,
        latencyMs: Date.now() - startedAt,
        error: e?.message || "Resend network error"
      };
    }
  };

  // API Route for sending emails
  app.post(
    "/api/send-email",
    safeAsync(async (req, res) => {
      if (!req.body) {
        return res.status(400).json({ success: false, error: "Missing request body" });
      }
      const { to, subject, text, html, forceRetry, attachments } = req.body;

      const normalizedAttachments = Array.isArray(attachments)
        ? attachments
            .filter(
              (a: any) =>
                a &&
                typeof a.filename === "string" &&
                typeof a.content === "string" &&
                a.content.length > 0
            )
            .slice(0, 4)
            .map((a: any) => ({
              filename: a.filename,
              content: a.content,
              encoding: a.encoding === "base64" ? "base64" : "base64",
              ...(a.contentType ? { contentType: a.contentType } : {})
            }))
        : undefined;

      if (!to) {
        return res
          .status(400)
          .json({ success: false, error: "Required parameter 'to' is missing or empty" });
      }

      const { gmailUser, gmailPass } = getGmailCreds();

      if (!gmailUser || !gmailPass) {
        const relay = await tryResendFallback({
          to,
          subject: subject || "T.U.T. Account Notification",
          text: text || "",
          html: html || "",
          attachments: normalizedAttachments
        });
        if (relay?.success) {
          return res.json(relay);
        }

        console.warn("[Email Gateway] Gmail credentials not configured; skipping SMTP dispatch.");
        return res.json({
          success: false,
          code: "NOT_CONFIGURED",
          retryable: true,
          latencyMs: 0,
          error:
            "Email service not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD in AI Studio Secrets or Vercel Environment Variables."
        });
      }

      const credFingerprint = `${gmailUser}:${gmailPass.length}:${gmailPass.slice(0, 2)}`;
      if (
        !forceRetry &&
        cachedAuthFailure &&
        cachedAuthFailure.fingerprint === credFingerprint &&
        Date.now() - cachedAuthFailure.timestamp < 2 * 60 * 1000
      ) {
        const relay = await tryResendFallback({
          to,
          subject: subject || "T.U.T. Account Notification",
          text: text || "",
          html: html || "",
          attachments: normalizedAttachments
        });
        if (relay?.success) {
          return res.json(relay);
        }
        return res.json({
          success: false,
          code: "EAUTH",
          retryable: false,
          latencyMs: 0,
          error: cachedAuthFailure.message
        });
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });

      const startedAt = Date.now();
      try {
        const info = await transporter.sendMail({
          from: `"T.U.T Authority" <${gmailUser}>`,
          to,
          subject: subject || "T.U.T Authority Notification",
          text: text || "",
          html: html || "",
          ...(normalizedAttachments && normalizedAttachments.length > 0
            ? { attachments: normalizedAttachments }
            : {})
        });
        const latencyMs = Date.now() - startedAt;
        cachedAuthFailure = null;
        lastSmtpCheck = {
          checked: true,
          connected: true,
          code: "OK",
          error: null,
          latencyMs,
          checkedAt: new Date().toISOString()
        };
        console.log(`[Server] Email sent successfully to: ${to} (${latencyMs}ms)`);
        res.json({
          success: true,
          latencyMs,
          messageId: info?.messageId || null,
          provider: "gmail"
        });
      } catch (error: any) {
        const latencyMs = Date.now() - startedAt;
        const isAuthError =
          error?.code === "EAUTH" ||
          error?.responseCode === 535 ||
          String(error?.message || "").includes("535-5.7.8") ||
          String(error?.message || "").includes("Username and Password not accepted");

        const errorMessage = isAuthError
          ? "Gmail authentication failed (535-5.7.8). Check GMAIL_USER and generate a fresh 16-character GMAIL_APP_PASSWORD with 2-Step Verification enabled."
          : error?.message || "Failed to send email";

        if (isAuthError) {
          if (!cachedAuthFailure || cachedAuthFailure.fingerprint !== credFingerprint) {
            console.warn(
              `[Email Gateway] Gmail authentication rejected (535-5.7.8) for ${gmailUser}. Verify GMAIL_APP_PASSWORD.`
            );
          }
          cachedAuthFailure = {
            fingerprint: credFingerprint,
            message: errorMessage,
            timestamp: Date.now()
          };
        } else {
          console.warn(`[Email Gateway] Delivery warning to ${to}:`, errorMessage);
        }

        lastSmtpCheck = {
          checked: true,
          connected: false,
          code: isAuthError ? "EAUTH" : error?.code || "SEND_FAILED",
          error: errorMessage,
          latencyMs,
          checkedAt: new Date().toISOString()
        };

        const relay = await tryResendFallback({
          to,
          subject: subject || "T.U.T. Account Notification",
          text: text || "",
          html: html || "",
          attachments: normalizedAttachments
        });
        if (relay?.success) {
          return res.json(relay);
        }

        res.json({
          success: false,
          latencyMs,
          code: isAuthError ? "EAUTH" : error?.code || "SEND_FAILED",
          retryable: !isAuthError,
          error: errorMessage
        });
      }
    })
  );

  // Live SMTP handshake & credential diagnostics endpoint
  app.post(
    "/api/email/verify",
    safeAsync(async (_req, res) => {
      const result = await verifyGmailSmtpNow();
      const resendConfigured = !!cleanKey(process.env.RESEND_API_KEY);
      return res.json({
        ok: Boolean(result.connected),
        connected: Boolean(result.connected),
        code: result.code,
        senderEmail: maskEmail(result.gmailUser),
        activeSenderEmail: result.gmailUser || null,
        senderDisplayName: "T.U.T Authority",
        senderAvatarUrl: "/assets/tut-authority-logo.jpg",
        senderSource: (result as any).senderSource || null,
        adminEmail: process.env.ADMIN_EMAIL?.trim() || "tahsinullahtusher999@gmail.com",
        gmailUserSet: !!result.gmailUser,
        gmailAppPasswordSet: !!result.gmailPass,
        passwordLengthOk: (result.gmailPass?.length || 0) === 16,
        hasResendFallback: resendConfigured,
        latencyMs: result.latencyMs,
        checkedAt: result.checkedAt || new Date().toISOString(),
        error: result.error
      });
    })
  );

  // Digital Workforce Chat API Route
  app.post(
    "/api/digital-workforce/chat",
    safeAsync(async (req, res) => {
      if (!req.body) {
        return res.status(400).json({ error: "Missing request body" });
      }
      const { messages, employee, userContext, isAdmin, preferredLanguage } = req.body;
      const lang = preferredLanguage === "bn" ? "bn" : "en";

      if (!employee || !messages || !Array.isArray(messages)) {
        return res.status(400).json({
          error: "Required parameters 'employee' and 'messages' are missing or invalid"
        });
      }

      const isCreditOfficer =
        employee.id === "EMP-00101" ||
        String(employee.name || "")
          .toLowerCase()
          .includes("zubair") ||
        String(employee.department || "")
          .toLowerCase()
          .includes("credit");

      const rolePlaybook = isCreditOfficer
        ? `OFFICER SPECIALIZATION — SENIOR CREDIT & UNDERWRITING OFFICER (Zubair Ahmed):
- Primary Expertise: Borrowing limits, credit risk assessment, loan allocations, overdue rehabilitation, and repayment window eligibility.
- Credit Score Model (300–850 scale, 0% usury): Payment History (35%), Limit Utilization (30% — <30% optimal fast-track, >85% liquidity rationing), Vault Collateral Coverage (20%), Subscription Charter Loyalty (10%), KYC Integrity (5%).
- Dynamic Repayment Term Policy: Standard window is 30 days (restricted/overdue or score <580) to 40 days (1 month 10 days baseline). Verified members can unlock up to 90 days dynamically via Credit Score bonus (640+: +5d, 700+: +12d, 780+: +20d), settled repayment history (up to +15d), and low utilization + strong collateral capacity (up to +15d).
- Delinquency Rehabilitation (REG-404): Paying off an overdue loan restores up to 80% of penalty points within 24 hours of settlement.`
        : `OFFICER SPECIALIZATION — TREASURY & MEMBER CARE SPECIALIST (Nusrat Jahan):
- Primary Expertise: Segregated 1:1 Member Deposit Vault safety, withdrawals, bKash & Nagad TrxID payment verification, subscription charters, and member dispute care.
- Dual-Reserve Protection: Member Deposit Reserves are ring-fenced 1:1 in a segregated vault and never commingled with lending pools; deposits remain withdrawable anytime.
- Official Payment Channels: bKash (01713710607) and Nagad (01921801100). Always verify Transaction ID (TrxID), exact BDT amount, payment channel, and memo reference (TXN-...) during reconciliation.
- Subscription Charters: Bronze (৳50/mo -> ৳500 base limit), Silver (৳100/mo -> ৳1,500 base limit), Gold (৳150/mo -> ৳2,500 base limit); streaks unlock loyalty score and higher ceilings.`;

      try {
        const lastMessage = messages[messages.length - 1]?.text || "";
        const chatHistory = messages
          .slice(-14)
          .map(
            (msg: any) =>
              `${msg.sender === "user" ? (isAdmin ? "Admin" : "Member") : employee.name}: ${msg.text}`
          )
          .join("\n");

        const customPrompt = employee.customPrompt || "";
        const customTemp = typeof employee.temperature === "number" ? employee.temperature : null;

        if (isAdmin) {
          let systemInstruction = `You are ${employee.name}, ${employee.position} (${employee.department}, ID: ${employee.id}) at T.U.T. Money Lending Authority.
${rolePlaybook}

You are advising the System Administrator inside the Operations Console.
Live Platform, Reserve, Queue & Issues Context:
${JSON.stringify(userContext || {}, null, 2)}

EXECUTIVE BRIEFING DIRECTIVES:
1. Speak strictly as an experienced senior banking officer. Never mention AI, models, prompts, or system internals.
2. Cite exact figures from the live context (total deposits, active debt exposure, pending verifications, open/urgent issues, deposit-to-debt solvency buffer).
3. Prioritize actionable risk controls: highlight TrxID audit priorities for bKash (01713710607) & Nagad (01921801100), overdue recovery exposure, and unresolved urgent member cases.
4. Format answers clearly with concise structure (2–5 crisp sentences or short bullet points).`;

          if (customPrompt) {
            systemInstruction += `\n\nAdministrator Directives for ${employee.name}:\n${customPrompt}`;
          }

          const responseText = await executeWithGeminiPool(
            employee.id,
            employee.name,
            async (ai) => {
              const response = await generateWithModelFallback(ai, chatHistory, {
                systemInstruction,
                temperature: customTemp !== null ? customTemp : 0.22
              });
              return (
                response.text?.trim() ||
                "Operational review completed. All ledgers remain synchronized."
              );
            }
          );

          return res.json({
            response: responseText,
            escalate: false,
            issueDetected: false
          });
        } else {
          let systemInstruction = `You are ${employee.name}, ${employee.position} (${employee.department}) at T.U.T. Money Lending Authority.
${rolePlaybook}

REALISM & COMMUNICATION STANDARDS:
- Speak as a calm, expert, empathetic human banking officer.
- NEVER say you are an AI, bot, model, or automated assistant. Never use robotic disclaimers or long walls of text.
- Keep replies concise, crisp, and practical (typically 1 to 3 focused sentences).

STRICT LANGUAGE RULE:
Selected conversation language: ${lang === "bn" ? "BENGALI (বাংলা)" : "ENGLISH"}.
- Reply EXCLUSIVELY in ${
            lang === "bn"
              ? "natural, polite everyday BENGALI (বাংলা script)"
              : "clear, warm conversational ENGLISH"
          }, even if the member writes in another language or Banglish.
${
  lang === "bn"
    ? '- Use natural Bangla banking phrasing (যেমন: "আপনার বকেয়া", "সঞ্চয় ভল্ট", "বিকাশ/নগদ TrxID", "কোনো চিন্তা নেই, আমি দেখছি").'
    : ""
}

LIVE MEMBER DOSSIER, LEDGER & OPEN INQUIRIES:
${JSON.stringify(userContext || {}, null, 2)}

EXPERT ENQUIRY SKILL:
1. AUDIT BEFORE ASKING: Always check userContext.ledgerSnapshot (pendingTransactions, recentTransactions, activeLoans, overdueLoanDetails, creditScore, maxRepaymentDays) first! If a matching pending or recent transaction is already on file, quote its Memo ID, amount, payment method, and status immediately.
2. TARGETED CLARIFICATION: If the member mentions a payment delay, missing deposit, failed repayment, or vague problem WITHOUT sufficient specifics (e.g., missing TrxID, payment method bKash/Nagad, exact ৳ amount, or which transaction), ask 1–2 direct, friendly clarifying questions rather than guessing!
   - Populate needsClarification = true and list what is missing in missingDetails.
   - Do NOT open a premature duplicate ticket if they only said "I have a problem" without telling you what happened yet — set issueAction = 'none' and ask what happened first. Once they describe the actual incident/dispute, register or update the ticket immediately!

SMART REPORT NOTING & DEDUPLICATION:
- Check userContext.openIssues before opening any new issue!
- issueAction MUST be one of:
  * "none": normal Q&A, policy query, status check, or initial vague "I need to report an issue" before any facts are known.
  * "create": member reported a concrete issue, dispute, delay, missing credit, bug, or escalation NOT covered by an open issue in userContext.openIssues.
  * "update_existing": member provided follow-up evidence (like a TrxID, amount, channel, or clarification) or extra details relating to an EXISTING open issue in userContext.openIssues! Set existingIssueId to that exact ISS-XXXXX ID.
- Whenever issueAction is "create" or "update_existing":
  * issueTitle: short 4–8 word factual docket heading in English for Ops clarity (e.g., "Delayed bKash Deposit ৳1,500 TrxID Check").
  * issueDetails: factual 1–2 sentence record including amount, payment channel, TrxID/memo if known, and member's stated problem.
  * agentDiagnosis: concise investigative finding from comparing the member's claim against ledgerSnapshot (note what matched or what is still missing).
  * recommendedAction: exact operational instruction for the Admin Desk (e.g., "Verify TrxID XXXXX on bKash 01713710607 merchant log and approve TXN-...").
  * relatedTransactionId: exact TXN-... memo or TrxID if identified.
  * missingDetails: array of any remaining verification gaps (empty array if complete).
  * issuePriority: Urgent (fraud/lockout/severe dispute), High (missing money/delayed settlement/failed repayment), Medium (general delay/account update), Low (minor question).
- suggestedReplies: provide 2–3 ultra-short (2–6 word) contextual follow-up options in ${
            lang === "bn" ? "BENGALI" : "ENGLISH"
          } relevant to the next logical step in the enquiry.`;

          if (customPrompt) {
            systemInstruction += `\n\nCustom Persona/Instructions for ${employee.name}:\n${customPrompt}`;
          }

          let parsedResult: any = null;
          try {
            parsedResult = await executeWithGeminiPool(
              employee.id,
              employee.name,
              async (ai) => {
                const response = await generateWithModelFallback(ai, chatHistory, {
                  systemInstruction,
                  temperature: customTemp !== null ? customTemp : 0.3,
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      response: {
                        type: Type.STRING,
                        description:
                          "Concise, warm, expert human banking officer response in the selected language (1-3 sentences)."
                      },
                      issueAction: {
                        type: Type.STRING,
                        description: "Must be 'none', 'create', or 'update_existing'."
                      },
                      existingIssueId: {
                        type: Type.STRING,
                        description:
                          "Exact ISS-XXXXX id from userContext.openIssues when issueAction is 'update_existing'."
                      },
                      issueDetected: {
                        type: Type.BOOLEAN,
                        description: "True when issueAction is 'create' or 'update_existing'."
                      },
                      issueCategory: {
                        type: Type.STRING,
                        description:
                          "One of: 'Loan Issue', 'Deposit Help', 'Repayment Verification', 'Security / Verification', 'App Bug', 'General Inquiry'."
                      },
                      issuePriority: {
                        type: Type.STRING,
                        description: "One of: 'Low', 'Medium', 'High', 'Urgent'."
                      },
                      issueTitle: {
                        type: Type.STRING,
                        description: "Short 4-8 word factual title for the operations docket."
                      },
                      issueDetails: {
                        type: Type.STRING,
                        description:
                          "Factual incident summary including amount, channel, and TrxID/memo if present."
                      },
                      agentDiagnosis: {
                        type: Type.STRING,
                        description:
                          "Officer investigation notes comparing member statement against ledgerSnapshot."
                      },
                      recommendedAction: {
                        type: Type.STRING,
                        description:
                          "Specific next verification or resolution step for the Admin Desk."
                      },
                      relatedTransactionId: {
                        type: Type.STRING,
                        description: "Related TXN memo ID or TrxID if identified."
                      },
                      missingDetails: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description:
                          "Specific details still needed from the member (e.g. TrxID, Payment Method), or empty."
                      },
                      needsClarification: {
                        type: Type.BOOLEAN,
                        description: "True if waiting on member to supply clarifying info."
                      },
                      escalate: {
                        type: Type.BOOLEAN,
                        description:
                          "True if demanding forbidden manual bypass or direct executive intervention."
                      },
                      suggestedReplies: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description:
                          "2-3 concise contextual quick-reply suggestions in the selected language."
                      }
                    },
                    required: ["response", "issueAction", "issueDetected", "escalate"]
                  }
                });
                return JSON.parse(response.text?.trim() || "{}");
              }
            );
          } catch (jsonErr) {
            console.warn("[Gemini Multi-Key Result Parse Warning]:", jsonErr);
          }

          if (parsedResult && parsedResult.response) {
            const cleanExistingId =
              parsedResult.existingIssueId &&
              parsedResult.existingIssueId !== "null" &&
              parsedResult.existingIssueId !== "undefined"
                ? String(parsedResult.existingIssueId).trim()
                : undefined;
            const normalizedAction: "none" | "create" | "update_existing" =
              parsedResult.issueAction === "update_existing" && cleanExistingId
                ? "update_existing"
                : parsedResult.issueAction === "create" || parsedResult.issueDetected
                ? "create"
                : "none";

            return res.json({
              response: parsedResult.response,
              issueAction: normalizedAction,
              existingIssueId: cleanExistingId,
              issueDetected: normalizedAction !== "none",
              issueCategory: parsedResult.issueCategory || "General Inquiry",
              issuePriority: parsedResult.issuePriority || "Medium",
              issueTitle:
                parsedResult.issueTitle ||
                (normalizedAction !== "none" ? "Member Reported Inquiry" : ""),
              issueDetails: parsedResult.issueDetails || lastMessage,
              agentDiagnosis: parsedResult.agentDiagnosis || "",
              recommendedAction:
                parsedResult.recommendedAction || "Review member transaction ledger.",
              relatedTransactionId: parsedResult.relatedTransactionId || undefined,
              missingDetails: Array.isArray(parsedResult.missingDetails)
                ? parsedResult.missingDetails
                : [],
              needsClarification: !!parsedResult.needsClarification,
              suggestedReplies: Array.isArray(parsedResult.suggestedReplies)
                ? parsedResult.suggestedReplies.slice(0, 3)
                : [],
              escalate: !!parsedResult.escalate,
              ticketCategory: parsedResult.issueCategory || "General Help",
              ticketPriority: parsedResult.issuePriority || "Medium",
              ticketDescription: parsedResult.issueDetails || lastMessage
            });
          }

          const fallbackObj = generateHumanEmployeeResponse(
            lastMessage,
            userContext,
            employee,
            false,
            lang
          );
          return res.json(fallbackObj);
        }
      } catch (error: any) {
        console.error("[Gemini Chat API Error - Running 24/7 Fallback Engine]:", error);
        const lastMsg = (messages && messages[messages.length - 1]?.text) || "";
        const fallbackObj = generateHumanEmployeeResponse(
          lastMsg,
          userContext,
          employee,
          isAdmin,
          lang
        );
        return res.json(fallbackObj);
      }
    })
  );

  // Digital Workforce Operational Reporting API Route
  app.post(
    "/api/digital-workforce/report",
    safeAsync(async (req, res) => {
      if (!req.body) {
        return res.status(400).json({ error: "Missing request body" });
      }
      const { reportType, systemStats, recentIssues, recentTransactions, reserveSummary } = req.body;

      if (!reportType) {
        return res.status(400).json({ error: "Required parameter 'reportType' is missing" });
      }

      try {
        const reportMarkdown = await executeWithGeminiPool(undefined, undefined, async (ai) => {
          const response = await generateWithModelFallback(
            ai,
            `Compile an executive operational audit report for T.U.T. Money Lending Authority.
Report Tier: ${reportType.toUpperCase()} OPERATIONAL BRIEFING
Live Financial & Operations Metrics:
${JSON.stringify({ systemStats, reserveSummary }, null, 2)}
Recent Transaction Sample:
${JSON.stringify((recentTransactions || []).slice(0, 15), null, 2)}
Tracked Member Inquiries & Agent Diagnoses:
${JSON.stringify(recentIssues || [], null, 2)}

Structure cleanly with executive markdown headings and concise tables where helpful:
1. Executive Overview & Liquidity Coverage (Deposit Vault 1:1 segregation vs Active Debt Exposure)
2. Credit & Pending Queue Telemetry (KYC backlog, pending deposit/loan clearances, bKash 01713710607 / Nagad 01921801100 reconciliation load)
3. Desk Performance & Escalated Issues Audit (comparing Credit Desk [Zubair Ahmed] vs Treasury & Member Care Desk [Nusrat Jahan], root causes, evidence completeness, open vs resolved backlog)
4. Immediate Operational Priorities (3–5 concrete action items for Administrator review)
Tone: Concise, bank-grade, factual, strictly grounded in the numbers supplied. No filler.`,
            {
              temperature: 0.25
            }
          );
          return response.text || "Report generation completed with empty output.";
        });

        res.json({
          success: true,
          reportMarkdown
        });
      } catch (error: any) {
        console.error("[Gemini Report API Error]:", error);
        const reportTitle = (reportType || "Operations").toUpperCase();
        const stats = systemStats || {};
        const coverageRatio =
          (stats.remainingDebt || 0) > 0
            ? `${Math.round(((stats.totalDeposits || 0) / stats.remainingDebt) * 100)}%`
            : "100%+";
        const fallbackReport = `# EXECUTIVE OPERATIONAL REPORT: ${reportTitle}
**Authority:** T.U.T Money Lending Authority  
**Status:** Synchronized Ledger Summary

---

### 1. Core Platform & Liquidity Coverage
- **Registered Members:** ${stats.totalUsers || 0} (${stats.pendingMembersCount || 0} awaiting KYC review)
- **Segregated Deposit Vault:** ৳${(stats.totalDeposits || 0).toLocaleString()} BDT (1:1 Ring-Fenced)
- **Active Loan Exposure:** ৳${(stats.remainingDebt || 0).toLocaleString()} BDT across ${stats.totalLoans || 0} loan records
- **Deposit-to-Debt Buffer:** ${coverageRatio}

---

### 2. Pending Operations & Inquiry Desk
- **Pending Transactions:** ${stats.pendingTransactionsCount || 0} items awaiting TrxID / underwriting clearance
- **Active Member Inquiries:** ${(recentIssues || []).filter((i: any) => i.status !== "Resolved").length} unresolved cases logged across Credit Desk (Zubair Ahmed) & Treasury Desk (Nusrat Jahan)

---

### 3. Priority Action Items
1. Reconcile pending bKash (01713710607) and Nagad (01921801100) TrxID submissions in the transaction queue.
2. Clear open High/Urgent inquiries flagged with agent diagnoses in the Member Issues Tracker.
3. Complete pending member KYC reviews (${stats.pendingMembersCount || 0} queued).`;

        res.json({
          success: true,
          reportMarkdown: fallbackReport
        });
      }
    })
  );

  // Guard unmatched /api/* endpoints from returning SPA HTML
  app.all("/api/*", (_req, res) => {
    res.status(404).json({
      error: "API endpoint not found",
      timestamp: new Date().toISOString()
    });
  });
}

export function mountErrorHandler(app: express.Express): void {
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[Global Error Handled]:", err);
    res.status(err?.status || 500).json({
      error: "Internal Server Error",
      message: err?.message || "An unexpected error occurred on the server.",
      timestamp: new Date().toISOString()
    });
  });
}

export function createApiApp(options: CreateApiAppOptions = {}): express.Express {
  const app = express();
  mountBaseSecurityMiddleware(app);
  mountApiRoutes(app, options);
  mountErrorHandler(app);
  return app;
}
