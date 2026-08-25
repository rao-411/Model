import test from "node:test";
import assert from "node:assert/strict";
import { alignBasePoDueDateToLoadingRules, processScenario } from "./optimizer";
import { getDefaultLoadingDateRules } from "./defaultLoadingDates";
import { loadSamplePrEntries } from "./data";
import { PrEntry, ScenarioDef } from "./types";

test("the built-in sample data sets shipFrom and mcq on every entry, so it exercises the same logic as a real manual upload", () => {
  const entries = loadSamplePrEntries();
  assert.ok(entries.length > 0, "sample data should not be empty");

  const missingShipFrom = entries.filter(e => !e.shipFrom || e.shipFrom.trim() === "");
  assert.equal(
    missingShipFrom.length, 0,
    `every sample entry must have shipFrom set (e.g. "Taiwan Keelung") — otherwise the Taiwan Keelung-specific loading-day (Tue/Fri) and transit-time logic silently falls back to the generic default, causing the sample loader to behave differently from a real manual upload. Missing on: ${missingShipFrom.map(e => e.id).join(", ")}`
  );

  const missingMcq = entries.filter(e => !e.mcq || e.mcq <= 0);
  assert.equal(
    missingMcq.length, 0,
    `every sample entry must have mcq set — otherwise it silently falls back to the app's global default MCQ instead of this dataset's own documented threshold. Missing on: ${missingMcq.map(e => e.id).join(", ")}`
  );
});

test("shipment quantity rounding is not thrown off by floating-point summation noise", () => {
  const d = (day: number) => new Date(2026, 0, day); // January 2026

  const mk = (id: string, qty: number, week: number): PrEntry => ({
    id,
    itemCode: "ITEM-B",
    itemDescription: "test item",
    colorCode: "DRIFT",
    qty,
    originalQty: qty,
    unitPrice: 5,
    prDueDate: d(6),
    dueDateRaw: d(6),
    cbm: qty * 0.003,
    moq: 1,
    mcq: 0,
    shipFrom: "Taiwan Keelung",
    actualDelivery: d(6),
    currency: "USD",
    currencyRate: 35,
    vendor: "VENDOR1",
    assignedWeek: week,
  });

  // Shipment 1: a normal fractional quantity (rounds up to 1449, same
  // shape as the FORGE GREY example).
  const week1Entries = [mk("w1-a", 1448.9, 1)];

  // Shipment 2: five PR lines whose quantities sum, in decimal, to
  // exactly 420 — but summing them in floating point drifts to
  // 420.00000000000006 (verified: 326.1 + 81.1 + 8.3 + 2.5 + 2). Naive
  // Math.ceil/Math.floor on that noisy sum rounds to 421 instead of 420
  // (the DRIED VANILLA bug). The same class of bug can drift the other
  // way too — a true 701.0 landing just under the integer and Math.floor
  // cutting it to 700 (the FORGE GREY bug) — this test covers the
  // above-the-integer direction since it's the more common case.
  const driftParts = [326.1, 81.1, 8.3, 2.5, 2];
  // Sanity-check the drift actually reproduces in this JS runtime before
  // relying on it to exercise the bug.
  const rawSum = driftParts.reduce((a, b) => a + b, 0);
  assert.ok(rawSum > 420 && rawSum < 420.001, "test setup: expected sum to drift just above 420");

  const week2Entries = driftParts.map((qty, i) => mk(`w2-${i}`, qty, 2));

  const entries: PrEntry[] = [...week1Entries, ...week2Entries];

  const manualWeekOverrides: Record<string, number> = {};
  entries.forEach(e => { manualWeekOverrides[e.id] = e.assignedWeek!; });

  const scenarioDef: ScenarioDef = {
    id: "test",
    numShipments: 2,
    weeks: [1, 2],
    name: "Test scenario",
    splitDaysEarly: [10],
  };

  const result = processScenario(
    entries,               // entries
    scenarioDef,            // scenarioDef
    d(6),                   // D0
    0.08,                   // carryingRate
    0.10,                   // opportunityRate
    1,                      // defaultMOQ
    "Taiwan Keelung",       // shipFrom
    false,                  // enablePullForward
    false,                  // prefer20ftForOctober
    [],                     // shipmentDates
    [],                     // customRouteQuotes
    0,                      // warehouseStuckDays
    1000,                   // warehouseDailyRent
    { USD: 35.0 },          // exchangeRates
    150,                    // mcqSurchargeUSD
    "flat",                 // mcqSurchargeType
    [],                     // excessOverrides
    undefined,              // containerOverrides
    undefined,              // scenario1ContainersPool
    {},                     // vendorSurcharges
    manualWeekOverrides,    // manualWeekOverrides
    undefined,              // surchargeRules
    undefined,              // importedFclQuotes
    undefined,              // incotermRules
    500                     // defaultMCQ
  );

  const week2Qty = result.processedEntries
    .filter(p => p.assignedWeek === 2)
    .reduce((sum, p) => sum + p.qty, 0);

  assert.equal(week2Qty, 420, "shipment 2's true-420 quantity must round to 420, not 421, despite floating-point summation noise");
});

test("a shipment whose quantity is already a whole number is not pulled down by the neighboring shipments' rounding logic", () => {
  const d = (day: number) => new Date(2026, 0, day);

  const mk = (id: string, qty: number, week: number): PrEntry => ({
    id,
    itemCode: "KW-3872A",
    itemDescription: "test item",
    colorCode: "FGE:FORGE GREY",
    qty,
    originalQty: qty,
    unitPrice: 5,
    prDueDate: d(6),
    dueDateRaw: d(6),
    cbm: qty * 0.003,
    moq: 1,
    mcq: 0,
    shipFrom: "Taiwan Keelung",
    actualDelivery: d(6),
    currency: "USD",
    currencyRate: 35,
    vendor: "VENDOR1",
    assignedWeek: week,
  });

  // Reproduces the exact reported FORGE GREY sequence: shipments 1, 3, 4,
  // 5 all have real fractional remainders that legitimately go through
  // the ceil/floor arbitration, but shipment 2's true quantity is exactly
  // 701.0 — it should just be 701, regardless of what the arbitration
  // logic would have decided for it if it were treated as fractional.
  const entries: PrEntry[] = [
    mk("w1", 1448.9, 1),
    mk("w2", 701.0, 2),
    mk("w3", 1072.9, 3),
    mk("w4", 1159.6, 4),
    mk("w5", 1853.8, 5),
  ];

  const manualWeekOverrides: Record<string, number> = {};
  entries.forEach(e => { manualWeekOverrides[e.id] = e.assignedWeek!; });

  const scenarioDef: ScenarioDef = {
    id: "test",
    numShipments: 5,
    weeks: [1, 2, 3, 4, 5],
    name: "Test scenario",
    splitDaysEarly: [1, 2, 3, 4],
  };

  const result = processScenario(
    entries,                // entries
    scenarioDef,             // scenarioDef
    d(6),                    // D0
    0.08,                    // carryingRate
    0.10,                    // opportunityRate
    1,                       // defaultMOQ
    "Taiwan Keelung",        // shipFrom
    false,                   // enablePullForward
    false,                   // prefer20ftForOctober
    [],                      // shipmentDates
    [],                      // customRouteQuotes
    0,                       // warehouseStuckDays
    1000,                    // warehouseDailyRent
    { USD: 35.0 },           // exchangeRates
    150,                     // mcqSurchargeUSD
    "flat",                  // mcqSurchargeType
    [],                      // excessOverrides
    undefined,               // containerOverrides
    undefined,               // scenario1ContainersPool
    {},                      // vendorSurcharges
    manualWeekOverrides,     // manualWeekOverrides
    undefined,               // surchargeRules
    undefined,               // importedFclQuotes
    undefined,               // incotermRules
    500                      // defaultMCQ
  );

  const qtyByWeek = (w: number) => result.processedEntries
    .filter(p => p.assignedWeek === w)
    .reduce((sum, p) => sum + p.qty, 0);

  assert.equal(qtyByWeek(1), 1449, "shipment 1 (1448.9) should round up to 1449");
  assert.equal(qtyByWeek(2), 701, "shipment 2 (701.0, already whole) should stay 701, not be floored to 700");
  assert.equal(qtyByWeek(3), 1073, "shipment 3 (1072.9) should round up to 1073");
  assert.equal(qtyByWeek(4), 1160, "shipment 4 (1159.6) should round up to 1160");
  assert.equal(qtyByWeek(5), 1854, "shipment 5 (1853.8) should round up to 1854");
});

test("an item's first shipment always rounds UP, even when its true quantity happens to land within the near-integer tolerance", () => {
  const d = (day: number) => new Date(2026, 5, day); // June 2026

  const mk = (id: string, qty: number, week: number): PrEntry => ({
    id,
    itemCode: "6011158",
    itemDescription: "6011158 NF N419 PRINT",
    colorCode: "# 11",
    qty,
    originalQty: qty,
    unitPrice: 5,
    prDueDate: d(29),
    dueDateRaw: d(29),
    cbm: qty * 0.003,
    moq: 1,
    mcq: 999,
    shipFrom: "Taiwan Keelung",
    actualDelivery: d(29),
    currency: "USD",
    currencyRate: 35,
    vendor: "IFTCT01",
    assignedWeek: week,
  });

  // Reproduces the reported bug: shipment 1 has NO quantity for this
  // item/color (so it's skipped and shipment 2 becomes the item's true
  // FIRST shipment), and shipment 2's real summed quantity (2063.869 +
  // 2 + 1 + 25.809 + 39.328 = 2132.006) happens to land within
  // NEAR_INTEGER_TOLERANCE (0.05) of a whole number. That 0.006 is a
  // real fractional remainder from the source data, not floating-point
  // noise (which cleanQtyFloat already washes out well below this
  // tolerance) — so it must still go through the mandatory "first
  // shipment rounds up" rule (-> 2133), not get silently rounded to the
  // nearest integer (2132), which previously undercounted the shipment
  // by 1 unit and broke the surplus bank every later shipment draws from.
  const entries: PrEntry[] = [
    mk("a", 2063.869, 2),
    mk("b", 2.000, 2),
    mk("c", 1.000, 2),
    mk("d", 25.809, 2),
    mk("e", 39.328, 2),
  ];

  const manualWeekOverrides: Record<string, number> = {};
  entries.forEach(e => { manualWeekOverrides[e.id] = e.assignedWeek!; });

  const scenarioDef: ScenarioDef = {
    id: "test",
    numShipments: 2,
    weeks: [1, 2],
    name: "Test scenario",
    splitDaysEarly: [10],
  };

  const result = processScenario(
    entries,                // entries
    scenarioDef,             // scenarioDef
    d(1),                    // D0
    0.08,                    // carryingRate
    0.10,                    // opportunityRate
    1,                       // defaultMOQ
    "Taiwan Keelung",        // shipFrom
    false,                   // enablePullForward
    false,                   // prefer20ftForOctober
    [],                      // shipmentDates
    [],                      // customRouteQuotes
    0,                       // warehouseStuckDays
    1000,                    // warehouseDailyRent
    { USD: 35.0 },           // exchangeRates
    150,                     // mcqSurchargeUSD
    "flat",                  // mcqSurchargeType
    [],                      // excessOverrides
    undefined,               // containerOverrides
    undefined,               // scenario1ContainersPool
    {},                      // vendorSurcharges
    manualWeekOverrides,     // manualWeekOverrides
    undefined,               // surchargeRules
    undefined,               // importedFclQuotes
    undefined,               // incotermRules
    999                      // defaultMCQ
  );

  const qtyByWeek = (w: number) => result.processedEntries
    .filter(p => p.assignedWeek === w)
    .reduce((sum, p) => sum + p.qty, 0);

  assert.equal(qtyByWeek(1), 0, "shipment 1 has no quantity for this item/color");
  assert.equal(qtyByWeek(2), 2133, "shipment 2 is this item's true first shipment (2132.006) and must round UP to 2133, not down to 2132");
});

test("individually-rounded PR lines within a whole-number shipment total must reconcile back to that total, not invent a phantom unit", () => {
  const d = (day: number) => new Date(2025, 7, day); // August 2025

  const mk = (id: string, itemCode: string, qty: number, due: Date): PrEntry => ({
    id,
    itemCode,
    itemDescription: "04387D-P2",
    colorCode: "BLK:BLACK",
    qty,
    originalQty: qty,
    unitPrice: 5,
    prDueDate: due,
    dueDateRaw: due,
    cbm: qty * 0.003,
    moq: 1,
    mcq: 999,
    shipFrom: "Taiwan Keelung",
    actualDelivery: due,
    currency: "USD",
    currencyRate: 35,
    vendor: "ILIPE01",
    assignedWeek: 1,
  });

  // Reproduces the reported bug with the exact real PR lines: two
  // different item codes ("CWXPLA0008300001" and "ZCWXPLA0008300001")
  // share the same item description/color and both land in the single
  // shipment. The main item code's lines (455.71 + 629.56 = 1085.27) go
  // through the normal ceil/residual path and correctly become 1086. The
  // second item code's lines (0.5 + 1.0 + 0.5) sum to an EXACT whole
  // number, 2.0, at the group level — but rounding each PR line
  // independently (0.5->1, 1.0->1, 0.5->1) sums to 3, one more than the
  // group's true total. Without residual reconciliation in that
  // already-whole-number case, this phantom unit silently leaked into the
  // displayed total (1086 + 3 = 1089) instead of the correct 1086 + 2 =
  // 1088 (i.e. Math.ceil(1087.27)).
  const entries: PrEntry[] = [
    mk("a", "CWXPLA0008300001", 455.71, d(12)),
    mk("b", "ZCWXPLA0008300001", 0.5, d(12)),
    mk("c", "CWXPLA0008300001", 629.56, d(30)),
    mk("d", "ZCWXPLA0008300001", 1.0, d(30)),
    mk("e", "ZCWXPLA0008300001", 0.5, d(30)),
  ];

  const manualWeekOverrides: Record<string, number> = {};
  entries.forEach(e => { manualWeekOverrides[e.id] = 1; });

  const scenarioDef: ScenarioDef = {
    id: "test",
    numShipments: 1,
    weeks: [1],
    name: "Test scenario",
    splitDaysEarly: [],
  };

  const result = processScenario(
    entries,                // entries
    scenarioDef,             // scenarioDef
    d(1),                    // D0
    0.08,                    // carryingRate
    0.10,                    // opportunityRate
    1,                       // defaultMOQ
    "Taiwan Keelung",        // shipFrom
    false,                   // enablePullForward
    false,                   // prefer20ftForOctober
    [],                      // shipmentDates
    [],                      // customRouteQuotes
    0,                       // warehouseStuckDays
    1000,                    // warehouseDailyRent
    { USD: 35.0 },           // exchangeRates
    150,                     // mcqSurchargeUSD
    "flat",                  // mcqSurchargeType
    [],                      // excessOverrides
    undefined,               // containerOverrides
    undefined,               // scenario1ContainersPool
    {},                      // vendorSurcharges
    manualWeekOverrides,     // manualWeekOverrides
    undefined,               // surchargeRules
    undefined,               // importedFclQuotes
    undefined,               // incotermRules
    999                      // defaultMCQ
  );

  // Mirrors how the UI aggregates the displayed cell: by item
  // description + color code, across every item code that shares them.
  const displayTotal = result.processedEntries
    .filter(p => (p.itemDescription || p.itemCode) === "04387D-P2" && p.colorCode === "BLK:BLACK" && p.assignedWeek === 1)
    .reduce((sum, p) => sum + p.qty, 0);

  assert.equal(displayTotal, 1088, "1087.27 must round up to 1088 (Math.ceil), not 1089 — no phantom unit from independently rounding the whole-number item-code subgroup");
});

test("an item/color split across multiple raw item codes (main fabric code + Z-prefixed placeholder code) rounds as ONE combined row, not once per item code", () => {
  const d = (day: number) => new Date(2025, 7, day); // August 2025

  const mk = (id: string, itemCode: string, qty: number, due: Date): PrEntry => ({
    id,
    itemCode,
    itemDescription: "04387D-P2",
    colorCode: "BLSG:BLUE SAGE",
    qty,
    originalQty: qty,
    unitPrice: 5,
    prDueDate: due,
    dueDateRaw: due,
    cbm: qty * 0.003,
    moq: 1,
    mcq: 999,
    shipFrom: "Taiwan Keelung",
    actualDelivery: due,
    currency: "USD",
    currencyRate: 35,
    vendor: "ILIPE01",
    assignedWeek: 2,
  });

  // Reproduces the reported bug with the exact real PR lines: the source
  // file splits this item/color across a main fabric item code
  // ("CWXPLA0008300011": 485.03 + 74.68 + 82.32 = 642.03) and a
  // "Z"-prefixed placeholder item code ("ZCWXPLA0008300011": 1.0 + 0.5 =
  // 1.5), both sharing the same item description/color and both
  // displayed as ONE row (643.53 total). Grouping the rounding cascade by
  // raw item code (instead of by item description, which is what the UI
  // actually displays and what MCQ is evaluated against) ran the
  // "shipment 1 always rounds up" rule independently for each item code
  // -> ceil(642.03)=643 and ceil(1.5)=2 -> 645, one unit more than
  // ceiling the row's true combined total once (ceil(643.53)=644).
  const entries: PrEntry[] = [
    mk("a", "ZCWXPLA0008300011", 1.000, d(4)),
    mk("b", "CWXPLA0008300011", 485.030, d(17)),
    mk("c", "ZCWXPLA0008300011", 0.500, d(17)),
    mk("d", "CWXPLA0008300011", 74.680, d(23)),
    mk("e", "CWXPLA0008300011", 82.320, d(31)),
  ];

  const manualWeekOverrides: Record<string, number> = {};
  entries.forEach(e => { manualWeekOverrides[e.id] = 2; });

  const scenarioDef: ScenarioDef = {
    id: "test",
    numShipments: 2,
    weeks: [1, 2],
    name: "Test scenario",
    splitDaysEarly: [10],
  };

  const result = processScenario(
    entries,                // entries
    scenarioDef,             // scenarioDef
    d(1),                    // D0
    0.08,                    // carryingRate
    0.10,                    // opportunityRate
    1,                       // defaultMOQ
    "Taiwan Keelung",        // shipFrom
    false,                   // enablePullForward
    false,                   // prefer20ftForOctober
    [],                      // shipmentDates
    [],                      // customRouteQuotes
    0,                       // warehouseStuckDays
    1000,                    // warehouseDailyRent
    { USD: 35.0 },           // exchangeRates
    150,                     // mcqSurchargeUSD
    "flat",                  // mcqSurchargeType
    [],                      // excessOverrides
    undefined,               // containerOverrides
    undefined,               // scenario1ContainersPool
    {},                      // vendorSurcharges
    manualWeekOverrides,     // manualWeekOverrides
    undefined,               // surchargeRules
    undefined,               // importedFclQuotes
    undefined,               // incotermRules
    999                      // defaultMCQ
  );

  const displayTotal = result.processedEntries
    .filter(p => (p.itemDescription || p.itemCode) === "04387D-P2" && p.colorCode === "BLSG:BLUE SAGE" && p.assignedWeek === 2)
    .reduce((sum, p) => sum + p.qty, 0);

  assert.equal(displayTotal, 644, "643.53 must round up to 644 (Math.ceil once for the combined row), not 645 (double-ceiled once per underlying item code)");
});

test("per-PR Transit Lead Time and Consolidate Weekday override the shipFrom-based defaults", () => {
  const d = (day: number) => new Date(2026, 0, day); // January 2026
  // Jan 6 = Tue, Jan 7 = Wed, Jan 9 = Fri (Tue/Fri are Taiwan Keelung's
  // built-in default loading days; Wednesday is not one of them).

  const entry: PrEntry = {
    id: "custom-1",
    itemCode: "ITEM-C",
    itemDescription: "test item",
    colorCode: "CUSTOM",
    qty: 500,
    originalQty: 500,
    unitPrice: 5,
    prDueDate: d(7),
    dueDateRaw: d(7),
    cbm: 1.5,
    moq: 1,
    mcq: 0,
    shipFrom: "Taiwan Keelung",
    actualDelivery: d(7), // a Wednesday — not a default Taiwan Keelung loading day
    currency: "USD",
    currencyRate: 35,
    vendor: "VENDOR1",
    transitLeadTimeDays: 25, // deliberately different from any built-in default
    consolidateWeekdayRaw: "Wednesday",
    assignedWeek: 1,
  };

  const manualWeekOverrides: Record<string, number> = { "custom-1": 1 };

  const scenarioDef: ScenarioDef = {
    id: "test",
    numShipments: 1,
    weeks: [1],
    name: "Test scenario",
    splitDaysEarly: [],
  };

  const result = processScenario(
    [entry],                // entries
    scenarioDef,             // scenarioDef
    d(7),                    // D0
    0.08,                    // carryingRate
    0.10,                    // opportunityRate
    1,                       // defaultMOQ
    "Taiwan Keelung",        // shipFrom
    false,                   // enablePullForward
    false,                   // prefer20ftForOctober
    [],                      // shipmentDates
    [],                      // customRouteQuotes
    0,                       // warehouseStuckDays
    1000,                    // warehouseDailyRent
    { USD: 35.0 },           // exchangeRates
    150,                     // mcqSurchargeUSD
    "flat",                  // mcqSurchargeType
    [],                      // excessOverrides
    undefined,               // containerOverrides
    undefined,               // scenario1ContainersPool
    {},                      // vendorSurcharges
    manualWeekOverrides,     // manualWeekOverrides
    undefined,               // surchargeRules
    undefined,               // importedFclQuotes
    undefined,               // incotermRules
    500                      // defaultMCQ
  );

  const week1 = result.shipments.find(s => s.week === 1);
  assert.ok(week1, "week 1 shipment should exist");
  assert.equal(
    week1!.shipmentDate?.toDateString(),
    d(7).toDateString(),
    "shipment date should land on Wednesday (the PR's own Consolidate Weekday), not the Taiwan Keelung default Tue/Fri"
  );

  const pr = result.processedEntries.find(p => p.id === "custom-1");
  assert.ok(pr, "PR should exist in processed entries");
  assert.equal(
    pr!.poDueDate?.toDateString(),
    new Date(2026, 0, 7 + 25).toDateString(),
    "PO due date should use the PR's own 25-day Transit Lead Time, not the route default"
  );
});

test("alignBasePoDueDateToLoadingRules snaps to the nearest earlier loading day", () => {
  const tentative = new Date(2026, 8, 30); // 2026-09-30 (Wednesday)
  const result = alignBasePoDueDateToLoadingRules(
    tentative,
    "Taiwan Keelung",
    getDefaultLoadingDateRules()
  );

  assert.equal(result.toDateString(), new Date(2026, 8, 29).toDateString());
});

test("MCQ pull-forward only combines quantity when doing so is actually cheaper than paying the surcharge", () => {
  const d = (day: number, month = 0) => new Date(2026, month, day);

  const mk = (
    id: string, color: string, qty: number, unitPrice: number,
    actualDelivery: Date, dueDateRaw: Date
  ): PrEntry => ({
    id,
    itemCode: "ITEM-A",
    itemDescription: "test item",
    colorCode: color,
    qty,
    originalQty: qty,
    unitPrice,
    prDueDate: dueDateRaw,
    dueDateRaw,
    cbm: qty * 0.003,
    moq: 1,
    mcq: 0,
    shipFrom: "Taiwan Keelung",
    actualDelivery,
    currency: "USD",
    currencyRate: 35,
    vendor: "VENDOR1",
  });

  // Week 1 anchor: Jan 6. Week 2 anchor: Apr 6 (~90 days later) — a big
  // gap, so pulling something from week 2 into week 1 means shipping it
  // roughly 90 days earlier than it actually needs to.
  const w1Date = d(6, 0);
  const w2Date = d(6, 3);

  const entries: PrEntry[] = [
    mk("anchor1", "ANCHOR1", 1000, 5, w1Date, w1Date),
    mk("anchor2", "ANCHOR2", 1000, 5, w2Date, w2Date),
    // RED: low-value remainder — cheap to combine, should be pulled forward.
    mk("red_w1", "RED", 480, 2, w1Date, w1Date),
    mk("red_w2", "RED", 50, 2, w2Date, w2Date),
    // BLUE: high-value remainder with a big date gap — pulling it forward
    // would rack up far more carrying/opportunity cost than the flat
    // surcharge costs, so it should stay put.
    mk("blue_w2", "BLUE", 50, 500, w2Date, w2Date),
  ];

  const scenarioDef: ScenarioDef = {
    id: "test",
    numShipments: 2,
    weeks: [1, 2],
    name: "Test scenario",
    splitDaysEarly: [10],
  };

  const result = processScenario(
    entries,               // entries
    scenarioDef,            // scenarioDef
    w1Date,                 // D0
    0.08,                   // carryingRate
    0.10,                   // opportunityRate
    1,                      // defaultMOQ
    "Taiwan Keelung",       // shipFrom
    true,                   // enablePullForward
    false,                  // prefer20ftForOctober
    [],                     // shipmentDates
    [],                     // customRouteQuotes
    0,                      // warehouseStuckDays
    1000,                   // warehouseDailyRent
    { USD: 35.0 },          // exchangeRates
    150,                    // mcqSurchargeUSD
    "flat",                 // mcqSurchargeType
    [],                     // excessOverrides
    undefined,              // containerOverrides
    undefined,              // scenario1ContainersPool
    {},                     // vendorSurcharges
    undefined,              // manualWeekOverrides
    undefined,              // surchargeRules
    undefined,              // importedFclQuotes
    undefined,              // incotermRules
    500                     // defaultMCQ
  );

  const red = result.processedEntries.find(p => p.id === "red_w2");
  const blue = result.processedEntries.find(p => p.id === "blue_w2");
  assert.ok(red && blue, "both PRs should exist in the processed entries");

  assert.equal(red!.assignedWeek, 1, "cheap-to-combine RED quantity should be pulled forward into week 1");
  assert.equal(blue!.assignedWeek, 2, "expensive-to-combine BLUE quantity should stay in week 2 and pay the surcharge instead");
  assert.equal(red!.naturalAssignedWeek, 2, "RED's naturalAssignedWeek should still reflect its pre-pull-forward shipment (week 2), even though it was moved to week 1");

  const blueAlert = result.moqAlerts.find(a => a.colorCode === "BLUE");
  assert.ok(blueAlert, "BLUE should have a surcharge alert");
  assert.equal(blueAlert!.moved, false, "BLUE should be logged as not moved");
});

test("a PR with slack catches a ride on a later already-scheduled shipment, without dragging that shipment's date earlier", () => {
  const d = (day: number) => new Date(2026, 0, day); // January 2026
  // Jan 6 = Tue, Jan 9 = Fri, Jan 16 = Fri (both allowed loading days for
  // Taiwan Keelung).

  const mk = (id: string, color: string, qty: number, prDueDate: Date, actualDelivery: Date): PrEntry => ({
    id,
    itemCode: "ITEM-A",
    itemDescription: "test item",
    colorCode: color,
    qty,
    originalQty: qty,
    unitPrice: 5,
    prDueDate,
    cbm: qty * 0.003,
    moq: 1,
    mcq: 1,
    shipFrom: "Taiwan Keelung",
    actualDelivery,
    currency: "USD",
    currencyRate: 35,
  });

  const entries: PrEntry[] = [
    // Bucket 1 anchor: ships as soon as it's ready, Jan 6.
    mk("anchor", "RED", 1000, d(6), d(6)),
    // Bucket 1 member with slack: its own ready date (actualDelivery) keeps
    // it grouped with the anchor by the Days Early criterion, but its real
    // deadline (PR Delivery Date) is comfortably after bucket 2's date.
    mk("target", "RED", 800, d(20), d(9)),
    // Bucket 2: a single small "leftover" PR that alone anchors week 2 at
    // Jan 16 (already a valid Taiwan Keelung loading day).
    mk("leftover", "BLUE", 2, d(16), d(16)),
  ];

  const scenarioDef: ScenarioDef = {
    id: "test",
    numShipments: 2,
    weeks: [1, 2],
    name: "Test scenario",
    splitDaysEarly: [6],
  };

  const result = processScenario(
    entries,                // entries
    scenarioDef,             // scenarioDef
    d(6),                    // D0
    0.1,                     // carryingRate
    0.1,                     // opportunityRate
    1,                       // defaultMOQ
    "Taiwan Keelung",        // shipFrom
    false,                   // enablePullForward off, to isolate the loading-day reassignment
    false,                   // prefer20ftForOctober
    [],                      // shipmentDates
    [],                      // customRouteQuotes
    0,                       // warehouseStuckDays
    1000,                    // warehouseDailyRent
    { USD: 35.0 },           // exchangeRates
    150,                     // mcqSurchargeUSD
    "flat",                  // mcqSurchargeType
    [],                      // excessOverrides
    undefined,               // containerOverrides
    undefined,               // scenario1ContainersPool
    {},                      // vendorSurcharges
    undefined,               // manualWeekOverrides
    undefined,               // surchargeRules
    undefined,               // importedFclQuotes
    undefined,               // incotermRules
    1                        // defaultMCQ
  );

  const target = result.processedEntries.find(p => p.id === "target");
  assert.ok(target, "target PR should exist in the processed entries");
  assert.equal(target!.assignedWeek, 2, "the PR with slack should move to week 2 to catch the later shipment");

  const week2 = result.shipments.find(s => s.week === 2);
  assert.ok(week2, "week 2 shipment should exist");
  assert.equal(
    week2!.shipmentDate?.toDateString(),
    d(16).toDateString(),
    "week 2's shipment date must stay Jan 16 (the leftover's own date) — it must not be dragged earlier by the PR that caught a ride on it"
  );
});

