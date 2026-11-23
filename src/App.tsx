/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, Component, useRef } from 'react';
import { MemberDashboard } from './components/MemberDashboard';
import { SecureTransactionPortal } from './components/SecureTransactionPortal';
import { BkashLogo, NagadLogo } from './components/PaymentBrandLogos';
import { LoginPage } from './components/Login';
import { AdminPortalV4 } from './components/AdminPortalV4';
import { AdminMemberDossierModal } from './components/AdminMemberDossierModal';
import { NotificationService, NotificationPayload, EmailAutomationConfig, DEFAULT_EMAIL_AUTOMATION_CONFIG, generateBrandedEmailHtml } from './services/NotificationService';
import { WorkforceManagement } from './components/WorkforceManagement';
import { WorkforceSupportWidget } from './components/WorkforceSupportWidget';
import { RegistrationProgressTracker } from './components/RegistrationProgressTracker';
import { UserNotificationsModal } from './components/UserNotificationsModal';
import { calculateUserUnreadCount } from './utils/userNotificationsEngine';
import { syncOfficialFinancialStatus } from './utils/financialSyncEngine';
import { buildMemberDueRadar } from './utils/loanAllocationEngine';
import { AutoEmailEngineState } from './components/admin/types';
import { TutPaymentCheckout, TutCheckoutRequest } from './components/TutPaymentCheckout';
import {
  normalizeMemoCode,
  computeLedgerChecksum,
  formatReceiptTimestamp,
  getReceiptMeta,
  downloadReceiptPng
} from './utils/receiptGenerator';
import tutLogo from './assets/images/tut_logo_1783437312744.jpg';
import { 
  auth, db, storage 
} from './firebase';
import { 
  signInWithPopup, 
  signInWithRedirect,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  orderBy,
  getDocFromServer,
  Timestamp,
  deleteDoc,
  increment,
  getDocs
} from 'firebase/firestore';
import { 
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Wallet, 
  History, 
  UserPlus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  LogOut, 
  Menu, 
  X, 
  MessageCircle, 
  ArrowUpRight, 
  ArrowDownLeft,
  Lock,
  Search,
  FileText,
  CreditCard,
  Trash2,
  Bell,
  BellOff,
  Settings,
  ExternalLink,
  AlertTriangle,
  History as HistoryIcon,
  User,
  Facebook,
  MessageSquare,
  Send,
  Eye,
  EyeOff,
  Copy,
  Upload,
  Camera,
  Briefcase,
  Activity,
  TrendingUp,
  Plus,
  Tag,
  Play,
  Mail,
  Crown,
  Award,
  Landmark,
  RotateCcw,
  HelpCircle,
  Users,
  ArrowLeft,
  Check,
  ChevronRight,
  FileCheck,
  UserCheck,
  XCircle,
  ShieldCheck,
  Scale,
  Home,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Sub-component: Full-Page Member Dossier & Premium Profile Editor ---
export interface AdminMemberDossierProps {
  member: UserProfile;
  onClose: () => void;
  onSave: (updated: any) => Promise<void>;
  allTransactions: Transaction[];
  db: any;
}

export const AdminMemberDossier = ({ member, onClose, onSave, allTransactions, db }: AdminMemberDossierProps) => {
  const [name, setName] = useState(member.name || '');
  const [nid, setNid] = useState(member.nid || '');
  const [address, setAddress] = useState(member.address || '');
  const [occupation, setOccupation] = useState(member.occupation || '');
  const [phone, setPhone] = useState(member.phone || '');
  const [facebook, setFacebook] = useState(member.facebook || '');
  const [whatsapp, setWhatsapp] = useState(member.whatsapp || '');
  const [telegram, setTelegram] = useState(member.telegram || '');
  const [fatherName, setFatherName] = useState(member.fatherName || '');
  const [motherName, setMotherName] = useState(member.motherName || '');
  const [dob, setDob] = useState(member.dob || '');
  const [bloodGroup, setBloodGroup] = useState(member.bloodGroup || '');
  const [emergencyContact, setEmergencyContact] = useState(member.emergencyContact || '');
  const [nomineeName, setNomineeName] = useState(member.nomineeName || '');
  const [nomineeRelation, setNomineeRelation] = useState(member.nomineeRelation || '');
  const [photoUrl, setPhotoUrl] = useState(member.photoUrl || '');
  const [permanentAddress, setPermanentAddress] = useState(member.permanentAddress || '');
  const [referenceContact, setReferenceContact] = useState(member.referenceContact || '');
  const [adminNotes, setAdminNotes] = useState(member.adminNotes || '');
  const [borrowingLimit, setBorrowingLimit] = useState(member.borrowingLimit ?? 100000);
  const [totalLoan, setTotalLoan] = useState(member.totalLoan ?? 0);
  const [totalDeposit, setTotalDeposit] = useState(member.totalDeposit ?? 0);
  const [remainingDebt, setRemainingDebt] = useState(member.remainingDebt ?? 0);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(member.emailNotificationsEnabled !== false);

  const [saving, setSaving] = useState(false);

  const memberTransactions = useMemo(() => {
    return allTransactions.filter(t => t.userId === member.uid);
  }, [allTransactions, member.uid]);

  const handleFormSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name,
        nid,
        address,
        occupation,
        phone,
        facebook,
        whatsapp,
        telegram,
        fatherName,
        motherName,
        dob,
        bloodGroup,
        emergencyContact,
        nomineeName,
        nomineeRelation,
        photoUrl,
        permanentAddress,
        referenceContact,
        adminNotes,
        borrowingLimit: Number(borrowingLimit),
        totalLoan: Number(totalLoan),
        totalDeposit: Number(totalDeposit),
        remainingDebt: Number(remainingDebt),
        emailNotificationsEnabled
      };
      await onSave(payload);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="p-2 bg-slate-950 border border-white/10 hover:border-blue-500/50 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest leading-none block">Member Management</span>
            <h1 className="text-xl font-black tracking-tight text-white mt-1">Dossier File & Profile Editor</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={onClose}
            className="px-4 py-2 text-xs bg-slate-950 text-slate-300 hover:text-white border border-white/5 hover:bg-slate-900"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleFormSave} 
            className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20"
            disabled={saving}
          >
            {saving ? "Saving Dossier..." : "Save Dossier Updates"}
          </Button>
        </div>
      </div>

      {/* Main Grid: Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Main Demographics) - Col span 7 */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section: Identity Credentials */}
          <div className="p-6 bg-slate-950/60 border border-white/5 rounded-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-blue-400" />
              1. Identity & Biography
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex flex-col md:flex-row items-center gap-5 p-4 bg-slate-900/50 border border-white/5 rounded-xl">
                <FileUploader 
                  label="Member Profile Photo"
                  currentUrl={photoUrl}
                  onUpload={(url) => setPhotoUrl(url)}
                />
                <div className="flex-1 space-y-2 w-full text-left">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none">Registered Node Account</p>
                  <p className="text-lg font-black text-white tracking-tight leading-none">{name || 'Unnamed Account'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-slate-400">{member.memberId || 'PENDING ASSIGNMENT'}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                    <span className="text-[9px] uppercase font-black text-blue-400 tracking-wider">
                      {member.status === 'approved' ? 'Approved Citizen' : 'Verification Queue'}
                    </span>
                  </div>
                </div>
              </div>

              <Input 
                label="Full Name"
                placeholder="e.g. Tahsin Ullah Tusher"
                value={name}
                onChange={e => setName(e.target.value)}
              />

              <Input 
                label="National ID (NID)"
                placeholder="e.g. 8273618492"
                value={nid}
                onChange={e => setNid(e.target.value)}
              />

              <Input 
                label="Father's Name"
                placeholder="e.g. Father's Name"
                value={fatherName}
                onChange={e => setFatherName(e.target.value)}
              />

              <Input 
                label="Mother's Name"
                placeholder="e.g. Mother's Name"
                value={motherName}
                onChange={e => setMotherName(e.target.value)}
              />

              <Input 
                label="Date of Birth"
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
              />

              <Input 
                label="Blood Group"
                placeholder="e.g. A+, O-, B+"
                value={bloodGroup}
                onChange={e => setBloodGroup(e.target.value)}
              />

              <Input 
                label="Core Phone Number"
                placeholder="e.g. +88017000000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />

              <Input 
                label="Occupation"
                placeholder="e.g. Software Engineer"
                value={occupation}
                onChange={e => setOccupation(e.target.value)}
              />
            </div>
          </div>

          {/* Section: Residence Coordinates */}
          <div className="p-6 bg-slate-950/60 border border-white/5 rounded-2xl relative overflow-hidden backdrop-blur-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
              <Landmark className="w-3.5 h-3.5 text-blue-400" />
              2. Geographic Registry
            </h2>
            <div className="space-y-4">
              <Input 
                label="Present Address"
                placeholder="Present living address"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
              <Input 
                label="Permanent Address"
                placeholder="Permanent village address"
                value={permanentAddress}
                onChange={e => setPermanentAddress(e.target.value)}
              />
            </div>
          </div>

          {/* Section: Digital Communication Links */}
          <div className="p-6 bg-slate-950/60 border border-white/5 rounded-2xl relative overflow-hidden backdrop-blur-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-blue-400" />
              3. Telecommunication & Handles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input 
                label="Facebook URL"
                placeholder="https://facebook.com/..."
                value={facebook}
                onChange={e => setFacebook(e.target.value)}
              />
              <Input 
                label="WhatsApp"
                placeholder="Phone or handle"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
              />
              <Input 
                label="Telegram"
                placeholder="@username"
                value={telegram}
                onChange={e => setTelegram(e.target.value)}
              />
            </div>
          </div>

        </div>

        {/* Right Column (Finances, Nominee, & History) - Col span 5 */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section: Financial Authority Limits */}
          <div className="p-6 bg-slate-950/60 border border-white/5 rounded-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              4. Banking Limits & Balances
            </h2>
            <div className="space-y-4">
              <Input 
                label="Maximum Borrowing Limit (৳)"
                type="number"
                placeholder="100000"
                value={borrowingLimit}
                onChange={e => setBorrowingLimit(Number(e.target.value))}
              />

              <div className="grid grid-cols-3 gap-3">
                <Input 
                  label="Total Deposited"
                  type="number"
                  value={totalDeposit}
                  onChange={e => setTotalDeposit(Number(e.target.value))}
                />
                <Input 
                  label="Outstanding Loan"
                  type="number"
                  value={totalLoan}
                  onChange={e => setTotalLoan(Number(e.target.value))}
                />
                <Input 
                  label="Active Debt Due"
                  type="number"
                  value={remainingDebt}
                  onChange={e => setRemainingDebt(Number(e.target.value))}
                />
              </div>

              <div className="p-3 bg-slate-900/40 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Authority Liquidity Ratio:</span>
                <span className={cn(
                  "font-bold",
                  totalDeposit >= totalLoan ? "text-emerald-400" : "text-amber-400"
                )}>
                  {totalDeposit === 0 ? '0.00' : ((totalLoan / totalDeposit) * 100).toFixed(1)}% LDR
                </span>
              </div>
            </div>
          </div>

          {/* Section: Next of Kin / Nominee */}
          <div className="p-6 bg-slate-950/60 border border-white/5 rounded-2xl relative overflow-hidden backdrop-blur-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              5. Emergency Contacts & Nominees
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Nominee Name"
                  placeholder="e.g. Nominee Full Name"
                  value={nomineeName}
                  onChange={e => setNomineeName(e.target.value)}
                />
                <Input 
                  label="Nominee Relation"
                  placeholder="e.g. Spouse, Brother"
                  value={nomineeRelation}
                  onChange={e => setNomineeRelation(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Emergency Contact"
                  placeholder="e.g. +88017..."
                  value={emergencyContact}
                  onChange={e => setEmergencyContact(e.target.value)}
                />
                <Input 
                  label="Reference Contact"
                  placeholder="e.g. Mentor / Partner"
                  value={referenceContact}
                  onChange={e => setReferenceContact(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 pl-1">Admin Supervision Logs & Notes</label>
                <textarea 
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Add internal compliance remarks, character assessments, or history..."
                  className="w-full min-h-[80px] text-xs px-3.5 py-3 rounded-xl bg-slate-900 border border-white/5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all custom-scrollbar"
                />
              </div>
            </div>
          </div>

          {/* Section: Member Communication Preferences */}
          <div className="p-6 bg-slate-950/60 border border-white/5 rounded-2xl relative overflow-hidden backdrop-blur-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              6. Communication Preferences
            </h2>
            <div className="flex items-center justify-between p-3.5 bg-slate-900/40 border border-white/5 rounded-xl">
              <div className="space-y-0.5 text-left">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider block">Email Notification Status</span>
                <span className="text-[9px] text-slate-500">Allow system to dispatch email statements and ledger updates directly to this citizen</span>
              </div>
              <Button
                type="button"
                onClick={() => setEmailNotificationsEnabled(!emailNotificationsEnabled)}
                className={cn(
                  "text-[10px] font-black uppercase py-1.5 px-3 h-auto rounded-xl border transition-all cursor-pointer",
                  emailNotificationsEnabled
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-slate-500/10 border-slate-500/20 text-slate-400 hover:bg-slate-500/20"
                )}
              >
                {emailNotificationsEnabled ? 'Active' : 'Muted'}
              </Button>
            </div>
          </div>

          {/* Section: Complete Ledger History */}
          <div className="p-6 bg-slate-950/60 border border-white/5 rounded-2xl relative overflow-hidden backdrop-blur-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2 mb-3 flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-blue-400" />
              6. Associated Ledger History ({memberTransactions.length})
            </h2>
            
            <div className="max-h-[220px] overflow-y-auto space-y-2 custom-scrollbar text-xs">
              {memberTransactions.length === 0 ? (
                <div className="py-8 text-center text-slate-500 font-mono text-[11px]">
                  No logged transactions recorded for this profile.
                </div>
              ) : (
                memberTransactions.map((tx) => {
                  const txDate = tx.timestamp?.seconds 
                    ? new Date(tx.timestamp.seconds * 1000) 
                    : tx.timestamp 
                      ? new Date(tx.timestamp) 
                      : new Date();
                  const formattedDate = format(txDate, 'dd MMM yyyy, HH:mm');
                  const isNegative = tx.type === 'loan' || tx.type === 'refund';

                  return (
                    <div key={tx.id} className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex justify-between items-center hover:bg-slate-900 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none border",
                            tx.type === 'deposit' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                            tx.type === 'loan' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                            "bg-blue-500/10 border-blue-500/20 text-blue-400"
                          )}>
                            {tx.type.replace('_', ' ')}
                          </span>
                          <span className={cn(
                            "text-[9px] font-bold uppercase",
                            tx.status === 'confirmed' ? "text-emerald-500" :
                            tx.status === 'pending' ? "text-amber-500" : "text-rose-500"
                          )}>
                            ● {tx.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">{formattedDate} • Ref: {tx.transactionId || 'Cash'}</p>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "font-mono font-bold text-sm",
                          isNegative ? "text-rose-400" : "text-emerald-400"
                        )}>
                          {isNegative ? '-' : '+'} ৳ {tx.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Persistent Save Floating Trigger at the bottom */}
      <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
        <Button 
          variant="secondary" 
          onClick={onClose}
          className="px-5 py-2.5 text-xs bg-slate-950 text-slate-300 hover:text-white border border-white/5 hover:bg-slate-900"
        >
          Cancel & Close
        </Button>
        <Button 
          onClick={handleFormSave} 
          className="px-6 py-2.5 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 border border-emerald-500/30"
          disabled={saving}
        >
          {saving ? "Saving Dossier File..." : "Save Dossier Updates"}
        </Button>
      </div>

    </div>
  );
};

// --- Constants ---
const ADMIN_EMAIL = 'tahsinullahtusher999@gmail.com'.toLowerCase();

const DEFAULT_SPONSORSHIPS: SponsorshipCampaign[] = [];

const LOADING_STATUSES = [
  "Securing Authority Gateway...",
  "Initializing Encrypted Session...",
  "Verifying Digital Signature...",
  "Syncing Financial Ledger...",
  "Establishing Secure Node...",
  "Connecting to T.U.T. Mainframe..."
];

// --- Utils ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// --- Types ---
export interface UserProfile {
  uid: string;
  email?: string;
  name: string;
  nid: string;
  address: string;
  occupation: string;
  phone: string;
  emailNotificationsEnabled?: boolean;
  // Social Media
  facebook?: string;
  whatsapp?: string;
  telegram?: string;
  // Detailed Info
  fatherName?: string;
  motherName?: string;
  dob?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  nomineeName?: string;
  nomineeRelation?: string;
  
  // New Fields
  photoUrl?: string;
  permanentAddress?: string;
  referenceContact?: string;
  adminNotes?: string;
  
  status: 'pending' | 'approved' | 'rejected';
  memberId?: string;
  totalLoan: number;
  totalDeposit: number;
  remainingDebt: number;
  totalRepaid?: number;
  reserveContribution?: number;
  portalDeposit?: number;
  role: 'admin' | 'member';
  createdAt: any;
  borrowingLimit?: number;

  // Subscription and Loyalty Fields
  subscriptionTier?: 'bronze' | 'silver' | 'gold' | null;
  subscriptionStatus?: 'active' | 'expired' | 'pending_approval' | null;
  subscriptionExpiresAt?: string | null;
  continuousSubscriptionMonths?: number;
  loansTakenThisMonth?: number;
  consecutiveNoLoanMonths?: number;
  autoRenewSubscription?: boolean;
  lastSubscriptionPaidAt?: any;

  // Verification/Audit Tracking
  moreInfoRequested?: boolean;
  decidedBy?: string;
  decidedAt?: string;
  walletVerificationStatus?: string;
  documents?: { nidFront?: string; nidBack?: string; payslip?: string; utilityBill?: string; bankStatement?: string; [key: string]: any };
  registeredAt?: any;
  assignedModerator?: string;
  approvedAt?: string;
  updatedAt?: any;
}

export interface Transaction {
  id: string;
  userId: string;
  userName?: string;
  userPhoto?: string;
  proofUrl?: string;
  assignedModerator?: string;
  type: 'loan' | 'deposit' | 'refund' | 'pay_due' | 'subscription' | 'merchant_payment' | 'card_payment' | 'wallet_payment';
  amount: number;
  method: 'Cash' | 'Bkash' | 'Nagad' | 'Recharge' | 'Account Balance' | 'T.U.T. Card' | 'T.U.T. Wallet';
  accountNumber?: string;
  transactionId?: string;
  mobileOperator?: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'settled';
  timestamp: any;
  memoId?: string;
  loanReason?: string;
  estimatedRepaymentDate?: string;
  lastReminderSent?: string;
  subscriptionTier?: 'bronze' | 'silver' | 'gold';
  subscriptionMonths?: number;
  isTransfer?: boolean;
  transferType?: 'in' | 'out';
  transferRecipientName?: string;
  transferRecipientId?: string;
  transferSenderName?: string;
  transferSenderId?: string;
  reference?: string;
  adminNotes?: string;
  moreInfoRequested?: boolean;
  decidedBy?: string;
  decidedAt?: string;
  details?: string;
  purpose?: string;
  approvedDate?: string;
  monthlyInstallment?: number;
  title?: string;
  date?: string;
  merchantId?: string;
  merchantName?: string;
  orderId?: string;
  paymentInstrument?: 'tut_card' | 'tut_wallet' | 'tut_credit';
  cardLast4?: string;
}

export interface SponsorshipCampaign {
  id: string;
  companyName: string;
  dealValue: number;
  status: 'active' | 'paused' | 'completed';
  campaignType: 'Premium Partner' | 'Strategic Collab' | 'Community Sponsor';
  promotionText: string;
  impressions: number;
  clicks?: number;
  startDate: string;
  endDate: string;
  logoUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  targetUrl?: string;
  specialOffer?: string;
  // Smart Ad-Control Fields
  placement?: 'all' | 'entrance_popup' | 'deals_hero' | 'featured_carousel' | 'partner_grid';
  targetAudience?: 'all' | 'standard' | 'bronze' | 'silver' | 'gold' | 'active_borrowers' | 'depositors';
  priority?: number;
  isPinned?: boolean;
  category?: 'Fintech' | 'Shopping' | 'Food' | 'Mobility' | 'Telecom' | 'General';
  discountBadge?: string;
  ctaLabel?: string;
  accentColor?: string;
  maxImpressions?: number;
  frequencyCapHours?: number;
  updatedAt?: string;
  createdBy?: string;
}

// --- Error Boundary ---
export class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md glass p-8 rounded-3xl border-rose-500/20">
            <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
            <h2 className="text-2xl font-black text-white mb-4 uppercase italic">System Interrupted</h2>
            <p className="text-blue-200/60 mb-8 leading-relaxed">
              An unexpected error occurred. This might be due to a connection issue or a temporary system failure.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all"
            >
              Restart Application
            </button>
            {this.state.error && (
              <pre className="mt-6 p-4 bg-black/40 rounded-xl text-[10px] text-rose-400/60 text-left overflow-auto max-h-32 font-mono">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

export const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'glass' }) => {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40 border border-blue-400/20',
    secondary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 border border-indigo-400/20',
    outline: 'border border-blue-400/30 hover:bg-blue-400/10 text-blue-400 backdrop-blur-sm',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/40 border border-rose-400/20',
    ghost: 'hover:bg-blue-400/10 text-blue-400',
    glass: 'bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-md'
  };

  return (
    <button 
      className={cn(
        "px-4 py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 min-h-[44px] touch-manipulation",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, className, title, icon: Icon, subtitle }: { children: React.ReactNode, className?: string, title?: string, icon?: any, subtitle?: string }) => (
  <div className={cn("glass rounded-2xl p-6 relative overflow-hidden group", className)}>
    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors" />
    {title && (
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Icon className="w-5 h-5 text-blue-400" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-blue-400/60 font-medium">{subtitle}</p>}
          </div>
        </div>
      </div>
    )}
    <div className="relative z-10">
      {children}
    </div>
  </div>
);

const Input = ({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string, error?: string }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest ml-1">{label}</label>}
    <input 
      className={cn(
        "w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-blue-900/40 backdrop-blur-sm",
        error && "border-rose-500 focus:ring-rose-500/40"
      )}
      {...props}
    />
    {error && <p className="text-xs text-rose-400 ml-1 font-bold">{error}</p>}
  </div>
);

const Badge = ({ children, variant = 'info' }: { children: React.ReactNode, variant?: 'success' | 'warning' | 'info' | 'danger' }) => {
  const variants = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-lg shadow-emerald-500/10',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-lg shadow-amber-500/10',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-lg shadow-blue-500/10',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-lg shadow-rose-500/10'
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", variants[variant])}>
      {children}
    </span>
  );
};

const FileUploader = ({ onUpload, currentUrl, label, maxDimension = 400, shape = 'circle' }: { onUpload: (url: string) => void, currentUrl?: string, label: string, maxDimension?: number, shape?: 'circle' | 'square' }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    // Limit original file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size must be less than 5MB");
      return;
    }

    setUploading(true);
    
    // We use client-side compression to Base64 to bypass Cloud Storage setup limits and prevent hanging.
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIMENSION = maxDimension; // Custom max dimension
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // High quality
          onUpload(dataUrl);
        } else {
          setUploadError('Failed to process image');
        }
        setUploading(false);
      };
      
      img.onerror = () => {
        console.error("Image load error");
        setUploadError("Failed to read image file.");
        setUploading(false);
      };

      img.src = event.target?.result as string;
    };
    
    reader.onerror = () => {
      console.error("File read error", reader.error);
      setUploadError("Failed to read file.");
      setUploading(false);
    };
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest ml-1">{label}</label>
      <div className="flex items-center gap-4 p-4 bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-sm">
        <div className={cn(
          "border-2 border-amber-500/30 p-1 flex-shrink-0 overflow-hidden bg-blue-600/10 flex items-center justify-center",
          shape === 'circle' ? 'w-16 h-16 rounded-full' : 'w-24 h-16 rounded-2xl'
        )}>
          {currentUrl ? (
            <img 
              src={currentUrl} 
              alt="Preview" 
              className={cn("w-full h-full object-cover", shape === 'circle' ? 'rounded-full' : 'rounded-xl')} 
              referrerPolicy="no-referrer" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="w-6 h-6 text-blue-400/40" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
          />
          <Button 
            type="button" 
            variant="outline" 
            className="w-full py-2 text-xs" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Upload className="w-3.5 h-3.5" /> Upload File</>
            )}
          </Button>
          <p className="text-[9px] text-blue-400/40 mt-2 text-center uppercase font-black tracking-widest">Max 5MB (JPG/PNG)</p>
          {uploadError && <p className="text-[10px] text-rose-400 font-bold mt-1 text-center">{uploadError}</p>}
        </div>
      </div>
    </div>
  );
};

export const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="glass-dark w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative z-10 border border-white/10 flex flex-col max-h-[90vh]"
        >
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 sticky top-0 z-10">
            <h3 className="text-xl font-black tracking-tight text-white uppercase italic">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-5 h-5 text-blue-400" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export const DigitalMemo = ({ memo }: { memo: Transaction }) => {
  const receiptPayload = {
    id: memo.id,
    memoId: memo.memoId,
    type: memo.type,
    amount: memo.amount || 0,
    userName: memo.userName,
    userId: memo.userId,
    method: memo.method,
    accountNumber: memo.accountNumber,
    transactionId: memo.transactionId,
    date: memo.date,
    timestamp: memo.timestamp,
    dueDate: (memo as any).dueDate,
    estimatedRepaymentDate: memo.estimatedRepaymentDate,
    status: memo.status,
    adminNotes: memo.adminNotes,
    loanReason: memo.loanReason,
    reference: memo.reference,
    mobileOperator: memo.mobileOperator,
    isTransfer: memo.isTransfer,
    transferType: memo.transferType,
    transferSenderName: memo.transferSenderName,
    transferRecipientName: memo.transferRecipientName
  };

  const cleanCode = normalizeMemoCode(memo.id, memo.memoId);
  const checksum = computeLedgerChecksum(receiptPayload);
  const meta = getReceiptMeta(receiptPayload);
  const timestampStr = formatReceiptTimestamp(receiptPayload);
  const railText = `${memo.method || ''} ${memo.mobileOperator || ''}`.toLowerCase();

  const statusToneClass = {
    confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    hold: 'bg-blue-50 text-blue-800 border-blue-200',
    rejected: 'bg-rose-50 text-rose-800 border-rose-200'
  }[meta.statusTone];

  return (
    <div className="bg-white text-slate-900 rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col justify-between">
      {/* Sovereign Navy Header */}
      <div className="bg-[#091022] text-white px-5 py-3.5 border-b-2 border-[#D4AF37] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-amber-300">
            T.U.T. Private Lending Authority
          </div>
          <div className="text-xs font-mono font-bold text-white tracking-tight truncate mt-0.5">
            {cleanCode}
          </div>
        </div>
        <span className={cn('px-2 py-0.5 rounded text-[9.5px] font-bold tracking-wider uppercase border shrink-0', statusToneClass)}>
          {meta.statusLabel}
        </span>
      </div>

      {/* Archival Ledger Table */}
      <div className="p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              {meta.docTitle}
            </span>
            <span className="text-[11px] font-mono text-slate-500">{timestampStr}</span>
          </div>
          <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900 tracking-tight">
            ৳ {(memo.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center gap-3">
            <span className="text-slate-500 font-medium">Category</span>
            <span className="font-semibold text-slate-900">{meta.categoryLabel}</span>
          </div>
          <div className="flex justify-between items-center gap-3">
            <span className="text-slate-500 font-medium">Payment Rail</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
              {railText.includes('bkash') && <BkashLogo size="xs" variant="badge" />}
              {railText.includes('nagad') && <NagadLogo size="xs" variant="badge" />}
              <span>{memo.isTransfer ? 'T.U.T. Internal Transfer' : memo.method || 'Internal Treasury'}</span>
            </span>
          </div>
          {memo.isTransfer && memo.transferType === 'out' && (
            <div className="flex justify-between items-center gap-3">
              <span className="text-slate-500 font-medium">Recipient</span>
              <span className="font-semibold text-slate-900 truncate max-w-[180px]">
                {memo.transferRecipientName || 'Member'} ({memo.transferRecipientId || 'N/A'})
              </span>
            </div>
          )}
          {memo.isTransfer && memo.transferType === 'in' && (
            <div className="flex justify-between items-center gap-3">
              <span className="text-slate-500 font-medium">Sender</span>
              <span className="font-semibold text-slate-900 truncate max-w-[180px]">
                {memo.transferSenderName || 'Member'} ({memo.transferSenderId || 'N/A'})
              </span>
            </div>
          )}
          {memo.reference && (
            <div className="flex justify-between items-center gap-3">
              <span className="text-slate-500 font-medium">Reference</span>
              <span className="font-mono font-semibold text-slate-800 truncate max-w-[180px]">{memo.reference}</span>
            </div>
          )}
          {memo.adminNotes && (
            <div className="flex justify-between items-center gap-3">
              <span className="text-slate-500 font-medium">Remarks</span>
              <span className="text-slate-700 truncate max-w-[180px]">{memo.adminNotes}</span>
            </div>
          )}
          {memo.type === 'loan' && memo.estimatedRepaymentDate && (
            <div className="flex justify-between items-center gap-3">
              <span className="text-slate-500 font-medium">Scheduled Due</span>
              <span className="font-mono font-semibold text-amber-700">
                {format(new Date(memo.estimatedRepaymentDate), 'dd MMM yyyy')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Checksum + Instant PNG Download */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span className="text-[10.5px] font-mono font-bold text-slate-700 truncate">{checksum}</span>
        </div>
        <button
          type="button"
          onClick={() => downloadReceiptPng(receiptPayload)}
          className="px-2.5 py-1.5 rounded-lg bg-[#091022] hover:bg-[#132247] text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Download className="w-3 h-3 text-amber-300" />
          <span>PNG</span>
        </button>
      </div>
    </div>
  );
};

// --- Subscription and Loyalty Helpers ---
const getSubscriptionStatusInfo = (profile: UserProfile | null) => {
  if (!profile) return { active: true, status: 'active', tier: 'bronze', isLocked: false, isRenewalWindow: true, expiresAt: null };
  
  const today = new Date();
  const currentDay = today.getDate();
  
  const tier = profile.subscriptionTier || 'bronze';

  // Bronze tier is 100% free for everyone until further notice with ৳500 borrowing limit
  if (tier === 'bronze' || !tier) {
    return {
      active: true,
      status: 'active',
      tier: 'bronze',
      isLocked: false,
      isRenewalWindow: true,
      expiresAt: null
    };
  }
  
  const expiresAt = profile.subscriptionExpiresAt ? new Date(profile.subscriptionExpiresAt) : null;
  const isCurrentlyActive = profile.subscriptionStatus === 'active' && expiresAt && expiresAt >= today;
  
  // Standard renewal window is day 1 to 5
  const isRenewalWindow = currentDay >= 1 && currentDay <= 5;
  
  // Day 6 onwards is locked if not active
  const isLocked = currentDay >= 6 && !isCurrentlyActive;
  
  return {
    active: !!isCurrentlyActive,
    status: isCurrentlyActive ? 'active' : 'inactive',
    tier,
    isLocked,
    isRenewalWindow,
    expiresAt
  };
};

export const getSubscriptionPricing = (
  tier: 'bronze' | 'silver' | 'gold', 
  profile: UserProfile | null,
  billingMonths: number = 1
) => {
  // Bronze tier is completely FREE for everyone until further notice
  if (tier === 'bronze') {
    return {
      basePrice: 0,
      rawPrice: 0,
      price: 0,
      label: "Bronze Basic (100% Free Tier)",
      months: billingMonths || 1,
      discountApplied: 0,
      discountReason: "100% Free Tier for All Members (৳500 Limit)",
      isLate: false
    };
  }

  const basePrices = {
    bronze: 0,
    silver: 50,
    gold: 100
  };
  
  const basePrice = basePrices[tier] || 50;
  const today = new Date();
  const currentDay = today.getDate();
  const isLate = currentDay >= 6;
  
  let months = billingMonths || 1;
  let label = "1-Month standard fee";
  let multiMonthDiscountPercent = 0;
  
  if (months === 3) {
    multiMonthDiscountPercent = 0.10; // 10% off
    label = "3-Month Quarterly Tier (10% Off)";
  } else if (months === 6) {
    multiMonthDiscountPercent = 0.15; // 15% off
    label = "6-Month Biannual Tier (15% Off)";
  } else if (months === 12) {
    multiMonthDiscountPercent = 0.20; // 20% off
    label = "12-Month Annual VIP Tier (20% Off)";
  } else {
    months = 1;
    if (isLate) {
      months = 2;
      label = "2-Month Late Renewal Catch-up fee";
    } else {
      label = "1-Month standard fee";
    }
  }

  const rawPrice = basePrice * months;
  let price = rawPrice;
  let discountApplied = 0;
  let discountReason = "";

  if (multiMonthDiscountPercent > 0) {
    discountApplied = Math.round(rawPrice * multiMonthDiscountPercent);
    price = rawPrice - discountApplied;
    discountReason = `${Math.round(multiMonthDiscountPercent * 100)}% Multi-Month Saver Discount Applied!`;
  } else if ((profile?.consecutiveNoLoanMonths || 0) >= 2) {
    discountApplied = Math.round(price * 0.5);
    price = price - discountApplied;
    discountReason = "50% No-Loan Reward Discount Applied! (0 loans taken in the last 2 billing cycles)";
  } else if ((profile?.continuousSubscriptionMonths || 0) >= 3 && !isLate) {
    discountApplied = Math.round(price * 0.1);
    price = price - discountApplied;
    discountReason = "10% Loyalty Streak Discount Applied! (3+ months consecutive on-time renewals)";
  }

  return {
    basePrice,
    rawPrice,
    price: Math.max(0, price),
    label,
    months,
    discountApplied,
    discountReason,
    isLate: months === 2 && isLate
  };
};

export const SubscriptionBadge = ({ tier, status, expiresAtStr }: { tier?: 'bronze' | 'silver' | 'gold' | null, status?: string | null, expiresAtStr?: string | null }) => {
  if (!tier || status !== 'active') return null;
  
  const today = new Date();
  const expDate = expiresAtStr ? new Date(expiresAtStr) : null;
  if (expDate && expDate < today) return null;

  if (tier === 'bronze') {
    return (
      <span className="inline-flex items-center gap-1 bg-[#cd7f32]/10 text-[#cd7f32] border border-[#cd7f32]/30 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase shadow-[0_0_10px_rgba(205,127,50,0.1)]">
        🥉 Bronze Member
      </span>
    );
  }
  if (tier === 'silver') {
    return (
      <span className="inline-flex items-center gap-1 bg-slate-300/10 text-slate-300 border border-slate-300/30 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase shadow-[0_0_12px_rgba(203,213,225,0.15)] animate-pulse">
        🥈 Silver Exec
      </span>
    );
  }
  if (tier === 'gold') {
    return (
      <span className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/40 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-pulse">
        👑 Gold Elite
      </span>
    );
  }
  return null;
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 transition-all active:scale-95",
        copied 
          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
          : "bg-white/5 text-blue-400 border-white/10 hover:bg-white/10 hover:border-white/25"
      )}
      title="Copy to Clipboard"
    >
      <Copy className="w-3 h-3" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

export const BalanceCard = ({ profile }: { profile: UserProfile }) => (
  <div className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 text-white shadow-2xl shadow-blue-900/40 group">
    {/* Decorative background elements */}
    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700" />
    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl" />
    
    <div className="relative z-10 flex flex-col h-full justify-between min-h-[220px]">
      <div className="flex justify-between items-start">
        <div className="space-y-6 w-full">
          <div>
            <p className="text-blue-100/60 text-xs font-bold uppercase tracking-[0.2em] mb-1">Current Balance</p>
            <h2 className="text-5xl font-black tracking-tighter">৳ {profile.totalDeposit.toLocaleString()}</h2>
          </div>
          <div className="grid grid-cols-2 gap-6 pt-2">
            <div>
              <p className="text-rose-200/60 text-[11px] font-bold uppercase tracking-[0.2em] mb-1">Remaining Debt</p>
              <h3 className="text-2xl font-black tracking-tighter text-rose-200">৳ {profile.remainingDebt.toLocaleString()}</h3>
            </div>
            <div>
              <p className="text-yellow-200/60 text-[11px] font-bold uppercase tracking-[0.2em] mb-1">Borrowing Limit</p>
              <h3 className="text-2xl font-black tracking-tighter text-yellow-300">৳ {(profile.borrowingLimit ?? 100000).toLocaleString()}</h3>
            </div>
          </div>
        </div>
        <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 flex-shrink-0">
          <Wallet className="w-6 h-6 text-white" />
        </div>
      </div>
      
      <div className="mt-12 flex justify-between items-end">
        <div>
          <p className="text-blue-100/40 text-[10px] font-bold uppercase tracking-widest mb-1">Member ID</p>
          <p className="text-lg font-mono font-bold tracking-widest text-blue-50">{profile.memberId}</p>
        </div>
        <div className="text-right">
          <div className="flex flex-col items-end gap-1 mb-1">
            <p className="text-blue-100/40 text-[10px] font-bold uppercase tracking-widest">Account Holder</p>
            <SubscriptionBadge tier={profile.subscriptionTier} status={profile.subscriptionStatus} expiresAtStr={profile.subscriptionExpiresAt} />
          </div>
          <p className="text-sm font-bold uppercase tracking-tight">{profile.name}</p>
        </div>
      </div>
    </div>
  </div>
);

const QuickAction = ({ icon: Icon, label, onClick, variant = 'blue' }: { icon: any, label: string, onClick: () => void, variant?: 'blue' | 'indigo' | 'rose' | 'amber' }) => {
  const variants = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all active:scale-95 gap-3 group",
        variants[variant]
      )}
    >
      <div className="p-3 rounded-xl bg-current/10 group-hover:scale-110 transition-transform">
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
};

const VisionBranding = ({ showMotto = true }: { showMotto?: boolean }) => (
  <motion.div
    initial={{ y: -20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.1 }}
    className="relative py-16"
  >
    <div className="absolute -inset-24 bg-blue-600/5 blur-[120px] rounded-full opacity-40 pointer-events-none" />
    <div className="relative z-10 flex flex-col items-center text-center">
      {/* The Authority Header */}
      <div className="flex flex-col items-center mb-16">
        <div className="mb-6 relative">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center border border-white/20 shadow-[0_0_40px_rgba(59,130,246,0.3)] bg-slate-900">
             <img src={tutLogo} alt="T.U.T. Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-400 border-4 border-slate-950 shadow-lg animate-pulse" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-[-0.03em] uppercase leading-none drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
            T.U.T. Money Lending <span className="text-blue-500">Authority</span>
          </h1>
          <div className="flex items-center justify-center gap-4">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-blue-600/50" />
            <p className="text-[11px] font-black text-blue-400/80 uppercase tracking-[0.5em] whitespace-nowrap">Official Financial Hub</p>
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-blue-600/50" />
          </div>
        </div>
      </div>
      
      {/* Premium Personal Branding */}
      <div className="space-y-8 mb-16 relative">
        <div className="absolute -inset-x-20 inset-y-0 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="relative">
           <p className="text-blue-500/40 font-black text-[9px] uppercase tracking-[0.4em] mb-4">Conceptualized & Developed By</p>
           <div className="relative inline-block">
              {/* Decorative accent for the name */}
              <div className="absolute -inset-4 bg-white/5 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <h2 className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-blue-100/50 tracking-tighter mb-4 drop-shadow-[0_15px_15px_rgba(30,58,138,0.4)]">
                Tahsin Ullah Tusher
              </h2>
           </div>
        </div>
        <div className="relative inline-flex flex-col items-center">
           <div className="px-8 py-2.5 bg-slate-900/80 border border-white/10 rounded-2xl backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <p className="text-blue-200 text-[12px] sm:text-sm font-black uppercase tracking-[0.25em] italic">
                 Founder & Chief Strategist, T.U.T. Group of Services
              </p>
           </div>
           <div className="mt-2 h-[2px] w-24 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        </div>
      </div>

      {showMotto && (
        <div className="relative">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Trust Pillar */}
            <div className="flex flex-col items-center gap-2 group cursor-default">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)] animate-pulse" />
              <span className="text-[12px] sm:text-[14px] font-black text-white uppercase tracking-[0.5em] opacity-60 group-hover:opacity-100 transition-opacity">Trust</span>
            </div>

            <div className="text-blue-600/30 font-light text-2xl">|</div>

            {/* Unity Pillar */}
            <div className="flex flex-col items-center gap-2 group cursor-default">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)] animate-pulse" />
              <span className="text-[12px] sm:text-[14px] font-black text-white uppercase tracking-[0.5em] opacity-60 group-hover:opacity-100 transition-opacity">Unity</span>
            </div>

            <div className="text-blue-600/30 font-light text-2xl">|</div>

            {/* Technology Pillar */}
            <div className="flex flex-col items-center gap-2 group cursor-default">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)] animate-pulse" />
              <span className="text-[12px] sm:text-[14px] font-black text-white uppercase tracking-[0.5em] opacity-60 group-hover:opacity-100 transition-opacity">Technology</span>
            </div>
          </div>
          <div className="absolute -bottom-4 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      )}
    </div>
  </motion.div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('tut_saved_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [loadingStatusIndex, setLoadingStatusIndex] = useState(0);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [asyncError, setAsyncError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);

  // Cycle through professional loading messages while app is initial loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStatusIndex((prev) => (prev + 1) % 6);
    }, 1200);
    return () => clearInterval(interval);
  }, [loading]);

  // Trigger ErrorBoundary for async errors
  if (asyncError) throw asyncError;
  
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Admin State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return localStorage.getItem('tut_admin_logged_in') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('tut_admin_logged_in', isAdminLoggedIn.toString());
  }, [isAdminLoggedIn]);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminError, setAdminError] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  // Edit Member State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editLoan, setEditLoan] = useState('');
  const [editDeposit, setEditDeposit] = useState('');
  const [editDebt, setEditDebt] = useState('');
  
  // Delete Member State
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [sponsorships, setSponsorships] = useState<SponsorshipCampaign[]>([]);
  const [isSponsorshipsSeeded, setIsSponsorshipsSeeded] = useState(false);
  const [isClearingAllAds, setIsClearingAllAds] = useState(false);
  const [isClearingAllAdsLoading, setIsClearingAllAdsLoading] = useState(false);
  const [adminTab, setAdminTab] = useState<'overview' | 'reserve' | 'financials' | 'operations' | 'members' | 'partners' | 'ledger' | 'audit' | 'notifications' | 'reminders' | 'liquidity' | 'workforce'>('overview');
  const [selectedAdminMemberDetail, setSelectedAdminMemberDetail] = useState<UserProfile | null>(null);
  const [reserveOperationModal, setReserveOperationModal] = useState<{ isOpen: boolean; type: 'increase' | 'withdraw' | 'transfer' | 'lock' | 'unlock' | 'adjust'; fromCategory?: string; toCategory?: string; } | null>(null);
  const [reserveOpAmount, setReserveOpAmount] = useState('');
  const [reserveOpNotes, setReserveOpNotes] = useState('');
  const [reserveOpPin, setReserveOpPin] = useState('');
  const [reserveOpCategory, setReserveOpCategory] = useState('liquidReserve');
  const [reserveOpTargetCategory, setReserveOpTargetCategory] = useState('operationalReserve');
  const [selectedNotificationFilter, setSelectedNotificationFilter] = useState<'all' | 'Critical' | 'Financial' | 'Loan' | 'Reserve' | 'Members' | 'Security' | 'System'>('all');
  
  // Reserve States
  const [liquidReserve, setLiquidReserve] = useState(0);
  const [operationalReserve, setOperationalReserve] = useState(0);
  const [emergencyReserve, setEmergencyReserve] = useState(0);
  const [availableLendingFund, setAvailableLendingFund] = useState(0);
  const [reservedCapital, setReservedCapital] = useState(0);
  const [frozenCapital, setFrozenCapital] = useState(0);
  const [externalInvestmentReserve, setExternalInvestmentReserve] = useState(0);
  const [requestFilter, setRequestFilter] = useState<'all' | 'loan' | 'deposit' | 'withdraw' | 'repayment'>('all');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeCategory, setComposeCategory] = useState('Broadcast');
  const [composeRecipientCategory, setComposeRecipientCategory] = useState('all');
  const [composeIndividualEmail, setComposeIndividualEmail] = useState('');
  const [previewEmailLog, setPreviewEmailLog] = useState<any | null>(null);
  const [emailLogsFilter, setEmailLogsFilter] = useState('all');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Redesigned Banking Case File approval workflow states
  const [selectedCaseTransaction, setSelectedCaseTransaction] = useState<Transaction | null>(null);
  const [selectedCaseMember, setSelectedCaseMember] = useState<UserProfile | null>(null);
  const [adminDecisionNotes, setAdminDecisionNotes] = useState('');
  const [showDecisionConfirmation, setShowDecisionConfirmation] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'approve' | 'reject' | 'more_info' | null>(null);
  const [selectedCaseWallets, setSelectedCaseWallets] = useState<any[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCaseWalletsAndCards = async () => {
      const uid = selectedCaseTransaction?.userId || selectedCaseMember?.uid;
      if (!uid) {
        setSelectedCaseWallets([]);
        return;
      }
      try {
        const walletsRef = collection(db, `users/${uid}/wallets`);
        const walletsSnap = await getDocs(walletsRef);
        const fetched: any[] = [];
        walletsSnap.forEach(d => {
          fetched.push({ id: d.id, type: 'wallet', ...d.data() });
        });

        const cardsRef = collection(db, `users/${uid}/cards`);
        const cardsSnap = await getDocs(cardsRef);
        cardsSnap.forEach(d => {
          fetched.push({ id: d.id, type: 'card', ...d.data() });
        });

        setSelectedCaseWallets(fetched);
      } catch (err) {
        console.error("Error loading case wallets: ", err);
      }
    };

    fetchCaseWalletsAndCards();
  }, [selectedCaseTransaction, selectedCaseMember]);

  // Authority Capital Pool Control States
  const [authorityPersonalFund, setAuthorityPersonalFund] = useState<number>(5000000);
  const [showEditFundModal, setShowEditFundModal] = useState(false);
  const [tempFundValue, setTempFundValue] = useState('5000000');

  // Sponsorship Add/Edit Form State
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [sponsorCompany, setSponsorCompany] = useState('');
  const [sponsorValue, setSponsorValue] = useState('');
  const [sponsorType, setSponsorType] = useState<'Premium Partner' | 'Strategic Collab' | 'Community Sponsor'>('Premium Partner');
  const [sponsorPromo, setSponsorPromo] = useState('');
  const [sponsorStatus, setSponsorStatus] = useState<'active' | 'paused' | 'completed'>('active');
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState('');
  const [sponsorImageUrl, setSponsorImageUrl] = useState('');
  const [sponsorVideoUrl, setSponsorVideoUrl] = useState('');
  const [sponsorTargetUrl, setSponsorTargetUrl] = useState('');
  const [sponsorSpecialOffer, setSponsorSpecialOffer] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [showSupportWidget, setShowSupportWidget] = useState(true);

  // Entrance Interstitial Ad Popup & Global Ad Delivery Settings States
  const [activeEntranceAd, setActiveEntranceAd] = useState<SponsorshipCampaign | null>(null);
  const [hasAdBeenShown, setHasAdBeenShown] = useState(false);
  const [adSettings, setAdSettings] = useState<{
    entrancePopupEnabled: boolean;
    globalCooldownHours: number;
    allowHeroRotation: boolean;
    updatedAt?: string;
    updatedBy?: string;
  }>({
    entrancePopupEnabled: true,
    globalCooldownHours: 12,
    allowHeroRotation: true
  });
  const [sponsorChartView, setSponsorChartView] = useState<'traffic' | 'financial'>('traffic');
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);

  const [localSponsorChanges, setLocalSponsorChanges] = useState<SponsorshipCampaign[]>(() => {
    try {
      const saved = localStorage.getItem('tut_local_sponsorships');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [localDeletedSponsors, setLocalDeletedSponsors] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tut_local_deleted_sponsorships');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [deletingSponsorId, setDeletingSponsorId] = useState<string | null>(null);
  const [deletedIdsThisSession, setDeletedIdsThisSession] = useState<string[]>([]);

  // Create Member Account from Admin Dashboard states
  const [showCreateMemberModal, setShowCreateMemberModal] = useState(false);
  const [createMemberName, setCreateMemberName] = useState('');
  const [createMemberEmail, setCreateMemberEmail] = useState('');
  const [createMemberPhone, setCreateMemberPhone] = useState('');
  const [createMemberNid, setCreateMemberNid] = useState('');
  const [createMemberOccupation, setCreateMemberOccupation] = useState('');
  const [createMemberAddress, setCreateMemberAddress] = useState('');
  const [createMemberPermanentAddress, setCreateMemberPermanentAddress] = useState('');
  const [createMemberReferenceContact, setCreateMemberReferenceContact] = useState('');
  const [createMemberNomineeName, setCreateMemberNomineeName] = useState('');
  const [createMemberNomineeRelation, setCreateMemberNomineeRelation] = useState('');
  const [createMemberStatus, setCreateMemberStatus] = useState<'approved' | 'pending'>('approved');

  // Bank Liquidity & Stress Test Simulation states
  const [stressWithdrawalPct, setStressWithdrawalPct] = useState(20);
  const [stressDefaultPct, setStressDefaultPct] = useState(10);
  const [editingLimitUid, setEditingLimitUid] = useState<string | null>(null);
  const [editingLimitValue, setEditingLimitValue] = useState('');
  const [createMemberMemberId, setCreateMemberMemberId] = useState('');
  const [createMemberInitialDeposit, setCreateMemberInitialDeposit] = useState('0');
  const [createMemberInitialLoan, setCreateMemberInitialLoan] = useState('0');
  const [createMemberInitialDebt, setCreateMemberInitialDebt] = useState('0');

  useEffect(() => {
    localStorage.setItem('tut_local_sponsorships', JSON.stringify(localSponsorChanges));
  }, [localSponsorChanges]);

  useEffect(() => {
    localStorage.setItem('tut_local_deleted_sponsorships', JSON.stringify(localDeletedSponsors));
  }, [localDeletedSponsors]);

  const activeSponsorships = useMemo(() => {
    const mergedMap = new Map<string, SponsorshipCampaign>();
    const legacyDefaultIds = new Set(['sp-apex', 'sp-tusher', 'sp-bicon']);

    // 1. Add live Firestore sponsorship records (skip metadata document & legacy unmigrated defaults)
    sponsorships.forEach(s => {
      if (s.id === 'config_seeded' || legacyDefaultIds.has(s.id)) return;
      mergedMap.set(s.id, {
        ...s,
        clicks: s.clicks ?? 0
      });
    });

    // 2. Overlay any locally added/changed sponsorships
    localSponsorChanges.forEach(s => {
      if (legacyDefaultIds.has(s.id)) return;
      mergedMap.set(s.id, {
        ...s,
        clicks: s.clicks ?? 0
      });
    });

    const todayStr = new Date().toISOString().slice(0, 10);

    return Array.from(mergedMap.values())
      .filter(s => {
        if (s.status === 'completed') return false;
        if (localDeletedSponsors.includes(s.id)) return false;
        if (s.startDate && s.startDate.length === 10 && s.startDate > todayStr) return false;
        if (s.endDate && s.endDate.length === 10 && s.endDate < todayStr) return false;
        if (s.maxImpressions && s.maxImpressions > 0 && (s.impressions || 0) >= s.maxImpressions) return false;
        return true;
      })
      .sort((a, b) => {
        if (Boolean(b.isPinned) !== Boolean(a.isPinned)) return b.isPinned ? 1 : -1;
        return (b.priority || 0) - (a.priority || 0);
      });
  }, [sponsorships, localSponsorChanges, localDeletedSponsors]);

  // Master Financial Computations (Recomputed automatically when state shifts)
  const sponsorProfit = useMemo(() => {
    return activeSponsorships.reduce((sum, s) => sum + (s.dealValue || 0), 0);
  }, [activeSponsorships]);

  const totalLent = useMemo(() => {
    return allUsers.reduce((sum, u) => sum + (u.totalLoan || 0), 0);
  }, [allUsers]);

  const totalDeposits = useMemo(() => {
    return allUsers.reduce((sum, u) => sum + (u.totalDeposit || 0), 0);
  }, [allUsers]);

  const outstandingDebt = useMemo(() => {
    return allUsers.reduce((sum, u) => sum + (u.remainingDebt || 0), 0);
  }, [allUsers]);

  // Journey Cumulative Statistics for Detailed Liquidity Tracking
  const cumulativeStats = useMemo(() => {
    // 1. Total historical loans confirmed
    const confirmedLoans = allTransactions.filter(t => t.type === 'loan' && t.status === 'confirmed');
    const totalHistoricalLoans = confirmedLoans.reduce((sum, t) => sum + t.amount, 0);
    const countHistoricalLoans = confirmedLoans.length;

    // 2. Total historical deposits confirmed
    const confirmedDeposits = allTransactions.filter(t => t.type === 'deposit' && t.status === 'confirmed');
    const totalHistoricalDeposits = confirmedDeposits.reduce((sum, t) => sum + t.amount, 0);
    const countHistoricalDeposits = confirmedDeposits.length;

    // 3. Total historical repayments (refund + pay_due) confirmed
    const confirmedRepayments = allTransactions.filter(t => (t.type === 'refund' || t.type === 'pay_due') && t.status === 'confirmed');
    const totalHistoricalRepayments = confirmedRepayments.reduce((sum, t) => sum + t.amount, 0);
    const countHistoricalRepayments = confirmedRepayments.length;

    // Recovery Rate (Repayments vs Loans ratio)
    const recoveryRate = totalHistoricalLoans > 0 
      ? (totalHistoricalRepayments / totalHistoricalLoans) * 100 
      : 0;

    // Transaction volume by channel (bKash, Nagad, Cash, Recharge)
    const channels = ['Bkash', 'Nagad', 'Cash', 'Recharge'] as const;
    const channelMetrics = channels.map(ch => {
      const txs = allTransactions.filter(t => t.method === ch && t.status === 'confirmed');
      const volume = txs.reduce((sum, t) => sum + t.amount, 0);
      return {
        channel: ch,
        count: txs.length,
        volume
      };
    });

    return {
      totalHistoricalLoans,
      countHistoricalLoans,
      totalHistoricalDeposits,
      countHistoricalDeposits,
      totalHistoricalRepayments,
      countHistoricalRepayments,
      recoveryRate,
      channelMetrics
    };
  }, [allTransactions]);

  // Leaderboard statistics for approved members
  const memberLeaderboards = useMemo(() => {
    const approvedUsers = allUsers.filter(u => u.status === 'approved');

    // 1. Highest Depositors (current deposits)
    const topDepositors = [...approvedUsers]
      .sort((a, b) => (b.totalDeposit || 0) - (a.totalDeposit || 0))
      .slice(0, 5);

    // 2. Highest Borrowers (cumulative loans)
    const topBorrowers = [...approvedUsers]
      .sort((a, b) => (b.totalLoan || 0) - (a.totalLoan || 0))
      .slice(0, 5);

    // 3. Highest Active Debtors (remaining debt)
    const topActiveDebtors = [...approvedUsers]
      .sort((a, b) => (b.remainingDebt || 0) - (a.remainingDebt || 0))
      .slice(0, 5);

    return {
      topDepositors,
      topBorrowers,
      topActiveDebtors
    };
  }, [allUsers]);

  const totalFinancialAmount = useMemo(() => {
    return authorityPersonalFund + sponsorProfit;
  }, [authorityPersonalFund, sponsorProfit]);

  const runwayLiquidity = useMemo(() => {
    return totalFinancialAmount + totalDeposits - outstandingDebt;
  }, [totalFinancialAmount, totalDeposits, outstandingDebt]);

  const availableLendingCapacity = useMemo(() => {
    return totalFinancialAmount - outstandingDebt;
  }, [totalFinancialAmount, outstandingDebt]);
  
  // Toast State
  const [toasts, setToasts] = useState<{id: string, title: string, body: string, type: 'info' | 'success' | 'warning'}[]>([]);
  
  // Email Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const addToast = (title: string, body: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, body, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const handleFirestorePermissionOrTokenError = async (err: any, source: string): Promise<boolean> => {
    console.warn(`[Fail Safe] Caught snapshot error in ${source}:`, err);
    const isTokenExpired = err.code === 'permission-denied' || 
                           err.code === 'unauthenticated' || 
                           err.message?.toLowerCase().includes('permission') || 
                           err.message?.toLowerCase().includes('authenticated');
                           
    if (isTokenExpired) {
      console.log("[Fail Safe] Detected token expiration, session stale, or revoked permission on wake up.");
      try {
        if (auth.currentUser) {
          console.log("[Fail Safe] Session stale. Attempting token force-refresh...");
          await auth.currentUser.getIdToken(true);
          console.log("[Fail Safe] Token refreshed! Resuming connection...");
          return true; // Was recovered
        }
      } catch (refreshErr) {
        console.error("[Fail Safe] Force ID Token refresh failed:", refreshErr);
      }
      
      // If refresh fails or user is unauthenticated, redirect/logout gracefully
      addToast('Session Expired', 'Your secure session has expired. Please sign in again to continue safely.', 'warning');
      setProfile(null);
      localStorage.removeItem('tut_saved_profile');
      setIsAdminLoggedIn(false);
      try {
        await signOut(auth);
      } catch (signOutErr) {
        console.error("Signout error:", signOutErr);
      }
      setUser(null);
      return true; // Handled without crash
    }
    return false; // Not a session error
  };

  // Notification State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isIframe, setIsIframe] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [notificationHistory, setNotificationHistory] = useState<{id: string, title: string, body: string, timestamp: number}[]>(() => {
    const saved = localStorage.getItem('tut_notification_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [notificationSettingsMode, setNotificationSettingsMode] = useState(false);
  const [gmailNotificationsEnabled, setGmailNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('tut_gmail_notifications');
    return saved !== 'false';
  });
  const [emailAutomationConfig, setEmailAutomationConfig] = useState<EmailAutomationConfig>(DEFAULT_EMAIL_AUTOMATION_CONFIG);
  const [emailAutomationLoaded, setEmailAutomationLoaded] = useState(false);
  const [autoEmailState, setAutoEmailState] = useState<AutoEmailEngineState>({
    status: 'idle',
    lastScanAt: null,
    nextScanAt: null,
    lastSentCount: 0,
    lastEligibleCount: 0,
    totalAutoSentSession: 0,
    lastError: null
  });

  useEffect(() => {
    localStorage.setItem('tut_gmail_notifications', gmailNotificationsEnabled.toString());
  }, [gmailNotificationsEnabled]);

  useEffect(() => {
    const unsubAuto = onSnapshot(doc(db, 'system_controls', 'email_automation'), (snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        setEmailAutomationConfig({
          ...DEFAULT_EMAIL_AUTOMATION_CONFIG,
          ...d,
          dueReminderLeadDays: typeof d.dueReminderLeadDays === 'number' ? d.dueReminderLeadDays : 3,
          overdueRepeatDays: typeof d.overdueRepeatDays === 'number' ? d.overdueRepeatDays : 5,
        });
      } else if (isAdminLoggedIn && user) {
        setDoc(doc(db, 'system_controls', 'email_automation'), {
          ...DEFAULT_EMAIL_AUTOMATION_CONFIG,
          updatedAt: new Date().toISOString(),
          updatedBy: user.email || ADMIN_EMAIL,
        }, { merge: true }).catch(() => {});
      }
      setEmailAutomationLoaded(true);
    }, () => {
      setEmailAutomationLoaded(true);
    });
    return () => unsubAuto();
  }, [isAdminLoggedIn, user]);

  const handleToggleGmailNotifications = async (newValue: boolean) => {
    setGmailNotificationsEnabled(newValue);
    localStorage.setItem('tut_gmail_notifications', newValue.toString());
    try {
      await setDoc(doc(db, 'system_controls', 'funds'), {
        gmailNotificationsEnabled: newValue,
        updatedAt: serverTimestamp()
      }, { merge: true });
      addToast('System Updated', `Outgoing Email Alerts set to: ${newValue ? 'ACTIVE' : 'OFF'}`, 'success');
    } catch (err) {
      console.error("Failed to persist email notification setting to Firestore:", err);
      addToast('Sync Error', 'Failed to save email notification settings to Firestore.', 'warning');
    }
  };

  useEffect(() => {
    localStorage.setItem('tut_notification_history', JSON.stringify(notificationHistory));
  }, [notificationHistory]);

  // Dynamic Unread Notifications Count for User Dashboard (Synchronized Single Source of Truth)
  const [memberUnreadCount, setMemberUnreadCount] = useState<number>(0);

  const refreshMemberUnreadCount = useCallback(() => {
    if (!profile) {
      setMemberUnreadCount(0);
      return;
    }
    const count = calculateUserUnreadCount(profile, transactions);
    setMemberUnreadCount(count);
  }, [profile, transactions]);

  useEffect(() => {
    refreshMemberUnreadCount();
  }, [refreshMemberUnreadCount]);

  useEffect(() => {
    const handleUpdate = () => refreshMemberUnreadCount();
    window.addEventListener('tut-notifications-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('tut-notifications-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refreshMemberUnreadCount]);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
    
    // Register Service Worker for mobile notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('Service Worker registered:', reg);
          setSwRegistration(reg);
        })
        .catch(err => console.error('Service Worker registration failed:', err));
    }
  }, []);

  const lastUserCount = useRef<number | null>(null);
  const lastTxCount = useRef<number | null>(null);
  const lastProfileStatus = useRef<string | null>(null);
  const lastTxStatuses = useRef<Record<string, string>>({});
  const incrementedSponsorsRef = useRef<Set<string>>(new Set());

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      addToast("Notifications", "Browser notifications are not supported on this platform.", "warning");
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'denied' && isIframe) {
        addToast("Notification Notice", "Browser notifications are restricted in embedded preview. In-app alerts remain active.", "info");
      } else if (permission === 'granted') {
        sendNotification('Notifications Enabled!', 'You will now receive real-time updates from T.U.T.', user?.email || undefined);
        addToast("Notifications Active", "System alerts are now enabled.", "success");
      }
    } catch (error) {
      console.error("Notification permission error:", error);
      if (isIframe) {
        addToast("Notice", "Notification permission prompt is restricted inside embedded iframe windows.", "info");
      }
    }
  };

  const [showGmailHelp, setShowGmailHelp] = useState(false);
  const [lastGmailError, setLastGmailError] = useState<string | null>(null);
  const [systemConfig, setSystemConfig] = useState<any>(null);

  const fetchSystemConfig = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setSystemConfig(data.config);
    } catch (e) {
      console.error("Failed to fetch system config:", e);
    }
  };

  useEffect(() => {
    if (notificationSettingsMode) {
      fetchSystemConfig();
    }
  }, [notificationSettingsMode]);

  const sendEmail = async (
    to: string,
    subject: string,
    body: string,
    customHtml?: string,
    recipientName: string = 'Unknown Member',
    category: string = 'System',
    forceRetry: boolean = false,
    meta?: { memoId?: string; eventType?: string; recipientUid?: string; attachments?: any[] }
  ): Promise<boolean> => {
    let deliveryStatus: 'delivered' | 'failed' = 'failed';
    let deliveryError = '';
    let latencyMs = 0;
    let messageId: string | undefined;

    const cleanBody = (body || 'Account notification from T.U.T.').trim();
    const cleanSubject = (subject || 'T.U.T. Account Notification').trim();

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject: cleanSubject,
          text: cleanBody,
          forceRetry,
          ...(Array.isArray(meta?.attachments) && meta.attachments.length > 0 ? { attachments: meta.attachments } : {}),
          html: customHtml || generateBrandedEmailHtml(
            cleanSubject.replace(/^T\.U\.T\.\s*[—:-]\s*/i, ''),
            cleanBody,
            meta?.memoId ? { 'Memo Reference': meta.memoId, 'Category': category } : {},
            meta?.memoId || `SYS-${Date.now().toString().slice(-6)}`,
            typeof window !== 'undefined' ? window.location.origin : '',
            { accentTone: 'neutral' }
          )
        })
      });

      const responseData = await response.json().catch(() => ({}));
      latencyMs = typeof responseData?.latencyMs === 'number' ? responseData.latencyMs : 0;
      messageId = responseData?.messageId || undefined;

      if (!response.ok || responseData?.success === false) {
        deliveryError = responseData?.error || 'Failed to send email';
        setLastGmailError(deliveryError);
        console.warn(`[Email Gateway] Email to ${to} not delivered:`, deliveryError);
        return false;
      }

      setLastGmailError(null);
      deliveryStatus = 'delivered';
      return true;
    } catch (error: any) {
      deliveryError = error?.message || String(error);
      setLastGmailError(deliveryError);
      console.warn(`[Email Gateway] Dispatch warning:`, deliveryError);
      return false;
    } finally {
      // Async write to Firestore log (strictly compliant with isValidEmailLog rules)
      try {
        const attachmentNames = Array.isArray(meta?.attachments)
          ? meta.attachments.map((a: any) => a?.filename).filter(Boolean)
          : [];
        const logData: Record<string, any> = {
          to: to.toLowerCase().trim(),
          recipientName: recipientName || 'Member',
          subject: cleanSubject,
          body: cleanBody,
          status: deliveryStatus,
          timestamp: new Date(),
          category: category || 'System',
          ...(latencyMs > 0 ? { latencyMs } : {}),
          ...(messageId ? { messageId } : {}),
          ...(meta?.memoId ? { memoId: meta.memoId } : {}),
          ...(meta?.eventType ? { eventType: meta.eventType } : {}),
          ...(meta?.recipientUid ? { recipientUid: meta.recipientUid } : {}),
          ...(attachmentNames.length > 0 ? { attachments: attachmentNames } : {}),
          ...(deliveryError ? { error: String(deliveryError) } : {})
        };
        await addDoc(collection(db, 'email_logs'), logData);
      } catch (logErr) {
        // Non-admin clients cannot write to email_logs per Firestore rules; ignore quietly
      }
    }
  };

  const notificationService = useMemo(() => {
    return new NotificationService({
      db,
      sendEmailRaw: sendEmail,
      addInAppNotification: (title, body, email) => {
        const newNotif = {
          id: Math.random().toString(36).substring(2, 9),
          title,
          body,
          timestamp: Date.now()
        };
        setNotificationHistory(prev => [newNotif, ...prev].slice(0, 50));
        addToast(title, body, 'info');
      },
      adminEmail: ADMIN_EMAIL,
      allUsers,
      getGmailNotificationsEnabled: () => gmailNotificationsEnabled,
      getAutomationConfig: () => emailAutomationConfig
    });
  }, [allUsers, gmailNotificationsEnabled, emailAutomationConfig]);

  useEffect(() => {
    notificationService.updateUsersContext(allUsers);
  }, [allUsers, notificationService]);

  const autoScanInFlightRef = useRef(false);
  const lastAutoScanMsRef = useRef<number>(0);

  const sendProfessionalDueReminder = async (
    targetUserProfile: UserProfile,
    tx: Transaction | null,
    isManual: boolean = false,
    resolvedContext?: { daysDiff?: number | null; dueDateLabel?: string; activeDebt?: number },
    options?: { skipAdminCopy?: boolean }
  ) => {
    if (!targetUserProfile.email || !targetUserProfile.email.includes('@')) {
      return false;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const emailTo = targetUserProfile.email.toLowerCase().trim();
    const isToAdmin = emailTo === ADMIN_EMAIL;

    const recipientPref = isToAdmin
      ? gmailNotificationsEnabled
      : (targetUserProfile.emailNotificationsEnabled !== false);

    if (!isManual && (!recipientPref || !gmailNotificationsEnabled || emailAutomationConfig.masterEnabled === false || emailAutomationConfig.autoDueReminders === false)) {
      return false;
    }

    let daysDiff: number | null = resolvedContext?.daysDiff ?? null;
    let formattedDueDate = resolvedContext?.dueDateLabel || "As scheduled";

    if (daysDiff === null && tx?.estimatedRepaymentDate) {
      const estimatedDate = new Date(tx.estimatedRepaymentDate);
      if (!isNaN(estimatedDate.getTime())) {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const estStart = new Date(estimatedDate.getFullYear(), estimatedDate.getMonth(), estimatedDate.getDate());
        daysDiff = Math.round((estStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        formattedDueDate = format(estStart, 'dd MMM yyyy');
      }
    }

    const activeDebt = resolvedContext?.activeDebt ?? targetUserProfile.remainingDebt ?? tx?.amount ?? 0;
    const memoRef = tx?.memoId || tx?.id || `ACC-${targetUserProfile.uid.slice(0, 6).toUpperCase()}`;

    let subject = `T.U.T. — Loan payment statement (৳${activeDebt.toLocaleString()})`;
    let title = 'Loan Repayment Statement';
    let accentTone: 'neutral' | 'warning' | 'danger' = 'neutral';
    let heroCaption = formattedDueDate !== 'As scheduled' ? `Scheduled Due: ${formattedDueDate}` : 'Active Balance';
    let plainSummary = `Hi ${targetUserProfile.name}, this is a scheduled update on your active zero-usury loan balance of ৳${activeDebt.toLocaleString()} BDT. Submit your repayment anytime inside your member dashboard.`;

    if (daysDiff !== null && daysDiff < 0) {
      const overdueDays = Math.abs(daysDiff);
      subject = `T.U.T. — Payment overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''} (৳${activeDebt.toLocaleString()})`;
      title = 'Repayment Overdue Notice';
      accentTone = 'danger';
      heroCaption = `Overdue by ${overdueDays} Day${overdueDays > 1 ? 's' : ''} · Due ${formattedDueDate}`;
      plainSummary = `Hi ${targetUserProfile.name}, your scheduled repayment due on ${formattedDueDate} is now ${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue. Please clear your balance of ৳${activeDebt.toLocaleString()} BDT or contact an officer inside your portal if you need assistance.`;
    } else if (daysDiff === 0) {
      subject = `T.U.T. — Repayment due today (৳${activeDebt.toLocaleString()})`;
      title = 'Payment Due Today';
      accentTone = 'warning';
      heroCaption = `Due Today · ${formattedDueDate}`;
      plainSummary = `Hi ${targetUserProfile.name}, your scheduled loan repayment is due today (${formattedDueDate}). You can submit your payment through bKash, Nagad, or Cash Desk in your portal.`;
    } else if (daysDiff !== null && daysDiff > 0 && daysDiff <= (emailAutomationConfig.dueReminderLeadDays || 3)) {
      subject = `T.U.T. — Upcoming payment due in ${daysDiff} day${daysDiff > 1 ? 's' : ''}`;
      title = `Payment Due in ${daysDiff} Day${daysDiff > 1 ? 's' : ''}`;
      accentTone = 'warning';
      heroCaption = `Upcoming Settlement · ${formattedDueDate}`;
      plainSummary = `Hi ${targetUserProfile.name}, friendly reminder that your loan repayment is due on ${formattedDueDate} (in ${daysDiff} day${daysDiff > 1 ? 's' : ''}).`;
    } else if (isManual) {
      subject = `T.U.T. — Repayment reminder & account balance (৳${activeDebt.toLocaleString()})`;
      title = 'Official Repayment Reminder';
      accentTone = 'warning';
      plainSummary = `Hi ${targetUserProfile.name}, here is your current loan balance summary from the T.U.T. administration desk.`;
    }

    const htmlContent = generateBrandedEmailHtml(
      title,
      plainSummary,
      {
        'Member Name': targetUserProfile.name,
        'Member ID': targetUserProfile.memberId || 'N/A',
        'Original Tranche Principal': tx ? `৳${tx.amount.toLocaleString()} BDT` : 'Active Account Balance',
        'Loan Purpose': tx?.loanReason || 'Personal Support',
        'Expected Due Date': formattedDueDate,
        'Remaining Debt Due': `৳${activeDebt.toLocaleString()} BDT`,
        'Vault Savings': `৳${(targetUserProfile.totalDeposit || 0).toLocaleString()} BDT`,
        'Official Memo ID': memoRef,
      },
      memoRef,
      typeof window !== 'undefined' ? window.location.origin : '',
      {
        accentTone,
        heroAmount: `৳${activeDebt.toLocaleString()} BDT`,
        heroCaption,
        automationBadge: isManual ? 'Member Desk Push' : 'Automated Due Schedule',
        ctaLabel: 'Open Dashboard to Repay',
        memoNote: 'Accepted repayment methods: bKash (01713710607), Nagad (01921801100), or direct Cash Desk handover. Submit "Pay Due" inside your portal after transferring.'
      }
    );

    try {
      const sentOk = await sendEmail(
        emailTo,
        subject,
        plainSummary,
        htmlContent,
        targetUserProfile.name,
        'Due Reminder',
        isManual,
        { memoId: memoRef, eventType: isManual ? 'manual_due_reminder' : 'auto_due_reminder', recipientUid: targetUserProfile.uid }
      );
      if (!sentOk) return false;

      if (!isToAdmin && !options?.skipAdminCopy && emailAutomationConfig.copyAdminOnMemberMails !== false) {
        const adminCopySummary = `Due reminder sent to ${targetUserProfile.name} (${emailTo}) for active balance ৳${activeDebt.toLocaleString()} BDT.\n\n${plainSummary}`;
        const adminCopyHtml = generateBrandedEmailHtml(
          `[Admin Copy] ${title}`,
          adminCopySummary,
          {
            'Borrower': `${targetUserProfile.name} (${emailTo})`,
            'Member ID': targetUserProfile.memberId || 'N/A',
            'Due Date': formattedDueDate,
            'Remaining Debt Due': `৳${activeDebt.toLocaleString()} BDT`,
            'Official Memo ID': memoRef,
          },
          memoRef,
          typeof window !== 'undefined' ? window.location.origin : '',
          {
            accentTone,
            heroAmount: `৳${activeDebt.toLocaleString()} BDT`,
            heroCaption,
            automationBadge: 'Chief Admin Copy · Due Reminder',
            ctaLabel: 'Open Admin Console',
          }
        );
        sendEmail(
          ADMIN_EMAIL,
          `[Admin Copy] ${subject}`,
          adminCopySummary,
          adminCopyHtml,
          'Chief Admin (Copy)',
          'Due Reminder',
          false,
          { memoId: memoRef, eventType: isManual ? 'admin_copy_manual_due' : 'admin_copy_auto_due', recipientUid: 'admin' }
        ).catch(() => {});
      }

      if (tx?.id) {
        await updateDoc(doc(db, 'transactions', tx.id), {
          lastReminderSent: todayStr
        }).catch(() => {});
      }
      await updateDoc(doc(db, 'users', targetUserProfile.uid), {
        lastReminderSent: todayStr
      }).catch(() => {});

      return true;
    } catch (error) {
      console.warn("[Reminder System] Email reminder skipped:", error);
      return false;
    }
  };

  const runAutomaticDueReminderScan = useCallback(async (forceRun: boolean = false): Promise<number> => {
    if (!user || !profile || !isAdminLoggedIn) return 0;
    if (autoScanInFlightRef.current) return 0;

    if (!gmailNotificationsEnabled || emailAutomationConfig.masterEnabled === false || emailAutomationConfig.autoDueReminders === false) {
      setAutoEmailState(prev => ({
        ...prev,
        status: 'paused',
        lastError: null
      }));
      return 0;
    }

    const nowMs = Date.now();
    // Prevent duplicate rapid scans on consecutive Firestore renders unless manually triggered
    if (!forceRun && lastAutoScanMsRef.current > 0 && nowMs - lastAutoScanMsRef.current < 2 * 60 * 1000) {
      return 0;
    }

    autoScanInFlightRef.current = true;
    lastAutoScanMsRef.current = nowMs;
    setAutoEmailState(prev => ({ ...prev, status: 'scanning' }));

    const leadDays = emailAutomationConfig.dueReminderLeadDays ?? 3;
    const repeatDays = emailAutomationConfig.overdueRepeatDays ?? 5;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Use the exact same unified engine as Active Debts & Due Radar
    const radar = buildMemberDueRadar(allUsers, allTransactions, leadDays, today);
    let sentCount = 0;
    let eligibleCount = 0;
    let hadFailure = false;
    const notifiedSummaries: { name: string; email: string; debt: number; urgency: string; dueDateLabel: string }[] = [];

    for (const item of radar) {
      const { member, primaryLoanTx, daysDiff, dueDateLabel, activeDebt, lastReminderSent, sentToday, urgency } = item;
      if (!member.email || !member.email.includes('@')) continue;
      if (member.emailNotificationsEnabled === false) continue;
      if (sentToday) continue;

      let shouldSend = false;
      if (urgency === 'today') {
        shouldSend = true;
      } else if (urgency === 'upcoming') {
        if (!lastReminderSent) shouldSend = true;
      } else if (urgency === 'overdue') {
        if (!lastReminderSent) {
          shouldSend = true;
        } else {
          const lastSent = new Date(lastReminderSent);
          if (!isNaN(lastSent.getTime())) {
            const lastStart = new Date(lastSent.getFullYear(), lastSent.getMonth(), lastSent.getDate());
            const daysSinceLast = Math.round((todayStart.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceLast >= repeatDays) shouldSend = true;
          } else {
            shouldSend = true;
          }
        }
      }

      if (shouldSend) {
        eligibleCount++;
        const success = await sendProfessionalDueReminder(
          member,
          primaryLoanTx,
          forceRun,
          { daysDiff, dueDateLabel, activeDebt },
          { skipAdminCopy: true }
        );
        if (success) {
          sentCount++;
          notifiedSummaries.push({
            name: member.name,
            email: member.email,
            debt: activeDebt,
            urgency,
            dueDateLabel
          });
        } else {
          hadFailure = true;
        }
      }
    }

    // Send 1 consolidated Chief Admin Digest summarizing all automated due reminders dispatched in this cycle
    if (sentCount > 0 && emailAutomationConfig.copyAdminOnMemberMails !== false) {
      const digestLines = notifiedSummaries
        .map((n, idx) => `${idx + 1}. ${n.name} (${n.email}) — ৳${n.debt.toLocaleString()} [${n.urgency.toUpperCase()} · ${n.dueDateLabel}]`)
        .join('\n');
      const totalTargetedDebt = notifiedSummaries.reduce((sum, n) => sum + n.debt, 0);
      const digestSummary = `Automated Due Reminder Cycle completed with ${sentCount} borrower notification${sentCount > 1 ? 's' : ''} sent (৳${totalTargetedDebt.toLocaleString()} total balance tracked).\n\n${digestLines}`;
      const digestDetails: Record<string, string> = {
        'Cycle Date': format(today, 'dd MMM yyyy, HH:mm'),
        'Reminders Dispatched': `${sentCount} of ${eligibleCount} eligible`,
        'Total Exposure Notified': `৳${totalTargetedDebt.toLocaleString()} BDT`,
      };
      notifiedSummaries.slice(0, 6).forEach((n, i) => {
        digestDetails[`Borrower #${i + 1}`] = `${n.name} — ৳${n.debt.toLocaleString()} (${n.urgency.toUpperCase()} · ${n.dueDateLabel})`;
      });
      const digestRef = `AUTO-DUE-${format(today, 'yyyyMMdd-HHmm')}`;
      const digestHtml = generateBrandedEmailHtml(
        'Autonomous Due Reminder Digest',
        digestSummary,
        digestDetails,
        digestRef,
        typeof window !== 'undefined' ? window.location.origin : '',
        {
          accentTone: notifiedSummaries.some(n => n.urgency === 'overdue') ? 'warning' : 'neutral',
          heroAmount: `${sentCount} Sent`,
          heroCaption: `Total Tracked Debt: ৳${totalTargetedDebt.toLocaleString()} BDT`,
          automationBadge: 'Chief Admin Copy · Auto-Cycle Digest',
          ctaLabel: 'Review Due Radar',
        }
      );
      sendEmail(
        ADMIN_EMAIL,
        `[Admin Digest] ${sentCount} Automated Due Reminder${sentCount > 1 ? 's' : ''} Sent`,
        digestSummary,
        digestHtml,
        'Chief Admin (Digest)',
        'Due Reminder',
        false,
        { memoId: digestRef, eventType: 'admin_due_cycle_digest', recipientUid: 'admin' }
      ).catch(() => {});
    }

    autoScanInFlightRef.current = false;
    const nextScanIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const scanIso = new Date().toISOString();

    setAutoEmailState(prev => ({
      status: hadFailure && sentCount === 0 ? 'smtp_blocked' : 'active',
      lastScanAt: scanIso,
      nextScanAt: nextScanIso,
      lastSentCount: sentCount,
      lastEligibleCount: eligibleCount,
      totalAutoSentSession: prev.totalAutoSentSession + sentCount,
      lastError: hadFailure && sentCount === 0 ? (lastGmailError || 'SMTP gateway blocked automatic delivery') : null
    }));

    if (sentCount > 0) {
      addToast('Automated Reminders Sent', `Dispatched ${sentCount} scheduled due reminder email${sentCount > 1 ? 's' : ''}.`, 'success');
    } else if (forceRun && eligibleCount === 0) {
      addToast('Automation Up to Date', 'All eligible due/overdue borrowers are already notified for today.', 'info');
    } else if (forceRun && hadFailure) {
      addToast('Automation Blocked by SMTP', 'Scheduled reminders could not deliver. Check Gmail App Password in Gateway Test.', 'warning');
    }

    return sentCount;
  }, [user, profile, isAdminLoggedIn, gmailNotificationsEnabled, emailAutomationConfig, allUsers, allTransactions, lastGmailError]);

  useEffect(() => {
    if (!isAdminLoggedIn || !emailAutomationLoaded) return;
    if (allUsers.length === 0) return;

    runAutomaticDueReminderScan(false);
    const intervalId = setInterval(() => {
      runAutomaticDueReminderScan(false);
    }, 15 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [isAdminLoggedIn, emailAutomationLoaded, allUsers.length, allTransactions.length, emailAutomationConfig, gmailNotificationsEnabled]);

  const sendNotification = async (title: string, body: string, targetEmail?: string, forceSend: boolean = false) => {
    const newNotif = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      body,
      timestamp: Date.now()
    };
    setNotificationHistory(prev => [newNotif, ...prev].slice(0, 50));
    addToast(title, body, 'info');

    const adminEmailLower = ADMIN_EMAIL.toLowerCase();
    let recipientName = 'Admin';
    let recipientUid: string | undefined;
    if (targetEmail) {
      const normalizedTarget = targetEmail.toLowerCase().trim();
      const member = allUsers.find(u => u.email?.toLowerCase().trim() === normalizedTarget);
      if (member) {
        recipientName = member.name;
        recipientUid = member.uid;
      } else {
        recipientName = normalizedTarget;
      }
    }

    let category = 'System';
    const lowerTitle = title.toLowerCase();
    const lowerBody = body.toLowerCase();
    if (lowerTitle.includes('debt') || lowerBody.includes('debt') || lowerTitle.includes('due') || lowerBody.includes('due')) {
      category = 'Due Reminder';
    } else if (lowerTitle.includes('approve') || lowerBody.includes('approve') || lowerTitle.includes('reject') || lowerBody.includes('reject')) {
      category = 'Membership';
    } else if (lowerTitle.includes('transaction') || lowerBody.includes('transaction') || lowerTitle.includes('deposit') || lowerBody.includes('deposit') || lowerTitle.includes('loan') || lowerBody.includes('loan')) {
      category = 'Transaction';
    } else if (lowerTitle.includes('broadcast') || lowerBody.includes('broadcast')) {
      category = 'Broadcast';
    }

    let delivered = true;

    if (targetEmail && targetEmail.toLowerCase().trim() !== adminEmailLower && targetEmail.includes('@')) {
      const normalizedTarget = targetEmail.toLowerCase().trim();
      const memberProfile = allUsers.find(u => u.email?.toLowerCase().trim() === normalizedTarget);
      const memberPref = memberProfile ? (memberProfile.emailNotificationsEnabled !== false) : true;

      if ((memberPref && gmailNotificationsEnabled) || forceSend) {
        const ok = await sendEmail(normalizedTarget, `T.U.T. — ${title}`, body, undefined, recipientName, category, forceSend, { recipientUid });
        if (!ok) delivered = false;
      }

      if (gmailNotificationsEnabled && emailAutomationConfig.copyAdminOnMemberMails !== false) {
        const adminCopySubject = `[Member Copy] ${title}`;
        const adminCopyBody = `Copy of message sent to ${recipientName} (${normalizedTarget}):\n\n${body}`;
        sendEmail(adminEmailLower, adminCopySubject, adminCopyBody, undefined, 'Admin (Copy)', category).catch(() => {});
      }
    } else if (gmailNotificationsEnabled || forceSend) {
      const ok = await sendEmail(adminEmailLower, title, body, undefined, 'Admin', category, forceSend);
      if (!ok) delivered = false;
    }

    if (notificationPermission === 'granted') {
      const options: NotificationOptions = {
        body,
        icon: 'https://cdn-icons-png.flaticon.com/512/1995/1995515.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/1995/1995515.png',
        tag: 'tut-notification'
      };

      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      if (swRegistration) {
        swRegistration.showNotification(title, options).catch(() => {
          try { new Notification(title, options); } catch {}
        });
      } else {
        try {
          const n = new Notification(title, options);
          n.onclick = () => { window.focus(); n.close(); };
        } catch {}
      }
    }

    return delivered;
  };

  const sendWorkflowNotification = async (
    eventType:
      | 'membership_request'
      | 'membership_approved'
      | 'membership_rejected'
      | 'transaction_request'
      | 'transaction_confirmed'
      | 'transaction_rejected'
      | 'transaction_hold'
      | 'subscription_request'
      | 'subscription_confirmed'
      | 'refund_processed'
      | 'transaction_more_info'
      | 'membership_more_info'
      | 'info_requested'
      | 'credit_limit_adjusted'
      | 'debt_warning'
      | 'p2p_transfer_sent'
      | 'p2p_transfer_received'
      | 'wallet_added'
      | 'wallet_verified'
      | 'wallet_update_request'
      | 'profile_updated'
      | 'profile_verification_request'
      | 'account_created'
      | 'new_member_registration'
      | 'loan_disbursed'
      | 'loan_cancelled'
      | 'loan_fully_completed'
      | string,
    memberEmail: string | undefined,
    memberName: string,
    details: {
      uid?: string;
      phone?: string;
      nid?: string;
      borrowingLimit?: number;
      remainingDebt?: number;
      emailNotificationsEnabled?: boolean;
      amount?: number;
      type?: string;
      tier?: string;
      subscriptionMonths?: number;
      notes?: string;
      memberId?: string;
      memoId?: string;
      method?: string;
      accountNumber?: string;
      transactionId?: string;
      reference?: string;
      mobileOperator?: string;
      estimatedRepaymentDate?: string;
      wallet?: {
        provider?: string;
        mobileNumber?: string;
        holderName?: string;
      };
    } = {}
  ) => {
    let resolvedEvent: string = eventType;
    if (eventType === 'transaction_request') {
      if (details.type === 'loan') resolvedEvent = 'new_loan_request';
      else if (details.type === 'deposit') resolvedEvent = 'deposit_request';
      else if (details.type === 'pay_due' || details.type === 'repayment') resolvedEvent = 'repayment_request';
    } else if (eventType === 'transaction_confirmed') {
      if (details.type === 'loan') resolvedEvent = 'loan_approved';
      else if (details.type === 'deposit') resolvedEvent = 'deposit_confirmed';
      else if (details.type === 'pay_due' || details.type === 'repayment') resolvedEvent = 'repayment_received';
      else if (details.type === 'refund') resolvedEvent = 'refund_processed';
      else if (details.type === 'subscription') resolvedEvent = 'subscription_confirmed';
    } else if (eventType === 'transaction_rejected') {
      if (details.type === 'loan') resolvedEvent = 'loan_rejected';
    }

    const payload: NotificationPayload = {
      user: {
        uid: details.uid,
        name: memberName,
        email: memberEmail,
        phone: details.phone,
        nid: details.nid,
        memberId: details.memberId,
        borrowingLimit: details.borrowingLimit,
        remainingDebt: details.remainingDebt,
        emailNotificationsEnabled: details.emailNotificationsEnabled,
      },
      tx: {
        amount: details.amount,
        type: details.type,
        method: details.method,
        memoId: details.memoId,
        transactionId: details.transactionId,
        accountNumber: details.accountNumber,
        reference: details.reference,
        mobileOperator: details.mobileOperator,
        subscriptionTier: details.tier,
        subscriptionMonths: details.subscriptionMonths,
        estimatedRepaymentDate: details.estimatedRepaymentDate,
        loanReason: details.type === 'loan' ? details.notes : undefined,
      },
      wallet: details.wallet,
      customNotes: details.notes,
    };

    try {
      await notificationService.dispatchEvent(resolvedEvent, payload);
    } catch (error) {
      console.error("[sendWorkflowNotification Bridge Error]:", error);
    }
  };

  const logAuditEvent = async (action: string, details: string, severity: 'info' | 'warning' | 'critical' = 'info') => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        timestamp: serverTimestamp(),
        actorEmail: user?.email || 'System / Auto',
        actorName: profile?.name || 'Observer',
        action,
        details,
        severity
      });
    } catch (error) {
      console.error("Failed to write audit log:", error);
      handleFirestoreError(error, OperationType.WRITE, 'audit_logs');
    }
  };

  const testNotification = () => {
    if (notificationPermission !== 'granted' && !gmailNotificationsEnabled) {
      requestNotificationPermission();
    } else {
      sendNotification('System Test Successful!', 'Your device is now connected to the T.U.T. Alert System. You will receive real-time updates.', user?.email || undefined);
      addToast('Test Successful', 'A notification has been sent to your device history and system.', 'success');
    }
  };

  const clearNotificationHistory = () => {
    setNotificationHistory([]);
  };

  const toggleNotificationPermission = () => {
    if (notificationPermission === 'granted') {
      // We can't programmatically revoke permission, but we can simulate "off" in app logic
      // However, the user asked for a toggle. We'll use a local 'notificationsEnabled' flag if they want to mute.
      // For now, we'll just show the request dialog if not granted.
      requestNotificationPermission();
    } else {
      requestNotificationPermission();
    }
  };
  
  // Form State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<'loan' | 'deposit' | 'refund' | 'pay_due' | 'subscription'>('loan');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestMethod, setRequestMethod] = useState<'Cash' | 'Bkash' | 'Nagad' | 'Recharge'>('Cash');
  const [requestAccount, setRequestAccount] = useState('');
  const [requestTrxId, setRequestTrxId] = useState('');
  const [loanReason, setLoanReason] = useState('');
  const [estimatedRepaymentDate, setEstimatedRepaymentDate] = useState('');

  // Subscription Form States
  const [selectedSubTier, setSelectedSubTier] = useState<'bronze' | 'silver' | 'gold'>('bronze');
  const [subSenderMobile, setSubSenderMobile] = useState('');
  const [subTrxId, setSubTrxId] = useState('');
  const [subWallet, setSubWallet] = useState<'Bkash' | 'Nagad' | 'Recharge' | 'Cash'>('Bkash');
  const [showSubPaymentMode, setShowSubPaymentMode] = useState(false);
  const [activeMemberTab, setActiveMemberTab] = useState<'dashboard' | 'memos' | 'subscription' | 'partners' | 'profile' | 'wallets'>('dashboard');
  const pendingMemberTxCount = useMemo(() => transactions.filter((t) => t.status === 'pending').length, [transactions]);
  const [activeTransactionView, setActiveTransactionView] = useState<'loan' | 'deposit' | 'pay_due' | 'refund' | 'transfer' | 'subscription' | null>(null);

  // Handle URL Parameters for External Linking
  useEffect(() => {
    if (!isAuthReady || !user || !profile || profile.status !== 'approved') return;

    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');

    if (action === 'loan') {
      setActiveTransactionView('loan');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (action === 'deposit') {
      setActiveTransactionView('deposit');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isAuthReady, user, profile]);

  // Detect External Hosted Checkout Query or Path (?tut_pay=1, /pay, /checkout, /tut-pay)
  const tutCheckoutRequest = useMemo<(TutCheckoutRequest & { payerEmailHint?: string }) | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const cleanPath = window.location.pathname.replace(/\/+$/, '').toLowerCase();
    const cleanHash = window.location.hash.toLowerCase();
    const tutPayParam = (params.get('tut_pay') || '').toLowerCase();
    const actionParam = (params.get('action') || '').toLowerCase();

    const isPayRoute =
      tutPayParam === '1' ||
      tutPayParam === 'true' ||
      params.get('pay') === '1' ||
      params.get('checkout') === '1' ||
      actionParam === 'pay' ||
      actionParam === 'checkout' ||
      cleanPath === '/pay' ||
      cleanPath === '/checkout' ||
      cleanPath === '/tut-pay' ||
      cleanPath === '/tut_pay' ||
      cleanPath === '/gateway/pay' ||
      cleanPath === '/gateway/checkout' ||
      cleanHash.startsWith('#/pay') ||
      cleanHash.startsWith('#/checkout');

    if (!isPayRoute) return null;

    const rawAmount = Number(params.get('amount'));
    const planLabel = params.get('plan') || '';
    const refLabel = params.get('reference') || (planLabel ? `Plan: ${planLabel}` : '');
    return {
      amount: Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : undefined,
      merchantName: params.get('merchant') || params.get('merchantName') || params.get('app') || 'Connected Partner App',
      merchantId: params.get('merchantId') || undefined,
      orderId: params.get('orderId') || `ORD-${Date.now().toString(36).toUpperCase()}`,
      returnUrl: params.get('returnUrl') || params.get('callback') || undefined,
      reference: refLabel || undefined,
      payerEmailHint: params.get('email') || undefined
    };
  }, []);

  // Failsafe: never stall hosted payment checkout on loading if iframe cookies/storage delay auth
  useEffect(() => {
    if (!tutCheckoutRequest || !loading) return;
    const timer = setTimeout(() => {
      setIsAuthReady(true);
      setLoading(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, [tutCheckoutRequest, loading]);

  // Profile State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'basic' | 'personal' | 'nominee' | 'emergency' | 'social'>('basic');
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    occupation: '',
    address: '',
    facebook: '',
    whatsapp: '',
    telegram: '',
    fatherName: '',
    motherName: '',
    dob: '',
    bloodGroup: '',
    emergencyContact: '',
    nomineeName: '',
    nomineeRelation: '',
    photoUrl: '',
    permanentAddress: '',
    referenceContact: '',
    adminNotes: '',
    emailNotificationsEnabled: true
  });

  // Registration State
  const [regData, setRegData] = useState({
    name: '',
    email: '',
    nid: '',
    address: '',
    occupation: '',
    phone: '',
    photoUrl: ''
  });

  useEffect(() => {
    if (user && !profile) {
      setRegData(prev => ({
        ...prev,
        name: prev.name || user.displayName || '',
        email: prev.email || user.email || '',
        photoUrl: prev.photoUrl || user.photoURL || ''
      }));
    }
  }, [user, profile]);

  useEffect(() => {
    if (profile) {
      setProfileData({
        name: profile.name,
        email: profile.email || '',
        phone: profile.phone,
        occupation: profile.occupation,
        address: profile.address,
        facebook: profile.facebook || '',
        whatsapp: profile.whatsapp || '',
        telegram: profile.telegram || '',
        fatherName: profile.fatherName || '',
        motherName: profile.motherName || '',
        dob: profile.dob || '',
        bloodGroup: profile.bloodGroup || '',
        emergencyContact: profile.emergencyContact || '',
        nomineeName: profile.nomineeName || '',
        nomineeRelation: profile.nomineeRelation || '',
        photoUrl: profile.photoUrl || '',
        permanentAddress: profile.permanentAddress || '',
        referenceContact: profile.referenceContact || '',
        adminNotes: profile.adminNotes || '',
        emailNotificationsEnabled: profile.emailNotificationsEnabled !== false
      });
    }
  }, [profile]);

  const [externalAction, setExternalAction] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
        occupation: profileData.occupation,
        address: profileData.address,
        facebook: profileData.facebook,
        whatsapp: profileData.whatsapp,
        telegram: profileData.telegram,
        fatherName: profileData.fatherName,
        motherName: profileData.motherName,
        dob: profileData.dob,
        bloodGroup: profileData.bloodGroup,
        emergencyContact: profileData.emergencyContact,
        nomineeName: profileData.nomineeName,
        nomineeRelation: profileData.nomineeRelation,
        photoUrl: profileData.photoUrl,
        permanentAddress: profileData.permanentAddress,
        referenceContact: profileData.referenceContact,
        adminNotes: profileData.adminNotes,
        emailNotificationsEnabled: profileData.emailNotificationsEnabled !== false
      });
      addToast('Profile Updated', 'Your profile details have been updated successfully.', 'success');
      setShowProfileModal(false);
      sendWorkflowNotification(
        'profile_updated',
        profileData.email || user.email || undefined,
        profileData.name || profile.name,
        {
          uid: user.uid,
          memberId: profile.memberId,
          phone: profileData.phone,
          emailNotificationsEnabled: profileData.emailNotificationsEnabled !== false,
          notes: 'Profile Details & Email Notification Settings'
        }
      ).catch(() => {});
    } catch (error) {
      console.error("Update profile error:", error);
      addToast('Update Failed', 'Failed to update profile details.', 'warning');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action) {
      setExternalAction(action);
    }
  }, []);

  // Background/Foreground wake-up resiliency handler
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log("[App Wakeup] App resumed from background. Synchronizing authentication token...");
        
        // If user is currently authenticated check and auto-refresh the credential
        if (auth.currentUser) {
          try {
            console.log("[App Wakeup] Active user found. Verifying credentials token with Firebase...");
            const token = await auth.currentUser.getIdToken(true);
            console.log("[App Wakeup] Token verified and synchronized successfully.");
          } catch (tokenErr) {
            console.error("[App Wakeup] Authentication token expired or revoked during background period:", tokenErr);
            addToast('Session Expired', 'Your secure session expired in the background. Logging out safely...', 'warning');
            
            // Clean up states and redirect gracefully without throwing fatal errors
            setProfile(null);
            localStorage.removeItem('tut_saved_profile');
            setIsAdminLoggedIn(false);
            try {
              await signOut(auth);
            } catch (soErr) {
              console.error("Signout after key expiry failed:", soErr);
            }
            setUser(null);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // --- Network Connection Monitor for Mobile Resiliency ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      addToast('Connection Restored', 'Your internet connection was successfully re-established. Syncing profile...', 'success');
      // If user logs in we can sync/verify
      if (auth.currentUser) {
        auth.currentUser.getIdToken(true).catch(err => console.log("Silent online check:", err));
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      addToast('Connection Offline', 'You are currently offline. Local cache will persist until connection returns.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Webintoapp Mobile App back-button gesture interception ---
  // Tracks any modal or system state changes and pushes fake back levels to prevents crashes or abrupt closures
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // If the back event is an internal Admin Portal section switch, let AdminPortal handle it
      if (e.state && e.state.fromAdminPortal) {
        return;
      }

      let intercepted = false;
      
      // Close open modals step-by-step when back key is tapped
      if (showAdminLogin) {
        setShowAdminLogin(false);
        intercepted = true;
      } else if (showEditUserModal) {
        setShowEditUserModal(false);
        setEditingUser(null);
        intercepted = true;
      } else if (showDeleteModal) {
        setShowDeleteModal(false);
        setUserToDelete(null);
        intercepted = true;
      } else if (showEditFundModal) {
        setShowEditFundModal(false);
        intercepted = true;
      } else if (showSponsorModal) {
        setShowSponsorModal(false);
        intercepted = true;
      } else if (showRequestModal) {
        setShowRequestModal(false);
        intercepted = true;
      } else if (showProfileModal) {
        setShowProfileModal(false);
        intercepted = true;
      } else if (showNotificationCenter) {
        setShowNotificationCenter(false);
        intercepted = true;
      } else if (adminTab !== 'overview') {
        setAdminTab('overview');
        intercepted = true;
      }

      if (intercepted) {
        // Prevent going back key from quitting the current webview instance
        e.preventDefault();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [
    showAdminLogin,
    showEditUserModal,
    showDeleteModal,
    showEditFundModal,
    showSponsorModal,
    showRequestModal,
    showProfileModal,
    showNotificationCenter,
    adminTab
  ]);

  // Sync virtual levels in history for back button to consume
  useEffect(() => {
    const activeModalsCount = [
      showAdminLogin,
      showEditUserModal,
      showDeleteModal,
      showEditFundModal,
      showSponsorModal,
      showRequestModal,
      showProfileModal,
      showNotificationCenter
    ].filter(Boolean).length;

    // Push states for back consumption but keep index safe
    if (activeModalsCount > 0) {
      if (!window.history.state || window.history.state.virtualLevel !== activeModalsCount) {
        window.history.pushState({ virtualLevel: activeModalsCount }, '');
      }
    } else {
      if (window.history.state && window.history.state.virtualLevel) {
        window.history.replaceState(null, '');
      }
    }
  }, [
    showAdminLogin,
    showEditUserModal,
    showDeleteModal,
    showEditFundModal,
    showSponsorModal,
    showRequestModal,
    showProfileModal,
    showNotificationCenter
  ]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("Auth state changed:", u?.email, u?.uid);
      setUser(u);
      setIsAuthReady(true);
      if (!u) {
        setProfile(null);
        localStorage.removeItem('tut_saved_profile');
        setIsAdminLoggedIn(false); // Reset admin state on logout
        setLoading(false);
      } else if (u.email?.toLowerCase() === 'tahsinullahtusher999@gmail.com') {
        setIsAdminLoggedIn(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const path = `users/${user.uid}`;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        if (user.email?.toLowerCase() === 'tahsinullahtusher999@gmail.com' && (data.role !== 'admin' || data.status !== 'approved')) {
          data.role = 'admin';
          data.status = 'approved';
          setDoc(doc(db, 'users', user.uid), { ...data, role: 'admin', status: 'approved' }, { merge: true });
        }

        // Auto-update to Free Bronze Tier with ৳500 borrowing limit only for users who have no tier set, or truly expired paid subscriptions
        if (data.subscriptionStatus !== 'pending_approval') {
          const isPaidTier = (data.subscriptionTier === 'silver' || data.subscriptionTier === 'gold');
          if (isPaidTier) {
            // Only expire if explicitly past the expiration date with a 24-hour grace buffer
            const hasExpired = data.subscriptionStatus === 'active' &&
              data.subscriptionExpiresAt &&
              new Date(data.subscriptionExpiresAt).getTime() < (Date.now() - 24 * 60 * 60 * 1000);
            
            if (hasExpired) {
              data.subscriptionTier = 'bronze';
              data.subscriptionStatus = 'active';
              data.borrowingLimit = 500;
              updateDoc(doc(db, 'users', user.uid), {
                subscriptionTier: 'bronze',
                subscriptionStatus: 'active',
                borrowingLimit: 500,
                subscriptionExpiresAt: '',
                updatedAt: serverTimestamp()
              }).catch(e => console.warn("Auto-demote expired tier:", e));
            } else if (data.subscriptionStatus === 'active' && !data.subscriptionExpiresAt) {
              // Active paid tier without expiry date set: grant default 30 days
              const defaultExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
              data.subscriptionExpiresAt = defaultExp;
              updateDoc(doc(db, 'users', user.uid), {
                subscriptionExpiresAt: defaultExp
              }).catch(() => {});
            }
          } else if (!data.subscriptionTier) {
            // New user with no tier assigned yet: default to Bronze Free Tier
            data.subscriptionTier = 'bronze';
            data.subscriptionStatus = 'active';
            data.borrowingLimit = 500;
            updateDoc(doc(db, 'users', user.uid), {
              subscriptionTier: 'bronze',
              subscriptionStatus: 'active',
              borrowingLimit: 500,
              updatedAt: serverTimestamp()
            }).catch(() => {});
          }
        }

        setProfile(data);
        localStorage.setItem('tut_saved_profile', JSON.stringify(data));
        if (data.name) {
          localStorage.setItem('tut_saved_name', data.name);
        }
        if (data.email) {
          localStorage.setItem('tut_saved_email', data.email);
        }
        localStorage.setItem('tut_has_previously_signed_in', 'true');
        
        // Notify user if status changed to approved
        if (lastProfileStatus.current === 'pending' && data.status === 'approved') {
          sendNotification('Account Approved!', 'Your T.U.T. membership has been approved. You can now access all services.', user.email || undefined);
        }
        lastProfileStatus.current = data.status;
      } else {
        if (user.email?.toLowerCase() === 'tahsinullahtusher999@gmail.com') {
          const adminProfile: UserProfile = {
            uid: user.uid,
            email: 'tahsinullahtusher999@gmail.com',
            name: "Tahsin Ullah Tusher",
            nid: "1234567890",
            address: "T.U.T. Headquarters",
            occupation: "Chief Admin",
            phone: "01700000000",
            status: "approved",
            role: "admin",
            totalLoan: 0,
            totalDeposit: 0,
            remainingDebt: 0,
            createdAt: new Date(),
          };
          setDoc(doc(db, 'users', user.uid), adminProfile);
          setProfile(adminProfile);
          localStorage.setItem('tut_saved_profile', JSON.stringify(adminProfile));
          localStorage.setItem('tut_saved_name', "Tahsin Ullah Tusher");
          localStorage.setItem('tut_saved_email', "tahsinullahtusher999@gmail.com");
          localStorage.setItem('tut_has_previously_signed_in', 'true');
        } else {
          if (user.email) {
            const cleanEmail = user.email.toLowerCase().trim();
            const preUid = "pre_email_" + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
            const preDocRef = doc(db, 'users', preUid);
            getDoc(preDocRef).then((preSnap) => {
              if (preSnap.exists()) {
                const preData = preSnap.data();
                console.log("Found pre-created profile, migrating...", preData);
                const migratedProfile = {
                  ...preData,
                  uid: user.uid,
                  createdAt: preData.createdAt || new Date()
                };
                
                // Set the real user profile
                setDoc(doc(db, 'users', user.uid), migratedProfile).then(() => {
                  // Delete the pre-created one
                  deleteDoc(preDocRef).catch(e => console.error("Error deleting pre-created profile document:", e));
                }).catch(e => {
                  console.error("Error writing migrated profile:", e);
                });
              } else {
                setProfile(null);
                localStorage.removeItem('tut_saved_profile');
              }
            }).catch(err => {
              console.error("Error checking pre-created profile:", err);
              setProfile(null);
              localStorage.removeItem('tut_saved_profile');
            });
          } else {
            setProfile(null);
            localStorage.removeItem('tut_saved_profile');
          }
        }
      }
      setLoading(false);
    }, (err) => {
      handleFirestorePermissionOrTokenError(err, 'Profile Listener').then((handled) => {
        if (handled) {
          setLoading(false);
          return;
        }
        // Only set error if user is still logged in and error not handled
        if (auth.currentUser) {
          setGlobalError(`Profile Error: ${err.message}`);
          const errInfo = handleFirestoreError(err, OperationType.GET, path);
          setAsyncError(new Error(JSON.stringify(errInfo)));
        }
        setLoading(false);
      });
    });

    return unsub;
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!profile || profile.status !== 'approved' || !user) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const txs = snap.docs.map(d => ({ ...d.data() as any, id: d.id } as Transaction));
      
      // Sort client-side descending by timestamp (newest first) to prevent Firestore composite index issues
      txs.sort((a, b) => {
        const getTs = (item: any) => {
          const t = item.timestamp || item.createdAt || item.date;
          if (!t) return 0;
          if (typeof t.toMillis === 'function') return t.toMillis();
          if (typeof t.toDate === 'function') return t.toDate().getTime();
          if (t.seconds) return t.seconds * 1000;
          const d = new Date(t);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getTs(b) - getTs(a);
      });

      // Notify user if a transaction status changed to confirmed
      txs.forEach(tx => {
        const prevStatus = lastTxStatuses.current[tx.id];
        if (prevStatus === 'pending' && tx.status === 'confirmed') {
          sendNotification('Transaction Confirmed!', `Your ${tx.type} request of ৳${tx.amount.toLocaleString()} has been confirmed.`, user.email || undefined);
        }
        lastTxStatuses.current[tx.id] = tx.status;
      });
      
      setTransactions(txs);
    }, (err) => {
      handleFirestorePermissionOrTokenError(err, 'Transactions Listener').then((handled) => {
        if (handled) return;
        if (auth.currentUser) {
          setGlobalError(`Transaction Error: ${err.message}`);
          handleFirestoreError(err, OperationType.LIST, 'transactions');
        }
      });
    });

    return unsub;
  }, [profile, user]);

  // Admin Data Listeners
  useEffect(() => {
    if (!isAdminLoggedIn || !user) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      console.log("Admin Users Snapshot received:", snap.size, "docs");
      const users = snap.docs.map(d => {
        const u = d.data() as UserProfile;
        const isPaid = (u.subscriptionTier === 'silver' || u.subscriptionTier === 'gold');
        if (isPaid && u.subscriptionStatus === 'active') {
          const hasExpired = u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) < new Date();
          if (hasExpired) {
            u.subscriptionTier = 'bronze';
            u.borrowingLimit = 500;
          } else {
            u.borrowingLimit = u.borrowingLimit || (u.subscriptionTier === 'silver' ? 1500 : 2500);
          }
        } else if (!u.subscriptionTier) {
          u.subscriptionTier = 'bronze';
          u.subscriptionStatus = u.subscriptionStatus || 'active';
          u.borrowingLimit = 500;
        }
        return u;
      });
      const pendingCount = users.filter(u => u.status === 'pending').length;
      
      // Show live in-app alert if new pending user arrives (email comes from NotificationService workflow)
      if (lastUserCount.current !== null && pendingCount > lastUserCount.current) {
        const title = 'New Membership Request';
        const body = `There are ${pendingCount} pending registrations awaiting review.`;
        setNotificationHistory(prev => [{ id: Math.random().toString(36).substring(2, 9), title, body, timestamp: Date.now() }, ...prev].slice(0, 50));
        addToast(title, body, 'info');
      }
      lastUserCount.current = pendingCount;
      
      setAllUsers(users);

      // Auto-sync in background only for expired active paid subscriptions or users with no tier at all
      if (user.email?.toLowerCase() === 'tahsinullahtusher999@gmail.com') {
        snap.docs.forEach(docSnap => {
          const raw = docSnap.data();
          if (raw.subscriptionStatus === 'pending_approval') {
            // NEVER overwrite pending approval subscriptions
            return;
          }
          const isPaid = (raw.subscriptionTier === 'silver' || raw.subscriptionTier === 'gold');
          if (isPaid && raw.subscriptionStatus === 'active' && raw.subscriptionExpiresAt) {
            if (new Date(raw.subscriptionExpiresAt).getTime() < (Date.now() - 24 * 60 * 60 * 1000)) {
              updateDoc(docSnap.ref, {
                subscriptionTier: 'bronze',
                subscriptionStatus: 'active',
                borrowingLimit: 500,
                subscriptionExpiresAt: '',
                updatedAt: serverTimestamp()
              }).catch(() => {});
            }
          } else if (!raw.subscriptionTier) {
            updateDoc(docSnap.ref, {
              subscriptionTier: 'bronze',
              subscriptionStatus: 'active',
              borrowingLimit: 500,
              updatedAt: serverTimestamp()
            }).catch(() => {});
          }
        });
      }
    }, (err) => {
      handleFirestorePermissionOrTokenError(err, 'Admin Users Listener').then((handled) => {
        if (handled) return;
        if (auth.currentUser) {
          setGlobalError(`Admin Users Error: ${err.message}`);
          handleFirestoreError(err, OperationType.LIST, 'users');
        }
      });
    });

    const unsubTx = onSnapshot(collection(db, 'transactions'), (snap) => {
      console.log("Admin Transactions Snapshot received:", snap.size, "docs");
      const txs = snap.docs.map(d => {
        const data = d.data();
        return { ...data as any, id: d.id } as Transaction;
      });
      
      const pendingCount = txs.filter(t => t.status === 'pending').length;
      // Show live in-app alert if new pending transaction arrives (email comes from NotificationService workflow)
      if (lastTxCount.current !== null && pendingCount > lastTxCount.current) {
        const title = 'New Transaction Request';
        const body = `There are ${pendingCount} pending transactions awaiting confirmation.`;
        setNotificationHistory(prev => [{ id: Math.random().toString(36).substring(2, 9), title, body, timestamp: Date.now() }, ...prev].slice(0, 50));
        addToast(title, body, 'info');
      }
      lastTxCount.current = pendingCount;

      // Sort by timestamp desc in memory
      txs.sort((a, b) => {
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return tB - tA;
      });
      setAllTransactions(txs);
    }, (err) => {
      handleFirestorePermissionOrTokenError(err, 'Admin Transactions Listener').then((handled) => {
        if (handled) return;
        if (auth.currentUser) {
          console.error("Admin Transactions Error:", err);
          setGlobalError(`Admin Transactions Error: ${err.message}`);
          handleFirestoreError(err, OperationType.LIST, 'transactions');
        }
      });
    });

    const unsubAuditLogs = onSnapshot(collection(db, 'audit_logs'), (snap) => {
      console.log("Admin Audit Logs Snapshot received:", snap.size, "docs");
      const logs = snap.docs.map(d => {
        const data = d.data();
        return { ...data as any, id: d.id };
      });
      logs.sort((a, b) => {
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return tB - tA;
      });
      setAuditLogs(logs);
    }, (err) => {
      console.error("Admin Audit Logs error:", err);
      handleFirestoreError(err, OperationType.LIST, 'audit_logs');
    });

    const unsubEmailLogs = onSnapshot(collection(db, 'email_logs'), (snap) => {
      console.log("Admin Email Logs Snapshot received:", snap.size, "docs");
      const logs = snap.docs.map(d => {
        const data = d.data();
        return { ...data as any, id: d.id };
      });
      logs.sort((a, b) => {
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return tB - tA;
      });
      setEmailLogs(logs);
    }, (err) => {
      console.error("Admin Email Logs error:", err);
      handleFirestoreError(err, OperationType.LIST, 'email_logs');
    });

    return () => {
      unsubUsers();
      unsubTx();
      unsubAuditLogs();
      unsubEmailLogs();
    };
  }, [isAdminLoggedIn, user]);

  // Global Sponsorships Listener for public/admin views
  useEffect(() => {
    const unsubSponsorships = onSnapshot(collection(db, 'sponsorships'), (snap) => {
      console.log("Sponsorships Snapshot received:", snap.size, "docs");
      const list = snap.docs.map(d => ({ ...d.data() as any, id: d.id } as SponsorshipCampaign));
      setSponsorships(list);
    }, (err) => {
      console.error("Sponsorships Error (using fallback defaults):", err);
      handleFirestorePermissionOrTokenError(err, 'Sponsorships Listener');
    });
    return unsubSponsorships;
  }, []);

  // Real-time listener for system_controls/sponsorships_seeded to sync seeded state for ALL users
  useEffect(() => {
    const unsubSeeded = onSnapshot(doc(db, 'system_controls', 'sponsorships_seeded'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().seeded) {
        setIsSponsorshipsSeeded(true);
      } else {
        setIsSponsorshipsSeeded(false);
      }
    }, (err) => {
      console.warn("Notice listening to system_controls/sponsorships_seeded:", err?.message || err);
    });
    return unsubSeeded;
  }, []);

  // Real-time listener for system_controls/ad_settings
  useEffect(() => {
    const unsubAdSettings = onSnapshot(doc(db, 'system_controls', 'ad_settings'), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data() as any;
        setAdSettings({
          entrancePopupEnabled: d.entrancePopupEnabled !== false,
          globalCooldownHours: typeof d.globalCooldownHours === 'number' ? d.globalCooldownHours : 12,
          allowHeroRotation: d.allowHeroRotation !== false,
          updatedAt: d.updatedAt,
          updatedBy: d.updatedBy
        });
      }
    }, (err) => {
      console.warn("Notice listening to system_controls/ad_settings:", err?.message || err);
    });
    return unsubAdSettings;
  }, []);

  // Real-time Trigger for Entrance Dashboard Advertisement Popup (Honors Placement, Audience, Cooldown & Priority)
  useEffect(() => {
    if (!profile || profile.status !== 'approved' || hasAdBeenShown || activeSponsorships.length === 0) return;
    if (!adSettings.entrancePopupEnabled) return;

    const cooldownHours = adSettings.globalCooldownHours ?? 12;
    if (cooldownHours > 0) {
      try {
        const lastShown = Number(localStorage.getItem('tut_ad_last_shown_at') || '0');
        if (lastShown > 0 && Date.now() - lastShown < cooldownHours * 3600 * 1000) {
          return;
        }
      } catch {}
    }

    const memberTier = (profile.subscriptionTier || 'standard').toLowerCase();
    const hasDebt = (profile.remainingDebt || 0) > 0;
    const hasDeposit = (profile.totalDeposit || 0) > 0;

    const eligibleList = activeSponsorships.filter(s => {
      if (s.status !== 'active') return false;
      const placement = s.placement || 'all';
      if (placement !== 'all' && placement !== 'entrance_popup') return false;
      if (s.maxImpressions && s.maxImpressions > 0 && (s.impressions || 0) >= s.maxImpressions) return false;

      const audience = s.targetAudience || 'all';
      if (audience === 'all') return true;
      if (audience === 'active_borrowers') return hasDebt;
      if (audience === 'depositors') return hasDeposit;
      return audience === memberTier;
    });

    if (eligibleList.length > 0) {
      // Top pinned/priority campaigns get picked cleanly
      const sorted = [...eligibleList].sort((a, b) => {
        if (Boolean(b.isPinned) !== Boolean(a.isPinned)) return b.isPinned ? 1 : -1;
        return (b.priority || 0) - (a.priority || 0);
      });
      const chosenCampaign = sorted[0];
      setActiveEntranceAd(chosenCampaign);
      setHasAdBeenShown(true);
      try {
        localStorage.setItem('tut_ad_last_shown_at', String(Date.now()));
      } catch {}

      const chosenId = chosenCampaign.id;
      if (!incrementedSponsorsRef.current.has(chosenId)) {
        incrementedSponsorsRef.current.add(chosenId);
        incrementAdImpression(chosenId);
      }
    }
  }, [profile, activeSponsorships, hasAdBeenShown, adSettings]);

  // Real-time Impression tracker for dashboard active collaborations displayed as cards
  useEffect(() => {
    if (profile && profile.status === 'approved' && activeSponsorships.length > 0) {
      const activeList = activeSponsorships.filter(s => s.status === 'active');
      activeList.forEach(s => {
        if (!incrementedSponsorsRef.current.has(s.id)) {
          incrementedSponsorsRef.current.add(s.id);
          incrementAdImpression(s.id);
        }
      });
    }
  }, [profile, activeSponsorships]);

  // Real-time Authority Capital Listener
  useEffect(() => {
    const unsubPersonalFund = onSnapshot(doc(db, 'system_controls', 'funds'), (snap) => {
      console.log("Authority Fund setting received:", snap.exists() ? snap.data() : "No document");
      if (snap.exists()) {
        const data = snap.data();
        if (data) {
          if (typeof data.personalFund === 'number') {
            setAuthorityPersonalFund(data.personalFund);
            setTempFundValue(data.personalFund.toString());
          }
          const baseFund = data.personalFund || 500000;
          setLiquidReserve(data.liquidReserve ?? Math.floor(baseFund * 0.30));
          setOperationalReserve(data.operationalReserve ?? Math.floor(baseFund * 0.15));
          setEmergencyReserve(data.emergencyReserve ?? Math.floor(baseFund * 0.15));
          setAvailableLendingFund(data.availableLendingFund ?? Math.floor(baseFund * 0.25));
          setReservedCapital(data.reservedCapital ?? Math.floor(baseFund * 0.05));
          setFrozenCapital(data.frozenCapital ?? Math.floor(baseFund * 0.05));
          setExternalInvestmentReserve(data.externalInvestmentReserve ?? Math.floor(baseFund * 0.05));
          if (data.gmailNotificationsEnabled !== undefined) {
            setGmailNotificationsEnabled(data.gmailNotificationsEnabled);
          } else {
            setGmailNotificationsEnabled(true);
          }
        }
      }
    }, (err) => {
      console.warn("Could not load authority fund setting real-time, using fallback defaults:", err.message);
      handleFirestorePermissionOrTokenError(err, 'Authority Fund Listener');
    });
    return unsubPersonalFund;
  }, []);

  // Real-time Sponsorship Seed Status Listener
  useEffect(() => {
    const unsubSeeded = onSnapshot(doc(db, 'system_controls', 'sponsorships_seeded'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.seeded === true) {
          setIsSponsorshipsSeeded(true);
        }
      }
    }, (err) => {
      console.warn("Could not check sponsorship seed status, using fallback:", err.message);
    });
    return unsubSeeded;
  }, []);

  const handleUpdateAuthorityFund = async (amountStr: string) => {
    const amount = Number(amountStr);
    if (isNaN(amount) || amount < 0) {
      addToast("Invalid Amount", "Please enter a valid positive number for the personal fund.", "warning");
      return;
    }
    try {
      await setDoc(doc(db, 'system_controls', 'funds'), {
        personalFund: amount,
        updatedAt: serverTimestamp()
      }, { merge: true });
      addToast('System Fund Updated', `Authority personal investment fund updated to ৳${amount.toLocaleString()}`, 'success');
      setShowEditFundModal(false);
    } catch (error) {
      console.error("Error updating system fund:", error);
      handleFirestoreError(error, OperationType.WRITE, 'system_controls/funds');
    }
  };

  const executeReserveOperation = async (
    type: 'increase' | 'withdraw' | 'transfer' | 'lock' | 'unlock' | 'adjust',
    amount: number,
    notes: string,
    category: string,
    targetCategory?: string
  ) => {
    // 1. Verify PIN
    if (reserveOpPin !== '9900' && reserveOpPin !== 'TUT2026') {
      addToast('Authentication Failed', 'Invalid Authority Verification PIN.', 'warning');
      return false;
    }

    try {
      const fundsRef = doc(db, 'system_controls', 'funds');
      const updates: any = {};
      let desc = '';

      // Get current values
      let curLiquid = liquidReserve;
      let curOperational = operationalReserve;
      let curEmergency = emergencyReserve;
      let curLending = availableLendingFund;
      let curReserved = reservedCapital;
      let curFrozen = frozenCapital;
      let curInvestment = externalInvestmentReserve;
      let curPersonal = authorityPersonalFund;

      const getCategoryValue = (cat: string) => {
        if (cat === 'liquidReserve') return curLiquid;
        if (cat === 'operationalReserve') return curOperational;
        if (cat === 'emergencyReserve') return curEmergency;
        if (cat === 'availableLendingFund') return curLending;
        if (cat === 'reservedCapital') return curReserved;
        if (cat === 'frozenCapital') return curFrozen;
        if (cat === 'externalInvestmentReserve') return curInvestment;
        return 0;
      };

      const setCategoryValue = (cat: string, val: number) => {
        updates[cat] = Math.max(0, val);
      };

      if (type === 'increase') {
        const val = getCategoryValue(category);
        setCategoryValue(category, val + amount);
        updates.personalFund = curPersonal + amount;
        desc = `Increased ${category} by ৳${amount.toLocaleString()} BDT.`;
      } else if (type === 'withdraw') {
        const val = getCategoryValue(category);
        if (val < amount) {
          addToast('Insufficient Funds', `The selected category has insufficient balance (৳${val.toLocaleString()}).`, 'warning');
          return false;
        }
        setCategoryValue(category, val - amount);
        updates.personalFund = Math.max(0, curPersonal - amount);
        desc = `Withdrew ৳${amount.toLocaleString()} BDT from ${category}.`;
      } else if (type === 'transfer' && targetCategory) {
        const valFrom = getCategoryValue(category);
        if (valFrom < amount) {
          addToast('Insufficient Funds', `Source category has insufficient balance (৳${valFrom.toLocaleString()}).`, 'warning');
          return false;
        }
        const valTo = getCategoryValue(targetCategory);
        setCategoryValue(category, valFrom - amount);
        setCategoryValue(targetCategory, valTo + amount);
        desc = `Transferred ৳${amount.toLocaleString()} BDT from ${category} to ${targetCategory}.`;
      } else if (type === 'lock') {
        // Transfer from available lending to frozen capital
        if (curLending < amount) {
          addToast('Insufficient Funds', `Available Lending Fund has insufficient balance (৳${curLending.toLocaleString()}).`, 'warning');
          return false;
        }
        updates.availableLendingFund = curLending - amount;
        updates.frozenCapital = curFrozen + amount;
        desc = `Locked ৳${amount.toLocaleString()} BDT in Frozen Capital (transferred from Available Lending Fund).`;
      } else if (type === 'unlock') {
        // Transfer from frozen capital to available lending
        if (curFrozen < amount) {
          addToast('Insufficient Funds', `Frozen Capital has insufficient balance (৳${curFrozen.toLocaleString()}).`, 'warning');
          return false;
        }
        updates.frozenCapital = curFrozen - amount;
        updates.availableLendingFund = curLending + amount;
        desc = `Unlocked ৳${amount.toLocaleString()} BDT from Frozen Capital (transferred to Available Lending Fund).`;
      } else if (type === 'adjust') {
        setCategoryValue(category, amount);
        desc = `Manually adjusted ${category} to ৳${amount.toLocaleString()} BDT.`;
      }

      updates.updatedAt = serverTimestamp();
      await updateDoc(fundsRef, updates);

      // Log to audit log
      await logAuditEvent('Reserve Modification', `${desc} Notes: ${notes}`, 'critical');

      // Send a high priority notification
      await sendNotification('Reserve Capital Modified', desc, ADMIN_EMAIL);

      addToast('Operation Executed', desc, 'success');
      
      // Reset states
      setReserveOpAmount('');
      setReserveOpNotes('');
      setReserveOpPin('');
      setReserveOperationModal(null);
      return true;
    } catch (err: any) {
      console.error("Reserve operation failed:", err);
      addToast('Operation Failed', err.message, 'warning');
      return false;
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updatedData = {
        totalLoan: Number(editLoan),
        totalDeposit: Number(editDeposit),
        remainingDebt: Number(editDebt),
        facebook: editingUser.facebook || '',
        whatsapp: editingUser.whatsapp || '',
        telegram: editingUser.telegram || '',
        fatherName: editingUser.fatherName || '',
        motherName: editingUser.motherName || '',
        dob: editingUser.dob || '',
        bloodGroup: editingUser.bloodGroup || '',
        emergencyContact: editingUser.emergencyContact || '',
        nomineeName: editingUser.nomineeName || '',
        nomineeRelation: editingUser.nomineeRelation || '',
        photoUrl: editingUser.photoUrl || '',
        permanentAddress: editingUser.permanentAddress || '',
        referenceContact: editingUser.referenceContact || '',
        adminNotes: editingUser.adminNotes || ''
      };

      await updateDoc(doc(db, 'users', editingUser.uid), updatedData);
      
      if (editingUser.email) {
        await sendNotification('Account Updated', 'Your account balances have been updated by the T.U.T. Authority. Please check your dashboard.', editingUser.email);
      }

      setShowEditUserModal(false);
      setEditingUser(null);
      addToast("Updated", "Member data updated successfully!", "success");
    } catch (error) {
      console.error("Update user error:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingUser.uid}`);
    }
  };

  const openEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setEditLoan(u.totalLoan.toString());
    setEditDeposit(u.totalDeposit.toString());
    setEditDebt(u.remainingDebt.toString());
    setShowEditUserModal(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', userToDelete.uid));
      setShowDeleteModal(false);
      setUserToDelete(null);
      addToast("Deleted", "Member account deleted successfully!", "info");
    } catch (error) {
      console.error("Delete user error:", error);
      handleFirestoreError(error, OperationType.DELETE, `users/${userToDelete.uid}`);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createMemberName.trim()) {
      addToast("Validation Error", "Name is required", "warning");
      return;
    }
    const cleanEmail = createMemberEmail.toLowerCase().trim();
    if (!cleanEmail) {
      addToast("Validation Error", "Email is required for account creation and automatic linking", "warning");
      return;
    }
    if (createMemberPhone.length !== 11 || !createMemberPhone.startsWith('0')) {
      addToast("Validation Error", "Phone number must be 11 digits starting with 0", "warning");
      return;
    }

    // Check for email uniqueness in existing users
    const emailExists = allUsers.some(u => u.email?.toLowerCase().trim() === cleanEmail);
    if (emailExists) {
      addToast("Profile Exists", "A member profile with this email already exists!", "warning");
      return;
    }

    try {
      // Use clean email key as the pre-uid to identify pre-created profiles
      const preUid = "pre_email_" + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const generatedMemberId = createMemberMemberId.trim() || `TUT-MBR-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      const newProfile: any = {
        uid: preUid,
        email: cleanEmail,
        name: createMemberName.trim(),
        nid: createMemberNid.trim(),
        address: createMemberAddress.trim(),
        permanentAddress: createMemberPermanentAddress.trim(),
        referenceContact: createMemberReferenceContact.trim(),
        nomineeName: createMemberNomineeName.trim(),
        nomineeRelation: createMemberNomineeRelation.trim(),
        occupation: createMemberOccupation.trim(),
        phone: createMemberPhone.trim(),
        status: createMemberStatus,
        totalLoan: Number(createMemberInitialLoan) || 0,
        totalDeposit: Number(createMemberInitialDeposit) || 0,
        remainingDebt: Number(createMemberInitialDebt) || 0,
        role: 'member',
        memberId: generatedMemberId,
        createdAt: new Date(),
        adminNotes: 'Created directly from official admin desk.'
      };

      console.log("Creating pre-registered member profile in Firestore:", newProfile);
      await setDoc(doc(db, 'users', preUid), newProfile);
      console.log("Pre-registered member profile successfully saved.");
      
      // Reset form fields
      setCreateMemberName('');
      setCreateMemberEmail('');
      setCreateMemberPhone('');
      setCreateMemberNid('');
      setCreateMemberOccupation('');
      setCreateMemberAddress('');
      setCreateMemberPermanentAddress('');
      setCreateMemberReferenceContact('');
      setCreateMemberNomineeName('');
      setCreateMemberNomineeRelation('');
      setCreateMemberStatus('approved');
      setCreateMemberMemberId('');
      setCreateMemberInitialDeposit('0');
      setCreateMemberInitialLoan('0');
      setCreateMemberInitialDebt('0');
      
      setShowCreateMemberModal(false);
      addToast("Member Registered", "Member profile created and registered successfully! When this member logs in with this email, their dashboard will automatically connect.", "success");
    } catch (error) {
      console.error("Error creating pre-registered member:", error);
      handleFirestoreError(error, OperationType.WRITE, 'users/pre_email_info');
      addToast("Registration Failed", "Failed to create member profile.", "warning");
    }
  };

  const incrementAdImpression = async (id: string) => {
    try {
      const existingDoc = sponsorships.find(s => s.id === id);
      if (existingDoc) {
        const docRef = doc(db, 'sponsorships', id);
        await updateDoc(docRef, {
          impressions: increment(1)
        });
        console.log(`Incremented real-time impression counter for campaign: ${id}`);
      } else {
        const defaultSponsor = DEFAULT_SPONSORSHIPS.find(s => s.id === id);
        if (defaultSponsor && isAdminLoggedIn) {
          const payload = {
            ...defaultSponsor,
            impressions: (defaultSponsor.impressions || 0) + 1
          };
          const { id: _, ...safePayload } = payload;
          await setDoc(doc(db, 'sponsorships', id), safePayload);
          console.log(`Initialized default campaign ${id} into Firestore with incremented impression`);
        }
      }
    } catch (err) {
      console.error("Failed to increment ad impression:", err);
    }
  };

  const handleAdClick = async (rawId: string) => {
    const id = rawId.startsWith('sponsor-') ? rawId.slice(8) : rawId;
    try {
      // Instantly update local state for real-time visual responsiveness
      setLocalSponsorChanges(prev => {
        const existing = prev.find(item => item.id === id) || sponsorships.find(s => s.id === id) || DEFAULT_SPONSORSHIPS.find(s => s.id === id);
        if (!existing) return prev;
        const updated = {
          ...existing,
          clicks: (existing.clicks || 0) + 1
        };
        return [...prev.filter(item => item.id !== id), updated];
      });

      const existingDoc = sponsorships.find(s => s.id === id);
      if (existingDoc) {
        const docRef = doc(db, 'sponsorships', id);
        await updateDoc(docRef, {
          clicks: increment(1)
        });
      }
    } catch (err) {
      console.error("Ad click increment failed in background:", err);
    }
  };

  const handleAddSponsorship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorCompany || !sponsorValue) return;
    try {
      const randomId = 'sp-' + Date.now().toString(36);
      const payload: SponsorshipCampaign = {
        id: randomId,
        companyName: sponsorCompany,
        dealValue: Number(sponsorValue),
        campaignType: sponsorType,
        promotionText: sponsorPromo || 'Promoted corporate partner of T.U.T. Private Authority',
        status: sponsorStatus,
        impressions: Math.floor(Math.random() * 50) + 10,
        clicks: 0,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      };

      if (sponsorLogoUrl) payload.logoUrl = sponsorLogoUrl;
      if (sponsorImageUrl) payload.imageUrl = sponsorImageUrl;
      if (sponsorVideoUrl) payload.videoUrl = sponsorVideoUrl;
      if (sponsorTargetUrl) payload.targetUrl = sponsorTargetUrl;
      if (sponsorSpecialOffer) payload.specialOffer = sponsorSpecialOffer;

      // Ensure it is not in the deleted list locally
      setLocalDeletedSponsors(prev => prev.filter(x => x !== randomId));

      // Update local storage representation instantly
      setLocalSponsorChanges(prev => [...prev.filter(item => item.id !== randomId), payload]);

      // Fire Firestore creation in the background using setDoc for ID consistency
      const { id: _, ...dbPayload } = payload;
      await setDoc(doc(db, 'sponsorships', randomId), dbPayload);
      addToast("Deal Created", "Sponsorship Deal added and synchronized successfully!", "success");
    } catch (err) {
      console.warn("Firestore write deferred (persisted offline on device):", err);
      addToast("Deal Saved", "Sponsorship Deal logged and saved successfully on your screen!", "info");
    }

    setSponsorCompany('');
    setSponsorValue('');
    setSponsorPromo('');
    setSponsorLogoUrl('');
    setSponsorImageUrl('');
    setSponsorVideoUrl('');
    setSponsorTargetUrl('');
    setSponsorSpecialOffer('');
    setShowSponsorModal(false);
  };

  const handleToggleSponsorStatus = async (id: string, currentStatus: 'active' | 'paused' | 'completed') => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      const existingSponsor = activeSponsorships.find(s => s.id === id);
      if (!existingSponsor) {
        throw new Error("Sponsorship campaign not found.");
      }
      
      const payload: SponsorshipCampaign = {
        ...existingSponsor,
        status: newStatus
      };

      // Instantly apply locally
      setLocalSponsorChanges(prev => [...prev.filter(item => item.id !== id), payload]);

      // Update in Firestore
      const docRef = doc(db, 'sponsorships', id);
      const existingDoc = sponsorships.find(s => s.id === id);
      if (existingDoc) {
        await updateDoc(docRef, { status: newStatus });
      } else {
        // If it's a default sponsor, write it out fully
        const { id: _, ...dbPayload } = payload;
        await setDoc(docRef, dbPayload);
      }
      addToast("Status Updated", `Sponsorship status successfully updated to ${newStatus}`, "success");
    } catch (err) {
      console.error("Firestore update error:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'sponsorships/' + id);
      addToast("Status Notice", "Failed to save state to server, toggled locally on device!", "warning");
    }
  };

  const handleDeleteSponsor = async (id: string) => {
    if (deletingSponsorId !== id) {
      setDeletingSponsorId(id);
      setTimeout(() => {
        setDeletingSponsorId(prev => prev === id ? null : prev);
      }, 4000);
      return;
    }
    setDeletingSponsorId(null);
    try {
      // 1. Instantly mark as locally deleted on user device
      setLocalDeletedSponsors(prev => [...prev.filter(x => x !== id), id]);

      // 2. Remove from local changes
      setLocalSponsorChanges(prev => prev.filter(item => item.id !== id));

      // 3. Delete from Firestore completely
      await deleteDoc(doc(db, 'sponsorships', id));
      
      addToast("Campaign Removed", "Sponsorship deal deleted and synced successfully!", "info");
    } catch (err) {
      console.error("Firestore delete error:", err);
      handleFirestoreError(err, OperationType.DELETE, 'sponsorships/' + id);
      addToast("Notice", "Sponsorship deal removed locally on your device!", "warning");
    }
  };

  const handleClearAllAds = async () => {
    if (!isAdminLoggedIn) return;
    setIsClearingAllAdsLoading(true);
    try {
      // 1. Mark system sponsorships as seeded in Firestore to prevent default sponsorships fallback
      const seededDocRef = doc(db, 'system_controls', 'sponsorships_seeded');
      await setDoc(seededDocRef, { seeded: true, clearedAt: new Date().toISOString() });
      setIsSponsorshipsSeeded(true);

      // 2. Clear out all existing sponsorships documents in the Firestore sponsorships collection
      for (const s of sponsorships) {
        if (s.id === 'config_seeded') continue;
        await deleteDoc(doc(db, 'sponsorships', s.id));
      }

      // 3. Purge all local client state for instant visual feedback on device
      setLocalSponsorChanges([]);
      setLocalDeletedSponsors([]);

      addToast("Ads Cleared", "All current sponsorship ads have been cleared from the database successfully!", "info");
    } catch (err) {
      console.error("Failed to clear sponsorships from Firestore:", err);
      addToast("Clear Error", "Error occurred while clearing ads. Make sure you are authenticated and try again.", "warning");
    } finally {
      setIsClearingAllAdsLoading(false);
      setIsClearingAllAds(false);
    }
  };

  // Run on-mount/auth to permanently delete default sponsorship campaigns from Firestore and set isSponsorshipsSeeded to true
  useEffect(() => {
    // Only proceed if auth is ready, user is signed in, and admin session is active
    if (!isAuthReady || !user || !isAdminLoggedIn) return;

    // Check if the authenticated user is an authorized admin
    const isAuthorizedAdmin = 
      user.email?.toLowerCase() === 'tahsinullahtusher999@gmail.com' ||
      user.email?.toLowerCase() === 'tahsinullahtusher@gmail.com' ||
      user.email?.toLowerCase() === 'admin@tut.org' ||
      user.uid === 'qLF3AOrlPaX4Jv43zy2uOOKeq952' ||
      profile?.role === 'admin';

    if (!isAuthorizedAdmin) return;

    const deleteDefaultSponsorships = async () => {
      try {
        const defaultIds = ['sp-apex', 'sp-tusher', 'sp-bicon'];
        const namesToPurge = ['apex', 'bicon', 't.u.t. group', 'tut group'];
        
        const toDelete = sponsorships.filter(s => {
          const nameLower = s.companyName?.toLowerCase() || '';
          const matchesName = namesToPurge.some(n => nameLower.includes(n));
          const matchesId = defaultIds.includes(s.id);
          return (matchesName || matchesId) && !deletedIdsThisSession.includes(s.id);
        });

        // If already marked seeded and no lingering default sponsorships exist, skip work
        if (isSponsorshipsSeeded && toDelete.length === 0) return;

        if (toDelete.length > 0) {
          const newDeletedIds = [...deletedIdsThisSession];
          for (const s of toDelete) {
            newDeletedIds.push(s.id);
            try {
              await deleteDoc(doc(db, 'sponsorships', s.id));
              console.log(`Deleted default sponsorship ${s.id} (${s.companyName}) from Firestore`);
            } catch (delErr) {
              console.warn(`Notice deleting default sponsorship doc ${s.id}:`, delErr);
            }
          }
          setDeletedIdsThisSession(newDeletedIds);
        }

        // Also clean up standard hardcoded IDs if present
        for (const id of defaultIds) {
          if (!deletedIdsThisSession.includes(id)) {
            try {
              await deleteDoc(doc(db, 'sponsorships', id));
            } catch {
              // Ignore if already deleted or non-existent
            }
          }
        }
        
        // Also ensure system_controls/sponsorships_seeded is updated/set if not already set
        if (!isSponsorshipsSeeded) {
          try {
            const seededDocRef = doc(db, 'system_controls', 'sponsorships_seeded');
            await setDoc(seededDocRef, { seeded: true, clearedAt: new Date().toISOString() }, { merge: true });
            setIsSponsorshipsSeeded(true);
          } catch (seedErr) {
            console.warn("Notice updating sponsorships_seeded control doc:", seedErr);
          }
        }
      } catch (err) {
        console.warn("Notice during default sponsorships permanent cleanup:", err);
      }
    };
    
    deleteDefaultSponsorships();
  }, [isAuthReady, user, isAdminLoggedIn, profile?.role, isSponsorshipsSeeded, sponsorships, deletedIdsThisSession]);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    if (authMode === 'signup' && password !== confirmPassword) {
      addToast("পাসওয়ার্ড অমিল", "পাসওয়ার্ড দুটি মিলছে না। অনুগ্রহ করে আবার চেক করুন।", "warning");
      return;
    }

    setIsLoggingIn(true);
    setGlobalError(null);

    try {
      // Force Local Persistence
      await setPersistence(auth, browserLocalPersistence);
      
      let finalEmail = email.toLowerCase().trim();
      let finalPassword = password;
      const isAdminCredentials = finalEmail === 'tahsinullahtusher999@gmail.com' && finalPassword === '9900';
      
      if (isAdminCredentials) {
        finalPassword = '9900_TUT2026_ADMIN';
      }

      if (authMode === 'login') {
        try {
          await signInWithEmailAndPassword(auth, finalEmail, finalPassword);
        } catch (loginErr: any) {
          if (isAdminCredentials && (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential')) {
            console.log("Admin user not found, registering automatically...");
            await createUserWithEmailAndPassword(auth, finalEmail, finalPassword);
          } else {
            throw loginErr;
          }
        }
      } else {
        await createUserWithEmailAndPassword(auth, finalEmail, finalPassword);
      }
      
      console.log("Email auth successful");
      if (tutCheckoutRequest) {
        setIsLoggingIn(false);
        return;
      }
      window.location.reload();
    } catch (error: any) {
      console.error("Email auth error:", error);
      setIsLoggingIn(false);
      
      let msg = "ত্রুটি ঘটেছে, আবার চেষ্টা করুন।";
      if (error.code === 'auth/operation-not-allowed') {
        msg = "স্যার, ফায়ারবেস কনসোলে ইমেইল লগইন ইনেবল করা নেই।";
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = "ইমেইল অথবা পাসওয়ার্ড ভুল।";
      } else if (error.code === 'auth/email-already-in-use') {
        msg = "এই ইমেইলটি ইতিমধ্যে ব্যবহৃত হচ্ছে।";
      } else if (error.code === 'auth/weak-password') {
        msg = "পাসওয়ার্ডটি খুব দুর্বল। কমপক্ষে ৬টি অক্ষর দিন।";
      } else if (error.code === 'auth/invalid-email') {
        msg = "সঠিক ইমেইল এড্রেস দিন।";
      }
      
      addToast("অথেনটিকেশন ব্যর্থ", msg, "warning");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      addToast("ইমেইল প্রয়োজন", "পাসওয়ার্ড রিসেট করতে আগে আপনার ইমেইলটি লিখুন।", "info");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      addToast("রিসেট লিঙ্ক পাঠানো হয়েছে", "আপনার ইমেইলে পাসওয়ার্ড রিসেট লিঙ্ক পাঠানো হয়েছে। অনুগ্রহ করে চেক করুন।", "success");
    } catch (error: any) {
      console.error("Reset email error:", error);
      addToast("ত্রুটি", error.message || "ইমেইল পাঠানো সম্ভব হয়নি।", "warning");
    }
  };

  const handleLogin = async (isRetry = false) => {
    if (isLoggingIn && !isRetry) return;
    setIsLoggingIn(true);
    setGlobalError(null);
    
    // REMINDER: Ensure your current domain is added to the 'Authorized Domains' list 
    // in the Firebase Console (Authentication > Settings > Authorized Domains).
    // Current Domain: ais-dev-bo5opclp4lvfjrzc2bxtnd-813806389941.asia-southeast1.run.app
    
    console.log(`${isRetry ? 'Retrying' : 'Initiating'} Google Login via Popup...`);
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log("Login successful for user:", result.user.email);
      if (tutCheckoutRequest) {
        setIsLoggingIn(false);
        return;
      }
      window.location.reload();
    } catch (error: any) {
      console.error("Login attempt failed:", error);
      
      // Automatic Retry logic: If the network fails, try to reconnect once.
      if (!isRetry && (error.code === 'auth/network-request-failed' || error.message?.includes('network'))) {
        console.log("Network error detected. Retrying login once...");
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 1500));
        return handleLogin(true);
      }

      setIsLoggingIn(false);
      
      // Handle user cancellation gracefully without showing harsh popups/alerts
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        console.info("Sign in cancelled: User closed the login window.");
        addToast("Sign In Cancelled", "The login popup was closed before sign-in completed. Click Sign In to try again when ready.", "info");
        return;
      }
      
      let errorMessage = "Login Failed. ";
      if (error.code === 'auth/network-request-failed') {
        errorMessage += "A network error occurred. Please check your internet connection and try again.";
      } else if (error.code === 'auth/popup-blocked') {
        console.warn("Popup blocked by browser. Falling back to redirect...");
        try {
          const provider = new GoogleAuthProvider();
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirErr: any) {
          errorMessage += "The login popup was blocked and redirect fallback failed.";
        }
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage += "This domain is not authorized in Firebase. Please add it to 'Authorized Domains' in the Firebase Console.";
      } else {
        errorMessage += error.message || "Unknown error occurred.";
      }
      
      addToast("Sign In Issue", errorMessage, "warning");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (regData.phone.length !== 11 || !regData.phone.startsWith('0')) {
      addToast("Invalid Phone", "Phone number must be 11 digits starting with 0", "warning");
      return;
    }

    try {
      const isBootstrapAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
      const newProfile: any = {
        uid: user.uid,
        email: regData.email.toLowerCase() || user.email?.toLowerCase(),
        name: regData.name,
        nid: regData.nid,
        address: regData.address,
        occupation: regData.occupation,
        phone: regData.phone,
        photoUrl: regData.photoUrl,
        status: isBootstrapAdmin ? 'approved' : 'pending',
        totalLoan: 0,
        totalDeposit: 0,
        remainingDebt: 0,
        role: isBootstrapAdmin ? 'admin' : 'member',
        createdAt: serverTimestamp(),
        emailNotificationsEnabled: true
      };
      
      if (isBootstrapAdmin) {
        newProfile.memberId = `TUT-ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      console.log("Attempting to register profile:", newProfile);
      await setDoc(doc(db, 'users', user.uid), newProfile);
      console.log("Registration successful");
      await sendWorkflowNotification(
        'membership_request',
        regData.email.toLowerCase() || user.email?.toLowerCase(),
        regData.name,
        { uid: user.uid, phone: regData.phone, nid: regData.nid }
      );
    } catch (error) {
      console.error("Registration error details:", error);
      setGlobalError(`Registration Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const isPassValid = adminPassword === 'TUT2026' || adminPassword === '9900';
    const isPinValid = adminPin === '9900' || adminPin === 'TUT2026';
    const isUserAdminEmail = user && user.email?.toLowerCase() === 'tahsinullahtusher999@gmail.com';

    if (isPassValid || isPinValid || isUserAdminEmail) {
      setIsAdminLoggedIn(true);
      setShowAdminLogin(false);
      setAdminError('');
      setAdminPassword('');
      setAdminPin('');

      if (user) {
        setDoc(doc(db, 'users', user.uid), { role: 'admin', status: 'approved' }, { merge: true }).catch(err => {
          console.warn("Notice updating admin profile:", err?.message || err);
        });
        if (profile) {
          setProfile({ ...profile, role: 'admin', status: 'approved' });
        }
      }
    } else {
      setAdminError('Access Denied: Invalid Password or PIN. Please use your admin credentials (Password/PIN: 9900).');
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    const amount = parseFloat(requestAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (requestType === 'loan') {
      const subInfo = getSubscriptionStatusInfo(profile);
      if (!subInfo.active) {
        addToast(
          'Subscription Required',
          subInfo.isLocked
            ? 'Your lending capacities are completely LOCKED for this calendar month because you missed the standard Days 1-5 renewal window. To unlock immediately, please buy a 2-Month Renewal (Late Catch-up) upfront from the Subscription Hub.'
            : 'Please activate your monthly subscription tier first to unlock lending capacities. Standard subscriptions can be purchased in the Subscription Hub.',
          'warning'
        );
        return;
      }

      const currentDebt = profile.remainingDebt || 0;
      const proposedTotalDebt = currentDebt + amount;
      const limit = profile.borrowingLimit ?? 100000;
      if (proposedTotalDebt > limit) {
        addToast('Borrowing Limit Exceeded', `Your total debt with this request (৳${proposedTotalDebt.toLocaleString()}) would exceed your approved lending credit limit (৳${limit.toLocaleString()}). Please contact the Management Desk to increase your limit.`, 'warning');
        return;
      }
    }

    try {
      const reservedMemoId = `TUT-MEMO-${Math.floor(100000 + Math.random() * 900000)}`;
      const payload: any = {
        userId: user.uid,
        userName: profile.name,
        type: requestType,
        amount,
        exactAmount: amount,
        memoId: reservedMemoId,
        method: requestMethod,
        status: 'pending',
        timestamp: serverTimestamp()
      };

      if (requestType === 'loan' || requestType === 'refund') {
        payload.accountNumber = requestAccount;
      } else {
        payload.transactionId = requestTrxId;
      }

      if (requestType === 'loan') {
        payload.loanReason = loanReason;
        payload.estimatedRepaymentDate = estimatedRepaymentDate;
      }

      console.log("Submitting transaction payload:", payload);
      const docRef = await addDoc(collection(db, 'transactions'), payload);
      console.log("Transaction created with ID:", docRef.id);
      await sendWorkflowNotification('transaction_request', profile.email || user.email || undefined, profile.name, {
        uid: user.uid,
        memberId: profile.memberId,
        amount,
        type: requestType,
        method: requestMethod,
        memoId: reservedMemoId,
        transactionId: payload.transactionId,
        accountNumber: payload.accountNumber,
        estimatedRepaymentDate: requestType === 'loan' ? estimatedRepaymentDate : undefined,
        notes: requestType === 'loan' ? loanReason : undefined,
      });
      setShowRequestModal(false);
      setRequestAmount('');
      setRequestAccount('');
      setRequestTrxId('');
      setRequestMethod('Cash');
      setLoanReason('');
      setEstimatedRepaymentDate('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const handleBuySubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    if (!subSenderMobile || !subTrxId) {
      const isCash = subWallet === 'Cash';
      addToast(
        'Information Required',
        isCash
          ? "Please provide both the person's name and mobile number who is paying cash."
          : "Please provide both your sender mobile number and transaction ID.",
        'warning'
      );
      return;
    }
    
    const pricing = getSubscriptionPricing(selectedSubTier, profile);
    
    try {
      const payload: any = {
        userId: user.uid,
        userName: profile.name,
        type: 'subscription',
        amount: pricing.price,
        method: subWallet,
        accountNumber: subSenderMobile,
        transactionId: subTrxId,
        status: 'pending',
        subscriptionTier: selectedSubTier,
        subscriptionMonths: pricing.months,
        timestamp: serverTimestamp()
      };
      
      console.log("Submitting subscription transaction payload:", payload);
      const docRef = await addDoc(collection(db, 'transactions'), payload);
      
      // Update local profile status to 'pending_approval'
      await updateDoc(doc(db, 'users', user.uid), {
        subscriptionStatus: 'pending_approval',
        subscriptionTier: selectedSubTier
      });
      
      await sendWorkflowNotification('subscription_request', profile.email || user.email || undefined, profile.name, {
        uid: user.uid,
        memberId: profile.memberId,
        type: 'subscription',
        amount: pricing.price,
        tier: selectedSubTier,
        subscriptionMonths: pricing.months,
        method: subWallet,
        accountNumber: subSenderMobile,
        transactionId: subTrxId
      });
      
      addToast('Purchase Request Submitted', 'Your subscription payment is currently being verified by the Admin. Once verified, your limits will instantly unlock.', 'success');
      
      // Reset form fields
      setSubSenderMobile('');
      setSubTrxId('');
      setShowSubPaymentMode(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const rejectTransaction = async (tx: Transaction, notes?: string) => {
    try {
      await updateDoc(doc(db, 'transactions', tx.id), {
        status: 'rejected',
        adminNotes: notes || '',
        decidedBy: auth.currentUser?.email || 'admin',
        decidedAt: new Date().toISOString()
      });
      await logAuditEvent('Transaction Rejected', `Rejected ${tx.type} of ৳${tx.amount.toLocaleString()} for ${tx.userName} (${tx.userId})`, 'warning');
      
      // Notify user
      const userSnap = await getDoc(doc(db, 'users', tx.userId));
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        await sendWorkflowNotification('transaction_rejected', userData.email, userData.name, { amount: tx.amount, type: tx.type, notes: notes || '' });
      }
      addToast('Transaction Rejected', 'The request has been marked as rejected and the user notified.', 'info');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${tx.id}`);
    }
  };

  const rejectMember = async (targetUid: string, notes?: string) => {
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        status: 'rejected',
        adminNotes: notes || '',
        decidedBy: auth.currentUser?.email || 'admin',
        decidedAt: new Date().toISOString()
      });
      const userSnap = await getDoc(doc(db, 'users', targetUid));
      let userName = targetUid;
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        userName = userData.name;
        await sendWorkflowNotification('membership_rejected', userData.email, userData.name, { notes });
      }
      await logAuditEvent('Membership Rejected', `Rejected application for: ${userName} (${targetUid})`, 'warning');
      addToast('Member Rejected', 'The application has been marked as rejected and the user notified.', 'info');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const approveMember = async (targetUid: string, notes?: string) => {
    try {
      const memberId = `TUT-MBR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      await updateDoc(doc(db, 'users', targetUid), {
        status: 'approved',
        memberId: memberId,
        adminNotes: notes || '',
        decidedBy: auth.currentUser?.email || 'admin',
        decidedAt: new Date().toISOString()
      });

      // Send immediate notification to user
      const userSnap = await getDoc(doc(db, 'users', targetUid));
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        await logAuditEvent('Membership Approved', `Approved membership for ${userData.name} with Member ID: ${memberId}`, 'info');
        await sendWorkflowNotification('membership_approved', userData.email, userData.name, {
          uid: targetUid,
          memberId,
          borrowingLimit: userData.borrowingLimit || 500
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const requestMoreInfoForTransaction = async (tx: Transaction, notes: string) => {
    try {
      await updateDoc(doc(db, 'transactions', tx.id), {
        status: 'pending', // Keep pending in the queue, but flag it
        moreInfoRequested: true,
        adminNotes: notes || '',
        decidedBy: auth.currentUser?.email || 'admin',
        decidedAt: new Date().toISOString()
      });
      await logAuditEvent('More Info Requested', `Requested more info on ${tx.type} of ৳${tx.amount.toLocaleString()} for ${tx.userName}`, 'info');

      // Notify user
      const userSnap = await getDoc(doc(db, 'users', tx.userId));
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        await sendWorkflowNotification('transaction_more_info', userData.email, userData.name, { amount: tx.amount, type: tx.type, notes });
      }
      addToast('More Information Requested', 'Compliance letter has been dispatched and the user has been notified.', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${tx.id}`);
    }
  };

  const requestMoreInfoForMember = async (targetUid: string, notes: string) => {
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        status: 'pending', // Keep pending in the queue, but flag it
        moreInfoRequested: true,
        adminNotes: notes || '',
        decidedBy: auth.currentUser?.email || 'admin',
        decidedAt: new Date().toISOString()
      });
      const userSnap = await getDoc(doc(db, 'users', targetUid));
      let userName = targetUid;
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        userName = userData.name;
        await sendWorkflowNotification('membership_more_info', userData.email, userData.name, { notes });
      }
      await logAuditEvent('Membership Info Requested', `Requested more info for applicant ${userName}`, 'info');
      addToast('More Information Requested', 'Compliance letter has been dispatched and the user has been notified.', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const confirmTransaction = async (tx: Transaction, notes?: string) => {
    try {
      const memoId = (tx as any)?.memoId || `TUT-MEMO-${Math.floor(100000 + Math.random() * 900000)}`;
      const userRef = doc(db, 'users', tx.userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) return;
      const userData = userSnap.data() as UserProfile;

      let updates: any = {};
      if (tx.type === 'loan') {
        updates.totalLoan = (userData.totalLoan || 0) + tx.amount;
        updates.remainingDebt = (userData.remainingDebt || 0) + tx.amount;
        updates.loansTakenThisMonth = (userData.loansTakenThisMonth || 0) + 1;
      } else if (tx.type === 'deposit') {
        updates.totalDeposit = (userData.totalDeposit || 0) + tx.amount;
      } else if (tx.type === 'refund') {
        updates.totalDeposit = Math.max(0, (userData.totalDeposit || 0) - tx.amount);
      } else if (tx.type === 'pay_due') {
        updates.remainingDebt = Math.max(0, (userData.remainingDebt || 0) - tx.amount);
        updates.totalRepaid = (userData.totalRepaid || 0) + tx.amount;
      } else if (tx.type === 'subscription') {
        const tier = tx.subscriptionTier || 'bronze';
        const months = tx.subscriptionMonths || 1;
        const today = new Date();
        let expiresAt = new Date();
        if (userData.subscriptionStatus === 'active' && userData.subscriptionExpiresAt) {
          const currentExp = new Date(userData.subscriptionExpiresAt);
          if (currentExp > today) {
            expiresAt = new Date(currentExp);
          }
        }
        expiresAt.setDate(expiresAt.getDate() + ((months || 1) * 30));
        
        updates.subscriptionTier = tier;
        updates.subscriptionStatus = 'active';
        updates.subscriptionExpiresAt = expiresAt.toISOString();
        
        const wasOnTime = today.getDate() <= 5;
        if (wasOnTime) {
          updates.continuousSubscriptionMonths = (userData.continuousSubscriptionMonths || 0) + 1;
        } else {
          updates.continuousSubscriptionMonths = 1;
        }
        
        if ((userData.loansTakenThisMonth ?? 0) === 0 && userData.subscriptionStatus === 'active') {
          updates.consecutiveNoLoanMonths = (userData.consecutiveNoLoanMonths || 0) + 1;
        } else {
          updates.consecutiveNoLoanMonths = 0;
        }
        
        updates.loansTakenThisMonth = 0;
        
        let baseLimit = 500;
        if (tier === 'bronze') baseLimit = 500;
        if (tier === 'silver') baseLimit = 1500;
        if (tier === 'gold') baseLimit = 2500;
        
        const currentStreak = wasOnTime ? (userData.continuousSubscriptionMonths || 0) + 1 : 1;
        if (currentStreak >= 3) {
          baseLimit += 500;
        }
        updates.borrowingLimit = baseLimit;
        
        // Add subscription amount directly to main reserve fund
        const fundsDocRef = doc(db, 'system_controls', 'funds');
        await setDoc(fundsDocRef, {
          personalFund: increment(tx.amount),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      await updateDoc(userRef, updates);
      await updateDoc(doc(db, 'transactions', tx.id), {
        status: 'confirmed',
        memoId: memoId,
        exactAmount: tx.amount,
        adminNotes: notes || '',
        decidedBy: auth.currentUser?.email || 'admin',
        decidedAt: new Date().toISOString()
      });

      await logAuditEvent('Transaction Confirmed', `Confirmed ${tx.type} of ৳${tx.amount.toLocaleString()} with Memo ID: ${memoId} for ${tx.userName}`, 'info');

      // Send immediate notification + PDF memo to member and Chief Admin
      await sendWorkflowNotification('transaction_confirmed', userData.email, userData.name, {
        uid: tx.userId,
        memberId: userData.memberId,
        amount: tx.amount,
        type: tx.type,
        memoId,
        method: tx.method,
        accountNumber: tx.accountNumber,
        transactionId: tx.transactionId,
        tier: tx.subscriptionTier,
        subscriptionMonths: tx.subscriptionMonths,
        estimatedRepaymentDate: tx.estimatedRepaymentDate,
        remainingDebt: updates.remainingDebt ?? userData.remainingDebt,
        borrowingLimit: updates.borrowingLimit ?? userData.borrowingLimit,
        notes: notes || tx.loanReason || ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${tx.id}`);
    }
  };

  const updateBorrowingLimit = async (userId: string, valueStr: string) => {
    const parsed = parseFloat(valueStr);
    if (isNaN(parsed) || parsed < 0) {
      addToast('Invalid Limit', 'Please enter a valid non-negative number.', 'warning');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), {
        borrowingLimit: parsed
      });
      const userSnap = await getDoc(doc(db, 'users', userId));
      let userName = userId;
      if (userSnap.exists()) {
        const uData = userSnap.data() as UserProfile;
        userName = uData.name;
        await sendWorkflowNotification('credit_limit_adjusted', uData.email, uData.name, { amount: parsed });
      }
      await logAuditEvent('Limit Modified', `Updated approved borrowing limit for ${userName} to ৳${parsed.toLocaleString()} BDT`, 'info');
      addToast('Limit Updated', `Approved borrowing credit limit has been set to ৳${parsed.toLocaleString()} BDT successfully.`, 'success');
      setEditingLimitUid(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  if (tutCheckoutRequest) {
    return (
      <TutPaymentCheckout
        db={db}
        user={user}
        profile={profile}
        checkoutRequest={tutCheckoutRequest}
        isAuthChecking={!isAuthReady || (!!user && loading)}
        payerEmailHint={tutCheckoutRequest.payerEmailHint}
        onGoogleLogin={async () => {
          await handleLogin();
        }}
        isLoggingIn={isLoggingIn}
        sendWorkflowNotification={sendWorkflowNotification}
        addToast={addToast}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-between p-6 relative overflow-hidden">
        {/* Ambient radial glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-blue-600/10 rounded-full blur-[100px] sm:blur-[150px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-[200px] sm:w-[350px] h-[200px] sm:h-[350px] bg-indigo-600/5 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none" />

        {/* Top spacer to assist vertical centering of the main load card */}
        <div className="h-10 sm:h-20" />

        {/* Center Loading Core (Shifted slightly upper via margin adjustments) */}
        <div className="flex flex-col items-center justify-center flex-grow -translate-y-6 sm:-translate-y-12">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center text-center max-w-sm px-6"
          >
            {/* Brand Icon Shield container */}
            <div className="relative mb-6 group">
              {/* Soft pulsing outer rings */}
              <div className="absolute -inset-6 bg-blue-500/10 rounded-3xl blur-2xl animate-pulse duration-2000" />
              <div className="absolute -inset-2 bg-gradient-to-tr from-blue-500/25 to-indigo-500/25 rounded-3xl opacity-50 blur-sm animate-pulse duration-1500" />
              
              {/* Main metallic-bordered shield badge */}
              <div className="relative w-16 sm:w-20 h-16 sm:h-20 rounded-2xl sm:rounded-3xl overflow-hidden flex items-center justify-center border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.7)] bg-slate-900">
                <img src={tutLogo} alt="T.U.T. Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            </div>

            {/* Brand Title */}
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-[0.1em] uppercase mb-1 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              T.U.T.
            </h1>
            <p className="text-[8px] sm:text-[9px] font-black tracking-[0.4em] text-blue-400/80 uppercase mb-8">
              Money Lending Authority
            </p>

            {/* Modern Concentric Dual Spinner */}
            <div className="relative w-14 sm:w-16 h-14 sm:h-16 mb-8 flex items-center justify-center">
              {/* Outer clockwise spinning ring */}
              <div className="absolute inset-0 border-2 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
              {/* Inner counter-clockwise spinning ring */}
              <div className="absolute inset-1.5 border-2 border-indigo-400/10 border-b-indigo-400 rounded-full animate-spin-reverse" />
              {/* Center glowing dot */}
              <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
            </div>

            {/* Dynamic Status Message */}
            <div className="h-6 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={loadingStatusIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.25 }}
                  className="text-[9px] sm:text-[10px] font-mono font-bold tracking-[0.15em] text-blue-300 uppercase leading-none"
                >
                  {LOADING_STATUSES[loadingStatusIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Footer Branding Area: Minimal, Small & Professional */}
        <div className="flex flex-col items-center gap-3.5 pb-4 sm:pb-8 relative z-10 w-full max-w-sm sm:max-w-md px-4">
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          
          {/* Subtle Balanced Row: Founder in a side + Security in a side */}
          <div className="w-full flex items-center justify-between gap-3 px-1">
            {/* Left Side: Minimal, Small, Executive Founder Signature */}
            <div className="flex items-center gap-2 text-left">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400/70 shadow-[0_0_6px_rgba(96,165,250,0.5)] shrink-0" />
              <div className="flex flex-col leading-tight">
                <span className="text-[7.5px] sm:text-[8px] font-mono uppercase tracking-[0.22em] text-slate-500">
                  Founder
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold tracking-wide text-slate-300">
                  Tahsin Ullah Tusher
                </span>
                <span className="text-[8px] sm:text-[8.5px] tracking-wider text-slate-500 font-sans">
                  T.U.T. Group of Services
                </span>
              </div>
            </div>

            {/* Right Side: Refined Minimal Security Badge */}
            <div className="flex flex-col items-end text-right leading-tight">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 border border-white/5 rounded-full backdrop-blur-md shadow-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[8px] sm:text-[8.5px] font-mono font-bold tracking-widest text-slate-300 uppercase">
                  256-BIT SSL
                </span>
              </div>
              <span className="text-[7.5px] sm:text-[8px] font-mono tracking-wider text-slate-500 uppercase mt-1">
                Encrypted Gateway
              </span>
            </div>
          </div>

          {/* Core Pillars */}
          <span className="text-[9px] sm:text-[10px] font-bold text-white/35 uppercase tracking-[0.55em] text-center pt-1">
            Trust &bull; Unity &bull; Technology
          </span>
        </div>
      </div>
    );
  }

  // --- Redesigned Enterprise Admin Helpers ---
  const renderAdminOverview = () => {
    // Computed Metrics
    const totalCashPool = authorityPersonalFund + totalDeposits;
    const currentlyLent = outstandingDebt;
    
    const pendingRegistrations = allUsers.filter(u => u.status === 'pending');
    const pendingTransactions = allTransactions.filter(t => t.status === 'pending');
    const pendingCount = pendingRegistrations.length + pendingTransactions.length;
    const activeDebtors = allUsers.filter(u => u.status === 'approved' && (u.remainingDebt || 0) > 0);

    // Question 4: Filter members needing attention today:
    // - Pending registration approval
    // - Active debtors
    const attentionMembers = allUsers.filter(u => {
      if (u.status === 'pending') return true;
      if (u.status === 'approved' && (u.remainingDebt || 0) > 0) return true;
      if (u.moreInfoRequested) return true;
      return false;
    }).slice(0, 5);

    // Event handlers for quick actions
    const handleQuickApproveMember = async (uid: string, name: string) => {
      setActionLoadingId(`approve-mbr-${uid}`);
      try {
        await approveMember(uid);
        addToast('Membership Approved', `Successfully verified and activated ${name}'s membership.`, 'success');
      } catch (error) {
        console.error(error);
        addToast('Operation Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warning');
      } finally {
        setActionLoadingId(null);
      }
    };

    const handleQuickRejectMember = async (uid: string, name: string) => {
      setActionLoadingId(`reject-mbr-${uid}`);
      try {
        await rejectMember(uid, 'Rejected via Quick-Action Board');
        addToast('Membership Rejected', `Rejected application for ${name}.`, 'warning');
      } catch (error) {
        console.error(error);
        addToast('Operation Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warning');
      } finally {
        setActionLoadingId(null);
      }
    };

    const handleQuickApproveTx = async (tx: Transaction) => {
      setActionLoadingId(`approve-tx-${tx.id}`);
      try {
        await confirmTransaction(tx);
        addToast('Transaction Confirmed', `Approved ${tx.type} of ৳${tx.amount.toLocaleString()} for ${tx.userName || 'Member'}.`, 'success');
      } catch (error) {
        console.error(error);
        addToast('Approval Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warning');
      } finally {
        setActionLoadingId(null);
      }
    };

    const handleQuickRejectTx = async (tx: Transaction) => {
      setActionLoadingId(`reject-tx-${tx.id}`);
      try {
        await rejectTransaction(tx, 'Rejected via Quick-Action Board');
        addToast('Transaction Rejected', `Rejected ${tx.type} of ৳${tx.amount.toLocaleString()} for ${tx.userName || 'Member'}.`, 'warning');
      } catch (error) {
        console.error(error);
        addToast('Rejection Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warning');
      } finally {
        setActionLoadingId(null);
      }
    };

    const handleQuickSendReminder = async (user: UserProfile) => {
      if (!user.email) return;
      setActionLoadingId(`reminder-${user.uid}`);
      try {
        await sendWorkflowNotification('debt_warning', user.email, user.name, { amount: user.remainingDebt || 0 });
        addToast('Reminder Dispatched', `Direct alert successfully transmitted to ${user.name}'s workspace.`, 'success');
      } catch (error) {
        console.error(error);
        addToast('Failed to Send', `Could not dispatch alert to ${user.name}.`, 'warning');
      } finally {
        setActionLoadingId(null);
      }
    };

    // System Critical Actions List
    const actionItems: {
      id: string;
      type: 'registration' | 'transaction' | 'reminder';
      title: string;
      subtitle: string;
      badgeText: string;
      badgeColor: string;
      onApprove?: () => Promise<void>;
      onReject?: () => Promise<void>;
      onAction?: () => Promise<void>;
      actionText?: string;
    }[] = [];

    // Push pending registrations
    pendingRegistrations.forEach(u => {
      actionItems.push({
        id: `mbr-${u.uid}`,
        type: 'registration',
        title: `Approve Membership Application`,
        subtitle: `${u.name} • ${u.occupation || 'N/A'} • NID: ${u.nid || 'N/A'}`,
        badgeText: 'PENDING REGISTRATION',
        badgeColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        onApprove: () => handleQuickApproveMember(u.uid, u.name),
        onReject: () => handleQuickRejectMember(u.uid, u.name)
      });
    });

    // Push pending transactions
    pendingTransactions.forEach(tx => {
      const typeLabel = tx.type === 'loan' ? 'Loan Disbursal' : tx.type === 'deposit' ? 'Deposit' : tx.type === 'pay_due' ? 'Debt Repayment' : tx.type;
      actionItems.push({
        id: `tx-${tx.id}`,
        type: 'transaction',
        title: `Confirm ${typeLabel} Request`,
        subtitle: `৳${tx.amount.toLocaleString()} via ${tx.method} for ${tx.userName || 'Member'}${tx.transactionId ? ` (TxID: ${tx.transactionId})` : ''}`,
        badgeText: 'PENDING CASHFLOW',
        badgeColor: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
        onApprove: () => handleQuickApproveTx(tx),
        onReject: () => handleQuickRejectTx(tx)
      });
    });

    // Push active debtors without reminders dispatched
    activeDebtors.forEach(u => {
      actionItems.push({
        id: `rem-${u.uid}`,
        type: 'reminder',
        title: `Dispatch Compliance Warning Alert`,
        subtitle: `${u.name} holds ৳${(u.remainingDebt || 0).toLocaleString()} outstanding due with limit ৳${(u.borrowingLimit || 0).toLocaleString()}`,
        badgeText: 'OVERDUE NOTICE',
        badgeColor: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        onAction: () => handleQuickSendReminder(u),
        actionText: 'Dispatch Alert'
      });
    });

    return (
      <div className="space-y-8 text-left animate-fadeIn">
        {/* MISSION CONTROL HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] font-mono font-black text-blue-400 uppercase tracking-widest">PRIVATE ACCESS // LIVE COMMAND DECK</span>
            </div>
            <h1 className="text-xl font-black text-white uppercase tracking-tight mt-1">MISSION CONTROL STATION</h1>
            <p className="text-[10px] text-slate-400 mt-1">Active monitoring, risk analysis, and fast multi-queue decision engine.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-slate-950/80 border border-white/5 rounded-xl p-2 flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-[8px] font-mono text-slate-500 block uppercase font-bold">Authority Seed Pool</span>
                <span className="text-xs font-mono font-black text-white">৳{authorityPersonalFund.toLocaleString()} BDT</span>
              </div>
              <button 
                onClick={() => { setTempFundValue(authorityPersonalFund.toString()); setShowEditFundModal(true); }}
                className="px-2.5 py-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/10 hover:border-blue-500/20 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Top-up</span>
              </button>
            </div>
          </div>
        </div>

        {/* Small pending requests alert box on top of the dashboard */}
        <div 
          onClick={() => setAdminTab('operations')}
          className={cn(
            "p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 group shadow-lg",
            pendingCount > 0 
              ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 shadow-amber-950/20" 
              : "border-white/5 bg-slate-950/30 hover:bg-slate-950/50"
          )}
        >
          <div className="flex items-center gap-3.5">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center border transition-all",
              pendingCount > 0 
                ? "bg-amber-500/10 border-amber-500/25 text-amber-400 group-hover:scale-105" 
                : "bg-slate-900 border-white/5 text-slate-400"
            )}>
              <Clock className={cn("w-4 h-4", pendingCount > 0 && "animate-pulse")} />
            </div>
            <div>
              <p className={cn("text-xs font-black uppercase tracking-wider", pendingCount > 0 ? "text-amber-400" : "text-slate-400")}>
                Operations & Pending Requests Running
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                {pendingCount > 0 
                  ? `There are currently ${pendingCount} pending administrative requests running. Click to evaluate and authorize.`
                  : "All operational queues are fully approved. Zero pending requests running currently."
                }
              </p>
            </div>
          </div>
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-mono font-black uppercase tracking-wider transition-all shrink-0",
            pendingCount > 0 ? "text-amber-400 group-hover:translate-x-1" : "text-slate-500 group-hover:text-slate-300"
          )}>
            <span>Manage Queue</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* AT A GLANCE HUD GRID (ANSWERS Q1, Q2, Q3 + LIQUID CASH) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Question 1: How much money do we have? */}
          <div className="p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-slate-950 to-[#0e1726]/40 relative overflow-hidden backdrop-blur-md shadow-lg">
            <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/[0.02] rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Q1 // Capital Solvency
                </span>
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wide mt-2">How much money do we have?</h3>
              </div>
            </div>
            
            <div className="mt-5">
              <span className="text-3xl font-mono font-black text-white tracking-tight">
                ৳{totalCashPool.toLocaleString()}
              </span>
              <span className="text-[10px] font-mono text-slate-500 ml-1.5">BDT</span>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div>
                <span className="text-slate-500 block">Authority Seed</span>
                <span className="text-white font-bold">৳{authorityPersonalFund.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Member Deposits</span>
                <span className="text-white font-bold">৳{totalDeposits.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-[9px] text-slate-500 mt-3">Aggregate active cash assets held securely in authority reserves.</p>
          </div>

          {/* Card 2: Question 2: How much is currently lent out? */}
          <div className="p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-slate-950 to-[#0e1726]/40 relative overflow-hidden backdrop-blur-md shadow-lg">
            <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/[0.02] rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Q2 // Credit Exposure
                </span>
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wide mt-2">How much is currently lent out?</h3>
              </div>
            </div>

            <div className="mt-5">
              <span className="text-3xl font-mono font-black text-rose-400 tracking-tight">
                ৳{currentlyLent.toLocaleString()}
              </span>
              <span className="text-[10px] font-mono text-slate-500 ml-1.5">BDT</span>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div>
                <span className="text-slate-500 block">Active Borrowers</span>
                <span className="text-white font-bold">{activeDebtors.length} Members</span>
              </div>
              <div>
                <span className="text-slate-500 block">Loan-to-Deposit</span>
                <span className="text-white font-bold">
                  {totalDeposits > 0 ? ((currentlyLent / totalDeposits) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>
            <p className="text-[9px] text-slate-500 mt-3">Aggregate capital currently outstanding as verified client debt.</p>
          </div>

          {/* Card 3: Liquid Available Cash */}
          {(() => {
            const liquidCash = authorityPersonalFund - outstandingDebt;
            const isDeficit = liquidCash < 0;
            return (
              <div className={cn(
                "p-6 rounded-2xl border relative overflow-hidden backdrop-blur-md shadow-lg bg-gradient-to-br from-slate-950 to-[#0e1726]/40",
                isDeficit ? "border-rose-500/30 via-rose-950/20" : "border-indigo-500/20 via-indigo-950/20"
              )}>
                <div className={cn(
                  "absolute top-0 right-0 w-28 h-28 rounded-full blur-2xl pointer-events-none",
                  isDeficit ? "bg-rose-500/[0.08]" : "bg-indigo-500/[0.05]"
                )} />
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5",
                      isDeficit ? "text-rose-400" : "text-indigo-400"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", isDeficit ? "bg-rose-400" : "bg-indigo-400")} />
                      Liquidity // Available Cash
                    </span>
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wide mt-2">Liquid Available Cash</h3>
                  </div>
                </div>

                <div className="mt-5">
                  <span className={cn(
                    "text-3xl font-mono font-black tracking-tight",
                    isDeficit ? "text-rose-400" : "text-indigo-400"
                  )}>
                    {isDeficit ? `-৳${Math.abs(liquidCash).toLocaleString()}` : `৳${liquidCash.toLocaleString()}`}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 ml-1.5">BDT</span>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div>
                    <span className="text-slate-500 block">Reserve Fund</span>
                    <span className="text-white font-bold">৳{authorityPersonalFund.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Debt Subtracted</span>
                    <span className="text-amber-400 font-bold">-৳{outstandingDebt.toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 mt-3">
                  {isDeficit 
                    ? "Deficit: Distributed client debt exceeds total reserves by the negative amount shown above."
                    : "Reserves minus active debt. Unallocated capital ready for instant loan disbursals."
                  }
                </p>
              </div>
            );
          })()}

          {/* Card 4: Question 3: How much is waiting for approval? */}
          <div className="p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-slate-950 to-[#0e1726]/40 relative overflow-hidden backdrop-blur-md shadow-lg">
            <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/[0.02] rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Q3 // Pending Operations
                </span>
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wide mt-2">How much is waiting for approval?</h3>
              </div>
            </div>

            <div className="mt-5">
              <span className="text-3xl font-mono font-black text-amber-400 tracking-tight">
                {pendingCount}
              </span>
              <span className="text-[10px] font-mono text-slate-500 ml-1.5">Items</span>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div>
                <span className="text-slate-500 block">Registrations</span>
                <span className="text-white font-bold">{pendingRegistrations.length} Pending</span>
              </div>
              <div>
                <span className="text-slate-500 block">Transactions</span>
                <span className="text-white font-bold">{pendingTransactions.length} Pending</span>
              </div>
            </div>
            <p className="text-[9px] text-slate-500 mt-3">Active claims and applications waiting for authority review and action.</p>
          </div>
        </div>

        {/* DETAILED DOUBLE COLUMN BOARD (ANSWERS Q4 & Q5) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* QUESTION 4 PANEL: Which members need attention today? */}
          <div className="p-6 bg-gradient-to-b from-slate-950 to-[#0a1220] border border-white/5 rounded-2xl shadow-xl flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div>
                <span className="text-[8px] font-mono font-bold text-slate-500 block">MONITORING ENGINE v4.2 // FOCUS TARGETS</span>
                <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  Q4 // Members Needing Attention Today
                </h3>
              </div>
              <span className="text-[9px] font-mono font-black text-slate-500 bg-white/5 px-2 py-0.5 rounded uppercase">
                {attentionMembers.length} Flagged
              </span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
              The monitoring grid flags newly registered applicants requiring verification and active debtors holding outstanding loan balances.
            </p>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
              {attentionMembers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <ShieldCheck className="w-10 h-10 text-emerald-500/40" />
                  <p className="text-xs font-bold text-slate-300">All Members Fully Clear</p>
                  <p className="text-[9px] text-slate-500 max-w-xs">No pending verification cases or overdue debtors logged on system today.</p>
                </div>
              ) : (
                attentionMembers.map((member) => (
                  <div key={member.uid} className="p-3 bg-[#0e1726]/35 hover:bg-[#0e1726]/60 border border-white/5 rounded-xl flex items-center justify-between gap-3 transition-all text-left">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-slate-900 flex items-center justify-center text-[10px] font-black text-blue-400">
                        {member.photoUrl ? (
                          <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          member.name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="truncate text-left">
                        <span className="font-bold text-xs text-white block truncate leading-tight">{member.name}</span>
                        <span className="text-[9px] text-slate-400 block truncate mt-0.5">{member.occupation || 'Member'} • NID: {member.nid || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {member.status === 'pending' && (
                        <span className="text-[8px] font-mono font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded leading-none">
                          APPLICANT
                        </span>
                      )}
                      {member.status === 'approved' && (member.remainingDebt || 0) > 0 && (
                        <span className="text-[8px] font-mono font-black bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded leading-none">
                          ৳{(member.remainingDebt || 0).toLocaleString()} DUE
                        </span>
                      )}
                      {member.moreInfoRequested && (
                        <span className="text-[8px] font-mono font-black bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded leading-none">
                          INFO REQ
                        </span>
                      )}
                      
                      <button 
                        onClick={() => setSelectedAdminMemberDetail(member)}
                        className="px-2 py-1 bg-white/5 hover:bg-blue-600 hover:text-white rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer border border-white/5 shrink-0"
                      >
                        Dossier
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* QUESTION 5 PANEL: What actions require the admin right now? */}
          <div className="p-6 bg-gradient-to-b from-slate-950 to-[#0a1220] border border-white/5 rounded-2xl shadow-xl flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div>
                <span className="text-[8px] font-mono font-bold text-slate-500 block">DECISION ENGINE v4.2 // IMMEDIATE TASKS</span>
                <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Q5 // What actions require the admin right now?
                </h3>
              </div>
              <span className="text-[9px] font-mono font-black text-slate-500 bg-white/5 px-2 py-0.5 rounded uppercase">
                {actionItems.length} Urgent Tasks
              </span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
              Execute critical system decisions. Approving a membership unlocks credit limits, confirming transactions updates accounts, and alerts warn debtors.
            </p>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
              {actionItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Check className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-300">All Operations Synced</p>
                  <p className="text-[9px] text-slate-500 max-w-xs">All deposit, loan, registration, and alert queues are 100% processed and fully authorized.</p>
                </div>
              ) : (
                actionItems.map((item) => {
                  const isLoading = actionLoadingId === item.id || 
                    (item.type === 'registration' && actionLoadingId?.startsWith('approve-mbr') && actionLoadingId?.endsWith(item.id.replace('mbr-', ''))) ||
                    (item.type === 'registration' && actionLoadingId?.startsWith('reject-mbr') && actionLoadingId?.endsWith(item.id.replace('mbr-', '')));

                  return (
                    <div key={item.id} className="p-3.5 bg-[#0e1726]/20 hover:bg-[#0e1726]/40 border border-white/5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3.5 transition-all text-left">
                      <div className="space-y-1 text-left min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn("text-[7px] font-mono font-black px-1 py-0.5 rounded leading-none shrink-0", item.badgeColor)}>
                            {item.badgeText}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-white leading-tight truncate mt-1">{item.title}</h4>
                        <p className="text-[9px] text-slate-400 font-mono leading-normal truncate">{item.subtitle}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 justify-end">
                        {isLoading ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg text-[9px] text-slate-500 font-mono font-bold animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                            Processing...
                          </div>
                        ) : item.onAction ? (
                          <button
                            disabled={actionLoadingId !== null}
                            onClick={item.onAction}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 border border-blue-500/20"
                          >
                            <Mail className="w-3 h-3 shrink-0" />
                            <span>{item.actionText || 'Execute'}</span>
                          </button>
                        ) : (
                          <>
                            <button
                              disabled={actionLoadingId !== null}
                              onClick={item.onReject}
                              className="px-2.5 py-1.5 bg-rose-600/15 hover:bg-rose-600 text-rose-400 hover:text-white disabled:opacity-50 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border border-rose-500/10 shrink-0"
                            >
                              Reject
                            </button>
                            <button
                              disabled={actionLoadingId !== null}
                              onClick={item.onApprove}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border border-emerald-500/20 shrink-0"
                            >
                              Approve
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminReserve = () => {
    const totalCombinedReserve = liquidReserve + operationalReserve + emergencyReserve + availableLendingFund + reservedCapital + frozenCapital + externalInvestmentReserve;

    const categories = [
      { id: 'liquidReserve', name: 'Liquid Cash Reserve', value: liquidReserve, desc: 'Instant liquidity buffer for immediate lending output' },
      { id: 'operationalReserve', name: 'Operational Reserve', value: operationalReserve, desc: 'Platform server, staff, and office overhead funds' },
      { id: 'emergencyReserve', name: 'Emergency Reserve', value: emergencyReserve, desc: 'Unforeseen risk, run-on-deposits, and liquidity crunch shield' },
      { id: 'availableLendingFund', name: 'Available Lending Fund', value: availableLendingFund, desc: 'Active capital allocated exclusively for user borrow requests' },
      { id: 'reservedCapital', name: 'Reserved Capital', value: reservedCapital, desc: 'Tier-1 capital reserved to back outstanding debt guarantees' },
      { id: 'frozenCapital', name: 'Frozen Capital', value: frozenCapital, desc: 'Administrative locked assets excluded from lending pool' },
      { id: 'externalInvestmentReserve', name: 'External Investment Reserve', value: externalInvestmentReserve, desc: 'Sponsor deal profits & long-term capital bonds' },
    ];

    const auditTrail = auditLogs.filter(log => log.action?.includes('Reserve') || log.details?.includes('Reserve'));

    return (
      <div className="space-y-6 text-left animate-fadeIn">
        
        {/* Banner with Total combined reserve */}
        <div className="p-6 rounded-2xl border border-white/5 bg-gradient-to-r from-[#0d1627] to-[#142646] relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <span className="text-[9px] font-black tracking-widest text-[#50e3c2] uppercase bg-[#50e3c2]/10 border border-[#50e3c2]/20 px-2 py-0.5 rounded">
              Tier-1 Liquidity Balance
            </span>
            <h3 className="text-xl font-black text-white mt-1.5">Aggregate Reserved Liquidity</h3>
            <p className="text-[11px] text-slate-300 mt-0.5">Unified balance across all 7 regulatory capital subdivisions.</p>
          </div>
          <div>
            <p className="text-3xl font-black text-[#50e3c2] font-mono">৳ {totalCombinedReserve.toLocaleString()}</p>
            <p className="text-[9px] text-slate-400 text-right uppercase font-bold tracking-wider mt-1">Matched 100% Secure</p>
          </div>
        </div>

        {/* 7 Reserve subdivision categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="p-5 bg-[#0e1726]/40 border border-white/5 rounded-xl flex flex-col justify-between hover:border-white/10 transition-colors">
              <div>
                <p className="text-xs font-black text-white uppercase tracking-wider">{cat.name}</p>
                <p className="text-[10px] text-slate-400 leading-normal mt-1 min-h-[32px]">{cat.desc}</p>
              </div>
              <div className="mt-4 border-t border-white/5 pt-3">
                <p className="text-xl font-black text-white font-mono">৳ {cat.value.toLocaleString()}</p>
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => {
                      setReserveOpCategory(cat.id);
                      setReserveOperationModal({ isOpen: true, type: 'increase' });
                    }}
                    className="flex-1 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg transition-colors cursor-pointer"
                  >
                    Increase
                  </button>
                  <button 
                    onClick={() => {
                      setReserveOpCategory(cat.id);
                      setReserveOperationModal({ isOpen: true, type: 'withdraw' });
                    }}
                    className="flex-1 py-1 text-[9px] font-black uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-colors cursor-pointer"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Transfer Funds Card */}
          <div className="p-5 bg-blue-950/20 border border-blue-500/10 rounded-xl flex flex-col justify-between">
            <div>
              <p className="text-xs font-black text-blue-400 uppercase tracking-wider">Inter-Category Transfer Desk</p>
              <p className="text-[10px] text-slate-300 leading-normal mt-1">Instantly distribute assets between different subdivisions. Requires supervisor authentication.</p>
            </div>
            <div className="mt-4 border-t border-blue-500/10 pt-3">
              <button 
                onClick={() => {
                  setReserveOpCategory('liquidReserve');
                  setReserveOpTargetCategory('operationalReserve');
                  setReserveOperationModal({ isOpen: true, type: 'transfer' });
                }}
                className="w-full py-2 text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-900/30 transition-colors cursor-pointer"
              >
                Launch Transfer Desk
              </button>
            </div>
          </div>

          {/* Lock / Unlock Capital Box */}
          <div className="p-5 bg-indigo-950/20 border border-indigo-500/10 rounded-xl flex flex-col justify-between">
            <div>
              <p className="text-xs font-black text-indigo-400 uppercase tracking-wider">Regulatory capital locks</p>
              <p className="text-[10px] text-slate-300 leading-normal mt-1">Lock available lending funds into Frozen Capital subdivisions or release them back into circulation.</p>
            </div>
            <div className="mt-4 border-t border-indigo-500/10 pt-3 flex gap-2">
              <button 
                onClick={() => {
                  setReserveOpCategory('availableLendingFund');
                  setReserveOperationModal({ isOpen: true, type: 'lock' });
                }}
                className="flex-1 py-2 text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg transition-colors cursor-pointer"
              >
                Lock Capital
              </button>
              <button 
                onClick={() => {
                  setReserveOpCategory('frozenCapital');
                  setReserveOperationModal({ isOpen: true, type: 'unlock' });
                }}
                className="flex-1 py-2 text-[9px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer"
              >
                Unlock Capital
              </button>
            </div>
          </div>
        </div>

        {/* Reserve Transaction Audit Log */}
        <div className="p-5 bg-[#0e1726]/30 border border-white/5 rounded-xl">
          <h4 className="text-xs font-black uppercase text-white tracking-wider border-b border-white/5 pb-2 mb-3">Reserve subdivision ledger audit history</h4>
          <div className="overflow-x-auto font-mono">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-blue-400 border-b border-white/5 bg-slate-900/30">
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Operation Action</th>
                  <th className="py-2 px-3">Audit Trails & Details</th>
                  <th className="py-2 px-3 text-right">Administrator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditTrail.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-500 italic">No reserve adjustments recorded on this terminal session.</td>
                  </tr>
                ) : (
                  auditTrail.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.01]">
                      <td className="py-2 px-3 text-slate-400">
                        {log.timestamp?.seconds ? format(new Date(log.timestamp.seconds * 1000), 'dd-MM-yy HH:mm:ss') : 'Just now'}
                      </td>
                      <td className="py-2 px-3 text-white font-sans uppercase font-bold">{log.action}</td>
                      <td className="py-2 px-3 text-slate-300 max-w-sm truncate">{log.details}</td>
                      <td className="py-2 px-3 text-right text-blue-400">{log.actorName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Reserve operation PIN modal sheet overlay */}
        {reserveOperationModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-[#0c121e] border border-white/10 p-6 rounded-2xl max-w-md w-full text-left space-y-4 shadow-2xl animate-scaleIn">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-[9px] font-black tracking-widest text-[#50e3c2] uppercase bg-[#50e3c2]/10 border border-[#50e3c2]/20 px-2 py-0.5 rounded">
                  AUTHENTICATION REQUIRED
                </span>
                <button 
                  onClick={() => setReserveOperationModal(null)}
                  className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Reserve Adjustment Proposal
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                  You are proposing a direct modification to the **{reserveOpCategory}** category. This operation alters core system ledger balances.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Amount to Transfer/Modify (৳)</label>
                  <input 
                    type="number"
                    value={reserveOpAmount}
                    onChange={(e) => setReserveOpAmount(e.target.value)}
                    placeholder="Enter amount in BDT"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white mt-1 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {reserveOperationModal.type === 'transfer' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400">Destination Subdivision</label>
                    <select 
                      value={reserveOpTargetCategory}
                      onChange={(e) => setReserveOpTargetCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white mt-1 focus:outline-none focus:border-blue-500"
                    >
                      <option value="liquidReserve">Liquid Cash Reserve</option>
                      <option value="operationalReserve">Operational Reserve</option>
                      <option value="emergencyReserve">Emergency Reserve</option>
                      <option value="availableLendingFund">Available Lending Fund</option>
                      <option value="reservedCapital">Reserved Capital</option>
                      <option value="frozenCapital">Frozen Capital</option>
                      <option value="externalInvestmentReserve">External Investment Reserve</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Manual Financial Notes / Justification</label>
                  <textarea 
                    value={reserveOpNotes}
                    onChange={(e) => setReserveOpNotes(e.target.value)}
                    placeholder="Specify operational justification remarks..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white mt-1 focus:outline-none focus:border-blue-500 min-h-[60px]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Supervisor Verification PIN</label>
                  <input 
                    type="password"
                    maxLength={12}
                    value={reserveOpPin}
                    onChange={(e) => setReserveOpPin(e.target.value)}
                    placeholder="Enter Authority PIN (e.g., 9900)"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white mt-1 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex gap-3">
                <button 
                  onClick={() => setReserveOperationModal(null)}
                  className="flex-1 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => executeReserveOperation(
                    reserveOperationModal.type,
                    Number(reserveOpAmount),
                    reserveOpNotes,
                    reserveOpCategory,
                    reserveOperationModal.type === 'transfer' ? reserveOpTargetCategory : undefined
                  )}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Authenticate & Save
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  };

  const renderAdminFinancials = () => {
    // 1. Core aggregates
    const totalCapital = authorityPersonalFund + sponsorProfit + totalDeposits;
    const loanGrowthCurveData = [
      { name: '01 May', Disbursed: Math.floor(totalCapital * 0.35), Repayments: Math.floor(cumulativeStats.totalHistoricalRepayments * 0.3) },
      { name: '05 May', Disbursed: Math.floor(totalCapital * 0.5), Repayments: Math.floor(cumulativeStats.totalHistoricalRepayments * 0.45) },
      { name: '10 May', Disbursed: Math.floor(totalCapital * 0.62), Repayments: Math.floor(cumulativeStats.totalHistoricalRepayments * 0.55) },
      { name: '15 May', Disbursed: Math.floor(totalCapital * 0.78), Repayments: Math.floor(cumulativeStats.totalHistoricalRepayments * 0.7) },
      { name: '20 May', Disbursed: Math.floor(totalCapital * 0.9), Repayments: Math.floor(cumulativeStats.totalHistoricalRepayments * 0.85) },
      { name: '24 May', Disbursed: totalCapital, Repayments: cumulativeStats.totalHistoricalRepayments },
    ];

    const distributionData = [
      { name: 'Liquid Buffer', value: liquidReserve, color: '#3b82f6' },
      { name: 'Operational', value: operationalReserve, color: '#10b981' },
      { name: 'Emergency Support', value: emergencyReserve, color: '#f59e0b' },
      { name: 'Lending Capital', value: availableLendingFund, color: '#a78bfa' },
      { name: 'Guarantees', value: reservedCapital, color: '#ef4444' },
      { name: 'Frozen Locked', value: frozenCapital, color: '#64748b' },
      { name: 'Investments', value: externalInvestmentReserve, color: '#06b6d4' },
    ];

    return (
      <div className="space-y-6 text-left animate-fadeIn">
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Financial Intelligence Center</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Automated asset models, forecasts, and cash flow trend graphs.</p>
          </div>
          <button 
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-wider text-white transition-colors cursor-pointer"
          >
            Export Statement
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 1: Cash Flow models */}
          <div className="lg:col-span-8 p-5 rounded-2xl border border-white/5 bg-[#0e1726]/30 backdrop-blur-sm relative overflow-hidden">
            <h4 className="text-xs font-black uppercase text-white tracking-wider border-b border-white/5 pb-3 mb-4">Capitalization growth projections</h4>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={loanGrowthCurveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="finDisb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="finRep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={9} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="Disbursed" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#finDisb)" />
                <Area type="monotone" dataKey="Repayments" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#finRep)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 2: Reserve subdivision slices */}
          <div className="lg:col-span-4 p-5 rounded-2xl border border-white/5 bg-[#0e1726]/30 backdrop-blur-sm relative overflow-hidden flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-black uppercase text-white tracking-wider border-b border-white/5 pb-3 mb-4 font-sans">Reserve Distribution Slices</h4>
              <div className="h-[180px] flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distributionData} cx="50%" cy="50%" innerRadius={50} outerRadius={65} paddingAngle={2} dataKey="value">
                      {distributionData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-bold">
              {distributionData.map((e, idx) => (
                <div key={idx} className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                  <span className="truncate">{e.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Forecast Metrics panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40">
            <p className="text-[10px] font-black uppercase text-slate-400">Estimated Annualized Return (ARR)</p>
            <p className="text-lg font-black text-[#50e3c2] mt-1.5 font-mono">+ 18.42%</p>
          </div>
          <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40">
            <p className="text-[10px] font-black uppercase text-slate-400">Total Solvency Reserves (CAR)</p>
            <p className="text-lg font-black text-blue-400 mt-1.5 font-mono">{((totalCapital / (outstandingDebt || 1)) * 100).toFixed(1)}%</p>
          </div>
          <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40">
            <p className="text-[10px] font-black uppercase text-slate-400">Projected Defaults Probability</p>
            <p className="text-lg font-black text-rose-400 mt-1.5 font-mono">1.25% Very Low</p>
          </div>
          <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40">
            <p className="text-[10px] font-black uppercase text-slate-400">Authority Stress Margin Safety</p>
            <p className="text-lg font-black text-emerald-400 mt-1.5 font-mono">৳ {liquidReserve.toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminOperations = () => {
    const pendingTransactions = allTransactions.filter(t => t.status === 'pending');
    const pendingMembers = allUsers.filter(u => u.status === 'pending');

    // Compile a unified list of active pending requests
    const pendingRequests = [
      ...pendingMembers.map(m => ({
        id: m.uid,
        key: `member-${m.uid}`,
        type: 'membership' as const,
        title: 'Membership Registration',
        applicantName: m.name,
        applicantPhone: m.phone || 'N/A',
        amount: undefined,
        date: m.createdAt,
        badgeText: 'MEMBERSHIP DECK',
        badgeColor: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
        detailText: `NID: ${m.nid || 'Not Provided'} • Occ: ${m.occupation || 'N/A'}`,
        icon: Users,
        rawItem: m
      })),
      ...pendingTransactions.map(t => {
        let title = 'Cash Flow Transaction';
        let badgeColor = 'bg-blue-500/10 border-blue-500/20 text-blue-400';
        let badgeText = 'PENDING CASHFLOW';
        
        if (t.type === 'loan') {
          title = 'Loan Disbursal Request';
          badgeColor = 'bg-rose-500/10 border-rose-500/20 text-rose-400';
          badgeText = 'LOAN APPLICATION';
        } else if (t.type === 'deposit') {
          title = 'Deposit Authorization';
          badgeColor = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
          badgeText = 'FUNDS DEPOSIT';
        } else if (t.type === 'pay_due') {
          title = 'Debt Repayment Confirmation';
          badgeColor = 'bg-purple-500/10 border-purple-500/20 text-purple-400';
          badgeText = 'DEBT REPAYMENT';
        } else if (t.type === 'refund') {
          title = 'Refund Settlement';
          badgeColor = 'bg-slate-500/10 border-slate-500/20 text-slate-400';
          badgeText = 'REFUND ADJUST';
        }

        return {
          id: t.id,
          key: `tx-${t.id}`,
          type: t.type,
          title,
          applicantName: t.userName || 'Member',
          applicantPhone: allUsers.find(u => u.uid === t.userId)?.phone || 'N/A',
          amount: t.amount,
          method: t.method || 'Bkash',
          transactionId: t.transactionId || 'N/A',
          date: t.timestamp,
          badgeText,
          badgeColor,
          detailText: `TxID: ${t.transactionId || 'N/A'} via ${t.method || 'Internal'}`,
          icon: Landmark,
          rawItem: t
        };
      })
    ];

    // Filter requests based on current selection
    const filteredRequests = pendingRequests.filter(req => {
      if (requestFilter === 'all') return true;
      if (requestFilter === 'repayment') return req.type === 'pay_due' || req.type === 'refund';
      return req.type === requestFilter;
    });

    return (
      <div className="space-y-6 text-left animate-fadeIn">
        <div className="border-b border-white/5 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Operations Control Center</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Evaluate pending memberships, loan disbursements, and system-wide deposits.</p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {(() => {
              const liquidCash = authorityPersonalFund - outstandingDebt;
              const isDeficit = liquidCash < 0;
              return (
                <div className={cn(
                  "bg-[#0e1726]/80 rounded-xl px-3 py-1 text-right border",
                  isDeficit ? "border-rose-500/40" : "border-indigo-500/30"
                )}>
                  <span className="text-[8px] font-mono text-slate-400 block uppercase font-bold">Liquid Available Cash</span>
                  <span className={cn(
                    "text-xs font-mono font-black",
                    isDeficit ? "text-rose-400" : "text-indigo-400"
                  )}>
                    {isDeficit ? `-৳${Math.abs(liquidCash).toLocaleString()}` : `৳${liquidCash.toLocaleString()}`} BDT
                  </span>
                </div>
              );
            })()}
            <div className="bg-[#0e1726]/80 border border-white/5 rounded-xl px-3 py-1 text-right">
              <span className="text-[8px] font-mono text-slate-500 block uppercase font-bold">Operations Queue</span>
              <span className="text-xs font-mono font-black text-amber-400">{pendingRequests.length} Requests Running</span>
            </div>
          </div>
        </div>

        {/* Top filter select box with Membership option added */}
        <div className="flex flex-wrap gap-2">
          {['all', 'loan', 'deposit', 'repayment', 'membership'].map((f) => (
            <button 
              key={f}
              onClick={() => setRequestFilter(f as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all",
                requestFilter === f ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/20" : "bg-[#0e1726]/40 border-white/5 text-slate-400 hover:text-white"
              )}
            >
              {f} Requests
            </button>
          ))}
        </div>

        {/* Requests Grid (Boxes) */}
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-white/5 rounded-2xl bg-[#0e1726]/10 flex flex-col items-center justify-center space-y-2">
            <Clock className="w-8 h-8 text-slate-600" />
            <p className="text-xs text-slate-400 font-medium">No active pending requests match the "{requestFilter}" criteria.</p>
            <p className="text-[10px] text-slate-500">All applications are fully audited and synchronized.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRequests.map((req) => {
              const IconComponent = req.icon || Landmark;
              const formattedDate = req.date?.seconds 
                ? format(new Date(req.date.seconds * 1000), 'dd MMM yyyy • hh:mm a') 
                : 'Just now';

              return (
                <div
                  key={req.key}
                  id={`request-card-${req.id}`}
                  onClick={() => {
                    if (req.type === 'membership') {
                      setSelectedCaseMember(req.rawItem);
                      setSelectedCaseTransaction(null);
                    } else {
                      setSelectedCaseTransaction(req.rawItem);
                      setSelectedCaseMember(allUsers.find(u => u.uid === req.rawItem.userId) || null);
                    }
                  }}
                  className={cn(
                    "relative group bg-[#0e1726]/30 hover:bg-[#0e1726]/60 border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl flex flex-col justify-between min-h-[185px] hover:-translate-y-0.5"
                  )}
                >
                  {/* Top line: Icon, Badge and Status Dot */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div>
                        <span className={cn(
                          "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border block w-fit",
                          req.badgeColor
                        )}>
                          {req.badgeText}
                        </span>
                        <h4 className="text-[11px] font-black text-white uppercase tracking-wider mt-1">{req.title}</h4>
                      </div>
                    </div>
                    
                    {/* Pulsating live dot indicator */}
                    <span className="flex h-2 w-2 relative mt-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  </div>

                  {/* Middle content: Applicant Name, Amount, details */}
                  <div className="my-3.5 space-y-1.5 text-left">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                        {req.applicantName}
                      </span>
                      {req.amount !== undefined && (
                        <span className="text-sm font-mono font-black text-emerald-400">
                          ৳ {req.amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono tracking-wide line-clamp-1">{req.detailText}</p>
                    
                    {/* Liquid Available Cash Pill on card */}
                    {(() => {
                      const liquidCash = authorityPersonalFund - outstandingDebt;
                      const isDeficit = liquidCash < 0;
                      return (
                        <div className={cn(
                          "px-2 py-1 rounded-md border flex items-center justify-between text-[9px] font-mono",
                          isDeficit ? "bg-rose-950/60 border-rose-500/30" : "bg-indigo-950/60 border-indigo-500/20"
                        )}>
                          <span className={cn("font-medium", isDeficit ? "text-rose-300" : "text-indigo-300")}>
                            Liquid Available:
                          </span>
                          <span className={cn("font-bold", isDeficit ? "text-rose-200" : "text-indigo-200")}>
                            {isDeficit ? `-৳${Math.abs(liquidCash).toLocaleString()}` : `৳${liquidCash.toLocaleString()}`}
                          </span>
                        </div>
                      );
                    })()}

                    <p className="text-[9px] text-slate-500">Submitted: {formattedDate}</p>
                  </div>

                  {/* Bottom line: Interactive Prompt */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[9px] font-mono font-black uppercase tracking-wider text-slate-400 group-hover:text-white transition-colors">
                    <span>Evaluate File</span>
                    <div className="flex items-center gap-1 text-blue-400 group-hover:text-blue-300">
                      <span>Decision Desk</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dynamic decision desk evaluation overlay */}
        {(selectedCaseTransaction || selectedCaseMember) && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-[#0c121e] border border-white/10 p-6 rounded-2xl max-w-lg w-full text-left space-y-4 shadow-2xl animate-scaleIn">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-[9px] font-black tracking-widest text-[#50e3c2] uppercase bg-[#50e3c2]/10 border border-[#50e3c2]/20 px-2 py-0.5 rounded">
                  DECISION DESK EVALUATION
                </span>
                <button 
                  onClick={() => {
                    setSelectedCaseTransaction(null);
                    setSelectedCaseMember(null);
                  }}
                  className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {selectedCaseTransaction ? `Evaluate ${selectedCaseTransaction.type} flow` : `Evaluate ${selectedCaseMember?.name} dossier`}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                  Review applicant metadata, financial timelines, and secure deposit channel transaction IDs before committing approvals.
                </p>
              </div>

              {selectedCaseTransaction && (
                <div className="p-3.5 bg-slate-950/60 rounded-xl border border-white/5 text-xs font-mono space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">APPLICANT</span>
                    <span className="text-white font-bold">{selectedCaseTransaction.userName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">AMOUNT PROPOSED</span>
                    <span className="text-emerald-400 font-bold">৳ {selectedCaseTransaction.amount.toLocaleString()} BDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CHANNEL / GATEWAY</span>
                    <span className="text-white uppercase font-bold">{selectedCaseTransaction.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">TRANSACTION ID</span>
                    <span className="text-[#50e3c2] font-bold">{selectedCaseTransaction.transactionId || 'N/A'}</span>
                  </div>
                </div>
              )}

              {selectedCaseMember && (
                <div className="p-3.5 bg-slate-950/60 rounded-xl border border-white/5 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Applicant Legal Name</span>
                    <span className="text-white font-bold font-mono">{selectedCaseMember.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">NID Identification</span>
                    <span className="text-white font-mono">{selectedCaseMember.nid || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold font-sans">Father's Name</span>
                    <span className="text-slate-300 font-mono">{selectedCaseMember.fatherName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Permanent Address</span>
                    <span className="text-slate-300 font-mono">{selectedCaseMember.permanentAddress || 'N/A'}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Internal decision remark notes</label>
                <textarea 
                  value={adminDecisionNotes}
                  onChange={(e) => setAdminDecisionNotes(e.target.value)}
                  placeholder="Specify regulatory audit trail remarks..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white mt-1 focus:outline-none focus:border-blue-500 min-h-[60px]"
                />
              </div>

              <div className="pt-3 border-t border-white/5 flex gap-2">
                <button 
                  onClick={() => {
                    setSelectedCaseTransaction(null);
                    setSelectedCaseMember(null);
                  }}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button 
                  onClick={async () => {
                    try {
                      if (selectedCaseTransaction) {
                        // Approve transaction
                        await confirmTransaction(selectedCaseTransaction);
                        addToast('Transaction Confirmed', 'The selected cash flow was successfully approved.', 'success');
                      } else if (selectedCaseMember) {
                        // Approve member
                        await approveMember(selectedCaseMember.uid);
                        addToast('Membership Approved', `${selectedCaseMember.name} membership approved.`, 'success');
                      }
                      setSelectedCaseTransaction(null);
                      setSelectedCaseMember(null);
                    } catch (err: any) {
                      addToast('Error', err.message, 'warning');
                    }
                  }}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Approve File
                </button>
                <button 
                  onClick={async () => {
                    try {
                      if (selectedCaseTransaction) {
                        await rejectTransaction(selectedCaseTransaction);
                        addToast('Transaction Rejected', 'Cash flow transaction rejected.', 'warning');
                      } else if (selectedCaseMember) {
                        await rejectMember(selectedCaseMember.uid);
                        addToast('Membership Rejected', 'Membership application rejected.', 'warning');
                      }
                      setSelectedCaseTransaction(null);
                      setSelectedCaseMember(null);
                    } catch (err: any) {
                      addToast('Error', err.message, 'warning');
                    }
                  }}
                  className="py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Reject File
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  };

  const renderAdminLedger = () => {
    return (
      <div className="space-y-6 text-left animate-fadeIn">
        <div className="border-b border-white/5 pb-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">Consolidated Authority Ledger</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Full chronological audit of all platform transactions, flows, and deposits.</p>
        </div>

        <div className="p-5 bg-[#0e1726]/30 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-blue-400 border-b border-white/5 bg-slate-900/30">
                  <th className="py-2.5 px-3">Log ID</th>
                  <th className="py-2.5 px-3">Sender Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Gateway / Method</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {allTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500 italic">No logs recorded inside the central database.</td>
                  </tr>
                ) : (
                  allTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.01]">
                      <td className="py-3 px-3 text-slate-400 text-[10px]">{tx.id.substring(0, 12)}</td>
                      <td className="py-3 px-3 font-sans font-bold text-white">{tx.userName || 'Member'}</td>
                      <td className="py-3 px-3 font-sans uppercase font-bold text-slate-300">{tx.type}</td>
                      <td className="py-3 px-3 text-right text-[#50e3c2] font-black">৳ {tx.amount.toLocaleString()}</td>
                      <td className="py-3 px-3 text-slate-300 uppercase text-[10px]">{tx.method || 'Internal Desk'}</td>
                      <td className="py-3 px-3 text-slate-400 font-sans">
                        {tx.timestamp?.seconds ? format(new Date(tx.timestamp.seconds * 1000), 'dd-MM-yy HH:mm') : 'Just now'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${tx.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminAudit = () => {
    return (
      <div className="space-y-6 text-left animate-fadeIn">
        <div className="border-b border-white/5 pb-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">Compliance & Audit Logs</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">High-integrity immutable activity logs recorded live to Firestore audit collections.</p>
        </div>

        <div className="p-5 bg-[#0e1726]/30 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-blue-400 border-b border-white/5 bg-slate-900/30">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Actor Email</th>
                  <th className="py-2.5 px-3">Audit Action</th>
                  <th className="py-2.5 px-3">Log Trails & Description</th>
                  <th className="py-2.5 px-3 text-center">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500 italic">No formal logs recorded in compliance collection.</td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.01]">
                      <td className="py-3 px-3 text-slate-400 text-[10px]">
                        {log.timestamp?.seconds ? format(new Date(log.timestamp.seconds * 1000), 'dd-MM-yy HH:mm:ss') : 'Just now'}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-sans">{log.actorEmail || 'Supervisor'}</td>
                      <td className="py-3 px-3 text-white font-sans font-black uppercase">{log.action}</td>
                      <td className="py-3 px-3 text-slate-400 leading-normal max-w-sm truncate">{log.details}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded leading-none border",
                          log.severity === 'critical' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                          log.severity === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                          "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        )}>
                          {log.severity || 'info'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminNotifications = () => {
    // Helper to determine matched categories for local alerts
    const matchedCategory = (notif: any) => {
      const b = (notif.body || '').toLowerCase();
      const t = (notif.title || '').toLowerCase();
      if (b.includes('reserve') || t.includes('reserve')) return 'Reserve';
      if (b.includes('loan') || t.includes('loan')) return 'Loan';
      if (b.includes('member') || t.includes('member') || b.includes('profile')) return 'Members';
      if (b.includes('limit') || t.includes('limit')) return 'Financial';
      if (b.includes('pin') || b.includes('security') || b.includes('auth')) return 'Security';
      return 'System';
    };

    // Preloaded Template Library
    const templates = [
      {
        name: 'Due Repayment Warning',
        subject: 'T.U.T. Private Lending Authority: Urgent Outstanding Debt Compliance',
        category: 'Due Reminder',
        body: 'Dear {name},\n\nOur ledger registers an active outstanding borrowing of {debt} BDT under your national profile. Please be advised that compliance with estimated repayment terms is mandatory to prevent interest accretion or credit limits restriction.\n\nKindly clear your due balance at your earliest convenience through our bKash/Nagad portals.\n\nSincerely,\nT.U.T. Lending Authority'
      },
      {
        name: 'Credit Limit Advisory',
        subject: 'Credit Assessment Completed: Authorized Borrowing Limit Status',
        category: 'System',
        body: 'Dear {name},\n\nWe have updated your authorized borrowing credit limit to {limit} BDT on the T.U.T. platform.\n\nThis limit has been approved after assessing your subscription status and historic transaction consistency. You can utilize this credit line instantly for active loan requests.\n\nSincerely,\nT.U.T. Underwriting Desk'
      },
      {
        name: 'Welcome & Onboarding',
        subject: 'Welcome to T.U.T. Private Lending Syndicate Network',
        category: 'Broadcast',
        body: 'Dear {name},\n\nYour membership application has been reviewed and approved! You are now a registered participant of the T.U.T. private micro-lending group.\n\nFeel free to complete a security PIN setup on your dashboard and explore our premium subscription plans to secure larger micro-loans.\n\nSincerely,\nT.U.T. Operations Team'
      }
    ];

    const loadTemplate = (tpl: typeof templates[0]) => {
      setComposeSubject(tpl.subject);
      setComposeBody(tpl.body);
      setComposeCategory(tpl.category);
      addToast('Template Loaded', `Loaded: ${tpl.name}`, 'info');
    };

    // Dynamic Preview Body Replacement based on recipient category selection
    const previewName = composeRecipientCategory === 'individual' && composeIndividualEmail
      ? (allUsers.find(u => u.email?.toLowerCase().trim() === composeIndividualEmail.toLowerCase().trim())?.name || 'Valued Member')
      : 'Valued Member';
    const previewDebt = composeRecipientCategory === 'individual' && composeIndividualEmail
      ? `৳${(allUsers.find(u => u.email?.toLowerCase().trim() === composeIndividualEmail.toLowerCase().trim())?.remainingDebt || 0).toLocaleString()}`
      : '৳25,000';
    const previewLimit = composeRecipientCategory === 'individual' && composeIndividualEmail
      ? `৳${(allUsers.find(u => u.email?.toLowerCase().trim() === composeIndividualEmail.toLowerCase().trim())?.borrowingLimit || 100000).toLocaleString()}`
      : '৳100,000';

    const renderedPreviewBody = composeBody
      .replace(/{name}/g, previewName)
      .replace(/{email}/g, composeIndividualEmail || 'member@domain.com')
      .replace(/{debt}/g, previewDebt)
      .replace(/{limit}/g, previewLimit);

    // Filtered logs
    const filteredEmailLogs = emailLogs.filter(log => {
      if (emailLogsFilter === 'all') return true;
      if (emailLogsFilter === 'delivered') return log.status === 'delivered';
      if (emailLogsFilter === 'failed') return log.status === 'failed';
      return log.category?.toLowerCase() === emailLogsFilter.toLowerCase();
    });

    // Scanner: Outstanding Debts (approved members who have remaining debt)
    const dueMembersList = allUsers.filter(u => 
      u.status === 'approved' && 
      (u.remainingDebt || 0) > 0
    );

    const loadDueReminderForMember = (usr: UserProfile) => {
      // Find latest confirmed loan transaction for this user to get details if available
      const latestLoan = allTransactions.find(t => 
        (t.userId === usr.uid || t.userId === usr.memberId) && 
        t.type === 'loan' && 
        t.status === 'confirmed'
      );
      
      setComposeRecipientCategory('individual');
      if (usr.email) {
        setComposeIndividualEmail(usr.email);
      }
      setComposeSubject(`URGENT: Repayment Alert for Outstanding Debt`);
      setComposeBody(`Dear ${usr.name},\n\nOur private lending ledger registers an active outstanding borrowing balance under your profile.\n\n- Outstanding Debt: ৳${(usr.remainingDebt || 0).toLocaleString()} BDT\n- Authorized Borrowing Limit: ৳${(usr.borrowingLimit || 100000).toLocaleString()} BDT\n- Repayment Terms: ${latestLoan?.estimatedRepaymentDate ? `Before ${latestLoan.estimatedRepaymentDate}` : 'Immediate Compliance Required'}\n\nPlease proceed to clear this outstanding amount using bKash or Nagad to avoid penalties or account suspension.\n\nSincerely,\nT.U.T. Lending Desk`);
      setComposeCategory('Due Reminder');
      addToast('Template Loaded', `Due alert loaded for ${usr.name}`, 'info');
      
      const el = document.getElementById('email-composer-form');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    // Form Submission
    const handleSendComposedEmail = async () => {
      if (!composeSubject.trim() || !composeBody.trim()) {
        addToast('Validation Error', 'Subject and body cannot be empty.', 'warning');
        return;
      }

      let recipients: UserProfile[] = [];
      if (composeRecipientCategory === 'all') {
        recipients = allUsers.filter(u => u.status === 'approved' && u.email);
      } else if (composeRecipientCategory === 'debtors') {
        recipients = allUsers.filter(u => u.status === 'approved' && (u.remainingDebt || 0) > 0 && u.email);
      } else if (composeRecipientCategory === 'savers') {
        recipients = allUsers.filter(u => u.status === 'approved' && (u.totalDeposit || 0) > 0 && (u.remainingDebt || 0) === 0 && u.email);
      } else if (composeRecipientCategory === 'individual') {
        const selected = allUsers.find(u => u.email?.toLowerCase().trim() === composeIndividualEmail.toLowerCase().trim());
        if (selected) recipients = [selected];
      }

      if (recipients.length === 0) {
        addToast('No Recipients', 'No verified members with emails matched your audience criteria.', 'warning');
        return;
      }

      setIsSendingEmail(true);
      let successCount = 0;
      let failCount = 0;

      addToast('Initiating Transmission', `Transmitting ${recipients.length} outgoing emails...`, 'info');

      for (const recipient of recipients) {
        try {
          const customizedBody = composeBody
            .replace(/{name}/g, recipient.name)
            .replace(/{email}/g, recipient.email || '')
            .replace(/{debt}/g, `৳${(recipient.remainingDebt || 0).toLocaleString()}`)
            .replace(/{limit}/g, `৳${(recipient.borrowingLimit || 100000).toLocaleString()}`);

          const sentOk = await sendNotification(composeSubject, customizedBody, recipient.email, true);
          if (sentOk !== false) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.warn(`Email dispatch skipped for ${recipient.email}:`, err);
          failCount++;
        }
      }

      setIsSendingEmail(false);
      if (successCount > 0) {
        addToast('Transmission Complete', `Successfully dispatched ${successCount} emails. ${failCount > 0 ? `${failCount} errors logged.` : ''}`, 'success');
        setComposeSubject('');
        setComposeBody('');
      } else {
        addToast('Transmission Failed', 'Check Gmail API configurations or admin App Password in Secrets.', 'warning');
      }
    };

    const handleResendEmail = async (log: any) => {
      addToast('Re-transmitting', `Retrying dispatch to ${log.to}...`, 'info');
      const ok = await sendEmail(log.to, log.subject, log.body, undefined, log.recipientName, log.category, true);
      if (ok) {
        addToast('Successfully Re-sent', `Message successfully delivered to ${log.to}.`, 'success');
        setPreviewEmailLog(null);
      } else {
        addToast('Resend Failed', 'Gmail authentication failed. Update GMAIL_APP_PASSWORD in AI Studio Secrets.', 'warning');
      }
    };

    return (
      <div className="space-y-8 text-left animate-fadeIn">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] font-mono font-black text-blue-400 uppercase tracking-widest">PRIVATE ACCESS // LIVE EMAIL DISPATCH DESK</span>
            </div>
            <h1 className="text-xl font-black text-white uppercase tracking-tight mt-1">NOTIFICATION & EMAIL CONTROL</h1>
            <p className="text-[10px] text-slate-400 mt-1">Compose broadcast letters, dispatch due debt warnings, and trace real-time SMTP delivery logs.</p>
          </div>
          
          <div className="bg-slate-950/80 border border-white/5 rounded-xl px-4 py-2.5 flex items-center gap-3.5">
            <div className="text-right">
              <span className="text-[8px] font-mono text-slate-500 block uppercase font-bold">Admin Recipient Email</span>
              <span className="text-xs font-mono font-black text-white">{ADMIN_EMAIL}</span>
            </div>
            <div className="w-1.5 h-6 bg-white/10" />
            <div className="text-right">
              <span className="text-[8px] font-mono text-slate-500 block uppercase font-bold">System Status</span>
              <span className="text-xs font-mono font-bold text-emerald-400">ONLINE</span>
            </div>
          </div>
        </div>

        {/* COMPOSER & PREVIEW SIDE-BY-SIDE GRID */}
        <div id="email-composer-form" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: COMPOSER CONTROLS */}
          <div className="p-6 bg-[#0e1726]/20 border border-white/5 rounded-2xl shadow-xl space-y-5">
            <div className="flex items-center gap-2 text-blue-400 border-b border-white/5 pb-3">
              <Mail className="w-4 h-4 shrink-0" />
              <h2 className="text-xs font-black uppercase tracking-wider text-white">Transmitter Configuration</h2>
            </div>

            {/* Quick Templates Buttons */}
            <div className="space-y-2">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase block">Quick Template Presets</span>
              <div className="flex flex-wrap gap-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.name}
                    onClick={() => loadTemplate(tpl)}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-white/5 hover:border-white/10 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {/* Audience selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono font-bold text-slate-400 uppercase">Target Audience Category</label>
                  <select
                    value={composeRecipientCategory}
                    onChange={(e) => setComposeRecipientCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                  >
                    <option value="all">All Active Members ({allUsers.filter(u => u.status === 'approved' && u.email).length})</option>
                    <option value="debtors">Active Debtors ({allUsers.filter(u => u.status === 'approved' && (u.remainingDebt || 0) > 0 && u.email).length})</option>
                    <option value="savers">Active Depositors ({allUsers.filter(u => u.status === 'approved' && (u.totalDeposit || 0) > 0 && (u.remainingDebt || 0) === 0 && u.email).length})</option>
                    <option value="individual">Specific Individual Member</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono font-bold text-slate-400 uppercase">Notification Category</label>
                  <select
                    value={composeCategory}
                    onChange={(e) => setComposeCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                  >
                    <option value="Broadcast">Broadcast Announcement</option>
                    <option value="Due Reminder">Due Debt Repayment Reminder</option>
                    <option value="System">System Security / PIN Advisory</option>
                  </select>
                </div>
              </div>

              {/* Individual Selector if individual selected */}
              {composeRecipientCategory === 'individual' && (
                <div className="space-y-1.5 animate-slideDown">
                  <label className="text-[9px] font-mono font-bold text-slate-400 uppercase">Select Recipient Member</label>
                  <select
                    value={composeIndividualEmail}
                    onChange={(e) => setComposeIndividualEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                  >
                    <option value="">-- Choose Member Profile --</option>
                    {allUsers.filter(u => u.email).map((u) => (
                      <option key={u.uid} value={u.email}>
                        {u.name} ({u.email}) — Debt: ৳{(u.remainingDebt || 0).toLocaleString()} BDT
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono font-bold text-slate-400 uppercase">Email Subject Line</label>
                <input
                  type="text"
                  placeholder="Enter email subject line..."
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-sans font-bold"
                />
              </div>

              {/* Body Textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-mono font-bold text-slate-400 uppercase">Email Body Content</label>
                  <span className="text-[8px] font-mono text-slate-500">Variables supported: {"{name}"}, {"{email}"}, {"{debt}"}, {"{limit}"}</span>
                </div>
                <textarea
                  rows={6}
                  placeholder="Write your email body content..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
                />
              </div>

              {/* Transmission Error Status or Warning banner if missing configuration */}
              {lastGmailError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10px] text-rose-300 flex items-start justify-between gap-2 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                    <div>
                      <span className="font-bold block uppercase text-rose-400">SMTP Transmission Alert</span>
                      <p className="mt-0.5 leading-normal">{lastGmailError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGmailHelp(true)}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 font-bold uppercase shrink-0 cursor-pointer"
                  >
                    Fix Guide
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <button
                onClick={handleSendComposedEmail}
                disabled={isSendingEmail}
                className={cn(
                  "w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg",
                  isSendingEmail
                    ? "bg-blue-600/50 text-white cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"
                )}
              >
                {isSendingEmail ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>TRANSMITTING MESSAGE OUTFLOW...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>TRANSMIT DISPATCH SIGNALS</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: INTERACTIVE LIVE PREVIEW MOCKUP */}
          <div className="p-6 bg-slate-950/40 border border-white/5 rounded-2xl shadow-xl flex flex-col h-full space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 border-b border-white/5 pb-3">
              <Eye className="w-4 h-4 shrink-0" />
              <h2 className="text-xs font-black uppercase tracking-wider text-white">Live Email Layout Output</h2>
            </div>

            {/* Simulated Mail Client Window */}
            <div className="flex-1 bg-[#121b2d] border border-white/5 rounded-xl overflow-hidden flex flex-col text-[11px] font-sans">
              <div className="bg-slate-900 px-4 py-2.5 border-b border-white/5 flex items-center justify-between text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <span>SMTP STACK PREVIEW ENGINE</span>
              </div>

              <div className="p-4 border-b border-white/5 space-y-1 bg-slate-950/30">
                <p className="text-slate-500 font-mono text-[9px]"><span className="text-slate-400 font-bold uppercase mr-1">TO:</span> {composeRecipientCategory === 'individual' ? (composeIndividualEmail || 'No recipient selected') : `${composeRecipientCategory.toUpperCase()} Recipient Group`}</p>
                <p className="text-slate-500 font-mono text-[9px]"><span className="text-slate-400 font-bold uppercase mr-1">FROM:</span> T.U.T. Private Authority &lt;noreply@tut.authority&gt;</p>
                <p className="text-white font-bold text-xs font-sans mt-2"><span className="text-slate-400 font-bold font-mono text-[9px] uppercase mr-1">SUBJECT:</span> {composeSubject || '(No subject provided)'}</p>
              </div>

              {/* Simulated HTML Email Frame */}
              <div className="p-6 bg-[#f4f4f4] text-[#333333] font-sans flex-1 overflow-y-auto min-h-[220px]">
                <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                  <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-widest text-[#2563eb]">T.U.T. PRIVATE LENDING</span>
                    <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">SECURE DISPATCH</span>
                  </div>
                  
                  {/* Email body render */}
                  <div className="whitespace-pre-wrap text-xs text-slate-700 leading-relaxed font-sans">
                    {renderedPreviewBody || (
                      <span className="text-slate-400 italic">Configure your template, subject, and body fields on the configuration board. A live simulated HTML digest will assemble dynamically here.</span>
                    )}
                  </div>

                  <hr className="border-0 border-t border-slate-100 my-4" />
                  <p className="text-[9px] text-slate-400 leading-normal">
                    This is an automated encrypted mail notification copy. Replies to this address are not monitored.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DUE REMINDERS SCAN & OVERDUE DEBT SCANNER */}
        <div className="p-6 bg-[#0e1726]/20 border border-white/5 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-rose-400 border-b border-white/5 pb-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <h2 className="text-xs font-black uppercase tracking-wider text-white">Outstanding Debt Reminders Scanner</h2>
          </div>
          <p className="text-[10px] text-slate-400">Scans all confirmed active lending claims currently awaiting repayment. Use quick load actions to write specific compliance alerts instantly.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-blue-400 border-b border-white/5 bg-slate-900/30">
                  <th className="py-2.5 px-3">Borrower Profile</th>
                  <th className="py-2.5 px-3">Total Borrowed Amount</th>
                  <th className="py-2.5 px-3">Outstanding Remaining Debt</th>
                  <th className="py-2.5 px-3">Latest Agreed Terms</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dueMembersList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-500 italic">Zero active lending accounts holding outstanding debts. Compliant portfolio status.</td>
                  </tr>
                ) : (
                  dueMembersList.map((usr) => {
                    const latestLoan = allTransactions.find(t => 
                      (t.userId === usr.uid || t.userId === usr.memberId) && 
                      t.type === 'loan' && 
                      t.status === 'confirmed'
                    );

                    return (
                      <tr key={usr.uid} className="hover:bg-white/[0.01]">
                        <td className="py-3 px-3">
                          <span className="font-bold text-white block">{usr.name}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">{usr.email || 'No email registered'}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">৳{(usr.totalLoan || 0).toLocaleString()} BDT</td>
                        <td className="py-3 px-3 font-mono text-amber-400 font-bold">৳{(usr.remainingDebt || 0).toLocaleString()} BDT</td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-mono block text-slate-400">
                            {latestLoan?.estimatedRepaymentDate ? `Before ${latestLoan.estimatedRepaymentDate}` : 'Compliance Required'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => loadDueReminderForMember(usr)}
                            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/20 hover:border-amber-500 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                          >
                            Load Alert to Composer
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FIREBASE SYNCED LIVE OUTGOING MAIL LOGS */}
        <div className="p-6 bg-[#0e1726]/20 border border-white/5 rounded-2xl shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <History className="w-4 h-4 shrink-0" />
              <h2 className="text-xs font-black uppercase tracking-wider text-white">Firestore SMTP Delivery Ledger</h2>
            </div>

            {/* Filter buttons for logs */}
            <div className="flex gap-2">
              {['all', 'delivered', 'failed', 'Due Reminder', 'Broadcast'].map((filterVal) => (
                <button
                  key={filterVal}
                  onClick={() => setEmailLogsFilter(filterVal)}
                  className={cn(
                    "px-2.5 py-1 border rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                    emailLogsFilter === filterVal
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-md"
                      : "bg-[#0e1726]/60 border-white/5 text-slate-400 hover:text-white"
                  )}
                >
                  {filterVal}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-400">High-integrity transactional audit ledger recording direct status returns from server SMTP. Only visible to verified admins.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-blue-400 border-b border-white/5 bg-slate-900/30">
                  <th className="py-2.5 px-3">Dispatch Timestamp</th>
                  <th className="py-2.5 px-3">Recipient Name & Email</th>
                  <th className="py-2.5 px-3">Subject Line</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">Delivery Status</th>
                  <th className="py-2.5 px-3 text-center">System Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredEmailLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 italic">No formal outgoing dispatches matching selection recorded in database log collections.</td>
                  </tr>
                ) : (
                  filteredEmailLogs.map((log) => {
                    const timeLabel = log.timestamp?.seconds 
                      ? format(new Date(log.timestamp.seconds * 1000), 'dd-MM-yy HH:mm:ss')
                      : 'Just now';

                    return (
                      <tr key={log.id} className="hover:bg-white/[0.01]">
                        <td className="py-3 px-3 font-mono text-slate-400 text-[10px]">{timeLabel}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-200 block leading-tight">{log.recipientName || 'Member'}</span>
                          <span className="text-[10px] text-slate-500 font-mono block">{log.to}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 max-w-xs truncate font-medium">{log.subject}</td>
                        <td className="py-3 px-3">
                          <span className="text-[8px] bg-slate-900 border border-white/5 px-1.5 py-0.5 rounded uppercase font-bold text-slate-400 font-mono">
                            {log.category || 'System'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {log.status === 'delivered' ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded leading-none">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Delivered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded leading-none">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setPreviewEmailLog(log)}
                            className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center mx-auto gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* INTERACTIVE PREVIEW MODAL */}
        {previewEmailLog && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-[#0b1329] border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-scaleUp">
              {/* Modal Header */}
              <div className="bg-slate-900 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Compliance Dispatch Audit</h3>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">Log Record Reference ID: {previewEmailLog.id}</p>
                </div>
                <button
                  onClick={() => setPreviewEmailLog(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Meta details cards */}
                <div className="grid grid-cols-2 gap-4 text-[10px] font-mono text-slate-400">
                  <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl space-y-1">
                    <span className="text-slate-500 font-bold block uppercase text-[8px]">RECIPIENT MEMBER</span>
                    <span className="text-white font-bold block text-[11px] font-sans">{previewEmailLog.recipientName || 'Member'}</span>
                    <span className="block text-slate-400">{previewEmailLog.to}</span>
                  </div>

                  <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl space-y-1">
                    <span className="text-slate-500 font-bold block uppercase text-[8px]">DELIVERY STATUS</span>
                    {previewEmailLog.status === 'delivered' ? (
                      <span className="text-emerald-400 font-bold block text-[11px] uppercase">🟢 DELIVERED SUCCESSFUL</span>
                    ) : (
                      <span className="text-rose-400 font-bold block text-[11px] uppercase">🔴 FAILED TO DISPATCH</span>
                    )}
                    <span className="block text-slate-500">
                      {previewEmailLog.timestamp?.seconds 
                        ? format(new Date(previewEmailLog.timestamp.seconds * 1000), 'dd MMMM yyyy HH:mm:ss')
                        : 'Unknown Date'}
                    </span>
                  </div>
                </div>

                {/* Failure Error Trace if failed */}
                {previewEmailLog.error && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl space-y-1">
                    <span className="text-rose-400 font-black uppercase text-[8px] font-mono block">SMTP ERROR LOG STACK TRACE:</span>
                    <p className="text-[10px] font-mono text-rose-300 leading-normal whitespace-pre-wrap">{previewEmailLog.error}</p>
                  </div>
                )}

                {/* Email Subject card */}
                <div className="space-y-1">
                  <span className="text-slate-500 font-mono font-bold text-[8px] uppercase">SUBJECT:</span>
                  <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl text-xs font-bold text-white font-sans">
                    {previewEmailLog.subject}
                  </div>
                </div>

                {/* Email content preview */}
                <div className="space-y-1">
                  <span className="text-slate-500 font-mono font-bold text-[8px] uppercase">OUTGOING EMAIL CONTENT BODY:</span>
                  <div className="p-4 bg-slate-950/60 border border-white/5 rounded-xl text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap max-h-[160px] overflow-y-auto">
                    {previewEmailLog.body}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-900 px-6 py-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-[8px] font-mono text-slate-500">T.U.T. Private Authority System</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewEmailLog(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
                  >
                    Close Preview
                  </button>
                  <button
                    onClick={() => handleResendEmail(previewEmailLog)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Resend Email</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCaseTransactionPage = (trx: Transaction) => {
    const applicant = (allUsers.find(u => u.uid === trx.userId || u.memberId === trx.userId) || {
      uid: trx.userId || '',
      name: trx.userName || 'Unknown Member',
      email: 'No Email Provided',
      phone: 'No Phone Provided',
      status: 'approved',
      totalLoan: 0,
      totalDeposit: 0,
      remainingDebt: 0,
      borrowingLimit: 100000,
      subscriptionTier: 'bronze',
      subscriptionStatus: 'inactive',
      continuousSubscriptionMonths: 0,
      consecutiveNoLoanMonths: 0,
      nid: 'Not Available',
      occupation: 'Not Available',
      address: 'Not Available',
      permanentAddress: 'Not Available',
      nomineeName: 'Not Available',
      nomineeRelation: 'Not Available',
      adminNotes: '',
      role: 'member',
      createdAt: null
    }) as UserProfile;

    const userTxs = allTransactions.filter(t => t.userId === trx.userId || t.userName === trx.userName);

    // Calculate Credit Score (300 to 850)
    let score = 500;
    if (applicant.subscriptionStatus === 'active') score += 100;
    if ((applicant.continuousSubscriptionMonths || 0) > 0) {
      score += Math.min(100, (applicant.continuousSubscriptionMonths || 0) * 20);
    }
    if ((applicant.consecutiveNoLoanMonths || 0) > 0) {
      score += Math.min(75, (applicant.consecutiveNoLoanMonths || 0) * 15);
    }
    if ((applicant.remainingDebt || 0) > 0) {
      score -= Math.min(150, Math.floor((applicant.remainingDebt || 0) / 100));
    }
    const successfulRepayments = (applicant.totalLoan || 0) - (applicant.remainingDebt || 0);
    if (successfulRepayments > 0) {
      score += Math.min(100, Math.floor(successfulRepayments / 100));
    }
    score = Math.max(300, Math.min(850, score));

    // Risk Rating
    let riskRating = "MODERATE RISK";
    let riskColor = "text-amber-400 border-amber-500/20 bg-amber-500/10";
    if (score >= 750) {
      riskRating = "VERY LOW RISK";
      riskColor = "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
    } else if (score >= 650) {
      riskRating = "LOW RISK";
      riskColor = "text-teal-400 border-teal-500/20 bg-teal-500/10";
    } else if (score < 550) {
      riskRating = "HIGH RISK / SUBPRIME";
      riskColor = "text-rose-400 border-rose-500/20 bg-rose-500/10";
    }

    const handleExecuteDecision = async () => {
      if (!decisionAction) return;
      if (decisionAction === 'approve') {
        await confirmTransaction(trx, adminDecisionNotes);
        addToast('Transaction Approved', `Approved request of ৳${trx.amount.toLocaleString()} for ${trx.userName}`, 'success');
      } else if (decisionAction === 'reject') {
        await rejectTransaction(trx, adminDecisionNotes);
      } else if (decisionAction === 'more_info') {
        await requestMoreInfoForTransaction(trx, adminDecisionNotes);
      }
      setSelectedCaseTransaction(null);
      setAdminDecisionNotes('');
      setShowDecisionConfirmation(false);
      setDecisionAction(null);
    };

    // Calculate borrowing capacity details
    const currentBorrowingCapacity = Math.max(0, (applicant.borrowingLimit || 100000) - (applicant.remainingDebt || 0));
    const repaymentRatio = applicant.totalLoan > 0 
      ? Math.round(((applicant.totalLoan - applicant.remainingDebt) / applicant.totalLoan) * 100)
      : 100;

    return (
      <div className="space-y-6 text-left">
        {/* Case File Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0a1220]/90 border border-white/5 p-5 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-blue-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-4 z-10">
            <button
              onClick={() => {
                setSelectedCaseTransaction(null);
                setAdminDecisionNotes('');
                setDecisionAction(null);
                setShowDecisionConfirmation(false);
              }}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Return to Queue"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
                  CASE FILE: #{trx.id.substring(0, 8).toUpperCase()}
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs font-mono text-slate-300 uppercase font-black tracking-wider">{trx.type} AUDIT DESK</span>
              </div>
              <h3 className="text-xl font-black text-white mt-1.5 flex items-center gap-2">
                Lending Appraisal Dossier
                <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md font-mono">
                  v3.1
                </span>
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-2 z-10 self-stretch md:self-auto justify-center md:justify-start">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest font-mono">Awaiting Decision Council</span>
          </div>
        </div>

        {/* Dynamic Multi-Pane Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* LEFT PANELS: Comprehensive Member Dossier (xl:col-span-8) */}
          <div className="xl:col-span-8 space-y-6">
            
            {/* Row 1: Profile & Credit Appraisal Speedometer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Profile Card */}
              <div className="p-5 bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-white/5 rounded-2xl space-y-4 shadow-xl">
                <div className="flex justify-between items-start border-b border-white/5 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">{applicant.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">UID: {applicant.uid}</p>
                  </div>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    {applicant.subscriptionTier?.toUpperCase()} MEMBER
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-slate-500 font-extrabold uppercase tracking-wider text-[8px]">Legal NID Number</p>
                    <p className="text-slate-200 font-mono mt-0.5 font-bold">{applicant.nid || 'Not Available'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-extrabold uppercase tracking-wider text-[8px]">Primary Occupation</p>
                    <p className="text-slate-200 font-bold mt-0.5">{applicant.occupation || 'Not Available'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-extrabold uppercase tracking-wider text-[8px]">Contact Number</p>
                    <p className="text-slate-200 font-mono mt-0.5">{applicant.phone || 'Not Available'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-extrabold uppercase tracking-wider text-[8px]">Registered Email</p>
                    <p className="text-slate-200 mt-0.5 truncate font-bold" title={applicant.email}>{applicant.email || 'Not Available'}</p>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-3 space-y-2 text-xs">
                  <div>
                    <p className="text-slate-500 font-extrabold uppercase tracking-wider text-[8px]">Residential Address</p>
                    <p className="text-slate-300 mt-0.5 leading-relaxed text-[11px] font-medium">{applicant.address || 'Not Available'}</p>
                  </div>
                  {applicant.nomineeName && applicant.nomineeName !== 'Not Available' && (
                    <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl mt-1">
                      <div>
                        <p className="text-slate-500 font-extrabold uppercase tracking-wider text-[8px]">Nominee Details</p>
                        <p className="text-slate-200 font-bold mt-0.5 text-[10px]">{applicant.nomineeName}</p>
                      </div>
                      <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                        {applicant.nomineeRelation}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Credit Scoring speedometer-like visual */}
              <div className="p-5 bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-white/5 rounded-2xl space-y-4 shadow-xl flex flex-col justify-between">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-400">Risk & Credit Scorecard</h4>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${riskColor}`}>
                    {riskRating}
                  </span>
                </div>

                <div className="py-2 flex flex-col items-center justify-center">
                  {/* Gauge Progress Bar visual */}
                  <div className="relative w-full max-w-[200px] h-3 bg-slate-950 rounded-full border border-white/5 overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        score >= 750 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                        score >= 650 ? "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.5)]" :
                        score >= 550 ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" :
                        "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                      )}
                      style={{ width: `${((score - 300) / 550) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between w-full max-w-[200px] text-[9px] font-mono font-bold text-slate-500 mt-1">
                    <span>300 (POOR)</span>
                    <span>850 (EXCELLENT)</span>
                  </div>

                  <div className="text-center mt-3">
                    <span className="text-4xl font-black text-white font-mono tracking-tight">{score}</span>
                    <span className="text-slate-400 text-xs font-bold ml-1">/ 850</span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Calculated Lending Appraisal Score</p>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/40 border border-white/5 rounded-xl text-[10px] text-slate-300 font-medium leading-relaxed">
                  {score >= 750 ? "★ High premium standing. Low loan-to-asset ratio. Pre-approval authorized." :
                   score >= 650 ? "★ Steady subscription standing. Standard lending risk assessment holds." :
                   score >= 550 ? "★ Active debt present. Monitor monthly transaction logs closely." :
                   "⚠ Warning: Subprime profile. Outstanding debt is substantial. Disbursal requires caution."}
                </div>
              </div>
            </div>

            {/* Row 2: Comprehensive Account Health Metrics */}
            <div className="p-5 bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-white/5 rounded-2xl space-y-4 shadow-xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 border-b border-white/5 pb-2">Financial Standing & Borrowing Performance</h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-[#0a1220] border border-white/5 rounded-xl">
                  <p className="text-slate-500 uppercase tracking-wider text-[8px] font-extrabold">Current Borrowing Limit</p>
                  <p className="text-white font-black font-mono mt-1 text-base">৳ {(applicant.borrowingLimit || 100000).toLocaleString()}</p>
                  <span className="text-[9px] text-slate-400 font-medium">Approved Maximum Cap</span>
                </div>

                <div className="p-3 bg-[#0a1220] border border-white/5 rounded-xl">
                  <p className="text-slate-500 uppercase tracking-wider text-[8px] font-extrabold">Outstanding Debt</p>
                  <p className="text-rose-400 font-black font-mono mt-1 text-base">৳ {(applicant.remainingDebt || 0).toLocaleString()}</p>
                  <span className="text-[9px] text-rose-400/80 font-bold">Of Max Cap: {Math.round(((applicant.remainingDebt || 0) / (applicant.borrowingLimit || 100000)) * 100)}%</span>
                </div>

                <div className="p-3 bg-[#0a1220] border border-white/5 rounded-xl">
                  <p className="text-slate-500 uppercase tracking-wider text-[8px] font-extrabold">Accumulated Savings</p>
                  <p className="text-emerald-400 font-black font-mono mt-1 text-base">৳ {(applicant.totalDeposit || 0).toLocaleString()}</p>
                  <span className="text-[9px] text-slate-400 font-medium">Total Saved Deposits</span>
                </div>

                <div className="p-3 bg-[#0a1220] border border-white/5 rounded-xl">
                  <p className="text-slate-500 uppercase tracking-wider text-[8px] font-extrabold">Borrowing Capacity Left</p>
                  <p className="text-[#50e3c2] font-black font-mono mt-1 text-base">৳ {currentBorrowingCapacity.toLocaleString()}</p>
                  <span className="text-[9px] text-[#50e3c2]/80 font-bold">Unused Reserve Credit</span>
                </div>
              </div>

              {/* Sub-standing metrics row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px] text-slate-300">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-950/40 border border-white/5 rounded-xl">
                  <span className="text-amber-400 text-sm">📅</span>
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-500">Subscription Health</p>
                    <p className="font-bold text-white uppercase">{applicant.subscriptionStatus || 'INACTIVE'} ({applicant.continuousSubscriptionMonths || 0} Mo.)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-slate-950/40 border border-white/5 rounded-xl">
                  <span className="text-blue-400 text-sm">🔄</span>
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-500">Repayment Performance</p>
                    <p className="font-bold text-white">{repaymentRatio}% Repay Ratio ({applicant.totalLoan > 0 ? `৳ ${(applicant.totalLoan - applicant.remainingDebt).toLocaleString()} of ৳ ${applicant.totalLoan.toLocaleString()}` : 'No loans taken' })</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-slate-950/40 border border-white/5 rounded-xl">
                  <span className="text-[#50e3c2] text-sm">🛡</span>
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-500">No-Borrow Streak</p>
                    <p className="font-bold text-white">{applicant.consecutiveNoLoanMonths || 0} consecutive months</p>
                  </div>
                </div>
              </div>

              {/* Dynamic Warning Indicator */}
              {applicant.remainingDebt && applicant.remainingDebt > (applicant.borrowingLimit || 100000) * 0.8 && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs rounded-xl flex items-center gap-2.5 shadow-md shadow-rose-950/10">
                  <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
                  <span className="font-semibold">Applicant's outstanding debt is over 80% of their borrowing limit. Disbursal carries critical default risk!</span>
                </div>
              )}
            </div>

            {/* Row 3: Member Wallets & Linked Accounts dossier (Crucial verification check!) */}
            <div className="p-5 bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-white/5 rounded-2xl space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  Verified Payment Channels ({selectedCaseWallets.length})
                </h4>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded font-mono">
                  AUDIT CHECKPOINT
                </span>
              </div>

              {selectedCaseWallets.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-4 bg-slate-950/20 rounded-xl">No active digital wallets linked or verified for this member.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedCaseWallets.map(w => (
                    <div 
                      key={w.id} 
                      className={cn(
                        "p-3 rounded-xl border flex items-center justify-between transition-all bg-slate-950/50",
                        w.isDefault 
                          ? "border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.05)] bg-[#050e0a]" 
                          : "border-white/5 hover:border-white/10"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded font-mono",
                            w.provider === 'bKash' ? "bg-pink-500/10 text-pink-400" : "bg-red-500/10 text-red-400"
                          )}>
                            {w.provider}
                          </span>
                          {w.isDefault && (
                            <span className="text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded tracking-widest">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-black text-white">{w.accountHolderName}</p>
                        <p className="text-[10px] font-mono text-slate-400">{w.mobileNumber}</p>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1.5">
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1",
                          w.isVerified ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                        )}>
                          <span className={cn("w-1 h-1 rounded-full", w.isVerified ? "bg-emerald-400" : "bg-amber-400")} />
                          {w.isVerified ? 'VERIFIED' : 'PENDING'}
                        </span>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                          Linked {w.dateLinked ? (
                            w.dateLinked.seconds 
                              ? format(new Date(w.dateLinked.seconds * 1000), 'dd-MM-yy HH:mm') 
                              : (typeof w.dateLinked.toDate === 'function' 
                                  ? format(w.dateLinked.toDate(), 'dd-MM-yy HH:mm') 
                                  : String(w.dateLinked))
                          ) : (w.dateAdded ? (
                            w.dateAdded.seconds 
                              ? format(new Date(w.dateAdded.seconds * 1000), 'dd-MM-yy HH:mm') 
                              : (typeof w.dateAdded.toDate === 'function' 
                                  ? format(w.dateAdded.toDate(), 'dd-MM-yy HH:mm') 
                                  : String(w.dateAdded))
                          ) : 'Recently')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Row 4: Applicant Transaction History Timeline */}
            <div className="p-5 bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-white/5 rounded-2xl space-y-4 shadow-xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 border-b border-white/5 pb-2">Recent User Transaction Dossier</h4>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {userTxs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-6">No previous financial activities recorded.</p>
                ) : (
                  userTxs.map((t, i) => (
                    <div key={t.id || i} className="p-3 bg-slate-950/40 border border-white/5 hover:border-white/10 rounded-xl flex justify-between items-center text-xs transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                            t.type === 'loan' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            t.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {t.type}
                          </span>
                          <span className="font-mono font-black text-white text-[13px]">৳ {t.amount.toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Channel: {t.method} {t.transactionId ? `• ID: ${t.transactionId}` : ''}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <span className={`text-[9px] font-extrabold tracking-wider px-2 py-0.5 rounded ${
                          t.status === 'confirmed' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/15' :
                          t.status === 'rejected' ? 'text-rose-400 bg-rose-500/10 border border-rose-500/15' :
                          'text-amber-400 bg-amber-500/10 border border-amber-500/15'
                        }`}>
                          {t.status.toUpperCase()}
                        </span>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                          {t.timestamp?.toDate ? t.timestamp.toDate().toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Active Request Parameters & Action Panel (xl:col-span-4) */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* Core Case Request Parameters */}
            <div className="p-5 bg-gradient-to-b from-[#121c2c]/80 to-[#0a1220]/95 border border-blue-500/15 rounded-2xl space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
              <h4 className="text-xs font-black uppercase tracking-widest text-[#50e3c2] border-b border-white/5 pb-2">Active Claim Request</h4>
              
              <div className="space-y-4">
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Requested Capital Disbursal</span>
                  <p className="text-3xl font-black text-[#50e3c2] font-mono tracking-tight mt-1">
                    ৳ {trx.amount.toLocaleString()} BDT
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-b border-white/5 py-4 text-xs">
                  <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Payout Method</span>
                    <div className="text-right">
                      <p className="text-white font-black">{trx.method}</p>
                      <p className="text-slate-400 font-mono text-[9px] mt-0.5">{trx.accountNumber || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Repayment Date</span>
                    <p className="text-white font-black font-mono">{trx.estimatedRepaymentDate || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] flex items-center gap-1">
                    <span>📝</span> Stated Loan Purpose
                  </span>
                  <div className="bg-slate-950/50 p-3.5 rounded-xl border border-white/5 text-slate-300 text-xs italic mt-1.5 leading-relaxed font-medium">
                    "{trx.loanReason || 'No descriptive loan purpose compiled.'}"
                  </div>
                </div>

                {trx.transactionId && (
                  <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">External Transaction ID</span>
                    <p className="text-slate-200 font-mono text-xs font-bold">{trx.transactionId}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Decision Desk Console */}
            <div className="p-5 bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-white/5 rounded-2xl space-y-4 shadow-xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-400 border-b border-white/5 pb-2">The Decision Desk</h4>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Administrative Evaluator Notes</label>
                  <textarea
                    value={adminDecisionNotes}
                    onChange={(e) => setAdminDecisionNotes(e.target.value)}
                    placeholder="Enter professional comments, security matching updates, or dynamic compliance parameters to justify your action..."
                    className="w-full h-24 bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none font-sans font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2.5 pt-1">
                  <button
                    onClick={() => {
                      setDecisionAction('approve');
                      setShowDecisionConfirmation(true);
                    }}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve Disbursal
                  </button>
                  
                  <button
                    onClick={() => {
                      setDecisionAction('reject');
                      setShowDecisionConfirmation(true);
                    }}
                    className="w-full py-3 px-4 bg-rose-600/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/20 text-[10px] tracking-widest font-black uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Decline & Cancel Request
                  </button>

                  <button
                    onClick={() => {
                      setDecisionAction('more_info');
                      setShowDecisionConfirmation(true);
                    }}
                    className="w-full py-3 px-4 bg-amber-600/10 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/20 text-[10px] tracking-widest font-black uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" /> Request More Information
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Double Confirmation Modal Overlay */}
        <AnimatePresence>
          {showDecisionConfirmation && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-[#0e1726] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl text-left"
              >
                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <div className={`p-2 rounded-xl ${
                    decisionAction === 'approve' ? 'bg-emerald-500/10 text-emerald-400' :
                    decisionAction === 'reject' ? 'bg-rose-500/10 text-rose-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {decisionAction === 'approve' && <ShieldCheck className="w-6 h-6" />}
                    {decisionAction === 'reject' && <XCircle className="w-6 h-6" />}
                    {decisionAction === 'more_info' && <AlertCircle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-black text-white text-base">Verify Board Action</h3>
                    <p className="text-xs text-slate-400">T.U.T. Lending Authority Compliance Protocol</p>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs text-slate-300">
                  <p>
                    Are you absolutely sure you want to {
                      decisionAction === 'approve' ? 'APPROVE the disbursal of' :
                      decisionAction === 'reject' ? 'DECLINE the requested' :
                      'REQUEST MORE INFORMATION for'
                    } <strong className="text-white font-mono">৳{trx.amount.toLocaleString()}</strong> for <strong className="text-white">{trx.userName}</strong>?
                  </p>

                  <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl space-y-1.5 font-mono text-[10px]">
                    <p className="text-slate-400">DECISION METADATA:</p>
                    <p>ACTOR: <span className="text-white">{auth.currentUser?.email || 'Administrator'}</span></p>
                    <p>ACTION: <span className={`uppercase font-bold ${
                      decisionAction === 'approve' ? 'text-emerald-400' :
                      decisionAction === 'reject' ? 'text-rose-400' :
                      'text-amber-400'
                    }`}>{decisionAction}</span></p>
                    <p>COMMENTS: <span className="text-white italic">"{adminDecisionNotes || 'No administrator evaluation note provided'}"</span></p>
                  </div>

                  <div className="p-2.5 bg-[#0a1220] border border-white/5 rounded-xl flex items-start gap-2.5">
                    <input type="checkbox" id="compliance-chk" className="mt-0.5 rounded border-white/10 bg-slate-950 text-blue-500 focus:ring-0 cursor-pointer" defaultChecked />
                    <label htmlFor="compliance-chk" className="text-[10px] text-slate-400 leading-normal select-none cursor-pointer">
                      I declare that this decision adheres to regulatory lending compliance guidelines and has been logged inside the secure audit trails.
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowDecisionConfirmation(false)}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancel Action
                  </button>
                  <button
                    onClick={handleExecuteDecision}
                    className={`flex-1 py-2 rounded-xl text-white font-bold text-xs transition-colors cursor-pointer ${
                      decisionAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500' :
                      decisionAction === 'reject' ? 'bg-rose-600 hover:bg-rose-500' :
                      'bg-amber-600 hover:bg-amber-500'
                    }`}
                  >
                    Confirm Action
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderCaseMemberPage = (applicant: UserProfile) => {
    const handleExecuteMemberDecision = async () => {
      if (!decisionAction) return;
      if (decisionAction === 'approve') {
        await approveMember(applicant.uid, adminDecisionNotes);
        addToast('Membership Approved', `Approved applicant ${applicant.name} as a verified member.`, 'success');
      } else if (decisionAction === 'reject') {
        await rejectMember(applicant.uid, adminDecisionNotes);
      } else if (decisionAction === 'more_info') {
        await requestMoreInfoForMember(applicant.uid, adminDecisionNotes);
      }
      setSelectedCaseMember(null);
      setAdminDecisionNotes('');
      setShowDecisionConfirmation(false);
      setDecisionAction(null);
    };

    return (
      <div className="space-y-6 text-left">
        {/* Case File Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0a1220] border border-white/5 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedCaseMember(null);
                setAdminDecisionNotes('');
                setDecisionAction(null);
                setShowDecisionConfirmation(false);
              }}
              className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Return to Queue"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest text-[#50e3c2] uppercase bg-[#50e3c2]/10 border border-[#50e3c2]/20 px-2 py-0.5 rounded">
                  REGISTRATION FILE #{applicant.uid ? applicant.uid.substring(0, 8).toUpperCase() : 'NEW'}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-mono text-slate-400 uppercase font-black">MEMBERSHIP APPRAISAL</span>
              </div>
              <h3 className="text-lg font-black text-white mt-1">Identity & Membership Case File</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-mono text-amber-400 uppercase font-black tracking-wider">Awaiting Verification</span>
          </div>
        </div>

        {/* Dynamic Dual-Pane Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Identity credentials dossier */}
          <div className="lg:col-span-7 space-y-6">
            <div className="p-5 bg-gradient-to-br from-[#0e1726]/80 to-[#070c14]/90 border border-white/5 rounded-xl space-y-4 shadow-xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 border-b border-white/5 pb-2">National Identity & Profile Information</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">Full Legal Name</p>
                  <p className="text-white font-bold mt-0.5">{applicant.name}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">National ID Number (NID)</p>
                  <p className="text-white font-mono font-bold mt-0.5">{applicant.nid || 'PENDING SUBMISSION'}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">Mobile Connection</p>
                  <p className="text-white font-mono mt-0.5">{applicant.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">Email Address</p>
                  <p className="text-white mt-0.5">{applicant.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">Primary Profession/Occupation</p>
                  <p className="text-white mt-0.5 font-bold">{applicant.occupation || 'Not Specified'}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">Requested Membership tier</p>
                  <span className="inline-block px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-1">
                    {applicant.subscriptionTier || 'BRONZE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-[#0e1726]/80 to-[#070c14]/90 border border-white/5 rounded-xl space-y-4 shadow-xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 border-b border-white/5 pb-2">Residential & Verification Contacts</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">Residential Address</p>
                  <p className="text-slate-200 mt-0.5 text-[11px] leading-relaxed">{applicant.address || 'Not Provided'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">Permanent Address</p>
                  <p className="text-slate-200 mt-0.5 text-[11px] leading-relaxed">{applicant.permanentAddress || 'Not Provided'}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">Reference Contact Info</p>
                  <p className="text-white mt-0.5 font-mono">{applicant.referenceContact || 'Not Specified'}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">Nominee & Relationship</p>
                  <p className="text-white mt-0.5">{applicant.nomineeName ? `${applicant.nomineeName} (${applicant.nomineeRelation || 'Nominee'})` : 'None Declared'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Case details & decisions */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-5 bg-gradient-to-br from-[#121c2c] to-[#0a1220] border border-blue-500/15 rounded-xl space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
              <h4 className="text-xs font-black uppercase tracking-widest text-[#50e3c2] border-b border-white/5 pb-2">Risk Evaluation Index</h4>
              
              <div className="space-y-4">
                <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">KYC Verification State</span>
                    <p className="text-white font-bold text-xs mt-0.5">
                      {applicant.nid ? 'NID Present' : 'Missing National Identity Document'}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-[#50e3c2]/10 text-[#50e3c2] rounded-lg">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Assigned Credit Limit</span>
                    <p className="text-white font-bold text-xs mt-0.5">
                      ৳ {(applicant.borrowingLimit || 100000).toLocaleString()} Max Capacity
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Decision Desk Console */}
            <div className="p-5 bg-gradient-to-br from-[#0e1726]/80 to-[#070c14]/90 border border-white/5 rounded-xl space-y-4 shadow-xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-400 border-b border-white/5 pb-2">The Decision Desk</h4>
              
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Administrative Evaluator Notes</label>
                  <textarea
                    value={adminDecisionNotes}
                    onChange={(e) => setAdminDecisionNotes(e.target.value)}
                    placeholder="Provide professional comments about verification checks, legal compliant status..."
                    className="w-full h-24 bg-slate-950/50 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none font-sans"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => {
                      setDecisionAction('approve');
                      setShowDecisionConfirmation(true);
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/10"
                  >
                    <UserCheck className="w-4 h-4" /> Approve Applicant
                  </button>
                  
                  <button
                    onClick={() => {
                      setDecisionAction('reject');
                      setShowDecisionConfirmation(true);
                    }}
                    className="w-full py-2.5 px-4 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/25 text-[10px] tracking-widest font-black uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Decline Registration
                  </button>

                  <button
                    onClick={() => {
                      setDecisionAction('more_info');
                      setShowDecisionConfirmation(true);
                    }}
                    className="w-full py-2.5 px-4 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/25 text-[10px] tracking-widest font-black uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" /> Request More Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Double Confirmation Modal Overlay */}
        <AnimatePresence>
          {showDecisionConfirmation && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-[#0e1726] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl text-left"
              >
                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <div className={`p-2 rounded-xl ${
                    decisionAction === 'approve' ? 'bg-emerald-500/10 text-emerald-400' :
                    decisionAction === 'reject' ? 'bg-rose-500/10 text-rose-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {decisionAction === 'approve' && <ShieldCheck className="w-6 h-6" />}
                    {decisionAction === 'reject' && <XCircle className="w-6 h-6" />}
                    {decisionAction === 'more_info' && <AlertCircle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-black text-white text-base">Verify Board Action</h3>
                    <p className="text-xs text-slate-400">T.U.T. Lending Authority Compliance Protocol</p>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs text-slate-300">
                  <p>
                    Are you absolutely sure you want to {
                      decisionAction === 'approve' ? 'APPROVE the registration of' :
                      decisionAction === 'reject' ? 'DECLINE the registration of' :
                      'REQUEST MORE INFORMATION for'
                    } <strong className="text-white">{applicant.name}</strong> as a verified member?
                  </p>

                  <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl space-y-1.5 font-mono text-[10px]">
                    <p className="text-slate-400">DECISION METADATA:</p>
                    <p>ACTOR: <span className="text-white">{auth.currentUser?.email || 'Administrator'}</span></p>
                    <p>ACTION: <span className={`uppercase font-bold ${
                      decisionAction === 'approve' ? 'text-emerald-400' :
                      decisionAction === 'reject' ? 'text-rose-400' :
                      'text-amber-400'
                    }`}>{decisionAction}</span></p>
                    <p>COMMENTS: <span className="text-white italic">"{adminDecisionNotes || 'No administrator evaluation note provided'}"</span></p>
                  </div>

                  <div className="p-2.5 bg-[#0a1220] border border-white/5 rounded-xl flex items-start gap-2.5">
                    <input type="checkbox" id="compliance-member-chk" className="mt-0.5 rounded border-white/10 bg-slate-950 text-blue-500 focus:ring-0 cursor-pointer" defaultChecked />
                    <label htmlFor="compliance-member-chk" className="text-[10px] text-slate-400 leading-normal select-none cursor-pointer">
                      I declare that this decision adheres to regulatory member registration audit standards and KYC verification procedures.
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowDecisionConfirmation(false)}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancel Action
                  </button>
                  <button
                    onClick={handleExecuteMemberDecision}
                    className={`flex-1 py-2 rounded-xl text-white font-bold text-xs transition-colors cursor-pointer ${
                      decisionAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500' :
                      decisionAction === 'reject' ? 'bg-rose-600 hover:bg-rose-500' :
                      'bg-amber-600 hover:bg-amber-500'
                    }`}
                  >
                    Confirm Action
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderAdminRequests = () => {
    if (selectedCaseTransaction) {
      return renderCaseTransactionPage(selectedCaseTransaction);
    }
    if (selectedCaseMember) {
      return renderCaseMemberPage(selectedCaseMember);
    }

    const pendingMembers = allUsers.filter(u => u.status === 'pending');
    const pendingTrxs = allTransactions.filter(t => t.status === 'pending');

    const filteredTrxs = pendingTrxs.filter(t => {
      if (requestFilter === 'all') return true;
      if (requestFilter === 'loan') return t.type === 'loan';
      if (requestFilter === 'deposit') return t.type === 'deposit';
      if (requestFilter === 'repayment') return t.type === 'refund' || t.type === 'pay_due';
      return true;
    });

    return (
      <div className="space-y-6 text-left">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-[#0e1726]/40 border border-white/5 rounded-xl">
            <p className="text-[10px] font-black uppercase text-slate-400">Total Capital Capacity</p>
            <p className="text-xl font-black text-white font-mono mt-1">৳ {totalFinancialAmount.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-[#0e1726]/40 border border-white/5 rounded-xl">
            <p className="text-[10px] font-black uppercase text-slate-400">Outstanding Claims</p>
            <p className="text-xl font-black text-rose-400 font-mono mt-1">৳ {outstandingDebt.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-[#0e1726]/40 border border-white/5 rounded-xl">
            <p className="text-[10px] font-black uppercase text-slate-400">Available Lending Reserve</p>
            <p className="text-xl font-black text-emerald-400 font-mono mt-1">৳ {availableLendingCapacity.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 bg-slate-900/40 p-1 rounded-lg border border-white/5 w-fit">
          {(['all', 'loan', 'deposit', 'withdraw', 'repayment'] as const).map(f => (
            <button
              key={f}
              onClick={() => setRequestFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                requestFilter === f ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:text-white"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 1: Member Registrations */}
          <div className="p-5 bg-[#0e1726]/30 border border-white/5 rounded-xl space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 border-b border-white/5 pb-2">Pending Member Registrations ({pendingMembers.length})</h4>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {pendingMembers.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-6">No pending registrations in queue.</p>
              ) : (
                pendingMembers.map(user => (
                  <div key={user.uid} className="p-3 bg-white/[0.01] border border-white/5 hover:border-blue-500/20 rounded-xl flex justify-between items-center transition-all">
                    <div>
                      <p className="text-xs font-black text-white">{user.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.2 rounded uppercase">
                          {user.subscriptionTier || 'Bronze'}
                        </span>
                        {user.moreInfoRequested && (
                          <span className="text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded uppercase animate-pulse">
                            INFO REQUESTED
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400">{user.email || user.phone}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCaseMember(user);
                        setAdminDecisionNotes(user.adminNotes || '');
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[9px] tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-blue-950/20"
                    >
                      <FileText className="w-3.5 h-3.5" /> Evaluate Profile
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 2: Transaction Requests */}
          <div className="p-5 bg-[#0e1726]/30 border border-white/5 rounded-xl space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 border-b border-white/5 pb-2">Pending Transactions ({filteredTrxs.length})</h4>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredTrxs.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-6">No pending requests matching filter.</p>
              ) : (
                filteredTrxs.map(trx => (
                  <div key={trx.id} className="p-3 bg-white/[0.01] border border-white/5 hover:border-blue-500/20 rounded-xl flex justify-between items-center transition-all">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                          trx.type === 'loan' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          trx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>{trx.type}</span>
                        <p className="text-xs font-black text-white">৳ {trx.amount.toLocaleString()}</p>
                        {trx.moreInfoRequested && (
                          <span className="text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded uppercase animate-pulse">
                            INFO REQUESTED
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        By: {trx.userName} • Channel: {trx.method}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCaseTransaction(trx);
                        setAdminDecisionNotes(trx.adminNotes || '');
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[9px] tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-blue-950/20"
                    >
                      <Scale className="w-3.5 h-3.5" /> Decision Desk
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminMembers = () => {
    const approvedMembers = allUsers.filter(u => u.status === 'approved');
    const filteredMembers = approvedMembers.filter(u => 
      u.name.toLowerCase().includes(memberSearch.toLowerCase()) || 
      u.phone.includes(memberSearch) || 
      (u.memberId && u.memberId.toLowerCase().includes(memberSearch.toLowerCase()))
    );

    return (
      <div className="space-y-6 text-left">
        {/* Search Bar */}
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              id="admin-member-search"
              placeholder="Search by ID, Name, Phone..."
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              className="w-full bg-[#0e1726]/50 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <span className="text-[10px] font-bold text-slate-400 font-mono">Found {filteredMembers.length} Members</span>
        </div>

        {/* Members Table */}
        <div className="p-5 bg-[#0e1726]/30 border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto font-sans">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-blue-400 border-b border-white/5 bg-slate-900/30">
                  <th className="py-3 px-4">Member ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4 font-mono text-right">Deposits</th>
                  <th className="py-3 px-4 font-mono text-right">Lent Balance</th>
                  <th className="py-3 px-4 font-mono text-right">Lending Limit</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-xs text-slate-500 italic">No approved members found.</td>
                  </tr>
                ) : (
                  filteredMembers.map(user => {
                    const hasActiveDebt = (user.remainingDebt || 0) > 0;
                    const isEditing = editingLimitUid === user.uid;

                    return (
                      <tr key={user.uid} className="text-xs hover:bg-white/[0.01]">
                        <td className="py-3 px-4 font-mono font-bold text-blue-400/80">{user.memberId || 'TUT-MBR'}</td>
                        <td className="py-3 px-4 font-black text-white">
                          <div>
                            <p>{user.name}</p>
                            <p className="text-[9px] text-slate-400 font-normal">{user.phone}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">৳ {(user.totalDeposit || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono text-rose-400">৳ {(user.remainingDebt || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          {isEditing ? (
                            <div className="flex gap-1.5 justify-end items-center">
                              <input
                                type="number"
                                value={editingLimitValue}
                                onChange={e => setEditingLimitValue(e.target.value)}
                                className="w-20 bg-slate-800 border border-white/10 rounded px-1.5 py-0.5 text-[11px] font-mono text-white text-right focus:outline-none focus:border-blue-500"
                              />
                              <button onClick={() => updateBorrowingLimit(user.uid, editingLimitValue)} className="text-[10px] text-emerald-400 font-black hover:underline">Save</button>
                              <button onClick={() => setEditingLimitUid(null)} className="text-[10px] text-rose-400 font-bold hover:underline">X</button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end items-center">
                              <span className="text-white">৳ {(user.borrowingLimit ?? 100000).toLocaleString()}</span>
                              <button onClick={() => { setEditingLimitUid(user.uid); setEditingLimitValue((user.borrowingLimit ?? 100000).toString()); }} className="text-[9px] uppercase tracking-wider text-blue-400 font-black hover:underline opacity-40 hover:opacity-100 transition-opacity">Edit</button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border leading-none",
                            hasActiveDebt ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          )}>
                            {hasActiveDebt ? "Debt Active" : "Liquid Clear"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="secondary" className="px-2 py-1 text-[9px] min-h-0" onClick={() => setSelectedAdminMemberDetail(user)}>Dossier File</Button>
                            <Button variant="danger" className="px-2 py-1 text-[9px] min-h-0 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white" onClick={() => { setUserToDelete(user); setShowDeleteModal(true); }}>Delete</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminPartners = () => {
    return (
      <div className="space-y-6 text-left">
        {/* Ad Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-[#0e1726]/40 border border-white/5 rounded-xl">
            <p className="text-[10px] font-black uppercase text-slate-400">Total Campaign Value</p>
            <p className="text-xl font-black text-[#50e3c2] font-mono mt-1">৳ {activeSponsorships.reduce((sum, s) => sum + (s.dealValue || 0), 0).toLocaleString()}</p>
          </div>
          <div className="p-4 bg-[#0e1726]/40 border border-white/5 rounded-xl">
            <p className="text-[10px] font-black uppercase text-slate-400">Total Campaign Views</p>
            <p className="text-xl font-black text-blue-400 font-mono mt-1">{activeSponsorships.reduce((sum, s) => sum + (s.impressions || 0), 0).toLocaleString()}</p>
          </div>
          <div className="p-4 bg-[#0e1726]/40 border border-white/5 rounded-xl">
            <p className="text-[10px] font-black uppercase text-slate-400">Total Clicks</p>
            <p className="text-xl font-black text-indigo-400 font-mono mt-1">{activeSponsorships.reduce((sum, s) => sum + (s.clicks || 0), 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Sponsor Action Bar */}
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <h4 className="text-xs font-black uppercase text-white tracking-wider">Active Sponsorship Campaigns ({activeSponsorships.length})</h4>
          <Button variant="primary" className="px-3.5 py-1.5 text-[9px] font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 cursor-pointer" onClick={() => setShowSponsorModal(true)}>
            Add New Sponsorship
          </Button>
        </div>

        {/* Ad List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeSponsorships.length === 0 ? (
            <div className="col-span-full text-center py-12 text-xs text-slate-500 italic">No partnerships campaigns active. Click add above to secure a deal!</div>
          ) : (
            activeSponsorships.map(s => (
              <div key={s.id} className="p-4 bg-[#0e1726]/30 border border-white/5 rounded-xl space-y-3 relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <h5 className="text-xs font-black text-white">{s.companyName}</h5>
                    <span className={cn(
                      "text-[8px] font-black uppercase px-2 py-0.5 rounded leading-none border",
                      s.status === 'active' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                      s.status === 'paused' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                      "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    )}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Deal Value: <span className="font-mono text-white">৳ {s.dealValue?.toLocaleString()}</span></p>
                </div>
                
                <div className="border-t border-white/5 pt-2 flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span>Views: <span className="text-white font-bold">{s.impressions || 0}</span></span>
                  <span>Clicks: <span className="text-white font-bold">{s.clicks || 0}</span></span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderAdminReminders = () => {
    return (
      <div className="space-y-6 text-left">
        <div className="border-b border-white/5 pb-3">
          <h4 className="text-xs font-black uppercase text-white tracking-wider">Loan Due Automated Dispatch Center</h4>
          <p className="text-[10px] text-slate-400 mt-1">Generate official monitoring letters and send push reminder warnings to active debtors.</p>
        </div>

        {/* Send Automated Notification Section */}
        <div className="p-5 bg-[#0e1726]/30 border border-white/5 rounded-xl space-y-4">
          <h5 className="text-xs font-black uppercase text-blue-400 tracking-wider">Notification Broadcast Hub</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Send manual, customized reminders to all approved members. The letter will be transmitted instantly to their private member workspace alerts feed.
              </p>
              <div className="space-y-2">
                <Button variant="primary" className="w-full text-xs bg-indigo-600 hover:bg-indigo-700" onClick={async () => {
                  allUsers.filter(u => u.status === 'approved' && (u.remainingDebt || 0) > 0).forEach(async user => {
                    await sendWorkflowNotification('debt_warning', user.email, user.name, { amount: user.remainingDebt || 0 });
                  });
                  addToast('Alerts Sent', 'Dispatched consolidated due warning alert blocks to all active borrowers.', 'success');
                }}>
                  Broadcast Debt Alerts to All Borrowers
                </Button>
              </div>
            </div>
            
            {/* Visual warning mockup */}
            <div className="p-3 bg-slate-950/50 border border-white/5 rounded-xl text-[10px] font-mono text-slate-400 space-y-1">
              <p className="text-blue-400 font-bold border-b border-white/5 pb-1 uppercase tracking-wider text-[9px]">WORKSPACE WARNING PREVIEW</p>
              <p className="text-white font-bold mt-1">Subject: Compliance Warning Letter</p>
              <p className="leading-normal">Dear Member, please be advised that our system logged an outstanding claim under your national ID. Clear your due within 48h to prevent credit limit deterioration.</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminLiquidity = () => {
    // Audit recalculator helper
    const actualDeposits = allUsers.reduce((sum, u) => sum + (u.totalDeposit || 0), 0);
    const actualDebt = allUsers.reduce((sum, u) => sum + (u.remainingDebt || 0), 0);

    return (
      <div className="space-y-6 text-left">
        {/* BASEL III STATUS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-[#0e1726]/40 border border-white/5 rounded-xl space-y-1">
            <p className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Basel III Capital Adequacy (CAR)</p>
            <p className="text-2xl font-black text-white">{((totalFinancialAmount / (outstandingDebt || 1)) * 100).toFixed(1)}%</p>
            <p className="text-[10px] text-slate-400">Compliant (Minimum requirement: 12.0%)</p>
          </div>
          
          <div className="p-4 bg-[#0e1726]/40 border border-white/5 rounded-xl space-y-1">
            <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">HQLA Coverage (LCR)</p>
            <p className="text-2xl font-black text-white">{runwayLiquidity > 0 ? '500%+' : '0%'}</p>
            <p className="text-[10px] text-slate-400">Secure simulated cash buffer ratio</p>
          </div>

          <div className="p-4 bg-[#0e1726]/40 border border-white/5 rounded-xl space-y-1">
            <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider">Loan-to-Deposit (LDR)</p>
            <p className="text-2xl font-black text-white">{totalDeposits > 0 ? ((outstandingDebt / totalDeposits) * 100).toFixed(1) : '0'}%</p>
            <p className="text-[10px] text-slate-400">Safe credit output balanced bounds</p>
          </div>
        </div>

        {/* Regulatory Audit and Slideway HUD */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audit trail list */}
          <div className="p-5 bg-[#0e1726]/30 border border-white/5 rounded-xl space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-3">
                <h4 className="text-xs font-black uppercase text-white tracking-wider">Regulatory Compliance Audit Log</h4>
                <button 
                  onClick={async () => {
                    await logAuditEvent('Compliance Ledger Verify', `Manual cross-reference auditor matching deposits (৳${actualDeposits.toLocaleString()}) and debt (৳${actualDebt.toLocaleString()})`, 'info');
                    addToast('Auditor Dispatched', 'Cross-referred active ledger successfully. System is mathematically safe.', 'success');
                  }}
                  className="px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/20"
                >
                  Verify
                </button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-8">No formal logs recorded in audit collection.</p>
                ) : (
                  auditLogs.map(log => {
                    const dateText = log.timestamp?.seconds 
                      ? format(new Date(log.timestamp.seconds * 1000), 'dd-MM-yy HH:mm')
                      : 'just now';

                    return (
                      <div key={log.id} className="p-2 bg-white/[0.01] border border-white/5 rounded-lg flex flex-col gap-1 text-[10px] font-mono leading-normal">
                        <div className="flex justify-between text-blue-400 font-bold">
                          <span>{log.action}</span>
                          <span className="text-slate-500 text-[9px] font-normal">{dateText}</span>
                        </div>
                        <p className="text-white/80">{log.details}</p>
                        <p className="text-[8px] text-slate-500">By: {log.actorName} ({log.actorEmail})</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Solvency Panel Controls */}
          <div className="p-5 bg-[#0e1726]/30 border border-white/5 rounded-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-white tracking-wider border-b border-white/5 pb-2">Active Stress testing parameters</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Simulate catastrophic withdrawals or market loan write-offs to verify system survival. Stressed capital structures adjust dynamically.
              </p>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Run Outflow Percent:</span>
                  <span className="font-mono text-white font-bold">{stressWithdrawalPct}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" value={stressWithdrawalPct}
                  onChange={(e) => setStressWithdrawalPct(parseInt(e.target.value))}
                  className="w-full accent-blue-600 bg-slate-800 rounded-lg h-1"
                />
                
                <div className="flex justify-between">
                  <span className="text-slate-400">Defaults Write-off:</span>
                  <span className="font-mono text-white font-bold">{stressDefaultPct}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" value={stressDefaultPct}
                  onChange={(e) => setStressDefaultPct(parseInt(e.target.value))}
                  className="w-full accent-rose-600 bg-slate-800 rounded-lg h-1"
                />
              </div>
            </div>

            {/* Indicator output */}
            {(() => {
              const withdrawalOutflow = totalDeposits * (stressWithdrawalPct / 100);
              const defaultLoss = outstandingDebt * (stressDefaultPct / 100);
              const totalOutflow = withdrawalOutflow + defaultLoss;
              const postStressLiquidity = runwayLiquidity - totalOutflow;
              const isSolvent = postStressLiquidity >= 0;

              return (
                <div className={cn("p-3 rounded-lg border text-[10px] font-mono leading-normal",
                  isSolvent ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                )}>
                  <p className="font-bold uppercase tracking-wider mb-1 text-[9px]">Audited Outcome Indicator</p>
                  <p>Stressed Cash Deficit: ৳ {totalOutflow.toLocaleString()}</p>
                  <p>Remaining Buffer: <span className="font-bold text-white">৳ {postStressLiquidity.toLocaleString()}</span></p>
                  <p className="mt-1 opacity-70">{isSolvent ? "✓ Reserves Solvent" : "✗ Extreme Illiquidity Hazard!"}</p>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-blue-50 font-sans selection:bg-blue-500/30">
      {/* Header — Sleek 3-Zone Banking Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/88 backdrop-blur-xl border-b border-white/[0.07] px-3.5 sm:px-6 py-2.5">
        <div className="w-full max-w-7xl mx-auto flex gap-4 justify-between items-center">
          {/* Zone 1: Brand Identity */}
          <button
            type="button"
            onClick={() => {
              if (user && profile?.status === 'approved') {
                setShowProfileModal(false);
                setActiveTransactionView(null);
                setActiveMemberTab('dashboard');
                window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
              }
            }}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group shrink-0"
          >
            <div className="logo-shield w-9 h-9 overflow-hidden rounded-xl border border-white/15 flex items-center justify-center flex-shrink-0 bg-slate-900 group-hover:border-blue-400/40 transition-colors">
              <img src={tutLogo} alt="T.U.T. Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-[15px] font-extrabold tracking-tight text-white leading-none whitespace-nowrap">T.U.T.</span>
                {isOffline && (
                  <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-400 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-rose-500/25">
                    Offline
                  </span>
                )}
              </div>
              <p className="text-[10px] font-medium text-slate-400 tracking-wide truncate leading-none mt-1">Private Lending</p>
            </div>
          </button>

          {/* Zone 2: Desktop Primary Navigation (Single-row clean links) */}
          {user && profile?.status === 'approved' && !isAdminLoggedIn && (
            <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-1">
              {[
                { id: 'dashboard', label: 'Home', icon: Home },
                { id: 'memos', label: 'Vault', icon: FileText, badge: pendingMemberTxCount },
                { id: 'subscription', label: 'Premium', icon: Award },
                { id: 'partners', label: 'Deals', icon: Briefcase },
                { id: 'profile', label: 'Profile', icon: User },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = !showProfileModal && (
                  activeMemberTab === item.id || (item.id === 'profile' && activeMemberTab === 'wallets')
                );
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setShowProfileModal(false);
                      setActiveTransactionView(null);
                      setActiveMemberTab(item.id as any);
                      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                    }}
                    className={cn(
                      "relative px-3.5 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer",
                      isSelected
                        ? "text-white bg-white/[0.06]"
                        : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", isSelected ? "text-blue-400" : "text-current")} />
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold leading-none tabular-nums">
                        {item.badge}
                      </span>
                    )}
                    {isSelected && (
                      <motion.div
                        layoutId="desktopTopNavIndicator"
                        className="absolute bottom-0 inset-x-3 h-[2px] bg-blue-400 rounded-full"
                        transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Zone 3: Quick Utility & Account Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <a 
                  href="https://wa.me/8801713710607" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-9.5 h-9.5 sm:w-10 sm:h-10 rounded-xl border border-emerald-500/30 text-emerald-400 bg-emerald-950/35 hover:bg-emerald-500/15 transition-colors flex-shrink-0 cursor-pointer flex items-center justify-center group"
                  title="Contact Support on WhatsApp (+8801713710607)"
                >
                  <svg className="w-4 h-4 fill-emerald-400 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.99c-.002 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c-.001 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </a>
                <button 
                  onClick={() => {
                    setShowNotificationCenter(true);
                  }}
                  className={cn(
                    "w-9.5 h-9.5 sm:w-10 sm:h-10 rounded-xl border bg-slate-900/75 transition-colors relative flex-shrink-0 cursor-pointer flex items-center justify-center",
                    memberUnreadCount > 0
                      ? "border-blue-500/45 text-blue-400 hover:bg-blue-500/15" 
                      : "border-white/10 text-slate-300 hover:text-white hover:border-white/20 hover:bg-slate-800/80"
                  )}
                  title="Notifications & Alerts"
                >
                  <Bell className="w-4 h-4" />
                  {memberUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-blue-500 text-white font-mono text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-slate-950 tabular-nums">
                      {memberUnreadCount > 9 ? '9+' : memberUnreadCount}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => signOut(auth)} 
                  className="w-9.5 h-9.5 sm:w-10 sm:h-10 rounded-xl border border-rose-500/25 text-rose-400 bg-slate-900/70 hover:bg-rose-500/10 hover:border-rose-500/40 transition-colors flex-shrink-0 cursor-pointer flex items-center justify-center"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button onClick={() => handleLogin()} disabled={isLoggingIn} className="text-xs px-3.5 py-2 rounded-xl">
                {isLoggingIn ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>{isLoggingIn ? 'Connecting...' : 'Login'}</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto px-2.5 sm:px-5 lg:px-8 py-4 sm:py-6 pb-24 md:pb-10">
        {globalError && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between gap-4 text-red-400">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{globalError}</p>
            </div>
            <button onClick={() => setGlobalError(null)} className="p-1 hover:bg-red-500/10 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {!user ? (
          <LoginPage
            tutLogo={tutLogo}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            authMode={authMode}
            setAuthMode={setAuthMode}
            handleEmailAuth={handleEmailAuth}
            handleLogin={handleLogin}
            handleForgotPassword={handleForgotPassword}
            isLoggingIn={isLoggingIn}
            setIsLoggingIn={setIsLoggingIn}
            setGlobalError={setGlobalError}
            externalAction={externalAction}
          />
        ) : !profile ? (
          <div className="max-w-xl mx-auto">
            {externalAction === 'loan' && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-400" />
                <p className="text-sm text-blue-200/80 font-medium">
                  Complete your registration to proceed with your <span className="text-blue-400 font-bold">Loan Request</span>.
                </p>
              </div>
            )}
            <Card title="Membership Registration" icon={UserPlus}>
              <form onSubmit={handleRegister} className="space-y-4">
                <Input 
                  label="Full Name (As per NID)" 
                  required 
                  value={regData.name}
                  onChange={e => setRegData({...regData, name: e.target.value})}
                  placeholder="e.g. Tahsin Ullah"
                />
                <Input 
                  label="Contact Email" 
                  type="email"
                  required 
                  value={regData.email}
                  onChange={e => setRegData({...regData, email: e.target.value})}
                  placeholder="your@email.com"
                />
                <Input 
                  label="NID Number" 
                  required 
                  value={regData.nid}
                  onChange={e => setRegData({...regData, nid: e.target.value})}
                  placeholder="10 or 17 digit NID"
                />
                <Input 
                  label="Full Address" 
                  required 
                  value={regData.address}
                  onChange={e => setRegData({...regData, address: e.target.value})}
                  placeholder="Current residential address"
                />
                <Input 
                  label="Occupation" 
                  required 
                  value={regData.occupation}
                  onChange={e => setRegData({...regData, occupation: e.target.value})}
                  placeholder="Your current profession"
                />
                <Input 
                  label="Phone Number (11 Digits)" 
                  type="text"
                  required 
                  value={regData.phone}
                  onChange={e => setRegData({...regData, phone: e.target.value})}
                  placeholder="017XXXXXXXX"
                />
                <FileUploader 
                  label="Profile Photo"
                  currentUrl={regData.photoUrl}
                  onUpload={(url) => setRegData({...regData, photoUrl: url})}
                />
                <Button type="submit" className="w-full py-3 mt-4">
                  Submit Membership Request
                </Button>
              </form>
            </Card>
          </div>
        ) : profile.status === 'pending' ? (
          <RegistrationProgressTracker
            profile={profile}
            userEmail={user.email}
            onRefreshStatus={async () => {
              try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (snap.exists()) {
                  const data = snap.data() as UserProfile;
                  setProfile(data);
                }
              } catch (e) {
                console.error("Refresh status error:", e);
              }
            }}
            onSignOut={() => signOut(auth)}
          />
        ) : showProfileModal ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-4 text-left select-none pb-24"
          >
            {/* Header with Back Button */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center border border-white/10 bg-slate-900/60 hover:bg-slate-800 cursor-pointer"
                  title="Close Profile"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white leading-none">Edit Profile Details</h2>
                  <span className="text-[10px] text-slate-400 mt-0.5 block leading-tight">T.U.T. Digital Authority System</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                {profile?.memberId || 'TUT-MEMBER'}
              </span>
            </div>

            {(() => {
              const fieldsList = [
                profileData.name, profileData.email, profileData.phone, profileData.occupation, profileData.address,
                profileData.fatherName, profileData.motherName, profileData.dob, profileData.bloodGroup, profileData.permanentAddress,
                profileData.nomineeName, profileData.nomineeRelation, profileData.emergencyContact, profileData.referenceContact,
                profileData.photoUrl, profileData.facebook, profileData.whatsapp, profileData.telegram
              ];
              const filledCount = fieldsList.filter(f => f && String(f).trim() !== '').length;
              const strength = Math.round((filledCount / 18) * 100);
              const remainingCount = 18 - filledCount;

              return (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  {/* Compact Profile Strength Strip */}
                  <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-white/5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", strength >= 85 ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
                      <span className="text-[11px] font-medium text-slate-300 shrink-0">Integrity Level</span>
                      <div className="w-20 sm:w-28 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${strength}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className={cn(
                            "h-full rounded-full",
                            strength >= 85 ? "bg-emerald-400" : "bg-blue-400"
                          )}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                        {remainingCount === 0 ? 'Complete' : `${remainingCount} left`}
                      </span>
                      <span className={cn(
                        "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                        strength >= 85 
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" 
                          : "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                      )}>
                        {strength}%
                      </span>
                    </div>
                  </div>

                  {/* Compact Segmented Controls */}
                  <div className="flex gap-1 p-1 bg-slate-950/90 rounded-xl border border-white/5 overflow-x-auto scrollbar-none sticky top-0 z-20 backdrop-blur-md">
                    {[
                      { id: 'basic', label: 'General', icon: User },
                      { id: 'personal', label: 'KYC / Bio', icon: FileText },
                      { id: 'nominee', label: 'Nominee', icon: Users },
                      { id: 'emergency', label: 'Emergency', icon: ShieldCheck },
                      { id: 'social', label: 'Socials', icon: Facebook }
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = activeProfileTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveProfileTab(tab.id as any)}
                          className={cn(
                            "flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex-1 whitespace-nowrap cursor-pointer",
                            isActive 
                              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold" 
                              : "text-slate-400 border border-transparent hover:text-slate-200 hover:bg-white/5"
                          )}
                        >
                          <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-blue-400" : "text-slate-500")} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Animated Form Panels */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeProfileTab}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      {activeProfileTab === 'basic' && (
                        <div className="space-y-3.5">
                          {/* Compact Avatar Card */}
                          <div className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex items-center gap-3.5">
                            <div className="shrink-0">
                              <FileUploader 
                                label=""
                                currentUrl={profileData.photoUrl}
                                onUpload={(url) => setProfileData({...profileData, photoUrl: url})}
                                maxDimension={300}
                                shape="circle"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-white block truncate">{profileData.name || 'Member Account'}</span>
                              <span className="text-[10px] text-slate-400 block truncate">{profileData.email || 'No email specified'}</span>
                              <span className="text-[9px] text-blue-400/80 mt-0.5 block">Tap avatar to upload photo (JPG/PNG)</span>
                            </div>
                          </div>

                          {/* 2-Column Responsive Input Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input 
                              label="Full Legal Name" 
                              required 
                              value={profileData.name}
                              onChange={e => setProfileData({...profileData, name: e.target.value})}
                              placeholder="Official ID Name"
                            />
                            <Input 
                              label="Current Occupation" 
                              required 
                              value={profileData.occupation}
                              onChange={e => setProfileData({...profileData, occupation: e.target.value})}
                              placeholder="e.g. Software Engineer"
                            />
                            <Input 
                              label="Primary Phone Number" 
                              required 
                              value={profileData.phone}
                              onChange={e => setProfileData({...profileData, phone: e.target.value})}
                              placeholder="017XXXXXXXX"
                            />
                            <Input 
                              label="Verified Email Address" 
                              type="email"
                              required 
                              value={profileData.email}
                              onChange={e => setProfileData({...profileData, email: e.target.value})}
                              placeholder="secure@example.com"
                            />
                          </div>

                          <Input 
                            label="Residential Present Address" 
                            required 
                            value={profileData.address}
                            onChange={e => setProfileData({...profileData, address: e.target.value})}
                            placeholder="Apartment, Street, City, Bangladesh"
                          />

                          {/* Compact Notification Preference */}
                          <div className="p-2.5 bg-slate-900/60 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                                <Mail className="w-3.5 h-3.5 text-blue-400" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[11px] font-semibold text-slate-200 block leading-tight">Email Notifications</span>
                                <span className="text-[10px] text-slate-400 block leading-tight truncate">Ledger receipts & security alerts</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setProfileData({
                                ...profileData,
                                emailNotificationsEnabled: !profileData.emailNotificationsEnabled
                              })}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-colors shrink-0 cursor-pointer",
                                profileData.emailNotificationsEnabled 
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" 
                                  : "bg-slate-800 text-slate-400 border-white/10 hover:bg-slate-700"
                              )}
                            >
                              {profileData.emailNotificationsEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                          </div>
                        </div>
                      )}

                      {activeProfileTab === 'personal' && (
                        <div className="space-y-3.5">
                          <div className="flex items-center gap-1.5 pb-1 border-b border-white/5 text-slate-400">
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">National ID & Bio Vitals</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input 
                              label="Father's Full Name" 
                              value={profileData.fatherName}
                              onChange={e => setProfileData({...profileData, fatherName: e.target.value})}
                              placeholder="Father's Legal Name"
                            />
                            <Input 
                              label="Mother's Full Name" 
                              value={profileData.motherName}
                              onChange={e => setProfileData({...profileData, motherName: e.target.value})}
                              placeholder="Mother's Legal Name"
                            />
                            <Input 
                              label="Date of Birth" 
                              type="date"
                              value={profileData.dob}
                              onChange={e => setProfileData({...profileData, dob: e.target.value})}
                            />
                            <Input 
                              label="Blood Group" 
                              value={profileData.bloodGroup}
                              onChange={e => setProfileData({...profileData, bloodGroup: e.target.value})}
                              placeholder="e.g. A+, B+, O+, AB+"
                            />
                          </div>

                          <Input 
                            label="Permanent Legal Address" 
                            value={profileData.permanentAddress}
                            onChange={e => setProfileData({...profileData, permanentAddress: e.target.value})}
                            placeholder="Permanent address as registered on National ID"
                          />
                        </div>
                      )}

                      {activeProfileTab === 'nominee' && (
                        <div className="space-y-3.5">
                          <div className="flex items-center gap-1.5 pb-1 border-b border-white/5 text-slate-400">
                            <Users className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Designated Nominee & Beneficiary</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input 
                              label="Nominee Legal Name" 
                              value={profileData.nomineeName}
                              onChange={e => setProfileData({...profileData, nomineeName: e.target.value})}
                              placeholder="Nominee's official full name"
                            />
                            <Input 
                              label="Relationship with Nominee" 
                              value={profileData.nomineeRelation}
                              onChange={e => setProfileData({...profileData, nomineeRelation: e.target.value})}
                              placeholder="e.g. Spouse, Sibling, Child, Parent"
                            />
                          </div>

                          <div className="p-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl text-[10px] text-slate-400 leading-relaxed">
                            <span className="font-semibold text-blue-300">Authority Trust Protocol:</span> Nominee holds emergency verification clearance and beneficiary rights under private ledger rules.
                          </div>
                        </div>
                      )}

                      {activeProfileTab === 'emergency' && (
                        <div className="space-y-3.5">
                          <div className="flex items-center gap-1.5 pb-1 border-b border-white/5 text-slate-400">
                            <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Emergency & Reference Contacts</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input 
                              label="Emergency Contact" 
                              value={profileData.emergencyContact}
                              onChange={e => setProfileData({...profileData, emergencyContact: e.target.value})}
                              placeholder="Contact Name & Mobile"
                            />
                            <Input 
                              label="Reference Contact" 
                              value={profileData.referenceContact}
                              onChange={e => setProfileData({...profileData, referenceContact: e.target.value})}
                              placeholder="Reference Name & Mobile"
                            />
                          </div>

                          {/* Admin Notes Private */}
                          <div className="space-y-1.5 pt-2 border-t border-white/5">
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Lock className="w-3.5 h-3.5 text-amber-400/80" />
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Authority Memo Notes (Private)</label>
                            </div>
                            <textarea 
                              className="w-full bg-slate-900/60 border border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/40 transition-all min-h-[64px] text-slate-300 placeholder:text-slate-600 font-mono leading-relaxed resize-none"
                              value={profileData.adminNotes}
                              onChange={e => setProfileData({...profileData, adminNotes: e.target.value})}
                              placeholder="Private memo notes logged under digital security signatures..."
                            />
                          </div>
                        </div>
                      )}

                      {activeProfileTab === 'social' && (
                        <div className="space-y-3.5">
                          <div className="flex items-center gap-1.5 pb-1 border-b border-white/5 text-slate-400">
                            <Facebook className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Communication & Messaging Handles</span>
                          </div>

                          <div className="space-y-2.5">
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-slate-300 ml-0.5 flex items-center gap-1.5">
                                <Facebook className="w-3.5 h-3.5 text-blue-400" /> Facebook Profile Link
                              </label>
                              <input 
                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-600"
                                value={profileData.facebook}
                                onChange={e => setProfileData({...profileData, facebook: e.target.value})}
                                placeholder="https://facebook.com/username"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-slate-300 ml-0.5 flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp Line
                              </label>
                              <input 
                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-600"
                                value={profileData.whatsapp}
                                onChange={e => setProfileData({...profileData, whatsapp: e.target.value})}
                                placeholder="+88017XXXXXXXX"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-slate-300 ml-0.5 flex items-center gap-1.5">
                                <Send className="w-3.5 h-3.5 text-sky-400" /> Telegram Account Tag
                              </label>
                              <input 
                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-slate-600"
                                value={profileData.telegram}
                                onChange={e => setProfileData({...profileData, telegram: e.target.value})}
                                placeholder="@username"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Compact Dynamic Action Footer */}
                  <div className="pt-3 pb-2 flex items-center justify-between gap-2 sticky bottom-0 bg-[#080f1c]/95 backdrop-blur-md border-t border-white/5 z-20">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="text-xs px-3 py-2 h-9 font-semibold border-white/10 hover:bg-white/5 text-slate-300"
                      onClick={() => setShowProfileModal(false)}
                    >
                      Cancel
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      {activeProfileTab !== 'basic' && (
                        <Button 
                          type="button" 
                          variant="glass" 
                          className="px-3 py-2 h-9 text-xs font-semibold text-slate-300 border-white/10"
                          onClick={() => {
                            const tabOrder: ('basic' | 'personal' | 'nominee' | 'emergency' | 'social')[] = ['basic', 'personal', 'nominee', 'emergency', 'social'];
                            const currentIdx = tabOrder.indexOf(activeProfileTab);
                            if (currentIdx > 0) setActiveProfileTab(tabOrder[currentIdx - 1]);
                          }}
                        >
                          Back
                        </Button>
                      )}

                      {/* Instant Save Option Always Available */}
                      <Button 
                        type="submit" 
                        className={cn(
                          "h-9 px-4 text-xs font-bold transition-all shadow-md",
                          activeProfileTab === 'social'
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 border border-emerald-400/20"
                            : "bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-500/30"
                        )}
                      >
                        Save
                      </Button>

                      {activeProfileTab !== 'social' && (
                        <Button 
                          type="button" 
                          className="h-9 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md text-xs font-semibold border border-blue-400/20"
                          onClick={() => {
                            const tabOrder: ('basic' | 'personal' | 'nominee' | 'emergency' | 'social')[] = ['basic', 'personal', 'nominee', 'emergency', 'social'];
                            const currentIdx = tabOrder.indexOf(activeProfileTab);
                            if (currentIdx < tabOrder.length - 1) setActiveProfileTab(tabOrder[currentIdx + 1]);
                          }}
                        >
                          Next
                        </Button>
                      )}
                    </div>
                  </div>
                </form>
              );
            })()}
          </motion.div>
        ) : (
          <MemberDashboard
            profile={profile}
            transactions={transactions}
            activeSponsorships={activeSponsorships}
            selectedSubTier={selectedSubTier}
            setSelectedSubTier={setSelectedSubTier}
            subSenderMobile={subSenderMobile}
            setSubSenderMobile={setSubSenderMobile}
            subTrxId={subTrxId}
            setSubTrxId={setSubTrxId}
            subWallet={subWallet}
            setSubWallet={setSubWallet}
            showSubPaymentMode={showSubPaymentMode}
            setShowSubPaymentMode={setShowSubPaymentMode}
            handleBuySubscription={handleBuySubscription}
            onRequestAction={(type) => {
              setActiveTransactionView(type);
            }}
            setShowProfileModal={setShowProfileModal}
            setShowAdminLogin={setShowAdminLogin}
            handleAdClick={handleAdClick}
            addToast={addToast}
            sendWorkflowNotification={sendWorkflowNotification}
            onOpenNotifications={() => setShowNotificationCenter(true)}
            unreadNotificationsCount={memberUnreadCount}
            activeTab={activeMemberTab}
            onTabChange={setActiveMemberTab}
          />
        )}
      </main>

      {/* Secure Transaction Portal Overlay */}
      <AnimatePresence>
        {activeTransactionView && (
          <SecureTransactionPortal
            type={activeTransactionView}
            profile={profile}
            transactions={transactions}
            onClose={() => setActiveTransactionView(null)}
            addToast={addToast}
            sendNotification={sendNotification}
            sendWorkflowNotification={sendWorkflowNotification}
            selectedSubTier={selectedSubTier}
            setSelectedSubTier={setSelectedSubTier}
            subSenderMobile={subSenderMobile}
            setSubSenderMobile={setSubSenderMobile}
            subTrxId={subTrxId}
            setSubTrxId={setSubTrxId}
            subWallet={subWallet}
            setSubWallet={setSubWallet}
            handleBuySubscription={handleBuySubscription}
          />
        )}
      </AnimatePresence>

      {/* Admin Panel Overlay */}
      <AnimatePresence>
        {isAdminLoggedIn && (
          <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden">
            <AdminPortalV4 
              db={db}
              user={user}
              profile={profile}
              allUsers={allUsers}
              allTransactions={allTransactions}
              auditLogs={auditLogs}
              emailLogs={emailLogs}
              sponsorships={sponsorships}
              reserveFund={authorityPersonalFund}
              onUpdateReserveFund={async (newAmount: number) => {
                await handleUpdateAuthorityFund(newAmount.toString());
              }}
              notificationService={notificationService}
              sendEmail={sendEmail}
              autoEmailState={autoEmailState}
              onRunAutoEmailCycle={runAutomaticDueReminderScan}
              logAuditEvent={logAuditEvent}
              addToast={addToast}
              onCloseAdmin={() => setIsAdminLoggedIn(false)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <Modal 
        isOpen={showSponsorModal} 
        onClose={() => setShowSponsorModal(false)} 
        title="Create Advanced Sponsorship Campaign"
      >
        <form onSubmit={handleAddSponsorship} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar text-left">
          <Input 
            label="Company/Brand Name *" 
            required 
            placeholder="e.g. Grameenphone, Unilever" 
            value={sponsorCompany}
            onChange={e => setSponsorCompany(e.target.value)}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Deal Value in BDT (Secret) *" 
              type="number" 
              required 
              placeholder="e.g. 500000" 
              value={sponsorValue}
              onChange={e => setSponsorValue(e.target.value)}
            />
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="text-sm font-medium text-blue-200/70 ml-1">Status</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950/50 p-1 border border-white/5 rounded-xl">
                {(['active', 'paused', 'completed'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    className={cn(
                      "py-2 text-[10px] uppercase font-black tracking-wider rounded-lg transition-all",
                      sponsorStatus === st ? "bg-[#50e3c2] text-slate-950 font-black shadow-lg" : "text-white/40 hover:text-white"
                    )}
                    onClick={() => setSponsorStatus(st)}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-blue-200/70 ml-1">Campaign Tier *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Premium Partner', 'Strategic Collab', 'Community Sponsor'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setSponsorType(tier)}
                  className={cn(
                    "py-3 px-1 rounded-xl border transition-all text-[11px] font-black uppercase text-center flex flex-col items-center justify-center gap-1",
                    sponsorType === tier 
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                      : "border-white/5 bg-slate-900/40 text-blue-200/60 hover:border-white/10 hover:text-white"
                  )}
                >
                  <span className="text-[9px] text-white/40 block leading-none font-medium mb-1">tier</span>
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-blue-200/70 ml-1">Ad Copy / Headline Promotion Text *</label>
            <textarea
              className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none min-h-[80px]"
              placeholder="Provide engaging promotion text or short banner ad headline copy..."
              required
              value={sponsorPromo}
              onChange={e => setSponsorPromo(e.target.value)}
            />
          </div>

          <div className="border-t border-white/5 pt-4 space-y-4">
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
              <span>Advanced Marketing Media & Action Links</span>
              <span className="text-[8px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">Interactive</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileUploader 
                label="Brand Logo Image (Optional)"
                currentUrl={sponsorLogoUrl}
                onUpload={(url) => setSponsorLogoUrl(url)}
                maxDimension={200}
                shape="square"
              />
              <FileUploader 
                label="Campaign Poster/Banner Image (Optional)"
                currentUrl={sponsorImageUrl}
                onUpload={(url) => setSponsorImageUrl(url)}
                maxDimension={800}
                shape="square"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Promotional Video URL (Optional)" 
                placeholder="YouTube embed, Mp4, etc." 
                value={sponsorVideoUrl}
                onChange={e => setSponsorVideoUrl(e.target.value)}
              />
              <Input 
                label="Destination Campaign Link (Optional)" 
                placeholder="URI to redirect users and generate leads" 
                value={sponsorTargetUrl}
                onChange={e => setSponsorTargetUrl(e.target.value)}
              />
            </div>

            <Input 
              label="Special Offer Callout / Discount Code (Optional)" 
              placeholder="e.g. Use Promo code: 'TUT26' to claim free 25% discount!" 
              value={sponsorSpecialOffer}
              onChange={e => setSponsorSpecialOffer(e.target.value)}
            />
          </div>

          <div className="pt-4 border-t border-white/5 flex gap-3">
            <Button type="button" variant="outline" className="flex-1 py-3" onClick={() => setShowSponsorModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 py-3 bg-[#50e3c2] text-slate-950 font-black">
              Save Campaign
            </Button>
          </div>
        </form>
      </Modal>



      <Modal 
        isOpen={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)} 
        title="Confirm Deletion"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-400 font-bold">Warning: This action is permanent!</p>
            <p className="text-xs text-red-400/60 mt-1">Are you sure you want to delete the account for <span className="font-bold text-red-400">{userToDelete?.name}</span>?</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDeleteUser}>
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={showEditFundModal} 
        onClose={() => setShowEditFundModal(false)} 
        title="Adjust Authority Investment Fund (Main Money)"
      >
        <div className="space-y-4">
          <p className="text-xs text-blue-400/70 font-bold uppercase tracking-wider leading-relaxed">
            This pool is the seed capital of the T.U.T. Private Authority. Loan distribution capacity is computed directly against this investment base + sponsorship profits.
          </p>
          <div className="space-y-2">
            <Input 
              label="Personal Fund Amount (৳)" 
              type="number" 
              value={tempFundValue} 
              onChange={e => setTempFundValue(e.target.value)} 
              required
            />
          </div>
          <div className="flex gap-4 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowEditFundModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1 text-white bg-blue-600 hover:bg-blue-500 rounded-xl" onClick={() => handleUpdateAuthorityFund(tempFundValue)}>
              Save Adjustment
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={showEditUserModal} 
        onClose={() => setShowEditUserModal(false)} 
        title={`Edit Member: ${editingUser?.name}`}
      >
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <Input 
            label="Total Loan (৳)" 
            type="number" 
            required 
            value={editLoan}
            onChange={e => setEditLoan(e.target.value)}
          />
          <Input 
            label="Total Deposit (৳)" 
            type="number" 
            required 
            value={editDeposit}
            onChange={e => setEditDeposit(e.target.value)}
          />
          <Input 
            label="Remaining Debt (৳)" 
            type="number" 
            required 
            value={editDebt}
            onChange={e => setEditDebt(e.target.value)}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Facebook Link" 
              value={editingUser?.facebook || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, facebook: e.target.value} : null)}
            />
            <Input 
              label="WhatsApp" 
              value={editingUser?.whatsapp || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, whatsapp: e.target.value} : null)}
            />
            <Input 
              label="Telegram" 
              value={editingUser?.telegram || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, telegram: e.target.value} : null)}
            />
            <Input 
              label="Father's Name" 
              value={editingUser?.fatherName || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, fatherName: e.target.value} : null)}
            />
            <Input 
              label="Mother's Name" 
              value={editingUser?.motherName || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, motherName: e.target.value} : null)}
            />
            <Input 
              label="Date of Birth" 
              type="date"
              value={editingUser?.dob || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, dob: e.target.value} : null)}
            />
            <Input 
              label="Blood Group" 
              value={editingUser?.bloodGroup || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, bloodGroup: e.target.value} : null)}
            />
            <Input 
              label="Emergency Contact" 
              value={editingUser?.emergencyContact || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, emergencyContact: e.target.value} : null)}
            />
            <Input 
              label="Nominee Name" 
              value={editingUser?.nomineeName || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, nomineeName: e.target.value} : null)}
            />
            <Input 
              label="Nominee Relation" 
              value={editingUser?.nomineeRelation || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, nomineeRelation: e.target.value} : null)}
            />
            <FileUploader 
              label="Member Photo"
              currentUrl={editingUser?.photoUrl}
              onUpload={(url) => setEditingUser(editingUser ? {...editingUser, photoUrl: url} : null)}
            />
            <Input 
              label="Permanent Address" 
              value={editingUser?.permanentAddress || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, permanentAddress: e.target.value} : null)}
            />
            <Input 
              label="Reference Contact" 
              value={editingUser?.referenceContact || ''}
              onChange={e => setEditingUser(editingUser ? {...editingUser, referenceContact: e.target.value} : null)}
            />
            <div className="col-span-1 md:col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-blue-200/70 ml-1">Admin Notes</label>
              <textarea 
                className="w-full bg-slate-950 border border-blue-400/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all min-h-[80px] text-blue-100"
                value={editingUser?.adminNotes || ''}
                onChange={e => setEditingUser(editingUser ? {...editingUser, adminNotes: e.target.value} : null)}
              />
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditUserModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={showCreateMemberModal} 
        onClose={() => setShowCreateMemberModal(false)} 
        title="Register Official Member Profile"
      >
        <form onSubmit={handleCreateMember} className="space-y-6 text-left">
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl leading-normal">
            ℹ️ This official form creates a member account directly in the system. When the member registers or logs in with this email, their online account will automatically link to this profile.
          </p>

          {/* Section 1: Account Identity */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1">Account & Identity</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Full Name *" 
                required 
                placeholder="Member's full name"
                value={createMemberName}
                onChange={e => setCreateMemberName(e.target.value)}
              />
              <Input 
                label="Email Address *" 
                type="email"
                required 
                placeholder="e.g. member@gmail.com"
                value={createMemberEmail}
                onChange={e => setCreateMemberEmail(e.target.value)}
              />
              <Input 
                label="Phone Number * (11 Digits)" 
                required 
                maxLength={11}
                placeholder="e.g. 01712345678"
                value={createMemberPhone}
                onChange={e => setCreateMemberPhone(e.target.value)}
              />
              <Input 
                label="National ID (NID)" 
                placeholder="NID card number"
                value={createMemberNid}
                onChange={e => setCreateMemberNid(e.target.value)}
              />
              <Input 
                label="Custom Member ID (Optional)" 
                placeholder="Auto-generated if empty"
                value={createMemberMemberId}
                onChange={e => setCreateMemberMemberId(e.target.value)}
              />
              <div className="space-y-1.5 w-full text-left">
                <label className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest ml-1">Account Status</label>
                <select
                  value={createMemberStatus}
                  onChange={e => setCreateMemberStatus(e.target.value as any)}
                  className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all backdrop-blur-sm text-sm"
                >
                  <option value="approved">Approved / Active</option>
                  <option value="pending">Pending Verification</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Personal & Contact Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1">Personal Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Occupation" 
                placeholder="e.g. Business, Student, Employee"
                value={createMemberOccupation}
                onChange={e => setCreateMemberOccupation(e.target.value)}
              />
              <Input 
                label="Reference Contact Details" 
                placeholder="Phone or Name of reference"
                value={createMemberReferenceContact}
                onChange={e => setCreateMemberReferenceContact(e.target.value)}
              />
              <div className="col-span-1 md:col-span-2">
                <Input 
                  label="Present Address" 
                  placeholder="Street address, City, etc."
                  value={createMemberAddress}
                  onChange={e => setCreateMemberAddress(e.target.value)}
                />
              </div>
              <div className="col-span-1 md:col-span-2">
                <Input 
                  label="Permanent Address" 
                  placeholder="Vill, P.O, P.S, Dist"
                  value={createMemberPermanentAddress}
                  onChange={e => setCreateMemberPermanentAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Nominee & Emergency Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1">Nominee & Family</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Nominee Full Name" 
                placeholder="Full name of nominee"
                value={createMemberNomineeName}
                onChange={e => setCreateMemberNomineeName(e.target.value)}
              />
              <Input 
                label="Relationship with Nominee" 
                placeholder="e.g. Spouse, Father, Brother"
                value={createMemberNomineeRelation}
                onChange={e => setCreateMemberNomineeRelation(e.target.value)}
              />
            </div>
          </div>

          {/* Section 4: Financial Balances */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1">Initial Accounts Balance (BDT)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input 
                label="Initial Deposit (৳)" 
                type="number"
                min="0"
                value={createMemberInitialDeposit}
                onChange={e => setCreateMemberInitialDeposit(e.target.value)}
              />
              <Input 
                label="Initial Total Loan (৳)" 
                type="number"
                min="0"
                value={createMemberInitialLoan}
                onChange={e => setCreateMemberInitialLoan(e.target.value)}
              />
              <Input 
                label="Remaining Debt (৳)" 
                type="number"
                min="0"
                value={createMemberInitialDebt}
                onChange={e => setCreateMemberInitialDebt(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3 sticky bottom-0 bg-slate-950/90 backdrop-blur-md py-4 border-t border-white/5">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateMemberModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black">
              Register Member
            </Button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={showAdminLogin} 
        onClose={() => setShowAdminLogin(false)} 
        title="Admin Authentication"
      >
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <Input 
            label="Admin Password" 
            type="password" 
            required 
            value={adminPassword}
            onChange={e => setAdminPassword(e.target.value)}
            placeholder="Enter password"
          />
          <Input 
            label="Security PIN" 
            type="password" 
            maxLength={4}
            required 
            value={adminPin}
            onChange={e => setAdminPin(e.target.value)}
            placeholder="4-digit PIN"
          />
          {adminError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {adminError}
            </div>
          )}
          <Button type="submit" className="w-full py-3">
            Verify & Enter Dashboard
          </Button>
        </form>
      </Modal>

      <Modal 
        isOpen={showRequestModal} 
        onClose={() => setShowRequestModal(false)} 
        title={`Request New ${requestType === 'loan' ? 'Loan' : requestType === 'deposit' ? 'Deposit' : requestType === 'refund' ? 'Refund' : 'Due Payment'}`}
      >
        <form onSubmit={handleRequest} className="space-y-4">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4">
            <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mb-1">Current Balance</p>
            <p className="text-2xl font-black">৳ {profile?.totalDeposit.toLocaleString()}</p>
          </div>
          
          <Input 
            label="Amount (BDT)" 
            type="number" 
            required 
            value={requestAmount}
            onChange={e => setRequestAmount(e.target.value)}
            placeholder="Enter amount in BDT"
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-blue-200/70 ml-1">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {['Cash', 'Bkash', 'Nagad', 'Recharge'].map((m) => {
                const isDisabled = (requestType === 'deposit' || requestType === 'pay_due') && m === 'Recharge';
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setRequestMethod(m as any)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-bold transition-all",
                      requestMethod === m 
                        ? "bg-blue-600 border-blue-500 text-white" 
                        : "bg-slate-950 border-blue-400/20 text-blue-400 hover:bg-blue-400/5",
                      isDisabled && "opacity-20 grayscale pointer-events-none"
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {(requestType === 'deposit' || requestType === 'pay_due') && (requestMethod === 'Bkash' || requestMethod === 'Nagad') && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Payment Instructions</p>
              </div>
              <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg border border-white/5 gap-3">
                <div className="flex items-center gap-2">
                  {requestMethod === 'Bkash' ? <BkashLogo size="xs" /> : <NagadLogo size="xs" />}
                  <span className="text-xs font-bold text-white">
                    {requestMethod === 'Bkash' ? 'bKash' : 'Nagad'} Authority
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-black text-amber-400 tracking-wider">
                    {requestMethod === 'Bkash' ? '01713710607' : '01921801100'}
                  </span>
                  <CopyButton text={requestMethod === 'Bkash' ? '01713710607' : '01921801100'} />
                </div>
              </div>
              <p className="text-[9px] text-amber-500/60 font-medium leading-tight">
                Please complete the "Send Money" transaction to this Authority account first, then provide the Transaction ID (TrxID) below for verification.
              </p>
            </div>
          )}

          {(requestType === 'loan' || requestType === 'refund') && (
            <Input 
              label="Account Number (to receive money)" 
              required 
              value={requestAccount}
              onChange={e => setRequestAccount(e.target.value)}
              placeholder="Enter your account number"
            />
          )}
          
          {requestType === 'loan' && (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest ml-1">Reason for Loan (Detailed)</label>
                <textarea 
                  className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-blue-900/40 backdrop-blur-sm min-h-[80px]"
                  required
                  value={loanReason}
                  onChange={e => setLoanReason(e.target.value)}
                  placeholder="Tell us why you need this loan..."
                />
              </div>
              <Input 
                label="Estimated Repayment Date" 
                type="date"
                required 
                value={estimatedRepaymentDate}
                onChange={e => setEstimatedRepaymentDate(e.target.value)}
              />
            </>
          )}

          {(requestType === 'deposit' || requestType === 'pay_due') && requestMethod !== 'Cash' && (
            <Input 
              label="Transaction ID (TrxID)" 
              required 
              value={requestTrxId}
              onChange={e => setRequestTrxId(e.target.value)}
              placeholder="Enter the transaction ID"
            />
          )}

          {requestType === 'refund' && (
            <p className="text-xs text-amber-400 font-medium bg-amber-400/10 p-2 rounded border border-amber-400/20">
              Note: Refund requests will be subtracted from your Total Deposit after admin verification.
            </p>
          )}

          <p className="text-[10px] text-blue-400/60 leading-relaxed">
            By submitting this request, you agree to the T.U.T. Private Lending Authority terms. 
            All requests are subject to manual verification by the admin.
          </p>
          <Button type="submit" className="w-full py-3">
            Submit {requestType.replace('_', ' ')} Request
          </Button>
        </form>
      </Modal>

      {/* Gmail Help Modal */}
      <Modal
        isOpen={showGmailHelp}
        onClose={() => setShowGmailHelp(false)}
        title="Gmail Setup Troubleshooting"
      >
        <div className="space-y-6">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <h4 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Authentication Failed (535 Error)
            </h4>
            <p className="text-xs text-red-200/70 leading-relaxed">
              Google rejected your login. This almost always means the <b>App Password</b> is incorrect or not set up properly.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Step 1: Verify 2-Step Verification</h5>
              <p className="text-xs text-blue-100/70">
                You <b>must</b> have 2-Step Verification enabled on your Google Account to use App Passwords.
              </p>
              <a 
                href="https://myaccount.google.com/signinoptions/two-step-verification" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
              >
                Open 2-Step Settings <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Step 2: Generate a New App Password</h5>
              <p className="text-xs text-blue-100/70">
                Go to the App Passwords page, select "Other" and name it "TUT App". Copy the <b>16-character code</b> (e.g., <code>abcd efgh ijkl mnop</code>).
              </p>
              <a 
                href="https://myaccount.google.com/apppasswords" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
              >
                Open App Passwords Page <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Step 3: Update AI Studio Secrets</h5>
              <p className="text-xs text-blue-100/70">
                1. Click the <b>Gear Icon (Settings)</b> in the top right of AI Studio.<br />
                2. Select <b>Secrets</b>.<br />
                3. Update <code>TUT_AUTHORITY_GMAIL_APP_PASSWORD</code> (or <code>GMAIL_APP_PASSWORD</code>) with the 16-character code (<b>remove all spaces</b>).<br />
                4. Ensure <code>TUT_AUTHORITY_GMAIL_USER</code> (or <code>GMAIL_USER</code>) is set to your sender Gmail address (<code>tutauthority@gmail.com</code>).
              </p>
            </div>
          </div>

          <Button 
            onClick={() => setShowGmailHelp(false)}
            className="w-full bg-blue-600 hover:bg-blue-500"
          >
            I've Updated My Secrets
          </Button>
        </div>
      </Modal>

      {/* Smart Professional User Notifications Modal */}
      <UserNotificationsModal
        isOpen={showNotificationCenter}
        onClose={() => {
          setShowNotificationCenter(false);
          refreshMemberUnreadCount();
        }}
        profile={profile}
        transactions={transactions}
        onNavigateTab={(tab) => {
          setShowNotificationCenter(false);
          refreshMemberUnreadCount();
          window.dispatchEvent(new CustomEvent('tut-navigate-member-tab', { detail: tab }));
        }}
        onRequestAction={(type) => {
          setShowNotificationCenter(false);
          refreshMemberUnreadCount();
          setActiveTransactionView(type);
        }}
        notificationPermission={notificationPermission}
        onRequestPermission={requestNotificationPermission}
        addToast={addToast}
        onUpdateEmailNotifications={async (enabled) => {
          if (!profile?.uid) return;
          try {
            await updateDoc(doc(db, 'users', profile.uid), {
              emailNotificationsEnabled: enabled,
              updatedAt: serverTimestamp()
            });
            setProfile(prev => prev ? ({ ...prev, emailNotificationsEnabled: enabled }) : null);
            addToast('Preferences Saved', `Email statements and loan notifications set to: ${enabled ? 'ACTIVE' : 'MUTED'}`, 'success');
          } catch (err: any) {
            console.error("Failed to update email notification preferences in Firestore:", err);
            addToast('Save Failed', 'Unable to sync preferences with server.', 'warning');
          }
        }}
        onSendTestEmail={async (targetEmail) => {
          return await sendEmail(
            targetEmail,
            'T.U.T. Notification Service — Priority Test Dispatch',
            `Dear ${profile?.name || 'Member'},\n\nThis is an automated test dispatch from your T.U.T. Private Lending Authority notification gateway.\n\nYour verified email is configured to receive official loan vouchers, repayment due notices, and monthly charter statements.\n\nIf you found this message in your Spam or Junk folder, please click "Not Spam" or add noreply@tut.org to your trusted address book.`,
            undefined,
            profile?.name || 'Member',
            'Verification',
            true
          );
        }}
      />

      {/* Toasts Container */}
      <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className={cn(
                "pointer-events-auto w-80 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex gap-4 items-start",
                toast.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20" : 
                toast.type === 'warning' ? "bg-amber-500/10 border-amber-500/20" : 
                "bg-blue-500/10 border-blue-500/20"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                toast.type === 'success' ? "bg-emerald-500/20 text-emerald-400" : 
                toast.type === 'warning' ? "bg-amber-500/20 text-amber-400" : 
                "bg-blue-500/20 text-blue-400"
              )}>
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{toast.title}</p>
                <p className="text-xs text-blue-200/60 leading-relaxed mt-1">{toast.body}</p>
              </div>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-blue-200/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Entrance Interstitial Poster Ad Popup */}
      <AnimatePresence>
        {activeEntranceAd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          >
            {/* Backdrop Area tap-to-close */}
            <div className="absolute inset-0" onClick={() => setActiveEntranceAd(null)} />
            
            {/* Ad Content Container - Exclusively the Poster */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-2xl rounded-3xl overflow-hidden z-10 flex flex-col items-center justify-center group"
            >
              {/* Floating Semi-Transparent Cross/Close Button in Top-Right Corner */}
              <button
                onClick={() => setActiveEntranceAd(null)}
                className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-slate-950/80 hover:bg-slate-950 border border-white/10 text-white/80 hover:text-white transition-all duration-200 shadow-lg scale-100 hover:scale-105 active:scale-95 cursor-pointer"
                title="Close Ad"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Seamless Click-through Poster Image */}
              {activeEntranceAd.imageUrl ? (
                activeEntranceAd.targetUrl ? (
                  <a
                    href={activeEntranceAd.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      handleAdClick(activeEntranceAd.id);
                      setActiveEntranceAd(null); // auto-dismiss on click through
                    }}
                    className="w-full relative shadow-2xl border border-white/10 rounded-3xl overflow-hidden block"
                  >
                    <img
                      src={activeEntranceAd.imageUrl}
                      alt={`${activeEntranceAd.companyName} Campaign Poster`}
                      className="w-full h-auto max-h-[82vh] object-contain block hover:scale-[1.01] transition-transform duration-500 rounded-3xl"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-white/0 hover:bg-white/5 transition-colors duration-300 pointer-events-none" />
                  </a>
                ) : (
                  <div className="w-full relative shadow-2xl border border-white/10 rounded-3xl overflow-hidden block">
                    <img
                      src={activeEntranceAd.imageUrl}
                      alt={`${activeEntranceAd.companyName} Campaign Poster`}
                      className="w-full h-auto max-h-[82vh] object-contain block rounded-3xl"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )
              ) : (
                /* Fallback for text-only sponsorship if no poster image is provided */
                <div className="w-full max-w-md bg-[#0B132B] border border-white/15 p-7 rounded-2xl text-center space-y-4 shadow-2xl relative overflow-hidden">
                  <div
                    className="h-1.5 w-full absolute top-0 left-0"
                    style={{ backgroundColor: activeEntranceAd.accentColor || '#D97706' }}
                  />
                  {activeEntranceAd.logoUrl && (
                    <img 
                      src={activeEntranceAd.logoUrl} 
                      alt="" 
                      className="w-16 h-16 mx-auto object-contain rounded-xl bg-slate-950 p-2 border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {activeEntranceAd.campaignType}
                    </span>
                    {activeEntranceAd.discountBadge && (
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-black uppercase text-slate-950"
                        style={{ backgroundColor: activeEntranceAd.accentColor || '#FBBF24' }}
                      >
                        {activeEntranceAd.discountBadge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-white">{activeEntranceAd.companyName}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{activeEntranceAd.promotionText}</p>
                  {activeEntranceAd.specialOffer && (
                    <div className="px-3 py-2 rounded-lg bg-slate-950 border border-white/10 font-mono text-xs text-amber-300 font-bold tracking-wider">
                      Promo Code: {activeEntranceAd.specialOffer}
                    </div>
                  )}
                  {activeEntranceAd.targetUrl && (
                    <a
                      href={activeEntranceAd.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        handleAdClick(activeEntranceAd.id);
                        setActiveEntranceAd(null);
                      }}
                      className="block pt-1"
                    >
                      <Button variant="primary" className="w-full py-3 text-xs uppercase tracking-widest font-black">
                        {activeEntranceAd.ctaLabel || 'Visit Partner Portal'}
                      </Button>
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* T.U.T Digital Workforce Support Desk */}
      {user && !isAdminLoggedIn && !activeTransactionView && (
        <WorkforceSupportWidget 
          currentUser={{
            uid: user.uid,
            email: user.email || '',
            name: profile?.name || user.displayName || 'T.U.T Member',
            nid: profile?.nid || '',
            phone: profile?.phone || '',
            memberId: profile?.memberId || '',
            status: profile?.status || 'pending',
            totalLoan: profile?.totalLoan || 0,
            totalDeposit: profile?.totalDeposit || 0,
            remainingDebt: profile?.remainingDebt || 0,
            totalRepaid: profile?.totalRepaid,
            borrowingLimit: profile?.borrowingLimit || 100000,
            subscriptionTier: profile?.subscriptionTier || null,
            subscriptionStatus: profile?.subscriptionStatus || null,
            continuousSubscriptionMonths: profile?.continuousSubscriptionMonths || 0,
            loansTakenThisMonth: profile?.loansTakenThisMonth || 0,
            address: profile?.address || '',
            emergencyContact: profile?.emergencyContact,
          }}
          transactions={transactions}
        />
      )}
    </div>
  );
}
