import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { useApi } from '../../hooks/useApi'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'

interface Syndicate {
  id: string
  name: string
}

export default function ShootCreate() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const syndicateApi = useApi<Syndicate>('syndicates')
  const shootApi = useApi('shoots')
  
  const [syndicateId, setSyndicateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    date: '',
    locationName: '',
    locationAddress: '',
    locationPostcode: '',
    meetTime: '08:30',
    drivesPlanned: 4,
    expectedBag: 100,
    captainNotes: '',
  })

  useEffect(() => {
    if (user?.id) {
      loadSyndicate()
    }
  }, [user?.id])

  const loadSyndicate = async () => {
    const syndicates = await syndicateApi.fetchAll({ captainClerkId: user?.id || '' })
    if (syndicates.length > 0) {
      setSyndicateId(syndicates[0].id)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!syndicateId) return

    setLoading(true)
    const result = await shootApi.create({
      ...formData,
      syndicateId,
    })

    if (result) {
      navigate('/shoots')
    }
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Schedule Shoot | ShootSync</title>
      </Helmet>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Schedule New Shoot</h1>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Date"
              name="date"
              type="date"
              value={formData.date}
              onChange={handleChange}
              required
            />

            <Input
              label="Location Name"
              name="locationName"
              value={formData.locationName}
              onChange={handleChange}
              placeholder="e.g. Oakwood Farm"
              required
            />

            <Input
              label="Location Address"
              name="locationAddress"
              value={formData.locationAddress}
              onChange={handleChange}
              placeholder="Full address"
            />

            <Input
              label="Postcode"
              name="locationPostcode"
              value={formData.locationPostcode}
              onChange={handleChange}
              placeholder="e.g. OX15 4HB"
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Meet Time"
                name="meetTime"
                type="time"
                value={formData.meetTime}
                onChange={handleChange}
              />
              <Input
                label="Drives Planned"
                name="drivesPlanned"
                type="number"
                value={formData.drivesPlanned}
                onChange={handleChange}
                min={1}
                max={10}
              />
            </div>

            <Input
              label="Expected Bag"
              name="expectedBag"
              type="number"
              value={formData.expectedBag}
              onChange={handleChange}
              min={0}
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Captain's Notes
              </label>
              <textarea
                name="captainNotes"
                value={formData.captainNotes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                placeholder="Any notes for the day..."
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Schedule Shoot'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/shoots')}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  )
}
