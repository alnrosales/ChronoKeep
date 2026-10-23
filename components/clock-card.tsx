'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ClockCard({ profile, todayEntry, settings }: any) {
  const supabase = createClient()
  const [now, setNow] = useState(new Date())
  const [mode, setMode] = useState<'Remote'|'Onsite'>('Remote')
  const [lateType, setLateType] = useState('')
  const [lateReason, setLateReason] = useState('')
  const [note, setNote] = useState('')
  const [onBreak, setOnBreak] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i) }, [])

  const isLate = (() => {
    const [sh, sm] = settings.start_time.split(':').map(Number)
    const start = new Date(); start.setHours(sh, sm + settings.grace_minutes, 0, 0)
    return now > start
  })()

  const clockIn = async () => {
    if (isLate && !lateReason) { alert('Late reason required'); return }
    setLoading(true)
    const { error } = await supabase.from('time_entries').upsert({
      employee_id: profile.id,
      date: new Date().toISOString().split('T')[0],
      clock_in: new Date().toISOString(),
      original_clock_in: todayEntry?.original_clock_in || new Date().toISOString(),
      mode,
      notes: note,
      late_reason: lateReason,
      late_reason_type: lateType,
      status: isLate ? 'Late' : 'On Time',
      created_by: profile.id
    }, { onConflict: 'employee_id,date' })
    setLoading(false)
    if (error) alert(error.message)
    else location.reload()
  }

  const clockOut = async () => {
    setLoading(true)
    const { error } = await supabase.from('time_entries').update({
      clock_out: new Date().toISOString(),
      original_clock_out: todayEntry?.original_clock_out || new Date().toISOString()
    }).eq('id', todayEntry.id)
    setLoading(false)
    if (error) alert(error.message)
    else location.reload()
  }

  return (
    <div className="rounded-[20px] bg-white border shadow-sm p-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[11px] text-slate-500 tracking-wide">CURRENT TIME • {mode} MODE</div>
          <div className="mt-1 text-[36px] font-bold mono tracking-tight">{now.toLocaleTimeString()}</div>
          <div className="mt-2 flex gap-2">
            {['Remote','Onsite'].map(m => (
              <button key={m} onClick={() => setMode(m as any)} className={`px-3 py-1.5 rounded-full text-[12px] border ${mode===m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-[11px] border ${todayEntry?.clock_in && !todayEntry?.clock_out ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50'}`}>
          {todayEntry?.clock_in && !todayEntry?.clock_out ? '● On Duty' : 'Off Duty'}
        </div>
      </div>

      {isLate && !todayEntry?.clock_in && (
        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="text-[12px] font-medium text-amber-800">Late arrival — reason required</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {['Traffic','Power/Internet Issue','Family Emergency','Health','Other'].map(t => (
              <button key={t} onClick={()=>setLateType(t)} className={`text-[11px] px-2 py-1.5 rounded-full border text-left ${lateType===t ? 'bg-amber-900 text-white' : 'bg-white'}`}>{t}</button>
            ))}
          </div>
          <textarea value={lateReason} onChange={e=>setLateReason(e.target.value)} placeholder="Explain..." className="mt-2 w-full rounded-xl border p-2.5 text-[12px] min-h-[60px]" />
        </div>
      )}

      <div className="mt-4"><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add note for today (optional)" className="w-full rounded-xl border p-2.5 text-[12px]" /></div>

      <div className="mt-4 flex gap-2">
        {!todayEntry?.clock_in ? (
          <button disabled={loading} onClick={clockIn} className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-medium">Clock In • {mode}</button>
        ) : !todayEntry?.clock_out ? (
          <button disabled={loading} onClick={clockOut} className="flex-1 h-11 rounded-xl bg-white border text-sm font-medium">Clock Out</button>
        ) : (
          <div className="flex-1 h-11 rounded-xl bg-slate-50 border grid place-items-center text-[13px] text-slate-500">Completed today • {todayEntry.mode}</div>
        )}
      </div>
      <div className="mt-3 text-[10px] text-slate-400 flex items-center gap-1.5">🔒 Entry locked & timestamped in Postgres • RLS secured</div>
    </div>
  )
}
