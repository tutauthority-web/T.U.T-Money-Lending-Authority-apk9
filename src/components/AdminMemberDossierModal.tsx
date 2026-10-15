import React, { useState, useMemo, useRef } from 'react';
import { 
  User, 
  UserCheck, 
  Shield, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  Wallet, 
  FileText, 
  ExternalLink, 
  X, 
  Check, 
  ArrowLeft, 
  RefreshCw, 
  AlertTriangle, 
  Sparkles, 
  Building2, 
  Upload, 
  Eye, 
  Clock, 
  Award, 
  History, 
  Landmark, 
  Send, 
  Users, 
  ChevronRight,
  CheckCircle2,
  Lock,
  FileCheck
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { UserProfile, Transaction } from '../App';
import { calculateMemberLoanAllocations } from '../utils/loanAllocationEngine';
import { MemberLoanHistoryCard } from './MemberLoanHistoryCard';

export interface AdminMemberDossierModalProps {
  member: UserProfile;
  onClose: () => void;
  onSave: (updated: Partial<UserProfile>) => Promise<void>;
  allTransactions?: Transaction[];
  db?: any;
  onSettleDebt?: (userId: string) => Promise<void>;
}

export const AdminMemberDossierModal: React.FC<AdminMemberDossierModalProps> = ({
  member,
  onClose,
  onSave,
  allTransactions = [],
  db,
  onSettleDebt
}) => {
  // Tabs for structured, high-clarity navigation
  const [activeTab, setActiveTab] = useState<'identity' | 'financials' | 'documents' | 'address' | 'nominee' | 'history'>('identity');

  // Core Identity State
  const [name, setName] = useState(member.name || '');
  const [nid, setNid] = useState(member.nid || '');
  const [memberId, setMemberId] = useState(member.memberId || '');
  const [email, setEmail] = useState(member.email || '');
  const [phone, setPhone] = useState(member.phone || '');
  const [occupation, setOccupation] = useState(member.occupation || '');
  const [fatherName, setFatherName] = useState(member.fatherName || '');
  const [motherName, setMotherName] = useState(member.motherName || '');
  const [dob, setDob] = useState(member.dob || '');
  const [bloodGroup, setBloodGroup] = useState(member.bloodGroup || '');
  const [photoUrl, setPhotoUrl] = useState(member.photoUrl || '');
  const [status, setStatus] = useState<'approved' | 'pending' | 'rejected'>(member.status || 'pending');
  const [role, setRole] = useState<'admin' | 'member'>(member.role || 'member');

  // Address & Socials
  const [address, setAddress] = useState(member.address || '');
  const [permanentAddress, setPermanentAddress] = useState(member.permanentAddress || '');
  const [facebook, setFacebook] = useState(member.facebook || '');
  const [whatsapp, setWhatsapp] = useState(member.whatsapp || '');
  const [telegram, setTelegram] = useState(member.telegram || '');

  // Financial States
  const [borrowingLimit, setBorrowingLimit] = useState(member.borrowingLimit ?? 100000);
  const [totalLoan, setTotalLoan] = useState(member.totalLoan ?? 0);
  const [totalDeposit, setTotalDeposit] = useState(member.totalDeposit ?? 0);
  const [remainingDebt, setRemainingDebt] = useState(member.remainingDebt ?? 0);
  const [totalRepaid, setTotalRepaid] = useState(member.totalRepaid ?? 0);

  // Nominee & Emergency Contacts
  const [emergencyContact, setEmergencyContact] = useState(member.emergencyContact || '');
  const [referenceContact, setReferenceContact] = useState(member.referenceContact || '');
  const [nomineeName, setNomineeName] = useState(member.nomineeName || '');
  const [nomineeRelation, setNomineeRelation] = useState(member.nomineeRelation || '');
  const [adminNotes, setAdminNotes] = useState(member.adminNotes || '');

  // Subscription & Settings
  const [subscriptionTier, setSubscriptionTier] = useState<'bronze' | 'silver' | 'gold' | null>(member.subscriptionTier || null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'expired' | 'pending_approval' | null>(member.subscriptionStatus || null);
  const [continuousSubscriptionMonths, setContinuousSubscriptionMonths] = useState(member.continuousSubscriptionMonths || 0);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(member.emailNotificationsEnabled !== false);

  // Documents
  const [documents, setDocuments] = useState<Record<string, string>>({
    nidFront: member.documents?.nidFront || '',
    nidBack: member.documents?.nidBack || '',
    payslip: member.documents?.payslip || '',
    utilityBill: member.documents?.utilityBill || '',
    bankStatement: member.documents?.bankStatement || ''
  });

  // UI state
  const [saving, setSaving] = useState(false);
  const [docPreview, setDocPreview] = useState<{ url: string; title: string } | null>(null);
  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetUploadKey, setTargetUploadKey] = useState<'photo' | string>('photo');

  // Member Transactions (sorted newest-first: new-to-old wise)
  const memberTransactions = useMemo(() => {
    return allTransactions
      .filter(t => t.userId === member.uid || t.accountNumber === member.email)
      .sort((a, b) => {
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
  }, [allTransactions, member.uid, member.email]);

  // Member Loan Summary using chronological allocation engine
  const memberLoanSummary = useMemo(() => {
    return calculateMemberLoanAllocations(member.uid, memberTransactions, {
      ...member,
      remainingDebt: Number(remainingDebt) || 0,
      totalLoan: Number(totalLoan) || 0,
      totalRepaid: Number(totalRepaid) || 0
    });
  }, [member.uid, memberTransactions, member, remainingDebt, totalLoan, totalRepaid]);

  // Safe Date Formatter helper
  const safeFormat = (val: any, formatStr: string = 'dd MMM yyyy, HH:mm') => {
    try {
      if (!val) return 'N/A';
      let d: Date;
      if (typeof val?.toDate === 'function') {
        d = val.toDate();
      } else if (val?.seconds) {
        d = new Date(val.seconds * 1000);
      } else if (val instanceof Date) {
        d = val;
      } else {
        d = new Date(val);
      }
      return isValid(d) ? format(d, formatStr) : 'N/A';
    } catch {
      return 'N/A';
    }
  };

  // Auto-generate Member ID if missing
  const handleGenerateMemberId = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newId = `TUT-${randomNum}`;
    setMemberId(newId);
  };

  // Image Upload with client compression
  const handleImageUpload = (file: File, target: 'photo' | string) => {
    if (file.size > 8 * 1024 * 1024) {
      alert("File size must be less than 8MB");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = target === 'photo' ? 400 : 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          if (target === 'photo') {
            setPhotoUrl(dataUrl);
          } else {
            setDocuments(prev => ({ ...prev, [target]: dataUrl }));
          }
        }
        setUploadingDocKey(null);
      };
      img.onerror = () => {
        alert("Failed to load image file.");
        setUploadingDocKey(null);
      };
    };
  };

  // Handle Form Save
  const handleFormSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<UserProfile> = {
        name: name.trim(),
        nid: nid.trim(),
        memberId: memberId.trim() || undefined,
        email: email.trim(),
        phone: phone.trim(),
        occupation: occupation.trim(),
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        dob,
        bloodGroup: bloodGroup.trim(),
        photoUrl,
        status,
        role,
        address: address.trim(),
        permanentAddress: permanentAddress.trim(),
        facebook: facebook.trim(),
        whatsapp: whatsapp.trim(),
        telegram: telegram.trim(),
        borrowingLimit: subscriptionTier === 'gold' 
          ? Math.max(2500, Number(borrowingLimit) || 0) 
          : subscriptionTier === 'silver' 
          ? Math.max(1500, Number(borrowingLimit) || 0) 
          : (Number(borrowingLimit) || 500),
        totalLoan: Number(totalLoan) || 0,
        totalDeposit: Number(totalDeposit) || 0,
        remainingDebt: Number(remainingDebt) || 0,
        totalRepaid: Number(totalRepaid) || 0,
        emergencyContact: emergencyContact.trim(),
        referenceContact: referenceContact.trim(),
        nomineeName: nomineeName.trim(),
        nomineeRelation: nomineeRelation.trim(),
        adminNotes: adminNotes.trim(),
        subscriptionTier,
        subscriptionStatus: subscriptionStatus || 'active',
        subscriptionExpiresAt: member.subscriptionExpiresAt && new Date(member.subscriptionExpiresAt) > new Date()
          ? member.subscriptionExpiresAt
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        continuousSubscriptionMonths: Number(continuousSubscriptionMonths) || 0,
        emailNotificationsEnabled,
        documents: {
          ...member.documents,
          ...documents
        }
      };

      await onSave(payload);
    } catch (err) {
      console.error("Failed to save member profile dossier:", err);
    } finally {
      setSaving(false);
    }
  };

  // Quick Settle Debt
  const handleQuickSettleDebt = async () => {
    if (confirm("Are you sure you want to clear remaining debt for this member to ৳0 BDT?")) {
      setRemainingDebt(0);
      if (onSettleDebt) {
        await onSettleDebt(member.uid);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md overflow-y-auto p-3 sm:p-5 flex items-start sm:items-center justify-center">
      {/* Hidden file input for uploads */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImageUpload(file, targetUploadKey);
          }
          e.target.value = '';
        }}
      />

      <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-left relative animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* ================================================================ */}
        {/* MODAL HEADER                                                     */}
        {/* ================================================================ */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            {/* Avatar with click to change */}
            <div 
              onClick={() => {
                setTargetUploadKey('photo');
                fileInputRef.current?.click();
              }}
              className="relative w-12 h-12 rounded-full bg-blue-600/30 border-2 border-blue-500/50 flex items-center justify-center cursor-pointer group shrink-0 overflow-hidden"
              title="Click to change profile picture"
            >
              {photoUrl ? (
                <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-base font-black text-white">
                  {name ? name.substring(0, 2).toUpperCase() : 'MB'}
                </span>
              )}
              <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Upload className="w-4 h-4 text-white" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">{name || 'Unnamed Member'}</h2>
                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-full border ${
                  status === 'approved' 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : status === 'pending'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {status === 'approved' ? 'Approved Citizen' : status === 'pending' ? 'Verification Queue' : 'Suspended / Rejected'}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {role === 'admin' ? 'Administrator' : 'Citizen Member'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5 flex-wrap">
                <span className="text-blue-400 font-bold">{memberId || 'ID: PENDING'}</span>
                <span>•</span>
                <span>{email || member.uid}</span>
                <span>•</span>
                <span>{phone || 'No phone'}</span>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button 
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleFormSave}
              disabled={saving}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Save Dossier
                </>
              )}
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Profile"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================================================================ */}
        {/* TAB SWITCHER                                                     */}
        {/* ================================================================ */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 pb-2 border-b border-white/10 bg-slate-950/40 overflow-x-auto custom-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('identity')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'identity' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>1. Identity & Role</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('financials')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'financials' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>2. Financials & Debt</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'documents' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>3. KYC Documents ({Object.values(documents).filter(Boolean).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('address')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'address' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>4. Address & Social</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('nominee')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'nominee' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>5. Nominee & Notes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>6. Ledger History ({memberTransactions.length})</span>
          </button>
        </div>

        {/* ================================================================ */}
        {/* TAB CONTENTS (SCROLLABLE)                                        */}
        {/* ================================================================ */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* TAB 1: IDENTITY & ROLE */}
          {activeTab === 'identity' && (
            <div className="space-y-5">
              {/* Account Status & Role Controls */}
              <div className="bg-slate-950 p-4 rounded-xl border border-white/10 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Authority & Verification State
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Account Status
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setStatus('approved')}
                        className={`py-2 px-2 text-xs font-bold rounded-lg border transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          status === 'approved' 
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' 
                            : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus('pending')}
                        className={`py-2 px-2 text-xs font-bold rounded-lg border transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          status === 'pending' 
                            ? 'bg-amber-600 text-white border-amber-500 shadow-sm' 
                            : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" /> Pending
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus('rejected')}
                        className={`py-2 px-2 text-xs font-bold rounded-lg border transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          status === 'rejected' 
                            ? 'bg-rose-600 text-white border-rose-500 shadow-sm' 
                            : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" /> Rejected
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Syndicate System Role
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('member')}
                        className={`py-2 px-3 text-xs font-bold rounded-lg border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                          role === 'member' 
                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm' 
                            : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        <User className="w-3.5 h-3.5" /> Citizen Member
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('admin')}
                        className={`py-2 px-3 text-xs font-bold rounded-lg border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                          role === 'admin' 
                            ? 'bg-purple-600 text-white border-purple-500 shadow-sm' 
                            : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" /> Administrator
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Identity Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Full Name *</label>
                  <input 
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Tahsin Ullah Tusher"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                    <span>Member ID / Code</span>
                    <button
                      type="button"
                      onClick={handleGenerateMemberId}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-bold"
                    >
                      Generate New ID
                    </button>
                  </label>
                  <input 
                    type="text"
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    placeholder="e.g. TUT-1048"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Registered Email</label>
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="member@gmail.com"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number</label>
                  <input 
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+8801700000000"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">National ID (NID)</label>
                  <input 
                    type="text"
                    value={nid}
                    onChange={(e) => setNid(e.target.value)}
                    placeholder="e.g. 8273618492"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Occupation / Profession</label>
                  <input 
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. Software Engineer, Trader"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Father's Name</label>
                  <input 
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="Father's full name"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Mother's Name</label>
                  <input 
                    type="text"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="Mother's full name"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Date of Birth</label>
                  <input 
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Blood Group</label>
                  <input 
                    type="text"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    placeholder="e.g. A+, B+, O+, AB-"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FINANCIALS & DEBT */}
          {activeTab === 'financials' && (
            <div className="space-y-5">
              {/* Debt Overview Banner */}
              <div className="bg-slate-950 p-4 rounded-xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Active Member Debt Balance</span>
                  <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">৳{remainingDebt.toLocaleString()} BDT</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {remainingDebt > 0 ? 'Member currently has unsettled loan debt' : 'No active outstanding debt due'}
                  </p>
                </div>

                {remainingDebt > 0 && (
                  <button
                    type="button"
                    onClick={handleQuickSettleDebt}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Clear Remaining Debt to ৳0
                  </button>
                )}
              </div>

              {/* Individual Loan Allocation Summary Card */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Live Loan Allocation Breakdown
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {memberLoanSummary.activeLoans} Active • {memberLoanSummary.completedLoans} Settled
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Total Borrowed</span>
                    <span className="text-xs sm:text-sm font-black text-white font-mono">৳{memberLoanSummary.totalBorrowed.toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Total Repaid</span>
                    <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">৳{memberLoanSummary.totalRepaid.toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Outstanding Debt</span>
                    <span className="text-xs sm:text-sm font-black text-amber-400 font-mono">৳{memberLoanSummary.totalOutstanding.toLocaleString()}</span>
                  </div>
                </div>

                {remainingDebt !== memberLoanSummary.totalOutstanding && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 gap-2 border-t border-white/5">
                    <span className="text-[11px] text-amber-300">
                      Calculated loan balance (৳{memberLoanSummary.totalOutstanding.toLocaleString()}) differs from stored profile field (৳{remainingDebt.toLocaleString()}).
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRemainingDebt(memberLoanSummary.totalOutstanding);
                        setTotalRepaid(memberLoanSummary.totalRepaid);
                        setTotalLoan(memberLoanSummary.totalBorrowed);
                      }}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                    >
                      Sync with Engine (৳{memberLoanSummary.totalOutstanding.toLocaleString()})
                    </button>
                  </div>
                )}
              </div>

              {/* Financial Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Maximum Borrowing Limit (৳ BDT)
                  </label>
                  <input 
                    type="number"
                    value={borrowingLimit}
                    onChange={(e) => setBorrowingLimit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500">Ceiling of authorized debt available to this member</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Active Outstanding Debt (৳ BDT)
                  </label>
                  <input 
                    type="number"
                    value={remainingDebt}
                    onChange={(e) => setRemainingDebt(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-amber-400 font-mono font-bold placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500">Directly drives overdue alert banners and risk stats</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Cumulative Loans (৳ BDT)
                  </label>
                  <input 
                    type="number"
                    value={totalLoan}
                    onChange={(e) => setTotalLoan(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Member Deposits (৳ BDT)
                  </label>
                  <input 
                    type="number"
                    value={totalDeposit}
                    onChange={(e) => setTotalDeposit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-purple-300 font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500">Segregated vault savings</span>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Repaid to Syndicate (৳ BDT)
                  </label>
                  <input 
                    type="number"
                    value={totalRepaid}
                    onChange={(e) => setTotalRepaid(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Ratios & Credit File Note */}
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-white/10 text-xs flex items-center justify-between">
                <span className="text-slate-400">Syndicate Debt Coverage Ratio:</span>
                <span className={`font-mono font-bold ${totalDeposit >= remainingDebt ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {remainingDebt === 0 ? '100% Unencumbered' : totalDeposit > 0 ? `${((totalDeposit / remainingDebt) * 100).toFixed(1)}% Coverage` : 'Unbacked Debt'}
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: KYC DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-white">KYC Verification Files & Identity Attachments</h3>
                  <p className="text-xs text-slate-400">Click any document to inspect full-screen or upload updated proof.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: 'nidFront', label: 'National ID (Front)', url: documents.nidFront },
                  { key: 'nidBack', label: 'National ID (Back)', url: documents.nidBack },
                  { key: 'payslip', label: 'Income Payslip / Proof', url: documents.payslip },
                  { key: 'utilityBill', label: 'Utility Bill (Address Proof)', url: documents.utilityBill },
                  { key: 'bankStatement', label: 'Bank Statement', url: documents.bankStatement }
                ].map((item) => (
                  <div key={item.key} className="bg-slate-950 border border-white/10 rounded-xl p-3 space-y-2 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 truncate">{item.label}</span>
                      {item.url ? (
                        <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black uppercase">
                          Attached
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded text-[9px] font-bold uppercase">
                          Empty
                        </span>
                      )}
                    </div>

                    <div className="h-36 bg-slate-900 rounded-lg border border-white/5 flex items-center justify-center overflow-hidden relative">
                      {item.url ? (
                        <>
                          <img src={item.url} alt={item.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div 
                            onClick={() => setDocPreview({ url: item.url!, title: item.label })}
                            className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                          >
                            <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> View Full
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-3 text-slate-500 space-y-1">
                          <FileText className="w-6 h-6 mx-auto opacity-40" />
                          <span className="text-[10px] block">No document uploaded</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      {item.url && (
                        <button
                          type="button"
                          onClick={() => setDocPreview({ url: item.url!, title: item.label })}
                          className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> Inspect
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setTargetUploadKey(item.key);
                          fileInputRef.current?.click();
                        }}
                        className="flex-1 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" /> {item.url ? 'Replace' : 'Upload'}
                      </button>
                      {item.url && (
                        <button
                          type="button"
                          onClick={() => setDocuments(prev => ({ ...prev, [item.key]: '' }))}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remove document"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ADDRESS & SOCIAL */}
          {activeTab === 'address' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Present Living Address</label>
                <textarea 
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House, Road, Area, City, Postcode"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Permanent Village / Home Address</label>
                <textarea 
                  rows={2}
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  placeholder="Village, Post Office, Police Station, District"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/10">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Facebook Profile Link</label>
                  <input 
                    type="text"
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    placeholder="https://facebook.com/..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">WhatsApp Number</label>
                  <input 
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+8801700000000"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Telegram Username</label>
                  <input 
                    type="text"
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    placeholder="@username"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NOMINEE & NOTES */}
          {activeTab === 'nominee' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Nominee Full Name</label>
                  <input 
                    type="text"
                    value={nomineeName}
                    onChange={(e) => setNomineeName(e.target.value)}
                    placeholder="e.g. Nominee Full Name"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Nominee Relationship</label>
                  <input 
                    type="text"
                    value={nomineeRelation}
                    onChange={(e) => setNomineeRelation(e.target.value)}
                    placeholder="e.g. Spouse, Brother, Father"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Emergency Contact Phone</label>
                  <input 
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="+88017..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Reference Contact / Guarantor</label>
                  <input 
                    type="text"
                    value={referenceContact}
                    onChange={(e) => setReferenceContact(e.target.value)}
                    placeholder="Reference person phone or relation"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-white/10">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Admin Supervision Notes & Risk Remarks
                </label>
                <textarea 
                  rows={4}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Record confidential administrative observations, risk appraisal, or verification records..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 6: SUBSCRIPTION & HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-5">
              {/* Subscription Controls */}
              <div className="bg-slate-950 p-4 rounded-xl border border-white/10 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Award className="w-4 h-4" /> Syndicate Membership Tier & Alerts
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tier</label>
                    <select
                      value={subscriptionTier || ''}
                      onChange={(e) => setSubscriptionTier((e.target.value as any) || null)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">No Tier (Free Citizen)</option>
                      <option value="bronze">Bronze Tier</option>
                      <option value="silver">Silver Tier</option>
                      <option value="gold">Gold Elite Tier</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tier Status</label>
                    <select
                      value={subscriptionStatus || ''}
                      onChange={(e) => setSubscriptionStatus((e.target.value as any) || null)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">None / Inactive</option>
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="pending_approval">Pending Approval</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Continuous Months</label>
                    <input 
                      type="number"
                      value={continuousSubscriptionMonths}
                      onChange={(e) => setContinuousSubscriptionMonths(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="text-xs">
                    <span className="font-bold text-white block">Email Dispatch Notifications</span>
                    <span className="text-[11px] text-slate-400">Receive statements, reminders, and payment receipts</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailNotificationsEnabled(!emailNotificationsEnabled)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      emailNotificationsEnabled 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-400 border-white/10'
                    }`}
                  >
                    {emailNotificationsEnabled ? 'Enabled' : 'Muted'}
                  </button>
                </div>
              </div>

              {/* Citizen Loan Breakdown & Status Allocation */}
              <MemberLoanHistoryCard 
                summary={memberLoanSummary} 
                title="Citizen Loan Breakdown & Payment Allocation"
              />

              {/* Transactions List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Associated Ledger History ({memberTransactions.length})
                  </h4>
                </div>

                {memberTransactions.length === 0 ? (
                  <div className="bg-slate-950 p-6 rounded-xl border border-white/5 text-center text-slate-500 text-xs font-medium">
                    No transactions recorded for this user profile yet.
                  </div>
                ) : (
                  <div className="bg-slate-950 rounded-xl border border-white/5 divide-y divide-white/5 max-h-60 overflow-y-auto custom-scrollbar">
                    {memberTransactions.map((tx) => {
                      const isExpense = tx.type === 'loan' || tx.type === 'refund';
                      return (
                        <div key={tx.id} className="p-3 hover:bg-slate-900/60 transition-colors flex items-center justify-between text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase border ${
                                tx.type === 'deposit' 
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' 
                                  : tx.type === 'loan' 
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              }`}>
                                {tx.type}
                              </span>
                              <span className={`text-[10px] font-bold uppercase ${
                                tx.status === 'confirmed' ? 'text-emerald-400' : tx.status === 'pending' ? 'text-amber-400' : 'text-rose-400'
                              }`}>
                                ● {tx.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {safeFormat(tx.timestamp)} • Ref: {tx.transactionId || tx.memoId || tx.id}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`font-mono font-bold text-sm ${isExpense ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {isExpense ? '-' : '+'}৳{(tx.amount || 0).toLocaleString()} BDT
                            </div>
                            <span className="text-[10px] text-slate-500">{tx.method || 'Standard'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ================================================================ */}
        {/* MODAL FOOTER                                                     */}
        {/* ================================================================ */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            Registered: <span className="text-slate-200 font-mono">{safeFormat(member.createdAt || member.registeredAt, 'dd MMM yyyy')}</span>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel & Close
            </button>
            <button
              type="button"
              onClick={handleFormSave}
              disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Saving Dossier...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Save Dossier Updates
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Embedded Document Preview Zoom Lightbox */}
      {docPreview && (
        <div className="fixed inset-0 z-60 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/20 rounded-2xl max-w-4xl w-full p-4 space-y-3 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-400" />
                {docPreview.title}
              </h4>
              <button 
                type="button" 
                onClick={() => setDocPreview(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center max-h-[75vh] overflow-hidden rounded-xl bg-slate-950 p-2">
              <img 
                src={docPreview.url} 
                alt={docPreview.title} 
                className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-lg" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
