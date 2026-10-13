/**
 * Shooting season dates (Standard §05.7): the rules file pinned to its sources as opened on
 * 13 October 2026, the engine at both sides of each Sunday edge, and the guide held to typing
 * no date of its own.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEASON_RULES } from '../src/data/seasonDates.js'
import {
  christmasDay,
  formatLongDate,
  formatMonthDay,
  formatMonthDayLong,
  formatSeason,
  lastShootingDay,
  seasonDates,
  speciesById,
  weekday,
} from '../src/utils/seasonDates.js'
import { londonDate } from '../src/utils/beaterPayCalculator.js'
import { stripComments } from './sourceText.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const iso = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null

describe('season rules file', () => {
  it('holds the dates GWCT, the Game Act 1831 and the PSNI give, exactly', () => {
    const table = Object.fromEntries(
      SEASON_RULES.species.map((s) => [s.id, [s.seasons.englandWales, s.seasons.scotland, s.seasons.northernIreland].map(formatSeason)])
    )
    assert.deepEqual(table, {
      pheasant: ['1 Oct – 1 Feb', '1 Oct – 1 Feb', '1 Oct – 31 Jan'],
      partridge: ['1 Sep – 1 Feb', '1 Sep – 1 Feb', '1 Sep – 31 Jan'],
      'red-grouse': ['12 Aug – 10 Dec', '12 Aug – 10 Dec', '12 Aug – 30 Nov'],
      'black-grouse': ['20 Aug – 10 Dec', '20 Aug – 10 Dec', 'No open season'],
      ptarmigan: ['No open season', '12 Aug – 10 Dec', 'No open season'],
      woodcock: ['1 Oct – 31 Jan', '1 Sep – 31 Jan', '1 Oct – 31 Jan'],
      snipe: ['12 Aug – 31 Jan', '12 Aug – 31 Jan', '1 Sep – 31 Jan'],
      'duck-inland': ['1 Sep – 31 Jan', '1 Sep – 31 Jan', '1 Sep – 31 Jan'],
      'duck-foreshore': ['1 Sep – 20 Feb', '1 Sep – 20 Feb', '1 Sep – 31 Jan'],
    })
  })

  it('keeps the black grouse exception for Somerset, Devon and the New Forest', () => {
    assert.match(speciesById('black-grouse').note ?? '', /Somerset, Devon and the New Forest.*1 September/)
  })

  it('bans Sunday shooting of game in England and Wales and Northern Ireland, and Christmas Day in England and Wales', () => {
    assert.deepEqual([...SEASON_RULES.noGameOnSunday], ['englandWales', 'northernIreland'])
    assert.deepEqual([...SEASON_RULES.noGameOnChristmasDay], ['englandWales'])
  })

  it('every id is unique and every source is https', () => {
    assert.equal(new Set(SEASON_RULES.species.map((s) => s.id)).size, SEASON_RULES.species.length)
    for (const source of SEASON_RULES.sources) assert.match(source.url, /^https:\/\//)
  })

  it('the season label matches its start year', () => {
    const { label, startYear } = SEASON_RULES.current
    assert.equal(label, `${startYear}/${String(startYear + 1).slice(2)}`)
  })

  it('is not past its summer review (when this fails: re-check the sources, move `current` on a season)', () => {
    const today = londonDate(new Date())
    assert.ok(SEASON_RULES.lastVerified <= today, 'verified in the future')
    assert.ok(today < SEASON_RULES.reviewBy, `season dates due for review on ${SEASON_RULES.reviewBy}`)
  })
})

describe('season dates engine', () => {
  const pheasant = speciesById('pheasant')

  it('the 2026/27 pheasant season: Thursday 1 October 2026 to Monday 1 February 2027', () => {
    const { opens, closes } = seasonDates(pheasant.seasons.englandWales!, 2026)
    assert.equal(formatLongDate(opens), 'Thursday 1 October 2026')
    assert.equal(formatLongDate(closes), 'Monday 1 February 2027')
  })

  it('a season that closes in a later month of the same year closes that year', () => {
    const grouse = seasonDates(speciesById('red-grouse').seasons.englandWales!, 2026)
    assert.equal(iso(grouse.opens), '2026-08-12')
    assert.equal(iso(grouse.closes), '2026-12-10')
  })

  it('a season opening and closing in the same month closes that year, not the next', () => {
    // No real season does this today; pinned so a change to the year rule cannot slip through.
    const sameMonth = seasonDates({ opens: '09-01', closes: '09-30' }, 2026)
    assert.equal(iso(sameMonth.closes), '2026-09-30')
  })

  it('Northern Ireland 2026/27: closes Sunday 31 January, so the last day is Saturday 30 January', () => {
    const open = pheasant.seasons.northernIreland!
    assert.equal(weekday(seasonDates(open, 2026).closes), 'Sunday')
    assert.equal(formatLongDate(lastShootingDay(open, 2026, 'northernIreland')!), 'Saturday 30 January 2027')
  })

  it('England and Wales: a Monday close is the last day; a Sunday close moves it to the Saturday', () => {
    const open = pheasant.seasons.englandWales!
    assert.equal(iso(lastShootingDay(open, 2026, 'englandWales')), '2027-02-01')
    // 1 February 2026 was a Sunday: the 2025/26 season's last day was Saturday 31 January 2026.
    assert.equal(formatLongDate(lastShootingDay(open, 2025, 'englandWales')!), 'Saturday 31 January 2026')
  })

  it('works out no last day for Scotland, whose Sunday rule is species by species', () => {
    assert.equal(lastShootingDay(pheasant.seasons.scotland!, 2025, 'scotland'), null)
  })

  it('Christmas Day 2026 is a Friday', () => {
    assert.equal(weekday(christmasDay(2026)), 'Friday')
  })

  it('formats dates for tables and sentences', () => {
    assert.equal(formatMonthDay('10-01'), '1 Oct')
    assert.equal(formatMonthDayLong('02-01'), '1 February')
    assert.equal(formatSeason(null), 'No open season')
  })
})

describe('the season guide types no date', () => {
  const page = stripComments(readFileSync(path.join(root, 'src/pages/public/guides/SeasonDates.tsx'), 'utf8'))
  const MONTH = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*'

  it('no day-and-month, month-and-day or year written into the page', () => {
    assert.ok(page.includes('SEASON_RULES') && page.length > 3000, 'did not read the guide')
    assert.doesNotMatch(page, new RegExp(`\\b\\d{1,2}(st|nd|th|rd)?\\s+${MONTH}\\b`))
    assert.doesNotMatch(page, new RegExp(`\\b${MONTH}\\s+\\d{1,2}\\b`))
    assert.doesNotMatch(page, /\b20\d\d\b/)
  })

  it('the guard catches dates typed the usual ways', () => {
    for (const planted of ["'opens on 1 October'", "'31st Jan'", "'October 1'", "'in 2027'"]) {
      const bad =
        new RegExp(`\\b\\d{1,2}(st|nd|th|rd)?\\s+${MONTH}\\b`).test(planted) ||
        new RegExp(`\\b${MONTH}\\s+\\d{1,2}\\b`).test(planted) ||
        /\b20\d\d\b/.test(planted)
      assert.ok(bad, planted)
    }
  })
})
