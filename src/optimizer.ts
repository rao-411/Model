import { PrEntry, ContainerConfig, ContainerOverride, RouteConfig, ScenarioDef, ShipmentGroup, ProcessedScenario, MoqAlert, ErrorFlag, ShippingQuote, RouteQuote, ExcessMcqOverride, WarehouseRentConfig, SurchargeRule, ImportedFclQuote, IncotermRule, LoadingDateRule } from "./types";
import { getDefaultImportedFclQuotes } from "./defaultFclQuotes";

export const getDaysDifference = (d1: Date, d2: Date) => {
  const d1Copy = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const d2Copy = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((d1Copy.getTime() - d2Copy.getTime()) / (1000 * 60 * 60 * 24));
};

export function getImportedShipFrom(prId: string, baseShipFrom: string): string {
  const requisition = String(prId || "").trim();
  const startsWith2 = requisition.startsWith("2");
  const base = (baseShipFrom || "").toUpperCase().trim();

  if (base.includes("TAIWAN") || base.includes("KEELUNG")) {
    return startsWith2 ? "Taiwan Keelung to MM" : "Taiwan Keelung";
  } else if (base.includes("BUSAN") || base.includes("KOREA") || base.includes("KR")) {
    return startsWith2 ? "Korea Busan to MM" : "Korea Busan";
  } else if (base.includes("ITALY") || base.includes("LA SPEZIA")) {
    return "Italy";
  } else if (base.includes("HCM") || base.includes("VIETNAM") || base.includes("VN")) {
    return startsWith2 ? "Vietnam to MM" : "Vietnam";
  } else if (base.includes("HONG KONG") || base.includes("HK")) {
    return startsWith2 ? "Hong Kong to MM" : "Hong Kong";
  } else if (base.includes("SHANGHAI") || base.includes("CHINA")) {
    return startsWith2 ? "China Shanghai to MM" : "China Shanghai";
  }

  // Fallback for any ship-from location not in the known-port list above
  // (e.g. "Japan Osaka to MM", "Sweden", or any future new origin introduced
  // by a vendor/quote upload). Some source systems already bake a "to MM"
  // suffix into the raw ship-from string itself, so for a requisition whose
  // id starts with "2" we must NOT blindly append " to MM" again -- doing so
  // previously produced a doubled string (e.g. "Japan Osaka to MM to MM")
  // that could never match any uploaded quote row's shipFrom. That silent
  // mismatch made the app fall back to un-quoted default route costs, which
  // don't know about Incoterms at all (so e.g. CIF freight was never zeroed
  // out) and don't use the vendor's actual per-shipment LOCAL / BROKERAGE
  // quote amounts. Stripping any existing "to MM" suffix first and
  // re-applying it exactly once keeps this idempotent regardless of whether
  // the raw source data already included it.
  const trimmedBase = (baseShipFrom || "").trim();
  const toMmSuffixMatch = trimmedBase.match(/\s+to\s+mm\s*$/i);
  const strippedBase = toMmSuffixMatch
    ? trimmedBase.slice(0, trimmedBase.length - toMmSuffixMatch[0].length).trim()
    : trimmedBase;
  const alreadyToMm = !!toMmSuffixMatch;

  if (startsWith2 || alreadyToMm) {
    return `${strippedBase} to MM`;
  }
  return strippedBase;
}

export function getImportedFclCosts(
  shipFromStr: string,
  num20gp: number,
  num40gp: number,
  num40hq: number,
  numShipments: number,
  importedFclQuotes: ImportedFclQuote[],
  exchangeRates: Record<string, number>,
  totalCbm: number = 0,
  isLcl: boolean = false,
  incotermRules?: IncotermRule[],
  weekPrs?: PrEntry[]
): { freight: number, local: number, brokerage: number, exwork: number, determinedIncoterm?: string } {
  let freight = 0;
  let local = 0;
  let brokerage = 0;
  let exwork = 0;

  let determinedIncoterm = "FOB";
  if (weekPrs && weekPrs.length > 0) {
    const getEntryIncoterm = (p: PrEntry): string => {
      if (!incotermRules) return p.incoterm || "FOB";
      const rule = incotermRules.find(r => 
        r.vendorCode.toUpperCase().trim() === p.vendor?.toUpperCase().trim() &&
        (r.shipFrom.toUpperCase().trim() === (p.shipFrom || "").toUpperCase().trim() ||
         r.shipFrom.toUpperCase().trim() === shipFromStr.toUpperCase().trim())
      );
      return rule ? rule.incoterm.toUpperCase().trim() : (p.incoterm || "FOB").toUpperCase().trim();
    };
    const uniqueIncoterms = Array.from(new Set(weekPrs.map(getEntryIncoterm).filter(Boolean)));
    if (uniqueIncoterms.length === 1) {
      determinedIncoterm = uniqueIncoterms[0];
    } else if (uniqueIncoterms.length > 1) {
      determinedIncoterm = "FOB"; // Mixed -> FOB
    }
  }

  const convertToThb = (amount: number, currency: string): number => {
    const curr = (currency || "").toUpperCase().trim();
    if (curr === "THB") return amount;
    if (curr && exchangeRates && exchangeRates[curr] !== undefined && exchangeRates[curr] > 0) {
      return amount * exchangeRates[curr];
    }
    if (curr === "USD") return amount * (exchangeRates["USD"] || 33.5581);
    if (curr === "EUR") return amount * (exchangeRates["EUR"] || 38.0);
    if (curr === "HKD") return amount * (exchangeRates["HKD"] || 4.5);
    return amount;
  };

  const normalizedTargetShipFrom = (shipFromStr || "").toUpperCase().trim();
  const matchingRows = importedFclQuotes.filter(
    row => (row.shipFrom || "").toUpperCase().trim() === normalizedTargetShipFrom &&
           (isLcl ? row.containerLoad === "LCL" : row.containerLoad !== "LCL")
  );

  if (matchingRows.length === 0) {
    return { freight: 0, local: 0, brokerage: 0, exwork: 0, determinedIncoterm };
  }

  // For CBM-tiered brokerage/local/etc. rate cards (e.g. "BY CBM (1-4)",
  // "BY CBM (5-10)", "BY CBM (11-14)", plus a plain untiered "BY CBM" row
  // as the catch-all for anything above the highest bracket), determine
  // per expense type whether some defined bracket already covers this
  // shipment's totalCbm. If so, the untiered fallback row must NOT also
  // apply — it exists specifically for volumes that exceed every defined
  // bracket, not as an additional charge layered on top of whichever
  // bracket matched.
  const tierCoveredExpenseTypes = new Set<string>();
  matchingRows.forEach(row => {
    if (row.paymentType === "BY CBM" && row.cbmTierMin !== undefined && row.cbmTierMax !== undefined) {
      if (totalCbm >= row.cbmTierMin && totalCbm <= row.cbmTierMax) {
        tierCoveredExpenseTypes.add((row.expenseType || "").toUpperCase().trim());
      }
    }
  });

  matchingRows.forEach(row => {
    const expenseType = (row.expenseType || "").toUpperCase().trim();
    
    // Applying Incoterm rules for what parts of the logistics cost we (the buyer) pay:
    // EXW: Buyer pays FREIGHT, EXWORK (Origin Local), LOCAL (Destination Local), BROKERAGE.
    // FCA / FOB: Buyer pays FREIGHT, LOCAL, BROKERAGE. (Vendor pays EXWORK / Origin Local)
    // CFR / CIF: Buyer pays LOCAL, BROKERAGE. (Vendor pays FREIGHT, EXWORK / Origin Local)
    // DDP: Buyer pays nothing. (Vendor pays FREIGHT, EXWORK, LOCAL, BROKERAGE)
    
    if (determinedIncoterm === "DDP") {
      return; // We pay nothing
    }
    
    if (expenseType === "EXWORK") {
      if (determinedIncoterm !== "EXW") {
        return; // Only EXW includes EXWORK charges
      }
    }
    
    if (expenseType === "FREIGHT") {
      if (determinedIncoterm === "CFR" || determinedIncoterm === "CIF") {
        return; // CFR and CIF include Ocean Freight, so we don't pay it
      }
    }

    const isSize20 = row.containerSize === 20;
    const isSize40 = row.containerSize === 40;

    let multiplier = 0;
    let skipRow = false;
    if (row.paymentType === "BY CONTAINER") {
      if (isSize20) {
        multiplier = num20gp;
      } else if (isSize40) {
        multiplier = num40gp + num40hq;
      }
    } else if (row.paymentType === "BY SHIPMENT") {
      multiplier = numShipments;
    } else if (row.paymentType === "BY CBM") {
      if (row.cbmTierMin !== undefined && row.cbmTierMax !== undefined) {
        // Tiered bracket rate: a flat fee that only applies when totalCbm
        // falls within this specific bracket. Multiple such tier rows
        // commonly share the same expense type/ship-from — they are
        // mutually exclusive, NOT additive.
        if (totalCbm >= row.cbmTierMin && totalCbm <= row.cbmTierMax) {
          multiplier = 1; // flat fee, applied once
        } else {
          skipRow = true;
        }
      } else {
        // Untiered "BY CBM" is the catch-all rate for volumes above every
        // defined tier bracket. If some bracket already covers this
        // shipment's CBM for this expense type, this row must not also
        // apply — it would double-charge on top of the matched bracket.
        if (tierCoveredExpenseTypes.has(expenseType)) {
          skipRow = true;
        } else {
          multiplier = totalCbm;
        }
      }
    }

    if (skipRow) return;

    const amountInThb = convertToThb(row.amount, row.currency);
    const totalCost = amountInThb * multiplier;

    if (expenseType === "FREIGHT") {
      freight += totalCost;
    } else if (expenseType === "LOCAL") {
      local += totalCost;
    } else if (expenseType === "EXWORK") {
      exwork += totalCost;
    } else if (expenseType === "BROKERAGE") {
      brokerage += totalCost;
    }
  });

  return { freight, local, brokerage, exwork, determinedIncoterm };
}


// Default route configurations based on the reference cost guidelines
export function getDefaultRouteQuotes(): Record<string, RouteQuote> {
  return {
    "TAIWAN": {
      id: "taiwan-default",
      origin: "Taiwan",
      transitTimeDays: 18,
      
      lclFreightPerCbm: 671.2,
      fcl20Freight: 24163.2,
      fcl40Freight: 46312.8,
      fcl40hqFreight: 46312.8,
      customFreightFees: [],
      
      lclLocalPerCbm: 535,
      lclLocalPerShipment: 1450,
      fcl20LocalThc: 2800,
      fcl20LocalCleaning: 350,
      fcl20LocalEmc: 350,
      fcl40LocalThc: 4200,
      fcl40LocalCleaning: 500,
      fcl40LocalEmc: 350,
      fcl40hqLocalThc: 4200,
      fcl40hqLocalCleaning: 500,
      fcl40hqLocalEmc: 350,
      fclLocalPerShipment: 1800,
      fclLocalPerShipmentDo: 1400,
      fclLocalPerShipmentHandling: 400,
      fcl20ImbalanceSurchargeUsd: 60,
      fcl40ImbalanceSurchargeUsd: 120,
      fcl40hqImbalanceSurchargeUsd: 120,
      customLocalFees: [],
      
      brokerageLclBaseTier1: 1700,
      brokerageLclBaseTier2: 2000,
      brokerageLclBaseTier3: 3000,
      brokerageLclHandlingPerCbm: 80,
      brokerageLclAdmissionPerCbm: 30,
      
      brokerageFcl20Clearance: 4800,
      brokerageFcl20LiftOn: 1650,
      brokerageFcl20Admission: 100,
      brokerageFcl20OverTime: 400,
      brokerageFcl20ExtendPeriod: 500,
      brokerageFcl20FacilitiesUsage: 200,
      brokerageFcl20AdmissionSecond: 238.82,
      brokerageFcl20LiftOff: 600,
      
      brokerageFcl40Clearance: 5700,
      brokerageFcl40LiftOn: 2650,
      brokerageFcl40Admission: 200,
      brokerageFcl40OverTime: 400,
      brokerageFcl40ExtendPeriod: 500,
      brokerageFcl40FacilitiesUsage: 200,
      brokerageFcl40AdmissionSecond: 238.82,
      brokerageFcl40LiftOff: 1200,
      
      brokerageFcl40hqClearance: 5700,
      brokerageFcl40hqLiftOn: 2650,
      brokerageFcl40hqAdmission: 200,
      brokerageFcl40hqOverTime: 400,
      brokerageFcl40hqExtendPeriod: 500,
      brokerageFcl40hqFacilitiesUsage: 200,
      brokerageFcl40hqAdmissionSecond: 238.82,
      brokerageFcl40hqLiftOff: 1200,
      
      customBrokerageFees: [],
      customExworkFees: []
    },
    "ITALY": {
      id: "italy-default",
      origin: "Italy",
      transitTimeDays: 30,
      
      lclFreightPerCbm: 5250, // ~$150 USD/CBM
      fcl20Freight: 17500,
      fcl40Freight: 21000,
      fcl40hqFreight: 21000,
      customFreightFees: [],
      
      lclLocalPerCbm: 850,
      lclLocalPerShipment: 1800,
      fcl20LocalThc: 7675,
      fcl20LocalCleaning: 350,
      fcl20LocalEmc: 350,
      fcl40LocalThc: 11850,
      fcl40LocalCleaning: 500,
      fcl40LocalEmc: 350,
      fcl40hqLocalThc: 11850,
      fcl40hqLocalCleaning: 500,
      fcl40hqLocalEmc: 350,
      fclLocalPerShipment: 1800,
      customLocalFees: [],
      
      brokerageLclBaseTier1: 1700,
      brokerageLclBaseTier2: 2000,
      brokerageLclBaseTier3: 3000,
      brokerageLclHandlingPerCbm: 80,
      brokerageLclAdmissionPerCbm: 30,
      
      brokerageFcl20Clearance: 4800,
      brokerageFcl20LiftOn: 1650,
      brokerageFcl20Admission: 100,
      brokerageFcl20OverTime: 400,
      brokerageFcl20ExtendPeriod: 500,
      brokerageFcl20FacilitiesUsage: 200,
      brokerageFcl20AdmissionSecond: 238.82,
      brokerageFcl20LiftOff: 600,
      
      brokerageFcl40Clearance: 5700,
      brokerageFcl40LiftOn: 2650,
      brokerageFcl40Admission: 200,
      brokerageFcl40OverTime: 400,
      brokerageFcl40ExtendPeriod: 500,
      brokerageFcl40FacilitiesUsage: 200,
      brokerageFcl40AdmissionSecond: 238.82,
      brokerageFcl40LiftOff: 1200,
      
      brokerageFcl40hqClearance: 5700,
      brokerageFcl40hqLiftOn: 2650,
      brokerageFcl40hqAdmission: 200,
      brokerageFcl40hqOverTime: 400,
      brokerageFcl40hqExtendPeriod: 500,
      brokerageFcl40hqFacilitiesUsage: 200,
      brokerageFcl40hqAdmissionSecond: 238.82,
      brokerageFcl40hqLiftOff: 1200,
      
      customBrokerageFees: [],
      customExworkFees: [
        { id: "italy-ex-truck", name: "Italy Ex-Works Trucking (Pickup)", type: "flat", amount: 12000 },
        { id: "italy-ex-customs", name: "Italy Export Customs Clearance", type: "flat", amount: 3800 },
        { id: "italy-ex-handling", name: "Italy Origin Handling Fee", type: "perCbm", amount: 500 }
      ]
    },
    "BUSAN": {
      id: "busan-default",
      origin: "Busan",
      transitTimeDays: 14,
      
      lclFreightPerCbm: 1050,
      fcl20Freight: 28000,
      fcl40Freight: 38500,
      fcl40hqFreight: 38500,
      customFreightFees: [],
      
      lclLocalPerCbm: 750,
      lclLocalPerShipment: 1650,
      fcl20LocalThc: 2800,
      fcl20LocalCleaning: 350,
      fcl20LocalEmc: 350,
      fcl40LocalThc: 4200,
      fcl40LocalCleaning: 500,
      fcl40LocalEmc: 350,
      fcl40hqLocalThc: 4200,
      fcl40hqLocalCleaning: 500,
      fcl40hqLocalEmc: 350,
      fclLocalPerShipment: 1800,
      customLocalFees: [],
      
      brokerageLclBaseTier1: 1700,
      brokerageLclBaseTier2: 2000,
      brokerageLclBaseTier3: 3000,
      brokerageLclHandlingPerCbm: 80,
      brokerageLclAdmissionPerCbm: 30,
      
      brokerageFcl20Clearance: 4800,
      brokerageFcl20LiftOn: 1650,
      brokerageFcl20Admission: 100,
      brokerageFcl20OverTime: 400,
      brokerageFcl20ExtendPeriod: 500,
      brokerageFcl20FacilitiesUsage: 200,
      brokerageFcl20AdmissionSecond: 238.82,
      brokerageFcl20LiftOff: 600,
      
      brokerageFcl40Clearance: 5700,
      brokerageFcl40LiftOn: 2650,
      brokerageFcl40Admission: 200,
      brokerageFcl40OverTime: 400,
      brokerageFcl40ExtendPeriod: 500,
      brokerageFcl40FacilitiesUsage: 200,
      brokerageFcl40AdmissionSecond: 238.82,
      brokerageFcl40LiftOff: 1200,
      
      brokerageFcl40hqClearance: 5700,
      brokerageFcl40hqLiftOn: 2650,
      brokerageFcl40hqAdmission: 200,
      brokerageFcl40hqOverTime: 400,
      brokerageFcl40hqExtendPeriod: 500,
      brokerageFcl40hqFacilitiesUsage: 200,
      brokerageFcl40hqAdmissionSecond: 238.82,
      brokerageFcl40hqLiftOff: 1200,
      
      customBrokerageFees: [],
      customExworkFees: [
        { id: "busan-ex-truck", name: "Busan Ex-Works Trucking", type: "flat", amount: 5000 },
        { id: "busan-ex-customs", name: "Busan Export Customs Clearance", type: "flat", amount: 2500 }
      ]
    },
    "HK": {
      id: "hk-default",
      origin: "Hong Kong",
      transitTimeDays: 7,
      
      lclFreightPerCbm: 175,
      fcl20Freight: 14000,
      fcl40Freight: 19250,
      fcl40hqFreight: 19250,
      customFreightFees: [],
      
      lclLocalPerCbm: 575,
      lclLocalPerShipment: 1450,
      fcl20LocalThc: 2800,
      fcl20LocalCleaning: 350,
      fcl20LocalEmc: 350,
      fcl40LocalThc: 4200,
      fcl40LocalCleaning: 500,
      fcl40LocalEmc: 350,
      fcl40hqLocalThc: 4200,
      fcl40hqLocalCleaning: 500,
      fcl40hqLocalEmc: 350,
      fclLocalPerShipment: 1800,
      customLocalFees: [],
      
      brokerageLclBaseTier1: 1700,
      brokerageLclBaseTier2: 2000,
      brokerageLclBaseTier3: 3000,
      brokerageLclHandlingPerCbm: 80,
      brokerageLclAdmissionPerCbm: 30,
      
      brokerageFcl20Clearance: 4800,
      brokerageFcl20LiftOn: 1650,
      brokerageFcl20Admission: 100,
      brokerageFcl20OverTime: 400,
      brokerageFcl20ExtendPeriod: 500,
      brokerageFcl20FacilitiesUsage: 200,
      brokerageFcl20AdmissionSecond: 238.82,
      brokerageFcl20LiftOff: 600,
      
      brokerageFcl40Clearance: 5700,
      brokerageFcl40LiftOn: 2650,
      brokerageFcl40Admission: 200,
      brokerageFcl40OverTime: 400,
      brokerageFcl40ExtendPeriod: 500,
      brokerageFcl40FacilitiesUsage: 200,
      brokerageFcl40AdmissionSecond: 238.82,
      brokerageFcl40LiftOff: 1200,
      
      brokerageFcl40hqClearance: 5700,
      brokerageFcl40hqLiftOn: 2650,
      brokerageFcl40hqAdmission: 200,
      brokerageFcl40hqOverTime: 400,
      brokerageFcl40hqExtendPeriod: 500,
      brokerageFcl40hqFacilitiesUsage: 200,
      brokerageFcl40hqAdmissionSecond: 238.82,
      brokerageFcl40hqLiftOff: 1200,
      
      customBrokerageFees: [],
      customExworkFees: [
        { id: "hk-ex-truck", name: "Hong Kong Pickup & Trucking", type: "flat", amount: 3000 },
        { id: "hk-ex-customs", name: "Hong Kong Export Customs", type: "flat", amount: 1500 }
      ]
    },
    "HCM": {
      id: "hcm-default",
      origin: "HCM (Vietnam)",
      transitTimeDays: 5,
      
      lclFreightPerCbm: 210,
      fcl20Freight: 10500,
      fcl40Freight: 14000,
      fcl40hqFreight: 14000,
      customFreightFees: [],
      
      lclLocalPerCbm: 740,
      lclLocalPerShipment: 1450,
      fcl20LocalThc: 2800,
      fcl20LocalCleaning: 350,
      fcl20LocalEmc: 350,
      fcl40LocalThc: 4200,
      fcl40LocalCleaning: 500,
      fcl40LocalEmc: 350,
      fcl40hqLocalThc: 4200,
      fcl40hqLocalCleaning: 500,
      fcl40hqLocalEmc: 350,
      fclLocalPerShipment: 1800,
      customLocalFees: [],
      
      brokerageLclBaseTier1: 1700,
      brokerageLclBaseTier2: 2000,
      brokerageLclBaseTier3: 3000,
      brokerageLclHandlingPerCbm: 80,
      brokerageLclAdmissionPerCbm: 30,
      
      brokerageFcl20Clearance: 4800,
      brokerageFcl20LiftOn: 1650,
      brokerageFcl20Admission: 100,
      brokerageFcl20OverTime: 400,
      brokerageFcl20ExtendPeriod: 500,
      brokerageFcl20FacilitiesUsage: 200,
      brokerageFcl20AdmissionSecond: 238.82,
      brokerageFcl20LiftOff: 600,
      
      brokerageFcl40Clearance: 5700,
      brokerageFcl40LiftOn: 2650,
      brokerageFcl40Admission: 200,
      brokerageFcl40OverTime: 400,
      brokerageFcl40ExtendPeriod: 500,
      brokerageFcl40FacilitiesUsage: 200,
      brokerageFcl40AdmissionSecond: 238.82,
      brokerageFcl40LiftOff: 1200,
      
      brokerageFcl40hqClearance: 5700,
      brokerageFcl40hqLiftOn: 2650,
      brokerageFcl40hqAdmission: 200,
      brokerageFcl40hqOverTime: 400,
      brokerageFcl40hqExtendPeriod: 500,
      brokerageFcl40hqFacilitiesUsage: 200,
      brokerageFcl40hqAdmissionSecond: 238.82,
      brokerageFcl40hqLiftOff: 1200,
      
      customBrokerageFees: [],
      customExworkFees: [
        { id: "hcm-ex-truck", name: "HCM Ex-Works Trucking", type: "flat", amount: 3500 },
        { id: "hcm-ex-customs", name: "HCM Export Customs Clearance", type: "flat", amount: 2100 },
        { id: "hcm-ex-handling", name: "HCM Origin LCL Handling", type: "perCbm", amount: 350 }
      ]
    }
  };
}

// Keep legacy RouteConfig and DEFAULT_ROUTES fallback for backward compatibility
export const DEFAULT_ROUTES: Record<string, RouteConfig> = {
  "ITALY": {
    origin: "Italy",
    transitTimeDays: 30,
    lclFreightPerCbm: 0,
    lclLocalPerCbm: 0,
    lclLocalPerShipment: 0,
    fcl20Freight: 17500,
    fcl40Freight: 21000,
    fcl20Local: 7675,
    fcl40Local: 11850,
    fclLocalPerShipment: 0,
    brokerageLclBase: 3000,
    brokerageLclPerCbm: 110,
    brokerageFcl20: 8488.82,
    brokerageFcl40: 11088.82,
    vatApplied: false,
  },
  "BUSAN": {
    origin: "Busan",
    transitTimeDays: 14,
    lclFreightPerCbm: 1050,
    lclLocalPerCbm: 750,
    lclLocalPerShipment: 1650,
    fcl20Freight: 0,
    fcl40Freight: 0,
    fcl20Local: 0,
    fcl40Local: 0,
    fclLocalPerShipment: 0,
    brokerageLclBase: 3000,
    brokerageLclPerCbm: 110,
    brokerageFcl20: 8488.82,
    brokerageFcl40: 11088.82,
    vatApplied: false,
  },
  "HCM": {
    origin: "HCM (Vietnam)",
    transitTimeDays: 5,
    lclFreightPerCbm: 210,
    lclLocalPerCbm: 740,
    lclLocalPerShipment: 1450,
    fcl20Freight: 0,
    fcl40Freight: 0,
    fcl20Local: 0,
    fcl40Local: 0,
    fclLocalPerShipment: 0,
    brokerageLclBase: 3000,
    brokerageLclPerCbm: 110,
    brokerageFcl20: 8488.82,
    brokerageFcl40: 11088.82,
    vatApplied: false,
  },
  "HK": {
    origin: "Hong Kong",
    transitTimeDays: 7,
    lclFreightPerCbm: 175,
    lclLocalPerCbm: 575,
    lclLocalPerShipment: 1450,
    fcl20Freight: 0,
    fcl40Freight: 0,
    fcl20Local: 0,
    fcl40Local: 0,
    fclLocalPerShipment: 0,
    brokerageLclBase: 3000,
    brokerageLclPerCbm: 110,
    brokerageFcl20: 8488.82,
    brokerageFcl40: 11088.82,
    vatApplied: false,
  },
  "TAIWAN": {
    origin: "Taiwan",
    transitTimeDays: 18,
    lclFreightPerCbm: 671.2,
    lclLocalPerCbm: 535,
    lclLocalPerShipment: 1450,
    fcl20Freight: 24163.2,
    fcl40Freight: 46312.8,
    fcl20Local: 3500, // THC 2800 + Cleaning 350 + EMC 350
    fcl40Local: 5050, // THC 4200 + Cleaning 500 + EMC 350
    fclLocalPerShipment: 1800,
    brokerageLclBase: 3000,
    brokerageLclPerCbm: 110,
    brokerageFcl20: 8488.82,
    brokerageFcl40: 11088.82,
    vatApplied: true,
  }
};

export function matchRouteQuote(
  shipFrom: string, 
  customQuotes: RouteQuote[] = [], 
  targetShipmentDate?: string
): RouteQuote {
  const origin = (shipFrom || "").toUpperCase().trim();
  const quotesMap = getDefaultRouteQuotes();
  let key = "TAIWAN"; // Default
  if (origin.includes("ITALY") || origin.includes("LA SPEZIA") || origin.includes("SPEZIA")) {
    key = "ITALY";
  } else if (origin.includes("BUSAN") || origin.includes("KOREA") || origin.includes("KR")) {
    key = "BUSAN";
  } else if (origin.includes("HCM") || origin.includes("HO CHI MINH") || origin.includes("VIETNAM") || origin.includes("VN")) {
    key = "HCM";
  } else if (origin.includes("HONG KONG") || origin.includes("HK")) {
    key = "HK";
  } else if (origin.includes("TAIWAN") || origin.includes("TAIPEI") || origin.includes("KEELUNG") || origin.includes("TW")) {
    key = "TAIWAN";
  }
  
  const defaultQuote = quotesMap[key];

  // Filter customQuotes matching this origin name or the matching default origin name
  const originQuotes = customQuotes.filter(
    q => (q.origin || "").toUpperCase().trim() === origin ||
         (q.origin || "").toUpperCase().trim() === (defaultQuote.origin || "").toUpperCase().trim()
  );

  if (originQuotes.length > 0) {
    if (targetShipmentDate) {
      // Find quotes whose validity period covers targetShipmentDate
      const validQuotes = originQuotes.filter(q => {
        if (q.effectiveDate && q.effectiveDate > targetShipmentDate) {
          return false;
        }
        if (q.expiryDate && q.expiryDate < targetShipmentDate) {
          return false;
        }
        return true;
      });

      if (validQuotes.length > 0) {
        // Prioritize by effectiveDate descending (most specific / latest effective date first)
        // Quotes with dates should be sorted ahead of quotes without dates
        return validQuotes.sort((a, b) => {
          const aEff = a.effectiveDate || "";
          const bEff = b.effectiveDate || "";
          if (aEff && !bEff) return -1;
          if (!aEff && bEff) return 1;
          return bEff.localeCompare(aEff);
        })[0];
      }
    }

    // Fallback to the general quote (which has no effectiveDate and no expiryDate)
    const generalQuote = originQuotes.find(q => !q.effectiveDate && !q.expiryDate);
    if (generalQuote) return generalQuote;

    return originQuotes[0];
  }

  return defaultQuote;
}

export function matchRouteConfig(shipFrom: string): RouteConfig {
  const origin = (shipFrom || "").toUpperCase().trim();
  if (origin.includes("ITALY") || origin.includes("LA SPEZIA") || origin.includes("SPEZIA")) {
    return DEFAULT_ROUTES["ITALY"];
  } else if (origin.includes("BUSAN") || origin.includes("KOREA") || origin.includes("KR")) {
    return DEFAULT_ROUTES["BUSAN"];
  } else if (origin.includes("HCM") || origin.includes("HO CHI MINH") || origin.includes("VIETNAM") || origin.includes("VN")) {
    return DEFAULT_ROUTES["HCM"];
  } else if (origin.includes("HONG KONG") || origin.includes("HK")) {
    return DEFAULT_ROUTES["HK"];
  } else if (origin.includes("TAIWAN") || origin.includes("TAIPEI") || origin.includes("KEELUNG") || origin.includes("TW")) {
    return DEFAULT_ROUTES["TAIWAN"];
  }

  return {
    origin: shipFrom || "Other",
    transitTimeDays: 10,
    lclFreightPerCbm: 400,
    lclLocalPerCbm: 500,
    lclLocalPerShipment: 1200,
    fcl20Freight: 20000,
    fcl40Freight: 35000,
    fcl20Local: 6000,
    fcl40Local: 10000,
    fclLocalPerShipment: 1500,
    brokerageLclBase: 3000,
    brokerageLclPerCbm: 110,
    brokerageFcl20: 8488.82,
    brokerageFcl40: 11088.82,
    vatApplied: false,
  };
}

/**
 * Calculate the exact freight, local, and brokerage costs based on route tariffs.
 */
export function calculateRouteCosts(
  shipFrom: string,
  totalCbm: number,
  numShipments: number,
  container: ContainerConfig,
  routeQuote: RouteQuote,
  exchangeRates: Record<string, number> = {USD:35.0}
): { freight: number, local: number, brokerage: number, exwork: number, vatApplied: boolean } {
  if (totalCbm <= 0) {
    return { freight: 0, local: 0, brokerage: 0, exwork: 0, vatApplied: false };
  }

  const { isLcl, num20gp, num40gp, num40hq, numLcl } = container;

  // Blended LCL + FCL: bill the FCL containers against the volume they can
  // hold, and any actual volume beyond that as LCL by weight/volume — then
  // sum the two legs. This only triggers for a manual override that has
  // both FCL containers and an LCL share set; auto-computed packing never
  // sets numLcl, so this is a no-op for every other caller.
  const hasFclPortion = num20gp > 0 || num40gp > 0 || num40hq > 0;
  const hasLclPortion = (numLcl || 0) > 0;
  if (!isLcl && hasFclPortion && hasLclPortion) {
    const fclCapacity = num20gp * 25 + num40gp * 60 + num40hq * 65;
    const lclCbm = Math.max(0, totalCbm - fclCapacity);
    const fclCbm = totalCbm - lclCbm;

    const fclResult = calculateRouteCosts(
      shipFrom, fclCbm, numShipments,
      { ...container, isLcl: false, numLcl: 0 },
      routeQuote, exchangeRates
    );
    const lclResult = lclCbm > 0
      ? calculateRouteCosts(
          shipFrom, lclCbm, numShipments,
          { ...container, isLcl: true, num20gp: 0, num40gp: 0, num40hq: 0, numLcl: 0 },
          routeQuote, exchangeRates
        )
      : { freight: 0, local: 0, brokerage: 0, exwork: 0, vatApplied: fclResult.vatApplied };

    return {
      freight: Math.round((fclResult.freight + lclResult.freight) * 100) / 100,
      local: Math.round((fclResult.local + lclResult.local) * 100) / 100,
      brokerage: Math.round((fclResult.brokerage + lclResult.brokerage) * 100) / 100,
      exwork: Math.round((fclResult.exwork + lclResult.exwork) * 100) / 100,
      vatApplied: fclResult.vatApplied || lclResult.vatApplied
    };
  }

  const num40 = num40gp + num40hq;

  let freight = 0;
  let local = 0;
  let brokerage = 0;
  let exwork = 0;

  // 1. Freight Cost calculation
  if (isLcl) {
    freight = routeQuote.lclFreightPerCbm * totalCbm;
  } else {
    freight = num20gp * routeQuote.fcl20Freight + num40gp * routeQuote.fcl40Freight + num40hq * routeQuote.fcl40hqFreight;
  }

  // Custom Freight Surcharges
  if (routeQuote.customFreightFees) {
    routeQuote.customFreightFees.forEach(fee => {
      if (fee.type === "flat") {
        freight += fee.amount * numShipments;
      } else if (fee.type === "perCbm") {
        freight += fee.amount * totalCbm;
      } else if (fee.type === "per20gp") {
        freight += fee.amount * num20gp;
      } else if (fee.type === "per40gp") {
        freight += fee.amount * num40gp;
      } else if (fee.type === "per40hq") {
        freight += fee.amount * num40hq;
      } else if (fee.type === "allFcl") {
        freight += fee.amount * (num20gp + num40gp + num40hq);
      }
    });
  }

  // 2. Local Port Dues calculation (FCL unmultiplied by 1.07 VAT as requested)
  if (isLcl) {
    local = routeQuote.lclLocalPerCbm * totalCbm + routeQuote.lclLocalPerShipment * numShipments;
  } else {
    // Imbalance surcharges in USD, converted to THB
    const imbalanceSurcharge20 = (routeQuote.fcl20ImbalanceSurchargeUsd || 0)  * (exchangeRates["USD"] || 33.5581);
    const imbalanceSurcharge40 = (routeQuote.fcl40ImbalanceSurchargeUsd || 0)  * (exchangeRates["USD"] || 33.5581);
    const imbalanceSurcharge40hq = (routeQuote.fcl40hqImbalanceSurchargeUsd || 0)  * (exchangeRates["USD"] || 33.5581);

    const fcl20Local = routeQuote.fcl20LocalThc + routeQuote.fcl20LocalCleaning + routeQuote.fcl20LocalEmc + imbalanceSurcharge20;
    const fcl40Local = routeQuote.fcl40LocalThc + routeQuote.fcl40LocalCleaning + routeQuote.fcl40LocalEmc + imbalanceSurcharge40;
    const fcl40hqLocal = routeQuote.fcl40hqLocalThc + routeQuote.fcl40hqLocalCleaning + routeQuote.fcl40hqLocalEmc + imbalanceSurcharge40hq;

    local = num20gp * fcl20Local + num40gp * fcl40Local + num40hq * fcl40hqLocal;
    
    // Split Shipment Fee (D/O fee + Handling Charges) per shipment
    if (num20gp + num40gp + num40hq > 0) {
      if (routeQuote.fclLocalPerShipmentDo !== undefined && routeQuote.fclLocalPerShipmentHandling !== undefined) {
        local += (routeQuote.fclLocalPerShipmentDo + routeQuote.fclLocalPerShipmentHandling) * numShipments;
      } else {
        local += routeQuote.fclLocalPerShipment * numShipments;
      }
    }
  }

  // Custom Local Surcharges
  if (routeQuote.customLocalFees) {
    routeQuote.customLocalFees.forEach(fee => {
      if (fee.type === "flat") {
        local += fee.amount * numShipments;
      } else if (fee.type === "perCbm") {
        local += fee.amount * totalCbm;
      } else if (fee.type === "per20gp") {
        local += fee.amount * num20gp;
      } else if (fee.type === "per40gp") {
        local += fee.amount * num40gp;
      } else if (fee.type === "per40hq") {
        local += fee.amount * num40hq;
      } else if (fee.type === "allFcl") {
        local += fee.amount * (num20gp + num40gp + num40hq);
      }
    });
  }

  // 3. Customs Brokerage calculation
  if (isLcl) {
    let base = 0;
    if (totalCbm <= 3) {
      base = routeQuote.brokerageLclBaseTier1;
    } else if (totalCbm <= 5) {
      base = routeQuote.brokerageLclBaseTier2;
    } else {
      base = routeQuote.brokerageLclBaseTier3;
    }
    brokerage = base + (routeQuote.brokerageLclHandlingPerCbm + routeQuote.brokerageLclAdmissionPerCbm) * totalCbm;
  } else {
    const brokerageFcl20 = routeQuote.brokerageFcl20Clearance +
      routeQuote.brokerageFcl20LiftOn +
      routeQuote.brokerageFcl20Admission +
      routeQuote.brokerageFcl20OverTime +
      routeQuote.brokerageFcl20ExtendPeriod +
      routeQuote.brokerageFcl20FacilitiesUsage +
      routeQuote.brokerageFcl20AdmissionSecond +
      routeQuote.brokerageFcl20LiftOff;

    const brokerageFcl40 = routeQuote.brokerageFcl40Clearance +
      routeQuote.brokerageFcl40LiftOn +
      routeQuote.brokerageFcl40Admission +
      routeQuote.brokerageFcl40OverTime +
      routeQuote.brokerageFcl40ExtendPeriod +
      routeQuote.brokerageFcl40FacilitiesUsage +
      routeQuote.brokerageFcl40AdmissionSecond +
      routeQuote.brokerageFcl40LiftOff;

    const brokerageFcl40hq = routeQuote.brokerageFcl40hqClearance +
      routeQuote.brokerageFcl40hqLiftOn +
      routeQuote.brokerageFcl40hqAdmission +
      routeQuote.brokerageFcl40hqOverTime +
      routeQuote.brokerageFcl40hqExtendPeriod +
      routeQuote.brokerageFcl40hqFacilitiesUsage +
      routeQuote.brokerageFcl40hqAdmissionSecond +
      routeQuote.brokerageFcl40hqLiftOff;

    brokerage = num20gp * brokerageFcl20 + num40gp * brokerageFcl40 + num40hq * brokerageFcl40hq;
  }

  // Custom Brokerage Surcharges
  if (routeQuote.customBrokerageFees) {
    routeQuote.customBrokerageFees.forEach(fee => {
      if (fee.type === "flat") {
        brokerage += fee.amount * numShipments;
      } else if (fee.type === "perCbm") {
        brokerage += fee.amount * totalCbm;
      } else if (fee.type === "per20gp") {
        brokerage += fee.amount * num20gp;
      } else if (fee.type === "per40gp") {
        brokerage += fee.amount * num40gp;
      } else if (fee.type === "per40hq") {
        brokerage += fee.amount * num40hq;
      } else if (fee.type === "allFcl") {
        brokerage += fee.amount * (num20gp + num40gp + num40hq);
      }
    });
  }

  // 4. Custom Exwork Surcharges (Added dynamically as requested)
  if (routeQuote.customExworkFees) {
    routeQuote.customExworkFees.forEach(fee => {
      let feeValue = 0;
      if (fee.type === "flat") {
        feeValue = fee.amount * numShipments;
      } else if (fee.type === "perCbm") {
        feeValue = fee.amount * totalCbm;
      } else if (fee.type === "per20gp") {
        feeValue = fee.amount * num20gp;
      } else if (fee.type === "per40gp") {
        feeValue = fee.amount * num40gp;
      } else if (fee.type === "per40hq") {
        feeValue = fee.amount * num40hq;
      } else if (fee.type === "allFcl") {
        feeValue = fee.amount * (num20gp + num40gp + num40hq);
      }
      exwork += feeValue; // Exwork (Origin Local) charges are tracked as their own ledger line item
    });
  }

  const vatApplied = shipFrom.toUpperCase().trim().includes("TAIWAN");

  return {
    freight: Math.round(freight * 100) / 100,
    local: Math.round(local * 100) / 100,
    brokerage: Math.round(brokerage * 100) / 100,
    exwork: Math.round(exwork * 100) / 100,
    vatApplied
  };
}

/**
 * Knapsack optimizer to select 20ft, 40ft and 40HQ containers.
 */
export function calculateContainers(
  totalCbm: number,
  routeQuote?: RouteQuote,
  force20ftFcl: boolean = false
): ContainerConfig {
  const fcl20Cost = routeQuote && routeQuote.fcl20Freight > 0 ? routeQuote.fcl20Freight : 24163.2;
  const fcl40Cost = routeQuote && routeQuote.fcl40Freight > 0 ? routeQuote.fcl40Freight : 46312.8;

  if (totalCbm <= 0) {
    return {
      num20gp: 0,
      num40gp: 0,
      num40hq: 0,
      name: "No Volume",
      isLcl: true,
      totalCbm,
      freightCost: 0,
      status: "Acceptable",
      statusDetails: "No items scheduled for this shipment.",
      capacity: 0,
      excessCbm: 0
    };
  }

  // Under the elastic/flexible rule:
  // cbm <= 19 -> LCL. With up to 2.1 CBM elasticity, if totalCbm <= 21.1, we can still use LCL!
  // But if force20ftFcl is true, we skip LCL and force FCL.
  if (totalCbm <= 21.1 && !force20ftFcl) {
    const isOverTheoretical = totalCbm > 19.0;
    const name = `LCL (${totalCbm.toFixed(2)}/19.00 CBM)`;
    return {
      num20gp: 0,
      num40gp: 0,
      num40hq: 0,
      name,
      isLcl: true,
      totalCbm,
      freightCost: 0,
      status: isOverTheoretical ? "Review Needed" : "Acceptable",
      statusDetails: isOverTheoretical
        ? `Squeezed (High Utilization / Elastic Capacity): Over LCL theoretical capacity (19 CBM) by ${Math.max(0, totalCbm - 19.0).toFixed(2)} CBM, but within +2.1 CBM tolerance.`
        : `Fully fits in LCL space (max 19 CBM).`,
      capacity: 19.0,
      excessCbm: Math.max(0, totalCbm - 19.0)
    };
  }

  // FCL container selection:
  // Rule: 20ft containers have NO elasticity tolerance — hard cap at 25 CBM.
  //       40ft (60 CBM) and 40HQ (65 CBM) containers retain the +2.1 CBM elasticity per unit.
  // Thresholds derived from those rules:
  //   1x 20ft              : <= 25.00  (no tolerance)
  //   1x 40ft              : <= 62.10  (60 + 2.1)
  //   1x 40HQ              : <= 67.10  (65 + 2.1)
  //   1x 40HQ + 1x 20ft    : <= 90.10  (65+25 + 2.1 for the 40HQ only)
  //   1x 40HQ + 1x 40ft    : <= 129.20 (65+60 + 2×2.1)
  //   2x 40HQ              : <= 134.20 (2×65 + 2×2.1)
  //   2x 40HQ + 1x 20ft    : <= 159.20 (2×65+25 + 2×2.1 for the 40HQs)
  //   2x 40HQ + 1x 40ft    : <= 196.30 (2×65+60 + 3×2.1)
  //   3x 40HQ              : <= 201.30 (3×65 + 3×2.1)
  let num20gp = 0;
  let num40gp = 0;
  let num40hq = 0;
  let capacity = 0;
  let configName = "";

  if (totalCbm <= 25.0) {
    // 1x 20ft — hard cap, no elasticity
    num20gp = 1;
    capacity = 25;
    configName = "1x 20ft FCL";
  } else if (totalCbm <= 62.1) {
    // 1x 40ft (limit 60, fits up to 62.1 with elasticity)
    num40gp = 1;
    capacity = 60;
    configName = "1x 40ft FCL";
  } else if (totalCbm <= 67.1) {
    // 1x 40HQ (limit 65, fits up to 67.1 with elasticity)
    num40hq = 1;
    capacity = 65;
    configName = "1x 40HQ FCL";
  } else if (totalCbm <= 90.1) {
    // 1x 40HQ + 1x 20ft (limit 90, elasticity only on the 40HQ = +2.1)
    num40hq = 1;
    num20gp = 1;
    capacity = 90;
    configName = "1x 40HQ + 1x 20ft FCL";
  } else if (totalCbm <= 129.2) {
    // 1x 40HQ + 1x 40ft (limit 125, elasticity on both 40s = +4.2 total)
    num40hq = 1;
    num40gp = 1;
    capacity = 125;
    configName = "1x 40HQ + 1x 40ft FCL";
  } else if (totalCbm <= 134.2) {
    // 2x 40HQ (limit 130, elasticity on both = +4.2)
    num40hq = 2;
    capacity = 130;
    configName = "2x 40HQ FCL";
  } else if (totalCbm <= 159.2) {
    // 2x 40HQ + 1x 20ft (limit 155, elasticity only on the 2 40HQs = +4.2)
    num40hq = 2;
    num20gp = 1;
    capacity = 155;
    configName = "2x 40HQ + 1x 20ft FCL";
  } else if (totalCbm <= 196.3) {
    // 2x 40HQ + 1x 40ft (limit 190, elasticity on all three = +6.3)
    num40hq = 2;
    num40gp = 1;
    capacity = 190;
    configName = "2x 40HQ + 1x 40ft FCL";
  } else if (totalCbm <= 201.3) {
    // 3x 40HQ (limit 195, elasticity on all three = +6.3)
    num40hq = 3;
    capacity = 195;
    configName = "3x 40HQ FCL";
  } else {
    // Multiple 40HQs fallback
    num40hq = Math.ceil(totalCbm / 65);
    capacity = num40hq * 65;
    configName = `${num40hq}x 40HQ FCL`;
  }

  // Elasticity applies only to 40ft and 40HQ units — 20ft has zero tolerance
  const maxAllowedExcess = (num40gp + num40hq) * 2.1;
  const excessCbm = totalCbm - capacity > 0.005 ? totalCbm - capacity : 0;
  let status: "Acceptable" | "Review Needed" | "NOT Acceptable" = "Acceptable";
  let statusDetails = "";

  if (excessCbm === 0 || totalCbm <= capacity) {
    status = "Acceptable";
    statusDetails = `Fully acceptable. Fits within ${configName} capacity of ${capacity} CBM.`;
  } else if (maxAllowedExcess > 0 && excessCbm <= maxAllowedExcess) {
    status = "Review Needed";
    statusDetails = `Squeezed (High Utilization / Elastic Capacity): Over container capacity by only ${excessCbm.toFixed(2)} CBM. Within the +${maxAllowedExcess.toFixed(1)} CBM elasticity limit (40ft/40HQ only). Acceptable pending physical loading review.`;
  } else {
    status = "NOT Acceptable";
    statusDetails = `Too much over the limit! Over capacity by ${excessCbm.toFixed(2)} CBM, which exceeds the allowed tolerance of ${configName} (${capacity} CBM${maxAllowedExcess > 0 ? ` + ${maxAllowedExcess.toFixed(1)} CBM elasticity` : ", no elasticity for 20ft"}).`;
  }

  const freightCost = num20gp * fcl20Cost + num40gp * fcl40Cost + num40hq * fcl40Cost;

  return {
    num20gp,
    num40gp,
    num40hq,
    name: `${configName} (${totalCbm.toFixed(2)}/${capacity}.00 CBM)`,
    isLcl: false,
    totalCbm,
    freightCost,
    status,
    statusDetails,
    capacity,
    excessCbm
  };
}

function formatFclName(num40hq: number, num40gp: number, num20gp: number, totalCbm: number, totalCapacity: number): string {
  const parts: string[] = [];
  if (num40hq > 0) parts.push(`${num40hq}x 40HQ`);
  if (num40gp > 0) parts.push(`${num40gp}x 40ft`);
  if (num20gp > 0) parts.push(`${num20gp}x 20ft`);
  return parts.join(" + ") + ` FCL (${totalCbm.toFixed(2)}/${totalCapacity.toFixed(2)} CBM)`;
}

/**
 * Build a ContainerConfig for a user-selected manual container mix (set from
 * the Shipment Containers & Bins tab), evaluating capacity/status the same
 * way calculateContainers does for auto-computed combinations, so a manual
 * override gets the same Acceptable / Squeezed / Over-capacity feedback.
 * freightCost is left at 0 here — the caller recalculates real freight/
 * local/brokerage costs against this mix via calculateRouteCosts.
 */
function buildManualContainerConfig(
  num20gp: number,
  num40gp: number,
  num40hq: number,
  numLcl: number,
  isLcl: boolean,
  totalCbm: number
): ContainerConfig {
  const hasFcl = num20gp > 0 || num40gp > 0 || num40hq > 0;
  const hasLcl = numLcl > 0;

  if (!hasFcl) {
    // Pure LCL (or nothing selected at all). Capacity scales with the
    // number of LCL shares entered — each share is a nominal 19 CBM — so
    // bumping the LCL count actually raises the shipment's capacity instead
    // of staying pinned at a single share's 19 CBM.
    const shares = hasLcl ? numLcl : 1;
    const capacity = shares * 19.0;
    const isOverTheoretical = totalCbm > capacity;
    const excessCbm = Math.max(0, totalCbm - capacity);
    const withinTolerance = excessCbm <= 2.1;
    return {
      num20gp: 0,
      num40gp: 0,
      num40hq: 0,
      numLcl: hasLcl ? numLcl : 0,
      name: `${shares > 1 ? `${shares}x ` : ""}LCL (${totalCbm.toFixed(2)}/${capacity.toFixed(2)} CBM) (Manual)`,
      isLcl: true,
      totalCbm,
      freightCost: 0,
      status: !isOverTheoretical ? "Acceptable" : withinTolerance ? "Review Needed" : "NOT Acceptable",
      statusDetails: !isOverTheoretical
        ? `Fully fits in LCL space (max ${capacity.toFixed(2)} CBM across ${shares} LCL share${shares > 1 ? "s" : ""}).`
        : withinTolerance
          ? `Squeezed (High Utilization / Elastic Capacity): Over LCL theoretical capacity (${capacity.toFixed(2)} CBM across ${shares} share${shares > 1 ? "s" : ""}) by ${excessCbm.toFixed(2)} CBM, but within +2.1 CBM tolerance.`
          : `Too much over the limit! Over LCL capacity (${capacity.toFixed(2)} CBM across ${shares} share${shares > 1 ? "s" : ""}) by ${excessCbm.toFixed(2)} CBM, exceeding the +2.1 CBM tolerance. Add more LCL shares.`,
      capacity,
      excessCbm
    };
  }

  const fclCapacity = num20gp * 25 + num40gp * 60 + num40hq * 65;
  // Elasticity applies only to 40ft and 40HQ units — 20ft has zero tolerance
  const maxAllowedExcess = (num40gp + num40hq) * 2.1;

  if (hasLcl) {
    // Blended LCL + FCL: the FCL containers take their combined capacity,
    // and any actual volume beyond that ships LCL by weight/volume — so the
    // nominal capacity gets a further +19 CBM (per LCL share) of headroom
    // before the shipment is flagged as over capacity.
    const capacity = fclCapacity + numLcl * 19.0;
    const excessCbm = totalCbm - capacity > 0.005 ? totalCbm - capacity : 0;
    const lclCbm = Math.max(0, totalCbm - fclCapacity);

    let status: "Acceptable" | "Review Needed" | "NOT Acceptable" = "Acceptable";
    let statusDetails = "";
    if (excessCbm === 0 || totalCbm <= capacity) {
      status = "Acceptable";
      statusDetails = `Fully acceptable. Fits within your selected FCL containers (${fclCapacity} CBM) plus ${numLcl}x LCL share${numLcl > 1 ? "s" : ""} (+${(numLcl * 19).toFixed(1)} CBM) — ${lclCbm.toFixed(2)} CBM will ship LCL.`;
    } else if (maxAllowedExcess > 0 && excessCbm <= maxAllowedExcess) {
      status = "Review Needed";
      statusDetails = `Squeezed (High Utilization / Elastic Capacity): Over your selected FCL + LCL capacity by ${excessCbm.toFixed(2)} CBM. Within the +${maxAllowedExcess.toFixed(1)} CBM elasticity limit (40ft/40HQ only). Acceptable pending physical loading review.`;
    } else {
      status = "NOT Acceptable";
      statusDetails = `Manually selected containers + LCL are too small: over capacity by ${excessCbm.toFixed(2)} CBM, exceeding the allowed tolerance. Add more LCL share(s) or a larger container mix.`;
    }

    return {
      num20gp,
      num40gp,
      num40hq,
      numLcl,
      name: `${numLcl}x LCL + ${formatFclName(num40hq, num40gp, num20gp, totalCbm, fclCapacity)}`.replace(" FCL (", " (") + " (Manual)",
      isLcl: false,
      totalCbm,
      freightCost: 0,
      status,
      statusDetails,
      capacity,
      excessCbm
    };
  }

  const capacity = fclCapacity;
  const excessCbm = totalCbm - capacity > 0.005 ? totalCbm - capacity : 0;

  let status: "Acceptable" | "Review Needed" | "NOT Acceptable" = "Acceptable";
  let statusDetails = "";
  if (excessCbm === 0 || totalCbm <= capacity) {
    status = "Acceptable";
    statusDetails = `Fully acceptable. Fits within your selected containers' capacity of ${capacity} CBM.`;
  } else if (maxAllowedExcess > 0 && excessCbm <= maxAllowedExcess) {
    status = "Review Needed";
    statusDetails = `Squeezed (High Utilization / Elastic Capacity): Over your selected containers' capacity by ${excessCbm.toFixed(2)} CBM. Within the +${maxAllowedExcess.toFixed(1)} CBM elasticity limit (40ft/40HQ only). Acceptable pending physical loading review.`;
  } else {
    status = "NOT Acceptable";
    statusDetails = `Manually selected containers are too small: over capacity by ${excessCbm.toFixed(2)} CBM, exceeding the allowed tolerance (${capacity} CBM${maxAllowedExcess > 0 ? ` + ${maxAllowedExcess.toFixed(1)} CBM elasticity` : ", no elasticity for 20ft"}). Choose a larger container mix or switch to LCL.`;
  }

  return {
    num20gp,
    num40gp,
    num40hq,
    numLcl: 0,
    name: formatFclName(num40hq, num40gp, num20gp, totalCbm, capacity) + " (Manual)",
    isLcl: false,
    totalCbm,
    freightCost: 0,
    status,
    statusDetails,
    capacity,
    excessCbm
  };
}

/**
 * Generate list of combinations of other weeks.
 */
function getCombinations<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  function helper(start: number, combo: T[]) {
    if (combo.length === size) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      combo.push(array[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return result;
}

/**
 * Generate the 4 specific scenarios requested: 1, 2.1, 2.2, and 3.
 */
/**
 * Generate the 4 specific scenarios requested: 1, 2.1, 2.2, and 3.
 */
export function generateScenarios(maxWeeks: number): ScenarioDef[] {
  return [
    {
      id: "1",
      numShipments: 2,
      weeks: [1, 4],
      name: "Scenario 1 (Weeks 1 & 4)"
    },
    {
      id: "2.1",
      numShipments: 3,
      weeks: [1, 2, 4],
      name: "Scenario 2.1 (Weeks 1, 2 & 4)"
    },
    {
      id: "2.2",
      numShipments: 3,
      weeks: [1, 3, 4],
      name: "Scenario 2.2 (Weeks 1, 3 & 4)"
    },
    {
      id: "3",
      numShipments: 4,
      weeks: [1, 2, 3, 4],
      name: "Scenario 3 (Weeks 1, 2, 3 & 4)"
    }
  ];
}

export function getShipmentDate(w: number): Date {
  // Use local date constructors (year, monthIndex, day) to prevent timezone-related shifts
  if (w === 1) return new Date(2026, 8, 11); // Sept 11
  if (w === 2) return new Date(2026, 8, 18); // Sept 18
  if (w === 3) return new Date(2026, 8, 25); // Sept 25
  return new Date(2026, 9, 2); // Oct 2
}

export function matchesVendorCode(ruleVendor: string | undefined, prVendor: string | undefined): boolean {
  if (!ruleVendor || ruleVendor.trim() === "") return true;
  if (!prVendor) return false;
  const rv = ruleVendor.trim().toLowerCase();
  const pv = prVendor.trim().toLowerCase();
  return pv === rv || pv.includes(rv) || rv.includes(pv);
}

export function matchesCustomerCode(ruleCustStr: string | undefined, prCust: string | undefined): boolean {
  if (!ruleCustStr || ruleCustStr.trim() === "") return true;
  if (!prCust) return true;
  const prC = prCust.trim().toLowerCase();
  const codes = ruleCustStr.split(",").map(c => c.trim().toLowerCase());
  return codes.includes(prC) || codes.some(c => prC.includes(c) || c.includes(prC));
}

export function matchesItemDescription(ruleDesc: string | undefined, prDesc: string | undefined): boolean {
  if (!ruleDesc || ruleDesc.trim() === "") return true;
  if (!prDesc) return false;
  const rd = ruleDesc.trim().toLowerCase();
  const pd = prDesc.trim().toLowerCase();
  return pd.includes(rd) || rd.includes(pd);
}

export function matchesColor(ruleColor: string | undefined, prColor: string | undefined): boolean {
  if (!ruleColor || ruleColor.trim() === "") return true;
  if (!prColor) return false;
  const rc = ruleColor.trim().toLowerCase();
  const pc = prColor.trim().toLowerCase();
  
  if (rc === "black") {
    return pc.includes("black") || pc.includes("blk");
  }
  if (rc === "other color" || rc === "other colour") {
    return !pc.includes("black") && !pc.includes("blk");
  }
  
  return pc.includes(rc) || rc.includes(pc);
}

export function matchesSize(ruleSize: string | undefined, prSize: string | undefined): boolean {
  if (!ruleSize || ruleSize.trim() === "") return true;
  if (!prSize) return false;
  const rs = ruleSize.trim().toLowerCase();
  const ps = prSize.trim().toLowerCase();
  return ps === rs || ps.includes(rs) || rs.includes(ps);
}

// Parses a "Consolidate (Weekday)" cell value into JS Date.getDay()-style
// day numbers (0=Sunday..6=Saturday). Accepts full names ("Tuesday"),
// abbreviations ("Tue"), and multiple days separated by comma/slash/"&"/
// "and" (e.g. "Tue/Fri", "Tuesday, Friday"). Also accepts bare numeric
// day-of-week values (0-6) for files that export it that way. Returns an
// empty array (never null/undefined) when nothing parseable is found, so
// callers can treat "no override" uniformly with a simple length check.
const WEEKDAY_NAME_TO_NUM: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

export function parseWeekdayList(raw: string | undefined | null): number[] {
  if (!raw) return [];
  const parts = String(raw).split(/[,/&+]|\band\b/i).map(s => s.trim()).filter(Boolean);
  const days: number[] = [];
  for (const part of parts) {
    const cleaned = part.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!cleaned) continue;
    if (cleaned in WEEKDAY_NAME_TO_NUM) {
      days.push(WEEKDAY_NAME_TO_NUM[cleaned]);
      continue;
    }
    const asNum = parseInt(cleaned, 10);
    if (!isNaN(asNum) && asNum >= 0 && asNum <= 6) {
      days.push(asNum);
    }
  }
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

export function alignDepartureDateToLoadingRules(
  tentativeDate: Date,
  shipFrom: string,
  loadingDateRules: LoadingDateRule[],
  overrideAllowedDays?: number[]
): Date {
  const date = new Date(tentativeDate.getTime());
  
  const normalizeText = (text: string) => text.trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ");
  const normalizedShipFrom = normalizeText(shipFrom || "");

  const matchesShipFrom = (ruleCountry: string) => {
    const normalizedRule = normalizeText(ruleCountry);
    if (!normalizedRule) return false;
    if (normalizedShipFrom.includes(normalizedRule)) return true;
    const ruleTokens = normalizedRule.split(/\s+/).filter(Boolean);
    const shipFromTokens = normalizedShipFrom.split(/\s+/).filter(Boolean);
    return ruleTokens.every(token => shipFromTokens.includes(token));
  };

  let matchingRule = loadingDateRules ? loadingDateRules.find(r =>
    r.id !== "load_default" && matchesShipFrom(r.country)
  ) : undefined;

  // A per-PR "Consolidate (Weekday)" value, when present, is the source of
  // truth and overrides everything below (the shipFrom-based rule lookup,
  // including the Taiwan Keelung safety net) — the whole point of that
  // column is to let the actual uploaded data replace these defaults.
  let allowedDays: number[] | null = (overrideAllowedDays && overrideAllowedDays.length > 0)
    ? overrideAllowedDays
    : null;

  // Hardcoded Taiwan Keelung safety net: check this BEFORE falling back to
  // the generic default/other rule. Previously, once no specific-country
  // rule matched, the code grabbed the generic default/other rule (usually
  // Monday-only) and that took priority over this safety net below — so a
  // shipFrom value that clearly contains "Taiwan"/"Keelung" (e.g. just
  // "Taiwan" without the exact "Taiwan Keelung" rule-country string) would
  // silently get the wrong Monday-only rule instead of Tue/Fri.
  if (!allowedDays) {
    if (matchingRule && matchingRule.allowedDays && matchingRule.allowedDays.length > 0) {
      allowedDays = matchingRule.allowedDays;
    } else if (normalizedShipFrom.includes("TAIWAN") || normalizedShipFrom.includes("KEELUNG")) {
      allowedDays = [2, 5]; // Tuesday and Friday
    }
  }

  if (!allowedDays) {
    if (!matchingRule && loadingDateRules) {
      matchingRule = loadingDateRules.find(r => r.id === "load_default") ||
        loadingDateRules.find(r => {
          const normalizedCountry = normalizeText(r.country);
          return normalizedCountry.includes("OTHER") || normalizedCountry.includes("DEFAULT");
        });
    }
    allowedDays = (matchingRule && matchingRule.allowedDays && matchingRule.allowedDays.length > 0)
      ? matchingRule.allowedDays
      : [1]; // Final fallback: Monday
  }

  // Align backwards to the most recent allowed loading day.
  for (let attempt = 0; attempt < 14; attempt++) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    if (allowedDays.includes(dayOfWeek)) {
      return date;
    }
    date.setDate(date.getDate() - 1);
  }

  // If a backwards alignment fails for any reason, fall back to the nearest forward allowed day.
  date.setTime(tentativeDate.getTime());
  for (let attempt = 0; attempt < 14; attempt++) {
    const dayOfWeek = date.getDay();
    if (allowedDays.includes(dayOfWeek)) {
      return date;
    }
    date.setDate(date.getDate() + 1);
  }

  return tentativeDate; // Fallback
}

export function alignBasePoDueDateToLoadingRules(
  tentativeBasePoDueDate: Date,
  shipFrom: string,
  loadingDateRules: LoadingDateRule[]
): Date {
  return alignDepartureDateToLoadingRules(tentativeBasePoDueDate, shipFrom, loadingDateRules);
}

export interface McqMoqResolution {
  effectiveMcq: number;
  effectiveMoq: number;
  prFileMcq?: number;
  surchargeMcq?: number;
  prFileMoq?: number;
  surchargeMoq?: number;
  mcqActiveSource: "surcharge" | "pr_file" | "default";
  moqActiveSource: "surcharge" | "pr_file" | "default";
  mcqHasConflict: boolean;
  moqHasConflict: boolean;
}

export function getMcqMoqResolution(
  colorCode: string,
  vendor: string | undefined,
  surchargeRules: SurchargeRule[] | undefined,
  entries: PrEntry[] | undefined,
  defaultMCQ: number = 500,
  defaultMOQ: number = 5000,
  mcqMoqPreferences?: Record<string, "surcharge" | "pr_file">
): McqMoqResolution {
  let prFileMcq: number | undefined;
  let prFileMoq: number | undefined;

  if (entries && entries.length > 0) {
    const matchingPrs = entries.filter(e => {
      if (colorCode && e.colorCode !== colorCode) return false;
      if (vendor && e.vendor && !matchesVendorCode(e.vendor, vendor)) return false;
      return true;
    });

    const prWithMcq = matchingPrs.find(e => e.mcq !== undefined && e.mcq !== null && e.mcq > 0);
    if (prWithMcq) prFileMcq = prWithMcq.mcq;

    const prWithMoq = matchingPrs.find(e => e.moq !== undefined && e.moq !== null && e.moq > 0);
    if (prWithMoq) prFileMoq = prWithMoq.moq;
  }

  let surchargeMcq: number | undefined;
  let surchargeMoq: number | undefined;

  if (surchargeRules && surchargeRules.length > 0) {
    const mcqRules = surchargeRules.filter(rule => {
      const isColorRule = rule.surchargeType === "USD/Color" || 
                          rule.surchargeType === "% of Unit Price/Color" || 
                          rule.surchargeType === "USD/Color/Unit";
      if (!isColorRule) return false;
      if (vendor && rule.vendorCode && !matchesVendorCode(rule.vendorCode, vendor)) return false;
      if (colorCode && rule.color && !matchesColor(rule.color, colorCode)) return false;
      return true;
    });

    if (mcqRules.length > 0) {
      let maxThreshold = -1;
      mcqRules.forEach(rule => {
        if (rule.max !== undefined && rule.max !== null && rule.max > maxThreshold) {
          maxThreshold = rule.max;
        }
      });
      if (maxThreshold > 0) surchargeMcq = maxThreshold;
    }

    const moqRules = surchargeRules.filter(rule => {
      if (rule.surchargeType !== "USD/PO") return false;
      if (vendor && rule.vendorCode && !matchesVendorCode(rule.vendorCode, vendor)) return false;
      return true;
    });

    if (moqRules.length > 0) {
      let maxThreshold = -1;
      moqRules.forEach(rule => {
        if (rule.max !== undefined && rule.max !== null && rule.max > maxThreshold) {
          maxThreshold = rule.max;
        }
      });
      if (maxThreshold > 0) surchargeMoq = maxThreshold;
    }
  }

  const mcqKey = `${vendor || ""}::${colorCode}::MCQ`;
  const moqKey = `${vendor || ""}::MOQ`;

  const mcqPref = mcqMoqPreferences?.[mcqKey] || mcqMoqPreferences?.[colorCode] || mcqMoqPreferences?.["all"];
  const moqPref = mcqMoqPreferences?.[moqKey] || mcqMoqPreferences?.[vendor || ""] || mcqMoqPreferences?.["all"];

  let effectiveMcq = defaultMCQ;
  let mcqActiveSource: "surcharge" | "pr_file" | "default" = "default";
  const mcqHasConflict = !!(prFileMcq && surchargeMcq && Math.abs(prFileMcq - surchargeMcq) > 10);

  if (mcqPref === "pr_file" && prFileMcq && prFileMcq > 0) {
    effectiveMcq = prFileMcq;
    mcqActiveSource = "pr_file";
  } else if (mcqPref === "surcharge" && surchargeMcq && surchargeMcq > 0) {
    effectiveMcq = surchargeMcq;
    mcqActiveSource = "surcharge";
  } else {
    // Priority: Surcharge Rules > PR File > defaultMCQ
    if (surchargeMcq && surchargeMcq > 0) {
      effectiveMcq = surchargeMcq;
      mcqActiveSource = "surcharge";
    } else if (prFileMcq && prFileMcq > 0) {
      effectiveMcq = prFileMcq;
      mcqActiveSource = "pr_file";
    } else {
      effectiveMcq = defaultMCQ;
      mcqActiveSource = "default";
    }
  }

  let effectiveMoq = defaultMOQ;
  let moqActiveSource: "surcharge" | "pr_file" | "default" = "default";
  const moqHasConflict = !!(prFileMoq && surchargeMoq && Math.abs(prFileMoq - surchargeMoq) > 10);

  if (moqPref === "pr_file" && prFileMoq && prFileMoq > 0) {
    effectiveMoq = prFileMoq;
    moqActiveSource = "pr_file";
  } else if (moqPref === "surcharge" && surchargeMoq && surchargeMoq > 0) {
    effectiveMoq = surchargeMoq;
    moqActiveSource = "surcharge";
  } else {
    // Priority: Surcharge Rules > PR File > defaultMOQ
    if (surchargeMoq && surchargeMoq > 0) {
      effectiveMoq = surchargeMoq;
      moqActiveSource = "surcharge";
    } else if (prFileMoq && prFileMoq > 0) {
      effectiveMoq = prFileMoq;
      moqActiveSource = "pr_file";
    } else {
      effectiveMoq = defaultMOQ;
      moqActiveSource = "default";
    }
  }

  return {
    effectiveMcq,
    effectiveMoq,
    prFileMcq,
    surchargeMcq,
    prFileMoq,
    surchargeMoq,
    mcqActiveSource,
    moqActiveSource,
    mcqHasConflict,
    moqHasConflict
  };
}

export function getEffectiveMcqForColor(
  colorCode: string,
  vendor: string | undefined,
  surchargeRules: SurchargeRule[] | undefined,
  defaultMCQ: number = 500,
  entries?: PrEntry[],
  mcqMoqPreferences?: Record<string, "surcharge" | "pr_file">
): number {
  return getMcqMoqResolution(colorCode, vendor, surchargeRules, entries, defaultMCQ, 5000, mcqMoqPreferences).effectiveMcq;
}

export function getEffectiveMoqForVendor(
  vendor: string | undefined,
  surchargeRules: SurchargeRule[] | undefined,
  defaultMOQ: number = 5000,
  entries?: PrEntry[],
  mcqMoqPreferences?: Record<string, "surcharge" | "pr_file">
): number {
  return getMcqMoqResolution("", vendor, surchargeRules, entries, 500, defaultMOQ, mcqMoqPreferences).effectiveMoq;
}

/**
 * Run logistics processing for a given scenario definition.
 */
export function processScenario(
  entries: PrEntry[],
  scenarioDef: ScenarioDef,
  D0: Date,
  carryingRate: number,
  opportunityRate: number,
  defaultMOQ: number,
  shipFrom: string,
  enablePullForward: boolean = true,
  prefer20ftForOctober: boolean = false,
  shipmentDates: string[] = [],
  customRouteQuotes: RouteQuote[] = [],
  warehouseStuckDays: number = 0,
  warehouseDailyRent: WarehouseRentConfig | number = 1000,
  exchangeRates: Record<string, number>,
  mcqSurchargeUSD: number = 150,
  mcqSurchargeType: "flat" | "unitPriceIncrease" = "flat",
  excessOverrides: ExcessMcqOverride[] = [],
  containerOverrides?: Record<number, ContainerOverride>,
  scenario1ContainersPool?: Array<"20GP" | "40GP" | "40HQ">,
  vendorSurcharges: Record<string, number> = {},
  manualWeekOverrides?: Record<string, number>,
  surchargeRules?: SurchargeRule[],
  importedFclQuotes?: ImportedFclQuote[],
  incotermRules?: IncotermRule[],
  defaultMCQ: number = 500,
  loadingDateRules?: LoadingDateRule[],
  previouslyExistingContainers: number = 0,
  manualMatrixQtyOverrides?: Record<string, number>,
  unitPriceOverrides?: Record<string, number>,
  mcqMoqPreferences?: Record<string, "surcharge" | "pr_file">,
  acceptedFlags?: Record<string, boolean>
): ProcessedScenario {
  const S = scenarioDef.weeks;
  
  const totalCbmAll = entries.reduce((sum, e) => sum + (e.cbm || 0), 0);
  const isLclSameDay = totalCbmAll < 19.0;
  
  // Custom Route Quote resolution
  const baseRouteQuote = matchRouteQuote(shipFrom, customRouteQuotes);
  const transitTime = baseRouteQuote.transitTimeDays;

  const normalizeYear = (y: number): number => {
    if (y >= 2500 && y <= 2600) {
      return y - 543;
    }
    return y;
  };

  // 1. Create duplicate deep copy of PRs with normalized dates and resolved currency rates
  const processedEntries: PrEntry[] = entries.map(e => {
    let prDueDate = e.prDueDate ? new Date(e.prDueDate) : new Date(2026, 8, 29);
    if (isNaN(prDueDate.getTime()) || prDueDate.getFullYear() < 2000) {
      prDueDate = new Date(2026, 8, 29);
    } else {
      let y = normalizeYear(prDueDate.getFullYear());
      if (y !== prDueDate.getFullYear()) {
        prDueDate = new Date(y, prDueDate.getMonth(), prDueDate.getDate());
      }
    }
    // Keep Quantity Ordered YD unrounded initially to allow precise dynamic rounding later
    const rawQty = e.qty;

    const usdRate = exchangeRates["USD"] || 35.0;
    const eurRate = exchangeRates["EUR"] || 38.0;
    const hkdRate = exchangeRates["HKD"] || 4.5;

    let currencyRate = e.currencyRate;
    if (currencyRate === undefined || currencyRate === null || isNaN(currencyRate) || currencyRate <= 0) {
      const currency = e.currency ? String(e.currency).trim().toUpperCase() : "";
      if (currency) {
        if (currency === "USD") currencyRate = usdRate;
        else if (currency === "EUR") currencyRate = eurRate;
        else if (currency === "HKD") currencyRate = hkdRate;
        else if (currency === "THB") currencyRate = 1.0;
        else currencyRate = usdRate;
      } else {
        if (e.unitPrice > 30) {
          currencyRate = 1.0;
        } else {
          const originUpper = shipFrom.toUpperCase().trim();
          if (originUpper.includes("ITALY")) {
            currencyRate = eurRate;
          } else if (originUpper.includes("HK") || originUpper.includes("HONG KONG")) {
            currencyRate = hkdRate;
          } else {
            currencyRate = usdRate;
          }
        }
      }
    }
    
    return {
      ...e,
      qty: rawQty,
      originalQty: rawQty,
      prDueDate,
      assignedWeek: 1,
      excessQty: 0,
      currencyRate
    };
  });

  // Apply manual unit price overrides (fixes for $0 unit prices flagged to
  // the user) before any cost calculation reads unitPrice. Keyed by
  // "itemCode__colorCode", matching the pattern used for other manual
  // overrides in this app.
  if (unitPriceOverrides) {
    processedEntries.forEach(pr => {
      const key = `${pr.itemCode}__${pr.colorCode}`;
      if (Object.prototype.hasOwnProperty.call(unitPriceOverrides, key)) {
        pr.unitPrice = unitPriceOverrides[key];
      }
    });
  }

  // Detect $0 unit prices (likely a data/input error in the uploaded file)
  // and flag them so the user can review and correct. One flag per distinct
  // item/color combination, not per PR line, to avoid flooding the panel.
  const zeroPriceKeys = new Set<string>();
  const zeroPriceCombos: { itemCode: string; colorCode: string }[] = [];
  processedEntries.forEach(pr => {
    const key = `${pr.itemCode}__${pr.colorCode}`;
    const explicitlyZero = unitPriceOverrides && unitPriceOverrides[key] === 0;
    if ((pr.unitPrice === 0 || pr.unitPrice === undefined || pr.unitPrice === null || isNaN(pr.unitPrice)) && !explicitlyZero) {
      if (!zeroPriceKeys.has(key)) {
        zeroPriceKeys.add(key);
        zeroPriceCombos.push({ itemCode: pr.itemCode, colorCode: pr.colorCode });
      }
    }
  });

  // Step 1: Initial Week Assignment
  //
  // Days Early / grouping must be computed the same way no matter which
  // matched date pair is used: PR Delivery Date - PO Delivery Date, or
  // PR Due Date - PO Due Date. These only agree row-by-row if each PR's
  // own transit time (Due Date - Delivery Date, which can vary by route —
  // e.g. different shipFrom / vendor lanes) is used consistently, instead
  // of a single global route transit time applied to every PR. So:
  //   - Grouping itself is driven by PR Delivery Date (ship-basis date),
  //     since that's what's actually being scheduled/consolidated.
  //   - Each PR's own real transit time comes from the uploaded "Transit
  //     Lead Time (Days)" column when present (the actual source of truth
  //     going forward); otherwise it's derived from its own Due Date and
  //     Delivery Date when both are present; and only when neither is
  //     available does it fall back to the route's default transit time.
  const getPrOwnTransitDays = (pr: PrEntry): number => {
    if (pr.transitLeadTimeDays !== undefined && pr.transitLeadTimeDays !== null && !isNaN(pr.transitLeadTimeDays) && pr.transitLeadTimeDays >= 0) {
      return pr.transitLeadTimeDays;
    }
    if (pr.actualDelivery) {
      const d = new Date(pr.actualDelivery);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000) {
        const diff = getDaysDifference(pr.prDueDate, d);
        if (diff > 0) return diff;
      }
    }
    return transitTime;
  };

  const getPrShipBasisDate = (pr: PrEntry): Date => {
    if (pr.actualDelivery) {
      const d = new Date(pr.actualDelivery);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000) return d;
    }
    const fallback = new Date(pr.prDueDate);
    fallback.setDate(fallback.getDate() - getPrOwnTransitDays(pr));
    return fallback;
  };

  // This PR's own allowed loading/consolidation weekdays, parsed from the
  // uploaded "Consolidate (Weekday)" column. Empty when the column is
  // absent or blank for this row, in which case callers fall back to the
  // shipFrom-based default rule.
  const getPrConsolidateAllowedDays = (pr: PrEntry): number[] => parseWeekdayList(pr.consolidateWeekdayRaw);


  // Find the earliest required PR Due Date (D0) among processed entries
  const earliestPrDueDate = processedEntries.reduce(
    (min, e) => (e.prDueDate < min ? e.prDueDate : min),
    processedEntries[0]?.prDueDate || new Date(2026, 8, 29)
  );

  // Earliest PR Delivery Date (ship-basis) — this is the baseline grouping
  // runs off, so it must be computed from the same date type as the
  // per-row grouping value below.
  const earliestShipBasisDate = processedEntries.reduce(
    (min, e) => {
      const d = getPrShipBasisDate(e);
      return d < min ? d : min;
    },
    processedEntries[0] ? getPrShipBasisDate(processedEntries[0]) : new Date(2026, 8, 29)
  );

  const alignedBasePoDueDate = alignBasePoDueDateToLoadingRules(
    earliestPrDueDate,
    shipFrom,
    loadingDateRules || []
  );

  const alignedBaseShipDate = alignBasePoDueDateToLoadingRules(
    earliestShipBasisDate,
    shipFrom,
    loadingDateRules || []
  );

  const splitDaysEarly = scenarioDef.splitDaysEarly || [];

  processedEntries.forEach(pr => {
    // Calculate Days Early relative to Week 1's PR Delivery Date baseline.
    // This is mathematically identical to PR Due Date - PO Due Date as
    // long as each PR's own transit time is used consistently everywhere
    // else (see getPrOwnTransitDays / Step 4 below).
    const daysEarlyBase = getDaysDifference(getPrShipBasisDate(pr), alignedBaseShipDate);

    // Save this base days early
    pr.daysEarly = daysEarlyBase;

    // Split based on splitDaysEarly boundary array
    let groupIndex = 1;
    for (const splitPoint of splitDaysEarly) {
      if (daysEarlyBase > splitPoint) {
        groupIndex++;
      }
    }
    
    pr.assignedWeek = groupIndex;
  });

  // Apply manual week overrides if specified and the overridden week is active in this scenario
  processedEntries.forEach(pr => {
    if (manualWeekOverrides && manualWeekOverrides[pr.id] !== undefined) {
      const targetWeek = manualWeekOverrides[pr.id];
      if (scenarioDef.weeks.includes(targetWeek)) {
        pr.assignedWeek = targetWeek;
      }
    }
  });

  // Snapshot each PR's shipment assignment here — before the loading-day
  // reassignment pass or MOQ/MCQ pull-forward can move it to a different
  // shipment. This is what "before optimization" quantity means for the
  // UI's per-shipment "Original Qty" display: without it, once a PR gets
  // consolidated into an earlier shipment, that shipment's displayed
  // "Original Qty" would just be the post-consolidation total shown
  // pre-rounding — not actually reflective of what belonged there before
  // any optimization ran.
  processedEntries.forEach(pr => {
    pr.naturalAssignedWeek = pr.assignedWeek;
  });

  // Calculate dynamic shipment dates and PO due dates for each group.
  // Computed once, before MOQ/MCQ pull-forward runs — pull-forward always
  // gets the final say on quantity consolidation, so these dates are never
  // recalculated afterward.
  //
  // PRs that "caught a ride" on a later shipment via the loading-day
  // reassignment pass (see reassignToLatestFeasibleLoadingDay below) are
  // excluded from this calculation — the whole point of catching a ride is
  // that the PR adopts the later shipment's already-established date;
  // letting it count as a "member" here would let its own (earlier) need
  // pull that date backward again, cancelling out the benefit and
  // needlessly dragging every other member of that shipment earlier too.
  const riderIds = new Set<string>();
  const recomputeGroupDates = (): Record<number, { shipmentDate: Date; poDueDate: Date }> => {
    const dates: Record<number, { shipmentDate: Date; poDueDate: Date }> = {};
    S.forEach(w => {
      let finalShipDate: Date;
      let finalPoDueDate: Date;

      const manualDateStr = shipmentDates[w - 1];
      if (manualDateStr && manualDateStr.trim() !== "") {
        finalShipDate = new Date(manualDateStr);
        finalPoDueDate = new Date(finalShipDate);
        finalPoDueDate.setDate(finalPoDueDate.getDate() + transitTime + warehouseStuckDays);
      } else {
        const groupEntries = processedEntries.filter(pr => pr.assignedWeek === w && !riderIds.has(pr.id));
        // Base the group's ship date on the earliest PR Delivery Date
        // (ship-basis date) within the group, not on PR Due Date re-derived
        // through a single global transit time — group members may span
        // routes with different real transit times. Track the earliest
        // member itself (not just its date) so its own uploaded transit
        // lead time and consolidate-weekday, when present, can drive the
        // group's alignment instead of the global defaults.
        let baseDate = earliestShipBasisDate;
        let anchorPr: PrEntry | undefined;
        if (groupEntries.length > 0) {
          anchorPr = groupEntries.reduce(
            (minPr, pr) => (getPrShipBasisDate(pr) < getPrShipBasisDate(minPr) ? pr : minPr),
            groupEntries[0]
          );
          baseDate = getPrShipBasisDate(anchorPr);
        }
        const tentativeShipDate = new Date(baseDate);
        tentativeShipDate.setDate(tentativeShipDate.getDate() - warehouseStuckDays);
        const anchorAllowedDays = anchorPr ? getPrConsolidateAllowedDays(anchorPr) : [];
        finalShipDate = alignDepartureDateToLoadingRules(tentativeShipDate, shipFrom, loadingDateRules || [], anchorAllowedDays);
        finalPoDueDate = new Date(finalShipDate);
        const groupTransitDays = anchorPr ? getPrOwnTransitDays(anchorPr) : transitTime;
        finalPoDueDate.setDate(finalPoDueDate.getDate() + groupTransitDays + warehouseStuckDays);
      }
      dates[w] = { shipmentDate: finalShipDate, poDueDate: finalPoDueDate };
    });
    return dates;
  };

  const groupDates = recomputeGroupDates();

  // Loading-day-aware shipment reassignment: the Days Early grouping
  // buckets each PR into a shipment based on a 7-day rolling window, but
  // that bucket's shipment date can still be well before the PR's own PR
  // Delivery Date (i.e. it has unused slack). Since shipping later — up
  // to, but not past, the PR's own PR Delivery Date, and only on an
  // allowed loading day for this shipFrom (Tue/Fri for Taiwan Keelung,
  // Monday for the rest, at most one shipment per calendar week) — reduces
  // carrying cost and opportunity cost (the item spends less time sitting
  // idle before it's actually needed), check whether a LATER shipment
  // already scheduled in this scenario also satisfies the PR's own PR
  // Delivery Date, and if so, move the PR to that later shipment instead.
  // This only ever moves a PR to a shipment that already exists in the
  // scenario (never creates a new one, since the shipment count is fixed
  // by the Days Early grouping above), and only ever moves it later, never
  // earlier.
  //
  // Runs once, here, BEFORE MOQ/MCQ pull-forward below — not after — so
  // that pull-forward always has the final say on quantity consolidation
  // and never gets its work undone by a later loading-day move.
  //
  // Deliberately does NOT recompute the target group's ship date in
  // reaction to a PR catching a ride here: the whole point is that the PR
  // adopts the LATER group's existing, already-scheduled date — letting
  // the newly-joined PR's own (earlier) need pull that date backward again
  // would just cancel out the benefit (and, worse, needlessly drag every
  // other member of that later group earlier too). riderIds tracks PRs
  // that caught a ride this way so they're permanently excluded from
  // group-date math even if pull-forward later moves them again.
  const reassignToLatestFeasibleLoadingDay = (): void => {
    processedEntries.forEach(pr => {
      // Respect explicit manual "move to week" overrides — don't
      // second-guess a choice the user already made for this specific PR
      // line.
      if (manualWeekOverrides && manualWeekOverrides[pr.id] !== undefined) {
        return;
      }

      // Use the raw PR Delivery Date field directly here, not
      // getPrShipBasisDate (which subtracts the full route transit time as
      // a fallback when actualDelivery isn't set — that's the right basis
      // for the Days Early grouping math above, but it's the wrong basis
      // for this specific check, which needs to compare against the PR's
      // own actual PR Delivery Date deadline, not a further transit-shifted
      // estimate of it.
      const prOwnDeliveryDate = pr.prDueDate;
      let bestWeek = pr.assignedWeek;
      let bestDate = groupDates[pr.assignedWeek]?.shipmentDate || null;

      S.forEach(w2 => {
        if (w2 <= pr.assignedWeek) return;
        const candidate = groupDates[w2]?.shipmentDate;
        if (!candidate) return;
        // Must not ship later than the PR's own PR Delivery Date, and must
        // be later than (or equal to) the best candidate found so far, to
        // push as late as the PR's own slack allows.
        if (candidate <= prOwnDeliveryDate && (!bestDate || candidate > bestDate)) {
          bestWeek = w2;
          bestDate = candidate;
        }
      });

      if (bestWeek === pr.assignedWeek) return;

      pr.assignedWeek = bestWeek;
      riderIds.add(pr.id);
    });
  };

  reassignToLatestFeasibleLoadingDay();

  const getShipmentDateLocal = (w: number): Date => {
    return groupDates[w]?.shipmentDate || earliestPrDueDate;
  };

  const getPoDueDate = (w: number): Date => {
    return groupDates[w]?.poDueDate || earliestPrDueDate;
  };

  const getActiveRouteQuoteForWeek = (w: number): RouteQuote => {
    const sDate = getShipmentDateLocal(w);
    const yyyy = sDate.getFullYear();
    const mm = String(sDate.getMonth() + 1).padStart(2, '0');
    const dd = String(sDate.getDate()).padStart(2, '0');
    const shipmentDateStr = `${yyyy}-${mm}-${dd}`;
    return matchRouteQuote(shipFrom, customRouteQuotes, shipmentDateStr);
  };

  // Apply excess overrides (Additional quantity ordered)
  if (excessOverrides && excessOverrides.length > 0) {
    excessOverrides.forEach(ov => {
      const addQty = Math.round(ov.additionalQty);
      if (addQty <= 0) return;

      // Determine target week: if targetWeek is not specified (Auto / Under MCQ), find the week where the selected color has qty > 0 and totalQty < MCQ
      let determinedTargetWeek = ov.targetWeek;
      if (!determinedTargetWeek) {
        const colorUpper = ov.colorCode.toUpperCase().trim();
        let weekUnderMcq: number | undefined;
        
        for (const w of scenarioDef.weeks) {
          const weekEntries = processedEntries.filter(pr => 
            pr.colorCode.toUpperCase().trim() === colorUpper &&
            pr.assignedWeek === w
          );
          const totalQty = weekEntries.reduce((sum, pr) => sum + pr.qty, 0);
          if (totalQty > 0 && totalQty < defaultMCQ) {
            weekUnderMcq = w;
            break; // take the earliest week under MCQ
          }
        }
        
        if (weekUnderMcq !== undefined) {
          determinedTargetWeek = weekUnderMcq;
        } else {
          // Fallback: find the earliest active week where this color has ordered quantity
          const firstWeekWithColor = scenarioDef.weeks.find(w => 
            processedEntries.some(pr => pr.colorCode.toUpperCase().trim() === colorUpper && pr.assignedWeek === w)
          );
          determinedTargetWeek = firstWeekWithColor || scenarioDef.weeks[0] || 1;
        }
      }

      // Try to find a matching PR of this color/item in the determined target week
      let matchingPr = processedEntries.find(pr => 
        pr.colorCode.toUpperCase().trim() === ov.colorCode.toUpperCase().trim() &&
        (!ov.itemDescription || (pr.itemDescription || pr.itemCode).toUpperCase().trim() === ov.itemDescription.toUpperCase().trim()) &&
        pr.assignedWeek === determinedTargetWeek
      );

      // Fallback 1: match just the color in that week
      if (!matchingPr) {
        matchingPr = processedEntries.find(pr => 
          pr.colorCode.toUpperCase().trim() === ov.colorCode.toUpperCase().trim() &&
          pr.assignedWeek === determinedTargetWeek
        );
      }

      // Fallback 2: match color/item in ANY week
      if (!matchingPr) {
        matchingPr = processedEntries.find(pr => 
          pr.colorCode.toUpperCase().trim() === ov.colorCode.toUpperCase().trim() &&
          (!ov.itemDescription || (pr.itemDescription || pr.itemCode).toUpperCase().trim() === ov.itemDescription.toUpperCase().trim())
        );
      }

      // Fallback 3: match just color in ANY week
      if (!matchingPr) {
        matchingPr = processedEntries.find(pr => 
          pr.colorCode.toUpperCase().trim() === ov.colorCode.toUpperCase().trim()
        );
      }

      if (matchingPr) {
        const prevQty = matchingPr.qty;
        
        // If the matching PR is in a different week than determinedTargetWeek, but we want it in determinedTargetWeek,
        // we can copy the PR and assign the new copy to determinedTargetWeek, so that it goes to the correct week!
        if (matchingPr.assignedWeek !== determinedTargetWeek) {
          const newPr: PrEntry = {
            ...matchingPr,
            id: `${matchingPr.id}-PAD`,
            qty: addQty,
            originalQty: addQty,
            excessQty: addQty,
            assignedWeek: determinedTargetWeek
          };
          if (ov.pricePerUnit !== undefined && ov.pricePerUnit > 0) {
            newPr.unitPrice = ov.pricePerUnit;
          }
          if (ov.cbmPerUnit !== undefined && ov.cbmPerUnit > 0) {
            newPr.cbm = addQty * ov.cbmPerUnit;
          } else if (matchingPr.unitWeightRaw !== undefined && matchingPr.unitWeightRaw > 0) {
            newPr.cbm = addQty * matchingPr.unitWeightRaw;
          } else {
            newPr.cbm = addQty * 0.003;
          }
          processedEntries.push(newPr);
        } else {
          // Add to the existing PR in that week
          matchingPr.qty += addQty;
          matchingPr.originalQty += addQty;
          matchingPr.excessQty = (matchingPr.excessQty || 0) + addQty;
          
          if (ov.pricePerUnit !== undefined && ov.pricePerUnit > 0) {
            matchingPr.unitPrice = ov.pricePerUnit;
          }
          
          if (ov.cbmPerUnit !== undefined && ov.cbmPerUnit > 0) {
            matchingPr.cbm = matchingPr.qty * ov.cbmPerUnit;
          } else if (matchingPr.unitWeightRaw !== undefined && matchingPr.unitWeightRaw > 0) {
            matchingPr.cbm = matchingPr.qty * matchingPr.unitWeightRaw;
          } else if (prevQty > 0) {
            matchingPr.cbm = matchingPr.cbm * (matchingPr.qty / prevQty);
          } else {
            matchingPr.cbm = matchingPr.qty * 0.003;
          }
        }
      } else {
        // No entries for this color at all (unlikely), create dummy entry
        const usdRate = exchangeRates["USD"] || 35.0;
        const eurRate = exchangeRates["EUR"] || 38.0;
        const hkdRate = exchangeRates["HKD"] || 4.5;
        let dummyRate = usdRate;
        const originUpper = shipFrom.toUpperCase().trim();
        if (originUpper.includes("ITALY")) {
          dummyRate = eurRate;
        } else if (originUpper.includes("HK") || originUpper.includes("HONG KONG")) {
          dummyRate = hkdRate;
        }

        const dummyPr: PrEntry = {
          id: `PAD-${ov.colorCode}-${determinedTargetWeek}`,
          itemCode: "PAD-MATERIAL",
          itemDescription: ov.itemDescription || "Padded MCQ Material",
          colorCode: ov.colorCode,
          qty: addQty,
          originalQty: addQty,
          unitPrice: ov.pricePerUnit || 2.75,
          prDueDate: new Date(earliestPrDueDate),
          cbm: addQty * (ov.cbmPerUnit || 0.003),
          moq: defaultMOQ,
          assignedWeek: determinedTargetWeek,
          excessQty: addQty,
          currencyRate: dummyRate
        };
        processedEntries.push(dummyPr);
      }
    });
  }

  // Apply manual matrix quantity overrides
  if (manualMatrixQtyOverrides) {
    for (const [key, targetQty] of Object.entries(manualMatrixQtyOverrides)) {
      const parts = key.split('__');
      if (parts.length !== 3) continue;
      const [itemDescKey, colorCode, weekStr] = parts;
      const week = parseInt(weekStr, 10);

      const colorUpper = colorCode.toUpperCase().trim();
      const descUpper = itemDescKey.toUpperCase().trim();
      const matchesItemDesc = (pr: PrEntry) => (pr.itemDescription || pr.itemCode).toUpperCase().trim() === descUpper;
      // Match by BOTH item description and color — matching by color alone
      // would silently edit the wrong item's PRs whenever multiple items
      // share a color, since colors commonly span several styles/items.
      // Matched by description (not the underlying item code) since
      // different item codes can share the same descriptive name and are
      // treated as one combined row in the UI.
      const weekEntries = processedEntries.filter(pr => 
        pr.colorCode.toUpperCase().trim() === colorUpper &&
        matchesItemDesc(pr) &&
        pr.assignedWeek === week
      );
      
      const currentQty = weekEntries.reduce((sum, pr) => sum + pr.qty, 0);
      const diff = targetQty - currentQty;
      
      if (diff > 0) {
        // Add quantity
        let matchingPr = weekEntries[0];
        if (!matchingPr) {
          // Find any PR for this exact item description + color (any week)
          matchingPr = processedEntries.find(pr =>
            pr.colorCode.toUpperCase().trim() === colorUpper &&
            matchesItemDesc(pr)
          );
        }
        
        if (matchingPr) {
          const prevQty = matchingPr.qty;
          if (matchingPr.assignedWeek !== week) {
            // copy to new week — this is a brand-new quantity for this
            // item/color/week combination that didn't exist before, so
            // there is no true "original" request to preserve; leave
            // originalQty at 0 so the "req:"/Original Qty label doesn't
            // show for it.
            const newPr: PrEntry = {
              ...matchingPr,
              id: `${matchingPr.id}-MATRIX-${week}`,
              qty: diff,
              originalQty: 0,
              excessQty: (matchingPr.excessQty || 0) + diff,
              assignedWeek: week
            };
            newPr.cbm = matchingPr.unitWeightRaw !== undefined && matchingPr.unitWeightRaw > 0
              ? diff * matchingPr.unitWeightRaw
              : (prevQty > 0 ? (matchingPr.cbm / prevQty) * diff : diff * 0.003);
            processedEntries.push(newPr);
          } else {
            // Editing an existing cell — originalQty must NOT change here.
            // It's the true pre-edit "requested" quantity, shown as
            // "req:"/Original Qty in the UI; only qty (the effective,
            // editable value) should move.
            matchingPr.qty += diff;
            matchingPr.excessQty = (matchingPr.excessQty || 0) + diff;
            matchingPr.cbm = matchingPr.unitWeightRaw !== undefined && matchingPr.unitWeightRaw > 0
              ? matchingPr.qty * matchingPr.unitWeightRaw
              : (prevQty > 0 ? (matchingPr.cbm / prevQty) * matchingPr.qty : matchingPr.qty * 0.003);
          }
        } else {
          // No entries for this exact item description + color at all, create dummy entry
          const dummyRate = exchangeRates["USD"] || 35.0;
          const dummyPr: PrEntry = {
            id: `PAD-${itemDescKey}-${colorCode}-${week}`,
            itemCode: itemDescKey,
            itemDescription: itemDescKey,
            colorCode: colorCode,
            qty: diff,
            originalQty: 0,
            unitPrice: 2.75,
            prDueDate: new Date(earliestPrDueDate),
            cbm: diff * 0.003,
            moq: defaultMOQ,
            assignedWeek: week,
            excessQty: diff,
            currencyRate: dummyRate
          };
          processedEntries.push(dummyPr);
        }
      } else if (diff < 0) {
        // Reduce quantity — originalQty must NOT change here either, for
        // the same reason as the increase branch above.
        let remainingToReduce = -diff;
        for (const pr of weekEntries) {
          if (remainingToReduce <= 0) break;
          const reduceAmount = Math.min(pr.qty, remainingToReduce);
          const prevQty = pr.qty;
          pr.qty -= reduceAmount;
          pr.cbm = pr.unitWeightRaw !== undefined && pr.unitWeightRaw > 0
            ? pr.qty * pr.unitWeightRaw
            : (prevQty > 0 ? (pr.cbm / prevQty) * pr.qty : 0);
          remainingToReduce -= reduceAmount;
        }
      }
    }
  }

  const moqAlerts: MoqAlert[] = [];
  const MCQ = defaultMCQ;
  let totalMoqSurchargeCost = 0; // in THB

  const USD_TO_THB = exchangeRates["USD"] || 35.0;
  const EUR_TO_THB = exchangeRates["EUR"] || 38.0;
  const HKD_TO_THB = exchangeRates["HKD"] || 4.5;
  const SURCHARGE_THB = mcqSurchargeUSD * USD_TO_THB;

  const getPrPriceTHB = (p: PrEntry | number): number => {
    if (typeof p === "number") {
      return p > 30 ? p : p * USD_TO_THB;
    }
    const currCode = (p.currency || "").toUpperCase().trim();
    if (currCode === "THB") {
      return p.unitPrice;
    }
    if (currCode && exchangeRates && exchangeRates[currCode] !== undefined && exchangeRates[currCode] > 0) {
      return p.unitPrice * exchangeRates[currCode];
    }
    if (p.currencyRate !== undefined && p.currencyRate !== null && p.currencyRate > 0) {
      return p.unitPrice * p.currencyRate;
    }
    const rate = p.unitPrice > 30 ? 1.0 : USD_TO_THB;
    return p.unitPrice * rate;
  };

  // Estimate a single PR's carrying + opportunity cost (THB) if it were to
  // ship with the group assigned to `week`. Mirrors the Step 4 calculation
  // below exactly (shipment value, Days Early via the group's ship date +
  // this PR's own transit time, same carrying/opportunity formulas) so the
  // MOQ/MCQ pull-forward decision below is comparing like-for-like against
  // what would actually be reported afterward — it just has to be
  // computed early because the pull-forward decision needs it before
  // week assignment is finalized.
  const estimateCarryOpportunityCostThb = (pr: PrEntry, week: number): number => {
    const groupShipDate = getShipmentDateLocal(week);
    const poDueDate = new Date(groupShipDate);
    poDueDate.setDate(poDueDate.getDate() + getPrOwnTransitDays(pr) + warehouseStuckDays);
    const days = getDaysDifference(pr.dueDateRaw || pr.prDueDate, poDueDate);
    const shipmentValue = pr.qty * getPrPriceTHB(pr);
    if (days <= 0 || shipmentValue <= 0) return 0;
    const carrying = (shipmentValue / 2) * carryingRate * (days / 365);
    const opportunity = shipmentValue * (Math.pow(1 + opportunityRate, days / 365) - 1);
    return carrying + opportunity;
  };

  // Estimate the MCQ surcharge (THB) a color's under-MCQ entries in one
  // shipment would incur if left as-is. Mirrors the same flat / vendor /
  // %-of-unit-price logic applied later when surcharges are actually
  // assessed (see the non-surchargeRules branch below), applied once for
  // the group as a whole to match how a flat surcharge is actually
  // charged (once per color per shipment, not once per PR line).
  const estimateMcqSurchargeThb = (colorWeekEntries: PrEntry[], mcqThreshold: number): number => {
    const totalQty = colorWeekEntries.reduce((sum, p) => sum + p.qty, 0);
    if (totalQty <= 0 || totalQty >= mcqThreshold) return 0;
    const vendorName = colorWeekEntries[0]?.vendor;
    const resolvedValue = (vendorName && vendorSurcharges[vendorName] !== undefined && vendorSurcharges[vendorName] !== null)
      ? vendorSurcharges[vendorName]
      : mcqSurchargeUSD;
    if (mcqSurchargeType === "flat") {
      return resolvedValue * USD_TO_THB;
    }
    const multiplier = resolvedValue / 100;
    return colorWeekEntries.reduce((sum, pr) => {
      const rate = pr.currencyRate !== undefined && pr.currencyRate !== null
        ? pr.currencyRate
        : (pr.currency === "THB"
            ? 1.0
            : (pr.currency === "USD"
                ? USD_TO_THB
                : (pr.unitPrice > 30 ? 1.0 : USD_TO_THB)
              )
          );
      return sum + (pr.unitPrice * multiplier * pr.qty) * rate;
    }, 0);
  };

  // Pull-forward applies across ALL shipments in the scenario, not just an
  // arbitrary early subset — previously this was hardcoded to weeks <= 3
  // ("September weeks", a leftover from an early test dataset), which
  // meant any later shipment (e.g. week 4+) could never be pulled forward
  // and was stuck with a surcharge even when consolidating it earlier was
  // clearly possible.
  const pullForwardEligibleWeeks = S;
  const colors = Array.from(new Set(processedEntries.map(p => p.colorCode)));

  if (enablePullForward) {
    colors.forEach(color => {
      // Process September active weeks in order
      for (let i = 0; i < pullForwardEligibleWeeks.length; i++) {
        const w_curr = pullForwardEligibleWeeks[i];
        
        const currentEntries = processedEntries.filter(p => p.colorCode === color && p.assignedWeek === w_curr);
        const currentQty = currentEntries.reduce((sum, p) => sum + p.qty, 0);

        const colorVendor = currentEntries[0]?.vendor || processedEntries.find(p => p.colorCode === color)?.vendor;
        const colorMcq = getEffectiveMcqForColor(color, colorVendor, surchargeRules, MCQ, entries, mcqMoqPreferences);

        // We pull from later weeks if:
        // 1. The current week has a gap (currentQty > 0 && currentQty < colorMcq)
        // 2. OR any later active week has a sub-MCQ gap for this color
        //
        // Both cases require currentQty > 0 — pulling material INTO a week
        // that has zero existing volume for this color doesn't consolidate
        // with anything; it just relocates the exact same shortfall to a
        // different (often earlier, always more expensive) date while
        // still leaving it under MCQ. If this color truly has only one
        // shipment's worth of material across the whole scenario, there is
        // nothing to combine it with, and it should stay exactly where it
        // is rather than being moved for no MCQ benefit.
        let shouldPull = (currentQty > 0 && currentQty < colorMcq);

        if (!shouldPull && currentQty > 0) {
          for (let j = i + 1; j < pullForwardEligibleWeeks.length; j++) {
            const w_next = pullForwardEligibleWeeks[j];
            const nextEntries = processedEntries.filter(p => p.colorCode === color && p.assignedWeek === w_next);
            const nextQty = nextEntries.reduce((sum, p) => sum + p.qty, 0);
            if (nextQty > 0 && nextQty < colorMcq) {
              shouldPull = true;
              break;
            }
          }
        }

        if (shouldPull) {
          // We have an MCQ gap! Let's pull completely from later September weeks.
          for (let j = i + 1; j < pullForwardEligibleWeeks.length; j++) {
            const w_next = pullForwardEligibleWeeks[j];
            const nextEntries = processedEntries.filter(p => p.colorCode === color && p.assignedWeek === w_next);
            
            if (nextEntries.length > 0) {
              const movingQty = nextEntries.reduce((sum, p) => sum + p.qty, 0);

              // Cost comparison: only pull this quantity forward if it's
              // actually cheaper to do so. Cost 1 (stay put) is the MCQ
              // surcharge this color/week would incur for staying under
              // MCQ, plus its own carrying + opportunity cost shipping in
              // w_next. Cost 2 (combine) is just the carrying +
              // opportunity cost of shipping earlier, in w_curr instead
              // (no surcharge, since combining is what clears the MCQ gap)
              // — but shipping earlier always means more Days Early, so
              // this can be more expensive than just paying the
              // surcharge, especially for a high-value shipment being
              // pulled many weeks forward.
              const costStay = estimateMcqSurchargeThb(nextEntries, colorMcq)
                + nextEntries.reduce((sum, p) => sum + estimateCarryOpportunityCostThb(p, w_next), 0);
              const costCombine = nextEntries.reduce((sum, p) => sum + estimateCarryOpportunityCostThb(p, w_curr), 0);

              if (costCombine >= costStay) {
                continue; // Cheaper (or equal) to leave it and pay the surcharge — don't pull forward.
              }

              nextEntries.forEach(p => {
                if (manualWeekOverrides && manualWeekOverrides[p.id] !== undefined) {
                  return; // Don't auto-pull forward if manually overridden
                }
                p.assignedWeek = w_curr;
              });

              // Log the movement alert
              moqAlerts.push({
                colorCode: color,
                week: w_next,
                originalQty: movingQty,
                targetMoq: colorMcq,
                moved: true,
                movedToWeek: w_curr
              });
            }
          }
        }

        // Backward-pull: if this week's own quantity is STILL below MCQ
        // after attempting to pull from later weeks (i.e. there was
        // nothing later to consolidate with — this is often the last
        // active week for this color), push it into the nearest earlier
        // week that already has quantity for this color, instead of
        // leaving it to trigger a surcharge. This only ever moves
        // quantity earlier, never later, so it can never cause a PR to
        // miss its own PR Delivery Date deadline — unlike the forward
        // case, earlier is always safe.
        if (i > 0) {
          const currentEntriesAfterPull = processedEntries.filter(p => p.colorCode === color && p.assignedWeek === w_curr);
          const currentQtyAfterPull = currentEntriesAfterPull.reduce((sum, p) => sum + p.qty, 0);

          if (currentQtyAfterPull > 0 && currentQtyAfterPull < colorMcq) {
            for (let k = i - 1; k >= 0; k--) {
              const w_prev = pullForwardEligibleWeeks[k];
              const prevEntries = processedEntries.filter(p => p.colorCode === color && p.assignedWeek === w_prev);
              const prevQty = prevEntries.reduce((sum, p) => sum + p.qty, 0);
              if (prevQty > 0) {
                // Same cost comparison as the forward-pull case above:
                // only push this remainder into the earlier week if doing
                // so is actually cheaper than leaving it to incur the MCQ
                // surcharge where it is.
                const costStay = estimateMcqSurchargeThb(currentEntriesAfterPull, colorMcq)
                  + currentEntriesAfterPull.reduce((sum, p) => sum + estimateCarryOpportunityCostThb(p, w_curr), 0);
                const costCombine = currentEntriesAfterPull.reduce((sum, p) => sum + estimateCarryOpportunityCostThb(p, w_prev), 0);

                if (costCombine >= costStay) {
                  break; // Cheaper (or equal) to leave it and pay the surcharge — stop looking for an earlier week.
                }

                currentEntriesAfterPull.forEach(p => {
                  if (manualWeekOverrides && manualWeekOverrides[p.id] !== undefined) {
                    return; // Don't auto-pull if manually overridden
                  }
                  p.assignedWeek = w_prev;
                });
                moqAlerts.push({
                  colorCode: color,
                  week: w_curr,
                  originalQty: currentQtyAfterPull,
                  targetMoq: colorMcq,
                  moved: true,
                  movedToWeek: w_prev
                });
                break;
              }
            }
          }
        }
      }
    });
  }

  // Initialize flat surcharge for each PR entry
  processedEntries.forEach(pr => {
    (pr as any).flatSurchargeTHB = 0;
  });

  // Calculate surcharges on final week assignments
  const weekSurcharges: Record<number, number> = {};

  S.forEach(w => {
    weekSurcharges[w] = 0;
    const weekEntries = processedEntries.filter(p => p.assignedWeek === w);
    if (weekEntries.length === 0) return;

    const appliedFlatRuleIds = new Set<string>();
    const colorSurchargeUSD: Record<string, number> = {};
    const colorSurchargeRuleApplied: Record<string, string> = {};
    const colorSurchargeRateApplied: Record<string, string> = {};

    const uniqueVendorColors = Array.from(new Set(weekEntries.map(p => `${p.vendor}::${p.colorCode}`)));

    uniqueVendorColors.forEach(vcKey => {
      const [vendor, colorCode] = vcKey.split("::");
      const groupEntries = weekEntries.filter(p => p.vendor === vendor && p.colorCode === colorCode);
      const totalColorQty = groupEntries.reduce((sum, pr) => sum + pr.qty, 0);
      const totalColorAmount = groupEntries.reduce((sum, pr) => sum + (pr.qty * pr.unitPrice), 0);

      const effectiveMcq = getEffectiveMcqForColor(colorCode, vendor, surchargeRules, MCQ, entries, mcqMoqPreferences);

      // Surcharge only applies if quantity is below effective MCQ threshold (effectiveMcq > 0)
      if (effectiveMcq > 0 && totalColorQty < effectiveMcq) {
        let ruleAppliedForGroup = false;

        if (surchargeRules && surchargeRules.length > 0) {
          groupEntries.forEach(pr => {
            if (ruleAppliedForGroup) return;

            const matchingColorRules = surchargeRules.filter(rule => {
              const isColorRule = rule.surchargeType === "USD/Color" || 
                                  rule.surchargeType === "% of Unit Price/Color" || 
                                  rule.surchargeType === "USD/Color/Unit";
              if (!isColorRule) return false;

              return matchesVendorCode(rule.vendorCode, pr.vendor) &&
                     matchesCustomerCode(rule.customerCodeRaw, pr.customerCode) &&
                     matchesItemDescription(rule.itemDescription, pr.itemDescription) &&
                     matchesColor(rule.color, pr.colorCode) &&
                     matchesSize(rule.size, pr.size);
            });

            if (matchingColorRules.length > 0) {
              let bestRule = matchingColorRules[0];
              let maxScore = -1;
              matchingColorRules.forEach(r => {
                let score = 0;
                if (r.itemDescription) score += 10;
                if (r.color) score += 5;
                if (r.size) score += 2;
                if (score > maxScore) {
                  maxScore = score;
                  bestRule = r;
                }
              });

              const rangeVal = bestRule.qtyOrAmount === "Qty" ? totalColorQty : totalColorAmount;
              const isMinOk = rangeVal >= (bestRule.min || 0);
              const isMaxOk = bestRule.max === undefined || bestRule.max === null || rangeVal <= bestRule.max;

              if (isMinOk && isMaxOk) {
                ruleAppliedForGroup = true;
                const rate = bestRule.currency === "USD" ? USD_TO_THB : 1.0;
                let addedUSD = 0;

                if (bestRule.surchargeType === "USD/Color") {
                  const flatKey = `${bestRule.id}::${colorCode}::${w}`;
                  if (!appliedFlatRuleIds.has(flatKey)) {
                    appliedFlatRuleIds.add(flatKey);
                    const surchargeTHB = bestRule.amount * rate;
                    addedUSD = bestRule.currency === "USD" ? bestRule.amount : bestRule.amount / USD_TO_THB;
                    weekSurcharges[w] += surchargeTHB;
                    totalMoqSurchargeCost += surchargeTHB;
                    groupEntries.forEach(gpPr => {
                      (gpPr as any).flatSurchargeTHB = ((gpPr as any).flatSurchargeTHB || 0) + surchargeTHB * (gpPr.qty / totalColorQty);
                    });
                  }
                } else if (bestRule.surchargeType === "% of Unit Price/Color") {
                  const chargeTHB = (bestRule.amount * pr.unitPrice * pr.qty) * rate;
                  addedUSD = bestRule.currency === "USD" ? (bestRule.amount * pr.unitPrice * pr.qty) : chargeTHB / USD_TO_THB;
                  weekSurcharges[w] += chargeTHB;
                  totalMoqSurchargeCost += chargeTHB;
                } else if (bestRule.surchargeType === "USD/Color/Unit") {
                  const chargeTHB = (bestRule.amount * pr.qty) * rate;
                  addedUSD = bestRule.currency === "USD" ? (bestRule.amount * pr.qty) : chargeTHB / USD_TO_THB;
                  weekSurcharges[w] += chargeTHB;
                  totalMoqSurchargeCost += chargeTHB;
                }

                colorSurchargeUSD[colorCode] = (colorSurchargeUSD[colorCode] || 0) + addedUSD;
                colorSurchargeRuleApplied[colorCode] = bestRule.surchargeType;
                colorSurchargeRateApplied[colorCode] = bestRule.surchargeType === "% of Unit Price/Color"
                  ? `${(bestRule.amount * 100).toFixed(0)}% of Unit Price`
                  : bestRule.surchargeType === "USD/Color/Unit"
                  ? `${bestRule.amount} USD/Unit`
                  : `${bestRule.amount} ${bestRule.currency || "USD"}/Color`;
              }
            }
          });
        }

        // Fall back to default vendor/MCQ surcharge if no custom excel rule applied
        if (!ruleAppliedForGroup) {
          const resolvedValue = (vendor && vendorSurcharges[vendor] !== undefined && vendorSurcharges[vendor] !== null)
            ? vendorSurcharges[vendor]
            : mcqSurchargeUSD;

          let surchargeUSD = 0;

          if (mcqSurchargeType === "flat") {
            surchargeUSD = resolvedValue;
            const resolvedSurchargeTHB = resolvedValue * USD_TO_THB;
            weekSurcharges[w] += resolvedSurchargeTHB;
            totalMoqSurchargeCost += resolvedSurchargeTHB;
            groupEntries.forEach(pr => {
              (pr as any).flatSurchargeTHB = ((pr as any).flatSurchargeTHB || 0) + resolvedSurchargeTHB * (pr.qty / totalColorQty);
            });
          } else {
            const multiplier = 1 + (resolvedValue / 100);
            groupEntries.forEach(pr => {
              const oldPrice = pr.unitPrice;
              pr.unitPrice = oldPrice * multiplier;
              const priceDiff = (pr.unitPrice - oldPrice) * pr.qty;
              surchargeUSD += priceDiff;
              const rate = pr.currencyRate !== undefined && pr.currencyRate !== null
                ? pr.currencyRate
                : (pr.currency === "THB"
                    ? 1.0
                    : (pr.currency === "USD"
                        ? USD_TO_THB
                        : (oldPrice > 30 ? 1.0 : USD_TO_THB)
                      )
                  );
              const penaltyDiff = priceDiff * rate;
              weekSurcharges[w] += penaltyDiff;
              totalMoqSurchargeCost += penaltyDiff;
            });
          }

          colorSurchargeUSD[colorCode] = surchargeUSD;
          colorSurchargeRuleApplied[colorCode] = mcqSurchargeType === "flat" ? "USD/Color" : "% Unit Price Increase";
          colorSurchargeRateApplied[colorCode] = mcqSurchargeType === "flat" ? `${resolvedValue} USD/Color` : `${resolvedValue}% Increase`;
        }
      }
    });

    // PO-level surcharges check
    if (surchargeRules && surchargeRules.length > 0) {
      const uniqueVendorsInWeek = Array.from(new Set(weekEntries.map(p => p.vendor)));
      uniqueVendorsInWeek.forEach(vendor => {
        const vendorEntries = weekEntries.filter(p => p.vendor === vendor);
        const globalVendorEntries = entries.filter(p => p.vendor === vendor);
        const globalVendorQty = globalVendorEntries.reduce((sum, pr) => sum + pr.qty, 0);
        const globalVendorAmount = globalVendorEntries.reduce((sum, pr) => sum + (pr.qty * pr.unitPrice), 0);
        const vendorMoq = globalVendorEntries.length > 0 ? globalVendorEntries[0].moq : 0;

        const poRules = surchargeRules.filter(rule => {
          if (rule.surchargeType !== "USD/PO") return false;
          return matchesVendorCode(rule.vendorCode, vendor) &&
                 vendorEntries.some(pr => matchesCustomerCode(rule.customerCodeRaw, pr.customerCode));
        });

        poRules.forEach(rule => {
          const rangeVal = rule.qtyOrAmount === "Qty" ? globalVendorQty : globalVendorAmount;
          const isMinOk = rangeVal >= (rule.min || 0);
          const effectiveMax = rule.max !== undefined && rule.max !== null ? rule.max : (rule.qtyOrAmount === "Qty" && vendorMoq > 0 ? vendorMoq : Infinity);
          const isMaxOk = rangeVal <= effectiveMax;

          if (isMinOk && isMaxOk) {
            const flatKey = `${rule.id}::${vendor}::${w}`;
            if (!appliedFlatRuleIds.has(flatKey)) {
              appliedFlatRuleIds.add(flatKey);
              const rate = rule.currency === "USD" ? USD_TO_THB : 1.0;
              const surchargeTHB = rule.amount * rate;
              weekSurcharges[w] += surchargeTHB;
              totalMoqSurchargeCost += surchargeTHB;
            }
          }
        });
      });
    }

    // Log MOQ Alerts for colors under their effective MCQ threshold
    colors.forEach(color => {
      const colorWeekEntries = weekEntries.filter(p => p.colorCode === color);
      const totalQty = colorWeekEntries.reduce((sum, p) => sum + p.qty, 0);
      const colorVendor = colorWeekEntries[0]?.vendor || processedEntries.find(p => p.colorCode === color)?.vendor;
      const colorMcq = getEffectiveMcqForColor(color, colorVendor, surchargeRules, MCQ, entries, mcqMoqPreferences);

      if (totalQty > 0 && totalQty < colorMcq) {
        moqAlerts.push({
          colorCode: color,
          week: w,
          originalQty: totalQty,
          targetMoq: colorMcq,
          moved: false,
          surchargeAmount: colorSurchargeUSD[color] ?? mcqSurchargeUSD,
          surchargeRuleApplied: colorSurchargeRuleApplied[color] || "USD/Color",
          surchargeRateApplied: colorSurchargeRateApplied[color] || `${mcqSurchargeUSD} USD/Color`
        });
      }
    });
  });

  // Step 3: Rounding cumulative propagation
  //
  // This MUST group by the same key the UI displays and evaluates MCQ
  // against — item description + color code — not by raw item code.
  // Source PR files routinely split one logical item/color across several
  // item codes (e.g. the main fabric code plus a "Z"-prefixed
  // placeholder/swatch/trim code carrying just a fraction of a unit), all
  // sharing one item description. Grouping the cascade by item code
  // instead ran the "shipment 1 always rounds up" rule independently once
  // per item code — e.g. a 485.03+74.68+82.32 fabric-code subtotal AND a
  // separate 1.0+0.5 Z-code subtotal for the same displayed row each got
  // their own ceiling (643->643.53->644 style rounding done twice),
  // summing to one unit more than ceiling the row's true combined total
  // once. Grouping by item description (matching the UI's own grouping)
  // guarantees the display row and the rounding math agree.
  const groupKeyOf = (p: PrEntry): string => `${p.itemDescription || p.itemCode}::${p.colorCode}`;
  const uniqueItemColors = Array.from(new Set(processedEntries.map(groupKeyOf)));
  let totalRoundingExcessCost = 0;

  // Summing many fractional PR quantities in floating point can drift by a
  // tiny amount (e.g. a true 701.0 landing as 700.999999999994, or a true
  // 420.0 landing as 420.00000000002). Math.ceil/Math.floor are exact —
  // they don't forgive that noise — so without cleanup, a shipment that's
  // genuinely a whole number (or exact to the source data's precision) can
  // silently round to the wrong integer depending on which side of the
  // true value the noise fell on. Snap to a much finer precision than any
  // real source quantity (source data is at most 1 decimal place) before
  // doing any ceil/floor/comparison logic.
  const cleanQtyFloat = (n: number): number => Math.round(n * 1e6) / 1e6;

  // Beyond pure floating-point noise, a shipment's summed quantity can
  // also be a REAL value that's already essentially a whole number to the
  // precision the source data actually carries (e.g. a true 701.0, or
  // 700.98 which the UI displays as "701.0"). The ceil-then-conditionally-
  // floor logic below exists to arbitrate between rounding up (excess
  // material) and rounding down (shortfall) when a shipment has a
  // meaningful fractional remainder — there's nothing to arbitrate when
  // the quantity is already whole, so those shipments skip the ceil/floor
  // machinery entirely and just use the nearest integer directly.
  const NEAR_INTEGER_TOLERANCE = 0.05;
  const isNearInteger = (n: number): boolean => Math.abs(n - Math.round(n)) < NEAR_INTEGER_TOLERANCE;

  uniqueItemColors.forEach(key => {
    const itemPrs = processedEntries.filter(p => groupKeyOf(p) === key);
    if (itemPrs.length === 0) return;

    const weekQuantities = S.map(w => {
      const prsInWeek = itemPrs.filter(p => p.assignedWeek === w);

      // A week that contains a manually-edited cell (via the MCQ Shipment
      // Calendar Matrix) is "settled" — the user's explicit number IS the
      // final quantity, not a fractional value awaiting a rounding
      // decision. Manual overrides never change originalQty (by design,
      // so the true source value stays visible in the UI), which means
      // this week's cascade input would otherwise still be computed from
      // the stale pre-edit originalQty — creating a target totally
      // disconnected from the actual (manually-set, already-integer)
      // total. Reconciling that gap by dumping it into "Rounding
      // Surcharge" misrepresents a manual business decision (e.g.
      // deliberately padding a color up to meet MCQ) as if it were a
      // side-effect of fractional rounding.
      const isManuallySettled = prsInWeek.some(p => {
        const desc = (p.itemDescription || p.itemCode).toUpperCase().trim();
        const colorUpper = p.colorCode.toUpperCase().trim();
        const cellKey = `${desc}__${colorUpper}__${w}`;
        return Object.keys(manualMatrixQtyOverrides || {}).some(k => k.toUpperCase() === cellKey);
      });

      return {
        week: w,
        // Use each PR's immutable originalQty (the true value extracted
        // directly from the uploaded PR file) as the basis for cumulative
        // rounding, NOT the current `qty` field — `qty` may already be a
        // whole number left over from a prior rounding pass (e.g. this
        // scenario was reprocessed after accepting a flag), and cascading
        // ceil/floor logic on an already-rounded number silently loses the
        // true fractional excess, corrupting every subsequent shipment's
        // round-up/round-down decision in the chain.
        // Manually-injected matrix overrides intentionally have
        // originalQty === 0 (there is no "original file" value for them),
        // so for those specific rows fall back to their current qty.
        qty: cleanQtyFloat(prsInWeek.reduce((sum, p) => sum + (p.originalQty > 0 ? p.originalQty : p.qty), 0)),
        prs: prsInWeek,
        isManuallySettled
      };
    });

    const activeWeeks = weekQuantities.filter(wq => wq.qty > 0);
    if (activeWeeks.length === 0) return;

    const qtys = activeWeeks.map(wq => wq.qty);
    const roundedQtys: number[] = [];
    const excesses: number[] = [];

    if (qtys.length > 0) {
      // Running "surplus bank": how much the cumulative rounded total is
      // currently ahead of the cumulative true original total. Shipment 1
      // is always rounded UP, seeding this bank with its own excess. Every
      // later shipment then draws down that bank to cover its own
      // fractional remainder (rounding DOWN) whenever the bank can fully
      // cover it, or rounds UP and adds its own excess into the bank when
      // it can't. This keeps the running rounded total always >= the
      // running true original total, while minimizing total excess
      // shipped — and it generalizes to any number of shipments in the
      // chain, not just a fixed comparison against shipment 1.
      //
      // Example: 559.238 -> ceil -> 560 (bank = 0.762)
      //          157.575: fractional 0.575 <= bank(0.762) -> floor -> 157 (bank = 0.762 - 0.575 = 0.187)
      //          1873.061: fractional 0.061 <= bank(0.187) -> floor -> 1873 (bank = 0.187 - 0.061 = 0.126)
      let surplus = 0;

      activeWeeks.forEach((wq, j) => {
        const qty_j = qtys[j];
        let rounded_j: number;

        if (wq.isManuallySettled) {
          // Skip the cascade entirely for a manually-settled week: the
          // current total (already an integer, from the user's edit) IS
          // the final answer — nothing to round, no excess to bank or
          // draw from.
          rounded_j = cleanQtyFloat(wq.prs.reduce((sum, p) => sum + p.qty, 0));
        } else if (j === 0) {
          // Shipment 1 always rounds up, establishing the initial bank —
          // this is a hard business rule with NO exception, so it must be
          // checked before the near-integer shortcut below. Otherwise an
          // item whose first shipment happens to land within
          // NEAR_INTEGER_TOLERANCE of a whole number (e.g. a real summed
          // quantity like 2132.006, not floating-point noise — noise is
          // already washed out by cleanQtyFloat/cleanQtyFloat's 1e-6
          // precision before this point) would get silently floored to
          // Math.round() instead of ceiled, undercounting the first
          // shipment and breaking the surplus bank every later shipment
          // in the chain draws from.
          rounded_j = Math.ceil(qty_j);
        } else if (isNearInteger(qty_j)) {
          rounded_j = Math.round(qty_j);
        } else {
          const fractional_j = cleanQtyFloat(qty_j - Math.floor(qty_j));
          // An exact tie (surplus === fractional remainder) favors
          // rounding UP, consistent with this app's established rounding
          // convention elsewhere.
          rounded_j = surplus > fractional_j ? Math.floor(qty_j) : Math.ceil(qty_j);
        }

        // A manually-settled week's delta is a deliberate business decision
        // (e.g. padding a color up to meet MCQ), not a rounding effect —
        // it must not feed into the surplus bank that arbitrates genuine
        // fractional round-up/round-down decisions on this item/color's
        // OTHER shipments. Only real rounding excess should ever bank or
        // draw from that surplus.
        if (!wq.isManuallySettled) {
          surplus = cleanQtyFloat(surplus + (rounded_j - qty_j));
        }
        roundedQtys.push(rounded_j);
        excesses.push(cleanQtyFloat(rounded_j - qty_j));
      });
    }

    activeWeeks.forEach((wq, index) => {
      const originalTotal = wq.qty;
      const roundedTotal = roundedQtys[index];
      const diff = roundedTotal - originalTotal;

      if (Math.abs(diff) > 0.0001 || wq.prs.some(pr => !Number.isInteger(pr.qty))) {
        // Round every PR in this week to a whole number first, so no PR is
        // ever left fractional (this previously caused messy per-cell
        // totals like 841.87 in the MCQ matrix, since only the latest PR
        // used to get rounded while the rest stayed fractional).
        //
        // This branch must also run whenever any individual PR is still
        // fractional even if the GROUP total already came out to a whole
        // number (diff ~ 0) — e.g. three PRs of 0.5 + 1.0 + 0.5 sum to an
        // exact 2.0 at the group level, but rounding each PR independently
        // (0.5->1, 1.0->1, 0.5->1) sums to 3, silently inventing a phantom
        // extra unit. Skipping residual reconciliation whenever diff was
        // merely small (the old behavior) let that phantom unit slip
        // through uncorrected. Reconciling against the true roundedTotal
        // here, in every case, guarantees the sum of individually-rounded
        // PRs always matches the cascade's intended total.
        wq.prs.forEach(pr => {
          pr.qty = Math.round(pr.qty);
        });
        // The individual roundings above may not sum exactly to the
        // intended weekly roundedTotal (which follows the ceil/floor logic
        // above, not simple per-PR rounding) — absorb that residual
        // entirely into the latest-due PR, consistent with the app's
        // stated design of compiling rounding/MOQ excess onto the latest
        // entry on that shipment date.
        const sorted = [...wq.prs].sort((a, b) => b.prDueDate.getTime() - a.prDueDate.getTime());
        const latestPr = sorted[0];
        const sumAfterIndividualRounding = wq.prs.reduce((sum, pr) => sum + pr.qty, 0);
        const residual = roundedTotal - sumAfterIndividualRounding;
        if (Math.abs(residual) > 0.0001) {
          latestPr.qty += residual;
          latestPr.qty = Math.round(latestPr.qty);
          latestPr.excessQty = (latestPr.excessQty || 0) + residual;
          totalRoundingExcessCost += residual * getPrPriceTHB(latestPr);
        }
      }
    });
  });

  // Step 4: Update properties of individual PRs (CBM, Days Early, Carrying & Opportunity Costs in THB)
  processedEntries.forEach(pr => {
    // Final PO Due Date is the week's actual landing date at VT Garment,
    // using THIS PR's own transit time (not the single global route
    // transit time) so that PR Due Date - PO Due Date always matches
    // PR Delivery Date - PO Delivery Date for this specific PR, even
    // when different PRs in the same group ship on different routes.
    // NOTE: pr.prDueDate holds "PR Delivery Date" data (ship-basis, used
    // for grouping); the true arrival-target "PR Due Date" lives in
    // pr.dueDateRaw and must be used below, paired against pr.poDueDate
    // (also arrival-basis) — see the fix note in the else branch below.
    const groupShipDate = getShipmentDateLocal(pr.assignedWeek!);
    const rowPoDueDate = new Date(groupShipDate);
    rowPoDueDate.setDate(rowPoDueDate.getDate() + getPrOwnTransitDays(pr) + warehouseStuckDays);
    pr.poDueDate = rowPoDueDate;
    
    // Final Days Early is: PR Due Date - PO Due Date
    // If daysEarlyExcel was provided, compute based on the delay from baseline
    if (pr.daysEarlyExcel !== undefined && pr.daysEarlyExcel !== null) {
      const week1PoDueDate = getPoDueDate(1);
      const delayedDays = getDaysDifference(week1PoDueDate, pr.poDueDate!);
      pr.daysEarly = pr.daysEarlyExcel - warehouseStuckDays - delayedDays;
    } else {
      // Days Early = PR Due Date - PO Due Date, using the true raw "Due
      // Date" source column (dueDateRaw, arrival-target), paired against
      // PO Due Date (also arrival-basis, groupShipDate + transit). Both
      // sides are arrival-basis dates, so per-PR transit time correctly
      // cancels out — mathematically equivalent to PR Delivery Date - PO
      // Delivery Date (validated against real Syteline exports). Using
      // pr.prDueDate here instead would mismatch a ship-basis date against
      // an arrival-basis date and produce a large, wrong negative offset.
      const diffDays = getDaysDifference(pr.dueDateRaw || pr.prDueDate, pr.poDueDate!);
      pr.daysEarly = diffDays;
    }

    // Recompute cbm for the PR's final qty. Prefer the stable per-unit
    // unitWeightRaw factor (Unit Weight × Quantity, per explicit design)
    // over a ratio against originalQty — a ratio-based recompute silently
    // DOUBLE-COUNTS any adjustment that already updated pr.cbm for the
    // current qty earlier in the pipeline (e.g. a manual Shipment
    // Calendar Matrix override), since pr.originalQty deliberately never
    // changes from such an edit. unitWeightRaw has no such problem: it's
    // a fixed per-unit factor, so qty × unitWeightRaw is correct no
    // matter how many times or in what order it gets recalculated.
    if (pr.unitWeightRaw !== undefined && pr.unitWeightRaw > 0) {
      pr.cbm = pr.qty * pr.unitWeightRaw;
    } else if (pr.originalQty > 0) {
      pr.cbm = pr.cbm * (pr.qty / pr.originalQty);
    } else {
      pr.cbm = 0;
    }

    // Calculate Shipment Value in THB: Material Cost + flat MCQ surcharge (if any)
    const shipmentValue = (pr.qty * getPrPriceTHB(pr)) + ((pr as any).flatSurchargeTHB || 0);
    const days = pr.daysEarly || 0;

    if (days > 0 && shipmentValue > 0) {
      // Carrying Cost_i = (Shipment Value_i ÷ 2) × Carrying Rate × (Days Early_i / 365)
      pr.carryingCost = (shipmentValue / 2) * carryingRate * (days / 365);
      
      // Opportunity Cost_i = Shipment Value_i × [ (1 + Opportunity Rate)^(Days Early_i / 365) − 1 ]
      pr.opportunityCost = shipmentValue * (Math.pow(1 + opportunityRate, days / 365) - 1);
    } else {
      pr.carryingCost = 0;
      pr.opportunityCost = 0;
    }
  });

  let totalWarehouseRentCost = 0;

  // Step 5: Group entries into shipment bins and calculate costs
  const shipmentGroups: ShipmentGroup[] = S.map(w => {
    const weekPrs = processedEntries.filter(p => p.assignedWeek === w);
    const totalCbm = weekPrs.reduce((sum, p) => sum + p.cbm, 0);
    const totalQty = weekPrs.reduce((sum, p) => sum + p.qty, 0);
    
    // Material Cost is calculated in THB
    const totalMaterialCost = weekPrs.reduce((sum, p) => sum + (p.qty * getPrPriceTHB(p)), 0);

    // force20ft applies only to the standard (non-MM) cargo stream.
    // The to-MM stream is a separate independent route and should not be
    // forced into FCL just because the standard stream is — it picks its
    // own optimal container type (including LCL when the volume is small).
    const force20ftStandard = (w === 4 && prefer20ftForOctober) || !!scenarioDef.force20ftGPForAllWeeks;

    // Split standard and to-MM items
    const standardPrs = weekPrs.filter(p => !String(p.id || "").trim().startsWith("2"));
    const toMmPrs = weekPrs.filter(p => String(p.id || "").trim().startsWith("2"));

    const standardCbm = standardPrs.reduce((sum, p) => sum + p.cbm, 0);
    const toMmCbm = toMmPrs.reduce((sum, p) => sum + p.cbm, 0);

    // Standard calculations
    const standardRouteQuote = getActiveRouteQuoteForWeek(w);
    const standardContainer = calculateContainers(standardCbm, standardRouteQuote, force20ftStandard);
    
    const standardImportedShipFrom = getImportedShipFrom("1", shipFrom);
    let standardCosts = { freight: 0, local: 0, brokerage: 0, exwork: 0 };
    
    if (standardCbm > 0) {
      const hasStandardQuote = importedFclQuotes && importedFclQuotes.length > 0 && importedFclQuotes.some(row => 
        (row.shipFrom || "").toUpperCase().trim() === standardImportedShipFrom.toUpperCase().trim() &&
        (standardContainer.isLcl ? row.containerLoad === "LCL" : row.containerLoad !== "LCL")
      );
      
      if (hasStandardQuote) {
        standardCosts = getImportedFclCosts(
          standardImportedShipFrom,
          standardContainer.num20gp,
          standardContainer.num40gp,
          standardContainer.num40hq,
          1,
          importedFclQuotes,
          exchangeRates,
          standardCbm,
          standardContainer.isLcl,
          incotermRules,
          standardPrs
        );
      } else {
        const standardCostsRaw = calculateRouteCosts(shipFrom, standardCbm, 1, standardContainer, standardRouteQuote, exchangeRates);
        standardCosts = { freight: standardCostsRaw.freight, local: standardCostsRaw.local, brokerage: standardCostsRaw.brokerage, exwork: standardCostsRaw.exwork };
      }
    }

    // to-MM calculations
    const toMmImportedShipFrom = getImportedShipFrom("2", shipFrom);
    const toMmRouteQuote = customRouteQuotes.find(q => (q.origin || "").toUpperCase().trim() === toMmImportedShipFrom.toUpperCase().trim()) || { ...standardRouteQuote, origin: toMmImportedShipFrom };
    // to-MM stream: never force 20ft — let it pick LCL if the volume fits
    const toMmContainer = calculateContainers(toMmCbm, toMmRouteQuote, false);
    
    let toMmCosts = { freight: 0, local: 0, brokerage: 0, exwork: 0 };
    
    if (toMmCbm > 0) {
      const hasToMmQuote = importedFclQuotes && importedFclQuotes.length > 0 && importedFclQuotes.some(row => 
        (row.shipFrom || "").toUpperCase().trim() === toMmImportedShipFrom.toUpperCase().trim() &&
        (toMmContainer.isLcl ? row.containerLoad === "LCL" : row.containerLoad !== "LCL")
      );
      
      if (hasToMmQuote) {
        toMmCosts = getImportedFclCosts(
          toMmImportedShipFrom,
          toMmContainer.num20gp,
          toMmContainer.num40gp,
          toMmContainer.num40hq,
          1,
          importedFclQuotes,
          exchangeRates,
          toMmCbm,
          toMmContainer.isLcl,
          incotermRules,
          toMmPrs
        );
      } else {
        const toMmCostsRaw = calculateRouteCosts(toMmImportedShipFrom, toMmCbm, 1, toMmContainer, toMmRouteQuote, exchangeRates);
        toMmCosts = { freight: toMmCostsRaw.freight, local: toMmCostsRaw.local, brokerage: toMmCostsRaw.brokerage, exwork: toMmCostsRaw.exwork };
      }
    }

    // Merge route costs
    let combinedFreight = standardCosts.freight + toMmCosts.freight;
    let combinedLocal = standardCosts.local + toMmCosts.local;
    let combinedBrokerage = standardCosts.brokerage + toMmCosts.brokerage;
    let combinedExwork = standardCosts.exwork + toMmCosts.exwork;

    // Manual container override for this shipment week, set from the
    // Shipment Containers & Bins tab. When present, it completely replaces
    // the auto-computed packing above (standard + to-MM streams are billed
    // together as a single mix) and freight/local/brokerage/exwork are
    // recalculated to match the user's chosen containers.
    const weekContainerOverride = containerOverrides && containerOverrides[w];
    let overrideContainerConfig: ContainerConfig | undefined;
    if (weekContainerOverride && totalCbm > 0) {
      overrideContainerConfig = buildManualContainerConfig(
        weekContainerOverride.num20gp,
        weekContainerOverride.num40gp,
        weekContainerOverride.num40hq,
        weekContainerOverride.numLcl || 0,
        weekContainerOverride.isLcl,
        totalCbm
      );
      // Bill against whichever stream's route quote is dominant for this
      // week (in the common case there is only one stream anyway).
      const overrideRouteQuote = standardCbm >= toMmCbm ? standardRouteQuote : toMmRouteQuote;
      const overrideCostsRaw = calculateRouteCosts(shipFrom, totalCbm, 1, overrideContainerConfig, overrideRouteQuote, exchangeRates);
      combinedFreight = overrideCostsRaw.freight;
      combinedLocal = overrideCostsRaw.local;
      combinedBrokerage = overrideCostsRaw.brokerage;
      combinedExwork = overrideCostsRaw.exwork;
      overrideContainerConfig.freightCost = combinedFreight;
    }

    // Carrying Cost and Opportunity Cost are the sum of individual PR costs (already in THB)
    const carryingCost = weekPrs.reduce((sum, p) => sum + (p.carryingCost || 0), 0);
    const opportunityCost = weekPrs.reduce((sum, p) => sum + (p.opportunityCost || 0), 0);

    const surchargeForWeek = weekSurcharges[w] || 0;
    
    // Calculate Warehouse Rent Cost
    let weekWarehouseRent = 0;
    if (warehouseStuckDays > 0) {
      const calcRent = (cnt: ContainerConfig) => {
        if (cnt.totalCbm <= 0) return 0;
        if (typeof warehouseDailyRent === "number") {
          if (!cnt.isLcl) {
            const containerCount = cnt.num20gp + cnt.num40gp + cnt.num40hq;
            return containerCount * warehouseStuckDays * warehouseDailyRent;
          }
          return 0;
        } else {
          if (cnt.isLcl) {
            return warehouseStuckDays * (warehouseDailyRent.lcl || 0);
          } else {
            const rent20 = cnt.num20gp * (warehouseDailyRent.gp20 || 0);
            const rent40 = cnt.num40gp * (warehouseDailyRent.gp40 || 0);
            const rentHq = cnt.num40hq * (warehouseDailyRent.hq40 || 0);
            return (rent20 + rent40 + rentHq) * warehouseStuckDays;
          }
        }
      };
      weekWarehouseRent = overrideContainerConfig
        ? calcRent(overrideContainerConfig)
        : calcRent(standardContainer) + calcRent(toMmContainer);
      totalWarehouseRentCost += weekWarehouseRent;
    }

    const totalLandedCost = totalMaterialCost + combinedFreight + combinedLocal + combinedBrokerage + combinedExwork + carryingCost + opportunityCost + surchargeForWeek + weekWarehouseRent;

    // Build the combined container configuration — use the manual override
    // wholesale if the user set one for this week, otherwise merge the
    // auto-computed standard + to-MM container picks as before.
    const container: ContainerConfig = overrideContainerConfig || {
      num20gp: standardContainer.num20gp + toMmContainer.num20gp,
      num40gp: standardContainer.num40gp + toMmContainer.num40gp,
      num40hq: standardContainer.num40hq + toMmContainer.num40hq,
      name: standardCbm > 0 && toMmCbm > 0
        ? `Std: ${standardContainer.name} | MM: ${toMmContainer.name}`
        : standardCbm > 0
          ? standardContainer.name
          : toMmContainer.name,
      isLcl: (standardCbm > 0 ? standardContainer.isLcl : true) && (toMmCbm > 0 ? toMmContainer.isLcl : true),
      totalCbm,
      freightCost: combinedFreight,
      status: (standardContainer.status === "NOT Acceptable" || toMmContainer.status === "NOT Acceptable")
        ? "NOT Acceptable"
        : (standardContainer.status === "Review Needed" || toMmContainer.status === "Review Needed")
          ? "Review Needed"
          : "Acceptable",
      statusDetails: `Std: ${standardContainer.statusDetails || ""} | MM: ${toMmContainer.statusDetails || ""}`,
      capacity: (standardCbm > 0 ? standardContainer.capacity : 0) + (toMmCbm > 0 ? toMmContainer.capacity : 0),
      excessCbm: (standardCbm > 0 ? standardContainer.excessCbm : 0) + (toMmCbm > 0 ? toMmContainer.excessCbm : 0)
    };

    return {
      week: w,
      date: getPoDueDate(w),
      shipmentDate: getShipmentDateLocal(w), // Include actual shipment date from port as requested
      totalCbm,
      totalQty,
      totalMaterialCost,
      container,
      freightCost: combinedFreight,
      localCost: combinedLocal,
      brokerageCost: combinedBrokerage,
      exworkCost: combinedExwork,
      carryingCost: Math.round(carryingCost * 100) / 100,
      opportunityCost: Math.round(opportunityCost * 100) / 100,
      moqSurchargeCost: surchargeForWeek,
      totalLandedCost: Math.round(totalLandedCost * 100) / 100,
      items: weekPrs
    };
  });

  const totalQty = processedEntries.reduce((sum, p) => sum + p.qty, 0);
  const totalOriginalQty = processedEntries.reduce((sum, p) => sum + p.originalQty, 0);
  const totalCbm = processedEntries.reduce((sum, p) => sum + p.cbm, 0);
  
  // Total Material Cost in THB
  const totalMaterialCost = processedEntries.reduce((sum, p) => sum + (p.qty * getPrPriceTHB(p)), 0);
  
  const totalFreightCost = shipmentGroups.reduce((sum, s) => sum + s.freightCost, 0);
  const totalLocalCost = shipmentGroups.reduce((sum, s) => sum + s.localCost, 0);
  const totalBrokerageCost = shipmentGroups.reduce((sum, s) => sum + s.brokerageCost, 0);
  const totalExworkCost = shipmentGroups.reduce((sum, s) => sum + s.exworkCost, 0);
  const totalCarryingCost = shipmentGroups.reduce((sum, s) => sum + s.carryingCost, 0);
  const totalOpportunityCost = shipmentGroups.reduce((sum, s) => sum + s.opportunityCost, 0);
  const totalLandedCost = shipmentGroups.reduce((sum, s) => sum + s.totalLandedCost, 0);

  // Calculate high-fidelity monthly consolidated container requirements dynamically based on shipment months
  let sepStdVol = 0;
  let sepMmVol = 0;
  let octStdVol = 0;
  let octMmVol = 0;

  shipmentGroups.forEach(s => {
    // 0-indexed, so 8 is September
    const isSept = s.date.getMonth() === 8;
    const stdVol = s.items.filter(p => !String(p.id || "").trim().startsWith("2")).reduce((sum, p) => sum + p.cbm, 0);
    const mmVol = s.items.filter(p => String(p.id || "").trim().startsWith("2")).reduce((sum, p) => sum + p.cbm, 0);
    if (isSept) {
      sepStdVol += stdVol;
      sepMmVol += mmVol;
    } else {
      octStdVol += stdVol;
      octMmVol += mmVol;
    }
  });

  const sepStdConfig = calculateContainers(sepStdVol, baseRouteQuote, !!scenarioDef.force20ftGPForAllWeeks);
  const sepMmConfig = calculateContainers(sepMmVol, baseRouteQuote, !!scenarioDef.force20ftGPForAllWeeks);
  const octStdConfig = calculateContainers(octStdVol, baseRouteQuote, prefer20ftForOctober || !!scenarioDef.force20ftGPForAllWeeks);
  const octMmConfig = calculateContainers(octMmVol, baseRouteQuote, prefer20ftForOctober || !!scenarioDef.force20ftGPForAllWeeks);

  const septemberContainersText = sepStdVol > 0 && sepMmVol > 0
    ? `Std: ${sepStdConfig.name} | MM: ${sepMmConfig.name}`
    : sepStdVol > 0
      ? sepStdConfig.name
      : sepMmVol > 0
        ? sepMmConfig.name
        : "None";

  const octoberContainersText = octStdVol > 0 && octMmVol > 0
    ? `Std: ${octStdConfig.name} | MM: ${octMmConfig.name}`
    : octStdVol > 0
      ? octStdConfig.name
      : octMmVol > 0
        ? octMmConfig.name
        : "None";

  const containerBreakdown = {
    septemberTotalVolume: Math.round((sepStdVol + sepMmVol) * 1000) / 1000,
    septemberContainers: septemberContainersText,
    octoberTotalVolume: Math.round((octStdVol + octMmVol) * 1000) / 1000,
    octoberContainers: octoberContainersText,
    shipmentBreakdowns: shipmentGroups.map(s => ({
      week: s.week,
      date: s.date,
      volume: Math.round(s.totalCbm * 1000) / 1000,
      containers: s.totalQty > 0 ? s.container.name : "None (No Items scheduled)",
      isLcl: s.container.isLcl
    }))
  };

  // Generate Error and Warning Flags
  const errorFlags: ErrorFlag[] = [];

  // Check for missing shipping quotes, incoterms, or surcharges
  const uniqueShipFroms = Array.from(new Set(processedEntries.map(pr => getImportedShipFrom(pr.id, pr.shipFrom))));
  uniqueShipFroms.forEach(shipFromStr => {
    const hasQuote = (importedFclQuotes || []).some(
      q => (q.shipFrom || "").toUpperCase().trim() === shipFromStr.toUpperCase().trim()
    );
    if (!hasQuote && shipFromStr) {
      errorFlags.push({
        type: "warning",
        category: "MissingInfo",
        message: `Missing Shipping Quote for Ship From "${shipFromStr}"`,
        details: `The uploaded PR contains ship from location "${shipFromStr}" which does not have any active shipping quotes in settings. Port local and freight charges will default to 0.`,
        messageKey: "flag.missingQuote.message",
        messageParams: { shipFrom: shipFromStr },
        detailsKey: "flag.missingQuote.details",
        detailsParams: { shipFrom: shipFromStr },
        shipFrom: shipFromStr
      });
    }
  });

  const uniqueIncotermKeys = new Set<string>();
  processedEntries.forEach(pr => {
    const shipFromStr = getImportedShipFrom(pr.id, pr.shipFrom);
    const vendorCode = (pr.vendor || "").toUpperCase().trim();
    const shipFromKey = shipFromStr.toUpperCase().trim();
    if (!vendorCode || !shipFromKey) return;
    const key = `${vendorCode}||${shipFromKey}`;
    if (uniqueIncotermKeys.has(key)) return;
    uniqueIncotermKeys.add(key);

    const hasRule = (incotermRules || []).some(
      r => r.vendorCode.toUpperCase().trim() === vendorCode &&
           r.shipFrom.toUpperCase().trim() === shipFromKey
    );
    if (!hasRule) {
      errorFlags.push({
        type: "warning",
        category: "MissingInfo",
        message: `Missing Incoterm Rule for Vendor "${pr.vendor}" and Ship From "${shipFromStr}"`,
        details: `There is no active Incoterm rule configured for vendor "${pr.vendor}" and ship from "${shipFromStr}". Sourcing default of FOB is assumed.`,
        messageKey: "flag.missingIncoterm.message",
        messageParams: { vendor: pr.vendor, shipFrom: shipFromStr },
        detailsKey: "flag.missingIncoterm.details",
        detailsParams: { vendor: pr.vendor, shipFrom: shipFromStr },
        vendorCode: pr.vendor,
        shipFrom: shipFromStr
      });
    }
  });

  const uniqueVendors = Array.from(new Set(processedEntries.map(pr => (pr.vendor || "").toUpperCase().trim()).filter(Boolean)));
  uniqueVendors.forEach(vendorCode => {
    const hasRules = (surchargeRules || []).some(
      r => (r.vendorCode || "").toUpperCase().trim() === vendorCode
    );
    const flagKey = `no_surcharge_vendor_${vendorCode}`;
    if (!hasRules && !acceptedFlags?.[flagKey]) {
      const samplePr = processedEntries.find(pr => (pr.vendor || "").toUpperCase().trim() === vendorCode);
      const originalVendorName = samplePr?.vendor || vendorCode;

      errorFlags.push({
        type: "warning",
        category: "MissingInfo",
        message: `Missing MCQ/MOQ Surcharge Config for Vendor "${originalVendorName}"`,
        details: `No MCQ or MOQ surcharge rule has been configured for vendor "${originalVendorName}". If this vendor has no minimum volume constraints, you may dismiss this warning.`,
        messageKey: "flag.missingSurcharge.message",
        messageParams: { vendor: originalVendorName },
        detailsKey: "flag.missingSurcharge.details",
        detailsParams: { vendor: originalVendorName },
        vendorCode: originalVendorName,
        flagKey,
        actionType: "no_surcharge"
      });
    }
  });

  // Flag any item/color still at $0 unit price after overrides — likely a
  // data entry error in the uploaded PR file, since a real $0 cost would
  // make landed cost, carrying cost, and opportunity cost calculations
  // meaningless for that item.
  zeroPriceCombos.forEach(combo => {
    errorFlags.push({
      type: "warning",
      category: "Price",
      message: `${combo.itemCode} / ${combo.colorCode} has a Unit Price of $0.00`,
      details: `This is likely a data entry error in the uploaded PR file. Landed cost, carrying cost, and opportunity cost for this item will be understated until corrected.`,
      messageKey: "flag.zeroPrice.message",
      messageParams: { itemCode: combo.itemCode, colorCode: combo.colorCode },
      detailsKey: "flag.zeroPrice.details",
      itemCode: combo.itemCode,
      colorCode: combo.colorCode
    });
  });

  
  if (isLclSameDay) {
    errorFlags.push({
      type: "info",
      category: "General",
      message: `Total volume is below 19 CBM (${totalCbmAll.toFixed(2)} CBM).`,
      details: `Optimized for LCL shipping: All items consolidated into a single shipment on the same day (Scenario 1) to minimize transport & handling costs.`,
      messageKey: "flag.lclSameDay.message",
      messageParams: { cbm: totalCbmAll.toFixed(2) },
      detailsKey: "flag.lclSameDay.details"
    });
  }
  
  shipmentGroups.forEach(s => {
    if (s.totalQty > 0 && s.container.status === "NOT Acceptable") {
      errorFlags.push({
        type: "error",
        category: "Container",
        message: `Shipment Week ${s.week} is overloaded!`,
        details: `CBM is ${s.totalCbm.toFixed(2)} which exceeds the capacity of ${s.container.capacity} CBM.`,
        messageKey: "flag.containerOverloaded.message",
        messageParams: { week: s.week },
        detailsKey: "flag.containerOverloaded.details",
        detailsParams: { cbm: s.totalCbm.toFixed(2), capacity: s.container.capacity }
      });
    } else if (s.totalQty > 0 && s.container.status === "Review Needed" && s.container.excessCbm && s.container.excessCbm > 0.005) {
      const flagKey = `container_tolerance_week_${s.week}`;
      if (!acceptedFlags?.[flagKey]) {
        errorFlags.push({
          type: "warning",
          category: "Container",
          message: `Shipment Week ${s.week} is close to container limit.`,
          details: `Over capacity by ${s.container.excessCbm?.toFixed(2)} CBM, within the 2.1 CBM tolerance.`,
          messageKey: "flag.containerCloseToLimit.message",
          messageParams: { week: s.week },
          detailsKey: "flag.containerCloseToLimit.details",
          detailsParams: { excessCbm: s.container.excessCbm?.toFixed(2) ?? "0" },
          flagKey,
          actionType: "accept_container_tolerance"
        });
      }
    }
  });

  processedEntries.forEach(pr => {
    const days = pr.daysEarly || 0;
    if (days < 0) {
      errorFlags.push({
        type: "error",
        category: "Delay",
        message: `Line ${pr.id} arrives LATE by ${Math.abs(days)} days!`,
        details: `PR Due Date: ${pr.prDueDate.toLocaleDateString()}, PO Due Date: ${pr.poDueDate?.toLocaleDateString()}.`,
        messageKey: "flag.lateArrival.message",
        messageParams: { id: pr.id, days: Math.abs(days) },
        detailsKey: "flag.lateArrival.details",
        detailsParams: { prDate: pr.prDueDate.toLocaleDateString(), poDate: pr.poDueDate?.toLocaleDateString() ?? "" }
      });
    }
  });

  const auditedConflictKeys = new Set<string>();

  colors.forEach(color => {
    const colorEntries = processedEntries.filter(p => p.colorCode === color);
    const colorVendor = colorEntries[0]?.vendor || entries.find(p => p.colorCode === color)?.vendor;
    const res = getMcqMoqResolution(color, colorVendor, surchargeRules, entries, MCQ, defaultMOQ, mcqMoqPreferences);

    const mcqConflictKey = `${colorVendor || ""}::${color}::MCQ`;
    const hasMcqSelection = !!(mcqMoqPreferences && mcqMoqPreferences[mcqConflictKey]);

    if (res.mcqHasConflict && !hasMcqSelection) {
      if (!auditedConflictKeys.has(mcqConflictKey)) {
        auditedConflictKeys.add(mcqConflictKey);
        errorFlags.push({
          type: "warning",
          category: "MCQ",
          message: `MCQ Conflict for ${color} (${colorVendor || "Vendor"}): PR File is ${res.prFileMcq?.toLocaleString()} YD vs Surcharge Rule is ${res.surchargeMcq?.toLocaleString()} YD`,
          details: `Currently applying ${res.mcqActiveSource === "pr_file" ? "PR File (" + res.effectiveMcq.toLocaleString() + " YD)" : "Surcharge Rule (" + res.effectiveMcq.toLocaleString() + " YD)"}. Priority defaults to Surcharge Rules unless overridden.`,
          messageKey: "flag.mcqConflict.message",
          messageParams: { color, vendor: colorVendor || "Vendor", prFileValue: res.prFileMcq?.toLocaleString() ?? "0", surchargeValue: res.surchargeMcq?.toLocaleString() ?? "0" },
          detailsKey: res.mcqActiveSource === "pr_file" ? "flag.conflict.details.prFile" : "flag.conflict.details.surchargeRule",
          detailsParams: { value: res.effectiveMcq.toLocaleString() },
          colorCode: color,
          conflictInfo: {
            key: mcqConflictKey,
            colorCode: color,
            vendor: colorVendor,
            type: "MCQ",
            prFileValue: res.prFileMcq!,
            surchargeValue: res.surchargeMcq!,
            activeValue: res.effectiveMcq,
            activeSource: res.mcqActiveSource === "pr_file" ? "pr_file" : "surcharge"
          }
        });
      }
    }

    const moqConflictKey = `${colorVendor || ""}::MOQ`;
    const hasMoqSelection = !!(mcqMoqPreferences && mcqMoqPreferences[moqConflictKey]);

    if (res.moqHasConflict && !hasMoqSelection) {
      if (!auditedConflictKeys.has(moqConflictKey)) {
        auditedConflictKeys.add(moqConflictKey);
        errorFlags.push({
          type: "warning",
          category: "MOQ",
          message: `MOQ Conflict for ${colorVendor || "Vendor"}: PR File is ${res.prFileMoq?.toLocaleString()} YD vs Surcharge Rule is ${res.surchargeMoq?.toLocaleString()} YD`,
          details: `Currently applying ${res.moqActiveSource === "pr_file" ? "PR File (" + res.effectiveMoq.toLocaleString() + " YD)" : "Surcharge Rule (" + res.effectiveMoq.toLocaleString() + " YD)"}. Priority defaults to Surcharge Rules unless overridden.`,
          messageKey: "flag.moqConflict.message",
          messageParams: { vendor: colorVendor || "Vendor", prFileValue: res.prFileMoq?.toLocaleString() ?? "0", surchargeValue: res.surchargeMoq?.toLocaleString() ?? "0" },
          detailsKey: res.moqActiveSource === "pr_file" ? "flag.conflict.details.prFile" : "flag.conflict.details.surchargeRule",
          detailsParams: { value: res.effectiveMoq.toLocaleString() },
          conflictInfo: {
            key: moqConflictKey,
            vendor: colorVendor,
            type: "MOQ",
            prFileValue: res.prFileMoq!,
            surchargeValue: res.surchargeMoq!,
            activeValue: res.effectiveMoq,
            activeSource: res.moqActiveSource === "pr_file" ? "pr_file" : "surcharge"
          }
        });
      }
    }

    S.forEach(w => {
      const weekEntries = processedEntries.filter(p => p.colorCode === color && p.assignedWeek === w);
      const q = weekEntries.reduce((sum, p) => sum + p.qty, 0);
      const colorMcq = res.effectiveMcq;
      if (q > 0 && q < colorMcq) {
        const flagKey = `mcq_under_penalty_${color}_week_${w}`;
        if (!acceptedFlags?.[flagKey]) {
          errorFlags.push({
            type: "warning",
            category: "MCQ",
            message: `${color} is under MCQ (${q.toFixed(0)}/${colorMcq} YD) on Shipment Date ${getShipmentDateLocal(w).toLocaleDateString()}`,
            details: `Incurred MCQ penalty surcharge.`,
            messageKey: "flag.underMcq.message",
            messageParams: { color, qty: q.toFixed(0), mcq: colorMcq, date: getShipmentDateLocal(w).toLocaleDateString() },
            detailsKey: "flag.underMcq.details",
            flagKey,
            actionType: "pay_mcq_surcharge",
            week: w,
            colorCode: color
          });
        }
      }
    });
  });

  // MOQ is a per-shipment minimum, not a one-time whole-order check: each
  // shipment must independently reach the minimum order quantity, since
  // each shipment is placed/loaded separately by the vendor. Checking only
  // the summed total across every shipment would let, e.g., 10 shipments
  // of 300 YD each (3,000 YD total) look "compliant" against a 3,000 YD
  // target even though every individual shipment actually falls far short.
  S.forEach(w => {
    const shipmentQty = processedEntries
      .filter(p => p.assignedWeek === w)
      .reduce((sum, p) => sum + p.qty, 0);
    if (shipmentQty > 0 && shipmentQty < defaultMOQ) {
      const shipmentDate = getShipmentDateLocal(w).toLocaleDateString();
      errorFlags.push({
        type: "warning",
        category: "MOQ",
        message: `Shipment ${w} total is under MOQ (${shipmentQty.toFixed(0)}/${defaultMOQ} YD) on Shipment Date ${shipmentDate}`,
        details: `This shipment alone falls short of the minimum order quantity requirement of ${defaultMOQ} YD.`,
        messageKey: "flag.shipmentUnderMoq.message",
        messageParams: { week: w, qty: shipmentQty.toFixed(0), moq: defaultMOQ, date: shipmentDate },
        detailsKey: "flag.shipmentUnderMoq.details",
        detailsParams: { moq: defaultMOQ },
        week: w
      });
    }
  });

  if (warehouseStuckDays > 0) {
    errorFlags.push({
      type: "info",
      category: "Warehouse",
      message: `Containers delayed by ${warehouseStuckDays} days in Port Warehouse.`,
      details: `Incurred warehouse storage rent of ${totalWarehouseRentCost.toLocaleString()} THB.`,
      messageKey: "flag.warehouseDelay.message",
      messageParams: { days: warehouseStuckDays },
      detailsKey: "flag.warehouseDelay.details",
      detailsParams: { thb: totalWarehouseRentCost.toLocaleString() }
    });
  }

  const currentPool: Array<"20GP" | "40GP" | "40HQ"> = [];
  shipmentGroups.forEach(s => {
    if (s.totalQty > 0 && !s.container.isLcl) {
      for (let i = 0; i < s.container.num20gp; i++) currentPool.push("20GP");
      for (let i = 0; i < s.container.num40gp; i++) currentPool.push("40GP");
      for (let i = 0; i < s.container.num40hq; i++) currentPool.push("40HQ");
    }
  });

  const existingContainerCount = Math.max(0, previouslyExistingContainers || 0);
  const adjustedContainerCount = Math.max(0, existingContainerCount > 0 ? Math.max(0, currentPool.length - existingContainerCount) : currentPool.length);
  const adjustedPool = currentPool.slice(0, adjustedContainerCount);

  let containerMatchingStatus: "Approved" | "Mismatch" = "Approved";
  let containerMatchingDetails = "Matches Scenario 1 total containers exactly.";
  let containerPoolMatchesBaseline = false;

  const isScenario1 = scenarioDef.id === "1";
  const hasOverloadedShipment = shipmentGroups.some(s => s.container.status === "NOT Acceptable");

  const doPoolsMatch = (pool1: string[], pool2: string[]) => {
    if (pool1.length !== pool2.length) return false;
    const count1: Record<string, number> = {};
    const count2: Record<string, number> = {};
    pool1.forEach(c => count1[c] = (count1[c] || 0) + 1);
    pool2.forEach(c => count2[c] = (count2[c] || 0) + 1);
    const keys = new Set([...Object.keys(count1), ...Object.keys(count2)]);
    for (const key of keys) {
      if (count1[key] !== count2[key]) return false;
    }
    return true;
  };

  if (isScenario1) {
    containerPoolMatchesBaseline = true;
    if (hasOverloadedShipment) {
      containerMatchingStatus = "Mismatch";
      containerMatchingDetails = "Baseline scenario contains overloaded shipment (exceeding elasticity capacity).";
    } else {
      containerMatchingStatus = "Approved";
      containerMatchingDetails = "Baseline scenario.";
    }
  } else if (scenario1ContainersPool) {
    const matched = doPoolsMatch(scenario1ContainersPool, adjustedPool);
    // Container type/count differing from the baseline scenario is expected and not itself
    // an issue, so it no longer affects the approval status.
    containerPoolMatchesBaseline = true;
    if (hasOverloadedShipment) {
      containerMatchingStatus = "Mismatch";
      containerMatchingDetails = "Flagged: Contains overloaded container configuration exceeding elastic capacity limit (+2.1 CBM per container).";
    } else {
      containerMatchingStatus = "Approved";
      containerMatchingDetails = matched
        ? "Matches Scenario 1 total containers exactly."
        : `Container mix differs from Scenario 1 ([${scenario1ContainersPool.join(", ") || "no FCL containers"}] vs [${adjustedPool.join(", ") || "no FCL containers"}]); this is expected and does not require review.`;
    }
  } else {
    containerPoolMatchesBaseline = true;
    containerMatchingStatus = hasOverloadedShipment ? "Mismatch" : "Approved";
  }

  if (hasOverloadedShipment) {
    errorFlags.push({
      type: "warning",
      category: "Container",
      message: `Requires manual review! Container configuration exceeds elastic capacity limit.`,
      details: containerMatchingDetails,
      messageKey: "flag.manualReview.message"
    });
  }

  return {
    id: scenarioDef.id,
    name: scenarioDef.name,
    weeks: S,
    numShipments: shipmentGroups.filter(s => s.totalQty > 0).length,
    processedEntries,
    shipments: shipmentGroups,
    moqAlerts,
    totalQty,
    totalOriginalQty,
    totalCbm,
    totalMaterialCost,
    totalRoundingExcessCost: Math.round(totalRoundingExcessCost * 100) / 100,
    totalMoqExcessCost: Math.round(totalMoqSurchargeCost * 100) / 100,
    totalFreightCost: Math.round(totalFreightCost * 100) / 100,
    totalLocalCost: Math.round(totalLocalCost * 100) / 100,
    totalBrokerageCost: Math.round(totalBrokerageCost * 100) / 100,
    totalExworkCost: Math.round(totalExworkCost * 100) / 100,
    totalCarryingCost: Math.round(totalCarryingCost * 100) / 100,
    totalOpportunityCost: Math.round(totalOpportunityCost * 100) / 100,
    totalLandedCost: Math.round(totalLandedCost * 100) / 100,
    containerMatchingStatus,
    containerMatchingDetails,
    containerPoolMatchesBaseline,
    containersUsedList: shipmentGroups.filter(s => s.totalQty > 0).map(s => s.container.name),
    containerBreakdown,
    mcqThreshold: MCQ,
    moqThreshold: defaultMOQ,
    errorFlags,
    warehouseRentCost: Math.round(totalWarehouseRentCost * 100) / 100,
    exchangeRates: exchangeRates
  };
}

export function distributeContainerPool(
  activeWeeksWithCbm: { week: number; cbm: number }[],
  pool: Array<"20GP" | "40GP" | "40HQ">,
  routeConfig?: RouteQuote
): Record<number, ContainerConfig> {
  const fcl20Cost = routeConfig && routeConfig.fcl20Freight > 0 ? routeConfig.fcl20Freight : 24163.2;
  const fcl40Cost = routeConfig && routeConfig.fcl40Freight > 0 ? routeConfig.fcl40Freight : 46312.8;

  const assignment: Record<number, { num20gp: number; num40gp: number; num40hq: number }> = {};
  activeWeeksWithCbm.forEach(({ week }) => {
    assignment[week] = { num20gp: 0, num40gp: 0, num40hq: 0 };
  });

  const sortedWeeks = [...activeWeeksWithCbm].sort((a, b) => b.cbm - a.cbm);
  const sortedPool = [...pool].sort((a, b) => {
    const cap = (x: string) => x === "40HQ" ? 65 : x === "40GP" ? 60 : 25;
    return cap(b) - cap(a);
  });

  const assignedCapacity: Record<number, number> = {};
  activeWeeksWithCbm.forEach(({ week }) => {
    assignedCapacity[week] = 0;
  });

  sortedPool.forEach(containerType => {
    let bestWeek = -1;
    let maxUncovered = -Infinity;

    sortedWeeks.forEach(({ week, cbm }) => {
      if (cbm <= 21.1) {
        return; // Skip if volume fits in LCL (<= 21.1 CBM under the elastic rule)
      }
      const uncovered = cbm - assignedCapacity[week];
      if (uncovered > maxUncovered) {
        maxUncovered = uncovered;
        bestWeek = week;
      }
    });

    if (bestWeek !== -1) {
      if (containerType === "20GP") {
        assignment[bestWeek].num20gp++;
        assignedCapacity[bestWeek] += 25;
      } else if (containerType === "40GP") {
        assignment[bestWeek].num40gp++;
        assignedCapacity[bestWeek] += 60;
      } else if (containerType === "40HQ") {
        assignment[bestWeek].num40hq++;
        assignedCapacity[bestWeek] += 65;
      }
    }
  });

  const result: Record<number, ContainerConfig> = {};
  activeWeeksWithCbm.forEach(({ week, cbm }) => {
    const { num20gp, num40gp, num40hq } = assignment[week];
    const capacity = num20gp * 25 + num40gp * 60 + num40hq * 65;

    if (capacity === 0 && cbm > 0) {
      const isOverTheoretical = cbm > 19.0;
      result[week] = {
        num20gp: 0,
        num40gp: 0,
        num40hq: 0,
        name: `LCL (${cbm.toFixed(2)}/19.00 CBM)`,
        isLcl: true,
        totalCbm: cbm,
        freightCost: 0,
        status: isOverTheoretical ? "Review Needed" : "Acceptable",
        statusDetails: isOverTheoretical
          ? `Squeezed (High Utilization / Elastic Capacity): Over LCL theoretical capacity (19 CBM) by ${Math.max(0, cbm - 19.0).toFixed(2)} CBM, but within +2.1 CBM tolerance.`
          : `Fully fits in LCL space (max 19 CBM).`,
        capacity: 19.0,
        excessCbm: Math.max(0, cbm - 19.0)
      };
    } else {
      // Elasticity applies only to 40ft and 40HQ — 20ft has zero tolerance
      const maxAllowedExcess = (num40gp + num40hq) * 2.1;
      const excessCbm = cbm - capacity > 0.005 ? cbm - capacity : 0;
      let status: "Acceptable" | "Review Needed" | "NOT Acceptable" = "Acceptable";
      let statusDetails = "";

      const configParts: string[] = [];
      if (num20gp > 0) configParts.push(`${num20gp}x 20ft`);
      if (num40gp > 0) configParts.push(`${num40gp}x 40ft`);
      if (num40hq > 0) configParts.push(`${num40hq}x 40HQ`);
      const configName = configParts.length > 0 ? configParts.join(" + ") + " FCL" : "Empty Container";

      if (excessCbm === 0 || cbm <= capacity) {
        status = "Acceptable";
        statusDetails = `Fully acceptable. Fits within ${configName} capacity of ${capacity} CBM.`;
      } else if (maxAllowedExcess > 0 && excessCbm <= maxAllowedExcess) {
        status = "Review Needed";
        statusDetails = `Squeezed (High Utilization / Elastic Capacity): Over container capacity by only ${excessCbm.toFixed(2)} CBM. Within the +${maxAllowedExcess.toFixed(1)} CBM elasticity limit (40ft/40HQ only). Acceptable pending physical loading review.`;
      } else {
        status = "NOT Acceptable";
        statusDetails = `Too much over the limit! Over capacity by ${excessCbm.toFixed(2)} CBM, which exceeds the allowed tolerance of ${configName} (${capacity} CBM${maxAllowedExcess > 0 ? ` + ${maxAllowedExcess.toFixed(1)} CBM elasticity` : ", no elasticity for 20ft"}).`;
      }

      const freightCost = num20gp * fcl20Cost + num40gp * fcl40Cost + num40hq * fcl40Cost;

      result[week] = {
        num20gp,
        num40gp,
        num40hq,
        name: `${configName} (${cbm.toFixed(2)}/${capacity}.00 CBM)`,
        isLcl: false,
        totalCbm: cbm,
        freightCost,
        status,
        statusDetails,
        capacity,
        excessCbm
      };
    }
  });

  return result;
}

/**
 * Compare all scenarios with Scenario 1 and flag those with different container configurations.
 */
export function processAllScenarios(
  entries: PrEntry[],
  D0: Date,
  maxWeeks: number,
  carryingRate: number,
  opportunityRate: number,
  defaultMOQ: number,
  shipFrom: string,
  enablePullForward: boolean = true,
  prefer20ftForOctober: boolean = false,
  shipmentDates: string[] = [],
  customRouteQuotes: RouteQuote[] = [],
  warehouseStuckDays: number = 0,
  warehouseDailyRent: WarehouseRentConfig | number = 1000,
  exchangeRates: Record<string, number>,
  mcqSurchargeUSD: number = 150,
  mcqSurchargeType: "flat" | "unitPriceIncrease" = "flat",
  excessOverrides: ExcessMcqOverride[] = [],
  vendorSurcharges: Record<string, number> = {},
  manualWeekOverrides: Record<string, Record<string, number>> = {},
  surchargeRules?: SurchargeRule[],
  importedFclQuotes?: ImportedFclQuote[],
  incotermRules?: IncotermRule[],
  defaultMCQ: number = 500,
  loadingDateRules?: LoadingDateRule[],
  previouslyExistingContainers: number = 0,
  manualMatrixQtyOverrides: Record<string, Record<string, number>> = {},
  unitPriceOverrides: Record<string, number> = {},
  mcqMoqPreferences?: Record<string, "surcharge" | "pr_file">,
  acceptedFlags?: Record<string, boolean>,
  containerOverrides: Record<string, Record<string, ContainerOverride>> = {}
): ProcessedScenario[] {
  const routeQuote = matchRouteQuote(shipFrom, customRouteQuotes);
  const transitTime = routeQuote ? routeQuote.transitTimeDays : 0;

  // Grouping must be driven by PR Delivery Date (ship-basis date), not PR
  // Due Date, so that it matches PR Delivery Date - PO Delivery Date /
  // PR Due Date - PO Due Date consistently even when different PRs ship
  // on routes with different real transit times. See processScenario's
  // getPrShipBasisDate for the row-level equivalent of this logic.
  const getShipBasisDate = (e: PrEntry): Date => {
    if (e.actualDelivery) {
      const d = new Date(e.actualDelivery);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000) return d;
    }
    let dueDate = e.prDueDate ? new Date(e.prDueDate) : new Date(2026, 8, 29);
    if (isNaN(dueDate.getTime())) dueDate = new Date(2026, 8, 29);
    const fallback = new Date(dueDate);
    fallback.setDate(fallback.getDate() - transitTime);
    return fallback;
  };

  const earliestPrDueDate = entries.reduce(
    (min, e) => {
      const d = getShipBasisDate(e);
      return d < min ? d : min;
    },
    new Date(2026, 11, 31)
  );

  const alignedBasePoDueDate = alignBasePoDueDateToLoadingRules(
    earliestPrDueDate,
    shipFrom,
    loadingDateRules || []
  );

  const entriesWithBaseDays = entries.map(e => {
    const d = getShipBasisDate(e);
    return {
       ...e,
       baseDaysEarly: getDaysDifference(d, alignedBasePoDueDate)
    };
  });

  const sortedBaseDays = Array.from(new Set(entriesWithBaseDays.map(e => e.baseDaysEarly))).sort((a, b) => a - b);
  
  const groups: { startDay: number; endDay: number }[] = [];
  if (sortedBaseDays.length > 0) {
    let currentGroupStart = sortedBaseDays[0];
    let currentGroupEnd = sortedBaseDays[0];
    
    for (let i = 1; i < sortedBaseDays.length; i++) {
       const day = sortedBaseDays[i];
       if (day - currentGroupStart <= 6) {
          currentGroupEnd = day;
       } else {
          groups.push({ startDay: currentGroupStart, endDay: currentGroupEnd });
          currentGroupStart = day;
          currentGroupEnd = day;
       }
    }
    groups.push({ startDay: currentGroupStart, endDay: currentGroupEnd });
  }

  interface GapInfo {
    index: number;
    size: number;
    splitAfterDaysEarly: number;
    nextDaysEarly: number;
  }

  const allGaps: GapInfo[] = [];
  for (let i = 0; i < groups.length - 1; i++) {
    allGaps.push({
      index: i,
      size: groups[i+1].startDay - groups[i].endDay,
      splitAfterDaysEarly: groups[i].endDay,
      nextDaysEarly: groups[i+1].startDay
    });
  }

  const sortedGapsDesc = [...allGaps].sort((a, b) => b.size - a.size);

  // Scenario 1 (Baseline, single shipment): internally evaluate both an
  // LCL-preferred and a 20ft-FCL-preferred packing strategy, but only ever
  // surface the cheaper of the two as "Scenario 1". The .1 / .2 suffix is
  // reserved exclusively for real gap-tie split variants (see below), so we
  // never expose two separate baseline cards here.
  const s1Lcl = processScenario(
    entries,
    {
      id: "1",
      numShipments: 1,
      weeks: [1],
      name: "Scenario 1 (Baseline)",
      splitDaysEarly: []
    },
    D0,
    carryingRate,
    opportunityRate,
    defaultMOQ,
    shipFrom,
    enablePullForward,
    false,
    shipmentDates,
    customRouteQuotes,
    warehouseStuckDays,
    warehouseDailyRent,
    exchangeRates,
    mcqSurchargeUSD,
    mcqSurchargeType,
    excessOverrides,
    containerOverrides["1"],
    undefined,
    vendorSurcharges,
    manualWeekOverrides["1"],
    surchargeRules,
    importedFclQuotes,
    incotermRules,
    defaultMCQ,
    loadingDateRules,
    previouslyExistingContainers,
    manualMatrixQtyOverrides["1"],
    unitPriceOverrides,
    mcqMoqPreferences,
    acceptedFlags
  );

  const s1Fcl = processScenario(
    entries,
    {
      id: "1",
      numShipments: 1,
      weeks: [1],
      name: "Scenario 1 (Baseline)",
      force20ftGPForAllWeeks: true,
      splitDaysEarly: []
    },
    D0,
    carryingRate,
    opportunityRate,
    defaultMOQ,
    shipFrom,
    enablePullForward,
    true,
    shipmentDates,
    customRouteQuotes,
    warehouseStuckDays,
    warehouseDailyRent,
    exchangeRates,
    mcqSurchargeUSD,
    mcqSurchargeType,
    excessOverrides,
    containerOverrides["1"],
    undefined,
    vendorSurcharges,
    manualWeekOverrides["1"],
    surchargeRules,
    importedFclQuotes,
    incotermRules,
    defaultMCQ,
    loadingDateRules,
    0, // previouslyExistingContainers for fcl
    manualMatrixQtyOverrides["1"],
    unitPriceOverrides,
    mcqMoqPreferences,
    acceptedFlags
  );

  // Pick whichever packing strategy is actually cheaper; ties default to LCL.
  const s1Processed = s1Fcl.totalLandedCost < s1Lcl.totalLandedCost - 0.01 ? s1Fcl : s1Lcl;

  const results: ProcessedScenario[] = [s1Processed];

  // Helper to generate combinations of array items safely with a max cap
  function getCombinations<T>(array: T[], r: number, max: number = 50): T[][] {
    if (r <= 0 || array.length < r) return [];
    if (r === 1) return array.slice(0, max).map(a => [a]);
    if (r === array.length) return [array.slice()];
    const combinations: T[][] = [];
    for (let i = 0; i <= array.length - r; i++) {
      if (combinations.length >= max) break;
      const head = array.slice(i, i + 1);
      const tailCombinations = getCombinations(array.slice(i + 1), r - 1, max - combinations.length);
      for (const tail of tailCombinations) {
        combinations.push(head.concat(tail));
        if (combinations.length >= max) break;
      }
    }
    return combinations;
  }

  // Scenarios 2 through min(groups.length, maxWeeks) — maxWeeks now tracks
  // entries.length from the caller so it never truncates the true dynamic
  // group count.
  const maxScenarios = Math.min(groups.length, maxWeeks || 12);
  for (let numShipments = 2; numShipments <= maxScenarios; numShipments++) {
    const numSplits = numShipments - 1;
    if (numSplits > sortedGapsDesc.length) break;

    const thresholdSize = sortedGapsDesc[numSplits - 1].size;
    const definiteGaps = sortedGapsDesc.filter(g => g.size > thresholdSize);
    const borderlineGaps = sortedGapsDesc.filter(g => g.size === thresholdSize);
    const neededBorderline = numSplits - definiteGaps.length;

    // Generate a scenario variant for every valid combination of tied
    // largest gaps (e.g. 2.1, 2.2, 2.3...), not just the first 3. A high
    // safety ceiling is kept only to guard against pathological data with
    // an extreme number of exactly-tied gaps.
    const combos = getCombinations(borderlineGaps, neededBorderline).slice(0, 50);

    combos.forEach((combo, idx) => {
      const selectedGaps = [...definiteGaps, ...combo];
      const splitPoints = selectedGaps.map(g => g.splitAfterDaysEarly).sort((a, b) => a - b);
      
      const sId = combos.length === 1 ? `${numShipments}` : `${numShipments}.${idx + 1}`;
      let sName = `Scenario ${sId} (${numShipments} Shipments)`;
      
      const processed = processScenario(
        entries,
        {
          id: sId,
          numShipments,
          weeks: Array.from({ length: numShipments }, (_, i) => i + 1),
          name: sName,
          splitDaysEarly: splitPoints
        },
        D0,
        carryingRate,
        opportunityRate,
        defaultMOQ,
        shipFrom,
        enablePullForward,
        prefer20ftForOctober,
        shipmentDates,
        customRouteQuotes,
        warehouseStuckDays,
        warehouseDailyRent,
        exchangeRates,
        mcqSurchargeUSD,
        mcqSurchargeType,
        excessOverrides,
        containerOverrides[sId] || containerOverrides[`${numShipments}`],
        undefined,
        vendorSurcharges,
        manualWeekOverrides[sId] || manualWeekOverrides[`${numShipments}`],
        surchargeRules,
        importedFclQuotes,
        incotermRules,
        defaultMCQ,
        loadingDateRules,
        previouslyExistingContainers,
        manualMatrixQtyOverrides[sId] || manualMatrixQtyOverrides[`${numShipments}`],
        unitPriceOverrides,
        mcqMoqPreferences,
        acceptedFlags
      );
      results.push(processed);
    });
  }

  return results;
}

export interface FleetCombination {
  num40hq: number;
  num40gp: number; // 40ft
  num20gp: number; // 20ft
  numLcl: number;  // 0 or 1
  lclVolume: number;
  totalCapacity: number;
  freightCost: number;
  localCost: number;
  brokerageCost: number;
  exworkCost: number;
  warehouseRent: number;
  totalLogisticsCost: number;
}

export interface FleetScenarioResult {
  id: string;
  name: string;
  numShipments: number;
  legVolume: number;
  totalCbm: number;
  materialValue: number;
  moqPenalty: number;
  carryingCost: number;
  opportunityCost: number;
  combinations: {
    combination: FleetCombination;
    trueLandedCost: number;
    description: string;
  }[];
}

export function findValidCombinationsForSingleRoute(
  V: number,
  shipFrom: string,
  customRouteQuotes: RouteQuote[],
  exchangeRates: Record<string, number>,
  warehouseStuckDays: number,
  warehouseDailyRent: WarehouseRentConfig | number,
  importedFclQuotes?: ImportedFclQuote[],
  incotermRules?: IncotermRule[],
  weekPrs?: PrEntry[]
): FleetCombination[] {
  const routeQuote = matchRouteQuote(shipFrom, customRouteQuotes);
  const USD_TO_THB = exchangeRates["USD"] || 35.0;

  // 20ft has NO elasticity (hard cap 25 CBM); 40ft and 40HQ each get +2.1 CBM elasticity.
  const isValidCombo = (h: number, f: number, t: number, l: number): boolean => {
    const baseCapacity = h * 65 + f * 60 + t * 25;
    // Only 40ft (f) and 40HQ (h) contribute to elasticity; 20ft (t) does not
    const elasticity = (h + f) * 2.1;
    const fclCapacity = baseCapacity + elasticity;
    
    if (l === 0) {
      return (h + f + t) > 0 && fclCapacity >= V;
    } else {
      const remaining = V - baseCapacity;
      return remaining > 0 && remaining <= 21.1;
    }
  };

  const isMinimal = (h: number, f: number, t: number, l: number): boolean => {
    if (h > 0 && isValidCombo(h - 1, f, t, l)) return false;
    if (f > 0 && isValidCombo(h, f - 1, t, l)) return false;
    if (t > 0 && isValidCombo(h, f, t - 1, l)) return false;
    if (l > 0 && isValidCombo(h, f, t, l - 1)) return false;
    return true;
  };

  const rawCombinations: { h: number; f: number; t: number; l: number; lclVol: number }[] = [];
  const maxH = Math.ceil(V / 65) + 1;
  const maxF = Math.ceil(V / 60) + 1;

  for (let h = 0; h <= maxH; h++) {
    const remH = V - h * 67.1;
    const maxF_h = Math.min(maxF, Math.max(0, Math.ceil(remH / 62.1) + 1));
    for (let f = 0; f <= maxF_h; f++) {
      for (let l = 0; l <= 1; l++) {
        // Direct O(1) computation of candidate t values
        // 20ft has no elasticity, so effective 20ft capacity = exactly 25 CBM each
        const candidateTs: number[] = [];
        if (l === 0) {
          const remAfterLarge = V - h * 67.1 - f * 62.1;
          const reqT = Math.max(0, Math.ceil(remAfterLarge / 25.0));
          candidateTs.push(reqT);
        } else {
          // l === 1
          const minT = Math.max(0, Math.ceil((V - 21.1 - h * 65 - f * 60) / 25));
          const maxT_lcl = Math.max(0, Math.floor((V - 0.001 - h * 65 - f * 60) / 25));
          for (let t = minT; t <= maxT_lcl; t++) {
            candidateTs.push(t);
          }
        }

        for (const t of candidateTs) {
          if (isValidCombo(h, f, t, l)) {
            if (isMinimal(h, f, t, l)) {
              const fclCapacity = h * 65 + f * 60 + t * 25;
              const lclVol = l === 1 ? Math.max(0, V - fclCapacity) : 0;
              rawCombinations.push({ h, f, t, l, lclVol });
            }
          }
        }
      }
    }
  }

  const results: FleetCombination[] = rawCombinations.map(combo => {
    const { h, f, t, l, lclVol } = combo;

    let freight = 0;
    let local = 0;
    let brokerage = 0;
    let exwork = 0;
    let warehouseRent = 0;

    // FCL portion
    if (h > 0 || f > 0 || t > 0) {
      const normalizedShipFrom = (shipFrom || "").toUpperCase().trim();
      const hasFclQuote = importedFclQuotes && importedFclQuotes.length > 0 && importedFclQuotes.some(row => (row.shipFrom || "").toUpperCase().trim() === normalizedShipFrom && row.containerLoad !== "LCL");
      
      if (hasFclQuote) {
        const fclCosts = getImportedFclCosts(
          shipFrom,
          t,
          f,
          h,
          1,
          importedFclQuotes!,
          exchangeRates,
          V - lclVol,
          false,
          incotermRules,
          weekPrs
        );
        freight += fclCosts.freight;
        local += fclCosts.local;
        brokerage += fclCosts.brokerage;
        exwork += fclCosts.exwork;
      } else {
        const fclContainer: ContainerConfig = {
          num20gp: t,
          num40gp: f,
          num40hq: h,
          isLcl: false,
          name: "FCL Portion",
          totalCbm: V - lclVol,
          freightCost: 0
        };
        const fclCosts = calculateRouteCosts(shipFrom, V - lclVol, 1, fclContainer, routeQuote, exchangeRates);
        freight += fclCosts.freight;
        local += fclCosts.local;
        brokerage += fclCosts.brokerage;
        exwork += fclCosts.exwork;
      }

      if (warehouseStuckDays > 0) {
        if (typeof warehouseDailyRent === "number") {
          warehouseRent += (h + f + t) * warehouseStuckDays * warehouseDailyRent;
        } else {
          const rent20 = t * (warehouseDailyRent.gp20 || 0);
          const rent40 = f * (warehouseDailyRent.gp40 || 0);
          const rentHq = h * (warehouseDailyRent.hq40 || 0);
          warehouseRent += (rent20 + rent40 + rentHq) * warehouseStuckDays;
        }
      }
    }

    // LCL portion
    if (l === 1 && lclVol > 0) {
      const normalizedShipFrom = (shipFrom || "").toUpperCase().trim();
      const hasLclQuote = importedFclQuotes && importedFclQuotes.length > 0 && importedFclQuotes.some(row => (row.shipFrom || "").toUpperCase().trim() === normalizedShipFrom && row.containerLoad === "LCL");

      if (hasLclQuote) {
        const lclCosts = getImportedFclCosts(
          shipFrom,
          0,
          0,
          0,
          1,
          importedFclQuotes!,
          exchangeRates,
          lclVol,
          true,
          incotermRules,
          weekPrs
        );
        freight += lclCosts.freight;
        local += lclCosts.local;
        brokerage += lclCosts.brokerage;
        exwork += lclCosts.exwork;
      } else {
        const lclContainer: ContainerConfig = {
          num20gp: 0,
          num40gp: 0,
          num40hq: 0,
          isLcl: true,
          name: "LCL Portion",
          totalCbm: lclVol,
          freightCost: 0
        };
        const lclCosts = calculateRouteCosts(shipFrom, lclVol, 1, lclContainer, routeQuote, exchangeRates);
        freight += lclCosts.freight;
        local += lclCosts.local;
        brokerage += lclCosts.brokerage;
        exwork += lclCosts.exwork;
      }

      if (warehouseStuckDays > 0) {
        if (typeof warehouseDailyRent === "number") {
          warehouseRent += warehouseStuckDays * warehouseDailyRent;
        } else {
          warehouseRent += warehouseStuckDays * (warehouseDailyRent.lcl || 0);
        }
      }
    }

    const totalLogisticsCost = freight + local + brokerage + exwork + warehouseRent;

    return {
      num40hq: h,
      num40gp: f,
      num20gp: t,
      numLcl: l,
      lclVolume: lclVol,
      totalCapacity: h * 65 + f * 60 + t * 25 + (l === 1 ? 19 : 0),
      freightCost: freight,
      localCost: local,
      brokerageCost: brokerage,
      exworkCost: exwork,
      warehouseRent,
      totalLogisticsCost
    };
  });

  return results.sort((a, b) => a.totalLogisticsCost - b.totalLogisticsCost);
}

export function findValidCombinations(
  V: number,
  shipFrom: string,
  customRouteQuotes: RouteQuote[],
  exchangeRates: Record<string, number>,
  warehouseStuckDays: number,
  warehouseDailyRent: WarehouseRentConfig | number,
  importedFclQuotes?: ImportedFclQuote[],
  entries?: PrEntry[],
  incotermRules?: IncotermRule[]
): FleetCombination[] {
  // Check if we have entries that split into Standard vs "to MM"
  const prs = entries || [];
  const standardPrs = prs.filter(e => !String(e.id || "").trim().startsWith("2"));
  const toMmPrs = prs.filter(e => String(e.id || "").trim().startsWith("2"));

  const hasStandard = standardPrs.length > 0;
  const hasToMm = toMmPrs.length > 0;

  if (hasStandard && hasToMm && importedFclQuotes && importedFclQuotes.length > 0) {
    const standardShipFrom = getImportedShipFrom("1", shipFrom);
    const toMmShipFrom = getImportedShipFrom("2", shipFrom);

    const standardCbmAll = standardPrs.reduce((sum, e) => sum + (e.cbm || 0), 0);
    const totalCbmAll = standardCbmAll + toMmPrs.reduce((sum, e) => sum + (e.cbm || 0), 0);
    const standardRatio = totalCbmAll > 0 ? standardCbmAll / totalCbmAll : 0.5;

    const V_standard = V * standardRatio;
    const V_toMm = V * (1 - standardRatio);

    const standardCombos = findValidCombinationsForSingleRoute(
      V_standard,
      standardShipFrom,
      customRouteQuotes,
      exchangeRates,
      warehouseStuckDays,
      warehouseDailyRent,
      importedFclQuotes,
      incotermRules,
      standardPrs
    );

    const toMmCombos = findValidCombinationsForSingleRoute(
      V_toMm,
      toMmShipFrom,
      customRouteQuotes,
      exchangeRates,
      warehouseStuckDays,
      warehouseDailyRent,
      importedFclQuotes,
      incotermRules,
      toMmPrs
    );

    const mergedCombos: FleetCombination[] = [];
    const limitS = Math.min(standardCombos.length, 5);
    const limitT = Math.min(toMmCombos.length, 5);

    for (let i = 0; i < limitS; i++) {
      for (let j = 0; j < limitT; j++) {
        const sc = standardCombos[i];
        const tc = toMmCombos[j];

        mergedCombos.push({
          num40hq: sc.num40hq + tc.num40hq,
          num40gp: sc.num40gp + tc.num40gp,
          num20gp: sc.num20gp + tc.num20gp,
          numLcl: sc.numLcl || tc.numLcl ? 1 : 0,
          lclVolume: sc.lclVolume + tc.lclVolume,
          totalCapacity: sc.totalCapacity + tc.totalCapacity,
          freightCost: sc.freightCost + tc.freightCost,
          localCost: sc.localCost + tc.localCost,
          brokerageCost: sc.brokerageCost + tc.brokerageCost,
          exworkCost: sc.exworkCost + tc.exworkCost,
          warehouseRent: sc.warehouseRent + tc.warehouseRent,
          totalLogisticsCost: sc.totalLogisticsCost + tc.totalLogisticsCost
        });
      }
    }

    return mergedCombos.sort((a, b) => a.totalLogisticsCost - b.totalLogisticsCost);
  }

  // Fallback to single route
  const singleRouteShipFrom = hasToMm && !hasStandard ? getImportedShipFrom("2", shipFrom) : getImportedShipFrom("1", shipFrom);
  return findValidCombinationsForSingleRoute(
    V,
    singleRouteShipFrom,
    customRouteQuotes,
    exchangeRates,
    warehouseStuckDays,
    warehouseDailyRent,
    importedFclQuotes,
    incotermRules,
    prs
  );
}

export function calculateFleetScenarios(
  entries: PrEntry[],
  carryingRate: number,
  opportunityRate: number,
  defaultMOQ: number,
  shipFrom: string,
  enablePullForward: boolean,
  prefer20ftForOctober: boolean,
  shipmentDates: string[],
  customRouteQuotes: RouteQuote[],
  warehouseStuckDays: number,
  warehouseDailyRent: WarehouseRentConfig | number,
  exchangeRates: Record<string, number>,
  mcqSurchargeUSD: number,
  mcqSurchargeType: "flat" | "unitPriceIncrease",
  excessOverrides: ExcessMcqOverride[],
  vendorSurcharges: Record<string, number>,
  surchargeRules?: SurchargeRule[],
  importedFclQuotes?: ImportedFclQuote[],
  incotermRules?: IncotermRule[],
  defaultMCQ: number = 500,
  previouslyExistingContainers: number = 0,
  manualMatrixQtyOverrides: Record<string, Record<string, number>> = {}
): FleetScenarioResult[] {
  if (entries.length === 0) return [];

  const D0 = entries.reduce((min, e) => e.prDueDate < min ? e.prDueDate : min, entries[0].prDueDate);

  // 1. Process standard timing configurations to get high-fidelity financial costs
  // Scenario 1: 1 Shipment (weeks = [1])
  const s1Sim = processScenario(
    entries,
    { id: "f1", numShipments: 1, weeks: [1], name: "1 Shipment" },
    D0, carryingRate, opportunityRate, defaultMOQ, shipFrom,
    enablePullForward, prefer20ftForOctober, shipmentDates, customRouteQuotes,
    warehouseStuckDays, warehouseDailyRent, exchangeRates,
    mcqSurchargeUSD, mcqSurchargeType, excessOverrides, undefined, undefined,
     vendorSurcharges, undefined, surchargeRules,
    importedFclQuotes, incotermRules, defaultMCQ, undefined, previouslyExistingContainers,
    manualMatrixQtyOverrides["1"]
  );

  // Scenario 2: 2 Shipments (weeks = [1, 4])
  const s2Sim = processScenario(
    entries,
    { id: "f2", numShipments: 2, weeks: [1, 4], name: "2 Shipments" },
    D0, carryingRate, opportunityRate, defaultMOQ, shipFrom,
    enablePullForward, prefer20ftForOctober, shipmentDates, customRouteQuotes,
    warehouseStuckDays, warehouseDailyRent, exchangeRates,
    mcqSurchargeUSD, mcqSurchargeType, excessOverrides, undefined, undefined,
     vendorSurcharges, undefined, surchargeRules,
    importedFclQuotes, incotermRules, defaultMCQ, undefined, previouslyExistingContainers,
    manualMatrixQtyOverrides["2"]
  );

  // Scenario 3: 3 Shipments (weeks = [1, 2, 4])
  const s3Sim = processScenario(
    entries,
    { id: "f3", numShipments: 3, weeks: [1, 2, 4], name: "3 Shipments" },
    D0, carryingRate, opportunityRate, defaultMOQ, shipFrom,
    enablePullForward, prefer20ftForOctober, shipmentDates, customRouteQuotes,
    warehouseStuckDays, warehouseDailyRent, exchangeRates,
    mcqSurchargeUSD, mcqSurchargeType, excessOverrides, undefined, undefined,
     vendorSurcharges, undefined, surchargeRules,
    importedFclQuotes, incotermRules, defaultMCQ, undefined, previouslyExistingContainers,
    manualMatrixQtyOverrides["3"]
  );

  const totalCbm = s1Sim.totalCbm; // total CBM is the same across scenarios

  const scenariosDef = [
    { id: "1", name: "Scenario 1 (1 Shipment)", numShipments: 1, simResult: s1Sim },
    { id: "2", name: "Scenario 2 (2 Shipments)", numShipments: 2, simResult: s2Sim },
    { id: "3", name: "Scenario 3 (3 Shipments)", numShipments: 3, simResult: s3Sim }
  ];

  const results: FleetScenarioResult[] = scenariosDef.map(sc => {
    const legVolume = totalCbm / sc.numShipments;
    
    // Generate valid combinations for this leg volume
    const validCombos = findValidCombinations(
      legVolume,
      shipFrom,
      customRouteQuotes,
      exchangeRates,
      warehouseStuckDays,
      warehouseDailyRent,
      importedFclQuotes,
      entries,
      incotermRules
    );

    const materialValue = sc.simResult.totalMaterialCost;
    const moqPenalty = sc.simResult.totalMoqExcessCost;
    const carryingCost = sc.simResult.totalCarryingCost;
    const opportunityCost = sc.simResult.totalOpportunityCost;

    const combinationsMapped = validCombos.map(combo => {
      // Multiply leg logistics cost by numShipments
      const totalFreightCost = combo.totalLogisticsCost * sc.numShipments;
      const trueLandedCost = materialValue + moqPenalty + totalFreightCost + carryingCost + opportunityCost;

      // Construct description string
      const descParts: string[] = [];
      if (combo.num40hq > 0) descParts.push(`${combo.num40hq}x 40HQ`);
      if (combo.num40gp > 0) descParts.push(`${combo.num40gp}x 40ft`);
      if (combo.num20gp > 0) descParts.push(`${combo.num20gp}x 20ft`);
      if (combo.numLcl > 0) descParts.push(`LCL (${combo.lclVolume.toFixed(2)} CBM)`);
      const legDesc = descParts.length > 0 ? descParts.join(" + ") : "None";
      const description = sc.numShipments === 1 ? legDesc : `Per leg: ${legDesc}`;

      return {
        combination: combo,
        trueLandedCost: Math.round(trueLandedCost * 100) / 100,
        description
      };
    });

    // Sort combinations by trueLandedCost ascending
    combinationsMapped.sort((a, b) => a.trueLandedCost - b.trueLandedCost);

    return {
      id: sc.id,
      name: sc.name,
      numShipments: sc.numShipments,
      legVolume,
      totalCbm,
      materialValue,
      moqPenalty,
      carryingCost,
      opportunityCost,
      combinations: combinationsMapped
    };
  });

  return results;
}

