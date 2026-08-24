import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

const fileName = process.argv[2];
if (!fileName) {
  console.error("Usage: npx tsx scripts/parsePrCsv.ts <csv-file-path>");
  process.exit(1);
}

const filePath = path.isAbsolute(fileName) ? fileName : path.join(process.cwd(), fileName);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const rawBytes = fs.readFileSync(filePath);

const decodeCsvText = (bytes: Uint8Array): string => {
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

const raw = decodeCsvText(new Uint8Array(rawBytes));
const workbook = XLSX.read(raw, { type: "string" });
const firstSheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[firstSheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, any>[];

console.log(`Parsed ${rows.length} rows from ${filePath}`);
console.log("Headers:", Object.keys(rows[0] || {}).join(", "));
console.log("\nFirst 30 rows:\n");

const normalizeHeader = (h: string) => String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
const headerMap: Record<string, string> = {};
for (const header of Object.keys(rows[0] || {})) {
  headerMap[normalizeHeader(header)] = header;
}

const requisitionKey = headerMap["requisition"] || headerMap["requisitionno"] || headerMap["prno"] || headerMap["prnumber"] || headerMap["refpo"] || headerMap["ref"];
const prDueKey = headerMap["prduedate"] || headerMap["duedate"] || headerMap["due_date"];
const prDeliveryKey = headerMap["prdeliverydate"] || headerMap["prdelivery"] || headerMap["deliverydate"] || headerMap["actualdelivery"] || headerMap["actualdeliverydate"];

console.log({ requisitionKey, prDueKey, prDeliveryKey });
console.log("\nRows:");

const fmt = (v: any) => {
  if (v === null || v === undefined || v === "") return "<empty>";
  return String(v);
};

for (let i = 0; i < Math.min(30, rows.length); i++) {
  const row = rows[i];
  console.log(
    `${i + 1}	Requisition=${fmt(row[requisitionKey])}	PR Due Date=${fmt(row[prDueKey])}	PR Delivery Date=${fmt(row[prDeliveryKey])}`
  );
}
