'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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

export default function EmployeesManager({ employees, trigger }: { employees: Employee[], trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Employee[]>(employees)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  
  // Summary modal states
  const [summaryEmp, setSummaryEmp] = useState<Employee | null>(null)
  const [workLogs, setWorkLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role: 'employee',
    work_type: 'Hybrid',
    shift_start: '09:00',
    shift_ends: '15:00',
    department: '',
    password: ''
  })
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  // Helper to format date as dd-mmm-yy in UTC+8
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      // Shift to UTC+8
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
      hours = hours ? hours : 12 // the hour '0' should be '12'
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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/delete-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id })
      })

      const result = await response.json()

      if (!response.ok) {
        const { error: dbError } = await supabase.from('profiles').delete().eq('id', id)
        if (dbError) {
          alert(`Failed to delete: ${dbError.message}`)
        } else {
          setList((prev) => prev.filter((e) => e.id !== id))
        }
      } else {
        setList((prev) => prev.filter((e) => e.id !== id))
      }
    } catch (err: any) {
      alert(`Delete error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenSummary = async (emp: Employee) => {
    setSummaryEmp(emp)
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
      shift_start: form.shift_start,
      shift_ends: form.shift_ends,
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
      shift_start: form.shift_start,
      shift_ends: form.shift_ends,
      department: form.department || null,
      is_active: true
    }

    setList((prev) => [...prev, newEmployee])
    setForm({ 
      full_name: '', 
      email: '', 
      role: 'employee', 
      work_type: 'Hybrid', 
      shift_start: '09:00', 
      shift_ends: '15:00', 
      department: '', 
      password: '' 
    })
    setLoading(false)
    setShowAddModal(false)
  }

  const handleEdit = async () => {
    if (!editing) return
    setLoading(true)
    const { error } = await supabase.from('profiles').update({
      full_name: editing.full_name,
      email: editing.email,
      role: editing.role,
      work_type: editing.work_type,
      shift_start: editing.shift_start,
      shift_ends: editing.shift_ends,
      department: editing.department,
      is_active: editing.is_active
    }).eq('id', editing.id)
    setLoading(false)
    if (error) {
      alert(error.message)
    } else {
      setList((prev) => prev.map((e) => (e.id === editing.id ? editing : e)))
      setEditing(null)
    }
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{trigger}</div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col rounded-3xl">
            <div className="p-5 border-b flex justify-between items-center">
              <div className="font-semibold">Employees • {list.length}</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setForm({
                      full_name: '',
                      email: '',
                      role: 'employee',
                      work_type: 'Hybrid',
                      shift_start: '09:00',
                      shift_ends: '15:00',
                      department: '',
                      password: ''
                    })
                    setShowAddModal(true)
                  }} 
                  className="px-5 py-2 rounded-full bg-slate-900 text-white text-sm"
                >
                  + Add
                </button>
                <button onClick={() => setOpen(false)} className="px-5 py-2 rounded-full border bg-white text-sm">Close</button>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b text-xs text-slate-500">
                  <tr>
                    <th className="text-left p-3">Full Name</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-left p-3">Work Type</th>
                    <th className="text-left p-3">Shift Start</th>
                    <th className="text-left p-3">Shift Ends</th>
                    <th className="text-left p-3">Department</th>
                    <th className="text-left p-3">Active</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-slate-50">
                      {editing?.id === emp.id ? (
                        <>
                          <td className="p-2"><input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} className="w-full h-8 rounded-full border px-3 text-sm" /></td>
                          <td className="p-2"><input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="w-full h-8 rounded-full border px-3 text-sm" /></td>
                          <td className="p-2"><select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className="h-8 rounded-full border px-2 text-sm"><option>employee</option><option>admin</option></select></td>
                          <td className="p-2"><select value={editing.work_type} onChange={(e) => setEditing({ ...editing, work_type: e.target.value })} className="h-8 rounded-full border px-2 text-sm"><option>Hybrid</option><option>Remote</option><option>Onsite</option></select></td>
                          <td className="p-2"><input type="time" value={editing.shift_start || '09:00'} onChange={(e) => setEditing({ ...editing, shift_start: e.target.value })} className="h-8 rounded-full border px-2 text-sm" /></td>
                          <td className="p-2"><input type="time" value={editing.shift_ends || '15:00'} onChange={(e) => setEditing({ ...editing, shift_ends: e.target.value })} className="h-8 rounded-full border px-2 text-sm" /></td>
                          <td className="p-2"><input value={editing.department || ''} onChange={(e) => setEditing({ ...editing, department: e.target.value })} className="w-full h-8 rounded-full border px-2 text-sm" /></td>
                          <td className="p-2"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /></td>
                          <td className="p-2 flex gap-1"><button onClick={handleEdit} className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs">Save</button><button onClick={() => setEditing(null)} className="px-3 py-1 rounded-full border text-xs">Cancel</button></td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 font-medium">
                            <button 
                              onClick={() => handleOpenSummary(emp)}
                              className="text-left text-slate-900 hover:text-indigo-600 hover:underline cursor-pointer font-medium focus:outline-none"
                              title="Click to view working records summary"
                            >
                              {emp.full_name}
                            </button>
                          </td>
                          <td className="p-3">{emp.email}</td>
                          <td className="p-3">{emp.role}</td>
                          <td className="p-3">{emp.work_type}</td>
                          <td className="p-3 font-mono">{emp.shift_start || '09:00'}</td>
                          <td className="p-3 font-mono">{emp.shift_ends || '15:00'}</td>
                          <td className="p-3">{emp.department || '-'}</td>
                          <td className="p-3">{emp.is_active ? 'Yes' : 'No'}</td>
                          <td className="p-3 flex gap-1">
                            <button onClick={() => setEditing(emp)} className="px-3 py-1 rounded-full border text-xs">Edit</button>
                            <button disabled={loading} onClick={() => handleDelete(emp.id)} className="px-3 py-1 rounded-full bg-red-50 text-red-600 border text-xs">Delete</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal Window */}
      {summaryEmp && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSummaryEmp(null)} />
          <div className="relative bg-white w-full max-w-3xl shadow-2xl p-7 rounded-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-start mb-5 pb-3 border-b">
              <div>
                <h2 className="text-lg font-semibold">{summaryEmp.full_name}&apos;s Working Records</h2>
                <p className="text-xs text-slate-500">{summaryEmp.email} • {summaryEmp.department || 'No Dept'} • {summaryEmp.work_type}</p>
              </div>
              <button onClick={() => setSummaryEmp(null)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">✕</button>
            </div>
            
            <div className="overflow-y-auto flex-1">
              {loadingLogs ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading records...</div>
              ) : workLogs.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No working records found for this employee.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b text-xs text-slate-500">
                    <tr>
                      <th className="text-left p-3">Date (UTC+8)</th>
                      <th className="text-left p-3">Clock In</th>
                      <th className="text-left p-3">Clock Out</th>
                      <th className="text-left p-3">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workLogs.map((log, idx) => (
                      <tr key={log.id || idx} className="border-b hover:bg-slate-50">
                        <td className="p-3 text-xs text-slate-600">{formatDate(log.date)}</td>
                        <td className="p-3 font-mono">{formatTime12hr(log.clock_in)}</td>
                        <td className="p-3 font-mono">{formatTime12hr(log.clock_out)}</td>
                        <td className="p-3 font-semibold text-indigo-600">{calculateHours(log.clock_in, log.clock_out)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-5 pt-3 border-t flex justify-between items-center text-xs text-slate-500">
              <div>Total Records Found: {workLogs.length}</div>
              <button onClick={() => setSummaryEmp(null)} className="px-5 py-2 rounded-full border bg-white text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white w-full max-w-md shadow-2xl p-7 rounded-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <h2 className="text-lg font-semibold">Add Employee</h2>
              <button onClick={() => setShowAddModal(false)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">✕</button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Full name" className="w-full h-11 rounded-full border px-4 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email address" className="w-full h-11 rounded-full border px-4 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password *</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" className="w-full h-11 rounded-full border px-4 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Work Type</label>
                <select 
                  value={form.work_type} 
                  onChange={(e) => setForm({ ...form, work_type: e.target.value })} 
                  className="w-full h-11 rounded-full border px-4 text-sm bg-white"
                >
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                  <option value="Onsite">Onsite</option>