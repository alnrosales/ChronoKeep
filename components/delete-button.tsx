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
    <button
      disabled={loading}
      onClick={handleDelete}
      aria-label="Delete time record"
      className="h-9 px-3.5 rounded-xl text-[12px] font-semibold border-2 border-[#FFC9C2] bg-[#FFF1EF] text-[#B42318] hover:bg-[#FFE1DD] active:scale-[0.98] transition disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5A4E]/25"
    >
      {loading ? '...' : 'Delete'}
    </button>
  )
}
