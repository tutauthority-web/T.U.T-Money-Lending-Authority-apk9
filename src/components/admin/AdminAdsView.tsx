import React, { useState, useMemo, useRef } from 'react';
import {
  Firestore,
  doc,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import {
  Megaphone,
  Plus,
  Search,
  Eye,
  MousePointerClick,
  TrendingUp,
  DollarSign,
  Play,
  Pause,
  Trash2,
  Edit3,
  Pin,
  PinOff,
  ExternalLink,
  Copy,
  Check,
  X,
  Upload,
  Sliders,
  Sparkles,
  Calendar,
  Target,
  Layers,
  AlertTriangle,
  Video,
  CheckCircle2,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { SponsorshipCampaign } from '../../App';
import {
  AdDeliverySettings,
  AdPlacement,
  AdTargetAudience,
  AdCategory
} from './types';

interface AdminAdsViewProps {
  db: Firestore;
  campaigns: SponsorshipCampaign[];
  adSettings: AdDeliverySettings;
  adminEmail: string;
  logAuditEvent: (action: string, details: string, severity?: 'info' | 'warning' | 'critical') => Promise<void>;
  addToast: (title: string, body: string, type?: 'info' | 'success' | 'warning') => void;
}

const ACCENT_PRESETS = [
  { label: 'bKash Magenta', hex: '#E2136E' },
  { label: 'Sovereign Gold', hex: '#D97706' },
  { label: 'Emerald Vault', hex: '#10B981' },
  { label: 'Nagad Flame', hex: '#F6921E' },
  { label: 'Cobalt Trust', hex: '#2563EB' },
  { label: 'Slate Carbon', hex: '#475569' }
];

const PLACEMENT_LABELS: Record<AdPlacement, string> = {
  all: 'All Channels (Omni)',
  entrance_popup: 'Entrance Popup Modal',
  deals_hero: 'Deals Top Hero Banner',
  featured_carousel: 'Featured Drops Carousel',
  partner_grid: 'Partner Offers Grid'
};

const AUDIENCE_LABELS: Record<AdTargetAudience, string> = {
  all: 'All Verified Members',
  standard: 'Standard Tier',
  bronze: 'Bronze Charter',
  silver: 'Silver Charter',
  gold: 'Gold Charter',
  active_borrowers: 'Active Borrowers',
  depositors: 'Vault Depositors'
};

const CATEGORIES: AdCategory[] = ['Fintech', 'Shopping', 'Food', 'Mobility', 'Telecom', 'General'];

async function compressImageToDataUrl(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = String(ev.target?.result || '');
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

export const AdminAdsView: React.FC<AdminAdsViewProps> = ({
  db,
  campaigns,
  adSettings,
  adminEmail,
  logAuditEvent,
  addToast
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [placementFilter, setPlacementFilter] = useState<'all_filter' | AdPlacement>('all_filter');
  const [audienceFilter, setAudienceFilter] = useState<'all_filter' | AdTargetAudience>('all_filter');
  const [searchQuery, setSearchQuery] = useState('');

  // Delivery engine settings saving
  const [isSavingEngine, setIsSavingEngine] = useState(false);

  // Studio Create/Edit Modal
  const [studioOpen, setStudioOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'card' | 'popup'>('card');
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);

  // Quick Preview Modal
  const [previewCampaign, setPreviewCampaign] = useState<SponsorshipCampaign | null>(null);
  const [previewMode, setPreviewMode] = useState<'card' | 'popup'>('popup');

  // Guarded delete states
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [dealValue, setDealValue] = useState('50000');
  const [campaignType, setCampaignType] = useState<'Premium Partner' | 'Strategic Collab' | 'Community Sponsor'>('Premium Partner');
  const [status, setStatus] = useState<'active' | 'paused' | 'completed'>('active');
  const [promotionText, setPromotionText] = useState('');
  const [placement, setPlacement] = useState<AdPlacement>('all');
  const [targetAudience, setTargetAudience] = useState<AdTargetAudience>('all');
  const [category, setCategory] = useState<AdCategory>('Fintech');
  const [priority, setPriority] = useState<number>(7);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [discountBadge, setDiscountBadge] = useState('EXCLUSIVE');
  const [ctaLabel, setCtaLabel] = useState('Claim Offer');
  const [specialOffer, setSpecialOffer] = useState('');
  const [accentColor, setAccentColor] = useState('#D97706');
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [maxImpressions, setMaxImpressions] = useState('0');
  const [frequencyCapHours, setFrequencyCapHours] = useState('12');
  const [logoUrl, setLogoUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Compute global KPIs
  const metrics = useMemo(() => {
    const active = campaigns.filter(c => c.status === 'active');
    const paused = campaigns.filter(c => c.status === 'paused');
    const totalRevenue = campaigns.filter(c => c.status !== 'completed').reduce((s, c) => s + (Number(c.dealValue) || 0), 0);
    const totalImpressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0);
    const totalClicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;
    return {
      total: campaigns.length,
      activeCount: active.length,
      pausedCount: paused.length,
      totalRevenue,
      totalImpressions,
      totalClicks,
      ctr
    };
  }, [campaigns]);

  // Sorted & filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        const cPlacement = c.placement || 'all';
        if (placementFilter !== 'all_filter' && cPlacement !== placementFilter) return false;
        const cAudience = c.targetAudience || 'all';
        if (audienceFilter !== 'all_filter' && cAudience !== audienceFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            c.companyName?.toLowerCase().includes(q) ||
            c.promotionText?.toLowerCase().includes(q) ||
            c.specialOffer?.toLowerCase().includes(q) ||
            c.category?.toLowerCase().includes(q) ||
            c.campaignType?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (!!b.isPinned !== !!a.isPinned) return b.isPinned ? 1 : -1;
        if ((b.priority || 5) !== (a.priority || 5)) return (b.priority || 5) - (a.priority || 5);
        return (b.impressions || 0) - (a.impressions || 0);
      });
  }, [campaigns, statusFilter, placementFilter, audienceFilter, searchQuery]);

  const handleUpdateDeliverySettings = async (patch: Partial<AdDeliverySettings>) => {
    setIsSavingEngine(true);
    try {
      const nextSettings: AdDeliverySettings = {
        ...adSettings,
        ...patch,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'system_controls', 'ad_settings'), nextSettings, { merge: true });
      await logAuditEvent(
        'AD_ENGINE_UPDATED',
        `Updated Global Ad Delivery Engine: popup=${nextSettings.entrancePopupEnabled ? 'ON' : 'OFF'}, cooldown=${nextSettings.globalCooldownHours}h`,
        'info'
      );
      addToast('Ad Engine Updated', 'Global ad delivery preferences synchronized.', 'success');
    } catch (err: any) {
      addToast('Update Failed', err.message || 'Could not save ad engine rules.', 'warning');
    } finally {
      setIsSavingEngine(false);
    }
  };

  const openCreateStudio = () => {
    setEditingId(null);
    setCompanyName('');
    setDealValue('50000');
    setCampaignType('Premium Partner');
    setStatus('active');
    setPromotionText('');
    setPlacement('all');
    setTargetAudience('all');
    setCategory('Fintech');
    setPriority(8);
    setIsPinned(false);
    setDiscountBadge('EXCLUSIVE');
    setCtaLabel('Claim Offer');
    setSpecialOffer('');
    setAccentColor('#D97706');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate(format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
    setMaxImpressions('0');
    setFrequencyCapHours('12');
    setLogoUrl('');
    setImageUrl('');
    setVideoUrl('');
    setTargetUrl('');
    setPreviewTab('card');
    setStudioOpen(true);
  };

  const openEditStudio = (c: SponsorshipCampaign) => {
    setEditingId(c.id);
    setCompanyName(c.companyName || '');
    setDealValue(String(c.dealValue ?? 0));
    setCampaignType(c.campaignType || 'Premium Partner');
    setStatus(c.status || 'active');
    setPromotionText(c.promotionText || '');
    setPlacement(c.placement || 'all');
    setTargetAudience(c.targetAudience || 'all');
    setCategory(c.category || 'Fintech');
    setPriority(c.priority ?? 5);
    setIsPinned(!!c.isPinned);
    setDiscountBadge(c.discountBadge || 'EXCLUSIVE');
    setCtaLabel(c.ctaLabel || 'Claim Offer');
    setSpecialOffer(c.specialOffer || '');
    setAccentColor(c.accentColor || '#D97706');
    setStartDate(c.startDate || format(new Date(), 'yyyy-MM-dd'));
    setEndDate(c.endDate || format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
    setMaxImpressions(String(c.maxImpressions ?? 0));
    setFrequencyCapHours(String(c.frequencyCapHours ?? 12));
    setLogoUrl(c.logoUrl || '');
    setImageUrl(c.imageUrl || '');
    setVideoUrl(c.videoUrl || '');
    setTargetUrl(c.targetUrl || '');
    setPreviewTab(c.placement === 'entrance_popup' ? 'popup' : 'card');
    setStudioOpen(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !promotionText.trim()) {
      addToast('Validation Error', 'Brand name and headline ad copy are required.', 'warning');
      return;
    }
    setIsSavingCampaign(true);
    try {
      const targetId = editingId || `sp-${Date.now().toString(36)}`;
      const existing = editingId ? campaigns.find(c => c.id === editingId) : undefined;
      const nowIso = new Date().toISOString();

      const docPayload: Record<string, any> = {
        companyName: companyName.trim(),
        dealValue: Math.max(0, Number(dealValue) || 0),
        campaignType,
        promotionText: promotionText.trim(),
        status,
        impressions: existing ? (Number(existing.impressions) || 0) : 0,
        clicks: existing ? (Number(existing.clicks) || 0) : 0,
        startDate: startDate || format(new Date(), 'yyyy-MM-dd'),
        endDate: endDate || format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        placement,
        targetAudience,
        priority: Math.min(10, Math.max(1, Number(priority) || 5)),
        isPinned,
        category,
        discountBadge: discountBadge.trim() || 'PARTNER',
        ctaLabel: ctaLabel.trim() || 'Claim Offer',
        accentColor: accentColor.trim() || '#D97706',
        maxImpressions: Math.max(0, Number(maxImpressions) || 0),
        frequencyCapHours: Math.max(0, Number(frequencyCapHours) || 0),
        updatedAt: nowIso,
        createdBy: existing?.createdBy || adminEmail
      };

      if (logoUrl.trim()) docPayload.logoUrl = logoUrl.trim();
      if (imageUrl.trim()) docPayload.imageUrl = imageUrl.trim();
      if (videoUrl.trim()) docPayload.videoUrl = videoUrl.trim();
      if (targetUrl.trim()) docPayload.targetUrl = targetUrl.trim();
      if (specialOffer.trim()) docPayload.specialOffer = specialOffer.trim();

      await setDoc(doc(db, 'sponsorships', targetId), docPayload, { merge: true });
      await setDoc(doc(db, 'system_controls', 'sponsorships_seeded'), { seeded: true, updatedAt: nowIso }, { merge: true });

      await logAuditEvent(
        editingId ? 'CAMPAIGN_UPDATED' : 'CAMPAIGN_CREATED',
        `${editingId ? 'Updated' : 'Launched'} ad campaign for ${companyName.trim()} (Placement: ${placement}, Audience: ${targetAudience}, Value: ৳${docPayload.dealValue.toLocaleString()})`,
        'info'
      );

      addToast(
        editingId ? 'Campaign Updated' : 'Campaign Launched',
        `${companyName.trim()} is now live in the Ad Control Registry.`,
        'success'
      );
      setStudioOpen(false);
    } catch (err: any) {
      console.error('Campaign save error:', err);
      addToast('Save Failed', err.message || 'Could not save campaign to Firestore.', 'warning');
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const handleToggleStatus = async (c: SponsorshipCampaign) => {
    const nextStatus = c.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'sponsorships', c.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
      await logAuditEvent('CAMPAIGN_STATUS_CHANGED', `Set ${c.companyName} status to ${nextStatus}`, 'info');
      addToast('Status Updated', `${c.companyName} is now ${nextStatus}.`, 'success');
    } catch (err: any) {
      addToast('Update Failed', err.message || 'Could not toggle status.', 'warning');
    }
  };

  const handleTogglePin = async (c: SponsorshipCampaign) => {
    try {
      const nextPin = !c.isPinned;
      await updateDoc(doc(db, 'sponsorships', c.id), {
        isPinned: nextPin,
        updatedAt: new Date().toISOString()
      });
      addToast(nextPin ? 'Campaign Pinned' : 'Campaign Unpinned', `${c.companyName} priority updated.`, 'info');
    } catch (err: any) {
      addToast('Pin Failed', err.message || 'Could not update pin state.', 'warning');
    }
  };

  const handleDeleteCampaign = async (c: SponsorshipCampaign) => {
    if (confirmDeleteId !== c.id) {
      setConfirmDeleteId(c.id);
      setTimeout(() => setConfirmDeleteId(prev => (prev === c.id ? null : prev)), 4000);
      return;
    }
    try {
      await deleteDoc(doc(db, 'sponsorships', c.id));
      await logAuditEvent('CAMPAIGN_DELETED', `Deleted ad campaign ${c.companyName} (${c.id})`, 'warning');
      addToast('Campaign Removed', `${c.companyName} permanently removed.`, 'info');
      setConfirmDeleteId(null);
    } catch (err: any) {
      addToast('Delete Failed', err.message || 'Could not delete campaign.', 'warning');
    }
  };

  const handleClearAllCampaigns = async () => {
    setIsClearingAll(true);
    try {
      await setDoc(doc(db, 'system_controls', 'sponsorships_seeded'), {
        seeded: true,
        clearedAt: new Date().toISOString()
      }, { merge: true });

      for (const c of campaigns) {
        if (c.id === 'config_seeded') continue;
        await deleteDoc(doc(db, 'sponsorships', c.id));
      }
      await logAuditEvent('ALL_CAMPAIGNS_CLEARED', `Purged ${campaigns.length} sponsorship campaigns`, 'critical');
      addToast('All Campaigns Cleared', 'All sponsorship ads removed from active rotation.', 'info');
      setShowClearAllConfirm(false);
    } catch (err: any) {
      addToast('Clear Error', err.message || 'Could not clear all ads.', 'warning');
    } finally {
      setIsClearingAll(false);
    }
  };

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="space-y-4 w-full max-w-7xl mx-auto animate-fadeIn pb-8">
      {/* 1. MASTER AD CONTROL ENGINE BAR */}
      <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Advertisement & Partner Perks Engine
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Control entrance interstitial popups, Deals hero banners, tier targeting, impression caps, and partner ROI.
            </p>
          </div>
        </div>

        {/* Global Controls & Action CTAs */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Master Entrance Popup Switch */}
          <button
            type="button"
            disabled={isSavingEngine}
            onClick={() => handleUpdateDeliverySettings({ entrancePopupEnabled: !adSettings.entrancePopupEnabled })}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center gap-2 transition-colors cursor-pointer ${
              adSettings.entrancePopupEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900 border-white/10 text-slate-400'
            }`}
            title="Master switch for member login entrance interstitial popup"
          >
            <span className={`w-2 h-2 rounded-full ${adSettings.entrancePopupEnabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <span>Entrance Popup: {adSettings.entrancePopupEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Global Cooldown Select */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#080F20] border border-white/10">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-400 hidden sm:inline">Cooldown:</span>
            <select
              value={String(adSettings.globalCooldownHours)}
              disabled={isSavingEngine}
              onChange={(e) => handleUpdateDeliverySettings({ globalCooldownHours: Number(e.target.value) })}
              className="bg-transparent text-xs font-semibold text-amber-300 focus:outline-none cursor-pointer"
            >
              <option value="0" className="bg-[#0B1326]">Every Session</option>
              <option value="6" className="bg-[#0B1326]">6 Hours</option>
              <option value="12" className="bg-[#0B1326]">12 Hours</option>
              <option value="24" className="bg-[#0B1326]">24 Hours</option>
              <option value="72" className="bg-[#0B1326]">72 Hours</option>
            </select>
          </div>

          {campaigns.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearAllConfirm(true)}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-colors cursor-pointer"
            >
              Clear All
            </button>
          )}

          <button
            type="button"
            onClick={openCreateStudio}
            className="px-3.5 py-2 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Launch Campaign</span>
          </button>
        </div>
      </div>

      {/* 2. 4 KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Active Campaigns</span>
            <Layers className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white mt-1.5">
            {metrics.activeCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            {metrics.pausedCount} paused • {metrics.total} total registered
          </div>
        </div>

        <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Contract Value</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1.5">
            ৳ {metrics.totalRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Active & paused sponsorship pool
          </div>
        </div>

        <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Total Impressions</span>
            <Eye className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white mt-1.5">
            {metrics.totalImpressions.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Verified member exposures
          </div>
        </div>

        <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Clicks & CTR</span>
            <MousePointerClick className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
              {metrics.totalClicks.toLocaleString()}
            </span>
            <span className="text-xs font-mono font-semibold text-teal-400 tabular-nums">
              ({metrics.ctr.toFixed(1)}% CTR)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Direct portal click-throughs
          </div>
        </div>
      </div>

      {/* 3. CONTROLLER FILTER & SEARCH BAR */}
      <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070D19] border border-white/[0.06] overflow-x-auto">
          {(['all', 'active', 'paused', 'completed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#132247] text-amber-300 border border-amber-500/35'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Placement, Audience & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={placementFilter}
            onChange={(e) => setPlacementFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-[#070D19] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all_filter">All Placements</option>
            {(Object.keys(PLACEMENT_LABELS) as AdPlacement[]).map(p => (
              <option key={p} value={p}>{PLACEMENT_LABELS[p]}</option>
            ))}
          </select>

          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-[#070D19] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all_filter">All Audiences</option>
            {(Object.keys(AUDIENCE_LABELS) as AdTargetAudience[]).map(a => (
              <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-56 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search brand, code, copy..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#070D19] border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* 4. CAMPAIGNS LIST */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-[#0B1326] border border-white/[0.08] rounded-xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">No Campaigns Match Filters</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Launch a new targeted sponsorship campaign to control partner deals banners, featured drops, and entrance popups across the member app.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateStudio}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Create First Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {filteredCampaigns.map((c) => {
            const imps = Number(c.impressions) || 0;
            const clks = Number(c.clicks) || 0;
            const ctrVal = imps > 0 ? ((clks / imps) * 100).toFixed(1) : '0.0';
            const maxImp = Number(c.maxImpressions) || 0;
            const capReached = maxImp > 0 && imps >= maxImp;
            const capPct = maxImp > 0 ? Math.min(100, Math.round((imps / maxImp) * 100)) : 0;
            const brandHex = c.accentColor || '#D97706';

            return (
              <div
                key={c.id}
                className={`bg-[#0B1326] border rounded-xl p-4 flex flex-col justify-between gap-3.5 transition-colors ${
                  c.isPinned ? 'border-amber-500/45' : 'border-white/[0.08] hover:border-white/20'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {c.logoUrl ? (
                      <img
                        src={c.logoUrl}
                        alt={c.companyName}
                        className="w-11 h-11 rounded-xl object-contain bg-[#070D19] border border-white/10 p-1 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0 border border-white/15"
                        style={{ backgroundColor: brandHex }}
                      >
                        {c.companyName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-white truncate">{c.companyName}</h3>
                        {c.isPinned && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                            <Pin className="w-3 h-3" /> Pinned
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${
                          capReached
                            ? 'text-rose-400'
                            : c.status === 'active'
                            ? 'text-emerald-400'
                            : c.status === 'paused'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            capReached
                              ? 'bg-rose-400'
                              : c.status === 'active'
                              ? 'bg-emerald-400'
                              : c.status === 'paused'
                              ? 'bg-amber-400'
                              : 'bg-slate-400'
                          }`} />
                          {capReached ? 'Cap Reached' : c.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-slate-300 font-medium">{c.campaignType}</span>
                        <span>•</span>
                        <span>{c.category || 'General'}</span>
                        <span>•</span>
                        <span className="font-mono text-amber-300/90">P{c.priority ?? 5}</span>
                        <span>•</span>
                        <span>{PLACEMENT_LABELS[c.placement || 'all']}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deal Value */}
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Deal Value</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-emerald-400">
                      ৳ {(c.dealValue || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Ad Copy & Targeting Strip */}
                <div className="space-y-2">
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {c.promotionText}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
                    <span className="inline-flex items-center gap-1">
                      <Target className="w-3 h-3 text-sky-400" />
                      Audience: <strong className="text-slate-200 font-medium">{AUDIENCE_LABELS[c.targetAudience || 'all']}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span className="font-mono tabular-nums">{c.startDate} → {c.endDate}</span>
                    </span>
                    {c.discountBadge && (
                      <span className="font-mono font-bold text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-amber-300 border border-white/10">
                        {c.discountBadge}
                      </span>
                    )}
                    {c.specialOffer && (
                      <button
                        type="button"
                        onClick={() => copyCode(c.specialOffer!, c.id)}
                        className="inline-flex items-center gap-1 font-mono text-[10.5px] text-emerald-300 hover:text-emerald-200 cursor-pointer"
                        title="Copy promo code"
                      >
                        {copiedId === c.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>Code: {c.specialOffer}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Telemetry & Cap Progress */}
                <div className="pt-2.5 border-t border-white/[0.06] space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Impressions</span>
                      <span className="font-mono font-bold tabular-nums text-white">
                        {imps.toLocaleString()}{maxImp > 0 ? ` / ${maxImp.toLocaleString()}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Clicks</span>
                      <span className="font-mono font-bold tabular-nums text-white">{clks.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">CTR</span>
                      <span className="font-mono font-bold tabular-nums text-teal-400">{ctrVal}%</span>
                    </div>
                  </div>

                  {maxImp > 0 && (
                    <div className="w-full h-1.5 rounded-full bg-[#070D19] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${capReached ? 'bg-rose-500' : 'bg-teal-400'}`}
                        style={{ width: `${capPct}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Control Buttons */}
                <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(c)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                        c.status === 'active'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/25 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20'
                      }`}
                    >
                      {c.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      <span>{c.status === 'active' ? 'Pause' : 'Activate'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTogglePin(c)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        c.isPinned
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                          : 'bg-[#070D19] text-slate-400 hover:text-white border-white/10'
                      }`}
                      title={c.isPinned ? 'Unpin campaign' : 'Pin campaign to top'}
                    >
                      {c.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPreviewCampaign(c);
                        setPreviewMode(c.placement === 'entrance_popup' ? 'popup' : 'card');
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#070D19] text-slate-300 hover:text-white border border-white/10 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3 text-sky-400" />
                      <span>Preview</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditStudio(c)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#132247] hover:bg-[#1A316B] text-slate-200 border border-[#1E3A7B] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-amber-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCampaign(c)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                        confirmDeleteId === c.id
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{confirmDeleteId === c.id ? 'Confirm?' : 'Delete'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CAMPAIGN STUDIO MODAL (CREATE / EDIT + LIVE MEMBER PREVIEW) */}
      {/* ========================================================================= */}
      {studioOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-[#0B1326] border border-white/15 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {editingId ? 'Edit Ad Campaign' : 'Campaign Studio — Launch Targeted Ad'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStudioOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Split: Form + Live Preview */}
            <form onSubmit={handleSaveCampaign} className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.08]">
              {/* LEFT: Form Fields (7 cols) */}
              <div className="lg:col-span-7 p-4 sm:p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Brand / Partner Name *</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. bKash, Pathao, Daraz"
                      className="w-full px-3 py-2 rounded-lg bg-[#070D19] border border-white/10 text-white focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Contract Deal Value (BDT) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={dealValue}
                      onChange={(e) => setDealValue(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#070D19] border border-white/10 text-white font-mono focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Campaign Tier</label>
                    <select
                      value={campaignType}
                      onChange={(e) => setCampaignType(e.target.value as any)}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#070D19] border border-white/10 text-white focus:outline-none focus:border-amber-500/60"
                    >
                      <option value="Premium Partner">Premium Partner</option>
                      <option value="Strategic Collab">Strategic Collab</option>
                      <option value="Community Sponsor">Community Sponsor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as AdCategory)}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#070D19] border border-white/10 text-white focus:outline-none focus:border-amber-500/60"
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#070D19] border border-white/10 text-white focus:outline-none focus:border-amber-500/60"
                    >
                      <option value="active">Active (Live)</option>
                      <option value="paused">Paused</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                {/* Placement & Targeting */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Placement Channel</label>
                    <select
                      value={placement}
                      onChange={(e) => setPlacement(e.target.value as AdPlacement)}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#070D19] border border-white/10 text-white focus:outline-none focus:border-amber-500/60"
                    >
                      {(Object.keys(PLACEMENT_LABELS) as AdPlacement[]).map(p => (
                        <option key={p} value={p}>{PLACEMENT_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Target Audience</label>
                    <select
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value as AdTargetAudience)}
                      className="w-full px-2.5 py-2 rounded-lg bg-[#070D19] border border-white/10 text-white focus:outline-none focus:border-amber-500/60"
                    >
                      {(Object.keys(AUDIENCE_LABELS) as AdTargetAudience[]).map(a => (
                        <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Headline Copy */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Headline / Promotional Copy *</label>
                  <textarea
                    required
                    rows={2}
                    value={promotionText}
                    onChange={(e) => setPromotionText(e.target.value)}
                    placeholder="Concise value proposition shown in member Deals banner and popup..."
                    className="w-full px-3 py-2 rounded-lg bg-[#070D19] border border-white/10 text-white focus:outline-none focus:border-amber-500/60"
                  />
                </div>

                {/* Creative Badges & Colors */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Offer Badge</label>
                    <input
                      type="text"
                      maxLength={32}
                      value={discountBadge}
                      onChange={(e) => setDiscountBadge(e.target.value)}
                      placeholder="0% FEE"
                      className="w-full px-3 py-2 rounded-lg bg-[#070D19] border border-white/10 text-white font-mono focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Promo Code</label>
                    <input
                      type="text"
                      value={specialOffer}
                      onChange={(e) => setSpecialOffer(e.target.value)}
                      placeholder="TUTVIP26"
                      className="w-full px-3 py-2 rounded-lg bg-[#070D19] border border-white/10 text-white font-mono focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">CTA Button Label</label>
                    <input
                      type="text"
                      maxLength={30}
                      value={ctaLabel}
                      onChange={(e) => setCtaLabel(e.target.value)}
                      placeholder="Claim Offer"
                      className="w-full px-3 py-2 rounded-lg bg-[#070D19] border border-white/10 text-white focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                </div>

                {/* Priority, Pin & Accent Color */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-300">Priority Weight ({priority}/10)</label>
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-amber-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isPinned}
                          onChange={(e) => setIsPinned(e.target.checked)}
                          className="rounded text-amber-500 focus:ring-0"
                        />
                        Pin to Top
                      </label>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Brand Accent Color</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ACCENT_PRESETS.map(p => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => setAccentColor(p.hex)}
                          className={`w-6 h-6 rounded-md border transition-transform cursor-pointer ${
                            accentColor.toLowerCase() === p.hex.toLowerCase() ? 'border-white scale-110' : 'border-white/15'
                          }`}
                          style={{ backgroundColor: p.hex }}
                          title={p.label}
                        />
                      ))}
                      <input
                        type="text"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-20 px-2 py-1 rounded bg-[#070D19] border border-white/10 font-mono text-[11px] text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Schedule & Caps */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#070D19] border border-white/10 text-white font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-[#070D19] border border-white/10 text-white font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Max Impr. (0=∞)</label>
                    <input
                      type="number"
                      min="0"
                      value={maxImpressions}
                      onChange={(e) => setMaxImpressions(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D19] border border-white/10 text-white font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Cap Hrs (Popup)</label>
                    <input
                      type="number"
                      min="0"
                      value={frequencyCapHours}
                      onChange={(e) => setFrequencyCapHours(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D19] border border-white/10 text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* Media & Links */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/[0.06]">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Logo Image URL or Upload</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://... or upload"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#070D19] border border-white/10 text-white text-[11px]"
                      />
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const url = await compressImageToDataUrl(file, 200);
                            setLogoUrl(url);
                          } catch {}
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg bg-[#132247] text-amber-300 border border-[#1E3A7B] cursor-pointer"
                        title="Upload Logo"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Poster / Banner Image URL or Upload</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://... or upload"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#070D19] border border-white/10 text-white text-[11px]"
                      />
                      <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const url = await compressImageToDataUrl(file, 800);
                            setImageUrl(url);
                          } catch {}
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => bannerInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg bg-[#132247] text-amber-300 border border-[#1E3A7B] cursor-pointer"
                        title="Upload Banner"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Destination Link URL</label>
                    <input
                      type="text"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="https://partner.example.com"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D19] border border-white/10 text-white text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Promo Video URL (Optional)</label>
                    <input
                      type="text"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#070D19] border border-white/10 text-white text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT: LIVE MEMBER PREVIEW (5 cols) */}
              <div className="lg:col-span-5 p-4 sm:p-5 bg-[#070D19] flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Live Member Preview</span>
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#0B1326] border border-white/10">
                      <button
                        type="button"
                        onClick={() => setPreviewTab('card')}
                        className={`px-2.5 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                          previewTab === 'card' ? 'bg-[#132247] text-amber-300' : 'text-slate-400'
                        }`}
                      >
                        Deals Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab('popup')}
                        className={`px-2.5 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                          previewTab === 'popup' ? 'bg-[#132247] text-amber-300' : 'text-slate-400'
                        }`}
                      >
                        Entrance Popup
                      </button>
                    </div>
                  </div>

                  {previewTab === 'card' ? (
                    <div className="rounded-2xl border border-white/10 bg-[#0B1222] p-4 relative overflow-hidden shadow-xl space-y-3">
                      <div
                        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-25 pointer-events-none"
                        style={{ backgroundColor: accentColor }}
                      />
                      <div className="flex items-start justify-between gap-2 relative z-10">
                        <div className="flex items-center gap-2.5">
                          {logoUrl ? (
                            <img src={logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-slate-950 p-1 border border-white/10" />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white"
                              style={{ backgroundColor: accentColor }}
                            >
                              {(companyName || 'T').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1">
                              <span>{companyName || 'Partner Brand'}</span>
                              <CheckCircle2 className="w-3 h-3 text-sky-400" />
                            </div>
                            <div className="text-[10px] text-slate-400">{category} • {campaignType}</div>
                          </div>
                        </div>
                        <span
                          className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950"
                        >
                          {discountBadge || 'EXCLUSIVE'}
                        </span>
                      </div>

                      {imageUrl && (
                        <div className="rounded-xl overflow-hidden border border-white/10 max-h-32 bg-black/40">
                          <img src={imageUrl} alt="" className="w-full h-32 object-cover" />
                        </div>
                      )}

                      <p className="text-xs text-slate-200 leading-relaxed relative z-10">
                        {promotionText || 'Your promotional headline copy will appear right here for verified members.'}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] relative z-10">
                        <span className="text-[10px] font-mono text-slate-400">
                          {specialOffer ? `Code: ${specialOffer}` : `Valid till ${endDate}`}
                        </span>
                        <span
                          className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase text-slate-950 bg-amber-400"
                        >
                          {ctaLabel || 'Claim Offer'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/15 bg-slate-950/95 p-4 relative overflow-hidden shadow-2xl space-y-3 text-center">
                      <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400">
                        <X className="w-3 h-3" />
                      </span>
                      {imageUrl ? (
                        <div className="rounded-xl overflow-hidden border border-white/10 bg-black/50">
                          <img src={imageUrl} alt="" className="w-full max-h-52 object-contain mx-auto" />
                        </div>
                      ) : (
                        <div className="py-5 space-y-2.5">
                          {logoUrl && <img src={logoUrl} alt="" className="w-12 h-12 mx-auto object-contain rounded-xl bg-slate-900 p-1.5 border border-white/10" />}
                          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                            {discountBadge || 'Partner Spotlight'}
                          </div>
                          <div className="text-base font-black text-white">{companyName || 'Partner Brand'}</div>
                          <p className="text-xs text-slate-300 px-2">
                            {promotionText || 'Entrance popup creative preview for verified members upon login.'}
                          </p>
                          <div className="pt-1">
                            <span className="inline-block px-4 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                              {ctaLabel || 'Visit Partner Portal'}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500">
                        Target: {AUDIENCE_LABELS[targetAudience]} • Cooldown: {frequencyCapHours || adSettings.globalCooldownHours}h
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Bar */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setStudioOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCampaign}
                    className="px-5 py-2 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer shadow-sm"
                  >
                    {isSavingCampaign ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Campaign'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STANDALONE QUICK PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewCampaign && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewCampaign(null)}
        >
          <div
            className="bg-[#0B1326] border border-white/15 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <div className="text-sm font-bold text-white">{previewCampaign.companyName}</div>
                <div className="text-[11px] text-slate-400">
                  {PLACEMENT_LABELS[previewCampaign.placement || 'all']} • {AUDIENCE_LABELS[previewCampaign.targetAudience || 'all']}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode(previewMode === 'popup' ? 'card' : 'popup')}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#132247] text-amber-300 border border-[#1E3A7B] cursor-pointer"
                >
                  Switch to {previewMode === 'popup' ? 'Deals Card' : 'Popup'}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewCampaign(null)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {previewMode === 'popup' && previewCampaign.imageUrl ? (
              <img
                src={previewCampaign.imageUrl}
                alt={previewCampaign.companyName}
                className="w-full max-h-[60vh] object-contain rounded-xl border border-white/10"
              />
            ) : (
              <div className="rounded-xl bg-[#070D19] border border-white/10 p-5 space-y-3 text-center">
                {previewCampaign.logoUrl && (
                  <img src={previewCampaign.logoUrl} alt="" className="w-14 h-14 mx-auto object-contain rounded-xl bg-slate-950 p-1.5 border border-white/10" />
                )}
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {previewCampaign.discountBadge || previewCampaign.campaignType}
                </div>
                <h4 className="text-lg font-bold text-white">{previewCampaign.companyName}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{previewCampaign.promotionText}</p>
                {previewCampaign.specialOffer && (
                  <div className="inline-block px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 font-mono text-xs text-emerald-300">
                    Code: {previewCampaign.specialOffer}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CLEAR ALL GUARD MODAL */}
      {/* ========================================================================= */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B1326] border border-rose-500/35 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Clear All Sponsorship Campaigns?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently remove all {campaigns.length} campaign records from Firestore and stop all entrance popups & partner deals immediately.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isClearingAll}
                onClick={() => setShowClearAllConfirm(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingAll}
                onClick={handleClearAllCampaigns}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              >
                {isClearingAll ? 'Clearing...' : 'Yes, Purge All Ads'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
