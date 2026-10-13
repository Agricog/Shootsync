/**
 * Contact page - ShootSync
 */

import { Link } from 'react-router-dom'
import Seo from '../../components/public/Seo'
import LegalPage from '../../components/public/LegalPage'
import { SITE } from '../../config/site'

const { operator, email } = SITE

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Contact ShootSync',
    url: `${SITE.url}/contact`,
    mainEntity: {
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.url,
      email,
      contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email, areaServed: 'GB', availableLanguage: 'English' },
    },
  },
]

export default function Contact() {
  return (
    <>
      <Seo
        title="Contact ShootSync | Shooting Syndicate Software Support"
        description="Get in touch with ShootSync about running your shooting syndicate, a larger estate or several shoots, your account, or your data. Email hello@shootsync.co.uk."
        path="/contact"
        jsonLd={jsonLd}
      />
      <LegalPage
        breadcrumb="Contact"
        title="Contact ShootSync"
        intro={
          <>
            <p>
              Email <a href={`mailto:${email}`} className="text-green-500 underline underline-offset-2">{email}</a>.
              Your message goes to {operator.knownAs}, who builds and runs ShootSync from {operator.region}.
            </p>
          </>
        }
        sections={[
          {
            id: 'what-to-include',
            heading: 'What to include',
            body: (
              <ul>
                <li><strong>Setting up a syndicate:</strong> roughly how many guns, beaters and shoot days you have.</li>
                <li><strong>A larger estate or several shoots:</strong> how your shoots are organised, so we can talk it through.</li>
                <li><strong>A problem:</strong> what you were doing, what you expected, and a screenshot if you can.</li>
                <li><strong>Your data or cancelling:</strong> the email address you signed up with.</li>
              </ul>
            ),
          },
          {
            id: 'more',
            heading: 'Before you write',
            body: (
              <p>
                The <Link to="/#faq">questions shoot captains ask</Link> may already have your answer. How we
                handle data is in the <Link to="/privacy">privacy notice</Link>, and billing and cancelling are in
                the <Link to="/terms">terms</Link>.
              </p>
            ),
          },
        ]}
      />
    </>
  )
}
