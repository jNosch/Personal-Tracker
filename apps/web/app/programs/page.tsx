// Programs list (#24). No design system exists yet (theming lands separately
// in #32) — plain inline styles, matching the prototype/program-builder
// reference rather than inventing one here.
import { asc, desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "../../db/client";
import { programs } from "../../db/schema";
import { createProgram } from "./actions";

// Not statically prerenderable: this is a single-user, DB-backed page with
// no meaningful build-time snapshot — a stale prerender would show wrong
// data, and static prerendering also means `next build` tries to actually
// query the DB (breaking CI's build job, which only has a dummy
// DATABASE_URL — see docs/engineering/ci.md).
export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const allPrograms = await db
    .select()
    .from(programs)
    .orderBy(
      desc(programs.isActive),
      asc(programs.isArchived),
      asc(programs.name),
    );

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "sans-serif",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 20 }}>Programs</h1>
        <form action={createProgram}>
          <button type="submit" style={btnStyle}>
            + New Program
          </button>
        </form>
      </div>

      {allPrograms.length === 0 ? (
        <p style={{ color: "#999", fontSize: 14 }}>No programs yet.</p>
      ) : (
        <ul style={{ listStyle: "none" }}>
          {allPrograms.map((program) => (
            <li key={program.id} style={{ marginBottom: 8 }}>
              <Link
                href={`/programs/${program.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  opacity: program.isArchived ? 0.5 : 1,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <span>{program.name}</span>
                <span style={{ fontSize: 12, color: "#999", fontWeight: 400 }}>
                  {program.isActive
                    ? "active"
                    : program.isArchived
                      ? "archived"
                      : "inactive"}
                </span>
              </Link>
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
