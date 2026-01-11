/**
 * Guest Waiver Component - ShootSync
 * Liability waiver for guest guns
 */

import { useState } from 'react'
import Button from '../common/Button'
import Input from '../common/Input'
import Card, { CardHeader, CardContent, CardFooter } from '../common/Card'
import { validateRequired, validateInput } from '../../utils/validation'

interface GuestWaiverProps {
  guestName: string
  shootName: string
  shootDate: string
  syndicateName: string
  onAccept: (data: WaiverData) => Promise<void>
}

interface WaiverData {
  emergencyContactName: string
  emergencyContactPhone: string
  acceptedAt: string
}

const DEFAULT_WAIVER_TEXT = `
By accepting this waiver, I confirm that:

1. I am a competent shot and hold appropriate insurance for game shooting.

2. I understand and accept the inherent risks associated with game shooting, including but not limited to risks from firearms, terrain, weather, and wildlife.

3. I agree to follow all safety instructions given by the shoot captain and to adhere to safe shooting practices at all times.

4. I release the syndicate, its members, and landowners from any liability for injury or damage that may occur during my participation, except in cases of gross negligence.

5. I confirm that I am physically fit to participate in the shoot and have disclosed any relevant medical conditions to the organizers.

6. I agree to respect the countryside code and all instructions regarding conservation and land management.
`

export default function GuestWaiver({
  guestName,
  shootName,
  shootDate,
  syndicateName,
  onAccept,
}: GuestWaiverProps) {
  const [hasRead, setHasRead] = useState(false)
  const [hasAccepted, setHasAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    emergencyContactName: '',
    emergencyContactPhone: '',
  })

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {}

    const nameError = validateRequired(formData.emergencyContactName, 'Emergency contact name')
    if (nameError) newErrors.emergencyContactName = nameError

    const phoneValidation = validateInput(formData.emergencyContactPhone, 'phone')
    if (!phoneValidation.isValid) {
      newErrors.emergencyContactPhone = 'Valid phone number is required'
    }

    if (!hasAccepted) {
      newErrors.acceptance = 'You must accept the waiver to continue'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)

    try {
      await onAccept({
        ...formData,
        acceptedAt: new Date().toISOString(),
      })
    } catch (err) {
      setErrors({ form: 'Failed to submit waiver. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Liability Waiver"
        subtitle={`${shootName} - ${shootDate}`}
      />
      <CardContent>
        <div className="space-y-6">
          <div className="p-4 bg-slate-800 rounded-lg">
            <p className="text-white font-medium mb-2">Guest: {guestName}</p>
            <p className="text-slate-400 text-sm">Syndicate: {syndicateName}</p>
          </div>

          {/* Waiver Text */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Waiver Terms
            </label>
            <div
              className="h-48 overflow-y-auto p-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-sm whitespace-pre-line"
              onScroll={(e) => {
                const target = e.target as HTMLDivElement
                if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
                  setHasRead(true)
                }
              }}
            >
              {DEFAULT_WAIVER_TEXT}
            </div>
            {!hasRead && (
              <p className="text-amber-400 text-xs">
                Please scroll to read the entire waiver
              </p>
            )}
          </div>

          {/* Emergency Contact */}
          <div className="space-y-4">
            <h3 className="text-white font-medium">Emergency Contact</h3>
            <Input
              label="Contact Name"
              value={formData.emergencyContactName}
              onChange={handleChange('emergencyContactName')}
              error={errors.emergencyContactName}
              required
            />
            <Input
              type="tel"
              label="Contact Phone"
              value={formData.emergencyContactPhone}
              onChange={handleChange('emergencyContactPhone')}
              error={errors.emergencyContactPhone}
              required
            />
          </div>

          {/* Acceptance */}
          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasAccepted}
                onChange={(e) => setHasAccepted(e.target.checked)}
                disabled={!hasRead}
                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-600 focus:ring-green-500 disabled:opacity-50"
              />
              <span className={`text-sm ${hasRead ? 'text-white' : 'text-slate-500'}`}>
                I have read and understand the waiver terms, and I accept full responsibility
                for my participation in this shoot.
              </span>
            </label>
            {errors.acceptance && (
              <p className="text-red-500 text-sm">{errors.acceptance}</p>
            )}
          </div>

          {errors.form && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-500 text-sm">{errors.form}</p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleSubmit}
          isLoading={isSubmitting}
          disabled={!hasAccepted}
        >
          Accept Waiver & Continue to Payment
        </Button>
      </CardFooter>
    </Card>
  )
}
