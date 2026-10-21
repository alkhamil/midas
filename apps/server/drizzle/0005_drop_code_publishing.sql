ALTER TABLE "builder_projects" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "component_mappings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "builder_projects" CASCADE;--> statement-breakpoint
DROP TABLE "component_mappings" CASCADE;--> statement-breakpoint
ALTER TABLE "libraries" DROP CONSTRAINT "libraries_package_name_unique";--> statement-breakpoint
DROP INDEX "library_versions_version_idx";--> statement-breakpoint
ALTER TABLE "libraries" DROP COLUMN "package_name";--> statement-breakpoint
ALTER TABLE "library_versions" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "library_versions" DROP COLUMN "manifest";--> statement-breakpoint
ALTER TABLE "library_versions" DROP COLUMN "code_status";--> statement-breakpoint
ALTER TABLE "library_versions" DROP COLUMN "bundle_url";--> statement-breakpoint
ALTER TABLE "library_versions" DROP COLUMN "code_reported_at";--> statement-breakpoint
DELETE FROM "sessions" WHERE "id" LIKE 'mdt\_%' ESCAPE '\';
