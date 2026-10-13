/**
 * The beater pay calculator page's words (Standard §05.1, §05.7).
 * The page itself is checked as built by scripts/check-built-site.mjs.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MINIMUM_WAGE } from '../src/data/payRules.js'
import {
  CALCULATOR_DESCRIPTION,
  CALCULATOR_PATH,
  CALCULATOR_TITLE,
  EXAMPLE_FLAT_RATE_MINUTES,
  EXAMPLE_FLAT_RATE_PENCE,
  TABLE_MINUTES,
  calculatorFaqs,
  quickAnswer,
} from '../src/content/beaterPayCalculator.js'
import { calculate, DEFAULT_INPUT, formatPence } from '../src/utils/beaterPayCalculator.js'

describe('calculator page: search and sharing', () => {
  it('title is 55-60 characters and ends with the brand', () => {
    assert.ok(CALCULATOR_TITLE.length >= 55 && CALCULATOR_TITLE.length <= 60, `${CALCULATOR_TITLE.length}: ${CALCULATOR_TITLE}`)
    assert.ok(CALCULATOR_TITLE.endsWith(' | ShootSync'))
  })

  it('description is 150-160 characters', () => {
    assert.ok(CALCULATOR_DESCRIPTION.length >= 150 && CALCULATOR_DESCRIPTION.length <= 160, String(CALCULATOR_DESCRIPTION.length))
  })

  it('lives at one safe address under /tools', () => {
    assert.match(CALCULATOR_PATH, /^\/tools\/[a-z0-9-]+$/)
  })
})

describe('calculator page: the quick answer', () => {
  it('is 120-160 characters, with the rates and once they lapse', () => {
    for (const answer of [quickAnswer(MINIMUM_WAGE), quickAnswer(null)]) {
      assert.ok(answer.length >= 120 && answer.length <= 160, `${answer.length}: ${answer}`)
    }
  })

  it('states the adult rate and the six-hour day from the rules', () => {
    const answer = quickAnswer(MINIMUM_WAGE)
    assert.match(answer, /£12\.71 an hour/)
    assert.match(answer, /£76\.26 for a six-hour day/)
    assert.match(answer, /From April 2026/)
  })

  it('states no figure once the rates lapse', () => {
    assert.doesNotMatch(quickAnswer(null), /£|\d/)
  })

  it('agrees with what the calculator shows on opening', () => {
    const opening = calculate(DEFAULT_INPUT, '2026-10-13').result
    assert.ok(opening?.wage?.minimumDayPence)
    assert.ok(quickAnswer(MINIMUM_WAGE).includes(formatPence(opening.wage.minimumDayPence)))
  })
})

describe('calculator page: questions and answers', () => {
  for (const [name, faqs] of [
    ['with the rates', calculatorFaqs(MINIMUM_WAGE)],
    ['once they lapse', calculatorFaqs(null)],
  ] as const) {
    it(`10-15 distinct questions, each answered in full (${name})`, () => {
      assert.ok(faqs.length >= 10 && faqs.length <= 15, String(faqs.length))
      assert.equal(new Set(faqs.map((faq) => faq.question)).size, faqs.length)
      for (const faq of faqs) {
        assert.ok(faq.question.endsWith('?'), faq.question)
        assert.ok(faq.answer.length >= 100 && faq.answer.length <= 500, `${faq.answer.length}: ${faq.question}`)
      }
    })
  }

  it('the same questions are asked whether or not the rates are current', () => {
    assert.deepEqual(
      calculatorFaqs(MINIMUM_WAGE).map((faq) => faq.question),
      calculatorFaqs(null).map((faq) => faq.question)
    )
  })

  it('once the rates lapse, no answer states a minimum wage figure', () => {
    for (const faq of calculatorFaqs(null)) assert.doesNotMatch(faq.answer, /£/, faq.question)
  })

  it('the flat-rate example is the engine’s own answer, and is below the adult rate', () => {
    const answer = calculatorFaqs(MINIMUM_WAGE).find((faq) => faq.question === 'Is a flat day rate allowed?')!.answer
    assert.match(answer, /£60\.00 for a day of 7 hours is £8\.57 an hour, which is below the £12\.71 rate/)
    const check = calculate({ ...DEFAULT_INPUT, meet: '08:00', finish: '15:00', breakMinutes: '0', dayRate: String(EXAMPLE_FLAT_RATE_PENCE / 100) }, '2026-10-13')
    assert.equal(check.result?.minutesWorked, EXAMPLE_FLAT_RATE_MINUTES)
    assert.equal(check.result?.dayRate?.averageHourlyPence, 857)
    assert.equal(check.result?.dayRate?.meetsMinimum, false)
  })

  it('the HMRC questions name the limit from the rules', () => {
    const faqs = calculatorFaqs(MINIMUM_WAGE)
    assert.ok(faqs.some((faq) => faq.question === 'What is HMRC’s 14-day rule for beaters?'))
    assert.ok(faqs.some((faq) => /within the 14-day limit/.test(faq.answer)))
  })
})

describe('calculator page: the reference table', () => {
  it('runs from five to eight hours by the half hour', () => {
    assert.deepEqual([...TABLE_MINUTES], [300, 330, 360, 390, 420, 450, 480])
  })
})
