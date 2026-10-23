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
  department: string | null
  is_active: boolean
}

export default function EmployeesManager({ employees, trigger }: { employees: Employee[], trigger: React.ReactNode }){
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Employee[]>(employees)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', role: 'employee', work_type: 'Hybrid', shift_start: '09:00', department: '', password: '' })
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
        department: form.department,
        is_active: true
      })
      if(insertErr) { alert(insertErr.message); setLoading(false); return }
    } else if(data.user){
      await supabase.from('profiles').update({
        work_type: form.work_type,
        shift_start: form.shift_start,
        department: form.department,
        role: form.role
      }).eq('id', data.user.id)
    }
    setLoading(false)
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
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setOpen(false)} />
          <div className="relative bg-white rounded- w-full max-w- max-h- overflow-hidden shadow-2xl m-4 flex flex-col">
            <div className="p-5 border-b flex justify-between items-center">
              <div><div className="font-semibold">Employees • {list.length}</div><div className="text- text-slate-500">full_name, email, role, work_type, shift_start, department • Add/Edit/Delete</div></div>
              <div className="flex gap-2">
                <button onClick={()=>setShowAdd(!showAdd)} className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-">+ Add</button>
                <button onClick={()=>setOpen(false)} className="px-3 py-1.5 rounded-full border bg-white text-">Close</button>
              </div>
            </div>
            {showAdd && (
              <div className="p-4 bg-slate-50 border-b grid grid-cols-2 lg:grid-cols-4 gap-3">
                <input value={form.full_name} onChange={e=>setForm({...form, full_name: e.target.value})} placeholder="Full name" className="h-9 rounded-xl border px-3 text-" />
                <input value={form.email} onChange={e=>setForm({...form, email: e.target.value})} placeholder="Email" className="h-9 rounded-xl border px-3 text-" />
                <input value={form.password} onChange={e=>setForm({...form, password: e.target.value})} placeholder="Password" className="h-9 rounded-xl border px-3 text-" />
                <select value={form.role} onChange={e=>setForm({...form, role: e.target.value})} className="h-9 rounded-xl border px-2 text-"><option value="employee">employee</option><option value="admin">admin</option></select>
                <select value={form.work_type} onChange={e=>setForm({...form, work_type: e.target.value})} className="h-9 rounded-xl border px-2 text-"><option>Hybrid</option><option>Remote</option><option>Onsite</option></select>
                <input type="time" value={form.shift_start} onChange={e=>setForm({...form, shift_start: e.target.value})} className="h-9 rounded-xl border px-3 text-" />
                <input value={form.department} onChange={e=>setForm({...form, department: e.target.value})} placeholder="Department" className="h-9 rounded-xl border px-3 text-" />
                <button disabled={loading} onClick={handleAdd} className="h-9 rounded-xl bg-slate-900 text-white text-">{loading?'...':'Create'}</button>
              </div>
            )}
            <div className="overflow-auto flex-1">
              <table className="w-full text-">
                <thead className="sticky top-0 bg-slate-50 border-b text- text-slate-500">
                  <tr><th className="text-left p-2.5">Full Name</th><th className="text-left p-2.5">Email</th><th className="text-left p-2.5">Role</th><th className="text-left p-2.5">Work Type</th><th className="text-left p-2.5">Shift Start</th><th className="text-left p-2.5">Department</th><th className="text-left p-2.5">Active</th><th className="text-left p-2.5">Actions</th></tr>
                </thead>
                <tbody>
                  {list.map(emp => (
                    <tr key={emp.id} className="border-b hover:bg-slate-50">
                      {editing?.id === emp.id ? (
                        <>
                          <td className="p-2"><input value={editing.full_name} onChange={e=>setEditing({...editing, full_name: e.target.value})} className="w-full h-8 rounded-lg border px-2 text-" /></td>
                          <td className="p-2"><input value={editing.email} onChange={e=>setEditing({...editing, email: e.target.value})} className="w-full h-8 rounded-lg border px-2 text-" /></td>
                          <td className="p-2"><select value={editing.role} onChange={e=>setEditing({...editing, role: e.target.value})} className="h-8 rounded-lg border px-2 text-"><option>employee</option><option>admin</option></select></td>
                          <td className="p-2"><select value={editing.work_type} onChange={e=>setEditing({...editing, work_type: e.target.value})} className="h-8 rounded-lg border px-2 text-"><option>Hybrid</option><option>Remote</option><option>Onsite</option></select></td>
                          <td className="p-2"><input type="time" value={editing.shift_start || '09:00'} onChange={e=>setEditing({...editing, shift_start: e.target.value})} className="h-8 rounded-lg border px-2 text-" /></td>
                          <td className="p-2"><input value={editing.department || ''} onChange={e=>setEditing({...editing, department: e.target.value})} className="w-full h-8 rounded-lg border px-2 text-" /></td>
                          <td className="p-2"><input type="checkbox" checked={editing.is_active} onChange={e=>setEditing({...editing, is_active: e.target.checked})} /></td>
                          <td className="p-2 flex gap-1"><button onClick={handleEdit} className="px-2 py-1 rounded-full bg-emerald-600 text-white text-">Save</button><button onClick={()=>setEditing(null)} className="px-2 py-1 rounded-full border bg-white text-">Cancel</button></td>
                        </>
                      ) : (
                        <>
                          <td className="p-2.5 font-medium">{emp.full_name}</td>
                          <td className="p-2.5">{emp.email}</td>
                          <td className="p-2.5"><span className={`px-2 py-1 rounded-full text- border ${emp.role==='admin'?'bg-indigo-50 text-indigo-700':'bg-slate-50'}`}>{emp.role}</span></td>
                          <td className="p-2.5">{emp.work_type}</td>
                          <td className="p-2.5 font-mono">{emp.shift_start || '09:00'}</td>
                          <td className="p-2.5">{emp.department || '-'}</td>
                          <td className="p-2.5">{emp.is_active ? 'Yes' : 'No'}</td>
                          <td className="p-2.5 flex gap-1"><button onClick={()=>setEditing(emp)} className="px-2 py-1 rounded-full border bg-white text-">Edit</button><button onClick={()=>handleDelete(emp.id)} className="px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 text-">Delete</button></td>
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
    </>
  )
}