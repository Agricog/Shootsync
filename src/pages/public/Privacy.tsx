/**
 * Privacy and cookies notice - ShootSync
 *
 * Keep the processor list in step with what the browser and server actually
 * contact (Standard §04.4 Assets and origins). If a provider is added or
 * removed, this page changes in the same commit.
 */

import Seo from '../../components/public/Seo'
import LegalPage from '../../components/public/LegalPage'
import { SITE } from '../../config/site'

const UPDATED = '29 October 2026'
const { operator, email } = SITE

export default function Privacy() {
  return (
    <>
      <Seo
        title="Privacy and Cookies Notice | ShootSync"
        description="How ShootSync collects, uses and protects personal data for shooting syndicates, guns, beaters and guest guns, the cookies it uses, and your rights under UK GDPR."
        path="/privacy"
      />
      <LegalPage
        breadcrumb="Privacy"
        title="Privacy and cookies"
        updated={UPDATED}
        intro={
          <p>
            This notice explains what personal data ShootSync handles, why, who else is involved, and your
            rights. ShootSync is run by {operator.legalName}, trading as {operator.tradingAs}, in{' '}
            {operator.region}, registered with the Information Commissioner’s Office as a data controller
            (registration {operator.icoRegistration}). Contact: <a href={`mailto:${email}`}>{email}</a>.
          </p>
        }
        sections={[
          {
            id: 'roles',
            heading: 'Who is responsible for what',
            body: (
              <>
                <p>
                  <strong>Captains’ accounts.</strong> When a captain signs up, ShootSync is the controller of
                  their account details and billing records.
                </p>
                <p>
                  <strong>Information about a syndicate’s guns, beaters and guests.</strong> The syndicate,
                  through its captain, decides what to record about its own people. For that information the
                  syndicate is the controller and ShootSync processes it on the syndicate’s behalf, only to
                  provide the service. If you are a gun, beater or guest and have a question about what your
                  syndicate holds, ask your captain first; we will also help if you email us.
                </p>
              </>
            ),
          },
          {
            id: 'what-we-hold',
            heading: 'What we hold',
            body: (
              <ul>
                <li><strong>Captain’s account:</strong> name, email address and sign-in details.</li>
                <li><strong>Syndicate details:</strong> syndicate name, season dates, subscription amount and beaters’ day rate.</li>
                <li><strong>Members:</strong> name, email, phone, role and status, and, if the captain enters them, BASC number, insurance expiry date and emergency contact.</li>
                <li><strong>Beaters:</strong> name, contact details, day rate and, if the captain enters them, bank name, sort code and account number, used to pay them.</li>
                <li><strong>Shoot days:</strong> dates, locations, peg allocations, attendance and bag records.</li>
                <li><strong>Guest guns:</strong> name, email, phone, emergency contact, acceptance of the guest waiver, and whether the day fee has been paid.</li>
                <li><strong>Payments:</strong> plan, subscription status and payment references. Card details are entered directly with Stripe and never reach ShootSync.</li>
                <li><strong>Technical:</strong> server logs of requests, which can include IP addresses, used to keep the service secure and working.</li>
              </ul>
            ),
          },
          {
            id: 'why',
            heading: 'Why we use it, and the lawful basis',
            body: (
              <ul>
                <li><strong>To provide the service you signed up for</strong> (contract): your account, your syndicate’s records, billing.</li>
                <li><strong>To take subscription payments</strong>, and to record whether a guest has paid their day fee (contract).</li>
                <li><strong>To keep ShootSync secure and working</strong> (legitimate interests): sign-in checks, logs, preventing misuse.</li>
                <li><strong>To keep financial records</strong> (legal obligation): payment records required for tax.</li>
              </ul>
            ),
          },
          {
            id: 'providers',
            heading: 'Who else handles it',
            body: (
              <>
                <p>We use these providers to run ShootSync. Each handles data only to provide its service to us:</p>
                <ul>
                  <li><strong>Clerk</strong>: sign-in and account security.</li>
                  <li><strong>Stripe</strong>: subscription payments. Stripe is also responsible in its own right for the payment data it processes.</li>
                  <li><strong>Neon</strong>: the database where syndicate records are stored.</li>
                  <li><strong>Railway</strong>: hosting for the ShootSync application.</li>
                </ul>
                <p>
                  Some of these providers are based in, or use services in, the United States. Where personal
                  data leaves the UK, it is protected by safeguards recognised under UK data protection law.
                </p>
                <p>We do not sell personal data, and we do not use it for advertising.</p>
              </>
            ),
          },
          {
            id: 'retention',
            heading: 'How long we keep it',
            body: (
              <ul>
                <li>Syndicate records are kept while the syndicate’s subscription is active, so the season’s history stays available.</li>
                <li>When a captain closes their account and asks us to, we delete the syndicate’s records within 30 days of the request.</li>
                <li>Payment records are kept for as long as UK tax law requires.</li>
                <li>A captain can delete a guest record, and mark members and beaters inactive, at any time. To have records erased completely, email us.</li>
              </ul>
            ),
          },
          {
            id: 'security',
            heading: 'How we protect it',
            body: (
              <ul>
                <li>Every connection to ShootSync is encrypted (HTTPS).</li>
                <li>Every request is checked against the signed-in account. One syndicate can never see another syndicate’s records.</li>
                <li>Beaters’ bank details are shown in full only on the captain’s own payments page.</li>
                <li>Card payments are taken by Stripe; ShootSync never sees or stores card numbers.</li>
                <li>Signing out clears ShootSync’s stored data from that browser.</li>
              </ul>
            ),
          },
          {
            id: 'cookies',
            heading: 'Cookies',
            body: (
              <>
                <p>
                  ShootSync uses only the cookies needed to keep you signed in. They are set by Clerk, our sign-in
                  provider, and are strictly necessary, so no consent banner is needed. There are no analytics,
                  advertising or tracking cookies.
                </p>
                <p>
                  The app also keeps a small amount of data in your browser to work properly, which it clears when
                  you sign out.
                </p>
              </>
            ),
          },
          {
            id: 'rights',
            heading: 'Your rights',
            body: (
              <>
                <p>
                  Under UK data protection law you can ask for a copy of your data, ask us to correct or delete it,
                  ask us to restrict or stop using it, and ask for it in a portable format. Email{' '}
                  <a href={`mailto:${email}`}>{email}</a>. We will reply within one month.
                </p>
                <p>
                  If you are unhappy with how we have handled your data, you can complain to the Information
                  Commissioner’s Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a> or on
                  0303 123 1113. We would appreciate the chance to put things right first.
                </p>
              </>
            ),
          },
          {
            id: 'changes',
            heading: 'Changes to this notice',
            body: <p>If this notice changes in a way that matters, we will tell captains by email before it takes effect.</p>,
          },
        ]}
      />
    </>
  )
}
