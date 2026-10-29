/**
 * CI guard (Standard §19.7): a green run must mean the whole suite ran.
 * Fails if any test was skipped or marked todo, if any failed, or if fewer
 * tests ran than the floor below. Raise MIN_TESTS when tests are added.
 */
import { readFileSync } from 'node:fs'

const MIN_TESTS = 640
const report = readFileSync(process.argv[2] ?? 'test-results.tap', 'utf8')

const count = (name) => {
  const match = new RegExp(`^# ${name} (\\d+)$`, 'm').exec(report)
  if (!match) throw new Error(`Test report has no "${name}" line - did the suite run?`)
  return Number(match[1])
}

const totals = { tests: count('tests'), pass: count('pass'), fail: count('fail'), skipped: count('skipped'), todo: count('todo'), cancelled: count('cancelled') }
console.log('Test report:', totals)

const problems = []
if (totals.fail > 0) problems.push(`${totals.fail} failed`)
if (totals.cancelled > 0) problems.push(`${totals.cancelled} cancelled`)
if (totals.skipped > 0) problems.push(`${totals.skipped} skipped`)
if (totals.todo > 0) problems.push(`${totals.todo} todo`)
if (totals.tests < MIN_TESTS) problems.push(`only ${totals.tests} tests ran, expected at least ${MIN_TESTS}`)

if (problems.length > 0) {
  console.error(`Refusing a green run: ${problems.join(', ')}`)
  process.exit(1)
}
