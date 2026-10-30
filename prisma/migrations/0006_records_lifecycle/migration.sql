-- 0006_records_lifecycle
--
-- Bank details sealed, every change recorded, and the clocks the retention policy runs on
-- (claude/retention-policy-2026-10-30.md):
--   - beaters: the sealed sort code and account number (server/bankCrypto.ts), the last four
--     digits shown in their place, and when they left; the readable columns stay until the new
--     code has sealed every row at boot and cleared them, and go in a later migration;
--   - members: when they left;
--   - syndicates: when the plan ended, which starts the 90-day clock to deletion;
--   - activity_logs: the action is free text (the route's own name for it), the actor is the
--     signed-in user's ID whatever their role, no IP address is kept, and an entry can't be
--     changed once written: only the retention job may remove one, when its time is up.
--
-- For the running code: it never reads or writes activity_logs, and nothing it reads is renamed
-- or dropped. One transaction.
--
-- Production: paste into the Neon SQL editor (ShootSync, production) and run. Receipt: then run
--   SELECT "id", "applied_at" FROM "schema_migrations" ORDER BY "id";
-- which ends with 0006_records_lifecycle. Then upload the code.

BEGIN;

ALTER TABLE "beaters" ADD COLUMN "bank_details_sealed" TEXT;
ALTER TABLE "beaters" ADD COLUMN "bank_account_last4" TEXT;
ALTER TABLE "beaters" ADD COLUMN "left_at" TIMESTAMP(3);
ALTER TABLE "members" ADD COLUMN "left_at" TIMESTAMP(3);
ALTER TABLE "syndicates" ADD COLUMN "plan_ended_at" TIMESTAMP(3);

ALTER TABLE "activity_logs" ALTER COLUMN "action" TYPE TEXT USING "action"::TEXT;
DROP TYPE "ActivityAction";
ALTER TABLE "activity_logs" DROP COLUMN "ip_address";
ALTER TABLE "activity_logs" ADD COLUMN "actor_user_id" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN "actor_role" TEXT;
CREATE INDEX "activity_logs_syndicate_id_target_id_idx" ON "activity_logs"("syndicate_id", "target_id");

-- An audit entry is never edited, and never removed early: only once it is over 6 years old (the
-- retention job), or with its whole syndicate (when the syndicate itself is deleted).
CREATE FUNCTION "activity_logs_no_update"() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''activity_logs entries cannot be changed''; END';
CREATE TRIGGER "activity_logs_no_update" BEFORE UPDATE ON "activity_logs" FOR EACH ROW EXECUTE FUNCTION "activity_logs_no_update"();
CREATE FUNCTION "activity_logs_no_early_delete"() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN IF OLD."timestamp" < (now() AT TIME ZONE ''UTC'') - interval ''6 years'' OR NOT EXISTS (SELECT 1 FROM "syndicates" WHERE "id" = OLD."syndicate_id") THEN RETURN OLD; END IF; RAISE EXCEPTION ''activity_logs entries cannot be removed before their retention period ends''; END';
CREATE TRIGGER "activity_logs_no_early_delete" BEFORE DELETE ON "activity_logs" FOR EACH ROW EXECUTE FUNCTION "activity_logs_no_early_delete"();

-- Dates people type are real years: a season or shoot day between 2000 and 2100 (a season end in
-- the year 28 was found on 29 Oct 2026). The code refuses these too; this makes sure of it.
ALTER TABLE "syndicates" ADD CONSTRAINT "syndicates_season_years_check" CHECK ("season_start" >= '2000-01-01' AND "season_start" < '2101-01-01' AND "season_end" >= '2000-01-01' AND "season_end" < '2101-01-01');
ALTER TABLE "shoot_days" ADD CONSTRAINT "shoot_days_date_check" CHECK ("date" >= '2000-01-01' AND "date" < '2101-01-01');

-- Syndicates without a live plan when this runs had no deletion clock: theirs starts today, so
-- nobody is deleted for 90 days, and every captain sees the date in the app before then.
UPDATE "syndicates" SET "plan_ended_at" = CURRENT_TIMESTAMP
WHERE "stripe_subscription_status" IS NULL OR "stripe_subscription_status" IN ('CANCELLED', 'UNPAID', 'INCOMPLETE');

-- Members and beaters already inactive left before the clock existed: their clock starts today.
UPDATE "members" SET "left_at" = CURRENT_TIMESTAMP WHERE "status" = 'INACTIVE';
UPDATE "beaters" SET "left_at" = CURRENT_TIMESTAMP WHERE "status" = 'INACTIVE';

INSERT INTO "schema_migrations" ("id") VALUES ('0006_records_lifecycle');

COMMIT;
