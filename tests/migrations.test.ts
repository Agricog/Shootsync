/**
 * Migrations (Build Standard 9.8).
 *
 * - The app is tested on a database built from prisma/migrations, in order, exactly as production
 *   is; and the migrations match prisma/schema.prisma (built separately by CI with `prisma db
 *   push`): every column, constraint, index and enum value, apart from the CHECK constraints
 *   Prisma can't express, which are listed here instead.
 * - Every migration records itself, the files are numbered without gaps, and the server asks
 *   for the newest one.
 * - The production adoption script for 0001 is run for real: it records 0001 on an exact
 *   match, refuses (changing nothing) on any difference, and refuses a second run.
 * - The health check and the boot check refuse a database that is behind the code.
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { call, createTestPrisma, createTestStripe, databaseUrlFor, resetDatabase, seed, startTestServer, type TestServer } from './helpers.js'
import { deleteSyndicate } from '../server/retention.js'
import { REQUIRED_MIGRATION, checkSchema, requireSchema, sqlStateOf } from '../server/schemaVersion.js'
import { hashInviteToken } from '../server/inviteTokens.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const migrationIds = readdirSync(`${root}prisma/migrations`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
const migrationSql = (id: string) => readFileSync(`${root}prisma/migrations/${id}/migration.sql`, 'utf8')
const adoptScript = readFileSync(`${root}prisma/production/0001_adopt.sql`, 'utf8')

/**
 * Statements in a migration file: comments dropped, split at each semicolon that ends a line.
 * BEGIN and COMMIT are left out: these run one statement at a time through Prisma's pool, where
 * a transaction can't span statements; psql runs the file as written (`appliedByPsql` below).
 */
function statements(sql: string): string[] {
  const code = sql.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n')
  return code
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s && s !== 'BEGIN' && s !== 'COMMIT')
}

/** Migrations from this one on are a single transaction: all of it applies or none of it does. */
const FIRST_TRANSACTIONAL = '0004_records_protected'

/** The CHECK constraints production carries. Prisma can't express them, so this list is the record. */
/** Triggers production carries. Prisma can't express them either. */
const TRIGGERS = [
  'activity_logs.activity_logs_no_early_delete',
  'activity_logs.activity_logs_no_update',
  'beaters.beaters_day_rate_sync',
  'beater_bookings.beater_bookings_day_rate_sync',
  'syndicates.syndicates_default_beater_rate_sync',
]

const CHECKS = [
  'syndicates.syndicates_season_years_check',
  'shoot_days.shoot_days_date_check',
  'syndicates.syndicates_season_check',
  'syndicates.syndicates_amounts_check',
  'beaters.beaters_day_rate_check',
  'beater_bookings.beater_bookings_day_rate_check',
  'beater_payments.beater_payments_amount_check',
  'member_payments.member_payments_amount_check',
  'guest_guns.guest_guns_day_fee_check',
  'guest_guns.guest_guns_peg_number_check',
  'shoot_attendances.shoot_attendances_peg_number_check',
  'bag_records.bag_records_counts_check',
  'shoot_days.shoot_days_drives_check',
  'beaters.beaters_day_rate_pence_check',
  'beater_bookings.beater_bookings_day_rate_pence_check',
  'syndicates.syndicates_default_beater_rate_pence_check',
]

/** Every column, constraint, index and enum value in the public schema, as sortable lines. */
async function catalog(db: PrismaClient): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<Array<{ line: string }>>(`
    SELECT 'column ' || table_name || '.' || column_name || ' ' || data_type || coalesce('(' || character_maximum_length || ')', '')
           || coalesce(' precision=' || datetime_precision, '') || ' null=' || is_nullable || ' default=' || coalesce(column_default, '') || ' udt=' || udt_name AS line
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name NOT LIKE '\\_prisma%'
    UNION ALL
    SELECT 'constraint ' || cl.relname || '.' || c.conname || ' ' || c.contype::text || ' ' || pg_get_constraintdef(c.oid)
    FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public' AND c.contype IN ('p', 'f', 'u', 'c') AND cl.relname NOT LIKE '\\_prisma%'
    UNION ALL
    SELECT 'index ' || tablename || '.' || indexname || ' ' || indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%'
    UNION ALL
    SELECT 'enum ' || t.typname || ' ' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' GROUP BY t.typname
    UNION ALL
    SELECT 'trigger ' || cl.relname || '.' || tg.tgname || ' ' || pg_get_triggerdef(tg.oid)
    FROM pg_trigger tg JOIN pg_class cl ON cl.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public' AND NOT tg.tgisinternal`)
  return rows.map((r) => r.line).sort()
}

describe('migrations', () => {
  const scratchName = 'shootsync_migrations_check'
  let main: PrismaClient
  let scratch: PrismaClient | null = null

  /** A fresh, empty database on the same server, with the given migrations applied. */
  async function freshDatabase(ids: readonly string[]): Promise<PrismaClient> {
    await scratch?.$disconnect()
    await main.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`)
    await main.$executeRawUnsafe(`CREATE DATABASE "${scratchName}"`)
    scratch = createTestPrisma(databaseUrlFor(scratchName))
    for (const id of ids) for (const statement of statements(migrationSql(id))) await scratch.$executeRawUnsafe(statement)
    return scratch
  }

  /** Runs the adoption script as the Neon SQL editor would, returning the error message if it refused. */
  async function adopt(db: PrismaClient): Promise<string | null> {
    const doBlock = adoptScript.slice(adoptScript.indexOf('DO $adopt$'), adoptScript.indexOf('$adopt$;') + '$adopt$'.length)
    try {
      await db.$executeRawUnsafe(doBlock)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  }

  before(() => {
    main = createTestPrisma()
  })

  after(async () => {
    await scratch?.$disconnect()
    await main.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`)
    await main.$disconnect()
  })

  it('are numbered 0001, 0002 … with no gaps, each named', () => {
    assert.ok(migrationIds.length >= 1)
    migrationIds.forEach((id, index) => assert.match(id, new RegExp(`^${String(index + 1).padStart(4, '0')}_[a-z0-9_]+$`), id))
  })

  it('each records itself as its last statement', () => {
    for (const id of migrationIds) {
      const last = statements(migrationSql(id)).at(-1)
      assert.equal(last, `INSERT INTO "schema_migrations" ("id") VALUES ('${id}')`, id)
    }
  })

  it('from 0004 on, each is one transaction: BEGIN first, COMMIT last', () => {
    for (const id of migrationIds) {
      const code = migrationSql(id).split('\n').filter((line) => line.trim() && !line.trimStart().startsWith('--'))
      if (id < FIRST_TRANSACTIONAL) continue
      assert.equal(code.at(0), 'BEGIN;', id)
      assert.equal(code.at(-1), 'COMMIT;', id)
    }
  })

  it('a row a migration would refuse stops it and leaves the database exactly as it was; put right, it runs', async () => {
    const at = migrationIds.indexOf(FIRST_TRANSACTIONAL)
    const before = await freshDatabase(migrationIds.slice(0, at))
    const was = await catalog(before)
    // Legal before 0004 (the code only refused season_end < season_start), refused by its CHECK.
    await before.$executeRawUnsafe(`INSERT INTO syndicates (id, name, captain_clerk_id, season_start, season_end, updated_at)
      VALUES ('bad-season', 'Same day', 'user_x', '2026-10-01', '2026-10-01', now())`)
    const file = `${root}prisma/migrations/${FIRST_TRANSACTIONAL}/migration.sql`
    const run = () => spawnSync('psql', [databaseUrlFor(scratchName), '-q', '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8' })

    const refused = run()
    assert.notEqual(refused.status, 0)
    assert.match(refused.stderr, /syndicates_season_check/)
    assert.deepEqual(await catalog(before), was)
    const recorded = () => before.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM schema_migrations ORDER BY id').then((rows) => rows.map((r) => r.id))
    assert.deepEqual(await recorded(), migrationIds.slice(0, at))

    await before.$executeRawUnsafe(`UPDATE syndicates SET season_end = '2027-02-01' WHERE id = 'bad-season'`)
    const applied = run()
    assert.equal(applied.status, 0, applied.stderr)
    assert.deepEqual(await recorded(), migrationIds.slice(0, at + 1))
    if (at + 1 === migrationIds.length) assert.deepEqual(await catalog(before), await catalog(main))
  })

  it('the server asks for the newest migration', () => {
    assert.equal(REQUIRED_MIGRATION, migrationIds.at(-1))
  })

  it('the database the tests run on is exactly what the migrations build, in order', async () => {
    const built = await freshDatabase(migrationIds)
    const fromMigrations = await catalog(built)
    const tested = await catalog(main)
    assert.ok(fromMigrations.length > 200, `only ${fromMigrations.length} catalog entries: the reader is broken`)
    assert.deepEqual(tested, fromMigrations)
    const recorded = await built.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM schema_migrations ORDER BY id')
    assert.deepEqual(recorded.map((r) => r.id), migrationIds)
    assert.deepEqual(await checkSchema(built), { ready: true })
  })

  it('the migrations match schema.prisma, apart from the CHECK constraints and triggers Prisma cannot express', async () => {
    const schemaUrl = process.env.SCHEMA_DATABASE_URL
    assert.ok(schemaUrl, 'SCHEMA_DATABASE_URL must point at a database built from prisma/schema.prisma (prisma db push)')
    const fromSchema = createTestPrisma(schemaUrl)
    try {
      const isCheck = (line: string) => / c CHECK /.test(line) || line.startsWith('trigger ')
      const migrated = (await catalog(main)).filter((l) => !isCheck(l))
      const declared = (await catalog(fromSchema)).filter((l) => !isCheck(l))
      assert.deepEqual(
        { inMigrationsOnly: migrated.filter((l) => !declared.includes(l)), inSchemaOnly: declared.filter((l) => !migrated.includes(l)) },
        { inMigrationsOnly: [], inSchemaOnly: [] }
      )
    } finally {
      await fromSchema.$disconnect()
    }
  })

  it('every CHECK constraint on the record is there, and nothing else of that kind', async () => {
    const found = (await catalog(main)).filter((l) => / c CHECK /.test(l)).map((l) => l.split(' ')[1]).sort()
    assert.deepEqual(found, [...CHECKS].sort())
  })

  it('every trigger on the record is there, and nothing else of that kind', async () => {
    const found = (await catalog(main)).filter((l) => l.startsWith('trigger ')).map((l) => l.split(' ')[1]).sort()
    assert.deepEqual(found, [...TRIGGERS].sort())
  })

  it('an audit entry can never be changed, nor removed before its 6 years, except with its whole syndicate', async () => {
    await resetDatabase(main)
    const seeded = await seed(main)
    const entry = await main.activityLog.create({ data: { syndicateId: seeded.a.syndicate.id, action: 'Test entry', actorMemberId: seeded.a.gun.id } })
    await assert.rejects(main.activityLog.update({ where: { id: entry.id }, data: { action: 'Rewritten' } }), /activity_logs entries cannot be changed/)
    await assert.rejects(main.activityLog.delete({ where: { id: entry.id } }), /cannot be removed before their retention period ends/)
    const old = await main.activityLog.create({ data: { syndicateId: seeded.a.syndicate.id, action: 'Old entry', timestamp: new Date(Date.now() - 6 * 366 * 86_400_000) } })
    await main.activityLog.delete({ where: { id: old.id } })
    // Deleting the whole syndicate takes its trail with it, actor links and all.
    await main.$transaction(async (tx) => deleteSyndicate(tx, seeded.a.syndicate.id))
    assert.equal(await main.activityLog.count({ where: { syndicateId: seeded.a.syndicate.id } }), 0)
  })

  it('0006 starts every unplanned syndicate’s clock on the day it runs, so the first clean-up deletes nobody', async () => {
    const at = migrationIds.indexOf('0006_records_lifecycle')
    const before = await freshDatabase(migrationIds.slice(0, at))
    // Set up a year ago, never paid; and one cancelled long ago: neither had a deletion clock.
    await before.$executeRawUnsafe(`INSERT INTO syndicates (id, name, captain_clerk_id, season_start, season_end, created_at, updated_at) VALUES ('old-unpaid', 'Old', 'u', '2025-10-01', '2026-02-01', now() - interval '365 days', now())`)
    await before.$executeRawUnsafe(`INSERT INTO syndicates (id, name, captain_clerk_id, season_start, season_end, stripe_subscription_status, created_at, updated_at) VALUES ('old-cancelled', 'Gone', 'u', '2025-10-01', '2026-02-01', 'CANCELLED', now() - interval '365 days', now())`)
    await before.$executeRawUnsafe(`INSERT INTO syndicates (id, name, captain_clerk_id, season_start, season_end, stripe_subscription_status, updated_at) VALUES ('live', 'Live', 'u', '2026-10-01', '2027-02-01', 'ACTIVE', now())`)
    for (const statement of statements(migrationSql('0006_records_lifecycle'))) await before.$executeRawUnsafe(statement)
    const rows = await before.$queryRawUnsafe<Array<{ id: string; recent: boolean | null }>>(`SELECT id, plan_ended_at > now() - interval '1 minute' AS recent FROM syndicates ORDER BY id`)
    assert.deepEqual(rows, [{ id: 'live', recent: null }, { id: 'old-cancelled', recent: true }, { id: 'old-unpaid', recent: true }])
  })

  describe('0007: day rates in pence, invitation links hashed', () => {
    const rates = (db: PrismaClient) => db.$queryRawUnsafe<Array<{ id: string; pounds: number; pence: number }>>(
      `SELECT id, day_rate AS pounds, day_rate_pence AS pence FROM beaters UNION ALL SELECT id, day_rate, day_rate_pence FROM beater_bookings UNION ALL SELECT id, default_beater_rate, default_beater_rate_pence FROM syndicates ORDER BY id`
    )

    it('fills every pence column from the pounds, and hashes every link in place', async () => {
      const at = migrationIds.indexOf('0007_day_rates_in_pence')
      const before = await freshDatabase(migrationIds.slice(0, at))
      const token = 'a'.repeat(64)
      await before.$executeRawUnsafe(`INSERT INTO syndicates (id, name, captain_clerk_id, season_start, season_end, default_beater_rate, updated_at) VALUES ('s1', 'S', 'u', '2026-10-01', '2027-02-01', 45, now())`)
      await before.$executeRawUnsafe(`INSERT INTO beaters (id, syndicate_id, name, day_rate, updated_at) VALUES ('b1', 's1', 'Dai', 55, now()), ('b2', 's1', 'Bob', 0, now())`)
      await before.$executeRawUnsafe(`INSERT INTO shoot_days (id, syndicate_id, date, location_name, updated_at) VALUES ('d1', 's1', '2026-11-14', 'Wood', now())`)
      await before.$executeRawUnsafe(`INSERT INTO beater_bookings (id, syndicate_id, beater_id, shoot_id, day_rate, updated_at) VALUES ('k1', 's1', 'b1', 'd1', 50, now())`)
      await before.$executeRawUnsafe(`INSERT INTO members (id, syndicate_id, clerk_user_id, email, name, updated_at) VALUES ('m1', 's1', 'u', 'g@example.com', 'Gun', now())`)
      await before.$executeRawUnsafe(`INSERT INTO guest_guns (id, shoot_id, invited_by_member_id, name, email, invite_token, updated_at) VALUES ('g1', 'd1', 'm1', 'Guest', 'x@example.com', '${token}', now()), ('g2', 'd1', 'm1', 'Erased', 'y@example.com', NULL, now())`)
      for (const statement of statements(migrationSql('0007_day_rates_in_pence'))) await before.$executeRawUnsafe(statement)

      assert.deepEqual(await rates(before), [
        { id: 'b1', pounds: 55, pence: 5500 },
        { id: 'b2', pounds: 0, pence: 0 },
        { id: 'k1', pounds: 50, pence: 5000 },
        { id: 's1', pounds: 45, pence: 4500 },
      ])
      const links = await before.$queryRawUnsafe<Array<{ id: string; invite_token: string | null }>>(`SELECT id, invite_token FROM guest_guns ORDER BY id`)
      assert.deepEqual(links, [{ id: 'g1', invite_token: hashInviteToken(token) }, { id: 'g2', invite_token: null }])
    })

    it('keeps pounds and pence in step whichever one is written, on insert and on update', async () => {
      const at = migrationIds.indexOf('0007_day_rates_in_pence')
      const db = await freshDatabase(migrationIds.slice(0, at + 1))
      // Code that knows only pounds (the deploy window) and code that writes only pence, side by side.
      await db.$executeRawUnsafe(`INSERT INTO syndicates (id, name, captain_clerk_id, season_start, season_end, default_beater_rate, updated_at) VALUES ('old', 'Old', 'u', '2026-10-01', '2027-02-01', 35, now())`)
      await db.$executeRawUnsafe(`INSERT INTO syndicates (id, name, captain_clerk_id, season_start, season_end, default_beater_rate_pence, updated_at) VALUES ('new', 'New', 'u', '2026-10-01', '2027-02-01', 4250, now())`)
      await db.$executeRawUnsafe(`INSERT INTO syndicates (id, name, captain_clerk_id, season_start, season_end, updated_at) VALUES ('dft', 'Default', 'u', '2026-10-01', '2027-02-01', now())`)
      await db.$executeRawUnsafe(`INSERT INTO beaters (id, syndicate_id, name, day_rate, updated_at) VALUES ('b-old', 'old', 'Old code', 55, now())`)
      await db.$executeRawUnsafe(`INSERT INTO beaters (id, syndicate_id, name, day_rate_pence, updated_at) VALUES ('b-new', 'old', 'New code', 4275, now())`)
      await db.$executeRawUnsafe(`INSERT INTO beaters (id, syndicate_id, name, updated_at) VALUES ('b-dft', 'old', 'Default', now())`)
      // Old code writing the default rate explicitly: the one insert the rule can't tell from a pence write, and needn't.
      await db.$executeRawUnsafe(`INSERT INTO beaters (id, syndicate_id, name, day_rate, updated_at) VALUES ('b-forty', 'old', 'Forty', 40, now())`)
      await db.$executeRawUnsafe(`INSERT INTO shoot_days (id, syndicate_id, date, location_name, updated_at) VALUES ('d1', 'old', '2026-11-14', 'Wood', now())`)
      await db.$executeRawUnsafe(`INSERT INTO beater_bookings (id, syndicate_id, beater_id, shoot_id, day_rate, updated_at) VALUES ('k-old', 'old', 'b-old', 'd1', 45, now())`)
      await db.$executeRawUnsafe(`INSERT INTO beater_bookings (id, syndicate_id, beater_id, shoot_id, day_rate_pence, updated_at) VALUES ('k-new', 'old', 'b-new', 'd1', 4250, now())`)
      await db.$executeRawUnsafe(`INSERT INTO beater_bookings (id, syndicate_id, beater_id, shoot_id, day_rate_pence, updated_at) VALUES ('k-nil', 'old', 'b-dft', 'd1', 0, now())`)
      assert.deepEqual(await rates(db), [
        { id: 'b-dft', pounds: 40, pence: 4000 },
        { id: 'b-forty', pounds: 40, pence: 4000 },
        { id: 'b-new', pounds: 43, pence: 4275 },
        { id: 'b-old', pounds: 55, pence: 5500 },
        { id: 'dft', pounds: 40, pence: 4000 },
        { id: 'k-new', pounds: 43, pence: 4250 },
        { id: 'k-nil', pounds: 0, pence: 0 },
        { id: 'k-old', pounds: 45, pence: 4500 },
        { id: 'new', pounds: 43, pence: 4250 },
        { id: 'old', pounds: 35, pence: 3500 },
      ])
      // Updates: the pence win when they change; a pounds-only change is carried into the pence.
      await db.$executeRawUnsafe(`UPDATE beaters SET day_rate = 60 WHERE id = 'b-new'`)
      await db.$executeRawUnsafe(`UPDATE beaters SET day_rate_pence = 6150 WHERE id = 'b-old'`)
      await db.$executeRawUnsafe(`UPDATE beater_bookings SET day_rate = 70 WHERE id = 'k-new'`)
      await db.$executeRawUnsafe(`UPDATE beater_bookings SET day_rate_pence = 7050 WHERE id = 'k-old'`)
      await db.$executeRawUnsafe(`UPDATE syndicates SET default_beater_rate = 50 WHERE id = 'new'`)
      await db.$executeRawUnsafe(`UPDATE syndicates SET default_beater_rate_pence = 5125 WHERE id = 'old'`)
      // A write that touches neither leaves both alone.
      await db.$executeRawUnsafe(`UPDATE beaters SET name = 'Renamed' WHERE id = 'b-dft'`)
      assert.deepEqual(await rates(db), [
        { id: 'b-dft', pounds: 40, pence: 4000 },
        { id: 'b-forty', pounds: 40, pence: 4000 },
        { id: 'b-new', pounds: 60, pence: 6000 },
        { id: 'b-old', pounds: 62, pence: 6150 },
        { id: 'dft', pounds: 40, pence: 4000 },
        { id: 'k-new', pounds: 70, pence: 7000 },
        { id: 'k-nil', pounds: 0, pence: 0 },
        { id: 'k-old', pounds: 71, pence: 7050 },
        { id: 'new', pounds: 50, pence: 5000 },
        { id: 'old', pounds: 51, pence: 5125 },
      ])
      // The floor holds on the pence too.
      await assert.rejects(db.$executeRawUnsafe(`UPDATE beaters SET day_rate_pence = -1 WHERE id = 'b-dft'`), /beaters_day_rate_pence_check/)
    })

    it('through Prisma, a rate written in pence is what the old column shows too', async () => {
      await resetDatabase(main)
      const seeded = await seed(main)
      const beater = await main.beater.create({ data: { syndicateId: seeded.a.syndicate.id, name: 'Penny', dayRatePence: 4250 } })
      assert.deepEqual([beater.dayRatePence, beater.dayRate], [4250, 43])
      const changed = await main.beater.update({ where: { id: beater.id }, data: { dayRatePence: 3999 } })
      assert.deepEqual([changed.dayRatePence, changed.dayRate], [3999, 40])
      await resetDatabase(main)
    })
  })

  it('a season or shoot date outside 2000 to 2100 is refused by the database itself', async () => {
    await resetDatabase(main)
    const seeded = await seed(main)
    await assert.rejects(main.syndicate.update({ where: { id: seeded.a.syndicate.id }, data: { seasonStart: new Date('0028-02-28') } }), /syndicates_season_years_check/)
    await assert.rejects(main.shootDay.update({ where: { id: seeded.a.shoot.id }, data: { date: new Date('2201-01-01') } }), /shoot_days_date_check/)
  })

  it('the checks hold: a negative amount, a peg of 0 and a season ending before it starts are all refused', async () => {
    await resetDatabase(main)
    const seeded = await seed(main)
    await assert.rejects(main.beaterPayment.create({ data: { syndicateId: seeded.a.syndicate.id, beaterId: seeded.a.beater.id, shootId: seeded.b.shoot.id, amount: -1 } }), /beater_payments_amount_check/)
    await assert.rejects(main.guestGun.update({ where: { id: seeded.a.guest.id }, data: { pegNumber: 0 } }), /guest_guns_peg_number_check/)
    await assert.rejects(main.syndicate.update({ where: { id: seeded.a.syndicate.id }, data: { seasonEnd: new Date('2020-01-01') } }), /syndicates_season_check/)
    await assert.rejects(main.bagRecord.create({ data: { shootId: seeded.a.shoot.id, driveNumber: 1, pheasant: -5 } }), /bag_records_counts_check/)
    await resetDatabase(main)
  })

  describe('adopting 0001 on the live database (prisma/production/0001_adopt.sql)', () => {
    /** The live database as it is today: the 0001 schema, created before migrations, so no schema_migrations. */
    const liveToday = async () => {
      const db = await freshDatabase(['0001_baseline'])
      await db.$executeRawUnsafe('DROP TABLE schema_migrations')
      return db
    }

    it('records 0001 when the live schema matches exactly', async () => {
      const db = await liveToday()
      assert.equal(await checkSchema(db).then((s) => s.ready), false)
      assert.equal(await adopt(db), null)
      const rows = await db.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM schema_migrations')
      assert.deepEqual(rows.map((r) => r.id), ['0001_baseline'])
      // Adopted at 0001; later migrations then apply on top, in order, as on a fresh database.
      for (const id of migrationIds.slice(1)) for (const statement of statements(migrationSql(id))) await db.$executeRawUnsafe(statement)
      assert.deepEqual(await checkSchema(db), { ready: true })
      assert.deepEqual(await catalog(db), await catalog(main))
    })

    it('a second run refuses and changes nothing', async () => {
      const db = await liveToday()
      await adopt(db)
      assert.match((await adopt(db)) ?? '', /0001_baseline has been adopted before\. Nothing was changed\./)
      assert.equal((await db.$queryRawUnsafe<unknown[]>('SELECT id FROM schema_migrations')).length, 1)
    })

    it('any difference stops it, lists the difference, and changes nothing', async () => {
      for (const drift of [
        'ALTER TABLE members ADD COLUMN surprise text',
        'ALTER TABLE shoot_days ALTER COLUMN meet_time DROP DEFAULT',
        'DROP INDEX "beater_bookings_beater_id_shoot_id_key"',
        `ALTER TYPE "PaymentStatus" ADD VALUE 'WAIVED'`,
        'ALTER TABLE members ALTER COLUMN created_at TYPE timestamp(6)',
      ]) {
        const db = await liveToday()
        await db.$executeRawUnsafe(drift)
        const refusal = await adopt(db)
        assert.match(refusal ?? '', /not 0001_baseline\. Nothing was changed\./, drift)
        const table = await db.$queryRawUnsafe<Array<{ t: string | null }>>("SELECT to_regclass('public.schema_migrations')::text AS t")
        assert.equal(table[0].t, null, `${drift}: schema_migrations was created`)
      }
    })
  })

  describe('a database behind the code', () => {
    let server: TestServer

    before(async () => {
      server = await startTestServer(main, createTestStripe().stripe)
    })

    after(async () => {
      // Close first: if the clean-up below fails, an open server would keep the run alive forever.
      await server.close()
      // Leave the database as the migrations built it, whatever this block did to it.
      await main.$executeRawUnsafe(`INSERT INTO schema_migrations (id) VALUES ('${REQUIRED_MIGRATION}') ON CONFLICT DO NOTHING`)
    })

    it('fails the health check until the migration the code needs is recorded, without saying why', async () => {
      await main.$executeRawUnsafe(`DELETE FROM schema_migrations WHERE id = '${REQUIRED_MIGRATION}'`)
      const behind = await call(server, '/api/health')
      assert.equal(behind.status, 503)
      assert.deepEqual(behind.json, { status: 'unavailable' })
      assert.equal((await checkSchema(main)).ready, false)

      // An older migration on record is not enough: it must be the one this code needs.
      await main.$executeRawUnsafe(`INSERT INTO schema_migrations (id) VALUES ('0000_older')`)
      assert.equal((await call(server, '/api/health')).status, 503)
      assert.equal((await checkSchema(main)).ready, false)
      await main.$executeRawUnsafe(`DELETE FROM schema_migrations WHERE id = '0000_older'`)

      await main.$executeRawUnsafe(`INSERT INTO schema_migrations (id) VALUES ('${REQUIRED_MIGRATION}')`)
      const ready = await call(server, '/api/health')
      assert.equal(ready.status, 200)
      assert.equal(ready.json.status, 'ok')
    })

    it('server/index.ts runs the boot check before it starts listening', () => {
      const index = readFileSync(`${root}server/index.ts`, 'utf8')
      const check = index.indexOf('await requireSchema(prisma)')
      assert.ok(check > 0, 'server/index.ts does not check the schema')
      assert.ok(check < index.indexOf('app.listen('), 'the schema is checked after the server starts listening')
    })
  })

  describe('the boot check (requireSchema)', () => {
    /** Runs the boot check with a recorded log, no real waiting, and an exit that is only noted. */
    async function boot(prisma: PrismaClient) {
      const log: string[] = []
      const waits: number[] = []
      let exitCode: number | null = null
      await requireSchema(prisma, {
        retryDelaysMs: [10, 20, 30],
        sleep: async (ms) => { waits.push(ms) },
        log: (line) => log.push(line),
        exit: ((code: number) => { exitCode = code }) as (code: number) => never,
      })
      return { log, waits, exitCode }
    }

    /** A stand-in database: each call answers with the next result in the list. */
    const scripted = (...results: Array<'down' | 'ready'>) => {
      let call = 0
      return {
        $queryRaw: async () => {
          const next = results[Math.min(call++, results.length - 1)]
          if (next === 'down') throw new Error("Can't reach database server at `ep-example.neon.tech:5432`")
          return [{ id: REQUIRED_MIGRATION }]
        },
      } as unknown as PrismaClient
    }

    it('starts quietly when the migration is recorded', async () => {
      const db = await freshDatabase(migrationIds)
      assert.deepEqual(await boot(db), { log: [], waits: [], exitCode: null })
    })

    it('stops at once, without waiting, when the database is behind', async () => {
      const db = await freshDatabase(migrationIds)
      await db.$executeRawUnsafe('DELETE FROM schema_migrations')
      const result = await boot(db)
      assert.equal(result.exitCode, 1)
      assert.deepEqual(result.waits, [])
      assert.match(result.log.join('\n'), new RegExp(`Refusing to start: migration ${REQUIRED_MIGRATION} has not been applied.*Run prisma/migrations/${REQUIRED_MIGRATION}/migration\\.sql in the Neon SQL editor`))
    })

    it('stops at once when schema_migrations is missing, and says to adopt 0001', async () => {
      const db = await freshDatabase(['0001_baseline'])
      await db.$executeRawUnsafe('DROP TABLE schema_migrations')
      assert.equal((await checkSchema(db) as { problem?: string }).problem, 'no-table')
      const result = await boot(db)
      assert.equal(result.exitCode, 1)
      assert.deepEqual(result.waits, [])
      assert.match(result.log.join('\n'), /adopt 0001_baseline first/)
    })

    it('says so when the app’s database user may not read schema_migrations, rather than “could not be reached”', async () => {
      const db = await freshDatabase(migrationIds)
      await main.$executeRawUnsafe('DROP ROLE IF EXISTS shootsync_reader_check')
      await main.$executeRawUnsafe("CREATE ROLE shootsync_reader_check LOGIN PASSWORD 'reader-check'")
      const url = new URL(databaseUrlFor(scratchName))
      url.username = 'shootsync_reader_check'
      url.password = 'reader-check'
      const reader = createTestPrisma(url.toString())
      try {
        const state = await checkSchema(reader)
        assert.equal((state as { problem?: string }).problem, 'no-permission', JSON.stringify(state))
        assert.ok(db)
      } finally {
        await reader.$disconnect()
        await main.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`)
        scratch = null
        await main.$executeRawUnsafe('DROP ROLE IF EXISTS shootsync_reader_check')
      }
    })

    it('a database that can’t be reached is tried again, and a recovery lets it start', async () => {
      const result = await boot(scripted('down', 'down', 'ready'))
      assert.equal(result.exitCode, null)
      assert.deepEqual(result.waits, [10, 20])
      assert.equal(result.log.length, 2)
      assert.match(result.log[0], /could not be reached .*trying again in 0\.01s/)
    })

    it('one that stays unreachable stops after the last try', async () => {
      const result = await boot(scripted('down'))
      assert.equal(result.exitCode, 1)
      assert.deepEqual(result.waits, [10, 20, 30])
      assert.match(result.log.at(-1) ?? '', /Refusing to start: the database could not be reached/)
    })

    it('reads the Postgres error code from either shape Prisma reports it in', () => {
      assert.equal(sqlStateOf({ meta: { code: '42P01', message: 'relation does not exist' } }), '42P01')
      assert.equal(sqlStateOf(new Error('Invalid `prisma.$queryRaw()` invocation:\n\nRaw query failed. Code: `42501`. Message: `permission denied`')), '42501')
      assert.equal(sqlStateOf(new Error("Can't reach database server")), null)
    })
  })
})
