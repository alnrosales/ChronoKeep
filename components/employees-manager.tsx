'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Bricolage_Grotesque } from 'next/font/google'
import { deleteEmployee, resetEmployeePassword, updateEmployee } from '@/app/admin/actions'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'] })

type Employee = {
  id: string
  full_name: string
  email: string
  role: string
  work_type: string
  shift_start: string | null
  shift_ends: string | null
  department: string | null
  is_active: boolean
}

// ---- shared style tokens (match the login + admin pages) ----
const fieldInput =
  'w-full h-12 rounded-2xl border-2 border-[#E4DFFA] bg-[#FAF9FF] px-4 text-[16px] sm:text-sm text-[#14102B] placeholder:text-slate-400 transition-colors focus:outline-none focus:border-[#4B2BF0] focus:bg-white focus:ring-4 focus:ring-[#4B2BF0]/15'
const cellInput =
  'w-full h-10 rounded-xl border-2 border-[#E4DFFA] bg-[#FAF9FF] px-2.5 text-[16px] md:text-[13px] text-[#14102B] focus:outline-none focus:border-[#4B2BF0] focus:bg-white'
const btnPrimary =
  'h-11 px-5 rounded-2xl bg-[#FF5A4E] text-white text-sm font-bold shadow-[0_10px_24px_-10px_rgba(255,90,78,0.7)] hover:bg-[#F2443A] active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5A4E]/30'
const btnGhost =
  'h-11 px-5 rounded-2xl border-2 border-[#E4DFFA] bg-white text-[#4B2BF0] text-sm font-semibold hover:bg-[#F6F4FF] active:scale-[0.98] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/20'
const btnSmGhost =
  'h-9 px-3.5 rounded-xl border-2 border-[#E4DFFA] bg-white text-[#4B2BF0] text-[12px] font-semibold hover:bg-[#F6F4FF] active:scale-[0.98] transition'
const btnSmSave =
  'h-9 px-3.5 rounded-xl bg-[#4B2BF0] text-white text-[12px] font-semibold hover:bg-[#3A1FD0] active:scale-[0.98] transition'
const btnSmDanger =
  'h-9 px-3.5 rounded-xl border-2 border-[#FFC9C2] bg-[#FFF1EF] text-[#B42318] text-[12px] font-semibold hover:bg-[#FFE1DD] active:scale-[0.98] transition disabled:opacity-60'
const iconClose =
  'h-10 w-10 shrink-0 rounded-full bg-[#EEEAFF] text-[#4B2BF0] grid place-items-center text-sm font-bold hover:bg-[#E2DBFF] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/20'

const parseShiftTime = (value: string): string | null => {
  const match = value.trim().match(/^(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)$/i)
  if (!match) return null

  const hour = (Number(match[1]) % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0)
  return `${String(hour).padStart(2, '0')}:${match[2]}`
}

const formatShiftTime = (value: string | null) => {
  if (!value) return ''

  const enteredTime = parseShiftTime(value)
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/)
  const timeValue = enteredTime || (match ? `${match[1]}:${match[2]}` : null)
  if (!timeValue) return value

  const [hours, minutes] = timeValue.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`
}

const initials = (name?: string | null) =>
  (name || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'

// 8-character random password: crypto-random, no look-alike characters (0/O, 1/l/I),
// always contains a lowercase letter, an uppercase letter and a digit.
const PW_LOWER = 'abcdefghjkmnpqrstuvwxyz'
const PW_UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const PW_DIGIT = '23456789'

function randInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max // rejection sampling: no modulo bias
  const buf = new Uint32Array(1)
  let x: number
  do { crypto.getRandomValues(buf); x = buf[0] } while (x >= limit)
  return x % max
}

function generatePassword(): string {
  const pick = (set: string) => set[randInt(set.length)]
  const all = PW_LOWER + PW_UPPER + PW_DIGIT
  const chars = [pick(PW_LOWER), pick(PW_UPPER), pick(PW_DIGIT)]
  while (chars.length < 8) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function ActivePill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E3FBF2] text-[#0B7A55] px-2.5 py-1 text-[12px] font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-[#2EE6A6]" aria-hidden /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-500 px-2.5 py-1 text-[12px] font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" aria-hidden /> Inactive
    </span>
  )
}

function Chip({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'violet' | 'amber' | 'plain' }) {
  const tones = {
    violet: 'bg-[#EEEAFF] text-[#4B2BF0]',
    amber: 'bg-[#FFF4D6] text-[#8A5A00]',
    plain: 'bg-slate-100 text-slate-600',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${tones[tone]}`}>{children}</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-[#14102B] mb-1.5">{label}</span>
      {children}
    </label>
  )
}

export default function EmployeesManager({ employees, trigger }: { employees: Employee[], trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Employee[]>(employees)

  // When the server sends fresh data (after router.refresh()), show it instead of the old copy
  useEffect(() => { setList(employees) }, [employees])

  // Employee search (name, email, role, work type or group)
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const visibleList = query
    ? list.filter((e) =>
        [e.full_name, e.email, e.role, e.work_type, e.department].filter(Boolean).join(' ').toLowerCase().includes(query)
      )
    : list
  const [editing, setEditing] = useState<Employee | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Summary modal states
  const [summaryEmp, setSummaryEmp] = useState<Employee | null>(null)
  const [workLogs, setWorkLogs] = useState<any[]>([])
  const [summaryMonth, setSummaryMonth] = useState<string>('all')
  const [loadingLogs, setLoadingLogs] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role: 'employee',
    work_type: 'Hybrid',
    shift_start: '09:00 AM',
    shift_ends: '03:00 PM',
    department: '',
    password: ''
  })
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Delete-employee confirmation (goes through the logged server action)
  const [deleting, setDeleting] = useState<Employee | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteErr, setDeleteErr] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  // Reset-password window
  const [resetting, setResetting] = useState<Employee | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetReason, setResetReason] = useState('')
  const [resetErr, setResetErr] = useState('')
  const [resetBusy, setResetBusy] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [copied, setCopied] = useState(false)

  // Helper to format date as dd-mmm-yy in UTC+8
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      const utc8Date = new Date(d.getTime() + (8 * 60 - d.getTimezoneOffset()) * 60000)
      const day = String(utc8Date.getUTCDate()).padStart(2, '0')
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = months[utc8Date.getUTCMonth()]
      const year = String(utc8Date.getUTCFullYear()).slice(-2)
      return `${day}-${month}-${year}`
    } catch {
      return dateStr
    }
  }

  // Helper to format time to 12-hour format in UTC+8
  const formatTime12hr = (timeStr: string) => {
    if (!timeStr) return '-'
    try {
      let hours = 0, minutes = 0
      if (timeStr.includes('T')) {
        const d = new Date(timeStr)
        if (!isNaN(d.getTime())) {
          const utc8Date = new Date(d.getTime() + (8 * 60 - d.getTimezoneOffset()) * 60000)
          hours = utc8Date.getUTCHours()
          minutes = utc8Date.getUTCMinutes()
        } else {
          return timeStr
        }
      } else {
        const parts = timeStr.split(':')
        if (parts.length >= 2) {
          hours = parseInt(parts[0], 10)
          minutes = parseInt(parts[1], 10)
        } else {
          return timeStr
        }
      }

      const ampm = hours >= 12 ? 'PM' : 'AM'
      hours = hours % 12
      hours = hours ? hours : 12
      const minStr = String(minutes).padStart(2, '0')
      return `${hours}:${minStr} ${ampm}`
    } catch {
      return timeStr
    }
  }

  // Helper function to calculate working hours between clock_in and clock_out
  const calculateHours = (clockIn: string, clockOut: string) => {
    if (!clockIn || !clockOut) return '-'
    try {
      const start = clockIn.includes('T') ? new Date(clockIn) : new Date(`1970-01-01T${clockIn}`)
      const end = clockOut.includes('T') ? new Date(clockOut) : new Date(`1970-01-01T${clockOut}`)

      const diffMs = end.getTime() - start.getTime()
      if (isNaN(diffMs) || diffMs < 0) return '-'

      const diffHrs = diffMs / (1000 * 60 * 60)
      return `${diffHrs.toFixed(2)} hrs`
    } catch {
      return '-'
    }
  }

  const openDelete = (emp: Employee) => { setDeleting(emp); setDeleteReason(''); setDeleteErr('') }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true); setDeleteErr('')
    try {
      const r = await deleteEmployee(deleting.id, deleteReason)
      if (r.ok) {
        setList((prev) => prev.filter((e) => e.id !== deleting.id))
        setDeleting(null)
        router.refresh()
      } else {
        setDeleteErr(r.error)
      }
    } catch (e: any) {
      setDeleteErr(e?.message || 'Delete failed.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const openReset = (emp: Employee) => {
    setResetting(emp); setNewPassword(''); setResetReason(''); setResetErr(''); setResetDone(false); setCopied(false)
  }

  const copyPassword = async () => {
    if (!newPassword) return
    try {
      await navigator.clipboard.writeText(newPassword)
    } catch {
      // Fallback for browsers/contexts where the Clipboard API isn't available
      const ta = document.createElement('textarea')
      ta.value = newPassword
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const confirmReset = async () => {
    if (!resetting) return
    if (newPassword.length < 8) { setResetErr('Password must be at least 8 characters.'); return }
    setResetBusy(true); setResetErr('')
    try {
      const r = await resetEmployeePassword(resetting.id, newPassword, resetReason)
      if (r.ok) setResetDone(true)
      else setResetErr(r.error)
    } catch (e: any) {
      setResetErr(e?.message || 'Password reset failed.')
    } finally {
      setResetBusy(false)
    }
  }

  const handleOpenSummary = async (emp: Employee) => {
    setSummaryEmp(emp)
    setSummaryMonth('all')
    setLoadingLogs(true)
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', emp.id)
        .order('date', { ascending: false })

      if (error) {
        setWorkLogs([])
      } else {
        setWorkLogs(data || [])
      }
    } catch (err) {
      setWorkLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleAdd = async () => {
    if (!form.email || !form.full_name) {
      alert('Name and email required')
      return
    }
    if (!form.password) {
      alert('Password is required')
      return
    }

    const shiftStart = parseShiftTime(form.shift_start)
    const shiftEnds = parseShiftTime(form.shift_ends)
    if (!shiftStart || !shiftEnds) {
      alert('Enter shift times in 12-hour format (for example, 09:00 AM).')
      return
    }

    setLoading(true)

    // Create a temporary client that does NOT persist session
    const tempSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data, error } = await tempSupabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          role: form.role
        }
      }
    })

    if (error) {
      if (error.message.includes('already registered')) {
        alert('This email is already registered in Supabase Auth. Please delete the user from Supabase Authentication -> Users table first, or use a different email.')
      } else {
        alert(`Auth creation failed: ${error.message}`)
      }
      setLoading(false)
      return
    }

    const user = data.user
    if (!user) {
      alert('User could not be created.')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: form.email,
      full_name: form.full_name,
      role: form.role,
      work_type: form.work_type,
      shift_start: shiftStart,
      shift_ends: shiftEnds,
      department: form.department || null,
      is_active: true
    })

    if (profileError) {
      alert(`Profile error: ${profileError.message}`)
      setLoading(false)
      return
    }

    const newEmployee: Employee = {
      id: user.id,
      full_name: form.full_name,
      email: form.email,
      role: form.role,
      work_type: form.work_type,
      shift_start: shiftStart,
      shift_ends: shiftEnds,
      department: form.department || null,
      is_active: true
    }

    setList((prev) => [...prev, newEmployee])
    setForm({
      full_name: '',
      email: '',
      role: 'employee',
      work_type: 'Hybrid',
      shift_start: '09:00 AM',
      shift_ends: '03:00 PM',
      department: '',
      password: ''
    })
    setLoading(false)
    setShowAddModal(false)
  }

  const handleEdit = async () => {
    if (!editing) return
    const shiftStart = parseShiftTime(editing.shift_start || '09:00 AM')
    const shiftEnds = parseShiftTime(editing.shift_ends || '03:00 PM')
    if (!shiftStart || !shiftEnds) {
      alert('Enter shift times in 12-hour format (for example, 09:00 AM).')
      return
    }

    setLoading(true)
    try {
      // Saved on the server so it can't be silently blocked, and so the sign-in email changes too
      const r = await updateEmployee(editing.id, {
        full_name: editing.full_name,
        email: editing.email,
        role: editing.role,
        work_type: editing.work_type,
        shift_start: shiftStart,
        shift_ends: shiftEnds,
        department: editing.department,
        is_active: editing.is_active,
      })
      if (r.ok) {
        const saved = {
          ...editing,
          full_name: editing.full_name.trim(),
          email: editing.email.trim().toLowerCase(),
          shift_start: shiftStart,
          shift_ends: shiftEnds,
        }
        setList((prev) => prev.map((e) => (e.id === editing.id ? saved : e)))
        setEditing(null)
        router.refresh()
      } else {
        alert(r.error)
      }
    } catch (e: any) {
      alert(e?.message || 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  // Month filter for the working records summary
  const monthKey = (log: any): string | null =>
    typeof log?.date === 'string' && /^\d{4}-\d{2}/.test(log.date) ? log.date.slice(0, 7) : null

  const monthLabel = (key: string) =>
    new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

  const monthOptions = Array.from(new Set(workLogs.map(monthKey).filter((k): k is string => !!k))).sort().reverse()
  const filteredLogs = summaryMonth === 'all' ? workLogs : workLogs.filter((l) => monthKey(l) === summaryMonth)
  const filteredHours = filteredLogs.reduce((sum, l) => {
    const h = parseFloat(calculateHours(l.clock_in, l.clock_out))
    return isNaN(h) ? sum : sum + h
  }, 0)

  // Mobile edit form (stacked fields inside the employee card)
  const renderMobileEdit = (ed: Employee) => (
    <div className="space-y-3">
      <Field label="Full name"><input value={ed.full_name} onChange={(e) => setEditing({ ...ed, full_name: e.target.value })} className={fieldInput} /></Field>
      <Field label="Email"><input type="email" value={ed.email} onChange={(e) => setEditing({ ...ed, email: e.target.value })} className={fieldInput} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <select value={ed.role} onChange={(e) => setEditing({ ...ed, role: e.target.value })} className={fieldInput}>
            <option>employee</option><option>admin</option>
          </select>
        </Field>
        <Field label="Work type">
          <select value={ed.work_type} onChange={(e) => setEditing({ ...ed, work_type: e.target.value })} className={fieldInput}>
            <option>Hybrid</option><option>Remote</option><option>Onsite</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Shift start"><input type="text" inputMode="text" placeholder="09:00 AM" value={formatShiftTime(ed.shift_start || '09:00')} onChange={(e) => setEditing({ ...ed, shift_start: e.target.value })} className={fieldInput} /></Field>
        <Field label="Shift ends"><input type="text" inputMode="text" placeholder="03:00 PM" value={formatShiftTime(ed.shift_ends || '15:00')} onChange={(e) => setEditing({ ...ed, shift_ends: e.target.value })} className={fieldInput} /></Field>
      </div>
      <Field label="Group"><input value={ed.department || ''} onChange={(e) => setEditing({ ...ed, department: e.target.value })} className={fieldInput} /></Field>
      <label className="flex items-center gap-3 rounded-2xl bg-[#F6F4FF] px-4 h-12 text-[14px] font-semibold text-[#14102B]">
        <input type="checkbox" checked={ed.is_active} onChange={(e) => setEditing({ ...ed, is_active: e.target.checked })} className="w-5 h-5 accent-[#4B2BF0]" />
        Active account
      </label>
      <button onClick={() => openReset(ed)} className={`${btnGhost} w-full`}>Reset password</button>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={() => setEditing(null)} className={btnGhost}>Cancel</button>
        <button onClick={handleEdit} disabled={loading} className={btnPrimary}>{loading ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  )

  return (
    <>
      <div onClick={() => { setSearch(''); setOpen(true) }} className="h-full">{trigger}</div>

      {/* ===== Employees list (bottom sheet on phones, centered dialog on larger screens) ===== */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-[#14102B]/55 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full sm:max-w-6xl h-[94vh] sm:h-auto sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col rounded-t-[28px] sm:rounded-[28px]">
            <div className="p-4 sm:p-5 border-b border-[#EEEAFF] flex justify-between items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className={`${display.className} text-[20px] sm:text-[22px] font-extrabold text-[#14102B]`}>Employees</h2>
                <Chip>{query ? `${visibleList.length} / ${list.length}` : list.length}</Chip>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setForm({
                      full_name: '',
                      email: '',
                      role: 'employee',
                      work_type: 'Hybrid',
                      shift_start: '09:00 AM',
                      shift_ends: '03:00 PM',
                      department: '',
                      password: ''
                    })
                    setShowAddModal(true)
                  }}
                  className={btnPrimary}
                >
                  + Add
                </button>
                <button onClick={() => setOpen(false)} className={iconClose} aria-label="Close">✕</button>
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3 border-b border-[#EEEAFF] bg-[#FAF9FF]">
              <div className="relative">
                <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, role or group"
                  aria-label="Search employees"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full h-11 rounded-xl border-2 border-[#E4DFFA] bg-white pl-10 pr-10 text-[16px] sm:text-[13px] text-[#14102B] placeholder:text-slate-400 focus:outline-none focus:border-[#4B2BF0] focus:ring-4 focus:ring-[#4B2BF0]/15"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-[12px] font-bold text-[#4B2BF0] hover:bg-[#EEEAFF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B2BF0]"
                  >✕</button>
                )}
              </div>
            </div>

            <div className="overflow-auto flex-1">
              {/* Mobile: cards */}
              <ul className="md:hidden divide-y divide-[#EEEAFF]">
                {visibleList.map((emp) => (
                  <li key={emp.id} className="p-4">
                    {editing?.id === emp.id ? (
                      renderMobileEdit(editing)
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 shrink-0 rounded-full bg-[#EEEAFF] text-[#4B2BF0] grid place-items-center text-[13px] font-bold">
                            {initials(emp.full_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <button
                              onClick={() => handleOpenSummary(emp)}
                              className="text-left font-semibold text-[15px] text-[#14102B] hover:text-[#4B2BF0] focus:outline-none"
                              title="View working records summary"
                            >
                              {emp.full_name}
                            </button>
                            <div className="text-[12px] text-slate-500 break-all">{emp.email}</div>
                          </div>
                          <ActivePill active={emp.is_active} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Chip>{emp.role}</Chip>
                          <Chip tone="plain">{emp.work_type}</Chip>
                          <Chip tone="plain">{emp.department || 'No group'}</Chip>
                          <Chip tone="amber"><span className="tabular-nums">{formatShiftTime(emp.shift_start || '09:00')} – {formatShiftTime(emp.shift_ends || '15:00')}</span></Chip>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <button onClick={() => handleOpenSummary(emp)} className={btnSmGhost}>Records</button>
                          <button onClick={() => setEditing(emp)} className={btnSmGhost}>Edit</button>
                          <button disabled={loading} onClick={() => openDelete(emp)} className={btnSmDanger}>Delete</button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
                {visibleList.length === 0 && (
                  <li className="p-10 text-center text-sm text-slate-500">
                    {list.length === 0 ? 'No employees yet. Tap + Add to create one.' : `No employees match "${search.trim()}".`}
                  </li>
                )}
              </ul>

              {/* Desktop: table */}
              <table className="hidden md:table w-full table-fixed text-[12px]">
                <thead className="sticky top-0 bg-[#F6F4FF] text-slate-600">
                  <tr>
                    <th className="text-left p-2 pl-3 w-[15%] font-semibold">Full name</th>
                    <th className="text-left p-2 w-[18%] font-semibold">Email</th>
                    <th className="text-left p-2 w-[8%] font-semibold">Role</th>
                    <th className="text-left p-2 w-[9%] font-semibold">Work type</th>
                    <th className="text-left p-2 w-[10%] font-semibold">Shift start</th>
                    <th className="text-left p-2 w-[10%] font-semibold">Shift ends</th>
                    <th className="text-left p-2 w-[9%] font-semibold">Group</th>
                    <th className="text-left p-2 w-[8%] font-semibold">Active</th>
                    <th className="text-left p-2 pr-3 w-[13%] font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleList.map((emp) => (
                    <tr key={emp.id} className="border-t border-[#EEEAFF] hover:bg-[#FAF9FF]">
                      {editing?.id === emp.id ? (
                        <>
                          <td className="p-1.5 align-middle"><input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} className={`${cellInput} px-1.5`} /></td>
                          <td className="p-1.5 align-middle"><input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={`${cellInput} px-1.5`} /></td>
                          <td className="p-1.5 align-middle"><select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className={`${cellInput} px-1`}><option>employee</option><option>admin</option></select></td>
                          <td className="p-1.5 align-middle"><select value={editing.work_type} onChange={(e) => setEditing({ ...editing, work_type: e.target.value })} className={`${cellInput} px-1`}><option>Hybrid</option><option>Remote</option><option>Onsite</option></select></td>
                          <td className="p-1.5 align-middle"><input type="text" inputMode="text" placeholder="09:00 AM" value={formatShiftTime(editing.shift_start || '09:00')} onChange={(e) => setEditing({ ...editing, shift_start: e.target.value })} className={`${cellInput} px-1`} /></td>
                          <td className="p-1.5 align-middle"><input type="text" inputMode="text" placeholder="03:00 PM" value={formatShiftTime(editing.shift_ends || '15:00')} onChange={(e) => setEditing({ ...editing, shift_ends: e.target.value })} className={`${cellInput} px-1`} /></td>
                          <td className="p-1.5 align-middle"><input value={editing.department || ''} onChange={(e) => setEditing({ ...editing, department: e.target.value })} className={`${cellInput} px-1.5`} /></td>
                          <td className="p-1.5 align-middle"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="w-5 h-5 accent-[#4B2BF0]" aria-label="Active" /></td>
                          <td className="p-1.5 align-middle">
                            <div className="flex flex-wrap gap-1.5">
                              <button onClick={handleEdit} className={btnSmSave}>Save</button>
                              <button onClick={() => setEditing(null)} className={btnSmGhost}>Cancel</button>
                              <button onClick={() => openReset(emp)} className={`${btnSmGhost} w-full`}>Reset password</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-2 pl-3 align-middle">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 shrink-0 rounded-full bg-[#EEEAFF] text-[#4B2BF0] grid place-items-center text-[11px] font-bold">{initials(emp.full_name)}</div>
                              <button
                                onClick={() => handleOpenSummary(emp)}
                                className="min-w-0 block truncate text-left font-semibold text-[#14102B] hover:text-[#4B2BF0] hover:underline cursor-pointer focus:outline-none"
                                title="Click to view working records summary"
                              >
                                {emp.full_name}
                              </button>
                            </div>
                          </td>
                          <td className="p-2 align-middle break-all text-slate-600">{emp.email}</td>
                          <td className="p-2 align-middle"><Chip>{emp.role}</Chip></td>
                          <td className="p-2 align-middle break-words">{emp.work_type}</td>
                          <td className="p-2 align-middle tabular-nums">{formatShiftTime(emp.shift_start || '09:00')}</td>
                          <td className="p-2 align-middle tabular-nums">{formatShiftTime(emp.shift_ends || '15:00')}</td>
                          <td className="p-2 align-middle break-words">{emp.department || '-'}</td>
                          <td className="p-2 align-middle"><ActivePill active={emp.is_active} /></td>
                          <td className="p-2 align-middle">
                            <div className="flex flex-wrap gap-1">
                              <button onClick={() => setEditing(emp)} className={btnSmGhost}>Edit</button>
                              <button disabled={loading} onClick={() => openDelete(emp)} className={btnSmDanger}>Delete</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {visibleList.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-sm text-slate-500">
                        {list.length === 0 ? 'No employees yet. Click + Add to create one.' : `No employees match "${search.trim()}".`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== Summary modal ===== */}
      {summaryEmp && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-[#14102B]/60 backdrop-blur-sm" onClick={() => setSummaryEmp(null)} />
          <div className="relative bg-white w-full sm:max-w-3xl shadow-2xl rounded-t-[28px] sm:rounded-[28px] max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-[#EEEAFF] flex justify-between items-start gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 shrink-0 rounded-full bg-[#4B2BF0] text-white grid place-items-center text-[13px] font-bold">{initials(summaryEmp.full_name)}</div>
                <div className="min-w-0">
                  <h2 className={`${display.className} text-[18px] sm:text-[20px] font-bold text-[#14102B] leading-tight`}>{summaryEmp.full_name}&apos;s working records</h2>
                  <p className="text-[12px] text-slate-500 truncate">{summaryEmp.email} · {summaryEmp.department || 'No group'} · {summaryEmp.work_type}</p>
                </div>
              </div>
              <button onClick={() => setSummaryEmp(null)} className={iconClose} aria-label="Close">✕</button>
            </div>

            {!loadingLogs && monthOptions.length > 0 && (
              <div className="px-4 sm:px-6 py-3 border-b border-[#EEEAFF] flex gap-2 overflow-x-auto" role="tablist" aria-label="Filter by month">
                {['all', ...monthOptions].map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={summaryMonth === m}
                    onClick={() => setSummaryMonth(m)}
                    className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold border-2 transition active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/20 ${
                      summaryMonth === m
                        ? 'bg-[#4B2BF0] border-[#4B2BF0] text-white'
                        : 'bg-white border-[#E4DFFA] text-[#4B2BF0] hover:bg-[#F6F4FF]'
                    }`}
                  >
                    {m === 'all' ? 'All months' : monthLabel(m)}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-y-auto flex-1">
              {loadingLogs ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading records...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">No working records found for this employee.</div>
              ) : (
                <>
                  {/* Mobile: list */}
                  <ul className="sm:hidden divide-y divide-[#EEEAFF]">
                    {filteredLogs.map((log, idx) => (
                      <li key={log.id || idx} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-semibold text-[#14102B]">{formatDate(log.date)}</div>
                          <div className="text-[12px] text-slate-500 tabular-nums">{formatTime12hr(log.clock_in)} → {formatTime12hr(log.clock_out)}</div>
                        </div>
                        <Chip tone="amber"><span className="tabular-nums">{calculateHours(log.clock_in, log.clock_out)}</span></Chip>
                      </li>
                    ))}
                  </ul>

                  {/* Desktop: table */}
                  <table className="hidden sm:table w-full text-[13px]">
                    <thead className="sticky top-0 bg-[#F6F4FF] text-slate-600">
                      <tr>
                        <th className="text-left p-3 pl-6 font-semibold">Date</th>
                        <th className="text-left p-3 font-semibold">Clock in</th>
                        <th className="text-left p-3 font-semibold">Clock out</th>
                        <th className="text-left p-3 pr-6 font-semibold">Total work hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log, idx) => (
                        <tr key={log.id || idx} className="border-t border-[#EEEAFF] hover:bg-[#FAF9FF]">
                          <td className="p-3 pl-6 text-slate-600">{formatDate(log.date)}</td>
                          <td className="p-3 tabular-nums">{formatTime12hr(log.clock_in)}</td>
                          <td className="p-3 tabular-nums">{formatTime12hr(log.clock_out)}</td>
                          <td className="p-3 pr-6 font-semibold text-[#4B2BF0] tabular-nums">{calculateHours(log.clock_in, log.clock_out)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div className="p-4 sm:px-6 border-t border-[#EEEAFF] flex justify-between items-center gap-3 text-[12px] text-slate-500">
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <span>Records: <span className="font-semibold text-[#14102B]">{filteredLogs.length}</span></span>
                <span>Total hours: <span className="font-semibold text-[#14102B] tabular-nums">{filteredHours.toFixed(2)} hrs</span></span>
              </div>
              <button onClick={() => setSummaryEmp(null)} className={btnGhost}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Reset password window ===== */}
      {resetting && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-[#14102B]/60 backdrop-blur-sm" onClick={() => !resetBusy && setResetting(null)} />
          <div role="dialog" aria-modal="true" aria-label="Reset password" className="relative bg-white w-full sm:max-w-md shadow-2xl rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] overflow-y-auto">
            <div className="p-5 sm:p-6 border-b border-[#EEEAFF] flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 shrink-0 rounded-full bg-[#4B2BF0] text-white grid place-items-center text-[13px] font-bold">{initials(resetting.full_name)}</div>
                <div className="min-w-0">
                  <h3 className={`${display.className} text-[18px] font-extrabold text-[#14102B] leading-tight`}>Reset password</h3>
                  <div className="text-[12px] text-slate-500 truncate">{resetting.full_name} · {resetting.email}</div>
                </div>
              </div>
              <button onClick={() => setResetting(null)} disabled={resetBusy} className={iconClose} aria-label="Close">✕</button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {resetDone ? (
                <p role="status" className="text-[14px] text-[#0B7A55] bg-[#E3FBF2] border border-[#B7F0DA] rounded-2xl p-3">
                  Password updated for {resetting.full_name}. Copy it now and share it securely. It won&apos;t be shown again after you close this window.
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="new-password" className="text-[13px] font-semibold text-[#14102B]">Enter new password</label>
                  <button
                    type="button"
                    onClick={() => { setNewPassword(generatePassword()); setCopied(false); setResetErr('') }}
                    className="h-8 px-3 rounded-full bg-[#EEEAFF] text-[#4B2BF0] text-[12px] font-semibold hover:bg-[#E2DBFF] active:scale-[0.98] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4B2BF0]/20"
                  >
                    Generate
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  id="new-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setCopied(false) }}
                  readOnly={resetDone}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={72}
                  placeholder="At least 8 characters"
                  className={`${fieldInput} font-mono tracking-wider`}
                />
                <button
                  type="button"
                  onClick={copyPassword}
                  disabled={!newPassword}
                  className={`${btnGhost} shrink-0 !px-4`}
                  aria-label="Copy password"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {!resetDone && (
                <Field label="Reason (optional)">
                  <input value={resetReason} onChange={(e) => setResetReason(e.target.value)} maxLength={300} placeholder="e.g. Forgot their password" className={fieldInput} />
                </Field>
              )}

              {resetErr && <div role="alert" className="text-[13px] text-[#B42318] bg-[#FFF1EF] border border-[#FFC9C2] p-3 rounded-2xl">{resetErr}</div>}

              {!resetDone && <p className="text-[11px] text-slate-400">This reset is recorded in the admin changes log. The password itself is never stored there.</p>}

              {resetDone ? (
                <button onClick={() => setResetting(null)} className={`${btnPrimary} w-full`}>Done</button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setResetting(null)} disabled={resetBusy} className={btnGhost}>Cancel</button>
                  <button onClick={confirmReset} disabled={resetBusy || !newPassword} className={btnPrimary}>{resetBusy ? 'Saving...' : 'Reset password'}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete employee confirmation ===== */}
      {deleting && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-[#14102B]/60 backdrop-blur-sm" onClick={() => !deleteBusy && setDeleting(null)} />
          <div role="dialog" aria-modal="true" aria-label="Delete employee" className="relative bg-white w-full sm:max-w-md shadow-2xl rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] overflow-y-auto">
            <div className="p-5 sm:p-6 border-b border-[#EEEAFF] flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 shrink-0 rounded-full bg-[#FFF1EF] text-[#B42318] grid place-items-center text-[13px] font-bold">{initials(deleting.full_name)}</div>
                <div className="min-w-0">
                  <h3 className={`${display.className} text-[18px] font-extrabold text-[#14102B] leading-tight`}>Delete employee</h3>
                  <div className="text-[12px] text-slate-500 truncate">{deleting.full_name} · {deleting.email}</div>
                </div>
              </div>
              <button onClick={() => setDeleting(null)} disabled={deleteBusy} className={iconClose} aria-label="Close">✕</button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-[14px] text-[#B42318] bg-[#FFF1EF] border border-[#FFC9C2] rounded-2xl p-3">
                This permanently deletes {deleting.full_name}&apos;s account and profile, and they can no longer sign in. This can&apos;t be undone, but the deletion will be recorded in the admin changes log.
              </p>
              <Field label="Reason (optional)">
                <input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} maxLength={300} placeholder="e.g. Left the company" className={fieldInput} />
              </Field>
              {deleteErr && <div role="alert" className="text-[13px] text-[#B42318] bg-[#FFF1EF] border border-[#FFC9C2] p-3 rounded-2xl">{deleteErr}</div>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setDeleting(null)} disabled={deleteBusy} className={btnGhost}>Cancel</button>
                <button onClick={confirmDelete} disabled={deleteBusy} className="h-11 px-5 rounded-2xl bg-[#B42318] text-white text-sm font-bold hover:bg-[#912018] active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#B42318]/30">
                  {deleteBusy ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Add employee modal ===== */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-[#14102B]/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white w-full sm:max-w-md shadow-2xl rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 p-5 sm:p-6 pb-3 flex justify-between items-center border-b border-[#EEEAFF]">
              <h2 className={`${display.className} text-[22px] font-extrabold text-[#14102B]`}>Add employee</h2>
              <button onClick={() => setShowAddModal(false)} className={iconClose} aria-label="Close">✕</button>
            </div>

            <div className="p-5 sm:p-6 flex flex-col gap-4">
              <Field label="Full name *">
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Full name" autoComplete="off" className={fieldInput} />
              </Field>
              <Field label="Email *">
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@waho.com.au" autoComplete="off" className={fieldInput} />
              </Field>
              <Field label="Password *">
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" autoComplete="new-password" className={fieldInput} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Work type">
                  <select value={form.work_type} onChange={(e) => setForm({ ...form, work_type: e.target.value })} className={fieldInput}>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                    <option value="Onsite">Onsite</option>
                  </select>
                </Field>
                <Field label="Role">
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={fieldInput}>
                    <option value="employee">employee</option>
                    <option value="admin">admin</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Shift start">
                  <input type="text" inputMode="text" placeholder="09:00 AM" value={form.shift_start} onChange={(e) => setForm({ ...form, shift_start: e.target.value })} className={fieldInput} />
                </Field>
                <Field label="Shift ends">
                  <input type="text" inputMode="text" placeholder="03:00 PM" value={form.shift_ends} onChange={(e) => setForm({ ...form, shift_ends: e.target.value })} className={fieldInput} />
                </Field>
              </div>
              <Field label="Group">
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Group" className={fieldInput} />
              </Field>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#EEEAFF] p-4 sm:px-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button onClick={() => setShowAddModal(false)} className={btnGhost}>Cancel</button>
              <button disabled={loading} onClick={handleAdd} className={btnPrimary}>
                {loading ? 'Adding...' : 'Add employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
