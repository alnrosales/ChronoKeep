'use client'
import { useState, useEffect } from 'react'
import { Bricolage_Grotesque } from 'next/font/google'
import { createClient } from '@/lib/supabase/client'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'] })

function getManilaDate(){ return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) }
function getManilaTimeString(d: Date){ return d.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }) }

// Helper function to format 24hr or timestamp strings into 12hr format (e.g., "08:00:00" -> "8:00 AM")
function formatTo12Hour(timeStr: string) {
  if (!timeStr) return 'Not set'
  try {
    const dateObj = timeStr.includes('T') || timeStr.includes('-') 
      ? new Date(timeStr) 
      : new Date(`1970-01-01T${timeStr}`)
    
    if (isNaN(dateObj.getTime())) return timeStr

    return dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return timeStr
  }
}

// Clocking out within this long after clocking in asks the employee for a reason
const QUICK_CLOCKOUT_MS = 60_000
const QUICK_REASONS = [
  'Selected the wrong work site',
  'Clocked in by mistake',
  'App or connection problem',
  'Emergency',
]

export default function ClockCard({ profile, todayEntry, settings, openEntry }: any) {
  const supabase = createClient()

  const activeEntry = openEntry || (todayEntry && !todayEntry.clock_out ? todayEntry : null)

  const [now, setNow] = useState(new Date())
  // If a shift is already open, start from the mode it was clocked in with (survives page reloads)
  const [mode, setMode] = useState<'Remote'|'Onsite'>(activeEntry?.mode === 'Onsite' ? 'Onsite' : 'Remote')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  // Quick clock-out prompt
  const [showQuick, setShowQuick] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonErr, setReasonErr] = useState('')

  // Extract shift_start (singular) and shift_ends directly from the profile prop
  const shift_start = profile?.shift_start
  const shift_ends = profile?.shift_ends

  useEffect(()=>{ const i=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(i) },[])

  // While clocked in, the mode is locked to the one used at clock-in
  const shownMode: 'Remote'|'Onsite' = activeEntry ? (activeEntry.mode === 'Onsite' ? 'Onsite' : 'Remote') : mode

  const clockIn = async()=>{
    setLoading(true)
    const { error } = await supabase.from('time_entries').insert({ employee_id: profile.id, date: getManilaDate(), clock_in: new Date().toISOString(), original_clock_in: new Date().toISOString(), mode, notes: note, status: 'On Time', created_by: profile.id })
    setLoading(false)
    if(error) alert(error.message); else location.reload()
  }

  const clockOut = async(quickReason?: string)=>{
    if(!activeEntry) return
    setLoading(true)
    const update: any = { clock_out: new Date().toISOString(), original_clock_out: new Date().toISOString() }
    // Saved in its own column so employees and admins can see it
    if (quickReason) update.quick_clockout_reason = quickReason
    const { error } = await supabase.from('time_entries').update(update).eq('id', activeEntry.id)
    setLoading(false)
    if(error) alert(error.message); else location.reload()
  }

  // Clock out right away, unless the shift is a minute old or less: then ask why first
  const requestClockOut = () => {
    if(!activeEntry) return
    const elapsed = Date.now() - new Date(activeEntry.clock_in).getTime()
    if (elapsed <= QUICK_CLOCKOUT_MS) {
      setReason(''); setReasonErr(''); setShowQuick(true)
    } else {
      clockOut()
    }
  }

  const confirmQuickClockOut = () => {
    const r = reason.trim()
    if (r.length < 3) { setReasonErr('Please tell us why you are clocking out so soon.'); return }
    clockOut(r.slice(0, 200))
  }

  const clockInTime = activeEntry ? new Date(activeEntry.clock_in).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila'}) : ''

  return (
    <div className="rounded-[20px] border border-[#EEEAFF] bg-[#FAF9FF] p-4 sm:p-6">
      {/* Top row: label + duty status */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold tracking-wide text-[#4B2BF0] border border-[#EEEAFF]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4B2BF0]" aria-hidden />
          CURRENT TIME • {shownMode.toUpperCase()} MODE
        </div>
        <div className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold ${activeEntry ? 'bg-[#E3FBF2] text-[#0B7A55]' : 'bg-white text-slate-500 border border-[#EEEAFF]'}`}>
          {activeEntry ? (
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#2EE6A6] motion-safe:animate-pulse" aria-hidden />On Duty</span>
          ) : 'Off Duty'}
        </div>
      </div>

      {/* Time */}
      <div className={`${display.className} mt-4 text-[36px] sm:text-[44px] font-extrabold leading-none tracking-tight text-[#14102B] tabular-nums`}>
        {getManilaTimeString(now)}
      </div>
      <div className="mt-2 text-[12px] text-slate-500">Philippines Time • Asia/Manila • UTC+8</div>

      <div className="mt-3 inline-flex flex-wrap items-center gap-x-2 rounded-xl bg-[#FFF4D6] px-3 py-1.5 text-[12px] text-[#8A5A00]">
        <span className="font-bold">Shift</span>
        <span className="font-semibold">{formatTo12Hour(shift_start)} – {formatTo12Hour(shift_ends)}</span>
      </div>

      {/* Work mode */}
      <div className="mt-5">
        <div className="mb-2 text-[12px] font-semibold text-slate-600">Work mode</div>
        <div className="grid grid-cols-2 gap-2">
          {['Remote','Onsite'].map(m=>{
            const selected = shownMode === m
            const grayedOut = !!activeEntry && !selected
            return (
              <button
                key={m}
                disabled={!!activeEntry}
                aria-pressed={selected}
                title={grayedOut ? `You clocked in as ${shownMode}. Clock out to change it.` : undefined}
                onClick={()=>setMode(m as any)}
                className={`h-11 rounded-2xl border-2 text-[14px] font-semibold transition active:scale-[0.98] disabled:cursor-default focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/25 ${
                  selected ? 'bg-[#4B2BF0] border-[#4B2BF0] text-white shadow-[0_8px_20px_-10px_rgba(75,43,240,0.8)]'
                  : grayedOut ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-[#E4DFFA] text-[#4B2BF0] hover:bg-[#F6F4FF]'
                }`}
              >{m}</button>
            )
          })}
        </div>
      </div>

      {/* Action */}
      <div className="mt-5">
        {!activeEntry ? (
          <button disabled={loading} onClick={clockIn} className="w-full h-12 rounded-2xl bg-[#FF5A4E] text-white text-[15px] font-bold shadow-[0_10px_24px_-8px_rgba(255,90,78,0.7)] hover:bg-[#F2443A] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5A4E]/30">{loading?'...':`Clock In • ${mode}`}</button>
        ) : (
          <button disabled={loading} onClick={requestClockOut} className="w-full h-12 rounded-2xl bg-white border-2 border-[#4B2BF0] text-[#4B2BF0] text-[15px] font-bold hover:bg-[#F6F4FF] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/25">{loading?'...':`Clock Out • in at ${clockInTime}`}</button>
        )}
      </div>

      {/* Quick clock-out: ask for a reason */}
      {showQuick && activeEntry && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-[#14102B]/55 backdrop-blur-sm" onClick={() => !loading && setShowQuick(false)} />
          <div role="dialog" aria-modal="true" aria-label="Reason for clocking out early" className="relative w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-5 sm:p-6 border-b border-[#EEEAFF]">
              <h3 className={`${display.className} text-[20px] font-extrabold text-[#14102B] leading-tight`}>Clocking out so soon?</h3>
              <p className="mt-1 text-[13px] text-slate-500">
                You clocked in at {clockInTime}, less than a minute ago. Please tell us why you are clocking out so quickly.
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div>
                <div className="text-[12px] font-semibold text-slate-600 mb-2">Common reasons</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_REASONS.map(r => (
                    <button
                      key={r} type="button" onClick={() => { setReason(r); setReasonErr('') }}
                      className={`px-3.5 h-9 rounded-full border-2 text-[13px] font-semibold transition active:scale-[0.98] ${
                        reason === r ? 'bg-[#4B2BF0] border-[#4B2BF0] text-white' : 'bg-white border-[#E4DFFA] text-[#4B2BF0] hover:bg-[#F6F4FF]'
                      }`}
                    >{r}</button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="block text-[13px] font-semibold text-[#14102B] mb-1.5">Reason</span>
                <input
                  value={reason} maxLength={200}
                  onChange={(e) => { setReason(e.target.value); setReasonErr('') }}
                  placeholder="Pick one above or type your own"
                  className="w-full h-12 rounded-2xl border-2 border-[#E4DFFA] bg-[#FAF9FF] px-4 text-[16px] sm:text-sm text-[#14102B] placeholder:text-slate-400 focus:outline-none focus:border-[#4B2BF0] focus:bg-white focus:ring-4 focus:ring-[#4B2BF0]/15"
                />
              </label>

              {reasonErr && <div role="alert" className="text-[13px] text-[#B42318] bg-[#FFF1EF] border border-[#FFC9C2] p-3 rounded-2xl">{reasonErr}</div>}

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowQuick(false)} disabled={loading} className="h-11 rounded-2xl border-2 border-[#E4DFFA] bg-white text-[#4B2BF0] text-sm font-semibold hover:bg-[#F6F4FF] active:scale-[0.98] transition disabled:opacity-60">Keep working</button>
                <button onClick={confirmQuickClockOut} disabled={loading} className="h-11 rounded-2xl bg-[#FF5A4E] text-white text-sm font-bold hover:bg-[#F2443A] active:scale-[0.98] transition disabled:opacity-60">{loading ? '...' : 'Clock out'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
