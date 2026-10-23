import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/employee')
  const adminDb = createServiceClient()
  const { data: employees } = await adminDb.from('profiles').select('*').eq('is_active', true).order('full_name')
  const { data: entries } = await adminDb.from('time_entries').select('*, profiles!inner(full_name)').order('date', { ascending: false }).limit(100)
  const { data: audit } = await adminDb.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100)
  const { data: settings } = await adminDb.from('company_settings').select('*').limit(1).single()
  const today = new Date().toISOString().split('T')[0]
  const presentToday = entries?.filter((e: any) => e.date === today).length || 0
  const lateToday = entries?.filter((e: any) => e.date === today && e.status === 'Late').length || 0
  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6">
      <div className="max-w-[1280px] mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">C</div><div><div className="font-semibold">ChronoKeep Admin</div><div className="text-[11px] text-slate-500">CLEAN BUILD • Service Role • FIXED • {today}</div></div></div>
          <div className="flex gap-2"><div className="px-3 py-1.5 rounded-full bg-white border text-[12px]">Present: {presentToday}</div><form action="/auth/signout" method="post"><button className="text-[12px] px-3 py-1.5 rounded-full border bg-white">Sign out</button></form></div>
        </header>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white border p-4"><div className="text-[11px] text-slate-500">Employees</div><div className="text-[22px] font-bold">{employees?.length || 0}</div></div>
          <div className="rounded-2xl bg-white border p-4"><div className="text-[11px] text-slate-500">Present Today</div><div className="text-[22px] font-bold">{presentToday}</div></div>
          <div className="rounded-2xl bg-white border p-4"><div className="text-[11px] text-slate-500">Late Today</div><div className="text-[22px] font-bold text-amber-600">{lateToday}</div></div>
          <div className="rounded-2xl bg-white border p-4"><div className="text-[11px] text-slate-500">Total Records</div><div className="text-[22px] font-bold">{entries?.length || 0}</div></div>
        </div>
        <div className="rounded-[20px] bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b"><div className="font-medium text-[14px]">Time Records (latest 100)</div></div>
          <div className="overflow-auto max-h-[560px]">
            <table className="w-full text-[12px]"><thead className="sticky top-0 bg-slate-50 border-b text-[11px] text-slate-500"><tr><th className="text-left p-2.5">Employee</th><th className="text-left p-2.5">Date</th><th className="text-left p-2.5">In → Out</th><th className="text-left p-2.5">Mode</th><th className="text-left p-2.5">Status</th></tr></thead>
              <tbody>{entries?.map((e: any) => (<tr key={e.id} className="border-b"><td className="p-2.5">{e.profiles?.full_name}</td><td className="p-2.5">{e.date}</td><td className="p-2.5">{e.clock_in ? new Date(e.clock_in).toLocaleTimeString() : '—'} → {e.clock_out ? new Date(e.clock_out).toLocaleTimeString() : '—'}</td><td className="p-2.5">{e.mode}</td><td className="p-2.5">{e.status}</td></tr>))}{(!entries || entries.length===0) && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No records yet — you have {employees?.length} employees. Run seed SQL.</td></tr>}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
