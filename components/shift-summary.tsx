'use client'
import { useEffect, useState } from 'react'
import { Bricolage_Grotesque } from 'next/font/google'
import { createClient } from '@/lib/supabase/client'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'] })

type Entry = {
  id: string | number
  date: string
  clock_in: string | null
  clock_out: string | null
  mode?: string | null
  status?: string | null
  quick_clockout_reason?: string | null
}

// ---- helpers (Manila time, UTC+8) ----
const manilaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

// Add/subtract days to a YYYY-MM-DD string
const shiftDate = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const monthStart = (ymd: string) => `${ymd.slice(0, 7)}-01`

const manilaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true })

const dayLabel = (ymd: string) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })

const hoursBetween = (a: string | null, b: string | null) =>
  a && b ? Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3600000) : null

const dateInput =
  'w-full h-12 rounded-2xl border-2 border-[#E4DFFA] bg-[#FAF9FF] px-3 text-[16px] sm:text-sm text-[#14102B] focus:outline-none focus:border-[#4B2BF0] focus:bg-white focus:ring-4 focus:ring-[#4B2BF0]/15'

export default function ShiftSummary({ employeeId }: { employeeId: string }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [today, setToday] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const openWindow = () => {
    const t = manilaToday()
    setToday(t); setFrom(monthStart(t)); setTo(t); setError(''); setOpen(true)
  }

  const presets = [
    { label: 'This month', from: today ? monthStart(today) : '', to: today },
    { label: 'Last 7 days', from: today ? shiftDate(today, -6) : '', to: today },
    { label: 'Last 30 days', from: today ? shiftDate(today, -29) : '', to: today },
  ]

  const rangeInvalid = !!from && !!to && from > to

  // Load the employee's own records for the chosen range
  useEffect(() => {
    if (!open || !from || !to || rangeInvalid) return
    let cancelled = false
    setLoading(true); setError('')
    supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
      .order('clock_in', { ascending: false })
      .limit(1000)
      .then(({ data, error }: any) => {
        if (cancelled) return
        if (error) { setError(error.message); setEntries([]) } else { setEntries(data || []) }
        setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, from, to, employeeId])

  const completed = entries.filter(e => e.clock_in && e.clock_out)
  const totalHours = completed.reduce((sum, e) => sum + (hoursBetween(e.clock_in, e.clock_out) ?? 0), 0)
  const daysWorked = new Set(entries.map(e => e.date)).size
  const avg = completed.length ? totalHours / completed.length : 0

  return (
    <>
      {/* Overview card (replaces "Recent hours") */}
      <button
        type="button"
        onClick={openWindow}
        className="group w-full text-left rounded-[20px] border border-white bg-white p-4 shadow-sm transition hover:border-[#C9BEFF] hover:shadow-md active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/25 sm:p-5"
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-[#14102B]">My shift summary</div>
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#E3FBF2] text-[#0B7A55]" aria-hidden>↗</span>
        </div>
        <div className={`${display.className} mt-3 text-2xl font-extrabold text-[#14102B]`}>View my shift summary</div>
        <p className="mt-1 text-xs text-slate-500">See your shifts and hours for any date range.</p>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-[#14102B]/55 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            role="dialog" aria-modal="true" aria-label="My shift summary"
            className="relative flex h-[94vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-[28px]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#EEEAFF] p-5 sm:p-6">
              <div>
                <h2 className={`${display.className} text-[20px] font-extrabold text-[#14102B] sm:text-[22px]`}>My shift summary</h2>
                <p className="mt-0.5 text-[12px] text-slate-500">Your own shift records. Pick a date range to filter.</p>
              </div>
              <button
                onClick={() => setOpen(false)} aria-label="Close"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EEEAFF] text-sm font-bold text-[#4B2BF0] transition hover:bg-[#E2DBFF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/20"
              >✕</button>
            </div>

            {/* Date range */}
            <div className="border-b border-[#EEEAFF] bg-[#FAF9FF] p-4 sm:px-6">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-600">From</span>
                  <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className={dateInput} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-600">To</span>
                  <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className={dateInput} />
                </label>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
                {presets.map(p => {
                  const active = p.from === from && p.to === to
                  return (
                    <button
                      key={p.label} type="button" onClick={() => { setFrom(p.from); setTo(p.to) }}
                      className={`h-9 shrink-0 rounded-full border-2 px-4 text-[13px] font-semibold transition active:scale-[0.98] ${
                        active ? 'border-[#4B2BF0] bg-[#4B2BF0] text-white' : 'border-[#E4DFFA] bg-white text-[#4B2BF0] hover:bg-[#F6F4FF]'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
              {rangeInvalid && (
                <div role="alert" className="mt-3 rounded-2xl border border-[#FFC9C2] bg-[#FFF1EF] p-3 text-[13px] text-[#B42318]">
                  The &quot;From&quot; date must be on or before the &quot;To&quot; date.
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Totals */}
              <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-4 sm:px-6">
                {[
                  { label: 'Total hours', value: totalHours.toFixed(2), tone: 'bg-[#EEEAFF] text-[#4B2BF0]' },
                  { label: 'Shifts', value: String(entries.length), tone: 'bg-[#FFF4D6] text-[#8A5A00]' },
                  { label: 'Days worked', value: String(daysWorked), tone: 'bg-[#E3FBF2] text-[#0B7A55]' },
                  { label: 'Avg hrs per shift', value: `${avg.toFixed(2)}`, tone: 'bg-[#FFF0EE] text-[#D93F35]' },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl p-3 ${s.tone}`}>
                    <div className="text-[11px] font-semibold opacity-80">{s.label}</div>
                    <div className={`${display.className} mt-0.5 text-[22px] font-extrabold tabular-nums`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {error && (
                <div role="alert" className="mx-4 mb-3 rounded-2xl border border-[#FFC9C2] bg-[#FFF1EF] p-3 text-[13px] text-[#B42318] sm:mx-6">
                  Couldn&apos;t load your records: {error}
                </div>
              )}

              {loading ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading your shifts...</div>
              ) : !rangeInvalid && entries.length === 0 && !error ? (
                <div className="py-12 text-center text-sm text-slate-500">No shifts found in this date range.</div>
              ) : (
                <ul className="divide-y divide-[#EEEAFF] border-t border-[#EEEAFF]">
                  {entries.map(e => {
                    const h = hoursBetween(e.clock_in, e.clock_out)
                    return (
                      <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
                        <div className="min-w-0">
                          <div className="text-[14px] font-bold text-[#14102B]">{dayLabel(e.date)}</div>
                          <div className="mt-0.5 text-[12px] tabular-nums text-slate-500">
                            {e.clock_in ? manilaTime(e.clock_in) : '—'} → {e.clock_out ? manilaTime(e.clock_out) : 'In progress'}
                            {e.mode ? ` · ${e.mode}` : ''}
                          </div>
                          {e.quick_clockout_reason && (
                            <div className="mt-1.5 inline-block max-w-full rounded-lg bg-[#FFF4D6] px-2 py-1 text-[11px] font-medium text-[#8A5A00] break-words">
                              Quick clock-out: {e.quick_clockout_reason}
                            </div>
                          )}
                        </div>
                        {e.clock_out ? (
                          <span className="shrink-0 rounded-full bg-[#EEEAFF] px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#4B2BF0]">
                            {(h ?? 0).toFixed(2)} hrs
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-[#E3FBF2] px-2.5 py-1 text-[11px] font-bold text-[#0B7A55]">ONGOING</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#EEEAFF] bg-[#FAF9FF] px-4 py-3 text-[12px] text-slate-500 sm:px-6">
              <span>All times are in Davao City time (UTC+8).</span>
              <button
                onClick={() => setOpen(false)}
                className="h-10 shrink-0 rounded-2xl border-2 border-[#E4DFFA] bg-white px-4 text-[13px] font-semibold text-[#4B2BF0] transition hover:bg-[#F6F4FF] active:scale-[0.98]"
              >Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
