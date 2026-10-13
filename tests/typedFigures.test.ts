/**
 * No regulatory figure is typed into a page (Standard §05.7).
 *
 * The minimum wage rates and HMRC's casual beater limit live in src/data/payRules.ts.
 * This reads every source file under src/ (comments stripped, everything else kept:
 * meta descriptions, FAQ answers, prop strings) and fails on any of those figures typed
 * as text. The pages that explain pay are held to more: no pound figure at all.
 *
 * When this fails: import the figure from src/data/payRules.ts (or work it out with
 * src/utils/beaterPayCalculator.ts) instead of typing it.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './sourceText.js'
import { CASUAL_BEATERS, MINIMUM_WAGE } from '../src/data/payRules.js'
import { minimumForMinutes } from '../src/utils/beaterPayCalculator.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULES_FILE = 'src/data/payRules.ts'

/**
 * Pages, components and page copy whose whole subject is pay: no pound figure may be typed in them.
 * Found by name, so a new tool page or pay component is covered without anyone listing it.
 * (The engine in src/utils and the rules in src/data are where figures are allowed to live.)
 */
const PAY_PAGE = /^src\/(pages|components|content)\/(.*\/)?(tools\/.*|[^/]*(PayingBeaters|RatesReviewNotice|beaterPay|BeaterPay)[^/]*)\.(ts|tsx)$/

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`
    if (statSync(path.join(root, rel)).isDirectory()) return sourceFiles(rel)
    return /\.(ts|tsx)$/.test(name) ? [rel] : []
  })
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']

/** On the pay pages: any pound figure, and any pounds-and-pence amount (but not a time like 8.30am). */
const POUND_FIGURE = /£\s?\d/
const PENCE_AMOUNT = /(?<![\w.])\d+\.\d{2}(?!\d|\s?[ap]m\b)/i

const pounds = (pence: number) => (pence / 100).toFixed(2)

/** Every way a rule's figure could be typed. Built from the rules, so a new rate is guarded too. */
function typedFigurePatterns(): Array<{ name: string; pattern: RegExp }> {
  const patterns: Array<{ name: string; pattern: RegExp }> = []
  for (const band of MINIMUM_WAGE.bands) {
    const decimal = pounds(band.hourlyPence).replace('.', '\\.')
    patterns.push({ name: `${band.label} hourly rate`, pattern: new RegExp(`(?<![\\d.])${decimal}(?!\\d)`) })
    if (band.hourlyPence % 100 === 0) {
      patterns.push({ name: `${band.label} hourly rate in whole pounds`, pattern: new RegExp(`£${band.hourlyPence / 100}(?![\\d.,])`) })
    }
    const sixHours = pounds(minimumForMinutes(360, band.hourlyPence)).replace('.', '\\.')
    patterns.push({ name: `${band.label} six-hour day`, pattern: new RegExp(`(?<![\\d.])${sixHours}(?!\\d)`) })
  }
  const limit = CASUAL_BEATERS.dayLimit
  // "14-day", "14 days", "14{' '}days" (a JSX line break), and the number written as a word.
  const spelled = [String(limit), NUMBER_WORDS[limit]].filter(Boolean).join('|')
  patterns.push({ name: 'HMRC day limit', pattern: new RegExp(`(?<![\\d\\w])(?:${spelled})(?:[- ]day|\\s+days|\\{' '\\}\\s*days)\\b`, 'i') })
  return patterns
}

describe('regulatory figures are never typed into the site', () => {
  const files = sourceFiles('src').filter((file) => file !== RULES_FILE)

  it('reads the whole site source, not an empty list', () => {
    assert.ok(files.length > 50, `only ${files.length} files read`)
    assert.ok(files.includes('src/pages/public/guides/PayingBeaters.tsx'))
    assert.ok(files.includes('src/content/faq.ts'))
  })

  it('no minimum wage rate, six-hour minimum or HMRC day limit is typed outside the rules file', () => {
    const found: string[] = []
    for (const file of files) {
      const code = stripComments(readFileSync(path.join(root, file), 'utf8'), file)
      for (const { name, pattern } of typedFigurePatterns()) {
        if (pattern.test(code)) found.push(`${file}: ${name} (${pattern.source})`)
      }
    }
    assert.deepEqual(found, [], `typed figures found:\n${found.join('\n')}`)
  })

  it('the pages about pay type no pound figure and no pence amount at all', () => {
    const payPages = files.filter((file) => PAY_PAGE.test(file))
    assert.ok(payPages.includes('src/pages/public/guides/PayingBeaters.tsx'), `pay pages found: ${payPages.join(', ')}`)
    assert.ok(payPages.includes('src/components/public/RatesReviewNotice.tsx'))
    for (const file of payPages) {
      const code = stripComments(readFileSync(path.join(root, file), 'utf8'), file)
      assert.doesNotMatch(code, POUND_FIGURE, `${file} types a pound figure`)
      assert.doesNotMatch(code, PENCE_AMOUNT, `${file} types an amount in pounds and pence`)
    }
  })
})

describe('the guard itself', () => {
  const caught = (code: string) => typedFigurePatterns().some(({ pattern }) => pattern.test(stripComments(code)))

  it('catches each figure typed the ways a person would type it', () => {
    for (const planted of [
      "'From April 2026 that is £12.71 an hour'",
      "'£10.85 for 18 to 20 year olds'",
      "'Under 18: £8 an hour'",
      "'apprentices get £8.00'",
      "'£76.26 for a six-hour day'",
      "'a flag past HMRC’s 14-day casual limit'",
      "'more than 14 days in a tax year'",
      "<p>more than 14{' '}days in a tax year</p>",
      "'not more than fourteen days'",
      "'a fourteen-day limit'",
      'description="Pay at least 12.71 an hour"',
    ]) {
      assert.ok(caught(planted), planted)
    }
  })

  it('leaves near-misses alone', () => {
    for (const fine of [
      "'£80 a day'",
      "'£112.71'",
      "'14 December'",
      "'meet at 08:00'",
      "'a 140-day season'",
      "'peg 14'",
      "'£8,000 a season'",
      "'£85'",
      "'114 days'",
      "'the 14th day'",
    ]) {
      assert.ok(!caught(fine), fine)
    }
  })

  it('finds pay pages by name, and leaves the engine and the rules file to hold figures', () => {
    for (const file of [
      'src/pages/public/tools/BeaterPayCalculator.tsx',
      'src/pages/public/tools/SyndicateCostCalculator.tsx',
      'src/content/beaterPayCalculator.ts',
      'src/components/public/RatesReviewNotice.tsx',
      'src/pages/public/guides/PayingBeaters.tsx',
    ]) {
      assert.ok(PAY_PAGE.test(file), file)
    }
    for (const file of ['src/utils/beaterPayCalculator.ts', 'src/data/payRules.ts', 'src/pages/public/Pricing.tsx', 'src/pages/captain/Beaters.tsx']) {
      assert.ok(!PAY_PAGE.test(file), file)
    }
  })

  it('on the pay pages, catches any pound figure or pence amount, but not a time of day', () => {
    for (const planted of ["'£60 a day'", "'£ 45'", "'a 62.50 day rate'", "'76.26'"]) {
      assert.ok(POUND_FIGURE.test(planted) || PENCE_AMOUNT.test(planted), planted)
    }
    for (const fine of ["'meets at 8.30am'", "'finishes at 3.30 pm'", "'version 1.2'", "'the 2026/27 season'"]) {
      assert.ok(!POUND_FIGURE.test(fine) && !PENCE_AMOUNT.test(fine), fine)
    }
  })

  it('ignores figures in comments, and keeps figures in strings that look like comments', () => {
    assert.ok(!caught('// was £12.71 before the rules file\nconst a = 1'))
    assert.ok(!caught('/* 14 days */ const a = 1'))
    assert.ok(!caught('const a = <p>{/* £76.26 */}hello</p>'))
    assert.ok(caught("const url = 'https://example.org' + ' £12.71'"))
    assert.ok(caught("const label = 'Rates // £12.71'"))
  })

  it('keeps "//" in page text, and every character as typed', () => {
    assert.equal(stripComments("const a = <p>See https://gov.uk // £12.71</p> // note"), "const a = <p>See https://gov.uk // £12.71</p>  ")
    assert.equal(stripComments("const s = '£12.71' /* x */"), "const s = '£12.71'  ")
  })

  it('a "/*" inside a JSX attribute is not taken for the start of a comment', () => {
    // App.tsx has path="/login/*". A text-based stripper removed everything from there to the next
    // "*/", hiding any figure typed in between (found by the independent review, 13 October 2026).
    const app = `<Route path="/login/*" element={<Login />} />\n<Route path="/x" element={<p>£12.71 an hour</p>} />\n{/* routes */}`
    assert.ok(caught(app))
  })
})
