import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { generateHumanEmployeeResponse } from "../src/utils/workforceKnowledge";
import embeddedFirebaseConfig from "../firebase-applet-config.json";

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

  let fromFile: FirebasePublicConfig = (embeddedFirebaseConfig as FirebasePublicConfig) || {};
  for (const candidatePath of candidates) {
    try {
      if (fs.existsSync(candidatePath)) {
        const raw = fs.readFileSync(candidatePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          fromFile = { ...fromFile, ...parsed };
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
  // T.U.T. CARD-ONLY PAYMENT GATEWAY v2 (VERCEL-PRIMARY, FIRESTORE-VERIFIED)
  // ==============================================================================
  const PRIMARY_VERCEL_ORIGIN = "https://t-u-t-money-lending-authority-apkma.vercel.app";
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
    cardLast4?: string;
    method: string;
    timestamp: string;
  }) => {
    return [
      "TUT-CARD-RECEIPT-V2",
      String(p.txId || "").trim(),
      String(p.memoId || "").trim(),
      String(p.merchantId || "").trim(),
      String(p.merchantName || "").trim(),
      String(p.orderId || "").trim(),
      Number(p.amount || 0).toFixed(2),
      String(p.currency || "BDT").toUpperCase(),
      String(p.payerUid || "").trim(),
      String(p.payerMemberId || "").trim(),
      String(p.cardLast4 || "").trim(),
      String(p.method || "T.U.T. Card").trim(),
      String(p.timestamp || "").trim()
    ].join("|");
  };

  const signReceiptPayload = (payload: Parameters<typeof canonicalReceiptMessage>[0]) => {
    const msg = canonicalReceiptMessage(payload);
    return crypto.createHmac("sha256", GATEWAY_SIGNING_SECRET).update(msg).digest("hex");
  };

  const signCompactData = (data: unknown): string => {
    const bodyB64 = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
    const sig = crypto
      .createHmac("sha256", GATEWAY_SIGNING_SECRET)
      .update(bodyB64)
      .digest("base64url");
    return `${bodyB64}.${sig}`;
  };

  const verifyCompactData = <T = any>(token: string): T | null => {
    if (typeof token !== "string") return null;
    const parts = token.trim().split(".");
    if (parts.length !== 2) return null;
    const [bodyB64, providedSig] = parts;
    if (!bodyB64 || !providedSig) return null;
    const expectedSig = crypto
      .createHmac("sha256", GATEWAY_SIGNING_SECRET)
      .update(bodyB64)
      .digest("base64url");
    const a = Buffer.from(providedSig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      return JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8")) as T;
    } catch {
      return null;
    }
  };

  const verifyFirebaseIdToken = async (idToken: string) => {
    const firebaseApiKey = FIREBASE_PUBLIC_CONFIG.apiKey;
    if (!firebaseApiKey) {
      throw new Error("Firebase public configuration missing.");
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
    if (!verifyResp.ok || !tokenUser?.localId) {
      return null;
    }
    return tokenUser as { localId: string; email?: string; displayName?: string };
  };

  const decodeFirestoreValue = (val: any): any => {
    if (!val || typeof val !== "object") return undefined;
    if ("stringValue" in val) return val.stringValue;
    if ("integerValue" in val) return Number(val.integerValue);
    if ("doubleValue" in val) return Number(val.doubleValue);
    if ("booleanValue" in val) return Boolean(val.booleanValue);
    if ("timestampValue" in val) return val.timestampValue;
    if ("nullValue" in val) return null;
    if ("arrayValue" in val) {
      const values = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
      return values.map(decodeFirestoreValue);
    }
    if ("mapValue" in val) {
      const fields = val.mapValue?.fields || {};
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(fields)) {
        out[k] = decodeFirestoreValue(v);
      }
      return out;
    }
    return undefined;
  };

  const readFirestoreDocWithUserToken = async (
    collectionPath: string,
    docId: string,
    idToken: string
  ): Promise<Record<string, any> | null> => {
    const projectId = FIREBASE_PUBLIC_CONFIG.projectId;
    const databaseId = FIREBASE_PUBLIC_CONFIG.firestoreDatabaseId || "(default)";
    if (!projectId) {
      throw new Error("Firebase projectId missing.");
    }
    const safeCol = collectionPath.replace(/^\/+|\/+$/g, "");
    const safeId = encodeURIComponent(docId.trim());
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents/${safeCol}/${safeId}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json"
      }
    });
    if (resp.status === 404) return null;
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      throw new Error(`Firestore read rejected (${resp.status}): ${errBody.slice(0, 200)}`);
    }
    const docJson = await resp.json().catch(() => null);
    const fields = docJson?.fields;
    if (!fields || typeof fields !== "object") return null;
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      result[k] = decodeFirestoreValue(v);
    }
    return result;
  };

  const isSafeWebhookUrl = (rawUrl: string): boolean => {
    try {
      const parsed = new URL(rawUrl.trim());
      if (parsed.protocol !== "https:") return false;
      const host = parsed.hostname.toLowerCase();
      if (
        !host ||
        host === "localhost" ||
        host.endsWith(".local") ||
        host.endsWith(".internal") ||
        host === "::1" ||
        host === "[::1]"
      ) {
        return false;
      }
      // Block IPv4 loopback, private RFC1918, link-local / cloud metadata ranges
      const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (ipv4Match) {
        const [, a, b] = ipv4Match.map(Number);
        if (
          a === 10 ||
          a === 127 ||
          a === 0 ||
          (a === 169 && b === 254) ||
          (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && b === 168)
        ) {
          return false;
        }
      }
      return host.includes(".");
    } catch {
      return false;
    }
  };

  const resolveRequestBaseUrl = (req: express.Request): string => {
    const rawHost = req.headers["x-forwarded-host"] || req.get("host") || "";
    const host = String(Array.isArray(rawHost) ? rawHost[0] : rawHost)
      .split(",")[0]
      .trim()
      .toLowerCase();
    if (host.includes("vercel.app")) {
      return `https://${host}`;
    }
    const envUrl = process.env.APP_URL?.trim().replace(/\/+$/, "") || "";
    if (
      envUrl &&
      !envUrl.includes("ais-") &&
      !envUrl.includes(".run.app") &&
      !envUrl.includes("localhost")
    ) {
      return envUrl;
    }
    return PRIMARY_VERCEL_ORIGIN;
  };

  // Public Gateway Discovery (no secrets; Card-Only)
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
      gatewayVersion: "2.0-card-only",
      currency: "BDT",
      hostingMode: isServerless ? "vercel-serverless" : "node-server",
      persistentSigningSecretConfigured: HAS_PERSISTENT_SIGNING_SECRET,
      primaryUrl: PRIMARY_VERCEL_ORIGIN,
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
        createSessionUrl: `${baseUrl}/api/gateway/create-session`,
        parseSessionUrl: `${baseUrl}/api/gateway/parse-session`,
        confirmPaymentUrl: `${baseUrl}/api/gateway/confirm-payment`,
        verifyPaymentUrl: `${baseUrl}/api/gateway/verify-payment`,
        verifyReceiptUrl: `${baseUrl}/api/gateway/verify-payment`,
        publicConfigUrl: `${baseUrl}/api/gateway/public-config`,
        supportedInstruments: ["tut_card"]
      }
    });
  });

  // Creates a tamper-proof signed checkout session URL so orderId & amount cannot be modified in browser URL
  app.options("/api/gateway/create-session", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });

  app.post(
    "/api/gateway/create-session",
    safeAsync(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
      if (!checkGatewayRateLimit(`sess:${clientIp}`, 60)) {
        return res.status(429).json({ success: false, error: "Too many checkout session requests." });
      }

      const {
        amount,
        merchantId = "",
        merchantName,
        orderId,
        returnUrl = "",
        reference = ""
      } = req.body || {};

      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 500000) {
        return res.status(400).json({ success: false, error: "Amount must be between 1 and 500,000 BDT." });
      }
      if (!merchantName || typeof merchantName !== "string" || !merchantName.trim()) {
        return res.status(400).json({ success: false, error: "merchantName is required." });
      }
      const cleanOrderId = String(orderId || `ORD-${Date.now().toString(36).toUpperCase()}`)
        .trim()
        .slice(0, 100);

      let safeReturnUrl = "";
      if (typeof returnUrl === "string" && returnUrl.trim()) {
        try {
          const parsedRet = new URL(returnUrl.trim());
          if (parsedRet.protocol === "https:" || parsedRet.protocol === "http:") {
            safeReturnUrl = parsedRet.toString();
          }
        } catch {
          return res.status(400).json({ success: false, error: "Invalid returnUrl format." });
        }
      }

      const exp = Date.now() + 60 * 60 * 1000; // 1 hour expiry
      const sessionPayload = {
        v: 2,
        amount: Math.round(parsedAmount * 100) / 100,
        merchantId: String(merchantId || "").trim().slice(0, 100),
        merchantName: merchantName.trim().slice(0, 120),
        orderId: cleanOrderId,
        returnUrl: safeReturnUrl,
        reference: String(reference || "").trim().slice(0, 200),
        exp
      };

      const sessionToken = signCompactData(sessionPayload);
      const baseUrl = resolveRequestBaseUrl(req);
      const checkoutUrl = `${baseUrl}/pay?session=${encodeURIComponent(sessionToken)}`;

      res.json({
        success: true,
        sessionToken,
        checkoutUrl,
        expiresAt: new Date(exp).toISOString()
      });
    })
  );

  app.get("/api/gateway/parse-session", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    const rawSession = String(req.query.session || "").trim();
    const parsed = verifyCompactData<{
      v: number;
      amount: number;
      merchantId?: string;
      merchantName: string;
      orderId: string;
      returnUrl?: string;
      reference?: string;
      exp: number;
    }>(rawSession);

    if (!parsed || parsed.v !== 2) {
      return res.status(400).json({ valid: false, error: "Invalid checkout session signature." });
    }
    if (!parsed.exp || Date.now() > Number(parsed.exp)) {
      return res.status(410).json({ valid: false, error: "Checkout session has expired." });
    }
    res.json({ valid: true, session: parsed });
  });

  // Authoritative Server Confirmation: verifies Firebase ID Token AND reads the real Firestore transaction
  // before issuing an HMAC receipt token or dispatching a merchant webhook.
  app.post(
    "/api/gateway/confirm-payment",
    safeAsync(async (req, res) => {
      const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
      if (!checkGatewayRateLimit(`confirm:${clientIp}`, 40)) {
        return res
          .status(429)
          .json({ success: false, error: "Too many gateway confirmation requests." });
      }

      const authHeader = String(req.headers.authorization || "");
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!idToken) {
        return res
          .status(401)
          .json({ success: false, error: "Missing Firebase Authorization Bearer token." });
      }

      const txId = String(req.body?.txId || "").trim();
      if (!txId || !/^[a-zA-Z0-9_-]{6,128}$/.test(txId)) {
        return res.status(400).json({ success: false, error: "Valid txId is required." });
      }

      const tokenUser = await verifyFirebaseIdToken(idToken);
      if (!tokenUser) {
        return res
          .status(403)
          .json({ success: false, error: "Caller identity could not be verified." });
      }

      // Fetch authoritative transaction record directly from Firestore using caller's verified token
      const txDoc = await readFirestoreDocWithUserToken("transactions", txId, idToken);
      if (!txDoc) {
        return res
          .status(404)
          .json({ success: false, error: "Transaction record not found in ledger." });
      }
      if (txDoc.userId !== tokenUser.localId) {
        return res
          .status(403)
          .json({ success: false, error: "Transaction does not belong to authenticated user." });
      }
      if (txDoc.type !== "merchant_payment" || txDoc.paymentInstrument !== "tut_card") {
        return res
          .status(400)
          .json({ success: false, error: "Only confirmed T.U.T. Card payments can be certified." });
      }
      if (txDoc.status !== "confirmed") {
        return res
          .status(409)
          .json({ success: false, error: "Transaction is not in confirmed state." });
      }

      const amount = Number(txDoc.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid transaction amount." });
      }

      const timestamp =
        typeof txDoc.timestamp === "string" && txDoc.timestamp
          ? txDoc.timestamp
          : new Date().toISOString();

      const receipt = {
        txId,
        memoId: String(txDoc.memoId || txId),
        merchantId: String(txDoc.merchantId || ""),
        merchantName: String(txDoc.merchantName || "Authorized Partner App").slice(0, 120),
        orderId: String(txDoc.orderId || txDoc.transactionId || txId).slice(0, 120),
        amount,
        currency: "BDT",
        payerUid: String(tokenUser.localId),
        payerEmail: String(tokenUser.email || ""),
        payerMemberId: String(req.body?.payerMemberId || ""),
        cardLast4: String(txDoc.cardLast4 || ""),
        method: "T.U.T. Card",
        timestamp
      };

      const signature = signReceiptPayload(receipt);
      const receiptToken = signCompactData({ v: 2, receipt, sig: signature });

      // Read merchant configuration (safe public fields only) & dispatch SSRF-guarded webhook if configured
      let webhookDelivered = false;
      let webhookAttempted = false;
      let allowedOrigins: string[] = [];

      if (receipt.merchantId && /^[a-zA-Z0-9_-]{4,100}$/.test(receipt.merchantId)) {
        try {
          const merchantDoc = await readFirestoreDocWithUserToken(
            "merchant_apps",
            receipt.merchantId,
            idToken
          );
          if (merchantDoc && merchantDoc.status === "active") {
            if (Array.isArray(merchantDoc.allowedOrigins)) {
              allowedOrigins = merchantDoc.allowedOrigins.filter(
                (o: any) => typeof o === "string" && o.startsWith("http")
              );
            }
            const webhookUrl = typeof merchantDoc.webhookUrl === "string" ? merchantDoc.webhookUrl.trim() : "";
            if (webhookUrl && isSafeWebhookUrl(webhookUrl)) {
              webhookAttempted = true;
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 5000);
              try {
                const hookResp = await fetch(webhookUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-TUT-Event": "payment.confirmed",
                    "X-TUT-Signature": signature
                  },
                  body: JSON.stringify({
                    event: "payment.confirmed",
                    receipt,
                    signature,
                    token: receiptToken
                  }),
                  redirect: "error",
                  signal: controller.signal
                });
                webhookDelivered = hookResp.ok;
              } catch (hookErr: any) {
                console.warn("[Gateway Webhook] Delivery failed:", hookErr?.message);
              } finally {
                clearTimeout(timer);
              }
            }
          }
        } catch (mErr: any) {
          console.warn("[Gateway Confirm] Merchant lookup skipped:", mErr?.message);
        }
      }

      res.json({
        success: true,
        receipt,
        signature,
        token: receiptToken,
        webhookAttempted,
        webhookDelivered,
        allowedOrigins
      });
    })
  );

  // Unified receipt / token verifier for external Merchant apps (/api/gateway/verify-payment & legacy alias)
  const handleVerifyGatewayPayment: express.RequestHandler = safeAsync(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
    if (!checkGatewayRateLimit(`verify:${clientIp}`, 90)) {
      return res.status(429).json({ valid: false, error: "Rate limit exceeded." });
    }

    const { token, receipt, signature } = req.body || {};

    let targetReceipt: any = null;
    let targetSignature: string = "";

    if (typeof token === "string" && token.trim()) {
      const parsed = verifyCompactData<{ v: number; receipt: any; sig: string }>(token.trim());
      if (!parsed || parsed.v !== 2 || !parsed.receipt || typeof parsed.sig !== "string") {
        return res.status(401).json({ valid: false, error: "Invalid or tampered payment token." });
      }
      targetReceipt = parsed.receipt;
      targetSignature = parsed.sig;
    } else if (
      receipt &&
      typeof signature === "string" &&
      /^[a-f0-9]{64}$/i.test(signature.trim())
    ) {
      targetReceipt = receipt;
      targetSignature = signature.trim();
    } else {
      return res.status(400).json({
        valid: false,
        error: "Provide either { token } or { receipt, signature }."
      });
    }

    const expectedSig = signReceiptPayload(targetReceipt);
    const sigBuf = Buffer.from(targetSignature.toLowerCase(), "hex");
    const expectedBuf = Buffer.from(expectedSig.toLowerCase(), "hex");
    const isMatch =
      sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);

    if (!isMatch) {
      return res.status(401).json({ valid: false, error: "Invalid payment signature." });
    }

    res.json({
      valid: true,
      status: "paid",
      verifiedAt: new Date().toISOString(),
      txId: targetReceipt.txId,
      memoId: targetReceipt.memoId,
      amount: targetReceipt.amount,
      currency: targetReceipt.currency || "BDT",
      orderId: targetReceipt.orderId,
      merchantId: targetReceipt.merchantId || "",
      merchantName: targetReceipt.merchantName,
      cardLast4: targetReceipt.cardLast4 || "",
      method: targetReceipt.method || "T.U.T. Card",
      payerEmail: targetReceipt.payerEmail || null
    });
  });

  app.options("/api/gateway/verify-payment", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });
  app.post("/api/gateway/verify-payment", handleVerifyGatewayPayment);

  app.options("/api/gateway/verify-receipt", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });
  app.post("/api/gateway/verify-receipt", handleVerifyGatewayPayment);

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

  // Smart Card Key Recovery: Email OTP Challenge + Verification (stateless HMAC-bound)
  app.post(
    "/api/gateway/card-recovery/send-otp",
    safeAsync(async (req, res) => {
      const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
      if (!checkGatewayRateLimit(`otp-send:${clientIp}`, 10)) {
        return res.status(429).json({
          success: false,
          error: "Too many recovery OTP requests. Please wait a minute."
        });
      }

      const authHeader = String(req.headers.authorization || "");
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!idToken) {
        return res.status(401).json({ success: false, error: "Authentication required." });
      }

      const tokenUser = await verifyFirebaseIdToken(idToken);
      if (!tokenUser?.localId || !tokenUser?.email) {
        return res
          .status(403)
          .json({ success: false, error: "Verified account email required for Email OTP recovery." });
      }

      const otp = String(crypto.randomInt(100000, 1000000));
      const expiresAt = Date.now() + 10 * 60 * 1000;
      const otpHash = crypto
        .createHmac("sha256", GATEWAY_SIGNING_SECRET)
        .update(`otp:${tokenUser.localId}:${expiresAt}:${otp}`)
        .digest("hex");

      const subject = "T.U.T. Card Key Recovery Verification Code";
      const text = `Your T.U.T. Card Payment Key recovery code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request a key recovery, freeze your card immediately from your dashboard.`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0b132b;color:#f8fafc;border-radius:12px;">
          <h2 style="margin:0 0 12px;color:#fbbf24;">T.U.T. Authority — Card Key Recovery</h2>
          <p style="font-size:14px;color:#cbd5e1;line-height:1.5;">Use the one-time verification code below to reset your 6-digit T.U.T. Card Payment Key:</p>
          <div style="margin:20px 0;padding:16px;background:#070d1f;border:1px solid #334155;border-radius:10px;text-align:center;font-size:28px;font-weight:bold;letter-spacing:8px;color:#fde68a;font-family:monospace;">
            ${otp}
          </div>
          <p style="font-size:12px;color:#94a3b8;">Valid for 10 minutes. Never share this code with anyone.</p>
        </div>
      `;

      const { gmailUser, gmailPass } = getGmailCreds();
      let sent = false;
      if (gmailUser && gmailPass) {
        try {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: gmailUser, pass: gmailPass }
          });
          await transporter.sendMail({
            from: `"T.U.T Authority" <${gmailUser}>`,
            to: tokenUser.email,
            subject,
            text,
            html
          });
          sent = true;
        } catch (mailErr: any) {
          console.warn("[Card Recovery OTP] Gmail send failed:", mailErr?.message);
        }
      }

      if (!sent) {
        const relay = await tryResendFallback({
          to: tokenUser.email,
          subject,
          text,
          html
        });
        if (relay?.success) {
          sent = true;
        }
      }

      if (!sent) {
        return res.status(503).json({
          success: false,
          code: "EMAIL_NOT_CONFIGURED",
          error:
            "Email delivery is not configured on the server right now. Use your Master Recovery Backup Key or Security Question instead."
        });
      }

      const challengeToken = signCompactData({
        purpose: "card-recovery-challenge",
        uid: tokenUser.localId,
        expiresAt,
        otpHash
      });

      res.json({
        success: true,
        challengeToken,
        maskedEmail: maskEmail(tokenUser.email),
        expiresAt: new Date(expiresAt).toISOString()
      });
    })
  );

  app.post(
    "/api/gateway/card-recovery/verify-otp",
    safeAsync(async (req, res) => {
      const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
      if (!checkGatewayRateLimit(`otp-verify:${clientIp}`, 20)) {
        return res.status(429).json({ success: false, error: "Too many verification attempts." });
      }

      const authHeader = String(req.headers.authorization || "");
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!idToken) {
        return res.status(401).json({ success: false, error: "Authentication required." });
      }

      const tokenUser = await verifyFirebaseIdToken(idToken);
      if (!tokenUser?.localId) {
        return res.status(403).json({ success: false, error: "Invalid user session." });
      }

      const { challengeToken, otp } = req.body || {};
      const cleanOtp = String(otp || "").trim();
      if (!/^\d{6}$/.test(cleanOtp)) {
        return res.status(400).json({ success: false, error: "Enter the 6-digit verification code." });
      }

      const challenge = verifyCompactData<{
        purpose: string;
        uid: string;
        expiresAt: number;
        otpHash: string;
      }>(String(challengeToken || ""));

      if (
        !challenge ||
        challenge.purpose !== "card-recovery-challenge" ||
        challenge.uid !== tokenUser.localId
      ) {
        return res.status(400).json({ success: false, error: "Invalid or mismatched recovery challenge." });
      }
      if (!challenge.expiresAt || Date.now() > Number(challenge.expiresAt)) {
        return res.status(410).json({ success: false, error: "Verification code expired. Request a new code." });
      }

      const candidateHash = crypto
        .createHmac("sha256", GATEWAY_SIGNING_SECRET)
        .update(`otp:${tokenUser.localId}:${challenge.expiresAt}:${cleanOtp}`)
        .digest("hex");

      const a = Buffer.from(candidateHash, "hex");
      const b = Buffer.from(challenge.otpHash, "hex");
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ success: false, error: "Incorrect 6-digit verification code." });
      }

      const proofToken = signCompactData({
        purpose: "card-recovery-proof",
        uid: tokenUser.localId,
        exp: Date.now() + 10 * 60 * 1000
      });

      res.json({ success: true, recoveryAuthToken: proofToken });
    })
  );

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
