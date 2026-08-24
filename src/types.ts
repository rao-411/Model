export interface PrEntry {
  id: string;
  requisitionRaw?: string; // Original Requisition field from upload (preserve exact formatting)
  itemCode: string;
  itemDescription: string;
  colorCode: string;
  qty: number;           // Final quantity, modified by MOQ or rounding
  originalQty: number;   // Original quantity from user upload
  unitPrice: number;     // Price per unit (Baht or USD depending on currency)
  prDueDate: Date;       // Ship-basis date used for grouping/Days Early math (mapped from "PR Delivery Date" in real Syteline exports)
  dueDateRaw?: Date;     // The raw "Due Date" source column, preserved separately for display as "PR Due Date" in reports — NOT used for grouping/Days Early math
  cbm: number;           // Volume in CBM
  moq: number;           // MOQ threshold for this item/color (Order Minimum)
  mcq?: number;          // MCQ threshold (Order MCQ)
  shipFrom?: string;     // Ship From location from uploaded data
  incoterm?: string;     // Incoterm from uploaded data
  assignedWeek?: number; // Shipment week assigned in this scenario (e.g., 1, 2, 3...)
  poDueDate?: Date;      // Expected arrival date at VT Garment (Shipment Date + Transit Time)
  daysEarly?: number;    // Days early: PR Due Date - PO Due Date
  excessQty?: number;    // Quantity added due to MOQ or rounding
  daysEarlyExcel?: number; // Pre-calculated Days Early from uploaded file
  actualDelivery?: Date; // Actual Delivery date from uploaded file
  currencyRate?: number; // Mapped currency exchange rate from sheet row
  currency?: string;     // Mapped currency code (USD, EUR, HKD, THB) from sheet row
  carryingCost?: number;  // Carrying cost penalty in THB
  opportunityCost?: number; // Capital opportunity cost in THB
  vendor?: string;       // Vendor code / Vendor Name from planning sheet
  customerCode?: string; // Mapped Customer Code from sheet row
  size?: string;         // Mapped Size from sheet row
  transitLeadTimeDays?: number;   // Per-PR transit lead time in days, from the uploaded "Transit Lead Time (Days)" column. When present, this is the source of truth for this PR's transit time — it takes priority over both the actualDelivery-derived estimate and the route's default transit time.
  consolidateWeekdayRaw?: string; // Per-PR consolidation/loading weekday(s), from the uploaded "Consolidate (Weekday)" column (e.g. "Tuesday", "Tue/Fri", "2,5"). When present, this is the source of truth for which weekday(s) this PR's shipment can load on — it takes priority over the shipFrom-based default loading-day rule.
  naturalAssignedWeek?: number;   // The shipment this PR belonged to right after Days Early grouping / manual overrides, before the loading-day reassignment pass or MOQ/MCQ pull-forward moved anything. Used by the UI to show each shipment's true "before optimization" quantity, since `assignedWeek` itself changes once those passes run.

  // --- Raw pass-through fields captured verbatim from the uploaded PR file ---
  // These are captured by exact column name/position (bypassing the fuzzy
  // auto-detect heuristics used for the fields above) so the Combined/Separated
  // Excel exports can reproduce the source PR file's values exactly, even when
  // the source file has duplicate header names (e.g. two "Line" columns, four
  // "Currency" columns).
  lineRaw?: string;                      // Raw "Line" column (first occurrence, the Requisition line number) — used for "PR Line" in the Separated Excel export
  refCoRaw?: string;                     // Raw "Ref.CO" column
  termDescriptionRaw?: string;           // Raw "Term Description" column -> "Payment Term"
  incoTermCodeRaw?: string;              // Raw "Inco Term Code" column -> "Incoterm"
  techDescRaw?: string;                  // Raw "Tech  Desc" column -> "Tech Des"
  seasonRaw?: string;                    // Raw "Season" column
  buyerRaw?: string;                     // Raw "Buyer" column -> "Buy"
  planCostRaw?: number;                  // Raw "Plan Cost" column (unadjusted, as uploaded) -> "Plan Cost" / Amount calc
  planExtendedCostCurrencyRaw?: string;  // Raw "Currency" column immediately to the right of "Plan Extended Cost"
  orderMultipleRaw?: number;             // Raw "Order Multiple" column
  unitWeightRaw?: number;                // Raw "Unit Weight" column
  uomRaw?: string;                       // Raw "U/M" column (first occurrence)
  freightRaw?: number;                   // Raw "Freight" column (per-unit freight cost component from the PR file)
  dutyRaw?: number;                      // Raw "Duty" column
  brokerageRaw?: number;                 // Raw "Brokerage" column
  insuranceRaw?: number;                 // Raw "Insurance" column
  localFreightRaw?: number;              // Raw "Local Freight" column
}

export interface CustomFeeItem {
  id: string;
  name: string;
  type: "flat" | "perCbm" | "per20gp" | "per40gp" | "per40hq" | "allFcl";
  amount: number;
}

export interface RouteQuote {
  id: string;
  origin: string; // Country / origin name, e.g. "Taiwan"
  transitTimeDays: number;
  effectiveDate?: string; // Validity starting date, e.g. "2026-09-01"
  expiryDate?: string;    // Validity ending date, e.g. "2026-10-15" (optional)
  
  // Freight charges
  lclFreightPerCbm: number;
  fcl20Freight: number;
  fcl40Freight: number;
  fcl40hqFreight: number;
  customFreightFees: CustomFeeItem[];
  
  // Local charges
  lclLocalPerCbm: number;
  lclLocalPerShipment: number;
  fcl20LocalThc: number;
  fcl20LocalCleaning: number;
  fcl20LocalEmc: number;
  fcl40LocalThc: number;
  fcl40LocalCleaning: number;
  fcl40LocalEmc: number;
  fcl40hqLocalThc: number;
  fcl40hqLocalCleaning: number;
  fcl40hqLocalEmc: number;
  fclLocalPerShipment: number; // Combined or fallback fee
  fclLocalPerShipmentDo?: number; // D/O Fee (e.g. 1400 THB)
  fclLocalPerShipmentHandling?: number; // Handling Charge (e.g. 400 THB)
  fcl20ImbalanceSurchargeUsd?: number; // 20' Imbalance Surcharge in USD (e.g. 60 USD)
  fcl40ImbalanceSurchargeUsd?: number; // 40' Imbalance Surcharge in USD (e.g. 120 USD)
  fcl40hqImbalanceSurchargeUsd?: number; // 40HQ Imbalance Surcharge in USD (e.g. 120 USD)
  customLocalFees: CustomFeeItem[];
  
  // Brokerage charges
  brokerageLclBaseTier1: number; // <= 3 CBM
  brokerageLclBaseTier2: number; // <= 5 CBM
  brokerageLclBaseTier3: number; // > 5 CBM
  brokerageLclHandlingPerCbm: number; // default 80
  brokerageLclAdmissionPerCbm: number; // default 30
  
  // FCL 20ft Brokerage breakdown
  brokerageFcl20Clearance: number; // default 4800
  brokerageFcl20LiftOn: number; // default 1650
  brokerageFcl20Admission: number; // default 100
  brokerageFcl20OverTime: number; // default 400
  brokerageFcl20ExtendPeriod: number; // default 500
  brokerageFcl20FacilitiesUsage: number; // default 200
  brokerageFcl20AdmissionSecond: number; // default 238.82
  brokerageFcl20LiftOff: number; // default 600
  
  // FCL 40ft Brokerage breakdown
  brokerageFcl40Clearance: number; // default 5700
  brokerageFcl40LiftOn: number; // default 2650
  brokerageFcl40Admission: number; // default 200
  brokerageFcl40OverTime: number; // default 400
  brokerageFcl40ExtendPeriod: number; // default 500
  brokerageFcl40FacilitiesUsage: number; // default 200
  brokerageFcl40AdmissionSecond: number; // default 238.82
  brokerageFcl40LiftOff: number; // default 1200
  
  // FCL 40hq Brokerage breakdown
  brokerageFcl40hqClearance: number; // default 5700
  brokerageFcl40hqLiftOn: number; // default 2650
  brokerageFcl40hqAdmission: number; // default 200
  brokerageFcl40hqOverTime: number; // default 400
  brokerageFcl40hqExtendPeriod: number; // default 500
  brokerageFcl40hqFacilitiesUsage: number; // default 200
  brokerageFcl40hqAdmissionSecond: number; // default 238.82
  brokerageFcl40hqLiftOff: number; // default 1200
  
  customBrokerageFees: CustomFeeItem[];
  
  // Exwork charges
  customExworkFees: CustomFeeItem[];
}

export type ShippingQuote = RouteQuote; // Maintain backwards compatibility name alias if needed

export interface ExcessMcqOverride {
  id: string;
  colorCode: string;
  additionalQty: number;
  itemCode?: string;
  itemDescription?: string;
  prDueDateStr?: string;
  pricePerUnit?: number;
  cbmPerUnit?: number;
  targetWeek?: number;
}

export interface McqMoqConflictInfo {
  key: string;
  colorCode?: string;
  vendor?: string;
  type: "MCQ" | "MOQ";
  prFileValue: number;
  surchargeValue: number;
  activeValue: number;
  activeSource: "surcharge" | "pr_file";
}

export interface ErrorFlag {
  type: "error" | "warning" | "info";
  category: "MOQ" | "MCQ" | "Container" | "Delay" | "Warehouse" | "General" | "Price" | "MissingInfo";
  message: string;
  details?: string;
  // Optional structured i18n keys + params so the UI can render a fully
  // translated message/details in the active language, while `message`/
  // `details` above remain as the English fallback (also used verbatim in
  // Excel exports, which are always English regardless of UI language).
  messageKey?: string;
  messageParams?: Record<string, string | number>;
  detailsKey?: string;
  detailsParams?: Record<string, string | number>;
  // Populated for Price flags so the UI can offer an inline fix.
  itemCode?: string;
  colorCode?: string;
  // Populated for MCQ flags so the UI can re-check them against manual
  // Shipment Calendar Matrix quantity overrides without re-running the optimizer.
  week?: number;
  conflictInfo?: McqMoqConflictInfo;
  flagKey?: string;
  actionType?: "accept_container_tolerance" | "pay_mcq_surcharge" | "no_surcharge";
  vendorCode?: string;
  shipFrom?: string;
}


export interface ContainerConfig {
  num20gp: number;
  num40gp: number;
  num40hq: number;
  name: string;
  isLcl: boolean;
  // Number of LCL "shares" (each a nominal 19 CBM) blended in alongside the
  // FCL containers above, when this is a mixed LCL+FCL mix. 0/undefined for
  // a pure-FCL or pure-LCL config. Only set on manual overrides — the
  // auto-computed packer never mixes LCL with FCL containers.
  numLcl?: number;
  totalCbm: number;
  freightCost: number;
  status?: "Acceptable" | "Review Needed" | "NOT Acceptable";
  statusDetails?: string;
  capacity?: number;
  excessCbm?: number;
}

// A user-selected manual container mix for a single shipment, entered in
// the Shipment Containers & Bins tab. When set for a given shipment week,
// it replaces the auto-computed container packing (and its freight/local/
// brokerage costs are recalculated against this exact mix).
export interface ContainerOverride {
  num20gp: number;
  num40gp: number;
  num40hq: number;
  // Number of LCL shares (each a nominal 19 CBM) to blend in alongside the
  // FCL counts above. Can be combined with FCL containers — any actual
  // volume beyond the FCL containers' combined capacity is billed as LCL.
  // 0 means no LCL portion. When this is >0 and no FCL containers are set,
  // the whole shipment ships pure LCL.
  numLcl: number;
  // True only for a pure-LCL override (numLcl > 0 and no FCL containers).
  // Kept for backward compatibility with the "LCL" preset and older saved
  // overrides; derived automatically by the UI, not user-editable directly.
  isLcl: boolean;
}

export interface RouteConfig {
  origin: string;
  transitTimeDays: number;
  lclFreightPerCbm: number;
  lclLocalPerCbm: number;
  lclLocalPerShipment: number;
  fcl20Freight: number;
  fcl40Freight: number;
  fcl20Local: number;
  fcl40Local: number;
  fclLocalPerShipment: number;
  brokerageLclBase: number;
  brokerageLclPerCbm: number;
  brokerageFcl20: number;
  brokerageFcl40: number;
  vatApplied: boolean;
}

export interface ScenarioDef {
  id: string;          // e.g. "1", "2.1", "3.2"
  numShipments: number; // e.g. 1, 2, 3
  weeks: number[];     // active weeks, e.g. [1, 3, 4]
  name: string;        // e.g. "Scenario 2.1 (Weeks 1, 2)"
  force20ftGPForAllWeeks?: boolean;
  assignments?: Record<string, { week: number; poDueDate: Date; daysEarly: number }>;
  splitDaysEarly?: number[];
}

export interface LoadingDateRule {
  id: string;
  country: string;
  allowedDays: number[]; // 0 to 6 (0=Sunday, 1=Monday, 2=Tuesday, etc.)
}

export interface ShipmentGroup {
  week: number;
  date: Date;            // Arrival date (PO Due Date)
  shipmentDate?: Date;   // Actual shipment date from port
  totalCbm: number;
  totalQty: number;
  totalMaterialCost: number;
  container: ContainerConfig;
  freightCost: number;
  localCost: number;
  brokerageCost: number;
  exworkCost: number;    // EXWORK (Origin Local) charges, broken out as their own line item (only non-zero when Incoterm is EXW)
  carryingCost: number;
  opportunityCost: number;
  moqSurchargeCost?: number;
  totalLandedCost: number;
  items: PrEntry[];
}

export interface MoqAlert {
  colorCode: string;
  week: number;
  originalQty: number;
  targetMoq: number;
  moved: boolean;
  movedToWeek?: number;
  surchargeAmount?: number;
  surchargeRuleApplied?: string; // e.g. "USD/Color" or "Flat"
  surchargeRateApplied?: string; // e.g. "150.00 USD" or "10%"
}

export interface ScenarioContainerBreakdown {
  septemberTotalVolume: number;
  septemberContainers: string;
  octoberTotalVolume: number;
  octoberContainers: string;
  shipmentBreakdowns: {
    week: number;
    date: Date;
    volume: number;
    containers: string;
    isLcl: boolean;
  }[];
}

export interface ProcessedScenario {
  id: string;
  name: string;
  weeks: number[];
  numShipments: number;
  processedEntries: PrEntry[];
  shipments: ShipmentGroup[];
  moqAlerts: MoqAlert[];
  
  // Aggregated totals for the scenario (THB)
  totalQty: number;
  totalOriginalQty: number;
  totalCbm: number;
  totalMaterialCost: number;
  totalRoundingExcessCost: number;
  totalMoqExcessCost: number;
  totalFreightCost: number;
  totalLocalCost: number;
  totalBrokerageCost: number;
  totalExworkCost: number;
  totalCarryingCost: number;
  totalOpportunityCost: number;
  totalLandedCost: number;
  
  // Container match vs Scenario 1
  containerMatchingStatus: "Approved" | "Mismatch";
  containerMatchingDetails?: string;
  containerPoolMatchesBaseline?: boolean;
  containersUsedList: string[]; // List of container types used in shipments
  containerBreakdown: ScenarioContainerBreakdown;
  mcqThreshold?: number; // Store the MCQ threshold used for this run
  moqThreshold?: number; // Store the MOQ threshold used for this run
  errorFlags?: ErrorFlag[]; // Structured error and warning logs
  warehouseRentCost?: number; // Sum of port warehouse storage costs
  exchangeRates?: Record<string, number>; // Exchange rate used for USD/THB translation
}

export interface WarehouseRentConfig {
  gp20: number;
  gp40: number;
  hq40: number;
  lcl: number;
}

export interface SurchargeRule {
  id: string;
  customerCodeRaw?: string;
  vendorCode?: string;
  itemDescription?: string;
  color?: string;
  size?: string;
  qtyOrAmount: "Qty" | "Amount";
  min?: number;
  max?: number; // undefined or empty means infinity
  surchargeType: string; // "USD/Color" | "% of Unit Price/Color" | "USD/PO" | "USD/Color/Unit"
  amount: number;
  currency: string;
}

export interface ImportedFclQuote {
  id: string;
  containerLoad: string; // e.g. "FCL"
  containerSize: number; // 20 or 40
  shipFrom: string;      // e.g. "Taiwan Keelung"
  expenseType: string;   // "FREIGHT", "LOCAL", "BROKERAGE", "EXWORK"
  paymentType: string;   // "BY CONTAINER", "BY SHIPMENT", "BY CBM", "BY CBM (TIERED)"
  amount: number;
  currency: string;
  // Populated when the source "Payment Type" cell was a tiered bracket like
  // "BY CBM (1-4)" or "BY CBM (11-14)" — a flat fee that applies only when
  // the shipment's total CBM falls within [cbmTierMin, cbmTierMax], NOT a
  // per-CBM rate to multiply and NOT additive with the other tiers. A plain
  // "BY CBM" row (no range in the source) has both left undefined and is
  // treated as a genuine linear per-CBM rate, typically covering volumes
  // above the highest defined tier.
  cbmTierMin?: number;
  cbmTierMax?: number;
}

export interface IncotermRule {
  id: string;
  vendorCode: string;
  shipFrom: string;
  incoterm: string;
  source: "default" | "data" | "manual";
}


