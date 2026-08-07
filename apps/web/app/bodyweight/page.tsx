import { desc } from "drizzle-orm";
import { db } from "../../db/client";
import { bodyweightEntries } from "../../db/schema";
import { addBodyweightEntry, deleteBodyweightEntry } from "./actions";

// Same reasoning as app/programs/page.tsx — not statically prerenderable.
export const dynamic = "force-dynamic";

export default async function BodyweightPage() {
  const entries = await db
    .select()
    .from(bodyweightEntries)
    .orderBy(desc(bodyweightEntries.entryDate));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "sans-serif",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Bodyweight</h1>

      <form
        action={addBodyweightEntry}
        style={{ display: "flex", gap: 8, marginBottom: 20 }}
      >
        <input
          type="date"
          name="entryDate"
          defaultValue={today}
          required
          style={{ padding: "6px 8px", border: "1px solid #ccc" }}
        />
        <input
          type="number"
          name="weightKg"
          step="0.1"
          placeholder="kg"
          required
          style={{ padding: "6px 8px", border: "1px solid #ccc", width: 90 }}
        />
        <button type="submit" style={btnStyle}>
          + Add
        </button>
      </form>

      {entries.length === 0 ? (
        <p style={{ color: "#999", fontSize: 14 }}>No entries yet.</p>
      ) : (
        <ul style={{ listStyle: "none" }}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                marginBottom: 6,
                fontSize: 14,
              }}
            >
              <span>{entry.entryDate}</span>
              <span style={{ fontWeight: 600 }}>{entry.weightKg} kg</span>
              <form action={deleteBodyweightEntry.bind(null, entry.id)}>
                <button
                  type="submit"
                  style={{
                    fontSize: 11,
                    color: "#dc2626",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const btnStyle = {
  padding: "6px 12px",
  fontSize: 12,
  borderRadius: 5,
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};
