/**
 * Reading the bag from speech: "thirty four pheasants, twelve partridge and five duck".
 *
 * The rule is: never fill in a wrong number. Anything that isn't clearly
 * "<number> <species>" makes the whole phrase unclear, and nothing is filled in.
 *
 * - Browsers write some numbers as digits ("34") and some as words ("five"): both are read.
 * - Numbers in words are read with a strict grammar up to 999: "a hundred and twelve",
 *   "thirty four", "five and twenty". Run-together numbers ("34 12", "twenty twenty"),
 *   "thousand", or a species said before its number ("pheasant 34") are unclear.
 * - "Drive 3, ..." at the start is understood as the drive number and set aside.
 */

export const BAG_SPECIES = ['pheasant', 'partridge', 'duck', 'woodcock', 'other'] as const
export type BagSpecies = (typeof BAG_SPECIES)[number]

const UNITS: Record<string, number> = {
  zero: 0, nil: 0, none: 0, no: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
}
const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
/** Words that are part of a spoken number, including ones we refuse to read (so they make it unclear). */
const NUMBER_WORDS = new Set([...Object.keys(UNITS), ...Object.keys(TEENS), ...Object.keys(TENS), 'hundred', 'and', 'thousand', 'million'])

const isDigits = (w: string) => /^\d+$/.test(w)

/** Under one hundred, in words: "thirty four", "twelve", "five", "five and twenty". Null if not well formed. */
function belowHundred(words: string[]): number | null {
  if (words.length === 1) {
    const [w] = words
    if (w in UNITS) return UNITS[w]
    if (w in TEENS) return TEENS[w]
    if (w in TENS) return TENS[w]
    return null
  }
  if (words.length === 2 && words[0] in TENS && words[1] in UNITS && UNITS[words[1]] > 0 && words[1] !== 'a' && words[1] !== 'an') {
    return TENS[words[0]] + UNITS[words[1]]
  }
  // Old style: "five and twenty"
  if (words.length === 3 && words[0] in UNITS && UNITS[words[0]] > 0 && words[1] === 'and' && words[2] in TENS) {
    return UNITS[words[0]] + TENS[words[2]]
  }
  return null
}

/**
 * A spoken number, read strictly. ["a", "hundred", "and", "twelve"] -> 112; ["34"] -> 34;
 * ["34", "12"], ["twenty", "twenty"], ["one", "thousand"] -> null.
 */
export function wordsToNumber(words: string[]): number | null {
  if (words.length === 0) return null
  if (words.length === 1 && isDigits(words[0])) return Number(words[0])
  const hundred = words.indexOf('hundred')
  if (hundred === -1) return belowHundred(words)
  if (words.lastIndexOf('hundred') !== hundred || hundred !== 1 && hundred !== 0) return null
  const lead = hundred === 0 ? 1 : UNITS[words[0]]
  if (!lead) return null
  const rest = words.slice(hundred + 1)
  if (rest.length === 0) return lead * 100
  const tail = rest[0] === 'and' ? rest.slice(1) : rest
  const small = belowHundred(tail)
  return small === null || small === 0 ? null : lead * 100 + small
}

const SPECIES_WORD: Record<string, BagSpecies> = {
  pheasant: 'pheasant', pheasants: 'pheasant',
  partridge: 'partridge', partridges: 'partridge',
  duck: 'duck', ducks: 'duck', mallard: 'duck',
  woodcock: 'woodcock', woodcocks: 'woodcock',
  other: 'other', others: 'other',
}

export interface BagSpeech {
  counts: Partial<Record<BagSpecies, number>>
  /** The drive number, if the phrase started "drive N". */
  drive?: number
  /** Something couldn't be read with certainty: nothing should be filled in. */
  unclear: boolean
}

/** "34 pheasants twelve partridge and five duck" -> { counts: { pheasant: 34, partridge: 12, duck: 5 } } */
export function parseBagSpeech(text: string): BagSpeech {
  let words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  const result: BagSpeech = { counts: {}, unclear: false }

  // "Drive 3 ..." or "drive three ...": a single number after "drive" is the drive.
  const driveAt = words.indexOf('drive')
  if (driveAt !== -1) {
    const next = words[driveAt + 1]
    const drive = next === undefined ? null : wordsToNumber([next])
    if (drive === null || drive < 1 || drive > 50) return { counts: {}, unclear: true }
    result.drive = drive
    words = [...words.slice(0, driveAt), ...words.slice(driveAt + 2)]
  }

  let previousEnd = 0
  for (let i = 0; i < words.length; i++) {
    const species = SPECIES_WORD[words[i]]
    if (!species) continue
    let start = i
    while (start > previousEnd && (NUMBER_WORDS.has(words[start - 1]) || isDigits(words[start - 1]))) start--
    // "... partridge and five duck": the "and" joins two counts, it isn't part of the number.
    while (start < i && words[start] === 'and') start++
    const value = wordsToNumber(words.slice(start, i))
    // A species with no number before it but one after ("pheasant 34") is said the other way round.
    const followedByNumber = i + 1 < words.length && (isDigits(words[i + 1]) || (NUMBER_WORDS.has(words[i + 1]) && words[i + 1] !== 'and'))
    if (value === null || species in result.counts || value > 100_000) {
      if (start < i || followedByNumber || species in result.counts) result.unclear = true
    } else {
      result.counts[species] = value
    }
    previousEnd = i + 1
  }
  // Numbers left over after the last species ("... 5 duck 12") belong to nothing we understood.
  if (words.slice(previousEnd).some((w) => isDigits(w) || (NUMBER_WORDS.has(w) && w !== 'and'))) result.unclear = true
  if (result.unclear) return { counts: {}, drive: result.drive, unclear: true }
  return result
}
