/**
 * Guest invitation - ShootSync
 *
 * A guest opens the link a gun or captain sent them, sees the day, and either accepts (reading
 * the guest acknowledgement and leaving an emergency contact) or declines. The link is the guest's only key:
 * they have no account. ShootSync doesn't take the day fee: the guest pays the syndicate as
 * arranged, and the captain marks them paid.
 *
 * Every call goes through src/lib/api.ts, so every failure reads as a sentence, and the
 * server's own words (a cancelled day, an expired link) are shown as they are.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { apiRequest } from '../../lib/api'
import { sha256Hex } from '../../lib/hash'
import { formatCurrency } from '../../config/stripe'
import { formatLongDate, formatTime } from '../../utils/dateHelpers'

type Step = 'loading' | 'details' | 'waiver' | 'confirmed' | 'declined' | 'closed' | 'error'

interface GuestInvite {
  name: string
  email: string
  dayFee: number
  rsvpStatus: 'PENDING' | 'CONFIRMED' | 'DECLINED'
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED'
  waiverAccepted: boolean
  /** Why nothing more can be done with this invitation (the day was cancelled or has passed), or null. */
  closed: string | null
  /** The exact words to accept, from the server, so the record matches what was shown. */
  waiver: { version: string; text: string }
  invitedByMember: { name: string } | null
  shootDay: {
    date: string
    locationName: string
    locationAddress: string | null
    locationPostcode: string | null
    meetTime: string | null
    syndicate: { name: string }
  }
}


const PHONE_PATTERN = /^[\d\s+()-]{10,}$/

/** Where the invitation should open, from what the server says about it. */
function stepFor(invite: GuestInvite): Step {
  if (invite.closed) return 'closed'
  if (invite.rsvpStatus === 'CONFIRMED') return 'confirmed'
  if (invite.rsvpStatus === 'DECLINED') return 'declined'
  return 'details'
}

/** What the guest is told about the day fee once they've accepted. */
function feeLine(invite: GuestInvite): string | null {
  if (invite.dayFee <= 0) return null
  const fee = formatCurrency(invite.dayFee)
  if (invite.paymentStatus === 'PAID') return `Day fee: ${fee}, paid. Thank you.`
  const host = invite.invitedByMember?.name
  return `Day fee: ${fee}. Please pay ${invite.shootDay.syndicate.name} directly${host ? `, as arranged with ${host}` : ''}. ShootSync doesn’t take payments.`
}

function DayDetails({ invite }: { invite: GuestInvite }) {
  const { shootDay } = invite
  return (
    <dl className="p-4 bg-slate-800 rounded-lg space-y-4 text-left">
      <div>
        <dt className="text-slate-400 text-sm">Syndicate</dt>
        <dd className="text-white font-medium">{shootDay.syndicate.name}</dd>
      </div>
      <div>
        <dt className="text-slate-400 text-sm">Date</dt>
        <dd className="text-white font-medium">{formatLongDate(shootDay.date)}</dd>
      </div>
      <div>
        <dt className="text-slate-400 text-sm">Meet time</dt>
        <dd className="text-white font-medium">{shootDay.meetTime ? formatTime(shootDay.meetTime) : 'To be confirmed'}</dd>
      </div>
      <div>
        <dt className="text-slate-400 text-sm">Location</dt>
        <dd className="text-white font-medium">{shootDay.locationName}</dd>
        {shootDay.locationAddress && <dd className="text-slate-300 text-sm">{shootDay.locationAddress}</dd>}
        {shootDay.locationPostcode && <dd className="text-slate-300 text-sm">{shootDay.locationPostcode}</dd>}
      </div>
    </dl>
  )
}

function Problem({ message }: { message: string }) {
  return <p role="alert" className="rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">{message}</p>
}

export default function GuestAccept() {
  const { token: tokenFromPath } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const token = tokenFromPath || searchParams.get('token') || ''
  const base = `/api/guests/token/${encodeURIComponent(token)}`

  const [step, setStep] = useState<Step>('loading')
  const [invite, setInvite] = useState<GuestInvite | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const [contact, setContact] = useState({ name: '', phone: '' })
  const [waiverTicked, setWaiverTicked] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; waiver?: string }>({})

  const load = useCallback(async () => {
    if (!token) {
      setLoadError('This link is missing its invitation code. Ask the person who invited you to send it again.')
      setStep('error')
      return
    }
    setStep('loading')
    const result = await apiRequest<GuestInvite>(base)
    if (!result.ok) {
      setLoadError(result.status === 404 ? 'This invitation is invalid or has expired. Ask the person who invited you to send it again.' : result.error)
      setStep('error')
      return
    }
    setInvite(result.data)
    setStep(stepFor(result.data))
  }, [base, token])

  useEffect(() => {
    void load()
  }, [load])

  /** The server refused because the day closed while the page was open: show the closed page. */
  const afterRefusal = async (error: string, status: number) => {
    if (status === 409 || status === 404) {
      await load()
      return
    }
    setActionError(error)
  }

  const decline = async () => {
    setWorking(true)
    setActionError(null)
    const result = await apiRequest<GuestInvite>(`${base}/decline`, { method: 'POST' })
    setWorking(false)
    if (!result.ok) return afterRefusal(result.error, result.status)
    setInvite({ ...result.data, closed: invite?.closed ?? null, waiver: invite!.waiver })
    setStep('declined')
  }

  const accept = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: typeof fieldErrors = {}
    if (!contact.name.trim()) errors.name = 'Enter your emergency contact’s name.'
    if (!contact.phone.trim()) errors.phone = 'Enter your emergency contact’s phone number.'
    else if (!PHONE_PATTERN.test(contact.phone.trim())) errors.phone = 'Enter a phone number of at least 10 digits.'
    if (!waiverTicked) errors.waiver = 'Tick to accept the acknowledgement.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setWorking(true)
    setActionError(null)
    const waiverTextHash = await sha256Hex(invite!.waiver.text)
    const result = await apiRequest<GuestInvite>(`${base}/accept`, {
      method: 'POST',
      body: { emergencyContactName: contact.name.trim(), emergencyContactPhone: contact.phone.trim(), waiverAccepted: true, waiverTextHash },
    })
    setWorking(false)
    if (!result.ok) return afterRefusal(result.error, result.status)
    setInvite({ ...result.data, closed: null, waiver: invite!.waiver })
    setStep('confirmed')
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const fee = invite ? feeLine(invite) : null

  return (
    <>
      <Helmet>
        <title>Guest invitation | ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-slate-900 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">SS</span>
            </div>
            <span className="text-white font-semibold text-xl">ShootSync</span>
          </div>

          {step === 'error' && (
            <Card>
              <div className="text-center py-8">
                <h1 className="text-xl font-bold text-white mb-2">This invitation can’t be opened</h1>
                <p className="text-slate-300">{loadError}</p>
              </div>
            </Card>
          )}

          {step === 'closed' && invite && (
            <Card>
              <div className="text-center py-8">
                <h1 className="text-xl font-bold text-white mb-2">Invitation closed</h1>
                <p className="text-slate-300">{invite.closed}</p>
                <p className="text-slate-400 text-sm mt-3">
                  {invite.shootDay.locationName}, {formatLongDate(invite.shootDay.date)}
                </p>
              </div>
            </Card>
          )}

          {step === 'details' && invite && (
            <Card>
              <div className="p-6 space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">You’re invited to shoot</h1>
                  <p className="text-slate-300">
                    {invite.invitedByMember ? `${invite.invitedByMember.name} has invited you as their guest.` : 'You have been invited as a guest.'}
                  </p>
                </div>
                <DayDetails invite={invite} />
                {invite.dayFee > 0 && (
                  <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Guest day fee</span>
                      <span className="text-white font-bold text-xl">{formatCurrency(invite.dayFee)}</span>
                    </div>
                    <p className="text-slate-400 text-sm mt-2">Paid to the syndicate directly, not through ShootSync.</p>
                  </div>
                )}
                {actionError && <Problem message={actionError} />}
                <div className="space-y-3">
                  <Button onClick={() => { setActionError(null); setStep('waiver') }} fullWidth>Accept the invitation</Button>
                  <Button variant="ghost" onClick={() => void decline()} isLoading={working} disabled={working} fullWidth>
                    Decline
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {step === 'waiver' && invite && (
            <Card>
              <form onSubmit={(e) => void accept(e)} noValidate className="p-6 space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">Guest acknowledgement</h1>
                  <p className="text-slate-300">Read it, leave an emergency contact, and accept.</p>
                </div>
                <div className="h-56 overflow-y-auto p-4 bg-slate-800 rounded-lg" tabIndex={0} aria-label="Acknowledgement text">
                  <pre className="text-slate-200 text-sm whitespace-pre-wrap font-sans">{invite.waiver.text}</pre>
                </div>
                <p className="text-slate-400 text-xs">
                  Version {invite.waiver.version}. How your details are used:{' '}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="text-green-400 underline underline-offset-2">ShootSync’s privacy notice</a>.
                </p>
                <div className="space-y-4">
                  <Input
                    label="Emergency contact name"
                    value={contact.name}
                    onChange={(e) => setContact({ ...contact, name: e.target.value })}
                    error={fieldErrors.name}
                    autoComplete="off"
                    maxLength={100}
                    required
                  />
                  <Input
                    type="tel"
                    label="Emergency contact phone"
                    value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    error={fieldErrors.phone}
                    autoComplete="off"
                    maxLength={30}
                    required
                  />
                </div>
                <div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={waiverTicked}
                      onChange={(e) => setWaiverTicked(e.target.checked)}
                      aria-invalid={fieldErrors.waiver ? 'true' : 'false'}
                      className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-white">I have read and accept the guest acknowledgement</span>
                  </label>
                  {fieldErrors.waiver && <p className="text-red-300 text-sm mt-1">{fieldErrors.waiver}</p>}
                </div>
                {actionError && <Problem message={actionError} />}
                <div className="space-y-3">
                  <Button type="submit" isLoading={working} disabled={working} fullWidth>Accept and confirm</Button>
                  <Button type="button" variant="ghost" onClick={() => setStep('details')} disabled={working} fullWidth>Back</Button>
                </div>
              </form>
            </Card>
          )}

          {step === 'confirmed' && invite && (
            <Card>
              <div className="p-6 space-y-6 text-center">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">You’re confirmed</h1>
                  <p className="text-slate-300">
                    See you at {invite.shootDay.locationName}. Keep this link: it shows the day’s details.
                  </p>
                </div>
                <DayDetails invite={invite} />
                {fee && <p className="text-slate-200 text-left">{fee}</p>}
              </div>
            </Card>
          )}

          {step === 'declined' && (
            <Card>
              <div className="p-6 text-center">
                <h1 className="text-2xl font-bold text-white mb-2">Invitation declined</h1>
                <p className="text-slate-300">
                  You’ve declined this invitation. If that was a mistake, ask the person who invited you to add you again.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
