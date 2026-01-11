/**
 * Create Shoot Page - ShootSync
 * Create new shoot day
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent, } from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { validateRequired, validateInput, validatePositiveNumber } from '../../utils/validation'
import { captureError } from '../../utils/errorTracking'

export default function ShootCreate() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    date: '',
    locationName: '',
    locationAddress: '',
    locationPostcode: '',
    locationWhat3Words: '',
    meetTime: '08:30',
    drivesPlanned: '4',
    expectedBag: '80',
    captainNotes: '',
  })

  const handleChange = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    const dateError = validateRequired(formData.date, 'Date')
    if (dateError) newErrors.date = dateError

    const locationError = validateRequired(formData.locationName, 'Location name')
    if (locationError) newErrors.locationName = locationError

    const timeError = validateRequired(formData.meetTime, 'Meet time')
    if (timeError) newErrors.meetTime = timeError

    const drivesNum = parseInt(formData.drivesPlanned)
    const drivesError = validatePositiveNumber(drivesNum, 'Drives planned')
    if (drivesError) newErrors.drivesPlanned = drivesError

    const bagNum = parseInt(formData.expectedBag)
    const bagError = validatePositiveNumber(bagNum, 'Expected bag')
    if (bagError) newErrors.expectedBag = bagError

    if (formData.locationPostcode) {
      const postcodeValidation = validateInput(formData.locationPostcode, 'postcode')
      if (!postcodeValidation.isValid) {
        newErrors.locationPostcode = 'Invalid UK postcode'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)

    try {
      // TODO: API call to create shoot
      console.log('[ShootCreate] Creating shoot:', formData)
      await new Promise(resolve => setTimeout(resolve, 1000))
      navigate('/shoots')
    } catch (err) {
      captureError(err, 'ShootCreate.handleSubmit')
      setErrors({ form: 'Failed to create shoot. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Create Shoot - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="Create Shoot"
        subtitle="Schedule a new shoot day"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Date & Time" />
              <CardContent>
                <div className="space-y-4">
                  <Input
                    type="date"
                    label="Shoot Date"
                    value={formData.date}
                    onChange={handleChange('date')}
                    error={errors.date}
                    required
                  />
                  <Input
                    type="time"
                    label="Meet Time"
                    value={formData.meetTime}
                    onChange={handleChange('meetTime')}
                    error={errors.meetTime}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Location" />
              <CardContent>
                <div className="space-y-4">
                  <Input
                    label="Location Name"
                    value={formData.locationName}
                    onChange={handleChange('locationName')}
                    error={errors.locationName}
                    placeholder="e.g., Beatrice Farm"
                    required
                  />
                  <Input
                    label="Address"
                    value={formData.locationAddress}
                    onChange={handleChange('locationAddress')}
                    placeholder="Full address (optional)"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Postcode"
                      value={formData.locationPostcode}
                      onChange={handleChange('locationPostcode')}
                      error={errors.locationPostcode}
                      placeholder="e.g., OX15 4AB"
                    />
                    <Input
                      label="what3words"
                      value={formData.locationWhat3Words}
                      onChange={handleChange('locationWhat3Words')}
                      placeholder="e.g., filled.count.soap"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Shoot Details" />
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      label="Drives Planned"
                      value={formData.drivesPlanned}
                      onChange={handleChange('drivesPlanned')}
                      error={errors.drivesPlanned}
                      min="1"
                      max="10"
                      required
                    />
                    <Input
                      type="number"
                      label="Expected Bag"
                      value={formData.expectedBag}
                      onChange={handleChange('expectedBag')}
                      error={errors.expectedBag}
                      min="0"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Notes" />
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Captain Notes
                    </label>
                    <textarea
                      value={formData.captainNotes}
                      onChange={handleChange('captainNotes')}
                      rows={4}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Any special instructions or notes for this shoot..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {errors.form && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-500">{errors.form}</p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/shoots')}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Shoot
            </Button>
          </div>
        </form>
      </DashboardLayout>
    </>
  )
}
