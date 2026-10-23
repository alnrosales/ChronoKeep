'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Bricolage_Grotesque } from 'next/font/google'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'] })

const ZONES = [
  { label: 'Manila', tz: 'Asia/Manila' },
  { label: 'Sydney', tz: 'Australia/Sydney' },
  { label: 'London', tz: 'Europe/London' },
]

function zoneTime(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(ms))
  const h = parts.find(p => p.type === 'hour')?.value ?? '00'
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  const hourNum = parseInt(h, 10) % 24
  return { text: `${h}:${m}`, daytime: hourNum >= 6 && hourNum < 18 }
}

function LiveClock({ now, className = '' }: { now: number | null; className?: string }) {
  const d = new Date(now ?? 0)
  const minAngle = now === null ? 0 : d.getMinutes() * 6 + d.getSeconds() * 0.1
  const hourAngle = now === null ? 0 : (d.getHours() % 12) * 30 + d.getMinutes() * 0.5
  const progress = now === null ? 0 : d.getSeconds() / 60
  const C = 2 * Math.PI * 92

  const origin = { transformOrigin: '100px 100px' } as const

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Live analog clock">
      <circle cx="100" cy="100" r="98" fill="#ffffff" fillOpacity="0.12" />
      <circle cx="100" cy="100" r="92" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="5" />
      <circle
        cx="100" cy="100" r="92" fill="none" stroke="#FFC83D" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
        transform="rotate(-90 100 100)"
      />
      {Array.from({ length: 60 }).map((_, i) => {
        const major = i % 5 === 0
        return (
          <line
            key={i} x1="100" y1={major ? 17 : 19} x2="100" y2={major ? 29 : 24}
            stroke="#ffffff" strokeOpacity={major ? 0.95 : 0.4} strokeWidth={major ? 2.5 : 1}
            strokeLinecap="round" transform={`rotate(${i * 6} 100 100)`}
          />
        )
      })}
      <g style={{ ...origin, transform: `rotate(${hourAngle}deg)` }}>
        <line x1="100" y1="108" x2="100" y2="58" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
      </g>
      <g style={{ ...origin, transform: `rotate(${minAngle}deg)` }}>
        <line x1="100" y1="110" x2="100" y2="36" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="100" r="6" fill="#FF5A4E" />
      <circle cx="100" cy="100" r="2.5" fill="#ffffff" />
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState<number | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

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

  const bigTime = now === null ? '--:--' : zoneTime(now, Intl.DateTimeFormat().resolvedOptions().timeZone).text

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#EEEAFF]">
      <div className="w-full max-w-[1040px] grid lg:grid-cols-[1.1fr_0.9fr] rounded-[32px] overflow-hidden shadow-[0_30px_80px_-20px_rgba(60,30,200,0.45)] bg-white">

        {/* Left: live clock panel (desktop) */}
        <div className="hidden lg:flex relative flex-col justify-between bg-[#4B2BF0] text-white p-10 min-h-[600px] overflow-hidden">
          {/* big offset clock face as a backdrop shape */}
          <div className="absolute -right-32 -bottom-32 w-[420px] h-[420px] rounded-full bg-[#FF5A4E] opacity-90" aria-hidden />
          <div className="absolute -left-20 -top-20 w-[220px] h-[220px] rounded-full bg-[#7A5CFF]" aria-hidden />

          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-[#4B2BF0] grid place-items-center font-extrabold">C</div>
            <div className={`${display.className} font-bold text-xl`}>ChronoKeep</div>
            <span className="text-[11px] px-2 py-1 rounded-full bg-white/20 font-medium">Version 5</span>
          </div>

          <div className="relative">
            <LiveClock now={now} className="w-[250px] h-[250px] drop-shadow-[0_18px_30px_rgba(20,10,80,0.35)]" />
            <div className={`${display.className} mt-6 text-[64px] font-extrabold leading-none tabular-nums`}>{bigTime}</div>
            <h1 className={`${display.className} mt-4 text-[30px] font-bold leading-[1.1] max-w-[320px]`}>
              Timekeeping for teams spread across the clock.
            </h1>
          </div>

          <div className="relative">
            <div className="flex gap-2.5">
              {ZONES.map(z => {
                const t = now === null ? null : zoneTime(now, z.tz)
                return (
                  <div key={z.tz} className="flex-1 rounded-2xl bg-white/15 backdrop-blur px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[12px] text-white/80">
                      <span className={`w-2 h-2 rounded-full ${t?.daytime ? 'bg-[#FFC83D]' : 'bg-[#B9A8FF]'}`} />
                      {z.label}
                    </div>
                    <div className="mt-0.5 font-semibold text-[17px] tabular-nums">{t?.text ?? '--:--'}</div>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 text-[12px] text-white/70">Built for Waho Solutions Inc. by Alistair Rosales</div>
          </div>
        </div>

        {/* Right: form */}
        <div className="w-full p-6 sm:p-10 flex flex-col justify-center">

          {/* Mobile-only branding header with a compact live clock */}
          <div className="flex lg:hidden items-center justify-between mb-8 rounded-2xl bg-[#4B2BF0] text-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white text-[#4B2BF0] grid place-items-center font-extrabold text-sm">C</div>
              <div>
                <div className={`${display.className} font-bold text-base leading-tight`}>ChronoKeep</div>
                <div className="text-[12px] text-white/75 tabular-nums">{bigTime} local · v5</div>
              </div>
            </div>
            <LiveClock now={now} className="w-14 h-14" />
          </div>

          <h2 className={`${display.className} text-[28px] sm:text-[32px] font-extrabold text-[#14102B] leading-tight`}>Welcome back</h2>
          <p className="mt-1.5 text-[14px] text-slate-500">Sign in to clock in, review your hours and manage your team.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="text-[13px] font-semibold text-[#14102B]">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1.5 w-full h-12 rounded-2xl border-2 border-[#E4DFFA] bg-[#FAF9FF] px-4 text-sm text-[#14102B] placeholder:text-slate-400 transition-colors focus:outline-none focus:border-[#4B2BF0] focus:bg-white focus:ring-4 focus:ring-[#4B2BF0]/15"
                placeholder="name@waho.com.au"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="text-[13px] font-semibold text-[#14102B]">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1.5 w-full h-12 rounded-2xl border-2 border-[#E4DFFA] bg-[#FAF9FF] pl-4 pr-16 text-sm text-[#14102B] placeholder:text-slate-400 transition-colors focus:outline-none focus:border-[#4B2BF0] focus:bg-white focus:ring-4 focus:ring-[#4B2BF0]/15"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-[calc(50%+3px)] -translate-y-1/2 text-[12px] font-semibold text-[#4B2BF0] hover:text-[#2f16b8] rounded-md px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B2BF0]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="text-[13px] text-[#B42318] bg-[#FFF1EF] border border-[#FFC9C2] p-3 rounded-2xl">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="group w-full h-12 rounded-2xl bg-[#FF5A4E] text-white text-[15px] font-bold shadow-[0_10px_24px_-8px_rgba(255,90,78,0.7)] hover:bg-[#F2443A] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5A4E]/30"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-2 justify-center lg:justify-start text-[12px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-[#2EE6A6]" aria-hidden />
            Waho Solutions Inc. secure portal
          </div>
        </div>

      </div>
    </div>
  )
}