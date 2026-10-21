CREATE TABLE "user_file_access" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	CONSTRAINT "user_file_access_user_id_kind_target_id_pk" PRIMARY KEY("user_id","kind","target_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'editor' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_mode" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_file_access" ADD CONSTRAINT "user_file_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;