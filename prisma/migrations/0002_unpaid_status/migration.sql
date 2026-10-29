-- 0002_unpaid_status
--
-- Stripe's "unpaid" (it has stopped retrying a failed payment) gets its own status. Until now it
-- was recorded as PAST_DUE, which from this release still counts as paid up while Stripe retries
-- the card. Additive only: the code running before this release never reads or writes UNPAID.
--
-- Production: paste into the Neon SQL editor (ShootSync, production) and run. Receipt: then run
--   SELECT "id", "applied_at" FROM "schema_migrations" ORDER BY "id";
-- which lists 0001_baseline and 0002_unpaid_status. Then upload the code that needs it.

ALTER TYPE "StripeSubscriptionStatus" ADD VALUE IF NOT EXISTS 'UNPAID';

INSERT INTO "schema_migrations" ("id") VALUES ('0002_unpaid_status');
