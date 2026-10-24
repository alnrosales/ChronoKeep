'use server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type Result = { ok: true } | { ok: false; error: string }

// The acting admin always comes from the signed-in session on the server,
// never from anything the browser sends, so log entries can't be attributed to someone else.
async function requireAdmin(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You are not signed in.')
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (profile?.role !== 'admin' || profile?.is_active === false) throw new Error('Only active admins can do this.')
  return user.id
}

// Admins type times in Manila time (UTC+8), e.g. "2026-10-24T08:30".
function manilaToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Invalid date or time.')
  const d = new Date(`${value}:00+08:00`)
  if (isNaN(d.getTime())) throw new Error('Invalid date or time.')
  return d.toISOString()
}

const cleanReason = (r?: string | null) => (r && r.trim() ? r.trim().slice(0, 300) : null)

async function run(fn: (adminId: string) => Promise<{ message: string } | null>): Promise<Result> {
  try {
    const adminId = await requireAdmin()
    const failure = await fn(adminId)
    if (failure) return { ok: false, error: failure.message }
    revalidatePath('/admin')
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Something went wrong.' }
  }
}

export async function editTimeEntry(id: string, clockIn: string, clockOut: string | null, reason?: string): Promise<Result> {
  return run(async (adminId) => {
    const { error } = await createServiceClient().rpc('admin_edit_time_entry', {
      p_entry_id: String(id),
      p_actor: adminId,
      p_clock_in: manilaToIso(clockIn),
      p_clock_out: clockOut ? manilaToIso(clockOut) : null,
      p_reason: cleanReason(reason),
    })
    return error
  })
}

export async function forceClockOut(id: string, reason?: string): Promise<Result> {
  return run(async (adminId) => {
    const { error } = await createServiceClient().rpc('admin_force_clock_out', {
      p_entry_id: String(id),
      p_actor: adminId,
      p_reason: cleanReason(reason),
    })
    return error
  })
}

export async function deleteTimeEntry(id: string, reason?: string): Promise<Result> {
  return run(async (adminId) => {
    const { error } = await createServiceClient().rpc('admin_delete_time_entry', {
      p_entry_id: String(id),
      p_actor: adminId,
      p_reason: cleanReason(reason),
    })
    return error
  })
}
