import React, { useState, useRef } from "react";
import { resetPreview, resetFinance, RESET_TABLES } from "./reset-finance.js";
export default function ResetFinance({ client, ctx, onDone }) {
  const [snapshot, setSnapshot] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [word, setWord] = useState(""),
    [progress, setProgress] = useState([]),
    [done, setDone] = useState(false);
  const lock = useRef(false);
  if (ctx.role !== "owner") return null;
  async function preview() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setSnapshot(null);
    setWord("");
    setDone(false);
    try {
      setSnapshot(await resetPreview(client, ctx.business.id));
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function reset(e) {
    e.preventDefault();
    if (lock.current || word !== "ΜΗΔΕΝΙΣΜΟΣ") return;
    lock.current = true;
    setBusy(true);
    setError("");
    setProgress([]);
    try {
      await resetFinance(client, snapshot, word, setProgress);
      setDone(true);
      setSnapshot(null);
      setWord("");
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function backup() {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      "cult-finance-before-reset-" + snapshot.createdAt.slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <section className="panel reset-panel">
      <h2>Νέα αρχή</h2>
      <p>
        Διαγραφή οικονομικών καταχωρήσεων όλων των ημερομηνιών και μηδενισμός
        αρχικού ταμείου και στόχων.
      </p>
      {!snapshot && !done && (
        <button type="button" disabled={busy} onClick={preview}>
          Προεπισκόπηση μηδενισμού
        </button>
      )}
      {snapshot && (
        <form onSubmit={reset}>
          <h3>{snapshot.business.name}</h3>
          <ul>
            {RESET_TABLES.map(([table, label]) => (
              <li key={table}>
                {label}: <strong>{snapshot.records[table].length}</strong>
              </li>
            ))}
            <li>Αρχικό ταμείο και ποσά στόχων: μηδενισμός</li>
          </ul>
          <p>
            Διατηρούνται ο λογαριασμός, η επωνυμία, ο ΑΦΜ, η ΔΟΥ, οι φορολογικές
            ρυθμίσεις και οι κατηγορίες.
          </p>
          <p className="error">
            Η διαγραφή είναι οριστική και δεν υπάρχει αναίρεση μέσα στην
            εφαρμογή. Μην κάνετε νέες καταχωρήσεις όσο εκτελείται.
          </p>
          <button type="button" disabled={busy} onClick={backup}>
            Λήψη αντιγράφου πριν τη διαγραφή
          </button>
          <label>
            Γράψε ΜΗΔΕΝΙΣΜΟΣ για επιβεβαίωση
            <input
              autoComplete="off"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="actions">
            <button className="danger" disabled={busy || word !== "ΜΗΔΕΝΙΣΜΟΣ"}>
              {busy ? "Μηδενισμός…" : "Οριστική διαγραφή και μηδενισμός"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSnapshot(null);
                setWord("");
              }}
            >
              Ακύρωση
            </button>
          </div>
        </form>
      )}
      {progress.length > 0 && (
        <p role="status">Ολοκληρώθηκαν: {progress.join(", ")}</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {done && (
        <div className="notice" role="status">
          <p>
            Ο μηδενισμός ολοκληρώθηκε και ελέγχθηκε. Μπορείτε να ξεκινήσετε νέες
            καταχωρήσεις.
          </p>
          <button type="button" onClick={onDone}>
            Συνέχεια με κενά δεδομένα
          </button>
        </div>
      )}
    </section>
  );
}
