'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DeleteButton({ id }: { id: string }){
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleDelete = async () => {
    if(!confirm('Delete this time record? This cannot be undone.')) return
    setLoading(true)
    const { error } = await supabase.from('time_entries').delete().eq('id', id)
    setLoading(false)
    if(error){
      alert('Delete failed: ' + error.message + '\n\nIf RLS blocks, run this SQL in Supabase:\nCREATE POLICY \"Admin can delete entries\" ON public.time_entries FOR DELETE TO authenticated USING (exists (select 1 from public.profiles where id = auth.uid() and role = \'admin\'));')
    } else {
      location.reload()
    }
  }

  return (
    <button disabled={loading} onClick={handleDelete} className="px-2.5 py-1 rounded-full text-[11px] border bg-red-50 text-red-600 hover:bg-red-100 border-red-200 disabled:opacity-50">
      {loading ? '...' : 'Delete'}
    </button>
  )
}