/**
 * Session limits - ShootSync: 10 minutes idle, 12 hours absolute
 *
 * The owner's decision, 29 Oct 2026, by his mantra rather than the standard's 15 minutes absolute:
 * the idle limit is what protects a phone or laptop left unattended, so it is strict and enforced
 * here; the absolute limit means one sign-in lasts a working or shoot day and never overnight,
 * without throwing a captain out mid-task every quarter of an hour.
 *
 * Enforced here, on the server, for every signed-in request, so no browser can get round them.
 *
 * Absolute: a session ends 12 hours after it started, by two independent measures, either of
 * which ends it:
 *   - the token: Clerk's `fva[0]` says how many whole minutes before the token was issued (`iat`)
 *     the user last proved who they are; adding the token's own age gives the time to the second;
 *   - the server's own record of when it first saw the session, which nothing the user does can
 *     reset (verifying again resets `fva`, but never this), and which still works if a token
 *     doesn't carry `fva`.
 * Idle: the server records when each session last made a request. A session quiet for longer
 * than the idle limit is refused from then on, and must sign in again.
 *
 * The browser signs the user out at the same limits and warns them a minute before
 * (src/hooks/useSessionTimeout.ts). While they are busy on a page that isn't saving anything it
 * tells the server they are still there (POST /api/session/ping), at most every
 * pingEveryMinutes; so the server allows that much more quiet before it calls a session idle,
 * and never refuses someone the browser still counts as active.
 */

import type { PrismaClient } from '@prisma/client'

export const SESSION_LIMITS = {
  absoluteMinutes: 12 * 60,
  idleMinutes: 10,
  /** How often, at most, the browser tells the server a busy user is still there. */
  pingEveryMinutes: 2,
} as const

/** The server's idle limit: the browser's, plus the gap between its reports of activity. */
export const SERVER_IDLE_MINUTES = SESSION_LIMITS.idleMinutes + SESSION_LIMITS.pingEveryMinutes

/**
 * Rows are kept this long after a session started: longer than Clerk keeps a session alive (7 days
 * by default), so a session that has been refused can never come back looking new.
 */
export const KEEP_SESSION_ROWS_DAYS = 8

export const SESSION_ENDED_MESSAGES = {
  absolute: 'For security, ShootSync signs you out 12 hours after you sign in. Sign in again to carry on.',
  idle: 'You were signed out after 10 minutes without using ShootSync. Sign in again to carry on.',
} as const

export type SessionEndReason = keyof typeof SESSION_ENDED_MESSAGES

/** What a verified session token says, as far as the session limits need it. */
export interface VerifiedSession {
  userId: string
  sessionId: string
  /** Seconds since the user signed in, by the token; null when the token doesn't say. */
  secondsSinceSignIn: number | null
}

/** Whether the token alone shows the session is past its absolute limit. */
export function absoluteLimitReached(session: VerifiedSession): boolean {
  return session.secondsSinceSignIn !== null && session.secondsSinceSignIn >= SESSION_LIMITS.absoluteMinutes * 60
}

/**
 * Records that the session is being used, unless it must end. One statement, so two requests at
 * once can't race:
 *   - a new session is recorded, with now as when it was first seen;
 *   - a session quiet past the idle limit is left as it is (not refreshed), so it stays refused
 *     until the user signs in again, which starts a new session;
 *   - otherwise it is refreshed, and checked against the absolute limit from when it was first seen.
 */
export async function touchSession(prisma: PrismaClient, sessionId: string): Promise<SessionEndReason | null> {
  const rows = await prisma.$queryRaw<Array<{ inserted: boolean; age_seconds: number }>>`
    INSERT INTO "session_activity" ("session_id", "first_seen_at", "last_seen_at")
    VALUES (${sessionId}, (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC'))
    ON CONFLICT ("session_id") DO UPDATE SET "last_seen_at" = (now() AT TIME ZONE 'UTC')
    WHERE "session_activity"."last_seen_at" > (now() AT TIME ZONE 'UTC') - make_interval(mins => ${SERVER_IDLE_MINUTES}::int)
    RETURNING (xmax = 0) AS "inserted",
              EXTRACT(EPOCH FROM ((now() AT TIME ZONE 'UTC') - "session_activity"."first_seen_at"))::float8 AS "age_seconds"`
  if (rows.length === 0) return 'idle'
  // A new session: clear out rows for sessions long finished, so the table stays small.
  if (rows[0].inserted) {
    await prisma.$executeRaw`DELETE FROM "session_activity" WHERE "first_seen_at" < (now() AT TIME ZONE 'UTC') - make_interval(days => ${KEEP_SESSION_ROWS_DAYS}::int)`
  }
  return rows[0].age_seconds >= SESSION_LIMITS.absoluteMinutes * 60 ? 'absolute' : null
}
