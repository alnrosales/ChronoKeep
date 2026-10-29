// Server-side query for the admin Time records list.
// Used by app/admin/page.tsx (first render) and app/api/admin/time-records/route.ts (search as you type).
// Never import this from a client component: the browser gets the data through the API route.
import type { createServiceClient } from '@/lib/supabase/server'

type Db = ReturnType<typeof createServiceClient>

export const PAGE_SIZES = [100, 500, 1000] as const
export const DEFAULT_PAGE_SIZE = 100

export type RecordFilters = { q: string; year: string; month: string; day: string }

export type RecordsResult = {
  entries: any[]
  totalCount: number
  page: number
  pageCount: number
  pageSize: number
  error: string | null
}

// Without a search the employee is a plain (left) join. With a search it becomes an inner join so the
// name/email filter can drop rows.
const SELECT_PLAIN = '*, employee:profiles!time_entries_employee_id_fkey(full_name, email)'
const SELECT_SEARCH = '*, employee:profiles!time_entries_employee_id_fkey!inner(full_name, email)'

const pad2 = (n: number) => String(n).padStart(2, '0')

// Everything here ends up inside a PostgREST filter string, so it is validated strictly.
export function cleanFilters(raw: { q?: unknown; year?: unknown; month?: unknown; day?: unknown }): RecordFilters {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const year = s(raw.year)
  const month = s(raw.month)
  const day = s(raw.day)
  return {
    q: s(raw.q).slice(0, 100),
    year: /^\d{4}$/.test(year) ? year : '',
    month: /^(0[1-9]|1[0-2])$/.test(month) ? month : '',
    day: /^(0[1-9]|[12]\d|3[01])$/.test(day) ? day : '',
  }
}

export const cleanPage = (n: number) => (Number.isInteger(n) && n > 0 ? n : 1)
export const cleanSize = (n: number) => PAGE_SIZES.find((size) => size === n) ?? DEFAULT_PAGE_SIZE

// Years that have records, newest first (for the Year dropdown and the month/day-only filters).
export async function getAvailableYears(db: Db): Promise<{ years: string[]; error: string | null }> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const [oldest, newest] = await Promise.all([
    db.from('time_entries').select('date').order('date', { ascending: true }).limit(1).maybeSingle(),
    db.from('time_entries').select('date').order('date', { ascending: false }).limit(1).maybeSingle(),
  ])
  const first = Number(String(oldest.data?.date ?? today).slice(0, 4))
  const last = Number(String(newest.data?.date ?? today).slice(0, 4))
  return {
    years: Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => String(last - i)),
    error: oldest.error?.message ?? newest.error?.message ?? null,
  }
}

function applyFilters(baseQuery: any, f: RecordFilters, years: string[]) {
  let query = baseQuery
  const { q, year, month, day } = f

  if (year && month && day) {
    query = query.eq('date', `${year}-${month}-${day}`)
  } else if (year && month) {
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    query = query.gte('date', `${year}-${month}-01`).lte('date', `${year}-${month}-${pad2(lastDay)}`)
  } else if (year && day) {
    // Day of month inside one year (the old code silently ignored the day here)
    query = query.or(Array.from({ length: 12 }, (_, i) => `date.eq.${year}-${pad2(i + 1)}-${day}`).join(','))
  } else if (year) {
    query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
  } else if (month || day) {
    const dateFilters = years.flatMap((y) => {
      if (month && day) return [`date.eq.${y}-${month}-${day}`]
      if (month) {
        const lastDay = new Date(Number(y), Number(month), 0).getDate()
        return [`and(date.gte.${y}-${month}-01,date.lte.${y}-${month}-${pad2(lastDay)})`]
      }
      return Array.from({ length: 12 }, (_, i) => `date.eq.${y}-${pad2(i + 1)}-${day}`)
    })
    query = dateFilters.length ? query.or(dateFilters.join(',')) : query.eq('date', '0001-01-01')
  }

  if (q) {
    const pattern = `"%${q.replace(/["\\]/g, '\\$&')}%"`
    query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`, { referencedTable: 'employee' })
  }
  return query
}

// One request returns both the page of rows and the exact total (count: 'exact' with range()).
export async function queryTimeRecords(
  db: Db,
  rawFilters: Parameters<typeof cleanFilters>[0],
  rawPage: number,
  rawSize: number
): Promise<RecordsResult> {
  const filters = cleanFilters(rawFilters)
  const pageSize = cleanSize(rawSize)
  let page = cleanPage(rawPage)
  const select = filters.q ? SELECT_SEARCH : SELECT_PLAIN

  // Only a month and/or day filter without a year needs the list of years
  const years = !filters.year && (filters.month || filters.day) ? (await getAvailableYears(db)).years : []

  const run = (p: number) => {
    const from = (p - 1) * pageSize
    return applyFilters(
      db.from('time_entries').select(select, { count: 'exact' }).order('clock_in', { ascending: false }),
      filters,
      years
    ).range(from, from + pageSize - 1)
  }

  let { data, count, error } = await run(page)

  // Asked for a page past the end (filters changed, rows deleted): fall back to the last page
  if (error?.code === 'PGRST103') {
    const head = await applyFilters(db.from('time_entries').select(select, { count: 'exact', head: true }), filters, years)
    page = Math.max(1, Math.ceil((head.count ?? 0) / pageSize))
    ;({ data, count, error } = await run(page))
  }

  if (error) return { entries: [], totalCount: 0, page, pageCount: 1, pageSize, error: error.message }

  const totalCount = count ?? (data?.length ?? 0)
  return {
    entries: data ?? [],
    totalCount,
    page,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
    pageSize,
    error: null,
  }
}
