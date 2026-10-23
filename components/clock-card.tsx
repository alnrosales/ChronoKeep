'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ClockCard({ profile, todayEntry, settings, openEntry }: any) {
  const supabase = createClient()
  const [now, setNow] = useState(new Date())
  const [mode, setMode] = useState<'Remote'|'Onsite'>('Remote')
  const [lateType, setLateType] = useState('')
  const [lateReason, setLateReason] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i) }, [])

  // Determine if current open entry exists - this is the active shift
  const activeEntry = openEntry || (todayEntry && !todayEntry.clock_out ? todayEntry : null)

  const isLate = (() => {
    try {
      const [sh, sm] = (settings?.start_time || '09:00').split(':').map(Number)
      const start = new Date(); start.setHours(sh, sm + (settings?.grace_minutes || 15), 0, 0)
      return now > start
    } catch { return false }
  })()

  const clockIn = async () => {
    // Allow clock-in ANYTIME - late reason optional, not blocking
    setLoading(true)
    const { error } = await supabase.from('time_entries').insert({
      employee_id: profile.id,
      date: new Date().toISOString().split('T')[0],
      clock_in: new Date().toISOString(),
      original_clock_in: new Date().toISOString(),
      mode,
      notes: note,
      late_reason: lateReason,
      late_reason_type: lateType,
      status: isLate ? 'Late' : 'On Time',
      created_by: profile.id
    })
    setLoading(false)
    if (error) alert('Clock In failed: ' + error.message)
    else location.reload()
  }

  const clockOut = async () => {
    if (!activeEntry) return
    setLoading(true)
    const { error } = await supabase.from('time_entries').update({
      clock_out: new Date().toISOString(),
      original_clock_out: new Date().toISOString()
    }).eq('id', activeEntry.id)
    setLoading(false)
    if (error) alert('Clock Out failed: ' + error.message)
    else location.reload()
  }

  return (
    <div className="rounded-[20px] bg-white border shadow-sm p-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[11px] text-slate-500 tracking-wide">CURRENT TIME • {mode} MODE • FLEXIBLE</div>
          <div className="mt-1 text-[36px] font-bold mono tracking-tight">{now.toLocaleTimeString()}</div>
          <div className="mt-2 flex gap-2">
            {['Remote','Onsite'].map(m => (
              <button key={m} onClick={() => setMode(m as any)} className={`px-3 py-1.5 rounded-full text-[12px] border ${mode===m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'}`}>{m}</button>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-slate-400">Clock in/out anytime • Multiple shifts per day allowed</div>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-[11px] border ${activeEntry ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50'}`}>
          {activeEntry ? '● On Duty' : 'Off Duty'}
        </div>
      </div>

      {isLate && !activeEntry && (
        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="text-[12px] font-medium text-amber-800">Late arrival? Add reason (optional, not blocking)</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {['Traffic','Power/Internet Issue','Family Emergency','Health','Other'].map(t => (
              <button key={t} onClick={()=>setLateType(t)} className={`text-[11px] px-2 py-1.5 rounded-full border text-left ${lateType===t ? 'bg-amber-900 text-white' : 'bg-white'}`}>{t}</button>
            ))}
          </div>
          <textarea value={lateReason} onChange={e=>setLateReason(e.target.value)} placeholder="Explain late (optional)..." className="mt-2 w-full rounded-xl border p-2.5 text-[12px] min-h-[50px]" />
        </div>
      )}

      <div className="mt-4"><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add note for this shift (optional)" className="w-full rounded-xl border p-2.5 text-[12px]" /></div>

      <div className="mt-4 flex gap-2">
        {!activeEntry ? (
          <button disabled={loading} onClick={clockIn} className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">{loading ? '...' : `Clock In • ${mode} • Anytime`}</button>
        ) : (
          <button disabled={loading} onClick={clockOut} className="flex-1 h-11 rounded-xl bg-white border border-slate-900 text-sm font-medium hover:bg-slate-50">{loading ? '...' : `Clock Out • Started ${new Date(activeEntry.clock_in).toLocaleTimeString()}`}</button>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        {activeEntry && (
          <div className="text-[11px] text-slate-500">Open shift: {activeEntry.mode} • {new Date(activeEntry.clock_in).toLocaleString()} • You can clock out anytime</div>
        )}
      </div>
      <div className="mt-3 text-[10px] text-slate-400 flex items-center gap-1.5">🔓 Flexible • No 9-5 lock • Multiple entries per day • RLS secured</div>
    </div>
  )
}
