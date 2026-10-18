ALTER TABLE "component_mappings" ADD COLUMN "code_detail" text;--> statement-breakpoint
ALTER TABLE "library_versions" ADD COLUMN "code_reported_at" timestamp with time zone;