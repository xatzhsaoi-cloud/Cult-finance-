import test from "node:test";
import assert from "node:assert/strict";
import {
  resetPreview,
  resetFinance,
  RESET_TABLES,
} from "../src/reset-finance.js";
function fixture(denyTable = null) {
  const db = {
    businesses: [
      { id: "b1", name: "Keep me", opening_cash: 350 },
      { id: "b2", opening_cash: 90 },
    ],
    goals: [
      {
        business_id: "b1",
        daily_target: 5,
        monthly_target: 10,
        fixed_costs_monthly: 3,
      },
    ],
    profiles: [{ id: "user", business_id: "b1" }],
    categories: [{ id: "cat", business_id: "b1" }],
  };
  for (const [t] of RESET_TABLES)
    db[t] = [
      { id: t + "1", business_id: "b1" },
      { id: t + "2", business_id: "b2" },
    ];
  const calls = [];
  class Q {
    constructor(t) {
      this.t = t;
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
    in(k, vs) {
      this.filters.push((r) => vs.includes(r[k]));
      return this;
    }
    order() {
      return this;
    }
    range(a, b) {
      this.slice = [a, b];
      return this;
    }
    single() {
      this.one = true;
      return this;
    }
    maybeSingle() {
      this.one = true;
      return this;
    }
    delete() {
      this.action = "delete";
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
          calls.push([this.t, this.action]);
          let rows = db[this.t].filter((r) => this.filters.every((f) => f(r)));
          if (this.action === "delete" && this.t !== denyTable)
            db[this.t] = db[this.t].filter((r) => !rows.includes(r));
          if (this.action === "update")
            rows.forEach((r) => Object.assign(r, this.payload));
          if (this.slice) rows = rows.slice(this.slice[0], this.slice[1] + 1);
          return {
            data: structuredClone(this.one ? (rows[0] ?? null) : rows),
            error: null,
          };
        })
        .then(resolve, reject);
    }
  }
  return { db, calls, client: { from: (t) => new Q(t) } };
}
test("preview reads only selected business and makes no writes", async () => {
  const f = fixture(),
    p = await resetPreview(f.client, "b1");
  assert.equal(p.records.incomes.length, 1);
  assert.equal(p.business.name, "Keep me");
  assert.ok(f.calls.every(([, action]) => action === "read"));
});
test("reset requires exact confirmation before any writes", async () => {
  const f = fixture(),
    p = await resetPreview(f.client, "b1");
  await assert.rejects(() => resetFinance(f.client, p, "YES"));
  assert.ok(f.calls.every(([, a]) => a === "read"));
});
test("reset clears selected records but preserves other businesses and identity", async () => {
  const f = fixture(),
    p = await resetPreview(f.client, "b1");
  await resetFinance(f.client, p, "ΜΗΔΕΝΙΣΜΟΣ");
  for (const [t] of RESET_TABLES) {
    assert.equal(f.db[t].length, 1);
    assert.equal(f.db[t][0].business_id, "b2");
  }
  assert.equal(f.db.businesses[0].opening_cash, 0);
  assert.equal(f.db.businesses[1].opening_cash, 90);
  assert.equal(f.db.businesses[0].name, "Keep me");
  assert.equal(f.db.profiles.length, 1);
  assert.equal(f.db.categories.length, 1);
  assert.equal(f.db.goals[0].monthly_target, 0);
});
test("silent RLS delete denial is detected and stops subsequent writes", async () => {
  const f = fixture("expenses"),
    p = await resetPreview(f.client, "b1");
  await assert.rejects(
    () => resetFinance(f.client, p, "ΜΗΔΕΝΙΣΜΟΣ"),
    /υπάρχουν ακόμη/,
  );
  assert.ok(f.db.obligations.some((r) => r.business_id === "b1"));
  assert.equal(f.db.businesses[0].opening_cash, 350);
});
test("new records after preview survive and prevent false success", async () => {
  const f = fixture(),
    p = await resetPreview(f.client, "b1");
  f.db.incomes.push({ id: "new", business_id: "b1" });
  await assert.rejects(
    () => resetFinance(f.client, p, "ΜΗΔΕΝΙΣΜΟΣ"),
    /υπάρχουν ακόμη/,
  );
  assert.ok(f.db.incomes.some((r) => r.id === "new"));
});
test("tampered snapshot fails closed before any writes", async () => {
  const f = fixture(),
    p = await resetPreview(f.client, "b1");
  p.records.incomes[0].business_id = "b2";
  await assert.rejects(
    () => resetFinance(f.client, p, "ΜΗΔΕΝΙΣΜΟΣ"),
    /Μη έγκυρες/,
  );
  assert.ok(f.calls.every(([, a]) => a === "read"));
});
