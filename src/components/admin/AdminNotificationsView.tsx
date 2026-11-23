import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  Clock,
  User,
  FileText,
  X,
  Mail,
  Send,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Search,
  Activity,
  Eye,
  RotateCcw,
  Wifi,
  WifiOff,
  ChevronRight,
  CalendarClock,
  Zap,
  Code2,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Firestore, doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Transaction } from '../../App';
import {
  NotificationService,
  EmailAutomationConfig,
  DEFAULT_EMAIL_AUTOMATION_CONFIG,
  EVENT_REGISTRY,
  generateBrandedEmailHtml
} from '../../services/NotificationService';
import { buildMemberDueRadar, MemberDueRadarItem } from '../../utils/loanAllocationEngine';
import { AdminSection, AutoEmailEngineState } from './types';

function formatSafeDate(val: any): string {
  if (!val) return 'Just now';
  try {
    if (val instanceof Date && !isNaN(val.getTime())) {
      return format(val, 'dd MMM yyyy, HH:mm');
    }
    if (typeof val?.toDate === 'function') {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm');
    }
    if (typeof val?.toMillis === 'function') {
      const d = new Date(val.toMillis());
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm');
    }
    if (typeof val?.seconds === 'number') {
      const d = new Date(val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0));
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm');
    }
    if (typeof val === 'number' || typeof val === 'string') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm');
    }
  } catch {}
  return 'Just now';
}

function toSafeMillis(val: any): number {
  if (!val) return 0;
  try {
    if (val instanceof Date) return val.getTime();
    if (typeof val?.toMillis === 'function') return val.toMillis();
    if (typeof val?.toDate === 'function') return val.toDate().getTime();
    if (typeof val?.seconds === 'number') return val.seconds * 1000;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const ms = new Date(val).getTime();
      return isNaN(ms) ? 0 : ms;
    }
  } catch {}
  return 0;
}

export interface AdminNotificationItem {
  id: string;
  type: 'system' | 'request' | 'member';
  title: string;
  message: string;
  timestamp: any;
  read?: boolean;
}

interface SmtpVerifyState {
  checking: boolean;
  checkedAt?: string;
  connected?: boolean;
  code?: string;
  senderEmail?: string | null;
  activeSenderEmail?: string | null;
  senderDisplayName?: string | null;
  senderAvatarUrl?: string | null;
  senderSource?: string | null;
  adminInbox?: string | null;
  gmailUserSet?: boolean;
  gmailAppPasswordSet?: boolean;
  passwordLengthOk?: boolean;
  hasResendFallback?: boolean;
  latencyMs?: number;
  error?: string | null;
}

interface AdminNotificationsViewProps {
  notifications: AdminNotificationItem[];
  onClearAll?: () => void;
  onDismiss?: (id: string) => void;
  db: Firestore;
  allUsers: UserProfile[];
  allTransactions: Transaction[];
  emailLogs: any[];
  adminEmail: string;
  adminPhoto?: string;
  sendEmail: (
    to: string,
    subject: string,
    body: string,
    customHtml?: string,
    recipientName?: string,
    category?: string,
    forceRetry?: boolean,
    meta?: { memoId?: string; eventType?: string; recipientUid?: string; attachments?: any[] }
  ) => Promise<boolean | void>;
  autoEmailState?: AutoEmailEngineState;
  onRunAutoEmailCycle?: (forceRun?: boolean) => Promise<number>;
  notificationService: NotificationService;
  logAuditEvent: (action: string, details: string, severity?: 'info' | 'warning' | 'critical') => Promise<void>;
  addToast: (title: string, body: string, type?: 'info' | 'success' | 'warning') => void;
  onInspectMember?: (member: UserProfile) => void;
  onNavigateSection?: (section: AdminSection) => void;
}

type HubTab = 'overview' | 'rules' | 'logs' | 'compose';
type AudienceType = 'single' | 'overdue' | 'borrowers' | 'pending_kyc' | 'approved' | 'custom';

export const AdminNotificationsView: React.FC<AdminNotificationsViewProps> = ({
  notifications,
  onClearAll,
  onDismiss,
  db,
  allUsers,
  allTransactions,
  emailLogs = [],
  adminEmail,
  adminPhoto,
  sendEmail,
  autoEmailState,
  onRunAutoEmailCycle,
  logAuditEvent,
  addToast,
  onInspectMember
}) => {
  const [hubTab, setHubTab] = useState<HubTab>('overview');

  // SMTP Health & Diagnostics
  const [smtpState, setSmtpState] = useState<SmtpVerifyState>({ checking: false });
  const [showSmtpGuide, setShowSmtpGuide] = useState(false);

  // Automation Rules synced with Firestore
  const [automationCfg, setAutomationCfg] = useState<EmailAutomationConfig>(DEFAULT_EMAIL_AUTOMATION_CONFIG);
  const [savingRules, setSavingRules] = useState(false);
  const [runningAutoCycle, setRunningAutoCycle] = useState(false);

  // Alert Feed Sub-tab
  const [alertFilter, setAlertFilter] = useState<'all' | 'system' | 'requests' | 'members'>('all');

  // Delivery Log Filters & Inspector
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'delivered' | 'failed'>('all');
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');
  const [inspectedLog, setInspectedLog] = useState<any | null>(null);
  const [inspectorViewMode, setInspectorViewMode] = useState<'card' | 'raw'>('card');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);

  // Manual Composer State (secondary workflow)
  const [audience, setAudience] = useState<AudienceType>('single');
  const [selectedMemberUid, setSelectedMemberUid] = useState<string>('');
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [customEmail, setCustomEmail] = useState<string>('');
  const [customRecipientName, setCustomRecipientName] = useState<string>('');
  const [composeCategory, setComposeCategory] = useState<string>('Broadcast');
  const [composeTone, setComposeTone] = useState<'neutral' | 'success' | 'warning' | 'danger'>('neutral');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeTitle, setComposeTitle] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [attachedTxId, setAttachedTxId] = useState<string>('');
  const [composeMode, setComposeMode] = useState<'edit' | 'preview'>('edit');
  const [sendingBatch, setSendingBatch] = useState<{ active: boolean; done: number; total: number }>({
    active: false,
    done: 0,
    total: 0
  });

  // Due Radar sending state
  const [sendingDueUid, setSendingDueUid] = useState<string | null>(null);
  const [isRunningBatchDue, setIsRunningBatchDue] = useState(false);

  // Load Automation Rules from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'system_controls', 'email_automation'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as any;
          setAutomationCfg({
            ...DEFAULT_EMAIL_AUTOMATION_CONFIG,
            ...d,
            dueReminderLeadDays: typeof d.dueReminderLeadDays === 'number' ? d.dueReminderLeadDays : 3,
            overdueRepeatDays: typeof d.overdueRepeatDays === 'number' ? d.overdueRepeatDays : 5
          });
        }
      },
      () => {}
    );
    return () => unsub();
  }, [db]);

  // Honest health fetch reading verified SMTP status from /api/health
  const fetchHealthCheck = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data?.config) {
        const verified = data.config.smtpVerified;
        setSmtpState((prev) => ({
          ...prev,
          gmailUserSet: Boolean(data.config.gmailUserSet),
          gmailAppPasswordSet: Boolean(data.config.gmailAppPasswordSet),
          passwordLengthOk: Boolean(data.config.isCorrectLength),
          hasResendFallback: Boolean(data.config.hasResendFallback),
          senderEmail: data.config.senderEmail || prev.senderEmail || null,
          activeSenderEmail: data.config.activeSenderEmail || data.config.senderEmail || prev.activeSenderEmail || null,
          senderDisplayName: data.config.senderDisplayName || prev.senderDisplayName || 'T.U.T Authority',
          senderAvatarUrl: data.config.senderAvatarUrl || prev.senderAvatarUrl || '/assets/tut-authority-logo.jpg',
          senderSource: data.config.senderSource || prev.senderSource || null,
          adminInbox: data.config.adminEmail || prev.adminInbox || null,
          connected: typeof verified === 'boolean' ? verified : Boolean(data.config.emailGatewayReady),
          code: data.config.smtpCode || prev.code,
          latencyMs: typeof data.config.smtpLatencyMs === 'number' ? data.config.smtpLatencyMs : prev.latencyMs,
          error: data.config.smtpError || null
        }));
        if (verified === false && data.config.smtpError) {
          setShowSmtpGuide(true);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchHealthCheck();
  }, []);

  const handleRunLiveSmtpTest = async () => {
    setSmtpState((prev) => ({ ...prev, checking: true }));
    try {
      const res = await fetch('/api/email/verify', { method: 'POST' });
      const data = await res.json();
      setSmtpState({
        checking: false,
        checkedAt: data.checkedAt ? format(new Date(data.checkedAt), 'HH:mm:ss') : format(new Date(), 'HH:mm:ss'),
        connected: Boolean(data.connected),
        code: data.code,
        senderEmail: data.senderEmail,
        activeSenderEmail: data.activeSenderEmail || data.senderEmail,
        senderDisplayName: data.senderDisplayName || 'T.U.T Authority',
        senderAvatarUrl: data.senderAvatarUrl || '/assets/tut-authority-logo.jpg',
        senderSource: data.senderSource || null,
        adminInbox: data.adminEmail || null,
        gmailUserSet: Boolean(data.gmailUserSet),
        gmailAppPasswordSet: Boolean(data.gmailAppPasswordSet),
        passwordLengthOk: Boolean(data.passwordLengthOk),
        hasResendFallback: Boolean(data.hasResendFallback),
        latencyMs: data.latencyMs,
        error: data.error || null
      });
      if (data.connected) {
        setShowSmtpGuide(false);
        const verifiedAddr = data.activeSenderEmail || data.senderEmail || 'Gmail';
        addToast(
          'SMTP Connected',
          `Sending via ${verifiedAddr} (${data.latencyMs}ms).${telemetry.failed > 0 ? ' You can now retry failed outbox messages.' : ''}`,
          'success'
        );
      } else {
        setShowSmtpGuide(true);
        addToast('SMTP Verification Failed', data.error || 'Check Gmail credentials.', 'warning');
      }
    } catch (err: any) {
      setSmtpState((prev) => ({
        ...prev,
        checking: false,
        connected: false,
        error: err?.message || 'Network error verifying SMTP gateway.'
      }));
      addToast('Check Failed', 'Could not reach server /api/email/verify.', 'warning');
    }
  };

  const handleTriggerAutoEngineNow = async () => {
    if (!onRunAutoEmailCycle) {
      await handleBatchDueScan();
      return;
    }
    setRunningAutoCycle(true);
    try {
      const sent = await onRunAutoEmailCycle(true);
      await fetchHealthCheck();
      if (sent > 0) {
        addToast('Auto-Cycle Complete', `Dispatched ${sent} scheduled reminder email${sent > 1 ? 's' : ''}.`, 'success');
      } else {
        addToast('Auto-Cycle Checked', 'All due/overdue accounts are already up to date under current cadence.', 'info');
      }
    } finally {
      setRunningAutoCycle(false);
    }
  };

  // Update automation rules in Firestore
  const handleSaveAutomationRule = async (patch: Partial<EmailAutomationConfig>) => {
    const next = { ...automationCfg, ...patch, updatedAt: new Date().toISOString(), updatedBy: adminEmail };
    setAutomationCfg(next);
    setSavingRules(true);
    try {
      await setDoc(doc(db, 'system_controls', 'email_automation'), next, { merge: true });
      if (typeof patch.masterEnabled === 'boolean') {
        await setDoc(
          doc(db, 'system_controls', 'funds'),
          {
            gmailNotificationsEnabled: patch.masterEnabled,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
        localStorage.setItem('tut_gmail_notifications', String(patch.masterEnabled));
      }
      addToast('Automation Updated', 'Email automation policy saved.', 'success');
    } catch (err: any) {
      addToast('Save Error', err?.message || 'Could not save automation settings.', 'warning');
    } finally {
      setSavingRules(false);
    }
  };

  // Telemetry KPIs from emailLogs
  const telemetry = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const total = emailLogs.length;
    let delivered = 0;
    let failed = 0;
    let last24h = 0;

    emailLogs.forEach((log) => {
      if (log.status === 'delivered') delivered++;
      else if (log.status === 'failed') failed++;
      if (toSafeMillis(log.timestamp) >= dayAgo) last24h++;
    });

    const successRate = total > 0 ? Math.round((delivered / total) * 100) : 100;
    return { total, delivered, failed, last24h, successRate };
  }, [emailLogs]);

  // Unified Authoritative Due & Overdue Radar (100% synced with App.tsx scanner & Admin KPIs)
  const dueRadarItems = useMemo(
    () => buildMemberDueRadar(allUsers, allTransactions, automationCfg.dueReminderLeadDays || 3),
    [allUsers, allTransactions, automationCfg.dueReminderLeadDays]
  );

  const overdueCount = useMemo(
    () => dueRadarItems.filter((i) => i.urgency === 'overdue').length,
    [dueRadarItems]
  );

  const urgentDueCount = useMemo(
    () => dueRadarItems.filter((i) => i.urgency === 'overdue' || i.urgency === 'today' || i.urgency === 'upcoming').length,
    [dueRadarItems]
  );

  // Dispatch single Due Reminder directly from Radar
  const sendSingleDueReminderFromRadar = async (
    item: MemberDueRadarItem,
    options?: { skipAdminCopy?: boolean }
  ) => {
    const { member, primaryLoanTx, activeDebt, daysDiff, dueDateLabel } = item;
    if (!member.email || !member.email.includes('@')) {
      addToast('Missing Email', `${member.name} has no valid email address on file.`, 'warning');
      return false;
    }

    setSendingDueUid(member.uid);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const memoRef = primaryLoanTx?.memoId || primaryLoanTx?.id || `ACC-${member.uid.slice(0, 6).toUpperCase()}`;
    const targetEmail = member.email.trim().toLowerCase();
    const chiefAdminInbox = (smtpState.adminInbox || 'tahsinullahtusher999@gmail.com').trim().toLowerCase();

    let subject = `T.U.T. — Loan repayment reminder (৳${activeDebt.toLocaleString()})`;
    let title = 'Repayment Reminder';
    let tone: 'warning' | 'danger' | 'neutral' = 'warning';
    let summary = `Hi ${member.name}, this is a quick reminder regarding your current loan balance of ৳${activeDebt.toLocaleString()} BDT. You can submit your repayment anytime inside your member portal.`;

    if (daysDiff !== null && daysDiff < 0) {
      const over = Math.abs(daysDiff);
      subject = `T.U.T. — Payment overdue by ${over} day${over > 1 ? 's' : ''} (৳${activeDebt.toLocaleString()})`;
      title = 'Payment Overdue Notice';
      tone = 'danger';
      summary = `Hi ${member.name}, your repayment scheduled for ${dueDateLabel} is now ${over} day${over > 1 ? 's' : ''} overdue. Please clear your balance of ৳${activeDebt.toLocaleString()} BDT or contact an officer if you need assistance.`;
    } else if (daysDiff === 0) {
      subject = `T.U.T. — Repayment due today (৳${activeDebt.toLocaleString()})`;
      title = 'Repayment Due Today';
      summary = `Hi ${member.name}, your loan repayment of ৳${activeDebt.toLocaleString()} BDT is due today (${dueDateLabel}). Please complete payment via bKash, Nagad, or Cash Desk.`;
    }

    const html = generateBrandedEmailHtml(
      title,
      summary,
      {
        Member: member.name,
        'Member ID': member.memberId || 'N/A',
        'Active Tranches': `${item.openTranches.length} open`,
        'Due Date': dueDateLabel,
        'Remaining Balance Due': `৳${activeDebt.toLocaleString()} BDT`,
        'Memo Reference': memoRef
      },
      memoRef,
      typeof window !== 'undefined' ? window.location.origin : '',
      {
        accentTone: tone,
        ctaLabel: 'Open Member Dashboard',
        heroAmount: `৳${activeDebt.toLocaleString()} BDT`,
        heroCaption: daysDiff !== null && daysDiff < 0 ? `Overdue by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? 's' : ''}` : `Scheduled Due ${dueDateLabel}`,
        automationBadge: 'Admin Due Desk Reminder',
        memoNote: 'Payment Channels: bKash (01713710607) or Nagad (01921801100), then submit "Pay Due" inside your portal.'
      }
    );

    try {
      const ok = await sendEmail(
        targetEmail,
        subject,
        summary,
        html,
        member.name,
        'Due Reminder',
        true,
        { memoId: memoRef, eventType: 'manual_due_reminder', recipientUid: member.uid }
      );
      if (ok) {
        if (!options?.skipAdminCopy && targetEmail !== chiefAdminInbox && automationCfg.copyAdminOnMemberMails !== false) {
          const copySummary = `Manual due reminder dispatched to ${member.name} (${targetEmail}) for ৳${activeDebt.toLocaleString()} BDT.\n\n${summary}`;
          const copyHtml = generateBrandedEmailHtml(
            `[Admin Copy] ${title}`,
            copySummary,
            {
              Borrower: `${member.name} (${targetEmail})`,
              'Member ID': member.memberId || 'N/A',
              'Due Date': dueDateLabel,
              'Remaining Balance Due': `৳${activeDebt.toLocaleString()} BDT`,
              'Memo Reference': memoRef
            },
            memoRef,
            typeof window !== 'undefined' ? window.location.origin : '',
            {
              accentTone: tone,
              heroAmount: `৳${activeDebt.toLocaleString()} BDT`,
              heroCaption: `Sent to ${targetEmail}`,
              automationBadge: 'Chief Admin Copy · Due Radar',
              ctaLabel: 'Open Due Radar'
            }
          );
          sendEmail(
            chiefAdminInbox,
            `[Admin Copy] ${subject}`,
            copySummary,
            copyHtml,
            'Chief Admin (Copy)',
            'Due Reminder',
            false,
            { memoId: memoRef, eventType: 'admin_copy_manual_due', recipientUid: 'admin' }
          ).catch(() => {});
        }
        if (primaryLoanTx?.id) {
          await updateDoc(doc(db, 'transactions', primaryLoanTx.id), { lastReminderSent: todayStr }).catch(() => {});
        }
        await updateDoc(doc(db, 'users', member.uid), { lastReminderSent: todayStr }).catch(() => {});
        await logAuditEvent('DUE_REMINDER_SENT', `Sent repayment reminder email to ${member.name} (${member.email}) for ৳${activeDebt.toLocaleString()}`, 'info');
        if (!options?.skipAdminCopy) {
          addToast('Reminder Sent', `Delivered email reminder to ${member.name}.`, 'success');
        }
        return true;
      } else {
        await fetchHealthCheck();
        if (!options?.skipAdminCopy) {
          addToast('Delivery Failed', `Could not send reminder to ${member.email}. Check SMTP status & logs.`, 'warning');
        }
        return false;
      }
    } finally {
      setSendingDueUid(null);
    }
  };

  const handleBatchDueScan = async () => {
    const eligible = dueRadarItems.filter(
      (i) => (i.urgency === 'overdue' || i.urgency === 'today' || i.urgency === 'upcoming') && !i.sentToday && i.member.email?.includes('@')
    );
    if (eligible.length === 0) {
      addToast('Up to Date', 'All eligible due/overdue borrowers already received reminders today.', 'info');
      return;
    }
    setIsRunningBatchDue(true);
    let sent = 0;
    const sentList: MemberDueRadarItem[] = [];
    for (const item of eligible) {
      const ok = await sendSingleDueReminderFromRadar(item, { skipAdminCopy: true });
      if (ok) {
        sent++;
        sentList.push(item);
      }
    }

    const chiefAdminInbox = (smtpState.adminInbox || 'tahsinullahtusher999@gmail.com').trim().toLowerCase();
    if (sent > 0 && automationCfg.copyAdminOnMemberMails !== false) {
      const totalAmt = sentList.reduce((sum, i) => sum + i.activeDebt, 0);
      const summaryLines = sentList
        .map((i, idx) => `${idx + 1}. ${i.member.name} (${i.member.email}) — ৳${i.activeDebt.toLocaleString()} [${i.urgency.toUpperCase()} · ${i.dueDateLabel}]`)
        .join('\n');
      const digestRef = `BATCH-DUE-${format(new Date(), 'yyyyMMdd-HHmm')}`;
      const digestSummary = `Batch Due Reminder Scan sent ${sent} email${sent > 1 ? 's' : ''} covering ৳${totalAmt.toLocaleString()} BDT active debt.\n\n${summaryLines}`;
      const details: Record<string, string> = {
        'Dispatched Count': `${sent} of ${eligible.length} eligible`,
        'Total Debt Notified': `৳${totalAmt.toLocaleString()} BDT`
      };
      sentList.slice(0, 6).forEach((i, idx) => {
        details[`Member #${idx + 1}`] = `${i.member.name} — ৳${i.activeDebt.toLocaleString()} (${i.urgency.toUpperCase()})`;
      });
      const digestHtml = generateBrandedEmailHtml(
        'Batch Due Reminder Digest',
        digestSummary,
        details,
        digestRef,
        typeof window !== 'undefined' ? window.location.origin : '',
        {
          accentTone: sentList.some(i => i.urgency === 'overdue') ? 'warning' : 'neutral',
          heroAmount: `${sent} Sent`,
          heroCaption: `Total Balance Notified: ৳${totalAmt.toLocaleString()} BDT`,
          automationBadge: 'Chief Admin Digest · Due Radar Batch',
          ctaLabel: 'Open Due Radar'
        }
      );
      sendEmail(
        chiefAdminInbox,
        `[Admin Digest] ${sent} Batch Due Reminder${sent > 1 ? 's' : ''} Dispatched`,
        digestSummary,
        digestHtml,
        'Chief Admin (Digest)',
        'Due Reminder',
        false,
        { memoId: digestRef, eventType: 'admin_batch_due_digest', recipientUid: 'admin' }
      ).catch(() => {});
    }

    setIsRunningBatchDue(false);
    addToast('Batch Scan Complete', `Sent ${sent} of ${eligible.length} due reminder emails.`, sent > 0 ? 'success' : 'warning');
  };

  // Filtered Email Logs
  const filteredEmailLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return [...emailLogs]
      .sort((a, b) => toSafeMillis(b.timestamp) - toSafeMillis(a.timestamp))
      .filter((log) => {
        if (logStatusFilter !== 'all' && log.status !== logStatusFilter) return false;
        if (logCategoryFilter !== 'all' && String(log.category || 'System').toLowerCase() !== logCategoryFilter.toLowerCase()) return false;
        if (q) {
          const hay = `${log.to || ''} ${log.recipientName || ''} ${log.subject || ''} ${log.memoId || ''} ${log.category || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [emailLogs, logStatusFilter, logCategoryFilter, logSearch]);

  // Inspected log preview HTML (renders formatted email card inside inspector modal)
  const inspectedPreviewHtml = useMemo(() => {
    if (!inspectedLog) return '';
    return generateBrandedEmailHtml(
      inspectedLog.subject || 'T.U.T. Notification',
      inspectedLog.body || 'Account notification recorded in audit ledger.',
      {
        Recipient: inspectedLog.recipientName || inspectedLog.to || 'Member',
        Category: inspectedLog.category || 'System',
        Status: String(inspectedLog.status || 'logged').toUpperCase(),
        Timestamp: formatSafeDate(inspectedLog.timestamp)
      },
      inspectedLog.memoId || inspectedLog.id || 'LOG-REF',
      typeof window !== 'undefined' ? window.location.origin : '',
      {
        accentTone: inspectedLog.status === 'failed' ? 'danger' : 'success',
        automationBadge: inspectedLog.category || 'Automated Ledger Mail'
      }
    );
  }, [inspectedLog]);

  // Retry failed email log
  const handleRetryEmail = async (log: any) => {
    if (!log?.to) return;
    setRetryingId(log.id || log.to);
    try {
      const ok = await sendEmail(
        log.to,
        log.subject || 'T.U.T. Account Notification',
        log.body || 'Please review your account dashboard.',
        undefined,
        log.recipientName || 'Member',
        log.category || 'System',
        true,
        { memoId: log.memoId, eventType: 'manual_retry', recipientUid: log.recipientUid }
      );
      if (ok) {
        addToast('Resent Successfully', `Delivered to ${log.to}.`, 'success');
      } else {
        await fetchHealthCheck();
        addToast('Retry Failed', `Delivery to ${log.to} failed. Check SMTP credentials.`, 'warning');
      }
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAllFailed = async () => {
    const failedLogs = emailLogs.filter((l) => l.status === 'failed' && l.to).slice(0, 15);
    if (failedLogs.length === 0) return;
    setIsRetryingAll(true);
    let okCount = 0;
    for (const log of failedLogs) {
      const ok = await sendEmail(
        log.to,
        log.subject || 'T.U.T. Account Notification',
        log.body || 'Account notification.',
        undefined,
        log.recipientName || 'Member',
        log.category || 'System',
        true,
        { memoId: log.memoId, eventType: 'batch_retry', recipientUid: log.recipientUid }
      );
      if (ok) okCount++;
    }
    setIsRetryingAll(false);
    if (okCount === 0) await fetchHealthCheck();
    addToast('Retry Batch Finished', `Delivered ${okCount} of ${failedLogs.length} failed messages.`, okCount > 0 ? 'success' : 'warning');
  };

  // Composer helpers
  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return allUsers
      .filter((u) => u.email && u.email.includes('@'))
      .filter((u) => !q || `${u.name} ${u.memberId || ''} ${u.email}`.toLowerCase().includes(q));
  }, [allUsers, memberSearch]);

  const selectedMemberObj = useMemo(
    () => allUsers.find((u) => u.uid === selectedMemberUid) || null,
    [allUsers, selectedMemberUid]
  );

  const memberRecentTxs = useMemo(() => {
    if (!selectedMemberUid) return [];
    return allTransactions
      .filter((t) => t.userId === selectedMemberUid)
      .sort((a, b) => toSafeMillis(b.timestamp) - toSafeMillis(a.timestamp))
      .slice(0, 12);
  }, [allTransactions, selectedMemberUid]);

  const attachedTx = useMemo(
    () => memberRecentTxs.find((t) => t.id === attachedTxId) || null,
    [memberRecentTxs, attachedTxId]
  );

  const audienceRecipients = useMemo(() => {
    if (audience === 'single') {
      return selectedMemberObj && selectedMemberObj.email?.includes('@') ? [selectedMemberObj] : [];
    }
    if (audience === 'overdue') {
      return dueRadarItems.filter((i) => i.urgency === 'overdue' && i.member.email?.includes('@')).map((i) => i.member);
    }
    if (audience === 'borrowers') {
      return dueRadarItems.filter((i) => i.member.email?.includes('@')).map((i) => i.member);
    }
    if (audience === 'pending_kyc') {
      return allUsers.filter((u) => (u.status === 'pending' || String(u.status) === 'info_requested') && u.email?.includes('@'));
    }
    if (audience === 'approved') {
      return allUsers.filter((u) => u.status === 'approved' && u.email?.includes('@'));
    }
    return [];
  }, [audience, selectedMemberObj, dueRadarItems, allUsers]);

  const applyTemplate = (key: 'due' | 'memo' | 'kyc' | 'deposit' | 'notice') => {
    const mName = selectedMemberObj?.name || '{name}';
    const mDebt = selectedMemberObj ? `৳${(selectedMemberObj.remainingDebt || 0).toLocaleString()} BDT` : '{debt}';
    const mLimit = selectedMemberObj ? `৳${(selectedMemberObj.borrowingLimit || 500).toLocaleString()} BDT` : '{limit}';
    const latestTx = attachedTx || memberRecentTxs[0];

    if (key === 'due') {
      setComposeCategory('Due Reminder');
      setComposeTone('warning');
      setComposeSubject(`T.U.T. — Loan repayment reminder for ${mName}`);
      setComposeTitle('Loan Repayment Reminder');
      setComposeBody(
        `Hi ${mName},\n\nThis is a friendly reminder regarding your active balance of ${mDebt}. Please submit your payment through your T.U.T. dashboard (bKash, Nagad, or Cash Desk) when ready.\n\nIf you have already sent payment or need a short extension, reply inside your Member Support chat.`
      );
    } else if (key === 'memo') {
      if (latestTx) setAttachedTxId(latestTx.id);
      const memoRef = latestTx?.memoId || latestTx?.id || '{memoId}';
      const amt = latestTx ? `৳${latestTx.amount.toLocaleString()} BDT` : 'your recent transaction';
      setComposeCategory('Transaction');
      setComposeTone('success');
      setComposeSubject(`T.U.T. — Official Memo & Receipt (${memoRef})`);
      setComposeTitle('Official Transaction Memo');
      setComposeBody(
        `Hi ${mName},\n\nAttached below is your official verification summary for ${amt} (Reference: ${memoRef}). You can view and download your printable PDF or PNG memo anytime from your Vault tab.`
      );
    } else if (key === 'kyc') {
      setComposeCategory('Membership');
      setComposeTone('warning');
      setComposeSubject('T.U.T. — Account verification check');
      setComposeTitle('Verification Details Needed');
      setComposeBody(
        `Hi ${mName},\n\nOur verification desk reviewed your profile and needs updated identification or contact details to complete approval. Please log in to your portal and review your profile details.`
      );
    } else if (key === 'deposit') {
      setComposeCategory('Transaction');
      setComposeTone('success');
      setComposeSubject('T.U.T. — Savings deposit & vault summary');
      setComposeTitle('Vault Savings Update');
      setComposeBody(
        `Hi ${mName},\n\nYour Savings Vault balance is verified and protected under our 1:1 reserve charter. Current approved borrowing ceiling: ${mLimit}. Thank you for banking with T.U.T.`
      );
    } else {
      setComposeCategory('Broadcast');
      setComposeTone('neutral');
      setComposeSubject('T.U.T. — Member account notice');
      setComposeTitle('Member Account Update');
      setComposeBody(
        `Hi ${mName},\n\nWe are sharing an important service update from T.U.T. Private Authority. Please open your member portal to check the latest updates.`
      );
    }
  };

  const buildRenderedEmail = (targetMember?: UserProfile | null, txForEmail?: Transaction | null) => {
    const name = targetMember?.name || customRecipientName.trim() || 'Member';
    const mId = targetMember?.memberId || 'N/A';
    const debt = `৳${(targetMember?.remainingDebt || 0).toLocaleString()} BDT`;
    const limit = `৳${(targetMember?.borrowingLimit || 500).toLocaleString()} BDT`;
    const memoId = txForEmail?.memoId || txForEmail?.id || '';

    const resolveTokens = (txt: string) =>
      txt
        .replace(/\{name\}/gi, name)
        .replace(/\{memberId\}/gi, mId)
        .replace(/\{debt\}/gi, debt)
        .replace(/\{limit\}/gi, limit)
        .replace(/\{memoId\}/gi, memoId || 'N/A');

    const finalSubject = resolveTokens(composeSubject.trim() || 'T.U.T. — Account Update');
    const finalTitle = resolveTokens(composeTitle.trim() || composeSubject.trim() || 'Account Notice');
    const finalBody = resolveTokens(composeBody.trim());

    const details: Record<string, string> = {};
    if (targetMember) {
      details['Member Name'] = targetMember.name;
      if (targetMember.memberId) details['Member ID'] = targetMember.memberId;
      if ((targetMember.remainingDebt || 0) > 0) {
        details['Current Balance Due'] = `৳${targetMember.remainingDebt.toLocaleString()} BDT`;
      }
    }
    if (txForEmail) {
      details['Official Memo ID'] = txForEmail.memoId || txForEmail.id;
      details['Transaction Type'] = txForEmail.type.replace('_', ' ').toUpperCase();
      details['Amount'] = `৳${txForEmail.amount.toLocaleString()} BDT`;
      details['Payment Channel'] = txForEmail.method || 'N/A';
      details['Status'] = txForEmail.status.toUpperCase();
    }

    const heroAmt = txForEmail
      ? `৳${txForEmail.amount.toLocaleString()} BDT`
      : targetMember && (targetMember.remainingDebt || 0) > 0 && composeCategory === 'Due Reminder'
      ? `৳${targetMember.remainingDebt.toLocaleString()} BDT`
      : undefined;

    const html = generateBrandedEmailHtml(
      finalTitle,
      finalBody,
      details,
      memoId || `MSG-${Date.now().toString().slice(-6)}`,
      typeof window !== 'undefined' ? window.location.origin : '',
      {
        accentTone: composeTone,
        ctaLabel: 'Open Member Dashboard',
        heroAmount: heroAmt,
        heroCaption: txForEmail ? `${txForEmail.type.replace('_', ' ').toUpperCase()} · ${txForEmail.status.toUpperCase()}` : undefined,
        automationBadge: 'Official Desk Communication',
        memoNote: txForEmail ? 'This official statement corresponds to the verified ledger record inside your Member Vault.' : undefined
      }
    );

    return { finalSubject, finalBody, html, memoId };
  };

  const previewHtml = useMemo(() => {
    const sampleMember =
      audience === 'single'
        ? selectedMemberObj
        : audienceRecipients[0] || ({ name: customRecipientName || 'Sample Member', memberId: 'TUT-1042', remainingDebt: 1500, borrowingLimit: 2500 } as any);
    return buildRenderedEmail(sampleMember, audience === 'single' ? attachedTx : null).html;
  }, [audience, selectedMemberObj, audienceRecipients, customRecipientName, attachedTx, composeSubject, composeTitle, composeBody, composeTone, composeCategory]);

  const handleDispatchCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeSubject.trim() || !composeBody.trim()) {
      addToast('Missing Fields', 'Please enter both a subject and a message.', 'warning');
      return;
    }

    const chiefAdminInbox = (smtpState.adminInbox || 'tahsinullahtusher999@gmail.com').trim().toLowerCase();

    if (audience === 'custom') {
      const emailClean = customEmail.trim().toLowerCase();
      if (!emailClean.includes('@')) {
        addToast('Invalid Email', 'Enter a valid destination email address.', 'warning');
        return;
      }
      setSendingBatch({ active: true, done: 0, total: 1 });
      const { finalSubject, finalBody, html, memoId } = buildRenderedEmail(null, null);
      const ok = await sendEmail(
        emailClean,
        finalSubject,
        finalBody,
        html,
        customRecipientName.trim() || emailClean,
        composeCategory,
        true,
        { eventType: 'admin_manual_push' }
      );
      setSendingBatch({ active: false, done: 1, total: 1 });
      if (ok) {
        if (emailClean !== chiefAdminInbox && automationCfg.copyAdminOnMemberMails !== false) {
          sendEmail(
            chiefAdminInbox,
            `[Admin Copy] ${finalSubject}`,
            `Manual push delivered to ${customRecipientName.trim() || emailClean} (${emailClean}):\n\n${finalBody}`,
            html,
            'Chief Admin (Copy)',
            composeCategory,
            false,
            { memoId: memoId || undefined, eventType: 'admin_copy_manual_push', recipientUid: 'admin' }
          ).catch(() => {});
        }
        await logAuditEvent('MANUAL_EMAIL_SENT', `Sent email "${finalSubject}" to ${emailClean}`, 'info');
        addToast('Email Dispatched', `Message delivered to ${emailClean}.`, 'success');
      } else {
        await fetchHealthCheck();
        addToast('Send Failed', `Could not deliver to ${emailClean}. Check SMTP diagnostics.`, 'warning');
      }
      return;
    }

    if (audienceRecipients.length === 0) {
      addToast('No Recipients', 'Select a member or choose an audience with valid emails.', 'warning');
      return;
    }

    setSendingBatch({ active: true, done: 0, total: audienceRecipients.length });
    let deliveredCount = 0;
    const deliveredMembers: UserProfile[] = [];

    for (let i = 0; i < audienceRecipients.length; i++) {
      const m = audienceRecipients[i];
      const txToUse = audience === 'single' ? attachedTx : null;
      const { finalSubject, finalBody, html, memoId } = buildRenderedEmail(m, txToUse);
      const ok = await sendEmail(
        m.email!.trim().toLowerCase(),
        finalSubject,
        finalBody,
        html,
        m.name,
        composeCategory,
        true,
        { memoId: memoId || undefined, eventType: 'admin_manual_push', recipientUid: m.uid }
      );
      if (ok) {
        deliveredCount++;
        deliveredMembers.push(m);
      }
      setSendingBatch({ active: true, done: i + 1, total: audienceRecipients.length });
    }

    if (deliveredCount > 0 && automationCfg.copyAdminOnMemberMails !== false) {
      if (deliveredMembers.length === 1) {
        const single = deliveredMembers[0];
        const singleEmail = single.email!.trim().toLowerCase();
        if (singleEmail !== chiefAdminInbox) {
          const txToUse = audience === 'single' ? attachedTx : null;
          const { finalSubject, finalBody, html, memoId } = buildRenderedEmail(single, txToUse);
          sendEmail(
            chiefAdminInbox,
            `[Admin Copy] ${finalSubject}`,
            `Manual push delivered to ${single.name} (${singleEmail}):\n\n${finalBody}`,
            html,
            'Chief Admin (Copy)',
            composeCategory,
            false,
            { memoId: memoId || undefined, eventType: 'admin_copy_manual_push', recipientUid: 'admin' }
          ).catch(() => {});
        }
      } else {
        const digestRef = `PUSH-${format(new Date(), 'yyyyMMdd-HHmm')}`;
        const recipientListText = deliveredMembers
          .slice(0, 15)
          .map((m, idx) => `${idx + 1}. ${m.name} (${m.email})`)
          .join('\n');
        const digestSummary = `Manual broadcast "${composeSubject}" delivered to ${deliveredCount} of ${audienceRecipients.length} recipients (${audience}).\n\nMessage:\n${composeBody}\n\nRecipients:\n${recipientListText}`;
        const digestHtml = generateBrandedEmailHtml(
          '[Admin Copy] Manual Dispatch Summary',
          digestSummary,
          {
            Audience: audience.toUpperCase(),
            Delivered: `${deliveredCount} of ${audienceRecipients.length} members`,
            Category: composeCategory,
            Subject: composeSubject.trim()
          },
          digestRef,
          typeof window !== 'undefined' ? window.location.origin : '',
          {
            accentTone: 'neutral',
            heroAmount: `${deliveredCount} Delivered`,
            heroCaption: `Manual Dispatch (${audience})`,
            automationBadge: 'Chief Admin Copy · Manual Broadcast'
          }
        );
        sendEmail(
          chiefAdminInbox,
          `[Admin Copy] Broadcast: ${composeSubject.trim()} (${deliveredCount} sent)`,
          digestSummary,
          digestHtml,
          'Chief Admin (Copy)',
          composeCategory,
          false,
          { memoId: digestRef, eventType: 'admin_copy_broadcast', recipientUid: 'admin' }
        ).catch(() => {});
      }
    }

    setSendingBatch({ active: false, done: audienceRecipients.length, total: audienceRecipients.length });
    if (deliveredCount === 0) await fetchHealthCheck();
    await logAuditEvent(
      'ADMIN_EMAIL_DISPATCH',
      `Dispatched "${composeSubject}" to ${deliveredCount}/${audienceRecipients.length} recipient(s) [${audience}]`,
      'info'
    );
    addToast(
      deliveredCount > 0 ? 'Dispatch Complete' : 'Dispatch Failed',
      `Delivered ${deliveredCount} of ${audienceRecipients.length} email${audienceRecipients.length > 1 ? 's' : ''}.`,
      deliveredCount > 0 ? 'success' : 'warning'
    );
  };

  // Pre-fill composer when clicking "Edit" on a Due Radar member
  const openComposerForMember = (member: UserProfile, preset: 'due' | 'memo' = 'due') => {
    setAudience('single');
    setSelectedMemberUid(member.uid);
    setHubTab('compose');
    setTimeout(() => {
      const debt = `৳${(member.remainingDebt || 0).toLocaleString()} BDT`;
      if (preset === 'due') {
        setComposeCategory('Due Reminder');
        setComposeTone('warning');
        setComposeSubject(`T.U.T. — Loan repayment reminder for ${member.name}`);
        setComposeTitle('Loan Repayment Reminder');
        setComposeBody(
          `Hi ${member.name},\n\nThis is a friendly reminder regarding your active balance of ${debt}. Please submit your payment through your T.U.T. dashboard (bKash, Nagad, or Cash Desk) when ready.`
        );
      }
    }, 0);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (alertFilter === 'system' && n.type !== 'system') return false;
    if (alertFilter === 'requests' && n.type !== 'request') return false;
    if (alertFilter === 'members' && n.type !== 'member') return false;
    return true;
  });

  const smtpConnected = smtpState.connected === true;
  const automatedEventCount = Object.keys(EVENT_REGISTRY).length;

  const engineStatusBadge = useMemo(() => {
    const st = autoEmailState?.status || (automationCfg.masterEnabled ? 'active' : 'paused');
    if (!automationCfg.masterEnabled || st === 'paused') {
      return { label: 'Paused', cls: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
    if (st === 'smtp_blocked' || (smtpState.connected === false && smtpState.error)) {
      return { label: 'SMTP Attention', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    }
    if (st === 'scanning' || runningAutoCycle) {
      return { label: 'Scanning Queue', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    return { label: 'Autonomous Active', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  }, [autoEmailState?.status, automationCfg.masterEnabled, smtpState.connected, smtpState.error, runningAutoCycle]);

  const automatedWorkflowMatrix = useMemo(
    () => [
      {
        name: 'Membership Registration & KYC Decisions',
        trigger: 'Applicant submits form / Admin approves or rejects',
        active: automationCfg.masterEnabled && automationCfg.autoMembershipUpdates
      },
      {
        name: 'Transaction Approvals, Declines & Official Memos',
        trigger: 'Loan, Deposit, Repayment, Refund & Subscription confirmations',
        active: automationCfg.masterEnabled && automationCfg.autoTransactionMemos
      },
      {
        name: 'P2P Instant Member Transfers',
        trigger: 'Debit notice to sender + Receipt notice to recipient',
        active: automationCfg.masterEnabled && automationCfg.autoTransactionMemos
      },
      {
        name: 'Autonomous Due & Overdue Escalation',
        trigger: `${automationCfg.dueReminderLeadDays}d pre-due warning + every ${automationCfg.overdueRepeatDays}d while overdue`,
        active: automationCfg.masterEnabled && automationCfg.autoDueReminders
      },
      {
        name: 'Security & Verified Payout Wallet Alerts',
        trigger: 'Wallet bind requests, verification status & PIN notices',
        active: automationCfg.masterEnabled && automationCfg.securityAlerts
      }
    ],
    [automationCfg]
  );

  return (
    <div className="space-y-4 w-full max-w-7xl mx-auto pb-8">
      {/* Top Gateway Status Strip + Automation-First Navigation */}
      <div className="bg-[#0C152E] border border-[#16274E] rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Sub-module Tab Switcher with Layout Spring Indicator */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#070D19] border border-[#16274E] overflow-x-auto custom-scrollbar">
            {[
              { id: 'overview' as HubTab, label: 'Automation & Radar', icon: Zap },
              { id: 'rules' as HubTab, label: `Policies & Alerts (${notifications.length})`, icon: Sliders },
              { id: 'logs' as HubTab, label: `Delivery Logs (${emailLogs.length})`, icon: Mail },
              { id: 'compose' as HubTab, label: 'Manual Push', icon: Send }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = hubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setHubTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'text-amber-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="emailHubTabPill"
                      transition={{ type: 'spring', stiffness: 460, damping: 34, duration: 0.18 }}
                      className="absolute inset-0 rounded-lg bg-[#132247] border border-amber-500/35"
                    />
                  )}
                  <Icon className={`w-3.5 h-3.5 relative z-10 ${active ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Verified SMTP Health Indicator + Verify Trigger */}
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-300 px-2.5 py-1.5 rounded-lg bg-[#070D19] border border-[#16274E]">
              {smtpConnected ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span className="font-medium text-white whitespace-nowrap">
                {smtpConnected
                  ? 'Gmail SMTP Verified'
                  : smtpState.code === 'EAUTH'
                  ? 'Gmail Auth Rejected'
                  : smtpState.gmailUserSet
                  ? 'SMTP Check Pending'
                  : 'SMTP Not Configured'}
              </span>
              {typeof smtpState.latencyMs === 'number' && smtpState.latencyMs > 0 && smtpConnected && (
                <span className="text-emerald-400 font-mono tabular-nums text-[11px]">· {smtpState.latencyMs}ms</span>
              )}
            </div>

            <button
              onClick={handleRunLiveSmtpTest}
              disabled={smtpState.checking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer tap-interactive"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${smtpState.checking ? 'animate-spin' : ''}`} />
              <span>{smtpState.checking ? 'Verifying...' : 'Verify SMTP'}</span>
            </button>
          </div>
        </div>

        {/* Active Gmail Account & Admin Routing Bar (always visible on mobile & desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-[#16274E]">
          <div className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-[#070D19] border border-[#16274E] min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-500/35 bg-[#0C152E] shrink-0">
                <img
                  src={adminPhoto || smtpState.senderAvatarUrl || '/assets/tut-authority-logo.jpg'}
                  alt="T.U.T Authority"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white truncate">
                  {smtpState.senderDisplayName || 'T.U.T Authority'}
                </div>
                <div className="text-[11px] font-mono font-semibold text-amber-300 truncate">
                  {smtpState.activeSenderEmail || smtpState.senderEmail || 'Checking server config...'}
                </div>
              </div>
            </div>
            {smtpState.senderSource && (
              <span className="text-[10px] font-mono text-slate-400 bg-[#0C152E] border border-[#182C58] px-1.5 py-0.5 rounded shrink-0">
                {smtpState.senderSource}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#070D19] border border-[#16274E] min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {adminPhoto ? (
                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/15 bg-[#0C152E] shrink-0">
                  <img
                    src={adminPhoto}
                    alt="Admin"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Admin Alert Inbox (To Admin)
                </div>
                <div className="text-xs font-mono font-semibold text-white truncate mt-0.5">
                  {smtpState.adminInbox || 'tahsinullahtusher999@gmail.com'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded shrink-0">
              {automationCfg.copyAdminOnMemberMails !== false ? 'Copies On' : 'Alerts Only'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#070D19] border border-[#16274E] min-w-0 sm:col-span-2 lg:col-span-1">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Dispatch Channel &amp; Avatar Sync
              </div>
              <div className="text-xs font-semibold text-slate-200 truncate mt-0.5">
                {smtpConnected
                  ? 'Primary Gmail SMTP + PDF Memo'
                  : smtpState.hasResendFallback
                  ? 'Resend HTTP Relay Active'
                  : 'Waiting on SMTP Auth'}
              </div>
            </div>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                smtpState.hasResendFallback
                  ? 'text-sky-300 bg-sky-500/10 border-sky-500/25'
                  : 'text-slate-400 bg-slate-800/40 border-slate-700'
              }`}
            >
              {smtpState.hasResendFallback ? 'Resend Standby' : 'SMTP Only'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Sender display name is <span className="text-slate-200 font-semibold">T.U.T Authority</span>. In Gmail inboxes, the sender circle photo comes automatically from the Google Account profile picture uploaded on{' '}
          <span className="font-mono text-amber-300">{smtpState.activeSenderEmail || 'tutauthority@gmail.com'}</span>.
        </p>

        {/* Inline SMTP Troubleshooting Banner (transparent failure diagnostic) */}
        {(showSmtpGuide || smtpState.error) && !smtpConnected && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-100 flex flex-col sm:flex-row sm:items-start justify-between gap-3 animate-slideDown">
            <div className="space-y-1">
              <div className="font-bold text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{smtpState.error || 'Gmail SMTP Gateway needs a valid 16-character App Password'}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Generate a fresh App Password under{' '}
                <span className="text-white font-semibold">Google Account → Security → 2-Step Verification → App Passwords</span> and update{' '}
                <code className="text-amber-300 font-mono">TUT_AUTHORITY_GMAIL_APP_PASSWORD</code> (or <code className="text-amber-300 font-mono">GMAIL_APP_PASSWORD</code>) in AI Studio Secrets (or configure{' '}
                <code className="text-amber-300 font-mono">RESEND_API_KEY</code> fallback). Once saved, click <span className="font-semibold text-white">Verify SMTP</span> and retry failed logs.
              </p>
            </div>
            <button
              onClick={() => setShowSmtpGuide(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white self-end sm:self-start cursor-pointer"
              aria-label="Close diagnostics tip"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Tab Body Transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={hubTab}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ===================================================================== */}
          {/* TAB 1: AUTOMATION ENGINE PIPELINE & DUE RADAR                         */}
          {/* ===================================================================== */}
          {hubTab === 'overview' && (
            <div className="space-y-4">
              {/* Autonomous Email Engine Pipeline Card */}
              <div className="bg-[#0C152E] border border-[#16274E] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Autonomous Email Engine</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${engineStatusBadge.cls}`}>
                      {engineStatusBadge.label}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      {automatedEventCount} automated triggers active
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-x-4 gap-y-1 flex-wrap font-mono tabular-nums">
                    <span>
                      Cadence: <strong className="text-slate-200">{automationCfg.dueReminderLeadDays}d lead · {automationCfg.overdueRepeatDays}d repeat</strong>
                    </span>
                    <span>
                      Last Auto-Scan:{' '}
                      <strong className="text-slate-200">
                        {autoEmailState?.lastScanAt ? formatSafeDate(autoEmailState.lastScanAt) : 'Syncing...'}
                      </strong>
                    </span>
                    <span>
                      Next Cycle:{' '}
                      <strong className="text-slate-200">
                        {autoEmailState?.nextScanAt ? format(new Date(autoEmailState.nextScanAt), 'HH:mm') : 'Every 15m'}
                      </strong>
                    </span>
                    <span>
                      Auto-Sent Session: <strong className="text-emerald-400">{autoEmailState?.totalAutoSentSession ?? 0}</strong>
                    </span>
                  </div>
                  {autoEmailState?.lastError && (
                    <div className="text-[11px] text-rose-300 truncate">
                      Last Engine Notice: {autoEmailState.lastError}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => setHubTab('rules')}
                    className="px-3 py-2 rounded-xl bg-[#070D19] hover:bg-[#132247] border border-[#182C58] text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer tap-interactive"
                  >
                    Configure Cadence
                  </button>
                  <button
                    onClick={handleTriggerAutoEngineNow}
                    disabled={runningAutoCycle || !automationCfg.masterEnabled}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer tap-interactive"
                  >
                    <Play className={`w-3.5 h-3.5 ${runningAutoCycle ? 'animate-pulse' : ''}`} />
                    <span>{runningAutoCycle ? 'Running Cycle...' : 'Run Auto-Cycle Now'}</span>
                  </button>
                </div>
              </div>

              {/* 4-Column KPI Telemetry */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[#0C152E] border border-[#16274E] rounded-xl p-3.5">
                  <div className="text-[11px] font-medium text-slate-400">Delivered Emails</div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold text-white font-mono tabular-nums">{telemetry.delivered}</span>
                    <span className="text-[11px] text-emerald-400 font-mono tabular-nums">{telemetry.last24h} in 24h</span>
                  </div>
                </div>

                <div className="bg-[#0C152E] border border-[#16274E] rounded-xl p-3.5">
                  <div className="text-[11px] font-medium text-slate-400">Delivery Rate</div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">{telemetry.successRate}%</span>
                    <span className="text-[11px] text-slate-400 font-mono tabular-nums">{telemetry.total} logged</span>
                  </div>
                </div>

                <div
                  onClick={() => {
                    if (telemetry.failed > 0) {
                      setLogStatusFilter('failed');
                      setHubTab('logs');
                    }
                  }}
                  className={`bg-[#0C152E] border rounded-xl p-3.5 transition-colors ${
                    telemetry.failed > 0 ? 'border-rose-500/35 hover:border-rose-400/60 cursor-pointer' : 'border-[#16274E]'
                  }`}
                >
                  <div className="text-[11px] font-medium text-slate-400">Failed Dispatches</div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className={`text-2xl font-bold font-mono tabular-nums ${telemetry.failed > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {telemetry.failed}
                    </span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{telemetry.failed > 0 ? 'Inspect & retry →' : 'Zero errors'}</span>
                  </div>
                </div>

                <div className="bg-[#0C152E] border border-[#16274E] rounded-xl p-3.5">
                  <div className="text-[11px] font-medium text-slate-400">Overdue / Urgent Due</div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className={`text-2xl font-bold font-mono tabular-nums ${overdueCount > 0 ? 'text-rose-400' : urgentDueCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                      {overdueCount}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {urgentDueCount} urgent · {dueRadarItems.length} active
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left: Authoritative Overdue & Due Radar */}
                <div className="lg:col-span-7 bg-[#0C152E] border border-[#16274E] rounded-2xl overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-[#16274E] flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-amber-400" />
                        <span>Unified Member Due Radar</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">Synced with loan tranche ledger & automated reminder scanner</p>
                    </div>
                    <button
                      onClick={handleBatchDueScan}
                      disabled={isRunningBatchDue || urgentDueCount === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#132247] hover:bg-[#1A316B] disabled:opacity-50 border border-amber-500/30 text-amber-300 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer tap-interactive"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isRunningBatchDue ? 'Dispatching...' : 'Send Urgent Batch'}</span>
                    </button>
                  </div>

                  <div className="divide-y divide-[#16274E]/70 max-h-[390px] overflow-y-auto custom-scrollbar">
                    {dueRadarItems.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto opacity-80" />
                        <div className="font-semibold text-white">No Active Borrower Debts</div>
                        <p className="text-[11px] text-slate-500">All member loan accounts are currently settled.</p>
                      </div>
                    ) : (
                      dueRadarItems.map((item) => {
                        const { member, activeDebt, dueDateLabel, daysDiff, urgency, sentToday, lastReminderSent, openTranches } = item;
                        const urgencyLabel =
                          urgency === 'overdue'
                            ? `${Math.abs(daysDiff || 0)}d overdue`
                            : urgency === 'today'
                            ? 'Due today'
                            : urgency === 'upcoming'
                            ? `Due in ${daysDiff}d`
                            : dueDateLabel;

                        return (
                          <div
                            key={member.uid}
                            className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <button
                                  onClick={() => onInspectMember?.(member)}
                                  className="text-xs font-bold text-white hover:text-amber-300 truncate cursor-pointer text-left"
                                >
                                  {member.name}
                                </button>
                                <span
                                  className={`text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded shrink-0 ${
                                    urgency === 'overdue'
                                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                                      : urgency === 'today' || urgency === 'upcoming'
                                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                                      : 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {urgencyLabel}
                                </span>
                                {openTranches.length > 1 && (
                                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                    {openTranches.length} tranches
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                <span className="font-mono tabular-nums text-rose-300 font-semibold">৳{activeDebt.toLocaleString()}</span>
                                <span> · Due {dueDateLabel}</span>
                                <span> · {member.email || 'No email'}</span>
                                {lastReminderSent && <span className="text-slate-500 font-mono"> · Mailed {lastReminderSent}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => openComposerForMember(member, 'due')}
                                className="px-2.5 py-1.5 rounded-lg bg-[#070D19] hover:bg-[#132247] border border-[#182C58] text-slate-300 text-[11px] font-medium whitespace-nowrap cursor-pointer tap-interactive"
                                title="Customize email in Manual Push"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => sendSingleDueReminderFromRadar(item)}
                                disabled={sendingDueUid === member.uid || !member.email?.includes('@')}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 disabled:opacity-40 border border-amber-400/35 text-amber-300 text-[11px] font-semibold whitespace-nowrap cursor-pointer tap-interactive"
                              >
                                <Send className="w-3 h-3" />
                                <span>{sendingDueUid === member.uid ? 'Sending...' : sentToday ? 'Resend' : 'Remind'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right: Recent Outgoing Email Pulse */}
                <div className="lg:col-span-5 bg-[#0C152E] border border-[#16274E] rounded-2xl overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-[#16274E] flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-sky-400" />
                        <span>Recent Dispatches</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">Latest automated & workflow email logs</p>
                    </div>
                    <button
                      onClick={() => setHubTab('logs')}
                      className="text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-0.5 whitespace-nowrap cursor-pointer"
                    >
                      <span>View All</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-[#16274E]/70 max-h-[390px] overflow-y-auto custom-scrollbar">
                    {emailLogs.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">No outgoing emails logged yet.</div>
                    ) : (
                      [...emailLogs]
                        .sort((a, b) => toSafeMillis(b.timestamp) - toSafeMillis(a.timestamp))
                        .slice(0, 8)
                        .map((log, i) => (
                          <button
                            key={log.id || i}
                            onClick={() => {
                              setInspectorViewMode('card');
                              setInspectedLog(log);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/[0.02] transition-colors flex items-start gap-2.5 cursor-pointer"
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                                log.status === 'delivered' ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-white truncate">{log.subject || 'Notification'}</div>
                              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                {log.recipientName || log.to} · {log.category || 'System'}
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono tabular-nums shrink-0 mt-0.5">
                              {formatSafeDate(log.timestamp).split(', ')[1] || ''}
                            </span>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 2: AUTOMATION POLICIES, MATRIX & ALERTS                           */}
          {/* ===================================================================== */}
          {hubTab === 'rules' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left: Automation Controls & Trigger Matrix */}
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-[#0C152E] border border-[#16274E] rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#16274E]">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        <span>Automation Controls</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">Priority policies governing hands-free system emails</p>
                    </div>
                    {savingRules && <span className="text-[10px] text-amber-300 font-mono">Saving...</span>}
                  </div>

                  <div className="space-y-2.5">
                    {[
                      {
                        key: 'masterEnabled' as const,
                        title: 'Global Autonomous Gateway',
                        desc: 'Master switch for all automated member & admin notifications'
                      },
                      {
                        key: 'autoDueReminders' as const,
                        title: 'Auto Due & Overdue Escalator',
                        desc: 'Automatically scans due dates on boot & every 15 minutes'
                      },
                      {
                        key: 'autoTransactionMemos' as const,
                        title: 'Instant Transaction & Memo Dispatches',
                        desc: 'Dispatches formatted PDF/Memo receipts on loans, deposits, repayments & P2P'
                      },
                      {
                        key: 'autoMembershipUpdates' as const,
                        title: 'Membership & KYC Lifecycle',
                        desc: 'Automatic emails for registrations, approvals, rejections & info checks'
                      },
                      {
                        key: 'copyAdminOnMemberMails' as const,
                        title: 'Admin Telemetry Copy',
                        desc: 'Send copies of key system-triggered alerts to Admin Gmail'
                      },
                      {
                        key: 'securityAlerts' as const,
                        title: 'Security & Wallet Notices',
                        desc: 'Wallet linking, verification, and security activity notices'
                      }
                    ].map((rule) => {
                      const enabled = Boolean(automationCfg[rule.key]);
                      return (
                        <div
                          key={rule.key}
                          className="p-3 rounded-xl bg-[#070D19] border border-[#16274E] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white">{rule.title}</div>
                            <div className="text-[11px] text-slate-400 leading-snug mt-0.5">{rule.desc}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveAutomationRule({ [rule.key]: !enabled })}
                            className={`w-10 h-5 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer ${
                              enabled ? 'bg-emerald-500' : 'bg-slate-700'
                            }`}
                            aria-label={`Toggle ${rule.title}`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition-transform duration-150 ${
                                enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}

                    {/* Schedule Tuning */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div className="p-2.5 rounded-xl bg-[#070D19] border border-[#16274E]">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Lead Window (Before Due)</label>
                        <select
                          value={automationCfg.dueReminderLeadDays}
                          onChange={(e) => handleSaveAutomationRule({ dueReminderLeadDays: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 rounded-lg bg-[#0C152E] border border-[#182C58] text-xs text-white font-mono"
                        >
                          <option value={1}>1 Day Before</option>
                          <option value={3}>3 Days Before</option>
                          <option value={5}>5 Days Before</option>
                          <option value={7}>7 Days Before</option>
                        </select>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#070D19] border border-[#16274E]">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Overdue Repeat Cadence</label>
                        <select
                          value={automationCfg.overdueRepeatDays}
                          onChange={(e) => handleSaveAutomationRule({ overdueRepeatDays: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 rounded-lg bg-[#0C152E] border border-[#182C58] text-xs text-white font-mono"
                        >
                          <option value={1}>Daily (Every 1 Day)</option>
                          <option value={3}>Every 3 Days</option>
                          <option value={5}>Every 5 Days</option>
                          <option value={7}>Every 7 Days</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Automated Event Matrix */}
                <div className="bg-[#0C152E] border border-[#16274E] rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#16274E]">
                    <span className="text-xs font-bold text-white">Event-Driven Email Matrix</span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">{automatedEventCount} handlers</span>
                  </div>
                  <div className="space-y-2">
                    {automatedWorkflowMatrix.map((row) => (
                      <div key={row.name} className="flex items-center justify-between gap-3 py-1.5 border-b border-[#16274E]/50 last:border-b-0">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-200 truncate">{row.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{row.trigger}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap shrink-0 ${
                            row.active ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {row.active ? 'Enabled' : 'Off'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Live Operations Alerts Feed */}
              <div className="lg:col-span-6 bg-[#0C152E] border border-[#16274E] rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#16274E]">
                  <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-[#070D19] border border-[#16274E] overflow-x-auto">
                    {(['all', 'system', 'requests', 'members'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setAlertFilter(tab)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all capitalize whitespace-nowrap cursor-pointer ${
                          alertFilter === tab
                            ? 'bg-[#132247] text-amber-300 border border-amber-500/35'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {onClearAll && notifications.length > 0 && (
                    <button
                      onClick={onClearAll}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors self-start sm:self-auto whitespace-nowrap cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Clear All ({notifications.length})
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-0.5">
                  {filteredNotifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs space-y-1.5">
                      <CheckCircle2 className="w-6 h-6 text-teal-400 mx-auto opacity-70" />
                      <div className="font-semibold text-white">All Caught Up</div>
                      <p className="text-slate-500 text-[11px]">No active alerts in this category.</p>
                    </div>
                  ) : (
                    filteredNotifications.map((notif) => {
                      let icon = <Info className="w-3.5 h-3.5 text-blue-400" />;
                      let iconBg = 'bg-blue-500/10 border-blue-500/20';

                      if (notif.type === 'request') {
                        icon = <FileText className="w-3.5 h-3.5 text-amber-400" />;
                        iconBg = 'bg-amber-500/10 border-amber-500/20';
                      } else if (notif.type === 'member') {
                        icon = <User className="w-3.5 h-3.5 text-teal-400" />;
                        iconBg = 'bg-teal-500/10 border-teal-500/20';
                      } else if (notif.type === 'system') {
                        icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
                        iconBg = 'bg-emerald-500/10 border-emerald-500/20';
                      }

                      return (
                        <div
                          key={notif.id}
                          className="bg-[#070D19] border border-[#16274E] hover:border-slate-600/70 rounded-xl p-3 flex items-start gap-3 transition-colors group relative"
                        >
                          <div className={`w-8 h-8 rounded-lg ${iconBg} border flex items-center justify-center shrink-0 mt-0.5`}>
                            {icon}
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <div className="text-xs font-semibold text-white">{notif.title}</div>
                            <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{notif.message}</div>
                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-mono tabular-nums">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{formatSafeDate(notif.timestamp)}</span>
                            </div>
                          </div>

                          {onDismiss && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDismiss(notif.id);
                              }}
                              title="Dismiss"
                              className="opacity-60 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-all absolute top-2.5 right-2.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 3: DELIVERY LOGS & OUTBOX                                         */}
          {/* ===================================================================== */}
          {hubTab === 'logs' && (
            <div className="bg-[#0C152E] border border-[#16274E] rounded-2xl overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-[#16274E] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {(['all', 'delivered', 'failed'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setLogStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer whitespace-nowrap ${
                        logStatusFilter === st
                          ? 'bg-[#132247] text-amber-300 border border-amber-500/35'
                          : 'bg-[#070D19] text-slate-400 border border-[#16274E] hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}

                  <select
                    value={logCategoryFilter}
                    onChange={(e) => setLogCategoryFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#070D19] border border-[#16274E] text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="all">All Categories</option>
                    <option value="Transaction">Transaction</option>
                    <option value="Membership">Membership</option>
                    <option value="Due Reminder">Due Reminder</option>
                    <option value="Broadcast">Broadcast</option>
                    <option value="Security">Security</option>
                    <option value="System">System</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Search email, name, memo ID..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#070D19] border border-[#16274E] text-xs text-white focus:outline-none focus:border-amber-500/45"
                    />
                  </div>

                  {telemetry.failed > 0 && (
                    <button
                      onClick={handleRetryAllFailed}
                      disabled={isRetryingAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer tap-interactive"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRetryingAll ? 'animate-spin' : ''}`} />
                      <span>{isRetryingAll ? 'Retrying...' : 'Retry Failed'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-[#16274E]/70 max-h-[540px] overflow-y-auto custom-scrollbar">
                {filteredEmailLogs.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400">
                    No email logs match the current filter.
                  </div>
                ) : (
                  filteredEmailLogs.map((log, idx) => (
                    <div
                      key={log.id || idx}
                      onClick={() => {
                        setInspectorViewMode('card');
                        setInspectedLog(log);
                      }}
                      className="px-4 py-3 hover:bg-white/[0.025] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span
                          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                            log.status === 'delivered' ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white truncate max-w-md">{log.subject || 'Notification'}</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#070D19] border border-[#16274E] text-slate-300">
                              {log.category || 'System'}
                            </span>
                            {log.memoId && (
                              <span className="text-[10px] font-mono text-amber-300">{log.memoId}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            <span>{log.recipientName || 'Member'}</span>
                            <span className="text-slate-500"> · {log.to}</span>
                            {log.error && <span className="text-rose-400"> · {log.error}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <div className="text-right">
                          <div className={`text-[11px] font-semibold font-mono tabular-nums ${log.status === 'delivered' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {log.status === 'delivered' ? 'Delivered' : 'Failed'}
                            {typeof log.latencyMs === 'number' && log.latencyMs > 0 ? ` · ${log.latencyMs}ms` : ''}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono tabular-nums">{formatSafeDate(log.timestamp)}</div>
                        </div>

                        {log.status === 'failed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetryEmail(log);
                            }}
                            disabled={retryingId === (log.id || log.to)}
                            className="px-2.5 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-300 text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                          >
                            {retryingId === (log.id || log.to) ? '...' : 'Resend'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 4: MANUAL PUSH & MEMO COMPOSER (SECONDARY FALLBACK)               */}
          {/* ===================================================================== */}
          {hubTab === 'compose' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Form */}
              <form onSubmit={handleDispatchCompose} className="lg:col-span-7 bg-[#0C152E] border border-[#16274E] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#16274E]">
                  <div>
                    <h3 className="text-sm font-bold text-white">Manual Desk Push</h3>
                    <p className="text-[11px] text-slate-400">Optional manual announcements or one-off member memos</p>
                  </div>
                  <div className="flex lg:hidden items-center gap-1 p-0.5 rounded-lg bg-[#070D19] border border-[#16274E]">
                    <button
                      type="button"
                      onClick={() => setComposeMode('edit')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${composeMode === 'edit' ? 'bg-[#132247] text-amber-300' : 'text-slate-400'}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposeMode('preview')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${composeMode === 'preview' ? 'bg-[#132247] text-amber-300' : 'text-slate-400'}`}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {composeMode === 'preview' && (
                  <div className="lg:hidden">
                    <iframe
                      title="Mobile Email Preview"
                      srcDoc={previewHtml}
                      className="w-full h-[420px] rounded-xl border border-[#16274E] bg-slate-100"
                      sandbox=""
                    />
                  </div>
                )}

                <div className={composeMode === 'preview' ? 'hidden lg:block space-y-4' : 'space-y-4'}>
                  {/* Audience Target Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-300">Recipient Target</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[
                        { id: 'single' as AudienceType, label: 'Single Member' },
                        { id: 'overdue' as AudienceType, label: `Overdue (${overdueCount})` },
                        { id: 'borrowers' as AudienceType, label: `Borrowers (${dueRadarItems.length})` },
                        { id: 'pending_kyc' as AudienceType, label: 'Pending KYC' },
                        { id: 'approved' as AudienceType, label: 'All Approved' },
                        { id: 'custom' as AudienceType, label: 'Custom Email' }
                      ].map((opt) => (
                        <button
                          type="button"
                          key={opt.id}
                          onClick={() => setAudience(opt.id)}
                          className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors text-left truncate cursor-pointer ${
                            audience === opt.id
                              ? 'bg-[#132247] border-amber-500/45 text-amber-300'
                              : 'bg-[#070D19] border-[#16274E] text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Single Member Picker */}
                  {audience === 'single' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#070D19] border border-[#16274E]">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold text-slate-300">Select Member</label>
                        <input
                          type="text"
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          placeholder="Filter name, ID or email..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C152E] border border-[#182C58] text-xs text-white focus:outline-none focus:border-amber-500/50"
                        />
                        <select
                          value={selectedMemberUid}
                          onChange={(e) => {
                            setSelectedMemberUid(e.target.value);
                            setAttachedTxId('');
                          }}
                          className="w-full px-2.5 py-2 rounded-lg bg-[#0C152E] border border-[#182C58] text-xs text-white focus:outline-none focus:border-amber-500/50"
                        >
                          <option value="">-- Choose a member --</option>
                          {filteredMembers.map((u) => (
                            <option key={u.uid} value={u.uid}>
                              {u.name} ({u.memberId || u.email})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold text-slate-300">Attach Official Memo Summary (Optional)</label>
                        <select
                          value={attachedTxId}
                          onChange={(e) => setAttachedTxId(e.target.value)}
                          disabled={!selectedMemberUid || memberRecentTxs.length === 0}
                          className="w-full px-2.5 py-2 rounded-lg bg-[#0C152E] border border-[#182C58] text-xs text-white focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
                        >
                          <option value="">No transaction memo attached</option>
                          {memberRecentTxs.map((tx) => (
                            <option key={tx.id} value={tx.id}>
                              {(tx.memoId || tx.id).slice(0, 16)} · {tx.type.toUpperCase()} · ৳{tx.amount.toLocaleString()} ({tx.status})
                            </option>
                          ))}
                        </select>
                        {selectedMemberObj && (
                          <div className="text-[10px] text-slate-400">
                            Email: <span className="text-slate-200 font-mono">{selectedMemberObj.email}</span> · Pref:{' '}
                            <span className={selectedMemberObj.emailNotificationsEnabled !== false ? 'text-emerald-400' : 'text-amber-400'}>
                              {selectedMemberObj.emailNotificationsEnabled !== false ? 'Opted In' : 'Muted Auto (Manual Override Ready)'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Custom Email Input */}
                  {audience === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#070D19] border border-[#16274E]">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Destination Email *</label>
                        <input
                          type="email"
                          value={customEmail}
                          onChange={(e) => setCustomEmail(e.target.value)}
                          placeholder="member@gmail.com"
                          className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#182C58] text-xs text-white focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Recipient Name</label>
                        <input
                          type="text"
                          value={customRecipientName}
                          onChange={(e) => setCustomRecipientName(e.target.value)}
                          placeholder="e.g. Shahriar Tajbir"
                          className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#182C58] text-xs text-white focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  )}

                  {/* Quick Simple Templates */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-300">Quick Templates</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { id: 'due' as const, label: 'Repayment Reminder' },
                        { id: 'memo' as const, label: 'Send Official Memo' },
                        { id: 'kyc' as const, label: 'Verification Check' },
                        { id: 'deposit' as const, label: 'Vault Summary' },
                        { id: 'notice' as const, label: 'General Notice' }
                      ].map((tpl) => (
                        <button
                          type="button"
                          key={tpl.id}
                          onClick={() => applyTemplate(tpl.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#132247] hover:bg-[#1A316B] border border-[#1E3A7B] text-[11px] font-medium text-sky-200 transition-colors cursor-pointer"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Category Tag</label>
                      <select
                        value={composeCategory}
                        onChange={(e) => setComposeCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#070D19] border border-[#16274E] text-xs text-white focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="Broadcast">Broadcast</option>
                        <option value="Due Reminder">Due Reminder</option>
                        <option value="Transaction">Transaction / Memo</option>
                        <option value="Membership">Membership</option>
                        <option value="Security">Security</option>
                        <option value="System">System</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Header Accent Tone</label>
                      <select
                        value={composeTone}
                        onChange={(e) => setComposeTone(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-lg bg-[#070D19] border border-[#16274E] text-xs text-white focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="neutral">Neutral Navy (Standard)</option>
                        <option value="success">Emerald (Confirmed / Memo)</option>
                        <option value="warning">Amber (Reminder / Action)</option>
                        <option value="danger">Crimson (Overdue / Urgent)</option>
                      </select>
                    </div>
                  </div>

                  {/* Subject & Heading */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Email Subject Line *</label>
                      <input
                        type="text"
                        required
                        value={composeSubject}
                        onChange={(e) => setComposeSubject(e.target.value)}
                        placeholder="e.g. T.U.T. — Loan repayment reminder"
                        className="w-full px-3 py-2 rounded-lg bg-[#070D19] border border-[#16274E] text-xs text-white focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Email Card Heading</label>
                      <input
                        type="text"
                        value={composeTitle}
                        onChange={(e) => setComposeTitle(e.target.value)}
                        placeholder="e.g. Repayment Reminder"
                        className="w-full px-3 py-2 rounded-lg bg-[#070D19] border border-[#16274E] text-xs text-white focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>

                  {/* Message Body */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-300">Message *</label>
                      <span className="text-[10px] text-slate-500 font-mono">Tokens: {'{name} {memberId} {debt} {limit}'}</span>
                    </div>
                    <textarea
                      rows={5}
                      required
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      placeholder="Write a clear, polite message that is easy for the member to understand..."
                      className="w-full px-3 py-2.5 rounded-xl bg-[#070D19] border border-[#16274E] text-xs text-white leading-relaxed focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  {/* Submit Bar */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#16274E]">
                    <div className="text-[11px] text-slate-400">
                      {sendingBatch.active ? (
                        <span className="text-amber-300 font-semibold font-mono tabular-nums">
                          Sending {sendingBatch.done} / {sendingBatch.total}...
                        </span>
                      ) : audience === 'custom' ? (
                        <span>Target: {customEmail || 'Custom address'}</span>
                      ) : (
                        <span>
                          Target: <strong className="text-white font-mono tabular-nums">{audienceRecipients.length}</strong> recipient{audienceRecipients.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={sendingBatch.active}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer tap-interactive"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingBatch.active ? 'Dispatching...' : 'Dispatch Mail'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Right Live Inbox Card Preview */}
              <div className="hidden lg:flex lg:col-span-5 bg-[#0C152E] border border-[#16274E] rounded-2xl overflow-hidden flex-col">
                <div className="px-4 py-3 border-b border-[#16274E] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Live Member Inbox Preview</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Statement Card</span>
                </div>
                <div className="p-3 flex-1 bg-[#070D19]">
                  <iframe
                    title="Live Email Preview"
                    srcDoc={previewHtml}
                    className="w-full h-[540px] rounded-xl border border-[#16274E] bg-slate-100"
                    sandbox=""
                  />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* EMAIL LOG INSPECTOR MODAL (WITH RENDERED CARD & RAW DIAGNOSTIC TOGGLE)*/}
      {/* ===================================================================== */}
      <AnimatePresence>
        {inspectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setInspectedLog(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[#0B132B] border border-[#182C58] rounded-2xl max-w-2xl w-full p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#182C58]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${inspectedLog.status === 'delivered' ? 'bg-emerald-400' : 'bg-rose-400'}`}
                    />
                    <span className="text-xs font-bold text-white truncate">{inspectedLog.subject}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono">
                    {inspectedLog.recipientName || 'Member'} · {inspectedLog.to}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#070D19] border border-[#16274E]">
                    <button
                      type="button"
                      onClick={() => setInspectorViewMode('card')}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        inspectorViewMode === 'card' ? 'bg-[#132247] text-amber-300' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Eye className="w-3 h-3" /> Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectorViewMode('raw')}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        inspectorViewMode === 'raw' ? 'bg-[#132247] text-amber-300' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Code2 className="w-3 h-3" /> Raw
                    </button>
                  </div>
                  <button
                    onClick={() => setInspectedLog(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[#070D19] border border-[#16274E]">
                  <div className="text-[10px] text-slate-400">Status</div>
                  <div className={`font-bold mt-0.5 ${inspectedLog.status === 'delivered' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {inspectedLog.status === 'delivered' ? 'Delivered' : 'Failed'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#070D19] border border-[#16274E]">
                  <div className="text-[10px] text-slate-400">Timestamp</div>
                  <div className="font-mono tabular-nums text-white mt-0.5 text-[11px]">{formatSafeDate(inspectedLog.timestamp)}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#070D19] border border-[#16274E] col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-slate-400">Memo Ref</div>
                  <div className="font-mono text-amber-300 font-bold mt-0.5 truncate">{inspectedLog.memoId || 'N/A'}</div>
                </div>
              </div>

              {inspectedLog.error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 leading-relaxed">
                  <strong className="text-rose-300 block mb-0.5">Error Diagnostic</strong>
                  {inspectedLog.error}
                </div>
              )}

              {inspectorViewMode === 'card' ? (
                <iframe
                  title="Email Render Inspector"
                  srcDoc={inspectedPreviewHtml}
                  className="w-full h-[320px] rounded-xl border border-[#16274E] bg-slate-100"
                  sandbox=""
                />
              ) : (
                <div className="p-3.5 rounded-xl bg-[#070D19] border border-[#16274E] text-xs text-slate-200 leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto custom-scrollbar">
                  {inspectedLog.body || '(No message content logged)'}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#182C58]">
                <button
                  onClick={() => setInspectedLog(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={async () => {
                    await handleRetryEmail(inspectedLog);
                    setInspectedLog(null);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs whitespace-nowrap cursor-pointer tap-interactive"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Resend Email</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
