/**
 * Beater pay calculator - /tools/beater-pay-calculator (free public tool).
 *
 * Checks a beater's day rate against the minimum wage for the hours worked, costs the
 * season's beating line, and flags HMRC's casual beater day limit. Everything runs in the
 * browser: nothing typed is sent anywhere.
 *
 * Figures: every rate and limit comes from src/data/payRules.ts through the engine in
 * src/utils/beaterPayCalculator.ts (Standard §05.7). None is typed here, and
 * tests/typedFigures.test.ts fails if one is. The words live in src/content/beaterPayCalculator.ts.
 * "Today" comes from useToday (src/lib/today.tsx) and is handed to the engine, so the page shows
 * the review notice from the day the rates lapse, in the browser and in the served HTML alike.
 */

import { useId, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react'
import Seo from '../../../components/public/Seo'
import PublicLayout from '../../../components/public/PublicLayout'
import RatesReviewNotice from '../../../components/public/RatesReviewNotice'
import { useToday } from '../../../lib/today'
import { SITE, absoluteUrl } from '../../../config/site'
import { CASUAL_BEATERS, MINIMUM_WAGE } from '../../../data/payRules'
import {
  CALCULATOR_DESCRIPTION,
  CALCULATOR_PATH,
  CALCULATOR_TITLE,
  TABLE_MINUTES,
  calculatorFaqs,
  quickAnswer,
} from '../../../content/beaterPayCalculator'
import {
  AGE_CHOICES,
  DEFAULT_INPUT,
  calculate,
  formatDuration,
  formatPence,
  formatRuleDate,
  minimumForMinutes,
  ratesInForce,
  type CalculatorField,
  type CalculatorInput,
  type CalculatorResult,
} from '../../../utils/beaterPayCalculator'

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500'
const prose =
  'text-slate-300 leading-relaxed space-y-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_a]:text-green-500 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-white'
const inputClass = `mt-1 block w-full rounded-lg bg-slate-800 border px-3 py-2 text-white placeholder:text-slate-400 ${focusRing}`

interface FieldProps {
  label: string
  hint?: string
  error?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; className: string }) => ReactNode
}

/** A labelled field with its hint and error tied to it (Standard §17.1). */
function Field({ label, hint, error, children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-white">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-0.5 text-sm text-slate-400">
          {hint}
        </p>
      )}
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
        className: `${inputClass} ${error ? 'border-red-400' : 'border-slate-600'}`,
      })}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 border-t border-slate-700 first:border-t-0">
      <dt className="text-slate-300">{term}</dt>
      <dd className="ml-auto text-white font-semibold text-right">{children}</dd>
    </div>
  )
}

/** The one-line verdict, announced to screen readers when it changes. */
function verdict(result: CalculatorResult): string {
  const { wage, dayRate } = result
  if (!wage) return `${formatDuration(result.minutesWorked)} worked. The minimum wage rates are being re-checked.`
  if (wage.minimumDayPence === null) return `${formatDuration(result.minutesWorked)} worked. No minimum wage applies below school leaving age.`
  if (!dayRate) return `${formatDuration(result.minutesWorked)} worked. The legal minimum for the day is ${formatPence(wage.minimumDayPence)}.`
  return dayRate.meetsMinimum
    ? `${formatPence(dayRate.pence)} meets the minimum of ${formatPence(wage.minimumDayPence)} for ${formatDuration(result.minutesWorked)}.`
    : `${formatPence(dayRate.pence)} is ${formatPence(dayRate.shortfallPerDayPence)} short of the minimum of ${formatPence(wage.minimumDayPence)} for ${formatDuration(result.minutesWorked)}.`
}

function Results({ result }: { result: CalculatorResult }) {
  const { wage, dayRate, season } = result
  const perBeater = season && !season.beatersEntered
  const beaterDays = season ? season.shootDays * season.beatersPerDay : 0

  return (
    <div className="space-y-6">
      {!wage && <RatesReviewNotice />}

      <dl>
        <Row term="Hours worked">{formatDuration(result.minutesWorked)}</Row>
        {wage && wage.hourlyPence !== null && wage.minimumDayPence !== null && (
          <Row term={`Legal minimum for the day (${formatPence(wage.hourlyPence)} an hour)`}>{formatPence(wage.minimumDayPence)}</Row>
        )}
        {dayRate && (
          <Row term={`Your day rate of ${formatPence(dayRate.pence)} works out at`}>{formatPence(dayRate.averageHourlyPence)} an hour</Row>
        )}
      </dl>

      {wage && wage.minimumDayPence === null && (
        <p className="text-slate-300">
          Below school leaving age there is no minimum wage entitlement. Your local council’s rules on employing children
          still apply.
        </p>
      )}

      {dayRate && dayRate.meetsMinimum === true && (
        <p className="flex gap-3 rounded-lg border border-green-700 bg-green-950/50 p-4 text-slate-200">
          <CheckCircle className="w-5 h-5 mt-0.5 shrink-0 text-green-500" aria-hidden="true" />
          <span>
            <strong className="text-white">This day rate meets the minimum wage</strong> for a beater in this age band
            working this day.
          </span>
        </p>
      )}

      {dayRate && dayRate.meetsMinimum === false && wage?.minimumDayPence != null && (
        <p className="flex gap-3 rounded-lg border border-amber-600 bg-amber-950/40 p-4 text-slate-200">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
          <span>
            <strong className="text-white">{formatPence(dayRate.shortfallPerDayPence)} short per beater, per day.</strong>{' '}
            If your beaters count as workers, the day rate needs to be at least {formatPence(wage.minimumDayPence)}, or
            the day shorter.
          </span>
        </p>
      )}

      {season && (
        <div>
          <h3 className="text-lg font-semibold text-white">
            The season: {season.shootDays} shoot {season.shootDays === 1 ? 'day' : 'days'}
            {perBeater ? ', per beater' : `, ${season.beatersPerDay} ${season.beatersPerDay === 1 ? 'beater' : 'beaters'} a day`}
          </h3>
          <dl className="mt-2">
            {season.billPence !== null && <Row term="Beaters’ pay at your rate">{formatPence(season.billPence)}</Row>}
            {season.minimumBillPence !== null && <Row term="At the legal minimum">{formatPence(season.minimumBillPence)}</Row>}
            {season.shortfallPence !== null && season.shortfallPence > 0 && (
              <Row term={`Short across ${beaterDays} beater ${beaterDays === 1 ? 'day' : 'days'}`}>{formatPence(season.shortfallPence)}</Row>
            )}
          </dl>
          {season.paye && (
            <>
            <p className={`mt-4 rounded-lg border p-4 text-slate-200 ${season.paye.overLimit ? 'border-amber-600 bg-amber-950/40' : 'border-slate-700 bg-slate-800/50'}`}>
              {season.paye.overLimit ? (
                <>
                  <strong className="text-white">Over HMRC’s {season.paye.limit}-day limit.</strong> A beater you expect at
                  every one of your {season.shootDays} days is expected to work more than {season.paye.limit} days for you
                  this tax year, so HMRC’s daily-casual rule doesn’t cover them, even for the first few days. Operate PAYE
                  for them from the start, deducting tax as normal.
                </>
              ) : (
                <>
                  <strong className="text-white">Within HMRC’s {season.paye.limit}-day limit</strong> for a daily casual
                  beater, even one who comes to every day, as long as they don’t work for you on other days in the same
                  tax year. A beater who does other work for you, or is family, needs PAYE whatever the count.
                </>
              )}
            </p>
            <p className="mt-3 text-sm text-slate-300">
              National Insurance for casual beaters is worked out as normal on every day’s pay, inside the limit or not.
            </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** The field names as the form shows them, for the status line and for moving focus to a bad field. */
const FIELD_LABELS: Record<CalculatorField, string> = {
  meet: 'Meet time',
  finish: 'Finish time',
  breakMinutes: 'Unpaid break, in minutes',
  age: 'Age band',
  dayRate: 'Day rate you pay, in pounds',
  shootDays: 'Shoot days this season',
  beatersPerDay: 'Beaters on a typical day',
}

function Calculator({ today }: { today: string }) {
  const [input, setInput] = useState<CalculatorInput>(DEFAULT_INPUT)
  const [touched, setTouched] = useState<ReadonlySet<CalculatorField>>(new Set())
  const outcome = useMemo(() => calculate(input, today), [input, today])

  // A field's error shows once the person leaves it, and goes as soon as they start correcting it,
  // so nobody is told off for a value they are halfway through typing.
  const errorOf = (field: CalculatorField) =>
    touched.has(field) ? outcome.errors.find((error) => error.field === field)?.message : undefined
  const bind = (field: CalculatorField) => ({
    'data-field': field,
    value: input[field],
    onChange: (event: { target: { value: string } }) => {
      setInput((current) => ({ ...current, [field]: event.target.value }))
      setTouched((current) => {
        const next = new Set(current)
        next.delete(field)
        return next
      })
    },
    onBlur: () => setTouched((current) => new Set(current).add(field)),
  })

  return (
    <form
      onSubmit={(event) => {
        // The button, or Enter in a field: show every error and take the person to the first one,
        // or, when all is well, take them to the result (it updates as they type, but may be off screen).
        event.preventDefault()
        if (outcome.errors.length === 0) {
          event.currentTarget.querySelector<HTMLElement>('#result-heading')?.focus()
          return
        }
        setTouched(new Set(outcome.errors.map((error) => error.field)))
        const first = event.currentTarget.querySelector<HTMLElement>(`[data-field="${outcome.errors[0].field}"]`)
        first?.focus()
      }}
      noValidate
      aria-labelledby="calculator-heading"
      className="grid gap-8 lg:grid-cols-2"
    >
      <div className="space-y-8">
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-white">The day</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FIELD_LABELS.meet} error={errorOf('meet')}>
              {(props) => <input type="time" {...props} {...bind('meet')} />}
            </Field>
            <Field label={FIELD_LABELS.finish} hint="When the beaters are free to go" error={errorOf('finish')}>
              {(props) => <input type="time" {...props} {...bind('finish')} />}
            </Field>
          </div>
          <Field label={FIELD_LABELS.breakMinutes} hint="Usually the lunch break. Leave at 0 if there isn’t one." error={errorOf('breakMinutes')}>
            {(props) => <input type="text" inputMode="numeric" autoComplete="off" {...props} {...bind('breakMinutes')} />}
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-white">The beater</legend>
          <Field label={FIELD_LABELS.age} error={errorOf('age')}>
            {(props) => (
              <select {...props} {...bind('age')}>
                {AGE_CHOICES.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={FIELD_LABELS.dayRate} hint="Optional. Pounds, or pounds and pence." error={errorOf('dayRate')}>
            {(props) => <input type="text" inputMode="decimal" autoComplete="off" {...props} {...bind('dayRate')} />}
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-white">The season (optional)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FIELD_LABELS.shootDays} error={errorOf('shootDays')}>
              {(props) => <input type="text" inputMode="numeric" autoComplete="off" {...props} {...bind('shootDays')} />}
            </Field>
            <Field label={FIELD_LABELS.beatersPerDay} hint="Leave blank for one beater" error={errorOf('beatersPerDay')}>
              {(props) => <input type="text" inputMode="numeric" autoComplete="off" {...props} {...bind('beatersPerDay')} />}
            </Field>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="submit"
            className={`text-sm font-medium bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg ${focusRing}`}
          >
            Check these figures
          </button>
          <button
            type="button"
            onClick={() => {
              setInput(DEFAULT_INPUT)
              setTouched(new Set())
            }}
            className={`text-sm text-slate-300 hover:text-white underline underline-offset-2 rounded ${focusRing}`}
          >
            Start again
          </button>
        </div>
      </div>

      <section aria-labelledby="result-heading" className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 h-fit lg:sticky lg:top-6">
        <h2 id="result-heading" tabIndex={-1} className="text-xl font-semibold text-white rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
          The result
        </h2>
        <p role="status" className="mt-2 text-slate-300">
          {outcome.result
            ? verdict(outcome.result)
            : `Check the ${[...new Set(outcome.errors.map((error) => FIELD_LABELS[error.field].split(',')[0].toLowerCase()))].join(' and the ')}. The result will show when every field reads correctly.`}
        </p>
        <div className="mt-4">{outcome.result && <Results result={outcome.result} />}</div>
      </section>
    </form>
  )
}

function ReferenceTable({ rates }: { rates: NonNullable<ReturnType<typeof ratesInForce>> }) {
  return (
    <div
      className="overflow-x-auto rounded-lg"
      tabIndex={0}
      role="region"
      aria-label="Minimum day pay by hours worked, scrolls sideways on small screens"
      data-rates-until={rates.reviewBy}
    >
      <table className="w-full text-left text-sm border border-slate-700">
        <caption className="sr-only">The least a beater can be paid for a day, by hours worked and age band, from {rates.periodLabel}</caption>
        <thead className="bg-slate-800 text-white">
          <tr>
            <th scope="col" className="p-3">Hours worked</th>
            {rates.bands.map((band) => (
              <th key={band.id} scope="col" className="p-3">
                {band.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_MINUTES.map((minutes) => (
            <tr key={minutes} className="border-t border-slate-700">
              <th scope="row" className="p-3 font-normal text-white">{formatDuration(minutes)}</th>
              {rates.bands.map((band) => (
                <td key={band.id} className="p-3">{formatPence(minimumForMinutes(minutes, band.hourlyPence))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function BeaterPayCalculator() {
  const today = useToday()
  const rates = ratesInForce(today)
  const faqs = calculatorFaqs(rates)
  const limit = CASUAL_BEATERS.dayLimit
  const url = absoluteUrl(CALCULATOR_PATH)
  const sources = [...MINIMUM_WAGE.sources, ...CASUAL_BEATERS.sources]

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
        { '@type': 'ListItem', position: 2, name: 'Beater pay calculator', item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Beater pay calculator',
      url,
      description: CALCULATOR_DESCRIPTION,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Any (runs in a web browser)',
      isAccessibleForFree: true,
      inLanguage: 'en-GB',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      provider: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: CALCULATOR_TITLE,
      url,
      description: CALCULATOR_DESCRIPTION,
      inLanguage: 'en-GB',
      dateModified: MINIMUM_WAGE.lastVerified,
      author: { '@type': 'Person', name: SITE.operator.knownAs, url: SITE.operator.url },
      publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url, logo: absoluteUrl(SITE.ogImage) },
      citation: sources.map((source) => source.url),
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['#quick-answer'] },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ]

  return (
    <PublicLayout>
      <Seo title={CALCULATOR_TITLE} description={CALCULATOR_DESCRIPTION} path={CALCULATOR_PATH} jsonLd={jsonLd} />

      <div className="px-4 py-16 sm:py-24">
        <div className="max-w-5xl mx-auto">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400 mb-6">
            <Link to="/" className={`hover:text-white rounded ${focusRing}`}>Home</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="text-slate-300">Beater pay calculator</span>
          </nav>

          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">Beater pay calculator</h1>
          <p className="mt-4 text-lg text-slate-300 max-w-3xl">
            Check a beater’s day rate against the minimum wage for the hours they actually work, cost the season’s
            beating line, and see whether a regular beater will go past HMRC’s{' '}
            <span className="whitespace-nowrap">{limit}-day limit</span>.
          </p>
          <p className="mt-3 text-sm text-slate-400">
            Minimum wage rates from <time dateTime={MINIMUM_WAGE.appliesFrom}>{formatRuleDate(MINIMUM_WAGE.appliesFrom)}</time>.
            Last checked against GOV.UK on <time dateTime={MINIMUM_WAGE.lastVerified}>{formatRuleDate(MINIMUM_WAGE.lastVerified)}</time> by{' '}
            {SITE.operator.knownAs}. Sources are listed at the end.
          </p>

          <div id="quick-answer" className="mt-8 bg-slate-800/50 border border-slate-700 rounded-xl p-6 max-w-3xl">
            <h2 className="text-lg font-semibold text-white">In short</h2>
            <p className="mt-2 text-slate-300 leading-relaxed">{quickAnswer(rates)}</p>
          </div>

          <section aria-labelledby="calculator-heading" className="mt-12">
            <h2 id="calculator-heading" className="text-2xl font-semibold text-white mb-6">
              Check your day rate
            </h2>
            <Calculator today={today} />
            <p className="mt-6 text-sm text-slate-400 max-w-3xl">
              The calculator runs in your browser. Nothing you type is sent to ShootSync or anyone else.
            </p>
          </section>

          <div className="mt-16 max-w-3xl space-y-14">
            <section id="how-it-works" aria-labelledby="how-it-works-heading" className="scroll-mt-8">
              <h2 id="how-it-works-heading" className="text-2xl font-semibold text-white">How the calculator works</h2>
              <div className={`mt-4 ${prose}`}>
                <p>
                  GOV.UK’s test for the minimum wage is simple: divide the pay for a period by the hours worked in it, and
                  check that the average is not less than the hourly rate for the worker’s age. The calculator applies that
                  test to one shoot day.
                </p>
                <ul>
                  <li><strong>Hours worked</strong> run from the meet to the finish, less the unpaid break.</li>
                  <li>
                    <strong>The legal minimum for the day</strong> is the hours worked times the hourly rate for the beater’s
                    age band, rounded up to the next penny, because anything less falls short.
                  </li>
                  <li>
                    <strong>Your day rate per hour</strong> is the day rate divided by the hours, rounded down to the penny, so
                    it never looks better than it is.
                  </li>
                  <li>
                    <strong>The season</strong> multiplies the day by the number of shoot days and beaters, so you can see the
                    whole beating bill before the first drive.
                  </li>
                </ul>
                <p>
                  The comparison is done in whole pence, so a day rate exactly on the minimum passes and a penny less does
                  not. It checks each day on its own. That is the cautious way to check: if every day meets the minimum, so
                  does any pay period made up of those days.
                </p>
              </div>
            </section>

            <section id="minimum-by-hours" aria-labelledby="minimum-by-hours-heading" className="scroll-mt-8">
              <h2 id="minimum-by-hours-heading" className="text-2xl font-semibold text-white">Minimum day pay by hours worked</h2>
              <div className={`mt-4 ${prose}`}>
                {rates ? (
                  <>
                    <p>
                      The least a beater can be paid for a day of each length, at the rates from {rates.periodLabel}. Find the
                      length of your day down the side, then the beater’s age band across the top.
                    </p>
                    <ReferenceTable rates={rates} />
                    <p>
                      A day that runs longer than planned needs more pay, not just thanks. If the last drive often runs late,
                      set the rate for the long days, not the short ones.
                    </p>
                  </>
                ) : (
                  <RatesReviewNotice />
                )}
              </div>
            </section>

            <section id="working-time" aria-labelledby="working-time-heading" className="scroll-mt-8">
              <h2 id="working-time-heading" className="text-2xl font-semibold text-white">What counts as working time</h2>
              <div className={`mt-4 ${prose}`}>
                <p>
                  GOV.UK’s guidance on working hours counts the time a worker spends at the workplace and required to be
                  available for work, whether or not there is work for them at that moment. It leaves out rest breaks, and
                  it leaves out travelling between home and work unless the worker is working while they travel.
                </p>
                <p>On a shoot day, that means:</p>
                <ul>
                  <li><strong>Start the clock at the meet</strong>, the time beaters are told to be there.</li>
                  <li>
                    <strong>Waiting counts.</strong> Standing at the end of a drive while the guns move, or waiting for the
                    next drive to start, is time they are required to be there.
                  </li>
                  <li><strong>Stop the clock for the lunch break</strong>, if beaters are free during it.</li>
                  <li>
                    <strong>Stop it again when they are free to go.</strong> That may be after the last drive, once the
                    beaters are back and released, not the moment the last bird flies.
                  </li>
                  <li><strong>Leave out the drive to and from the shoot.</strong></li>
                </ul>
                <p>
                  Write the meet and finish times down for each day. If a beater ever questions their pay, a note of the
                  hours is what shows the rate was met.
                </p>
              </div>
            </section>

            <section id="not-pay" aria-labelledby="not-pay-heading" className="scroll-mt-8">
              <h2 id="not-pay-heading" className="text-2xl font-semibold text-white">What doesn’t count towards pay</h2>
              <div className={`mt-4 ${prose}`}>
                <p>
                  Only money counts towards the minimum wage. GOV.UK lists what does not count as pay, and three items on
                  that list come up on every shoot day:
                </p>
                <ul>
                  <li><strong>Benefits in kind</strong>, such as meals, even when they have a value. Lunch, drinks and the brace of birds at the end of the day are welcome extras, not pay.</li>
                  <li><strong>Tips and gratuities</strong>, so a whip-round from the guns can’t make up a short day rate.</li>
                  <li><strong>Expenses</strong> paid back to the beater, such as fuel money, which are a refund, not wages.</li>
                </ul>
              </div>
            </section>

            <section id="age-bands" aria-labelledby="age-bands-heading" className="scroll-mt-8">
              <h2 id="age-bands-heading" className="text-2xl font-semibold text-white">Age bands and apprentices</h2>
              <div className={`mt-4 ${prose}`}>
                <p>The minimum depends on the beater’s age on the day, using GOV.UK’s bands:</p>
                <ul>
                  {MINIMUM_WAGE.bands.map((band) => (
                    <li key={band.id}>
                      <strong>{band.label}</strong>
                      {rates ? <>: {formatPence(band.hourlyPence)} an hour from {rates.periodLabel}.</> : '.'}
                    </li>
                  ))}
                  <li><strong>Below school leaving age:</strong> no minimum wage entitlement, though your council’s rules on employing children still apply.</li>
                </ul>
                <p>
                  The apprentice rate is for apprentices under 19, or 19 and over in the first year of their apprenticeship.
                  After that, they get the rate for their age. HMRC already asks you to record each beater’s date of birth,
                  so their band is easy to keep right as birthdays come round during the season.
                </p>
              </div>
            </section>

            <section id="paye" aria-labelledby="paye-heading" className="scroll-mt-8">
              <h2 id="paye-heading" className="text-2xl font-semibold text-white">HMRC’s {limit}-day limit and PAYE</h2>
              <div className={`mt-4 ${prose}`}>
                <p>
                  The minimum wage is about how much you pay. Tax is a separate question, and HMRC has its own guidance for
                  casual beaters. A shoot may not need to deduct tax for:
                </p>
                <ul>
                  <li><strong>One-day engagements:</strong> taken on for a day or less, paid off at the end of it, with no contract for further work.</li>
                  <li><strong>Short engagements:</strong> {CASUAL_BEATERS.shortEngagementWeeks} weeks or less, with the further conditions on HMRC’s page.</li>
                  <li><strong>Daily casuals:</strong> one or two days a week, where the total is not expected to go over {limit} days in the tax year.</li>
                </ul>
                <p>
                  <strong>
                    If a beater works, or is expected to work, more than {limit} days for you in the tax year, you must
                    operate PAYE
                  </strong>{' '}
                  for them, deducting tax and National Insurance as normal. HMRC’s test is what you expect: a regular you
                  know will come every week is outside the rule from their first day, not from the day they pass the limit. PAYE also applies to anyone engaged for more than {CASUAL_BEATERS.shortEngagementWeeks}{' '}
                  weeks, anyone doing other work for the shoot, and members of your family. National Insurance for casual
                  beaters is worked out as normal in any case, and HMRC is clear the pay is still taxable income for the
                  beater.
                </p>
                <p>
                  The tax year runs from 6 April to 5 April, so a whole game season sits inside one tax year (see the{' '}
                  <Link to="/guides/shooting-season-dates">shooting season dates</Link>). The calculator warns you when a
                  season has more than {limit} shoot days, because a beater you expect at every one is expected to go
                  over.
                </p>
              </div>
            </section>

            <section id="records" aria-labelledby="records-heading" className="scroll-mt-8">
              <h2 id="records-heading" className="text-2xl font-semibold text-white">The records to keep</h2>
              <div className={`mt-4 ${prose}`}>
                <p>HMRC asks you to keep a record of every person you pay, even if you don’t run a payroll:</p>
                <ul>
                  <li>full name, date of birth and gender</li>
                  <li>National Insurance number and address</li>
                  <li>how much you paid them</li>
                </ul>
                <p>
                  Without a payroll, keep them for {CASUAL_BEATERS.recordYears} years after the end of the current tax
                  year. Add each day’s meet and finish times, and you have everything needed to show both HMRC’s rules and
                  the minimum wage were followed.
                </p>
              </div>
            </section>

            <section id="workers" aria-labelledby="workers-heading" className="scroll-mt-8">
              <h2 id="workers-heading" className="text-2xl font-semibold text-white">Do your beaters count as workers?</h2>
              <div className={`mt-4 ${prose}`}>
                <p>
                  The minimum wage applies to workers, and the law looks at the arrangement rather than the label. A fixed
                  day rate, set days and an expectation that people turn up all point towards beaters being workers.
                  Genuine volunteers paid only expenses, and self-employed pickers-up who run their own business, are
                  different. Our guide to{' '}
                  <Link to="/guides/paying-beaters-and-pickers-up">paying beaters and pickers-up</Link> goes through
                  the cases.
                </p>
              </div>
            </section>

            <section id="questions" aria-labelledby="questions-heading" className="scroll-mt-8">
              <h2 id="questions-heading" className="text-2xl font-semibold text-white">Questions about paying beaters</h2>
              <div className="mt-6 space-y-6">
                {faqs.map((faq) => (
                  <div key={faq.question}>
                    <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                    <p className="mt-2 text-slate-300 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>

            <aside aria-labelledby="feature-heading" className="bg-green-950/40 border border-green-800 rounded-xl p-6">
              <h2 id="feature-heading" className="text-xl font-semibold text-white">Keep the count all season</h2>
              <p className="mt-3 text-slate-300 leading-relaxed">
                ShootSync books your beaters onto each shoot day, works out what each confirmed beater is owed when the day
                is complete, records each payment with its bank reference, and counts every beater’s days this tax year
                against HMRC’s {limit}-day limit.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                <Link to="/features#beaters" className={`inline-flex items-center gap-2 text-green-400 hover:text-green-300 font-medium rounded ${focusRing}`}>
                  See how ShootSync pays beaters <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <Link to="/pricing" className={`inline-flex items-center gap-2 text-green-400 hover:text-green-300 font-medium rounded ${focusRing}`}>
                  See the prices <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            </aside>

            <section id="sources" aria-labelledby="sources-heading" className="scroll-mt-8">
              <h2 id="sources-heading" className="text-2xl font-semibold text-white">Sources</h2>
              <div className="mt-4 text-sm text-slate-300 border-l-2 border-amber-600 pl-4">
                <p>
                  This calculator and the notes above are general information to help you ask the right questions. They
                  aren’t legal or tax advice, and every shoot’s arrangements are different. Check your own situation with
                  HMRC or an accountant.
                </p>
              </div>
              <ol className="mt-4 list-decimal pl-6 space-y-2 text-sm text-slate-300">
                {sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} rel="noopener" className="text-green-500 underline underline-offset-2 hover:text-green-400 break-words">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-sm text-slate-400">
                Spotted something out of date? Email{' '}
                <a href={`mailto:${SITE.email}`} className="text-green-500 underline underline-offset-2">{SITE.email}</a> and we
                will check it and correct the page. More help for shoot captains is in the{' '}
                <Link to="/guides" className="text-green-500 underline underline-offset-2">guides</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
