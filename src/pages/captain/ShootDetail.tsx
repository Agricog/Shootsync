import { useCallback, useEffect, useState } from 'react'
import { londonDate } from '../../utils/beaterPayCalculator'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useCanWrite, useCaptainSyndicate, useSyndicates } from '../../context/SyndicateContext'
import { apiPath, apiRequest } from '../../lib/api'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button, { ButtonLink } from '../../components/common/Button'
import Input from '../../components/common/Input'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { formatShootDate, formatTime, what3wordsLink } from '../../utils/dateHelpers'
import { formatCurrency } from '../../config/stripe'
import { generateShootBriefingPDF } from '../../utils/pdfGenerator'
import ShootBeaters, { type Booking, type PaymentLine } from '../../components/shoots/ShootBeaters'
import ShootDayEditor from '../../components/shoots/ShootDayEditor'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import GuestEditor, { type EditableGuest } from '../../components/guests/GuestEditor'
import { useUnsavedWork } from '../../lib/unsavedWork'

interface Member {
  id: string
  name: string
  email: string
  role?: string
  status?: string
}

const RSVP_LABEL: Record<string, string> = { PENDING: 'Not replied', CONFIRMED: 'Coming', DECLINED: 'Not coming' }

interface ShootDay {
  id: string
  syndicateId: string
  syndicate: { id: string; name: string }
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
    emergencyContactName?: string | null
    emergencyContactPhone?: string | null
    /** Set when the fee was paid by card through Stripe; null when the captain marked it paid. */
    stripePaymentId?: string | null
    pegNumber?: number | null
    phone?: string | null
    notes?: string | null
    invitedByMember?: { id: string; name: string } | null
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
  const syndicate = useCaptainSyndicate()
  const { select } = useSyndicates()
  const canWrite = useCanWrite()

  const [shoot, setShoot] = useState<ShootDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null)
  // The syndicate's active guns: a guest is always some gun's guest.
  const [guns, setGuns] = useState<Member[]>([])

  // Adding a guest
  const [showInviteForm, setShowInviteForm] = useState(false)
  const blankGuest = useCallback(() => ({
    name: '',
    email: '',
    phone: '',
    dayFee: 5000, // £50.00 default
    invitedByMemberId: syndicate.memberId ?? '',
  }), [syndicate.memberId])
  const [inviteData, setInviteData] = useState(blankGuest)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [guestNotice, setGuestNotice] = useState<string | null>(null)
  const [guestError, setGuestError] = useState<string | null>(null)
  // Invite links are shown once, when made: the server keeps only a hash of each one. A link made
  // on this page stays here until the page is left; after that the captain makes a new one.
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({})
  const [copiedGuest, setCopiedGuest] = useState<string | null>(null)
  const [confirmNewLink, setConfirmNewLink] = useState<string | null>(null)
  const [makingLink, setMakingLink] = useState<string | null>(null)

  const navigate = useNavigate()
  const [editingDay, setEditingDay] = useState(false)
  const [editingGuest, setEditingGuest] = useState<string | null>(null)
  // Removing or erasing a guest asks first, in a dialog of the app's own.
  const [confirming, setConfirming] = useState<{ kind: 'remove' | 'erase'; guest: { id: string; name: string } } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  // Anything typed into the add-a-guest form that hasn't been sent.
  useUnsavedWork(showInviteForm && (inviteData.name.trim() !== '' || inviteData.email.trim() !== '' || inviteData.phone.trim() !== ''), 'add-guest')

  // Completing the day
  const [confirmingComplete, setConfirmingComplete] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  const refreshShoot = useCallback(async () => {
    if (!id) return
    const result = await apiRequest<ShootDay>(`/api/shoots/${encodeURIComponent(id)}`)
    if (result.ok) setShoot(result.data)
  }, [id])

  useEffect(() => {
    if (!id) return
    let stale = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      const sheet = await apiRequest<ShootDay>(`/api/shoots/${encodeURIComponent(id)}`)
      if (stale) return
      if (!sheet.ok) {
        setLoadError({ status: sheet.status, message: sheet.error })
        setLoading(false)
        return
      }
      // Opened from a link or a bookmark while another syndicate was on show: this day
      // belongs to one the captain also runs, so show that one, everywhere.
      if (sheet.data.syndicateId !== syndicate.id) select(sheet.data.syndicateId)
      const members = await apiRequest<Member[]>(apiPath('/api/members', { syndicateId: sheet.data.syndicateId, status: 'ACTIVE' }))
      if (stale) return
      setShoot(sheet.data)
      // A guest is a gun's guest: guns only, never a member kept for another reason.
      if (members.ok) setGuns(members.data.filter((m) => m.role !== 'BEATER'))
      setLoading(false)
    })()
    return () => {
      stale = true
    }
  }, [id, syndicate.id, select])

  const completeShoot = async () => {
    if (!shoot) return
    setCompleting(true)
    setCompleteError(null)
    const result = await apiRequest<unknown>(`/api/shoots/${encodeURIComponent(shoot.id)}/complete`, { method: 'POST' })
    if (result.ok) {
      setConfirmingComplete(false)
      await refreshShoot()
    } else {
      setCompleteError(result.error)
    }
    setCompleting(false)
  }

  const handleInviteGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shoot) return
    if (!inviteData.invitedByMemberId) {
      setInviteError('Choose whose guest they are.')
      return
    }
    if (inviteData.dayFee < 0 || inviteData.dayFee > 100_000) {
      setInviteError('The day fee must be between £0 and £1,000.')
      return
    }

    setInviting(true)
    setInviteError(null)
    const result = await apiRequest<{ id: string; name: string; inviteLink: string }>('/api/guests', {
      method: 'POST',
      body: {
        shootId: shoot.id,
        invitedByMemberId: inviteData.invitedByMemberId,
        name: inviteData.name.trim(),
        email: inviteData.email.trim(),
        phone: inviteData.phone.trim() || undefined,
        dayFee: inviteData.dayFee,
      },
    })
    setInviting(false)
    if (!result.ok) {
      setInviteError(`Not added: ${result.error}`)
      return
    }
    setInviteData(blankGuest())
    setShowInviteForm(false)
    setInviteLinks((links) => ({ ...links, [result.data.id]: `${window.location.origin}${result.data.inviteLink}` }))
    setGuestNotice(`${result.data.name} added. ShootSync doesn’t email guests: copy their invite link below and send it to them yourself.`)
    await refreshShoot()
  }

  // A new link for a guest: the only way to get one again, and the way to withdraw one that went astray.
  const makeNewLink = async (guest: { id: string; name: string }) => {
    setConfirmNewLink(null)
    setGuestError(null)
    setMakingLink(guest.id)
    const result = await apiRequest<{ inviteLink: string }>(`/api/guests/${encodeURIComponent(guest.id)}/invite-link`, { method: 'POST' })
    setMakingLink(null)
    if (!result.ok) {
      setGuestError(result.error)
      return
    }
    setInviteLinks((links) => ({ ...links, [guest.id]: `${window.location.origin}${result.data.inviteLink}` }))
    setGuestNotice(`A new invite link for ${guest.name} is below. Any link you sent them before no longer works.`)
  }

  const removeGuest = async (guestId: string) => {
    setGuestError(null)
    setGuestNotice(null)
    const result = await apiRequest<{ withdrawn?: boolean }>(`/api/guests/${encodeURIComponent(guestId)}`, { method: 'DELETE' })
    if (!result.ok) {
      setGuestError(result.error)
      return
    }
    if (result.data.withdrawn) setGuestNotice('They signed the acknowledgement, so they are shown as withdrawn rather than removed: the signed record stays.')
    await refreshShoot()
  }

  // A guest asked for their details to be erased (UK GDPR Article 17): only once the day is over.
  const eraseGuest = async (guestId: string) => {
    setGuestError(null)
    setGuestNotice(null)
    const result = await apiRequest<{ message: string }>(`/api/guests/${encodeURIComponent(guestId)}/erase`, { method: 'POST' })
    if (!result.ok) {
      setGuestError(result.error)
      return
    }
    setGuestNotice(result.data.message)
    await refreshShoot()
  }

  const confirmed = async () => {
    if (!confirming) return
    setConfirmBusy(true)
    if (confirming.kind === 'remove') await removeGuest(confirming.guest.id)
    else await eraseGuest(confirming.guest.id)
    setConfirmBusy(false)
    setConfirming(null)
  }

  // A guest's peg, set by the captain on this page (the draw places the guns; guests are placed by hand).
  const [pegEdits, setPegEdits] = useState<Record<string, string>>({})
  const [savingPeg, setSavingPeg] = useState<string | null>(null)
  const saveGuestPeg = async (guestId: string, value: string) => {
    const peg = value.trim() === '' ? null : Number(value)
    if (peg !== null && (!Number.isInteger(peg) || peg < 1 || peg > 40)) {
      setGuestError('A peg is a whole number from 1 to 40.')
      return
    }
    setGuestError(null)
    setSavingPeg(guestId)
    const result = await apiRequest<unknown>(`/api/guests/${encodeURIComponent(guestId)}`, { method: 'PATCH', body: { pegNumber: peg } })
    setSavingPeg(null)
    if (!result.ok) {
      setGuestError(result.error)
      return
    }
    setPegEdits((edits) => { const next = { ...edits }; delete next[guestId]; return next })
    await refreshShoot()
  }

  // Guests pay the syndicate directly; the captain records it.
  const [markingPayment, setMarkingPayment] = useState<string | null>(null)
  const setGuestPaid = async (guestId: string, paid: boolean) => {
    setGuestError(null)
    setGuestNotice(null)
    setMarkingPayment(guestId)
    const result = await apiRequest<unknown>(`/api/guests/${encodeURIComponent(guestId)}/payment`, { method: 'PATCH', body: { paid } })
    setMarkingPayment(null)
    if (!result.ok) {
      setGuestError(result.error)
      return
    }
    await refreshShoot()
  }

  const copyInviteLink = async (guestId: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedGuest(guestId)
      setTimeout(() => setCopiedGuest(null), 2000)
    } catch {
      // No clipboard (an old browser, or permission refused): the link is on the page to copy by hand.
      setGuestError('Couldn’t copy to the clipboard. Select the link below and copy it.')
    }
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

  // Guns on today's draw. Someone left out of a later draw keeps their attendance record
  // (and any check-in) but isn't on the day's sheet.
  const pegged = shoot?.attendances?.filter((att) => att.pegNumber != null) ?? []

  const handleGenerateBriefing = () => {
    if (!shoot) return

    generateShootBriefingPDF({
      syndicateName: shoot.syndicate.name,
      shootDate: formatShootDate(shoot.date),
      locationName: shoot.locationName,
      locationAddress: shoot.locationAddress,
      locationPostcode: shoot.locationPostcode,
      locationWhat3Words: shoot.locationWhat3Words,
      meetTime: shoot.meetTime,
      drivesPlanned: shoot.drivesPlanned,
      expectedBag: shoot.expectedBag,
      captainNotes: shoot.captainNotes,
      guns: [
        ...pegged.map(att => ({
          name: att.member?.name || 'Unknown',
          pegNumber: att.pegNumber,
          isGuest: false,
        })),
        ...(shoot.guestGuns?.filter(g => g.rsvpStatus === 'CONFIRMED').map(guest => ({
          name: guest.name,
          pegNumber: guest.pegNumber ?? undefined,
          isGuest: true,
        })) || []),
      ],
      beaters: shoot.beaterBookings?.filter(b => b.status === 'CONFIRMED').map(b => ({
        name: b.beater?.name || 'Unknown',
      })) || [],
      emergencyContacts: (shoot.guestGuns ?? [])
        .filter((g) => g.rsvpStatus === 'CONFIRMED' && g.emergencyContactName && g.emergencyContactPhone)
        .map((g) => ({ name: g.name, contactName: g.emergencyContactName as string, contactPhone: g.emergencyContactPhone as string })),
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
    const missing = loadError?.status === 404
    return (
      <DashboardLayout>
        <div role="alert" className="text-center py-12">
          <h1 className="text-2xl font-bold text-white mb-4">{missing ? 'Shoot day not found' : 'This shoot day didn’t load'}</h1>
          {!missing && loadError && <p className="text-slate-300 mb-6">{loadError.message}</p>}
          <ButtonLink to="/shoots">Back to shoot days</ButtonLink>
        </div>
      </DashboardLayout>
    )
  }

  // The day is over once it has been completed or cancelled, or its date has passed (UK time).
  const dayOver = shoot.status !== 'SCHEDULED' || shoot.date.slice(0, 10) < londonDate(new Date())

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
            <p className="text-amber-500">{formatShootDate(shoot.date)} · Meet {formatTime(shoot.meetTime)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleGenerateBriefing}>
              Briefing sheet (PDF)
            </Button>
            <ButtonLink to={`/pegs?shootId=${shoot.id}`} variant="secondary">Pegs</ButtonLink>
            {!editingDay && canWrite && (
              <Button variant="secondary" onClick={() => setEditingDay(true)}>
                Edit day
              </Button>
            )}
            <ButtonLink to="/shoots" variant="secondary">Back</ButtonLink>
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
          {canWrite && shoot.status === 'SCHEDULED' && !confirmingComplete && new Date(shoot.date).getTime() <= Date.now() && (
            <Button size="sm" variant="secondary" onClick={() => setConfirmingComplete(true)}>
              Mark day complete
            </Button>
          )}
        </div>
        {confirmingComplete && (() => {
          const confirmed = shoot.beaterBookings.filter((b) => b.status === 'CONFIRMED')
          const asked = shoot.beaterBookings.filter((b) => b.status === 'INVITED').length
          const owed = confirmed.reduce((sum, b) => sum + b.dayRatePence, 0)
          return (
            <Card>
              <h2 className="text-lg font-semibold text-white">Mark this day complete?</h2>
              <p className="mt-2 text-slate-300">
                {confirmed.length === 0
                  ? 'No beaters are marked Confirmed, so nobody will be owed beating pay for this day.'
                  : `${confirmed.length} confirmed ${confirmed.length === 1 ? 'beater' : 'beaters'} will be owed ${formatCurrency(owed)} in total, shown under Beaters’ pay.`}
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
              {shoot.locationWhat3Words && (
                <p className="text-white">
                  <span className="text-amber-500">what3words:</span>{' '}
                  <a href={what3wordsLink(shoot.locationWhat3Words)} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline">///{shoot.locationWhat3Words}</a>
                </p>
              )}
            </div>
          </Card>

          {/* Shoot Info Card */}
          <Card>
            <h2 className="text-lg font-semibold text-green-500 mb-4">Shoot details</h2>
            <div className="space-y-2">
              <p className="text-white"><span className="text-amber-500">Meet:</span> {formatTime(shoot.meetTime)}</p>
              <p className="text-white"><span className="text-amber-500">Drives planned:</span> {shoot.drivesPlanned}</p>
              {shoot.expectedBag != null && <p className="text-white"><span className="text-amber-500">Expected bag:</span> {shoot.expectedBag}</p>}
            </div>
          </Card>
        </div>

        {/* Captain's Notes */}
        {shoot.captainNotes && (
          <Card>
            <h2 className="text-lg font-semibold text-green-500 mb-4">Captain’s notes</h2>
            <p className="text-white whitespace-pre-wrap">{shoot.captainNotes}</p>
          </Card>
        )}

        {/* Attendees (Members) */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-green-500">
              Guns ({pegged.length})
            </h2>
          </div>
          {pegged.length > 0 ? (
            <div className="space-y-2">
              {pegged.map((att) => (
                <div key={att.id} className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                  <span className="text-white font-medium">{att.member?.name}</span>
                  <span className="text-amber-500 font-medium">
                    Peg {att.pegNumber}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">No pegs drawn for this day yet. Use Pegs to choose who is shooting and draw them.</p>
          )}
        </Card>

        {/* Guest Guns */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-green-500">
              Guests ({shoot.guestGuns?.length || 0})
            </h2>
            {!showInviteForm && canWrite && shoot.status === 'SCHEDULED' && (
              <Button onClick={() => { setShowInviteForm(true); setGuestNotice(null) }} size="sm">
                Add a guest
              </Button>
            )}
          </div>

          <div role="status" aria-live="polite">
            {guestNotice && <p className="mb-4 rounded-lg px-3 py-2 bg-green-900/40 text-green-200 border border-green-800 text-sm">{guestNotice}</p>}
          </div>
          {guestError && <p role="alert" className="mb-4 rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">{guestError}</p>}

          {/* Invite Form */}
          {showInviteForm && (
            <div className="mb-6 p-4 bg-slate-800 rounded-lg">
              <h3 className="text-white font-medium mb-1">Add a guest</h3>
              <p className="text-sm text-slate-300 mb-4">
                You’ll get an invite link to send them. On it they confirm and sign the guest acknowledgement. Any day fee is paid to you directly, and you mark it paid here.
              </p>
              <form onSubmit={handleInviteGuest} className="space-y-4">
                <div>
                  <label htmlFor="guest-invited-by" className="block text-sm font-medium text-slate-300 mb-1">Whose guest</label>
                  <select
                    id="guest-invited-by"
                    value={inviteData.invitedByMemberId}
                    onChange={(e) => setInviteData({ ...inviteData, invitedByMemberId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    required
                  >
                    <option value="">Choose a gun</option>
                    {guns.map((gun) => (
                      <option key={gun.id} value={gun.id}>{gun.id === syndicate.memberId ? `${gun.name} (you)` : gun.name}</option>
                    ))}
                  </select>
                  {guns.length === 0 && (
                    <p className="text-sm text-amber-300 mt-1">Add your guns under Members first: every guest is a gun’s guest.</p>
                  )}
                </div>
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
                  <label htmlFor="guest-day-fee" className="block text-sm font-medium text-slate-300 mb-1">
                    Day fee (£)
                  </label>
                  <input
                    id="guest-day-fee"
                    type="number"
                    aria-describedby="guest-day-fee-note"
                    value={inviteData.dayFee / 100}
                    onChange={(e) => setInviteData({ ...inviteData, dayFee: Math.round((parseFloat(e.target.value) || 0) * 100) })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    min="0"
                    max="1000"
                    step="1"
                  />
                  <p id="guest-day-fee-note" className="text-slate-400 text-sm mt-1">
                    Up to £1,000. 0 if they shoot free.
                  </p>
                </div>

                {inviteError && (
                  <p role="alert" className="rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">{inviteError}</p>
                )}

                <div className="flex gap-3">
                  <Button type="submit" isLoading={inviting} disabled={inviting || guns.length === 0}>
                    Add guest
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => { setShowInviteForm(false); setInviteError(null) }}>
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
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-white font-medium">{guest.name}</p>
                      <p className="text-slate-400 text-sm break-words">{guest.email.endsWith('@removed.invalid') ? 'Details erased' : guest.email}</p>
                      {guest.invitedByMember && <p className="text-slate-400 text-sm">{guest.invitedByMember.name}’s guest</p>}
                      {guest.emergencyContactName && (
                        <p className="text-slate-300 text-sm mt-1">
                          <span className="text-slate-400">Emergency contact:</span> {guest.emergencyContactName}
                          {guest.emergencyContactPhone && <>, <a href={`tel:${guest.emergencyContactPhone.replace(/\s+/g, '')}`} className="text-green-400 hover:text-green-300">{guest.emergencyContactPhone}</a></>}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRsvpStatusColor(guest.rsvpStatus)}`}>
                        {RSVP_LABEL[guest.rsvpStatus] ?? guest.rsvpStatus}
                      </span>
                      {guest.dayFee > 0 && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPaymentStatusColor(guest.paymentStatus)}`}>
                          {guest.paymentStatus === 'PAID' ? 'Paid' : formatCurrency(guest.dayFee)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* The link is shown once, when made. The guest's page shows the day's details, so it stays useful after they say yes. */}
                  {inviteLinks[guest.id] && guest.rsvpStatus !== 'DECLINED' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`invite-link-${guest.id}`}>Invite link for {guest.name}</label>
                      <input id={`invite-link-${guest.id}`} readOnly value={inviteLinks[guest.id]} onFocus={(e) => e.target.select()}
                        className="flex-1 min-w-0 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200 text-sm" />
                      <Button size="sm" variant="secondary" onClick={() => void copyInviteLink(guest.id, inviteLinks[guest.id])}>
                        {copiedGuest === guest.id ? 'Copied ✓' : 'Copy link'}
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                    {canWrite && !dayOver && guest.rsvpStatus !== 'DECLINED' && !guest.email.endsWith('@removed.invalid') && !inviteLinks[guest.id] && (
                      confirmNewLink === guest.id ? (
                        <span className="text-sm text-amber-200 flex flex-wrap items-center gap-2">
                          A new link stops any link you sent before from working.
                          <button type="button" onClick={() => void makeNewLink(guest)} className="underline text-white">Make a new link</button>
                          <button type="button" onClick={() => setConfirmNewLink(null)} className="underline">Keep the old one</button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmNewLink(guest.id)}
                          disabled={makingLink === guest.id}
                          className="text-sm text-green-400 hover:text-green-300 disabled:opacity-50"
                        >
                          {makingLink === guest.id ? 'Making a link…' : 'Invite link…'}
                        </button>
                      )
                    )}
                    {guest.waiverAccepted && (
                      <span className="text-sm text-slate-400">Acknowledgement signed ✓</span>
                    )}
                    {dayOver && !guest.email.endsWith('@removed.invalid') && (
                      <button type="button" onClick={() => setConfirming({ kind: 'erase', guest })} className="text-sm text-slate-300 hover:text-white underline">
                        Erase details…
                      </button>
                    )}
                    {canWrite && !guest.email.endsWith('@removed.invalid') && guest.rsvpStatus !== 'DECLINED' && editingGuest !== guest.id && (
                      <button type="button" onClick={() => { setEditingGuest(guest.id); setGuestError(null); setGuestNotice(null) }} className="text-sm text-green-400 hover:text-green-300">
                        Edit
                      </button>
                    )}
                    {guest.rsvpStatus !== 'DECLINED' && (
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        Peg
                        <input
                          type="number"
                          min={1}
                          max={40}
                          inputMode="numeric"
                          aria-label={`${guest.name}’s peg`}
                          value={pegEdits[guest.id] ?? (guest.pegNumber ?? '')}
                          onChange={(e) => setPegEdits({ ...pegEdits, [guest.id]: e.target.value })}
                          onBlur={(e) => { if (pegEdits[guest.id] !== undefined) void saveGuestPeg(guest.id, e.target.value) }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          disabled={!canWrite || savingPeg === guest.id}
                          className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white disabled:opacity-60"
                        />
                      </label>
                    )}
                    {canWrite && guest.dayFee > 0 && guest.rsvpStatus !== 'DECLINED' && guest.paymentStatus === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => void setGuestPaid(guest.id, true)}
                        disabled={markingPayment === guest.id}
                        className="text-sm text-green-400 hover:text-green-300 disabled:opacity-50"
                      >
                        Mark {formatCurrency(guest.dayFee)} paid
                      </button>
                    )}
                    {canWrite && guest.paymentStatus === 'PAID' && !guest.stripePaymentId && (
                      <button
                        type="button"
                        onClick={() => void setGuestPaid(guest.id, false)}
                        disabled={markingPayment === guest.id}
                        className="text-sm text-slate-300 hover:text-white disabled:opacity-50"
                      >
                        Mark unpaid
                      </button>
                    )}
                    {guest.paymentStatus === 'PAID' && guest.rsvpStatus === 'DECLINED' ? (
                      <span className="text-sm text-amber-300 ml-auto">Paid after being withdrawn: refund them in Stripe</span>
                    ) : guest.paymentStatus !== 'PENDING' ? (
                      <span className="text-sm text-slate-400 ml-auto">{guest.stripePaymentId ? 'Paid by card, so kept on record' : 'Paid: mark unpaid to remove'}</span>
                    ) : guest.rsvpStatus === 'DECLINED' && guest.waiverAccepted ? (
                      <span className="text-sm text-slate-400 ml-auto">Withdrawn</span>
                    ) : !canWrite ? null : (
                      <button
                        type="button"
                        onClick={() => setConfirming({ kind: 'remove', guest })}
                        className="text-sm text-red-400 hover:text-red-300 ml-auto"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {editingGuest === guest.id && (
                    <GuestEditor
                      guest={guest as EditableGuest}
                      onSaved={async () => { setEditingGuest(null); setGuestNotice(`${guest.name}’s details saved.`); await refreshShoot() }}
                      onClose={() => setEditingGuest(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">No guests for this day.</p>
          )}
        </Card>

        {/* Beaters */}
        <ShootBeaters
          shootId={shoot.id}
          syndicateId={shoot.syndicateId}
          shootStatus={shoot.status}
          readOnly={!canWrite}
          bookings={shoot.beaterBookings ?? []}
          payments={shoot.beaterPayments ?? []}
          onChanged={refreshShoot}
        />

        <ConfirmDialog
          open={confirming !== null}
          title={confirming?.kind === 'erase' ? `Erase ${confirming.guest.name}’s details for good?` : `Remove ${confirming?.guest.name ?? 'this guest'} from the day?`}
          confirmLabel={confirming?.kind === 'erase' ? 'Erase their details' : 'Remove the guest'}
          busy={confirmBusy}
          onConfirm={() => void confirmed()}
          onCancel={() => { if (!confirmBusy) setConfirming(null) }}
        >
          {confirming?.kind === 'erase' ? (
            <>
              <p>Their phone, email and emergency contact go now and can’t be brought back.</p>
              <p>If they signed the acknowledgement or paid, their name and the signed acknowledgement stay on the record for its retention period.</p>
            </>
          ) : (
            <p>Their invitation link stops working. If they have already signed the acknowledgement they are shown as withdrawn instead, so the signed record stays.</p>
          )}
        </ConfirmDialog>

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
