import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminId } from '@/lib/admin-auth'
import { queryTimeRecords } from '@/lib/time-records-query'

export const dynamic = 'force-dynamic'

// Search and filter for the admin Time records list.
// A route handler (not a server action) on purpose: requests run in parallel and the browser can
// cancel the ones that are already out of date while the admin is still typing.
export async function GET(request: NextRequest) {
  const adminId = await getAdminId()
  if (!adminId) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const result = await queryTimeRecords(
    createServiceClient(),
    { q: sp.get('q') ?? '', year: sp.get('year') ?? '', month: sp.get('month') ?? '', day: sp.get('day') ?? '' },
    Number(sp.get('page') || 1),
    Number(sp.get('size') || 0)
  )

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
