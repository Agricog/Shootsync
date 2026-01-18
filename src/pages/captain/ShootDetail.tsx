import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useApi } from '../../hooks/useApi'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'

interface ShootDay {
  id: string
  date: string
  locationName: string
  locationAddress?: string
  locationPostcode?: string
  meetTime: string
  status: string
  drivesPlanned: number
  expectedBag?: number
  captainNotes?: string
  attendances: any[]
  beaterBookings: any[]
  bagRecords: any[]
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
  const shootApi = useApi<ShootDay>('shoots')
  const [shoot, setShoot] = useState<ShootDay | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadShoot()
    }
  }, [id])

  const loadShoot = async () => {
    setLoading(true)
    const data = await shootApi.fetchOne(id!)
    setShoot(data)
    setLoading(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
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

  return (
    <DashboardLayout>
      <Helmet>
        <title>{shoot.locationName} | ShootSync</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-white">{shoot.locationName}</h1>
            <p className="text-gray-300">{formatDate(shoot.date)} • Meet {shoot.meetTime}</p>
          </div>
          <div className="flex gap-3">
            <Link to="/shoots">
              <Button variant="secondary">Back</Button>
            </Link>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Location Card */}
          <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Location</h2>
            <div className="space-y-2 text-gray-300">
              <p><strong>Name:</strong> {shoot.locationName}</p>
              {shoot.locationAddress && <p><strong>Address:</strong> {shoot.locationAddress}</p>}
              {shoot.locationPostcode && <p><strong>Postcode:</strong> {shoot.locationPostcode}</p>}
            </div>
          </Card>

          {/* Shoot Info Card */}
          <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Shoot Details</h2>
            <div className="space-y-2 text-gray-300">
              <p><strong>Status:</strong> {shoot.status}</p>
              <p><strong>Drives Planned:</strong> {shoot.drivesPlanned}</p>
              {shoot.expectedBag && <p><strong>Expected Bag:</strong> {shoot.expectedBag}</p>}
            </div>
          </Card>
        </div>

        {/* Captain's Notes */}
        {shoot.captainNotes && (
          <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Captain's Notes</h2>
            <p className="text-gray-300">{shoot.captainNotes}</p>
          </Card>
        )}

        {/* Attendees */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">
            Guns ({shoot.attendances?.length || 0})
          </h2>
          {shoot.attendances?.length > 0 ? (
            <div className="space-y-2">
              {shoot.attendances.map((att: any) => (
                <div key={att.id} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                  <span className="text-white">{att.member?.name}</span>
                  <span className="text-gray-400">Peg {att.pegNumber || 'TBD'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No guns assigned yet.</p>
          )}
        </Card>

        {/* Beaters */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">
            Beaters ({shoot.beaterBookings?.length || 0})
          </h2>
          {shoot.beaterBookings?.length > 0 ? (
            <div className="space-y-2">
              {shoot.beaterBookings.map((booking: any) => (
                <div key={booking.id} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                  <span className="text-white">{booking.beater?.name}</span>
                  <span className="text-gray-400">£{booking.dayRate}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No beaters booked yet.</p>
          )}
        </Card>

        {/* Bag Totals */}
        {shoot.bagTotals && (
          <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Bag Total</h2>
            <div className="grid grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-white">{shoot.bagTotals.pheasant}</p>
                <p className="text-gray-400 text-sm">Pheasant</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{shoot.bagTotals.partridge}</p>
                <p className="text-gray-400 text-sm">Partridge</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{shoot.bagTotals.duck}</p>
                <p className="text-gray-400 text-sm">Duck</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{shoot.bagTotals.woodcock}</p>
                <p className="text-gray-400 text-sm">Woodcock</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{shoot.bagTotals.other}</p>
                <p className="text-gray-400 text-sm">Other</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
