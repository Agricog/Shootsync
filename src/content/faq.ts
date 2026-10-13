/**
 * Frequently asked questions - shown on the home page and published as FAQPage
 * structured data from the same list, so the two can never disagree.
 *
 * Every answer describes what ShootSync does today. Nothing planned, nothing borrowed.
 */

import { BILLING_TERMS, PLANS } from '../config/plans'
import { SITE } from '../config/site'

const starter = PLANS.find((plan) => plan.tier === 'STARTER')!
const standard = PLANS.find((plan) => plan.tier === 'STANDARD')!

export interface Faq {
  question: string
  answer: string
}

export const FAQS: Faq[] = [
  {
    question: 'What is ShootSync?',
    answer:
      'ShootSync is shooting syndicate management software for UK shoot captains. It keeps your members, shoot days, peg draw, bag records, beaters and guest guns in one place, instead of spread across WhatsApp threads, spreadsheets and the back of an envelope.',
  },
  {
    question: 'Who is ShootSync for?',
    answer:
      'Captains and organisers of UK driven shooting syndicates: pheasant, partridge and duck days run by a group of guns who share the costs and the work. It is built around how a syndicate season actually runs, from setting the subscription to paying the beaters after the last drive.',
  },
  {
    question: 'How does the peg draw work?',
    answer:
      "ShootSync runs a fair rotation rather than a random draw. It looks at which pegs each gun has already stood on this season and gives each one the peg they have had least, so over the season everyone gets their turn on the good pegs. You see the allocation before you save it to the shoot day.",
  },
  {
    question: 'Can I record the bag on the day?',
    answer:
      'Yes. Record the bag drive by drive for pheasant, partridge, duck, woodcock and other quarry, and ShootSync keeps the running total for the day and for the season. On a phone or computer whose browser supports speech recognition, such as Chrome, you can say the numbers instead of typing them.',
  },
  {
    question: 'Do guest guns need an account?',
    answer:
      'No. You invite a guest from the shoot day and send them their own link. They read and accept the guest waiver, give an emergency contact, and pay the day fee by card. Card payments are handled by Stripe, so card details never reach ShootSync.',
  },
  {
    question: 'How does ShootSync help with paying beaters?',
    answer:
      "Keep each beater's day rate and bank details in one list, see what each is owed, mark payments as paid with your bank reference, and export a spreadsheet ready for your bank transfers. ShootSync records the payments; the money still moves through your own bank.",
  },
  {
    question: 'Do my guns need to sign up?',
    answer:
      "No. As captain you keep the member list, with each gun's role and contact details. Your guns don't need an account to be on it.",
  },
  {
    question: 'How much does ShootSync cost?',
    answer: `${starter.name} is £${starter.monthlyPrice} a month for up to 10 guns. ${standard.name} is £${standard.monthlyPrice} a month for up to 20 guns, unlimited beaters and priority support. Both are billed monthly with no contract. For larger estates or several shoots, get in touch.`,
  },
  {
    question: 'Is there a free trial?',
    answer: BILLING_TERMS.freeTrial
      ? 'Yes.'
      : `No. Instead, every plan has a ${BILLING_TERMS.moneyBackDays}-day money-back guarantee: if ShootSync isn't right for your syndicate, email us within ${BILLING_TERMS.moneyBackDays} days of your first payment for a full refund.`,
  },
  {
    question: 'Can I cancel at any time?',
    answer: `Yes. There is no contract. Email ${SITE.email} and your subscription stops at the end of the month you have paid for.`,
  },
  {
    question: 'Who can see my syndicate’s information?',
    answer:
      "Only you, as the syndicate's captain, when signed in. Every request to ShootSync is checked against the signed-in account, and one syndicate can never see another's members, beaters, shoot days or payments. We don't sell or share your data, and the site sets no advertising or tracking cookies.",
  },
  {
    question: 'Does it work on a phone?',
    answer:
      'Yes. ShootSync runs in the web browser on a phone, tablet or computer, so there is nothing to download from an app store. On a phone you can add it to your home screen and open it like an app.',
  },
]
