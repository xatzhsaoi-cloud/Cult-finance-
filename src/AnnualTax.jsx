import React, { useState } from "react";
import { annualDefaults, annualEstimate } from "./annual-tax.js";
const eur = (n) =>
  new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(
    n,
  );
const source =
  "https://minfin.gov.gr/forologiki-politiki/forologikos-odigos/forologia-eisodimatos/";
function Field({ label, name, p, set, help }) {
  return (
    <label>
      {label}
      <input
        type="number"
        min="0"
        step={name === "children" ? "1" : "0.01"}
        value={p[name]}
        onChange={(e) => set(name, e.target.value)}
      />
      {help && <small>{help}</small>}
    </label>
  );
}
export default function AnnualTax({ ctx }) {
  const key = `cult-annual-v1:${ctx.user.id}:${ctx.business.id}`;
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch {
      return {};
    }
  });
  const [year, setYear] = useState(2023),
    [p, setP] = useState(() => ({
      ...annualDefaults(2023),
      ...saved[2023],
      year: 2023,
    })),
    [message, setMessage] = useState("");
  const set = (name, value) => {
    setP((prev) => ({ ...prev, [name]: value }));
    setMessage("Μη αποθηκευμένες αλλαγές.");
  };
  const changeYear = (e) => {
    const y = Number(e.target.value);
    setYear(y);
    setP({ ...annualDefaults(y), ...saved[y], year: y });
    setMessage("");
  };
  let result,
    error = "";
  const complete = ["turnover", "expenses", "vatInput"].every(
    (k) => p[k] !== "",
  );
  try {
    if (complete) result = annualEstimate(p);
  } catch (e) {
    error = e.message;
  }
  const save = () => {
    try {
      const next = { ...saved, [year]: p };
      localStorage.setItem(key, JSON.stringify(next));
      setSaved(next);
      setMessage(`Αποθηκεύτηκε το ${year} σε αυτόν τον browser.`);
    } catch {
      setMessage("Η αποθήκευση απέτυχε. Τα ποσά παραμένουν στη φόρμα.");
    }
  };
  return (
    <>
      <header className="pagehead">
        <div>
          <h1>Ετήσιος φόρος & ΦΠΑ</h1>
          <p>Ατομική επιχείρηση · Χειροκίνητα ποσά από το 2023</p>
        </div>
      </header>
      <div className="notice">
        Καθαρός τζίρος χωρίς ΦΠΑ. Αυτοτελής εκτίμηση ανά έτος, χωρίς σύνδεση ή
        αποστολή στην ΑΑΔΕ. Τα ποσά δεν προστίθενται στις καθημερινές
        καταχωρήσεις.
      </div>
      <div className="formgrid">
        <label>
          Φορολογικό έτος
          <select value={year} onChange={changeYear}>
            {[2023, 2024, 2025, 2026].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <small>Αποθήκευσε πριν αλλάξεις έτος.</small>
        </label>
        <Field
          label="Ετήσιος καθαρός τζίρος (€)"
          name="turnover"
          {...{ p, set }}
        />
        <Field
          label="Εκπιπτόμενα ετήσια έξοδα (€)"
          name="expenses"
          {...{ p, set }}
          help="Χωρίς τον ΦΠΑ που εκπίπτει. Συμπερίλαβε εκπιπτόμενες εισφορές και αποσβέσεις, όχι ολόκληρη την αγορά παγίων."
        />
        <Field
          label="Συντελεστής ΦΠΑ πωλήσεων (%)"
          name="vatRate"
          {...{ p, set }}
          help="Για πωλήσεις με έναν κοινό συντελεστή. Σε απαλλαγή συμπλήρωσε 0 και μηδενικό εκπιπτόμενο ΦΠΑ αγορών."
        />
        <Field
          label="Εκπιπτόμενος ΦΠΑ αγορών (€)"
          name="vatInput"
          {...{ p, set }}
          help="Μόνο ο ΦΠΑ που δικαιούσαι να αφαιρέσεις. Βάλε 0 αν δεν υπάρχει."
        />
        {year === 2026 && (
          <>
            <label>
              Ηλικία μέσα στο 2026
              <select
                value={p.age}
                onChange={(e) => set("age", e.target.value)}
              >
                <option value="">Επίλεξε</option>
                <option value="under26">Έως 25 ετών</option>
                <option value="26to30">26–30 ετών</option>
                <option value="over30">Πάνω από 30 ετών</option>
              </select>
            </label>
            <Field label="Εξαρτώμενα τέκνα" name="children" {...{ p, set }} />
          </>
        )}
      </div>
      <details className="panel" open>
        <summary>Φορολογικές παραδοχές και ποσά που έχουν πληρωθεί</summary>
        <div className="formgrid">
          <label>
            Πρώτη έναρξη ατομικής το 2023
            <select
              value={p.firstStart ? "yes" : "no"}
              onChange={(e) => set("firstStart", e.target.value === "yes")}
            >
              <option value="no">
                Δεν εφαρμόζεται / δεν έχει επιβεβαιωθεί
              </option>
              <option value="yes">Ναι, πρώτη έναρξη το 2023</option>
            </select>
            <small>
              Μείωση πρώτου συντελεστή κατά 50% για 2023–2025 με τζίρο έως
              10.000 €.
            </small>
          </label>
          <Field
            label="Ελάχιστο φορολογητέο εισόδημα (€)"
            name="minimum"
            {...{ p, set }}
            help="Τελικό ποσό μετά από εξαιρέσεις/μειώσεις, από τον λογιστή. Κενό: εκτίμηση μόνο βάσει κέρδους· δεν υπολογίζεται αυτόματα το τεκμαρτό ελάχιστο."
          />
          <label>
            Προκαταβολή φόρου
            <select
              value={p.advance}
              onChange={(e) => set("advance", e.target.value)}
            >
              <option value="normal">Κανονική — 55%</option>
              <option value="first">
                Πρώτη απόκτηση επιχειρηματικού εισοδήματος — 27,5%
              </option>
              <option value="none">Δεν οφείλεται (επιβεβαίωση λογιστή)</option>
            </select>
          </label>
          <Field
            label="Πιστώσεις / καταβολές φόρου εισοδήματος (€)"
            name="taxCredits"
            {...{ p, set }}
            help="Προηγούμενη προκαταβολή και καταβολές για το συγκεκριμένο έτος, χωρίς διπλομέτρηση. Παρακρατήσεις που επηρεάζουν τη νέα προκαταβολή χρειάζονται ξεχωριστό έλεγχο."
          />
          <Field
            label="ΦΠΑ που έχει ήδη πληρωθεί (€)"
            name="vatPaid"
            {...{ p, set }}
          />
          <Field
            label="Πιστωτικό ΦΠΑ από προηγούμενο έτος (€)"
            name="vatCredit"
            {...{ p, set }}
          />
        </div>
      </details>
      <button onClick={save}>Αποθήκευση έτους {year}</button>
      <p role="status">{message}</p>
      <p className="muted">
        Αποθήκευση μόνο σε αυτόν τον browser, για τον λογαριασμό σου. Δεν
        συγχρονίζεται σε άλλες συσκευές και χάνεται αν διαγραφούν τα δεδομένα
        του browser.
      </p>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {!complete && (
        <p className="notice">
          Συμπλήρωσε τζίρο, έξοδα και ΦΠΑ αγορών για να εμφανιστεί η εκτίμηση.
          Αν κάποιο ποσό δεν υπάρχει, βάλε 0.
        </p>
      )}
      {result && (
        <>
          <h2>Εκτίμηση {year}</h2>
          <div className="cards">
            {[
              ["Κέρδος προ φόρου", result.profit],
              ["Βάση υπολογισμού φόρου", result.taxable],
              ["Φόρος εισοδήματος", result.tax],
              [`Νέα προκαταβολή (${result.advanceRate}%)`, result.advance],
              [
                result.incomeBalance >= 0
                  ? "Υπόλοιπο φόρου με προκαταβολή"
                  : "Εκτιμώμενο πιστωτικό φόρου",
                Math.abs(result.incomeBalance),
              ],
              ["ΦΠΑ πωλήσεων", result.vatOut],
              [
                result.vatBalance >= 0
                  ? "Ετήσιο υπόλοιπο ΦΠΑ"
                  : "Εκτιμώμενο πιστωτικό ΦΠΑ",
                Math.abs(result.vatBalance),
              ],
            ].map(([label, value]) => (
              <div className="card" key={label}>
                <span>{label}</span>
                <h2>{eur(value)}</h2>
              </div>
            ))}
          </div>
          {p.minimum === "" && (
            <p className="notice">
              Δεν έχει δηλωθεί ελάχιστο φορολογητέο εισόδημα. Ο φόρος βασίζεται
              μόνο στο κέρδος και μπορεί να είναι χαμηλότερος από την
              εκκαθάριση.
            </p>
          )}
          <details className="panel">
            <summary>Πώς προκύπτει ο φόρος</summary>
            {result.bands
              .filter((b) => b.amount > 0)
              .map((b) => (
                <p key={b.lower}>
                  {eur(b.amount)} × {b.rate}% = {eur(b.tax)}
                </p>
              ))}
            {result.newBusinessReduction && (
              <p>Εφαρμόστηκε η μείωση νέας επιχείρησης.</p>
            )}
          </details>
        </>
      )}
      <p className="notice">
        Εκτίμηση για εισόδημα αποκλειστικά από ατομική επιχείρηση. Δεν
        περιλαμβάνει μισθούς/συντάξεις, μεταφερόμενες ζημιές, προσωπικά
        τεκμήρια, ειδικές εκπτώσεις, τέλη ή προσαυξήσεις. Ο ΦΠΑ εδώ είναι ετήσια
        σύνοψη, όχι περιοδική δήλωση ή επιβεβαιωμένη οφειλή. Για οριστική
        εκκαθάριση χρειάζεται ο λογιστής.
      </p>
      <p>
        <a href={source} target="_blank" rel="noreferrer">
          Επίσημες κλίμακες φόρου
        </a>{" "}
        ·{" "}
        <a
          href="https://www.aade.gr/exypiretisi-enimerosi/hristikoi-odigoi/enarxi-epiheirimatikis-drastiriotitas/forologikes-apallages-elafrynseis"
          target="_blank"
          rel="noreferrer"
        >
          Μειώσεις νέας επιχείρησης
        </a>
      </p>
    </>
  );
}
