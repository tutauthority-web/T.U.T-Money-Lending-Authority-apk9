import React from 'react';
import { 
  Menu, 
  Bell, 
  MoreVertical, 
  ArrowLeft, 
  X,
  Shield
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
  const getSectionTitle = () => {
    if (detailTitle) return detailTitle;
    switch (activeSection) {
      case 'dashboard':
        return 'Dashboard';
      case 'requests':
        return 'Loan Requests';
      case 'request_detail':
        return 'Request Details';
      case 'members':
        return 'Members';
      case 'member_profile':
        return 'Member Profile';
      case 'transactions':
        return 'Transactions';
      case 'reserve':
        return 'Reserve Management';
      case 'deposits':
        return 'Member Deposits';
      case 'notifications':
        return 'Notifications';
      case 'settings':
        return 'Settings';
      case 'workforce':
        return 'Digital Workforce & AI Staff';
      case 'audit':
        return 'System Audit Logs';
      case 'reports':
        return 'Financial Reports & Analytics';
      default:
        return 'Admin Portal';
    }
  };

  const isDetailView = activeSection === 'request_detail' || activeSection === 'member_profile';

  return (
    <header className="h-14 lg:h-16 bg-[#0B132B]/95 backdrop-blur-md border-b border-[#152347] px-4 lg:px-6 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left Title / Breadcrumb */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#132247] border border-[#182C58]"
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
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-200 bg-[#132247] hover:bg-[#1A316B] border border-[#182C58] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        <div>
          <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight flex items-center gap-2">
            {getSectionTitle()}
          </h1>
          {activeSection === 'dashboard' && (
            <p className="text-[11px] text-slate-400 font-normal">
              Administrative console • <span className="text-slate-300">{adminName}</span>
            </p>
          )}
        </div>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Notifications Icon Button */}
        <button
          onClick={() => onSelectSection('notifications')}
          className="relative p-2 rounded-lg bg-[#0D1836] hover:bg-[#132247] border border-[#182C58] text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-4 h-4 text-amber-400/90" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] flex items-center justify-center shadow-sm">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* More Menu (Three Dots) Button */}
        <button
          onClick={onToggleMoreMenu}
          className="p-2 rounded-lg bg-[#0D1836] hover:bg-[#132247] border border-[#182C58] text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Navigation & Quick Options"
        >
          <MoreVertical className="w-4 h-4 text-slate-300" />
        </button>

        {/* Close Admin Button */}
        <button
          onClick={onCloseAdmin}
          className="p-2 rounded-lg bg-[#1A1528] hover:bg-rose-950/60 border border-rose-900/40 text-rose-300 hover:text-rose-100 transition-colors ml-0.5 cursor-pointer"
          title="Exit Admin Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
