/**
 * Settings Page - ShootSync
 * Syndicate settings for captains
 */

import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent, CardFooter } from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import { useSyndicate } from '../../hooks/useSyndicate'

export default function Settings() {
  const { syndicate } = useSyndicate()
  const [isSaving, setIsSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'syndicate' | 'season' | 'preferences'>('syndicate')

  return (
    <>
      <Helmet>
        <title>Settings - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout title="Settings" subtitle="Manage your syndicate settings">
        <div className="flex flex-col lg:flex-row gap-6">
          <nav className="lg:w-48 flex-shrink-0">
            <ul className="space-y-1">
              <SettingsNavItem
                active={activeSection === 'syndicate'}
                onClick={() => setActiveSection('syndicate')}
              >
                Syndicate Details
              </SettingsNavItem>
              <SettingsNavItem
                active={activeSection === 'season'}
                onClick={() => setActiveSection('season')}
              >
                Season Settings
              </SettingsNavItem>
              <SettingsNavItem
                active={activeSection === 'preferences'}
                onClick={() => setActiveSection('preferences')}
              >
                Preferences
              </SettingsNavItem>
            </ul>
          </nav>

          <div className="flex-1">
            {activeSection === 'syndicate' && (
              <SyndicateDetailsSection
                syndicate={syndicate}
                isSaving={isSaving}
                onSave={() => setIsSaving(true)}
              />
            )}
            {activeSection === 'season' && (
              <SeasonSettingsSection
                syndicate={syndicate}
                isSaving={isSaving}
                onSave={() => setIsSaving(true)}
              />
            )}
            {activeSection === 'preferences' && (
              <PreferencesSection
                isSaving={isSaving}
                onSave={() => setIsSaving(true)}
              />
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}

interface SettingsNavItemProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function SettingsNavItem({ active, onClick, children }: SettingsNavItemProps) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`
          w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors
          ${active 
            ? 'bg-slate-700 text-white' 
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }
        `}
      >
        {children}
      </button>
    </li>
  )
}

interface SectionProps {
  syndicate: ReturnType<typeof useSyndicate>['syndicate']
  isSaving: boolean
  onSave: () => void
}

function SyndicateDetailsSection({ isSaving, onSave }: SectionProps) {
  const [name, setName] = useState('Beatrice Pheasant Syndicate 2025-26')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    onSave()
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return (
    <Card>
      <CardHeader
        title="Syndicate Details"
        subtitle="Basic information about your syndicate"
      />
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="space-y-4 max-w-md">
            <Input
              label="Syndicate Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" isLoading={isSaving}>Save Changes</Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function SeasonSettingsSection({ isSaving, onSave }: SectionProps) {
  const [seasonStart, setSeasonStart] = useState('2025-10-01')
  const [seasonEnd, setSeasonEnd] = useState('2026-02-01')
  const [subscriptionAmount, setSubscriptionAmount] = useState('800')
  const [subscriptionType, setSubscriptionType] = useState('annual')
  const [defaultBeaterRate, setDefaultBeaterRate] = useState('40')
  const [pegRotation, setPegRotation] = useState('fair_rotation')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    onSave()
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return (
    <Card>
      <CardHeader
        title="Season Settings"
        subtitle="Configure your shooting season"
      />
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="space-y-4 max-w-md">
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="date"
                label="Season Start"
                value={seasonStart}
                onChange={(e) => setSeasonStart(e.target.value)}
                required
              />
              <Input
                type="date"
                label="Season End"
                value={seasonEnd}
                onChange={(e) => setSeasonEnd(e.target.value)}
                required
              />
            </div>

            <Input
              type="number"
              label="Annual Subscription (£)"
              value={subscriptionAmount}
              onChange={(e) => setSubscriptionAmount(e.target.value)}
              required
            />

            <Select
              label="Subscription Type"
              value={subscriptionType}
              onChange={(e) => setSubscriptionType(e.target.value)}
              options={[
                { value: 'annual', label: 'Annual (single payment)' },
                { value: 'per_shoot', label: 'Per shoot day' },
                { value: 'hybrid', label: 'Hybrid (deposit + per shoot)' },
              ]}
            />

            <Input
              type="number"
              label="Default Beater Day Rate (£)"
              value={defaultBeaterRate}
              onChange={(e) => setDefaultBeaterRate(e.target.value)}
              required
            />

            <Select
              label="Peg Rotation Method"
              value={pegRotation}
              onChange={(e) => setPegRotation(e.target.value)}
              options={[
                { value: 'fair_rotation', label: 'Fair rotation (recommended)' },
                { value: 'random', label: 'Random each shoot' },
                { value: 'manual', label: 'Manual allocation' },
              ]}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" isLoading={isSaving}>Save Changes</Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function PreferencesSection({ isSaving, onSave }: Omit<SectionProps, 'syndicate'>) {
  const [emailReminders, setEmailReminders] = useState(true)
  const [reminderDays, setReminderDays] = useState('3')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    onSave()
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return (
    <Card>
      <CardHeader
        title="Preferences"
        subtitle="Notification and reminder settings"
      />
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="space-y-4 max-w-md">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={emailReminders}
                onChange={(e) => setEmailReminders(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-600 focus:ring-green-500"
              />
              <span className="text-white">Send email reminders before shoots</span>
            </label>

            {emailReminders && (
              <Input
                type="number"
                label="Days before shoot to send reminder"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                min="1"
                max="14"
              />
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" isLoading={isSaving}>Save Changes</Button>
        </CardFooter>
      </form>
    </Card>
  )
}
