/**
 * Migrations (Build Standard 9.8).
 *
 * - A database built from prisma/migrations, in order, is the same schema the app is tested on
 *   (built by CI from prisma/schema.prisma): every column, constraint, index and enum value.
 * - Every migration records itself, the files are numbered without gaps, and the server asks
 *   for the newest one.
 * - The production adoption script for 0001 is run for real: it records 0001 on an exact
 *   match, refuses (changing nothing) on any difference, and refuses a second run.
 * - The health check and the boot check refuse a database that is behind the code.
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { call, createTestPrisma, createTestStripe, databaseUrlFor, startTestServer, type TestServer } from './helpers.js'
import { REQUIRED_MIGRATION, checkSchema, requireSchema, sqlStateOf } from '../server/schemaVersion.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const migrationIds = readdirSync(`${root}prisma/migrations`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
const migrationSql = (id: string) => readFileSync(`${root}prisma/migrations/${id}/migration.sql`, 'utf8')
const adoptScript = readFileSync(`${root}prisma/production/0001_adopt.sql`, 'utf8')

/** Statements in a migration file: comments dropped, split at each semicolon that ends a line. */
function statements(sql: string): string[] {
  const code = sql.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n')
  return code.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean)
}

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

  it('the server asks for the newest migration', () => {
    assert.equal(REQUIRED_MIGRATION, migrationIds.at(-1))
  })

  it('built in order, they give exactly the schema the app is tested on', async () => {
    const built = await freshDatabase(migrationIds)
    const fromMigrations = await catalog(built)
    const tested = await catalog(main)
    assert.ok(fromMigrations.length > 200, `only ${fromMigrations.length} catalog entries: the reader is broken`)
    assert.deepEqual(
      { missingFromMigrations: tested.filter((l) => !fromMigrations.includes(l)), extraInMigrations: fromMigrations.filter((l) => !tested.includes(l)) },
      { missingFromMigrations: [], extraInMigrations: [] }
    )
    const recorded = await built.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM schema_migrations ORDER BY id')
    assert.deepEqual(recorded.map((r) => r.id), migrationIds)
    assert.deepEqual(await checkSchema(built), { ready: true })
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
      // Ready once 0001 is recorded, if 0001 is still the newest migration the code needs.
      assert.equal((await checkSchema(db)).ready, REQUIRED_MIGRATION === '0001_baseline')
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
      assert.match(result.log.join('\n'), /Refusing to start: migration 0001_baseline has not been applied/)
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
