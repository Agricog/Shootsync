/**
 * Guide: tipping the keeper.
 * Custom, not law. Figures are the conventions reported by The Field and are
 * labelled as conventions; never present them as a rule.
 */

import GuidePage from '../../../components/public/GuidePage'

const TRADITIONAL = [
  { bag: '100 birds', tip: '£35 to £40' },
  { bag: '200 birds', tip: '£60 to £70' },
  { bag: '300 birds', tip: '£85 to £100' },
]

export default function TippingTheKeeper() {
  return (
    <GuidePage
      path="/guides/tipping-the-keeper"
      seoTitle="Tipping the Keeper: How Much to Tip by Bag Size | ShootSync"
      description="How much to tip the gamekeeper on a shoot day, by the size of the bag: the traditional rule of thumb, when and how to hand it over, and syndicate customs."
      title="Tipping the keeper: how much, when and how"
      inShort={
        <>
          <p>
            The traditional rule of thumb is <strong>£10, plus £25 to £30 for every 100 birds in the bag</strong>, so
            around <strong>£60 to £70 for a 200-bird day</strong>. Each gun tips individually, in cash, at the end of
            the day when the keeper hands over the birds.
          </p>
          <p>
            These are conventions, not rules. If you’re a guest and unsure, ask your host: every shoot has its own
            custom.
          </p>
        </>
      }
      sections={[
        {
          id: 'how-much',
          heading: 'How much to tip, by the size of the bag',
          body: (
            <>
              <p>
                The long-standing rule, as reported by <em>The Field</em>, is an initial £10 plus £25 to £30 for every
                100 birds. Worked through:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border border-slate-700">
                  <caption className="sr-only">Traditional tip by size of bag: £10 plus £25 to £30 per 100 birds</caption>
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th scope="col" className="p-3">Bag for the day</th>
                      <th scope="col" className="p-3">Traditional tip per gun</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TRADITIONAL.map((row) => (
                      <tr key={row.bag} className="border-t border-slate-700">
                        <th scope="row" className="p-3 font-normal">{row.bag}</th>
                        <td className="p-3">{row.tip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <em>The Field</em> also reports a newer convention of a £20 starting token, giving about £65 for a
                200-bird day and £85 for 300 or more, which tops out lower on the biggest days.
              </p>
              <p>
                Keepers say guns often tip more generously on small days than on big ones, which is fair: a small
                day can take just as much work.
              </p>
            </>
          ),
        },
        {
          id: 'when-and-how',
          heading: 'When and how to hand it over',
          body: (
            <ul>
              <li>
                <strong>At the end of the day</strong>, usually when the keeper hands each gun their brace of birds. Too
                early and the moment is lost in the bustle; too late and the keeper is kept waiting.
              </li>
              <li>
                <strong>In cash, discreetly.</strong> Fold the notes small and pass them during a handshake, with a word
                of thanks for the day.
              </li>
              <li>
                <strong>Mean the thanks.</strong> A tip is a thank-you for the keeper’s year of work as well as the
                day. If something went wrong, find out why before you hold back, because the cause may not have been
                the keeper’s.
              </li>
            </ul>
          ),
        },
        {
          id: 'syndicates',
          heading: 'Tipping on a syndicate day',
          body: (
            <>
              <p>
                Customs vary more on syndicate shoots, where the guns pay towards the keeper’s costs through their
                subscription. Some syndicates expect each member to tip as on a let day; some agree a set amount; some
                collect for an end-of-season gift instead.
              </p>
              <p>
                Whatever your syndicate does, agree it at the start of the season and tell guests in their invitation,
                so nobody turns up without cash or tips three times the going rate.
              </p>
            </>
          ),
        },
        {
          id: 'beaters-and-pickers-up',
          heading: 'Beaters, pickers-up and the keeper’s tax',
          body: (
            <>
              <p>
                The tip goes to the keeper. Beaters and pickers-up are paid by the shoot. Whether guns also tip a
                picker-up who has worked hard for them varies from shoot to shoot, so ask your host. A word of thanks
                to the beating line at the end of the day always goes down well.
              </p>
              <p>
                For keepers: tips are part of your income and are taxable, so keep them in mind when you declare it.
              </p>
            </>
          ),
        },
      ]}
      sources={[
        { label: 'The Field: What is the etiquette of tipping when shooting?', url: 'https://www.thefield.co.uk/features/shooting-tipping-the-gamekeeper-when-game-shooting-22324' },
        { label: 'Shooting UK: How to make sure a shoot day goes well', url: 'https://www.shootinguk.co.uk/legislation/first-shoot-day/' },
      ]}
      feature={{
        to: '/features#bag-records',
        heading: 'Know the bag before you reach for your wallet',
        text:
          'ShootSync records the bag drive by drive as the day goes, by voice or by hand, so the day’s totals by species are there at the end of the last drive.',
      }}
    />
  )
}
