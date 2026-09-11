import { fetchAll } from "./finance.js";
export const RESET_TABLES = [
  ["incomes", "Έσοδα"],
  ["expenses", "Έξοδα"],
  ["obligations", "Υποχρεώσεις"],
  ["cash_days", "Κλεισίματα ταμείου"],
  ["recurring_expenses", "Πάγια"],
];
export async function resetPreview(client, businessId) {
  if (!businessId) throw Error("Δεν έχει επιλεγεί επιχείρηση.");
  const records = {};
  for (const [table] of RESET_TABLES)
    records[table] = await fetchAll(() =>
      client.from(table).select("*").eq("business_id", businessId).order("id"),
    );
  const [business, goals] = await Promise.all([
    client.from("businesses").select("*").eq("id", businessId).single(),
    client
      .from("goals")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);
  if (business.error) throw business.error;
  if (goals.error) throw goals.error;
  return {
    businessId,
    createdAt: new Date().toISOString(),
    records,
    business: business.data,
    goals: goals.data,
  };
}
export async function resetFinance(
  client,
  snapshot,
  confirmation,
  onProgress = () => {},
) {
  if (confirmation !== "ΜΗΔΕΝΙΣΜΟΣ")
    throw Error("Η επιβεβαίωση δεν είναι σωστή.");
  const b = snapshot?.businessId;
  if (!b || snapshot.business?.id !== b) throw Error("Μη έγκυρη επιχείρηση.");
  for (const [table] of RESET_TABLES) {
    if (!Array.isArray(snapshot.records?.[table]))
      throw Error("Ελλιπής προεπισκόπηση.");
    for (const row of snapshot.records[table])
      if (!row.id || row.business_id !== b)
        throw Error("Μη έγκυρες εγγραφές προεπισκόπησης.");
  }
  const completed = [];
  try {
    for (const [table, label] of RESET_TABLES) {
      const rows = snapshot.records[table];
      for (let i = 0; i < rows.length; i += 100) {
        const ids = rows.slice(i, i + 100).map((r) => r.id);
        const { error } = await client
          .from(table)
          .delete()
          .eq("business_id", b)
          .in("id", ids);
        if (error) throw error;
      }
      // RLS can silently reject deletes. Verify using a fresh scoped read.
      const remaining = await fetchAll(() =>
        client.from(table).select("id").eq("business_id", b).order("id"),
      );
      if (remaining.length)
        throw Error(
          label +
            ": υπάρχουν ακόμη " +
            remaining.length +
            " εγγραφές. Ελέγξτε τα δικαιώματα ή τυχόν νέες καταχωρήσεις.",
        );
      completed.push(label);
      onProgress([...completed]);
    }
    if (snapshot.goals) {
      const { error } = await client
        .from("goals")
        .update({ daily_target: 0, monthly_target: 0, fixed_costs_monthly: 0 })
        .eq("business_id", b)
        .select("business_id")
        .single();
      if (error) throw error;
    }
    const { error } = await client
      .from("businesses")
      .update({ opening_cash: 0 })
      .eq("id", b)
      .select("id")
      .single();
    if (error) throw error;
    const fresh = await resetPreview(client, b);
    if (
      RESET_TABLES.some(([table]) => fresh.records[table].length) ||
      Number(fresh.business.opening_cash) !== 0 ||
      ["daily_target", "monthly_target", "fixed_costs_monthly"].some(
        (k) => Number(fresh.goals?.[k] ?? 0) !== 0,
      )
    )
      throw Error("Ο τελικός έλεγχος δεν επιβεβαίωσε πλήρη μηδενισμό.");
    return fresh;
  } catch (e) {
    throw Error(
      "Ο μηδενισμός σταμάτησε. Ολοκληρώθηκαν: " +
        (completed.join(", ") || "κανένα βήμα") +
        ". " +
        (e.message || "Αποτυχία σύνδεσης."),
    );
  }
}
