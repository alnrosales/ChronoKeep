'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bricolage_Grotesque } from 'next/font/google'
import { editTimeEntry, forceClockOut, deleteTimeEntry } from '@/app/admin/actions'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'] })

type Entry = {
  id: string | number
  employee_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  mode?: string | null
  quick_clockout_reason?: string | null
  employee?: { full_name?: string | null; email?: string | null } | null
}
type Result = { ok: true } | { ok: false; error: string }
type View = 'menu' | 'edit' | 'force' | 'delete'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ---- style tokens (same palette as the login + admin pages) ----
const fieldInput =
  'w-full h-12 rounded-2xl border-2 border-[#E4DFFA] bg-[#FAF9FF] px-4 text-[16px] sm:text-sm text-[#14102B] placeholder:text-slate-400 transition-colors focus:outline-none focus:border-[#4B2BF0] focus:bg-white focus:ring-4 focus:ring-[#4B2BF0]/15'
const filterInput =
  'w-full h-11 rounded-xl border-2 border-[#E4DFFA] bg-[#FAF9FF] px-3 text-[16px] sm:text-[13px] text-[#14102B] placeholder:text-slate-400 focus:outline-none focus:border-[#4B2BF0] focus:bg-white'
const btnPrimary =
  'h-11 px-5 rounded-2xl bg-[#FF5A4E] text-white text-sm font-bold shadow-[0_10px_24px_-10px_rgba(255,90,78,0.7)] hover:bg-[#F2443A] active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5A4E]/30'
const btnViolet =
  'h-11 px-5 rounded-2xl bg-[#4B2BF0] text-white text-sm font-bold hover:bg-[#3A1FD0] active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/30'
const btnGhost =
  'h-11 px-5 rounded-2xl border-2 border-[#E4DFFA] bg-white text-[#4B2BF0] text-sm font-semibold hover:bg-[#F6F4FF] active:scale-[0.98] transition disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/20'
const btnDanger =
  'h-11 px-5 rounded-2xl bg-[#B42318] text-white text-sm font-bold hover:bg-[#912018] active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#B42318]/30'
const btnOpen =
  'h-9 px-4 rounded-xl bg-[#4B2BF0] text-white text-[12px] font-semibold hover:bg-[#3A1FD0] active:scale-[0.98] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/30'
const iconClose =
  'h-10 w-10 shrink-0 rounded-full bg-[#EEEAFF] text-[#4B2BF0] grid place-items-center text-sm font-bold hover:bg-[#E2DBFF] transition disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/20'

// ---- helpers (all times shown in Manila time) ----
const fullTime = (iso: string) => new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour12: true })
const shortTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true })

function calculateTotalHours(clockIn?: string | null, clockOut?: string | null): string {
  if (!clockIn || !clockOut) return '—'
  const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  if (diffMs <= 0) return '0.00 hrs'
  return `${(diffMs / (1000 * 60 * 60)).toFixed(2)} hrs`
}

const initials = (name?: string | null) =>
  (name || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'

// ISO timestamp -> "YYYY-MM-DDTHH:mm" in Manila time, for <input type="datetime-local">
function toManilaInput(iso?: string | null): string {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const g = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
}

function Ongoing() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E3FBF2] text-[#0B7A55] px-2.5 py-1 text-[12px] font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-[#2EE6A6] motion-safe:animate-pulse" aria-hidden />
      Ongoing
    </span>
  )
}

function ModePill({ mode }: { mode?: string | null }) {
  if (!mode) return <span className="text-slate-400">—</span>
  return <span className="inline-flex rounded-full bg-[#EEEAFF] text-[#4B2BF0] px-2.5 py-1 text-[12px] font-semibold">{mode}</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-[#14102B] mb-1.5">{label}</span>
      {children}
    </label>
  )
}

export default function TimeRecords({ entries, today, errorMessage, limit }: {
  entries: Entry[]; today: string; errorMessage?: string | null; limit: number
}) {
  const router = useRouter()

  // ---- filters ----
  const [q, setQ] = useState('')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('') // '01'..'12'
  const [day, setDay] = useState('')     // '01'..'31'

  const years = useMemo(
    () => Array.from(new Set(entries.map(e => String(e.date || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)))).sort().reverse(),
    [entries]
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return entries.filter((e) => {
      const d = String(e.date || '')
      if (year && d.slice(0, 4) !== year) return false
      if (month && d.slice(5, 7) !== month) return false
      if (day && d.slice(8, 10) !== day) return false
      if (needle) {
        const hay = `${e.employee?.full_name || ''} ${e.employee?.email || ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [entries, q, year, month, day])

  const filtersActive = !!(q || year || month || day)
  const clearFilters = () => { setQ(''); setYear(''); setMonth(''); setDay('') }

  // ---- admin actions popup ----
  const [selected, setSelected] = useState<Entry | null>(null)
  const [view, setView] = useState<View>('menu')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const openActions = (e: Entry) => {
    setSelected(e); setView('menu'); setReason(''); setErr('')
    setClockIn(toManilaInput(e.clock_in)); setClockOut(toManilaInput(e.clock_out))
  }
  const closeActions = () => { if (!busy) setSelected(null) }
  const goto = (v: View) => { setView(v); setErr(''); setReason('') }

  const submit = async (fn: () => Promise<Result>) => {
    setBusy(true); setErr('')
    try {
      const r = await fn()
      if (r.ok) { setSelected(null); router.refresh() } else { setErr(r.error) }
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = () => {
    if (!selected) return
    if (!clockIn) { setErr('Clock in is required.'); return }
    if (clockOut && clockOut <= clockIn) { setErr('Clock out must be after clock in.'); return }
    submit(() => editTimeEntry(String(selected.id), clockIn, clockOut || null, reason))
  }

  const name = selected?.employee?.full_name || (selected ? String(selected.employee_id).slice(0, 8) : '')

  return (
    <section className="rounded-[24px] bg-white shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-[#EEEAFF] flex items-center justify-between gap-3">
        <h2 className={`${display.className} text-[18px] sm:text-[20px] font-bold text-[#14102B]`}>Time records</h2>
        <span className="text-[12px] text-slate-500">Latest {limit} · Manila time</span>
      </div>

      {/* Filters */}
      <div className="p-4 sm:p-5 border-b border-[#EEEAFF] bg-[#FAF9FF]">
        <div className="grid grid-cols-3 sm:grid-cols-[minmax(0,1fr)_110px_150px_100px] gap-2.5">
          <label className="col-span-3 sm:col-span-1 block">
            <span className="block text-[12px] font-semibold text-slate-600 mb-1">Name</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className={filterInput} />
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-slate-600 mb-1">Year</span>
            <select value={year} onChange={(e) => setYear(e.target.value)} className={filterInput}>
              <option value="">All</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-slate-600 mb-1">Month</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={filterInput}>
              <option value="">All</option>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-slate-600 mb-1">Day</span>
            <select value={day} onChange={(e) => setDay(e.target.value)} className={filterInput}>
              <option value="">All</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => <option key={d} value={d}>{Number(d)}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-slate-500">
          <span>Showing <span className="font-semibold text-[#14102B]">{filtered.length}</span> of {entries.length} records</span>
          {filtersActive && (
            <button onClick={clearFilters} className="font-semibold text-[#4B2BF0] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B2BF0] rounded">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="m-4 text-[13px] text-[#B42318] bg-[#FFF1EF] border border-[#FFC9C2] p-3 rounded-2xl">
          Couldn&apos;t load time records: {errorMessage}
        </div>
      )}

      {!errorMessage && entries.length === 0 && (
        <div className="p-10 text-center text-[14px] text-slate-500">No time records yet. Entries appear here as soon as employees clock in.</div>
      )}
      {entries.length > 0 && filtered.length === 0 && (
        <div className="p-10 text-center text-[14px] text-slate-500">No records match these filters.</div>
      )}

      {/* Mobile: one card per record */}
      {filtered.length > 0 && (
        <ul className="md:hidden divide-y divide-[#EEEAFF]">
          {filtered.map((e) => (
            <li key={e.id} className={`p-4 ${e.date === today ? 'bg-[#FAF9FF]' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-[#EEEAFF] text-[#4B2BF0] grid place-items-center text-[13px] font-bold">{initials(e.employee?.full_name)}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] text-[#14102B] truncate">{e.employee?.full_name || String(e.employee_id).slice(0, 8)}</div>
                    <div className="text-[12px] text-slate-500 truncate">{e.employee?.email}</div>
                  </div>
                </div>
                <button onClick={() => openActions(e)} className={btnOpen}>Open</button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                <div className="rounded-xl bg-[#F6F4FF] p-2.5">
                  <div className="text-slate-500">In</div>
                  <div className="mt-0.5 font-semibold text-[#14102B] tabular-nums">{e.clock_in ? shortTime(e.clock_in) : '—'}</div>
                </div>
                <div className="rounded-xl bg-[#F6F4FF] p-2.5">
                  <div className="text-slate-500">Out</div>
                  <div className="mt-0.5 font-semibold text-[#14102B] tabular-nums">{e.clock_out ? shortTime(e.clock_out) : <Ongoing />}</div>
                </div>
                <div className="rounded-xl bg-[#FFF4D6] p-2.5">
                  <div className="text-slate-500">Total</div>
                  <div className="mt-0.5 font-semibold text-[#14102B] tabular-nums">{calculateTotalHours(e.clock_in, e.clock_out)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[12px] text-slate-500">
                <span>{e.date}</span>
                <ModePill mode={e.mode} />
              </div>
              {e.quick_clockout_reason && (
                <div className="mt-2 rounded-xl bg-[#FFF4D6] px-3 py-2 text-[12px] text-[#8A5A00] break-words">
                  <span className="font-bold">Quick clock-out:</span> {e.quick_clockout_reason}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Desktop: table */}
      {filtered.length > 0 && (
        <div className="hidden md:block overflow-auto max-h-[560px]">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-[#F6F4FF] text-slate-600 text-left">
              <tr>
                <th className="p-3 pl-5 font-semibold">Employee</th>
                <th className="p-3 font-semibold">Date</th>
                <th className="p-3 font-semibold">Clock in</th>
                <th className="p-3 font-semibold">Clock out</th>
                <th className="p-3 font-semibold">Total hours</th>
                <th className="p-3 font-semibold">Mode</th>
                <th className="p-3 font-semibold">Notes</th>
                <th className="p-3 pr-5 font-semibold">Admin actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className={`border-t border-[#EEEAFF] hover:bg-[#FAF9FF] ${e.date === today ? 'bg-[#FAF9FF]' : ''}`}>
                  <td className="p-3 pl-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 shrink-0 rounded-full bg-[#EEEAFF] text-[#4B2BF0] grid place-items-center text-[12px] font-bold">{initials(e.employee?.full_name)}</div>
                      <div>
                        <div className="font-semibold text-[#14102B]">{e.employee?.full_name || String(e.employee_id).slice(0, 8)}</div>
                        <div className="text-[12px] text-slate-500">{e.employee?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 tabular-nums">{e.date}</td>
                  <td className="p-3 tabular-nums">{e.clock_in ? fullTime(e.clock_in) : '—'}</td>
                  <td className="p-3 tabular-nums">{e.clock_out ? fullTime(e.clock_out) : <Ongoing />}</td>
                  <td className="p-3 font-semibold text-[#14102B] tabular-nums">{calculateTotalHours(e.clock_in, e.clock_out)}</td>
                  <td className="p-3"><ModePill mode={e.mode} /></td>
                  <td className="p-3 max-w-[240px]">
                    {e.quick_clockout_reason ? (
                      <span title={`Quick clock-out: ${e.quick_clockout_reason}`} className="block truncate rounded-lg bg-[#FFF4D6] px-2.5 py-1 text-[12px] font-medium text-[#8A5A00]">
                        {e.quick_clockout_reason}
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="p-3 pr-5"><button onClick={() => openActions(e)} className={btnOpen}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Admin actions popup (bottom sheet on phones, dialog on larger screens) ===== */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-[#14102B]/55 backdrop-blur-sm" onClick={closeActions} />
          <div role="dialog" aria-modal="true" aria-label="Admin actions" className="relative bg-white w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 p-5 pb-4 border-b border-[#EEEAFF] flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 shrink-0 rounded-full bg-[#4B2BF0] text-white grid place-items-center text-[13px] font-bold">{initials(selected.employee?.full_name)}</div>
                <div className="min-w-0">
                  <h3 className={`${display.className} text-[18px] font-extrabold text-[#14102B] leading-tight`}>Admin actions</h3>
                  <div className="text-[12px] text-slate-500 truncate">{name} · {selected.date}</div>
                </div>
              </div>
              <button onClick={closeActions} disabled={busy} className={iconClose} aria-label="Close">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-xl bg-[#F6F4FF] p-2.5">
                  <div className="text-slate-500">Clock in</div>
                  <div className="mt-0.5 font-semibold text-[#14102B] tabular-nums">{selected.clock_in ? fullTime(selected.clock_in) : '—'}</div>
                </div>
                <div className="rounded-xl bg-[#F6F4FF] p-2.5">
                  <div className="text-slate-500">Clock out</div>
                  <div className="mt-0.5 font-semibold text-[#14102B] tabular-nums">{selected.clock_out ? fullTime(selected.clock_out) : <Ongoing />}</div>
                </div>
              </div>

              {selected.quick_clockout_reason && (
                <div className="rounded-xl bg-[#FFF4D6] px-3 py-2 text-[12px] text-[#8A5A00] break-words">
                  <span className="font-bold">Quick clock-out reason:</span> {selected.quick_clockout_reason}
                </div>
              )}

              {view === 'menu' && (
                <div className="space-y-2.5">
                  <button onClick={() => { setClockIn(toManilaInput(selected.clock_in)); setClockOut(toManilaInput(selected.clock_out)); goto('edit') }}
                    className="w-full text-left rounded-2xl border-2 border-[#E4DFFA] p-4 hover:border-[#4B2BF0] hover:bg-[#FAF9FF] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/20">
                    <div className="font-semibold text-[14px] text-[#14102B]">Edit clock in / out</div>
                    <div className="text-[12px] text-slate-500 mt-0.5">Correct the recorded times for this shift.</div>
                  </button>
                  <button onClick={() => goto('force')} disabled={!!selected.clock_out}
                    className="w-full text-left rounded-2xl border-2 border-[#E4DFFA] p-4 hover:border-[#FF5A4E] hover:bg-[#FFF8F7] transition disabled:opacity-50 disabled:hover:border-[#E4DFFA] disabled:hover:bg-transparent disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5A4E]/25">
                    <div className="font-semibold text-[14px] text-[#14102B]">Force clock out</div>
                    <div className="text-[12px] text-slate-500 mt-0.5">{selected.clock_out ? 'Already clocked out.' : 'End this open shift right now.'}</div>
                  </button>
                  <button onClick={() => goto('delete')}
                    className="w-full text-left rounded-2xl border-2 border-[#FFC9C2] bg-[#FFF1EF] p-4 hover:bg-[#FFE1DD] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#B42318]/25">
                    <div className="font-semibold text-[14px] text-[#B42318]">Delete record</div>
                    <div className="text-[12px] text-[#B42318]/80 mt-0.5">Permanently remove this time record.</div>
                  </button>
                </div>
              )}

              {view === 'edit' && (
                <div className="space-y-3">
                  <Field label="Clock in (Manila time)">
                    <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className={fieldInput} />
                  </Field>
                  <Field label="Clock out (Manila time)">
                    <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className={fieldInput} />
                  </Field>
                  {!selected.clock_out && <p className="text-[12px] text-slate-500 -mt-1">Leave clock out empty to keep the shift open.</p>}
                  <Field label="Reason (optional)">
                    <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Forgot to clock out" className={fieldInput} />
                  </Field>
                </div>
              )}

              {view === 'force' && (
                <div className="space-y-3">
                  <p className="text-[14px] text-[#14102B]">Clock out <span className="font-semibold">{name}</span> now? The current time will be recorded as their clock out.</p>
                  <Field label="Reason (optional)">
                    <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Left without clocking out" className={fieldInput} />
                  </Field>
                </div>
              )}

              {view === 'delete' && (
                <div className="space-y-3">
                  <p className="text-[14px] text-[#B42318] bg-[#FFF1EF] border border-[#FFC9C2] rounded-2xl p-3">
                    This permanently deletes {name}&apos;s record for {selected.date}. This can&apos;t be undone, but the deletion will be logged.
                  </p>
                  <Field label="Reason (optional)">
                    <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Duplicate entry" className={fieldInput} />
                  </Field>
                </div>
              )}

              {err && <div role="alert" className="text-[13px] text-[#B42318] bg-[#FFF1EF] border border-[#FFC9C2] p-3 rounded-2xl">{err}</div>}

              {view !== 'menu' && (
                <>
                  <p className="text-[11px] text-slate-400">This change is recorded in the admin changes log with the current date and time.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => goto('menu')} disabled={busy} className={btnGhost}>Back</button>
                    {view === 'edit' && <button onClick={saveEdit} disabled={busy} className={btnViolet}>{busy ? 'Saving...' : 'Save changes'}</button>}
                    {view === 'force' && <button onClick={() => submit(() => forceClockOut(String(selected.id), reason))} disabled={busy} className={btnPrimary}>{busy ? 'Clocking out...' : 'Force clock out'}</button>}
                    {view === 'delete' && <button onClick={() => submit(() => deleteTimeEntry(String(selected.id), reason))} disabled={busy} className={btnDanger}>{busy ? 'Deleting...' : 'Delete record'}</button>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
