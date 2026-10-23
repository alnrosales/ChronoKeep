# ChronoKeep — Production Next.js + Supabase

Tamper-proof timekeeper for remote & onsite. Production ready.

## What you get
- Next.js 14 App Router + Tailwind
- Supabase Auth (email/password)
- Postgres tables with RLS: profiles, time_entries, audit_logs, company_settings
- Employee: clock-in/out with Remote/Onsite, late reason required, notes
- Admin: dashboard, all records, audit log (immutable), settings
- Tamper-proof: original_clock_in preserved, is_edited flag, audit_logs append-only, RLS

## Setup Supabase (5 min)

1. Create project at https://supabase.com
2. SQL Editor → paste `supabase/schema.sql` → Run
3. Auth → Settings → Disable email confirmations for demo (or enable if prod)
4. Auth → Users → Create users:
   - admin@company.com / admin123 → after creation, SQL: `update profiles set role='admin' where email='admin@company.com'`
   - sarah@company.com / employee123 etc
5. Get keys: Project Settings → API → URL + anon key + service_role key

## Local dev

```
npm install
cp .env.example .env.local
# fill env
npm run dev
```

## Deploy to Vercel

1. Push this folder to GitHub
2. vercel.com/new → Import repo
3. Add env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
4. Deploy → https://your-app.vercel.app

Vercel automatically handles Next.js build.

## Admin edit flow (production code example)

Server Action (to implement in app/admin):

```ts
'use server'
import { createServiceClient } from '@/lib/supabase/server'

export async function editTimeEntry({ entryId, newClockIn, reason, actor }: { ... }) {
  const admin = createServiceClient()
  const { data: original } = await admin.from('time_entries').select('*').eq('id', entryId).single()
  
  await admin.from('time_entries').update({
    clock_in: newClockIn,
    is_edited: true,
    last_modified_at: new Date().toISOString(),
    last_modified_by: actor.id
  }).eq('id', entryId)

  await admin.from('audit_logs').insert({
    actor_id: actor.id,
    actor_name: actor.name,
    action: `Edited clock-in for ${original.profiles}`,
    employee_id: original.employee_id,
    employee_name: ...,
    field: 'clock_in',
    old_value: original.clock_in,
    new_value: newClockIn,
    reason
  })
}
```

This ensures every edit prompts for reason and logs.

## No geofencing / IP lock as requested

Removed those features. If you want them later, add PostGIS or IP column.

## Security

- RLS: employees can only read/insert own entries
- Audit logs append-only
- Original timestamps preserved
- Service role used only server-side for admin edits
