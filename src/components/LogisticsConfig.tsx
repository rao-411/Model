import { Percent, Settings2, ShieldCheck, RefreshCw, ArrowRightLeft } from "lucide-react";
import { Language, t } from "../utils/translate";

interface LogisticsConfigProps {
  carryingRate: number;
  setCarryingRate: (val: number) => void;
  opportunityRate: number;
  setOpportunityRate: (val: number) => void;
  defaultMoq: number;
  setDefaultMoq: (val: number) => void;
  defaultMcq: number;
  setDefaultMcq: (val: number) => void;
  transitTimes: Record<string, number>;
  setTransitTime: (route: string, days: number) => void;
  enablePullForward: boolean;
  setEnablePullForward: (val: boolean) => void;
  prefer20ftForOctober: boolean;
  setPrefer20ftForOctober: (val: boolean) => void;
  lang: Language;
}

export default function LogisticsConfig({
  carryingRate,
  setCarryingRate,
  opportunityRate,
  setOpportunityRate,
  defaultMoq,
  setDefaultMoq,
  defaultMcq,
  setDefaultMcq,
  transitTimes,
  setTransitTime,
  enablePullForward,
  setEnablePullForward,
  prefer20ftForOctober,
  setPrefer20ftForOctober,
  lang
}: LogisticsConfigProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-100">
        <Settings2 size={18} className="text-blue-600" />
        <h2 className="text-lg font-semibold text-slate-800">{t("Logistics & Cost Config", lang)}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Column 1: Default MOQ & MCQ */}
        <div className="space-y-5">
          <div className="pt-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-violet-600" />
                {t("Default Minimum Order Quantity (MOQ)", lang)}
              </span>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={defaultMoq}
              onChange={(e) => setDefaultMoq(parseInt(e.target.value) || 0)}
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              {t("Auto-extracted from the uploaded manifest (Order Minimum). Editable.", lang)}
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-violet-600" />
                {t("Default Color Minimum Color Quantity (MCQ)", lang)}
              </span>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={defaultMcq}
              onChange={(e) => setDefaultMcq(parseInt(e.target.value) || 0)}
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              {t("Auto-extracted from the uploaded manifest (Order MCQ). Editable.", lang)}
            </p>
          </div>
        </div>

        {/* Column 2: Financial Rates & MCQ Pull Forward */}
        <div className="space-y-5 border-t md:border-t-0 md:border-x border-slate-100 md:px-6">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Percent size={12} className="text-blue-600" />
                {t("Annual Inventory Carrying Rate", lang)}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                value={parseFloat((carryingRate * 100).toFixed(2))}
                onChange={(e) => setCarryingRate((parseFloat(e.target.value) || 0) / 100)}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg pl-3 pr-8 py-2 text-sm font-mono font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">%</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              {t("Used as: (Value ÷ 2) × Rate × (Days Early / 365)", lang)}
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Percent size={12} className="text-emerald-600" />
                {t("Capital Opportunity Rate (WACC)", lang)}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                value={parseFloat((opportunityRate * 100).toFixed(2))}
                onChange={(e) => setOpportunityRate((parseFloat(e.target.value) || 0) / 100)}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg pl-3 pr-8 py-2 text-sm font-mono font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">%</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              {t("Used as: Value × [ (1 + Rate)^(Days Early / 365) − 1 ]", lang)}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enablePullForward}
                id="enable-mcq-pull-forward"
                onChange={(e) => setEnablePullForward(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <ArrowRightLeft size={12} className="text-blue-600" />
                  {t("Enable MCQ Pull-Forwards", lang)}
                </span>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {t("Automatically consolidates color rolls from later weeks into earlier shipments to resolve MOQ gaps (removes leftover quantities from source weeks).", lang)}
                </p>
              </div>
            </label>
          </div>
        </div>

      </div>

      <div className="mt-6 bg-blue-50/50 border border-blue-100 p-3.5 rounded-lg flex items-start gap-2.5">
        <RefreshCw size={14} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="text-[11px] text-slate-600 leading-relaxed">
          <span className="text-blue-800 font-semibold">{t("Automatic Recalculation:", lang)}</span> {t("Updating values or transit days immediately recalculates all sub-scenarios, container schedules, and capital carrying costs!", lang)}
        </div>
      </div>
    </div>
  );
}

