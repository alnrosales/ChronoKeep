import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Bricolage_Grotesque } from 'next/font/google'
import SignOutButton from '@/components/signout-button'
import EmployeesManager from '@/components/employees-manager'
import TimeRecords from '@/components/time-records'
import AdminChangesLog from '@/components/admin-changes-log'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'] })

const RECORD_LIMIT = 1000

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/employee')

  const adminDb = createServiceClient()
  const { data: employees } = await adminDb.from('profiles').select('*').order('full_name')
  const { data: activeEmployees } = await adminDb.from('profiles').select('*').eq('is_active', true).order('full_name')
  const { data: entries, error: entryErr } = await adminDb
    .from('time_entries')
    .select('*, employee:profiles!time_entries_employee_id_fkey(full_name, email)')
    .order('clock_in', { ascending: false })
    .limit(RECORD_LIMIT)

  const { data: logs, error: logErr } = await adminDb
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const todayLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())
  const todayEntries = entries?.filter((e: any) => e.date === today) || []
  const presentToday = new Set(todayEntries.map((e: any) => e.employee_id)).size

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
                <div className="text-[12px] sm:text-[13px] text-white/80 truncate">{profile?.full_name} · {todayLabel}</div>
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
            <div className={`${display.className} mt-2 text-[32px] sm:text-[40px] font-extrabold leading-none text-[#14102B] tabular-nums`}>{todayEntries.length}</div>
            <div className="mt-2 text-[12px] text-slate-500">Clock-ins recorded</div>
          </div>
          <div className="rounded-[20px] bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#14102B]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A4E]" aria-hidden /> Total records
            </div>
            <div className={`${display.className} mt-2 text-[32px] sm:text-[40px] font-extrabold leading-none text-[#14102B] tabular-nums`}>{entries?.length || 0}</div>
            <div className="mt-2 text-[12px] text-slate-500">Latest {RECORD_LIMIT} loaded</div>
          </div>
        </div>

        {/* Time records: filters, table and admin actions */}
        <TimeRecords entries={(entries || []) as any} today={today} errorMessage={entryErr?.message} limit={RECORD_LIMIT} />

        {/* Immutable log of every admin change */}
        <AdminChangesLog logs={(logs || []) as any} errorMessage={logErr?.message} />

      </div>
    </div>
  )
}