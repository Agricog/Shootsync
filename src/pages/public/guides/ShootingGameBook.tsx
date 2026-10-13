/**
 * Guide: the shooting game book - what to record, and why.
 *
 * Searchers: "shooting game book" and "game book app", each 10-100 UK searches a month (Google
 * Keyword Planner, Sep 2025 - Aug 2026). The only app phrase with measurable demand.
 *
 * Statements about the Code of Good Shooting Practice and GWCT's National Gamebag Census read
 * src/data/shootingLaw.ts, where each is pinned to its source; nothing is typed here
 * (tests/shootingLaw.test.ts). The rest is how game books are kept, stated as practice; the page
 * makes no claim about whether the law requires one. The ShootSync box matches the Features page's
 * bag records section.
 */

import { Link } from 'react-router-dom'
import GuidePage from '../../../components/public/GuidePage'
import { SHOOTING_LAW } from '../../../data/shootingLaw'

const { code, sources } = SHOOTING_LAW

const DAY_RECORD = [
  { item: 'Date and ground', why: 'The shoot, the beat if you have more than one, and the weather.' },
  { item: 'Guns', why: 'Who stood, guests included, and the peg each drew.' },
  { item: 'Each drive', why: 'Its name, and the bag on it by species.' },
  { item: 'The day’s bag', why: 'Totals by species, with what any “other” was: a hare, a pigeon, a woodcock.' },
  { item: 'The team', why: 'How many beaters and pickers-up, so next season’s day can be planned and costed.' },
  { item: 'Notes', why: 'What worked and what didn’t: a drive that blanked, a flush that came too fast.' },
]

export default function ShootingGameBook() {
  return (
    <GuidePage
      path="/guides/shooting-game-book"
      seoTitle="Keeping a Shooting Game Book: What to Record | ShootSync"
      description="How to keep a shooting game book: what to record for each day and drive, why the bag record matters to your shoot, and GWCT’s National Gamebag Census."
      title="The shooting game book: what to record, and why it matters"
      inShort={
        <>
          <p>
            A <strong>game book</strong> is the record of what was shot: for each day, the date and ground, the guns,
            and the bag by species, best kept <strong>drive by drive</strong>. Guns keep their own; a syndicate keeps
            one for the shoot.
          </p>
          <p>
            Kept honestly over the seasons, the shoot’s game book shows which drives work, how the shoot is doing year on
            year, and is exactly what the GWCT asks shoots to share, free and in confidence, through its National Gamebag
            Census.
          </p>
        </>
      }
      sections={[
        {
          id: 'what-to-record',
          heading: 'What to record for each shoot day',
          body: (
            <>
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="What to record table, scrolls sideways on small screens">
                <table className="w-full text-left text-sm border border-slate-700">
                  <caption className="sr-only">What a shoot’s game book records for each day</caption>
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th scope="col" className="p-3">Record</th>
                      <th scope="col" className="p-3">What it means</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAY_RECORD.map((row) => (
                      <tr key={row.item} className="border-t border-slate-700">
                        <th scope="row" className="p-3 font-normal text-white">{row.item}</th>
                        <td className="p-3">{row.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                At the end of the season, add up each species across every day. That season total is the figure you will
                compare next year’s against.
              </p>
            </>
          ),
        },
        {
          id: 'drive-by-drive',
          heading: 'Why drive by drive, and why on the day',
          body: (
            <>
              <p>
                A day’s total tells you how the day went. The drive-by-drive record tells you why: which drives produce
                birds, which blank, and which might shoot better from the other direction or later in the season.
              </p>
              <p>
                Write each drive down as it finishes, at the game cart, rather than reconstructing the day over lunch or
                that evening. Numbers remembered hours later drift, and they drift in both directions.
              </p>
            </>
          ),
        },
        {
          id: 'over-the-seasons',
          heading: 'What a game book tells you over the seasons',
          body: (
            <ul>
              <li><strong>Planning.</strong> Last season’s bag on each day is the best guide to the expected bag you give the guns this season.</li>
              <li><strong>The ground.</strong> Drives that fall away year on year point to cover, feeding or flushing that needs attention.</li>
              <li><strong>The money.</strong> Set the bag against what the season cost, and the syndicate can see what each bird shot is costing it.</li>
              <li>
                <strong>Fairness.</strong> With pegs recorded alongside the bag, everyone can see that the{' '}
                <Link to="/guides/peg-draw-explained">peg draw</Link> has given each gun their share of the good pegs.
              </li>
            </ul>
          ),
        },
        {
          id: 'national-gamebag-census',
          heading: 'Sharing your bag with the National Gamebag Census',
          body: (
            <>
              <p>
                The GWCT asks shoots to contribute their annual bag records to its <strong>National Gamebag Census</strong>,
                which tracks trends in game numbers over time. There is no fee to take part, and the GWCT keeps the
                records strictly confidential.
              </p>
              <p>
                It also wants to hear from anyone holding <strong>historical bag records kept in game books</strong>: an
                old shoot game book in a drawer can add years to the record.
              </p>
            </>
          ),
        },
        {
          id: 'other-records',
          heading: 'The other records a shoot keeps',
          body: (
            <ul>
              <li>
                <strong>Pest and predator control.</strong> The {code.name} says accurate records should be kept of the
                pest and predator control carried out.
              </li>
              <li>
                <strong>Where the bag went.</strong> The Code says all shot game must be regarded as food. Noting how many
                birds went to the guns, to a game dealer or to the freezer shows it was.
              </li>
              <li>
                <strong>Beaters’ days and pay.</strong> HMRC asks for a record of everyone you pay: see{' '}
                <Link to="/guides/paying-beaters-and-pickers-up">paying beaters and pickers-up</Link>.
              </li>
            </ul>
          ),
        },
        {
          id: 'personal-game-book',
          heading: 'A gun’s own game book',
          body: (
            <p>
              Many guns keep a personal game book too, often a bound book kept for a lifetime: the date, the shoot, who
              they shot with, the peg, and their own bag or the day’s. It is the same record seen from one peg, and the
              shoot’s game book is where those details come from.
            </p>
          ),
        },
      ]}
      adviceNote={
        <p>
          The statements here about the Code of Good Shooting Practice and the National Gamebag Census are taken from the
          GWCT pages listed below. The rest is how game books are commonly kept, not legal advice.
        </p>
      }
      sources={[sources.gamebagCensus, sources.codePdf, sources.code]}
      feature={{
        to: '/features#bag-records',
        heading: 'Your game book, kept for you',
        text:
          'Record the bag drive by drive as the day goes, by voice or by hand. The day’s totals build as each drive is entered, a drive can be corrected or deleted, and the season’s game book, with every day’s bag and totals for every species, exports to a spreadsheet.',
      }}
    />
  )
}
