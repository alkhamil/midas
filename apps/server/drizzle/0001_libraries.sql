CREATE TABLE "component_mappings" (
	"library_version_id" uuid NOT NULL,
	"component_key" text NOT NULL,
	"component_name" text NOT NULL,
	"export_name" text NOT NULL,
	"props_map" jsonb NOT NULL,
	"code_status" text DEFAULT 'not_implemented' NOT NULL,
	CONSTRAINT "component_mappings_library_version_id_component_key_pk" PRIMARY KEY("library_version_id","component_key")
);
--> statement-breakpoint
CREATE TABLE "file_libraries" (
	"file_id" text NOT NULL,
	"library_id" text NOT NULL,
	"seq" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_libraries_file_id_library_id_pk" PRIMARY KEY("file_id","library_id")
);
--> statement-breakpoint
CREATE TABLE "libraries" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"package_name" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "libraries_package_name_unique" UNIQUE("package_name")
);
--> statement-breakpoint
CREATE TABLE "library_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" text NOT NULL,
	"seq" integer NOT NULL,
	"version" text NOT NULL,
	"release_notes" text,
	"snapshot_key" text NOT NULL,
	"components_count" integer DEFAULT 0 NOT NULL,
	"variables_count" integer DEFAULT 0 NOT NULL,
	"manifest" jsonb,
	"design_status" text DEFAULT 'published' NOT NULL,
	"code_status" text DEFAULT 'pending' NOT NULL,
	"bundle_url" text,
	"published_by" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "component_mappings" ADD CONSTRAINT "component_mappings_library_version_id_library_versions_id_fk" FOREIGN KEY ("library_version_id") REFERENCES "public"."library_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_libraries" ADD CONSTRAINT "file_libraries_file_id_design_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."design_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_libraries" ADD CONSTRAINT "file_libraries_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_id_design_files_id_fk" FOREIGN KEY ("id") REFERENCES "public"."design_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_versions" ADD CONSTRAINT "library_versions_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_versions" ADD CONSTRAINT "library_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "library_versions_seq_idx" ON "library_versions" USING btree ("library_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "library_versions_version_idx" ON "library_versions" USING btree ("library_id","version");