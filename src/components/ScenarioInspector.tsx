import { useState, useEffect, useMemo } from "react";
import { ProcessedScenario, ShipmentGroup, PrEntry, MoqAlert, ExcessMcqOverride, SurchargeRule, ContainerOverride } from "../types";
import { ShieldAlert, AlertTriangle, HelpCircle, Truck, Layers, Eye, Table, CheckSquare, Plus, Minus, Info, CheckCircle2, FileSpreadsheet, Download, RotateCcw, GripVertical, ChevronDown, ChevronUp, Pencil, X, Calendar, Trash2, Check } from "lucide-react";
import { exportCombinedExcelReport, exportSeparatedExcelZip } from "../utils/excelExport";
import { Language, t, tp } from "../utils/translate";
import { getEffectiveMcqForColor } from "../optimizer";

interface ScenarioInspectorProps {
  scenario: ProcessedScenario;
  scenarios: ProcessedScenario[];
  exchangeRates: Record<string, number>;
  lang: Language;
  currency: "THB" | "USD";
  onMovePrLine?: (prId: string, targetWeek: number) => void;
  onResetOverrides?: () => void;
  hasManualOverrides?: boolean;
  matrixQtyOverrides?: Record<string, number>;
  onMatrixQtyChange?: (itemDescription: string, colorCode: string, week: number, value: number | null) => void;
  containerOverrides?: Record<string, ContainerOverride>;
  onContainerOverrideChange?: (week: number, override: ContainerOverride | null) => void;
  onFixUnitPrice?: (itemCode: string, colorCode: string, value: number | null | "zero") => void;
  entries?: PrEntry[];
  maxWeeks?: number;
  computedDates?: Date[];
  shipmentDates?: string[];
  setShipmentDates?: (dates: string[]) => void;
  excessOverrides?: ExcessMcqOverride[];
  setExcessOverrides?: (overrides: ExcessMcqOverride[]) => void;
  surchargeRules?: SurchargeRule[];
  mcqMoqPreferences?: Record<string, "surcharge" | "pr_file">;
  onSelectMcqMoqPreference?: (key: string, choice: "surcharge" | "pr_file") => void;
  onAcceptFlag?: (flagKey: string) => void;
}

// A small controlled/uncontrolled hybrid number input used inside the MCQ matrix cells.
// Lets the user type a replacement quantity directly (no drag-and-drop). Commits on blur
// or Enter; an empty value clears the manual override and reverts to the computed quantity.
function EditableQtyCell({
  overrideValue,
  computedQty,
  onCommit,
  disabled
}: {
  overrideValue?: number;
  computedQty: number;
  onCommit: (value: number | null) => void;
  disabled?: boolean;
}) {
  const effective = overrideValue !== undefined ? overrideValue : computedQty;
  const format = (n: number) => (n > 0 ? String(Math.round(n * 100) / 100) : "");
  const [text, setText] = useState<string>(format(effective));
  const [isFocused, setIsFocused] = useState(false);

  // Keep the field in sync if the override is cleared elsewhere (e.g. Reset Assignments)
  // or the underlying computed quantity changes — but never fight the user while they're typing.
  useEffect(() => {
    if (!isFocused) {
      setText(format(effective));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, isFocused]);

  const commit = () => {
    setIsFocused(false);
    const trimmed = text.trim();
    if (trimmed === "") {
      onCommit(null);
      return;
    }
    const parsed = Number(trimmed.replace(/,/g, ""));
    if (Number.isNaN(parsed) || parsed < 0) {
      // Invalid entry, revert to last known good value
      setText(format(effective));
      return;
    }
    onCommit(parsed);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={text}
      placeholder="0"
      onChange={(e) => {
        const v = e.target.value;
        // Allow empty, digits, and a single decimal point while typing
        if (v === "" || /^[0-9]*\.?[0-9]*$/.test(v)) {
          setText(v);
        }
      }}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setText(format(effective));
          setIsFocused(false);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-20 text-center font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-400"
    />
  );
}

// Presets shown in the per-shipment container picker on the "Shipment
// Containers & Bins" tab. "Auto (Recommended)" clears the override so the
// logistics engine goes back to auto-computing the cheapest valid packing;
// any other preset — or a custom mix — replaces it and re-bills freight/
// local/brokerage costs against exactly what the user picked.
const CONTAINER_PRESETS: { key: string; label: string; value: ContainerOverride | null }[] = [
  { key: "auto", label: "Auto (Recommended)", value: null },
  { key: "lcl", label: "LCL", value: { num20gp: 0, num40gp: 0, num40hq: 0, numLcl: 1, isLcl: true } },
  { key: "1x20", label: "1x 20ft FCL", value: { num20gp: 1, num40gp: 0, num40hq: 0, numLcl: 0, isLcl: false } },
  { key: "1x40", label: "1x 40ft FCL", value: { num20gp: 0, num40gp: 1, num40hq: 0, numLcl: 0, isLcl: false } },
  { key: "1x40hq", label: "1x 40HQ FCL", value: { num20gp: 0, num40gp: 0, num40hq: 1, numLcl: 0, isLcl: false } },
  { key: "2x40hq", label: "2x 40HQ FCL", value: { num20gp: 0, num40gp: 0, num40hq: 2, numLcl: 0, isLcl: false } },
  { key: "1x40hq_1x20", label: "1x 40HQ + 1x 20ft FCL", value: { num20gp: 1, num40gp: 0, num40hq: 1, numLcl: 0, isLcl: false } },
  { key: "1x40hq_1x40", label: "1x 40HQ + 1x 40ft FCL", value: { num20gp: 0, num40gp: 1, num40hq: 1, numLcl: 0, isLcl: false } },
  { key: "3x40hq", label: "3x 40HQ FCL", value: { num20gp: 0, num40gp: 0, num40hq: 3, numLcl: 0, isLcl: false } },
  { key: "custom", label: "Custom Mix\u2026", value: null }
];

function presetKeyForOverride(o?: ContainerOverride): string {
  if (!o) return "auto";
  const match = CONTAINER_PRESETS.find(p =>
    p.value && p.value.isLcl === o.isLcl && p.value.num20gp === o.num20gp && p.value.num40gp === o.num40gp
      && p.value.num40hq === o.num40hq && (p.value.numLcl || 0) === (o.numLcl || 0)
  );
  return match ? match.key : "custom";
}

// Lets the user swap the auto-computed container(s) for a shipment with a
// manual pick — either a common preset (1x 40HQ, 2x 40HQ, LCL, etc.) or a
// fully custom 20ft/40ft/40HQ mix. Selecting "Auto" clears the override.
function ContainerMixPicker({
  override,
  autoContainer,
  onChange,
  disabled
}: {
  override?: ContainerOverride;
  // The currently active (auto-computed or previously-set) container mix,
  // used only to seed the custom-mix fields with something sensible the
  // first time the user opens "Custom Mix" — never used to decide what's
  // selected in the dropdown.
  autoContainer?: { num20gp: number; num40gp: number; num40hq: number };
  onChange: (override: ContainerOverride | null) => void;
  disabled?: boolean;
}) {
  const derivedKey = presetKeyForOverride(override);

  // Whether "Custom Mix" is the active dropdown option. This is tracked as
  // its own piece of state — NOT derived by matching the current counts
  // against the preset list — because a custom mix can legitimately equal
  // a preset's counts (e.g. the default 1x 20ft seed) without meaning the
  // user picked that preset. Deriving it from the numbers alone caused
  // "Custom Mix" to silently snap back to whichever preset it happened to
  // match as soon as it was selected.
  const [customMode, setCustomMode] = useState(derivedKey === "custom");
  const [customDraft, setCustomDraft] = useState<ContainerOverride>(
    override && derivedKey === "custom"
      ? { ...override, numLcl: override.numLcl || 0 }
      : {
          num20gp: autoContainer?.num20gp || 1,
          num40gp: autoContainer?.num40gp || 0,
          num40hq: autoContainer?.num40hq || 0,
          numLcl: 0,
          isLcl: false
        }
  );

  // If the override changes to a mix that doesn't match any known preset
  // (e.g. restored from a saved session), switch into custom mode so the
  // dropdown and fields reflect it correctly.
  useEffect(() => {
    if (derivedKey === "custom" && override) {
      setCustomMode(true);
      setCustomDraft({ ...override, numLcl: override.numLcl || 0 });
    } else if (!override) {
      // Override was cleared externally (e.g. "Reset Overrides") — go back
      // to showing "Auto (Recommended)" instead of staying stuck in custom mode.
      setCustomMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override?.num20gp, override?.num40gp, override?.num40hq, override?.numLcl, override?.isLcl]);

  const currentKey = customMode ? "custom" : derivedKey;

  const handlePresetChange = (key: string) => {
    if (key === "custom") {
      setCustomMode(true);
      onChange(customDraft);
      return;
    }
    setCustomMode(false);
    const preset = CONTAINER_PRESETS.find(p => p.key === key);
    onChange(preset ? preset.value : null);
  };

  // LCL can be combined freely with any FCL container counts — any actual
  // volume beyond what the FCL containers hold ships LCL by volume. isLcl
  // (pure-LCL) is derived, true only when LCL is set and no FCL containers
  // are selected; it's never user-editable directly.
  const updateCustom = (patch: Partial<ContainerOverride>) => {
    const merged = { ...customDraft, ...patch };
    const hasFcl = merged.num20gp > 0 || merged.num40gp > 0 || merged.num40hq > 0;
    const next: ContainerOverride = { ...merged, isLcl: merged.numLcl > 0 && !hasFcl };
    setCustomDraft(next);
    onChange(next);
  };

  return (
    <div className="mt-2.5">
      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        Container Selection
      </label>
      <select
        value={currentKey}
        disabled={disabled}
        onChange={(e) => handlePresetChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
        title="Choose which container(s) to use for this shipment"
      >
        {CONTAINER_PRESETS.map(p => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </select>

      {currentKey === "custom" && (
        <div className="mt-2">
          <div className="grid grid-cols-4 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold text-slate-400 uppercase text-center">LCL</span>
              <input
                type="number"
                min={0}
                value={customDraft.numLcl}
                disabled={disabled}
                onChange={(e) => updateCustom({ numLcl: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-center font-mono font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                title="Number of LCL shares to blend in alongside the FCL containers"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold text-slate-400 uppercase text-center">20ft</span>
              <input
                type="number"
                min={0}
                value={customDraft.num20gp}
                disabled={disabled}
                onChange={(e) => updateCustom({ num20gp: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-center font-mono font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold text-slate-400 uppercase text-center">40ft</span>
              <input
                type="number"
                min={0}
                value={customDraft.num40gp}
                disabled={disabled}
                onChange={(e) => updateCustom({ num40gp: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-center font-mono font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold text-slate-400 uppercase text-center">40HQ</span>
              <input
                type="number"
                min={0}
                value={customDraft.num40hq}
                disabled={disabled}
                onChange={(e) => updateCustom({ num40hq: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-center font-mono font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
          </div>
          {customDraft.numLcl > 0 && (customDraft.num20gp > 0 || customDraft.num40gp > 0 || customDraft.num40hq > 0) && (
            <div className="mt-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-500">
              Mixed load: your FCL containers fill first, and any leftover volume beyond their capacity ships LCL.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Displays a quantity at its true source precision instead of rounding it
// off. Uploaded PR files commonly carry 2-3 decimal places (e.g. 157.634),
// and truncating that with a fixed toFixed(1) silently hides real digits
// from the source data. This only cleans up genuine floating-point noise
// (e.g. 157.00000000002) and trims insignificant trailing zeros — it never
// drops a meaningful digit that was actually present in the uploaded file.
const formatOriginalQty = (n: number): string => {
  const cleaned = Math.round(n * 1e6) / 1e6; // strip floating-point noise only
  if (Number.isInteger(cleaned)) return cleaned.toFixed(1);
  // Show up to 3 decimal places (the precision typically present in
  // Syteline/ERP exports), trimming any trailing zeros beyond that.
  return cleaned.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0");
};

export default function ScenarioInspector({ 
  scenario, 
  scenarios, 
  exchangeRates, 
  lang,
  currency,
  onMovePrLine,
  onResetOverrides,
  hasManualOverrides,
  matrixQtyOverrides = {},
  onMatrixQtyChange,
  containerOverrides = {},
  onContainerOverrideChange,
  onFixUnitPrice,
  entries = [],
  maxWeeks = 12,
  computedDates = [],
  shipmentDates = [],
  setShipmentDates = () => {},
  excessOverrides = [],
  setExcessOverrides = () => {},
  surchargeRules = [],
  mcqMoqPreferences = {},
  onSelectMcqMoqPreference,
  onAcceptFlag
}: ScenarioInspectorProps) {
  const rate = currency === "USD" ? (exchangeRates.USD || 33.5581) : 1;
  const formatMoney = (val: number) => {
    if (currency === "USD") {
      const usdVal = val / rate;
      return `$${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      return `${Math.round(val).toLocaleString()} THB`;
    }
  };

  const [activeTab, setActiveTab] = useState<"colorSummary" | "colors" | "shipmentDates" | "excess" | "shipments" | "ledger" | "requisitions">("colorSummary");
  const [draggedOverWeek, setDraggedOverWeek] = useState<number | null>(null);
  const [showConsolidated, setShowConsolidated] = useState(false);
  const [priceFixDrafts, setPriceFixDrafts] = useState<Record<string, string>>({});
  const [selectedPriceFlagIdx, setSelectedPriceFlagIdx] = useState<number>(0);
  const [selectedContainerFlagIdx, setSelectedContainerFlagIdx] = useState<number>(0);
  const [selectedConflictFlagIdx, setSelectedConflictFlagIdx] = useState<number>(0);
  const [selectedMcqPenaltyFlagIdx, setSelectedMcqPenaltyFlagIdx] = useState<number>(0);
  const [selectedMissingInfoFlagIdx, setSelectedMissingInfoFlagIdx] = useState<number>(0);
  const [isExportingSeparated, setIsExportingSeparated] = useState(false);

  // State for new excess override form (relocated from AdvancedSettings, now per-scenario)
  const [newOverColor, setNewOverColor] = useState("");
  const [newOverItemDescription, setNewOverItemDescription] = useState("");
  const [newOverQty, setNewOverQty] = useState(0);
  const [newOverWeek, setNewOverWeek] = useState<number>(0); // 0 means auto/any week

  // Memoized unique colors and items for the selected color
  const uniqueColors = useMemo(() => {
    return Array.from(new Set(entries.map(e => e.colorCode))).sort();
  }, [entries]);

  const uniqueItems = useMemo(() => {
    if (!newOverColor) return [];
    return Array.from(new Set(
      entries
        .filter(e => e.colorCode === newOverColor)
        .map(e => e.itemDescription || e.itemCode)
    )).sort();
  }, [entries, newOverColor]);

  // Sync color selection when entries change
  useEffect(() => {
    if (uniqueColors.length > 0 && (!newOverColor || !uniqueColors.includes(newOverColor))) {
      setNewOverColor(uniqueColors[0]);
    }
  }, [uniqueColors, newOverColor]);

  // Sync item selection when color changes
  useEffect(() => {
    setNewOverItemDescription(""); // Default to "All Items" when color shifts
  }, [newOverColor]);

  const handleAddOverride = () => {
    if (!newOverColor) return;

    // Auto-lookup price and cbm per unit from raw entries
    const matchingPr = entries.find(e =>
      e.colorCode === newOverColor &&
      (!newOverItemDescription || (e.itemDescription || e.itemCode) === newOverItemDescription)
    );
    const pricePerUnit = matchingPr ? matchingPr.unitPrice : undefined;
    const cbmPerUnit = matchingPr && matchingPr.qty > 0 ? matchingPr.cbm / matchingPr.qty : 0.003;

    const ov: ExcessMcqOverride = {
      id: Math.random().toString(36).substring(2),
      colorCode: newOverColor,
      itemDescription: newOverItemDescription || undefined,
      additionalQty: newOverQty,
      pricePerUnit,
      cbmPerUnit,
      targetWeek: newOverWeek || undefined
    };
    setExcessOverrides([...excessOverrides, ov]);
    setNewOverItemDescription("");
    setNewOverQty(0);
    setNewOverWeek(0);
  };

  const handleRemoveOverride = (id: string) => {
    setExcessOverrides(excessOverrides.filter(o => o.id !== id));
  };

  // Group columns (shipments)
  const shipmentColumns = scenario.shipments;
  // Item-level breakdown for the MCQ Shipment Calendar Matrix — the same
  // color code can span multiple distinct items/styles (e.g. two different
  // garment styles sharing the same dye lot color), so the matrix needs a
  // row per (item, color) pair, not just per color. Grouped by
  // itemDescription rather than itemCode, since different item codes can
  // share the same descriptive name and should be treated as one editable
  // row, not split apart. MCQ itself still applies at the color level
  // (it's a minimum dye-lot quantity, shared across every item of that
  // color), so the pass/fail check aggregates across all items sharing a
  // color — only the displayed/editable quantity is item-specific.
  const colorItemPairs = useMemo(() => {
    const seen = new Map<string, { itemDescription: string; colorCode: string }>();
    scenario.processedEntries.forEach(e => {
      const desc = e.itemDescription || e.itemCode;
      const key = `${desc}__${e.colorCode}`;
      if (!seen.has(key)) {
        seen.set(key, { itemDescription: desc, colorCode: e.colorCode });
      }
    });
    return Array.from(seen.values()).sort((a, b) => {
      if (a.colorCode !== b.colorCode) return a.colorCode.localeCompare(b.colorCode);
      return a.itemDescription.localeCompare(b.itemDescription);
    });
  }, [scenario.processedEntries]);

  // Color grouping calculations — grouped by (item description, color code)
  // pair, mirroring colorItemPairs above, so the same color code used across
  // multiple garment styles/items shows up as separate, individually
  // correctable rows instead of being merged into one color-only total.
  const colorGroupedSummary = colorItemPairs.map(({ itemDescription, colorCode }) => {
    const poEntries = scenario.processedEntries.filter(
      e => (e.itemDescription || e.itemCode) === itemDescription && e.colorCode === colorCode
    );

    // "Qty Original PR" — the quantity as it appears on the uploaded PR/
    // Requisition file (or sample data) before any optimizer processing.
    // Sourced from the raw `entries` prop rather than
    // scenario.processedEntries, because processedEntries[].originalQty
    // gets mutated in place by Excess MCQ padding overrides (optimizer.ts
    // adds the padding qty onto both qty AND originalQty when padding an
    // existing PR line) — using it here would silently inflate the
    // "as-uploaded" figure once a padding override is applied.
    const origEntries = entries.filter(
      e => (e.itemDescription || e.itemCode) === itemDescription && e.colorCode === colorCode
    );
    const origQty = origEntries.reduce((sum, e) => sum + e.qty, 0);

    // "Qty PO" — the current, working quantity after MCQ Shipment Calendar
    // Matrix manual edits and Excess MCQ padding overrides. Both are
    // already baked into processedEntries[].qty by the optimizer, so this
    // total updates live as the user edits either tab.
    const poQty = poEntries.reduce((sum, e) => sum + e.qty, 0);

    // CBM already tracks Qty PO: the optimizer rescales/recomputes cbm
    // whenever qty is overridden, so summing it here reflects the current
    // PO quantity rather than the original PR quantity.
    const totalCbm = poEntries.reduce((sum, e) => sum + e.cbm, 0);

    // Material cost must be based on Qty PO — the quantity actually being
    // shipped/paid for after overrides — not the original PR quantity,
    // otherwise a manually edited shipment would show the wrong cost.
    const totalMaterialCost = poEntries.reduce((sum, e) => {
      const currCode = (e.currency || "").toUpperCase().trim();
      const rate = e.currencyRate !== undefined && e.currencyRate !== null
        ? e.currencyRate
        : (currCode === "THB"
            ? 1.0
            : (currCode && scenario.exchangeRates?.[currCode] !== undefined
                ? scenario.exchangeRates[currCode]
                : (e.unitPrice > 30 ? 1.0 : (scenario.exchangeRates?.["USD"] || 35.0))
              )
          );
      const priceTHB = e.unitPrice * rate;
      return sum + (e.qty * priceTHB);
    }, 0);
    return {
      itemDescription,
      color: colorCode,
      origQty,
      poQty,
      totalCbm,
      totalMaterialCost
    };
  });

  // Helper to format Date
  const formatDate = (d?: Date) => {
    if (!d || isNaN(d.getTime()) || d.getFullYear() < 2000) return "N/A";
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 mb-6 border-b border-slate-100">
        <div>
          <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded text-xs font-mono font-semibold uppercase">
            {t("Deep-Dive Inspector", lang)}
          </span>
          <h2 className="text-xl font-bold text-slate-800 mt-1.5 font-sans">
            Scenario {scenario.id} {t("Detailed Breakdown", lang)}
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            {tp("flag.analyzingShipments", { count: scenario.numShipments }, lang)}
          </p>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2 items-center">
          {hasManualOverrides && onResetOverrides && (
            <button
              onClick={onResetOverrides}
              className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold rounded-lg px-3 py-1.5 text-xs flex items-center justify-center gap-2 shadow-sm transition duration-150 cursor-pointer"
              title={t("Reset manual shipment date assignments back to defaults", lang)}
            >
              <RotateCcw size={13} />
              <span>{t("Reset Assignments", lang)}</span>
            </button>
          )}

          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => exportCombinedExcelReport(scenario)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg px-3 py-1.5 text-xs flex items-center justify-center gap-2 shadow-sm transition duration-150 cursor-pointer"
              title={t("One workbook with every shipment's PR lines, ordered by PO Delivery Date", lang)}
            >
              <Download size={13} />
              <span>{t("Download Combined Excel Report", lang)}</span>
            </button>
            <button
              onClick={async () => {
                setIsExportingSeparated(true);
                try {
                  await exportSeparatedExcelZip(scenario);
                } finally {
                  setIsExportingSeparated(false);
                }
              }}
              disabled={isExportingSeparated}
              className="bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold rounded-lg px-3 py-1.5 text-xs flex items-center justify-center gap-2 shadow-sm transition duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              title={t("A ZIP with one workbook per shipment (named by PO Delivery Date), listing that shipment's PR Num / PR Line", lang)}
            >
              <Download size={13} />
              <span>{isExportingSeparated ? t("Zipping…", lang) : t("Download Separated Excel Report", lang)}</span>
            </button>
          </div>

          {scenario.containerMatchingStatus === "Approved" ? (
            <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {t("Container Check: Approved", lang)}
            </div>
          ) : (
            <div className="bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              {t("Container Check: Manual Review Required", lang)}
            </div>
          )}
        </div>
      </div>

      {/* Error and Warning Flagging Tray */}
      {(() => {
        // MCQ-category flags are computed once by the optimizer and don't
        // automatically know about manual Shipment Calendar Matrix qty
        // overrides applied afterward. Without this filter, editing a
        // cell up to (or past) the MCQ threshold makes the matrix cell
        // itself turn green/resolved, but the flag stays listed here
        // forever, incorrectly telling the user a surcharge still applies
        // — even though the same override-aware total (colorWeekEffectiveTotal)
        // the matrix cell uses would show it's actually resolved.
        const visibleErrorFlags = (scenario.errorFlags || []).filter(flag => {
          if (flag.category !== "MCQ" || !flag.colorCode || flag.week === undefined) return true;

          const colorAlert = scenario.moqAlerts.find(a => a.colorCode === flag.colorCode);
          const colorEntries = scenario.processedEntries.filter(e => e.colorCode === flag.colorCode);
          const colorVendor = colorEntries[0]?.vendor;
          const limit = colorAlert?.targetMoq || getEffectiveMcqForColor(flag.colorCode, colorVendor, surchargeRules, scenario.mcqThreshold ?? 500);

          const itemDescriptionsForColor = Array.from(new Set(colorEntries.map(e => e.itemDescription || e.itemCode)));
          const colorWeekEffectiveTotal = itemDescriptionsForColor.reduce((sum, itemDescription) => {
            const cellKey = `${itemDescription}__${flag.colorCode}__${flag.week}`;
            if (Object.prototype.hasOwnProperty.call(matrixQtyOverrides, cellKey)) {
              return sum + matrixQtyOverrides[cellKey];
            }
            const naturalQty = colorEntries
              .filter(e => (e.itemDescription || e.itemCode) === itemDescription && e.assignedWeek === flag.week)
              .reduce((s, e) => s + e.qty, 0);
            return sum + naturalQty;
          }, 0);

          // Keep the flag only if the override-aware total still falls
          // short of MCQ — hide it once the manual edit resolves it.
          return colorWeekEffectiveTotal < limit;
        });

        if (!visibleErrorFlags || visibleErrorFlags.length === 0) return null;

        const priceFlags = visibleErrorFlags.filter(flag => flag.category === "Price");
        const missingInfoFlags = visibleErrorFlags.filter(flag => flag.category === "MissingInfo");
        
        // Container tolerance warnings (where we can accept the tolerance)
        const containerToleranceFlags = visibleErrorFlags.filter(
          flag => flag.category === "Container" && flag.actionType === "accept_container_tolerance"
        );
        
        // MCQ/MOQ Standard Conflicts
        const conflictFlags = visibleErrorFlags.filter(
          flag => (flag.category === "MCQ" || flag.category === "MOQ") && !!flag.conflictInfo
        );
        
        // MCQ penalty warnings (under MCQ)
        const mcqPenaltyFlags = visibleErrorFlags.filter(
          flag => flag.category === "MCQ" && flag.actionType === "pay_mcq_surcharge"
        );
        
        // All other flags that are informational or non-interactive (e.g. late arrival, overloaded, warehouse, MOQ shortfalls, LCL)
        const nonInteractiveFlags = visibleErrorFlags.filter(flag => {
          if (flag.category === "Price") return false;
          if (flag.category === "MissingInfo") return false;
          if (flag.category === "Container" && flag.actionType === "accept_container_tolerance") return false;
          if ((flag.category === "MCQ" || flag.category === "MOQ") && !!flag.conflictInfo) return false;
          if (flag.category === "MCQ" && flag.actionType === "pay_mcq_surcharge") return false;
          return true;
        });

        return (
        <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <ShieldAlert size={14} className="text-red-500 animate-pulse" />
            {t("Landed Logistics Flagged Events & Sanity Audits", lang)} ({visibleErrorFlags.length})
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[550px] overflow-y-auto pr-1">
            {/* Price Alerts Consolidated Card */}
            {priceFlags.length > 0 && (
              <div className="p-3.5 rounded-xl border bg-amber-50/80 border-amber-200/80 text-xs text-amber-900 col-span-1 md:col-span-2 shadow-sm animate-fade-in">
                <div className="font-bold flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="uppercase text-[9px] px-1.5 py-0.5 bg-amber-600 text-white rounded font-mono font-bold tracking-wider">
                      Price
                    </span>
                    <span className="text-sm text-amber-950">
                      {lang === "TH" ? `พบข้อมูล Unit Price เป็น $0.00 จำนวน ${priceFlags.length} รายการ` : `Found ${priceFlags.length} items with $0.00 Unit Price`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onFixUnitPrice) {
                        priceFlags.forEach(f => {
                          if (f.itemCode && f.colorCode) {
                            onFixUnitPrice(f.itemCode, f.colorCode, "zero");
                          }
                        });
                      }
                    }}
                    className="text-[10px] font-bold px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-900 transition shadow-sm cursor-pointer"
                  >
                    {lang === "TH" ? "ปล่อยเป็น 0 ทั้งหมด For All" : "Keep As 0 For All"}
                  </button>
                </div>
                <p className="text-[10px] text-amber-800 leading-relaxed mb-3">
                  {lang === "TH"
                    ? "ราคานี้อาจเป็นความผิดพลาดในการกรอกข้อมูลในไฟล์ PR ดั้งเดิม ทำให้การคำนวณต้นทุนต่างๆ ต่ำกว่าความเป็นจริง กรุณาเลือกรายการด้านล่างเพื่อทำการแก้ไขราคา หรือคลิกปุ่มด้านขวาบนเพื่อปล่อยเป็น 0 ทั้งหมด"
                    : "These are likely data entry errors in the uploaded PR file. Choose an item below to correct its price, or click the button above to keep them all as $0.00."}
                </p>
                
                <div className="flex flex-wrap items-center gap-3 bg-white/70 p-2.5 rounded-lg border border-amber-200/50">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[9px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                      {lang === "TH" ? "เลือกรายการเพื่อแก้ไข" : "Select Item to Resolve"}
                    </label>
                    <select
                      value={selectedPriceFlagIdx >= priceFlags.length ? 0 : selectedPriceFlagIdx}
                      onChange={e => setSelectedPriceFlagIdx(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-amber-200 rounded px-2 py-1 text-xs text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      {priceFlags.map((pf, pidx) => (
                        <option key={pidx} value={pidx}>
                          {pf.itemCode} / {pf.colorCode}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {(() => {
                    const activePriceFlagIdx = selectedPriceFlagIdx >= priceFlags.length ? 0 : selectedPriceFlagIdx;
                    const pf = priceFlags[activePriceFlagIdx];
                    if (!pf) return null;
                    const draftKey = `${pf.itemCode}__${pf.colorCode}`;
                    const draftVal = priceFixDrafts[draftKey] ?? "";
                    const commit = () => {
                      const parsed = parseFloat(draftVal);
                      if (!isNaN(parsed) && parsed > 0) {
                        onFixUnitPrice?.(pf.itemCode!, pf.colorCode!, parsed);
                        setPriceFixDrafts(prev => {
                          const copy = { ...prev };
                          delete copy[draftKey];
                          return copy;
                        });
                      }
                    };
                    return (
                      <div className="flex items-end gap-1.5 self-end">
                        <div>
                          <label className="block text-[9px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                            {lang === "TH" ? "ใส่ราคาใหม่" : "Enter New Unit Price ($)"}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="e.g. 1.25"
                            value={draftVal}
                            onChange={(e) => setPriceFixDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
                            className="w-28 bg-white border border-amber-300 rounded px-2 py-1 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={commit}
                          className="text-xs font-semibold px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition cursor-pointer h-[26px]"
                        >
                          {t("Fix Price", lang)}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onFixUnitPrice && pf.itemCode && pf.colorCode) {
                              onFixUnitPrice(pf.itemCode, pf.colorCode, "zero");
                            }
                          }}
                          className="text-xs font-semibold px-2.5 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition cursor-pointer h-[26px]"
                        >
                          {t("keep as 0", lang)}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Container Capacity Warnings Consolidated Card */}
            {containerToleranceFlags.length > 0 && (
              <div className="p-3.5 rounded-xl border bg-amber-50/80 border-amber-200/80 text-xs text-amber-900 col-span-1 md:col-span-2 shadow-sm animate-fade-in">
                <div className="font-bold flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="uppercase text-[9px] px-1.5 py-0.5 bg-amber-600 text-white rounded font-mono font-bold tracking-wider">
                      Container Limit
                    </span>
                    <span className="text-sm text-amber-950">
                      {lang === "TH" 
                        ? `พบคำเตือนความจุตู้สินค้าใกล้เต็มขีดจำกัด ${containerToleranceFlags.length} รายการ` 
                        : `Found ${containerToleranceFlags.length} Container Capacity Warnings`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onAcceptFlag) {
                        containerToleranceFlags.forEach(f => {
                          if (f.flagKey) onAcceptFlag(f.flagKey);
                        });
                      }
                    }}
                    className="text-[10px] font-bold px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-900 transition shadow-sm cursor-pointer"
                  >
                    {lang === "TH" ? "ยอมรับเกณฑ์เบี่ยงเบนทั้งหมด For All" : "Accept Tolerance For All"}
                  </button>
                </div>
                <p className="text-[10px] text-amber-800 leading-relaxed mb-3">
                  {lang === "TH"
                    ? "ปริมาตรสินค้าในสัปดาห์เหล่านี้ใกล้เคียงหรือเกินขีดจำกัดตู้สินค้ามาตรฐานเล็กน้อย (แต่อยู่ในช่วงยืดหยุ่นที่ยอมรับได้) คุณสามารถกดยอมรับค่าเบี่ยงเบนเพื่อหลีกเลี่ยงการจัดส่งแยกตู้ หรือจัดการทีละรายการด้านล่าง"
                    : "The volume for these shipments is close to the limit but within allowable tolerance. You can accept the tolerance for all to avoid splitting them, or resolve each below."}
                </p>
                
                <div className="flex flex-wrap items-center gap-3 bg-white/70 p-2.5 rounded-lg border border-amber-200/50">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[9px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                      {lang === "TH" ? "เลือกสัปดาห์เพื่อยอมรับ" : "Select Week to Resolve"}
                    </label>
                    <select
                      value={selectedContainerFlagIdx >= containerToleranceFlags.length ? 0 : selectedContainerFlagIdx}
                      onChange={e => setSelectedContainerFlagIdx(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-amber-200 rounded px-2 py-1 text-xs text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      {containerToleranceFlags.map((cf, cidx) => (
                        <option key={cidx} value={cidx}>
                          Week {cf.week} ({cf.messageKey ? tp(cf.messageKey, cf.messageParams, lang) : cf.message})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {(() => {
                    const activeIdx = selectedContainerFlagIdx >= containerToleranceFlags.length ? 0 : selectedContainerFlagIdx;
                    const cf = containerToleranceFlags[activeIdx];
                    if (!cf) return null;
                    return (
                      <div className="flex items-end gap-1.5 self-end">
                        <div className="text-[10px] text-slate-600 max-w-sm mr-2 leading-tight">
                          {cf.detailsKey ? tp(cf.detailsKey, cf.detailsParams, lang) : cf.details}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (onAcceptFlag && cf.flagKey) {
                              onAcceptFlag(cf.flagKey);
                            }
                          }}
                          className="text-xs font-semibold px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition cursor-pointer h-[26px] whitespace-nowrap"
                        >
                          {t("accept", lang)}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* MCQ/MOQ Standard Conflicts Consolidated Card */}
            {conflictFlags.length > 0 && (
              <div className="p-3.5 rounded-xl border bg-orange-50/80 border-orange-200/80 text-xs text-orange-900 col-span-1 md:col-span-2 shadow-sm animate-fade-in">
                <div className="font-bold flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="uppercase text-[9px] px-1.5 py-0.5 bg-orange-600 text-white rounded font-mono font-bold tracking-wider">
                      Standard Conflict
                    </span>
                    <span className="text-sm text-orange-950">
                      {lang === "TH" 
                        ? `พบข้อขัดแย้งเกณฑ์ขั้นต่ำ (MCQ/MOQ) ${conflictFlags.length} รายการ` 
                        : `Found ${conflictFlags.length} MCQ/MOQ Conflicts`}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectMcqMoqPreference) {
                          conflictFlags.forEach(f => {
                            if (f.conflictInfo) onSelectMcqMoqPreference(f.conflictInfo.key, "surcharge");
                          });
                        }
                      }}
                      className="text-[10px] font-bold px-2.5 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-900 transition shadow-sm cursor-pointer"
                    >
                      {lang === "TH" ? "ใช้กฎค่าธรรมเนียมทั้งหมด For All" : "Use Surcharge Rule For All"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectMcqMoqPreference) {
                          conflictFlags.forEach(f => {
                            if (f.conflictInfo) onSelectMcqMoqPreference(f.conflictInfo.key, "pr_file");
                          });
                        }
                      }}
                      className="text-[10px] font-bold px-2.5 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-900 transition shadow-sm cursor-pointer"
                    >
                      {lang === "TH" ? "ใช้ไฟล์ PR ทั้งหมด For All" : "Use PR File For All"}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-orange-800 leading-relaxed mb-3">
                  {lang === "TH"
                    ? "มีการตรวจพบค่าเกณฑ์ MCQ/MOQ ในไฟล์ PR แตกต่างจากข้อมูลตารางการตั้งค่า กรุณาเลือกมาตรฐานที่ประสงค์จะใช้เพื่อให้ระบบคำนวณอย่างถูกต้อง หรือกดปุ่มข้างต้นเพื่อจัดการทั้งหมด"
                    : "MCQ or MOQ values in the uploaded PR file conflict with the configured settings rules. Select which standard to prioritize, or use the global buttons above to choose for all."}
                </p>
                
                <div className="flex flex-wrap items-center gap-3 bg-white/70 p-2.5 rounded-lg border border-orange-200/50">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[9px] font-bold text-orange-800 uppercase tracking-wider mb-1">
                      {lang === "TH" ? "เลือกรายการที่มีข้อขัดแย้ง" : "Select Conflict to Resolve"}
                    </label>
                    <select
                      value={selectedConflictFlagIdx >= conflictFlags.length ? 0 : selectedConflictFlagIdx}
                      onChange={e => setSelectedConflictFlagIdx(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-orange-200 rounded px-2 py-1 text-xs text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-orange-500"
                    >
                      {conflictFlags.map((cf, cidx) => (
                        <option key={cidx} value={cidx}>
                          {cf.conflictInfo?.type} - {cf.conflictInfo?.colorCode || cf.conflictInfo?.vendor || "General"}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {(() => {
                    const activeIdx = selectedConflictFlagIdx >= conflictFlags.length ? 0 : selectedConflictFlagIdx;
                    const cf = conflictFlags[activeIdx];
                    if (!cf || !cf.conflictInfo) return null;
                    const info = cf.conflictInfo;
                    return (
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center self-end">
                        <div className="text-[10px] text-slate-600 mr-2 max-w-[260px] leading-tight">
                          {cf.messageKey ? tp(cf.messageKey, cf.messageParams, lang) : cf.message}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onSelectMcqMoqPreference?.(info.key, "surcharge")}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1 h-[26px] ${
                              info.activeSource === "surcharge"
                                ? "bg-orange-600 text-white shadow-sm ring-1 ring-orange-700"
                                : "bg-white text-slate-700 border border-orange-300 hover:bg-orange-100"
                            }`}
                          >
                            {info.activeSource === "surcharge" && <Check size={11} />}
                            {t("Use Surcharge Rule", lang)} ({info.surchargeValue.toLocaleString()} YD)
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectMcqMoqPreference?.(info.key, "pr_file")}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1 h-[26px] ${
                              info.activeSource === "pr_file"
                                ? "bg-orange-600 text-white shadow-sm ring-1 ring-orange-700"
                                : "bg-white text-slate-700 border border-orange-300 hover:bg-orange-100"
                            }`}
                          >
                            {info.activeSource === "pr_file" && <Check size={11} />}
                            {t("Use PR File", lang)} ({info.prFileValue.toLocaleString()} YD)
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* MCQ Penalty/Surcharge Warnings Consolidated Card */}
            {mcqPenaltyFlags.length > 0 && (
              <div className="p-3.5 rounded-xl border bg-rose-50/80 border-rose-200/80 text-xs text-rose-900 col-span-1 md:col-span-2 shadow-sm animate-fade-in">
                <div className="font-bold flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="uppercase text-[9px] px-1.5 py-0.5 bg-rose-600 text-white rounded font-mono font-bold tracking-wider">
                      MCQ Surcharge
                    </span>
                    <span className="text-sm text-rose-950">
                      {lang === "TH" 
                        ? `พบข้อกำหนดสีย้อมสั่งซื้อต่ำกว่าเกณฑ์ (MCQ Surcharge) ${mcqPenaltyFlags.length} รายการ` 
                        : `Found ${mcqPenaltyFlags.length} MCQ Surcharge Warnings`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onAcceptFlag) {
                        mcqPenaltyFlags.forEach(f => {
                          if (f.flagKey) onAcceptFlag(f.flagKey);
                        });
                      }
                    }}
                    className="text-[10px] font-bold px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-900 transition shadow-sm cursor-pointer"
                  >
                    {lang === "TH" ? "ยอมรับชำระค่าธรรมเนียมทั้งหมด For All" : "Pay MCQ Surcharge For All"}
                  </button>
                </div>
                <p className="text-[10px] text-rose-800 leading-relaxed mb-3">
                  {lang === "TH"
                    ? "รายการสีย้อมของคู่ค้าบางรายการมีจำนวนสั่งซื้อในสัปดาห์นั้นๆ ต่ำกว่าเกณฑ์ขั้นต่ำ (MCQ) ทำให้โดนค่าปรับเพิ่มเติม คุณสามารถกดยอมรับเพื่อชำระค่าธรรมเนียม MCQ หรือจัดสัดส่วนจำนวนใหม่บนตารางปฏิทินส่งสินค้าเพื่อหลีกเลี่ยง"
                    : "Some color items fall short of the vendor's MCQ threshold in specific weeks, triggering standard penalty surcharges. You can choose to accept the penalty for all, or rebalance quantities in the Shipment Calendar."}
                </p>
                
                <div className="flex flex-wrap items-center gap-3 bg-white/70 p-2.5 rounded-lg border border-rose-200/50">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[9px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                      {lang === "TH" ? "เลือกรายการที่ต่ำกว่าเกณฑ์" : "Select Surcharge to Resolve"}
                    </label>
                    <select
                      value={selectedMcqPenaltyFlagIdx >= mcqPenaltyFlags.length ? 0 : selectedMcqPenaltyFlagIdx}
                      onChange={e => setSelectedMcqPenaltyFlagIdx(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-rose-200 rounded px-2 py-1 text-xs text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                    >
                      {mcqPenaltyFlags.map((mf, midx) => (
                        <option key={midx} value={midx}>
                          {mf.colorCode} - Week {mf.week} ({mf.messageKey ? tp(mf.messageKey, mf.messageParams, lang) : mf.message})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {(() => {
                    const activeIdx = selectedMcqPenaltyFlagIdx >= mcqPenaltyFlags.length ? 0 : selectedMcqPenaltyFlagIdx;
                    const mf = mcqPenaltyFlags[activeIdx];
                    if (!mf) return null;
                    return (
                      <div className="flex items-end gap-1.5 self-end">
                        <div className="text-[10px] text-slate-600 max-w-sm mr-2 leading-tight">
                          {mf.detailsKey ? tp(mf.detailsKey, mf.detailsParams, lang) : mf.details}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (onAcceptFlag && mf.flagKey) {
                              onAcceptFlag(mf.flagKey);
                            }
                          }}
                          className="text-xs font-semibold px-3 py-1 bg-rose-600 text-white rounded hover:bg-rose-700 transition cursor-pointer h-[26px] whitespace-nowrap"
                        >
                          {t("pay for surcharge", lang)}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Missing Info / Settings Match Alerts Consolidated Card */}
            {missingInfoFlags.length > 0 && (
              <div className="p-3.5 rounded-xl border bg-violet-50/80 border-violet-200/80 text-xs text-violet-900 col-span-1 md:col-span-2 shadow-sm animate-fade-in">
                <div className="font-bold flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="uppercase text-[9px] px-1.5 py-0.5 bg-violet-600 text-white rounded font-mono font-bold tracking-wider">
                      Settings Match
                    </span>
                    <span className="text-sm text-violet-950">
                      {lang === "TH" ? `พบข้อเสนอแนะด้านข้อมูลการตั้งค่า ${missingInfoFlags.length} รายการ` : `Found ${missingInfoFlags.length} Missing Settings Warnings`}
                    </span>
                  </div>
                  {missingInfoFlags.some(f => f.flagKey && f.actionType === "no_surcharge") && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onAcceptFlag) {
                          missingInfoFlags.forEach(f => {
                            if (f.flagKey && f.actionType === "no_surcharge") onAcceptFlag(f.flagKey);
                          });
                        }
                      }}
                      className="text-[10px] font-bold px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-900 transition shadow-sm cursor-pointer"
                    >
                      {lang === "TH" ? "ละเว้นค่าธรรมเนียมคู่ค้าทั้งหมด For All" : "No Surcharge For All"}
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-violet-800 leading-relaxed mb-3">
                  {lang === "TH"
                    ? "ข้อมูลคู่ค้าหรือเส้นทางการจัดส่งที่ระบบดึงมาจาก PR ไม่มีข้อมูลในส่วนการตั้งค่า ระบบได้ตั้งค่าเริ่มต้นเป็นแบบทั่วไป (Default FOB/0 Surcharge) ไว้ชั่วคราว คุณสามารถเพิ่มข้อมูลเพื่อให้การจำลองต้นทุนมีความแม่นยำยิ่งขึ้น หรือกดปล่อยผ่านได้สำหรับกรณีที่เวนเดอร์ไม่มีค่าธรรมเนียม"
                    : "Some ship-from routes or vendors in the PR lack configured settings. Safe defaults are used; you may add specific rules in settings or dismiss if not applicable (e.g., vendors with no surcharges)."}
                </p>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {missingInfoFlags.map((flag, midx) => (
                    <div key={midx} className="bg-white/70 border border-violet-100 p-2.5 rounded-lg flex items-start gap-3 justify-between">
                      <div className="flex gap-2">
                        <AlertTriangle size={14} className="text-violet-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-slate-800 text-[11px]">
                            {flag.messageKey ? tp(flag.messageKey, flag.messageParams, lang) : flag.message}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                            {flag.detailsKey ? tp(flag.detailsKey, flag.detailsParams, lang) : flag.details}
                          </p>
                        </div>
                      </div>
                      
                      {flag.flagKey && flag.actionType === "no_surcharge" && onAcceptFlag && (
                        <button
                          type="button"
                          onClick={() => onAcceptFlag(flag.flagKey!)}
                          className="text-[10px] font-bold px-2.5 py-1 bg-violet-600 text-white rounded hover:bg-violet-700 shadow-sm transition shrink-0 cursor-pointer flex items-center gap-1 self-center"
                        >
                          <Check size={11} />
                          {t("No Surcharge", lang)}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Non-interactive Warnings & System Log Alerts */}
            {nonInteractiveFlags.length > 0 && (
              <div className="p-3.5 rounded-xl border bg-slate-100/80 border-slate-200/80 text-xs text-slate-800 col-span-1 md:col-span-2 shadow-sm animate-fade-in">
                <div className="font-bold flex items-center gap-2 mb-2">
                  <span className="uppercase text-[9px] px-1.5 py-0.5 bg-slate-600 text-white rounded font-mono font-bold tracking-wider">
                    Logistics Info
                  </span>
                  <span className="text-sm text-slate-950">
                    {lang === "TH" ? `ข้อบ่งชี้ทางโลจิสติกส์ & ข้อมูลระบบ (${nonInteractiveFlags.length})` : `System Alerts & Logistics Audits (${nonInteractiveFlags.length})`}
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mt-2">
                  {nonInteractiveFlags.map((flag, nidx) => (
                    <div key={nidx} className="bg-white/70 border border-slate-200/50 p-2.5 rounded-lg flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        {flag.type === "error" ? (
                          <AlertTriangle size={14} className="text-red-600 animate-bounce" />
                        ) : flag.type === "warning" ? (
                          <AlertTriangle size={14} className="text-amber-600" />
                        ) : (
                          <Info size={14} className="text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-[11px] flex items-center gap-1.5 flex-wrap">
                          <span className="uppercase text-[9px] px-1 py-0.2 bg-white rounded border font-mono font-bold text-slate-500">
                            {flag.category}
                          </span>
                          <span>
                            {flag.messageKey ? tp(flag.messageKey, flag.messageParams, lang) : flag.message}
                          </span>
                        </div>
                        {flag.details && (
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                            {flag.detailsKey ? tp(flag.detailsKey, flag.detailsParams, lang) : flag.details}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex border-b border-slate-100 mb-6 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("colorSummary")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition duration-150 border-b-2 -mb-px shrink-0 ${
            activeTab === "colorSummary"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Table size={14} />
          {t("Grouped by Colors Summary", lang)}
        </button>
        <button
          onClick={() => setActiveTab("colors")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition duration-150 border-b-2 -mb-px shrink-0 ${
            activeTab === "colors"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers size={14} />
          {t("MCQ Shipment Calendar Matrix", lang)}
        </button>
        <button
          onClick={() => setActiveTab("shipmentDates")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition duration-150 border-b-2 -mb-px shrink-0 ${
            activeTab === "shipmentDates"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calendar size={14} />
          {t("Ship Dates", lang)}
        </button>
        <button
          onClick={() => setActiveTab("excess")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition duration-150 border-b-2 -mb-px shrink-0 ${
            activeTab === "excess"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Plus size={14} />
          {t("Excess", lang)}
        </button>
        <button
          onClick={() => setActiveTab("shipments")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition duration-150 border-b-2 -mb-px shrink-0 ${
            activeTab === "shipments"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Truck size={14} />
          {t("Shipment Containers & Bins", lang)} ({shipmentColumns.length})
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition duration-150 border-b-2 -mb-px shrink-0 ${
            activeTab === "ledger"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckSquare size={14} />
          {t("Duplicated PR Rounded Ledger", lang)}
        </button>
        <button
          onClick={() => setActiveTab("requisitions")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition duration-150 border-b-2 -mb-px shrink-0 ${
            activeTab === "requisitions"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileSpreadsheet size={14} />
          {t("Syteline Requisition Output", lang)}
        </button>
      </div>

      {/* Tab 0: Primary Color Wise Grouping Summary */}
      {activeTab === "colorSummary" && (
        <div className="space-y-6">
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-xs text-slate-600 leading-relaxed">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-blue-900 font-bold">{t("Primary Input Grouping:", lang)}</span> {t("This table groups the entire input dataset by unique colors to show the total ordered quantity, CBM, and material cost of each color before split allocations.", lang)}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">{t("Item Description", lang)}</th>
                  <th className="py-3 px-4">{t("Color Code", lang)}</th>
                  <th className="py-3 px-4 text-right">{t("Qty Original PR", lang)}</th>
                  <th className="py-3 px-4 text-right">{t("Qty PO", lang)}</th>
                  <th className="py-3 px-4 text-right">{t("Total CBM Volume", lang)}</th>
                  <th className="py-3 px-4 text-right">{t("Total Material Cost", lang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {colorGroupedSummary.map(row => (
                  <tr key={`${row.itemDescription}__${row.color}`} className="hover:bg-slate-50 font-mono">
                    <td className="py-3 px-4 font-sans text-slate-600">
                      {row.itemDescription}
                    </td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded border border-slate-300 inline-block" style={{
                        backgroundColor: row.color.includes("BLACK") ? "#000" : row.color.includes("BLUE") ? "#3b82f6" : row.color.includes("NAVY") ? "#1e3a8a" : "#64748b"
                      }}></span>
                      {row.color}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {formatOriginalQty(row.origQty)} YD
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-700">
                      {Math.round(row.poQty).toLocaleString()} YD
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {row.totalCbm.toFixed(3)} CBM
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-blue-600">
                      {formatMoney(row.totalMaterialCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 1: Colors & MCQ Matrix */}
      {activeTab === "colors" && (
        <div className="space-y-6">
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-xs text-slate-600 leading-relaxed">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            {lang === "TH" ? (
              <div>
                <span className="text-blue-900 font-bold">หลักการทำงานของตารางเมทริกซ์นี้:</span> รายการทั้งหมดจาก Syteline จะถูกจัดกลุ่มตามรหัสสีและวันที่ขนส่ง หากปริมาณรวมของสีใดสีหนึ่งต่ำกว่าเกณฑ์ขั้นต่ำ MCQ (เช่น {scenario.mcqThreshold ?? 500} หลา) การจัดส่งในรอบนั้นจะถูก<span className="text-amber-700 font-semibold"> ไฮไลต์สีส้มแจ้งเตือนโดยอัตโนมัติ</span> และปริมาณจะถูก<span className="text-blue-600 font-semibold"> ดึงไปจัดส่งเร็วขึ้น</span> (รวมเข้ากับสัปดาห์ก่อนหน้า) หรือปัดเศษเพิ่มขึ้นในรอบแรกพร้อมคิด<span className="text-emerald-600 font-semibold"> ค่าธรรมเนียมส่วนต่างขั้นต่ำในสัปดาห์ที่ 1</span> เพื่อหลีกเลี่ยงค่าปรับยอดสั่งสั่งผลิตต่ำกว่าเกณฑ์ขั้นต่ำจากโรงงาน
              </div>
            ) : (
              <div>
                <span className="text-blue-900 font-bold">How this matrix works:</span> All Syteline entries are grouped by color code and shipment date.
                If a color's total quantity falls below the MCQ threshold (e.g., {scenario.mcqThreshold ?? 500} YD), that column's shipment is automatically
                <span className="text-amber-700 font-semibold"> highlighted</span> and the quantity is either
                <span className="text-blue-600 font-semibold"> moved earlier</span> (consolidated to previous week) or met with a
                <span className="text-emerald-600 font-semibold"> shipment 1 rounding surcharge</span> to avoid factory minimum penalties.
                {" "}Click any quantity cell to <span className="text-slate-900 font-semibold">type in a corrected number</span> — your edits are saved per scenario and the MCQ status recalculates instantly.
              </div>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">{t("Item Description", lang)}</th>
                  <th className="py-3 px-4">{t("Color Code", lang)}</th>
                  <th className="py-3 px-4 text-center">{t("MCQ Limit", lang)}</th>
                  {shipmentColumns.map((col, idx) => (
                    <th key={idx} className="py-3 px-4 text-center">
                      {t("Shipment", lang)} {idx + 1}
                      <div className="text-[9px] font-mono font-normal text-slate-400 normal-case mt-0.5">
                        {formatDate(col.shipmentDate || col.date)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {colorItemPairs.map(({ itemDescription, colorCode }) => {
                  const itemColorEntries = scenario.processedEntries.filter(p => (p.itemDescription || p.itemCode) === itemDescription && p.colorCode === colorCode);
                  const siblingItems = colorItemPairs.filter(p => p.colorCode === colorCode);
                  const colorVendor = itemColorEntries[0]?.vendor || entries?.find(e => e.colorCode === colorCode)?.vendor;
                  const colorAlert = scenario.moqAlerts.find(a => a.colorCode === colorCode);
                  const limit = colorAlert?.targetMoq || getEffectiveMcqForColor(colorCode, colorVendor, surchargeRules, scenario.mcqThreshold ?? 500);

                  return (
                    <tr key={`${itemDescription}__${colorCode}`} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-sans text-slate-600 text-[11px] max-w-[220px] align-top">
                        {itemDescription}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 align-top">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded border border-slate-300 inline-block shrink-0" style={{
                            backgroundColor: colorCode === "COL-RED" ? "#ef4444" : colorCode === "COL-BLU" ? "#3b82f6" : "#475569"
                          }}></span>
                          {colorCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-slate-500 align-top">
                        {limit.toLocaleString()}
                      </td>
                      {shipmentColumns.map((col, colIdx) => {
                        // This item's own PRs for this week
                        const weekPrs = itemColorEntries.filter(p => p.assignedWeek === col.week);
                        const qty = weekPrs.reduce((sum, p) => sum + p.qty, 0);
                        // "Original Qty" is the pre-rounding precursor of
                        // the SAME number shown in the box above — i.e. the
                        // raw (unrounded) qty of the entries currently
                        // assigned to this week, before Math.round/MCQ
                        // rounding was applied. It must use the identical
                        // grouping as `qty` (assignedWeek === col.week);
                        // grouping by naturalAssignedWeek instead would pair
                        // this caption with a *different* week's entries
                        // whenever a PR got moved (MCQ push-forward,
                        // rounding propagation, etc.), producing numbers
                        // that don't correspond to what's in the box.
                        const originalQty = weekPrs.reduce((sum, p) => sum + p.originalQty, 0);

                        // Manual override — keyed per itemDescription+color+week
                        // so editing one item never affects a different item
                        // that happens to share the same color, while items
                        // sharing the same description are still treated as
                        // one combined row.
                        const cellKey = `${itemDescription}__${colorCode}__${col.week}`;
                        const hasOverride = Object.prototype.hasOwnProperty.call(matrixQtyOverrides, cellKey);
                        const overrideVal = matrixQtyOverrides[cellKey];
                        const effectiveQty = hasOverride ? overrideVal : qty;

                        // MCQ pass/fail is evaluated at the COLOR level —
                        // the aggregate across every item sharing this
                        // color for this week — since MCQ represents a
                        // minimum dye-lot quantity, not a per-item/style
                        // minimum. Only the displayed/editable number above
                        // is item-specific.
                        const colorWeekEffectiveTotal = siblingItems.reduce((sum, p) => {
                          const pKey = `${p.itemDescription}__${colorCode}__${col.week}`;
                          if (Object.prototype.hasOwnProperty.call(matrixQtyOverrides, pKey)) {
                            return sum + matrixQtyOverrides[pKey];
                          }
                          const pQty = scenario.processedEntries
                            .filter(e => (e.itemDescription || e.itemCode) === p.itemDescription && e.colorCode === colorCode && e.assignedWeek === col.week)
                            .reduce((s, e) => s + e.qty, 0);
                          return sum + pQty;
                        }, 0);

                        // Check if we had an MOQ alert/movement for this color and week
                        const isMoved = scenario.moqAlerts.some(a => a.colorCode === colorCode && a.week === col.week && a.moved);
                        const isSurcharged = scenario.moqAlerts.some(a => a.colorCode === colorCode && a.week === col.week && !a.moved);

                        let cellClass = "py-3 px-4 text-center font-mono ";
                        let badge = null;

                        if (effectiveQty > 0 && colorWeekEffectiveTotal > 0 && colorWeekEffectiveTotal < limit && colIdx === 0) {
                          // Under MCQ on Shipment 1 (surcharge added!)
                          cellClass += "bg-red-50 text-red-800 border border-red-200 font-bold";
                          badge = (
                            <span className="block text-[8px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded uppercase mt-1 font-sans tracking-wide">
                              need surcharge (MCQ)
                            </span>
                          );
                        } else if (colorWeekEffectiveTotal === 0 && isMoved && !hasOverride) {
                          // Had quantity but got shifted earlier
                          cellClass += "bg-amber-50 text-amber-700/70 border border-dashed border-amber-200";
                          badge = (
                            <span className="block text-[8px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded uppercase mt-1 font-sans tracking-wide">
                              Below MCQ → Moved Earlier
                            </span>
                          );
                        } else if (colorWeekEffectiveTotal >= limit) {
                          // Met MCQ perfectly (color-wide)
                          cellClass += "text-emerald-600 font-semibold";
                        } else if (effectiveQty > 0 && colorWeekEffectiveTotal > 0 && colorWeekEffectiveTotal < limit) {
                          // Below MCQ threshold on a later shipment (either flagged by the
                          // optimizer, or newly below-threshold because of a manual edit)
                          cellClass += "bg-red-50 text-red-700 border border-red-200 font-semibold";
                          badge = (
                            <span className="block text-[8px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded uppercase mt-1 font-sans tracking-wide">
                              {isSurcharged ? "need surcharge (MCQ)" : "below MCQ threshold"}
                            </span>
                          );
                        } else {
                          cellClass += "text-slate-500";
                        }

                        return (
                          <td key={colIdx} className={cellClass + " align-top relative"}>
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1">
                                <EditableQtyCell
                                  overrideValue={hasOverride ? overrideVal : undefined}
                                  computedQty={qty}
                                  disabled={!onMatrixQtyChange}
                                  onCommit={(value) => onMatrixQtyChange && onMatrixQtyChange(itemDescription, colorCode, col.week, value)}
                                />
                                {hasOverride && onMatrixQtyChange && (
                                  <button
                                    type="button"
                                    title="Clear manual edit and revert to computed quantity"
                                    onClick={() => onMatrixQtyChange(itemDescription, colorCode, col.week, null)}
                                    className="text-slate-400 hover:text-red-600 transition shrink-0 cursor-pointer"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                              {(qty > 0 || hasOverride || originalQty > 0) && (
                                <span className="text-[10px] text-slate-400">Original Qty: {formatOriginalQty(originalQty)}</span>
                              )}
                              {hasOverride && (
                                <span className="flex items-center gap-0.5 text-[8px] text-blue-600 font-sans font-semibold uppercase tracking-wide">
                                  <Pencil size={8} /> edited
                                </span>
                              )}
                              {badge}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Per-Shipment MOQ Status */}
          {(() => {
            const orderMoq = scenario.moqThreshold ?? 3000;
            const shipmentWeeks = Array.from(new Set(scenario.processedEntries.map(p => p.assignedWeek))).sort((a, b) => a - b);
            const shipmentSummaries = shipmentWeeks.map(w => {
              const shipmentQty = scenario.processedEntries
                .filter(p => p.assignedWeek === w)
                .reduce((sum, p) => sum + p.qty, 0);
              return { week: w, qty: shipmentQty, isMoqMet: shipmentQty >= orderMoq };
            }).filter(s => s.qty > 0);

            if (shipmentSummaries.length === 0) return null;

            return (
              <div className="space-y-2 mb-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {t("Per-Shipment MOQ Status", lang)}
                </div>
                {shipmentSummaries.map(({ week, qty, isMoqMet }) => {
                  const pct = Math.min(100, (qty / orderMoq) * 100);
                  return (
                    <div key={week} className={`p-4 rounded-xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm transition-all ${
                      isMoqMet
                        ? "bg-emerald-50/60 border-emerald-100 text-emerald-900"
                        : "bg-amber-50 border-amber-100 text-amber-900"
                    }`}>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          {isMoqMet ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                              {t("MOQ Met", lang)}
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase animate-pulse">
                              {t("MOQ Not Met", lang)}
                            </span>
                          )}
                          <span className="font-bold text-sm">
                            {t("Shipment", lang)} {week} {isMoqMet ? t("MOQ Target Achieved", lang) : t("MOQ Target Not Met", lang)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {isMoqMet
                            ? tp("flag.shipmentMoqMetDetail", { moq: orderMoq.toLocaleString(), qty: Math.round(qty).toLocaleString() }, lang)
                            : tp("flag.shipmentMoqShortDetail", { moq: orderMoq.toLocaleString(), shortfall: (orderMoq - qty).toFixed(0) }, lang)
                          }
                        </p>
                      </div>

                      <div className="flex flex-col items-start md:items-end gap-1 font-mono shrink-0">
                        <div className="text-xs font-semibold text-slate-500">
                          {t("Shipment MOQ Ratio", lang)}
                        </div>
                        <div className="text-lg font-extrabold text-slate-800">
                          {Math.round(qty).toLocaleString()} / {orderMoq.toLocaleString()} YD
                        </div>
                        <div className="w-full md:w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full transition-all duration-500 ${isMoqMet ? "bg-emerald-500" : "bg-amber-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Warnings Log */}
          {scenario.moqAlerts.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="text-amber-600" size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Automated MOQ Optimization Logs
                </span>
              </div>
              <div className="space-y-1.5">
                {scenario.moqAlerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4 text-[11px] bg-white border border-slate-200 p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                      <span className="font-mono text-blue-600 font-semibold">{alert.colorCode}</span>
                      <span className="text-slate-500">Shipment {alert.week} quantity</span>
                      <span className="font-mono bg-slate-50 text-slate-700 px-1 py-0.5 rounded border border-slate-100">
                        {formatOriginalQty(alert.originalQty)} YD
                      </span>
                      <span className="text-slate-500">was below MCQ limit of</span>
                      <span className="font-mono bg-slate-50 text-slate-700 px-1 py-0.5 rounded border border-slate-100">
                        {alert.targetMoq} YD
                      </span>
                    </div>

                    <div className="shrink-0">
                      {alert.moved ? (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold">
                          Moved to Shipment {alert.movedToWeek}
                        </span>
                      ) : (
                        <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded font-mono text-[9px] font-bold block text-right leading-tight">
                          <span className="block">Shipment {alert.week} MCQ Surcharge Added {alert.surchargeAmount !== undefined ? `${alert.surchargeAmount.toFixed(2)} USD` : ''}</span>
                          {alert.surchargeRuleApplied ? (
                            <span className="block text-[8px] font-normal text-slate-500 mt-0.5 font-sans">
                              [Rule: {alert.surchargeRuleApplied} ({alert.surchargeRateApplied})]
                            </span>
                          ) : null}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Manual Shipment Date Overrides (per-scenario) */}
      {activeTab === "shipmentDates" && (
        <div className="space-y-4">
          <div className="bg-blue-50/70 border border-blue-100 p-3.5 rounded-xl text-[11px] text-slate-600 leading-relaxed flex gap-2.5 shadow-sm">
            <Calendar size={15} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>{t("Manual Shipment Date Overrides:", lang)}</strong> {t("By default, shipment dates are dynamically calculated by grouping PRs into natural gaps, finding the earliest PR Due Date per group, subtracting transit time, and snapping backwards to the allowed Loading Departure Days. You can manually override the computed departure date for any specific shipment group below.", lang)}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl max-h-[400px] overflow-y-auto">
            {Array.from({ length: scenario.shipments.length }, (_, i) => i + 1).map((w) => {
              // Local-time-safe date formatting for <input type="date">
              // (YYYY-MM-DD). toISOString() converts to UTC first, which
              // silently shows the wrong day for timezones ahead of UTC
              // (e.g. Bangkok, UTC+7) — a local midnight date can roll back
              // to the previous day once converted to UTC.
              const toDateInputValue = (d: Date) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                return `${year}-${month}-${day}`;
              };
              const computedDateStr = computedDates[w - 1] ? toDateInputValue(computedDates[w - 1]) : "";
              // Long-format date string including weekday, e.g.
              // "Friday, February 6, 2026" (or Thai equivalent). Native
              // <input type="date"> can't render this itself, so we show
              // it as a caption alongside the input.
              const formatLongDate = (dateInputValue: string) => {
                if (!dateInputValue) return "";
                const [y, m, d] = dateInputValue.split("-").map(Number);
                const dateObj = new Date(y, m - 1, d);
                if (isNaN(dateObj.getTime())) return "";
                return dateObj.toLocaleDateString(lang === "TH" ? "th-TH" : "en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
              };
              // Show the computed date directly in the field by default so
              // the user can see it at a glance — but this is purely a
              // display fallback. shipmentDates itself stays untouched
              // until the user actually edits the field via onChange, so
              // the dynamic per-group calculation keeps driving the real
              // value unless explicitly overridden.
              const dateVal = shipmentDates[w - 1] || computedDateStr;
              return (
                <div key={w} className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200/60 shadow-xs">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {lang === "TH" ? `วันเดินเรือชิปเมนต์ที่ ${w}` : `Shipment ${w} Date`}
                  </label>
                  <input
                    type="date"
                    value={dateVal}
                    onChange={(e) => {
                      const newDates = [...shipmentDates];
                      newDates[w - 1] = e.target.value;
                      setShipmentDates(newDates);
                    }}
                    className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  />
                  {dateVal && (
                    <div className="text-[10px] text-slate-500 font-medium px-0.5">
                      {formatLongDate(dateVal)}
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[9px]">
                    <span className="text-slate-400 font-medium">
                      {lang === "TH" ? `ชิปเมนต์กลุ่มที่ ${w}` : `Shipment Group ${w}`}
                    </span>
                    {computedDateStr && !shipmentDates[w - 1] && (
                      <span className="text-blue-500 font-mono" title="Dynamically Computed Baseline Date — edit above to override">
                        Computed: {formatLongDate(computedDateStr)}
                      </span>
                    )}
                    {shipmentDates[w - 1] && (
                      <span className="text-amber-600 font-mono font-semibold" title="Manually overridden">
                        Manual override
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Excess MCQ / MOQ Manual Overrides (per-scenario) */}
      {activeTab === "excess" && (() => {
        const matchingPr = entries.find(e =>
          e.colorCode === newOverColor &&
          (!newOverItemDescription || (e.itemDescription || e.itemCode) === newOverItemDescription)
        );
        const foundUnitPrice = matchingPr ? matchingPr.unitPrice : 0;
        const foundCbmPerUnit = matchingPr && matchingPr.qty > 0 ? matchingPr.cbm / matchingPr.qty : 0.003;

        return (
          <div className="space-y-4">
            <div className="bg-violet-50 border border-violet-100 p-3 rounded-lg text-[11px] text-slate-600 leading-relaxed">
              <strong>{t("Excess MCQ Overrides:", lang)}</strong> {t("Select a color and optionally a specific item, then specify the additional quantity to add. Price and CBM per unit are automatically retrieved from the dataset to ensure total landed cost and volume update correctly.", lang)}
            </div>

            <div className="space-y-2.5 bg-slate-50 border border-slate-100 p-3 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t("Inject Order Padding Override", lang)}</span>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">{t("Color Code", lang)}</label>
                  <select
                    value={newOverColor}
                    onChange={e => setNewOverColor(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {uniqueColors.length === 0 ? (
                      <option value="">{t("No colors available", lang)}</option>
                    ) : (
                      uniqueColors.map(color => (
                        <option key={color} value={color}>{color}</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">{t("Item Description (Optional)", lang)}</label>
                  <select
                    value={newOverItemDescription}
                    onChange={e => setNewOverItemDescription(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">{t("All Items under Color", lang)}</option>
                    {uniqueItems.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">{t("Target Shipment", lang)}</label>
                  <select
                    value={newOverWeek}
                    onChange={e => setNewOverWeek(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="0">{t("Auto / Under MCQ", lang)}</option>
                    {Array.from({ length: scenario.shipments.length }, (_, i) => i + 1).map((w) => (
                      <option key={w} value={w}>
                        {lang === "TH" ? `ชิปเมนต์ ${w}` : `Shipment ${w}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">{t("Additional Qty (YD)", lang)}</label>
                  <input
                    type="number"
                    value={newOverQty || ""}
                    onChange={e => setNewOverQty(parseInt(e.target.value) || 0)}
                    placeholder="e.g. 500"
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Auto-Looked Up Display Fields */}
                <div className="col-span-2 grid grid-cols-2 gap-3 bg-violet-100/40 p-2.5 rounded-lg border border-violet-200/50 mt-1">
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[8px] tracking-wider mb-0.5">{t("Retrieved Unit Price", lang)}</span>
                    <span className="font-mono text-violet-800 font-semibold text-xs">
                      {foundUnitPrice > 0
                        ? (foundUnitPrice > 30 ? `${foundUnitPrice.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} THB` : `$${foundUnitPrice.toFixed(2)} USD`)
                        : "N/A"
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[8px] tracking-wider mb-0.5">{t("Retrieved CBM per YD", lang)}</span>
                    <span className="font-mono text-violet-800 font-semibold text-xs">
                      {matchingPr ? `${foundCbmPerUnit.toFixed(5)} CBM` : "0.00300 CBM (Default)"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddOverride}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded py-1.5 text-xs font-semibold mt-2 cursor-pointer transition flex items-center justify-center gap-1"
              >
                <Plus size={12} /> {t("Add Padding Override", lang)}
              </button>
            </div>

            {excessOverrides.length > 0 && (
              <div className="border border-slate-100 rounded-lg overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="p-2">{t("Color / Item", lang)}</th>
                      <th className="p-2">{t("Target", lang)}</th>
                      <th className="p-2 text-right">{t("Padded Qty", lang)}</th>
                      <th className="p-2 text-right">{t("Price", lang)}</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {excessOverrides.map(o => (
                      <tr key={o.id} className="text-slate-600 hover:bg-slate-50">
                        <td className="p-2 font-medium">
                          <div className="truncate max-w-[120px]">{o.colorCode}</div>
                          {o.itemDescription && <div className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">{o.itemDescription}</div>}
                        </td>
                        <td className="p-2 font-mono text-slate-500">
                          {o.targetWeek ? `${t("Shipment", lang)} ${o.targetWeek}` : t("Auto / Under MCQ", lang)}
                        </td>
                        <td className="p-2 text-right font-mono text-violet-600 font-bold">+{o.additionalQty} YD</td>
                        <td className="p-2 text-right font-mono">${o.pricePerUnit?.toFixed(2) || "Default"}</td>
                        <td className="p-2">
                          <button
                            onClick={() => handleRemoveOverride(o.id)}
                            className="text-red-500 hover:text-red-700 transition cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab 2: Shipment Group Details */}
      {activeTab === "shipments" && (
        <div className="space-y-6">
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-xs text-slate-600 leading-relaxed">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-blue-900 font-bold">{t("Interactive Shipment Planning:", lang)}</span> {t("Drag and drop any materials between shipment cards to reschedule them manually, use the drop-down selector on each line, or pick a specific container mix per shipment below. The logistics engine will instantly re-calculate ocean freight container packing, MCQ surcharges, carrying penalties, and total landed costs!", lang)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shipmentColumns.map((ship, idx) => {
              const isLcl = ship.container.isLcl;
              const isMixedLoad = !isLcl && (ship.container.numLcl || 0) > 0;

              return (
                <div 
                  key={idx} 
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedOverWeek !== ship.week) {
                      setDraggedOverWeek(ship.week);
                    }
                  }}
                  onDragLeave={() => {
                    setDraggedOverWeek(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggedOverWeek(null);
                    const prId = e.dataTransfer.getData("text/plain");
                    if (prId && onMovePrLine) {
                      onMovePrLine(prId, ship.week);
                    }
                  }}
                  className={`bg-slate-50/50 border rounded-xl p-5 shadow-sm flex flex-col justify-between transition-all duration-200 ${
                    draggedOverWeek === ship.week
                      ? "border-blue-500 ring-4 ring-blue-500/10 bg-blue-50/30 scale-[1.01]"
                      : "border-slate-200"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                          SHIPMENT {idx + 1}
                        </span>
                        <h4 className="text-base font-bold text-slate-800 mt-1">
                          Shipment Date: {formatDate(ship.shipmentDate || ship.date)}
                        </h4>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isLcl
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : isMixedLoad
                            ? "bg-violet-50 text-violet-700 border border-violet-100"
                            : "bg-blue-50 text-blue-700 border border-blue-100"
                      }`}>
                        {isLcl ? "LCL Cargo" : isMixedLoad ? "Mixed FCL + LCL" : "FCL Cargo"}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 p-3.5 rounded-lg mb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Assigned Containers
                          </div>
                          <div className="text-sm font-bold text-slate-800 font-mono mt-1">
                            {ship.container.name}
                          </div>
                        </div>
                        {containerOverrides[`${ship.week}`] && (
                          <span className="shrink-0 bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                            Manual
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Total Volume: {ship.totalCbm.toFixed(3)} CBM | Quantity: {Math.round(ship.totalQty).toLocaleString()} YD
                      </div>

                      {ship.container.status && (
                        <div className={`mt-2.5 p-2 rounded text-[11px] leading-relaxed flex items-start gap-1.5 border ${
                          ship.container.status === "NOT Acceptable"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : ship.container.status === "Review Needed"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}>
                          {ship.container.status === "NOT Acceptable" ? (
                            <AlertTriangle size={13} className="text-rose-600 shrink-0 mt-0.5" />
                          ) : ship.container.status === "Review Needed" ? (
                            <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                          )}
                          <span>
                            <strong className="font-semibold">{ship.container.status}:</strong> {ship.container.statusDetails}
                          </span>
                        </div>
                      )}

                      {onContainerOverrideChange && (
                        <ContainerMixPicker
                          override={containerOverrides[`${ship.week}`]}
                          autoContainer={{
                            num20gp: ship.container.num20gp,
                            num40gp: ship.container.num40gp,
                            num40hq: ship.container.num40hq
                          }}
                          onChange={(override) => onContainerOverrideChange(ship.week, override)}
                        />
                      )}
                    </div>

                    {/* Cost Breakdown — same fields, order, and labels as the
                        VT Garment Multi-Scenario Sourcing Ledger table, so a
                        shipment card and the ledger row always read the same way. */}
                    <div className="space-y-2 border-t border-slate-200 pt-4 text-xs mb-4">
                      <div className="flex justify-between text-slate-500">
                        <span>{t("Material", lang)}:</span>
                        <span className="font-mono text-slate-700">{formatMoney(ship.totalMaterialCost)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>{t("Freight", lang)}:</span>
                        <span className="font-mono text-slate-700">
                          {ship.freightCost > 0 ? formatMoney(ship.freightCost) : <span className="text-slate-300">—</span>}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>{t("Local", lang)}:</span>
                        <span className="font-mono text-slate-700">
                          {ship.localCost > 0 ? formatMoney(ship.localCost) : <span className="text-slate-300">—</span>}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>{t("Exwork", lang)}:</span>
                        <span className="font-mono text-slate-700">
                          {ship.exworkCost > 0 ? formatMoney(ship.exworkCost) : <span className="text-slate-300">—</span>}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>{t("Brokerage", lang)}:</span>
                        <span className="font-mono text-slate-700">
                          {ship.brokerageCost > 0 ? formatMoney(ship.brokerageCost) : <span className="text-slate-300">—</span>}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{t("Shipping", lang)}:</span>
                        <span className="font-mono">{formatMoney(ship.freightCost + ship.localCost + ship.exworkCost + ship.brokerageCost)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 group relative">
                        <span className="flex items-center gap-1 cursor-help border-b border-dotted border-slate-400">
                          {t("Carrying", lang)}:
                          <span className="invisible group-hover:visible absolute left-0 bottom-6 z-10 w-64 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-lg leading-normal">
                            {t("Formula: (Shipment Value ÷ 2) × Carrying Rate × (Days Early / 365)", lang)}<br/>
                            <span className="text-slate-300 font-mono">{t("Shipment Value = Material Cost + MOQ Excess Cost", lang)}</span>
                          </span>
                        </span>
                        <span className="font-mono text-slate-700">{formatMoney(ship.carryingCost)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 group relative">
                        <span className="flex items-center gap-1 cursor-help border-b border-dotted border-slate-400">
                          {t("Opportunity", lang)}:
                          <span className="invisible group-hover:visible absolute left-0 bottom-6 z-10 w-64 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-lg leading-normal">
                            {t("Formula: Shipment Value × [ (1 + Opportunity Rate)^(Days Early / 365) − 1 ]", lang)}<br/>
                            <span className="text-slate-300 font-mono">{t("Opportunity Rate = WACC %", lang)}</span>
                          </span>
                        </span>
                        <span className="font-mono text-slate-700">{formatMoney(ship.opportunityCost)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>{t("Surcharges", lang)}:</span>
                        <span className="font-mono text-slate-700">
                          {(ship.moqSurchargeCost || 0) > 0 ? formatMoney(ship.moqSurchargeCost || 0) : <span className="text-slate-300">—</span>}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-slate-200 pt-2 text-blue-600">
                        <span>{t("True Landed Cost", lang)}:</span>
                        <span className="font-mono">{formatMoney(ship.totalLandedCost)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Shipment items list */}
                  <div className="border-t border-slate-200 pt-4">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Consolidated Materials ({ship.items.length})
                    </span>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {ship.items.map((item, itemIdx) => (
                        <div 
                          key={item.id || itemIdx} 
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", item.id);
                          }}
                          className="bg-white border border-slate-200 hover:border-blue-300 p-2 rounded flex justify-between items-center text-[11px] font-mono text-slate-700 hover:bg-blue-50/20 active:cursor-grabbing hover:cursor-grab transition duration-150 group"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="text-slate-400 shrink-0 cursor-grab hover:text-blue-500" title="Drag to reschedule">
                              <GripVertical size={13} />
                            </span>
                            <span className="text-slate-500 truncate max-w-[12rem]" title={item.itemDescription || item.itemCode}>
                              {item.id}: {item.itemCode}
                            </span>
                            <span className="bg-slate-100 text-slate-600 px-1 py-0.2 rounded text-[9px] shrink-0 font-bold uppercase">
                              {item.colorCode}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-slate-800 font-bold whitespace-nowrap">{Math.round(item.qty).toLocaleString()} YD</span>
                            
                            {onMovePrLine && scenario.weeks.length > 1 && (
                              <select
                                value={ship.week}
                                onChange={(e) => {
                                  const targetW = parseInt(e.target.value, 10);
                                  if (targetW !== ship.week) {
                                    onMovePrLine(item.id, targetW);
                                  }
                                }}
                                className="bg-slate-50 border border-slate-200 text-[10px] text-slate-600 rounded px-1.5 py-0.5 ml-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer hover:bg-slate-100"
                                title="Reschedule to shipment week"
                              >
                                {scenario.weeks.map(w => (
                                  <option key={w} value={w}>
                                    S{w}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Duplicate PR Rounded Ledger */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-xs text-slate-600 leading-relaxed">
            <CheckSquare size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-blue-900 font-bold">{t("Final Mapped Syteline Planning Sheet (Duplicated & Balanced):", lang)}</span> {t("This duplicate PR ledger reflects the exact rounded integer purchase quantities, adjusted proportionate CBM volumes, and actual financial Carrying & Capital opportunity penalty costs for each entry. Rounding or MCQ/MOQ excess is automatically compiled and added directly to the latest entry on that shipment date as required.", lang)}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-3">{t("PR ID", lang)}</th>
                  <th className="py-3 px-3">{t("Item Code", lang)}</th>
                  <th className="py-3 px-3">{t("Color", lang)}</th>
                  <th className="py-3 px-3 text-right">{t("Original Qty", lang)}</th>
                  <th className="py-3 px-3 text-right">{t("Final Qty", lang)}</th>
                  <th className="py-3 px-3 text-center">{t("Rounding/MOQ Excess", lang)}</th>
                  <th className="py-3 px-3 text-right">{t("Price", lang)}</th>
                  <th className="py-3 px-3 text-center">{t("PR Due Date", lang)}</th>
                  <th className="py-3 px-3 text-center">{t("PO Due Date", lang)}</th>
                  <th className="py-3 px-3 text-center">{t("Days Early", lang)}</th>
                  <th className="py-3 px-3 text-right">{t("Volume (CBM)", lang)}</th>
                  <th className="py-3 px-3 text-right">{t("Material Value", lang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scenario.processedEntries.map((pr, idx) => {
                  const excess = (pr.excessQty || 0);
                  const isPositiveExcess = excess > 0.0001;
                  const isNegativeExcess = excess < -0.0001;

                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono text-slate-400 font-medium">
                        {pr.id}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {pr.itemCode}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {pr.colorCode}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {pr.originalQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                        {pr.qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isPositiveExcess ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-mono text-[10px] font-semibold inline-flex items-center gap-0.5">
                            <Plus size={10} /> {excess.toFixed(2)}
                          </span>
                        ) : isNegativeExcess ? (
                          <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded font-mono text-[10px] font-semibold inline-flex items-center gap-0.5">
                            <Minus size={10} /> {Math.abs(excess).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {pr.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-500">
                        {formatDate(pr.dueDateRaw || pr.prDueDate)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-blue-600 font-semibold">
                        {formatDate(pr.poDueDate)}
                      </td>
                      <td className={`py-3 px-3 text-center font-mono font-bold ${
                        (pr.daysEarly || 0) < 0 ? "text-red-600 font-bold" : (pr.daysEarly || 0) > 0 ? "text-slate-500" : "text-emerald-700 font-black"
                      }`}>
                        {pr.daysEarly} days
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {pr.cbm.toFixed(4)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {(() => {
                          const currCode = (pr.currency || "").toUpperCase().trim();
                          const rate = pr.currencyRate !== undefined && pr.currencyRate !== null
                            ? pr.currencyRate
                            : (currCode === "THB"
                                ? 1.0
                                : (currCode && scenario.exchangeRates?.[currCode] !== undefined
                                    ? scenario.exchangeRates[currCode]
                                    : (pr.unitPrice > 30 ? 1.0 : (scenario.exchangeRates?.["USD"] || 35.0))
                                  )
                              );
                          return formatMoney(pr.qty * pr.unitPrice * rate);
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Syteline Requisition & Line Columns Output */}
      {activeTab === "requisitions" && (
        <div className="space-y-4">
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 flex gap-3 text-xs text-slate-700 leading-relaxed">
            <CheckSquare size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-emerald-900 font-bold">{t("Official Requisition Mapping Worksheet:", lang)}</span> {t("Below is the official compiled Syteline Requisition schedule for", lang)} <strong>{t("Scenario", lang)} {scenario.id}</strong>. {t("In keeping with Syteline standards, we output the Requisition and Line columns mapped alongside their optimized quantities and delivery structures.", lang)}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">{t("Requisition No.", lang)}</th>
                  <th className="py-3 px-4 text-center">{t("Line No.", lang)}</th>
                  <th className="py-3 px-4">{t("Item Code", lang)}</th>
                  <th className="py-3 px-4">{t("Color Description", lang)}</th>
                  <th className="py-3 px-4 text-right">{t("Optimized Qty", lang)}</th>
                  <th className="py-3 px-4 text-center">{t("UOM", lang)}</th>
                  <th className="py-3 px-4 text-center">{t("PO Delivery Date", lang)}</th>
                  <th className="py-3 px-4 text-center">{t("PR Due Date", lang)}</th>
                  <th className="py-3 px-4 text-center">{t("Days Early", lang)}</th>
                  <th className="py-3 px-4 text-center">{t("PR Delivery Date (Vendor Loading)", lang)}</th>
                  <th className="py-3 px-4 text-center">{t("PO Due Date (Arrival at VT)", lang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  // Determine loading date according to shipping rules
                  const getVendorLoadingDate = (shipmentDate: Date, origin: string): Date => {
                    const dateCopy = new Date(shipmentDate);
                    const originUpper = origin.toUpperCase();
                    
                    if (originUpper.includes("TAIWAN") || originUpper.includes("KEELUNG")) {
                      // Taiwan Keelung: Tuesday and Friday.
                      const day = dateCopy.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
                      if (day === 2 || day === 5) return dateCopy;
                      while (dateCopy.getDay() !== 2 && dateCopy.getDay() !== 5) {
                        dateCopy.setDate(dateCopy.getDate() - 1);
                      }
                      return dateCopy;
                    } else {
                      // Other Countries: Monday.
                      const day = dateCopy.getDay();
                      if (day === 1) return dateCopy;
                      while (dateCopy.getDay() !== 1) {
                        dateCopy.setDate(dateCopy.getDate() - 1);
                      }
                      return dateCopy;
                    }
                  };

                  return scenario.processedEntries.map((pr, idx) => {
                    // Derive shipping date associated with the assigned week
                    const shipmentGroup = scenario.shipments.find(s => s.week === pr.assignedWeek);
                    const shipmentDate = shipmentGroup?.shipmentDate || new Date();
                    const loadingDate = pr.actualDelivery || pr.prDueDate; // PR Delivery Date (Vendor Loading) — the ex-port ship date

                    // Requisition usually uses the PR row ID or the PR document
                    const requisitionNo = pr.id;
                    const lineNo = idx + 1; // Standard 1, 2, 3 sequence

                    return (
                      <tr key={idx} className="hover:bg-slate-50 font-mono text-[11px]">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {requisitionNo}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500 font-semibold">
                          {lineNo}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-bold">
                          {pr.itemCode}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-sans">
                          {pr.colorCode}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-blue-600">
                          {Math.round(pr.qty).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400 font-sans font-bold">
                          YD
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500">
                          {formatDate(shipmentDate)}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500">
                          {formatDate(pr.dueDateRaw || pr.prDueDate)}
                        </td>
                        <td className={`py-3 px-4 text-center font-bold ${
                          (pr.daysEarly || 0) < 0 ? "text-red-600 font-bold" : (pr.daysEarly || 0) > 0 ? "text-slate-500" : "text-emerald-700 font-black"
                        }`}>
                          {pr.daysEarly} days
                        </td>
                        <td className="py-3 px-4 text-center text-emerald-700 font-bold">
                          {formatDate(loadingDate)}
                        </td>
                        <td className="py-3 px-4 text-center text-blue-700 font-bold">
                          {formatDate(pr.poDueDate)}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
