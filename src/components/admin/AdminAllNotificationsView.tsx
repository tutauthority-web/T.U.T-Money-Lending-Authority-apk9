import React, { useState, useMemo } from 'react';
import {
  Bell,
  FileText,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Trash2,
  X,
  ArrowRight,
  Mail,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { AdminAllNotificationItem, AdminSection } from './types';

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
    if (typeof val?.seconds === 'number') {
      const d = new Date(val.seconds * 1000);
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm');
    }
    if (typeof val === 'number' || typeof val === 'string') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm');
    }
  } catch {}
  return 'Just now';
}

interface AdminAllNotificationsViewProps {
  notifications: AdminAllNotificationItem[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onOpenRequest?: (requestId: string) => void;
  onOpenMember?: (memberUid: string) => void;
  onSelectSection: (section: AdminSection) => void;
}

type FilterTab = 'all' | 'request' | 'overdue' | 'member' | 'system';

export const AdminAllNotificationsView: React.FC<AdminAllNotificationsViewProps> = ({
  notifications,
  onDismiss,
  onClearAll,
  onOpenRequest,
  onOpenMember,
  onSelectSection
}) => {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const counts = useMemo(() => {
    return {
      all: notifications.length,
      request: notifications.filter((n) => n.category === 'request').length,
      overdue: notifications.filter((n) => n.category === 'overdue').length,
      member: notifications.filter((n) => n.category === 'member').length,
      system: notifications.filter((n) => n.category === 'system').length
    };
  }, [notifications]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notifications.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false;
      if (q) {
        const hay = `${item.title} ${item.message} ${item.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notifications, filter, searchQuery]);

  return (
    <div className="space-y-4 w-full max-w-6xl mx-auto pb-8">
      {/* Header Summary Bar */}
      <div className="bg-[#0C152E] border border-[#16274E] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">All System Notifications</h2>
            <p className="text-xs text-slate-400">
              Unified live feed for pending requests, overdue alerts, member KYC & system events
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => onSelectSection('email_hub')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#070D19] hover:bg-[#132247] border border-[#182C58] text-xs font-semibold text-sky-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer tap-interactive"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email System</span>
          </button>

          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-xs font-semibold text-rose-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer tap-interactive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All ({notifications.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Bar + Search */}
      <div className="bg-[#0C152E] border border-[#16274E] rounded-2xl p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#070D19] border border-[#16274E] overflow-x-auto custom-scrollbar">
          {[
            { id: 'all' as FilterTab, label: `All (${counts.all})` },
            { id: 'request' as FilterTab, label: `Requests (${counts.request})` },
            { id: 'overdue' as FilterTab, label: `Overdue (${counts.overdue})` },
            { id: 'member' as FilterTab, label: `Members (${counts.member})` },
            { id: 'system' as FilterTab, label: `System & Audit (${counts.system})` }
          ].map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? 'text-amber-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="allNotifsTabPill"
                    transition={{ type: 'spring', stiffness: 460, damping: 34, duration: 0.16 }}
                    className="absolute inset-0 rounded-lg bg-[#132247] border border-amber-500/35"
                  />
                )}
                <span className="relative z-10 font-mono tabular-nums">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter notifications..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#070D19] border border-[#16274E] text-xs text-white focus:outline-none focus:border-amber-500/45"
          />
        </div>
      </div>

      {/* Unified Notification Feed */}
      <div className="bg-[#0C152E] border border-[#16274E] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto opacity-80" />
            <div className="text-sm font-bold text-white">No Active Notifications</div>
            <p className="text-xs text-slate-400">
              {filter === 'all'
                ? 'All requests, member alerts, and system notices are up to date.'
                : 'No alerts currently match this filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#16274E]/75">
            {filtered.map((notif) => {
              let icon = <ShieldCheck className="w-4 h-4 text-sky-400" />;
              let badgeBg = 'bg-sky-500/10 border-sky-500/25';
              let categoryLabel = 'System';

              if (notif.category === 'request') {
                icon = <FileText className="w-4 h-4 text-amber-400" />;
                badgeBg = 'bg-amber-500/10 border-amber-500/25';
                categoryLabel = 'Request';
              } else if (notif.category === 'overdue') {
                icon = <AlertTriangle className="w-4 h-4 text-rose-400" />;
                badgeBg = 'bg-rose-500/10 border-rose-500/25';
                categoryLabel = 'Overdue Alert';
              } else if (notif.category === 'member') {
                icon = <UserCheck className="w-4 h-4 text-emerald-400" />;
                badgeBg = 'bg-emerald-500/10 border-emerald-500/25';
                categoryLabel = 'Member';
              }

              const handlePrimaryAction = () => {
                if (notif.requestId && onOpenRequest) {
                  onOpenRequest(notif.requestId);
                } else if (notif.memberUid && onOpenMember) {
                  onOpenMember(notif.memberUid);
                } else if (notif.category === 'request') {
                  onSelectSection('requests');
                } else if (notif.category === 'overdue') {
                  onSelectSection('active_debts');
                } else if (notif.category === 'system') {
                  onSelectSection('audit');
                }
              };

              return (
                <div
                  key={notif.id}
                  onClick={handlePrimaryAction}
                  className="px-4 py-3.5 hover:bg-white/[0.025] transition-colors flex items-start justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl border ${badgeBg} flex items-center justify-center shrink-0 mt-0.5`}>
                      {icon}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-[13px] font-bold text-white">{notif.title}</span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {categoryLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatSafeDate(notif.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(notif.requestId || notif.memberUid || notif.actionLabel) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrimaryAction();
                        }}
                        className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#070D19] hover:bg-[#132247] border border-[#182C58] text-[11px] font-semibold text-amber-300 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>{notif.actionLabel || 'Inspect'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(notif.id);
                      }}
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
