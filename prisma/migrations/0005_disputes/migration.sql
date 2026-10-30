-- 0005_disputes
--
-- When a syndicate's card payment is disputed with the card issuer (a chargeback), the moment it
-- was opened is recorded here. While it is set the syndicate is read-only, whatever Stripe says
-- the subscription's status is, until a payment arrives (server/access.ts planAccess).
--
-- When a card first fails (the subscription becomes past due) that moment is recorded too: the
-- syndicate keeps full use for 14 days from it, then is read-only until a payment arrives.
--
-- A guest's acceptance now keeps the exact words accepted, not only their hash, so they can be
-- read back after a syndicate changes its own clauses.
--
-- Additive: the running code never reads it. One transaction.
--
-- Production: paste into the Neon SQL editor (ShootSync, production) and run. Receipt: then run
--   SELECT "id", "applied_at" FROM "schema_migrations" ORDER BY "id";
-- which ends with 0005_disputes. Then upload the code.

BEGIN;

ALTER TABLE "syndicates" ADD COLUMN "dispute_opened_at" TIMESTAMP(3);
ALTER TABLE "syndicates" ADD COLUMN "past_due_since" TIMESTAMP(3);
ALTER TABLE "guest_guns" ADD COLUMN "waiver_text" TEXT;

INSERT INTO "schema_migrations" ("id") VALUES ('0005_disputes');

COMMIT;
