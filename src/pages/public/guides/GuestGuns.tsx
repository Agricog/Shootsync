/**
 * Guide: guest guns - borrowing a shotgun, what to send, day fees and waivers.
 * Law cited: Firearms Act 1968 s.11A and Firearms (Amendment) Act 1997 s.32
 * (England, Wales and Scotland), Unfair Contract Terms Act 1977 s.2,
 * Consumer Rights Act 2015 s.65. Northern Ireland firearms law is separate.
 */

import GuidePage from '../../../components/public/GuidePage'

export default function GuestGuns() {
  return (
    <GuidePage
      path="/guides/guest-guns"
      seoTitle="Guest Guns: Borrowing a Shotgun, Fees and Etiquette | ShootSync"
      description="Can a guest gun borrow a shotgun without a certificate? The Firearms Act rules, what to send a guest before the day, day fees, waivers and etiquette."
      title="Guest guns: the law, the etiquette and the day fee"
      inShort={
        <>
          <p>
            In England, Wales and Scotland, a guest without a shotgun certificate can borrow a shotgun on a shoot
            under <strong>section 11A of the Firearms Act 1968</strong>, but only on private land, from an adult
            certificate holder with the right to allow shooting there, and only while they stay in that person’s
            presence.
          </p>
          <p>
            Before the day, send the guest the date, meet time, location, dress code and day fee, and take an
            emergency contact. A waiver is a useful record that they have read your safety rules, but it can’t remove
            your legal responsibilities.
          </p>
        </>
      }
      sections={[
        {
          id: 'borrowing-without-a-certificate',
          heading: 'Can a guest borrow a shotgun without a certificate?',
          body: (
            <>
              <p>
                Yes, within limits. Section 11A of the Firearms Act 1968 lets a person without a certificate borrow a
                rifle or shotgun on <strong>private premises</strong>, to shoot game or vermin, hunt, or shoot at
                artificial targets, when all of these are true:
              </p>
              <ul>
                <li>The lender is <strong>18 or over</strong> and holds a certificate for that gun.</li>
                <li>
                  The lender has the right to let people onto the land to shoot there, or has been authorised in
                  writing to lend the gun there by someone who has.
                </li>
                <li>
                  The guest stays <strong>in the lender’s presence</strong>, or in the presence of another adult
                  certificate holder who meets the same conditions.
                </li>
                <li>The guest follows any conditions on the lender’s certificate.</li>
              </ul>
              <p>
                Section 11A came into force in 2017 and replaced the old rule that only let a guest borrow from the
                occupier of the land. It applies in England, Wales and Scotland.{' '}
                <strong>Northern Ireland has its own firearms law</strong>, so a shoot there should check the position
                with the PSNI or a shooting organisation.
              </p>
              <p>Young guests have extra age rules of their own. If a guest is under 18, check before inviting them.</p>
            </>
          ),
        },
        {
          id: 'lending-to-a-certificate-holder',
          heading: 'Lending a shotgun to a guest who has a certificate',
          body: (
            <>
              <p>
                When the guest holds their own shotgun certificate, a short loan is simpler. The transfer rules in
                section 32 of the Firearms (Amendment) Act 1997 only apply to a shotgun lent{' '}
                <strong>for more than 72 hours</strong>. A loan for the day, returned that day, falls outside them.
              </p>
              <p>
                A loan of more than 72 hours is treated as a transfer: the borrower must produce their certificate,
                the lender must follow the instructions on it, and the gun must be handed over in person.
              </p>
            </>
          ),
        },
        {
          id: 'before-the-day',
          heading: 'What to send a guest before the day',
          body: (
            <>
              <p>A guest who knows what to expect arrives on time and enjoys the day. Send them:</p>
              <ul>
                <li><strong>Date, meet time and meeting point</strong>, with a postcode and directions for the last mile.</li>
                <li><strong>What to wear</strong>, and whether ties or tweed are expected.</li>
                <li><strong>Gun and cartridges:</strong> whether they are bringing their own gun, the bore, and roughly how many cartridges.</li>
                <li><strong>Dogs:</strong> whether they can bring one.</li>
                <li><strong>Lunch</strong> arrangements, and roughly when the day will finish.</li>
                <li><strong>The day fee</strong> and how to pay it, and the shoot’s custom on tipping the keeper.</li>
                <li><strong>Your safety rules</strong>, so the briefing on the day isn’t the first time they hear them.</li>
              </ul>
              <p>And ask them for:</p>
              <ul>
                <li>an <strong>emergency contact</strong> name and phone number</li>
                <li>whether they have <strong>shooting insurance</strong>, for example through a shooting organisation’s membership</li>
                <li>whether they hold a <strong>shotgun certificate</strong>, if they are borrowing a gun</li>
              </ul>
            </>
          ),
        },
        {
          id: 'day-fees',
          heading: 'Guest day fees',
          body: (
            <>
              <p>
                Many syndicates charge a guest day fee, which goes towards the cost of the birds, the keeper and the
                beaters. The amount is for each syndicate to set; agree it at the start of the season so members know
                what to tell their guests.
              </p>
              <p>
                Collect the fee before the day if you can. It saves an awkward conversation at the end of a good day,
                and it settles who is coming.
              </p>
            </>
          ),
        },
        {
          id: 'waivers',
          heading: 'What a guest waiver can and can’t do',
          body: (
            <>
              <p>
                Many shoots ask guests to accept a waiver. It is worth having, but be clear about what it does. UK law
                limits what any waiver can exclude: in many situations, liability for death or personal injury caused
                by negligence can’t be excluded at all.
              </p>
              <p>A waiver is most useful as a record that the guest:</p>
              <ul>
                <li>has read the shoot’s safety rules before the day</li>
                <li>understands the risks of a driven shoot</li>
                <li>has given an emergency contact</li>
              </ul>
              <p>
                It doesn’t replace a proper safety briefing, sensible management on the day, or the shoot’s own
                insurance. If you rely on a waiver, have a solicitor look at the wording.
              </p>
            </>
          ),
        },
        {
          id: 'etiquette',
          heading: 'Etiquette for guests on the day',
          body: (
            <ul>
              <li><strong>Safety first.</strong> Listen to the briefing, and never swing through the line or shoot low birds.</li>
              <li><strong>Arrive early.</strong> The draw happens at the meet, and late guns hold everyone up.</li>
              <li><strong>Shoot your own birds.</strong> Leave birds that are clearly your neighbour’s.</li>
              <li><strong>Shoot within range.</strong> Wounding birds at long range is poor form and poor practice.</li>
              <li><strong>Mark your birds</strong> for the pickers-up at the end of each drive.</li>
              <li><strong>Thank the keeper</strong>, and ask your host how much to tip if you are unsure.</li>
            </ul>
          ),
        },
      ]}
      adviceNote={
        <p>
          This guide is general information, not legal advice. Firearms law has conditions and exceptions that aren’t
          covered here. If you’re unsure whether an arrangement is lawful, check with your firearms licensing
          department, a shooting organisation, or a solicitor.
        </p>
      }
      sources={[
        { label: 'legislation.gov.uk: Firearms Act 1968, section 11A (authorised lending for hunting etc.)', url: 'https://www.legislation.gov.uk/ukpga/1968/27/section/11A' },
        { label: 'legislation.gov.uk: Firearms (Amendment) Act 1997, section 32 (transfers and loans)', url: 'https://www.legislation.gov.uk/ukpga/1997/5/section/32' },
        { label: 'legislation.gov.uk: Unfair Contract Terms Act 1977, section 2', url: 'https://www.legislation.gov.uk/ukpga/1977/50/section/2' },
        { label: 'legislation.gov.uk: Consumer Rights Act 2015, section 65', url: 'https://www.legislation.gov.uk/ukpga/2015/15/section/65' },
        { label: 'Shooting UK: How to make sure a shoot day goes well', url: 'https://www.shootinguk.co.uk/legislation/first-shoot-day/' },
      ]}
      feature={{
        to: '/features#guest-guns',
        heading: 'Guests sorted before the day',
        text:
          'With ShootSync you invite a guest from the shoot day and send them their own link. They see the date, location and meet time, accept the guest waiver, leave an emergency contact and pay the day fee by card, without needing an account.',
      }}
    />
  )
}
