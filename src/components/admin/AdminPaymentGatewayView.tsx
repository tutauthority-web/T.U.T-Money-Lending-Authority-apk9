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
import {
  PRIMARY_VERCEL_GATEWAY_URL,
  MerchantAppRecord,
  MerchantSecretRecord,
  generateMerchantCredentials
} from '../../utils/tutPaymentEngine';
import { Transaction } from '../../App';

interface AdminPaymentGatewayViewProps {
  db: Firestore;
  adminEmail: string;
  allTransactions: Transaction[];
  logAuditEvent: (
    action: string,
    details: string,
    severity?: 'info' | 'warning' | 'critical'
  ) => Promise<void>;
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
  const [newMerchantWebhook, setNewMerchantWebhook] = useState('');
  const [creatingMerchant, setCreatingMerchant] = useState(false);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<{
    name: string;
    merchantId: string;
    rawKey: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [gatewayStatus, setGatewayStatus] = useState<{
    checked: boolean;
    online: boolean;
    persistentSecret: boolean | null;
  }>({ checked: false, online: false, persistentSecret: null });

  const baseOrigin = PRIMARY_VERCEL_GATEWAY_URL;

  const gatewayUrls = useMemo(
    () => ({
      gatewayBaseUrl: baseOrigin,
      checkoutUrl: `${baseOrigin}/pay`,
      createSessionUrl: `${baseOrigin}/api/gateway/create-session`,
      verifyPaymentUrl: `${baseOrigin}/api/gateway/verify-payment`,
      publicConfigUrl: `${baseOrigin}/api/gateway/public-config`
    }),
    [baseOrigin]
  );

  useEffect(() => {
    fetch('/api/gateway/public-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setGatewayStatus({
          checked: true,
          online: Boolean(data?.gateway?.checkoutUrl),
          persistentSecret:
            typeof data?.persistentSigningSecretConfigured === 'boolean'
              ? data.persistentSigningSecretConfigured
              : null
        });
      })
      .catch(() => {
        setGatewayStatus({ checked: true, online: false, persistentSecret: null });
      });
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

    const cleanWebhook = newMerchantWebhook.trim();
    if (cleanWebhook) {
      try {
        const parsed = new URL(cleanWebhook);
        if (parsed.protocol !== 'https:') {
          addToast('Invalid Webhook URL', 'Webhook URL must start with https://', 'warning');
          return;
        }
      } catch {
        addToast('Invalid Webhook URL', 'Enter a valid HTTPS webhook endpoint URL.', 'warning');
        return;
      }
    }

    setCreatingMerchant(true);
    try {
      const creds = await generateMerchantCredentials();
      const origins = newMerchantOrigins
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const nowIso = new Date().toISOString();

      const publicMerchantRecord: MerchantAppRecord = {
        merchantId: creds.merchantId,
        name: cleanName,
        ownerEmail: adminEmail,
        apiKeyId: creds.apiKeyId,
        allowedOrigins: origins,
        ...(cleanWebhook ? { webhookUrl: cleanWebhook } : {}),
        status: 'active',
        totalProcessed: 0,
        txCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const secretRecord: MerchantSecretRecord = {
        merchantId: creds.merchantId,
        apiKeyId: creds.apiKeyId,
        apiKeyHash: creds.apiKeyHash,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'merchant_apps', creds.merchantId), publicMerchantRecord);
      await setDoc(doc(db, 'merchant_secrets', creds.merchantId), secretRecord);

      await logAuditEvent(
        'MERCHANT_APP_REGISTERED',
        `Registered Card Gateway v2 merchant "${cleanName}" (${creds.merchantId}). Key ID: ${creds.apiKeyId}`,
        'info'
      );

      setNewlyCreatedSecret({
        name: cleanName,
        merchantId: creds.merchantId,
        rawKey: creds.rawMerchantKey
      });
      setNewMerchantName('');
      setNewMerchantOrigins('');
      setNewMerchantWebhook('');
      addToast(
        'Merchant Registered',
        `${cleanName} is active on the T.U.T. Card Gateway.`,
        'success'
      );
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
      await deleteDoc(doc(db, 'merchant_secrets', m.merchantId)).catch(() => {});
      await logAuditEvent(
        'MERCHANT_APP_REMOVED',
        `Removed merchant app "${m.name}" (${m.merchantId})`,
        'warning'
      );
      addToast('Merchant Removed', `${m.name} revoked.`, 'info');
    } catch (err: any) {
      addToast('Delete Failed', err?.message || 'Unable to remove merchant.', 'warning');
    }
  };

  const externalCardPayments = useMemo(
    () =>
      allTransactions.filter(
        (t) =>
          t.type === 'merchant_payment' ||
          t.type === 'card_payment' ||
          t.type === 'wallet_payment'
      ),
    [allTransactions]
  );

  const envFields = [
    { key: 'TUT_GATEWAY_URL', value: gatewayUrls.gatewayBaseUrl },
    { key: 'TUT_CHECKOUT_URL', value: gatewayUrls.checkoutUrl },
    { key: 'TUT_CREATE_SESSION_URL', value: gatewayUrls.createSessionUrl },
    { key: 'TUT_VERIFY_PAYMENT_URL', value: gatewayUrls.verifyPaymentUrl }
  ];

  const envBlock = envFields.map((f) => `${f.key}="${f.value}"`).join('\n');

  const integrationSnippet = `// Step 1: Create tamper-proof Card Checkout URL (or pass query params directly to /pay)
const sessionRes = await fetch("${gatewayUrls.createSessionUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    amount: 49,
    merchantId: "YOUR_MERCHANT_ID",
    merchantName: "Your App Name",
    orderId: "ORD-" + Date.now(),
    returnUrl: window.location.origin + "/payment-callback"
  })
});
const { checkoutUrl } = await sessionRes.json();
window.location.href = checkoutUrl;

// Step 2: On returnUrl (?tut_status=paid&tut_token=...), verify server-side:
const token = new URLSearchParams(window.location.search).get("tut_token");
if (token) {
  const verifyRes = await fetch("${gatewayUrls.verifyPaymentUrl}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  const verified = await verifyRes.json();
  if (verified.valid && verified.status === "paid") {
    // Credit user order safely (verified.orderId, verified.amount, verified.memoId)
  }
}`;

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto animate-fadeIn pb-8 text-left">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-[#0C152E]/95 border border-[#182C58] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              T.U.T. Card Payment Gateway (Vercel Production)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Card-only hosted checkout, signed payment tokens &amp; optional HTTPS webhooks hosted at{' '}
              <span className="font-mono text-emerald-300">{PRIMARY_VERCEL_GATEWAY_URL}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleCopy('all_env', envBlock)}
          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 cursor-pointer transition-colors"
        >
          {copiedKey === 'all_env' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copiedKey === 'all_env' ? 'Copied .env' : 'Copy Gateway .env'}</span>
        </button>
      </div>

      {/* Diagnostic Banner */}
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <p className="font-bold text-blue-200">
            Vercel Checklist · API Status:{' '}
            <span className={gatewayStatus.online ? 'text-emerald-300' : 'text-amber-300'}>
              {!gatewayStatus.checked
                ? 'Checking...'
                : gatewayStatus.online
                ? 'API Online'
                : 'Push Latest Code to Vercel to Activate /api/gateway/*'}
            </span>
          </p>
          <p className="text-slate-300 leading-relaxed">
            Ensure <code className="text-amber-300 font-mono">t-u-t-money-lending-authority-apkma.vercel.app</code> is listed under{' '}
            <strong>Firebase Console → Authentication → Settings → Authorized Domains</strong> and configure{' '}
            <code className="text-amber-300 font-mono">TUT_GATEWAY_SIGNING_SECRET</code> in Vercel Environment Variables.
          </p>
          {gatewayStatus.persistentSecret === false && (
            <p className="text-amber-300 font-medium">
              Action recommended: Add a 32+ character <code className="font-mono">TUT_GATEWAY_SIGNING_SECRET</code> in Vercel Environment Variables so payment tokens verify across all serverless functions.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Simple 2-Step Integration */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-[#0C152E]/95 border border-[#182C58] space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Vercel Gateway Endpoints
            </h3>
          </div>

          <div className="space-y-2.5">
            {envFields.map((item) => (
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

          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-sky-400" />
                <span>2-Step Integration Code (Redirect + Token Verify)</span>
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

        {/* Right: Register Merchant App */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-2xl bg-[#0C152E]/95 border border-[#182C58] space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Globe className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Register Partner App
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
                  Allowed Return Domains (optional)
                </label>
                <input
                  type="text"
                  value={newMerchantOrigins}
                  onChange={(e) => setNewMerchantOrigins(e.target.value)}
                  placeholder="https://your-app.vercel.app"
                  className="w-full px-3 py-2 rounded-xl bg-[#070D1F] border border-white/10 text-white font-mono text-[11px] focus:outline-none focus:border-amber-400/60"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  HTTPS Webhook URL (optional instant push)
                </label>
                <input
                  type="url"
                  value={newMerchantWebhook}
                  onChange={(e) => setNewMerchantWebhook(e.target.value)}
                  placeholder="https://your-app.vercel.app/api/tut-webhook"
                  className="w-full px-3 py-2 rounded-xl bg-[#070D1F] border border-white/10 text-white font-mono text-[11px] focus:outline-none focus:border-amber-400/60"
                />
              </div>
              <button
                type="submit"
                disabled={creatingMerchant}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{creatingMerchant ? 'Issuing Credentials...' : 'Register App & Issue Key'}</span>
              </button>
            </form>

            {newlyCreatedSecret && (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/40 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>One-Time Merchant Key for {newlyCreatedSecret.name}</span>
                </div>
                <p className="text-[11px] text-amber-100/80">
                  Store this key in your partner app now. Only its hash is stored inside admin-only secrets.
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

          <div className="p-5 rounded-2xl bg-[#0C152E]/95 border border-[#182C58] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Registered Apps ({merchants.length})
            </h3>
            {merchants.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No partner apps registered yet.
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
                        <span className="font-mono text-[10px] text-slate-400 block truncate">
                          {m.merchantId} · {m.apiKeyId}
                        </span>
                        {m.webhookUrl && (
                          <span className="font-mono text-[10px] text-sky-300 block truncate">
                            Webhook: {m.webhookUrl}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase shrink-0 ${
                          m.status === 'active' ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/[0.06]">
                      <span className="font-mono tabular-nums">
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

      {/* External Card Payments Ledger */}
      <div className="p-5 rounded-2xl bg-[#0C152E]/95 border border-[#182C58] space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              External Card Payments Ledger ({externalCardPayments.length})
            </h3>
          </div>
          <a
            href={`${PRIMARY_VERCEL_GATEWAY_URL}/pay?amount=49&merchant=Test+Checkout`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1"
          >
            <span>Test Hosted Checkout</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {externalCardPayments.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            No external card payments recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                  <th className="py-2.5 px-3">Memo ID</th>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Merchant / Order</th>
                  <th className="py-2.5 px-3">Card / Funding</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {externalCardPayments.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3 font-mono tabular-nums text-amber-300 font-bold">
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
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-400">
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
