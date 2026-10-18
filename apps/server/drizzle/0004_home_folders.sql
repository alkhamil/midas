CREATE TABLE "design_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_files" ADD COLUMN "folder_id" text;--> statement-breakpoint
ALTER TABLE "design_files" ADD COLUMN "starred" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "design_files" ADD COLUMN "hidden_recent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "design_folders" ADD CONSTRAINT "design_folders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "design_folders_workspace_idx" ON "design_folders" USING btree ("workspace_id");