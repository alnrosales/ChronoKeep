import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Bricolage_Grotesque } from 'next/font/google'
import SignOutButton from '@/components/signout-button'
import DeleteButton from '@/components/delete-button'
import EmployeesManager from '@/components/employees-manager'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'] })

function calculateTotalHours(clockIn?: string | null, clockOut?: string | null): string {
  if (!clockIn || !clockOut) return '—'
  const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  if (diffMs <= 0) return '0.00 hrs'
  const hours = diffMs / (1000 * 60 * 60)
  return `${hours.toFixed(2)} hrs`
}

const fullTime = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour12: true })

const shortTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true })

const initials = (name?: string | null) =>
  (name || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'

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
  return (
    <span className="inline-flex rounded-full bg-[#EEEAFF] text-[#4B2BF0] px-2.5 py-1 text-[12px] font-semibold">
      {mode}
    </span>
  )
}

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
    .limit(100)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
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
                <div className="text-[12px] sm:text-[13px] text-white/80 truncate">{profile?.full_name} · {today}</div>
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
            <div className="mt-2 text-[12px] text-slate-500">Latest 100 shown</div>
          </div>
        </div>

        {/* Time records */}
        <section className="rounded-[24px] bg-white shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#EEEAFF] flex items-center justify-between gap-3">
            <h2 className={`${display.className} text-[18px] sm:text-[20px] font-bold text-[#14102B]`}>Time records</h2>
            <span className="text-[12px] text-slate-500">Latest 100 · Manila time</span>
          </div>

          {entryErr && (
            <div role="alert" className="m-4 text-[13px] text-[#B42318] bg-[#FFF1EF] border border-[#FFC9C2] p-3 rounded-2xl">
              Couldn&apos;t load time records: {entryErr.message}
            </div>
          )}

          {!entryErr && (!entries || entries.length === 0) && (
            <div className="p-10 text-center text-[14px] text-slate-500">
              No time records yet. Entries appear here as soon as employees clock in.
            </div>
          )}

          {/* Mobile: one card per record */}
          {entries && entries.length > 0 && (
            <ul className="md:hidden divide-y divide-[#EEEAFF]">
              {entries.map((e: any) => (
                <li key={e.id} className={`p-4 ${e.date === today ? 'bg-[#FAF9FF]' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 shrink-0 rounded-full bg-[#EEEAFF] text-[#4B2BF0] grid place-items-center text-[13px] font-bold">
                        {initials(e.employee?.full_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] text-[#14102B] truncate">{e.employee?.full_name || e.employee_id.slice(0, 8)}</div>
                        <div className="text-[12px] text-slate-500 truncate">{e.employee?.email}</div>
                      </div>
                    </div>
                    <DeleteButton id={e.id} />
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
                </li>
              ))}
            </ul>
          )}

          {/* Desktop: table */}
          {entries && entries.length > 0 && (
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
                    <th className="p-3 pr-5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e: any) => (
                    <tr key={e.id} className={`border-t border-[#EEEAFF] hover:bg-[#FAF9FF] ${e.date === today ? 'bg-[#FAF9FF]' : ''}`}>
                      <td className="p-3 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 shrink-0 rounded-full bg-[#EEEAFF] text-[#4B2BF0] grid place-items-center text-[12px] font-bold">
                            {initials(e.employee?.full_name)}
                          </div>
                          <div>
                            <div className="font-semibold text-[#14102B]">{e.employee?.full_name || e.employee_id.slice(0, 8)}</div>
                            <div className="text-[12px] text-slate-500">{e.employee?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 tabular-nums">{e.date}</td>
                      <td className="p-3 tabular-nums">{e.clock_in ? fullTime(e.clock_in) : '—'}</td>
                      <td className="p-3 tabular-nums">{e.clock_out ? fullTime(e.clock_out) : <Ongoing />}</td>
                      <td className="p-3 font-semibold text-[#14102B] tabular-nums">{calculateTotalHours(e.clock_in, e.clock_out)}</td>
                      <td className="p-3"><ModePill mode={e.mode} /></td>
                      <td className="p-3 pr-5"><DeleteButton id={e.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
