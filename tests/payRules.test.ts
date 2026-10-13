/**
 * Beater pay rules and the calculator engine (Standard §05.7).
 *
 * The figures are pinned to what the GOV.UK pages said when opened on 13 October 2026.
 * The engine is pinned at both sides of every edge: the hour, the penny, the day limit,
 * and the date the rates lapse, in UK time.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CASUAL_BEATERS, MINIMUM_WAGE } from '../src/data/payRules.js'
import {
  AGE_CHOICES,
  DEFAULT_INPUT,
  LIMITS,
  MESSAGES,
  calculate,
  casualRulesInForce,
  formatDuration,
  formatPence,
  formatRuleDate,
  lastDayBefore,
  londonDate,
  minimumForMinutes,
  parseClock,
  parsePounds,
  parseWhole,
  ratesInForce,
  type CalculatorInput,
} from '../src/utils/beaterPayCalculator.js'
import { HMRC_CASUAL_DAY_LIMIT } from '../server/beaterPay.js'

const IN_FORCE = '2026-10-13'
const input = (changes: Partial<CalculatorInput> = {}): CalculatorInput => ({ ...DEFAULT_INPUT, ...changes })
const run = (changes: Partial<CalculatorInput> = {}, today = IN_FORCE) => calculate(input(changes), today)
const result = (changes: Partial<CalculatorInput> = {}, today = IN_FORCE) => {
  const outcome = run(changes, today)
  assert.deepEqual(outcome.errors, [])
  assert.ok(outcome.result)
  return outcome.result
}
const errorFor = (changes: Partial<CalculatorInput>) => {
  const outcome = run(changes)
  assert.equal(outcome.result, null)
  return outcome.errors
}

describe('pay rules file', () => {
  it('holds the April 2026 rates exactly as GOV.UK publishes them', () => {
    assert.deepEqual(
      MINIMUM_WAGE.bands.map((band) => [band.id, band.hourlyPence]),
      [['age21Plus', 1271], ['age18to20', 1085], ['under18', 800], ['apprentice', 800]]
    )
    assert.equal(MINIMUM_WAGE.appliesFrom, '2026-04-01')
    assert.equal(MINIMUM_WAGE.reviewBy, '2027-04-01')
  })

  it('holds HMRC’s casual beater limits as the page states them', () => {
    assert.equal(CASUAL_BEATERS.dayLimit, 14)
    assert.equal(CASUAL_BEATERS.shortEngagementWeeks, 2)
    assert.equal(CASUAL_BEATERS.recordYears, 3)
  })

  it('the server’s 14-day flag and the public pages use the same limit', () => {
    assert.equal(HMRC_CASUAL_DAY_LIMIT, CASUAL_BEATERS.dayLimit)
  })

  it('every rule cites only GOV.UK and legislation.gov.uk, over https', () => {
    for (const source of [...MINIMUM_WAGE.sources, ...CASUAL_BEATERS.sources]) {
      assert.match(source.url, /^https:\/\/www\.(gov|legislation\.gov)\.uk\//, source.url)
      assert.ok(source.label.length > 10)
    }
  })

  it('the rates cite the regulation that sets them, not only GOV.UK’s summary (§05.7)', () => {
    assert.ok(MINIMUM_WAGE.sources.some((source) => source.url === 'https://www.legislation.gov.uk/uksi/2026/357/made'))
  })

  it('each rule was verified before it is due for review, and none is verified in the future', () => {
    const today = londonDate(new Date())
    for (const rule of [MINIMUM_WAGE, CASUAL_BEATERS]) {
      assert.match(rule.lastVerified, /^\d{4}-\d{2}-\d{2}$/)
      assert.match(rule.reviewBy, /^\d{4}-\d{2}-\d{2}$/)
      assert.ok(rule.lastVerified < rule.reviewBy)
      assert.ok(rule.lastVerified <= today, `verified in the future: ${rule.lastVerified}`)
    }
  })

  it('no rule is past its review date (when this fails: open the sources, update payRules.ts)', () => {
    // From 1 April 2027 this goes red until the new rates are checked and entered. The live
    // site shows a review notice in place of the figures on that day without a redeploy.
    const today = londonDate(new Date())
    assert.ok(today < MINIMUM_WAGE.reviewBy, `minimum wage rates lapsed on ${MINIMUM_WAGE.reviewBy}`)
    assert.ok(today < CASUAL_BEATERS.reviewBy, `casual beater rules due for review on ${CASUAL_BEATERS.reviewBy}`)
  })

  it('the age choices are the four GOV.UK bands plus below school leaving age, each once', () => {
    const ids = AGE_CHOICES.map((choice) => choice.id)
    assert.deepEqual(ids, ['age21Plus', 'age18to20', 'under18', 'apprentice', 'belowSchoolAge'])
  })
})

describe('dates: the rates change at midnight UK time', () => {
  it('rates apply from their first day up to the day before the review date', () => {
    assert.equal(ratesInForce('2026-03-31'), null)
    assert.ok(ratesInForce('2026-04-01'))
    assert.ok(ratesInForce('2027-03-31'))
    assert.equal(ratesInForce('2027-04-01'), null)
  })

  it('HMRC’s rules apply until the new tax year starts', () => {
    assert.ok(casualRulesInForce('2027-04-05'))
    assert.equal(casualRulesInForce('2027-04-06'), null)
  })

  it('reads the UK date, in summer time, either side of midnight on 31 March 2027', () => {
    // British Summer Time starts on 28 March 2027, so UK midnight is 23:00 UTC.
    assert.equal(londonDate(new Date('2027-03-31T22:59:59Z')), '2027-03-31')
    assert.equal(londonDate(new Date('2027-03-31T23:00:00Z')), '2027-04-01')
    assert.ok(ratesInForce(londonDate(new Date('2027-03-31T22:59:59Z'))))
    assert.equal(ratesInForce(londonDate(new Date('2027-03-31T23:00:00Z'))), null)
  })

  it('reads the UK date in winter, when the UK is on UTC', () => {
    assert.equal(londonDate(new Date('2026-12-31T23:59:59Z')), '2026-12-31')
    assert.equal(londonDate(new Date('2027-01-01T00:00:00Z')), '2027-01-01')
  })

  it('formats rule dates the same everywhere', () => {
    assert.equal(formatRuleDate('2027-04-01'), '1 April 2027')
    assert.equal(lastDayBefore('2027-04-01'), '2027-03-31')
    assert.equal(lastDayBefore('2027-03-01'), '2027-02-28')
  })
})

describe('reading what is typed', () => {
  it('times: 24-hour HH:MM only', () => {
    assert.equal(parseClock('08:30'), 510)
    assert.equal(parseClock('8:30'), 510)
    assert.equal(parseClock(' 23:59 '), 1439)
    assert.equal(parseClock('00:00'), 0)
    for (const bad of ['24:00', '08:60', '0830', '8.30', '', 'noon', '08:30pm']) assert.equal(parseClock(bad), null, bad)
  })

  it('money: pounds, pounds and pence, a pound sign, and thousands commas', () => {
    assert.equal(parsePounds('60'), 6000)
    assert.equal(parsePounds('£62.50'), 6250)
    assert.equal(parsePounds('62.5'), 6250)
    assert.equal(parsePounds(' £ 76.26 '), 7626)
    assert.equal(parsePounds('1,000'), 100000)
    assert.equal(parsePounds('1,000.50'), 100050)
  })

  it('money: a comma is never read as a decimal point', () => {
    assert.equal(parsePounds('62,50'), null)
    assert.equal(parsePounds('6,50'), null)
    assert.equal(parsePounds('1,00'), null)
  })

  it('money: refuses anything else', () => {
    for (const bad of ['', 'sixty', '62.505', '-60', '60p', '£', '.50', '1e3']) assert.equal(parsePounds(bad), null, bad)
  })

  it('whole numbers: inside the range only', () => {
    assert.equal(parseWhole('14', 1, 200), 14)
    assert.equal(parseWhole('1', 1, 200), 1)
    assert.equal(parseWhole('200', 1, 200), 200)
    for (const bad of ['0', '201', '3.5', '-1', '', 'ten', '1e2']) assert.equal(parseWhole(bad, 1, 200), null, bad)
  })
})

describe('the minimum for a day', () => {
  it('the guide’s example: meet 8.30, an hour’s lunch, finish 3.30 is six hours and £76.26 at 21 and over', () => {
    const r = result()
    assert.equal(r.minutesWorked, 360)
    assert.equal(r.wage?.hourlyPence, 1271)
    assert.equal(r.wage?.minimumDayPence, 7626)
  })

  it('rounds a part-penny up, because the minimum is a floor', () => {
    // 6 hours 15 minutes at £12.71 is £79.4375: anything less than £79.44 is below the minimum.
    assert.equal(minimumForMinutes(375, 1271), 7944)
    assert.equal(result({ finish: '15:45' }).wage?.minimumDayPence, 7944)
  })

  it('rounds up even when the part-penny is under a half', () => {
    // 6 hours 1 minute at £12.71 is £76.4818...: rounding to the nearest penny would give £76.47, a penny short.
    assert.equal(minimumForMinutes(361, 1271), 7648)
    const day = result({ finish: '15:31', dayRate: '76.47' })
    assert.equal(day.wage?.minimumDayPence, 7648)
    assert.equal(day.dayRate?.meetsMinimum, false)
    assert.equal(day.dayRate?.shortfallPerDayPence, 1)
  })

  it('uses the rate for the age band chosen', () => {
    assert.equal(result({ age: 'age18to20' }).wage?.minimumDayPence, 6510)
    assert.equal(result({ age: 'under18' }).wage?.minimumDayPence, 4800)
    assert.equal(result({ age: 'apprentice' }).wage?.minimumDayPence, 4800)
  })

  it('below school leaving age there is no minimum, and nothing is called short', () => {
    const r = result({ age: 'belowSchoolAge', dayRate: '20' })
    assert.equal(r.wage?.bandLabel, null)
    assert.equal(r.wage?.hourlyPence, null)
    assert.equal(r.wage?.minimumDayPence, null)
    assert.equal(r.dayRate?.meetsMinimum, null)
    assert.equal(r.dayRate?.shortfallPerDayPence, 0)
  })

  it('a blank break counts as no break', () => {
    assert.equal(result({ breakMinutes: '' }).minutesWorked, 420)
    assert.equal(result({ breakMinutes: '0' }).minutesWorked, 420)
  })
})

describe('checking a day rate', () => {
  it('exactly the minimum meets it; a penny less is a penny short', () => {
    const exact = result({ dayRate: '76.26' }).dayRate
    assert.equal(exact?.meetsMinimum, true)
    assert.equal(exact?.shortfallPerDayPence, 0)
    const short = result({ dayRate: '76.25' }).dayRate
    assert.equal(short?.meetsMinimum, false)
    assert.equal(short?.shortfallPerDayPence, 1)
  })

  it('on a part-penny day, the rounded-up minimum meets it and a penny less does not', () => {
    assert.equal(result({ finish: '15:45', dayRate: '79.44' }).dayRate?.meetsMinimum, true)
    const short = result({ finish: '15:45', dayRate: '79.43' }).dayRate
    assert.equal(short?.meetsMinimum, false)
    assert.equal(short?.shortfallPerDayPence, 1)
  })

  it('a £50 day over six hours averages £8.33 an hour, £26.26 short at 21 and over', () => {
    const r = result({ dayRate: '50' }).dayRate
    assert.equal(r?.averageHourlyPence, 833)
    assert.equal(r?.meetsMinimum, false)
    assert.equal(r?.shortfallPerDayPence, 2626)
  })

  it('the average hourly figure is rounded down, so it never flatters the rate', () => {
    // £80 over 6 hours 15 minutes is £12.80 exactly; over 6 hours 20 minutes it is £12.6315...
    assert.equal(result({ finish: '15:45', dayRate: '80' }).dayRate?.averageHourlyPence, 1280)
    assert.equal(result({ finish: '15:50', dayRate: '80' }).dayRate?.averageHourlyPence, 1263)
    // £62.50 over 6 hours is £10.4166...: shown as £10.41, never rounded up to £10.42.
    assert.equal(result({ dayRate: '62.50' }).dayRate?.averageHourlyPence, 1041)
  })

  it('a rate well above the minimum is shown as meeting it with nothing short', () => {
    const r = result({ dayRate: '90' }).dayRate
    assert.equal(r?.meetsMinimum, true)
    assert.equal(r?.shortfallPerDayPence, 0)
  })

  it('no day rate entered means no verdict, not a failure', () => {
    assert.equal(result().dayRate, null)
  })
})

describe('the season', () => {
  it('works out the wage bill, the legal minimum and the shortfall across every beater-day', () => {
    const season = result({ dayRate: '50', shootDays: '12', beatersPerDay: '10' }).season
    assert.equal(season?.billPence, 50 * 100 * 120)
    assert.equal(season?.minimumBillPence, 7626 * 120)
    assert.equal(season?.shortfallPence, 2626 * 120)
    assert.equal(season?.beatersEntered, true)
  })

  it('with the number of beaters left blank, works it out per beater', () => {
    const season = result({ dayRate: '60', shootDays: '12' }).season
    assert.equal(season?.beatersPerDay, 1)
    assert.equal(season?.beatersEntered, false)
    assert.equal(season?.billPence, 6000 * 12)
  })

  it('without a day rate, gives the minimum bill and no shortfall', () => {
    const season = result({ shootDays: '10', beatersPerDay: '8' }).season
    assert.equal(season?.billPence, null)
    assert.equal(season?.minimumBillPence, 7626 * 80)
    assert.equal(season?.shortfallPence, null)
  })

  it('no shoot days entered means no season figures', () => {
    assert.equal(result({ dayRate: '60', beatersPerDay: '10' }).season, null)
  })

  it('HMRC’s limit: 14 days is within it; the 15th day is over', () => {
    assert.equal(result({ shootDays: '14' }).season?.paye?.overLimit, false)
    const over = result({ shootDays: '15' }).season?.paye
    assert.equal(over?.overLimit, true)
    assert.equal(over?.limit, 14)
  })
})

describe('once the rates lapse', () => {
  it('shows no minimum and no verdict, but still works out the hours and the bill', () => {
    const r = result({ dayRate: '50', shootDays: '15', beatersPerDay: '2' }, '2027-04-01')
    assert.equal(r.minutesWorked, 360)
    assert.equal(r.wage, null)
    assert.equal(r.dayRate?.meetsMinimum, null)
    assert.equal(r.dayRate?.shortfallPerDayPence, 0)
    assert.equal(r.season?.billPence, 5000 * 30)
    assert.equal(r.season?.minimumBillPence, null)
    assert.equal(r.season?.shortfallPence, null)
  })

  it('keeps HMRC’s day limit until the new tax year, then drops it too', () => {
    assert.equal(result({ shootDays: '15' }, '2027-04-05').season?.paye?.overLimit, true)
    assert.equal(result({ shootDays: '15' }, '2027-04-06').season?.paye, null)
  })

  it('the last day of the rates still gives the figures', () => {
    assert.equal(result({}, '2027-03-31').wage?.minimumDayPence, 7626)
  })
})

describe('refusing what cannot be worked out', () => {
  it('names each bad field with its own message', () => {
    assert.deepEqual(errorFor({ meet: '8.30' }), [{ field: 'meet', message: MESSAGES.meet }])
    assert.deepEqual(errorFor({ finish: '' }), [{ field: 'finish', message: MESSAGES.finish }])
    assert.deepEqual(errorFor({ breakMinutes: 'an hour' }), [{ field: 'breakMinutes', message: MESSAGES.breakMinutes }])
    assert.deepEqual(errorFor({ age: 'over65' }), [{ field: 'age', message: MESSAGES.age }])
    assert.deepEqual(errorFor({ dayRate: '62,50' }), [{ field: 'dayRate', message: MESSAGES.dayRate }])
    assert.deepEqual(errorFor({ shootDays: '0' }), [{ field: 'shootDays', message: MESSAGES.shootDays }])
    assert.deepEqual(errorFor({ beatersPerDay: '2.5' }), [{ field: 'beatersPerDay', message: MESSAGES.beatersPerDay }])
  })

  it('a finish at or before the meet is refused', () => {
    assert.deepEqual(errorFor({ finish: '08:30' }), [{ field: 'finish', message: MESSAGES.finishBeforeMeet }])
    assert.deepEqual(errorFor({ finish: '07:00' }), [{ field: 'finish', message: MESSAGES.finishBeforeMeet }])
  })

  it('a break as long as the day is refused; a minute shorter is allowed', () => {
    assert.deepEqual(errorFor({ breakMinutes: '420' }), [{ field: 'breakMinutes', message: MESSAGES.breakTooLong }])
    assert.equal(result({ breakMinutes: '419' }).minutesWorked, 1)
  })

  it('the break limit is inclusive', () => {
    assert.equal(result({ meet: '06:00', finish: '23:00', breakMinutes: String(LIMITS.maxBreakMinutes) }).minutesWorked, 420)
    assert.deepEqual(errorFor({ meet: '06:00', finish: '23:00', breakMinutes: String(LIMITS.maxBreakMinutes + 1) }), [
      { field: 'breakMinutes', message: MESSAGES.breakMinutes },
    ])
  })

  it('a day rate of nothing, or over £1,000, is refused; £1,000 itself is allowed', () => {
    assert.deepEqual(errorFor({ dayRate: '0' }), [{ field: 'dayRate', message: MESSAGES.dayRate }])
    assert.deepEqual(errorFor({ dayRate: '1,000.01' }), [{ field: 'dayRate', message: MESSAGES.dayRate }])
    assert.equal(result({ dayRate: '1,000' }).dayRate?.pence, LIMITS.maxDayRatePence)
  })

  it('reports every bad field at once, so nobody fixes them one at a time', () => {
    const fields = errorFor({ meet: 'x', breakMinutes: 'y', dayRate: 'z', shootDays: '0', beatersPerDay: '0' }).map((e) => e.field)
    assert.deepEqual(fields, ['meet', 'breakMinutes', 'dayRate', 'shootDays', 'beatersPerDay'])
  })
})

describe('how figures read', () => {
  it('money in pounds and pence', () => {
    assert.equal(formatPence(7626), '£76.26')
    assert.equal(formatPence(6000), '£60.00')
    assert.equal(formatPence(915120), '£9,151.20')
    assert.equal(formatPence(0), '£0.00')
  })

  it('hours and minutes in words', () => {
    assert.equal(formatDuration(360), '6 hours')
    assert.equal(formatDuration(375), '6 hours 15 minutes')
    assert.equal(formatDuration(61), '1 hour 1 minute')
    assert.equal(formatDuration(45), '45 minutes')
    assert.equal(formatDuration(1), '1 minute')
  })
})
