/**
 * Terms of service - ShootSync
 * Billing terms must match src/config/plans.ts (BILLING_TERMS).
 */

import { Link } from 'react-router-dom'
import Seo from '../../components/public/Seo'
import LegalPage from '../../components/public/LegalPage'
import { BILLING_TERMS } from '../../config/plans'
import { SITE } from '../../config/site'

const UPDATED = '13 October 2026'
const { operator, email } = SITE

export default function Terms() {
  return (
    <>
      <Seo
        title="Terms of Service | ShootSync"
        description="The terms for using ShootSync, shooting syndicate management software: plans and billing, cancellation, the money-back guarantee, your data and our responsibilities."
        path="/terms"
      />
      <LegalPage
        breadcrumb="Terms"
        title="Terms of service"
        updated={UPDATED}
        intro={
          <p>
            These terms are between you, the captain who signs up for a syndicate, and {operator.legalName},
            trading as {operator.tradingAs} (“ShootSync”, “we”). By creating a syndicate you agree to them.
            Questions: <a href={`mailto:${email}`}>{email}</a>.
          </p>
        }
        sections={[
          {
            id: 'service',
            heading: 'The service',
            body: (
              <p>
                ShootSync is web software for running a shooting syndicate: members, shoot days, peg allocation,
                bag records, beaters’ pay and guest guns. What it does is described on the{' '}
                <Link to="/features">features page</Link>. We may improve or change features over time. If we
                remove something you rely on, we will tell you first.
              </p>
            ),
          },
          {
            id: 'account',
            heading: 'Your account',
            body: (
              <ul>
                <li>You must be 18 or over and acting for your syndicate.</li>
                <li>Keep your sign-in details secure. You are responsible for what happens under your account.</li>
                <li>Give us a working email address. That’s where we send anything important.</li>
              </ul>
            ),
          },
          {
            id: 'billing',
            heading: 'Plans and payment',
            body: (
              <ul>
                <li>Plans and prices are shown on the <Link to="/pricing">pricing page</Link>. You pay monthly in advance, by card, through Stripe.</li>
                <li>ShootSync is not VAT registered, so no VAT is charged.</li>
                <li>{BILLING_TERMS.freeTrial ? 'New syndicates start with a free trial.' : 'There is no free trial.'}</li>
                <li>If we change a price, we will email you at least 30 days before it applies to you.</li>
              </ul>
            ),
          },
          {
            id: 'guarantee',
            heading: `${BILLING_TERMS.moneyBackDays}-day money-back guarantee`,
            body: (
              <p>
                If ShootSync isn’t right for your syndicate, email <a href={`mailto:${email}`}>{email}</a> within{' '}
                {BILLING_TERMS.moneyBackDays} days of your first payment and we will refund it in full and close the
                subscription. This is in addition to your legal rights.
              </p>
            ),
          },
          {
            id: 'cancelling',
            heading: 'Cancelling',
            body: (
              <p>
                There is no contract. Cancel in ShootSync under Settings, Manage billing, or email{' '}
                <a href={`mailto:${email}`}>{email}</a>. Your subscription
                stops at the end of the month you have already paid for, and you keep access until then. Outside
                the money-back guarantee, part months are not refunded.
              </p>
            ),
          },
          {
            id: 'your-data',
            heading: 'Your syndicate’s information',
            body: (
              <>
                <p>
                  Information you put into ShootSync stays yours. You may only enter details about people
                  (members, beaters, guests) where your syndicate has a proper reason to hold them, for example
                  to organise shoot days and pay beaters.
                </p>
                <p>
                  We handle that information only to provide ShootSync to you, as set out in the{' '}
                  <Link to="/privacy">privacy notice</Link>. When you leave, ask us and we will delete your
                  syndicate’s records within 30 days.
                </p>
              </>
            ),
          },
          {
            id: 'guests',
            heading: 'Guest guns and the guest waiver',
            body: (
              <>
                <p>
                  ShootSync provides a standard guest waiver for guests to accept before a shoot day. It is a
                  starting point, not legal advice. You are responsible for checking it suits your shoot and for
                  your syndicate’s safety arrangements, insurance and conduct on the day.
                </p>
                <p>
                  Guest day fees are paid by card through Stripe. How and when collected fees reach your
                  syndicate is agreed with you before your first guest pays.
                </p>
              </>
            ),
          },
          {
            id: 'use',
            heading: 'Fair use',
            body: (
              <p>
                Don’t use ShootSync to break the law, to store information you have no right to hold, or to try
                to get into another syndicate’s data or interfere with the service. We may suspend an account
                that does, and will tell you why.
              </p>
            ),
          },
          {
            id: 'availability',
            heading: 'Availability',
            body: (
              <p>
                We work to keep ShootSync running and your data safe, but we can’t promise it will never be
                unavailable. Where we can, we will tell you about planned maintenance in advance.
              </p>
            ),
          },
          {
            id: 'liability',
            heading: 'Our responsibility to you',
            body: (
              <>
                <p>
                  If we let you down, our total liability to you is limited to what you paid us in the 12 months
                  before the problem. We are not responsible for losses we could not reasonably have foreseen, or
                  for how a shoot day is run.
                </p>
                <p>
                  Nothing in these terms limits liability for death or personal injury caused by negligence, for
                  fraud, or anything else the law does not allow us to limit.
                </p>
              </>
            ),
          },
          {
            id: 'changes',
            heading: 'Changes and law',
            body: (
              <p>
                If we change these terms in a way that matters, we will email you at least 30 days before. These
                terms are governed by the law of England and Wales.
              </p>
            ),
          },
        ]}
      />
    </>
  )
}
