'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export default function SignUpPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
  }

  if (done) {
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
            <p className="text-slate-300 text-3xl font-semibold leading-snug">
              The intelligence layer<br />for your client relationships.
            </p>
            <p className="text-slate-500 mt-4 text-sm">Track clients, assignments, and signals — all in one place.</p>
          </div>
          <p className="text-slate-600 text-xs">© 2026 Client Intel</p>
        </div>

        {/* Right panel — success state */}
        <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
          <div className="w-full max-w-sm space-y-4 text-center">
            <h1 className="text-2xl font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to <strong>{email}</strong>.
            </p>
            <Link href="/sign-in" className="text-sm underline underline-offset-4">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
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
          <p className="text-slate-300 text-3xl font-semibold leading-snug">
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
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-muted-foreground mt-1 text-sm">Join Client Intel to manage your clients</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
              />
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
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link href="/sign-in" className="underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
