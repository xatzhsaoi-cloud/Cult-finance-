import { today } from "../src/finance.js";
const db = {
  profiles: [{ id: "test-user", business_id: "test-business" }],
  businesses: [
    {
      id: "test-business",
      name: "CULT — Δοκιμαστικά δεδομένα",
      opening_cash: 350,
      default_vat_rate: 24,
      income_tax_pct: 0,
      tax_reserve_pct: 0,
    },
  ],
  user_roles: [{ user_id: "test-user", role: "owner" }],
  incomes: [
    {
      id: "i1",
      business_id: "test-business",
      date: today(),
      gross: 124,
      net: 100,
      vat: 24,
      payment_method: "cash",
      description: "Δοκιμαστικό έσοδο",
    },
  ],
  expenses: [
    {
      id: "e1",
      business_id: "test-business",
      date: today(),
      total: 62,
      net: 50,
      vat: 12,
      vat_deductible: false,
      payment_method: "cash",
      supplier: "Δοκιμαστικό έξοδο",
    },
  ],
  obligations: [],
  goals: [
    {
      business_id: "test-business",
      daily_target: 100,
      monthly_target: 1000,
      fixed_costs_monthly: 400,
    },
  ],
  recurring_expenses: [],
  categories: [],
  cash_days: [],
};
class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.action = "read";
  }
  select() {
    return this;
  }
  eq(k, v) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  gte(k, v) {
    this.filters.push((r) => r[k] >= v);
    return this;
  }
  lte(k, v) {
    this.filters.push((r) => r[k] <= v);
    return this;
  }
  order() {
    return this;
  }
  range(a, b) {
    this.slice = [a, b];
    return this;
  }
  maybeSingle() {
    this.singleRow = true;
    return this;
  }
  single() {
    this.singleRow = true;
    return this;
  }
  insert(p) {
    this.action = "insert";
    this.payload = p;
    return this;
  }
  update(p) {
    this.action = "update";
    this.payload = p;
    return this;
  }
  then(resolve, reject) {
    return Promise.resolve()
      .then(() => {
        if (
          new URLSearchParams(location.search).has("fail") &&
          this.table === "incomes"
        )
          return {
            data: null,
            error: { message: "Δοκιμαστική αποτυχία φόρτωσης" },
          };
        let rows = db[this.table].filter((r) =>
          this.filters.every((f) => f(r)),
        );
        if (this.action === "insert") {
          const row = { id: crypto.randomUUID(), ...this.payload };
          db[this.table].push(row);
          rows = [row];
        }
        if (this.action === "update")
          rows.forEach((r) => Object.assign(r, this.payload));
        if (this.slice) rows = rows.slice(this.slice[0], this.slice[1] + 1);
        return { data: this.singleRow ? (rows[0] ?? null) : rows, error: null };
      })
      .then(resolve, reject);
  }
}
export function createClient() {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "test-user" } } },
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
      signOut: async () => ({ error: null }),
    },
    from: (table) => new Query(table),
  };
}
