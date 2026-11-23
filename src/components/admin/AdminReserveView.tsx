import React, { useState } from 'react';
import { 
  Landmark, 
  PiggyBank, 
  ShieldCheck, 
  AlertTriangle, 
  Edit3, 
  ArrowRight, 
  Clock, 
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';

interface AdminReserveViewProps {
  reserveFund?: number;
  totalAllocated: number; // Outstanding loans
  targetAmount?: number;
  totalDeposits: number;
  onUpdateReserveFund?: (newAmount: number) => Promise<void>;
  onOpenAdvancedReserve?: () => void;
}

export const AdminReserveView: React.FC<AdminReserveViewProps> = ({
  reserveFund,
  totalAllocated,
  targetAmount = 500000,
  totalDeposits,
  onUpdateReserveFund,
  onOpenAdvancedReserve
}) => {
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'set' | 'add' | 'subtract'>('set');
  const [amountInput, setAmountInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Exact mathematical logic: Available Reserve = Target Capital - Active Outstanding Loan Allocations
  const availableReserve = Math.max(0, targetAmount - totalAllocated);
  const availablePercent = targetAmount > 0 
    ? Math.min(100, Math.max(0, Math.round((availableReserve / targetAmount) * 100))) 
    : 0;

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateReserveFund) return;
    const val = Number(amountInput);
    if (isNaN(val) || val < 0) return;

    setIsSubmitting(true);
    try {
      let finalTarget = val;
      if (adjustmentType === 'add') {
        finalTarget = targetAmount + val;
      } else if (adjustmentType === 'subtract') {
        finalTarget = Math.max(0, targetAmount - val);
      }
      await onUpdateReserveFund(finalTarget);
      setShowAdjustModal(false);
      setAmountInput('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-7xl mx-auto animate-fadeIn">
      {/* CARD 1: PRIMARY RESERVE */}
      <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#16274E]/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-normal">Primary Reserve</h2>
              <div className="text-[11px] text-slate-400">Core operational lending liquidity pool</div>
            </div>
          </div>

          <button
            onClick={() => setShowAdjustModal(true)}
            className="px-2.5 py-1 rounded-md text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3 h-3" /> Adjust Fund
          </button>
        </div>

        {/* 3 Metric Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
            <div className="text-[11px] font-semibold text-slate-400">Target Amount</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">
              ৳ {targetAmount.toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
            <div className="text-[11px] font-semibold text-slate-400">Allocated (Loans)</div>
            <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">
              ৳ {totalAllocated.toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
            <div className="text-[11px] font-semibold text-slate-400">Available</div>
            <div className="text-lg font-bold font-mono text-teal-400 mt-0.5">
              ৳ {availableReserve.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Progress Bar with % indicator */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-slate-400 text-[11px]">Reserve Target Coverage</span>
            <span className="text-teal-400 font-mono font-bold text-xs">{availablePercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#090F24] border border-[#16274E]/70 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-teal-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${availablePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* CARD 2: MEMBER DEPOSIT RESERVE */}
      <div className="bg-[#0C152E]/95 border border-[#16274E]/90 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#16274E]/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <PiggyBank className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-normal">Member Deposit Reserve</h2>
              <div className="text-[11px] text-slate-400">Citizen savings protected by strict deposit insurance protocol</div>
            </div>
          </div>
        </div>

        {/* 2 Metric Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
            <div className="text-[11px] font-semibold text-slate-400">Total Deposits</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">
              ৳ {totalDeposits.toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#090F24] border border-[#16274E]/70">
            <div className="text-[11px] font-semibold text-slate-400">Available for Use</div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
              ৳ 0
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-normal">
              Used only in emergency under mutual agreement
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info & Action */}
      <div className="bg-[#090F24] border border-[#16274E]/70 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px]">Last Updated: {format(new Date(), 'dd MMM yyyy, HH:mm')}</span>
        </div>

        {onOpenAdvancedReserve && (
          <button
            onClick={onOpenAdvancedReserve}
            className="px-3 py-1 rounded-md text-xs font-medium text-blue-300 bg-[#12224A] hover:bg-[#1A316B] border border-[#1E3A7B] transition-colors self-start sm:self-auto cursor-pointer"
          >
            View Details
          </button>
        )}
      </div>

      {/* Modal: Adjust Reserve Fund */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B132B] border border-[#16274E] rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl animate-scaleUp">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Landmark className="w-4 h-4 text-amber-400" /> Adjust Primary Reserve Fund
            </h3>

            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#090F24] border border-[#16274E]/70">
              {(['set', 'add', 'subtract'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAdjustmentType(t)}
                  className={`flex-1 py-1 rounded-md text-xs font-semibold uppercase transition-all cursor-pointer ${
                    adjustmentType === t
                      ? 'bg-[#132247] text-amber-400 border border-amber-500/35'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                {adjustmentType === 'set' ? 'New Exact Fund Balance (৳)' : 'Adjustment Amount (৳)'}
              </label>
              <input
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="e.g. 250000"
                className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-[#16274E]/70 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdjustSubmit}
                disabled={isSubmitting || !amountInput}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-500/20"
              >
                {isSubmitting ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
