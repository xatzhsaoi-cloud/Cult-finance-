import { round } from "./finance.js";
export function annualEstimate(p) {
  const n = (k) => {
    const v = Number(p[k] || 0);
    if (!Number.isFinite(v) || v < 0)
      throw new Error("Συμπλήρωσε μη αρνητικά ποσά.");
    return v;
  };
  const year = Number(p.year);
  if (![2023, 2024, 2025, 2026].includes(year))
    throw new Error("Μη υποστηριζόμενο έτος.");
  const turnover = n("turnover"),
    expenses = n("expenses"),
    vatRate = n("vatRate");
  if (vatRate > 100) throw new Error("Μη έγκυρος ΦΠΑ.");
  const children = n("children");
  if (!Number.isInteger(children) || children > 20)
    throw new Error("Μη έγκυρος αριθμός τέκνων.");
  let rates =
    year < 2026
      ? [9, 22, 28, 36, 44]
      : [
          children >= 4 ? 0 : 9,
          children >= 4 ? 0 : children === 3 ? 9 : 20 - children * 2,
          Math.max(0, 26 - children * 2),
          34,
          39,
          44,
        ];
  if (year === 2026) {
    if (!["under26", "26to30", "over30"].includes(p.age))
      throw new Error("Επίλεξε ηλικία για το 2026.");
    if (p.age === "under26") rates[0] = rates[1] = 0;
    if (p.age === "26to30") rates[1] = children >= 4 ? 0 : 9;
  }
  const newBusinessReduction =
    !!p.firstStart && year <= 2025 && turnover <= 10000;
  if (newBusinessReduction) rates[0] /= 2;
  const profit = round(turnover - expenses),
    taxable = Math.max(0, profit, n("minimum"));
  const widths =
    year < 2026
      ? [10000, 10000, 10000, 10000, Infinity]
      : [10000, 10000, 10000, 10000, 20000, Infinity];
  let remaining = taxable,
    lower = 0;
  const bands = widths.map((width, i) => {
    const amount = Math.min(remaining, width);
    remaining -= amount;
    const row = {
      lower,
      upper: lower + width,
      rate: rates[i],
      amount,
      tax: round((amount * rates[i]) / 100),
    };
    lower += width;
    return row;
  });
  const tax = round(bands.reduce((s, b) => s + b.tax, 0));
  const advanceRate =
    p.advance === "none" ? 0 : p.advance === "first" ? 27.5 : 55;
  const advance = round((tax * advanceRate) / 100),
    incomeBalance = round(tax + advance - n("taxCredits"));
  const vatOut = round((turnover * vatRate) / 100),
    vatBalance = round(vatOut - n("vatInput") - n("vatCredit") - n("vatPaid"));
  return {
    profit,
    taxable,
    bands,
    tax,
    advance,
    advanceRate,
    incomeBalance,
    vatOut,
    vatBalance,
    newBusinessReduction,
  };
}
export const annualDefaults = (year) => ({
  year,
  turnover: "",
  expenses: "",
  vatInput: "",
  vatRate: "24",
  minimum: "",
  vatCredit: "",
  vatPaid: "",
  taxCredits: "",
  firstStart: false,
  advance: "normal",
  age: "",
  children: "0",
});
