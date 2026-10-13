import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { useApi } from '../../hooks/useApi'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { formatLongDate } from '../../utils/dateHelpers'
import { formatCurrency } from '../../config/stripe'
import { generateShootBriefingPDF } from '../../utils/pdfGenerator'
import ShootBeaters, { type Booking, type PaymentLine } from '../../components/shoots/ShootBeaters'
import ShootDayEditor from '../../components/shoots/ShootDayEditor'

interface Member {
  id: string
  name: string
  email: string
  clerkUserId?: string
}

interface ShootDay {
  id: string
  syndicateId: string
  date: string
  locationName: string
  locationAddress?: string
  locationPostcode?: string
  locationWhat3Words?: string
  meetTime: string
  status: string
  drivesPlanned: number
  expectedBag?: number
  captainNotes?: string
  attendances: Array<{
    id: string
    pegNumber?: number
    member: Member
  }>
  guestGuns: Array<{
    id: string
    name: string
    email: string
    dayFee: number
    rsvpStatus: string
    paymentStatus: string
    waiverAccepted: boolean
    inviteToken?: string
    invitedByMember?: Member
  }>
  beaterBookings: Booking[]
  beaterPayments: PaymentLine[]
  bagRecords: Array<{
    id: string
    driveNumber: number
    pheasant: number
    partridge: number
    duck: number
    woodcock: number
    other: number
  }>
  bagTotals?: {
    pheasant: number
    partridge: number
    duck: number
    woodcock: number
    other: number
  }
}

export default function ShootDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const shootApi = useApi<ShootDay>('shoots')
  const memberApi = useApi<Member>('members')

  const [shoot, setShoot] = useState<ShootDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentMember, setCurrentMember] = useState<Member | null>(null)

  // Guest invite state
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteData, setInviteData] = useState({
    name: '',
    email: '',
    phone: '',
    dayFee: 5000, // £50.00 default
  })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const navigate = useNavigate()
  const [editingDay, setEditingDay] = useState(false)

  // Completing the day
  const [confirmingComplete, setConfirmingComplete] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      loadShoot()
    }
  }, [id])

  const refreshShoot = async () => {
    const data = await shootApi.fetchOne(id!)
    if (data) setShoot(data)
  }

  const completeShoot = async () => {
    if (!shoot) return
    setCompleting(true)
    setCompleteError(null)
    try {
      const response = await fetch(`/api/shoots/${encodeURIComponent(shoot.id)}/complete`, { method: 'POST' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || `Something went wrong (${response.status})`)
      }
      setConfirmingComplete(false)
      await refreshShoot()
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Could not complete the day.')
    }
    setCompleting(false)
  }

  const loadShoot = async () => {
    setLoading(true)
    const data = await shootApi.fetchOne(id!)
    setShoot(data)

    // Get current member for inviting guests
    if (data && user?.id) {
      const members = await memberApi.fetchAll({ syndicateId: data.syndicateId })
      // Try to find by clerkUserId first, then fall back to any active member
      let member = members.find((m: any) => m.clerkUserId === user.id)
      if (!member) {
        // Fall back to first active member (captain is viewing this page)
        member = members.find((m: any) => m.status === 'ACTIVE')
      }
      if (!member && members.length > 0) {
        // Last resort: use first member
        member = members[0]
      }
      if (member) {
        setCurrentMember(member)
      }
    }

    setLoading(false)
  }

  const handleInviteGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shoot || !currentMember) return

    setInviting(true)
    setInviteError(null)

    try {
      const response = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shootId: shoot.id,
          invitedByMemberId: currentMember.id,
          name: inviteData.name.trim(),
          email: inviteData.email.trim(),
          phone: inviteData.phone.trim() || undefined,
          dayFee: inviteData.dayFee,
        }),
      })

      if (response.ok) {
        setInviteData({ name: '', email: '', phone: '', dayFee: 5000 })
        setShowInviteForm(false)
        loadShoot() // Reload to show new guest
      } else {
        const errorData = await response.json()
        setInviteError(errorData.error || 'Failed to invite guest')
      }
    } catch (err) {
      console.error('Error inviting guest:', err)
      setInviteError('Failed to invite guest. Please try again.')
    }

    setInviting(false)
  }

  const handleRemoveGuest = async (guestId: string) => {
    if (!confirm('Are you sure you want to remove this guest?')) return

    try {
      const response = await fetch(`/api/guests/${guestId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadShoot()
      }
    } catch (err) {
      console.error('Error removing guest:', err)
    }
  }

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/guest/accept/${token}`
    navigator.clipboard.writeText(link)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const getRsvpStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-900 text-green-200'
      case 'DECLINED': return 'bg-red-900 text-red-200'
      default: return 'bg-yellow-900 text-yellow-200'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-green-900 text-green-200'
      case 'REFUNDED': return 'bg-slate-700 text-slate-200'
      default: return 'bg-amber-900 text-amber-200'
    }
  }

  const handleGenerateBriefing = () => {
    if (!shoot) return

    generateShootBriefingPDF({
      syndicateName: (shoot as any).syndicate?.name || 'Shooting Syndicate',
      shootDate: formatLongDate(shoot.date),
      locationName: shoot.locationName,
      locationAddress: shoot.locationAddress,
      locationPostcode: shoot.locationPostcode,
      locationWhat3Words: shoot.locationWhat3Words,
      meetTime: shoot.meetTime,
      drivesPlanned: shoot.drivesPlanned,
      expectedBag: shoot.expectedBag,
      captainNotes: shoot.captainNotes,
      guns: [
        ...(shoot.attendances?.map(att => ({
          name: att.member?.name || 'Unknown',
          pegNumber: att.pegNumber,
          isGuest: false,
        })) || []),
        ...(shoot.guestGuns?.filter(g => g.rsvpStatus === 'CONFIRMED').map(guest => ({
          name: guest.name,
          pegNumber: undefined,
          isGuest: true,
        })) || []),
      ],
      beaters: shoot.beaterBookings?.filter(b => b.status === 'CONFIRMED').map(b => ({
        name: b.beater?.name || 'Unknown',
      })) || [],
    })
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  if (!shoot) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-white mb-4">Shoot Not Found</h1>
          <Link to="/shoots">
            <Button>Back to Shoots</Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const totalBag = shoot.bagTotals 
    ? shoot.bagTotals.pheasant + shoot.bagTotals.partridge + shoot.bagTotals.duck + shoot.bagTotals.woodcock + shoot.bagTotals.other
    : 0

  return (
    <DashboardLayout>
      <Helmet>
        <title>{shoot.locationName} | ShootSync</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{shoot.locationName}</h1>
            <p className="text-amber-500">{formatLongDate(shoot.date)} • Meet {shoot.meetTime}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleGenerateBriefing}>
              Generate Briefing
            </Button>
            <Link to={`/pegs?shootId=${shoot.id}`}>
              <Button variant="secondary">Allocate Pegs</Button>
            </Link>
            {!editingDay && (
              <Button variant="secondary" onClick={() => setEditingDay(true)}>
                Edit day
              </Button>
            )}
            <Link to="/shoots">
              <Button variant="secondary">Back</Button>
            </Link>
          </div>
        </div>

        {editingDay && (
          <ShootDayEditor
            shoot={shoot}
            paidGuests={shoot.guestGuns.filter((g) => g.paymentStatus === 'PAID').length}
            onSaved={refreshShoot}
            onClose={() => setEditingDay(false)}
            onDeleted={() => navigate('/shoots')}
          />
        )}

        {/* Status, and completing the day */}
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            shoot.status === 'COMPLETED' ? 'bg-green-900 text-green-200' :
            shoot.status === 'CANCELLED' ? 'bg-red-900 text-red-200' :
            'bg-blue-900 text-blue-200'
          }`}>
            {shoot.status === 'COMPLETED' ? 'Completed' : shoot.status === 'CANCELLED' ? 'Cancelled' : 'Scheduled'}
          </span>
          {shoot.status === 'SCHEDULED' && !confirmingComplete && new Date(shoot.date).getTime() <= Date.now() && (
            <Button size="sm" variant="secondary" onClick={() => setConfirmingComplete(true)}>
              Mark day complete
            </Button>
          )}
        </div>
        {confirmingComplete && (() => {
          const confirmed = shoot.beaterBookings.filter((b) => b.status === 'CONFIRMED')
          const asked = shoot.beaterBookings.filter((b) => b.status === 'INVITED').length
          const owed = confirmed.reduce((sum, b) => sum + b.dayRate * 100, 0)
          return (
            <Card>
              <h2 className="text-lg font-semibold text-white">Mark this day complete?</h2>
              <p className="mt-2 text-slate-300">
                {confirmed.length === 0
                  ? 'No beaters are marked Confirmed, so nobody will be owed beating pay for this day.'
                  : `${confirmed.length} confirmed ${confirmed.length === 1 ? 'beater' : 'beaters'} will be owed ${formatCurrency(owed)} in total, shown under Finances.`}
                {asked > 0 && ` ${asked} still marked Asked ${asked === 1 ? 'is' : 'are'} not included: mark them Confirmed first if they came.`}
              </p>
              <p className="mt-2 text-sm text-slate-400">You can still change the beaters afterwards, and what’s owed will follow.</p>
              {completeError && <p role="alert" className="mt-3 text-red-300">{completeError}</p>}
              <div className="mt-4 flex gap-3">
                <Button onClick={completeShoot} isLoading={completing} disabled={completing}>
                  Mark complete
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingComplete(false)} disabled={completing}>
                  Not yet
                </Button>
              </div>
            </Card>
          )
        })()}

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Location Card */}
          <Card>
            <h2 className="text-lg font-semibold text-green-500 mb-4">Location</h2>
            <div className="space-y-2">
              <p className="text-white"><span className="text-amber-500">Name:</span> {shoot.locationName}</p>
              {shoot.locationAddress && <p className="text-white"><span className="text-amber-500">Address:</span> {shoot.locationAddress}</p>}
              {shoot.locationPostcode && <p className="text-white"><span className="text-amber-500">Postcode:</span> {shoot.locationPostcode}</p>}
            </div>
          </Card>

          {/* Shoot Info Card */}
          <Card>
            <h2 className="text-lg font-semibold text-green-500 mb-4">Shoot Details</h2>
            <div className="space-y-2">
              <p className="text-white"><span className="text-amber-500">Drives Planned:</span> {shoot.drivesPlanned}</p>
              {shoot.expectedBag && <p className="text-white"><span className="text-amber-500">Expected Bag:</span> {shoot.expectedBag}</p>}
            </div>
          </Card>
        </div>

        {/* Captain's Notes */}
        {shoot.captainNotes && (
          <Card>
            <h2 className="text-lg font-semibold text-green-500 mb-4">Captain's Notes</h2>
            <p className="text-white whitespace-pre-wrap">{shoot.captainNotes}</p>
          </Card>
        )}

        {/* Attendees (Members) */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-green-500">
              Guns ({shoot.attendances?.length || 0})
            </h2>
          </div>
          {shoot.attendances?.length > 0 ? (
            <div className="space-y-2">
              {shoot.attendances.map((att) => (
                <div key={att.id} className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                  <span className="text-white font-medium">{att.member?.name}</span>
                  <span className="text-amber-500 font-medium">
                    {att.pegNumber ? `Peg ${att.pegNumber}` : 'No peg assigned'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">No guns assigned yet. Use the peg allocation page to assign guns.</p>
          )}
        </Card>

        {/* Guest Guns */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-green-500">
              Guests ({shoot.guestGuns?.length || 0})
            </h2>
            <Button onClick={() => setShowInviteForm(true)} size="sm">
              Invite Guest
            </Button>
          </div>

          {/* Invite Form */}
          {showInviteForm && (
            <div className="mb-6 p-4 bg-slate-800 rounded-lg">
              <h3 className="text-white font-medium mb-4">Invite New Guest</h3>
              <form onSubmit={handleInviteGuest} className="space-y-4">
                <Input
                  label="Guest Name"
                  value={inviteData.name}
                  onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                  placeholder="John Smith"
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                />
                <Input
                  label="Phone (optional)"
                  type="tel"
                  value={inviteData.phone}
                  onChange={(e) => setInviteData({ ...inviteData, phone: e.target.value })}
                  placeholder="+44 7xxx xxxxxx"
                />
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Day Fee (£)
                  </label>
                  <input
                    type="number"
                    value={inviteData.dayFee / 100}
                    onChange={(e) => setInviteData({ ...inviteData, dayFee: Math.round((parseFloat(e.target.value) || 0) * 100) })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    min="0"
                    step="1"
                  />
                  <p className="text-slate-500 text-sm mt-1">
                    Enter 0 for complimentary
                  </p>
                </div>

                {inviteError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-sm">{inviteError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button type="submit" disabled={inviting}>
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowInviteForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Guest List */}
          {shoot.guestGuns?.length > 0 ? (
            <div className="space-y-3">
              {shoot.guestGuns.map((guest) => (
                <div key={guest.id} className="p-4 bg-slate-800 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-white font-medium">{guest.name}</p>
                      <p className="text-slate-400 text-sm">{guest.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRsvpStatusColor(guest.rsvpStatus)}`}>
                        {guest.rsvpStatus}
                      </span>
                      {guest.dayFee > 0 && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPaymentStatusColor(guest.paymentStatus)}`}>
                          {guest.paymentStatus === 'PAID' ? 'Paid' : formatCurrency(guest.dayFee)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    {guest.inviteToken && guest.rsvpStatus === 'PENDING' && (
                      <button
                        onClick={() => copyInviteLink(guest.inviteToken!)}
                        className="text-sm text-green-400 hover:text-green-300"
                      >
                        {copiedToken === guest.inviteToken ? '✓ Copied!' : 'Copy Invite Link'}
                      </button>
                    )}
                    {guest.waiverAccepted && (
                      <span className="text-sm text-slate-500">Waiver signed ✓</span>
                    )}
                    {guest.paymentStatus === 'PAID' && guest.rsvpStatus === 'DECLINED' ? (
                      <span className="text-sm text-amber-300 ml-auto">Paid after being withdrawn: refund them in Stripe</span>
                    ) : guest.paymentStatus !== 'PENDING' ? (
                      <span className="text-sm text-slate-500 ml-auto">Paid, so kept on record</span>
                    ) : guest.rsvpStatus === 'DECLINED' && guest.waiverAccepted ? (
                      <span className="text-sm text-slate-500 ml-auto">Withdrawn</span>
                    ) : (
                      <button
                        onClick={() => handleRemoveGuest(guest.id)}
                        className="text-sm text-red-400 hover:text-red-300 ml-auto"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">No guests invited yet.</p>
          )}
        </Card>

        {/* Beaters */}
        <ShootBeaters
          shootId={shoot.id}
          syndicateId={shoot.syndicateId}
          shootStatus={shoot.status}
          bookings={shoot.beaterBookings ?? []}
          payments={shoot.beaterPayments ?? []}
          onChanged={refreshShoot}
        />

        {/* Bag Totals */}
        <Card>
          <h2 className="text-lg font-semibold text-green-500 mb-4">
            Bag Total ({totalBag})
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4 text-center">
            <div className="p-3 bg-slate-800 rounded-lg">
              <p className="text-2xl font-bold text-white">{shoot.bagTotals?.pheasant || 0}</p>
              <p className="text-amber-500 text-sm">Pheasant</p>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg">
              <p className="text-2xl font-bold text-white">{shoot.bagTotals?.partridge || 0}</p>
              <p className="text-amber-500 text-sm">Partridge</p>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg">
              <p className="text-2xl font-bold text-white">{shoot.bagTotals?.duck || 0}</p>
              <p className="text-amber-500 text-sm">Duck</p>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg">
              <p className="text-2xl font-bold text-white">{shoot.bagTotals?.woodcock || 0}</p>
              <p className="text-amber-500 text-sm">Woodcock</p>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg">
              <p className="text-2xl font-bold text-white">{shoot.bagTotals?.other || 0}</p>
              <p className="text-amber-500 text-sm">Other</p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
