'use client'
import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
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

type FilterValues = {
  q: string
  year: string
  month: string
  day: string
}

type RecordsData = {
  entries: Entry[]
  totalCount: number
  pageCount: number
  error: string | null
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DEFAULT_SIZE = 100
const SEARCH_DELAY_MS = 200
const NO_FILTERS: FilterValues = { q: '', year: '', month: '', day: '' }

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
// One formatter for the whole list. Creating a new one per cell (toLocaleTimeString) is slow with hundreds of rows.
const timeFmt = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true })
const shortTime = (iso: string) => timeFmt.format(new Date(iso))

function formatRecordDate(date: string): string {
  const [year, month, day] = date.split('-')
  const monthName = MONTHS[Number(month) - 1]?.slice(0, 3)
  return year && monthName && day ? `${day}-${monthName}-${year}` : date
}

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

// Keep the address bar in step with the filters so the page can be refreshed or shared,
// without asking the server to re-render the whole admin page.
function syncUrl(f: FilterValues, page: number, size: number) {
  const params = new URLSearchParams()
  if (f.q) params.set('q', f.q)
  if (f.year) params.set('year', f.year)
  if (f.month) params.set('month', f.month)
  if (f.day) params.set('day', f.day)
  if (page > 1) params.set('page', String(page))
  if (size !== DEFAULT_SIZE) params.set('size', String(size))
  const qs = params.toString()
  window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
}

// Render only the layout that is on screen (the old code rendered every row twice and hid one with CSS).
// Matches Tailwind's md breakpoint.
function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia('(min-width: 768px)')
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia('(min-width: 768px)').matches,
    () => true
  )
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

type RowProps = { e: Entry; today: string; onOpen: (e: Entry) => void }

// Memoized rows: typing in the search box or opening a popup doesn't re-render hundreds of unchanged rows.
const MobileRow = memo(function MobileRow({ e, today, onOpen }: RowProps) {
  return (
    <li className={`p-4 ${e.date === today ? 'bg-[#FAF9FF]' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-full bg-[#EEEAFF] text-[#4B2BF0] grid place-items-center text-[13px] font-bold">{initials(e.employee?.full_name)}</div>
          <div className="min-w-0">
            <div className="font-semibold text-[14px] text-[#14102B] truncate">{e.employee?.full_name || String(e.employee_id).slice(0, 8)}</div>
            <div className="text-[12px] text-slate-500 truncate">{e.employee?.email}</div>
          </div>
        </div>
        <button onClick={() => onOpen(e)} className={btnOpen}>Open</button>
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
        <span>{formatRecordDate(e.date)}</span>
        <ModePill mode={e.mode} />
      </div>
      {e.quick_clockout_reason && (
        <div className="mt-2 rounded-xl bg-[#FFF4D6] px-3 py-2 text-[12px] text-[#8A5A00] break-words">
          <span className="font-bold">Quick clock-out:</span> {e.quick_clockout_reason}
        </div>
      )}
    </li>
  )
})

const DesktopRow = memo(function DesktopRow({ e, today, onOpen }: RowProps) {
  return (
    <tr className={`border-t border-[#EEEAFF] hover:bg-[#FAF9FF] ${e.date === today ? 'bg-[#FAF9FF]' : ''}`}>
      <td className="p-3 pl-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 rounded-full bg-[#EEEAFF] text-[#4B2BF0] grid place-items-center text-[12px] font-bold">{initials(e.employee?.full_name)}</div>
          <div>
            <div className="font-semibold text-[#14102B]">{e.employee?.full_name || String(e.employee_id).slice(0, 8)}</div>
            <div className="text-[12px] text-slate-500">{e.employee?.email}</div>
          </div>
        </div>
      </td>
      <td className="p-3 tabular-nums">{formatRecordDate(e.date)}</td>
      <td className="p-3 tabular-nums">{e.clock_in ? shortTime(e.clock_in) : '—'}</td>
      <td className="p-3 tabular-nums">{e.clock_out ? shortTime(e.clock_out) : <Ongoing />}</td>
      <td className="p-3 font-semibold text-[#14102B] tabular-nums">{calculateTotalHours(e.clock_in, e.clock_out)}</td>
      <td className="p-3"><ModePill mode={e.mode} /></td>
      <td className="p-3 max-w-[240px]">
        {e.quick_clockout_reason ? (
          <span title={`Quick clock-out: ${e.quick_clockout_reason}`} className="block truncate rounded-lg bg-[#FFF4D6] px-2.5 py-1 text-[12px] font-medium text-[#8A5A00]">
            {e.quick_clockout_reason}
          </span>
        ) : <span className="text-slate-400">—</span>}
      </td>
      <td className="p-3 pr-5"><button onClick={() => onOpen(e)} className={btnOpen}>Open</button></td>
    </tr>
  )
})

export default function TimeRecords({
  entries: initialEntries,
  today,
  errorMessage,
  limit: initialSize,
  page: initialPage,
  pageCount: initialPageCount,
  totalCount: initialTotal,
  years,
  filters: initialFilters,
}: {
  entries: Entry[]
  today: string
  errorMessage?: string | null
  limit: number
  page: number
  pageCount: number
  totalCount: number
  years: string[]
  filters: FilterValues
}) {
  const router = useRouter()
  const isDesktop = useIsDesktop()

  // The server renders the first page. From then on the filters live here and results come from the API.
  const [applied, setApplied] = useState<FilterValues>(initialFilters)
  const [searchText, setSearchText] = useState(initialFilters.q)
  const [pageNo, setPageNo] = useState(initialPage)
  const [size, setSize] = useState(initialSize)
  const [data, setData] = useState<RecordsData>({
    entries: initialEntries,
    totalCount: initialTotal,
    pageCount: initialPageCount,
    error: errorMessage ?? null,
  })
  const [loading, setLoading] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const key = JSON.stringify([applied, pageNo, size])
  const loadedKey = useRef(key)
  const latest = useRef({ applied, pageNo, size })
  latest.current = { applied, pageNo, size }

  // Fetch one page. A newer request cancels the one still in flight, so a slow old answer can never
  // overwrite a newer one, and the server stops working on results nobody will see.
  const load = useCallback(async (f: FilterValues, p: number, s: number) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f.q) params.set('q', f.q)
      if (f.year) params.set('year', f.year)
      if (f.month) params.set('month', f.month)
      if (f.day) params.set('day', f.day)
      params.set('page', String(p))
      params.set('size', String(s))
      const res = await fetch(`/api/admin/time-records?${params}`, { signal: ctrl.signal, cache: 'no-store' })
      if (!res.ok) throw new Error(res.status === 401 ? 'Your session has expired. Please sign in again.' : 'Search failed. Please try again.')
      const d = await res.json()
      if (ctrl.signal.aborted) return
      setData({ entries: d.entries ?? [], totalCount: d.totalCount ?? 0, pageCount: d.pageCount ?? 1, error: d.error ?? null })
      if (typeof d.page === 'number' && d.page !== p) {
        // The server moved us to the last page that exists
        loadedKey.current = JSON.stringify([f, d.page, s])
        setPageNo(d.page)
        syncUrl(f, d.page, s)
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setData((prev) => ({ ...prev, error: e?.message || 'Search failed. Please try again.' }))
    } finally {
      if (abortRef.current === ctrl) setLoading(false)
    }
  }, [])

  // Cancel anything still running when the page is left
  useEffect(() => () => abortRef.current?.abort(), [])

  // Typing: wait a moment after the last keystroke, then search. (Enter searches immediately.)
  useEffect(() => {
    const value = searchText.trim()
    if (value === applied.q) return
    const timer = window.setTimeout(() => {
      setApplied((f) => ({ ...f, q: value }))
      setPageNo(1)
    }, SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [searchText, applied.q])

  // Any change to the filters, page or page size fetches new results
  useEffect(() => {
    if (key === loadedKey.current) return
    loadedKey.current = key
    syncUrl(applied, pageNo, size)
    load(applied, pageNo, size)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const reload = useCallback(() => {
    const { applied: f, pageNo: p, size: s } = latest.current
    load(f, p, s)
  }, [load])

  const filtersActive = !!(applied.q || applied.year || applied.month || applied.day)

  const clearFilters = () => {
    setSearchText('')
    setApplied(NO_FILTERS)
    setPageNo(1)
  }

  const onFilterChange = (name: keyof FilterValues, value: string) => {
    setApplied((f) => ({ ...f, [name]: value }))
    setPageNo(1)
  }

  const onSearchKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key !== 'Enter') return
    const value = searchText.trim()
    if (value !== applied.q) {
      setApplied((f) => ({ ...f, q: value }))
      setPageNo(1)
    }
  }

  const onPageSizeChange = (next: string) => {
    setSize(Number(next))
    setPageNo(1)
  }

  // ---- admin actions popup ----
  const [selected, setSelected] = useState<Entry | null>(null)
  const [view, setView] = useState<View>('menu')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const openActions = useCallback((e: Entry) => {
    setSelected(e); setView('menu'); setReason(''); setErr('')
    setClockIn(toManilaInput(e.clock_in)); setClockOut(toManilaInput(e.clock_out))
  }, [])
  const closeActions = () => { if (!busy) setSelected(null) }
  const goto = (v: View) => { setView(v); setErr(''); setReason('') }

  const submit = async (fn: () => Promise<Result>) => {
    setBusy(true); setErr('')
    try {
      const r = await fn()
      if (r.ok) {
        setSelected(null)
        router.refresh() // stats and the admin changes log
        reload() // the records list (it is no longer part of the server render)
      } else {
        setErr(r.error)
      }
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
    <section className="rounded-[24px] bg-white shadow-sm overflow-hidden" aria-busy={loading}>
      {/* Thin progress bar while a search is running */}
      <div className={`h-0.5 bg-[#4B2BF0] transition-opacity duration-150 ${loading ? 'opacity-100 motion-safe:animate-pulse' : 'opacity-0'}`} aria-hidden />

      <div className="p-4 sm:p-5 border-b border-[#EEEAFF] flex items-center justify-between gap-3">
        <h2 className={`${display.className} text-[18px] sm:text-[20px] font-bold text-[#14102B]`}>Time records</h2>
        <span className="text-[12px] text-slate-500">{size} per page</span>
      </div>

      {/* Filters */}
      <div className="p-4 sm:p-5 border-b border-[#EEEAFF] bg-[#FAF9FF]">
        <div className="grid grid-cols-3 sm:grid-cols-[minmax(0,1fr)_110px_150px_100px] gap-2.5">
          <label className="col-span-3 sm:col-span-1 block">
            <span className="block text-[12px] font-semibold text-slate-600 mb-1">Name</span>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search name or email"
              autoComplete="off"
              spellCheck={false}
              className={filterInput}
            />
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-slate-600 mb-1">Year</span>
            <select value={applied.year} onChange={(e) => onFilterChange('year', e.target.value)} className={filterInput}>
              <option value="">All</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-slate-600 mb-1">Month</span>
            <select value={applied.month} onChange={(e) => onFilterChange('month', e.target.value)} className={filterInput}>
              <option value="">All</option>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-slate-600 mb-1">Day</span>
            <select value={applied.day} onChange={(e) => onFilterChange('day', e.target.value)} className={filterInput}>
              <option value="">All</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => <option key={d} value={d}>{Number(d)}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-slate-500">
          <span>Showing <span className="font-semibold text-[#14102B]">{data.entries.length}</span> of {data.totalCount} records</span>
          {(filtersActive || searchText) && (
            <button onClick={clearFilters} className="font-semibold text-[#4B2BF0] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B2BF0] rounded">
              Clear filters
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-slate-500">
          <span>Page {pageNo} of {data.pageCount}</span>
          <div className="flex items-center gap-2">
            <label htmlFor="records-page-size" className="font-medium">Rows per page</label>
            <select
              id="records-page-size"
              value={size}
              onChange={(event) => onPageSizeChange(event.target.value)}
              className="h-9 rounded-xl border border-[#E4DFFA] bg-white px-2 text-[#14102B] focus:outline-none focus:border-[#4B2BF0]"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
            <button
              type="button"
              disabled={pageNo <= 1}
              onClick={() => setPageNo(pageNo - 1)}
              className="h-9 px-3 rounded-xl border border-[#E4DFFA] bg-white text-[#4B2BF0] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={pageNo >= data.pageCount}
              onClick={() => setPageNo(pageNo + 1)}
              className="h-9 px-3 rounded-xl border border-[#E4DFFA] bg-white text-[#4B2BF0] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {data.error && (
        <div role="alert" className="m-4 text-[13px] text-[#B42318] bg-[#FFF1EF] border border-[#FFC9C2] p-3 rounded-2xl">
          Couldn&apos;t load time records: {data.error}
        </div>
      )}

      {!data.error && data.entries.length === 0 && !loading && (
        <div className="p-10 text-center text-[14px] text-slate-500">
          {filtersActive
            ? 'No time records match these filters.'
            : 'No time records yet. Entries appear here as soon as employees clock in.'}
        </div>
      )}

      {/* Results stay on screen (slightly dimmed) while the next ones load, so the list never flashes empty */}
      <div className={`transition-opacity duration-150 ${loading ? 'opacity-60' : 'opacity-100'}`}>
        {/* Mobile: one card per record */}
        {data.entries.length > 0 && !isDesktop && (
          <ul className="divide-y divide-[#EEEAFF]">
            {data.entries.map((e) => <MobileRow key={e.id} e={e} today={today} onOpen={openActions} />)}
          </ul>
        )}

        {/* Desktop: table */}
        {data.entries.length > 0 && isDesktop && (
          <div className="overflow-auto max-h-[560px]">
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
                {data.entries.map((e) => <DesktopRow key={e.id} e={e} today={today} onOpen={openActions} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                  <div className="text-[12px] text-slate-500 truncate">{name} · {formatRecordDate(selected.date)}</div>
                </div>
              </div>
              <button onClick={closeActions} disabled={busy} className={iconClose} aria-label="Close">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-xl bg-[#F6F4FF] p-2.5">
                  <div className="text-slate-500">Clock in</div>
                  <div className="mt-0.5 font-semibold text-[#14102B] tabular-nums">{selected.clock_in ? shortTime(selected.clock_in) : '—'}</div>
                </div>
                <div className="rounded-xl bg-[#F6F4FF] p-2.5">
                  <div className="text-slate-500">Clock out</div>
                  <div className="mt-0.5 font-semibold text-[#14102B] tabular-nums">{selected.clock_out ? shortTime(selected.clock_out) : <Ongoing />}</div>
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
