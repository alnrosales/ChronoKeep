import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
export async function middleware(request: NextRequest) { return await updateSession(request) }
// api/admin/time-records is left out on purpose: the route checks the admin session itself, and skipping
// the middleware saves one Supabase Auth round trip on every search keystroke.
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/admin/time-records|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
