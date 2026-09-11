export const dateKey = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const today = () => dateKey();
export function monthRange(date = new Date()) {
  const [year, month] = dateKey(date).split("-").map(Number);
  return [
    `${year}-${String(month).padStart(2, "0")}-01`,
    `${year}-${String(month).padStart(2, "0")}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`,
  ];
}
export const round = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const sum = (rows, key) =>
  round(rows.reduce((total, row) => total + Number(row[key] ?? 0), 0));
export function splitGross(gross, rate = 24) {
  const amount = Number(gross),
    vatRate = Number(rate);
  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(vatRate) ||
    vatRate < 0 ||
    vatRate > 100
  )
    throw new Error("Μη έγκυρο ποσό ή ποσοστό ΦΠΑ.");
  const net = round(amount / (1 + vatRate / 100));
  return { net, vat: round(amount - net) };
}
export function calc(incomes, expenses) {
  const turnover = sum(incomes, "gross"),
    vatOut = sum(incomes, "vat"),
    exp = sum(expenses, "total");
  const vatIn = sum(
    expenses.filter((x) => x.vat_deductible),
    "vat",
  );
  const netRevenue = sum(incomes, "net");
  // VAT that cannot be recovered remains part of the expense.
  const costs = round(
    expenses.reduce(
      (s, x) =>
        s + Number(x.net ?? 0) + (x.vat_deductible ? 0 : Number(x.vat ?? 0)),
      0,
    ),
  );
  return {
    turnover,
    vatOut,
    exp,
    vatIn,
    vatDue: round(vatOut - vatIn),
    profit: round(netRevenue - costs),
    netRevenue,
    cash: sum(
      incomes.filter((x) => x.payment_method === "cash"),
      "gross",
    ),
    card: sum(
      incomes.filter((x) => x.payment_method === "card"),
      "gross",
    ),
  };
}
export function csvText(rows) {
  const escape = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return "\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\r\n");
}
export const paymentLabel = (value) =>
  ({ cash: "Μετρητά", card: "Κάρτα / POS", bank: "Τράπεζα" })[value] ?? value;
export function validAmount(value, allowZero = false) {
  return (
    value !== "" &&
    value !== null &&
    Number.isFinite(Number(value)) &&
    (allowZero ? Number(value) >= 0 : Number(value) > 0)
  );
}
export async function fetchAll(makeQuery, pageSize = 500) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery().range(
      offset,
      offset + pageSize - 1,
    );
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}
