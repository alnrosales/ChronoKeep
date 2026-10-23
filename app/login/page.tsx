'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    
    // 1. Authenticate user credentials
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { 
      setError(error.message)
      setLoading(false) 
      return 
    }

    const user = data.user
    if (!user) {
      setError('User not found.')
      setLoading(false)
      return
    }

    // 2. Fetch both role and is_active status from the profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      setError('Unable to fetch user profile.')
      setLoading(false)
      return
    }

    // 3. Prevent login if the user is flagged as inactive
    if (profile.is_active === false) {
      await supabase.auth.signOut()
      setError('Your account has been deactivated. Please contact an administrator.')
      setLoading(false)
      return
    }

    // 4. Redirect based on role if active
    if (profile.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/employee')
    }
  }

  const handleSignupDemo = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: email.split('@')[0], role: email.includes('admin') ? 'admin' : 'employee' } }
    })
    if (error) setError(error.message)
    else setError('Check email to confirm, or disable email confirmation in Supabase Auth settings for demo.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--bg)]">
      <div className="w-full max-w-[960px] grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-center">
        
        {/* Left Branding Panel: Hidden on mobile, beautiful card on desktop */}
        <div className="hidden lg:flex flex-col justify-between rounded-[24px] bg-white border p-8 shadow-lg h-[460px]">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">C</div>
              <div className="font-semibold text-lg">ChronoKeep</div>
              <span className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-600">Version 5</span>
            </div>
            <h1 className="mt-12 text-[36px] font-bold leading-[1.1]">Timekeeper for distributed teams.</h1>
          </div>
          <div className="text-[12px] text-slate-400">Built for Waho Solutions Inc.</div>
        </div>

        {/* Right Form Card */}
        <div className="w-full rounded-[24px] bg-white border p-6 sm:p-8 shadow-lg">
          
          {/* Mobile-only Branding Header: Shows logo nicely on phones before the sign-in box */}
          <div className="flex lg:hidden items-center justify-between mb-6 pb-4 border-b">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white grid place-items-center font-bold text-sm">C</div>
              <span className="font-semibold text-base">ChronoKeep</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">v5</span>
          </div>

          <h2 className="text-[20px] sm:text-[22px] font-semibold">Sign in</h2>
          <p className="mt-1 text-[13px] text-slate-500">Enter your credentials to access your account.</p>
          
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="text-[12px] font-medium text-slate-600">Email</label>
              <input 
                type="email"
                autoComplete="email"
                value={email} 
                onChange={e=>setEmail(e.target.value)} 
                className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" 
                placeholder="name@waho.com"
                required
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-slate-600">Password</label>
              <input 
                type="password" 
                autoComplete="current-password"
                value={password} 
                onChange={e=>setPassword(e.target.value)} 
                className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" 
                placeholder="••••••••"
                required
              />
            </div>
            
            {error && <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-xl">{error}</div>}
            
            <button 
              disabled={loading} 
              className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-black active:scale-[0.99] transition-transform disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center lg:text-left text-[11px] text-slate-400">
            Waho Solutions Inc. • Secure Portal
          </div>
        </div>

      </div>
    </div>
  )
}