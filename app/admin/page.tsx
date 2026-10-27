import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Bricolage_Grotesque } from 'next/font/google'
import SignOutButton from '@/components/signout-button'
import EmployeesManager from '@/components/employees-manager'
import TimeRecords from '@/components/time-records'
import AdminChangesLog from '@/components/admin-changes-log'

// Always read fresh data. Without this, Next.js can serve cached Supabase responses,
// so a saved change looks reverted after a browser refresh.
export const dynamic = 'force-dynamic'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'] })

const PAGE_SIZES = [100, 500, 1000] as const
const DEFAULT_PAGE_SIZE = 100

function normalizeValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/employee')

  const q = normalizeValue(searchParams?.q).trim()
  const year = normalizeValue(searchParams?.year)
  const month = normalizeValue(searchParams?.month)
  const day = normalizeValue(searchParams?.day)
  const pageParam = Number(normalizeValue(searchParams?.page) || '1')
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const requestedPageSize = Number(normalizeValue(searchParams?.size))
  const pageSize = PAGE_SIZES.find(size => size === requestedPageSize) ?? DEFAULT_PAGE_SIZE

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const adminDb = createServiceClient()
  const { data: employees } = await adminDb.from('profiles').select('*').order('full_name')
  const { data: activeEmployees } = await adminDb.from('profiles').select('*').eq('is_active', true).order('full_name')

  const [{ data: oldestEntry, error: oldestEntryError }, { data: newestEntry, error: newestEntryError }] = await Promise.all([
    adminDb.from('time_entries').select('date').order('date', { ascending: true }).limit(1).maybeSingle(),
    adminDb.from('time_entries').select('date').order('date', { ascending: false }).limit(1).maybeSingle(),
  ])
  const firstYear = Number(String(oldestEntry?.date ?? today).slice(0, 4))
  const lastYear = Number(String(newestEntry?.date ?? today).slice(0, 4))
  const availableYears = Array.from(
    { length: Math.max(0, lastYear - firstYear + 1) },
    (_, index) => String(lastYear - index)
  )

  const entrySelect = '*, employee:profiles!time_entries_employee_id_fkey!inner(full_name, email)'

  // Applies the year/month/day/name filters to a time_entries query
  const applyEntryFilters = (baseQuery: any) => {
    let query = baseQuery

    if (year && month && day) {
      query = query.eq('date', `${year}-${month}-${day}`)
    } else if (year && month) {
      const lastDay = new Date(Number(year), Number(month), 0).getDate()
      query = query.gte('date', `${year}-${month}-01`).lte('date', `${year}-${month}-${lastDay}`)
    } else if (year) {
      query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
    } else if (month || day) {
      const dateFilters = availableYears.flatMap((availableYear) => {
        if (month && day) return [`date.eq.${availableYear}-${month}-${day}`]
        if (month) {
          const lastDay = new Date(Number(availableYear), Number(month), 0).getDate()
          return [`and(date.gte.${availableYear}-${month}-01,date.lte.${availableYear}-${month}-${lastDay})`]
        }
        return Array.from({ length: 12 }, (_, index) => {
          const monthValue = String(index + 1).padStart(2, '0')
          return `date.eq.${availableYear}-${monthValue}-${day}`
        })
      })
      if (dateFilters.length) query = query.or(dateFilters.join(','))
      else query = query.eq('date', '0001-01-01')
    }
    if (q) {
      const pattern = `"%${q.replace(/["\\]/g, '\\$&')}%"`
      query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`, { referencedTable: 'employee' })
    }

    return query
  }

  // countOnly = true asks the database for just the number of matching rows (no row data)
  const buildEntryQuery = (countOnly = false) =>
    applyEntryFilters(
      adminDb
        .from('time_entries')
        .select(entrySelect, countOnly ? { count: 'exact', head: true } : undefined)
        .order('clock_in', { ascending: false })
    )

  const [
    { count: filteredEntriesCount },
    { count: allEntriesCount },
    { count: todayEntryCount },
    { data: todayRows },
  ] = await Promise.all([
    buildEntryQuery(true),
    adminDb.from('time_entries').select('id', { count: 'exact', head: true }),
    adminDb.from('time_entries').select('id', { count: 'exact', head: true }).eq('date', today),
    adminDb.from('time_entries').select('employee_id').eq('date', today),
  ])
  const filteredEntries = filteredEntriesCount ?? 0
  const totalEntries = allEntriesCount ?? 0
  const todayEntries = todayEntryCount ?? 0
  // Unique employees who clocked in today (shifts today can be higher if someone clocks in twice)
  const presentToday = new Set((todayRows || []).map((r: any) => r.employee_id)).size
  const totalPages = Math.max(1, Math.ceil(filteredEntries / pageSize))
  const currentPage = Math.min(page, totalPages)
  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1
  const { data: entries, error: entryErr } = await buildEntryQuery().range(from, to)

  const { data: logs, error: logErr } = await adminDb
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const todayParts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Manila',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date())
  const todayDisplay = `${todayParts.find(part => part.type === 'day')?.value}-${todayParts.find(part => part.type === 'month')?.value}-${todayParts.find(part => part.type === 'year')?.value}`

  return (
    <div className="min-h-screen bg-[#EEEAFF] p-3 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">

        {/* Header */}
        <header className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] bg-[#4B2BF0] text-white p-4 sm:p-6 shadow-[0_24px_60px_-24px_rgba(60,30,200,0.6)]">
          <div className="absolute -right-16 -top-20 w-[200px] h-[200px] rounded-full bg-[#FF5A4E]" aria-hidden />
          <div className="absolute right-24 -bottom-16 w-[120px] h-[120px] rounded-full bg-[#7A5CFF]" aria-hidden />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-white text-[#4B2BF0] grid place-items-center font-extrabold">C</div>
              <div className="min-w-0">
                <div className={`${display.className} font-bold text-lg sm:text-xl leading-tight`}>ChronoKeep Admin</div>
                <div className="text-[12px] sm:text-[13px] text-white/80 truncate">Welcome {profile?.full_name} · {todayDisplay}</div>
              </div>
            </div>
            <div className="shrink-0"><SignOutButton /></div>
          </div>
          <div className="relative mt-4 sm:mt-6">
            <h1 className={`${display.className} text-[24px] sm:text-[32px] font-extrabold leading-tight`}>
              {presentToday} {presentToday === 1 ? 'person has' : 'people have'} clocked in today.
            </h1>
            <div className="mt-1 text-[13px] text-white/80 truncate">{profile?.email}</div>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <EmployeesManager employees={employees || []} trigger={
            <div className="h-full rounded-[20px] bg-white border-2 border-transparent p-4 sm:p-5 shadow-sm hover:border-[#4B2BF0] hover:shadow-lg cursor-pointer transition">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#14102B]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4B2BF0]" aria-hidden /> Employees
              </div>
              <div className={`${display.className} mt-2 text-[32px] sm:text-[40px] font-extrabold leading-none text-[#14102B] tabular-nums`}>
                {activeEmployees?.length || 0}<span className="text-slate-300"> / {employees?.length || 0}</span>
              </div>
              <div className="mt-2 text-[12px] text-slate-500">Active of total · tap to manage</div>
            </div>
          } />
          <div className="rounded-[20px] bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#14102B]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2EE6A6]" aria-hidden /> Present today
            </div>
            <div className={`${display.className} mt-2 text-[32px] sm:text-[40px] font-extrabold leading-none text-[#14102B] tabular-nums`}>{presentToday}</div>
            <div className="mt-2 text-[12px] text-slate-500">Unique employees</div>
          </div>
          <div className="rounded-[20px] bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#14102B]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFC83D]" aria-hidden /> Shifts today
            </div>
            <div className={`${display.className} mt-2 text-[32px] sm:text-[40px] font-extrabold leading-none text-[#14102B] tabular-nums`}>{todayEntries}</div>
            <div className="mt-2 text-[12px] text-slate-500">Clock-ins recorded</div>
          </div>
          <div className="rounded-[20px] bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#14102B]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A4E]" aria-hidden /> Total records
            </div>
            <div className={`${display.className} mt-2 text-[32px] sm:text-[40px] font-extrabold leading-none text-[#14102B] tabular-nums`}>{totalEntries}</div>
            <div className="mt-2 text-[12px] text-slate-500">All time entries</div>
          </div>
        </div>

        {/* Time records: filters, table and admin actions */}
        <TimeRecords
          entries={(entries || []) as any}
          today={today}
        errorMessage={entryErr?.message ?? oldestEntryError?.message ?? newestEntryError?.message}
          limit={pageSize}
          page={currentPage}
          pageCount={totalPages}
          totalCount={filteredEntries}
        years={availableYears}
        filters={{ q, year, month, day }}
        />

        {/* Immutable log of every admin change */}
        <AdminChangesLog logs={(logs || []) as any} errorMessage={logErr?.message} />

      </div>
    </div>
  )
}