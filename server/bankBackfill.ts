/**
 * Sealing bank details at boot - ShootSync
 *
 * Runs once each time the server starts, before it takes requests:
 *   - any beater whose numbers are still readable (rows from before 0006) has them sealed and the
 *     readable columns emptied, in one update per beater;
 *   - any sealed value under the previous key (after a rotation) is opened and sealed again under
 *     the current one, so BANK_DETAILS_KEY_PREVIOUS can then be removed.
 *
 * Safe to run any number of times: a row already sealed under the current key is left alone.
 * Nothing about the numbers is logged, only counts.
 */

import type { PrismaClient } from '@prisma/client'
import { keyId, last4, openBankNumbers, sealBankNumbers, sealedKeyId, type BankKeys } from './bankCrypto.js'

export interface BackfillResult {
  sealed: number
  resealed: number
  /** Half a pair (a sort code without an account number, or the reverse): never usable, so cleared. */
  halfCleared: number
  unreadable: string[]
  /** Sealed rows in all, to tell a wrong key (none open) from one damaged row. */
  sealedTotal: number
}

/** Not one sealed row opens: the server has the wrong key, not a damaged row. */
export function wrongKey(result: Pick<BackfillResult, 'sealedTotal' | 'unreadable'>): boolean {
  return result.sealedTotal > 0 && result.unreadable.length === result.sealedTotal
}

export async function sealOutstandingBankDetails(prisma: PrismaClient, keys: BankKeys): Promise<BackfillResult> {
  const result: BackfillResult = { sealed: 0, resealed: 0, halfCleared: 0, unreadable: [], sealedTotal: 0 }
  const currentId = keyId(keys.current)

  const readable = await prisma.beater.findMany({
    where: { OR: [{ bankSortCode: { not: null } }, { bankAccountNumber: { not: null } }] },
    select: { id: true, bankSortCode: true, bankAccountNumber: true, bankDetailsSealed: true },
  })
  for (const row of readable) {
    const complete = row.bankSortCode && row.bankAccountNumber
    // A half-entered pair (one number without the other) was never usable for paying: it is
    // cleared rather than sealed, and a row already sealed keeps its sealed value.
    // Readable numbers are always the newest: this code never writes them, so any present were
    // written by older code (during a deploy's overlap, say) after whatever is sealed.
    const data =
      complete
        ? {
            bankDetailsSealed: sealBankNumbers({ sortCode: row.bankSortCode!, accountNumber: row.bankAccountNumber! }, row.id, keys.current),
            bankAccountLast4: last4(row.bankAccountNumber!),
          }
        : {}
    // Conditional on the readable values still being these, so a change made at the same moment wins.
    await prisma.beater.updateMany({ where: { id: row.id, bankSortCode: row.bankSortCode, bankAccountNumber: row.bankAccountNumber }, data: { ...data, bankSortCode: null, bankAccountNumber: null } })
    if (complete) result.sealed++
    if (!complete) result.halfCleared++
  }

  const sealed = await prisma.beater.findMany({ where: { bankDetailsSealed: { not: null } }, select: { id: true, bankDetailsSealed: true } })
  result.sealedTotal = sealed.length
  for (const row of sealed) {
    if (sealedKeyId(row.bankDetailsSealed!) === currentId) continue
    try {
      const numbers = openBankNumbers(row.bankDetailsSealed!, row.id, keys)
      await prisma.beater.update({ where: { id: row.id }, data: { bankDetailsSealed: sealBankNumbers(numbers, row.id, keys.current) } })
      result.resealed++
    } catch {
      result.unreadable.push(row.id)
    }
  }
  return result
}
