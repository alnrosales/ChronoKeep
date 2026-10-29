import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Bricolage_Grotesque } from 'next/font/google'
import SignOutButton from '@/components/signout-button'
import EmployeesManager from '@/components/employees-manager'
import TimeRecords from '@/components/time-records'
import AdminChangesLog from '@/components/admin-changes-log'
import { cleanFilters, getAvailableYears, queryTimeRecords } from '@/lib/time-records-query'

// Always read fresh data. Without this, Next.js can serve cached Supabase responses,
// so a saved change looks reverted after a browser refresh.
export const dynamic = 'force-dynamic'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'] })

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

  // The first page of records is rendered here so the page opens with data (and shareable filters in the URL).
  // After that, searching and filtering goes through /api/admin/time-records without re-rendering this page.
  const filters = cleanFilters({
    q: normalizeValue(searchParams?.q),
    year: normalizeValue(searchParams?.year),
    month: normalizeValue(searchParams?.month),
    day: normalizeValue(searchParams?.day),
  })
  const filtersActive = !!(filters.q || filters.year || filters.month || filters.day)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const adminDb = createServiceClient()

  // All independent queries run at the same time
  const [
    { data: employees },
    { years: availableYears, error: yearsError },
    records,
    { count: allEntriesCount },
    { count: todayEntryCount },
    { data: todayRows },
    { data: logs, error: logErr },
  ] = await Promise.all([
    adminDb.from('profiles').select('*').order('full_name'),
    getAvailableYears(adminDb),
    queryTimeRecords(
      adminDb,
      filters,
      Number(normalizeValue(searchParams?.page) || '1'),
      Number(normalizeValue(searchParams?.size))
    ),
    // With no filters the records query already holds the all-time total, so skip the extra count
    filtersActive
      ? adminDb.from('time_entries').select('id', { count: 'exact', head: true })
      : Promise.resolve({ count: null as number | null }),
    adminDb.from('time_entries').select('id', { count: 'exact', head: true }).eq('date', today),
    adminDb.from('time_entries').select('employee_id').eq('date', today),
    adminDb.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200),
  ])

  const totalEntries = filtersActive ? (allEntriesCount ?? 0) : records.totalCount
  const todayEntries = todayEntryCount ?? 0
  const activeCount = (employees || []).filter((e: any) => e.is_active === true).length
  // Unique employees who clocked in today (shifts today can be higher if someone clocks in twice)
  const presentToday = new Set((todayRows || []).map((r: any) => r.employee_id)).size

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
                {activeCount}<span className="text-slate-300"> / {employees?.length || 0}</span>
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
          entries={records.entries as any}
          today={today}
          errorMessage={records.error ?? yearsError}
          limit={records.pageSize}
          page={records.page}
          pageCount={records.pageCount}
          totalCount={records.totalCount}
          years={availableYears}
          filters={filters}
        />

        {/* Immutable log of every admin change */}
        <AdminChangesLog logs={(logs || []) as any} errorMessage={logErr?.message} />

      </div>
    </div>
  )
}
