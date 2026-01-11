/**
 * Shoots Page - ShootSync
 * Shoot day management for captains
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent } from '../../components/common/Card'
import Button from '../../components/common/Button'
import type { ShootDay } from '../../types/shoot'

const MOCK_SHOOTS: ShootDay[] = [
  { id: '1', syndicateId: '1', date: '2026-01-18', locationName: 'Beatrice Farm', locationPostcode: 'OX15 4AB', meetTime: '08:30', drivesPlanned: 4, expectedBag: 80, status: 'scheduled', briefingGenerated: false, createdAt: '2025-12-01' },
  { id: '2', syndicateId: '1', date: '2026-01-25', locationName: 'Oakwood Estate', locationPostcode: 'GL7 5NP', meetTime: '09:00', drivesPlanned: 5, expectedBag: 100, status: 'scheduled', briefingGenerated: false, createdAt: '2025-12-01' },
  { id: '3', syndicateId: '1', date: '2026-01-11', locationName: 'Manor Fields', locationPostcode: 'SN6 7QA', meetTime: '08:30', drivesPlanned: 4, expectedBag: 75, status: 'completed', briefingGenerated: true, createdAt: '2025-11-15' },
]

export default function Shoots() {
  const [shoots] = useState<ShootDay[]>(MOCK_SHOOTS)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all')

  const filteredShoots = shoots.filter(shoot => {
    if (filter === 'upcoming') return shoot.status === 'scheduled'
    if (filter === 'completed') return shoot.status === 'completed'
    return true
  })

  const upcomingCount = shoots.filter(s => s.status === 'scheduled').length
  const completedCount = shoots.filter(s => s.status === 'completed').length

  return (
    <>
      <Helmet>
        <title>Shoots - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="Shoots"
        subtitle={`${upcomingCount} upcoming, ${completedCount} completed`}
        action={
          <Link to="/shoots/new">
            <Button>Create Shoot</Button>
          </Link>
        }
      >
        <div className="flex gap-2 mb-6">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            All ({shoots.length})
          </FilterButton>
          <FilterButton active={filter === 'upcoming'} onClick={() => setFilter('upcoming')}>
            Upcoming ({upcomingCount})
          </FilterButton>
          <FilterButton active={filter === 'completed'} onClick={() => setFilter('completed')}>
            Completed ({completedCount})
          </FilterButton>
        </div>

        <div className="space-y-4">
          {filteredShoots.map((shoot) => (
            <ShootCard key={shoot.id} shoot={shoot} />
          ))}

          {filteredShoots.length === 0 && (
            <Card>
              <CardContent>
                <p className="text-slate-400 text-center py-8">No shoots found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}

interface ShootCardProps {
  shoot: ShootDay
}

function ShootCard({ shoot }: ShootCardProps) {
  const shootDate = new Date(shoot.date)
  const isUpcoming = shoot.status === 'scheduled'
  const isPast = shootDate < new Date()

  return (
    <Card hover onClick={() => console.log('View shoot', shoot.id)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-14 h-14 bg-slate-700 rounded-lg flex flex-col items-center justify-center">
            <span className="text-xs text-slate-400 uppercase">
              {shootDate.toLocaleDateString('en-GB', { weekday: 'short' })}
            </span>
            <span className="text-lg font-bold text-white">
              {shootDate.getDate()}
            </span>
          </div>
          
          <div>
            <h3 className="text-white font-semibold">{shoot.locationName}</h3>
            <p className="text-slate-400 text-sm">
              {shootDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} • Meet {shoot.meetTime}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {shoot.drivesPlanned} drives • Expected bag: {shoot.expectedBag}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <StatusBadge status={shoot.status} />
          
          <div className="flex gap-2">
            {isUpcoming && (
              <>
                <Button variant="secondary" size="sm">Allocate Pegs</Button>
                <Button variant="ghost" size="sm">Edit</Button>
              </>
            )}
            {!isUpcoming && isPast && (
              <Button variant="secondary" size="sm">View Bags</Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  }

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

interface FilterButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function FilterButton({ active, onClick, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
        ${active 
          ? 'bg-green-600 text-white' 
          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
        }
      `}
    >
      {children}
    </button>
  )
}
