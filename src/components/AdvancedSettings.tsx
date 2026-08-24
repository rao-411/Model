import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Plus, Trash2, DollarSign, Info, ShieldAlert, Check,
  AlertTriangle, Settings, Coins, Anchor, TrendingUp, HelpCircle,
  Ship, Layers, CreditCard, PlusCircle, Download, Save, RotateCcw, Lock,
  Upload, FileSpreadsheet, X, Sparkles
} from "lucide-react";
import * as XLSX from "xlsx";
import { RouteQuote, CustomFeeItem, PrEntry, WarehouseRentConfig, SurchargeRule, ImportedFclQuote, IncotermRule, LoadingDateRule } from "../types";
import { Language, t } from "../utils/translate";
import { getDefaultRouteQuotes } from "../optimizer";
import { getDefaultImportedFclQuotes } from "../defaultFclQuotes";

const renderIncotermsTable = (lang: Language) => {
  const buyerLabel = t("We Pay (Buyer)", lang);
  const vendorLabel = t("Vendor Pays", lang);

  const rows = [
    { name: "EXW", exwork: buyerLabel, freight: buyerLabel, local: buyerLabel, brokerage: buyerLabel, desc: t("Ex Works", lang) },
    { name: "FCA", exwork: vendorLabel, freight: buyerLabel, local: buyerLabel, brokerage: buyerLabel, desc: t("Free Carrier", lang) },
    { name: "FOB", exwork: vendorLabel, freight: buyerLabel, local: buyerLabel, brokerage: buyerLabel, desc: t("Free On Board", lang) },
    { name: "CFR", exwork: vendorLabel, freight: vendorLabel, local: buyerLabel, brokerage: buyerLabel, desc: t("Cost and Freight", lang) },
    { name: "CIF", exwork: vendorLabel, freight: vendorLabel, local: buyerLabel, brokerage: buyerLabel, desc: t("Cost, Insurance & Freight", lang) },
    { name: "DDP", exwork: vendorLabel, freight: vendorLabel, local: vendorLabel, brokerage: vendorLabel, desc: t("Delivered Duty Paid", lang) },
  ];

  return (
    <div className="mt-3 overflow-hidden border border-slate-200 rounded-lg bg-white shadow-xs w-full">
      <table className="w-full text-left text-[9px] border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
            <th className="px-2 py-1 w-1/6">{t("Incoterm", lang)}</th>
            <th className="px-2 py-1 w-1/4">{t("EXWORK (Origin Local)", lang)}</th>
            <th className="px-2 py-1 w-1/4">{t("FREIGHT (Ocean)", lang)}</th>
            <th className="px-2 py-1 w-1/4">{t("LOCAL (Dest. Local)", lang)}</th>
            <th className="px-2 py-1 w-1/4">{t("BROKERAGE (Clearance)", lang)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.name} className="hover:bg-slate-50/50 transition">
              <td className="px-2 py-1 font-bold text-slate-800">
                {r.name}
                <div className="text-[8px] font-normal text-slate-400 font-sans">{r.desc}</div>
              </td>
              <td className="px-2 py-1">
                <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                  r.exwork === buyerLabel ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-600"
                }`}>
                  {r.exwork}
                </span>
              </td>
              <td className="px-2 py-1">
                <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                  r.freight === buyerLabel ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-600"
                }`}>
                  {r.freight}
                </span>
              </td>
              <td className="px-2 py-1">
                <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                  r.local === buyerLabel ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-600"
                }`}>
                  {r.local}
                </span>
              </td>
              <td className="px-2 py-1">
                <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                  r.brokerage === buyerLabel ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-600"
                }`}>
                  {r.brokerage}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface AdvancedSettingsProps {
  entries: PrEntry[];
  customQuotes: RouteQuote[];
  setCustomQuotes: (quotes: RouteQuote[]) => void;
  warehouseStuckDays: number;
  setWarehouseStuckDays: (days: number) => void;
  warehouseDailyRent: WarehouseRentConfig;
  setWarehouseDailyRent: (rent: WarehouseRentConfig) => void;
  exchangeRates: Record<string, number>;
  setExchangeRates: (rates: Record<string, number>) => void;
  activeCurrencies: string[];
  prExtractedCurrencies?: Record<string, boolean>;
  mcqSurchargeUSD: number;
  setMcqSurchargeUSD: (surcharge: number) => void;
  mcqSurchargeType: "flat" | "unitPriceIncrease";
  setMcqSurchargeType: (type: "flat" | "unitPriceIncrease") => void;
  vendorSurcharges: Record<string, number>;
  setVendorSurcharges: (v: Record<string, number>) => void;
  surchargeRules: SurchargeRule[];
  setSurchargeRules: (rules: SurchargeRule[]) => void;
  incotermRules: IncotermRule[];
  setIncotermRules: React.Dispatch<React.SetStateAction<IncotermRule[]>>;
  importedFclQuotes: ImportedFclQuote[];
  setImportedFclQuotes: React.Dispatch<React.SetStateAction<ImportedFclQuote[]>>;
  loadingDateRules: LoadingDateRule[];
  setLoadingDateRules: React.Dispatch<React.SetStateAction<LoadingDateRule[]>>;
  previouslyExistingContainers?: number;
  setPreviouslyExistingContainers?: (val: number) => void;
  recommendedFleetSuggestion?: any;
  carryingRate: number;
  setCarryingRate: (val: number) => void;
  opportunityRate: number;
  setOpportunityRate: (val: number) => void;
  enablePullForward: boolean;
  setEnablePullForward: (val: boolean) => void;
  lang: Language;
}

export default function AdvancedSettings({
  entries,
  customQuotes,
  setCustomQuotes,
  warehouseStuckDays,
  setWarehouseStuckDays,
  warehouseDailyRent,
  setWarehouseDailyRent,
  exchangeRates,
  setExchangeRates,
  activeCurrencies = ["USD", "EUR", "HKD"],
  prExtractedCurrencies = {},
  mcqSurchargeUSD,
  setMcqSurchargeUSD,
  mcqSurchargeType,
  setMcqSurchargeType,
  vendorSurcharges,
  setVendorSurcharges,
  surchargeRules,
  setSurchargeRules,
  incotermRules = [],
  setIncotermRules,
  importedFclQuotes = [],
  setImportedFclQuotes,
  loadingDateRules = [],
  setLoadingDateRules,
  previouslyExistingContainers = 0,
  setPreviouslyExistingContainers,
  recommendedFleetSuggestion,
  carryingRate,
  setCarryingRate,
  opportunityRate,
  setOpportunityRate,
  enablePullForward,
  setEnablePullForward,
  lang
}: AdvancedSettingsProps) {
  const [activeTab, setActiveTab] = useState<"quotes" | "warehouse" | "surcharges" | "incoterms" | "rates" | "pullforward">("quotes");

  // Selected country in Quotes Tab
  const [selectedCountry, setSelectedCountry] = useState<string>("Taiwan");

  // Track active quote version ID
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Custom iframe-safe confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  // State for adding a new custom fee item
  const [feeCategory, setFeeCategory] = useState<"local" | "freight" | "brokerage" | "exwork">("local");
  const [feeName, setFeeName] = useState("");
  const [feeType, setFeeType] = useState<CustomFeeItem["type"]>("flat");
  const [feeAmount, setFeeAmount] = useState(0);

  // State for manual vendor surcharge addition
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorSurcharge, setNewVendorSurcharge] = useState<number>(150);

  // Local controlled input for previously existing containers (keeps text while typing)
  const [prevExistingInput, setPrevExistingInput] = useState<string>(String(previouslyExistingContainers || 0));

  useEffect(() => {
    setPrevExistingInput(String(previouslyExistingContainers || 0));
  }, [previouslyExistingContainers]);



  const [surchargeDragActive, setSurchargeDragActive] = useState(false);
  const fileInputRefSurcharge = useRef<HTMLInputElement>(null);

  // FCL Quotes Import States and Handlers
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | "info" | null;
    message: string;
  }>(() => {
    const saved = localStorage.getItem("procurement_quotes_upload_status");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { type: null, message: "" };
  });

  useEffect(() => {
    localStorage.setItem("procurement_quotes_upload_status", JSON.stringify(uploadStatus));
  }, [uploadStatus]);

  const [surchargeUploadStatus, setSurchargeUploadStatus] = useState<{
    type: "success" | "error" | "info" | null;
    message: string;
  }>(() => {
    const saved = localStorage.getItem("procurement_surcharge_upload_status");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { type: null, message: "" };
  });

  useEffect(() => {
    localStorage.setItem("procurement_surcharge_upload_status", JSON.stringify(surchargeUploadStatus));
  }, [surchargeUploadStatus]);
  const fileInputRefQuotes = useRef<HTMLInputElement>(null);
  const [activeQuotesTab, setActiveQuotesTab] = useState<"FCL" | "LCL">("FCL");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) throw new Error("Could not read file data");

        const parsed = parseQuotesExcel(data as ArrayBuffer);
        if (parsed.length === 0) {
          setUploadStatus({
            type: "error",
            message: "No valid FCL quotes found in the uploaded file. Please check that headers match the expected format."
          });
          return;
        }

        setImportedFclQuotes(parsed);
        setUploadStatus({
          type: "success",
          message: `Successfully imported ${parsed.length} quotes from ${file.name}!`
        });
      } catch (err: any) {
        setUploadStatus({
          type: "error",
          message: `Failed to parse Excel file: ${err?.message || "Unknown error"}`
        });
      }
    };
    reader.onerror = () => {
      setUploadStatus({
        type: "error",
        message: "Failed to read the file. Please try again."
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportTemplate = () => {
    let fclRows = importedFclQuotes.filter(q => q.containerLoad !== "LCL").map(q => ({
      "CONTAINER LOAD": q.containerLoad,
      "CONTAINER SIZE": q.containerSize === 40 ? "40ft" : "20ft",
      "Ship From": q.shipFrom,
      "EXPENSE TYPE": q.expenseType,
      "PAYMENT TYPE": q.paymentType,
      "AMOUNT": q.amount,
      "CURRENCY": q.currency
    }));
    let lclRows = importedFclQuotes.filter(q => q.containerLoad === "LCL").map(q => ({
      "CONTAINER LOAD": q.containerLoad,
      "Ship From": q.shipFrom,
      "EXPENSE TYPE": q.expenseType,
      "PAYMENT TYPE": q.paymentType,
      "AMOUNT": q.amount,
      "CURRENCY": q.currency
    }));

    if (fclRows.length === 0) {
      fclRows = [
        {
          "CONTAINER LOAD": "FCL",
          "CONTAINER SIZE": "40ft",
          "Ship From": "Taiwan",
          "EXPENSE TYPE": "FREIGHT",
          "PAYMENT TYPE": "BY CONTAINER",
          "AMOUNT": 1750,
          "CURRENCY": "USD"
        },
        {
          "CONTAINER LOAD": "FCL",
          "CONTAINER SIZE": "20ft",
          "Ship From": "Taiwan",
          "EXPENSE TYPE": "FREIGHT",
          "PAYMENT TYPE": "BY CONTAINER",
          "AMOUNT": 1350,
          "CURRENCY": "USD"
        }
      ];
    }
    
    if (lclRows.length === 0) {
      lclRows = [
        {
          "CONTAINER LOAD": "LCL",
          "Ship From": "Taiwan",
          "EXPENSE TYPE": "FREIGHT",
          "PAYMENT TYPE": "BY CBM",
          "AMOUNT": 120,
          "CURRENCY": "USD"
        },
        {
          "CONTAINER LOAD": "LCL",
          "Ship From": "Taiwan",
          "EXPENSE TYPE": "LOCAL",
          "PAYMENT TYPE": "BY CBM",
          "AMOUNT": 50,
          "CURRENCY": "USD"
        }
      ];
    }

    const workbook = XLSX.utils.book_new();
    const fclSheet = XLSX.utils.json_to_sheet(fclRows);
    XLSX.utils.book_append_sheet(workbook, fclSheet, "FCL");
    
    const lclSheet = XLSX.utils.json_to_sheet(lclRows);
    XLSX.utils.book_append_sheet(workbook, lclSheet, "LCL");

    XLSX.writeFile(workbook, "Shipping_Quotes_Template.xlsx");
  };

  const handleLoadPresetSample = () => {
    setImportedFclQuotes(getDefaultImportedFclQuotes());
    setUploadStatus({
      type: "success",
      message: "Successfully reset to original high-fidelity sample FCL quotes."
    });
  };

  // Memoized unique vendors detected in the uploaded spreadsheet entries
  const uniqueVendors = useMemo(() => {
    const list = new Set<string>();
    entries.forEach(e => {
      if (e.vendor) {
        list.add(e.vendor);
      }
    });
    list.add("Sourcing Fallback");
    list.add("KINGWHALE CORPORATION");
    return Array.from(list).sort();
  }, [entries]);


  const formatStringDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      // YYYY-MM-DD to MM/DD/YYYY
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Memoized unique origins from initial dataset or custom quotes
  const uniqueOrigins = useMemo(() => {
    const list = Array.from(new Set(customQuotes.map(q => q.origin)));
    // Ensure the default origins are present
    const defaults = ["Taiwan", "Italy", "Busan", "Vietnam", "Hong Kong"];
    defaults.forEach(d => {
      if (!list.some(item => item.toLowerCase() === d.toLowerCase())) {
        list.push(d);
      }
    });
    return list;
  }, [customQuotes]);

  // Memoized quotes matching the active selected country
  const selectedCountryQuotes = useMemo(() => {
    const selected = (selectedCountry || "").toUpperCase().trim();
    return customQuotes.filter(q => (q.origin || "").toUpperCase().trim() === selected);
  }, [customQuotes, selectedCountry]);

  // Track and synchronize the selected quote ID when country changes
  useEffect(() => {
    if (selectedCountryQuotes.length > 0) {
      const exists = selectedCountryQuotes.some(q => q.id === selectedQuoteId);
      if (!exists) {
        setSelectedQuoteId(selectedCountryQuotes[0].id);
      }
    }
  }, [selectedCountryQuotes, selectedQuoteId]);

  // Resolve the RouteQuote currently selected for editing (base and draft merged)
  const baseQuote = useMemo(() => {
    const found = customQuotes.find(q => q.id === selectedQuoteId);
    if (found) return found;
    if (selectedCountryQuotes.length > 0) return selectedCountryQuotes[0];
    return customQuotes[0];
  }, [customQuotes, selectedQuoteId, selectedCountryQuotes]);

  const currentQuote = baseQuote;
  const isCurrentDefault = currentQuote ? (!currentQuote.effectiveDate && !currentQuote.expiryDate) : false;

  // Retrieve factory baseline for a given country string
  const getBaselineDefaultQuoteForCountry = (country: string): RouteQuote | undefined => {
    const defaultQuotes = getDefaultRouteQuotes();
    const origin = (country || "").toUpperCase().trim();
    let routeKey = "TAIWAN";
    if (origin.includes("ITALY") || origin.includes("LA SPEZIA") || origin.includes("SPEZIA")) {
      routeKey = "ITALY";
    } else if (origin.includes("BUSAN") || origin.includes("KOREA") || origin.includes("KR")) {
      routeKey = "BUSAN";
    } else if (origin.includes("HCM") || origin.includes("HO CHI MINH") || origin.includes("VIETNAM") || origin.includes("VN")) {
      routeKey = "HCM";
    } else if (origin.includes("HONG KONG") || origin.includes("HK")) {
      routeKey = "HK";
    } else if (origin.includes("TAIWAN") || origin.includes("TAIPEI") || origin.includes("KEELUNG") || origin.includes("TW")) {
      routeKey = "TAIWAN";
    } else {
      routeKey = origin;
    }
    const matchKey = Object.keys(defaultQuotes).find(k => k.toUpperCase().trim() === routeKey);
    return matchKey ? defaultQuotes[matchKey] : undefined;
  };

  // Handle saving changes
  const handleSaveChanges = () => {
    if (!currentQuote) return;

    const isDefaultVersion = !currentQuote.effectiveDate && !currentQuote.expiryDate;
    if (isDefaultVersion) return; // Locked default version cannot be modified

    // For custom periods, edits are already saved to customQuotes on keypress.
    // Just trigger success feedback.
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Duplicate current quote as a new version with validity dates
  const handleSaveAsNewVersion = () => {
    if (!currentQuote) return;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const newQuote: RouteQuote = {
      ...JSON.parse(JSON.stringify(currentQuote)),
      id: "quote_" + Math.random().toString(36).substring(2, 9),
      effectiveDate: todayStr, // default to today's date
      expiryDate: undefined
    };
    setCustomQuotes([...customQuotes, newQuote]);
    setSelectedQuoteId(newQuote.id);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Reset the current quote to factory default settings
  const handleResetToFactoryDefaults = () => {
    if (!currentQuote) return;
    const isDefaultVersion = !currentQuote.effectiveDate && !currentQuote.expiryDate;
    if (isDefaultVersion) return; // Locked default version, cannot be reset because it cannot be modified

    const msg = lang === "TH"
      ? "คุณแน่ใจหรือไม่ที่จะรีเซ็ตช่วงเวลานี้เป็นค่าเริ่มต้นดั้งเดิม? ข้อมูลที่แก้ไขทั้งหมดในเวอร์ชันนี้จะสูญหาย"
      : `Are you sure you want to reset this custom quotation period for ${currentQuote.origin} to its original factory defaults? This will restore all pricing values to the baseline, but preserve its validity dates.`;
    
    setConfirmModal({
      isOpen: true,
      title: lang === "TH" ? "รีเซ็ตค่าเริ่มต้น" : "Reset to Factory Defaults",
      message: msg,
      onConfirm: () => {
        const baseline = getBaselineDefaultQuoteForCountry(selectedCountry);
        if (baseline) {
          // Reset custom version
          const updatedQuote = {
            ...JSON.parse(JSON.stringify(baseline)),
            id: currentQuote.id, // preserve ID
            effectiveDate: currentQuote.effectiveDate, // preserve dates
            expiryDate: currentQuote.expiryDate
          };
          const updated = customQuotes.map(q => {
            if (q.id === currentQuote.id) {
              return updatedQuote;
            }
            return q;
          });
          setCustomQuotes(updated);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      }
    });
  };

  // Export all quotations for the selected country to a structured Excel CSV format
  const handleExportCountryQuotes = () => {
    const headers = [
      "Quotation Version",
      "Origin Country",
      "Effective Date",
      "Expiry Date",
      "LCL Freight / CBM",
      "20GP FCL Freight",
      "40GP FCL Freight",
      "40HQ FCL Freight",
      "LCL Local Lump Sum",
      "LCL Local / CBM",
      "FCL D/O Fee",
      "FCL Handling Fee",
      "FCL 20' THC + Cleaning + EMC",
      "FCL 40' THC + Cleaning + EMC",
      "FCL 40HQ' THC + Cleaning + EMC",
      "Brokerage LCL Tier 1 (<=3 CBM)",
      "Brokerage LCL Tier 2 (<=5 CBM)",
      "Brokerage LCL Tier 3 (>5 CBM)",
      "Brokerage LCL Handling / CBM",
      "Brokerage LCL Admission / CBM",
      "Brokerage FCL 20' Total",
      "Brokerage FCL 40'/40HQ Total",
      "Custom Freight Fees",
      "Custom Local Fees",
      "Custom Brokerage Fees",
      "Custom Exwork Fees"
    ];

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    csvContent += `Logistics Quotation Sheet for ${selectedCountry}\n`;
    csvContent += `Exported Date,${new Date().toLocaleString()}\n\n`;
    csvContent += headers.join(",") + "\n";

    selectedCountryQuotes.forEach((q, idx) => {
      const versionLabel = q.effectiveDate || q.expiryDate 
        ? `Custom Period ${idx + 1}` 
        : "General Default Version";
      
      const eff = q.effectiveDate || "Always Valid";
      const exp = q.expiryDate || "No Expiry";

      const fcl20LocalSum = (q.fcl20LocalThc || 0) + (q.fcl20LocalCleaning || 0) + (q.fcl20LocalEmc || 0);
      const fcl40LocalSum = (q.fcl40LocalThc || 0) + (q.fcl40LocalCleaning || 0) + (q.fcl40LocalEmc || 0);
      const fcl40hqLocalSum = (q.fcl40hqLocalThc || 0) + (q.fcl40hqLocalCleaning || 0) + (q.fcl40hqLocalEmc || 0);

      const fcl20BrokerageSum = (q.brokerageFcl20Clearance || 0) +
        (q.brokerageFcl20LiftOn || 0) +
        (q.brokerageFcl20Admission || 0) +
        (q.brokerageFcl20OverTime || 0) +
        (q.brokerageFcl20ExtendPeriod || 0) +
        (q.brokerageFcl20FacilitiesUsage || 0) +
        (q.brokerageFcl20AdmissionSecond || 0) +
        (q.brokerageFcl20LiftOff || 0);

      const fcl40BrokerageSum = (q.brokerageFcl40Clearance || 0) +
        (q.brokerageFcl40LiftOn || 0) +
        (q.brokerageFcl40Admission || 0) +
        (q.brokerageFcl40OverTime || 0) +
        (q.brokerageFcl40ExtendPeriod || 0) +
        (q.brokerageFcl40FacilitiesUsage || 0) +
        (q.brokerageFcl40AdmissionSecond || 0) +
        (q.brokerageFcl40LiftOff || 0);

      const formatCustomFees = (fees?: CustomFeeItem[]) => {
        if (!fees || fees.length === 0) return '"None"';
        return `"${fees.map(f => `${f.name}:${f.amount}THB(${f.type})`).join("; ")}"`;
      };

      const row = [
        `"${versionLabel}"`,
        `"${q.origin}"`,
        `"${eff}"`,
        `"${exp}"`,
        q.lclFreightPerCbm || 0,
        q.fcl20Freight || 0,
        q.fcl40Freight || 0,
        q.fcl40hqFreight || 0,
        q.lclLocalPerShipment || 0,
        q.lclLocalPerCbm || 0,
        q.fclLocalPerShipmentDo !== undefined ? q.fclLocalPerShipmentDo : 1400,
        q.fclLocalPerShipmentHandling !== undefined ? q.fclLocalPerShipmentHandling : 400,
        fcl20LocalSum,
        fcl40LocalSum,
        fcl40hqLocalSum,
        q.brokerageLclBaseTier1 || 0,
        q.brokerageLclBaseTier2 || 0,
        q.brokerageLclBaseTier3 || 0,
        q.brokerageLclHandlingPerCbm || 0,
        q.brokerageLclAdmissionPerCbm || 0,
        fcl20BrokerageSum,
        fcl40BrokerageSum,
        formatCustomFees(q.customFreightFees),
        formatCustomFees(q.customLocalFees),
        formatCustomFees(q.customBrokerageFees),
        formatCustomFees(q.customExworkFees)
      ];

      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `logistics_quotes_${selectedCountry.toLowerCase().replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // General field updater for custom route quotes
  const updateQuoteField = (field: keyof RouteQuote, value: any) => {
    if (!currentQuote) return;
    
    const isDefaultVersion = !currentQuote.effectiveDate && !currentQuote.expiryDate;
    if (isDefaultVersion) return; // Completely locked default version
    
    // Update customQuotes directly
    const updated = customQuotes.map(q => {
      if (q.id === currentQuote.id) {
        return { ...q, [field]: value };
      }
      return q;
    });
    setCustomQuotes(updated);
  };

  // Handler to add custom named fees
  const handleAddCustomFee = () => {
    if (!feeName.trim() || !currentQuote) return;
    const newItem: CustomFeeItem = {
      id: Math.random().toString(36).substring(2),
      name: feeName.trim(),
      type: feeType,
      amount: feeAmount
    };

    let targetArrayField: "customLocalFees" | "customFreightFees" | "customBrokerageFees" | "customExworkFees";
    if (feeCategory === "local") targetArrayField = "customLocalFees";
    else if (feeCategory === "freight") targetArrayField = "customFreightFees";
    else if (feeCategory === "brokerage") targetArrayField = "customBrokerageFees";
    else targetArrayField = "customExworkFees";

    const currentArr = currentQuote[targetArrayField] || [];
    updateQuoteField(targetArrayField, [...currentArr, newItem]);

    setFeeName("");
    setFeeAmount(0);
  };

  // Handler to remove custom named fees
  const handleRemoveCustomFee = (category: "local" | "freight" | "brokerage" | "exwork", feeId: string) => {
    if (!currentQuote) return;
    let targetArrayField: "customLocalFees" | "customFreightFees" | "customBrokerageFees" | "customExworkFees";
    if (category === "local") targetArrayField = "customLocalFees";
    else if (category === "freight") targetArrayField = "customFreightFees";
    else if (category === "brokerage") targetArrayField = "customBrokerageFees";
    else targetArrayField = "customExworkFees";

    const currentArr = currentQuote[targetArrayField] || [];
    updateQuoteField(targetArrayField, currentArr.filter((f: any) => f.id !== feeId));
  };

  const handleRemoveQuote = (id: string) => {
    setCustomQuotes(customQuotes.filter(q => q.id !== id));
  };

  const handleDownloadSampleSurcharges = () => {
    const headers = [
      "Customer Code", "Vendor Code", "SL Description", "Colour", "Size",
      "Qty/Amount", "Min", "Max", "Surcharge Type", "Amount", "Currency"
    ];
    const rows = [
      ["CUST001", "KW001", "100% Cotton Jersey", "BLACK", "M", "Qty", "100", "500", "USD/Color", "150", "USD"],
      ["CUST002", "KINGWHALE CORPORATION", "Polyester Blend Fleece", "Other colour", "L", "Amount", "1000", "5000", "% of Unit Price/Color", "20", "USD"],
      ["CUST001", "KW002", "", "", "", "Amount", "0", "1500", "USD/PO", "250", "USD"],
      ["", "KINGWHALE CORPORATION", "", "BLACK", "", "Qty", "200", "1000", "USD/Color/Unit", "0.21", "USD"]
    ];
    
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "surcharge_rules_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSurchargeRulesUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const parsedRules: SurchargeRule[] = json.map((row: any) => {
          const getVal = (possibleKeys: string[]) => {
            for (const k of possibleKeys) {
              const keyFound = Object.keys(row).find(
                key => key.toLowerCase().replace(/[^a-z0-9/]/g, "") === k.toLowerCase().replace(/[^a-z0-9/]/g, "")
              );
              if (keyFound !== undefined) return row[keyFound];
            }
            return undefined;
          };

          const customerCode = getVal(["Customer Code", "CustomerCode", "Customer"]);
          const vendorCode = getVal(["Vendor Code", "VendorCode", "Vendor", "Supplier"]);
          const itemDescription = getVal(["SL Description", "SLDescription", "Item Description", "ItemDescription", "Item", "Description"]);
          const color = getVal(["Colour", "Color"]);
          const size = getVal(["Size"]);
          const qtyOrAmountRaw = getVal(["Qty/Amount", "Qty_Amount", "QtyOrAmount", "QuantityOrAmount"]);
          const minVal = getVal(["Min"]);
          const maxVal = getVal(["Max"]);
          const rawSurchargeType = getVal(["Surcharge Type", "SurchargeType", "Type"]);
          const amount = getVal(["Amount", "Value"]);
          const currency = getVal(["Currency", "Curr"]);

          const isAmt = String(qtyOrAmountRaw || "Qty").trim().toLowerCase().includes("amount") || 
                        String(qtyOrAmountRaw || "Qty").trim().toLowerCase().includes("amt");

          let parsedType = rawSurchargeType !== undefined && rawSurchargeType !== "" ? String(rawSurchargeType).trim() : "USD/Color";
          const lowType = parsedType.toLowerCase();
          if (lowType.includes("%") || lowType.includes("percent")) {
            parsedType = "% of Unit Price/Color";
          } else if (lowType.includes("unit")) {
            parsedType = "USD/Color/Unit";
          } else if (lowType.includes("po")) {
            parsedType = "USD/PO";
          } else {
            parsedType = "USD/Color";
          }

          return {
            id: "rule_" + Math.random().toString(36).substring(2, 9),
            customerCodeRaw: customerCode !== undefined && customerCode !== "" ? String(customerCode).trim() : undefined,
            vendorCode: vendorCode !== undefined && vendorCode !== "" ? String(vendorCode).trim() : undefined,
            itemDescription: itemDescription !== undefined && itemDescription !== "" ? String(itemDescription).trim() : undefined,
            color: color !== undefined && color !== "" ? String(color).trim() : undefined,
            size: size !== undefined && size !== "" ? String(size).trim() : undefined,
            qtyOrAmount: isAmt ? ("Amount" as const) : ("Qty" as const),
            min: minVal !== undefined && minVal !== "" ? Number(minVal) : undefined,
            max: maxVal !== undefined && maxVal !== "" ? Number(maxVal) : undefined,
            surchargeType: parsedType,
            amount: amount !== undefined && amount !== "" ? Number(amount) : 0,
            currency: currency !== undefined && currency !== "" ? String(currency).trim() : "USD"
          };
        });

        if (parsedRules.length > 0) {
          setSurchargeRules(parsedRules);
          setSurchargeUploadStatus({
            type: "success",
            message: `Successfully imported ${parsedRules.length} surcharge rules from ${file.name}!`
          });
        } else {
          setSurchargeUploadStatus({
            type: "error",
            message: "No valid surcharge rules found in the uploaded file."
          });
        }
      } catch (err: any) {
        console.error("Error parsing surcharge rules", err);
        setSurchargeUploadStatus({
          type: "error",
          message: `Failed to parse Excel file: ${err?.message || "Unknown error"}`
        });
      }
    };
    reader.onerror = () => {
      setSurchargeUploadStatus({
        type: "error",
        message: "Failed to read the file. Please try again."
      });
    };
    reader.readAsBinaryString(file);
  };

  const handleSurchargeDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setSurchargeDragActive(true);
    } else if (e.type === "dragleave") {
      setSurchargeDragActive(false);
    }
  };

  const handleSurchargeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSurchargeDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSurchargeRulesUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSurchargeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleSurchargeRulesUpload(e.target.files[0]);
    }
  };



  const handleUpdateSurchargeRuleField = (ruleId: string, field: keyof SurchargeRule, value: any) => {
    const updated = surchargeRules.map(r => {
      if (r.id === ruleId) {
        return { ...r, [field]: value };
      }
      return r;
    });
    setSurchargeRules(updated);
  };

  const handleRemoveSurchargeRule = (ruleId: string) => {
    setSurchargeRules(surchargeRules.filter(r => r.id !== ruleId));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm mt-6 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-blue-600 animate-spin-slow" />
          <h3 className="text-sm font-bold text-slate-800">{t("Advanced Procurement Settings", lang)}</h3>
        </div>
        <div className="flex bg-slate-200/60 p-0.5 rounded-lg text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab("quotes")}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${activeTab === "quotes" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
          >
            {t("Quotes", lang)}
          </button>
          <button
            onClick={() => setActiveTab("warehouse")}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${activeTab === "warehouse" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
          >
            {t("Rent", lang)}
          </button>
          <button
            onClick={() => setActiveTab("surcharges")}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium whitespace-nowrap ${activeTab === "surcharges" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
          >
            {t("Surcharges", lang)}
          </button>
          <button
            onClick={() => setActiveTab("incoterms")}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium whitespace-nowrap ${activeTab === "incoterms" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
          >
            {t("Incoterms", lang)}
          </button>
          <button
            onClick={() => setActiveTab("rates")}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium whitespace-nowrap ${activeTab === "rates" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
          >
            {t("Rates", lang)}
          </button>
          <button
            onClick={() => setActiveTab("pullforward")}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium whitespace-nowrap ${activeTab === "pullforward" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
          >
            {t("MCQ Pull-Forward", lang)}
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* TAB 1: Shipping Quotes */}
        {activeTab === "quotes" && (
          <div className="space-y-4">
            {/* Global Exchange Rates Settings */}
            <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border border-blue-100 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins size={16} className="text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {t("Global Exchange Rates (THB per Currency)", lang)}
                  </h4>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {t("Rates automatically applied to foreign currency items & quotes", lang)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {(activeCurrencies && activeCurrencies.length > 0 ? activeCurrencies : Object.keys(exchangeRates)).map(curr => {
                  const isExtracted = prExtractedCurrencies?.[curr];
                  const currentRate = exchangeRates[curr] ?? (curr === "USD" ? 33.5581 : curr === "EUR" ? 38.0 : curr === "HKD" ? 4.5 : 1.0);
                  return (
                    <div key={curr} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                          {curr} (THB per {curr})
                        </label>
                        {isExtracted && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0"
                            title={t("Extracted from uploaded PR data (Buy Rate On PR Date)", lang)}
                          >
                            <Sparkles size={10} className="text-amber-600" />
                            {t("Buy Rate On PR Date", lang)}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          value={currentRate}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setExchangeRates({
                              ...exchangeRates,
                              [curr]: isNaN(val) ? 0 : val
                            });
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-xs text-slate-600 leading-relaxed flex gap-2.5 shadow-sm">
              <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>{t("FCL & LCL Quotes Import & Tariffs:", lang)}</strong> {t("Import shipping quotes for all countries directly from an Excel sheet. The engine will automatically parse columns, convert foreign currencies to THB, and calculate precise landed costs.", lang)}
              </div>
            </div>

            {/* Excel Uploader drag-and-drop area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col items-center justify-center min-h-[140px] cursor-pointer ${
                    dragActive ? "border-blue-500 bg-blue-50/50" : "border-slate-300 hover:border-slate-400 bg-white"
                  }`}
                  onClick={() => fileInputRefQuotes.current?.click()}
                >
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRefQuotes}
                    onChange={handleChangeFile}
                    accept=".xlsx,.xls"
                  />
                  <Upload size={24} className="text-blue-500 mb-2" />
                  <span className="text-xs font-bold text-slate-700 block mb-1">
                    {lang === "TH" ? "ลากและวางไฟล์ตารางใบเสนอราคา (.xlsx)" : "Drag & drop quotes Excel file (.xlsx)"}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {lang === "TH" ? "คลิกเพื่อเลือกไฟล์จากเครื่องคอมพิวเตอร์ของคุณ" : "or click to browse from your device"}
                  </span>
                </div>

                {uploadStatus.type && (
                  <div className={`mt-3 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    uploadStatus.type === "success" 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}>
                    <Info size={15} className={uploadStatus.type === "success" ? "text-emerald-600" : "text-red-600"} />
                    <span className="font-semibold">{uploadStatus.message}</span>
                  </div>
                )}
              </div>

              {/* Template & Preset Actions */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between">
                <div>
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t("Excel Format Requirements", lang)}
                  </h5>
                  <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
                    {t("Your Excel file must contain these exact headers:", lang)}
                  </p>
                  <div className="font-mono text-[9px] bg-white p-2 rounded-lg border border-slate-200 space-y-1 text-slate-600">
                    <div className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="font-bold">Ship From</span>
                      <span>Taiwan, MM</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="font-bold">Container Load</span>
                      <span>FCL, LCL</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="font-bold">Container Size</span>
                      <span>20ft, 40ft/40HQ (FCL)</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="font-bold">Payment Type</span>
                      <span>Container, Shipment, CBM</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Amount, Currency</span>
                      <span className="font-normal text-slate-500">e.g., 1750, USD</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={handleExportTemplate}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-[10px] py-2 px-1 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Download size={11} /> {t("Template", lang)}
                  </button>
                  <button
                    onClick={handleLoadPresetSample}
                    className="bg-white hover:bg-slate-50 text-blue-600 border border-blue-200 font-semibold text-[10px] py-2 px-1 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <RotateCcw size={11} /> {t("Sample", lang)}
                  </button>
                </div>
              </div>
            </div>

            {/* Imported Quotes Viewer */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs mt-4">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {t("Active Imported Quotes", lang)} ({importedFclQuotes.length})
                  </h4>
                </div>
                {importedFclQuotes.length > 0 && (
                  <button
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: lang === "TH" ? "ล้างข้อมูลทั้งหมด" : "Clear All Imported Quotes",
                        message: lang === "TH" ? "คุณแน่ใจหรือไม่ที่จะล้างใบเสนอราคาที่นำเข้าทั้งหมด?" : "Are you sure you want to delete all imported shipping quotes?",
                        onConfirm: () => {
                          setImportedFclQuotes([]);
                          setUploadStatus({ type: null, message: "" });
                        }
                      });
                    }}
                    className="text-red-600 hover:text-red-700 text-xs font-semibold cursor-pointer transition flex items-center gap-1"
                  >
                    <Trash2 size={13} />
                    {t("Clear All", lang)}
                  </button>
                )}
              </div>

              {importedFclQuotes.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  {lang === "TH" ? "ไม่มีใบเสนอราคาในระบบ อัปโหลดไฟล์ Excel เพื่อเพิ่มข้อมูล" : "No shipping quotes loaded. Import an Excel file above to load quotes."}
                </div>
              ) : (
                <div className="flex flex-col">
                  {/* Tabs */}
                  <div className="flex border-b border-slate-200">
                    <button
                      onClick={() => setActiveQuotesTab("FCL")}
                      className={`flex-1 py-2 text-xs font-bold transition ${activeQuotesTab === "FCL" ? "bg-white text-blue-600 border-b-2 border-blue-600" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
                    >
                      FCL Quotes
                    </button>
                    <button
                      onClick={() => setActiveQuotesTab("LCL")}
                      className={`flex-1 py-2 text-xs font-bold transition ${activeQuotesTab === "LCL" ? "bg-white text-blue-600 border-b-2 border-blue-600" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
                    >
                      LCL Quotes
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    {/* LCL Table */}
                    {activeQuotesTab === "LCL" && (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">{t("Origin (Ship From)", lang)}</th>
                            <th className="p-2.5">{t("Expense Type", lang)}</th>
                            <th className="p-2.5">{t("Payment Type", lang)}</th>
                            <th className="p-2.5 text-right">{t("Original Amount", lang)}</th>
                            <th className="p-2.5 text-right">{t("Amount in THB", lang)}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {importedFclQuotes.filter(q => q.containerLoad === "LCL").map((q, idx) => {
                            const qCurr = (q.currency || "USD").toUpperCase().trim();
                            const rate = q.currency === "THB" ? 1.0 : (exchangeRates[qCurr] ?? exchangeRates["USD"] ?? 35.0);
                            const thbAmount = q.amount * rate;
                            return (
                              <tr key={q.id || idx} className="hover:bg-slate-50/50 transition">
                                <td className="p-2.5">
                                  <span className="font-bold text-slate-800">{q.shipFrom}</span>
                                </td>
                                <td className="p-2.5">
                                  <span className="text-slate-500 font-mono text-[10px]">{q.expenseType}</span>
                                </td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                                    q.paymentType === "BY SHIPMENT" 
                                      ? "bg-amber-50 text-amber-700 border border-amber-100" 
                                      : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                  }`}>
                                    {q.paymentType}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-mono text-slate-600">
                                  {q.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {q.currency}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                  {Math.round(thbAmount).toLocaleString()} THB
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    {/* FCL Table */}
                    {activeQuotesTab === "FCL" && (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">{t("Origin (Ship From)", lang)}</th>
                            <th className="p-2.5">{t("Container Size", lang)}</th>
                            <th className="p-2.5">{t("Expense Type", lang)}</th>
                            <th className="p-2.5">{t("Payment Type", lang)}</th>
                            <th className="p-2.5 text-right">{t("Original Amount", lang)}</th>
                            <th className="p-2.5 text-right">{t("Amount in THB", lang)}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {importedFclQuotes.filter(q => q.containerLoad !== "LCL").map((q, idx) => {
                            const qCurr = (q.currency || "USD").toUpperCase().trim();
                            const rate = q.currency === "THB" ? 1.0 : (exchangeRates[qCurr] ?? exchangeRates["USD"] ?? 35.0);
                            const thbAmount = q.amount * rate;
                            return (
                              <tr key={q.id || idx} className="hover:bg-slate-50/50 transition">
                                <td className="p-2.5">
                                  <span className="font-bold text-slate-800">{q.shipFrom}</span>
                                </td>
                                <td className="p-2.5">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 font-mono">
                                    {q.containerSize}ft
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  <span className="text-slate-500 font-mono text-[10px]">{q.expenseType}</span>
                                </td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                                    q.paymentType === "BY SHIPMENT" 
                                      ? "bg-amber-50 text-amber-700 border border-amber-100" 
                                      : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                  }`}>
                                    {q.paymentType === "BY SHIPMENT" ? t("By Shipment", lang) : t("By Container", lang)}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-mono text-slate-600">
                                  {q.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {q.currency}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                  {Math.round(thbAmount).toLocaleString()} THB
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* TAB 2: Warehouse Delay & Currency Rent */}
      {activeTab === "warehouse" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-[11px] text-slate-600 leading-relaxed">
            <strong>{t("Warehouse Delay (Port Rent):", lang)}</strong> {t("Simulate unexpected congestion. Delayed containers accrue rent at the Port Warehouse daily, which is added directly to local landed costs.", lang)}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {t("Port Delay (Days)", lang)}
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={warehouseStuckDays}
                  onChange={(e) => setWarehouseStuckDays(parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {t("Previously Existing Containers", lang)}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={prevExistingInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // allow empty or digits only while typing
                    if (raw === "" || /^\d*$/.test(raw)) {
                      setPrevExistingInput(raw);
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseInt(prevExistingInput || "0", 10);
                    const safe = isNaN(parsed) ? 0 : Math.max(0, parsed);
                    setPrevExistingInput(String(safe));
                    setPreviouslyExistingContainers && setPreviouslyExistingContainers(safe);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {recommendedFleetSuggestion && (
                <div className="col-span-2 mt-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">{t("Recommended Fleet Suggestion", lang)}</div>
                  <div className="mt-2 text-sm text-slate-700">
                    <div>{recommendedFleetSuggestion.scenarioName} • {recommendedFleetSuggestion.numShipments} {recommendedFleetSuggestion.numShipments === 1 ? t("leg", lang) : t("legs", lang)}</div>
                    <div className="mt-1 text-[13px] font-mono">
                      {recommendedFleetSuggestion.combination.num40hq > 0 && <span className="mr-3">{recommendedFleetSuggestion.combination.num40hq}x 40HQ</span>}
                      {recommendedFleetSuggestion.combination.num40gp > 0 && <span className="mr-3">{recommendedFleetSuggestion.combination.num40gp}x 40ft</span>}
                      {recommendedFleetSuggestion.combination.num20gp > 0 && <span className="mr-3">{recommendedFleetSuggestion.combination.num20gp}x 20ft</span>}
                      {recommendedFleetSuggestion.combination.numLcl > 0 && <span className="mr-3">LCL</span>}
                    </div>
                    <div className="mt-2 text-[12px] text-slate-600">
                      {t("Total suggested containers", lang)}: <strong className="ml-2">{recommendedFleetSuggestion.totalSuggestedContainers}</strong>
                      <span className="ml-4">{t("Newly subject to rent", lang)}: <strong className="ml-2">{recommendedFleetSuggestion.newlySuggestedContainers}</strong></span>
                    </div>
                    <div className="mt-1 text-[12px] text-slate-600">{t("New container rent exposure", lang)}: <strong className="ml-2">{recommendedFleetSuggestion.newlySuggestedContainerDays}</strong> {t("container-days", lang)}</div>
                  </div>
                </div>
              )}
              <div className="flex items-end text-[10px] text-slate-400 pb-1.5">
                <span>{t("Delayed containers accrue size-specific rent below daily.", lang)}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 mt-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                {t("Daily Warehouse Rent Rates (THB / Day)", lang)}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">
                    {t("20ft Rent", lang)}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={warehouseDailyRent.gp20}
                    onChange={(e) => setWarehouseDailyRent({
                      ...warehouseDailyRent,
                      gp20: parseInt(e.target.value) || 0
                    })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">
                    {t("40ft Rent", lang)}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={warehouseDailyRent.gp40}
                    onChange={(e) => setWarehouseDailyRent({
                      ...warehouseDailyRent,
                      gp40: parseInt(e.target.value) || 0
                    })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">
                    {t("40HQ Rent", lang)}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={warehouseDailyRent.hq40}
                    onChange={(e) => setWarehouseDailyRent({
                      ...warehouseDailyRent,
                      hq40: parseInt(e.target.value) || 0
                    })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1">
                    {t("LCL (< 19 CBM) Rent per CBM", lang)}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={warehouseDailyRent.lcl}
                    onChange={(e) => setWarehouseDailyRent({
                      ...warehouseDailyRent,
                      lcl: parseInt(e.target.value) || 0
                    })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* TAB 5: Surcharge Rules Settings */}
        {activeTab === "surcharges" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-violet-50 border border-violet-100 p-4 rounded-xl text-[11px] text-slate-600 leading-relaxed flex gap-3 shadow-sm">
              <ShieldAlert className="text-violet-600 shrink-0 mt-0.5" size={16} />
              <div className="space-y-1">
                <strong className="text-violet-900 font-bold block text-xs">{t("Dynamic Surcharge Rules Engine", lang)}</strong>
                <p>
                  {t("Configure dynamic surcharges for shipments based on your specific vendor agreements. Upload an Excel or CSV spreadsheet containing your surcharge structure, or configure individual rules manually. Rules are matched dynamically against items in each shipment based on the highest specificity score.", lang)}
                </p>
                <ul className="list-disc pl-4 mt-2 space-y-1 text-slate-500">
                  <li><strong>{t("Blank Fields", lang)}</strong>: {t("Act as wildcards and apply to all items/colors/sizes under that customer/vendor.", lang)}</li>
                  <li><strong>{t("Other colour", lang)}</strong>: {t("Matches all colors except BLACK.", lang)}</li>
                  <li><strong>{t("Range check (Min, Max)", lang)}</strong>: {t("Surcharges are evaluated per shipment. Surcharges apply if the shipment volume/value falls within the [Min, Max] range.", lang)}</li>
                </ul>
              </div>
            </div>

            {/* Importer & Download block */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                onDragEnter={handleSurchargeDrag}
                onDragOver={handleSurchargeDrag}
                onDragLeave={handleSurchargeDrag}
                onDrop={handleSurchargeDrop}
                className={`md:col-span-2 border-2 border-dashed rounded-xl p-5 text-center transition-all flex flex-col items-center justify-center min-h-[140px] ${
                  surchargeDragActive ? "border-violet-500 bg-violet-50/50" : "border-slate-300 hover:border-slate-400 bg-white"
                }`}
              >
                <input 
                  ref={fileInputRefSurcharge}
                  type="file" 
                  accept=".csv, .xlsx, .xls"
                  onChange={handleSurchargeFileSelect}
                  className="hidden"
                />
                <div className="bg-violet-50 text-violet-600 p-3 rounded-full mb-2.5">
                  <Upload size={20} />
                </div>
                <p className="text-xs font-bold text-slate-700">
                  {lang === "TH" ? "ลากและวางไฟล์กฎค่าธรรมเนียม (.xlsx, .xls, .csv)" : "Drag & drop surcharge rules file (.xlsx, .xls, .csv)"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 mb-3">
                  {lang === "TH" ? "หรือ คลิกเพื่อเลือกไฟล์จากอุปกรณ์ของคุณ" : "or click to browse your files"}
                </p>
                <button
                  onClick={() => fileInputRefSurcharge.current?.click()}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {lang === "TH" ? "เลือกไฟล์" : "Select File"}
                </button>
                
                {surchargeUploadStatus.type && (
                  <div className={`mt-3 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    surchargeUploadStatus.type === "success" 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}>
                    <Info size={15} className={surchargeUploadStatus.type === "success" ? "text-emerald-600" : "text-red-600"} />
                    <span className="font-semibold text-left">{surchargeUploadStatus.message}</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileSpreadsheet size={14} className="text-slate-500" />
                    {t("Surcharge Template", lang)}
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {t("Download our official CSV spreadsheet template to structure your customer, vendor, and color surcharge rules perfectly before importing.", lang)}
                  </p>
                </div>
                <button
                  onClick={handleDownloadSampleSurcharges}
                  className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer mt-3"
                >
                  <Download size={13} />
                  {t("Download Template", lang)}
                </button>
              </div>
            </div>



            {/* Editable Rules Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-violet-600" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {t("Active Surcharge Rules", lang)} ({surchargeRules.length})
                  </h4>
                </div>
                {surchargeRules.length > 0 && (
                  <button
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: lang === "TH" ? "ล้างกฎทั้งหมด" : "Clear All Rules",
                        message: lang === "TH" ? "คุณแน่ใจหรือไม่ว่าต้องการล้างกฎทั้งหมด?" : "Are you sure you want to delete all loaded surcharge rules?",
                        onConfirm: () => {
                          setSurchargeRules([]);
                          setSurchargeUploadStatus({ type: null, message: "" });
                        }
                      });
                    }}
                    className="text-red-600 hover:text-red-700 text-xs font-semibold cursor-pointer transition flex items-center gap-1"
                  >
                    <Trash2 size={13} />
                    {t("Clear All", lang)}
                  </button>
                )}
              </div>

              {surchargeRules.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  {lang === "TH" ? "ไม่มีกฎค่าธรรมเนียมที่ใช้งานอยู่ นำเข้าไฟล์หรือเพิ่มด้วยตนเองเพื่อเริ่มต้น" : "No active surcharge rules loaded. Import a file or add manually to get started."}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100/80 text-slate-500 font-bold uppercase text-[9px] sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 whitespace-nowrap min-w-[90px]">{t("Cust. Code", lang)}</th>
                        <th className="p-2.5 whitespace-nowrap min-w-[120px]">{t("Vendor Code", lang)}</th>
                        <th className="p-2.5 whitespace-nowrap min-w-[140px]">{t("SL Description", lang)}</th>
                        <th className="p-2.5 whitespace-nowrap min-w-[100px]">{t("Colour", lang)}</th>
                        <th className="p-2.5 whitespace-nowrap min-w-[70px]">{t("Size", lang)}</th>
                        <th className="p-2.5 whitespace-nowrap min-w-[75px]">{t("Qty/Amt", lang)}</th>
                        <th className="p-2.5 whitespace-nowrap min-w-[75px]">{t("Min", lang)}</th>
                        <th className="p-2.5 whitespace-nowrap min-w-[75px]">{t("Max", lang)}</th>
                        <th className="p-2.5 whitespace-nowrap min-w-[140px]">{t("Surcharge Type", lang)}</th>
                        <th className="p-2.5 whitespace-nowrap min-w-[80px]">{t("Amount", lang)}</th>
                        <th className="p-2.5 whitespace-nowrap min-w-[65px]">{t("Curr", lang)}</th>
                        <th className="p-2.5 text-center min-w-[45px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {surchargeRules.map(rule => (
                        <tr key={rule.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={rule.customerCodeRaw || ""}
                              placeholder="Any"
                              onChange={e => handleUpdateSurchargeRuleField(rule.id, "customerCodeRaw", e.target.value || undefined)}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-violet-500 px-1.5 py-1 rounded text-slate-700"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={rule.vendorCode || ""}
                              placeholder="Any"
                              onChange={e => handleUpdateSurchargeRuleField(rule.id, "vendorCode", e.target.value || undefined)}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-violet-500 px-1.5 py-1 rounded text-slate-700"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={rule.itemDescription || ""}
                              placeholder="Any"
                              onChange={e => handleUpdateSurchargeRuleField(rule.id, "itemDescription", e.target.value || undefined)}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-violet-500 px-1.5 py-1 rounded text-slate-700 truncate"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={rule.color || ""}
                              placeholder="Any"
                              onChange={e => handleUpdateSurchargeRuleField(rule.id, "color", e.target.value || undefined)}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-violet-500 px-1.5 py-1 rounded text-slate-700"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={rule.size || ""}
                              placeholder="Any"
                              onChange={e => handleUpdateSurchargeRuleField(rule.id, "size", e.target.value || undefined)}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-violet-500 px-1.5 py-1 rounded text-slate-700"
                            />
                          </td>
                          <td className="p-1.5">
                            <select
                              value={rule.qtyOrAmount}
                              onChange={e => handleUpdateSurchargeRuleField(rule.id, "qtyOrAmount", e.target.value as "Qty" | "Amount")}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-violet-500 px-1 py-1 rounded text-slate-700"
                            >
                              <option value="Qty">Qty</option>
                              <option value="Amount">Amount</option>
                            </select>
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              value={rule.min === undefined ? "" : rule.min}
                              placeholder="0"
                              onChange={e => handleUpdateSurchargeRuleField(rule.id, "min", e.target.value === "" ? undefined : Number(e.target.value))}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-violet-500 px-1 py-1 rounded text-slate-700 font-mono"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              value={rule.max === undefined ? "" : rule.max}
                              placeholder="Infinity"
                              onChange={e => handleUpdateSurchargeRuleField(rule.id, "max", e.target.value === "" ? undefined : Number(e.target.value))}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-violet-500 px-1 py-1 rounded text-slate-700 font-mono"
                            />
                          </td>
                          <td className="p-1.5">
                            <select
                              value={rule.surchargeType}
                              onChange={e => handleUpdateSurchargeRuleField(rule.id, "surchargeType", e.target.value)}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-violet-500 px-1 py-1 rounded text-slate-700"
                            >
                              <option value="USD/Color">USD/Color</option>
                              <option value="% of Unit Price/Color">% of Unit Price/Color</option>
                              <option value="USD/PO">USD/PO</option>
                              <option value="USD/Color/Unit">USD/Color/Unit</option>
                            </select>
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              step="any"
                              value={rule.amount}
                              onChange={e => handleUpdateSurchargeRuleField(rule.id, "amount", parseFloat(e.target.value) || 0)}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-violet-500 px-1 py-1 rounded text-slate-700 font-mono font-bold"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={rule.currency}
                              onChange={e => handleUpdateSurchargeRuleField(rule.id, "currency", e.target.value || "USD")}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-violet-500 px-1 py-1 rounded text-slate-700 font-bold uppercase"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              onClick={() => handleRemoveSurchargeRule(rule.id)}
                              className="text-red-500 hover:text-red-700 transition cursor-pointer p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* TAB 6: Incoterms Settings */}
        {activeTab === "incoterms" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-[11px] text-slate-600 leading-relaxed space-y-3 shadow-sm">
              <div className="flex gap-3">
                <Ship className="text-blue-600 shrink-0 mt-0.5" size={16} />
                <div className="space-y-1">
                  <strong className="text-blue-900 font-bold block text-xs">{t("Incoterm Mapping", lang)}</strong>
                  <p>
                    {t("Map Vendor Codes and Origins to specific Incoterms (FOB, EXW, CIF, DDP, CFR, FCA). This mapping determines which parts of the shipping cost are paid by us versus the vendor, as explained in the reference table below:", lang)}
                  </p>
                </div>
              </div>
              <div className="pl-7">
                {renderIncotermsTable(lang)}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t("Active Incoterm Rules", lang)}</h4>
                <button
                  onClick={() => setIncotermRules(prev => [{
                    id: `inc_${Date.now()}`,
                    vendorCode: "",
                    shipFrom: "Taiwan Keelung",
                    incoterm: "FOB",
                    source: "manual"
                  }, ...prev])}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
                >
                  <Plus size={12} />
                  {t("Add Rule", lang)}
                </button>
              </div>
              
              {incotermRules.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {t("No incoterm rules defined.", lang)}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead className="bg-slate-100 text-slate-500 uppercase font-bold sticky top-0 z-10 shadow-xs">
                      <tr>
                        <th className="p-2 w-1/4">{t("Vendor Code", lang)}</th>
                        <th className="p-2 w-1/4">{t("Ship From", lang)}</th>
                        <th className="p-2 w-1/4">{t("Incoterm", lang)}</th>
                        <th className="p-2 w-[15%]">{t("Source", lang)}</th>
                        <th className="p-2 w-[10%] text-center">{t("Action", lang)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {incotermRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-blue-50/50 transition">
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={rule.vendorCode}
                              placeholder="Any"
                              onChange={e => {
                                setIncotermRules(prev => prev.map(r => r.id === rule.id ? { ...r, vendorCode: e.target.value, source: "manual" } : r));
                              }}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-blue-500 px-2 py-1 rounded text-slate-700"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={rule.shipFrom}
                              onChange={e => {
                                setIncotermRules(prev => prev.map(r => r.id === rule.id ? { ...r, shipFrom: e.target.value, source: "manual" } : r));
                              }}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-blue-500 px-2 py-1 rounded text-slate-700"
                            />
                          </td>
                          <td className="p-1.5">
                            <select
                              value={rule.incoterm}
                              onChange={e => {
                                setIncotermRules(prev => prev.map(r => r.id === rule.id ? { ...r, incoterm: e.target.value, source: "manual" } : r));
                              }}
                              className="w-full bg-transparent border-0 hover:bg-slate-100/80 focus:bg-white focus:ring-1 focus:ring-blue-500 px-1 py-1 rounded text-slate-700 font-bold"
                            >
                              <option value="FOB">FOB</option>
                              <option value="EXW">EXW</option>
                              <option value="CIF">CIF</option>
                              <option value="DDP">DDP</option>
                              <option value="CFR">CFR</option>
                              <option value="FCA">FCA</option>
                            </select>
                          </td>
                          <td className="p-1.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              rule.source === 'data' ? 'bg-violet-100 text-violet-700' :
                              rule.source === 'default' ? 'bg-slate-200 text-slate-600' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {rule.source}
                            </span>
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              onClick={() => {
                                setIncotermRules(prev => prev.filter(r => r.id !== rule.id));
                              }}
                              className="text-red-500 hover:text-red-700 transition cursor-pointer p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Financial & Inventory Holding Rates */}
        {activeTab === "rates" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-xl text-[11px] text-slate-600 leading-relaxed flex gap-3 shadow-sm">
              <TrendingUp className="text-blue-600 shrink-0 mt-0.5" size={16} />
              <div className="space-y-1">
                <strong className="text-blue-900 font-bold block text-xs">{t("Financial & Inventory Holding Rates", lang)}</strong>
                <p>
                  {t("Configure holding costs and capital opportunity rates used to calculate true landed costs for early shipments.", lang)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50/70 border border-slate-200 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-blue-600" />
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
                <p className="text-[10.5px] text-slate-400 font-mono mt-1">
                  {t("Used as: (Value ÷ 2) × Rate × (Days Early / 365)", lang)}
                </p>
              </div>

              <div className="bg-slate-50/70 border border-slate-200 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Coins size={14} className="text-emerald-600" />
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
                <p className="text-[10.5px] text-slate-400 font-mono mt-1">
                  {t("Used as: Value × [ (1 + Rate)^(Days Early / 365) − 1 ]", lang)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Enable MCQ Pull Forward */}
        {activeTab === "pullforward" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl text-[11px] text-slate-600 leading-relaxed flex gap-3 shadow-sm">
              <Sparkles className="text-indigo-600 shrink-0 mt-0.5" size={16} />
              <div className="space-y-1">
                <strong className="text-indigo-900 font-bold block text-xs">{t("MCQ Pull-Forward Optimization", lang)}</strong>
                <p>
                  {t("When enabled, the optimizer automatically consolidates color rolls from later weeks into earlier shipments to resolve MOQ/MCQ gaps and eliminate surcharges.", lang)}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enablePullForward}
                  id="enable-mcq-pull-forward-adv"
                  onChange={(e) => setEnablePullForward(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="space-y-1">
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    {t("Enable MCQ Pull-Forward Optimization", lang)}
                    {enablePullForward && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                        {t("Active", lang)}
                      </span>
                    )}
                  </span>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {t("Automatically pulls later PR entries forward into earlier shipments when a color is below MOQ/MCQ threshold, consolidating shipment lots and avoiding small-lot surcharges.", lang)}
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Custom Confirmation Dialog Modal (Iframe-Safe & Fluent UI Design) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="bg-red-50 text-red-600 p-2.5 rounded-full shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition"
              >
                {lang === "TH" ? "ยกเลิก" : "Cancel"}
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition shadow-sm"
              >
                {lang === "TH" ? "ยืนยัน" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function parseQuotesExcel(fileBuffer: ArrayBuffer): ImportedFclQuote[] {
  const workbook = XLSX.read(fileBuffer, { type: "array" });
  const parsedQuotes: ImportedFclQuote[] = [];

  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

    rawData.forEach((row, index) => {
      const getVal = (possibleKeys: string[]): any => {
        for (const key of Object.keys(row)) {
          const normKey = key.toUpperCase().trim().replace(/[\s_-]+/g, "");
          if (possibleKeys.some(pk => pk.toUpperCase().trim().replace(/[\s_-]+/g, "") === normKey)) {
            return row[key];
          }
        }
        return undefined;
      };

      const sheetUpper = sheetName.toUpperCase();
      const defaultLoad = sheetUpper.includes("LCL") ? "LCL" : "FCL";
      const containerLoad = String(getVal(["Container Load", "LoadType", "Load"]) || defaultLoad).trim();
      
      // Size can be 20, 40, "20ft", "40ft", "40 HQ", etc.
      let containerSize = 40;
      const sizeStr = String(getVal(["Container Size", "Size", "ContainerSize"]) || "").toUpperCase();
      if (sizeStr.includes("20")) {
        containerSize = 20;
      } else if (sizeStr.includes("40")) {
        containerSize = 40;
      }

      const shipFrom = String(getVal(["Ship From", "Origin", "Route"]) || "").trim();
      const expenseType = String(getVal(["Expense Type", "Expense", "CostType"]) || "").trim().toUpperCase();
      
      // Payment type: "BY CONTAINER" or "BY SHIPMENT" or "BY CBM" — and for
      // "BY CBM", the source may specify a tiered bracket like
      // "BY CBM (1-4)" or "BY CBM (11-14)". That bracket must be preserved,
      // not discarded: several such tiers commonly appear for the same
      // ship-from/expense combination (e.g. one row per CBM bracket), and
      // if they're all collapsed into the same generic "BY CBM" payment
      // type, downstream cost calculation has no way to tell they're
      // mutually-exclusive brackets — it ends up applying every bracket's
      // rate at once and summing them, wildly overcharging.
      let paymentType: string = "BY CONTAINER";
      let cbmTierMin: number | undefined;
      let cbmTierMax: number | undefined;
      const payTypeStr = String(getVal(["Payment Type", "Payment", "Unit"]) || "").toUpperCase();
      if (payTypeStr.includes("SHIPMENT")) {
        paymentType = "BY SHIPMENT";
      } else if (payTypeStr.includes("CBM")) {
        paymentType = "BY CBM";
        const tierMatch = payTypeStr.match(/\(\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\)/);
        if (tierMatch) {
          cbmTierMin = parseFloat(tierMatch[1]);
          cbmTierMax = parseFloat(tierMatch[2]);
        }
      }

      const amount = parseFloat(String(getVal(["Amount", "Rate", "Price"]) || "0").replace(/,/g, "")) || 0;
      const currency = String(getVal(["Currency", "Curr"]) || "USD").trim().toUpperCase();

      if (shipFrom) {
        parsedQuotes.push({
          id: `imported-${sheetName}-${index}-${Date.now()}`,
          containerLoad,
          containerSize,
          shipFrom,
          expenseType,
          paymentType,
          amount,
          currency,
          cbmTierMin,
          cbmTierMax
        });
      }
    });
  });

  return parsedQuotes;
}
