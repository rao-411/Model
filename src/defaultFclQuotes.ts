import { ImportedFclQuote } from "./types";

export function getDefaultImportedFclQuotes(): ImportedFclQuote[] {
  return [
    // Taiwan Keelung (standard)
    { id: "dfq-1", containerLoad: "FCL", containerSize: 20, shipFrom: "Taiwan Keelung", expenseType: "FREIGHT", paymentType: "BY CONTAINER", amount: 720, currency: "USD" },
    { id: "dfq-2", containerLoad: "FCL", containerSize: 20, shipFrom: "Taiwan Keelung", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 60, currency: "USD" },
    { id: "dfq-3", containerLoad: "FCL", containerSize: 20, shipFrom: "Taiwan Keelung", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 3550, currency: "THB" },
    { id: "dfq-4", containerLoad: "FCL", containerSize: 20, shipFrom: "Taiwan Keelung", expenseType: "LOCAL", paymentType: "BY SHIPMENT", amount: 1800, currency: "THB" },
    { id: "dfq-5", containerLoad: "FCL", containerSize: 20, shipFrom: "Taiwan Keelung", expenseType: "BROKERAGE", paymentType: "BY CONTAINER", amount: 13748.32, currency: "THB" },

    { id: "dfq-6", containerLoad: "FCL", containerSize: 40, shipFrom: "Taiwan Keelung", expenseType: "FREIGHT", paymentType: "BY CONTAINER", amount: 1050, currency: "USD" },
    { id: "dfq-7", containerLoad: "FCL", containerSize: 40, shipFrom: "Taiwan Keelung", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 100, currency: "USD" },
    { id: "dfq-8", containerLoad: "FCL", containerSize: 40, shipFrom: "Taiwan Keelung", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 4550, currency: "THB" },
    { id: "dfq-9", containerLoad: "FCL", containerSize: 40, shipFrom: "Taiwan Keelung", expenseType: "LOCAL", paymentType: "BY SHIPMENT", amount: 1800, currency: "THB" },
    { id: "dfq-10", containerLoad: "FCL", containerSize: 40, shipFrom: "Taiwan Keelung", expenseType: "BROKERAGE", paymentType: "BY CONTAINER", amount: 13748.32, currency: "THB" },

    // Taiwan Keelung to MM
    { id: "dfq-11", containerLoad: "FCL", containerSize: 20, shipFrom: "Taiwan Keelung to MM", expenseType: "FREIGHT", paymentType: "BY CONTAINER", amount: 1200, currency: "USD" },
    { id: "dfq-12", containerLoad: "FCL", containerSize: 20, shipFrom: "Taiwan Keelung to MM", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 100, currency: "USD" },
    { id: "dfq-13", containerLoad: "FCL", containerSize: 20, shipFrom: "Taiwan Keelung to MM", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 5550, currency: "THB" },
    { id: "dfq-14", containerLoad: "FCL", containerSize: 20, shipFrom: "Taiwan Keelung to MM", expenseType: "LOCAL", paymentType: "BY SHIPMENT", amount: 2500, currency: "THB" },
    { id: "dfq-15", containerLoad: "FCL", containerSize: 20, shipFrom: "Taiwan Keelung to MM", expenseType: "BROKERAGE", paymentType: "BY CONTAINER", amount: 15000, currency: "THB" },

    { id: "dfq-16", containerLoad: "FCL", containerSize: 40, shipFrom: "Taiwan Keelung to MM", expenseType: "FREIGHT", paymentType: "BY CONTAINER", amount: 1800, currency: "USD" },
    { id: "dfq-17", containerLoad: "FCL", containerSize: 40, shipFrom: "Taiwan Keelung to MM", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 150, currency: "USD" },
    { id: "dfq-18", containerLoad: "FCL", containerSize: 40, shipFrom: "Taiwan Keelung to MM", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 7550, currency: "THB" },
    { id: "dfq-19", containerLoad: "FCL", containerSize: 40, shipFrom: "Taiwan Keelung to MM", expenseType: "LOCAL", paymentType: "BY SHIPMENT", amount: 2500, currency: "THB" },
    { id: "dfq-20", containerLoad: "FCL", containerSize: 40, shipFrom: "Taiwan Keelung to MM", expenseType: "BROKERAGE", paymentType: "BY CONTAINER", amount: 15000, currency: "THB" },

    // Korea Busan (standard)
    { id: "dfq-21", containerLoad: "FCL", containerSize: 20, shipFrom: "Korea Busan", expenseType: "FREIGHT", paymentType: "BY CONTAINER", amount: 950, currency: "USD" },
    { id: "dfq-22", containerLoad: "FCL", containerSize: 20, shipFrom: "Korea Busan", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 80, currency: "USD" },
    { id: "dfq-23", containerLoad: "FCL", containerSize: 20, shipFrom: "Korea Busan", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 4000, currency: "THB" },
    { id: "dfq-24", containerLoad: "FCL", containerSize: 20, shipFrom: "Korea Busan", expenseType: "LOCAL", paymentType: "BY SHIPMENT", amount: 2000, currency: "THB" },
    { id: "dfq-25", containerLoad: "FCL", containerSize: 20, shipFrom: "Korea Busan", expenseType: "BROKERAGE", paymentType: "BY CONTAINER", amount: 14000, currency: "THB" },

    { id: "dfq-26", containerLoad: "FCL", containerSize: 40, shipFrom: "Korea Busan", expenseType: "FREIGHT", paymentType: "BY CONTAINER", amount: 1400, currency: "USD" },
    { id: "dfq-27", containerLoad: "FCL", containerSize: 40, shipFrom: "Korea Busan", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 120, currency: "USD" },
    { id: "dfq-28", containerLoad: "FCL", containerSize: 40, shipFrom: "Korea Busan", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 5000, currency: "THB" },
    { id: "dfq-29", containerLoad: "FCL", containerSize: 40, shipFrom: "Korea Busan", expenseType: "LOCAL", paymentType: "BY SHIPMENT", amount: 2000, currency: "THB" },
    { id: "dfq-30", containerLoad: "FCL", containerSize: 40, shipFrom: "Korea Busan", expenseType: "BROKERAGE", paymentType: "BY CONTAINER", amount: 14000, currency: "THB" },

    // Korea Busan to MM
    { id: "dfq-31", containerLoad: "FCL", containerSize: 20, shipFrom: "Korea Busan to MM", expenseType: "FREIGHT", paymentType: "BY CONTAINER", amount: 1500, currency: "USD" },
    { id: "dfq-32", containerLoad: "FCL", containerSize: 20, shipFrom: "Korea Busan to MM", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 120, currency: "USD" },
    { id: "dfq-33", containerLoad: "FCL", containerSize: 20, shipFrom: "Korea Busan to MM", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 6000, currency: "THB" },
    { id: "dfq-34", containerLoad: "FCL", containerSize: 20, shipFrom: "Korea Busan to MM", expenseType: "LOCAL", paymentType: "BY SHIPMENT", amount: 3000, currency: "THB" },
    { id: "dfq-35", containerLoad: "FCL", containerSize: 20, shipFrom: "Korea Busan to MM", expenseType: "BROKERAGE", paymentType: "BY CONTAINER", amount: 16000, currency: "THB" },

    { id: "dfq-36", containerLoad: "FCL", containerSize: 40, shipFrom: "Korea Busan to MM", expenseType: "FREIGHT", paymentType: "BY CONTAINER", amount: 2200, currency: "USD" },
    { id: "dfq-37", containerLoad: "FCL", containerSize: 40, shipFrom: "Korea Busan to MM", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 180, currency: "USD" },
    { id: "dfq-38", containerLoad: "FCL", containerSize: 40, shipFrom: "Korea Busan to MM", expenseType: "LOCAL", paymentType: "BY CONTAINER", amount: 8000, currency: "THB" },
    { id: "dfq-39", containerLoad: "FCL", containerSize: 40, shipFrom: "Korea Busan to MM", expenseType: "LOCAL", paymentType: "BY SHIPMENT", amount: 3000, currency: "THB" },
    { id: "dfq-40", containerLoad: "FCL", containerSize: 40, shipFrom: "Korea Busan to MM", expenseType: "BROKERAGE", paymentType: "BY CONTAINER", amount: 16000, currency: "THB" }
  ];
}
