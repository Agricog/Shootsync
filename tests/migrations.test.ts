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
import { REQUIRED_MIGRATION, checkSchema, requireSchema, sqlStateOf } from '../server/schemaVersion.js'

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
const CHECKS = [
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
    WHERE n.nspname = 'public' GROUP BY t.typname`)
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

  it('the migrations match schema.prisma, apart from the CHECK constraints Prisma cannot express', async () => {
    const schemaUrl = process.env.SCHEMA_DATABASE_URL
    assert.ok(schemaUrl, 'SCHEMA_DATABASE_URL must point at a database built from prisma/schema.prisma (prisma db push)')
    const fromSchema = createTestPrisma(schemaUrl)
    try {
      const isCheck = (line: string) => / c CHECK /.test(line)
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
      await main.$executeRawUnsafe(`DELETE FROM schema_migrations WHERE id = '${REQUIRED_MIGRATION}'`)
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
