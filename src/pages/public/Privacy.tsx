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
import { RETENTION, deletionWarningText } from '../../config/retention'

const UPDATED = '31 October 2026'
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
                <li><strong>Members:</strong> name, email, phone and whether they are active, and, where the syndicate records them, BASC number, insurance expiry and an emergency contact.</li>
                <li><strong>Beaters:</strong> name, contact details, day rate and, if the captain enters them, bank name, sort code and account number, used to pay them.</li>
                <li><strong>Shoot days:</strong> dates, locations, peg allocations, attendance and bag records.</li>
                <li><strong>Guest guns:</strong> name, email, phone, emergency contact, the guest acknowledgement they accepted (the exact words, the version and when), and whether the day fee has been paid.</li>
                <li><strong>Payments:</strong> plan, subscription status and payment references. Card details are entered directly with Stripe and never reach ShootSync.</li>
                <li><strong>Activity log:</strong> a record of each change made to a syndicate’s records: what changed, when and by whom (by account, not by name), and which details changed. It never holds the details themselves.</li>
                <li><strong>Voice entry:</strong> if you use voice entry when recording a bag, your browser’s own speech recognition turns what you say into text (in Chrome that is Google’s service, in Safari Apple’s). ShootSync receives only the text.</li>
                <li><strong>Technical:</strong> server logs of requests, which can include IP addresses, used to keep the service secure and working, and error reports, which never include names, contact details, bank details or what was typed.</li>
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
                  <li><strong>Sentry</strong> (Functional Software, Inc.): error reports, stored in the EU (Frankfurt). Reports are stripped of personal data before they leave ShootSync.</li>
                  <li><strong>Resend</strong>: sends the emails ShootSync sends to captains (such as the warning before a syndicate’s records are deleted). It receives the captain’s email address and the message, and nothing else, and keeps its own record of each email it sends, in the United States.</li>
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
              <>
                <p>
                  We keep each kind of record only as long as it is needed, and remove it automatically when its
                  time is up. The checks run every hour.
                </p>
                <ul>
                  <li><strong>Payments</strong> (beaters’ pay, guest day fees, subscriptions) and the activity log entries about them: {RETENTION.paymentsYearsAfterTaxYear} years after the end of the UK tax year they fall in, as HMRC requires.</li>
                  <li><strong>A guest’s signed acknowledgement</strong> (the words they accepted, their name and when): {RETENTION.paymentsYearsAfterTaxYear} years after the end of the tax year of the shoot day, so the syndicate can answer a claim.</li>
                  <li><strong>A guest’s phone number, email address and emergency contact:</strong> {RETENTION.guestContactDays} days after the shoot day. A guest who never accepted or paid is removed completely at the same point.</li>
                  <li><strong>A member’s emergency contact:</strong> while they are a member, and removed when they leave.</li>
                  <li><strong>A beater’s bank details,</strong> once they have stopped beating for the syndicate: {RETENTION.bankDetailsDaysAfterLastPayment} days after their last payment is settled.</li>
                  <li><strong>Contact details of members and beaters who have left:</strong> {RETENTION.leaverMonths} months after they leave. Their name stays only on payment records that must still be kept, and goes when those do.</li>
                  <li><strong>The game book</strong> (shoot days, drives, bags and pegs): for as long as the syndicate uses ShootSync.</li>
                  <li><strong>A syndicate that leaves ShootSync:</strong> everything is deleted {RETENTION.syndicateDaysAfterPlanEnds} days after its plan ends (or, if no plan was ever started, {RETENTION.syndicateDaysAfterPlanEnds} days after it was set up). Until then the syndicate stays in the app, read-only, the captain can download all of it, and the app shows the date. We also email the captain {deletionWarningText()} before. After that, keeping records for tax is the syndicate’s own responsibility, from its download.</li>
                  <li><strong>Sign-in session records:</strong> {RETENTION.sessionDays} days, longer than any sign-in can last, so an ended session can never be used again.</li>
                </ul>
              </>
            ),
          },
          {
            id: 'security',
            heading: 'How we protect it',
            body: (
              <ul>
                <li>Every connection to ShootSync is encrypted (HTTPS).</li>
                <li>Every request is checked against the signed-in account. One syndicate can never see another syndicate’s records.</li>
                <li>Beaters’ bank details are stored encrypted (AES-256), with the key held apart from the database. They are shown only to the captain, only when asked for, and each time they are shown or exported is recorded in the syndicate’s activity log.</li>
                <li>Every change to a syndicate’s records is recorded in an activity log the captain can read and nobody can edit.</li>
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
                  If you are a gun, beater or guest, your syndicate’s captain can act on these requests directly:
                  they can download everything held for the syndicate, and erase a member’s, beater’s or guest’s
                  details. Erasing removes contact details, emergency contacts and bank details at once; a name
                  stays only on payment records or a signed acknowledgement the law requires the syndicate to keep,
                  and goes when those do.
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
