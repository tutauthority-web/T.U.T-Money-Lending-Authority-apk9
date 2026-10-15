import React, { useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Trash2, 
  Clock,
  User,
  FileText,
  X
} from 'lucide-react';
import { format } from 'date-fns';

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
    if (typeof val?.toMillis === 'function') {
      const d = new Date(val.toMillis());
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm');
    }
    if (typeof val?.seconds === 'number') {
      const d = new Date(val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0));
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm');
    }
    if (typeof val === 'number') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm');
    }
    if (typeof val === 'string') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm');
    }
  } catch (err) {
    console.warn("Notification date parsing error:", err);
  }
  return 'Just now';
}

export interface AdminNotificationItem {
  id: string;
  type: 'system' | 'request' | 'member';
  title: string;
  message: string;
  timestamp: any;
  read?: boolean;
}

interface AdminNotificationsViewProps {
  notifications: AdminNotificationItem[];
  onClearAll?: () => void;
  onDismiss?: (id: string) => void;
  onNavigateToRequest?: (reqId: string) => void;
}

export const AdminNotificationsView: React.FC<AdminNotificationsViewProps> = ({
  notifications,
  onClearAll,
  onDismiss,
  onNavigateToRequest
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'system' | 'requests' | 'members'>('all');

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'system' && n.type !== 'system') return false;
    if (activeTab === 'requests' && n.type !== 'request') return false;
    if (activeTab === 'members' && n.type !== 'member') return false;
    return true;
  });

  return (
    <div className="space-y-3.5 max-w-3xl mx-auto animate-fadeIn">
      {/* Tabs & Clear Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0C152E] border border-[#16274E]/80 overflow-x-auto custom-scrollbar">
          {(['all', 'system', 'requests', 'members'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#132247] text-amber-300 border border-amber-500/35 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {onClearAll && notifications.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3 h-3" /> Clear All ({notifications.length})
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {filteredNotifications.length === 0 ? (
          <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-8 text-center text-slate-400 text-xs space-y-1.5">
            <CheckCircle2 className="w-6 h-6 text-teal-400 mx-auto opacity-70" />
            <div className="font-semibold text-white">All Caught Up</div>
            <p className="text-slate-500 text-[11px]">No active notifications in this category.</p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            let icon = <Info className="w-3.5 h-3.5 text-blue-400" />;
            let iconBg = 'bg-blue-500/10 border-blue-500/20';

            if (notif.type === 'request') {
              icon = <FileText className="w-3.5 h-3.5 text-amber-400" />;
              iconBg = 'bg-amber-500/10 border-amber-500/20';
            } else if (notif.type === 'member') {
              icon = <User className="w-3.5 h-3.5 text-teal-400" />;
              iconBg = 'bg-teal-500/10 border-teal-500/20';
            } else if (notif.type === 'system') {
              icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
              iconBg = 'bg-emerald-500/10 border-emerald-500/20';
            }

            return (
              <div
                key={notif.id}
                className="bg-[#0C152E]/95 border border-[#16274E]/90 hover:border-slate-600/70 rounded-xl p-3 sm:p-3.5 flex items-start gap-3 transition-all shadow-xs group relative"
              >
                <div className={`w-8 h-8 rounded-lg ${iconBg} border flex items-center justify-center shrink-0 mt-0.5`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <div className="text-xs font-semibold text-white">{notif.title}</div>
                  <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{notif.message}</div>
                  <div className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{formatSafeDate(notif.timestamp)}</span>
                  </div>
                </div>

                {onDismiss && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(notif.id);
                    }}
                    title="Dismiss"
                    className="opacity-50 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-all absolute top-2.5 right-2.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
