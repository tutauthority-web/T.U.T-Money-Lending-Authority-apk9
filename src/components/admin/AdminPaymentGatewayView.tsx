import React, { useState, useEffect, useMemo } from 'react';
import {
  Firestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import {
  CreditCard,
  KeyRound,
  Copy,
  Check,
  Plus,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Trash2,
  Code2,
  Globe,
  CheckCircle2
} from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';
import {
  MerchantAppRecord,
  generateMerchantCredentials
} from '../../utils/tutPaymentEngine';
import { Transaction } from '../../App';

interface AdminPaymentGatewayViewProps {
  db: Firestore;
  adminEmail: string;
  allTransactions: Transaction[];
  logAuditEvent: (action: string, details: string, severity?: 'info' | 'warning' | 'critical') => Promise<void>;
  addToast: (title: string, body: string, type?: 'info' | 'success' | 'warning') => void;
}

export const AdminPaymentGatewayView: React.FC<AdminPaymentGatewayViewProps> = ({
  db,
  adminEmail,
  allTransactions,
  logAuditEvent,
  addToast
}) => {
  const [merchants, setMerchants] = useState<MerchantAppRecord[]>([]);
  const [newMerchantName, setNewMerchantName] = useState('');
  const [newMerchantOrigins, setNewMerchantOrigins] = useState('');
  const [creatingMerchant, setCreatingMerchant] = useState(false);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<{
    name: string;
    merchantId: string;
    rawKey: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const VERCEL_PRODUCTION_ORIGIN = 'https://tut-money-lending-authority-apk9.vercel.app';
  const [selectedOriginMode, setSelectedOriginMode] = useState<'current' | 'vercel'>(() => {
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      return 'vercel';
    }
    return 'vercel';
  });
  const [signingSecretPersistent, setSigningSecretPersistent] = useState<boolean | null>(null);

  const detectedOrigin = typeof window !== 'undefined' ? window.location.origin : VERCEL_PRODUCTION_ORIGIN;
  const activeBaseOrigin =
    selectedOriginMode === 'vercel' ? VERCEL_PRODUCTION_ORIGIN : detectedOrigin;

  const gatewayUrls = useMemo(
    () => ({
      checkoutUrl: `${activeBaseOrigin}/pay`,
      verifyReceiptUrl: `${activeBaseOrigin}/api/gateway/verify-receipt`,
      publicConfigUrl: `${activeBaseOrigin}/api/gateway/public-config`
    }),
    [activeBaseOrigin]
  );

  useEffect(() => {
    fetch('/api/gateway/public-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (typeof data?.persistentSigningSecretConfigured === 'boolean') {
          setSigningSecretPersistent(data.persistentSigningSecretConfigured);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'merchant_apps'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          ...(d.data() as MerchantAppRecord),
          merchantId: d.id
        }));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setMerchants(list);
      },
      (err) => {
        console.warn('Error loading merchant_apps:', err?.message);
      }
    );
    return () => unsub();
  }, [db]);

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newMerchantName.trim();
    if (!cleanName) return;

    setCreatingMerchant(true);
    try {
      const creds = await generateMerchantCredentials();
      const origins = newMerchantOrigins
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const nowIso = new Date().toISOString();

      const record: MerchantAppRecord = {
        merchantId: creds.merchantId,
        name: cleanName,
        ownerEmail: adminEmail,
        apiKeyId: creds.apiKeyId,
        apiKeyHash: creds.apiKeyHash,
        allowedOrigins: origins,
        status: 'active',
        totalProcessed: 0,
        txCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'merchant_apps', creds.merchantId), record);
      await logAuditEvent(
        'MERCHANT_APP_REGISTERED',
        `Registered external merchant app "${cleanName}" (${creds.merchantId}). Key ID: ${creds.apiKeyId}`,
        'info'
      );

      setNewlyCreatedSecret({
        name: cleanName,
        merchantId: creds.merchantId,
        rawKey: creds.rawMerchantKey
      });
      setNewMerchantName('');
      setNewMerchantOrigins('');
      addToast('Merchant Registered', `${cleanName} can now accept T.U.T. Card & Wallet payments.`, 'success');
    } catch (err: any) {
      addToast('Registration Failed', err?.message || 'Could not register merchant app.', 'warning');
    } finally {
      setCreatingMerchant(false);
    }
  };

  const handleToggleMerchantStatus = async (m: MerchantAppRecord) => {
    const nextStatus = m.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'merchant_apps', m.merchantId), {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
      addToast(
        `Merchant ${nextStatus === 'active' ? 'Activated' : 'Paused'}`,
        `${m.name} is now ${nextStatus}.`,
        'info'
      );
    } catch (err: any) {
      addToast('Update Failed', err?.message || 'Unable to change merchant status.', 'warning');
    }
  };

  const handleDeleteMerchant = async (m: MerchantAppRecord) => {
    try {
      await deleteDoc(doc(db, 'merchant_apps', m.merchantId));
      await logAuditEvent('MERCHANT_APP_REMOVED', `Removed merchant app "${m.name}" (${m.merchantId})`, 'warning');
      addToast('Merchant Removed', `${m.name} revoked.`, 'info');
    } catch (err: any) {
      addToast('Delete Failed', err?.message || 'Unable to remove merchant.', 'warning');
    }
  };

  const externalPayments = useMemo(
    () =>
      allTransactions.filter(
        (t) =>
          t.type === 'merchant_payment' ||
          t.type === 'card_payment' ||
          t.type === 'wallet_payment'
      ),
    [allTransactions]
  );

  const secretFields = [
    { key: 'TUT_FIREBASE_PROJECT_ID', value: firebaseConfig.projectId },
    { key: 'TUT_FIREBASE_DATABASE_ID', value: firebaseConfig.firestoreDatabaseId },
    { key: 'TUT_FIREBASE_API_KEY', value: firebaseConfig.apiKey },
    { key: 'TUT_FIREBASE_AUTH_DOMAIN', value: firebaseConfig.authDomain },
    { key: 'TUT_FIREBASE_APP_ID', value: firebaseConfig.appId },
    { key: 'TUT_FIREBASE_STORAGE_BUCKET', value: firebaseConfig.storageBucket },
    { key: 'TUT_FIREBASE_MESSAGING_SENDER_ID', value: firebaseConfig.messagingSenderId },
    { key: 'TUT_PAYMENT_CHECKOUT_URL', value: gatewayUrls.checkoutUrl },
    { key: 'TUT_VERIFY_RECEIPT_URL', value: gatewayUrls.verifyReceiptUrl }
  ];

  const envBlock = secretFields.map((f) => `${f.key}="${f.value}"`).join('\n');

  const integrationSnippet = `// Launch T.U.T. Payment Page safely in a new tab (never embed in <iframe>!)
const checkoutUrl = new URL("${gatewayUrls.checkoutUrl}");
checkoutUrl.searchParams.set("tut_pay", "1");
checkoutUrl.searchParams.set("amount", "49");
checkoutUrl.searchParams.set("merchant", "Council Prime");
checkoutUrl.searchParams.set("orderId", "ORD-" + Date.now());
checkoutUrl.searchParams.set("returnUrl", window.location.origin + window.location.pathname);

// Open in a new tab/window (avoid embedding inside an <iframe>)
window.open(checkoutUrl.toString(), "_blank");

// Listen for automatic confirmation when paid from popup/tab:
window.addEventListener("message", async (e) => {
  if (e.data?.type === "TUT_PAYMENT_RESULT" && e.data?.status === "paid") {
    const res = await fetch("${gatewayUrls.verifyReceiptUrl}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt: e.data.receipt, signature: e.data.signature })
    });
    const verified = await res.json();
    if (verified.valid) { /* Activate user subscription */ }
  }
});`;

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto animate-fadeIn pb-8 text-left">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-[#0C152E]/95 border border-[#182C58] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>T.U.T. External Payment Gateway & App Secrets</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Live HMAC-SHA256
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Connect your other apps to accept T.U.T. Card + Secret Code and Direct T.U.T. Wallet payments safely.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleCopy('all_env', envBlock)}
          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shrink-0 cursor-pointer transition-colors"
        >
          {copiedKey === 'all_env' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copiedKey === 'all_env' ? 'Copied All Secrets' : 'Copy All .env Secrets'}</span>
        </button>
      </div>

      {/* Diagnostic Fix Notice for Other Apps & Vercel */}
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-xs">
          <p className="font-bold text-blue-200">
            Vercel Production &amp; External App Connection Guide:
          </p>
          <p className="text-slate-300 leading-relaxed">
            1. Open <code className="text-amber-300 font-mono">TUT_PAYMENT_CHECKOUT_URL</code> (<code className="text-amber-300 font-mono">/pay</code> or <code className="text-amber-300 font-mono">/?tut_pay=1</code>) in a <strong>new tab or top-level window</strong> — never embed it inside an <code className="text-rose-300 font-mono">&lt;iframe&gt;</code>.
          </p>
          <p className="text-slate-300 leading-relaxed">
            2. On Vercel (<code className="text-emerald-300 font-mono">tut-money-lending-authority-apk9.vercel.app</code>), add the domain under <strong>Firebase Console → Authentication → Settings → Authorized Domains</strong> and set <code className="text-amber-300 font-mono">TUT_GATEWAY_SIGNING_SECRET</code>, <code className="text-amber-300 font-mono">GMAIL_USER</code>, <code className="text-amber-300 font-mono">GMAIL_APP_PASSWORD</code>, and <code className="text-amber-300 font-mono">GEMINI_API_KEY</code> in Vercel Environment Variables.
          </p>
          {signingSecretPersistent === false && (
            <p className="text-amber-300 font-medium">
              Note: Set a persistent 32+ char <code className="font-mono">TUT_GATEWAY_SIGNING_SECRET</code> in Vercel Environment Variables so signed receipts verify reliably across serverless functions.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Required Secrets & Connection Details */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-[#0C152E]/95 border border-[#182C58] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                External App Configuration Credentials
              </h3>
            </div>
            <div className="flex items-center gap-1.5 bg-[#070D1F] p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setSelectedOriginMode('vercel')}
                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  selectedOriginMode === 'vercel'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Vercel URL
              </button>
              <button
                type="button"
                onClick={() => setSelectedOriginMode('current')}
                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  selectedOriginMode === 'current'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Current Host
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {secretFields.map((item) => (
              <div
                key={item.key}
                className="p-3 rounded-xl bg-[#070D1F] border border-white/[0.08] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-bold font-mono text-amber-400 block">
                    {item.key}
                  </span>
                  <span className="text-xs font-mono text-slate-200 truncate block mt-0.5">
                    {item.value}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(item.key, item.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedKey === item.key ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedKey === item.key ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            ))}
          </div>

          {/* Code Snippet */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Drop-In Checkout Integration Code</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopy('snippet', integrationSnippet)}
                className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'snippet' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'snippet' ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-[#050914] border border-white/10 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
              {integrationSnippet}
            </pre>
          </div>
        </div>

        {/* Right: Register Merchant App & Manage Connected Apps */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-2xl bg-[#0C152E]/95 border border-[#182C58] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Globe className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Register Connected App
              </h3>
            </div>

            <form onSubmit={handleCreateMerchant} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">App / Merchant Name *</label>
                <input
                  type="text"
                  required
                  value={newMerchantName}
                  onChange={(e) => setNewMerchantName(e.target.value)}
                  placeholder="e.g. Council Prime"
                  className="w-full px-3 py-2 rounded-xl bg-[#070D1F] border border-white/10 text-white focus:outline-none focus:border-amber-400/60"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Allowed App Domains (comma separated, optional)
                </label>
                <input
                  type="text"
                  value={newMerchantOrigins}
                  onChange={(e) => setNewMerchantOrigins(e.target.value)}
                  placeholder="https://your-other-app.run.app"
                  className="w-full px-3 py-2 rounded-xl bg-[#070D1F] border border-white/10 text-white font-mono text-[11px] focus:outline-none focus:border-amber-400/60"
                />
              </div>
              <button
                type="submit"
                disabled={creatingMerchant}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{creatingMerchant ? 'Generating Key...' : 'Register App & Issue Key'}</span>
              </button>
            </form>

            {newlyCreatedSecret && (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/40 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>One-Time Merchant Key for {newlyCreatedSecret.name}</span>
                </div>
                <p className="text-[11px] text-amber-100/80">
                  Copy and store this in your other app&apos;s secrets now. For security, only its cryptographic hash is kept in our database.
                </p>
                <div className="p-2 rounded-lg bg-[#070D1F] border border-white/10 flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-emerald-300 truncate">
                    {newlyCreatedSecret.rawKey}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('new_merchant_key', newlyCreatedSecret.rawKey)}
                    className="px-2 py-1 rounded bg-white/10 text-[10px] font-bold text-white cursor-pointer shrink-0"
                  >
                    {copiedKey === 'new_merchant_key' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="text-[10px] font-mono text-slate-300">
                  Merchant ID: {newlyCreatedSecret.merchantId}
                </div>
              </div>
            )}
          </div>

          {/* Merchant List */}
          <div className="p-5 rounded-2xl bg-[#0C152E]/95 border border-[#182C58] space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Registered Merchant Apps ({merchants.length})
            </h3>
            {merchants.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No connected merchant apps registered yet.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {merchants.map((m) => (
                  <div
                    key={m.merchantId}
                    className="p-3 rounded-xl bg-[#070D1F] border border-white/10 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-white block truncate">{m.name}</span>
                        <span className="font-mono text-[10px] text-slate-400 block">
                          ID: {m.merchantId} · {m.apiKeyId}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          m.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/[0.06]">
                      <span className="font-mono">
                        ৳{(m.totalProcessed || 0).toLocaleString()} ({m.txCount || 0} tx)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleMerchantStatus(m)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                          title={m.status === 'active' ? 'Pause App' : 'Activate App'}
                        >
                          {m.status === 'active' ? (
                            <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMerchant(m)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                          title="Revoke Merchant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live External Card & Wallet Payments Table */}
      <div className="p-5 rounded-2xl bg-[#0C152E]/95 border border-[#182C58] space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              External Card & Wallet Payments Ledger ({externalPayments.length})
            </h3>
          </div>
          <a
            href="/?tut_pay=1&amount=49&merchant=Test+Checkout"
            className="text-[11px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1"
          >
            <span>Open Checkout Page</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {externalPayments.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            No external app card or wallet payments recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                  <th className="py-2.5 px-3">Memo ID</th>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Merchant / Order</th>
                  <th className="py-2.5 px-3">Instrument</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {externalPayments.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3 font-mono text-amber-300 font-bold">
                      {tx.memoId || tx.id.slice(0, 10)}
                    </td>
                    <td className="py-3 px-3 text-white font-semibold">
                      {tx.userName || tx.userId}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-slate-200 block font-medium">
                        {tx.merchantName || tx.reference || 'Partner App'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {tx.orderId || tx.transactionId || ''}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {tx.method} {tx.cardLast4 ? `(••${tx.cardLast4})` : ''}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      ৳{(tx.amount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
