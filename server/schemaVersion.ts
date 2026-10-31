/**
 * Database schema version - ShootSync
 *
 * Migrations are applied to production by hand, in the Neon SQL editor, after review
 * (Build Standard 9.8), and each one ends by recording itself in schema_migrations. The code
 * says which migration it needs. Until that row exists, the server will not start and the
 * health check reports the database as not ready, so Railway keeps the previous deploy serving
 * rather than run new code against an old database.
 *
 * Order for a change that needs a migration: apply the migration, check its receipt, then
 * commit the code. Migrations only add (never drop or rename what the live code reads), so the
 * code already running is unaffected by the step in between.
 */

import type { PrismaClient } from '@prisma/client'

/** The newest migration this code needs. tests/migrations.test.ts keeps it equal to the newest file. */
export const REQUIRED_MIGRATION = '0008_deletion_warnings'

export type SchemaProblem = 'not-recorded' | 'no-table' | 'no-permission' | 'unreachable'
export type SchemaState = { ready: true } | { ready: false; problem: SchemaProblem; reason: string }

/** The Postgres error code (SQLSTATE) behind a Prisma raw-query error, when there is one. */
export function sqlStateOf(err: unknown): string | null {
  const meta = (err as { meta?: { code?: unknown } } | null)?.meta
  if (typeof meta?.code === 'string' && /^[0-9A-Z]{5}$/.test(meta.code)) return meta.code
  const message = err instanceof Error ? err.message : String(err)
  return /Code: `([0-9A-Z]{5})`/.exec(message)?.[1] ?? null
}

export async function checkSchema(prisma: PrismaClient): Promise<SchemaState> {
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "schema_migrations" WHERE "id" = ${REQUIRED_MIGRATION}`
    if (rows.length === 1) return { ready: true }
    return { ready: false, problem: 'not-recorded', reason: `migration ${REQUIRED_MIGRATION} has not been applied to this database. Run prisma/migrations/${REQUIRED_MIGRATION}/migration.sql in the Neon SQL editor` }
  } catch (err) {
    switch (sqlStateOf(err)) {
      case '42P01': // undefined_table
        return { ready: false, problem: 'no-table', reason: 'schema_migrations is missing: adopt 0001_baseline first (prisma/production/0001_adopt.sql)' }
      case '42501': // insufficient_privilege
        return { ready: false, problem: 'no-permission', reason: 'this database user may not read schema_migrations: run the migration as the same user as DATABASE_URL, or grant SELECT' }
      default: {
        const detail = err instanceof Error ? err.message.split('\n').filter(Boolean).at(-1) : String(err)
        return { ready: false, problem: 'unreachable', reason: `the database could not be reached (${detail})` }
      }
    }
  }
}

export interface RequireSchemaOptions {
  /** Waits between tries while the database can't be reached (a Neon compute waking up, a network blip). */
  retryDelaysMs?: readonly number[]
  sleep?: (ms: number) => Promise<void>
  log?: (line: string) => void
  exit?: (code: number) => never
}

/**
 * The boot check (server/index.ts runs it before listening). A database that is behind the
 * code stops the process at once: waiting won't fix it. One that can't be reached is tried
 * again for about half a minute first, so a restart during a brief outage recovers by itself.
 */
export async function requireSchema(prisma: PrismaClient, options: RequireSchemaOptions = {}): Promise<void> {
  const {
    retryDelaysMs = [1000, 2000, 4000, 8000, 15000],
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log = (line) => console.error(line),
    exit = (code) => process.exit(code),
  } = options
  let state = await checkSchema(prisma)
  for (const delay of retryDelaysMs) {
    if (state.ready || state.problem !== 'unreachable') break
    log(`[boot] ${state.reason}; trying again in ${delay / 1000}s`)
    await sleep(delay)
    state = await checkSchema(prisma)
  }
  if (!state.ready) {
    log(`[boot] Refusing to start: ${state.reason}. Check its receipt, then redeploy.`)
    exit(1)
  }
}
