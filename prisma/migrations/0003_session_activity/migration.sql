-- 0003_session_activity
--
-- When each signed-in session first and last used ShootSync, so the server itself can end a
-- session 15 minutes after it started and one left idle (Build Standard, Layer 2). One small row
-- per session; rows for sessions older than Clerk could still be using are cleared as new
-- sessions start. Additive only: the code running before this release never reads it.
--
-- Production: paste into the Neon SQL editor (ShootSync, production) and run. Receipt: then run
--   SELECT "id", "applied_at" FROM "schema_migrations" ORDER BY "id";
-- which lists 0001_baseline, 0002_unpaid_status and 0003_session_activity. Then upload the code.

CREATE TABLE "session_activity" (
    "session_id" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_activity_pkey" PRIMARY KEY ("session_id")
);

INSERT INTO "schema_migrations" ("id") VALUES ('0003_session_activity');
