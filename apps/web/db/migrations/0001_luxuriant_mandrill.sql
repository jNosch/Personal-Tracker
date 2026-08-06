ALTER TABLE "logged_sets" ALTER COLUMN "exercise_in_day_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "day_templates" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_in_day" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "day_template_position_per_program" ON "day_templates" USING btree ("program_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_position_per_day_template" ON "exercise_in_day" USING btree ("day_template_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "set_number_per_session_exercise" ON "logged_sets" USING btree ("session_id","exercise_id","set_number");--> statement-breakpoint
CREATE UNIQUE INDEX "one_estimate_per_exercise_session" ON "one_rm_estimates" USING btree ("exercise_id","session_id");