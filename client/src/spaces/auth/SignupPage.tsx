import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { LavaLogo } from '@/components/layout/LavaLogo'
import { Button, Input } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/hooks/useTheme'

export function SignupPage() {
  useTheme()
  const navigate = useNavigate()
  const signup = useAuthStore((s) => s.signup)
  const loginWithProvider = useAuthStore((s) => s.loginWithProvider)
  const isLoading = useAuthStore((s) => s.isLoading)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name || !email || !password) {
      setError('Please fill in all fields')
      return
    }
    try {
      await signup(name, email, password)
      navigate('/', { replace: true })
    } catch {
      setError('Signup failed')
    }
  }

  async function handleProvider(provider: 'google' | 'apple' | 'lava') {
    try {
      await loginWithProvider(provider)
      navigate('/', { replace: true })
    } catch {
      setError('Provider sign-in failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4">
      <button
        onClick={() => navigate(-1)}
        className="fixed top-4 left-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ChevronLeft size={18} />
        Back
      </button>
      <div className="w-full max-w-sm space-y-6">
        {/* Logo and heading */}
        <div className="flex flex-col items-center gap-3">
          <LavaLogo />
          <h1 className="text-2xl font-semibold text-text-primary">
            Create your LAVA account
          </h1>
          <p className="text-sm text-text-secondary">
            Your AI-powered practice partner
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            id="signup-name"
            label="Full Name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <Input
            id="signup-email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            id="signup-password"
            label="Password"
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          {error && (
            <p className="text-xs text-error">{error}</p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-text-muted">or continue with</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Provider buttons */}
        <div className="space-y-2">
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => handleProvider('google')}
            disabled={isLoading}
          >
            Continue with Google
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => handleProvider('apple')}
            disabled={isLoading}
          >
            Continue with Apple
          </Button>
          <Button
            size="lg"
            className="w-full"
            onClick={() => handleProvider('lava')}
            disabled={isLoading}
          >
            Sign in with LAVA ID
          </Button>
        </div>

        {/* Sign in link */}
        <p className="text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-text-primary underline underline-offset-4 hover:text-accent"
          >
            Sign in
          </Link>
        </p>

        {/* Legal footer */}
        <p className="text-center text-xs text-text-muted">
          By continuing, you agree to LAVA&apos;s Terms of Service and Privacy
          Policy
        </p>
      </div>
    </div>
  )
}
