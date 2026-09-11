import test from "node:test";
import assert from "node:assert/strict";
import {
  dateKey,
  monthRange,
  splitGross,
  calc,
  csvText,
  validAmount,
  fetchAll,
} from "../src/finance.js";
test("Athens date is correct after local midnight", () =>
  assert.equal(dateKey(new Date("2026-09-10T22:15:00Z")), "2026-09-11"));
test("month boundaries include first and last day in Athens", () => {
  assert.deepEqual(monthRange(new Date("2026-09-11T12:00:00Z")), [
    "2026-09-01",
    "2026-09-30",
  ]);
  assert.deepEqual(monthRange(new Date("2024-02-05T12:00:00Z")), [
    "2024-02-01",
    "2024-02-29",
  ]);
  assert.deepEqual(monthRange(new Date("2026-12-31T22:15:00Z")), [
    "2027-01-01",
    "2027-01-31",
  ]);
});
test("gross splits reconcile at every supported VAT rate", () => {
  for (const rate of [0, 6, 13, 24])
    for (const amount of [0.01, 0.03, 1, 12.4, 124, 999.99]) {
      const v = splitGross(amount, rate);
      assert.equal(Math.round((v.net + v.vat) * 100), Math.round(amount * 100));
    }
  assert.deepEqual(splitGross(124, 24), { net: 100, vat: 24 });
  assert.throws(() => splitGross(2, NaN));
});
test("non-recoverable VAT remains an expense", () => {
  const i = [{ gross: 124, net: 100, vat: 24, payment_method: "cash" }];
  const e = [{ total: 62, net: 50, vat: 12, vat_deductible: false }];
  assert.equal(calc(i, e).profit, 38);
  assert.equal(calc(i, e).vatDue, 24);
  e[0].vat_deductible = true;
  assert.equal(calc(i, e).profit, 50);
  assert.equal(calc(i, e).vatDue, 12);
});
test("credit VAT and empty data are preserved", () => {
  assert.equal(
    calc([], [{ net: 100, total: 124, vat: 24, vat_deductible: true }]).vatDue,
    -24,
  );
  assert.equal(calc([], []).profit, 0);
});
test("CSV escapes separators, quotes, newlines and formulas", () => {
  const csv = csvText([
    ["A;B", 'say "yes"', "line\nnext", "=1+1", "  @SUM(A1)", 12.4],
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"A;B"'));
  assert.ok(csv.includes('"say ""yes"""'));
  assert.ok(csv.includes('"line\nnext"'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\'  @SUM(A1)"'));
});
test("empty/negative/non-finite amounts rejected, zero closing allowed", () => {
  for (const value of ["", null, -1, Infinity, "abc"])
    assert.equal(validAmount(value), false);
  assert.equal(validAmount(0), false);
  assert.equal(validAmount(0, true), true);
});
test("pagination includes all records beyond the API row limit", async () => {
  const records = Array.from({ length: 1251 }, (_, id) => ({ id }));
  let calls = 0;
  const data = await fetchAll(() => ({
    range: async (a, b) => {
      calls++;
      return { data: records.slice(a, b + 1), error: null };
    },
  }));
  assert.equal(data.length, 1251);
  assert.equal(calls, 3);
  assert.equal(data[1250].id, 1250);
});
test("query failure never masquerades as an empty successful result", async () => {
  await assert.rejects(
    () =>
      fetchAll(() => ({
        range: async () => ({ data: null, error: new Error("Unavailable") }),
      })),
    /Unavailable/,
  );
});
