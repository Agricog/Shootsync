/**
 * Words for the beater pay calculator page (/tools/beater-pay-calculator).
 *
 * Kept apart from the page component so they can be tested without a browser: the
 * title, description and quick answer are held to Standard §05.1 lengths, the FAQ list
 * feeds both the visible questions and the FAQPage structured data, and every figure is
 * worked out from src/data/payRules.ts by the calculator engine (§05.7). No figure is
 * typed here; tests/typedFigures.test.ts reads this file.
 *
 * Each statement of law or HMRC practice below follows the GOV.UK page cited for it in
 * src/data/payRules.ts. When a rule changes, change it there first, then re-read this file.
 */

import { CASUAL_BEATERS, MINIMUM_WAGE } from '../data/payRules.js'
import { formatDuration, formatPence, minimumForMinutes } from '../utils/beaterPayCalculator.js'

export const CALCULATOR_PATH = '/tools/beater-pay-calculator'

/** 55-60 characters (§05.1 point 1). */
export const CALCULATOR_TITLE = 'Beater Pay Calculator: Minimum Wage and PAYE | ShootSync'

/** 150-160 characters (§05.1 point 2). */
export const CALCULATOR_DESCRIPTION =
  'Free beater pay calculator for UK shoots. Check a day rate against the minimum wage for the hours worked, cost the season’s beaters and spot HMRC’s PAYE limit.'

/** The day the guide and the calculator use as an example: meet 8.30am, an hour's lunch, finish 3.30pm. */
export const EXAMPLE_DAY_MINUTES = 6 * 60

/** A flat rate set years ago, worked through in the FAQ. An illustration, not a claim about what shoots pay. */
export const EXAMPLE_FLAT_RATE_PENCE = 6000
export const EXAMPLE_FLAT_RATE_MINUTES = 7 * 60

/** Hours shown in the reference table: five to eight, by the half hour. */
export const TABLE_MINUTES = [300, 330, 360, 390, 420, 450, 480] as const

type Rates = typeof MINIMUM_WAGE
type Band = Rates['bands'][number]

const bandOf = (rates: Rates, id: Band['id']) => rates.bands.find((band) => band.id === id)!

/** The short answer at the top of the page (§05.1 point 14): 120-160 characters. */
export function quickAnswer(rates: Rates | null): string {
  if (!rates) {
    return 'A beater who counts as a worker must be paid at least the minimum wage for their age for every hour worked. Lunch, drinks and birds don’t count.'
  }
  const adult = bandOf(rates, 'age21Plus')
  return `From ${rates.periodLabel} a beater aged 21 or over must be paid at least ${formatPence(adult.hourlyPence)} an hour: ${formatPence(minimumForMinutes(EXAMPLE_DAY_MINUTES, adult.hourlyPence))} for a six-hour day. Lunch and birds don’t count.`
}

export interface CalculatorFaq {
  question: string
  answer: string
}

/** 10-15 questions (§05.1 point 13), answered from the rules in force, or without figures once they lapse. */
export function calculatorFaqs(rates: Rates | null): CalculatorFaq[] {
  const limit = CASUAL_BEATERS.dayLimit
  const adult = rates ? bandOf(rates, 'age21Plus') : null
  const flatAverage = Math.floor((EXAMPLE_FLAT_RATE_PENCE * 60) / EXAMPLE_FLAT_RATE_MINUTES)

  return [
    {
      question: 'How much should I pay a beater for a day?',
      answer: adult && rates
        ? `If your beaters count as workers, at least the minimum wage for every hour they work. From ${rates.periodLabel}, anyone aged 21 or over must get at least ${formatPence(adult.hourlyPence)} an hour, so a six-hour day is at least ${formatPence(minimumForMinutes(EXAMPLE_DAY_MINUTES, adult.hourlyPence))}. Many shoots pay more. The calculator checks your own rate against your own day.`
        : 'If your beaters count as workers, at least the minimum wage for their age for every hour they work. The rates change every April: check GOV.UK for this year’s, then use the calculator to check your own rate against your own day.',
    },
    {
      question: 'Is a flat day rate allowed?',
      answer: adult
        ? `Yes, as long as it works out at no less than the minimum wage for the hours worked. Divide the day rate by the hours: ${formatPence(EXAMPLE_FLAT_RATE_PENCE)} for a day of ${formatDuration(EXAMPLE_FLAT_RATE_MINUTES)} is ${formatPence(flatAverage)} an hour, which is below the ${formatPence(adult.hourlyPence)} rate for anyone 21 or over. A longer day needs a higher rate.`
        : 'Yes, as long as it works out at no less than the minimum wage for the hours worked. Divide the day rate by the hours and compare the answer with the rate for the beater’s age. A longer day needs a higher rate.',
    },
    {
      question: 'Does the lunch break count as working time?',
      answer:
        'No. GOV.UK’s guidance on working hours leaves rest breaks out of the hours you must pay the minimum wage for. Enter the length of the lunch break in the calculator and it is taken off the day.',
    },
    {
      question: 'Does time spent waiting between drives count?',
      answer:
        'Yes. Time a worker spends at the workplace and required to be available for work counts towards the minimum wage, whether or not there is work to do at that moment. Count the day from the meet until the beaters are free to go, less the lunch break.',
    },
    {
      question: 'Does travelling to the shoot count?',
      answer:
        'Travelling between home and work does not count towards minimum wage hours, unless the worker is working while they travel. So the drive to the meet in the morning and home in the evening is left out.',
    },
    {
      question: 'Can lunch or a brace of birds count towards the minimum wage?',
      answer:
        'No. Benefits in kind, such as meals, do not count towards minimum wage pay even when they have a value. Lunch, drinks and a brace at the end of the day are welcome, but the money must meet the minimum on its own.',
    },
    {
      question: 'Do tips from the guns count towards a beater’s pay?',
      answer:
        'No. Tips and gratuities do not count towards minimum wage pay, so a whip-round from the guns cannot make up a day rate that is below the minimum.',
    },
    {
      question: 'What about young beaters?',
      answer:
        'Below school leaving age there is no minimum wage entitlement, though your local council’s rules on employing children still apply. Above school leaving age and under 18, the under-18 rate applies. Apprentices have their own rate if they are under 19, or 19 or over and in the first year of their apprenticeship.',
    },
    {
      question: `What is HMRC’s ${limit}-day rule for beaters?`,
      answer: `HMRC lets a shoot pay a daily casual beater without deducting tax where their work for you is not expected to go over ${limit} days in the tax year. If they work, or are expected to work, more than that, you must operate PAYE for them, so a regular you expect every week is outside the rule from the start. National Insurance is worked out as normal either way.`,
    },
    {
      question: 'Do I need to run a payroll for beaters?',
      answer: `Not always. Under HMRC’s casual beater rules you may not need to deduct tax for one-day engagements, engagements of ${CASUAL_BEATERS.shortEngagementWeeks} weeks or less, or daily casuals within the ${limit}-day limit. National Insurance for casual beaters is still worked out as normal, and you must keep a record of everyone you pay.`,
    },
    {
      question: 'What records do I need to keep?',
      answer: `For each person you pay: full name, date of birth, gender, National Insurance number, address and how much you paid them. Where you do not run a payroll, HMRC asks you to keep these for ${CASUAL_BEATERS.recordYears} years after the end of the current tax year. Recording each beater’s hours also lets you show the minimum wage was met.`,
    },
    {
      question: 'Are pickers-up paid the same way?',
      answer:
        'Not always. A picker-up who brings their own dogs and transport, works for several shoots and could send someone in their place may be self-employed rather than a worker, and the minimum wage is for workers. It depends on the whole arrangement, not the job title. Our guide to paying beaters and pickers-up covers the difference.',
    },
    {
      question: 'Does the calculator keep what I type?',
      answer:
        'No. The calculator works entirely in your browser. Nothing you enter is sent to ShootSync or anyone else, and nothing is saved once you leave the page.',
    },
  ]
}
