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

export async function deleteEmployee(id: string, reason?: string): Promise<Result> {
  return run(async (adminId) => {
    const { error } = await createServiceClient().rpc('admin_delete_employee', {
      p_employee_id: id,
      p_actor: adminId,
      p_reason: cleanReason(reason),
    })
    // 23503 = foreign key violation (the employee still has linked records)
    if (error?.code === '23503') return { message: 'This employee still has linked records that block deletion.' }
    return error
  })
}

export async function resetEmployeePassword(id: string, newPassword: string, reason?: string): Promise<Result> {
  return run(async (adminId) => {
    if (typeof newPassword !== 'string' || newPassword.length < 8) return { message: 'Password must be at least 8 characters.' }
    if (newPassword.length > 72) return { message: 'Password must be 72 characters or fewer.' }

    const db = createServiceClient()
    const { data: target } = await db.from('profiles').select('id').eq('id', id).single()
    if (!target) return { message: 'Employee not found.' }

    const { error } = await db.auth.admin.updateUserById(id, { password: newPassword })
    if (error) return error

    // Record it in the admin changes log. The password itself is never logged.
    const { error: logError } = await db.rpc('admin_log_password_reset', {
      p_employee_id: id,
      p_actor: adminId,
      p_reason: cleanReason(reason),
    })
    if (logError) return { message: `The password was changed, but writing the log entry failed: ${logError.message}` }
    return null
  })
}

// Edit an employee's profile. Runs on the server with the service role so the save can't be
// silently blocked by row-level security, and keeps the sign-in (auth) email in step with the profile email.
export async function updateEmployee(
  id: string,
  f: {
    full_name: string; email: string; role: string; work_type: string
    shift_start: string | null; shift_ends: string | null; department: string | null; is_active: boolean
  }
): Promise<Result> {
  return run(async (adminId) => {
    const email = String(f.email || '').trim().toLowerCase()
    const fullName = String(f.full_name || '').trim()
    if (!fullName) return { message: 'Full name is required.' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { message: 'Enter a valid email address.' }
    if (f.role !== 'admin' && f.role !== 'employee') return { message: 'Invalid role.' }
    if (id === adminId && (f.role !== 'admin' || f.is_active === false)) {
      return { message: "You can't remove your own admin access or deactivate your own account." }
    }

    const db = createServiceClient()
    const { data: current } = await db.from('profiles').select('email').eq('id', id).single()
    if (!current) return { message: 'Employee not found.' }

    // The email they sign in with lives in Supabase Auth. Compare against Auth itself (not just the
    // profile) so a sign-in email left changed by an earlier failed save doesn't cause a false error.
    const { data: authData } = await db.auth.admin.getUserById(id)
    const originalAuthEmail = authData?.user?.email || null
    const authNeedsChange = String(originalAuthEmail || '').toLowerCase() !== email
    if (authNeedsChange) {
      const { error } = await db.auth.admin.updateUserById(id, { email, email_confirm: true })
      if (error) {
        return { message: /already|registered|exists/i.test(error.message) ? 'That email address is already in use.' : error.message }
      }
    }
    // Put the sign-in email back if the profile save below doesn't go through, so the two never disagree
    const undoAuthChange = async () => {
      if (authNeedsChange && originalAuthEmail) await db.auth.admin.updateUserById(id, { email: originalAuthEmail, email_confirm: true })
    }

    const { data: saved, error: saveError } = await db
      .from('profiles')
      .update({
        full_name: fullName,
        email,
        role: f.role,
        work_type: f.work_type,
        shift_start: f.shift_start,
        shift_ends: f.shift_ends,
        department: f.department || null,
        is_active: !!f.is_active,
      })
      .eq('id', id)
      .select('id')

    if (saveError || !saved || saved.length !== 1) {
      await undoAuthChange()
      return { message: saveError?.message || 'Nothing was saved. The employee may no longer exist.' }
    }

    // Read it back to be sure nothing in the database (a trigger or sync rule) changed it again
    const { data: fresh } = await db.from('profiles').select('email').eq('id', id).single()
    if (fresh && String(fresh.email || '').toLowerCase() !== email) {
      await undoAuthChange()
      return {
        message: `The database changed the profile email back to "${fresh.email}" right after saving, so nothing was changed. A trigger on public.profiles or auth.users is probably doing this.`,
      }
    }
    return null
  })
}

// NEW: Create employee via service role - fixes the ANON_KEY / RLS issue
export async function createEmployee(f: {
  full_name: string
  email: string
  password: string
  role: string
  work_type: string
  shift_start: string | null
  shift_ends: string | null
  department: string | null
}): Promise<Result> {
  return run(async () => {
    const email = String(f.email || '').trim().toLowerCase()
    const fullName = String(f.full_name || '').trim()
    const password = String(f.password || '')

    if (!fullName) return { message: 'Full name is required.' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { message: 'Enter a valid email address.' }
    if (password.length < 8) return { message: 'Password must be at least 8 characters.' }
    if (password.length > 72) return { message: 'Password must be 72 characters or fewer.' }
    if (f.role !== 'admin' && f.role !== 'employee') return { message: 'Invalid role.' }

    const db = createServiceClient()

    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: f.role },
    })

    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        return { message: 'That email is already registered. Delete it from Supabase Authentication > Users first.' }
      }
      return error
    }

    if (!data.user) return { message: 'User could not be created.' }

    const { error: profileError } = await db.from('profiles').insert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: f.role,
      work_type: f.work_type,
      shift_start: f.shift_start,
      shift_ends: f.shift_ends,
      department: f.department || null,
      is_active: true,
    })

    if (profileError) {
      await db.auth.admin.deleteUser(data.user.id)
      return { message: profileError.message }
    }

    return null
  })
}