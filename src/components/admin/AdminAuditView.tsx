import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Clock, 
  User, 
  AlertTriangle,
  Info,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';

function formatSafeDate(val: any): string {
  if (!val) return 'Recently';
  try {
    if (val instanceof Date && !isNaN(val.getTime())) {
      return format(val, 'dd MMM yyyy, HH:mm:ss');
    }
    if (typeof val?.toDate === 'function') {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return format(d, 'dd MMM yyyy, HH:mm:ss');
      }
    }
    if (typeof val?.toMillis === 'function') {
      const d = new Date(val.toMillis());
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm:ss');
    }
    if (typeof val?.seconds === 'number') {
      const d = new Date(val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0));
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm:ss');
    }
    if (typeof val === 'number') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm:ss');
    }
    if (typeof val === 'string') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, HH:mm:ss');
    }
  } catch (err) {
    console.warn("Audit log date parsing error:", err);
  }
  return 'Recently';
}

interface AdminAuditViewProps {
  auditLogs: any[];
}

export const AdminAuditView: React.FC<AdminAuditViewProps> = ({ auditLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const actionMatch = log.action?.toLowerCase().includes(q);
    const detailsMatch = log.details?.toLowerCase().includes(q);
    const adminMatch = log.adminName?.toLowerCase().includes(q) || log.adminEmail?.toLowerCase().includes(q);
    return actionMatch || detailsMatch || adminMatch;
  });

  return (
    <div className="space-y-3.5 max-w-4xl mx-auto animate-fadeIn pb-6">
      {/* Search Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search system logs..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0C152E] border border-[#16274E]/80 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>
      </div>

      {/* Logs Table / Card List */}
      <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl divide-y divide-[#16274E]/60 overflow-hidden shadow-xs">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No system audit logs found.
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const isWarning = log.severity === 'warning';
            const isCritical = log.severity === 'critical';

            let icon = <Info className="w-3.5 h-3.5 text-blue-400" />;
            let iconBg = 'bg-blue-500/10 border-blue-500/20';

            if (isWarning) {
              icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
              iconBg = 'bg-amber-500/10 border-amber-500/20';
            } else if (isCritical) {
              icon = <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
              iconBg = 'bg-rose-500/10 border-rose-500/20';
            }

            return (
              <div key={log.id || idx} className="p-3 sm:p-3.5 flex items-start gap-3 hover:bg-[#0A1229] transition-colors">
                <div className={`w-8 h-8 rounded-lg ${iconBg} border flex items-center justify-center shrink-0 mt-0.5`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="text-xs font-semibold text-white capitalize">{log.action || 'System Action'}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-slate-500" />
                      {formatSafeDate(log.timestamp)}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{log.details}</div>
                  {log.adminEmail && (
                    <div className="text-[10px] text-amber-400/80 mt-1 font-medium">
                      Admin: {log.adminEmail}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
