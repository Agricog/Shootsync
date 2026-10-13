/**
 * Guide: the pheasant shooting season, and every UK game season.
 *
 * Every date on this page comes from src/data/seasonDates.ts (Standard §05.7), and the weekday
 * notes for the current season are worked out from it by src/utils/seasonDates.ts. No date is
 * typed here: tests/seasonDates.test.ts fails if one is. The summer review moves
 * SEASON_RULES.current on, and the page follows.
 *
 * Searchers ask first about pheasant (1,000-10,000 UK searches a month for "pheasant shooting
 * season", Google Keyword Planner, Sep 2025 - Aug 2026), so pheasant is answered first and the
 * full table follows.
 */

import GuidePage from '../../../components/public/GuidePage'
import { SEASON_RULES, type Region } from '../../../data/seasonDates'
import {
  christmasDay,
  formatLongDate,
  formatMonthDayLong,
  formatSeason,
  lastShootingDay,
  seasonDates,
  speciesById,
  weekday,
} from '../../../utils/seasonDates'

const { current, regions } = SEASON_RULES
const pheasant = speciesById('pheasant')
const partridge = speciesById('partridge')

/** "1 October to 1 February" for a region's pheasant season. */
const pheasantRange = (region: Region) => {
  const open = pheasant.seasons[region]!
  return `${formatMonthDayLong(open.opens)} to ${formatMonthDayLong(open.closes)}`
}

export default function SeasonDates() {
  const gbOpen = pheasant.seasons.englandWales!
  const niOpen = pheasant.seasons.northernIreland!
  const gb = seasonDates(gbOpen, current.startYear)
  const ni = seasonDates(niOpen, current.startYear)
  const niLast = lastShootingDay(niOpen, current.startYear, 'northernIreland')!
  const ewLast = lastShootingDay(gbOpen, current.startYear, 'englandWales')!
  const christmas = christmasDay(current.startYear)
  const notes = SEASON_RULES.species.filter((s) => 'note' in s && s.note)
  const sameLastDay = gb.closes.getTime() === ewLast.getTime()

  return (
    <GuidePage
      path="/guides/shooting-season-dates"
      seoTitle={`Pheasant Shooting Season ${current.label}: All UK Dates | ShootSync`}
      description="When the pheasant shooting season starts and ends in England, Wales, Scotland and Northern Ireland, with partridge, grouse, woodcock, snipe and duck dates."
      title={`Pheasant shooting season ${current.label}, and every UK game season`}
      inShort={
        <>
          <p>
            The <strong>pheasant shooting season runs from {pheasantRange('englandWales')}</strong> in England, Wales and
            Scotland, and from <strong>{pheasantRange('northernIreland')}</strong> in Northern Ireland. Both dates are
            included.
          </p>
          <p>
            In {current.label} it opens on <strong>{formatLongDate(gb.opens)}</strong>.{' '}
            {sameLastDay ? (
              <>
                The last day is <strong>{formatLongDate(ewLast)}</strong> in England, Wales and Scotland,
              </>
            ) : (
              <>
                It closes on <strong>{formatLongDate(gb.closes)}</strong> in Scotland; in England and Wales, where no game
                may be shot on a Sunday, the last day is <strong>{formatLongDate(ewLast)}</strong>,
              </>
            )}{' '}
            and <strong>{formatLongDate(niLast)}</strong> in Northern Ireland, where no game may be shot on a Sunday.
          </p>
          <p>
            Partridge opens earlier, on {formatMonthDayLong(partridge.seasons.englandWales!.opens)}, and closes with pheasant.
            Every other game bird and wildfowl season is in the table below.
          </p>
        </>
      }
      sections={[
        {
          id: 'pheasant-season',
          heading: 'When does the pheasant season start and end?',
          body: (
            <>
              <ul>
                <li>
                  <strong>England and Wales: {pheasantRange('englandWales')}.</strong> The Game Act 1831 makes it an
                  offence to kill a pheasant between those two dates, so both days themselves are in the season.
                </li>
                <li>
                  <strong>Scotland: {pheasantRange('scotland')}</strong>, the same dates as England and Wales.
                </li>
                <li>
                  <strong>Northern Ireland: {pheasantRange('northernIreland')}</strong>, closing a day earlier.
                </li>
              </ul>
              <p>
                The legal season is the outer limit. Many pheasant shoots start later than the opening day, when the birds
                are fully grown and the leaves are off the trees. Your keeper will know when your birds are ready.
              </p>
            </>
          ),
        },
        {
          id: 'this-season',
          heading: `The ${current.label} season, day by day`,
          body: (
            <ul>
              <li>
                Pheasant shooting opens on <strong>{formatLongDate(gb.opens)}</strong> everywhere in the UK.
              </li>
              <li>
                <strong>Christmas Day {christmas.getUTCFullYear()}</strong> is a {weekday(christmas)}. In England and Wales,
                no game may be shot that day.
              </li>
              <li>
                In England, Wales and Scotland, the pheasant and partridge seasons end on{' '}
                <strong>{formatLongDate(gb.closes)}</strong>.
                {!sameLastDay && <> That is a Sunday, so the last day in England and Wales is {formatLongDate(ewLast)}.</>}
              </li>
              <li>
                In Northern Ireland they close on <strong>{formatLongDate(ni.closes)}</strong>
                {ni.closes.getTime() !== niLast.getTime() ? (
                  <>
                    . No game may be shot there on a Sunday, so the last shooting day is{' '}
                    <strong>{formatLongDate(niLast)}</strong>.
                  </>
                ) : (
                  <>, which is the last shooting day.</>
                )}
              </li>
            </ul>
          ),
        },
        {
          id: 'season-dates',
          heading: 'Open seasons by species and country',
          body: (
            <>
              <p>Each season opens and closes on the dates shown, both days included.</p>
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Open seasons table, scrolls sideways on small screens">
                <table className="w-full text-left text-sm border border-slate-700">
                  <caption className="sr-only">Open seasons for game birds and waterfowl in England and Wales, Scotland, and Northern Ireland</caption>
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th scope="col" className="p-3">Species</th>
                      {(Object.keys(regions) as Region[]).map((region) => (
                        <th key={region} scope="col" className="p-3">{regions[region]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SEASON_RULES.species.map((s) => (
                      <tr key={s.id} className="border-t border-slate-700">
                        <th scope="row" className="p-3 font-normal text-white">
                          {s.species}
                          {'note' in s && s.note ? '*' : ''}
                        </th>
                        {(Object.keys(regions) as Region[]).map((region) => (
                          <td key={region} className="p-3 whitespace-nowrap">{formatSeason(s.seasons[region])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {notes.map((s) => (
                <p key={s.id} className="text-sm text-slate-400">* {'note' in s ? s.note : ''}</p>
              ))}
            </>
          ),
        },
        {
          id: 'sundays-and-christmas',
          heading: 'Sundays and Christmas Day',
          body: (
            <ul>
              <li>
                <strong>England and Wales:</strong> no game may be killed or taken on a Sunday or on Christmas Day
                (Game Act 1831). Some areas also have orders banning Sunday shooting of certain wild birds, including
                wildfowl.
              </li>
              <li>
                <strong>Scotland:</strong> certain wild birds listed in the Wildlife and Countryside Act 1981 may not be
                shot on Sundays or Christmas Day. Check which species before planning a Sunday or Christmas Day outing.
              </li>
              <li>
                <strong>Northern Ireland:</strong> no wild bird or game may be killed on a Sunday, nor between one
                hour after sunset and one hour before sunrise.
              </li>
            </ul>
          ),
        },
        {
          id: 'planning-the-season',
          heading: 'Planning a syndicate’s season around the dates',
          body: (
            <>
              <p>Most syndicates plan their days well inside the legal season:</p>
              <ul>
                <li>Partridge days often come first, in September and October.</li>
                <li>Many pheasant shoots start later than the opening day, once the birds are ready.</li>
                <li>
                  Keep the last weeks of January in mind for a cocks-only day or a beaters’ day, both long-standing
                  traditions on many shoots.
                </li>
              </ul>
              <p>
                Put the full list of days in the calendar before the season starts, so members can book their guests
                and the beaters can plan around them.
              </p>
            </>
          ),
        },
      ]}
      adviceNote={
        <p>
          Dates are checked against the sources below on the date shown at the top of this page. Species lists and
          general licences are reviewed regularly; in Northern Ireland, check the current DAERA general licences
          before shooting.
        </p>
      }
      sources={[...SEASON_RULES.sources]}
      feature={{
        to: '/features#shoot-days',
        heading: 'Your season’s shoot days in one list',
        text:
          'ShootSync keeps every shoot day of the season in one list, with the date, location, meet time and number of drives, and produces a briefing sheet for each day ready to print or send.',
      }}
    />
  )
}
