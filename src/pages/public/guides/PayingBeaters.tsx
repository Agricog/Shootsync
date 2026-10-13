/**
 * Guide: paying beaters and pickers-up.
 * Every minimum wage and HMRC figure on this page comes from src/data/payRules.ts
 * (Standard §05.7); none is typed here, and tests/typedFigures.test.ts fails if one is.
 * Once the rates lapse, the page shows RatesReviewNotice in their place.
 * When the rules file is updated in April, re-read this page and update `reviewed`
 * in src/content/guides.ts.
 */

import { Link } from 'react-router-dom'
import GuidePage from '../../../components/public/GuidePage'
import RatesReviewNotice from '../../../components/public/RatesReviewNotice'
import { useToday } from '../../../lib/today'
import { CASUAL_BEATERS, MINIMUM_WAGE } from '../../../data/payRules'
import { formatPence, minimumForMinutes, ratesInForce } from '../../../utils/beaterPayCalculator'

/** The example day in this guide: meet 8.30am, an hour's lunch, finish 3.30pm. */
const EXAMPLE_MINUTES = 6 * 60

export default function PayingBeaters() {
  const rates = ratesInForce(useToday())
  const adult = rates?.bands.find((band) => band.id === 'age21Plus')
  const limit = CASUAL_BEATERS.dayLimit

  return (
    <GuidePage
      path="/guides/paying-beaters-and-pickers-up"
      seoTitle="Paying Beaters and Pickers-Up: Pay, Tax and HMRC | ShootSync"
      description="How much to pay beaters in 2026: the minimum wage per hour, HMRC’s casual beaters rules, when PAYE applies, and the records a shoot must keep."
      title="Paying beaters and pickers-up: pay, tax and the records to keep"
      inShort={
        <>
          {rates && adult ? (
            <p>
              Most beaters are likely to count as <strong>workers</strong> in law, so they are owed at least the
              minimum wage for every hour they work. From {rates.periodLabel} that is{' '}
              <strong>{formatPence(adult.hourlyPence)} an hour</strong> for anyone 21 or over:{' '}
              <strong>{formatPence(minimumForMinutes(EXAMPLE_MINUTES, adult.hourlyPence))} for a six-hour day</strong>.
              Lunch and a brace of birds don’t count towards it.
            </p>
          ) : (
            <p>
              Most beaters are likely to count as <strong>workers</strong> in law, so they are owed at least the
              minimum wage for every hour they work. Lunch and a brace of birds don’t count towards it.
            </p>
          )}
          <p>
            For tax, HMRC has a short-engagement rule for casual beaters: a shoot may not need to deduct tax for
            someone engaged for {CASUAL_BEATERS.shortEngagementWeeks} weeks or less, but must operate PAYE for a casual
            beater who works, or is expected to work, more than {limit} days in a tax year. Either way, keep a record of
            everyone you pay.
          </p>
          <p>
            <Link to="/tools/beater-pay-calculator">Check your day rate with the free beater pay calculator</Link>.
          </p>
        </>
      }
      sections={[
        {
          id: 'workers',
          heading: 'Are beaters workers?',
          body: (
            <>
              <p>
                Many beaters don’t think of a day in the beating line as a job, and many shoots don’t either. The law
                looks at the arrangement rather than the label. “Worker” is defined widely, and solicitors who advise
                shoots say it is likely to cover most beaters, especially on organised days with a set rate.
              </p>
              <p>The exceptions are narrow:</p>
              <ul>
                <li><strong>Genuinely self-employed people</strong>, who run their own business and offer their services to others.</li>
                <li><strong>Volunteers</strong> who are paid only their expenses.</li>
                <li>
                  <strong>A very casual arrangement</strong> with no intention to create legal relations. A fixed day
                  rate, lunch and birds, and an expectation that you turn up on set days all point the other way.
                </li>
              </ul>
              <p>
                <strong>Pickers-up are often different.</strong> Someone who brings their own dogs and transport,
                works for several shoots and could send someone in their place may well be self-employed. In that case
                there is no minimum wage, but they should invoice the shoot and declare the income themselves.
              </p>
            </>
          ),
        },
        {
          id: 'minimum-wage',
          heading: 'The minimum wage for beaters in 2026',
          body: (
            <>
              {rates ? (
                <>
                  <p>
                    If your beaters are workers, every hour they work must be paid at least at the rate for their age.
                    These rates apply from {rates.periodLabel}:
                  </p>
                  <div
                    className="overflow-x-auto"
                    tabIndex={0}
                    role="region"
                    aria-label="Minimum wage rates table, scrolls sideways on small screens"
                    data-rates-until={rates.reviewBy}
                  >
                    <table className="w-full text-left text-sm border border-slate-700">
                      <caption className="sr-only">Minimum hourly rates from {rates.periodLabel}, and the minimum for a six-hour day</caption>
                      <thead className="bg-slate-800 text-white">
                        <tr>
                          <th scope="col" className="p-3">Age band</th>
                          <th scope="col" className="p-3">Per hour</th>
                          <th scope="col" className="p-3">Six-hour day</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rates.bands.map((band) => (
                          <tr key={band.id} className="border-t border-slate-700">
                            <th scope="row" className="p-3 font-normal">{band.label}</th>
                            <td className="p-3">{formatPence(band.hourlyPence)}</td>
                            <td className="p-3">{formatPence(minimumForMinutes(EXAMPLE_MINUTES, band.hourlyPence))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <RatesReviewNotice />
              )}
              <p>
                <strong>Working it out.</strong> Count the hours a beater is required to be at work, from the meet
                until they are free to go, and leave out the lunch break. A typical day that meets at 8.30am, stops for
                an hour’s lunch and finishes at 3.30pm is six hours’ work.
              </p>
              <p>
                <strong>What doesn’t count towards pay:</strong> lunch, drinks, and the brace of birds at the end of
                the day. They are welcome, but they can’t be used to make up the minimum.
              </p>
              <p>
                <strong>Young beaters.</strong> Children below school-leaving age aren’t entitled to the minimum wage,
                but your local council’s rules on employing children still apply.
              </p>
              <p>
                Many shoots still pay a flat day rate set years ago. If that rate is below the figure for the hours
                worked, and your beaters are workers, the shoot is paying below the legal minimum. Underpayment can
                bring arrears plus penalties, so it is worth checking before the season rather than after a complaint.
              </p>
            </>
          ),
        },
        {
          id: 'tax',
          heading: 'Tax and PAYE: HMRC’s casual beaters rules',
          body: (
            <>
              <p>
                HMRC publishes specific guidance for casual beaters and harvest workers. In outline, a shoot may not
                need to deduct tax when:
              </p>
              <ul>
                <li><strong>One-day engagements:</strong> the beater is taken on for a day or less, paid off at the end of it, and has no contract for further work.</li>
                <li><strong>Short engagements:</strong> they are engaged for {CASUAL_BEATERS.shortEngagementWeeks} weeks or less, and haven’t already been paid above the PAYE threshold by you since 6 April without PAYE being applied.</li>
                <li><strong>Daily casuals:</strong> they work on a casual, daily basis (one or two days a week through the season) and their total is not expected to go over {limit} days in the tax year.</li>
              </ul>
              <p>
                <strong>
                  If a casual beater works, or is expected to work, more than {limit} days in a tax year, you must operate
                  PAYE
                </strong>{' '}
                and deduct tax and National Insurance as normal. The test is what you expect: a regular you know will come
                every week is outside the rule from the start. PAYE also applies to anyone engaged for more than{' '}
                {CASUAL_BEATERS.shortEngagementWeeks} weeks, anyone doing other work for the shoot, and family members.
              </p>
              <p>
                HMRC is clear that this is not a tax exemption for the beater. The pay is still taxable, and they must
                pay any tax due themselves. HMRC also says National Insurance for casual beaters must be worked out as
                normal, whatever the number of days.
              </p>
              <p>
                Every Saturday from October to the end of January is 18 days in the 2026/27 season, so a regular
                beater on a weekly shoot can pass {limit} days with you before the season ends. It is worth counting each
                beater’s days as you go.
              </p>
            </>
          ),
        },
        {
          id: 'records',
          heading: 'The records a shoot must keep',
          body: (
            <>
              <p>HMRC asks you to keep a record of every person you pay, even if you don’t run a payroll:</p>
              <ul>
                <li>full name</li>
                <li>date of birth</li>
                <li>gender</li>
                <li>National Insurance number</li>
                <li>address</li>
                <li>how much you paid them</li>
              </ul>
              <p>
                If you don’t run a payroll because nobody is paid above the Lower Earnings Limit, keep these records
                for {CASUAL_BEATERS.recordYears} years after the end of the current tax year. For the minimum wage, it also pays to record the
                hours each beater worked, so you can show the rate was met.
              </p>
            </>
          ),
        },
        {
          id: 'paying',
          heading: 'Cash on the day or bank transfer?',
          body: (
            <>
              <p>
                Cash in an envelope at the end of the day is traditional and beaters like it. Bank transfer leaves a
                record without extra paperwork, and suits beaters who come every week. Whichever you use:
              </p>
              <ul>
                <li>Agree the rate before the season, in writing, so nobody is surprised.</li>
                <li>Pay promptly. Beaters talk, and a shoot that pays late soon struggles to fill the line.</li>
                <li>Keep a note of who worked each day, who has been paid, and the payment reference.</li>
                <li>Count days per beater through the season, for the {limit}-day PAYE rule.</li>
              </ul>
            </>
          ),
        },
      ]}
      adviceNote={
        <p>
          This guide is general information to help you ask the right questions. It isn’t legal or tax advice, and
          every shoot’s arrangements are different. Check your own situation with HMRC or an accountant.
        </p>
      }
      sources={[
        ...CASUAL_BEATERS.sources,
        ...MINIMUM_WAGE.sources,
        { label: 'Michelmores: Shoot beaters and pickers-up, employment law', url: 'https://michelmores.com/news-views/news/shoot-beaters-pickers-employment-law' },
        { label: 'Strutt & Parker: Shoot beaters and pickers-up, right to work, minimum wages and RTI', url: 'https://www.struttandparker.com/knowledge-and-research/shoot-beaters-and-pickers-up-right-to-work-minimum-wages-and-real-time-information' },
      ]}
      feature={{
        to: '/features#beaters',
        heading: 'Know who is owed what, all season',
        text:
          `ShootSync books your beaters onto each shoot day, works out what each confirmed beater is owed when the day is complete, records each payment with its bank reference, exports a sheet ready for your bank, and counts every beater’s days this tax year against HMRC’s ${CASUAL_BEATERS.dayLimit}-day casual limit.`,
      }}
    />
  )
}
