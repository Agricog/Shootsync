-- 0008_deletion_warnings
--
-- A record of every email warning that a syndicate's records are about to be deleted
-- (server/deletionWarnings.ts). The captain is emailed 30, 7 and 1 day before the deletion date
-- the retention job works to (90 days after the plan ended). One row per warning, so none is ever
-- sent twice, however often the hourly job runs or however many servers overlap during a deploy.
-- A plan started and ended again gives a new deletion date, and so a fresh set of warnings.
--
-- Each warning is claimed first ('pending'), then sent, then marked 'sent'. The email is never sent
-- inside a database transaction, so a send can't be undone by a rollback. A claim left 'pending'
-- (a server stopped mid-send) is taken again after a few minutes and sent with the same
-- idempotency key, so Resend sends it once. 'no_email': the captain's account had no address
-- (the owner is alerted). 'superseded': never confirmed, and a more urgent warning has replaced it.
--
-- No personal data: which syndicate, which deletion date, which warning, when, and whether it went.
-- The captain's address is looked up from the sign-in service at the moment of sending and never kept.
-- The rows go with the syndicate.
--
-- For the running code: a new table it never reads. One transaction.
--
-- Production: paste into the Neon SQL editor (ShootSync, production) and run. Receipt: then run
--   SELECT "id", "applied_at" FROM "schema_migrations" ORDER BY "id";
-- which ends with 0008_deletion_warnings. Then upload the code.

BEGIN;

CREATE TABLE "deletion_warnings" (
    "id" TEXT NOT NULL,
    "syndicate_id" TEXT NOT NULL,
    "deletion_due_at" TIMESTAMP(3) NOT NULL,
    "days_before" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "deletion_warnings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deletion_warnings_syndicate_id_deletion_due_at_days_before_key" ON "deletion_warnings"("syndicate_id", "deletion_due_at", "days_before");

ALTER TABLE "deletion_warnings" ADD CONSTRAINT "deletion_warnings_syndicate_id_fkey" FOREIGN KEY ("syndicate_id") REFERENCES "syndicates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deletion_warnings" ADD CONSTRAINT "deletion_warnings_days_before_check" CHECK ("days_before" IN (1, 7, 30));
ALTER TABLE "deletion_warnings" ADD CONSTRAINT "deletion_warnings_outcome_check" CHECK ("outcome" IN ('pending', 'sent', 'no_email', 'superseded'));
ALTER TABLE "deletion_warnings" ADD CONSTRAINT "deletion_warnings_sent_at_check" CHECK (("outcome" = 'sent') = ("sent_at" IS NOT NULL));

INSERT INTO "schema_migrations" ("id") VALUES ('0008_deletion_warnings');

COMMIT;
