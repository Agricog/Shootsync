/**
 * Login Page - ShootSync
 * Authentication entry point (Clerk placeholder)
 */

import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { validateInput } from '../../utils/validation'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const emailValidation = validateInput(email, 'email')
    if (!emailValidation.isValid) {
      setErrors({ email: emailValidation.errors.format || 'Invalid email' })
      return
    }

    if (!password || password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters' })
      return
    }

    setIsLoading(true)

    try {
      // TODO: Replace with Clerk signIn
      console.log('[Login] Signing in with:', emailValidation.sanitized)
      
      // Simulate auth delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      navigate(from, { replace: true })
    } catch (err) {
      setErrors({ form: 'Invalid email or password' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Sign In - ShootSync</title>
        <meta name="description" content="Sign in to your ShootSync account to manage your shooting syndicate." />
        <meta name="robots" content="noindex, nofollow" />
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
              Welcome back
            </h1>
            <p className="text-slate-400 text-center mb-6">
              Sign in to your account
            </p>

            {errors.form && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-500 text-sm text-center">{errors.form}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                required
                autoComplete="email"
                disabled={isLoading}
              />

              <Input
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-slate-400">Remember me</span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-sm text-green-500 hover:text-green-400"
                >
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" fullWidth isLoading={isLoading}>
                Sign In
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              Don't have an account?{' '}
              <Link to="/signup" className="text-green-500 hover:text-green-400 font-medium">
                Start free trial
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
