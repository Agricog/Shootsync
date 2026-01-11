/**
 * Footer Component - ShootSync
 * Site footer with links
 */

import { Link } from 'react-router-dom'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-slate-900 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SS</span>
              </div>
              <span className="text-white font-semibold text-lg">ShootSync</span>
            </div>
            <p className="text-slate-400 text-sm max-w-md">
              Professional shooting syndicate management for UK syndicates. 
              Manage members, shoots, pegs, bags, and payments all in one place.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <FooterLink to="/features">Features</FooterLink>
              <FooterLink to="/pricing">Pricing</FooterLink>
              <FooterLink to="/about">About</FooterLink>
              <FooterLink to="/contact">Contact</FooterLink>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <FooterLink to="/privacy">Privacy Policy</FooterLink>
              <FooterLink to="/terms">Terms of Service</FooterLink>
              <FooterLink to="/cookies">Cookie Policy</FooterLink>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © {currentYear} ShootSync. All rights reserved.
          </p>
          <p className="text-slate-500 text-sm">
            hello@shootsync.co.uk
          </p>
        </div>
      </div>
    </footer>
  )
}

interface FooterLinkProps {
  to: string
  children: React.ReactNode
}

function FooterLink({ to, children }: FooterLinkProps) {
  return (
    <li>
      <Link
        to={to}
        className="text-slate-400 hover:text-white text-sm transition-colors"
      >
        {children}
      </Link>
    </li>
  )
}
