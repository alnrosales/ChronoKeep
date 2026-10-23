'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('al@kulbakaayo.com')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    // get role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    if (profile?.role === 'admin') router.push('/admin')
    else router.push('/employee')
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
      <div className="w-full max-w-[960px] grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="hidden lg:flex flex-col justify-between rounded-[24px] bg-white border p-8 shadow-lg">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">C</div>
              <div className="font-semibold text-lg">ChronoKeep</div>
              <span className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-600">Production v3 • Supabase</span>
            </div>
            <h1 className="mt-12 text-[36px] font-bold leading-[1.1]">Tamper-proof timekeeping for distributed teams.</h1>
            <p className="mt-4 text-slate-500 text-[14px]">Next.js + Supabase. RLS secured. Every edit creates an immutable audit log with reason.</p>
          </div>
          <div className="text-[12px] text-slate-400">Built for Vercel deployment. No localStorage — all in Postgres.</div>
        </div>
        <div className="rounded-[24px] bg-white border p-6 sm:p-8 shadow-lg">
          <h2 className="text-[22px] font-semibold">Sign in</h2>
          <p className="mt-1 text-[13px] text-slate-500">Use Supabase Auth. Create accounts in Supabase Dashboard first.</p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div><label className="text-[12px] text-slate-500">Email</label><input value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full h-11 rounded-xl border px-3 text-sm" /></div>
            <div><label className="text-[12px] text-slate-500">Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full h-11 rounded-xl border px-3 text-sm" /></div>
            {error && <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-xl">{error}</div>}
            <button disabled={loading} className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-black">{loading ? 'Signing in...' : 'Sign in'}</button>
            <button type="button" onClick={handleSignupDemo} className="w-full h-11 rounded-xl border bg-white text-sm">Create demo account (needs email confirm off)</button>
          </form>
          <div className="mt-6 text-[11px] text-slate-400">Tip: In Supabase Dashboard → Auth → Providers → Email → Disable confirmations for quick testing.</div>
        </div>
      </div>
    </div>
  )
}
