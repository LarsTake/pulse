CREATE TABLE "bp_readings" (
	"user_id" integer NOT NULL,
	"id" text NOT NULL,
	"ts" bigint NOT NULL,
	"day" date NOT NULL,
	"systolic" smallint NOT NULL,
	"diastolic" smallint NOT NULL,
	"pulse" smallint,
	"created_at" bigint NOT NULL,
	CONSTRAINT "bp_readings_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "lab_results" (
	"user_id" integer NOT NULL,
	"id" text NOT NULL,
	"day" date NOT NULL,
	"marker" text NOT NULL,
	"value" double precision NOT NULL,
	"ref_low" double precision,
	"ref_high" double precision,
	"created_at" bigint NOT NULL,
	CONSTRAINT "lab_results_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "strength_sessions" (
	"user_id" integer NOT NULL,
	"id" text NOT NULL,
	"ts" bigint NOT NULL,
	"day" date NOT NULL,
	"duration_min" smallint,
	"exercises" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "strength_sessions_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "bp_readings" ADD CONSTRAINT "bp_readings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strength_sessions" ADD CONSTRAINT "strength_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bp_readings_ts" ON "bp_readings" USING btree ("user_id","ts");--> statement-breakpoint
CREATE INDEX "lab_results_marker" ON "lab_results" USING btree ("user_id","marker","day");--> statement-breakpoint
CREATE INDEX "strength_sessions_day" ON "strength_sessions" USING btree ("user_id","day");