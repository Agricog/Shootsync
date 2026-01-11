/**
 * Peg Allocation Algorithm - ShootSync
 * Fair rotation algorithm for peg allocation
 */

interface Member {
  id: string
  name: string
}

interface PegHistory {
  memberId: string
  pegNumber: number
  shootDate: string
}

interface Allocation {
  memberId: string
  memberName: string
  pegNumber: number
}

/**
 * Generate fair peg allocation based on history
 * Members who have had a peg least often get priority for that peg
 */
export function generateFairPegAllocation(
  members: Member[],
  history: PegHistory[],
  numberOfPegs: number
): Allocation[] {
  if (members.length === 0) return []

  // Count how many times each member has had each peg
  const pegCounts: Record<string, Record<number, number>> = {}

  members.forEach(m => {
    pegCounts[m.id] = {}
    for (let p = 1; p <= numberOfPegs; p++) {
      pegCounts[m.id][p] = 0
    }
  })

  history.forEach(h => {
    if (pegCounts[h.memberId] && pegCounts[h.memberId][h.pegNumber] !== undefined) {
      pegCounts[h.memberId][h.pegNumber]++
    }
  })

  const allocations: Allocation[] = []
  const assignedPegs = new Set<number>()
  const assignedMembers = new Set<string>()

  // Sort members by total shoots attended (ascending) for fairness
  const sortedMembers = [...members].sort((a, b) => {
    const aTotal = Object.values(pegCounts[a.id]).reduce((sum, c) => sum + c, 0)
    const bTotal = Object.values(pegCounts[b.id]).reduce((sum, c) => sum + c, 0)
    return aTotal - bTotal
  })

  // Allocate pegs
  sortedMembers.forEach(member => {
    if (assignedMembers.has(member.id)) return

    // Find the peg this member has had least often
    let bestPeg = 1
    let lowestCount = Infinity

    for (let p = 1; p <= numberOfPegs; p++) {
      if (!assignedPegs.has(p)) {
        const count = pegCounts[member.id][p]
        if (count < lowestCount) {
          lowestCount = count
          bestPeg = p
        }
      }
    }

    if (!assignedPegs.has(bestPeg)) {
      allocations.push({
        memberId: member.id,
        memberName: member.name,
        pegNumber: bestPeg,
      })
      assignedPegs.add(bestPeg)
      assignedMembers.add(member.id)
    }
  })

  return allocations.sort((a, b) => a.pegNumber - b.pegNumber)
}

/**
 * Calculate fairness score (0-100)
 * Higher score = more even distribution
 */
export function calculateFairnessScore(
  members: Member[],
  history: PegHistory[]
): number {
  if (history.length === 0 || members.length === 0) return 100

  // Calculate standard deviation of peg distributions per member
  const memberPegCounts: Record<string, number> = {}

  members.forEach(m => {
    memberPegCounts[m.id] = history.filter(h => h.memberId === m.id).length
  })

  const counts = Object.values(memberPegCounts)
  if (counts.length === 0) return 100

  const mean = counts.reduce((a, b) => a + b, 0) / counts.length
  const variance = counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length
  const stdDev = Math.sqrt(variance)

  // Convert to 0-100 score (lower stdDev = higher score)
  const score = Math.max(0, 100 - stdDev * 20)
  return Math.round(score)
}

/**
 * Get peg distribution summary for a member
 */
export function getMemberPegDistribution(
  memberId: string,
  history: PegHistory[],
  numberOfPegs: number
): Record<number, number> {
  const distribution: Record<number, number> = {}

  for (let p = 1; p <= numberOfPegs; p++) {
    distribution[p] = 0
  }

  history
    .filter(h => h.memberId === memberId)
    .forEach(h => {
      if (distribution[h.pegNumber] !== undefined) {
        distribution[h.pegNumber]++
      }
    })

  return distribution
}

/**
 * Random peg allocation (alternative to fair rotation)
 */
export function generateRandomAllocation(
  members: Member[],
  numberOfPegs: number
): Allocation[] {
  const shuffled = [...members].sort(() => Math.random() - 0.5)
  const pegs = Array.from({ length: numberOfPegs }, (_, i) => i + 1)
  const shuffledPegs = pegs.sort(() => Math.random() - 0.5)

  return shuffled.slice(0, numberOfPegs).map((member, index) => ({
    memberId: member.id,
    memberName: member.name,
    pegNumber: shuffledPegs[index],
  })).sort((a, b) => a.pegNumber - b.pegNumber)
}
