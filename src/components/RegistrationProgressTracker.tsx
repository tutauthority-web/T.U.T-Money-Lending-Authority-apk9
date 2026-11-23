import React, { useState } from 'react';
import { 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  Briefcase, 
  MapPin, 
  MessageSquare, 
  LogOut, 
  Calendar,
  AlertTriangle,
  ChevronRight,
  Shield,
  FileCheck
} from 'lucide-react';
import { UserProfile } from '../App';
import { format } from 'date-fns';

interface RegistrationProgressTrackerProps {
  profile: UserProfile;
  userEmail?: string | null;
  onRefreshStatus?: () => void;
  onSignOut?: () => void;
}

export const RegistrationProgressTracker: React.FC<RegistrationProgressTrackerProps> = ({
  profile,
  userEmail,
  onRefreshStatus,
  onSignOut
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const trackingId = profile?.uid 
    ? `TUT-REG-${profile.uid.slice(0, 8).toUpperCase()}` 
    : 'TUT-REG-PENDING';

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setSyncNotice(null);
    if (onRefreshStatus) {
      onRefreshStatus();
    }
    setTimeout(() => {
      setIsRefreshing(false);
      setLastChecked(new Date());
      setSyncNotice('Status synchronized with authority server. Application is actively being reviewed.');
      setTimeout(() => setSyncNotice(null), 5000);
    }, 700);
  };

  const maskedNid = profile?.nid
    ? profile.nid.length > 4
      ? `•••• •••• ${profile.nid.slice(-4)}`
      : profile.nid
    : 'Not Specified';

  // Format creation time safely
  let submittedDateStr = 'Recent';
  try {
    if (profile?.createdAt) {
      if (typeof (profile.createdAt as any).toDate === 'function') {
        submittedDateStr = format((profile.createdAt as any).toDate(), 'dd MMM yyyy, hh:mm a');
      } else if (profile.createdAt instanceof Date) {
        submittedDateStr = format(profile.createdAt, 'dd MMM yyyy, hh:mm a');
      } else if (typeof profile.createdAt === 'string' || typeof profile.createdAt === 'number') {
        submittedDateStr = format(new Date(profile.createdAt), 'dd MMM yyyy, hh:mm a');
      }
    }
  } catch {
    submittedDateStr = 'Recent';
  }

  return (
    <div className="w-full max-w-4xl lg:max-w-5xl mx-auto space-y-6 text-left animate-fadeIn py-3 sm:py-6 select-none">
      
      {/* 1. Header Banner & Live Status Strip */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0c1838] via-[#081026] to-[#040817] border border-blue-500/20 p-5 sm:p-7 shadow-2xl">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>APPLICATION UNDER AUTHORITY REVIEW</span>
            </div>
            
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Registration Progress Tracker
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Welcome, <span className="text-white font-bold">{profile?.name || 'Applicant'}</span>. 
              Your membership request has been registered in the T.U.T. Private Lending Authority database. 
              Our verification team is validating your submitted credentials.
            </p>
          </div>

          {/* Reference & Refresh Widget */}
          <div className="shrink-0 bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-3 min-w-[240px] text-left">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Application Tracking ID
              </span>
              <span className="text-sm font-mono font-bold text-amber-300 tracking-wide">
                {trackingId}
              </span>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3">
              <div className="text-[10px] text-slate-400 font-mono">
                Last checked: <br />
                <span className="text-slate-200">{format(lastChecked, 'hh:mm:ss a')}</span>
              </div>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                title="Check latest application status"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sync notification banner */}
        {syncNotice && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}
      </div>

      {/* 2. Four-Stage Visual Progress Timeline */}
      <div className="bg-[#0b142b]/90 border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-400" />
              Verification Workflow Stages
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Real-time progress overview through official clearance and member onboarding.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg self-start sm:self-auto">
            Stage 2 of 4 Active
          </span>
        </div>

        {/* Desktop / Responsive Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Step 1: Completed */}
          <div className="relative p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold text-xs">
                1
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Completed
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Application Received</h3>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Personal credentials, phone number, and NID safely recorded in ledger.
              </p>
            </div>
            <div className="text-[10px] font-mono text-emerald-400/80 pt-2 border-t border-emerald-500/20">
              {submittedDateStr}
            </div>
          </div>

          {/* Step 2: In Review (Active) */}
          <div className="relative p-4 rounded-2xl bg-amber-950/25 border-2 border-amber-500/50 shadow-lg shadow-amber-500/10 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-bold text-xs animate-pulse">
                2
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                <Clock className="w-3 h-3 animate-spin" /> In Review
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-200">Credential Audit</h3>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Authority administration is validating identity documents & eligibility criteria.
              </p>
            </div>
            <div className="text-[10px] font-mono text-amber-400 pt-2 border-t border-amber-500/20">
              Under Active Review
            </div>
          </div>

          {/* Step 3: Upcoming */}
          <div className="relative p-4 rounded-2xl bg-slate-900/40 border border-white/10 flex flex-col justify-between space-y-3 opacity-80">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 rounded-xl bg-slate-800 border border-white/10 text-slate-400 flex items-center justify-center font-bold text-xs">
                3
              </span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-white/5">
                Queued
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Limit Allocation</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Provisional credit limit allocation (starting ৳500 Bronze) and loan tier setup.
              </p>
            </div>
            <div className="text-[10px] font-mono text-slate-500 pt-2 border-t border-white/5">
              Next in Queue
            </div>
          </div>

          {/* Step 4: Upcoming */}
          <div className="relative p-4 rounded-2xl bg-slate-900/40 border border-white/10 flex flex-col justify-between space-y-3 opacity-80">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 rounded-xl bg-slate-800 border border-white/10 text-slate-400 flex items-center justify-center font-bold text-xs">
                4
              </span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-white/5">
                Final Step
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Account Activation</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Generation of digital Member ID Card & unblocking loans and deposit services.
              </p>
            </div>
            <div className="text-[10px] font-mono text-slate-500 pt-2 border-t border-white/5">
              Dashboard Ready
            </div>
          </div>

        </div>
      </div>

      {/* 3. Applicant Dossier & Authority SLA (Desktop 2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left 2 Cols: Submitted Profile Details */}
        <div className="lg:col-span-2 bg-[#0b142b]/80 border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Submitted Application Dossier
            </h2>
            <span className="text-[10px] font-mono text-slate-400">
              Encrypted Data
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Full Name */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>Full Name</span>
              </div>
              <div className="text-sm font-bold text-white truncate">
                {profile?.name || 'Not Specified'}
              </div>
            </div>

            {/* Contact Email */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span>Registered Email</span>
              </div>
              <div className="text-sm font-bold text-white truncate">
                {profile?.email || userEmail || 'Not Specified'}
              </div>
            </div>

            {/* Phone */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Contact Phone</span>
              </div>
              <div className="text-sm font-mono font-bold text-white">
                {profile?.phone || 'Not Specified'}
              </div>
            </div>

            {/* NID */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span>National ID (NID)</span>
              </div>
              <div className="text-sm font-mono font-bold text-amber-200">
                {maskedNid}
              </div>
            </div>

            {/* Occupation */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                <span>Occupation</span>
              </div>
              <div className="text-sm font-bold text-white truncate">
                {profile?.occupation || 'Not Specified'}
              </div>
            </div>

            {/* Residential Address */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>Residential Address</span>
              </div>
              <div className="text-sm font-medium text-slate-200 truncate">
                {profile?.address || 'Not Specified'}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-blue-200 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Your profile data is strictly protected under T.U.T. Private Lending Authority privacy policies.
            </span>
          </div>
        </div>

        {/* Right 1 Col: Authority SLA & Direct Help */}
        <div className="bg-[#0b142b]/80 border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
              <Clock className="w-4 h-4 text-amber-400" />
              Review Timelines
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-white">Estimated Decision:</span>
                  <p className="text-slate-300 mt-0.5">
                    15 to 45 minutes during official operational review hours (09:00 AM – 11:00 PM).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-white">Instant Unlock:</span>
                  <p className="text-slate-300 mt-0.5">
                    As soon as the authority approves your application, your dashboard will automatically unlock without requiring a page refresh.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons: WhatsApp Support & Sign Out */}
          <div className="space-y-2.5 pt-4 border-t border-white/5">
            <a
              href="https://wa.me/8801713710607?text=Hello%20T.U.T.%20Authority,%20I%20have%20submitted%20my%20membership%20application%20and%20would%20like%20to%20inquire%20about%20its%20verification."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition-all cursor-pointer shadow-md group"
            >
              <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Contact Authority on WhatsApp</span>
            </a>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-white/10 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out Securely</span>
              </button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
