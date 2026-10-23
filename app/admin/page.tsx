import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignOutButton from '@/components/signout-button'
import DeleteButton from '@/components/delete-button'
import EmployeesManager from '@/components/employees-manager'

function calculateTotalHours(clockIn?: string | null, clockOut?: string | null): string {
  if (!clockIn || !clockOut) return '—'
  const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  if (diffMs <= 0) return '0.00 hrs'
  const hours = diffMs / (1000 * 60 * 60)
  return `${hours.toFixed(2)} hrs`
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
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6">
      <div className="max-w- mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">C</div>
            <div><div className="font-semibold">ChronoKeep Admin</div><div className="text- text-slate-500">Welcome • {profile?.full_name} • {profile?.email} • {today}</div></div>
          </div>
          <div className="flex gap-2 items-center"><SignOutButton /></div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* CLICKABLE Employees box */}
          <EmployeesManager employees={employees || []} trigger={
            <div className="rounded-2xl bg-white border p-4 hover:border-slate-900 hover:shadow-md cursor-pointer transition-all">
              <div className="text- text-slate-500">Employees • Click to manage</div>
              <div className="text- font-bold">{activeEmployees?.length || 0} / {employees?.length || 0}</div>
              <div className="text- text-slate-400 mt-1">Active / Total</div>
            </div>
          } />
          <div className="rounded-2xl bg-white border p-4"><div className="text- text-slate-500">Present Today</div><div className="text- font-bold">{presentToday}</div></div>
          <div className="rounded-2xl bg-white border p-4"><div className="text- text-slate-500">Shifts Today</div><div className="text- font-bold">{todayEntries.length}</div></div>
          <div className="rounded-2xl bg-white border p-4"><div className="text- text-slate-500">Total Records</div><div className="text- font-bold">{entries?.length || 0}</div></div>
        </div>

        <div className="rounded- bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b"><div className="font-medium text-">Time Records (latest 100)</div></div>
          <div className="overflow-auto max-h-">
            <table className="w-full text-">
              <thead className="sticky top-0 bg-slate-50 border-b text- text-slate-500">
                <tr>
                  <th className="text-left p-2.5">Employee</th>
                  <th className="text-left p-2.5">Date</th>
                  <th className="text-left p-2.5">Clock In</th>
                  <th className="text-left p-2.5">Clock Out</th>
                  <th className="text-left p-2.5">Total Working Hours</th>
                  <th className="text-left p-2.5">Mode</th>
                  <th className="text-left p-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries?.map((e: any) => (
                  <tr key={e.id} className="border-b hover:bg-slate-50">
                    <td className="p-2.5"><div className="font-medium">{e.employee?.full_name || e.employee_id.slice(0,8)}</div><div className="text- text-slate-500">{e.employee?.email}</div></td>
                    <td className="p-2.5">{e.date}</td>
                    <td className="p-2.5 font-mono">{e.clock_in ? new Date(e.clock_in).toLocaleString('en-PH', {timeZone: 'Asia/Manila', hour12: true}) : '—'}</td>
                    <td className="p-2.5 font-mono">{e.clock_out ? new Date(e.clock_out).toLocaleString('en-PH', {timeZone: 'Asia/Manila', hour12: true}) : <span className="text-emerald-600">ONGOING</span>}</td>
                    <td className="p-2.5 font-mono font-medium">{calculateTotalHours(e.clock_in, e.clock_out)}</td>
                    <td className="p-2.5">{e.mode}</td>
                    <td className="p-2.5"><DeleteButton id={e.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}