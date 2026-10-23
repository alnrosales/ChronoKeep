'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function getManilaDate(){ return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) }
function getManilaTimeString(d: Date){ return d.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }) }

// Helper function to format 24hr or timestamp strings into 12hr format (e.g., "08:00:00" -> "8:00 AM")
function formatTo12Hour(timeStr: string) {
  if (!timeStr) return ''
  // If the string is already a time or timestamp, let's parse it
  try {
    // If it's just "HH:mm:ss" or "HH:mm", prepend a dummy date so Date can parse it
    const dateObj = timeStr.includes('T') || timeStr.includes('-') 
      ? new Date(timeStr) 
      : new Date(`1970-01-01T${timeStr}`)
    
    if (isNaN(dateObj.getTime())) return timeStr // Fallback if parsing fails

    return dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return timeStr
  }
}

export default function ClockCard({ profile, todayEntry, settings, openEntry }: any) {
  const supabase = createClient()
  const [now, setNow] = useState(new Date())
  const [mode, setMode] = useState<'Remote'|'Onsite'>('Remote')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  // Extract shift_starts and shift_ends directly from the profile prop
  const { shift_starts, shift_ends } = profile || {}

  useEffect(()=>{ const i=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(i) },[])

  const activeEntry = openEntry || (todayEntry && !todayEntry.clock_out ? todayEntry : null)

  const clockIn = async()=>{
    setLoading(true)
    const { error } = await supabase.from('time_entries').insert({ employee_id: profile.id, date: getManilaDate(), clock_in: new Date().toISOString(), original_clock_in: new Date().toISOString(), mode, notes: note, status: 'On Time', created_by: profile.id })
    setLoading(false)
    if(error) alert(error.message); else location.reload()
  }

  const clockOut = async()=>{
    if(!activeEntry) return
    setLoading(true)
    const { error } = await supabase.from('time_entries').update({ clock_out: new Date().toISOString(), original_clock_out: new Date().toISOString() }).eq('id', activeEntry.id)
    setLoading(false)
    if(error) alert(error.message); else location.reload()
  }

  return (
    <div className="rounded-[20px] bg-white border shadow-sm p-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[11px] text-slate-500 tracking-wide">CURRENT TIME • {mode} MODE • PHT</div>
          <div className="mt-1 text-[36px] font-bold mono tracking-tight">{getManilaTimeString(now)}</div>
          <div className="text-[11px] text-slate-400">Philippines Time • Asia/Manila • UTC+8</div>
          {shift_starts && shift_ends && (
            <div className="text-[11px] text-slate-400 mt-0.5">
              Your shift starts at {formatTo12Hour(shift_starts)} and it ends on {formatTo12Hour(shift_ends)}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            {['Remote','Onsite'].map(m=>(<button key={m} onClick={()=>setMode(m as any)} className={`px-3 py-1.5 rounded-full text-[12px] border ${mode===m?'bg-slate-900 text-white border-slate-900':'bg-white'}`}>{m}</button>))}
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-[11px] border ${activeEntry?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-slate-50'}`}>{activeEntry?'● On Duty':'Off Duty'}</div>
      </div>      
      <div className="mt-4">
        {!activeEntry ? (
          <button disabled={loading} onClick={clockIn} className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-medium">{loading?'...':`Clock In • ${mode}`}</button>
        ) : (
          <button disabled={loading} onClick={clockOut} className="w-full h-11 rounded-xl bg-white border border-slate-900 text-sm font-medium">{loading?'...':`Clock Out • ${new Date(activeEntry.clock_in).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila'})}`}</button>
        )}
      </div>
    </div>
  )
}