```ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const PROTECTED_EMAIL = 'al@kulbakaayo.com'

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        {
          error:
            'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in env variables',
        },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Check the target employee's profile before deleting anything.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to verify employee profile.' },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Employee profile not found.' },
        { status: 404 }
      )
    }

    // Protect the specified account from deletion.
    if (profile.email?.trim().toLowerCase() === PROTECTED_EMAIL) {
      return NextResponse.json(
        { error: 'This employee account is protected from deletion.' },
        { status: 403 }
      )
    }

    // Delete user from Supabase Auth.
    const { error: authError } =
      await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    // Explicitly delete from profiles table.
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (deleteProfileError) {
      return NextResponse.json(
        {
          error:
            'Auth user was deleted, but deleting the employee profile failed.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Server error'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
```