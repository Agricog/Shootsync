/**
 * Guide: shooting syndicates - joining one, and running one.
 *
 * Searchers: "shooting syndicate" 100-1,000 UK searches a month, "pheasant syndicate" and
 * "syndicate management" 10-100 (Google Keyword Planner, Sep 2025 - Aug 2026). Many who search
 * "shooting syndicate" want to join one, so joining comes first and running one follows.
 *
 * Every legal or good-practice statement reads src/data/shootingLaw.ts, where each is pinned to the
 * words of its source; nothing is typed here (tests/shootingLaw.test.ts). Everything else is how
 * syndicates commonly work, stated without figures. No cost figures: none was found in a source
 * that could be opened and checked, so none is given (Standard §05.2). The ShootSync box describes
 * only what a captain can use today (src/pages/public/Features.tsx).
 */

import { Link } from 'react-router-dom'
import GuidePage from '../../../components/public/GuidePage'
import { SHOOTING_LAW } from '../../../data/shootingLaw'
import { formatRuleDate } from '../../../utils/beaterPayCalculator'

const { shotgunCertificate, gameLicence, code, sources } = SHOOTING_LAW

export default function ShootingSyndicates() {
  return (
    <GuidePage
      path="/guides/shooting-syndicates"
      seoTitle="Shooting Syndicates: How to Join or Run One | ShootSync"
      description="What a shooting syndicate is, how to find and join one, what members pay for, and what running a pheasant syndicate takes: the law, insurance and records."
      title="Shooting syndicates: how to join one, and how to run one"
      inShort={
        <>
          <p>
            A <strong>shooting syndicate</strong> is a group of guns who share the cost of running a shoot, usually a
            pheasant and partridge shoot on land whose shooting rights the syndicate rents. Each member pays a share of
            the season’s costs and shoots on the syndicate’s days. One member, the <strong>captain</strong>, organises
            it.
          </p>
          <p>
            Every gun needs a <strong>shotgun certificate</strong>, issued by {shotgunCertificate.issuedBy} and usually
            lasting {shotgunCertificate.usualYears} years. In {gameLicence.extent} no game licence has been needed
            since {formatRuleDate(gameLicence.abolishedOn)}. The {code.name} asks the person running the shoot to have
            public liability insurance and to brief the guns at the start of every day.
          </p>
        </>
      }
      sections={[
        {
          id: 'what-is-a-syndicate',
          heading: 'What a shooting syndicate is',
          body: (
            <>
              <p>
                A gun without a shoot of their own can buy days on a commercial shoot, or club together with others in a
                syndicate and run a season of their own. A syndicate trades the convenience of a paid day for a share in
                the shoot itself: the same ground, the same team and a say in how it is run.
              </p>
              <ul>
                <li>
                  <strong>Keepered syndicates</strong> employ a gamekeeper, who rears or buys in the birds, looks after the
                  ground and runs the shoot days. Members mostly turn up and shoot.
                </li>
                <li>
                  <strong>DIY syndicates</strong> share the work between the members: feeding, building and mending pens,
                  and often beating on each other’s days. They cost less in money and more in time.
                </li>
              </ul>
              <p>
                A <strong>pheasant syndicate</strong> is simply a syndicate whose main quarry is pheasant; many also shoot
                partridge early in the season and duck or woodcock where the ground has them. The open seasons are set in
                law, by species and country: see the{' '}
                <Link to="/guides/shooting-season-dates">pheasant shooting season dates</Link>.
              </p>
            </>
          ),
        },
        {
          id: 'joining',
          heading: 'How to find and join a syndicate',
          body: (
            <>
              <p>
                Places in established syndicates often pass by word of mouth, so the best leads are local. Ask at gun shops
                and shooting grounds, ask beaters and keepers you meet, and watch the classified pages of the shooting press.
                Beating on a shoot for a season is a good way to be known when a gun’s place comes up.
              </p>
              <p>Before you pay a subscription, ask the captain:</p>
              <ul>
                <li>How many shoot days are there, and how many guns stand on each?</li>
                <li>What does the subscription pay for, and what is extra: lunches, the keeper’s tip, a beaters’ day?</li>
                <li>When is the money due, and what happens if you have to leave mid-season?</li>
                <li>What work is expected of members, on DIY syndicates especially?</li>
                <li>Can you bring guests, how often, and is there a day fee?</li>
                <li>How are pegs drawn, and does the draw rotate across the season?</li>
                <li>Is there a written agreement between the members, and can you read it first?</li>
              </ul>
              <p>
                If you can, stand as a guest for a day first. You will learn more about how a shoot is run from one day
                on the ground than from any conversation.
              </p>
            </>
          ),
        },
        {
          id: 'costs',
          heading: 'What the members’ money pays for',
          body: (
            <>
              <p>
                Subscriptions vary too widely from shoot to shoot for any one figure to mean much, so it is worth asking
                for the season’s budget rather than a single number. The usual costs are:
              </p>
              <ul>
                <li><strong>The shooting rights</strong>: rent to the landowner for the ground.</li>
                <li><strong>The birds</strong>: poults bought in or reared, and the feed and grit to hold them.</li>
                <li><strong>The keeper</strong>, on a keepered shoot: wages, and often a house and vehicle.</li>
                <li>
                  <strong>Beaters and pickers-up</strong> on every shoot day. If your beaters count as workers, the minimum
                  wage applies: check a day rate with the{' '}
                  <Link to="/tools/beater-pay-calculator">beater pay calculator</Link>.
                </li>
                <li><strong>Equipment</strong>: pens, feeders, game cart and the upkeep of rides and cover crops.</li>
                <li><strong>Insurance</strong>, and often lunches on shoot days.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'running',
          heading: 'Running a syndicate: the captain’s job',
          body: (
            <>
              <p>The captain is the syndicate’s organiser, and on most syndicates its treasurer and secretary too.</p>
              <ul>
                <li>
                  <strong>The ground.</strong> Agree the shooting rights with the landowner in writing: the land, the
                  term, the rent, and what the syndicate may do there.
                </li>
                <li>
                  <strong>The members.</strong> Put the syndicate’s own rules in writing: subscriptions and when they are
                  due, shoot days, guests, behaviour, and what happens when someone leaves.
                </li>
                <li>
                  <strong>Insurance.</strong> The {code.name} says shoot managers must make sure suitable public
                  liability insurance is in place.
                </li>
                <li>
                  <strong>The day.</strong> The Code says shoot managers should always brief the guns at the start of the
                  day, covering health and safety, the expected quarry and the Code itself. Fix the{' '}
                  <Link to="/guides/peg-draw-explained">peg draw</Link> before the first drive.
                </li>
                <li>
                  <strong>The bag.</strong> The Code says all shot game must be regarded as food, so know where the bag
                  goes before the day, whether that is the guns, a game dealer or your own freezers.
                </li>
                <li>
                  <strong>Guests.</strong> Brief guest guns on the law and the day before they arrive: our guide to{' '}
                  <Link to="/guides/guest-guns">guest guns</Link> covers borrowing a shotgun and the day fee.
                </li>
                <li>
                  <strong>Beaters.</strong> Book them, pay them correctly and keep HMRC’s records: see{' '}
                  <Link to="/guides/paying-beaters-and-pickers-up">paying beaters and pickers-up</Link>.
                </li>
                <li>
                  <strong>Records.</strong> Keep the bag for every drive and every day, and the Code’s records of pest
                  and predator control. Our guide to the <Link to="/guides/shooting-game-book">shooting game book</Link>{' '}
                  covers what to record.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'law',
          heading: 'The law in brief',
          body: (
            <ul>
              <li>
                <strong>Certificates.</strong> You need a shotgun certificate, issued by {shotgunCertificate.issuedBy}, to
                possess, buy or acquire a shotgun. It usually lasts {shotgunCertificate.usualYears} years. Your local
                police force sets out its fees.
              </li>
              <li>
                <strong>No game licence.</strong> Since {formatRuleDate(gameLicence.abolishedOn)}, in{' '}
                {gameLicence.extent}, no licence is needed to take or kill game, nor to deal in it.
              </li>
              <li>
                <strong>Seasons and Sundays.</strong> Each species may only be shot in its open season, and in England and
                Wales no game may be shot on a Sunday or Christmas Day: see the{' '}
                <Link to="/guides/shooting-season-dates">season dates</Link>.
              </li>
              <li>
                <strong>Good practice.</strong> The {code.name} is overseen by a committee of {code.steeringBodies}{' '}
                shooting and countryside organisations, among them BASC, the Countryside Alliance and the GWCT. Every
                syndicate should run to it.
              </li>
            </ul>
          ),
        },
      ]}
      adviceNote={
        <p>
          This guide is general information to help you ask the right questions. It isn’t legal advice; the law differs
          between England and Wales, Scotland and Northern Ireland, so check your own situation before you rely on it.
        </p>
      }
      sources={[sources.certificates, sources.gameOrder, sources.code, sources.codePdf]}
      feature={{
        to: '/features',
        heading: 'Run the syndicate from one place',
        text:
          'ShootSync keeps the member list, every shoot day with its briefing sheet, a fair peg draw that remembers the season, the bag drive by drive, the beaters and what each is owed, and guest guns with their waiver and day fee.',
      }}
    />
  )
}
