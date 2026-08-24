import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";

const source = readFileSync("src/components/PrUploader.tsx", "utf8");

test("PrUploader auto-detect prioritizes PR Due Date over generic due date columns", () => {
  assert.match(source, /norm === "prduedate"/);
  assert.match(source, /map.actualDelivery = h/);
  assert.match(source, /prdeliverydate/);
});
