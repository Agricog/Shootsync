-- 0007_day_rates_in_pence
--
-- Two changes:
--   1. Beaters' day rates in pence. A day rate of £42.50 could not be recorded: beaters.day_rate,
--      beater_bookings.day_rate and syndicates.default_beater_rate are whole pounds. Each gets a
--      pence column beside it, filled from the pounds (day_rate_pence, default_beater_rate_pence),
--      with the same floor of £0 the pounds have. The new code reads and writes only the pence.
--      The pounds columns stay for now, kept in step by a trigger on each table, so the code
--      running during the deploy (which still reads pounds) sees true figures and a rate it saves
--      is not lost. A later migration drops the pounds columns and the triggers once nothing
--      reads them. A rollback to code before this migration loses nothing, but once a rate with
--      pence in it has been saved (£42.50 is kept as 43 in the pounds column) that code would
--      pay from the rounded pound: roll forward instead (runbook).
--      The trigger bodies are each on one line because tests/migrations.test.ts splits a file at
--      a semicolon that ends a line.
--   2. Guest invitation links are stored hashed. guest_guns.invite_token held the 64-character
--      token from each guest's link as it is. Anyone who could read the table could open every
--      guest's page. From now on it holds the SHA-256 of the token, like a password: the link
--      itself is shown to the captain when it is made (or renewed) and never stored. Existing
--      tokens are hashed in place, so every link already sent still works.
--
-- For the running code: nothing it reads is renamed or dropped. Until the new code takes over:
-- a guest link opened in that window is answered "invalid or expired" (the old code looks the
-- token up as it is) and works again as soon as the new code is serving; "Copy invite link" on
-- the old shoot day page copies the hash, which opens nothing; and a guest added in the window
-- gets a link the new code can't match (the captain makes them a new one with "Invite link…").
-- Run it at a quiet hour. One transaction.
--
-- Production: paste into the Neon SQL editor (ShootSync, production) and run. Receipt: then run
--   SELECT "id", "applied_at" FROM "schema_migrations" ORDER BY "id";
-- which ends with 0007_day_rates_in_pence. Then upload the code.

BEGIN;

-- 1. Day rates in pence -------------------------------------------------------------------

ALTER TABLE "beaters" ADD COLUMN "day_rate_pence" INTEGER NOT NULL DEFAULT 4000;
UPDATE "beaters" SET "day_rate_pence" = "day_rate" * 100;
ALTER TABLE "beaters" ADD CONSTRAINT "beaters_day_rate_pence_check" CHECK ("day_rate_pence" >= 0);

ALTER TABLE "beater_bookings" ADD COLUMN "day_rate_pence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "beater_bookings" ALTER COLUMN "day_rate" SET DEFAULT 0;
UPDATE "beater_bookings" SET "day_rate_pence" = "day_rate" * 100;
ALTER TABLE "beater_bookings" ADD CONSTRAINT "beater_bookings_day_rate_pence_check" CHECK ("day_rate_pence" >= 0);

ALTER TABLE "syndicates" ADD COLUMN "default_beater_rate_pence" INTEGER NOT NULL DEFAULT 4000;
UPDATE "syndicates" SET "default_beater_rate_pence" = "default_beater_rate" * 100;
ALTER TABLE "syndicates" ADD CONSTRAINT "syndicates_default_beater_rate_pence_check" CHECK ("default_beater_rate_pence" >= 0);

-- Pounds and pence kept in step, whichever one a write sets. On an insert, a row that sets the
-- pounds but leaves the pence at the column default came from code that knows only pounds; any
-- other insert is taken from the pence. On an update, the pence win if they changed; otherwise a
-- change to the pounds is carried into the pence. The new code only ever writes the pence.
CREATE FUNCTION "beaters_day_rate_sync"() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN IF TG_OP = ''INSERT'' THEN IF NEW."day_rate_pence" = 4000 AND NEW."day_rate" <> 40 THEN NEW."day_rate_pence" := NEW."day_rate" * 100; ELSE NEW."day_rate" := round(NEW."day_rate_pence" / 100.0); END IF; ELSIF NEW."day_rate_pence" IS DISTINCT FROM OLD."day_rate_pence" THEN NEW."day_rate" := round(NEW."day_rate_pence" / 100.0); ELSIF NEW."day_rate" IS DISTINCT FROM OLD."day_rate" THEN NEW."day_rate_pence" := NEW."day_rate" * 100; END IF; RETURN NEW; END';
CREATE TRIGGER "beaters_day_rate_sync" BEFORE INSERT OR UPDATE ON "beaters" FOR EACH ROW EXECUTE FUNCTION "beaters_day_rate_sync"();

CREATE FUNCTION "beater_bookings_day_rate_sync"() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN IF TG_OP = ''INSERT'' THEN IF NEW."day_rate_pence" = 0 AND NEW."day_rate" <> 0 THEN NEW."day_rate_pence" := NEW."day_rate" * 100; ELSE NEW."day_rate" := round(NEW."day_rate_pence" / 100.0); END IF; ELSIF NEW."day_rate_pence" IS DISTINCT FROM OLD."day_rate_pence" THEN NEW."day_rate" := round(NEW."day_rate_pence" / 100.0); ELSIF NEW."day_rate" IS DISTINCT FROM OLD."day_rate" THEN NEW."day_rate_pence" := NEW."day_rate" * 100; END IF; RETURN NEW; END';
CREATE TRIGGER "beater_bookings_day_rate_sync" BEFORE INSERT OR UPDATE ON "beater_bookings" FOR EACH ROW EXECUTE FUNCTION "beater_bookings_day_rate_sync"();

CREATE FUNCTION "syndicates_default_beater_rate_sync"() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN IF TG_OP = ''INSERT'' THEN IF NEW."default_beater_rate_pence" = 4000 AND NEW."default_beater_rate" <> 40 THEN NEW."default_beater_rate_pence" := NEW."default_beater_rate" * 100; ELSE NEW."default_beater_rate" := round(NEW."default_beater_rate_pence" / 100.0); END IF; ELSIF NEW."default_beater_rate_pence" IS DISTINCT FROM OLD."default_beater_rate_pence" THEN NEW."default_beater_rate" := round(NEW."default_beater_rate_pence" / 100.0); ELSIF NEW."default_beater_rate" IS DISTINCT FROM OLD."default_beater_rate" THEN NEW."default_beater_rate_pence" := NEW."default_beater_rate" * 100; END IF; RETURN NEW; END';
CREATE TRIGGER "syndicates_default_beater_rate_sync" BEFORE INSERT OR UPDATE ON "syndicates" FOR EACH ROW EXECUTE FUNCTION "syndicates_default_beater_rate_sync"();

-- 2. Guest invitation links stored hashed --------------------------------------------------

UPDATE "guest_guns" SET "invite_token" = encode(sha256(convert_to("invite_token", 'UTF8')), 'hex') WHERE "invite_token" IS NOT NULL;

INSERT INTO "schema_migrations" ("id") VALUES ('0007_day_rates_in_pence');

COMMIT;
