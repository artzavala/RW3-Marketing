'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — navy brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0F172A] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">CI</span>
          </div>
          <span className="text-white font-semibold text-lg">Client Intel</span>
        </div>
        <div>
          <div className="w-12 h-1 bg-blue-500 rounded mb-4"></div>
          <p className="text-white text-3xl font-bold leading-snug">
            The intelligence layer<br />for your client relationships.
          </p>
          <p className="text-slate-500 mt-4 text-sm">Track clients, assignments, and signals — all in one place.</p>
        </div>
        <p className="text-slate-600 text-xs">© 2026 Client Intel</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-1 text-sm">Sign in to your account</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Need an account?{' '}
            <Link href="/sign-up" className="underline underline-offset-4">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
