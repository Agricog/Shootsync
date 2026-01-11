/**
 * Guest Invite Component - ShootSync
 * Invite guest guns to a shoot
 */

import { useState } from 'react'
import Button from '../common/Button'
import Input from '../common/Input'
import Modal, { ModalFooter } from '../common/Modal'
import { validateInput, validateRequired } from '../../utils/validation'
import { formatCurrency } from '../../config/stripe'
import { captureError } from '../../utils/errorTracking'

interface GuestInviteProps {
  shootId: string
  shootName: string
  shootDate: string
  guestFee: number
  onInvite: (data: GuestInviteData) => Promise<void>
}

interface GuestInviteData {
  name: string
  email: string
  phone: string
  shootId: string
}

export default function GuestInvite({
  shootId,
  shootName,
  shootDate,
  guestFee,
  onInvite,
}: GuestInviteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  })

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    const nameError = validateRequired(formData.name, 'Name')
    if (nameError) newErrors.name = nameError

    const emailValidation = validateInput(formData.email, 'email')
    if (!emailValidation.isValid) {
      newErrors.email = 'Valid email is required'
    }

    if (formData.phone) {
      const phoneValidation = validateInput(formData.phone, 'phone')
      if (!phoneValidation.isValid) {
        newErrors.phone = 'Invalid phone number'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)

    try {
      await onInvite({
        ...formData,
        shootId,
      })
      setIsOpen(false)
      setFormData({ name: '', email: '', phone: '' })
    } catch (err) {
      captureError(err, 'GuestInvite.handleSubmit')
      setErrors({ form: 'Failed to send invite. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setErrors({})
    setFormData({ name: '', email: '', phone: '' })
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Invite Guest</Button>

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Invite Guest Gun"
        description={`${shootName} - ${shootDate}`}
      >
        <form onSubmit={handleSubmit}>
          {errors.form && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-500 text-sm">{errors.form}</p>
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Guest Name"
              value={formData.name}
              onChange={handleChange('name')}
              error={errors.name}
              required
            />

            <Input
              type="email"
              label="Email Address"
              value={formData.email}
              onChange={handleChange('email')}
              error={errors.email}
              hint="Invite and payment link will be sent here"
              required
            />

            <Input
              type="tel"
              label="Phone Number"
              value={formData.phone}
              onChange={handleChange('phone')}
              error={errors.phone}
            />

            <div className="p-4 bg-slate-800 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Guest Day Fee</span>
                <span className="text-white font-semibold">
                  {formatCurrency(guestFee)}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Guest will receive an email with payment link and waiver
              </p>
            </div>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Send Invite
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  )
}
