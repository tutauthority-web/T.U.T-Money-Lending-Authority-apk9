import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  CreditCard, 
  Landmark, 
  PiggyBank, 
  Bell, 
  Settings, 
  Shield, 
  X,
  UserCheck
} from 'lucide-react';
import { AdminSection } from './types';

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  pendingRequestsCount: number;
  unreadNotificationsCount: number;
  mobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
  adminName?: string;
  adminRole?: string;
  adminPhoto?: string;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeSection,
  onSelectSection,
  pendingRequestsCount,
  unreadNotificationsCount,
  mobileMenuOpen,
  onCloseMobileMenu,
  adminName = 'Tahsin Ullah',
  adminRole = 'Founder & Chairman',
  adminPhoto
}) => {
  const navItems = [
    { id: 'dashboard' as AdminSection, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'requests' as AdminSection, label: 'Requests', icon: FileText, badge: pendingRequestsCount },
    { id: 'members' as AdminSection, label: 'Members', icon: Users },
    { id: 'transactions' as AdminSection, label: 'Transactions', icon: CreditCard },
    { id: 'reserve' as AdminSection, label: 'Reserve', icon: Landmark },
    { id: 'deposits' as AdminSection, label: 'Deposits', icon: PiggyBank },
    { id: 'notifications' as AdminSection, label: 'Notifications', icon: Bell, badge: unreadNotificationsCount },
    { id: 'settings' as AdminSection, label: 'Settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0B132B] border-r border-[#152347] w-60 select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-4.5 border-b border-[#152347]/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
            <Shield className="w-4 h-4 fill-amber-400/20 text-amber-400" />
          </div>
          <div>
            <div className="text-base font-black tracking-wider text-amber-400 font-sans leading-none">T.U.T</div>
            <div className="text-[10px] font-semibold tracking-wider text-amber-300/70 uppercase mt-0.5">Admin Console</div>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobileMenu}
          className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-2.5 py-3.5 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = 
            activeSection === item.id || 
            (item.id === 'requests' && activeSection === 'request_detail') ||
            (item.id === 'members' && activeSection === 'member_profile');

          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobileMenu();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#132247] text-amber-400 border border-amber-500/35 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#101B38] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                  isActive ? 'bg-amber-400 text-slate-950' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-[#152347]/80 bg-[#090F24]">
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0D1836]/60 border border-[#182C58]">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 p-[1.5px] shrink-0">
            {adminPhoto ? (
              <img src={adminPhoto} alt={adminName} className="w-full h-full object-cover rounded-full" />
            ) : (
              <div className="w-full h-full bg-[#0B132B] rounded-full flex items-center justify-center text-amber-400 font-bold text-[11px]">
                {adminName.charAt(0)}
              </div>
            )}
          </div>
          <div className="overflow-hidden min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-200 truncate">{adminName}</div>
            <div className="text-[10px] text-slate-400 truncate">{adminRole}</div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Online" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden lg:flex shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={onCloseMobileMenu}
        />
      )}

      {/* Mobile Drawer (Slide in) */}
      <div className={`lg:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-300 transform ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent}
      </div>
    </>
  );
};
