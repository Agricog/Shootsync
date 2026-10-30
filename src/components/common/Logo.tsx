/**
 * The ShootSync mark - one drawing, used everywhere a logo appears (header, footer, sign-in,
 * guest page), in place of the hand-built "SS" boxes each page used to make for itself.
 *
 * The mark: a peg. A numbered peg is the one thing every gun looks for on a shoot day, and the
 * fair peg draw is what ShootSync is known for. A white peg disc on a stake, on the brand green.
 * public/favicon.svg is the same drawing; keep the two together.
 */

import { Link } from 'react-router-dom'

const BRAND_GREEN = '#16a34a'

export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" fill={BRAND_GREEN} />
      {/* The stake, driven in at a slight angle like a real peg. */}
      <path d="M33 30 L39.5 54" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      {/* The disc. */}
      <circle cx="29" cy="22" r="12.5" fill="#ffffff" />
      <circle cx="29" cy="22" r="7" fill={BRAND_GREEN} />
    </svg>
  )
}

interface LogoProps {
  /** Where the logo takes you: "/" on public pages, "/dashboard" once signed in. */
  to?: string
  /** Hide the word on the narrowest screens (the signed-in header is short of room there). */
  wordFrom?: 'always' | 'sm'
  size?: 'md' | 'lg'
  className?: string
}

/** The mark and the name together, as a link. */
export default function Logo({ to = '/', wordFrom = 'always', size = 'md', className = '' }: LogoProps) {
  const word = size === 'lg' ? 'text-xl' : 'text-base sm:text-lg'
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${className}`}
      aria-label="ShootSync home"
    >
      <LogoMark size={size === 'lg' ? 40 : 32} />
      <span className={`text-white font-semibold ${word} ${wordFrom === 'sm' ? 'hidden sm:inline' : ''}`}>ShootSync</span>
    </Link>
  )
}
