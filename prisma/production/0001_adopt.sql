-- ShootSync production: adopt migration 0001_baseline.
--
-- The live database was built before ShootSync had migrations. This script checks that it is
-- exactly the schema in prisma/migrations/0001_baseline, and only then records 0001 as applied,
-- so every later migration starts from a known state (Build Standard 9.3, 9.4, 9.8).
--
-- HOW: paste the whole file into the Neon SQL editor for the ShootSync database and run it.
--   Success: the notice "Adopted 0001_baseline: the live schema matched all 218 expected
--   entries", then one row: 0001_baseline and today's time. Both, or it did not run.
--   Anything different on the live database: it stops with a list of every difference and
--   changes nothing at all. Send that list to Claude; nothing needs undoing.
--   Run twice: the second run stops ("already adopted") and changes nothing.
--   Restored Neon to a time before this ran? schema_migrations goes with it: run this again.
--
-- The expected list below is generated from the baseline; tests/migrations.test.ts fails if it
-- ever stops matching a database built from the migrations, and runs this script for real.

DO $adopt$
DECLARE
  differences text;
  checked integer;
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    RAISE EXCEPTION 'schema_migrations already exists, so 0001_baseline has been adopted before. Nothing was changed.';
  END IF;

  WITH expected(kind, name, detail) AS (VALUES
      ('column', 'activity_logs.action', 'USER-DEFINED null=NO default= udt=ActivityAction'),
      ('column', 'activity_logs.actor_member_id', 'text null=YES default= udt=text'),
      ('column', 'activity_logs.details', 'jsonb null=YES default= udt=jsonb'),
      ('column', 'activity_logs.id', 'text null=NO default= udt=text'),
      ('column', 'activity_logs.ip_address', 'text null=YES default= udt=text'),
      ('column', 'activity_logs.syndicate_id', 'text null=NO default= udt=text'),
      ('column', 'activity_logs.target_id', 'text null=YES default= udt=text'),
      ('column', 'activity_logs.target_type', 'text null=YES default= udt=text'),
      ('column', 'activity_logs.timestamp', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'bag_records.created_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'bag_records.drive_number', 'integer null=NO default= udt=int4'),
      ('column', 'bag_records.duck', 'integer null=NO default=0 udt=int4'),
      ('column', 'bag_records.id', 'text null=NO default= udt=text'),
      ('column', 'bag_records.notes', 'text null=YES default= udt=text'),
      ('column', 'bag_records.other', 'integer null=NO default=0 udt=int4'),
      ('column', 'bag_records.other_description', 'text null=YES default= udt=text'),
      ('column', 'bag_records.partridge', 'integer null=NO default=0 udt=int4'),
      ('column', 'bag_records.pheasant', 'integer null=NO default=0 udt=int4'),
      ('column', 'bag_records.recorded_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'bag_records.recorded_by_member_id', 'text null=YES default= udt=text'),
      ('column', 'bag_records.shoot_id', 'text null=NO default= udt=text'),
      ('column', 'bag_records.updated_at', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'bag_records.woodcock', 'integer null=NO default=0 udt=int4'),
      ('column', 'beater_bookings.beater_id', 'text null=NO default= udt=text'),
      ('column', 'beater_bookings.checked_in', 'boolean null=NO default=false udt=bool'),
      ('column', 'beater_bookings.checked_in_at', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'beater_bookings.confirmed_at', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'beater_bookings.created_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'beater_bookings.day_rate', 'integer null=NO default= udt=int4'),
      ('column', 'beater_bookings.id', 'text null=NO default= udt=text'),
      ('column', 'beater_bookings.invited_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'beater_bookings.notes', 'text null=YES default= udt=text'),
      ('column', 'beater_bookings.payment_status', 'USER-DEFINED null=NO default=''PENDING''::"PaymentStatus" udt=PaymentStatus'),
      ('column', 'beater_bookings.shoot_id', 'text null=NO default= udt=text'),
      ('column', 'beater_bookings.status', 'USER-DEFINED null=NO default=''INVITED''::"BookingStatus" udt=BookingStatus'),
      ('column', 'beater_bookings.syndicate_id', 'text null=NO default= udt=text'),
      ('column', 'beater_bookings.updated_at', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'beater_payments.amount', 'integer null=NO default= udt=int4'),
      ('column', 'beater_payments.beater_id', 'text null=NO default= udt=text'),
      ('column', 'beater_payments.created_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'beater_payments.id', 'text null=NO default= udt=text'),
      ('column', 'beater_payments.notes', 'text null=YES default= udt=text'),
      ('column', 'beater_payments.paid_date', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'beater_payments.payment_reference', 'text null=YES default= udt=text'),
      ('column', 'beater_payments.shoot_id', 'text null=NO default= udt=text'),
      ('column', 'beater_payments.status', 'USER-DEFINED null=NO default=''PENDING''::"PaymentStatus" udt=PaymentStatus'),
      ('column', 'beater_payments.syndicate_id', 'text null=NO default= udt=text'),
      ('column', 'beater_payments.updated_at', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'beaters.bank_account_number', 'text null=YES default= udt=text'),
      ('column', 'beaters.bank_name', 'text null=YES default= udt=text'),
      ('column', 'beaters.bank_sort_code', 'text null=YES default= udt=text'),
      ('column', 'beaters.created_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'beaters.day_rate', 'integer null=NO default=40 udt=int4'),
      ('column', 'beaters.email', 'text null=YES default= udt=text'),
      ('column', 'beaters.id', 'text null=NO default= udt=text'),
      ('column', 'beaters.name', 'text null=NO default= udt=text'),
      ('column', 'beaters.notes', 'text null=YES default= udt=text'),
      ('column', 'beaters.phone', 'text null=YES default= udt=text'),
      ('column', 'beaters.status', 'USER-DEFINED null=NO default=''ACTIVE''::"BeaterStatus" udt=BeaterStatus'),
      ('column', 'beaters.syndicate_id', 'text null=NO default= udt=text'),
      ('column', 'beaters.updated_at', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'guest_guns.created_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'guest_guns.day_fee', 'integer null=NO default=50 udt=int4'),
      ('column', 'guest_guns.email', 'text null=NO default= udt=text'),
      ('column', 'guest_guns.emergency_contact_name', 'text null=YES default= udt=text'),
      ('column', 'guest_guns.emergency_contact_phone', 'text null=YES default= udt=text'),
      ('column', 'guest_guns.id', 'text null=NO default= udt=text'),
      ('column', 'guest_guns.invite_token', 'text null=YES default= udt=text'),
      ('column', 'guest_guns.invited_by_member_id', 'text null=NO default= udt=text'),
      ('column', 'guest_guns.name', 'text null=NO default= udt=text'),
      ('column', 'guest_guns.notes', 'text null=YES default= udt=text'),
      ('column', 'guest_guns.payment_status', 'USER-DEFINED null=NO default=''PENDING''::"PaymentStatus" udt=PaymentStatus'),
      ('column', 'guest_guns.peg_number', 'integer null=YES default= udt=int4'),
      ('column', 'guest_guns.phone', 'text null=YES default= udt=text'),
      ('column', 'guest_guns.rsvp_status', 'USER-DEFINED null=NO default=''PENDING''::"RsvpStatus" udt=RsvpStatus'),
      ('column', 'guest_guns.shoot_id', 'text null=NO default= udt=text'),
      ('column', 'guest_guns.stripe_payment_id', 'text null=YES default= udt=text'),
      ('column', 'guest_guns.updated_at', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'guest_guns.waiver_accepted', 'boolean null=NO default=false udt=bool'),
      ('column', 'guest_guns.waiver_accepted_at', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'member_payments.amount', 'integer null=NO default= udt=int4'),
      ('column', 'member_payments.created_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'member_payments.due_date', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'member_payments.id', 'text null=NO default= udt=text'),
      ('column', 'member_payments.member_id', 'text null=NO default= udt=text'),
      ('column', 'member_payments.notes', 'text null=YES default= udt=text'),
      ('column', 'member_payments.paid_date', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'member_payments.payment_method', 'USER-DEFINED null=YES default= udt=PaymentMethod'),
      ('column', 'member_payments.payment_type', 'USER-DEFINED null=NO default=''SUBSCRIPTION''::"MemberPaymentType" udt=MemberPaymentType'),
      ('column', 'member_payments.status', 'USER-DEFINED null=NO default=''PENDING''::"PaymentStatus" udt=PaymentStatus'),
      ('column', 'member_payments.stripe_payment_id', 'text null=YES default= udt=text'),
      ('column', 'member_payments.syndicate_id', 'text null=NO default= udt=text'),
      ('column', 'member_payments.updated_at', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'members.accepted_at', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'members.basc_number', 'text null=YES default= udt=text'),
      ('column', 'members.clerk_user_id', 'text null=NO default= udt=text'),
      ('column', 'members.created_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'members.email', 'text null=NO default= udt=text'),
      ('column', 'members.emergency_contact_name', 'text null=YES default= udt=text'),
      ('column', 'members.emergency_contact_phone', 'text null=YES default= udt=text'),
      ('column', 'members.id', 'text null=NO default= udt=text'),
      ('column', 'members.insurance_document', 'text null=YES default= udt=text'),
      ('column', 'members.insurance_expiry', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'members.invited_at', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'members.name', 'text null=NO default= udt=text'),
      ('column', 'members.notes', 'text null=YES default= udt=text'),
      ('column', 'members.phone', 'text null=YES default= udt=text'),
      ('column', 'members.role', 'USER-DEFINED null=NO default=''GUN''::"MemberRole" udt=MemberRole'),
      ('column', 'members.status', 'USER-DEFINED null=NO default=''PENDING''::"MemberStatus" udt=MemberStatus'),
      ('column', 'members.subscription_paid_date', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'members.subscription_status', 'USER-DEFINED null=NO default=''PENDING''::"PaymentStatus" udt=PaymentStatus'),
      ('column', 'members.syndicate_id', 'text null=NO default= udt=text'),
      ('column', 'members.updated_at', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'shoot_attendances.attended', 'boolean null=NO default=false udt=bool'),
      ('column', 'shoot_attendances.checked_in_at', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'shoot_attendances.confirmed', 'boolean null=NO default=false udt=bool'),
      ('column', 'shoot_attendances.created_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'shoot_attendances.id', 'text null=NO default= udt=text'),
      ('column', 'shoot_attendances.member_id', 'text null=NO default= udt=text'),
      ('column', 'shoot_attendances.notes', 'text null=YES default= udt=text'),
      ('column', 'shoot_attendances.peg_number', 'integer null=YES default= udt=int4'),
      ('column', 'shoot_attendances.role_on_day', 'USER-DEFINED null=NO default=''GUN''::"MemberRole" udt=MemberRole'),
      ('column', 'shoot_attendances.shoot_id', 'text null=NO default= udt=text'),
      ('column', 'shoot_attendances.updated_at', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'shoot_days.briefing_generated', 'boolean null=NO default=false udt=bool'),
      ('column', 'shoot_days.captain_notes', 'text null=YES default= udt=text'),
      ('column', 'shoot_days.created_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'shoot_days.date', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'shoot_days.drives_planned', 'integer null=NO default=4 udt=int4'),
      ('column', 'shoot_days.expected_bag', 'integer null=YES default= udt=int4'),
      ('column', 'shoot_days.id', 'text null=NO default= udt=text'),
      ('column', 'shoot_days.location_address', 'text null=YES default= udt=text'),
      ('column', 'shoot_days.location_name', 'text null=NO default= udt=text'),
      ('column', 'shoot_days.location_postcode', 'text null=YES default= udt=text'),
      ('column', 'shoot_days.location_what3words', 'text null=YES default= udt=text'),
      ('column', 'shoot_days.meet_time', 'text null=NO default=''08:30''::text udt=text'),
      ('column', 'shoot_days.status', 'USER-DEFINED null=NO default=''SCHEDULED''::"ShootStatus" udt=ShootStatus'),
      ('column', 'shoot_days.syndicate_id', 'text null=NO default= udt=text'),
      ('column', 'shoot_days.updated_at', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'shoot_days.weather_notes', 'text null=YES default= udt=text'),
      ('column', 'syndicates.captain_clerk_id', 'text null=NO default= udt=text'),
      ('column', 'syndicates.created_at', 'timestamp without time zone precision=3 null=NO default=CURRENT_TIMESTAMP udt=timestamp'),
      ('column', 'syndicates.default_beater_rate', 'integer null=NO default=40 udt=int4'),
      ('column', 'syndicates.id', 'text null=NO default= udt=text'),
      ('column', 'syndicates.name', 'text null=NO default= udt=text'),
      ('column', 'syndicates.peg_rotation_rule', 'USER-DEFINED null=NO default=''FAIR_ROTATION''::"PegRotationRule" udt=PegRotationRule'),
      ('column', 'syndicates.plan_tier', 'USER-DEFINED null=YES default= udt=PlanTier'),
      ('column', 'syndicates.season_end', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'syndicates.season_start', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('column', 'syndicates.status', 'USER-DEFINED null=NO default=''ACTIVE''::"SyndicateStatus" udt=SyndicateStatus'),
      ('column', 'syndicates.stripe_customer_id', 'text null=YES default= udt=text'),
      ('column', 'syndicates.stripe_price_id', 'text null=YES default= udt=text'),
      ('column', 'syndicates.stripe_subscription_id', 'text null=YES default= udt=text'),
      ('column', 'syndicates.stripe_subscription_status', 'USER-DEFINED null=YES default= udt=StripeSubscriptionStatus'),
      ('column', 'syndicates.subscription_amount', 'integer null=NO default=0 udt=int4'),
      ('column', 'syndicates.subscription_current_period_end', 'timestamp without time zone precision=3 null=YES default= udt=timestamp'),
      ('column', 'syndicates.subscription_type', 'USER-DEFINED null=NO default=''ANNUAL''::"SubscriptionType" udt=SubscriptionType'),
      ('column', 'syndicates.updated_at', 'timestamp without time zone precision=3 null=NO default= udt=timestamp'),
      ('constraint', 'activity_logs.activity_logs_actor_member_id_fkey', 'f FOREIGN KEY (actor_member_id) REFERENCES members(id) ON UPDATE CASCADE ON DELETE SET NULL'),
      ('constraint', 'activity_logs.activity_logs_pkey', 'p PRIMARY KEY (id)'),
      ('constraint', 'activity_logs.activity_logs_syndicate_id_fkey', 'f FOREIGN KEY (syndicate_id) REFERENCES syndicates(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'bag_records.bag_records_pkey', 'p PRIMARY KEY (id)'),
      ('constraint', 'bag_records.bag_records_recorded_by_member_id_fkey', 'f FOREIGN KEY (recorded_by_member_id) REFERENCES members(id) ON UPDATE CASCADE ON DELETE SET NULL'),
      ('constraint', 'bag_records.bag_records_shoot_id_fkey', 'f FOREIGN KEY (shoot_id) REFERENCES shoot_days(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'beater_bookings.beater_bookings_beater_id_fkey', 'f FOREIGN KEY (beater_id) REFERENCES beaters(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'beater_bookings.beater_bookings_pkey', 'p PRIMARY KEY (id)'),
      ('constraint', 'beater_bookings.beater_bookings_shoot_id_fkey', 'f FOREIGN KEY (shoot_id) REFERENCES shoot_days(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'beater_bookings.beater_bookings_syndicate_id_fkey', 'f FOREIGN KEY (syndicate_id) REFERENCES syndicates(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'beater_payments.beater_payments_beater_id_fkey', 'f FOREIGN KEY (beater_id) REFERENCES beaters(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'beater_payments.beater_payments_pkey', 'p PRIMARY KEY (id)'),
      ('constraint', 'beater_payments.beater_payments_shoot_id_fkey', 'f FOREIGN KEY (shoot_id) REFERENCES shoot_days(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'beater_payments.beater_payments_syndicate_id_fkey', 'f FOREIGN KEY (syndicate_id) REFERENCES syndicates(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'beaters.beaters_pkey', 'p PRIMARY KEY (id)'),
      ('constraint', 'beaters.beaters_syndicate_id_fkey', 'f FOREIGN KEY (syndicate_id) REFERENCES syndicates(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'guest_guns.guest_guns_invited_by_member_id_fkey', 'f FOREIGN KEY (invited_by_member_id) REFERENCES members(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'guest_guns.guest_guns_pkey', 'p PRIMARY KEY (id)'),
      ('constraint', 'guest_guns.guest_guns_shoot_id_fkey', 'f FOREIGN KEY (shoot_id) REFERENCES shoot_days(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'member_payments.member_payments_member_id_fkey', 'f FOREIGN KEY (member_id) REFERENCES members(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'member_payments.member_payments_pkey', 'p PRIMARY KEY (id)'),
      ('constraint', 'member_payments.member_payments_syndicate_id_fkey', 'f FOREIGN KEY (syndicate_id) REFERENCES syndicates(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'members.members_pkey', 'p PRIMARY KEY (id)'),
      ('constraint', 'members.members_syndicate_id_fkey', 'f FOREIGN KEY (syndicate_id) REFERENCES syndicates(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'shoot_attendances.shoot_attendances_member_id_fkey', 'f FOREIGN KEY (member_id) REFERENCES members(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'shoot_attendances.shoot_attendances_pkey', 'p PRIMARY KEY (id)'),
      ('constraint', 'shoot_attendances.shoot_attendances_shoot_id_fkey', 'f FOREIGN KEY (shoot_id) REFERENCES shoot_days(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'shoot_days.shoot_days_pkey', 'p PRIMARY KEY (id)'),
      ('constraint', 'shoot_days.shoot_days_syndicate_id_fkey', 'f FOREIGN KEY (syndicate_id) REFERENCES syndicates(id) ON UPDATE CASCADE ON DELETE CASCADE'),
      ('constraint', 'syndicates.syndicates_pkey', 'p PRIMARY KEY (id)'),
      ('enum', 'ActivityAction', 'MEMBER_INVITED,MEMBER_ACCEPTED,PAYMENT_RECEIVED,SHOOT_CREATED,BAG_RECORDED,PEG_ALLOCATED,BEATER_BOOKED,GUEST_INVITED'),
      ('enum', 'BeaterStatus', 'ACTIVE,INACTIVE'),
      ('enum', 'BookingStatus', 'INVITED,CONFIRMED,DECLINED,NO_SHOW'),
      ('enum', 'MemberPaymentType', 'SUBSCRIPTION,GUEST_FEE,OTHER'),
      ('enum', 'MemberRole', 'CAPTAIN,GUN,BEATER,HYBRID'),
      ('enum', 'MemberStatus', 'ACTIVE,INACTIVE,PENDING'),
      ('enum', 'PaymentMethod', 'BANK_TRANSFER,STRIPE,CASH'),
      ('enum', 'PaymentStatus', 'PENDING,PAID,OVERDUE,REFUNDED'),
      ('enum', 'PegRotationRule', 'FAIR_ROTATION,RANDOM,MANUAL'),
      ('enum', 'PlanTier', 'STARTER,STANDARD'),
      ('enum', 'RsvpStatus', 'PENDING,CONFIRMED,DECLINED'),
      ('enum', 'ShootStatus', 'SCHEDULED,COMPLETED,CANCELLED'),
      ('enum', 'StripeSubscriptionStatus', 'ACTIVE,PAST_DUE,CANCELLED,INCOMPLETE,TRIALING'),
      ('enum', 'SubscriptionType', 'ANNUAL,PER_SHOOT,HYBRID'),
      ('enum', 'SyndicateStatus', 'ACTIVE,ARCHIVED'),
      ('index', 'activity_logs.activity_logs_pkey', 'CREATE UNIQUE INDEX activity_logs_pkey ON public.activity_logs USING btree (id)'),
      ('index', 'bag_records.bag_records_pkey', 'CREATE UNIQUE INDEX bag_records_pkey ON public.bag_records USING btree (id)'),
      ('index', 'beater_bookings.beater_bookings_beater_id_shoot_id_key', 'CREATE UNIQUE INDEX beater_bookings_beater_id_shoot_id_key ON public.beater_bookings USING btree (beater_id, shoot_id)'),
      ('index', 'beater_bookings.beater_bookings_pkey', 'CREATE UNIQUE INDEX beater_bookings_pkey ON public.beater_bookings USING btree (id)'),
      ('index', 'beater_payments.beater_payments_pkey', 'CREATE UNIQUE INDEX beater_payments_pkey ON public.beater_payments USING btree (id)'),
      ('index', 'beaters.beaters_pkey', 'CREATE UNIQUE INDEX beaters_pkey ON public.beaters USING btree (id)'),
      ('index', 'guest_guns.guest_guns_invite_token_key', 'CREATE UNIQUE INDEX guest_guns_invite_token_key ON public.guest_guns USING btree (invite_token)'),
      ('index', 'guest_guns.guest_guns_pkey', 'CREATE UNIQUE INDEX guest_guns_pkey ON public.guest_guns USING btree (id)'),
      ('index', 'member_payments.member_payments_pkey', 'CREATE UNIQUE INDEX member_payments_pkey ON public.member_payments USING btree (id)'),
      ('index', 'members.members_pkey', 'CREATE UNIQUE INDEX members_pkey ON public.members USING btree (id)'),
      ('index', 'members.members_syndicate_id_clerk_user_id_key', 'CREATE UNIQUE INDEX members_syndicate_id_clerk_user_id_key ON public.members USING btree (syndicate_id, clerk_user_id)'),
      ('index', 'shoot_attendances.shoot_attendances_pkey', 'CREATE UNIQUE INDEX shoot_attendances_pkey ON public.shoot_attendances USING btree (id)'),
      ('index', 'shoot_attendances.shoot_attendances_shoot_id_member_id_key', 'CREATE UNIQUE INDEX shoot_attendances_shoot_id_member_id_key ON public.shoot_attendances USING btree (shoot_id, member_id)'),
      ('index', 'shoot_days.shoot_days_pkey', 'CREATE UNIQUE INDEX shoot_days_pkey ON public.shoot_days USING btree (id)'),
      ('index', 'syndicates.syndicates_pkey', 'CREATE UNIQUE INDEX syndicates_pkey ON public.syndicates USING btree (id)')
  ),
  live AS (
    SELECT kind, name, detail FROM (
      SELECT 'column' AS kind, table_name || '.' || column_name AS name,
             data_type || coalesce('(' || character_maximum_length || ')', '') || coalesce(' precision=' || datetime_precision, '') || ' null=' || is_nullable || ' default=' || coalesce(column_default, '') || ' udt=' || udt_name AS detail
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name NOT LIKE '\_prisma%' AND table_name <> 'schema_migrations'
      UNION ALL
      SELECT 'constraint', cl.relname || '.' || c.conname, c.contype::text || ' ' || pg_get_constraintdef(c.oid)
      FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public' AND c.contype IN ('p', 'f', 'u', 'c') AND cl.relname NOT LIKE '\_prisma%' AND cl.relname <> 'schema_migrations'
      UNION ALL
      SELECT 'index', tablename || '.' || indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%' AND tablename <> 'schema_migrations'
      UNION ALL
      SELECT 'enum', t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' GROUP BY t.typname
    ) catalog
  ),
  missing AS (SELECT * FROM expected EXCEPT SELECT * FROM live),
  unexpected AS (SELECT * FROM live EXCEPT SELECT * FROM expected)
  SELECT string_agg(line, E'\n' ORDER BY line), (SELECT count(*) FROM expected)
  INTO differences, checked
  FROM (
    SELECT '  expected but not on live: ' || kind || ' ' || name || ' ' || detail AS line FROM missing
    UNION ALL
    SELECT '  on live but not expected: ' || kind || ' ' || name || ' ' || detail FROM unexpected
  ) d;

  IF differences IS NOT NULL THEN
    RAISE EXCEPTION E'The live schema is not 0001_baseline. Nothing was changed. Differences:\n%', differences;
  END IF;

  -- Run as quoted text: even an editor that split this file at every semicolon could never
  -- run these two on their own, without the check above.
  EXECUTE 'CREATE TABLE "schema_migrations" ("id" TEXT NOT NULL, "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("id"))';
  EXECUTE 'INSERT INTO "schema_migrations" ("id") VALUES (''0001_baseline'')';
  RAISE NOTICE 'Adopted 0001_baseline: the live schema matched all % expected entries.', checked;
END
$adopt$;

-- The receipt: one row, 0001_baseline.
SELECT "id", "applied_at" FROM "schema_migrations" ORDER BY "id";
