import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, Database, Check, AlertCircle, FileSpreadsheet, RefreshCw, HelpCircle } from "lucide-react";
import { PrEntry } from "../types";
import { Language, t } from "../utils/translate";
import { loadSamplePrEntries } from "../data";

interface PrUploaderProps {
  onDataLoaded: (entries: PrEntry[]) => void;
  currentCount: number;
  lang: Language;
}

export default function PrUploader({ onDataLoaded, currentCount, lang }: PrUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  // States for interactive column mapping if auto-mapping fails
  const [rawRows, setRawRows] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    itemCode: "",
    colorCode: "",
    qty: "",
    unitPrice: "",
    prDueDate: "",
    cbm: "",
    moq: "",
    daysEarlyExcel: "",
    currencyRate: "",
    currency: "",
    vendor: ""
  });
  const [showMappingGui, setShowMappingGui] = useState(false);

  // Row-aligned raw pass-through values (Ref.CO, Line, Term Description, etc.)
  // captured by exact column name/position rather than the fuzzy auto-detect
  // heuristics above. Needed for the Combined/Separated Excel exports to
  // reproduce the uploaded PR file's values exactly.
  const [extraRawFields, setExtraRawFields] = useState<Record<string, any>[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Builds one raw-field object per data row by reading the sheet positionally
  // (header:1), since the source PR file commonly has duplicate header names
  // (e.g. two "Line" columns, four "Currency" columns) that collide when
  // parsed as a plain object via sheet_to_json's default named-key mode.
  const buildExtraRawFields = (sheet: XLSX.WorkSheet, rowCount: number): Record<string, any>[] => {
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
    if (aoa.length === 0) return [];

    const headerRow = (aoa[0] || []).map(h => String(h ?? ""));
    const bodyRows = aoa.slice(1);

    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
    const findIdx = (name: string, which: "first" | "last" = "first"): number => {
      const target = normalize(name);
      const matches: number[] = [];
      headerRow.forEach((h, i) => { if (normalize(h) === target) matches.push(i); });
      if (matches.length === 0) return -1;
      return which === "first" ? matches[0] : matches[matches.length - 1];
    };

    const idxLine = findIdx("Line", "first");
    const idxRefCo = findIdx("Ref.CO");
    const idxTermDesc = findIdx("Term Description");
    const idxIncoTermCode = findIdx("Inco Term Code");
    const idxTechDesc = findIdx("Tech Desc"); // normalize() collapses the source's double space
    const idxSeason = findIdx("Season");
    const idxBuyer = findIdx("Buyer");
    const idxPlanCost = findIdx("Plan Cost");
    const idxPlanExtendedCost = findIdx("Plan Extended Cost");
    const idxOrderMultiple = findIdx("Order Multiple");
    const idxUnitWeight = findIdx("Unit Weight");
    const idxUom = findIdx("U/M", "first");
    const idxCurrencyAfterExtended = idxPlanExtendedCost >= 0 ? idxPlanExtendedCost + 1 : -1;
    const idxFreight = findIdx("Freight");
    const idxDuty = findIdx("Duty");
    const idxBrokerage = findIdx("Brokerage");
    const idxInsurance = findIdx("Insurance");
    const idxLocalFreight = findIdx("Local Freight");

    const getCell = (r: number, c: number): any => (c >= 0 && r < bodyRows.length && bodyRows[r] && bodyRows[r][c] !== undefined) ? bodyRows[r][c] : "";
    const getStr = (r: number, c: number): string | undefined => {
      const v = getCell(r, c);
      return v !== "" && v !== null && v !== undefined ? String(v).trim() : undefined;
    };
    const getNum = (r: number, c: number): number | undefined => {
      const v = getCell(r, c);
      if (v === "" || v === null || v === undefined) return undefined;
      const n = parseFloat(String(v).replace(/,/g, ""));
      return isNaN(n) ? undefined : n;
    };

    const out: Record<string, any>[] = [];
    for (let i = 0; i < rowCount; i++) {
      out.push({
        lineRaw: getStr(i, idxLine),
        refCoRaw: getStr(i, idxRefCo),
        termDescriptionRaw: getStr(i, idxTermDesc),
        incoTermCodeRaw: getStr(i, idxIncoTermCode),
        techDescRaw: getStr(i, idxTechDesc),
        seasonRaw: getStr(i, idxSeason),
        buyerRaw: getStr(i, idxBuyer),
        planCostRaw: getNum(i, idxPlanCost),
        planExtendedCostCurrencyRaw: getStr(i, idxCurrencyAfterExtended)?.toUpperCase(),
        orderMultipleRaw: getNum(i, idxOrderMultiple),
        unitWeightRaw: getNum(i, idxUnitWeight),
        uomRaw: getStr(i, idxUom),
        freightRaw: getNum(i, idxFreight),
        dutyRaw: getNum(i, idxDuty),
        brokerageRaw: getNum(i, idxBrokerage),
        insuranceRaw: getNum(i, idxInsurance),
        localFreightRaw: getNum(i, idxLocalFreight)
      });
    }
    return out;
  };

  // Auto-detect matching headers
  const autoDetectMapping = (sheetHeaders: string[]): Record<string, string> => {
    const map: Record<string, string> = {
      itemCode: "",
      itemDescription: "",
      colorCode: "",
      qty: "",
      unitPrice: "",
      prDueDate: "",
      requisition: "",
      cbm: "",
      moq: "",
      mcq: "",
      shipFrom: "",
      incoterm: "",
      customerCode: "",
      size: "",
      daysEarlyExcel: "",
      actualDelivery: "",
      dueDateRaw: "",
      currencyRate: "",
      currency: "",
      vendor: "",
      transitLeadTimeDays: "",
      consolidateWeekday: ""
    };

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    let prDueDateScore = 0;
    let itemCodeScore = 0;
    let qtyScore = 0;
    let unitPriceScore = 0;

    sheetHeaders.forEach(h => {
      const norm = normalize(h);

      const isPrDeliveryCandidate = /pr\s*delivery|prdelivery|deliverydate|vendorloading|vendorloadingdate/.test(norm);
      const isActualDeliveryCandidate = /actual\s*delivery|actualdelivery|actualdeliverydate/.test(norm);
      const isGenericDelivery = /delivery|vendorloading|vendor\s*loading/.test(norm);

      // Prefer explicit "Actual Delivery" headers first, then PR Delivery variants,
      // then any generic delivery-like header as a last resort.
      if (isActualDeliveryCandidate) {
        map.actualDelivery = h;
      } else if (isPrDeliveryCandidate && !map.actualDelivery) {
        map.actualDelivery = h;
      } else if (isGenericDelivery && !map.actualDelivery) {
        map.actualDelivery = h;
      }
      // Preserve the literal "Due Date" column separately for display as
      // "PR Due Date" in reports. This is independent of prDueDate scoring
      // below (which correctly prioritizes "PR Delivery Date" for
      // grouping/Days Early math) — Due Date and PR Delivery Date are two
      // different real-world dates and must not be conflated.
      if ((norm === "duedate" || norm.includes("requiredduedate")) && !map.dueDateRaw) {
        map.dueDateRaw = h;
      }

      if (norm.includes("buyrate") || norm.includes("exchangerate") || norm.includes("exrate") || norm.includes("currencyrate") || (norm.includes("rate") && !norm.includes("carrying") && !norm.includes("interest") && !norm.includes("tax") && !norm.includes("urate"))) {
        map.currencyRate = h;
      } else if (norm === "currency" || norm === "curr" || norm === "currencycode" || norm === "currency_code") {
        map.currency = h;
      }
      
      if (norm === "vendor" || norm === "vendorcode" || norm === "vendor_code" || norm === "supplier") {
        map.vendor = h;
      } else if ((norm === "name" || norm === "vendorname" || norm === "vendor_name" || norm === "suppliername") && !map.vendor) {
        map.vendor = h;
      }
      
      if (norm === "itemdescription" || norm === "description" || norm === "sldescription" || norm === "desc") {
        map.itemDescription = h;
      }

      // Requisition / PR ID detection
      // NOTE: some source files (e.g. Syteline exports) also contain a
      // "Requisition Cost" column. Its normalized name ("requisitioncost")
      // also contains "requisition", so it must be explicitly excluded or it
      // will silently overwrite the real Requisition ID mapping below.
      const isRequisitionCostOrDerivative = /cost|price|amount|value|total|extended/.test(norm);
      const isRequisitionCandidate =
        !isRequisitionCostOrDerivative &&
        (norm.includes("requisition") || norm.includes("prno") || norm === "prno" || norm.includes("prnumber") || norm.includes("refpo") || norm === "ref");
      if (isRequisitionCandidate) {
        const isExactRequisitionMatch = norm === "requisition" || norm === "requisitionno";
        // An exact "Requisition" / "Requisition No." header always takes
        // priority, regardless of the order columns appear in the file.
        if (isExactRequisitionMatch || !map.requisition) {
          map.requisition = h;
        }
      }
      
      // Priority scoring for Qty to avoid derived/aggregate columns like
      // "Qty Received" or "QtyBalanceCol" (remaining balance, not the
      // original PR line quantity) silently outranking the real "Ordered"
      // column just because they happen to appear later in the file and
      // also contain "qty" — this was a genuine bug: adding more columns
      // to a source export (e.g. Syteline growing from a handful of
      // columns to 80+) could silently re-point Ordered Quantity at an
      // unrelated balance/received column with no error shown.
      let qtyPickScore = 0;
      if (norm === "ordered" || norm === "orderqty" || norm === "orderedqty") {
        qtyPickScore = 10;
      } else if (norm === "qty" || norm === "quantity") {
        qtyPickScore = 8;
      } else if (norm.includes("orderedqty") || norm.includes("orderqty")) {
        qtyPickScore = 6;
      } else if (
        (norm.includes("qty") || norm.includes("quantity")) &&
        !norm.includes("received") && !norm.includes("balance") && !norm.includes("shipped") && !norm.includes("delivered")
      ) {
        qtyPickScore = 4;
      } else if (norm.includes("qty") || norm.includes("quantity")) {
        // Matches but looks derived (received/balance/shipped/delivered qty)
        // — still a fallback if nothing better exists, but ranked lowest.
        qtyPickScore = 1;
      }
      if (qtyPickScore > qtyScore) {
        qtyScore = qtyPickScore;
        map.qty = h;
      }

      // Priority scoring for Unit Price. "Material" is the validated true
      // per-unit price column in Syteline exports. Generic "cost" columns
      // (Plan Cost, Plan Extended Cost, Requisition Cost, etc.) must never
      // outrank it — an "Extended"/"Total" cost is Qty × Unit Price, and
      // using it AS the unit price would silently multiply every landed
      // cost calculation by the order quantity a second time.
      let unitPricePickScore = 0;
      if (norm === "material" || norm === "materialusd") {
        unitPricePickScore = 10;
      } else if (norm === "unitprice" || norm === "price") {
        unitPricePickScore = 9;
      } else if (norm.includes("unitprice") || norm.includes("materialprice")) {
        unitPricePickScore = 7;
      } else if (norm.includes("price") && !norm.includes("total") && !norm.includes("extended")) {
        unitPricePickScore = 5;
      } else if (norm.includes("rate") && !norm.includes("carrying") && !norm.includes("interest") && !norm.includes("tax") && !norm.includes("urate") && !norm.includes("exchange") && !norm.includes("buyrate")) {
        unitPricePickScore = 3;
      } else if ((norm === "cost" || norm.includes("plancost")) && !norm.includes("extended") && !norm.includes("total")) {
        unitPricePickScore = 2;
      } else if (norm.includes("extended") || (norm.includes("cost") && norm.includes("total"))) {
        // Explicitly an aggregate/extended value, not a per-unit price —
        // only ever used as an absolute last resort.
        unitPricePickScore = 1;
      }
      if (unitPricePickScore > unitPriceScore) {
        unitPriceScore = unitPricePickScore;
        map.unitPrice = h;
      }

      if (norm.includes("color") || norm.includes("colour") || norm === "colorcode" || norm === "colourcode") {
        map.colorCode = h;
      } else if (norm === "cbm" || norm.includes("volume") || norm.includes("cbmkg")) {
        map.cbm = h;
      } else if (norm === "moq" || norm === "orderminimum" || norm.includes("orderminimum")) {
        map.moq = h;
      } else if (norm === "mcq" || norm === "ordermcq" || norm.includes("ordermcq") || norm === "ordermultiple") {
        map.mcq = h;
      } else if (norm === "shipfrom" || norm.includes("shipfrom") || norm.includes("origin")) {
        map.shipFrom = h;
      } else if (norm === "incoterm" || norm.includes("incoterm") || norm.includes("term")) {
        map.incoterm = h;
      } else if (norm === "customer" || norm.includes("custnum") || norm.includes("customer")) {
        map.customerCode = h;
      } else if (norm === "size") {
        map.size = h;
      } else if (norm === "daysearly" || norm.includes("days_early") || norm.includes("days early")) {
        map.daysEarlyExcel = h;
      } else if (norm.includes("transitleadtime") || norm.includes("transitlead") || (norm.includes("transit") && norm.includes("day")) || norm === "leadtimedays" || norm === "leadtime") {
        map.transitLeadTimeDays = h;
      } else if (norm.includes("consolidateweekday") || (norm.includes("consolidate") && norm.includes("weekday")) || norm === "consolidateday" || norm === "consolidationday") {
        map.consolidateWeekday = h;
      }

      // Priority scoring for Item Code to avoid overwriting with cost/material price columns like "Material"
      let itemScore = 0;
      if (norm === "itemcode" || norm === "itemno") {
        itemScore = 12;
      } else if (norm === "item") {
        itemScore = 10;
      } else if (norm.includes("itemcode") || norm.includes("item_code") || norm.includes("itemnumber")) {
        itemScore = 8;
      } else if (norm === "partno" || norm === "partnumber" || norm === "materialno" || norm === "materialcode") {
        itemScore = 6;
      } else if (
        norm.includes("material") && 
        !norm.includes("price") && 
        !norm.includes("cost") && 
        !norm.includes("unit") && 
        !norm.includes("rate") && 
        norm !== "material" && 
        norm !== "materialusd"
      ) {
        itemScore = 4;
      }

      if (itemScore > itemCodeScore) {
        itemCodeScore = itemScore;
        map.itemCode = h;
      }

      // Priority scoring system for PR Due Date to avoid "Promise Date" or "Order Date" hijacking
      //
      // IMPORTANT — these are two DIFFERENT dates and must never be cross-mapped:
      //   - PR Delivery Date = the date the requisition itself needs to be delivered
      //                    (vendor ex-port ship date). This is the field that actually
      //                    drives Days Early / grouping math (Days Early = PR Delivery
      //                    Date - PO Delivery Date). VALIDATED against two independent
      //                    real Syteline exports (53-PR and 165-PR datasets): using this
      //                    field reproduces the exact reference grouping and the exact
      //                    reference PO Delivery Date baseline in both cases, with zero
      //                    mismatches.
      //   - Due Date     = a separate, unrelated field. It must NEVER be used as
      //                    `prDueDate` — doing so produces impossible negative Days
      //                    Early values and the wrong number of shipment groups.
      // "PR Delivery Date" must therefore outrank a generic "Due Date" column below.
      let score = 0;
      if (norm === "prdeliverydate" || (norm.includes("pr") && norm.includes("delivery") && norm.includes("date") && !norm.includes("actual"))) {
        score = 16;
      } else if (norm === "prduedate" || norm.includes("prduedate")) {
        score = 14;
      } else if (norm === "duedate" || norm.includes("due_date") || norm.includes("requiredduedate")) {
        score = 10;
      } else if (norm.includes("prdate") || norm === "prdate" || norm.includes("reqdate") || norm.includes("requireddate")) {
        score = 8;
      } else if (norm.includes("needdate") || norm.includes("plandate")) {
        score = 6;
      } else if ((norm.includes("date") || norm.includes("dt")) && !norm.includes("delivery") && !norm.includes("promise") && !norm.includes("order") && !norm.includes("ship") && !norm.includes("actual")) {
        score = 2;
      }

      if (score > prDueDateScore) {
        prDueDateScore = score;
        map.prDueDate = h;
      }
    });

    // Post-processing: "PR Delivery Date" is the validated PR Due Date source
    // (see scoring block above) and must win here too if present.
    const explicitPrDelivery = sheetHeaders.find(h => /pr\s*delivery|prdelivery|pr_delivery_date/i.test(h));
    if (explicitPrDelivery) {
      map.prDueDate = explicitPrDelivery;
      map.actualDelivery = explicitPrDelivery;
    }

    const explicitPrDue = sheetHeaders.find(h => {
      const n = normalize(h);
      return n === "prduedate" || n === "pr_due_date";
    });
    if (explicitPrDue) {
      map.prDueDate = explicitPrDue;
    }

    return map;
  };

  const decodeCsvText = (arrayBuffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder("utf-16le").decode(bytes.subarray(2));
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder("utf-16be").decode(bytes.subarray(2));
    }
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return new TextDecoder("utf-8").decode(bytes.subarray(3));
    }
    return new TextDecoder("utf-8").decode(bytes);
  };

  const handleFileParse = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      setError(null);
      setFileName(file.name);
      const reader = new FileReader();

      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) throw new Error("Could not read file data.");

          const workbook = isCsv
            ? XLSX.read(decodeCsvText(data as ArrayBuffer), { type: "string" })
            : XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          
          // Parse raw rows as objects with raw headers
          const rows = XLSX.utils.sheet_to_json(sheet) as any[];
          if (rows.length === 0) {
            throw new Error("The uploaded spreadsheet is empty.");
          }

          // Extract raw column headers
          const sheetHeaders = Object.keys(rows[0]);
          setHeaders(sheetHeaders);
          setRawRows(rows);
          const builtExtraRawFields = buildExtraRawFields(sheet, rows.length);
          setExtraRawFields(builtExtraRawFields);

          // Auto-detect columns
          const detectedMap = autoDetectMapping(sheetHeaders);
          setMapping(detectedMap);

          // Verify if all required mappings are present
          const missingRequired = !detectedMap.itemCode || !detectedMap.colorCode || !detectedMap.qty || !detectedMap.prDueDate;
          
          if (missingRequired) {
            // Show mapping GUI to let user complete the mapping
            setShowMappingGui(true);
          } else {
            // Complete import directly. Pass the just-built raw fields explicitly
            // rather than relying on the `extraRawFields` state var, since the
            // setExtraRawFields() call above hasn't been committed by React yet
            // at this point in the same synchronous handler (stale closure) —
            // reading from state here would silently yield [] and blank out
            // every pass-through column (Ref.CO, Amount, Plan Cost, etc.).
            applyMapping(rows, detectedMap, builtExtraRawFields);
          }
          resolve();
        } catch (err: any) {
          console.error(err);
          setError(err.message || "An error occurred while parsing the file.");
          reject(err);
        }
      };

      reader.onerror = () => {
        const err = new Error("File reading error.");
        setError(err.message);
        reject(err);
      };

      if (isCsv) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const applyMapping = (rows: any[], currentMap: Record<string, string>, extraFieldsOverride?: Record<string, any>[]) => {
    try {
      const parseDateValue = (rawDate: any): Date | undefined => {
        if (rawDate === null || rawDate === undefined || String(rawDate).trim() === "") {
          return undefined;
        }

        const normalizeYear = (y: number): number => {
          if (y >= 2500 && y <= 2600) {
            return y - 543;
          }
          if (y < 100) {
            return y + 2000;
          }
          return y;
        };

        let parsed: Date | undefined;

        if (rawDate instanceof Date) {
          if (isNaN(rawDate.getTime())) return undefined;
          let isUtcZero = rawDate.getUTCHours() === 0 && rawDate.getUTCMinutes() === 0;
          let year = normalizeYear(isUtcZero ? rawDate.getUTCFullYear() : rawDate.getFullYear());
          let month = isUtcZero ? rawDate.getUTCMonth() : rawDate.getMonth();
          let day = isUtcZero ? rawDate.getUTCDate() : rawDate.getDate();
          parsed = new Date(year, month, day);
        } else {
          const numVal = Number(rawDate);
          const str = String(rawDate).trim();

          // Check if it is an Excel numeric date serial (e.g. 46199 or 46202)
          if (typeof rawDate === "number" || (!isNaN(numVal) && str !== "" && numVal > 35000 && numVal < 60000)) {
            const serial = typeof rawDate === "number" ? rawDate : numVal;
            const epoch = new Date(Date.UTC(1899, 11, 30));
            const utcDate = new Date(epoch.getTime() + Math.round(serial * 86400 * 1000));
            let year = normalizeYear(utcDate.getUTCFullYear());
            parsed = new Date(year, utcDate.getUTCMonth(), utcDate.getUTCDate());
          } else {
            // String date match
            const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
            const dmyOrMdyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);

            if (ymdMatch) {
              let year = parseInt(ymdMatch[1], 10);
              year = normalizeYear(year);
              const month = parseInt(ymdMatch[2], 10) - 1;
              const day = parseInt(ymdMatch[3], 10);
              parsed = new Date(year, month, day);
            } else if (dmyOrMdyMatch) {
              const g1 = parseInt(dmyOrMdyMatch[1], 10);
              const g2 = parseInt(dmyOrMdyMatch[2], 10);
              let year = parseInt(dmyOrMdyMatch[3], 10);
              year = normalizeYear(year);

              // Default to Month/Day/Year as requested by the user
              let month = g1 - 1;
              let day = g2;

              // Fallback if the first group is > 12, which must mean Day/Month/Year
              if (g1 > 12) {
                month = g2 - 1;
                day = g1;
              }

              parsed = new Date(year, month, day);
            } else {
              const fallbackDate = new Date(str);
              if (!isNaN(fallbackDate.getTime())) {
                const isUtc = str.includes("T") || str.includes("Z") || str.includes("+");
                let year = isUtc ? fallbackDate.getUTCFullYear() : fallbackDate.getFullYear();
                year = normalizeYear(year);
                let month = isUtc ? fallbackDate.getUTCMonth() : fallbackDate.getMonth();
                let day = isUtc ? fallbackDate.getUTCDate() : fallbackDate.getDate();
                parsed = new Date(year, month, day);
              } else {
                return undefined;
              }
            }
          }
        }

        if (!parsed || isNaN(parsed.getTime()) || parsed.getFullYear() < 2000) {
          return undefined; // Filter out year 1900 / dummy dates
        }

        return parsed;
      };

      const parsedEntries: PrEntry[] = rows.map((row, idx) => {
        const itemCode = String(row[currentMap.itemCode] ?? `ITEM-${idx}`).trim();
        const itemDescription = String(row[currentMap.itemCode + " Description"] || row["Description"] || `${itemCode} Sourced Fabric`).trim();
        const colorCode = String(row[currentMap.colorCode] ?? "COL-GENERIC").trim().toUpperCase();
        
        // Parse quantity safely
        const rawQty = row[currentMap.qty];
        const qty = parseFloat(String(rawQty).replace(/,/g, "")) || 0;

        // Parse price safely
        const rawPrice = row[currentMap.unitPrice];
        let unitPrice = parseFloat(String(rawPrice).replace(/,/g, "")) || 0;

        const priceHeader = currentMap.unitPrice ? String(currentMap.unitPrice).toLowerCase() : "";
        // Only genuinely unambiguous "this is a total, not a per-unit price"
        // header names should trigger dividing by qty. "cost" and "material"
        // were removed from this list: both are extremely common names for
        // an already-correct PER-UNIT price in real ERP exports (e.g. a
        // column literally named "Material" holding $/unit) — treating
        // them as if they were an extended/aggregate total silently divided
        // a correct price by quantity, and because that division's qty
        // then cancels back out when the total is re-multiplied by qty
        // downstream, it made every material cost total collapse to
        // roughly "sum of raw per-unit prices" instead of "sum of
        // qty × price" — understating true material cost by orders of
        // magnitude with no error or warning.
        const isExtendedPrice = priceHeader.includes("extended") || priceHeader.includes("total") || priceHeader.includes("amount") || priceHeader.includes("sum");
        if (isExtendedPrice && qty > 0) {
          unitPrice = unitPrice / qty;
        }

        // Parse Dates safely
        const parsedPrDueDate = parseDateValue(row[currentMap.prDueDate]);
        const prDueDate = parsedPrDueDate || new Date(2026, 8, 29);

        // Robustly find actual delivery / PR Delivery Date from mapped header or common fallbacks
        let actualDelivery: Date | undefined;
        if (currentMap.actualDelivery && row[currentMap.actualDelivery]) {
          actualDelivery = parseDateValue(row[currentMap.actualDelivery]);
        } else {
          // Look for common header name variants in the row keys
          const normalizeKey = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const candidateKey = Object.keys(row).find(k => {
            const nk = normalizeKey(k);
            return /prdelivery|prdeliverydate|actualdelivery|deliverydate|vendorloading|vendorloadingdate/.test(nk);
          });
          if (candidateKey) actualDelivery = parseDateValue(row[candidateKey]);
        }

        // Parse the raw "Due Date" source column separately — this is the
        // true PR Due Date (item's required arrival date), distinct from
        // prDueDate above which is mapped from "PR Delivery Date" for
        // grouping/Days Early calculations. Never conflate the two.
        let dueDateRaw: Date | undefined;
        if (currentMap.dueDateRaw && row[currentMap.dueDateRaw]) {
          dueDateRaw = parseDateValue(row[currentMap.dueDateRaw]);
        } else {
          const normalizeKey = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const candidateDueKey = Object.keys(row).find(k => {
            const nk = normalizeKey(k);
            return (nk === "duedate" || nk.includes("requiredduedate"));
          });
          if (candidateDueKey) dueDateRaw = parseDateValue(row[candidateDueKey]);
        }

        const extra = (extraFieldsOverride ?? extraRawFields)[idx] || {};

        // CBM is calculated exclusively as Unit Weight × Quantity, per
        // explicit instruction — the direct CBM/Volume column from the
        // file (e.g. "Total CBM/KG") is intentionally NOT used, even when
        // present. Falls back to a flat 0.003 CBM/unit constant only if
        // Unit Weight itself is unavailable.
        let cbm: number;
        if (extra.unitWeightRaw !== undefined && extra.unitWeightRaw > 0 && qty > 0) {
          cbm = extra.unitWeightRaw * qty;
        } else {
          cbm = qty * 0.003; // Last-resort fallback only, when Unit Weight is missing
        }

        // Parse MOQ
        const rawMoq = currentMap.moq ? row[currentMap.moq] : null;
        const moq = rawMoq !== null && rawMoq !== undefined
          ? parseInt(String(rawMoq).replace(/,/g, "")) || 0
          : 0;

        // Parse MCQ
        const rawMcq = currentMap.mcq ? row[currentMap.mcq] : null;
        const mcq = rawMcq !== null && rawMcq !== undefined
          ? parseInt(String(rawMcq).replace(/,/g, "")) || 0
          : 500;

        // Parse other optional fields
        const shipFrom = currentMap.shipFrom && row[currentMap.shipFrom] ? String(row[currentMap.shipFrom]).trim() : undefined;
        const incoterm = currentMap.incoterm && row[currentMap.incoterm] ? String(row[currentMap.incoterm]).trim() : undefined;
        const customerCode = currentMap.customerCode && row[currentMap.customerCode] ? String(row[currentMap.customerCode]).trim() : undefined;
        const size = currentMap.size && row[currentMap.size] ? String(row[currentMap.size]).trim() : undefined;
        const itemDesc = currentMap.itemDescription && row[currentMap.itemDescription] ? String(row[currentMap.itemDescription]).trim() : `Item ${itemCode}`;

        // Parse original Days Early from file if present
        const rawDaysEarly = currentMap.daysEarlyExcel ? row[currentMap.daysEarlyExcel] : null;
        const daysEarlyExcel = rawDaysEarly !== null && rawDaysEarly !== undefined
          ? parseInt(String(rawDaysEarly).replace(/,/g, ""))
          : undefined;

        // Parse the new "Transit Lead Time (Days)" and "Consolidate
        // (Weekday)" columns, when present. These are per-row source-of-
        // truth values that the optimizer uses ahead of any built-in
        // default transit time or loading-day assumption.
        const rawTransitLeadTime = currentMap.transitLeadTimeDays ? row[currentMap.transitLeadTimeDays] : null;
        const transitLeadTimeDaysParsed = rawTransitLeadTime !== null && rawTransitLeadTime !== undefined && String(rawTransitLeadTime).trim() !== ""
          ? parseFloat(String(rawTransitLeadTime).replace(/,/g, ""))
          : undefined;
        const transitLeadTimeDays = transitLeadTimeDaysParsed !== undefined && !isNaN(transitLeadTimeDaysParsed)
          ? transitLeadTimeDaysParsed
          : undefined;

        const consolidateWeekdayRaw = currentMap.consolidateWeekday && row[currentMap.consolidateWeekday]
          ? String(row[currentMap.consolidateWeekday]).trim()
          : undefined;

        let rawRate = currentMap.currencyRate ? row[currentMap.currencyRate] : null;
        if (rawRate === null || rawRate === undefined || rawRate === "") {
          for (const key of Object.keys(row)) {
            const kNorm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (kNorm.includes("buyrate") || kNorm.includes("exchangerate") || kNorm.includes("currencyrate") || kNorm.includes("exrate")) {
              rawRate = row[key];
              if (rawRate !== null && rawRate !== undefined && rawRate !== "") break;
            }
          }
        }
        let currencyRate = rawRate !== null && rawRate !== undefined && rawRate !== ""
          ? parseFloat(String(rawRate).replace(/,/g, "")) || undefined
          : undefined;

        // Files with multiple ambiguous "Currency" columns (e.g. Syteline
        // exports commonly have 3-4 of them, describing different unrelated
        // aggregate figures) must not let a naive last-match-wins mapping
        // pick the wrong one. `planExtendedCostCurrencyRaw` is anchored by
        // POSITION (the column immediately after "Plan Extended Cost") and
        // is therefore guaranteed to be the currency that actually applies
        // to the unit price/material cost — use it first. Getting this
        // wrong silently treats a USD price as if it were already in THB
        // (or vice versa), understating/overstating material cost by
        // roughly the exchange rate itself.
        let rawCurr: any = extra.planExtendedCostCurrencyRaw || (currentMap.currency ? row[currentMap.currency] : null);
        if (rawCurr === null || rawCurr === undefined || rawCurr === "") {
          for (const key of Object.keys(row)) {
            const kNorm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (kNorm === "currency" || kNorm === "curr" || kNorm === "currencycode") {
              rawCurr = row[key];
              if (rawCurr !== null && rawCurr !== undefined && rawCurr !== "") break;
            }
          }
        }
        let currency = rawCurr !== null && rawCurr !== undefined && String(rawCurr).trim() !== ""
          ? String(rawCurr).trim().toUpperCase()
          : undefined;

        const isThbHeader = priceHeader.includes("thb") || priceHeader.includes("baht");
        if (isThbHeader) {
          if (currency === undefined) currency = "THB";
          if (currencyRate === undefined) currencyRate = 1.0;
        }

        // Default to THB and 1.0 rate for all uploaded entries if not specified
        if (currency === undefined) {
          currency = "THB";
        }
        if (currencyRate === undefined) {
          if (currency === "THB") {
            currencyRate = 1.0;
          } else {
            currencyRate = undefined;
          }
        }

        const vendor = currentMap.vendor && row[currentMap.vendor]
          ? String(row[currentMap.vendor]).trim()
          : "Sourcing Fallback";

        const rawId = (currentMap.requisition && row[currentMap.requisition]) || row["PR No"] || row["PR Number"] || row["Requisition"] || row["Requisition No"] || `PR-${idx + 100}`;

        const idVal = `${String(rawId || `PR-${idx + 100}`).trim()}-${idx}`;

        return {
          id: idVal,
          requisitionRaw: String(rawId).trim(),
          itemCode,
          itemDescription: itemDesc,
          colorCode,
          qty,
          originalQty: qty,
          unitPrice,
          prDueDate,
          cbm,
          moq,
          mcq,
          shipFrom,
          incoterm,
          customerCode,
          size,
          daysEarlyExcel: isNaN(daysEarlyExcel as any) ? undefined : daysEarlyExcel,
          transitLeadTimeDays,
          consolidateWeekdayRaw,
          actualDelivery,
          dueDateRaw,
          currencyRate,
          currency,
          vendor,
          lineRaw: extra.lineRaw,
          refCoRaw: extra.refCoRaw,
          termDescriptionRaw: extra.termDescriptionRaw,
          incoTermCodeRaw: extra.incoTermCodeRaw,
          techDescRaw: extra.techDescRaw,
          seasonRaw: extra.seasonRaw,
          buyerRaw: extra.buyerRaw,
          planCostRaw: extra.planCostRaw,
          planExtendedCostCurrencyRaw: extra.planExtendedCostCurrencyRaw,
          orderMultipleRaw: extra.orderMultipleRaw,
          unitWeightRaw: extra.unitWeightRaw,
          uomRaw: extra.uomRaw,
          freightRaw: extra.freightRaw,
          dutyRaw: extra.dutyRaw,
          brokerageRaw: extra.brokerageRaw,
          insuranceRaw: extra.insuranceRaw,
          localFreightRaw: extra.localFreightRaw
        };
      });

      onDataLoaded(parsedEntries);
      setShowMappingGui(false);
      setRawRows(null);
    } catch (err: any) {
      setError("Failed to apply column mapping: " + err.message);
    }
  };

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
      handleFileParse(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileParse(e.target.files[0]);
    }
  };

  const [isLoadingSample, setIsLoadingSample] = useState(false);

  const loadSample = async () => {
    setError(null);
    setIsLoadingSample(true);
    try {
      // Fetch the real sample spreadsheet (served from /public) and run it
      // through the exact same parsing pipeline as a manual upload.
      // An explicit timeout guards against fetch() hanging indefinitely
      // (e.g. a dev-server routing issue) — without it, an unsettled
      // fetch promise would leave the loading state stuck forever, since
      // the `finally` block below only runs once this try block settles.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      let res: Response;
      try {
        res = await fetch("/sample-data/KingWhale.xlsx", { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res.ok) throw new Error(`Could not load sample file (HTTP ${res.status}).`);
      const blob = await res.blob();
      const file = new File([blob], "KingWhale.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      await handleFileParse(file);
    } catch (err: any) {
      console.warn("Primary fetch for sample file failed, using embedded fallback sample dataset:", err);
      try {
        const fallbackData = loadSamplePrEntries();
        if (fallbackData && fallbackData.length > 0) {
          onDataLoaded(fallbackData);
          setShowMappingGui(false);
          setError(null);
        } else {
          throw new Error("Fallback sample dataset is empty.");
        }
      } catch (fallbackErr: any) {
        console.error("Fallback sample load failed:", fallbackErr);
        setError(err.message || "Could not load the sample dataset.");
      }
    } finally {
      setIsLoadingSample(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        
        {/* Left Column: Syteline / ERP Planning Sheet Upload */}
        <div className="flex flex-col h-full justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 mb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="text-blue-600" size={18} />
                {t("Syteline / ERP Planning Sheet Upload", lang)}
              </h2>
              <p className="text-slate-500 text-[11px] mt-1">
                {t("Import Purchase Requisitions (PR) to run the Weeks Scenario scheduling, MCQ consolidated check, and rounding engine.", lang)}
              </p>
            </div>
            <div className="shrink-0">
              <button
                onClick={loadSample}
                disabled={isLoadingSample}
                className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition duration-200 disabled:opacity-50 disabled:cursor-wait"
              >
                {isLoadingSample ? (
                  <RefreshCw size={13} className="text-emerald-600 animate-spin" />
                ) : (
                  <Database size={13} className="text-emerald-600" />
                )}
                {isLoadingSample ? t("Loading…", lang) : t("Load VT Garment Sample Data", lang)}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-red-800">{t("Data Parsing Error", lang)}</div>
                <div className="text-[11px] text-red-600 mt-0.5 leading-relaxed">{error}</div>
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col justify-center">
            {/* Main Upload Dropzone */}
            {!showMappingGui ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition duration-300 h-full min-h-[140px] ${
                  dragActive
                    ? "border-blue-500 bg-blue-50/50"
                    : "border-slate-200 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50/80"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleInputChange}
                  className="hidden"
                />

                <div className="bg-white border border-slate-200 p-2 rounded-lg text-slate-400 mb-2 shadow-sm">
                  <Upload size={20} className="text-blue-600 animate-pulse" />
                </div>

                <div className="text-xs font-semibold text-slate-700">
                  {fileName ? (
                    <span className="text-blue-600 flex items-center gap-1.5 justify-center font-semibold">
                      <Check size={14} className="text-emerald-600" /> {fileName}
                    </span>
                  ) : (
                    t("Drag & Drop Syteline sheet (.xlsx, .xls, .csv)", lang)
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t("or click to browse your computer's files", lang)}
                </div>

                {currentCount > 0 && (
                  <div className="mt-2.5 bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium">
                    {t("Active Ledger: ", lang)} {currentCount} {t(" PR entries loaded", lang)}
                  </div>
                )}
              </div>
            ) : (
              /* Column Mapping GUI if Auto-map fails or has ambiguities */
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertCircle className="text-amber-600 animate-bounce" size={16} />
                  <span className="text-xs font-bold text-amber-800">
                    Confirm Column Field Mapping
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                  We couldn't resolve all of Syteline's headers. Please map the columns of your uploaded sheet:
                </p>

                <div className="grid grid-cols-2 gap-2 mb-3 max-h-[140px] overflow-y-auto pr-1">
                  {/* Item Code Mapping */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Item Code <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={mapping.itemCode}
                      onChange={(e) => setMapping({ ...mapping, itemCode: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Select --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Color Code Mapping */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Color Code <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={mapping.colorCode}
                      onChange={(e) => setMapping({ ...mapping, colorCode: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Select --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Quantity Ordered Mapping */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={mapping.qty}
                      onChange={(e) => setMapping({ ...mapping, qty: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Select --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Unit Price Mapping */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Unit Price <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={mapping.unitPrice}
                      onChange={(e) => setMapping({ ...mapping, unitPrice: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Select --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* PR Due Date Mapping */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={mapping.prDueDate}
                      onChange={(e) => setMapping({ ...mapping, prDueDate: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Select --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Volume CBM Mapping */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Volume (CBM)
                    </label>
                    <select
                      value={mapping.cbm}
                      onChange={(e) => setMapping({ ...mapping, cbm: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Auto-calc --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Vendor Mapping */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Vendor / Supplier
                    </label>
                    <select
                      value={mapping.vendor}
                      onChange={(e) => setMapping({ ...mapping, vendor: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Auto-detect (Fallback) --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Currency Code Mapping */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Currency Code
                    </label>
                    <select
                      value={mapping.currency}
                      onChange={(e) => setMapping({ ...mapping, currency: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Auto-detect --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Currency Rate Mapping */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Exchange Rate Column
                    </label>
                    <select
                      value={mapping.currencyRate}
                      onChange={(e) => setMapping({ ...mapping, currencyRate: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Auto-detect --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowMappingGui(false);
                      setRawRows(null);
                      setFileName(null);
                    }}
                    className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1 rounded text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => rawRows && applyMapping(rawRows, mapping)}
                    disabled={!mapping.itemCode || !mapping.colorCode || !mapping.qty || !mapping.prDueDate || !mapping.unitPrice}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
                  >
                    <RefreshCw size={11} /> Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: VT Planning Rules Summary */}
        <div className="bg-slate-50/70 border border-slate-150 rounded-xl p-5 flex flex-col justify-between h-full">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-3">
              <HelpCircle size={14} className="text-blue-600" />
              {t("VT Planning Rules Summary", lang)}
            </h4>
            <ul className="space-y-3.5 text-[11px] text-slate-500 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 shrink-0 mt-0.5">●</span>
                <span>
                  <strong className="text-slate-700">{t("Days Early (Shipment classification):", lang)}</strong>
                  <div className="pl-4 mt-1.5 space-y-1 text-xs text-slate-600">
                    <div>{t("• Baseline: the earliest PR Due Date sets the base PO Due Date, shifted backward to the nearest allowed vendor loading day.", lang)}</div>
                    <div>{t("• Grouping: sorted Days Early values are clustered dynamically — each group spans a rolling 7-day window from its own start date, not fixed weekly buckets.", lang)}</div>
                    <div>{t("• Scenario count: the number of groups sets the maximum number of shipments (e.g. 15 groups → Scenarios 1–15).", lang)}</div>
                    <div>{t("• Splitting: Scenario N splits at the N-1 largest gaps between groups; equal-sized gaps produce numbered variants (e.g. 2.1, 2.2).", lang)}</div>
                    <div>{t("• Each shipment's PO Due Date is its group's earliest PR Due Date, aligned backward to the nearest allowed loading day.", lang)}</div>
                  </div>
                </span>
              </li>

              <li className="flex items-start gap-2">
                <span className="text-blue-600 shrink-0 mt-0.5">●</span>
                <span>
                  <strong className="text-slate-700">{t("Excess Propagation:", lang)}</strong> {t("rounds the first shipment UP, then propagates excess forward to round subsequent shipments up or down.", lang)}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 shrink-0 mt-0.5">●</span>
                <span>
                  <strong className="text-slate-700">{lang === "TH" ? "MCQ Push-Forward (การเลื่อนแผนจัดส่งล่วงหน้า):" : "MCQ Push-Forward:"}</strong> {lang === "TH" ? "ดึงม้วนผ้าที่มีจำนวนต่ำกว่าเกณฑ์ MCQ ขึ้นมาจัดส่งรอบก่อนหน้าเพื่อประหยัดค่าระวางเรือโดยเลี่ยงค่าปรับยอดขั้นต่ำ" : "sub-MOQ color-shipments shift earlier to optimize ocean freight without incurring MOQ penalties."}
                </span>
              </li>
            </ul>
          </div>
          
          <div className="mt-4 border-t border-slate-200/60 pt-3 flex items-center justify-between text-[10px] text-slate-400">
            <span>{t("Validation Rules Mode: Standard", lang)}</span>
            <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-medium">{t("ACTIVE", lang)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
