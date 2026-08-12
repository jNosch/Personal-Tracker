// Database schema — Drizzle ORM, targeting Postgres.
//
// Every table here traces back to a resolved wayfinder decision on the
// "Lifting Tracker app — product & architecture spec" map (issue #1). See the
// reviewed ERD for the entity-by-entity rationale.
//
// scheme_type is plain text, not a pg enum: the scheme catalog already grew
// once organically mid-map (Failure Sets was added after the fact), and an
// enum would force a migration every time it grows again. The known set is
// enforced in application code instead (see SchemeType below).
//
// is_archived on programs/day_templates/exercise_in_day/exercises: nothing
// referenced by history is ever hard-deleted, only flagged archived — see
// ADR-0001. That's also why exercise_in_day_id below is NOT NULL: the row a
// logged set points at always still exists, archived or not.

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  date,
  numeric,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const exercises = pgTable("exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isBodyweightBased: boolean("is_bodyweight_based").notNull().default(false),
  tracksOneRm: boolean("tracks_1rm").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
});

export const programs = pgTable(
  "programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    // Rotation position: which day template comes next. Lives here (not
    // derived) so it survives untouched while a program is inactive —
    // reactivating resumes exactly where it left off (Program lifecycle, #9).
    // Saving a session always advances this to (the day template actually
    // logged's position + 1) mod day count — rotation follows whatever was
    // just logged, not a predetermined sequence.
    nextDayPosition: integer("next_day_position").notNull().default(0),
  },
  (t) => [
    // Enforces "exactly one active program" at the DB level, not just in
    // application code — a partial unique index on is_active = true.
    uniqueIndex("one_active_program")
      .on(t.isActive)
      .where(sql`${t.isActive} = true`),
  ],
);

export const dayTemplates = pgTable(
  "day_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id),
    label: text("label").notNull(),
    position: integer("position").notNull(),
    isArchived: boolean("is_archived").notNull().default(false),
  },
  (t) => [
    uniqueIndex("day_template_position_per_program").on(
      t.programId,
      t.position,
    ),
  ],
);

// The known scheme types, kept in sync with the four scheme-math tickets
// (#8, #16, #17, #18, #19). Not a DB enum — see file header.
export const SCHEME_TYPES = [
  "double_progression",
  "wave",
  "rep_accumulation",
  "topset_backoff",
  "failure_sets",
] as const;
export type SchemeType = (typeof SCHEME_TYPES)[number];

export const exerciseInDay = pgTable(
  "exercise_in_day",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dayTemplateId: uuid("day_template_id")
      .notNull()
      .references(() => dayTemplates.id),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    position: integer("position").notNull(),
    schemeType: text("scheme_type").notNull(),
    // Static, user-set parameters — shape depends on scheme_type (issue #8).
    schemeConfig: jsonb("scheme_config").notNull(),
    // Dynamic state the scheme's update() evolves after every session.
    schemeState: jsonb("scheme_state").notNull(),
    isArchived: boolean("is_archived").notNull().default(false),
  },
  (t) => [
    uniqueIndex("exercise_position_per_day_template").on(
      t.dayTemplateId,
      t.position,
    ),
  ],
);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  dayTemplateId: uuid("day_template_id")
    .notNull()
    .references(() => dayTemplates.id),
  sessionDate: date("session_date").notNull(),
});

export const loggedSets = pgTable(
  "logged_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    // Which exercise-in-day entry prescribed this set. NOT NULL: archive-only
    // (ADR-0001) means the referenced row is never actually gone, so every
    // logged set always has a valid link — no freestyle/unlinked exercises.
    exerciseInDayId: uuid("exercise_in_day_id")
      .notNull()
      .references(() => exerciseInDay.id),
    setNumber: integer("set_number").notNull(),
    // Nullable throughout: Failure Sets tracks neither weight nor reps at all.
    repsAchieved: integer("reps_achieved"),
    actualWeightKg: numeric("actual_weight_kg", { precision: 6, scale: 2 }),
    rpe: numeric("rpe", { precision: 3, scale: 1 }),
    // Stamped at log time from whatever the scheme designated that session
    // (AMRAP set, top set, or the reps-≤10 fallback) — never re-derived later.
    countsTowardOneRm: boolean("counts_toward_1rm").notNull().default(false),
    // Stamped at log time from PrescribedSet.countsTowardRpeSignal (#60) —
    // Wave's AMRAP set that week, else its heaviest main set. Drives both
    // RpeBox's Wave-row display and Wave's redStreak deload trigger. false
    // by default for every pre-#60 row and every non-Wave scheme.
    countsTowardRpeSignal: boolean("counts_toward_rpe_signal")
      .notNull()
      .default(false),
    // The only signal a Failure Sets set carries.
    isDone: boolean("is_done").notNull().default(true),
  },
  (t) => [
    uniqueIndex("set_number_per_session_exercise").on(
      t.sessionId,
      t.exerciseId,
      t.setNumber,
    ),
  ],
);

export const oneRmEstimates = pgTable(
  "one_rm_estimates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    // The highest estimate among that session's qualifying sets for this
    // exercise, computed once at session-save time — one row per
    // (exercise, session), not one row per qualifying set.
    estimatedOneRmKg: numeric("estimated_1rm_kg", {
      precision: 6,
      scale: 2,
    }).notNull(),
  },
  (t) => [
    uniqueIndex("one_estimate_per_exercise_session").on(
      t.exerciseId,
      t.sessionId,
    ),
  ],
);

export const bodyweightEntries = pgTable("bodyweight_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryDate: date("entry_date").notNull(),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2 }).notNull(),
});

// --- relations (for ergonomic query building; no schema impact) ---

export const programsRelations = relations(programs, ({ many }) => ({
  dayTemplates: many(dayTemplates),
}));

export const dayTemplatesRelations = relations(
  dayTemplates,
  ({ one, many }) => ({
    program: one(programs, {
      fields: [dayTemplates.programId],
      references: [programs.id],
    }),
    exercises: many(exerciseInDay),
    sessions: many(sessions),
  }),
);

export const exercisesRelations = relations(exercises, ({ many }) => ({
  exerciseInDay: many(exerciseInDay),
  loggedSets: many(loggedSets),
  oneRmEstimates: many(oneRmEstimates),
}));

export const exerciseInDayRelations = relations(
  exerciseInDay,
  ({ one, many }) => ({
    dayTemplate: one(dayTemplates, {
      fields: [exerciseInDay.dayTemplateId],
      references: [dayTemplates.id],
    }),
    exercise: one(exercises, {
      fields: [exerciseInDay.exerciseId],
      references: [exercises.id],
    }),
    loggedSets: many(loggedSets),
  }),
);

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  dayTemplate: one(dayTemplates, {
    fields: [sessions.dayTemplateId],
    references: [dayTemplates.id],
  }),
  loggedSets: many(loggedSets),
  oneRmEstimates: many(oneRmEstimates),
}));

export const loggedSetsRelations = relations(loggedSets, ({ one }) => ({
  session: one(sessions, {
    fields: [loggedSets.sessionId],
    references: [sessions.id],
  }),
  exercise: one(exercises, {
    fields: [loggedSets.exerciseId],
    references: [exercises.id],
  }),
  exerciseInDay: one(exerciseInDay, {
    fields: [loggedSets.exerciseInDayId],
    references: [exerciseInDay.id],
  }),
}));

export const oneRmEstimatesRelations = relations(oneRmEstimates, ({ one }) => ({
  exercise: one(exercises, {
    fields: [oneRmEstimates.exerciseId],
    references: [exercises.id],
  }),
  session: one(sessions, {
    fields: [oneRmEstimates.sessionId],
    references: [sessions.id],
  }),
}));
