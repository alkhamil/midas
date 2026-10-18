CREATE TABLE "builder_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"file_id" text NOT NULL,
	"library_id" text,
	"library_version" text,
	"config" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_file_id_design_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."design_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_projects" ADD CONSTRAINT "builder_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "builder_projects_workspace_idx" ON "builder_projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "builder_projects_file_idx" ON "builder_projects" USING btree ("file_id");