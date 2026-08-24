import * as XLSX from "xlsx";
import JSZip from "jszip";
import { ProcessedScenario, PrEntry, ShipmentGroup } from "../types";

export function exportToExcel(
  scenarios: ProcessedScenario[],
  activeScenario: ProcessedScenario,
  exchangeRates: Record<string, number> | number = 33.5581
) {
  const usdRate = typeof exchangeRates === "number" ? exchangeRates : (exchangeRates["USD"] || 33.5581);
  const fmtDateShort = (d?: Date) => {
    if (!d) return "N/A";
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  // 1. Grouped by Colors Summary — per-shipment breakdown (Ordered / Material
  // Cost / CBM for each shipment), plus totals and a cost-breakdown section
  // (Opportunity Cost / Carrying Cost / O+C), matching the reference format.
  // Grouped by (item description, color code) pair rather than color alone,
  // since the same color code commonly spans several distinct garment
  // styles/items — grouping by color alone would merge their quantities
  // together and make totals impossible to trace back to a single item.
  const colorItemPairsForExport = (() => {
    const seen = new Map<string, { itemDescription: string; colorCode: string }>();
    activeScenario.processedEntries.forEach(e => {
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
  })();
  const shipmentsForColorSummary = activeScenario.shipments;

  const priceToTHB = (e: { unitPrice: number; currency?: string; currencyRate?: number }) => {
    const currCode = (e.currency || "").toUpperCase().trim();
    if (e.currencyRate !== undefined && e.currencyRate !== null) {
      return e.unitPrice * e.currencyRate;
    }
    if (currCode === "THB") return e.unitPrice;
    if (typeof exchangeRates === "object" && exchangeRates && exchangeRates[currCode] !== undefined) {
      return e.unitPrice * exchangeRates[currCode];
    }
    const rate = currCode === "USD" ? usdRate : (e.unitPrice > 30 ? 1.0 : usdRate);
    return e.unitPrice * rate;
  };

  const colorSummaryRows = colorItemPairsForExport.map(({ itemDescription, colorCode }) => {
    const colorEntries = activeScenario.processedEntries.filter(
      e => (e.itemDescription || e.itemCode) === itemDescription && e.colorCode === colorCode
    );

    const perShipment = shipmentsForColorSummary.map(ship => {
      const shipEntries = colorEntries.filter(e => e.assignedWeek === ship.week);
      if (shipEntries.length === 0) {
        return { ordered: null as number | null, materialCost: null as number | null, cbm: null as number | null };
      }
      const ordered = shipEntries.reduce((sum, e) => sum + e.qty, 0);
      const materialCost = shipEntries.reduce((sum, e) => sum + e.qty * priceToTHB(e), 0);
      const cbm = shipEntries.reduce((sum, e) => sum + e.cbm, 0);
      return { ordered, materialCost, cbm };
    });

    const totalOrdered = colorEntries.reduce((sum, e) => sum + e.qty, 0);
    const totalMaterialCost = colorEntries.reduce((sum, e) => sum + e.qty * priceToTHB(e), 0);
    const totalCbm = colorEntries.reduce((sum, e) => sum + e.cbm, 0);
    const totalOpportunityCost = colorEntries.reduce((sum, e) => sum + (e.opportunityCost || 0), 0);
    const totalCarryingCost = colorEntries.reduce((sum, e) => sum + (e.carryingCost || 0), 0);
    const totalOC = totalOpportunityCost + totalCarryingCost;

    return {
      itemDescription,
      color: colorCode,
      perShipment,
      totalOrdered,
      totalMaterialCost,
      totalMaterialCostPlusOC: totalMaterialCost + totalOC,
      totalCbm,
      totalOpportunityCost,
      totalCarryingCost,
      totalOC
    };
  });

  // Build the two-row merged header + data rows + totals row as an array of
  // arrays, since this layout (grouped per-shipment sub-columns) needs
  // merged header cells that a flat json_to_sheet table can't express.
  const csHeaderRow1: any[] = ["Item Description", "Color"];
  const csHeaderRow2: any[] = ["", ""];
  const csMerges: any[] = [];
  let csCol = 2; // 0 = Item Description column, 1 = Color column

  // Per-shipment CBM is only useful (non-redundant) when there's more than
  // one shipment — for a single-shipment scenario it would just duplicate
  // the Total CBM column in the Totals group.
  const showPerShipmentCbm = shipmentsForColorSummary.length > 1;
  const colsPerShipment = showPerShipmentCbm ? 3 : 2;

  shipmentsForColorSummary.forEach(ship => {
    if (showPerShipmentCbm) {
      csHeaderRow1.push(`Shipment ${ship.week} (Delivery Date ${fmtDateShort(ship.shipmentDate || ship.date)})`, "", "");
      csHeaderRow2.push("Ordered (YD)", "Material Cost (THB)", "Total CBM");
    } else {
      csHeaderRow1.push(`Shipment ${ship.week} (Delivery Date ${fmtDateShort(ship.shipmentDate || ship.date)})`, "");
      csHeaderRow2.push("Ordered (YD)", "Material Cost (THB)");
    }
    csMerges.push({ s: { r: 0, c: csCol }, e: { r: 0, c: csCol + colsPerShipment - 1 } });
    csCol += colsPerShipment;
  });

  const costGroupStart = csCol;
  csHeaderRow1.push("Cost Breakdown", "", "");
  csHeaderRow2.push("Opportunity Cost (THB)", "Carrying Cost (THB)", "O+C (THB)");
  csMerges.push({ s: { r: 0, c: costGroupStart }, e: { r: 0, c: costGroupStart + 2 } });
  csCol += 3;

  const totalsGroupStart = csCol;
  csHeaderRow1.push("Totals", "", "", "");
  csHeaderRow2.push("Total Ordered (YD)", "Total Material Cost (THB)", "Total Material Cost + O+C (THB)", "Total CBM");
  csMerges.push({ s: { r: 0, c: totalsGroupStart }, e: { r: 0, c: totalsGroupStart + 3 } });

  // Merge the "Item Description" and "Color" headers vertically across both header rows
  csMerges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });
  csMerges.push({ s: { r: 0, c: 1 }, e: { r: 1, c: 1 } });

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const csDataRows = colorSummaryRows.map(row => {
    const line: any[] = [row.itemDescription, row.color];
    row.perShipment.forEach(s => {
      line.push(s.ordered === null ? "" : Math.round(s.ordered));
      line.push(s.materialCost === null ? "" : round2(s.materialCost));
      if (showPerShipmentCbm) {
        line.push(s.cbm === null ? "" : round2(s.cbm));
      }
    });
    line.push(
      round2(row.totalOpportunityCost),
      round2(row.totalCarryingCost),
      round2(row.totalOC),
      Math.round(row.totalOrdered),
      round2(row.totalMaterialCost),
      round2(row.totalMaterialCostPlusOC),
      round2(row.totalCbm)
    );
    return line;
  });

  const csTotalsRow: any[] = ["TOTAL", ""];
  shipmentsForColorSummary.forEach((_, idx) => {
    const orderedSum = colorSummaryRows.reduce((sum, r) => sum + (r.perShipment[idx].ordered || 0), 0);
    const costSum = colorSummaryRows.reduce((sum, r) => sum + (r.perShipment[idx].materialCost || 0), 0);
    csTotalsRow.push(Math.round(orderedSum), round2(costSum));
    if (showPerShipmentCbm) {
      const cbmSum = colorSummaryRows.reduce((sum, r) => sum + (r.perShipment[idx].cbm || 0), 0);
      csTotalsRow.push(round2(cbmSum));
    }
  });
  csTotalsRow.push(
    round2(colorSummaryRows.reduce((sum, r) => sum + r.totalOpportunityCost, 0)),
    round2(colorSummaryRows.reduce((sum, r) => sum + r.totalCarryingCost, 0)),
    round2(colorSummaryRows.reduce((sum, r) => sum + r.totalOC, 0)),
    Math.round(colorSummaryRows.reduce((sum, r) => sum + r.totalOrdered, 0)),
    round2(colorSummaryRows.reduce((sum, r) => sum + r.totalMaterialCost, 0)),
    round2(colorSummaryRows.reduce((sum, r) => sum + r.totalMaterialCostPlusOC, 0)),
    round2(colorSummaryRows.reduce((sum, r) => sum + r.totalCbm, 0))
  );

  const colorSummaryAoa = [csHeaderRow1, csHeaderRow2, ...csDataRows, csTotalsRow];

  // 2. MCQ Shipment Calendar Matrix
  const shipmentColumns = activeScenario.shipments;
  const mcqThreshold = activeScenario.mcqThreshold || 500;
  const mcqMatrixData = colorItemPairsForExport.map(({ itemDescription, colorCode }) => {
    const itemColorEntries = activeScenario.processedEntries.filter(p => (p.itemDescription || p.itemCode) === itemDescription && p.colorCode === colorCode);
    
    const rowObj: Record<string, any> = {
      "Item Description": itemDescription,
      "Color Code": colorCode,
      "MCQ Limit (YD)": mcqThreshold
    };

    shipmentColumns.forEach((col, idx) => {
      const weekPrs = itemColorEntries.filter(p => p.assignedWeek === col.week);
      const qty = weekPrs.reduce((sum, p) => sum + p.qty, 0);
      const originalQty = weekPrs.reduce((sum, p) => sum + p.originalQty, 0);
      
      const formattedDate = col.shipmentDate ? `${col.shipmentDate.getFullYear()}/${String(col.shipmentDate.getMonth() + 1).padStart(2, '0')}/${String(col.shipmentDate.getDate()).padStart(2, '0')}` : "N/A";
      const colName = `Shipment ${idx + 1} (${formattedDate})`;
      rowObj[colName] = qty > 0 ? `${Math.round(qty)} (Original Qty: ${originalQty.toFixed(1)})` : "-";
    });

    return rowObj;
  });

  // 3. Duplicated PR Rounded Ledger
  const ledgerData = activeScenario.processedEntries.map(pr => {
    const excess = pr.excessQty || 0;
    const materialValueTHB = priceToTHB(pr) * pr.qty;
    
    const fmtDate = (d?: Date) => {
      if (!d) return "N/A";
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    return {
      "PR ID": pr.id,
      "Item Code": pr.itemCode,
      "Color Code": pr.colorCode,
      "Original Qty (YD)": parseFloat(pr.originalQty.toFixed(2)),
      "Final Qty (YD)": Math.round(pr.qty),
      "Rounding/MOQ Excess (YD)": parseFloat(excess.toFixed(2)),
      "Price ($)": pr.unitPrice,
      "PR Due Date": fmtDate(pr.dueDateRaw || pr.prDueDate),
      "PO Due Date": fmtDate(pr.poDueDate),
      "Days Early": pr.daysEarly,
      "Volume (CBM)": parseFloat(pr.cbm.toFixed(4)),
      "Material Value (THB)": Math.round(materialValueTHB)
    };
  });

  // 4. Syteline Requisition Output
  const requisitionData = activeScenario.processedEntries.map((pr, idx) => {
    const shipmentGroup = activeScenario.shipments.find(s => s.week === pr.assignedWeek);
    const shipmentDate = shipmentGroup?.shipmentDate || new Date();
    const lineNo = idx + 1;
    
    const fmtDate = (d?: Date) => {
      if (!d) return "N/A";
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    return {
      // Force Excel to treat this value as plain text via explicit cell type.
      // This preserves exact uploaded Requisition formatting while avoiding numeric coercion.
      "Requisition No.": pr.requisitionRaw ? pr.requisitionRaw : pr.id,
      "Line No.": lineNo,
      "Item Code": pr.itemCode,
      "Color Description": pr.colorCode,
      "Optimized Qty": Math.round(pr.qty),
      "UOM": "YD",
      "PO Delivery Date": fmtDate(shipmentDate),
      "PR Due Date": fmtDate(pr.dueDateRaw || pr.prDueDate),
      "Days Early": `${pr.daysEarly} days`,
      "PR Delivery Date (Vendor Loading)": fmtDate(pr.actualDelivery || pr.prDueDate),
      "PO Due Date (Arrival at VT)": fmtDate(pr.poDueDate)
    };
  });

  // 5. VT Garment Multi-Scenario Sourcing Ledger
  const multiScenarioLedgerData = scenarios.map(sc => {
    return {
      "Scenario": `Scenario ${sc.id}`,
      "Active Weeks": sc.weeks.join(", "),
      "Total Qty (YD)": Math.round(sc.totalQty),
      "Volume (CBM)": parseFloat(sc.totalCbm.toFixed(2)),
      "Material Cost (THB)": Math.round(sc.totalMaterialCost),
      "Freight Cost (THB)": Math.round(sc.totalFreightCost),
      "Local Port Cost (THB)": Math.round(sc.totalLocalCost),
      "Exwork Cost (THB)": Math.round(sc.totalExworkCost || 0),
      "Brokerage Cost (THB)": Math.round(sc.totalBrokerageCost),
      "Shipping Cost (THB)": Math.round(sc.totalFreightCost + sc.totalLocalCost + (sc.totalExworkCost || 0) + sc.totalBrokerageCost),
      "Carrying Cost (THB)": Math.round(sc.totalCarryingCost),
      "Opportunity Cost (THB)": Math.round(sc.totalOpportunityCost),
      "Surcharges MOQ+Rnd (THB)": Math.round((sc.totalMoqExcessCost || 0) + (sc.totalRoundingExcessCost || 0)),
      "True Landed Cost (THB)": Math.round(sc.totalLandedCost),
      "Containers Used": sc.containersUsedList.join(", "),
      "Status": sc.containerMatchingStatus
    };
  });

  // 6. Shipment Containers & Bins
  const shipmentContainersData = activeScenario.shipments.map((ship, idx) => {
    const fmtDate = (d?: Date) => {
      if (!d) return "N/A";
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    return {
      "Shipment No.": `Shipment ${idx + 1}`,
      "Vendor Loading Date": fmtDate(ship.shipmentDate),
      "Arrival at VT Date": fmtDate(ship.date),
      "Total Volume (CBM)": parseFloat(ship.totalCbm.toFixed(3)),
      "Total Quantity (YD)": Math.round(ship.totalQty),
      "Assigned Containers": ship.container.name,
      "Container Status": ship.container.status || "OK",
      "Freight Cost (THB)": Math.round(ship.freightCost),
      "Local Port Cost (THB)": Math.round(ship.localCost),
      "Exwork Cost (THB)": Math.round(ship.exworkCost || 0),
      "Brokerage Cost (THB)": Math.round(ship.brokerageCost),
      "Total Landed Cost (THB)": Math.round(ship.totalLandedCost)
    };
  });

  // Create Workbook
  const wb = XLSX.utils.book_new();

  // Add worksheets in the requested order:
  // 1. VT Garment Multi-Scenario Sourcing Ledger
  const wsMultiScen = XLSX.utils.json_to_sheet(multiScenarioLedgerData);
  XLSX.utils.book_append_sheet(wb, wsMultiScen, "VT Garment Sourcing Ledger");

  // 2. Syteline Requisition Output
  const wsReq = XLSX.utils.json_to_sheet(requisitionData);
  // Force the Requisition No. column to be treated as text in Excel.
  const findBodyRange = wsReq["!ref"];
  if (findBodyRange) {
    const [, end] = findBodyRange.split(":");
    const headerCells = Object.entries(wsReq)
      .filter(([addr]) => /^[A-Z]+1$/.test(addr));
    const reqHeader = headerCells.find(([, cell]) => cell.v === "Requisition No.");
    if (reqHeader) {
      const reqCol = reqHeader[0].replace(/\d+$/, "");
      const maxRow = parseInt(end.replace(/^[A-Z]+/, ""), 10);
      for (let r = 2; r <= maxRow; r++) {
        const addr = `${reqCol}${r}`;
        const cell = wsReq[addr];
        if (cell && cell.v !== undefined && cell.v !== null) {
          cell.t = "s";
          cell.v = String(cell.v);
        }
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, wsReq, "Syteline Requisition Output");

  // Other helper sheets
  const wsShipmentContainers = XLSX.utils.json_to_sheet(shipmentContainersData);
  XLSX.utils.book_append_sheet(wb, wsShipmentContainers, "Shipment Containers");

  const wsColors = XLSX.utils.aoa_to_sheet(colorSummaryAoa);
  wsColors["!merges"] = csMerges;
  wsColors["!cols"] = [
    { wch: 32 },
    ...shipmentsForColorSummary.flatMap(() => showPerShipmentCbm ? [{ wch: 12 }, { wch: 16 }, { wch: 12 }] : [{ wch: 12 }, { wch: 16 }]),
    { wch: 16 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, wsColors, "Colors Summary");

  const wsMatrix = XLSX.utils.json_to_sheet(mcqMatrixData);
  XLSX.utils.book_append_sheet(wb, wsMatrix, "Shipment MCQ Matrix");

  const wsLedger = XLSX.utils.json_to_sheet(ledgerData);
  XLSX.utils.book_append_sheet(wb, wsLedger, "PR Rounded Ledger");

  // Write file
  XLSX.writeFile(wb, `VT_Garment_Scenario_${activeScenario.id}_Optimization_Report.xlsx`);
}

// Shared date formatter: MM/DD/YYYY (e.g. "02/06/2026"), matching the format
// used in the spec's own example.
const fmtDateSlash = (d?: Date): string => {
  if (!d) return "N/A";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
};

// Filesystem-safe date formatter for use in downloaded file names (Windows
// disallows "/" in file names), e.g. "02/06/2026" -> "02-06-2026".
const fmtDateForFileName = (d?: Date): string => {
  if (!d) return "N-A";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getFullYear()}`;
};

// The exact 30 column headers required for the Combined Excel Report, in the
// exact order/spelling/casing specified (including the intentional double
// space in "PO Delivery  Date". "Unit Weight" has no trailing space.
const COMBINED_REPORT_HEADERS = [
  "Item",
  "Item Description",
  "Color",
  "Size",
  "PO Due Date",
  "PO Delivery  Date",
  "Item Ship From",
  "Ordered",
  "Qty Original PO",
  "U/M",
  "PO Num",
  "Vendor",
  "Ref.CO",
  "Cust Num",
  "Amount",
  "Currency",
  "Order Minimum",
  "Order Multiple",
  "Unit Weight",
  "PO Date",
  "Payment Term",
  "Tech Des",
  "RMA",
  "Season",
  "Buy",
  "Plan Cost",
  "Unit Price with surcharge",
  "Incoterm",
  "Ship Via",
  "Ship From"
];

// Builds one Combined Report row for a single PR line within a given shipment.
function buildCombinedRow(pr: PrEntry, shipment: ShipmentGroup, generatedOn: Date): Record<string, any> {
  const qtyOriginalPo = Math.round(pr.qty); // Final Qty (YD) from the PR Rounded Ledger — reflects all overrides
  const planCost = pr.planCostRaw;
  const amount = planCost !== undefined ? Math.round(qtyOriginalPo * planCost * 100) / 100 : "";
  const shipFrom = pr.shipFrom || "";
  const isByAir = /by\s*air|\bair\b/i.test(shipFrom);

  return {
    "Item": pr.itemCode || "",
    "Item Description": pr.itemDescription || "",
    "Color": pr.colorCode || "",
    "Size": pr.size || "",
    "PO Due Date": fmtDateSlash(pr.poDueDate),
    "PO Delivery  Date": fmtDateSlash(shipment.shipmentDate),
    "Item Ship From": shipFrom,
    "Ordered": parseFloat((pr.originalQty ?? 0).toFixed(2)),
    "Qty Original PO": qtyOriginalPo,
    "U/M": pr.uomRaw || "YD",
    "PO Num": "",
    "Vendor": pr.vendor || "",
    "Ref.CO": pr.refCoRaw || "",
    "Cust Num": pr.customerCode || "",
    "Amount": amount,
    "Currency": pr.planExtendedCostCurrencyRaw || pr.currency || "",
    "Order Minimum": pr.moq ?? "",
    "Order Multiple": pr.orderMultipleRaw ?? "",
    "Unit Weight": pr.unitWeightRaw ?? "",
    "PO Date": fmtDateSlash(generatedOn),
    "Payment Term": pr.termDescriptionRaw || "",
    "Tech Des": pr.techDescRaw || "",
    "RMA": "",
    "Season": pr.seasonRaw || "",
    "Buy": pr.buyerRaw || "",
    "Plan Cost": planCost ?? "",
    "Unit Price with surcharge": pr.unitPrice ?? "",
    "Incoterm": pr.incoTermCodeRaw || pr.incoterm || "",
    "Ship Via": isByAir ? "By Air" : "By Sea",
    "Ship From": shipFrom
  };
}

// Returns the scenario's shipments (excluding empty ones) ordered by PO
// Delivery Date (vendor loading / ship date) ascending — the same field used
// to sort/name shipments across this file.
function shipmentsInDeliveryOrder(scenario: ProcessedScenario): ShipmentGroup[] {
  return scenario.shipments
    .filter(s => s.totalQty > 0 && s.items && s.items.length > 0)
    .slice()
    .sort((a, b) => {
      const da = (a.shipmentDate || a.date)?.getTime() ?? 0;
      const db = (b.shipmentDate || b.date)?.getTime() ?? 0;
      return da - db;
    });
}

/**
 * Download Combined Excel Report — a single workbook containing every
 * shipment's PR lines for the active scenario, ordered by PO Delivery Date
 * (i.e. Shipment 1's lines first, then Shipment 2's, etc.), with the exact 30
 * columns of the reference "combined" template.
 */
export function exportCombinedExcelReport(activeScenario: ProcessedScenario) {
  const generatedOn = new Date();
  const orderedShipments = shipmentsInDeliveryOrder(activeScenario);

  const rows: Record<string, any>[] = [];
  orderedShipments.forEach(shipment => {
    shipment.items.forEach(pr => {
      rows.push(buildCombinedRow(pr, shipment, generatedOn));
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: COMBINED_REPORT_HEADERS });
  ws["!cols"] = COMBINED_REPORT_HEADERS.map(h => ({ wch: Math.max(12, Math.min(28, h.trim().length + 4)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Combined Requisition Output");

  XLSX.writeFile(wb, `VT_Garment_Scenario_${activeScenario.id}_Combined_Report.xlsx`);
}

/**
 * Download Separated Excel — a ZIP file containing one workbook per shipment
 * in the active scenario. Each workbook is named after that shipment's PO
 * Delivery Date and contains only the "PR Num" / "PR Line" of every PR line
 * assigned to that shipment (i.e. its Consolidated Materials).
 */
export async function exportSeparatedExcelZip(activeScenario: ProcessedScenario) {
  const orderedShipments = shipmentsInDeliveryOrder(activeScenario);
  const zip = new JSZip();
  const usedNames = new Set<string>();

  orderedShipments.forEach(shipment => {
    const rows = shipment.items.map(pr => ({
      "PR Num": pr.requisitionRaw || pr.id,
      "PR Line": pr.lineRaw || ""
    }));

    const ws = XLSX.utils.json_to_sheet(rows, { header: ["PR Num", "PR Line"] });
    // Force PR Num to be treated as text so leading zeros / formatting survive.
    const range = ws["!ref"];
    if (range) {
      const maxRow = parseInt(range.split(":")[1].replace(/^[A-Z]+/, ""), 10);
      for (let r = 2; r <= maxRow; r++) {
        const cell = ws[`A${r}`];
        if (cell && cell.v !== undefined && cell.v !== null) {
          cell.t = "s";
          cell.v = String(cell.v);
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shipment Materials");

    let baseName = fmtDateForFileName(shipment.shipmentDate);
    let fileName = `${baseName}.xlsx`;
    let dupeSuffix = 2;
    while (usedNames.has(fileName)) {
      fileName = `${baseName} (${dupeSuffix}).xlsx`;
      dupeSuffix++;
    }
    usedNames.add(fileName);

    const arrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    zip.file(fileName, arrayBuffer);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `VT_Garment_Scenario_${activeScenario.id}_Separated_Shipments.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
