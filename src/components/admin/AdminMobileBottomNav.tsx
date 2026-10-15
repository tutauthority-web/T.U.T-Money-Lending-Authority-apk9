import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  MoreHorizontal 
} from 'lucide-react';
import { AdminSection } from './types';

interface AdminMobileBottomNavProps {
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  pendingRequestsCount: number;
  onOpenMoreMenu: () => void;
}

export const AdminMobileBottomNav: React.FC<AdminMobileBottomNavProps> = ({
  activeSection,
  onSelectSection,
  pendingRequestsCount,
  onOpenMoreMenu
}) => {
  const isDashboard = activeSection === 'dashboard';
  const isRequests = activeSection === 'requests' || activeSection === 'request_detail';
  const isMembers = activeSection === 'members' || activeSection === 'member_profile';

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 h-13 bg-[#0B132B]/95 backdrop-blur-md border-t border-[#152347] px-4 flex items-center justify-around z-30 select-none">
      {/* Home / Dashboard */}
      <button
        onClick={() => onSelectSection('dashboard')}
        className={`flex flex-col items-center gap-0.5 transition-colors cursor-pointer ${
          isDashboard ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <LayoutDashboard className="w-4 h-4" />
        <span className="text-[10px]">Home</span>
      </button>

      {/* Requests */}
      <button
        onClick={() => onSelectSection('requests')}
        className={`flex flex-col items-center gap-0.5 relative transition-colors cursor-pointer ${
          isRequests ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <FileText className="w-4 h-4" />
        <span className="text-[10px]">Requests</span>
        {pendingRequestsCount > 0 && (
          <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[8px] flex items-center justify-center">
            {pendingRequestsCount}
          </span>
        )}
      </button>

      {/* Members */}
      <button
        onClick={() => onSelectSection('members')}
        className={`flex flex-col items-center gap-0.5 transition-colors cursor-pointer ${
          isMembers ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Users className="w-4 h-4" />
        <span className="text-[10px]">Members</span>
      </button>

      {/* More */}
      <button
        onClick={onOpenMoreMenu}
        className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
      >
        <MoreHorizontal className="w-4 h-4" />
        <span className="text-[10px]">More</span>
      </button>
    </nav>
  );
};
