CREATE TABLE "bodyweight_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_date" date NOT NULL,
	"weight_kg" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_in_day" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_template_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"scheme_type" text NOT NULL,
	"scheme_config" jsonb NOT NULL,
	"scheme_state" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_bodyweight_based" boolean DEFAULT false NOT NULL,
	"tracks_1rm" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logged_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"exercise_in_day_id" uuid,
	"set_number" integer NOT NULL,
	"reps_achieved" integer,
	"actual_weight_kg" numeric(6, 2),
	"rpe" numeric(3, 1),
	"counts_toward_1rm" boolean DEFAULT false NOT NULL,
	"is_done" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "one_rm_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"estimated_1rm_kg" numeric(6, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"next_day_position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_template_id" uuid NOT NULL,
	"session_date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "day_templates" ADD CONSTRAINT "day_templates_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_in_day" ADD CONSTRAINT "exercise_in_day_day_template_id_day_templates_id_fk" FOREIGN KEY ("day_template_id") REFERENCES "public"."day_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_in_day" ADD CONSTRAINT "exercise_in_day_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logged_sets" ADD CONSTRAINT "logged_sets_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logged_sets" ADD CONSTRAINT "logged_sets_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logged_sets" ADD CONSTRAINT "logged_sets_exercise_in_day_id_exercise_in_day_id_fk" FOREIGN KEY ("exercise_in_day_id") REFERENCES "public"."exercise_in_day"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_rm_estimates" ADD CONSTRAINT "one_rm_estimates_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_rm_estimates" ADD CONSTRAINT "one_rm_estimates_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_day_template_id_day_templates_id_fk" FOREIGN KEY ("day_template_id") REFERENCES "public"."day_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_program" ON "programs" USING btree ("is_active") WHERE "programs"."is_active" = true;