/**
 * Peg draw - ShootSync
 *
 * Pure functions, no database: the routes in routes/shoots.ts load the season's
 * history and call these. Kept separate so every rule can be unit-tested.
 *
 * Fair draw: each gun gets a starting peg so that, across everyone at once, guns
 * repeat pegs they have already stood on as little as possible this season.
 *   - It is an optimal assignment (the Hungarian method), not a first-come greedy
 *     loop, so one gun's choice never forces a worse result on the rest.
 *   - Repeats are weighted by the square of how often a gun has had a peg, so a
 *     third time on the same peg counts for more than a second.
 *   - Ties are broken at random, so the first shoot of a season is a genuine draw,
 *     and a jitter can never outweigh a single repeat.
 */

export type Rng = () => number

export interface PegHistoryEntry {
  memberId: string
  pegNumber: number
}

export interface PegAllocation {
  memberId: string
  pegNumber: number
}

/** Fisher-Yates shuffle with an injectable random source (so tests are repeatable). */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const pegNumbers = (numberOfPegs: number) => Array.from({ length: numberOfPegs }, (_, i) => i + 1)

function assertDrawable(memberIds: readonly string[], numberOfPegs: number) {
  if (!Number.isInteger(numberOfPegs) || numberOfPegs < 1) throw new RangeError('There must be at least one peg')
  if (new Set(memberIds).size !== memberIds.length) throw new RangeError('A gun is listed twice')
  if (memberIds.length > numberOfPegs) throw new RangeError('There are more guns than pegs')
}

/** Random draw: every gun gets a different peg between 1 and numberOfPegs. */
export function randomDraw(memberIds: readonly string[], numberOfPegs: number, rng: Rng = Math.random): PegAllocation[] {
  assertDrawable(memberIds, numberOfPegs)
  const pegs = shuffle(pegNumbers(numberOfPegs), rng)
  return memberIds.map((memberId, i) => ({ memberId, pegNumber: pegs[i] })).sort((a, b) => a.pegNumber - b.pegNumber)
}

/** How many times each gun has stood on each peg. */
export function pegCounts(history: readonly PegHistoryEntry[]): Map<string, Map<number, number>> {
  const counts = new Map<string, Map<number, number>>()
  for (const { memberId, pegNumber } of history) {
    const forMember = counts.get(memberId) ?? new Map<number, number>()
    forMember.set(pegNumber, (forMember.get(pegNumber) ?? 0) + 1)
    counts.set(memberId, forMember)
  }
  return counts
}

/** Fair draw: minimum total repeat cost over the whole line, random among equally fair answers. */
export function fairDraw(
  memberIds: readonly string[],
  numberOfPegs: number,
  history: readonly PegHistoryEntry[],
  rng: Rng = Math.random
): PegAllocation[] {
  assertDrawable(memberIds, numberOfPegs)
  if (memberIds.length === 0) return []

  const counts = pegCounts(history)
  const pegs = pegNumbers(numberOfPegs)
  const JITTER = 1000
  // Every gun's jitter together stays below the cost of one extra repeat.
  const REPEAT = JITTER * memberIds.length

  const cost = memberIds.map((memberId) =>
    pegs.map((peg) => {
      const had = counts.get(memberId)?.get(peg) ?? 0
      return had * had * REPEAT + Math.floor(rng() * JITTER)
    })
  )

  const pegIndexFor = hungarian(cost)
  return memberIds.map((memberId, i) => ({ memberId, pegNumber: pegs[pegIndexFor[i]] })).sort((a, b) => a.pegNumber - b.pegNumber)
}

/** Total repeat cost of an allocation (the quantity fairDraw minimises, without jitter). */
export function repeatCost(allocations: readonly PegAllocation[], history: readonly PegHistoryEntry[]): number {
  const counts = pegCounts(history)
  return allocations.reduce((sum, { memberId, pegNumber }) => {
    const had = counts.get(memberId)?.get(pegNumber) ?? 0
    return sum + had * had
  }, 0)
}

/**
 * Minimum-cost assignment of n rows to distinct columns (n <= m), O(n^2 m).
 * Returns, for each row, the column it is assigned.
 */
export function hungarian(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length
  const m = cost[0]?.length ?? 0
  if (n > m) throw new RangeError('More rows than columns')
  const u = new Array<number>(n + 1).fill(0)
  const v = new Array<number>(m + 1).fill(0)
  const p = new Array<number>(m + 1).fill(0) // p[col] = row assigned to col (1-based), 0 = none
  const way = new Array<number>(m + 1).fill(0)

  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array<number>(m + 1).fill(Infinity)
    const used = new Array<boolean>(m + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else {
          minv[j] -= delta
        }
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0 !== 0)
  }

  const result = new Array<number>(n).fill(-1)
  for (let j = 1; j <= m; j++) if (p[j] !== 0) result[p[j] - 1] = j - 1
  return result
}
