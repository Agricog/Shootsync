/**
 * Guide: the peg draw explained.
 * Conventions, not law: sources are shooting press. The ShootSync section must
 * match what src/utils/pegAlgorithm.ts actually does.
 */

import GuidePage from '../../../components/public/GuidePage'

const MOVE_UP = [
  { drive: 'First drive', peg: 1 },
  { drive: 'Second drive', peg: 3 },
  { drive: 'Third drive', peg: 5 },
  { drive: 'Fourth drive', peg: 7 },
  { drive: 'Fifth drive', peg: 1 },
]

export default function PegDraw() {
  return (
    <GuidePage
      path="/guides/peg-draw-explained"
      seoTitle="The Peg Draw Explained: How Shoot Pegs Work | ShootSync"
      description="How a peg draw works on a driven shoot, why guns move up two or three pegs each drive, and how to keep pegs fair for every gun across a whole season."
      title="The peg draw explained: how pegs are drawn and kept fair"
      inShort={
        <>
          <p>
            Before the first drive, each gun draws a number. That is their peg, the marked spot where they stand, on
            the first drive. After each drive everyone <strong>moves up</strong> by a set number of pegs, usually{' '}
            <strong>two with eight guns and three with ten</strong>, so everyone gets a turn in the middle of the line.
          </p>
          <p>
            A draw is fair on the day but not across a season: the same gun can draw the end of the line three shoots
            running. The fix is to rotate starting pegs using a record of where everyone has already stood.
          </p>
        </>
      }
      sections={[
        {
          id: 'what-is-a-peg',
          heading: 'What a peg is',
          body: (
            <>
              <p>
                On a driven shoot the guns stand in a line while the beaters drive the birds towards them. Each
                standing position is marked, often with a numbered stick or card, and is called a <strong>peg</strong>.
                The keeper sets the pegs out for each drive, so peg 4 on one drive is a different spot from peg 4 on
                the next.
              </p>
              <p>
                Some pegs see more birds than others. Where the birds come over depends on the wind, the flushing point
                and their line back to the wood, so the middle of the line is often, but not always, the busiest.
              </p>
            </>
          ),
        },
        {
          id: 'the-draw',
          heading: 'How the draw works on the day',
          body: (
            <>
              <ol>
                <li>
                  At the meet, the captain or host offers the guns a set of numbered tokens: in a hat, a leather peg
                  wallet, or numbered cartridges.
                </li>
                <li>Each gun draws one. That number is their peg for the first drive.</li>
                <li>
                  The safety briefing says how many guns are shooting, which way the pegs are numbered, and how many
                  places to move up after each drive.
                </li>
                <li>Guests are usually given a number next to their host, so someone is on hand to help them.</li>
              </ol>
              <p>
                Numbering systems vary between shoots, so a new or guest gun should listen carefully to which end of the
                line peg 1 is.
              </p>
            </>
          ),
        },
        {
          id: 'moving-up',
          heading: 'Moving up after each drive',
          body: (
            <>
              <p>
                If guns stayed on their drawn peg all day, whoever drew the end would have a quiet day. So after every
                drive, each gun moves up by the same number of pegs, going back to the start once they pass the last
                peg. The usual rule is <strong>two pegs with eight guns</strong> and <strong>three with ten</strong>.
              </p>
              <p>For example, a gun who draws peg 1 on an eight-gun day, moving up two:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border border-slate-700">
                  <caption className="sr-only">Pegs for a gun who draws peg 1, with eight guns moving up two</caption>
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th scope="col" className="p-3">Drive</th>
                      <th scope="col" className="p-3">Peg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOVE_UP.map((row) => (
                      <tr key={row.drive} className="border-t border-slate-700">
                        <th scope="row" className="p-3 font-normal">{row.drive}</th>
                        <td className="p-3">{row.peg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Moving by two means you don’t stand next to the same neighbours all day, and over four drives every gun
                spends time in the middle and on the ends. After peg 7 the count goes past peg 8 and starts again at
                peg 1.
              </p>
            </>
          ),
        },
        {
          id: 'walking-and-back-guns',
          heading: 'Walking guns and back guns',
          body: (
            <>
              <p>
                Some shoots put a gun or two with the beaters as <strong>walking guns</strong>, or behind the line as{' '}
                <strong>back guns</strong>, often taking turns through the day.
              </p>
              <ul>
                <li>
                  A walking gun shoots birds that break back over the beaters. They should agree with the beaters where
                  to walk and when to shoot, and someone new to it should have a picker-up with them.
                </li>
                <li>
                  A back gun stands well behind the line, close enough to see the drive but never where they could be a
                  danger to the guns in front.
                </li>
              </ul>
              <p>If your shoot uses either, say how they rotate in the briefing, so nobody feels left out.</p>
            </>
          ),
        },
        {
          id: 'fair-over-a-season',
          heading: 'Keeping pegs fair across a whole season',
          body: (
            <>
              <p>
                A fresh draw at every shoot is fair on each day, but chance doesn’t even out over a season of ten or
                twelve days. In a syndicate where everyone pays the same subscription, the gun who keeps drawing the
                poor end of the line notices, and so does everyone else. There are three common ways to handle it:
              </p>
              <ul>
                <li>
                  <strong>Random draw every time.</strong> Simple and accepted, but streaks happen.
                </li>
                <li>
                  <strong>A fixed rotation.</strong> Everyone’s starting peg moves along by one each shoot. Fair if the
                  same guns come every time, harder to keep straight when people miss days.
                </li>
                <li>
                  <strong>A rotation based on the record.</strong> Before each shoot, each gun gets the starting peg
                  they have had least often so far. This stays fair when guns miss days, but needs someone to keep the
                  record accurately.
                </li>
              </ul>
              <p>
                Whichever you choose, agree it at the start of the season, write it down, and keep the record where
                the guns can see it. Most peg arguments are about memory, not the rule.
              </p>
            </>
          ),
        },
      ]}
      sources={[
        { label: 'Shooting UK: How to put out the pegs', url: 'https://www.shootinguk.co.uk/shooting/howtoputoutthepegs95986/' },
        { label: 'Shooting UK: How to make sure a shoot day goes well', url: 'https://www.shootinguk.co.uk/legislation/first-shoot-day/' },
      ]}
      feature={{
        to: '/features#peg-draw',
        heading: 'A peg draw that remembers the season',
        text:
          'ShootSync keeps a record of where every gun has stood and, for each shoot, gives every gun the starting peg they have had least this season, with the guns who have had fewest days placed first. You see the allocation before you save it, and the pegs go straight onto the briefing sheet.',
      }}
    />
  )
}
