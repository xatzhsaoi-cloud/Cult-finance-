import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  TrendingDown,
  Percent,
  BarChart3,
  CalendarClock,
  Repeat,
  Target,
  Receipt,
  Settings,
  Plug,
  LogOut,
  Plus,
  Save,
  CheckCircle2,
} from "lucide-react";
import "./style.css";
import ResetFinance from "./ResetFinance.jsx";
import {
  today,
  monthRange,
  sum,
  splitGross,
  calc,
  csvText,
  paymentLabel,
  validAmount,
  fetchAll,
} from "./finance.js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ||
    "https://ptdaceajyulekdqobbrj.supabase.co",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_WDgzxl9iATQvQM_9J8g1nw_d4tp894E",
);
const eur = (n) =>
  new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(
    Number(n || 0),
  );
const nav = [
  ["dashboard", "Επισκόπηση", LayoutDashboard],
  ["cash", "Ημερήσιο ταμείο", Wallet],
  ["income", "Έσοδα", TrendingUp],
  ["expenses", "Έξοδα", TrendingDown],
  ["tax", "Φορολογική εικόνα", Percent],
  ["overview", "Οικονομική εικόνα", BarChart3],
  ["obligations", "Υποχρεώσεις", CalendarClock],
  ["fixed", "Πάγια", Repeat],
  ["goals", "Στόχοι", Target],
  ["reports", "Αναφορές", Receipt],
  ["settings", "Ρυθμίσεις", Settings],
  ["integrations", "Συνδέσεις", Plug],
];
function App() {
  const [session, setSession] = useState(null),
    [page, setPage] = useState("dashboard"),
    [ctx, setCtx] = useState(null),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState(""),
    [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        setSession(data.session);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
    const { data: s } = supabase.auth.onAuthStateChange((_e, ses) =>
      setSession(ses),
    );
    return () => {
      s.subscription.unsubscribe();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!session) {
      setCtx(null);
      return;
    }
    setLoading(true);
    setError("");
    (async () => {
      try {
        const { data: p, error: pe } = await supabase
          .from("profiles")
          .select("business_id")
          .eq("id", session.user.id)
          .maybeSingle();
        if (pe) throw pe;
        let bid = p?.business_id;
        if (!bid) {
          const { data, error } = await supabase.rpc("bootstrap_business", {
            p_name: "CULT Barbershop",
            p_demo: false,
          });
          if (error) throw error;
          bid = data;
        }
        const { data: business, error: be } = await supabase
          .from("businesses")
          .select("*")
          .eq("id", bid)
          .single();
        if (be) throw be;
        const { data: roles, error: re } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        if (re) throw re;
        if (active)
          setCtx({
            user: session.user,
            business,
            role: roles?.[0]?.role || "viewer",
          });
      } catch (e) {
        if (active) setError(e.message || "Δεν ήταν δυνατή η φόρτωση.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session?.user.id, refresh]);
  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
    else {
      setCtx(null);
      setSession(null);
      setPage("dashboard");
    }
  }
  if (loading)
    return (
      <div className="center" role="status" aria-label="Φόρτωση">
        <div className="loader" />
      </div>
    );
  if (error)
    return (
      <div className="center">
        <div className="panel" role="alert">
          <h1>Χρειάζεται νέα προσπάθεια</h1>
          <p>{error}</p>
          <button className="primary" onClick={() => location.reload()}>
            Επανάληψη
          </button>
          {session && <button onClick={logout}>Αποσύνδεση</button>}
        </div>
      </div>
    );
  if (!session) return <Auth />;
  if (!ctx)
    return (
      <div className="center">
        <button onClick={() => setRefresh((x) => x + 1)}>
          Επαναφόρτωση επιχείρησης
        </button>
      </div>
    );
  const Comp = {
    dashboard: Dashboard,
    cash: Cash,
    income: Income,
    expenses: Expenses,
    tax: Tax,
    overview: Overview,
    obligations: Obligations,
    fixed: Fixed,
    goals: Goals,
    reports: Reports,
    settings: SettingsPage,
    integrations: Integrations,
  }[page];
  return (
    <div className="app">
      <aside>
        <div className="brand">
          CULT <span>Finance</span>
        </div>
        <div className="biz">{ctx.business.name}</div>
        <nav aria-label="Κύρια πλοήγηση">
          {nav.map(([id, label, Icon]) => (
            <button
              aria-current={page === id ? "page" : undefined}
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => {
                setPage(id);
                window.scrollTo(0, 0);
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <button className="logout" onClick={logout}>
          <LogOut size={18} />
          Αποσύνδεση
        </button>
      </aside>
      <main>
        <div className="mobile-head">
          <span>
            CULT <b>Finance</b>
          </span>
          <button onClick={logout}>Αποσύνδεση</button>
        </div>
        {!online && (
          <div className="notice" role="status">
            Είστε εκτός σύνδεσης. Οι καταχωρήσεις χρειάζονται σύνδεση στο
            διαδίκτυο για να αποθηκευτούν.
          </div>
        )}
        <label className="mobile-switch">
          Μετάβαση σε
          <select
            value={page}
            onChange={(e) => {
              setPage(e.target.value);
              window.scrollTo(0, 0);
            }}
          >
            {nav.map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Comp key={page} ctx={ctx} rerender={() => setRefresh((x) => x + 1)} />
      </main>
    </div>
  );
}
function Auth() {
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [pass, setPass] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function go(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const { error } =
        mode === "login"
          ? await supabase.auth.signInWithPassword({
              email: email.trim(),
              password: pass,
            })
          : await supabase.auth.signUp({ email: email.trim(), password: pass });
      if (error) throw error;
      if (mode === "signup")
        setMessage("Ελέγξτε το email σας για την επιβεβαίωση του λογαριασμού.");
    } catch (e) {
      setError(
        e.message === "Invalid login credentials"
          ? "Το email ή ο κωδικός δεν είναι σωστά."
          : e.message || "Δεν ήταν δυνατή η σύνδεση.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="auth">
      <div className="authbox">
        <div className="auth-mark">
          CULT <span>FINANCE</span>
        </div>
        <h1>
          Η επιχείρησή σου,
          <br />
          σε μία εικόνα.
        </h1>
        <p>Ταμείο, έσοδα και υποχρεώσεις. Οργανωμένα, κάθε μέρα.</p>
        <div className="tabs">
          <button
            disabled={busy}
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
          >
            Σύνδεση
          </button>
          <button
            disabled={busy}
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
              setMessage("");
            }}
          >
            Εγγραφή
          </button>
        </div>
        <form onSubmit={go}>
          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Κωδικός
            <input
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              minLength="6"
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "Περιμένετε…"
              : mode === "login"
                ? "Σύνδεση στον λογαριασμό"
                : "Δημιουργία λογαριασμού"}
          </button>
        </form>
      </div>
    </div>
  );
}
function useFinance(ctx, from, to) {
  const [data, setData] = useState({
    incomes: [],
    expenses: [],
    obligations: [],
    goals: null,
    recurring: [],
    loading: true,
    error: null,
  });
  useEffect(() => {
    let active = true;
    setData((old) => ({ ...old, loading: true, error: null }));
    const b = ctx.business.id;
    (async () => {
      try {
        const [incomes, expenses, obligations, g, recurring] =
          await Promise.all([
            fetchAll(() =>
              supabase
                .from("incomes")
                .select("*")
                .eq("business_id", b)
                .gte("date", from)
                .lte("date", to)
                .order("id"),
            ),
            fetchAll(() =>
              supabase
                .from("expenses")
                .select("*")
                .eq("business_id", b)
                .gte("date", from)
                .lte("date", to)
                .order("id"),
            ),
            fetchAll(() =>
              supabase
                .from("obligations")
                .select("*")
                .eq("business_id", b)
                .order("due_date")
                .order("id"),
            ),
            supabase
              .from("goals")
              .select("*")
              .eq("business_id", b)
              .maybeSingle(),
            fetchAll(() =>
              supabase
                .from("recurring_expenses")
                .select("*")
                .eq("business_id", b)
                .order("day_of_month")
                .order("id"),
            ),
          ]);
        if (g.error) throw g.error;
        if (active)
          setData({
            incomes,
            expenses,
            obligations,
            goals: g.data,
            recurring,
            loading: false,
            error: null,
          });
      } catch (error) {
        if (active)
          setData((old) => ({
            ...old,
            loading: false,
            error: error.message || "Ελέγξτε τη σύνδεσή σας.",
          }));
      }
    })();
    return () => {
      active = false;
    };
  }, [ctx.business.id, from, to]);
  return data;
}
function DataStatus({ data }) {
  return (
    <div className="panel" role={data.error ? "alert" : "status"}>
      {data.error ? (
        <>
          <h2>Δεν φορτώθηκαν τα δεδομένα</h2>
          <p>{data.error}</p>
          <button className="primary" onClick={() => location.reload()}>
            Νέα προσπάθεια
          </button>
        </>
      ) : (
        <p>Φόρτωση οικονομικών στοιχείων…</p>
      )}
    </div>
  );
}
function Header({ title, sub, children }) {
  return (
    <div className="header">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
function Card({ label, value, note }) {
  return (
    <div className="card">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
function Dashboard({ ctx }) {
  const t = today(),
    d = useFinance(ctx, t, t),
    m = useFinance(ctx, monthRange()[0], t),
    c = calc(d.incomes, d.expenses),
    cm = calc(m.incomes, m.expenses),
    pending = d.obligations.filter((x) => x.status !== "paid").slice(0, 4);
  if (d.loading || d.error) return <DataStatus data={d} />;
  if (m.loading || m.error) return <DataStatus data={m} />;
  return (
    <>
      <Header
        title="Επισκόπηση ημέρας"
        sub={new Date().toLocaleDateString("el-GR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />
      <div className="cards">
        <Card label="Τζίρος σήμερα" value={eur(c.turnover)} />
        <Card label="Μετρητά" value={eur(c.cash)} />
        <Card label="POS / Κάρτες" value={eur(c.card)} />
        <Card label="Έξοδα ημέρας" value={eur(c.exp)} />
        <Card label="Καθαρό αποτέλεσμα" value={eur(c.profit)} />
        <Card label="Εκτιμώμενος ΦΠΑ" value={eur(Math.max(0, c.vatDue))} />
      </div>
      <section>
        <h2>Μήνας μέχρι σήμερα</h2>
        <div className="cards three">
          <Card label="Τζίρος μήνα" value={eur(cm.turnover)} />
          <Card label="Έξοδα μήνα" value={eur(cm.exp)} />
          <Card label="Κέρδος προ φόρων" value={eur(cm.profit)} />
        </div>
      </section>
      <section>
        <h2>Επόμενες υποχρεώσεις</h2>
        <div className="table">
          {pending.map((x) => (
            <div className="row" key={x.id}>
              <span>{x.title}</span>
              <span>{x.due_date}</span>
              <b>{eur(x.amount)}</b>
            </div>
          ))}
          {!pending.length && (
            <p className="muted">Καμία εκκρεμής υποχρέωση.</p>
          )}
        </div>
      </section>
    </>
  );
}
function Income({ ctx }) {
  return <Transactions ctx={ctx} kind="income" />;
}
function Expenses({ ctx }) {
  return <Transactions ctx={ctx} kind="expense" />;
}
function Transactions({ ctx, kind }) {
  const [range, setRange] = useState(monthRange),
    [rows, setRows] = useState([]),
    [cats, setCats] = useState([]),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const lock = useRef(false),
    request = useRef(0),
    isIn = kind === "income",
    table = isIn ? "incomes" : "expenses";
  async function load() {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const [r, c] = await Promise.all([
        fetchAll(() =>
          supabase
            .from(table)
            .select("*")
            .eq("business_id", ctx.business.id)
            .gte("date", range[0])
            .lte("date", range[1])
            .order("date", { ascending: false })
            .order("id"),
        ),
        supabase
          .from("categories")
          .select("*")
          .eq("business_id", ctx.business.id)
          .eq("kind", isIn ? "income" : "expense"),
      ]);
      if (c.error) throw c.error;
      if (id === request.current) {
        setRows(r);
        setCats(c.data || []);
      }
    } catch (e) {
      if (id === request.current) setError(e.message);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    return () => {
      request.current++;
    };
  }, [ctx.business.id, kind, ...range]);
  async function save(e) {
    e.preventDefault();
    if (lock.current) return;
    const f = new FormData(e.currentTarget);
    if (!validAmount(f.get("amount")))
      return setError("Το ποσό πρέπει να είναι μεγαλύτερο από μηδέν.");
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const amount = Number(f.get("amount")),
        vatRate = Number(f.get("vat")),
        split = splitGross(amount, vatRate),
        payload = {
          business_id: ctx.business.id,
          date: f.get("date"),
          category_id: f.get("category") || null,
          payment_method: f.get("payment"),
          created_by: ctx.user.id,
          vat_rate: vatRate,
          ...split,
          ...(isIn
            ? { gross: amount, description: f.get("name").trim() }
            : {
                total: amount,
                supplier: f.get("name").trim(),
                vat_deductible: f.get("deductible") === "on",
              }),
        };
      if (!(isIn ? payload.description : payload.supplier))
        throw Error("Συμπληρώστε περιγραφή.");
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
      setShow(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const visible = rows.filter((r) =>
    String(isIn ? r.description : r.supplier)
      .toLocaleLowerCase("el")
      .includes(query.toLocaleLowerCase("el")),
  );
  return (
    <>
      <Header title={isIn ? "Έσοδα" : "Έξοδα"} sub="Καταχωρήσεις και αναζήτηση">
        <button
          className="primary"
          disabled={busy}
          onClick={() => setShow(!show)}
        >
          <Plus size={16} />
          {show ? "Ακύρωση" : "Νέα καταχώρηση"}
        </button>
      </Header>
      <div className="filters">
        <label>
          Από
          <input
            type="date"
            value={range[0]}
            max={range[1]}
            onChange={(e) =>
              e.target.value && setRange([e.target.value, range[1]])
            }
          />
        </label>
        <label>
          Έως
          <input
            type="date"
            value={range[1]}
            min={range[0]}
            onChange={(e) =>
              e.target.value && setRange([range[0], e.target.value])
            }
          />
        </label>
        <label>
          Αναζήτηση
          <input
            type="search"
            placeholder="Περιγραφή ή προμηθευτής"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={load}>Επανάληψη φόρτωσης</button>
        </div>
      )}
      {show && (
        <form className="formgrid" onSubmit={save}>
          <label>
            Ημερομηνία
            <input name="date" type="date" defaultValue={today()} required />
          </label>
          <label>
            {isIn ? "Περιγραφή" : "Προμηθευτής"}
            <input name="name" required maxLength={200} />
          </label>
          <label>
            Κατηγορία
            <select name="category">
              <option value="">Χωρίς κατηγορία</option>
              {cats.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ποσό με ΦΠΑ (€)
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </label>
          <label>
            ΦΠΑ %
            <select
              name="vat"
              defaultValue={ctx.business.default_vat_rate ?? 24}
            >
              {[24, 13, 6, 0].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Τρόπος πληρωμής
            <select name="payment">
              <option value="cash">Μετρητά</option>
              <option value="card">Κάρτα / POS</option>
              <option value="bank">Τράπεζα</option>
            </select>
          </label>
          {!isIn && (
            <label className="check">
              <input name="deductible" type="checkbox" defaultChecked />
              Εκπιπτόμενος ΦΠΑ
            </label>
          )}
          <button className="primary" disabled={busy} type="submit">
            <Save size={16} />
            {busy ? "Αποθήκευση…" : "Αποθήκευση"}
          </button>
        </form>
      )}
      {loading ? (
        <p role="status">Φόρτωση καταχωρήσεων…</p>
      ) : (
        !error && (
          <>
            <div className="list-summary">
              <span>{visible.length} καταχωρήσεις</span>
              <strong>{eur(sum(visible, isIn ? "gross" : "total"))}</strong>
            </div>
            <div className="table">
              {visible.map((r) => (
                <div className="row" key={r.id}>
                  <span>{r.date}</span>
                  <span>{isIn ? r.description : r.supplier || "Έξοδο"}</span>
                  <span>{paymentLabel(r.payment_method)}</span>
                  <b>{eur(isIn ? r.gross : r.total)}</b>
                </div>
              ))}
              {!visible.length && (
                <p className="muted">
                  Δεν υπάρχουν καταχωρήσεις για αυτή την επιλογή.
                </p>
              )}
            </div>
          </>
        )
      )}
    </>
  );
}
function Cash({ ctx }) {
  const t = today(),
    d = useFinance(ctx, t, t),
    c = calc(d.incomes, d.expenses),
    [cashday, setCashday] = useState(null),
    [actual, setActual] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cash_days")
        .select("*")
        .eq("business_id", ctx.business.id)
        .eq("date", t)
        .maybeSingle();
      if (error) throw error;
      setCashday(data);
      setActual(data?.actual_closing ?? "");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [ctx.business.id, t]);
  const opening = Number(
      cashday?.opening_cash ?? ctx.business.opening_cash ?? 0,
    ),
    cashOut = sum(
      d.expenses.filter((x) => x.payment_method === "cash"),
      "total",
    ),
    expected =
      opening +
      c.cash -
      cashOut +
      Number(cashday?.deposits ?? 0) -
      Number(cashday?.withdrawals ?? 0);
  async function close(e) {
    e.preventDefault();
    if (lock.current) return;
    if (!validAmount(actual, true))
      return setError("Συμπληρώστε έγκυρο τελικό ταμείο.");
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        business_id: ctx.business.id,
        date: t,
        opening_cash: opening,
        actual_closing: Number(actual),
        closed: true,
        closed_at: new Date().toISOString(),
        closed_by: ctx.user.id,
      };
      const { data, error } = cashday
        ? await supabase
            .from("cash_days")
            .update(payload)
            .eq("id", cashday.id)
            .eq("business_id", ctx.business.id)
            .select("id")
            .single()
        : await supabase
            .from("cash_days")
            .insert(payload)
            .select("id")
            .single();
      if (error) throw error;
      if (!data) throw Error("Δεν αποθηκεύτηκε το κλείσιμο.");
      await load();
      setMessage("Το κλείσιμο αποθηκεύτηκε.");
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (d.loading || d.error) return <DataStatus data={d} />;
  if (loading) return <p role="status">Φόρτωση ταμείου…</p>;
  return (
    <>
      <Header title="Ημερήσιο ταμείο" sub={t} />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <div className="cards">
        <Card label="Αρχικό ταμείο" value={eur(opening)} />
        <Card label="Μετρητά εσόδων" value={eur(c.cash)} />
        <Card label="Μετρητά εξόδων" value={eur(cashOut)} />
        <Card label="Αναμενόμενο τελικό" value={eur(expected)} />
      </div>
      <form onSubmit={close} className="panel">
        <h2>Κλείσιμο ημέρας</h2>
        <label>
          Πραγματικό τελικό ταμείο (€)
          <input
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            required
          />
        </label>
        <p>
          Διαφορά:{" "}
          <b>
            {actual === ""
              ? "Συμπληρώστε το τελικό ποσό"
              : eur(Number(actual) - expected)}
          </b>
        </p>
        <button className="primary" disabled={busy || !!error}>
          <CheckCircle2 size={16} />
          {busy
            ? "Αποθήκευση…"
            : cashday?.closed
              ? "Ενημέρωση κλεισίματος"
              : "Κλείσιμο ημέρας"}
        </button>
        {error && (
          <button
            type="button"
            onClick={() => {
              setError("");
              load();
            }}
          >
            Νέα προσπάθεια
          </button>
        )}
      </form>
    </>
  );
}
function Tax({ ctx }) {
  const d = useFinance(ctx, ...monthRange()),
    c = calc(d.incomes, d.expenses),
    tax =
      (Math.max(0, c.profit) * Number(ctx.business.income_tax_pct ?? 22)) / 100,
    res =
      (Math.max(0, c.profit) * Number(ctx.business.tax_reserve_pct ?? 20)) /
      100;
  if (d.loading || d.error) return <DataStatus data={d} />;
  return (
    <>
      <Header title="Φορολογική εικόνα" sub="Εκτίμηση τρέχοντος μήνα" />
      <div className="notice">
        Οι υπολογισμοί είναι ενδεικτικοί και δεν αποτελούν λογιστική ή
        φοροτεχνική συμβουλή.
      </div>
      <div className="cards">
        <Card label="ΦΠΑ εκροών" value={eur(c.vatOut)} />
        <Card label="ΦΠΑ εισροών" value={eur(c.vatIn)} />
        <Card
          label="Εκτιμώμενος πληρωτέος ΦΠΑ"
          value={eur(Math.max(0, c.vatDue))}
        />
        <Card label="Κέρδος προ φόρων" value={eur(c.profit)} />
        <Card
          label={
            "Εκτ. φόρος εισοδήματος (" + ctx.business.income_tax_pct + "%)"
          }
          value={eur(tax)}
        />
        <Card label="Προτεινόμενο φορολογικό αποθεματικό" value={eur(res)} />
      </div>
    </>
  );
}
function Overview({ ctx }) {
  const d = useFinance(ctx, ...monthRange()),
    c = calc(d.incomes, d.expenses);
  const days = {};
  d.incomes.forEach(
    (x) => (days[x.date] = (days[x.date] || 0) + Number(x.gross)),
  );
  const chart = Object.entries(days)
    .sort()
    .map(([date, revenue]) => ({ date: date.slice(8), revenue }));
  if (d.loading || d.error) return <DataStatus data={d} />;
  return (
    <>
      <Header title="Οικονομική εικόνα" sub="Τρέχων μήνας" />
      <div className="cards">
        <Card label="Τζίρος" value={eur(c.turnover)} />
        <Card label="Συνολικά έξοδα" value={eur(c.exp)} />
        <Card label="Κέρδος προ φόρων" value={eur(c.profit)} />
        <Card
          label="Περιθώριο"
          value={
            (c.netRevenue ? (c.profit / c.netRevenue) * 100 : 0).toFixed(1) +
            "%"
          }
        />
      </div>
      <section className="panel">
        <h2>Τζίρος ανά ημέρα</h2>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [eur(value), "Τζίρος"]} />
              <Bar dataKey="revenue" fill="#2f8f7c" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
function Obligations({ ctx }) {
  const [rows, setRows] = useState([]),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function load() {
    setLoading(true);
    try {
      setRows(
        await fetchAll(() =>
          supabase
            .from("obligations")
            .select("*")
            .eq("business_id", ctx.business.id)
            .order("due_date")
            .order("id"),
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [ctx.business.id]);
  async function mutate(query) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const { error } = await query;
      if (error) throw error;
      setShow(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function add(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!validAmount(f.get("amount")))
      return setError("Συμπληρώστε θετικό ποσό.");
    mutate(
      supabase.from("obligations").insert({
        business_id: ctx.business.id,
        title: f.get("title").trim(),
        amount: Number(f.get("amount")),
        due_date: f.get("due"),
        status: "pending",
      }),
    );
  }
  function paid(id) {
    mutate(
      supabase
        .from("obligations")
        .update({ status: "paid" })
        .eq("business_id", ctx.business.id)
        .eq("id", id)
        .select("id")
        .single(),
    );
  }
  return (
    <>
      <Header title="Υποχρεώσεις" sub="Προθεσμίες και εκκρεμείς πληρωμές">
        <button
          className="primary"
          disabled={busy}
          onClick={() => setShow(!show)}
        >
          <Plus size={16} />
          {show ? "Ακύρωση" : "Νέα υποχρέωση"}
        </button>
      </Header>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {show && (
        <form className="formgrid" onSubmit={add}>
          <label>
            Τίτλος
            <input name="title" required maxLength={200} />
          </label>
          <label>
            Ποσό (€)
            <input name="amount" type="number" min="0.01" step=".01" required />
          </label>
          <label>
            Προθεσμία
            <input name="due" type="date" required />
          </label>
          <button disabled={busy} className="primary">
            {busy ? "Αποθήκευση…" : "Αποθήκευση"}
          </button>
        </form>
      )}
      {loading ? (
        <p role="status">Φόρτωση υποχρεώσεων…</p>
      ) : (
        <div className="table">
          {rows.map((x) => (
            <div className="row" key={x.id}>
              <span>
                {x.title}
                {x.status !== "paid" && x.due_date < today() && (
                  <small className="overdue">Εκπρόθεσμη</small>
                )}
              </span>
              <span>{x.due_date}</span>
              <b>{eur(x.amount)}</b>
              <button
                className="mini"
                disabled={busy || x.status === "paid"}
                onClick={() => paid(x.id)}
              >
                {x.status === "paid" ? "Πληρωμένο" : "Σήμανση πληρωμής"}
              </button>
            </div>
          ))}
          {!rows.length && !error && (
            <p className="muted">Δεν υπάρχουν υποχρεώσεις.</p>
          )}
        </div>
      )}
    </>
  );
}
function Fixed({ ctx }) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(null);
  const lock = useRef(false);
  async function load() {
    setLoading(true);
    try {
      setRows(
        await fetchAll(() =>
          supabase
            .from("recurring_expenses")
            .select("*")
            .eq("business_id", ctx.business.id)
            .order("day_of_month")
            .order("id"),
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [ctx.business.id]);
  async function save(e) {
    e.preventDefault();
    if (lock.current) return;
    const f = new FormData(e.currentTarget),
      title = f.get("title").trim(),
      amount = Number(f.get("amount")),
      day = Number(f.get("day"));
    if (
      !title ||
      !validAmount(amount) ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31
    )
      return setError("Ελέγξτε την περιγραφή, το ποσό και την ημέρα.");
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        business_id: ctx.business.id,
        title,
        amount,
        frequency: editing.frequency || "monthly",
        day_of_month: day,
      };
      const q = editing.id
        ? supabase
            .from("recurring_expenses")
            .update(payload)
            .eq("id", editing.id)
            .eq("business_id", ctx.business.id)
        : supabase.from("recurring_expenses").insert(payload);
      const { error } = await q.select("id").single();
      if (error) throw error;
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Header
        title="Πάγια έξοδα"
        sub="Καταχώρησε και ενημέρωσε τα επαναλαμβανόμενα έξοδα"
      >
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            setEditing({
              title: "",
              amount: "",
              day_of_month: 1,
              frequency: "monthly",
            })
          }
        >
          Νέο μηνιαίο πάγιο
        </button>
      </Header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {editing && (
        <form className="formgrid" onSubmit={save} key={editing.id || "new"}>
          <label>
            Περιγραφή παγίου
            <input
              name="title"
              defaultValue={editing.title}
              required
              maxLength={200}
            />
          </label>
          <label>
            Ποσό παγίου (€)
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={editing.amount}
              required
            />
          </label>
          <label>
            Ημέρα μήνα
            <input
              name="day"
              type="number"
              min="1"
              max="31"
              step="1"
              defaultValue={editing.day_of_month}
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Αποθήκευση…" : "Αποθήκευση παγίου"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(null)}
          >
            Ακύρωση
          </button>
        </form>
      )}
      {loading ? (
        <p role="status">Φόρτωση παγίων…</p>
      ) : (
        <>
          <div className="table">
            {rows.map((x) => (
              <div className="row" key={x.id}>
                <span>{x.title}</span>
                <span>
                  {x.frequency === "monthly" ? "Κάθε μήνα" : x.frequency} ·{" "}
                  {x.day_of_month}
                </span>
                <b>{eur(x.amount)}</b>
                <button
                  disabled={busy}
                  className="mini"
                  onClick={() => setEditing(x)}
                >
                  Επεξεργασία
                </button>
              </div>
            ))}
            {!rows.length && !error && (
              <p className="muted">Δεν υπάρχουν πάγια. Πρόσθεσε το πρώτο.</p>
            )}
          </div>
          <div className="cards three">
            <Card
              label="Μηνιαία πάγια"
              value={eur(
                sum(
                  rows.filter((x) => x.frequency === "monthly"),
                  "amount",
                ),
              )}
            />
          </div>
        </>
      )}
    </>
  );
}
function Goals({ ctx }) {
  const d = useFinance(ctx, ...monthRange()),
    c = calc(d.incomes, d.expenses),
    [saved, setSaved] = useState(null),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    g = saved || d.goals || {},
    pct =
      Number(g.monthly_target) > 0
        ? Math.max(0, (c.turnover / Number(g.monthly_target)) * 100)
        : 0;
  async function save(e) {
    e.preventDefault();
    if (lock.current) return;
    const f = new FormData(e.currentTarget),
      payload = {
        business_id: ctx.business.id,
        daily_target: Number(f.get("daily")),
        monthly_target: Number(f.get("monthly")),
        fixed_costs_monthly: Number(f.get("fixed")),
      };
    if (
      ![
        payload.daily_target,
        payload.monthly_target,
        payload.fixed_costs_monthly,
      ].every((v) => validAmount(v, true))
    )
      return setError("Συμπληρώστε μη αρνητικά ποσά.");
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const q =
        saved || d.goals
          ? supabase
              .from("goals")
              .update(payload)
              .eq("business_id", ctx.business.id)
          : supabase.from("goals").insert(payload);
      const { data, error } = await q.select("*").single();
      if (error) throw error;
      setSaved(data);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (d.loading || d.error) return <DataStatus data={d} />;
  return (
    <>
      <Header title="Στόχοι">
        <button
          className="primary"
          disabled={busy}
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Ακύρωση" : "Ορισμός στόχων"}
        </button>
      </Header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <form className="formgrid" onSubmit={save}>
          <label>
            Ημερήσιος στόχος (€)
            <input
              name="daily"
              type="number"
              min="0"
              step="0.01"
              defaultValue={g.daily_target ?? 0}
              required
            />
          </label>
          <label>
            Μηνιαίος στόχος (€)
            <input
              name="monthly"
              type="number"
              min="0"
              step="0.01"
              defaultValue={g.monthly_target ?? 0}
              required
            />
          </label>
          <label>
            Σταθερό μηνιαίο κόστος (€)
            <input
              name="fixed"
              type="number"
              min="0"
              step="0.01"
              defaultValue={g.fixed_costs_monthly ?? 0}
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Αποθήκευση…" : "Αποθήκευση στόχων"}
          </button>
        </form>
      )}
      <div className="cards">
        <Card label="Ημερήσιος στόχος" value={eur(g.daily_target)} />
        <Card label="Μηνιαίος στόχος" value={eur(g.monthly_target)} />
        <Card
          label="Σταθερό μηνιαίο κόστος"
          value={eur(g.fixed_costs_monthly)}
        />
        <Card label="Τζίρος μήνα" value={eur(c.turnover)} />
      </div>
      <section className="panel">
        <h2>Πρόοδος μήνα</h2>
        <div className="progress">
          <i style={{ width: Math.min(100, pct) + "%" }} />
        </div>
        <p>
          {Number(g.monthly_target) > 0
            ? pct.toLocaleString("el-GR", { maximumFractionDigits: 1 }) +
              "% του στόχου"
            : "Όρισε μηνιαίο στόχο για να βλέπεις την πρόοδο."}
        </p>
      </section>
    </>
  );
}
function Reports({ ctx }) {
  const d = useFinance(ctx, ...monthRange()),
    c = calc(d.incomes, d.expenses);
  function csv() {
    const rows = [
        ["Τύπος", "Ημερομηνία", "Περιγραφή", "Ποσό"],
        ...d.incomes.map((x) => [
          "Έσοδο",
          x.date,
          x.description || "",
          x.gross,
        ]),
        ...d.expenses.map((x) => ["Έξοδο", x.date, x.supplier || "", x.total]),
      ],
      blob = new Blob([csvText(rows)], { type: "text/csv;charset=utf-8" }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cult-finance-report.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  if (d.loading || d.error) return <DataStatus data={d} />;
  return (
    <>
      <Header title="Αναφορές">
        <button className="primary" onClick={csv}>
          Εξαγωγή CSV
        </button>
        <button onClick={() => window.print()}>Εκτύπωση</button>
      </Header>
      <div className="cards">
        <Card label="Τζίρος μήνα" value={eur(c.turnover)} />
        <Card label="Έξοδα" value={eur(c.exp)} />
        <Card label="Κέρδος" value={eur(c.profit)} />
        <Card label="ΦΠΑ" value={eur(c.vatDue)} />
      </div>
    </>
  );
}
function SettingsPage({ ctx, rerender }) {
  const [f, setF] = useState({ ...ctx.business }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function save(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: f.name.trim(),
        afm: f.afm?.trim() || null,
        doy: f.doy?.trim() || null,
        default_vat_rate: Number(f.default_vat_rate),
        tax_reserve_pct: Number(f.tax_reserve_pct),
        income_tax_pct: Number(f.income_tax_pct),
        opening_cash: Number(f.opening_cash),
      };
      if (!payload.name) throw Error("Συμπληρώστε επωνυμία.");
      const { error } = await supabase
        .from("businesses")
        .update(payload)
        .eq("id", ctx.business.id)
        .select("id")
        .single();
      if (error) throw error;
      rerender();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const field = (key, label, props = {}) => (
    <label>
      {label}
      <input
        value={f[key] ?? ""}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        {...props}
      />
    </label>
  );
  return (
    <>
      <Header
        title="Ρυθμίσεις επιχείρησης"
        sub="Τα στοιχεία που χρησιμοποιούνται στους υπολογισμούς"
      />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <form className="panel formgrid" onSubmit={save}>
        {field("name", "Επωνυμία", { required: true, maxLength: 200 })}
        {field("afm", "ΑΦΜ", {
          inputMode: "numeric",
          pattern: "[0-9]{9}",
          maxLength: 9,
        })}
        {field("doy", "ΔΟΥ")}
        {field("default_vat_rate", "ΦΠΑ %", {
          type: "number",
          min: 0,
          max: 100,
          step: 0.01,
          required: true,
        })}
        {field("tax_reserve_pct", "Φορολογικό αποθεματικό %", {
          type: "number",
          min: 0,
          max: 100,
          step: 0.01,
          required: true,
        })}
        {field("income_tax_pct", "Εκτιμώμενος φόρος εισοδήματος %", {
          type: "number",
          min: 0,
          max: 100,
          step: 0.01,
          required: true,
        })}
        {field("opening_cash", "Αρχικό ταμείο (€)", {
          type: "number",
          min: 0,
          step: 0.01,
          required: true,
        })}
        <button disabled={busy} className="primary">
          <Save size={16} />
          {busy ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
      </form>
      <ResetFinance client={supabase} ctx={ctx} onDone={rerender} />
    </>
  );
}
function Integrations() {
  return (
    <>
      <Header title="Συνδέσεις" sub="Κατάσταση διαθέσιμων διασυνδέσεων" />
      <div className="notice">
        Οι παρακάτω διασυνδέσεις δεν έχουν ενεργοποιηθεί. Δεν γίνεται αυτόματος
        συγχρονισμός δεδομένων.
      </div>
      <div className="integrations">
        {[
          ["myDATA / ΑΑΔΕ", "Αυτόματη εισαγωγή παραστατικών"],
          ["POS", "Συμφωνία καρτών με ημερήσιο ταμείο"],
          ["Τράπεζες", "Αυτόματη αντιστοίχιση κινήσεων"],
        ].map(([a, b]) => (
          <div className="panel" key={a}>
            <h2>{a}</h2>
            <p>{b}</p>
            <span className="badge">Δεν έχει υλοποιηθεί σύνδεση</span>
          </div>
        ))}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
