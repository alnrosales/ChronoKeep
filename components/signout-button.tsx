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
      className="h-10 px-4 rounded-2xl bg-white text-[#4B2BF0] text-[13px] font-bold shadow-sm hover:bg-[#F6F4FF] active:scale-[0.98] transition disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
    >
      {loading ? '...' : 'Sign out'}
    </button>
  )
}
