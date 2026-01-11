/**
 * My Bookings Page - ShootSync
 * Booking management for beaters
 */

import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent } from '../../components/common/Card'
import Button from '../../components/common/Button'
import { formatCurrency } from '../../config/stripe'

const BOOKINGS = [
  { id: '1', date: '2026-01-18', location: 'Beatrice Farm', meetTime: '08:30', rate: 40, status: 'confirmed' as const },
  { id: '2', date: '2026-01-25', location: 'Oakwood Estate', meetTime: '09:00', rate: 40, status: 'invited' as const },
  { id: '3', date: '2026-02-01', location: 'Manor Fields', meetTime: '08:30', rate: 40, status: 'invited' as const },
  { id: '4', date: '2026-01-11', location: 'Manor Fields', meetTime: '08:30', rate: 40, status: 'completed' as const },
  { id: '5', date: '2026-01-04', location: 'Beatrice Farm', meetTime: '08:30', rate: 40, status: 'completed' as const },
]

type BookingStatus = 'invited' | 'confirmed' | 'declined' | 'completed'

export default function MyBookings() {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all')

  const filteredBookings = BOOKINGS.filter(booking => {
    const bookingDate = new Date(booking.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (filter === 'upcoming') return bookingDate >= today
    if (filter === 'past') return bookingDate < today
    return true
  })

  return (
    <>
      <Helmet>
        <title>My Bookings - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="My Bookings"
        subtitle="Manage your shoot day bookings"
      >
        <div className="flex gap-2 mb-6">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </FilterButton>
          <FilterButton active={filter === 'upcoming'} onClick={() => setFilter('upcoming')}>
            Upcoming
          </FilterButton>
          <FilterButton active={filter === 'past'} onClick={() => setFilter('past')}>
            Past
          </FilterButton>
        </div>

        <Card>
          <CardHeader title="Bookings" />
          <CardContent>
            <div className="space-y-4">
              {filteredBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}

              {filteredBookings.length === 0 && (
                <p className="text-slate-400 text-center py-8">No bookings found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    </>
  )
}

interface BookingCardProps {
  booking: {
    id: string
    date: string
    location: string
    meetTime: string
    rate: number
    status: BookingStatus
  }
}

function BookingCard({ booking }: BookingCardProps) {
  const bookingDate = new Date(booking.date)
  const isToday = bookingDate.toDateString() === new Date().toDateString()

  return (
    <div className={`
      flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border
      ${isToday ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700 bg-slate-800/50'}
    `}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-slate-700 rounded-lg flex flex-col items-center justify-center">
          <span className="text-xs text-slate-400">
            {bookingDate.toLocaleDateString('en-GB', { weekday: 'short' })}
          </span>
          <span className="text-lg font-bold text-white">
            {bookingDate.getDate()}
          </span>
        </div>

        <div>
          <p className="text-white font-medium">{booking.location}</p>
          <p className="text-slate-400 text-sm">
            {bookingDate.toLocaleDateString('en-GB', { month: 'long' })} • Meet {booking.meetTime}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Rate: {formatCurrency(booking.rate * 100)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <StatusBadge status={booking.status} />

        {booking.status === 'invited' && (
          <div className="flex gap-2">
            <Button size="sm">Confirm</Button>
            <Button size="sm" variant="ghost">Decline</Button>
          </div>
        )}

        {isToday && booking.status === 'confirmed' && (
          <Button size="sm">Check In</Button>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    invited: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    confirmed: 'bg-green-500/10 text-green-400 border-green-500/20',
    declined: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    completed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
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
