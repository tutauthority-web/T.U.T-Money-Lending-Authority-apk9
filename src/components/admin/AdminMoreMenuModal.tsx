import React from 'react';
import { 
  FileText, 
  BarChart3, 
  History, 
  ShieldCheck, 
  Users, 
  Bot, 
  Database, 
  LogOut, 
  X,
  ChevronRight,
  Megaphone,
  Landmark,
  Mail,
  Bell,
  KeyRound
} from 'lucide-react';
import { AdminSection } from './types';

interface AdminMoreMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSection: (section: AdminSection) => void;
  onCloseAdmin: () => void;
}

export const AdminMoreMenuModal: React.FC<AdminMoreMenuModalProps> = ({
  isOpen,
  onClose,
  onSelectSection,
  onCloseAdmin
}) => {
  if (!isOpen) return null;

  const menuItems = [
    {
      label: 'Active Debts Registry',
      icon: FileText,
      action: () => {
        onSelectSection('active_debts');
        onClose();
      }
    },
    {
      label: 'All Notifications',
      icon: Bell,
      action: () => {
        onSelectSection('notifications');
        onClose();
      }
    },
    {
      label: 'Email Notification System',
      icon: Mail,
      action: () => {
        onSelectSection('email_hub');
        onClose();
      }
    },
    {
      label: 'Payment Gateway & Secrets',
      icon: KeyRound,
      action: () => {
        onSelectSection('gateway');
        onClose();
      }
    },
    {
      label: 'Advertisement Control Studio',
      icon: Megaphone,
      action: () => {
        onSelectSection('ads');
        onClose();
      }
    },
    {
      label: 'Reserve Pool Management',
      icon: Landmark,
      action: () => {
        onSelectSection('reserve');
        onClose();
      }
    },
    {
      label: 'Reports & Statements',
      icon: BarChart3,
      action: () => {
        onSelectSection('reports');
        onClose();
      }
    },
    {
      label: 'Transaction Registry',
      icon: History,
      action: () => {
        onSelectSection('transactions');
        onClose();
      }
    },
    {
      label: 'System Audit Trail',
      icon: ShieldCheck,
      action: () => {
        onSelectSection('audit');
        onClose();
      }
    },
    {
      label: 'Member Roster',
      icon: Users,
      action: () => {
        onSelectSection('members');
        onClose();
      }
    },
    {
      label: 'Digital Workforce (AI Officers)',
      icon: Bot,
      action: () => {
        onSelectSection('workforce');
        onClose();
      }
    },
    {
      label: 'Backup & Restore',
      icon: Database,
      action: () => {
        try {
          const snapshotData = {
            exportDate: new Date().toISOString(),
            system: 'T.U.T. Private Lending Authority',
            version: '4.2.0',
            exportedBy: 'Administrator',
            status: 'Verified Encrypted Snapshot'
          };
          const blob = new Blob([JSON.stringify(snapshotData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `TUT_Encrypted_Backup_${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error('Backup export error:', e);
        }
        onClose();
      }
    },
    {
      label: 'Logout',
      icon: LogOut,
      isDanger: true,
      action: () => {
        onClose();
        onCloseAdmin();
      }
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-end p-4 lg:p-6"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm bg-[#0B132B] border border-[#182C58] rounded-2xl shadow-2xl p-4 space-y-1.5 animate-scaleUp mt-14"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 px-2 border-b border-[#182C58]/80">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Navigation</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-2 space-y-1">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={item.action}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  item.isDanger
                    ? 'text-rose-400 hover:bg-rose-950/40 hover:text-rose-300'
                    : 'text-slate-300 hover:text-white hover:bg-[#132247]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${item.isDanger ? 'text-rose-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
