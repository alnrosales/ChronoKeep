'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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

export default function EmployeesManager({ employees, trigger }: { employees: Employee[], trigger: React.ReactNode }){
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Employee[]>(employees)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', role: 'employee', work_type: 'Hybrid', shift_start: '09:00', shift_ends: '15:00', department: '', password: '' })
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const handleDelete = async (id: string) => {
    if(!confirm('Delete employee?')) return
    setLoading(true)
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    setLoading(false)
    if(error) alert(error.message)
    else setList(list.filter(e => e.id !== id))
  }

  const handleAdd = async () => {
    if(!form.email || !form.full_name) { alert('Name and email required'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password || 'Password123!',
      options: { data: { full_name: form.full_name, role: form.role } }
    })
    if(error){
      const { error: insertErr } = await supabase.from('profiles').insert({
        id: crypto.randomUUID(),
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        work_type: form.work_type,
        shift_start: form.shift_start,
        shift_ends: form.shift_ends,
        department: form.department,
        is_active: true
      })
      if(insertErr) { alert(insertErr.message); setLoading(false); return }
    } else if(data.user){
      await supabase.from('profiles').update({
        work_type: form.work_type,
        shift_start: form.shift_start,
        shift_ends: form.shift_ends,
        department: form.department,
        role: form.role
      }).eq('id', data.user.id)
    }
    setLoading(false)
    setShowAddModal(false)
    location.reload()
  }

  const handleEdit = async () => {
    if(!editing) return
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
    if(error) alert(error.message)
    else { setList(list.map(e => e.id === editing.id ? editing : e)); setEditing(null) }
  }

  return (
    <>
      <div onClick={()=>setOpen(true)}>{trigger}</div>

      {/* Main Employees Window */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setOpen(false)} />
          <div className="relative bg-white rounded- w-full max-w-6xl max-h- overflow-hidden shadow-2xl flex flex-col border">
            <div className="p-5 border-b flex justify-between items-center">
              <div className="font-semibold">Employees • {list.length}</div>
              <div className="flex gap-2">
                <button onClick={()=>setShowAddModal(true)} className="px-4 py-1.5 rounded-full bg-slate-900 text-white text-sm hover:bg-black">+ Add</button>
                <button onClick={()=>setOpen(false)} className="px-4 py-1.5 rounded-full border bg-white text-sm">Close</button>
              </div>
            </div>

            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b text-xs text-slate-500">
                  <tr>
                    <th className="text-left p-2.5">Full Name</th>
                    <th className="text-left p-2.5">Email</th>
                    <th className="text-left p-2.5">Role</th>
                    <th className="text-left p-2.5">Work Type</th>
                    <th className="text-left p-2.5">Shift Start</th>
                    <th className="text-left p-2.5">Shift Ends</th>
                    <th className="text-left p-2.5">Department</th>
                    <th className="text-left p-2.5">Active</th>
                    <th className="text-left p-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(emp => (
                    <tr key={emp.id} className="border-b hover:bg-slate-50">
                      {editing?.id === emp.id ? (
                        <>
                          <td className="p-2"><input value={editing.full_name} onChange={e=>setEditing({...editing, full_name: e.target.value})} className="w-full h-8 rounded-lg border px-2 text-sm" /></td>
                          <td className="p-2"><input value={editing.email} onChange={e=>setEditing({...editing, email: e.target.value})} className="w-full h-8 rounded-lg border px-2 text-sm" /></td>
                          <td className="p-2"><select value={editing.role} onChange={e=>setEditing({...editing, role: e.target.value})} className="h-8 rounded-lg border px-2 text-sm"><option>employee</option><option>admin</option></select></td>
                          <td className="p-2"><select value={editing.work_type} onChange={e=>setEditing({...editing, work_type: e.target.value})} className="h-8 rounded-lg border px-2 text-sm"><option>Hybrid</option><option>Remote</option><option>Onsite</option></select></td>
                          <td className="p-2"><input type="time" value={editing.shift_start || '09:00'} onChange={e=>setEditing({...editing, shift_start: e.target.value})} className="h-8 rounded-lg border px-2 text-sm" /></td>
                          <td className="p-2"><input type="time" value={editing.shift_ends || '15:00'} onChange={e=>setEditing({...editing, shift_ends: e.target.value})} className="h-8 rounded-lg border px-2 text-sm" /></td>
                          <td className="p-2"><input value={editing.department || ''} onChange={e=>setEditing({...editing, department: e.target.value})} className="w-full h-8 rounded-lg border px-2 text-sm" /></td>
                          <td className="p-2"><input type="checkbox" checked={editing.is_active} onChange={e=>setEditing({...editing, is_active: e.target.checked})} /></td>
                          <td className="p-2 flex gap-1"><button onClick={handleEdit} className="px-2 py-1 rounded-full bg-emerald-600 text-white text-xs">Save</button><button onClick={()=>setEditing(null)} className="px-2 py-1 rounded-full border bg-white text-xs">Cancel</button></td>
                        </>
                      ) : (
                        <>
                          <td className="p-2.5 font-medium">{emp.full_name}</td>
                          <td className="p-2.5">{emp.email}</td>
                          <td className="p-2.5"><span className={`px-2 py-1 rounded-full text-xs border ${emp.role==='admin'?'bg-indigo-50 text-indigo-700':'bg-slate-50'}`}>{emp.role}</span></td>
                          <td className="p-2.5">{emp.work_type}</td>
                          <td className="p-2.5 font-mono">{emp.shift_start || '09:00'}</td>
                          <td className="p-2.5 font-mono">{emp.shift_ends || '15:00'}</td>
                          <td className="p-2.5">{emp.department || '-'}</td>
                          <td className="p-2.5">{emp.is_active ? 'Yes' : 'No'}</td>
                          <td className="p-2.5 flex gap-1"><button onClick={()=>setEditing(emp)} className="px-2 py-1 rounded-full border bg-white text-xs">Edit</button><button onClick={()=>handleDelete(emp.id)} className="px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 text-xs">Delete</button></td>
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

      {/* Separate Add Employee Form Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=>setShowAddModal(false)} />
          <div className="relative bg-white rounded- w-full max-w- shadow-2xl p-6 animate-in fade-in zoom-in">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-lg font-semibold">Add Employee</h2>
                <p className="text-sm text-slate-500">Create a new employee profile</p>
              </div>
              <button onClick={()=>setShowAddModal(false)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">✕</button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input value={form.full_name} onChange={e=>setForm({...form, full_name: e.target.value})} placeholder="Full name *" className="h-11 rounded-xl border px-4 text-sm w-full" />
              <input value={form.email} onChange={e=>setForm({...form, email: e.target.value})} placeholder="Email *" className="h-11 rounded-xl border px-4 text-sm w-full" />
              <input value={form.password} onChange={e=>setForm({...form, password: e.target.value})} placeholder="Password (default: Password123!)" className="h-11 rounded-xl border px-4 text-sm w-full" />
              
              <div className="grid grid-cols-2 gap-3">
                <select value={form.role} onChange={e=>setForm({...form, role: e.target.value})} className="h-11 rounded-xl border px-3 text-sm"><option value="employee">Employee</option><option value="admin">Admin</option></select>
                <select value={form.work_type} onChange={e=>setForm({...form, work_type: e.target.value})} className="h-11 rounded-xl border px-3 text-sm"><option>Hybrid</option><option>Remote</option><option>Onsite</option></select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 ml-1">Shift Start</label>
                  <input type="time" value={form.shift_start} onChange={e=>setForm({...form, shift_start: e.target.value})} className="h-11 rounded-xl border px-3 text-sm w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 ml-1">Shift Ends</label>
                  <input type="time" value={form.shift_ends} onChange={e=>setForm({...form, shift_ends: e.target.value})} className="h-11 rounded-xl border px-3 text-sm w-full mt-1" />
                </div>
              </div>

              <input value={form.department} onChange={e=>setForm({...form, department: e.target.value})} placeholder="Department" className="h-11 rounded-xl border px-4 text-sm w-full" />
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowAddModal(false)} className="flex-1 h-11 rounded-full border bg-white text-sm font-medium">Cancel</button>
              <button disabled={loading} onClick={handleAdd} className="flex-1 h-11 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-black disabled:opacity-50">{loading ? 'Creating...' : 'Create Employee'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}