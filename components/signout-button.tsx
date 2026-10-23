'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SignOutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (e) {
      window.location.href = '/login'
    } finally {
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleSignOut} 
      disabled={loading}
      className="text-[13px] px-3 py-1.5 rounded-full border bg-white hover:bg-slate-50 disabled:opacity-50"
    >
      {loading ? '...' : 'Sign out'}
    </button>
  )
}
