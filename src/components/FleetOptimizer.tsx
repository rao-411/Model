import React, { useState, useMemo } from "react";
import { 
  Ship, Info, CheckCircle2, DollarSign, Calendar, Sparkles, TrendingUp,
  Layers, ChevronDown, ChevronUp, Scale, AlertCircle, RefreshCw, FileText,
  Clock, ArrowRight
} from "lucide-react";
import { PrEntry, RouteQuote, WarehouseRentConfig, ExcessMcqOverride, ProcessedScenario, SurchargeRule, ImportedFclQuote, IncotermRule } from "../types";
import { Language, t } from "../utils/translate";
import { calculateFleetScenarios, FleetScenarioResult, FleetCombination } from "../optimizer";
import { motion, AnimatePresence } from "motion/react";

interface FleetOptimizerProps {
  scenarios: ProcessedScenario[];
  entries: PrEntry[];
  carryingRate: number;
  opportunityRate: number;
  defaultMoq: number;
  defaultMcq: number;
  shipFrom: string;
  enablePullForward: boolean;
  prefer20ftForOctober: boolean;
  shipmentDates: string[];
  customQuotes: RouteQuote[];
  warehouseStuckDays: number;
  warehouseDailyRent: WarehouseRentConfig | number;
  exchangeRates: Record<string, number>;
  mcqSurchargeUSD: number;
  mcqSurchargeType: "flat" | "unitPriceIncrease";
  excessOverrides: ExcessMcqOverride[];
  vendorSurcharges: Record<string, number>;
  surchargeRules?: SurchargeRule[];
  importedFclQuotes?: ImportedFclQuote[];
  incotermRules?: IncotermRule[];
  previouslyExistingContainers?: number;
  lang: Language;
}

export default function FleetOptimizer({
  scenarios,
  entries,
  carryingRate,
  opportunityRate,
  defaultMoq,
  defaultMcq,
  shipFrom,
  enablePullForward,
  prefer20ftForOctober,
  shipmentDates,
  customQuotes,
  warehouseStuckDays,
  warehouseDailyRent,
  exchangeRates,
  mcqSurchargeUSD,
  mcqSurchargeType,
  excessOverrides,
  vendorSurcharges,
  surchargeRules,
  importedFclQuotes = [],
  incotermRules = [],
  previouslyExistingContainers = 0,
  lang
}: FleetOptimizerProps) {
  const [activeTab, setActiveTab] = useState<string>("1");
  const [expandedCombos, setExpandedCombos] = useState<Record<string, boolean>>({});
  const [selectedSubscenarioId, setSelectedSubscenarioId] = useState<string>("2.1.2");

  const formatDate = (d?: Date | string) => {
    if (!d) return "N/A";
    const dateObj = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dateObj.getTime()) || dateObj.getFullYear() < 2000) return "N/A";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[dateObj.getMonth()];
    const day = String(dateObj.getDate()).padStart(2, "0");
    const year = dateObj.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const activeSubscenario = useMemo(() => {
    return scenarios.find(s => s.id === selectedSubscenarioId) || scenarios[0];
  }, [scenarios, selectedSubscenarioId]);

  // Calculate fleet scenarios
  const fleetResults = useMemo(() => {
    return calculateFleetScenarios(
      entries,
      carryingRate,
      opportunityRate,
      defaultMoq,
      shipFrom,
      enablePullForward,
      prefer20ftForOctober,
      shipmentDates,
      customQuotes,
      warehouseStuckDays,
      warehouseDailyRent,
      exchangeRates,
      mcqSurchargeUSD,
      mcqSurchargeType,
      excessOverrides,
      vendorSurcharges,
      surchargeRules,
      importedFclQuotes,
      incotermRules,
      defaultMcq,
      previouslyExistingContainers
    );
  }, [
    entries, carryingRate, opportunityRate, defaultMoq, shipFrom,
    enablePullForward, prefer20ftForOctober, shipmentDates, customQuotes,
    warehouseStuckDays, warehouseDailyRent, exchangeRates,
    mcqSurchargeUSD, mcqSurchargeType, excessOverrides,
     vendorSurcharges, surchargeRules,
    importedFclQuotes, incotermRules, defaultMcq, previouslyExistingContainers
  ]);

  // Find the absolute cheapest scenario & combination across all results
  const absoluteCheapest = useMemo(() => {
    let cheapestScenarioId = "";
    let cheapestComboIndex = -1;
    let minCost = Infinity;

    fleetResults.forEach(sc => {
      sc.combinations.forEach((c, idx) => {
        if (c.trueLandedCost < minCost) {
          minCost = c.trueLandedCost;
          cheapestScenarioId = sc.id;
          cheapestComboIndex = idx;
        }
      });
    });

    if (cheapestScenarioId === "") return null;

    const sc = fleetResults.find(s => s.id === cheapestScenarioId)!;
    const item = sc.combinations[cheapestComboIndex];

    return {
      scenarioId: cheapestScenarioId,
      scenarioName: sc.name,
      numShipments: sc.numShipments,
      trueLandedCost: item.trueLandedCost,
      description: item.description,
      combination: item.combination
    };
  }, [fleetResults]);

  if (entries.length === 0 || fleetResults.length === 0) {
    return null;
  }

  const selectedResult = fleetResults.find(r => r.id === activeTab) || fleetResults[0];

  const toggleExpand = (comboId: string) => {
    setExpandedCombos(prev => ({
      ...prev,
      [comboId]: !prev[comboId]
    }));
  };

  const getShorthand = (combo: FleetCombination) => {
    const parts: string[] = [];
    if (combo.num40hq > 0) parts.push(`${combo.num40hq}x40HQ`);
    if (combo.num40gp > 0) parts.push(`${combo.num40gp}x40ft`);
    if (combo.num20gp > 0) parts.push(`${combo.num20gp}x20ft`);
    if (combo.numLcl > 0) parts.push(`LCL`);
    return parts.join("+");
  };

  return (
    <div id="fleet-optimizer-section" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-8">
      {/* Header Banner */}
      <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/10 px-6 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} className="text-blue-600" />
                {t("New", lang)}
              </span>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Layers className="text-blue-600" size={20} />
                {t("Container Fleet Matrix & Optimization Engine", lang)}
              </h2>
            </div>
            <p className="text-slate-500 text-sm">
              {t("Dynamically evaluate combinations of [40HQ, 40ft, 20ft, LCL] across multiple timing splits to find the absolute lowest cost.", lang)}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3 flex items-center gap-3 max-w-sm">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
              <Scale size={18} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                {t("Fleet Matrix Rules", lang)}
              </div>
              <div className="text-[11px] text-amber-800 leading-tight">
                40HQ (65 CBM) • 40ft (60 CBM) • 20ft (25 CBM) • LCL (Allowed only strictly below 19 CBM)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Absolute Cheapest Ribbon / Callout */}
      {absoluteCheapest && (
        <div className="bg-emerald-50/60 border-b border-emerald-100 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg animate-pulse">
              🏆
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                {t("Absolute Optimal Fleet Recommendation", lang)}
              </div>
              <div className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{absoluteCheapest.scenarioName}</span>
                <span className="mx-1.5">•</span>
                <span className="font-semibold text-slate-900">{absoluteCheapest.description}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-bold uppercase">{t("Cheapest True Landed Cost", lang)}</div>
            <div className="text-lg font-extrabold text-emerald-700">
              ฿{absoluteCheapest.trueLandedCost.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Cost & Scenario Comparison */}
      <div className="bg-slate-50/50 border-b border-slate-100 p-6">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-600" />
          {t("Three-Way Shipment Cost Comparison & Contrasting Overview", lang)}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {fleetResults.map(res => {
            const bestCombo = res.combinations[0];
            const bestCost = bestCombo?.trueLandedCost || 0;
            const isCheapestOverall = absoluteCheapest?.scenarioId === res.id;
            const costDiff = bestCost - (absoluteCheapest?.trueLandedCost || 0);

            // Compute newly suggested containers (FCL only) and rent exposure days
            const fclCountPerLeg = (bestCombo?.combination.num20gp || 0) + (bestCombo?.combination.num40gp || 0) + (bestCombo?.combination.num40hq || 0);
            const totalSuggestedContainers = fclCountPerLeg * (res.numShipments || 1);
            const newlySuggestedContainers = Math.max(0, totalSuggestedContainers - (previouslyExistingContainers || 0));
            const newlySuggestedContainerDays = newlySuggestedContainers * (warehouseStuckDays || 0);

            let friendlyName = "";
            if (res.id === "1") friendlyName = t("Option 1: Send all items in 1 shipment", lang);
            else if (res.id === "2") friendlyName = t("Option 2: Divide into 2 shipments", lang);
            else if (res.id === "3") friendlyName = t("Option 3: Divide into 3 separate shipments", lang);
            else friendlyName = res.name;

            return (
              <div 
                key={res.id} 
                className={`rounded-xl p-4 border transition ${
                  isCheapestOverall 
                    ? "bg-white border-emerald-500 shadow-sm ring-1 ring-emerald-500/20" 
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 leading-snug">{friendlyName}</span>
                  {isCheapestOverall ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                      {t("Cheapest", lang)}
                    </span>
                  ) : (
                    <span className="bg-amber-50 text-amber-700 text-[9px] font-semibold px-2 py-0.5 rounded-full">
                      +฿{costDiff.toLocaleString()}
                    </span>
                  )}
                </div>
                
                <div className="mt-3">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">{t("Best Landed Cost", lang)}</div>
                  <div className={`text-lg font-extrabold ${isCheapestOverall ? "text-emerald-700" : "text-slate-800"}`}>
                    ฿{bestCost.toLocaleString()}
                  </div>
                </div>
                
                <div className="text-xs text-slate-400 mt-2">
                  {t("New container rent exposure", lang)}: <span className="font-semibold text-slate-700">{newlySuggestedContainerDays.toLocaleString()}</span> {t("container-days", lang)}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>{t("Material Value", lang)}:</span>
                    <span className="font-medium text-slate-700">฿{res.materialValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>{t("MCQ MCQ Surcharge", lang)}:</span>
                    <span className={`font-medium ${res.moqPenalty > 0 ? "text-amber-700 font-semibold" : "text-slate-700"}`}>
                      ฿{res.moqPenalty.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>{t("Carrying & Opportunity", lang)}:</span>
                    <span className="font-medium text-slate-700">
                      ฿{(res.carryingCost + res.opportunityCost).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 pt-2 border-t border-dashed border-slate-100">
                    <span>{t("Best Config", lang)}:</span>
                    <span className="font-semibold text-blue-700 truncate max-w-[120px]">{bestCombo ? bestCombo.description : "None"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scenario Splicer Tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 gap-2">
        {fleetResults.map(res => {
          const isCheapestInScenario = absoluteCheapest?.scenarioId === res.id;
          const bestLandedCost = res.combinations[0]?.trueLandedCost || 0;

          return (
            <button
              key={res.id}
              onClick={() => setActiveTab(res.id)}
              className={`flex-1 py-3 px-4 rounded-lg text-left transition duration-200 cursor-pointer ${
                activeTab === res.id
                  ? "bg-white shadow-sm border border-slate-200/80 text-blue-700 font-semibold"
                  : "hover:bg-white/60 text-slate-600 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold tracking-tight">{res.name}</span>
                {isCheapestInScenario && (
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                    {t("Cheapest", lang)}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {res.numShipments} {res.numShipments === 1 ? t("Leg", lang) : t("Legs", lang)} • {res.legVolume.toFixed(1)} CBM / {t("leg", lang)}
              </div>
              <div className="text-xs font-bold text-slate-700 mt-2">
                Min Landed: <span className="text-emerald-600">฿{bestLandedCost.toLocaleString()}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-6">
        {/* Scenario Logistics Metadata Card */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">{t("Total Shipment Volume", lang)}</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">
              {selectedResult.totalCbm.toFixed(2)} CBM
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">{t("Volume Per Leg", lang)}</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">
              {selectedResult.legVolume.toFixed(2)} CBM
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">{t("Material Value", lang)}</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5 text-slate-700">
              ฿{selectedResult.materialValue.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">{t("MOQ Penalty (MCQ Surcharge)", lang)}</div>
            <div className="text-sm font-bold text-amber-700 mt-0.5">
              ฿{selectedResult.moqPenalty.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 col-span-2 md:col-span-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase">{t("Carrying & Capital", lang)}</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">
              ฿{(selectedResult.carryingCost + selectedResult.opportunityCost).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Combinations List Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {t("Valid Fleet Permutations (Sorted by Landed Cost)", lang)}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full">
            <Info size={12} />
            {t("Click any card for full details and surcharge breakdowns.", lang)}
          </div>
        </div>

        {/* Combinations Grid */}
        <div className="space-y-3.5">
          {selectedResult.combinations.map((item, idx) => {
            const isAbsoluteCheapest = absoluteCheapest?.scenarioId === selectedResult.id && absoluteCheapest?.description === item.description;
            const isFirstInScenario = idx === 0;
            const keyId = `${selectedResult.id}-${idx}`;
            const isExpanded = !!expandedCombos[keyId];

            return (
              <div 
                key={keyId}
                className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                  isAbsoluteCheapest 
                    ? "border-emerald-300 shadow-md shadow-emerald-500/5 bg-emerald-50/5" 
                    : isFirstInScenario 
                      ? "border-blue-200 bg-blue-50/5" 
                      : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                {/* Combination Card Header Row */}
                <div 
                  onClick={() => toggleExpand(keyId)}
                  className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/40 select-none"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg mt-0.5 ${
                      isAbsoluteCheapest 
                        ? "bg-emerald-100 text-emerald-800" 
                        : isFirstInScenario 
                          ? "bg-blue-50 text-blue-800" 
                          : "bg-slate-100 text-slate-600"
                    }`}>
                      <Ship size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">
                          {item.description}
                        </span>
                        {isAbsoluteCheapest && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            🏆 {t("Best Overall Price", lang)}
                          </span>
                        )}
                        {isFirstInScenario && !isAbsoluteCheapest && (
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {t("Scenario Best", lang)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                        <span>
                          {t("Total Capacity", lang)}: <strong className="text-slate-700">{item.combination.totalCapacity} CBM</strong>
                        </span>
                        <span>•</span>
                        <span>
                          {t("Logistics Fees", lang)}: <strong className="text-slate-700">฿{(item.combination.totalLogisticsCost * selectedResult.numShipments).toLocaleString()}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{t("True Landed Cost", lang)}</div>
                      <div className="text-base font-extrabold text-slate-900">
                        ฿{item.trueLandedCost.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-100 bg-slate-50/60"
                    >
                      <div className="px-5 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 1. Logistics Freight Breakdown */}
                        <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-200/70 shadow-sm">
                          <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Ship size={14} />
                            {t("Logistics & Shipping Cost", lang)}
                          </h4>
                          
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-500">{t("Freight Ocean Fee (per leg)", lang)}</span>
                              <span className="font-semibold text-slate-700">฿{item.combination.freightCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-500">{t("Local Port Dues / THC (per leg)", lang)}</span>
                              <span className="font-semibold text-slate-700">฿{item.combination.localCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-500">{t("Customs Brokerage (per leg)", lang)}</span>
                              <span className="font-semibold text-slate-700">฿{item.combination.brokerageCost.toLocaleString()}</span>
                            </div>
                            {item.combination.warehouseRent > 0 && (
                              <div className="flex justify-between py-1 border-b border-slate-50">
                                <span className="text-slate-500">{t("Port Warehouse Storage Rent (per leg)", lang)}</span>
                                <span className="font-semibold text-amber-600">฿{item.combination.warehouseRent.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between pt-2 border-t border-slate-100 text-slate-800 font-bold">
                              <span>{t("Leg Logistics Total", lang)}</span>
                              <span>฿{item.combination.totalLogisticsCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-slate-100 text-blue-700 font-extrabold text-[13px]">
                              <span>{t("All Legs Total", lang)} ({selectedResult.numShipments}x {t("shipments", lang)})</span>
                              <span>฿{(item.combination.totalLogisticsCost * selectedResult.numShipments).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Sourcing & Financial Cost */}
                        <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-200/70 shadow-sm">
                          <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                            <DollarSign size={14} />
                            {t("Sourcing & Financial Costs", lang)}
                          </h4>

                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-500">{t("Consolidated Material Value", lang)}</span>
                              <span className="font-semibold text-slate-700">฿{selectedResult.materialValue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-500">{t("MOQ / MCQ Surcharge Sinks", lang)}</span>
                              <span className={`font-semibold ${selectedResult.moqPenalty > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                ฿{selectedResult.moqPenalty.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-500">{t("Inventory Carrying Penalty", lang)}</span>
                              <span className="font-semibold text-slate-700">฿{selectedResult.carryingCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-500">{t("Capital Opportunity Cost", lang)}</span>
                              <span className="font-semibold text-slate-700">฿{selectedResult.opportunityCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-100 text-indigo-700 font-extrabold text-[13px]">
                              <span>{t("Total Sourcing Surcharges", lang)}</span>
                              <span>฿{(selectedResult.materialValue + selectedResult.moqPenalty + selectedResult.carryingCost + selectedResult.opportunityCost).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Formula Footer */}
                        <div className="col-span-1 md:col-span-2 bg-slate-100/75 rounded-lg p-3 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2 border border-slate-200/40">
                          <AlertCircle size={14} className="text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <strong>{t("True Landed Cost Formula", lang)}:</strong> Material Value (฿{selectedResult.materialValue.toLocaleString()}) + MOQ Penalty (฿{selectedResult.moqPenalty.toLocaleString()}) + Total Shipping Costs (฿{(item.combination.totalLogisticsCost * selectedResult.numShipments).toLocaleString()}) + Carrying (฿{selectedResult.carryingCost.toLocaleString()}) + Opportunity Capital (฿{selectedResult.opportunityCost.toLocaleString()}) = <span className="font-bold text-slate-800">฿{item.trueLandedCost.toLocaleString()}</span>.
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Syteline Subscenarios Live Shipping Calendar */}
      <div className="border-t border-slate-200 bg-slate-50/20 px-6 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200/50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="text-indigo-600" size={18} />
              {t("Syteline Subscenarios & Live Shipping Calendar", lang)}
            </h3>
            <p className="text-slate-500 text-xs mt-0.5 leading-relaxed font-sans">
              {t("Compare real-world shipping dates, container allocations, and volume profiles across all 2.1, 2.2, and 3.0 subscenarios.", lang)}
            </p>
          </div>
          
          <div className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 max-w-md leading-normal font-sans">
            <strong>{t("Clarification:", lang)}</strong> {t("The Fleet Solver above explores hypothetical symmetrical splits. This calendar below displays the actual tactical schedules compiled from item-level production due dates, MOQ bounds, and pull-forwards.", lang)}
          </div>
        </div>

        {/* Subscenario Selector Horizontal Tabs */}
        <div className="flex overflow-x-auto pb-2 mb-4 gap-2 scrollbar-thin scrollbar-thumb-slate-200">
          {scenarios.map(sc => {
            const isSelected = selectedSubscenarioId === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => setSelectedSubscenarioId(sc.id)}
                className={`py-2 px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono">
                  <span>{sc.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isSelected 
                      ? "bg-indigo-500 text-white" 
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    ฿{Math.round(sc.totalLandedCost).toLocaleString()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Subscenario Timeline & Details */}
        {activeSubscenario && (
          <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            {/* Subscenario Summary Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">{t("Selected Schedule", lang)}</div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mt-0.5 font-sans">
                  {activeSubscenario.name}
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    activeSubscenario.containerMatchingStatus === "Approved" 
                      ? "bg-emerald-100 text-emerald-800" 
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {activeSubscenario.containerMatchingStatus === "Approved" 
                      ? t("Approved Container Match", lang) 
                      : t("Container Mismatch", lang)
                    }
                  </span>
                </h4>
              </div>
              
              <div className="flex gap-4 font-mono">
                <div className="text-left sm:text-right">
                  <div className="text-[10px] text-slate-400 font-bold uppercase font-sans">{t("Total Volume", lang)}</div>
                  <div className="text-sm font-bold text-slate-800">{activeSubscenario.totalCbm.toFixed(2)} CBM</div>
                </div>
                <div className="text-left sm:text-right border-l border-slate-100 pl-4">
                  <div className="text-[10px] text-slate-400 font-bold uppercase font-sans">{t("Total Landed Cost", lang)}</div>
                  <div className="text-sm font-extrabold text-indigo-700">฿{activeSubscenario.totalLandedCost.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Shipment Cards Timeline */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
                {t("Shipment Departure Calendar & Container Booking Plan", lang)}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {activeSubscenario.shipments.map((ship, index) => {
                  const containersDesc = ship.totalQty > 0 ? ship.container.name : t("No Items Scheduled", lang);
                  const formattedShipDate = ship.shipmentDate ? formatDate(ship.shipmentDate) : "N/A";
                  const formattedArrivalDate = ship.date ? formatDate(ship.date) : "N/A";
                  const hasVolume = ship.totalCbm > 0;

                  return (
                    <div 
                      key={index} 
                      className={`p-4 rounded-xl border flex flex-col justify-between transition hover:shadow-sm ${
                        hasVolume 
                          ? "bg-slate-50/50 border-slate-200" 
                          : "bg-slate-100/30 border-slate-200/50 opacity-60"
                      }`}
                    >
                      {/* Card Header */}
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-slate-200 text-slate-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase font-mono tracking-wider">
                            {t("Shipment", lang)} {index + 1} ({t("Week", lang)} {ship.week})
                          </span>
                          <span className="text-xs font-bold text-slate-800 font-mono">
                            {ship.totalCbm.toFixed(2)} CBM
                          </span>
                        </div>

                        {/* Shipment Dates */}
                        <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-150/60 mb-3 text-xs font-sans">
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="flex items-center gap-1">
                              <Clock size={12} className="text-blue-500" />
                              {t("Port Departure (ETD):", lang)}
                            </span>
                            <strong className="text-slate-800 font-mono">{formattedShipDate}</strong>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-dashed border-slate-100 font-sans">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 size={12} className="text-emerald-500" />
                              {t("Syteline Arrival (ETA):", lang)}
                            </span>
                            <strong className="text-slate-800 font-mono">{formattedArrivalDate}</strong>
                          </div>
                        </div>

                        {/* Containers Booked */}
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-2.5 mb-3 flex items-center gap-2">
                          <Ship size={14} className="text-indigo-600" />
                          <div>
                            <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-wide font-sans">
                              {t("Container Bookings", lang)}
                            </div>
                            <div className="text-xs font-extrabold text-indigo-800">
                              {containersDesc}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Financial and details footer */}
                      <div className="text-[11px] text-slate-500 border-t border-slate-200/60 pt-2.5 mt-2 flex justify-between font-sans">
                        <span>
                          {t("Sourced Qty:", lang)} <strong className="text-slate-700 font-mono">{Math.round(ship.totalQty).toLocaleString()} YD</strong>
                        </span>
                        <span>
                          {t("Logistics Total:", lang)} <strong className="text-slate-800 font-mono">฿{Math.round(ship.freightCost + ship.localCost + ship.brokerageCost).toLocaleString()}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
