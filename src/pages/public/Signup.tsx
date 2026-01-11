/**
 * Signup Page - ShootSync
 * New account registration (Clerk placeholder)
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { validateInput, validateRequired } from '../../utils/validation'

export default function Signup() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

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
      newErrors.email = emailValidation.errors.format || 'Invalid email'
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)

    try {
      // TODO: Replace with Clerk signUp
      console.log('[Signup] Creating account for:', emailValidation.sanitized)
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setErrors({ form: 'Failed to create account. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Start Free Trial - ShootSync</title>
        <meta name="description" content="Create your ShootSync account and start managing your shooting syndicate professionally. 14-day free trial, no credit card required." />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link to="/" className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">SS</span>
            </div>
            <span className="text-white font-semibold text-xl">ShootSync</span>
          </Link>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              Start your free trial
            </h1>
            <p className="text-slate-400 text-center mb-6">
              14 days free, no credit card required
            </p>

            {errors.form && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-500 text-sm text-center">{errors.form}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                label="Full name"
                value={formData.name}
                onChange={handleChange('name')}
                error={errors.name}
                required
                autoComplete="name"
                disabled={isLoading}
              />

              <Input
                type="email"
                label="Email address"
                value={formData.email}
                onChange={handleChange('email')}
                error={errors.email}
                required
                autoComplete="email"
                disabled={isLoading}
              />

              <Input
                type="password"
                label="Password"
                value={formData.password}
                onChange={handleChange('password')}
                error={errors.password}
                hint="At least 8 characters"
                required
                autoComplete="new-password"
                disabled={isLoading}
              />

              <Input
                type="password"
                label="Confirm password"
                value={formData.confirmPassword}
                onChange={handleChange('confirmPassword')}
                error={errors.confirmPassword}
                required
                autoComplete="new-password"
                disabled={isLoading}
              />

              <Button type="submit" fullWidth isLoading={isLoading}>
                Create Account
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              By creating an account, you agree to our{' '}
              <Link to="/terms" className="text-green-500 hover:text-green-400">Terms</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-green-500 hover:text-green-400">Privacy Policy</Link>
            </p>

            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="text-green-500 hover:text-green-400 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
