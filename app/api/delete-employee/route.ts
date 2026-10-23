import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in env variables' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Delete user from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Explicitly delete from profiles table
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}