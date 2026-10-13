/**
 * Guide: UK shooting season dates.
 * Dates from GWCT's season table, Northern Ireland checked against the PSNI's
 * wildlife and game advice (February 2026). Re-check every summer, and update
 * the "this season" weekday notes for the new season.
 */

import GuidePage from '../../../components/public/GuidePage'

interface Season {
  species: string
  englandWales: string
  scotland: string
  northernIreland: string
}

const SEASONS: Season[] = [
  { species: 'Pheasant', englandWales: '1 Oct – 1 Feb', scotland: '1 Oct – 1 Feb', northernIreland: '1 Oct – 31 Jan' },
  { species: 'Grey and red-legged partridge', englandWales: '1 Sep – 1 Feb', scotland: '1 Sep – 1 Feb', northernIreland: '1 Sep – 31 Jan' },
  { species: 'Red grouse', englandWales: '12 Aug – 10 Dec', scotland: '12 Aug – 10 Dec', northernIreland: '12 Aug – 30 Nov' },
  { species: 'Black grouse', englandWales: '20 Aug – 10 Dec*', scotland: '20 Aug – 10 Dec', northernIreland: 'No open season' },
  { species: 'Ptarmigan', englandWales: 'No open season', scotland: '12 Aug – 10 Dec', northernIreland: 'No open season' },
  { species: 'Woodcock', englandWales: '1 Oct – 31 Jan', scotland: '1 Sep – 31 Jan', northernIreland: '1 Oct – 31 Jan' },
  { species: 'Common snipe', englandWales: '12 Aug – 31 Jan', scotland: '12 Aug – 31 Jan', northernIreland: '1 Sep – 31 Jan' },
  { species: 'Duck and geese, inland', englandWales: '1 Sep – 31 Jan', scotland: '1 Sep – 31 Jan', northernIreland: '1 Sep – 31 Jan' },
  { species: 'Duck and geese, below high water mark', englandWales: '1 Sep – 20 Feb', scotland: '1 Sep – 20 Feb', northernIreland: '1 Sep – 31 Jan' },
]

export default function SeasonDates() {
  return (
    <GuidePage
      path="/guides/shooting-season-dates"
      seoTitle="UK Shooting Season Dates 2026/27: Pheasant to Duck | ShootSync"
      description="Shooting season dates for pheasant, partridge, grouse, woodcock, snipe and duck in England, Wales, Scotland and Northern Ireland, with the Sunday rules."
      title="UK shooting season dates for 2026/27"
      inShort={
        <>
          <p>
            In England, Wales and Scotland the <strong>pheasant season runs from 1 October to 1 February</strong> and
            partridge from 1 September to 1 February. In Northern Ireland both close a day earlier, on 31 January.
            Dates are inclusive.
          </p>
          <p>
            In England and Wales no game may be shot on a Sunday or on Christmas Day. In Northern Ireland no game or
            wild bird may be shot on a Sunday.
          </p>
        </>
      }
      sections={[
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
                      <th scope="col" className="p-3">England and Wales</th>
                      <th scope="col" className="p-3">Scotland</th>
                      <th scope="col" className="p-3">Northern Ireland</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SEASONS.map((season) => (
                      <tr key={season.species} className="border-t border-slate-700">
                        <th scope="row" className="p-3 font-normal text-white">{season.species}</th>
                        <td className="p-3 whitespace-nowrap">{season.englandWales}</td>
                        <td className="p-3 whitespace-nowrap">{season.scotland}</td>
                        <td className="p-3 whitespace-nowrap">{season.northernIreland}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-slate-400">
                * In Somerset, Devon and the New Forest, black grouse open on 1 September.
              </p>
            </>
          ),
        },
        {
          id: 'this-season',
          heading: 'The 2026/27 season',
          body: (
            <ul>
              <li>Pheasant shooting opened on <strong>Thursday 1 October 2026</strong>.</li>
              <li><strong>Christmas Day 2026</strong> is a Friday. In England and Wales, no game may be shot that day.</li>
              <li>
                <strong>31 January 2027 is a Sunday</strong>, and the pheasant and partridge seasons in England, Wales and
                Scotland end on <strong>Monday 1 February 2027</strong>.
              </li>
              <li>
                In Northern Ireland, where pheasant and partridge close on 31 January and no game may be shot on a
                Sunday, the last shooting day is <strong>Saturday 30 January 2027</strong>.
              </li>
            </ul>
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
              <p>The legal season is the outer limit. Most syndicates plan inside it:</p>
              <ul>
                <li>Partridge days often come first, in September and October.</li>
                <li>
                  Many pheasant shoots start later than 1 October, when the birds are fully grown and the leaves are
                  off the trees. Your keeper will know when your birds are ready.
                </li>
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
      sources={[
        { label: 'GWCT: Shooting season dates for gamebirds and waterfowl', url: 'https://gwct.org.uk/game/advice/shooting-season-dates/' },
        { label: 'PSNI: Advice on wildlife and game protection (February 2026)', url: 'https://www.psni.police.uk/sites/default/files/2026-02/Advice%20on%20Widlife%20and%20Game%20Protection.pdf' },
        { label: 'legislation.gov.uk: Game Act 1831, section 3', url: 'https://www.legislation.gov.uk/ukpga/Will4/1-2/32/section/3' },
        { label: 'legislation.gov.uk: Wildlife and Countryside Act 1981, section 2', url: 'https://www.legislation.gov.uk/ukpga/1981/69/section/2' },
      ]}
      feature={{
        to: '/features#shoot-days',
        heading: 'Your season’s shoot days in one list',
        text:
          'ShootSync keeps every shoot day of the season in one list, with the date, location, meet time and number of drives, and produces a briefing sheet for each day ready to print or send.',
      }}
    />
  )
}
