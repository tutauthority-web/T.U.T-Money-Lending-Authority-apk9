import React from 'react';
import { 
  Menu, 
  Bell, 
  Mail,
  MoreVertical, 
  ArrowLeft, 
  LogOut,
  Megaphone
} from 'lucide-react';
import { AdminSection } from './types';

interface AdminHeaderProps {
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  onOpenMobileMenu: () => void;
  onToggleMoreMenu: () => void;
  onCloseAdmin: () => void;
  unreadNotificationsCount: number;
  adminName?: string;
  detailBackAction?: () => void;
  detailTitle?: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeSection,
  onSelectSection,
  onOpenMobileMenu,
  onToggleMoreMenu,
  onCloseAdmin,
  unreadNotificationsCount,
  adminName = 'Tahsin Ullah',
  detailBackAction,
  detailTitle
}) => {
  const getSectionMeta = (): { title: string; subtitle: string } => {
    if (detailTitle) {
      return {
        title: detailTitle,
        subtitle: activeSection === 'request_detail' ? 'Underwriting review & audit record' : 'Full member dossier & credit ledger'
      };
    }
    switch (activeSection) {
      case 'dashboard':
        return { title: 'Executive Overview', subtitle: `Operations Console • ${adminName}` };
      case 'requests':
        return { title: 'Requests Queue', subtitle: 'Loans, deposits, repayments, subscriptions & KYC' };
      case 'request_detail':
        return { title: 'Request Details', subtitle: 'Underwriting verification & decision desk' };
      case 'active_debts':
        return { title: 'Active Debts Registry', subtitle: 'Open borrower obligations, tranches & due schedules' };
      case 'members':
        return { title: 'Member Directory', subtitle: 'Roster, tiers & active debt portfolios' };
      case 'member_profile':
        return { title: 'Member Profile', subtitle: 'Detailed account holdings & memo trail' };
      case 'transactions':
        return { title: 'Ledger Registry', subtitle: 'Verified financial movement logs' };
      case 'reserve':
        return { title: 'Reserve Pool', subtitle: 'Primary lending liquidity & segregated vault' };
      case 'deposits':
        return { title: 'Member Deposits', subtitle: '1:1 protected member vault inflows' };
      case 'ads':
        return { title: 'Advertisement Control', subtitle: 'Partner perks, placements, targeting & ROI' };
      case 'notifications':
        return { title: 'Notifications', subtitle: 'Pending requests, overdue alerts, member activity & system logs' };
      case 'email_hub':
        return { title: 'Email Notification System', subtitle: 'Automated memo delivery, SMTP & due reminders' };
      case 'settings':
        return { title: 'Settings & Diagnostics', subtitle: 'Authority rules, security & backend health' };
      case 'workforce':
        return { title: 'AI Officers & Reports', subtitle: 'Digital staff supervision & briefings' };
      case 'audit':
        return { title: 'Audit Trail', subtitle: 'Immutable administrative action logs' };
      case 'reports':
        return { title: 'Financial Reports', subtitle: 'Inflow, recovery rate & solvency statements' };
      default:
        return { title: 'Admin Console', subtitle: adminName };
    }
  };

  const { title, subtitle } = getSectionMeta();
  const isDetailView = activeSection === 'request_detail' || activeSection === 'member_profile';

  return (
    <header className="h-14 lg:h-16 bg-[#091022]/95 backdrop-blur-md border-b border-white/[0.08] px-3.5 sm:px-5 lg:px-6 flex items-center justify-between shrink-0 select-none z-20 gap-3">
      {/* Left Title / Breadcrumb */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden min-h-[38px] min-w-[38px] p-2 rounded-lg text-slate-300 hover:text-white bg-[#0D1836] hover:bg-[#132247] border border-white/10 flex items-center justify-center shrink-0 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4 text-amber-400" />
        </button>

        {/* Back button if in detail view */}
        {isDetailView && (
          <button
            onClick={() => {
              if (detailBackAction) {
                detailBackAction();
              } else if (activeSection === 'request_detail') {
                onSelectSection('requests');
              } else if (activeSection === 'member_profile') {
                onSelectSection('members');
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-[#132247] hover:bg-[#1A316B] border border-white/10 transition-colors shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
            {title}
          </h1>
          <p className="text-[11px] text-slate-400 truncate leading-tight">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Quick jump to Ad Control on Desktop */}
        {activeSection !== 'ads' && (
          <button
            onClick={() => onSelectSection('ads')}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0D1836] hover:bg-[#132247] border border-white/10 text-xs font-semibold text-amber-300 transition-colors whitespace-nowrap cursor-pointer"
            title="Open Advertisement Control Studio"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Ad Control</span>
          </button>
        )}

        {/* Email Notification System Shortcut */}
        <button
          onClick={() => onSelectSection('email_hub')}
          className={`min-h-[38px] min-w-[38px] p-2 rounded-lg border transition-colors flex items-center justify-center cursor-pointer ${
            activeSection === 'email_hub'
              ? 'bg-[#132247] border-amber-500/40 text-amber-300'
              : 'bg-[#0D1836] hover:bg-[#132247] border-white/10 text-slate-300 hover:text-white'
          }`}
          title="Email Notification System"
          aria-label="Open Email Notification System"
        >
          <Mail className="w-4 h-4 text-sky-400" />
        </button>

        {/* All Notifications Bell Button */}
        <button
          onClick={() => onSelectSection('notifications')}
          className={`relative min-h-[38px] min-w-[38px] p-2 rounded-lg border transition-colors flex items-center justify-center cursor-pointer ${
            activeSection === 'notifications'
              ? 'bg-[#132247] border-amber-500/40 text-amber-300'
              : 'bg-[#0D1836] hover:bg-[#132247] border-white/10 text-slate-300 hover:text-white'
          }`}
          title="All Notifications"
          aria-label="All Notifications"
        >
          <Bell className="w-4 h-4 text-amber-400/90" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-slate-950 font-mono font-bold text-[9px] flex items-center justify-center">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* More Menu (Three Dots) Button */}
        <button
          onClick={onToggleMoreMenu}
          className="min-h-[38px] min-w-[38px] p-2 rounded-lg bg-[#0D1836] hover:bg-[#132247] border border-white/10 text-slate-300 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
          title="Navigation & Quick Options"
        >
          <MoreVertical className="w-4 h-4 text-slate-300" />
        </button>

        {/* Exit to Member App */}
        <button
          onClick={onCloseAdmin}
          className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#0D1836] hover:bg-rose-950/50 border border-white/10 hover:border-rose-500/40 text-slate-200 hover:text-rose-200 transition-colors flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer"
          title="Switch to Member Portal View"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Member App</span>
        </button>
      </div>
    </header>
  );
};
