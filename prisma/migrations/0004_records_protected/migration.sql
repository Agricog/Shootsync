-- 0004_records_protected
--
-- The database itself now guarantees what the code already tried to:
--   - a signed guest acknowledgement, a bag record and money owed or paid can never be wiped by
--     deleting a shoot day, a member or a beater (RESTRICT instead of CASCADE);
--   - a beater can never have two payment records for one day (unique);
--   - no amount, count, fee or rate can be negative, a season can't end before it starts, and a
--     peg is 1 to 100 (CHECK constraints);
--   - every lookup the app makes has an index;
--   - a guest's day fee defaults to £50, not 50p;
--   - which acknowledgement text a guest accepted is recorded (version and hash), and a syndicate
--     can add its own clauses.
--
-- For the code running during the upload: nothing it reads is renamed or dropped, and a guest's
-- fee was already set explicitly. Its "delete shoot day" would meet a RESTRICT rule and answer
-- with a 500 rather than a 409 until the new code is up; the new code checks first.
--
-- One transaction: it all applies or none of it does, so a refused row (see below) leaves the
-- database exactly as it was and the file can simply be run again once the row is put right.
--
-- Production: first run the pre-flight in the runbook (rows the CHECKs below would refuse), then
-- paste this file into the Neon SQL editor (ShootSync, production) and run. Receipt: then run
--   SELECT "id", "applied_at" FROM "schema_migrations" ORDER BY "id";
-- which ends with 0004_records_protected. Then upload the code.

BEGIN;

-- DropForeignKey
ALTER TABLE "guest_guns" DROP CONSTRAINT "guest_guns_shoot_id_fkey";

-- DropForeignKey
ALTER TABLE "guest_guns" DROP CONSTRAINT "guest_guns_invited_by_member_id_fkey";

-- DropForeignKey
ALTER TABLE "bag_records" DROP CONSTRAINT "bag_records_shoot_id_fkey";

-- DropForeignKey
ALTER TABLE "beater_payments" DROP CONSTRAINT "beater_payments_beater_id_fkey";

-- DropForeignKey
ALTER TABLE "beater_payments" DROP CONSTRAINT "beater_payments_shoot_id_fkey";

-- DropForeignKey
ALTER TABLE "member_payments" DROP CONSTRAINT "member_payments_member_id_fkey";

-- AlterTable
ALTER TABLE "syndicates" ADD COLUMN     "waiver_extra" TEXT;

-- AlterTable
ALTER TABLE "guest_guns" ADD COLUMN     "waiver_text_hash" TEXT,
ADD COLUMN     "waiver_version" TEXT,
ALTER COLUMN "day_fee" SET DEFAULT 5000;

-- CreateIndex
CREATE INDEX "syndicates_captain_clerk_id_idx" ON "syndicates"("captain_clerk_id");

-- CreateIndex
CREATE INDEX "members_clerk_user_id_idx" ON "members"("clerk_user_id");

-- CreateIndex
CREATE INDEX "members_syndicate_id_status_idx" ON "members"("syndicate_id", "status");

-- CreateIndex
CREATE INDEX "beaters_syndicate_id_status_idx" ON "beaters"("syndicate_id", "status");

-- CreateIndex
CREATE INDEX "shoot_days_syndicate_id_date_idx" ON "shoot_days"("syndicate_id", "date");

-- CreateIndex
CREATE INDEX "shoot_attendances_member_id_idx" ON "shoot_attendances"("member_id");

-- CreateIndex
CREATE INDEX "guest_guns_shoot_id_idx" ON "guest_guns"("shoot_id");

-- CreateIndex
CREATE INDEX "guest_guns_invited_by_member_id_idx" ON "guest_guns"("invited_by_member_id");

-- CreateIndex
CREATE INDEX "bag_records_shoot_id_idx" ON "bag_records"("shoot_id");

-- CreateIndex
CREATE INDEX "bag_records_recorded_by_member_id_idx" ON "bag_records"("recorded_by_member_id");

-- CreateIndex
CREATE INDEX "beater_payments_syndicate_id_status_idx" ON "beater_payments"("syndicate_id", "status");

-- CreateIndex
CREATE INDEX "beater_payments_shoot_id_idx" ON "beater_payments"("shoot_id");

-- CreateIndex
CREATE UNIQUE INDEX "beater_payments_beater_id_shoot_id_key" ON "beater_payments"("beater_id", "shoot_id");

-- CreateIndex
CREATE INDEX "member_payments_syndicate_id_status_idx" ON "member_payments"("syndicate_id", "status");

-- CreateIndex
CREATE INDEX "member_payments_member_id_idx" ON "member_payments"("member_id");

-- CreateIndex
CREATE INDEX "beater_bookings_shoot_id_idx" ON "beater_bookings"("shoot_id");

-- CreateIndex
CREATE INDEX "beater_bookings_syndicate_id_idx" ON "beater_bookings"("syndicate_id");

-- CreateIndex
CREATE INDEX "activity_logs_syndicate_id_timestamp_idx" ON "activity_logs"("syndicate_id", "timestamp");

-- AddForeignKey
ALTER TABLE "guest_guns" ADD CONSTRAINT "guest_guns_shoot_id_fkey" FOREIGN KEY ("shoot_id") REFERENCES "shoot_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_guns" ADD CONSTRAINT "guest_guns_invited_by_member_id_fkey" FOREIGN KEY ("invited_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bag_records" ADD CONSTRAINT "bag_records_shoot_id_fkey" FOREIGN KEY ("shoot_id") REFERENCES "shoot_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beater_payments" ADD CONSTRAINT "beater_payments_beater_id_fkey" FOREIGN KEY ("beater_id") REFERENCES "beaters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beater_payments" ADD CONSTRAINT "beater_payments_shoot_id_fkey" FOREIGN KEY ("shoot_id") REFERENCES "shoot_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks: Prisma can't express these, so they live here and in tests/migrations.test.ts.
ALTER TABLE "syndicates" ADD CONSTRAINT "syndicates_season_check" CHECK ("season_end" > "season_start");
ALTER TABLE "syndicates" ADD CONSTRAINT "syndicates_amounts_check" CHECK ("subscription_amount" >= 0 AND "default_beater_rate" >= 0);
ALTER TABLE "beaters" ADD CONSTRAINT "beaters_day_rate_check" CHECK ("day_rate" >= 0);
ALTER TABLE "beater_bookings" ADD CONSTRAINT "beater_bookings_day_rate_check" CHECK ("day_rate" >= 0);
ALTER TABLE "beater_payments" ADD CONSTRAINT "beater_payments_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "guest_guns" ADD CONSTRAINT "guest_guns_day_fee_check" CHECK ("day_fee" >= 0);
ALTER TABLE "guest_guns" ADD CONSTRAINT "guest_guns_peg_number_check" CHECK ("peg_number" IS NULL OR ("peg_number" >= 1 AND "peg_number" <= 100));
ALTER TABLE "shoot_attendances" ADD CONSTRAINT "shoot_attendances_peg_number_check" CHECK ("peg_number" IS NULL OR ("peg_number" >= 1 AND "peg_number" <= 100));
ALTER TABLE "bag_records" ADD CONSTRAINT "bag_records_counts_check" CHECK ("pheasant" >= 0 AND "partridge" >= 0 AND "duck" >= 0 AND "woodcock" >= 0 AND "other" >= 0 AND "drive_number" >= 1);
ALTER TABLE "shoot_days" ADD CONSTRAINT "shoot_days_drives_check" CHECK ("drives_planned" >= 0 AND ("expected_bag" IS NULL OR "expected_bag" >= 0));

INSERT INTO "schema_migrations" ("id") VALUES ('0004_records_protected');

COMMIT;
