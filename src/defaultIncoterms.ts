import { IncotermRule } from "./types";

export function getDefaultIncotermRules(): IncotermRule[] {
  return [
    { id: "inc_01", vendorCode: "ISING01", shipFrom: "Taiwan Keelung", incoterm: "FOB", source: "default" },
    { id: "inc_02", vendorCode: "IHORI01", shipFrom: "HK", incoterm: "FOB", source: "default" },
    { id: "inc_03", vendorCode: "IVCHK01", shipFrom: "Hong Kong", incoterm: "EXW", source: "default" },
    { id: "inc_04", vendorCode: "IDPLX01", shipFrom: "China Shanghai", incoterm: "EXW", source: "default" },
    { id: "inc_05", vendorCode: "IPROS01", shipFrom: "HK", incoterm: "EXW", source: "default" },
    { id: "inc_06", vendorCode: "ISHIM01", shipFrom: "HK", incoterm: "EXW", source: "default" },
    { id: "inc_07", vendorCode: "IKING01", shipFrom: "Taiwan Keelung", incoterm: "FOB", source: "default" },
    { id: "inc_08", vendorCode: "ILIPE01", shipFrom: "Taiwan Keelung", incoterm: "FOB", source: "default" },
    { id: "inc_09", vendorCode: "IKOOK01", shipFrom: "Vietnam", incoterm: "EXW", source: "default" },
    { id: "inc_10", vendorCode: "IFTCT01", shipFrom: "Taiwan Keelung", incoterm: "FOB", source: "default" },
    { id: "inc_11", vendorCode: "IMENC01", shipFrom: "Taiwan Keelung", incoterm: "FOB", source: "default" }
  ];
}
