'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Employee = {
  id: string; full_name: string; email: string; role: string;
  work_type: string; shift_start: string | null; shift_ends: string | null;
  department: string | null; is_active: boolean
}

export default function EmployeesManager({ employees, trigger }: { employees: Employee[], trigger: React.ReactNode }){
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Employee[]>(employees)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', role: 'employee', work_type: 'Hybrid', shift_start: '09:00', shift_ends: '15:00', department: '', password: '' })
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if(!form.email || !form.full_name) return alert('Name and email required')
    setLoading(true)
    let newId = crypto.randomUUID()
    const { data, error } = await supabase.auth.signUp({
      email: form.email, password: form.password || 'Password123!',
      options: { data: { full_name: form.full_name, role: form.role } }
    })
    if(error){
      const { error: e } = await supabase.from('profiles').insert({
        id: newId, email: form.email, full_name: form.full_name, role: form.role,
        work_type: form.work_type, shift_start: form.shift_start, shift_ends: form.shift_ends,
        department: form.department, is_active: true
      })
      if(e){ alert(e.message); setLoading(false); return }
    } else if(data.user){
      newId = data.user.id
      await supabase.from('profiles').update({
        work_type: form.work_type, shift_start: form.shift_start, shift_ends: form.shift_ends,
        department: form.department, role: form.role
      }).eq('id', newId)
    }
    setList(prev => [...prev, { id: newId, full_name: form.full_name, email: form.email, role: form.role, work_type: form.work_type, shift_start: form.shift_start, shift_ends: form.shift_ends, department: form.department || null, is_active: true }])
    setForm({ full_name: '', email: '', role: 'employee', work_type: 'Hybrid', shift_start: '09:00', shift_ends: '15:00', department: '', password: '' })
    setLoading(false)
    setShowAddModal(false) // <- back to previews window
  }

  const handleEdit = async () => {
    if(!editing) return
    setLoading(true)
    const { error } = await supabase.from('profiles').update({
      full_name: editing.full_name, email: editing.email, role: editing.role, work_type: editing.work_type,
      shift_start: editing.shift_start, shift_ends: editing.shift_ends, department: editing.department, is_active: editing.is_active
    }).eq('id', editing.id)
    setLoading(false)
    if(error) alert(error.message)
    else { setList(list.map(e => e.id === editing.id ? editing : e)); setEditing(null) }
  }

  const handleDelete = async (id: string) => {
    if(!confirm('Delete?')) return
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if(!error) setList(list.filter(e => e.id !== id))
  }

  return (
    <>
      <div onClick={()=>setOpen(true)}>{trigger}</div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setOpen(false)} />
          {/* ROUND WINDOW */}
          <div className="relative bg-white rounded-3xl w-full max-w-6xl max-h- overflow-hidden shadow-2xl flex flex-col" style={{borderRadius: '24px'}}>
            <div className="p-5 border-b flex justify-between items-center">
              <div className="font-semibold">Employees • {list.length}</div>
              <div className="flex gap-2">
                <button onClick={()=>setShowAddModal(true)} className="px-5 py-2 rounded-full bg-slate-900 text-white text-sm">+ Add</button>
                <button onClick={()=>setOpen(false)} className="px-5 py-2 rounded-full border bg-white text-sm">Close</button>
              </div>
            </div>
            <div className="overflow-auto flex-1 rounded-b-3xl">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b text-xs text-slate-500">
                  <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Email</th><th className="text-left p-3">Role</th><th className="text-left p-3">Type</th><th className="text-left p-3">Start</th><th className="text-left p-3">Ends</th><th className="text-left p-3">Dept</th><th className="text-left p-3">Active</th><th className="text-left p-3">Actions</th></tr>
                </thead>
                <tbody>
                  {list.map(emp => (
                    <tr key={emp.id} className="border-b">
                      {editing?.id === emp.id ? (
                        <>
                          <td className="p-2"><input value={editing.full_name} onChange={e=>setEditing({...editing, full_name: e.target.value})} className="w-full h-8 rounded-full border px-3 text-sm" /></td>
                          <td className="p-2"><input value={editing.email} onChange={e=>setEditing({...editing, email: e.target.value})} className="w-full h-8 rounded-full border px-3 text-sm" /></td>
                          <td className="p-2"><select value={editing.role} onChange={e=>setEditing({...editing, role: e.target.value})} className="h-8 rounded-full border px-2 text-sm"><option>employee</option><option>admin</option></select></td>
                          <td className="p-2"><select value={editing.work_type} onChange={e=>setEditing({...editing, work_type: e.target.value})} className="h-8 rounded-full border px-2 text-sm"><option>Hybrid</option><option>Remote</option><option>Onsite</option></select></td>
                          <td className="p-2"><input type="time" value={editing.shift_start || ''} onChange={e=>setEditing({...editing, shift_start: e.target.value})} className="h-8 rounded-full border px-2 text-sm" /></td>
                          <td className="p-2"><input type="time" value={editing.shift_ends || ''} onChange={e=>setEditing({...editing, shift_ends: e.target.value})} className="h-8 rounded-full border px-2 text-sm" /></td>
                          <td className="p-2"><input value={editing.department || ''} onChange={e=>setEditing({...editing, department: e.target.value})} className="w-full h-8 rounded-full border px-2 text-sm" /></td>
                          <td className="p-2"><input type="checkbox" checked={editing.is_active} onChange={e=>setEditing({...editing, is_active: e.target.checked})} /></td>
                          <td className="p-2 flex gap-1"><button onClick={handleEdit} className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs">Save</button><button onClick={()=>setEditing(null)} className="px-3 py-1 rounded-full border text-xs">Cancel</button></td>
                        </>
                      ) : (
                        <>
                          <td className="p-3">{emp.full_name}</td><td className="p-3">{emp.email}</td><td className="p-3">{emp.role}</td><td className="p-3">{emp.work_type}</td>
                          <td className="p-3 font-mono">{emp.shift_start}</td><td className="p-3 font-mono">{emp.shift_ends}</td>
                          <td className="p-3">{emp.department || '-'}</td><td className="p-3">{emp.is_active?'Yes':'No'}</td>
                          <td className="p-3 flex gap-1"><button onClick={()=>setEditing(emp)} className="px-3 py-1 rounded-full border text-xs">Edit</button><button onClick={()=>handleDelete(emp.id)} className="px-3 py-1 rounded-full bg-red-50 text-red-600 border text-xs">Delete</button></td>
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

      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowAddModal(false)} />
          {/* ROUND ADD FORM */}
          <div className="relative bg-white rounded-3xl w-full max-w- shadow-2xl p-7" style={{borderRadius: '24px'}}>
            <h2 className="text-lg font-semibold">