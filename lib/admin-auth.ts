import { createClient } from '@/lib/supabase/server'

// Returns the signed-in admin's user id, or null if the request is not from an active admin.
// The identity comes from the session cookie on the server, never from anything the browser sends.
export async function getAdminId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (profile?.role !== 'admin' || profile?.is_active === false) return null
  return user.id
}
