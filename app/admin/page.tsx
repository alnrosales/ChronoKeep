import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/employee')

  // Use service client to bypass RLS for admin dashboard - this is intentional for admin
  const adminDb = createServiceClient()

  const { data: employees, error: empErr } = await adminDb.from('profiles').select('*').eq('is_active', true).order('full_name')
  const { data: entries, error: entryErr } = await adminDb.from('time_entries').select('*, profiles!inner(full_name)').order('date', { ascending: false }).limit(100)
  const { data: audit, error: auditErr } = await adminDb.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100)
  const { data: settings } = await adminDb.from('company_settings').select('*').limit(1).single()

  const today = new Date().toISOString().split('T')[0]
  const presentToday = entries?.filter((e: any) => e.date === today).length || 0
  const lateToday = entries?.filter((e: any) => e.date === today && e.status === 'Late').length || 0

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6">
      <div className="max-w-[1280px] mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">C</div>
            <div><div className="font-semibold">ChronoKeep Admin</div><div className="text-[11px] text-slate-500">Production • Service Role • Bypass RLS</div></div>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1.5 rounded-full bg-white border text-[12px]">Present today: {presentToday}</div>
            <div className="px-3 py-1.5 rounded-full bg-amber-50 border-amber-200 border text-[12px] text-amber-800">Late: {lateToday}</div>
            <form action="/auth/signout" method="post"><button className="text-[12px] px-3 py-1.5 rounded-full border bg-white">Sign out</button></form>
          </div>
        </header>

        {(empErr || entryErr) && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-800">
            Debug: empErr={empErr?.message} entryErr={entryErr?.message} — Check SUPABASE_SERVICE_ROLE_KEY env var in Vercel
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white border p-4"><div className="text-[11px] text-slate-500">Employees</div><div className="text-[22px] font-bold">{employees?.length || 0}</div></div>
          <div className="rounded-2xl bg-white border p-4"><div className="text-[11px] text-slate-500">Present Today</div><div className="text-[22px] font-bold">{presentToday}</div></div>
          <div className="rounded-2xl bg-white border p-4"><div className="text-[11px] text-slate-500">Late Today</div><div className="text-[22px] font-bold text-amber-600">{lateToday}</div></div>
          <div className="rounded-2xl bg-white border p-4"><div className="text-[11px] text-slate-500">Total Records</div><div className="text-[22px] font-bold">{entries?.length || 0}</div></div>
        </div>

        <div className="grid lg:grid-cols-[1.6fr_0.9fr] gap-6">
          <div className="rounded-[20px] bg-white border shadow-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center"><div className="font-medium text-[14px]">Time Records (latest 100) - Service Role Bypass</div><div className="text-[11px] text-slate-500">Edits require reason + audit log</div></div>
            <div className="overflow-auto max-h-[560px]">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-slate-50 border-b text-[11px] text-slate-500"><tr><th className="text-left p-2.5 font-medium">Employee</th><th className="text-left p-2.5 font-medium">Date</th><th className="text-left p-2.5 font-medium">In → Out</th><th className="text-left p-2.5 font-medium">Mode</th><th className="text-left p-2.5 font-medium">Status</th></tr></thead>
                <tbody>
                {entries?.map((e: any) => (<tr key={e.id} className="border-b last:border-0 hover:bg-slate-50"><td className="p-2.5">{e.profiles?.full_name || e.employee_id}</td><td className="p-2.5 mono">{e.date}</td><td className="p-2.5 mono">{e.clock_in ? new Date(e.clock_in).toLocaleTimeString() : '—'} → {e.clock_out ? new Date(e.clock_out).toLocaleTimeString() : '—'} {e.is_edited && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px]">Edited</span>}</td><td className="p-2.5">{e.mode}</td><td className="p-2.5">{e.status}</td></tr>))}
                {(!entries || entries.length===0) && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No time entries yet. Run the SQL seed below in Supabase SQL Editor, or login as employee and Clock In.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[20px] bg-white border shadow-sm p-4">
              <div className="font-medium text-[14px]">Audit Log (immutable)</div>
              <div className="mt-3 space-y-2 max-h-[320px] overflow-auto">
                {audit?.map((log: any) => (
                  <div key={log.id} className="p-2.5 rounded-xl border bg-slate-50 text-[11px]">
                    <div className="font-medium">{log.action} • {new Date(log.timestamp).toLocaleString()}</div>
                    <div className="mt-1 mono line-through text-slate-500">{log.old_value || '—'} → <span className="no-underline text-emerald-700">{log.new_value || '—'}</span> [{log.field}]</div>
                    <div className="mt-1 text-slate-600">Reason: {log.reason}</div>
                    <div className="text-[10px] text-slate-400">Actor: {log.actor_name} → {log.employee_name}</div>
                  </div>
                ))}
                {(!audit || audit.length===0) && <div className="text-[12px] text-slate-400">No edits yet — all entries original.</div>}
              </div>
            </div>

            <div className="rounded-[20px] bg-slate-900 text-white p-4">
              <div className="text-[13px] font-medium">Settings</div>
              <div className="mt-2 text-[12px] text-white/70">Start: {settings?.start_time || '09:00'} • Grace: {settings?.grace_minutes || 15}m • Hours/day: {settings?.work_hours_per_day || 8}</div>
              <div className="mt-2 text-[11px] text-white/50">{settings?.late_policy || 'Arrivals after grace period require justification.'}</div>
            </div>

            <div className="rounded-[20px] bg-amber-50 border border-amber-200 p-4">
              <div className="font-medium text-[12px] text-amber-900">⚠️ If still 0 records, run this in Supabase SQL Editor:</div>
              <pre className="mt-2 text-[10px] bg-white p-2 rounded border overflow-auto">
{`insert into time_entries (employee_id, date, clock_in, original_clock_in, mode, status, created_by)
select id, current_date, now(), now(), 'Remote', 'On Time', id
from profiles where role='employee' on conflict do nothing;`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
