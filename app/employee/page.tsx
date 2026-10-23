import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClockCard from '@/components/clock-card'
import SignOutButton from '@/components/signout-button'

export default async function EmployeePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: settings } = await supabase.from('company_settings').select('*').limit(1).single()
  const { data: openEntry } = await supabase.from('time_entries').select('*').eq('employee_id', user.id).is('clock_out', null).order('clock_in', { ascending: false }).limit(1).maybeSingle()
  const { data: todayEntry } = await supabase.from('time_entries').select('*').eq('employee_id', user.id).eq('date', new Date().toISOString().split('T')[0]).order('clock_in', { ascending: false }).limit(1).maybeSingle()
  const { data: history } = await supabase.from('time_entries').select('*').eq('employee_id', user.id).order('clock_in', { ascending: false }).limit(30)
  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6">
      <div className="max-w-[1100px] mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">C</div>
            <div><div className="font-semibold">ChronoKeep</div><div className="text-[11px] text-slate-500">Employee • {profile?.full_name} • {profile?.email}</div></div>
          </div>
          <SignOutButton />
        </header>
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <ClockCard profile={profile} todayEntry={todayEntry} openEntry={openEntry} settings={settings || { start_time: '09:00', grace_minutes: 15 }} />
          <div className="rounded-[20px] bg-white border shadow-sm p-6">
            <div className="font-medium">My history (30 shifts)</div>
            <div className="mt-4 space-y-2 max-h-[500px] overflow-auto pr-1">
              {history?.map((e: any) => (
                <div key={e.id} className="flex justify-between items-center text-[12px] p-2.5 rounded-xl border bg-slate-50">
                  <div><div className="font-medium">{e.date} • {new Date(e.clock_in).toLocaleString('en-PH', {timeZone: 'Asia/Manila', hour12: true})}</div><div className="text-[11px] text-slate-500">{e.mode} • {e.status} {e.clock_out ? '' : '• ONGOING'}</div></div>
                  <div className="text-right mono"><div>{e.clock_in ? new Date(e.clock_in).toLocaleString('en-PH', {timeZone: 'Asia/Manila', hour12: true}) : '—'} → {e.clock_out ? new Date(e.clock_out).toLocaleString('en-PH', {timeZone: 'Asia/Manila', hour12: true}) : '...'}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
