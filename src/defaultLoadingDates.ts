import { LoadingDateRule } from "./types";

export function getDefaultLoadingDateRules(): LoadingDateRule[] {
  return [
    { id: "load_1", country: "Taiwan Keelung", allowedDays: [2, 5] }, // Tuesday (2) & Friday (5)
    { id: "load_2", country: "Italy", allowedDays: [1] }, // Monday (1)
    { id: "load_3", country: "South Korea", allowedDays: [1] }, // Monday (1)
    { id: "load_4", country: "Vietnam", allowedDays: [1] }, // Monday (1)
    { id: "load_5", country: "Hong Kong", allowedDays: [1] }, // Monday (1)
    { id: "load_default", country: "Other Countries", allowedDays: [1] } // Default Monday (1)
  ];
}
