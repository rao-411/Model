import { useState, useMemo, useEffect, useRef } from "react";
import Header from "./components/Header";
import PrUploader from "./components/PrUploader";
import AdvancedSettings from "./components/AdvancedSettings";
import ScenarioOverview from "./components/ScenarioOverview";
import ScenarioInspector from "./components/ScenarioInspector";
import StepSidebar from "./components/StepSidebar";
import { PrEntry, ProcessedScenario, RouteQuote, ExcessMcqOverride, WarehouseRentConfig, SurchargeRule, ImportedFclQuote, IncotermRule, LoadingDateRule, ContainerOverride } from "./types";
import { processAllScenarios, getDefaultRouteQuotes, calculateFleetScenarios } from "./optimizer";
import { getDefaultImportedFclQuotes } from "./defaultFclQuotes";
import { getDefaultIncotermRules } from "./defaultIncoterms";
import { getDefaultLoadingDateRules } from "./defaultLoadingDates";
import { Info, HelpCircle, FileSpreadsheet, Layers, BarChart, CheckCircle2, Sliders, BarChart3, Ship } from "lucide-react";
import { Language, t } from "./utils/translate";

export default function App() {
  const [lang, setLang] = useState<Language>("EN");
  const [entries, setEntries] = useState<PrEntry[]>([]);
  const [carryingRate, setCarryingRate] = useState<number>(0.06); // Default 6.0%
  const [opportunityRate, setOpportunityRate] = useState<number>(0.10); // Default 10.0% WACC
  const [defaultMoq, setDefaultMoq] = useState<number>(1000); // Default MOQ
  const [defaultMcq, setDefaultMcq] = useState<number>(500); // Default MCQ
  const [shipFrom, setShipFrom] = useState<string>("Taiwan"); // Default Origin
  const [previouslyExistingContainers, setPreviouslyExistingContainers] = useState<number>(() => {
    const saved = localStorage.getItem("procurement_previous_existing_containers_v1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed === "number") return Math.max(0, parsed);
      } catch (e) {
        console.error("Error parsing saved previously existing containers", e);
      }
    }
    return 0;
  });
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("1");
  const [enablePullForward, setEnablePullForward] = useState<boolean>(false); // Default to false to match raw scenarios initially
  const [prefer20ftForOctober, setPrefer20ftForOctober] = useState<boolean>(false); // Default to false (use LCL)

  // New parameters requested by user
  const [customQuotes, setCustomQuotes] = useState<RouteQuote[]>(() => {
    const saved = localStorage.getItem("procurement_custom_quotes_v4");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing saved custom quotes", e);
      }
    }
    return Object.values(getDefaultRouteQuotes());
  });

  useEffect(() => {
    localStorage.setItem("procurement_custom_quotes_v4", JSON.stringify(customQuotes));
  }, [customQuotes]);

  const [importedFclQuotes, setImportedFclQuotes] = useState<ImportedFclQuote[]>(() => {
    const saved = localStorage.getItem("procurement_imported_fcl_quotes_v4");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing saved imported FCL quotes", e);
      }
    }
    return getDefaultImportedFclQuotes();
  });

  useEffect(() => {
    localStorage.setItem("procurement_imported_fcl_quotes_v4", JSON.stringify(importedFclQuotes));
  }, [importedFclQuotes]);

  useEffect(() => {
    localStorage.setItem("procurement_previous_existing_containers_v1", JSON.stringify(previouslyExistingContainers));
  }, [previouslyExistingContainers]);

  const [warehouseStuckDays, setWarehouseStuckDays] = useState<number>(0);
  const [warehouseDailyRent, setWarehouseDailyRent] = useState<WarehouseRentConfig>(() => {
    const saved = localStorage.getItem("procurement_warehouse_rent_v4");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved warehouse rent config", e);
      }
    }
    return {
      gp20: 160,
      gp40: 320,
      hq40: 320,
      lcl: 20
    };
  });

  useEffect(() => {
    localStorage.setItem("procurement_warehouse_rent_v4", JSON.stringify(warehouseDailyRent));
  }, [warehouseDailyRent]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("procurement_exchange_rates_v1");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { USD: 33.5581 };
  });

  const [mcqMoqPreferences, setMcqMoqPreferences] = useState<Record<string, "surcharge" | "pr_file">>(() => {
    const saved = localStorage.getItem("procurement_mcq_moq_preferences_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved mcq moq preferences", e);
      }
    }
    return {};
  });

  const handleSelectMcqMoqPreference = (key: string, choice: "surcharge" | "pr_file") => {
    setMcqMoqPreferences(prev => {
      const next = { ...prev, [key]: choice };
      localStorage.setItem("procurement_mcq_moq_preferences_v1", JSON.stringify(next));
      return next;
    });
  };

  const [currency, setCurrency] = useState<"THB" | "USD">("THB");

  const [acceptedFlags, setAcceptedFlags] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("procurement_accepted_flags_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved accepted flags", e);
      }
    }
    return {};
  });

  const handleAcceptFlag = (flagKey: string) => {
    setAcceptedFlags(prev => {
      const next = { ...prev, [flagKey]: true };
      localStorage.setItem("procurement_accepted_flags_v1", JSON.stringify(next));
      return next;
    });
  };

  const [activeCurrencies, setActiveCurrencies] = useState<string[]>(["USD"]);
  const [prExtractedCurrencies, setPrExtractedCurrencies] = useState<Record<string, boolean>>({});
  const [mcqSurchargeUSD, setMcqSurchargeUSD] = useState<number>(150);
  const [mcqSurchargeType, setMcqSurchargeType] = useState<"flat" | "unitPriceIncrease">("flat");
  const [vendorSurcharges, setVendorSurcharges] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("procurement_vendor_surcharges_v4");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved vendor surcharges", e);
      }
    }
    return {
      "Sourcing Fallback": 150,
      "KINGWHALE CORPORATION": 150
    };
  });

  useEffect(() => {
    localStorage.setItem("procurement_vendor_surcharges_v4", JSON.stringify(vendorSurcharges));
  }, [vendorSurcharges]);

  const [surchargeRules, setSurchargeRules] = useState<SurchargeRule[]>(() => {
    const saved = localStorage.getItem("procurement_surcharge_rules_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved surcharge rules", e);
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("procurement_surcharge_rules_v1", JSON.stringify(surchargeRules));
  }, [surchargeRules]);

  const [incotermRules, setIncotermRules] = useState<IncotermRule[]>(() => {
    const saved = localStorage.getItem("procurement_incoterm_rules_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved incoterm rules", e);
      }
    }
    return getDefaultIncotermRules();
  });

  useEffect(() => {
    localStorage.setItem("procurement_incoterm_rules_v1", JSON.stringify(incotermRules));
  }, [incotermRules]);

  // Vendor codes actually present in the currently loaded PR data (the
  // uploaded file, or the sample data) — used to keep the Incoterm-related
  // displays below scoped to what's actually in use, rather than showing
  // every vendor that's ever had a rule saved (defaults, or leftovers from
  // a previously loaded file, persist in incotermRules across uploads).
  const activeVendorCodes = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => {
      if (e.vendor) set.add(e.vendor.toUpperCase().trim());
    });
    return set;
  }, [entries]);

  // Only the Incoterm rules for vendors that are actually in the currently
  // loaded PR data — used solely by the "Ship From & Incoterm" reference
  // panel, so it shows what's actually in play right now rather than every
  // vendor that's ever had a rule saved. The conflict check above
  // deliberately does NOT use this — it checks the full rules list.
  const activeIncotermRules = useMemo(() => {
    if (activeVendorCodes.size === 0) return incotermRules;
    return incotermRules.filter(r => r.vendorCode && activeVendorCodes.has(r.vendorCode.toUpperCase().trim()));
  }, [incotermRules, activeVendorCodes]);

  // Vendors that currently have more than one distinct Incoterm across
  // their active rules in the table below — e.g. one row says FOB, another
  // says EXW/CIF for the same vendor code (whether that came from
  // conflicting data in the uploaded PR file, or from someone adding a
  // second manual rule for a vendor that already has one). Derived live
  // from the FULL incotermRules list — deliberately NOT scoped to vendors
  // in the currently loaded file, since a conflicting rule is worth
  // flagging regardless of whether that vendor's PR happens to be loaded
  // right now (e.g. reviewing/cleaning up the rules table itself). Keyed by
  // vendor code alone (not vendor+origin) so it still catches the conflict
  // even when "Ship From" differs or is blank between the rows.
  const incotermConflicts = useMemo(() => {
    const vendorIncotermValues: Record<string, Set<string>> = {};
    incotermRules.forEach(rule => {
      if (!rule.vendorCode || !rule.incoterm) return;
      const vendorKey = rule.vendorCode.toUpperCase().trim();
      if (!vendorIncotermValues[vendorKey]) vendorIncotermValues[vendorKey] = new Set();
      vendorIncotermValues[vendorKey].add(rule.incoterm.toUpperCase().trim());
    });

    const conflicts: Array<{ vendorCode: string; incoterms: string[] }> = [];
    Object.entries(vendorIncotermValues).forEach(([vendorCode, values]) => {
      if (values.size > 1) {
        conflicts.push({ vendorCode, incoterms: Array.from(values).sort() });
      }
    });
    return conflicts;
  }, [incotermRules]);

  const [loadingDateRules, setLoadingDateRules] = useState<LoadingDateRule[]>(() => {
    const defaults = getDefaultLoadingDateRules();
    const saved = localStorage.getItem("procurement_loading_date_rules_v1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge saved rules with defaults rather than trusting localStorage
          // verbatim. This guards against a stale/incomplete snapshot from an
          // earlier session (e.g. missing the Taiwan Keelung rule entirely,
          // or with corrupted/empty allowedDays) silently shadowing the
          // correct default — critical now that the editing UI is hidden and
          // there's no way for the user to notice or reset it.
          const merged = [...parsed];
          defaults.forEach(def => {
            const existingIdx = merged.findIndex((r: any) =>
              r && (r.id === def.id || (r.country || "").trim().toLowerCase() === def.country.toLowerCase())
            );
            if (existingIdx === -1) {
              merged.push(def);
            } else {
              const existing = merged[existingIdx];
              if (!existing || !Array.isArray(existing.allowedDays) || existing.allowedDays.length === 0) {
                merged[existingIdx] = def;
              }
            }
          });
          return merged;
        }
      } catch (e) {
        console.error("Error parsing saved loading date rules", e);
      }
    }
    return defaults;
  });

  useEffect(() => {
    localStorage.setItem("procurement_loading_date_rules_v1", JSON.stringify(loadingDateRules));
  }, [loadingDateRules]);

  const [excessOverrides, setExcessOverrides] = useState<ExcessMcqOverride[]>([]);
  const [manualWeekOverrides, setManualWeekOverrides] = useState<Record<string, Record<string, number>>>(() => {
    const saved = localStorage.getItem("procurement_manual_week_overrides_v4");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved manual week overrides", e);
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem("procurement_manual_week_overrides_v4", JSON.stringify(manualWeekOverrides));
  }, [manualWeekOverrides]);

  const handleMovePrLine = (prId: string, targetWeek: number) => {
    setManualWeekOverrides(prev => {
      const scenarioOverrides = prev[selectedScenarioId] || {};
      return {
        ...prev,
        [selectedScenarioId]: {
          ...scenarioOverrides,
          [prId]: targetWeek
        }
      };
    });
  };

  // Manual quantity overrides typed directly into the MCQ Shipment Calendar Matrix cells.
  // Keyed per scenario, then per "colorCode__week" cell.
  const [manualMatrixQtyOverrides, setManualMatrixQtyOverrides] = useState<Record<string, Record<string, number>>>(() => {
    const saved = localStorage.getItem("procurement_manual_matrix_qty_overrides_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved manual matrix qty overrides", e);
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem("procurement_manual_matrix_qty_overrides_v1", JSON.stringify(manualMatrixQtyOverrides));
  }, [manualMatrixQtyOverrides]);

  const handleMatrixQtyChange = (scenarioId: string, itemDescription: string, colorCode: string, week: number, value: number | null) => {
    const cellKey = `${itemDescription}__${colorCode}__${week}`;
    setManualMatrixQtyOverrides(prev => {
      const scenarioOverrides = { ...(prev[scenarioId] || {}) };
      if (value === null) {
        delete scenarioOverrides[cellKey];
      } else {
        scenarioOverrides[cellKey] = value;
      }
      return {
        ...prev,
        [scenarioId]: scenarioOverrides
      };
    });
  };

  // Manual container mix overrides set from the Shipment Containers & Bins
  // tab. Keyed per scenario, then per shipment week (as a string key).
  const [containerOverrides, setContainerOverrides] = useState<Record<string, Record<string, ContainerOverride>>>(() => {
    const saved = localStorage.getItem("procurement_container_overrides_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved container overrides", e);
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem("procurement_container_overrides_v1", JSON.stringify(containerOverrides));
  }, [containerOverrides]);

  const handleContainerOverrideChange = (scenarioId: string, week: number, override: ContainerOverride | null) => {
    setContainerOverrides(prev => {
      const scenarioOverrides = { ...(prev[scenarioId] || {}) };
      if (override === null) {
        delete scenarioOverrides[`${week}`];
      } else {
        scenarioOverrides[`${week}`] = override;
      }
      return {
        ...prev,
        [scenarioId]: scenarioOverrides
      };
    });
  };

  // Manual fixes for items flagged with a $0 unit price. Flat (not
  // per-scenario) since a price correction is a data fix that should
  // apply uniformly across every scenario, not just the one being viewed.
  const [unitPriceOverrides, setUnitPriceOverrides] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("procurement_unit_price_overrides_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved unit price overrides", e);
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem("procurement_unit_price_overrides_v1", JSON.stringify(unitPriceOverrides));
  }, [unitPriceOverrides]);

  const handleUnitPriceFix = (itemCode: string, colorCode: string, value: number | null | "zero") => {
    const key = `${itemCode}__${colorCode}`;
    setUnitPriceOverrides(prev => {
      const copy = { ...prev };
      if (value === null) {
        delete copy[key];
      } else if (value === "zero") {
        copy[key] = 0;
      } else {
        copy[key] = value;
      }
      return copy;
    });
  };

  const handleResetOverrides = () => {
    setManualWeekOverrides(prev => {
      const copy = { ...prev };
      delete copy[selectedScenarioId];
      return copy;
    });
    setManualMatrixQtyOverrides(prev => {
      const copy = { ...prev };
      delete copy[selectedScenarioId];
      return copy;
    });
    setContainerOverrides(prev => {
      const copy = { ...prev };
      delete copy[selectedScenarioId];
      return copy;
    });
    setMcqMoqPreferences({});
    localStorage.removeItem("procurement_mcq_moq_preferences_v1");
    setUnitPriceOverrides({});
    localStorage.removeItem("procurement_unit_price_overrides_v1");
    setExcessOverrides([]);
    setAcceptedFlags({});
    localStorage.removeItem("procurement_accepted_flags_v1");
  };

  const [shipmentDates, setShipmentDates] = useState<string[]>([]);

  // Customized transit times per route (in days)
  const [transitTimes, setTransitTimes] = useState<Record<string, number>>({
    ITALY: 30,
    BUSAN: 14,
    TAIWAN: 18, // Default 18 days for Keelung to VT Garment
    HK: 7,
    HCM: 5
  });

  const handleTransitTimeChange = (route: string, days: number) => {
    setTransitTimes(prev => ({
      ...prev,
      [route]: days
    }));
  };

  // NOTE: shipmentDates intentionally has NO auto-population effect.
  // It previously forced a fixed weekly cadence (week1, +7, +14, +21 days)
  // onto the first 4 shipment dates as active manual overrides — but real
  // gaps between dynamically-computed groups are irregular (e.g.
  // [2, 1, 3, 2, 18, 4] days for a validated 165-PR dataset), not uniform
  // 7-day steps. Leaving this array empty by default means processScenario
  // always uses its own correct per-group alignDepartureDateToLoadingRules
  // computation, based on each group's true earliest date. shipmentDates
  // is only ever populated when the user explicitly edits a date in the
  // Ship Dates tab (see ScenarioInspector.tsx's setShipmentDates call).

  // Run Sourcing Matrix Optimization on data reload or slider/config changes
  const optimizationResults = useMemo(() => {
    if (entries.length === 0) return { scenarios: [], D0: new Date(), maxWeeks: 1 };

    // Sync customized transit times to the customQuotes so optimizer can read them
    const syncedQuotes = customQuotes.map(q => {
      const origin = (q.origin || "").toUpperCase().trim();
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
      const transitDays = transitTimes[routeKey];
      if (transitDays !== undefined) {
        return { ...q, transitTimeDays: transitDays };
      }
      return q;
    });

    // Find the earliest required PR Due Date (D0)
    const D0 = entries.reduce((min, e) => e.prDueDate < min ? e.prDueDate : min, entries[0].prDueDate);

    // Generate as many shipment scenarios as there are dynamic 7-day clusters
    // (previously hardcoded to 12, which could truncate scenarios when the
    // data naturally clusters into more groups, e.g. 15). entries.length is
    // a safe upper bound since group count can never exceed unique PR count.
    const maxWeeks = entries.length;

    // Process all scenarios dynamically
    const scenarios = processAllScenarios(
      entries,
      D0,
      maxWeeks,
      carryingRate,
      opportunityRate,
      defaultMoq,
      shipFrom,
      enablePullForward,
      prefer20ftForOctober,
      shipmentDates,
      syncedQuotes,
      warehouseStuckDays,
      warehouseDailyRent,
      exchangeRates,
      mcqSurchargeUSD,
      mcqSurchargeType,
      excessOverrides,
      
      
      vendorSurcharges,
      manualWeekOverrides,
      surchargeRules,
      importedFclQuotes,
      incotermRules,
      defaultMcq,
      loadingDateRules,
      previouslyExistingContainers,
      manualMatrixQtyOverrides,
      unitPriceOverrides,
      mcqMoqPreferences,
      acceptedFlags,
      containerOverrides
    );

    return {
      scenarios,
      D0,
      maxWeeks,
      computedMaxWeeks: maxWeeks
    };
  }, [
    entries, carryingRate, opportunityRate, defaultMoq, shipFrom, transitTimes, 
    enablePullForward, prefer20ftForOctober, shipmentDates, customQuotes, 
    warehouseStuckDays, warehouseDailyRent, exchangeRates,
    mcqSurchargeUSD, mcqSurchargeType, excessOverrides, vendorSurcharges, manualWeekOverrides, surchargeRules,
    importedFclQuotes, incotermRules, defaultMcq, loadingDateRules, previouslyExistingContainers, manualMatrixQtyOverrides, unitPriceOverrides, mcqMoqPreferences, acceptedFlags, containerOverrides
  ]);

  const { scenarios, D0, maxWeeks, computedMaxWeeks } = optimizationResults;

  // Compute fleet scenario recommendations (absolute cheapest combo across scenarios)
  const fleetResults = useMemo(() => {
    try {
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
        previouslyExistingContainers,
        manualMatrixQtyOverrides
      );
    } catch (e) {
      console.error("Error calculating fleet scenarios", e);
      return [] as any;
    }
  }, [
    entries, carryingRate, opportunityRate, defaultMoq, shipFrom, enablePullForward, prefer20ftForOctober,
    shipmentDates, customQuotes, warehouseStuckDays, warehouseDailyRent, exchangeRates,
    mcqSurchargeUSD, mcqSurchargeType, excessOverrides, 
    vendorSurcharges, surchargeRules, importedFclQuotes, incotermRules, defaultMcq, previouslyExistingContainers, manualMatrixQtyOverrides
  ]);

  const recommendedFleetSuggestion = useMemo(() => {
    if (!fleetResults || fleetResults.length === 0) return undefined;
    let cheapestScenarioId = "";
    let cheapestComboIdx = -1;
    let minCost = Infinity;
    fleetResults.forEach(sc => {
      sc.combinations.forEach((c, idx) => {
        if (c.trueLandedCost < minCost) {
          minCost = c.trueLandedCost;
          cheapestScenarioId = sc.id;
          cheapestComboIdx = idx;
        }
      });
    });
    if (!cheapestScenarioId) return undefined;
    const sc = fleetResults.find(s => s.id === cheapestScenarioId)!;
    const combo = sc.combinations[cheapestComboIdx];
    if (!combo) return undefined;

    const perLegFcl = (combo.combination.num20gp || 0) + (combo.combination.num40gp || 0) + (combo.combination.num40hq || 0);
    const totalSuggestedContainers = perLegFcl * (sc.numShipments || 1);
    const newlySuggestedContainers = Math.max(0, totalSuggestedContainers - (previouslyExistingContainers || 0));
    const newlySuggestedContainerDays = newlySuggestedContainers * (warehouseStuckDays || 0);

    return {
      scenarioId: sc.id,
      scenarioName: sc.name,
      numShipments: sc.numShipments,
      combination: combo.combination,
      perLegFcl,
      totalSuggestedContainers,
      newlySuggestedContainers,
      newlySuggestedContainerDays
    };
  }, [fleetResults, previouslyExistingContainers, warehouseStuckDays]);

  // Selected scenario details
  const selectedScenario = useMemo(() => {
    return scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];
  }, [scenarios, selectedScenarioId]);

  const hasWarnings = useMemo(() => {
    return !!selectedScenario?.errorFlags?.some(f => f.type === "error" || f.type === "warning");
  }, [selectedScenario]);

  // Set default selected scenario on data load
  const handleDataLoaded = (newEntries: PrEntry[]) => {
    setEntries(newEntries);

    // Unconditionally reset all Part 4 ("Review warnings & export") manual
    // adjustments/overrides whenever a new file is loaded/uploaded in Part 1.
    // This ensures that the MCQ Shipment Calendar Matrix cell edits, Ship Dates overrides,
    // Excess overrides, and Shipment Containers & Bins assignments (manual week overrides)
    // from any previous planning sheet are fully cleared and do not carry over to the new dataset.
    setSelectedScenarioId("1"); // Reset selector
    setShipmentDates([]);
    setUnitPriceOverrides({});
    setManualMatrixQtyOverrides({});
    setExcessOverrides([]);
    setManualWeekOverrides({});
    setMcqMoqPreferences({});
    setAcceptedFlags({});
    setContainerOverrides({});

    // Explicitly clean up corresponding localStorage keys to start completely fresh
    localStorage.removeItem("procurement_manual_week_overrides_v4");
    localStorage.removeItem("procurement_manual_matrix_qty_overrides_v1");
    localStorage.removeItem("procurement_mcq_moq_preferences_v1");
    localStorage.removeItem("procurement_unit_price_overrides_v1");
    localStorage.removeItem("procurement_accepted_flags_v1");
    localStorage.removeItem("procurement_container_overrides_v1");

    // Auto-detect settings from the uploaded entries if available
    if (newEntries.length > 0) {
      const firstEntry = newEntries[0];

      // Extract currencies and buy rates ("Buy Rate On PR Date") from uploaded entries
      const newExtractedRates: Record<string, number> = {};
      const newExtractedFlags: Record<string, boolean> = {};
      const activeCurrenciesSet = new Set<string>(["USD"]);

      newEntries.forEach(entry => {
        const c = (entry.currency || "").toUpperCase().trim();
        if (c && c !== "THB") {
          activeCurrenciesSet.add(c);
          if (entry.currencyRate && !isNaN(entry.currencyRate) && entry.currencyRate > 0) {
            newExtractedRates[c] = entry.currencyRate;
            newExtractedFlags[c] = true;
          }
        }
      });

      if (Object.keys(newExtractedRates).length > 0) {
        setExchangeRates(prev => ({
          ...prev,
          ...newExtractedRates
        }));
      }
      setPrExtractedCurrencies(newExtractedFlags);
      setActiveCurrencies(Array.from(activeCurrenciesSet));

      // Derive shipFrom from the most common value across ALL entries,
      // not just entries[0] — using only the first row is fragile (it
      // silently no-ops if that one row's field happens to be empty, and
      // depends on row ordering). A wrong/blank shipFrom here causes the
      // vendor loading-day alignment (e.g. Taiwan Keelung's Tue/Fri rule)
      // to silently fall back to the generic default rule instead.
      const shipFromCounts: Record<string, number> = {};
      newEntries.forEach(e => {
        const val = (e.shipFrom || "").trim();
        if (val) shipFromCounts[val] = (shipFromCounts[val] || 0) + 1;
      });
      const mostCommonShipFrom = Object.keys(shipFromCounts).sort(
        (a, b) => shipFromCounts[b] - shipFromCounts[a]
      )[0];
      if (mostCommonShipFrom) {
        setShipFrom(mostCommonShipFrom);
      }

      // A PR can legitimately state an MOQ/MCQ of 0 (meaning "no minimum"),
      // and that must be respected rather than silently ignored in favor of
      // whatever default was left over from a previous file -- a truthy
      // check (`firstEntry.moq && ...`) treats 0 the same as "not provided".
      if (firstEntry.moq !== undefined && firstEntry.moq !== null) {
        setDefaultMoq(firstEntry.moq);
      }
      if (firstEntry.mcq !== undefined && firstEntry.mcq !== null) {
        setDefaultMcq(firstEntry.mcq);
      }

      // Auto-detect Incoterms (per vendor+origin) — this drives the actual
      // cost-allocation rule: first value seen per vendor+origin wins.
      // (Any resulting cross-vendor conflicts are now surfaced live via the
      // incotermConflicts memo above, derived from incotermRules itself.)
      const newIncoterms: Record<string, string> = {};
      newEntries.forEach(entry => {
        if (entry.vendor && entry.shipFrom && entry.incoterm) {
          const key = `${entry.vendor.toUpperCase().trim()}::${entry.shipFrom.toUpperCase().trim()}`;
          if (!newIncoterms[key]) {
            newIncoterms[key] = entry.incoterm;
          }
        }
      });

      if (Object.keys(newIncoterms).length > 0) {
        setIncotermRules(prev => {
          let updated = [...prev];
          Object.entries(newIncoterms).forEach(([key, incoterm]) => {
            const [vendorCode, shipFrom] = key.split("::");
            const existingIdx = updated.findIndex(r => r.vendorCode.toUpperCase().trim() === vendorCode && r.shipFrom.toUpperCase().trim() === shipFrom);
            if (existingIdx >= 0) {
              updated[existingIdx] = { ...updated[existingIdx], incoterm, source: "data" };
            } else {
              updated.push({
                id: "inc_" + Math.random().toString(36).substring(2, 9),
                vendorCode,
                shipFrom,
                incoterm,
                source: "data"
              });
            }
          });
          return updated;
        });
      }
    }
  };

  // --- Step sidebar: track which section is in view so users always know where they are ---
  const uploadRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [configSubTab, setConfigSubTab] = useState<"basic" | "advanced">("basic");
  const [compareSubTab, setCompareSubTab] = useState<"overview" | "fleet">("overview");

  const handleStepClick = (stepIndex: number) => {
    setActiveStep(stepIndex);
    // Smooth scroll back to top of workspace
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];
  const computedDates = activeScenario?.shipments.map(s => s.shipmentDate) || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased pb-12">
      {/* App Header Bar */}
      <Header lang={lang} setLang={setLang} currency={currency} onCurrencyChange={setCurrency} />

      <main className="max-w-[92rem] mx-auto px-4 md:px-8">
        <div className="flex gap-6 items-start">
          <StepSidebar
            hasData={entries.length > 0}
            activeStep={activeStep}
            hasWarnings={hasWarnings}
            onStepClick={handleStepClick}
            lang={lang}
          />

          <div className="flex-1 min-w-0 max-w-7xl">
            {/* Dynamic Workspace Container */}
            {entries.length === 0 ? (
              /* Empty State Guidelines with Direct Upload Zone */
              <div className="space-y-6">
                <PrUploader onDataLoaded={handleDataLoaded} currentCount={entries.length} lang={lang} />
                
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">{t("VT Garment Logistics Optimization Workspace", lang)}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
                        <span className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-[10px]">1</span>
                        {t("Scenario Slicer", lang)}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {t("Schedules shipment schedules dynamically, setting Shipment 1 on the earliest due date, spaced at least a week apart.", lang)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-violet-600 uppercase tracking-wider">
                        <span className="w-5 h-5 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center text-[10px]">2</span>
                        {t("MOQ Consolidation", lang)}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {t("Automatically highlights sub-threshold color shipments and pulls them earlier to meet suppliers' MOQ/MCQ targets.", lang)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">
                        <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[10px]">3</span>
                        {t("Container Lock", lang)}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {t("Verifies container requirements against the consolidated Baseline (Scenario 1), flagging container mismatches for review.", lang)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Main Interactive Workspace Dashboard (Step-by-Step Tabs) */
              <div className="space-y-6">
                
                {/* Step 1: Upload Manifest */}
                {activeStep === 0 && (
                  <div ref={uploadRef} className="space-y-6">
                    <PrUploader onDataLoaded={handleDataLoaded} currentCount={entries.length} lang={lang} />
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-800 mb-2">{t("Inbound Manifest Status", lang)}</h3>
                      <p className="text-slate-500 text-xs">
                        {t("You have successfully loaded", lang)} <span className="font-bold text-slate-800">{entries.length} {t("PR lines", lang)}</span> {t("from your Syteline procurement sheet. You can use the sidebar or click below to configure logistics rates & custom route quotes.", lang)}
                      </p>
                      <button
                        onClick={() => setActiveStep(1)}
                        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2 text-xs transition duration-200 cursor-pointer"
                      >
                        Configure Rates &raquo;
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Advanced Procurement Settings */}
                {activeStep === 1 && (
                  <div ref={configRef} className="space-y-6">
                    <AdvancedSettings
                      entries={entries}
                      customQuotes={customQuotes}
                      setCustomQuotes={setCustomQuotes}
                      warehouseStuckDays={warehouseStuckDays}
                      setWarehouseStuckDays={setWarehouseStuckDays}
                      warehouseDailyRent={warehouseDailyRent}
                      setWarehouseDailyRent={setWarehouseDailyRent}
                      exchangeRates={exchangeRates}
                      setExchangeRates={setExchangeRates}
                      activeCurrencies={activeCurrencies}
                      prExtractedCurrencies={prExtractedCurrencies}
                      mcqSurchargeUSD={mcqSurchargeUSD}
                      setMcqSurchargeUSD={setMcqSurchargeUSD}
                      mcqSurchargeType={mcqSurchargeType}
                      setMcqSurchargeType={setMcqSurchargeType}
                      vendorSurcharges={vendorSurcharges}
                      setVendorSurcharges={setVendorSurcharges}
                      surchargeRules={surchargeRules}
                      setSurchargeRules={setSurchargeRules}
                      incotermRules={incotermRules}
                      setIncotermRules={setIncotermRules}
                      importedFclQuotes={importedFclQuotes}
                      setImportedFclQuotes={setImportedFclQuotes}
                      loadingDateRules={loadingDateRules}
                      setLoadingDateRules={setLoadingDateRules}
                      previouslyExistingContainers={previouslyExistingContainers}
                      setPreviouslyExistingContainers={setPreviouslyExistingContainers}
                      recommendedFleetSuggestion={recommendedFleetSuggestion}
                      carryingRate={carryingRate}
                      setCarryingRate={setCarryingRate}
                      opportunityRate={opportunityRate}
                      setOpportunityRate={setOpportunityRate}
                      enablePullForward={enablePullForward}
                      setEnablePullForward={setEnablePullForward}
                      lang={lang}
                    />
                  </div>
                )}

                {/* Step 3: Compare Scenarios */}
                {activeStep === 2 && (
                  <div ref={compareRef} className="space-y-6">
                    <ScenarioOverview
                      scenarios={scenarios}
                      selectedScenarioId={selectedScenarioId}
                      onSelectScenario={(id) => {
                        setSelectedScenarioId(id);
                        setActiveStep(3); // Go to detailed review step
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      lang={lang}
                      currency={currency}
                      exchangeRates={exchangeRates}
                      incotermConflicts={incotermConflicts}
                      incotermRules={activeIncotermRules}
                    />
                  </div>
                )}

                {/* Step 4: Detailed Scenario Inspector */}
                {activeStep === 3 && selectedScenario && (
                  <div ref={reviewRef}>
                    <ScenarioInspector 
                      scenario={selectedScenario} 
                      scenarios={scenarios}
                      exchangeRates={exchangeRates}
                      lang={lang}
                      currency={currency}
                      onMovePrLine={handleMovePrLine}
                      onResetOverrides={handleResetOverrides}
                      hasManualOverrides={
                        Object.keys(manualWeekOverrides[selectedScenario.id] || {}).length > 0 ||
                        Object.keys(manualMatrixQtyOverrides[selectedScenario.id] || {}).length > 0 ||
                        Object.keys(containerOverrides[selectedScenario.id] || {}).length > 0 ||
                        Object.keys(mcqMoqPreferences).length > 0 ||
                        Object.keys(unitPriceOverrides).length > 0 ||
                        excessOverrides.length > 0 ||
                        Object.keys(acceptedFlags).length > 0
                      }
                      matrixQtyOverrides={manualMatrixQtyOverrides[selectedScenario.id] || {}}
                      onMatrixQtyChange={(itemDescription, colorCode, week, value) => handleMatrixQtyChange(selectedScenario.id, itemDescription, colorCode, week, value)}
                      containerOverrides={containerOverrides[selectedScenario.id] || {}}
                      onContainerOverrideChange={(week, override) => handleContainerOverrideChange(selectedScenario.id, week, override)}
                      onFixUnitPrice={handleUnitPriceFix}
                      entries={entries}
                      maxWeeks={computedMaxWeeks}
                      computedDates={computedDates}
                      shipmentDates={shipmentDates}
                      setShipmentDates={setShipmentDates}
                      excessOverrides={excessOverrides}
                      setExcessOverrides={setExcessOverrides}
                      surchargeRules={surchargeRules}
                      mcqMoqPreferences={mcqMoqPreferences}
                      onSelectMcqMoqPreference={handleSelectMcqMoqPreference}
                      onAcceptFlag={handleAcceptFlag}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
