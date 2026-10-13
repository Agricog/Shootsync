/**
 * Guide: paying beaters and pickers-up.
 * Facts to re-check every April: minimum wage rates (gov.uk LPC press release),
 * and HMRC's casual beaters page. Update the rates, the worked example and
 * `reviewed` in src/content/guides.ts together.
 */

import GuidePage from '../../../components/public/GuidePage'

const RATES = [
  { band: '21 and over (National Living Wage)', hourly: '£12.71', sixHours: '£76.26' },
  { band: '18 to 20', hourly: '£10.85', sixHours: '£65.10' },
  { band: '16 and 17', hourly: '£8.00', sixHours: '£48.00' },
  { band: 'Apprentices', hourly: '£8.00', sixHours: '£48.00' },
]

export default function PayingBeaters() {
  return (
    <GuidePage
      path="/guides/paying-beaters-and-pickers-up"
      seoTitle="Paying Beaters and Pickers-Up: Pay, Tax and HMRC | ShootSync"
      description="How much to pay beaters in 2026: the minimum wage per hour, HMRC’s casual beaters rules, when PAYE applies, and the records a shoot must keep."
      title="Paying beaters and pickers-up: pay, tax and the records to keep"
      inShort={
        <>
          <p>
            Most beaters are likely to count as <strong>workers</strong> in law, so they are owed at least the
            minimum wage for every hour they work. From April 2026 that is <strong>£12.71 an hour</strong> for
            anyone 21 or over: <strong>£76.26 for a six-hour day</strong>. Lunch and a brace of birds don’t count
            towards it.
          </p>
          <p>
            For tax, HMRC has a short-engagement rule for casual beaters: a shoot may not need to deduct tax for
            someone engaged for two weeks or less, but must operate PAYE once a casual beater works more than
            14 days in a tax year. Either way, keep a record of everyone you pay.
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
              <p>
                If your beaters are workers, every hour they work must be paid at least at the rate for their age.
                These rates apply from April 2026:
              </p>
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Minimum wage rates table, scrolls sideways on small screens">
                <table className="w-full text-left text-sm border border-slate-700">
                  <caption className="sr-only">Minimum hourly rates from April 2026, and the minimum for a six-hour day</caption>
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th scope="col" className="p-3">Age band</th>
                      <th scope="col" className="p-3">Per hour</th>
                      <th scope="col" className="p-3">Six-hour day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RATES.map((rate) => (
                      <tr key={rate.band} className="border-t border-slate-700">
                        <th scope="row" className="p-3 font-normal">{rate.band}</th>
                        <td className="p-3">{rate.hourly}</td>
                        <td className="p-3">{rate.sixHours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Working it out.</strong> Count the hours a beater is required to be working, from the meet to
                the end of the last drive, and leave out the lunch break. A typical day that meets at 8.30am, stops for
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
                <li><strong>Short engagements:</strong> they are engaged for two weeks or less, and haven’t already been paid above the PAYE threshold by you since 6 April without PAYE being applied.</li>
                <li><strong>Daily casuals:</strong> they work on a casual, daily basis (one or two days a week through the season) and their total is not expected to go over 14 days in the tax year.</li>
              </ul>
              <p>
                <strong>Once a casual beater goes over 14 days in a tax year, you must operate PAYE</strong> and
                deduct tax and National Insurance as normal. PAYE also applies to anyone engaged for more than two
                weeks, anyone doing other work for the shoot, and family members.
              </p>
              <p>
                HMRC is clear that this is not a tax exemption for the beater. The pay is still taxable, and they must
                pay any tax due themselves. National Insurance is due when a day’s pay goes over the relevant
                threshold.
              </p>
              <p>
                Every Saturday from October to the end of January is 18 days in the 2026/27 season, so a regular
                beater on a weekly shoot can pass 14 days with you before the season ends. It is worth counting each beater’s days as you go.
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
                for three years after the end of the current tax year. For the minimum wage, it also pays to record the
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
                <li>Count days per beater through the season, for the 14-day PAYE rule.</li>
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
        { label: 'GOV.UK: Paying harvest casuals and casual beaters (HMRC)', url: 'https://www.gov.uk/paying-harvest-casuals-and-casual-beaters' },
        { label: 'GOV.UK: Low Pay Commission recommendations take the National Living Wage to £12.71', url: 'https://www.gov.uk/government/news/lpc-recommendations-take-the-national-living-wage-to-1271' },
        { label: 'GOV.UK: National Minimum Wage and National Living Wage rates', url: 'https://www.gov.uk/national-minimum-wage-rates' },
        { label: 'Michelmores: Shoot beaters and pickers-up, employment law', url: 'https://michelmores.com/news-views/news/shoot-beaters-pickers-employment-law' },
        { label: 'Strutt & Parker: Shoot beaters and pickers-up, right to work, minimum wages and RTI', url: 'https://www.struttandparker.com/knowledge-and-research/shoot-beaters-and-pickers-up-right-to-work-minimum-wages-and-real-time-information' },
      ]}
      feature={{
        to: '/features#beaters',
        heading: 'Know who is owed what, all season',
        text:
          'ShootSync books your beaters onto each shoot day, works out what each confirmed beater is owed when the day is complete, records each payment with its bank reference, exports a sheet ready for your bank, and counts every beater’s days this tax year against HMRC’s 14-day casual limit.',
      }}
    />
  )
}
