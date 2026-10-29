/**
 * Frequently asked questions - shown on the home page and published as FAQPage
 * structured data from the same list, so the two can never disagree.
 *
 * Every answer describes what ShootSync does today. Nothing planned, nothing borrowed.
 */

import { BILLING_TERMS, PLANS } from '../config/plans'
import { SITE } from '../config/site'
import { CASUAL_BEATERS } from '../data/payRules'

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
      'Captains and organisers of UK driven shooting syndicates: pheasant, partridge and duck days run by a group of guns who share the costs and the work. It is built around how a syndicate season actually runs, from setting up the season to paying the beaters after the last drive.',
  },
  {
    question: 'How does the peg draw work?',
    answer:
      "Tick who is shooting and run a fair draw. ShootSync looks at the pegs each gun has already stood on this season and keeps everyone off their repeats as far as the whole line allows, drawing at random between equally fair options. Each gun's pegs so far are shown beside their name. You can swap any two guns by hand before you save, and the pegs go straight onto the PDF briefing sheet. A straight random draw is there too.",
  },
  {
    question: 'Can I record the bag on the day?',
    answer:
      'Yes. Record the bag drive by drive for pheasant, partridge, duck, woodcock and other quarry, and ShootSync keeps the running total for the day and the season’s game book: totals for every species and each day’s bag, which you can export to a spreadsheet. On a phone or computer whose browser supports speech recognition, such as Chrome, you can say the numbers instead of typing them.',
  },
  {
    question: 'Do guest guns need an account?',
    answer:
      'No. You invite a guest from the shoot day and copy them their own link to send by text or email. They read and accept the guest waiver and give an emergency contact. Guests pay their day fee to the syndicate as you arrange, and you mark in ShootSync who has paid.',
  },
  {
    question: 'How does ShootSync help with paying beaters?',
    answer:
      `Book your beaters onto each shoot day and mark who confirmed. When you mark the day complete, everyone confirmed is owed their day rate. You see what each beater is owed, day by day, mark them paid with your bank reference, and export a sheet with bank details and amounts for your bank. Each beater's days this tax year are counted too, with a flag past HMRC's ${CASUAL_BEATERS.dayLimit}-day casual limit. The money itself still moves through your own bank.`,
  },
  {
    question: 'Do my guns need to sign up?',
    answer:
      "No. As captain you keep the member list, with each gun's contact details. Your guns don't need an account to be on it.",
  },
  {
    question: 'How much does ShootSync cost?',
    answer: `${starter.name} is £${starter.monthlyPrice} a month for up to 10 guns. ${standard.name} is £${standard.monthlyPrice} a month for up to 20 guns, unlimited beaters and priority support (a reply within one working day). Both are billed monthly with no contract. For larger estates or several shoots, get in touch.`,
  },
  {
    question: 'Is there a free trial?',
    answer: BILLING_TERMS.freeTrial
      ? 'Yes.'
      : `No. Instead, every plan has a ${BILLING_TERMS.moneyBackDays}-day money-back guarantee: if ShootSync isn't right for your syndicate, email us within ${BILLING_TERMS.moneyBackDays} days of your first payment for a full refund.`,
  },
  {
    question: 'Can I cancel at any time?',
    answer: `Yes. There is no contract. Cancel in ShootSync under Settings, Manage billing, or email ${SITE.email}, and your subscription stops at the end of the month you have paid for.`,
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
