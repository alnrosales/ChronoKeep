# ChronoKeep

Timekeeper for distributed teams. Employees clock in and out, and admins manage people, review time records, correct mistakes, and keep an audit trail of every change.

Built for **Waho Solutions Inc.** by Alistair Rosales. Current version: **5**.

## Features

**Sign in**
- Email and password sign in with Supabase Auth
- Role-based redirect: admins go to `/admin`, employees go to `/employee`
- Deactivated accounts (`is_active = false`) are signed out and blocked
- Live analog clock and world clocks (Manila, Sydney, London) on the login screen

**Admin dashboard (`/admin`)**
- Stats: active/total employees, present today, shifts today, total records
- Time records table (cards on phones) with filters for name or email, year, month and day
- **Admin actions** popup on every record: edit clock in/out, force clock out, delete
- **Admin changes log** under the table: an append-only history of every admin change

**Employee view (`/employee`)**
- Time clock: the work mode (Remote or Onsite) locks once you clock in, and clocking out within a minute asks for a reason
- Quick clock-out reasons are saved in `time_entries.quick_clockout_reason` and shown in the employee's shift history and in the admin Time records
- **My shift summary**: your own shifts with a From and To date picker, totals and average hours
- Shift history of the latest 30 records

**Employee manager**
- Add, edit and delete employees (role, work type, shift times, department, active status)
- Per-employee working records summary with a month filter and total hours
- Deleting an employee is recorded in the admin changes log

**Everywhere**
- Mobile friendly: bottom-sheet popups and card layouts on small screens
- All times are shown in Manila time (`Asia/Manila`, UTC+8)

## Tech stack

- [Next.js](https://nextjs.org/) (App Router, Server Components and Server Actions)
- [Supabase](https://supabase.com/) (Auth and Postgres)
- [Tailwind CSS](https://tailwindcss.com/)
- `next/font/google` (Bricolage Grotesque)

## Getting started

### 1. Install

```bash
npm install
```

### 2. Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# Server-only. Never prefix it with NEXT_PUBLIC_ and never import it in a client component.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Database

The app expects these tables:

| Table | Columns used |
| --- | --- |
| `profiles` | `id` (matches the auth user id), `full_name`, `email`, `role` (`admin` or `employee`), `work_type`, `shift_start`, `shift_ends`, `department`, `is_active` |
| `time_entries` | `id`, `employee_id` (references `profiles.id`), `date` (Manila work date), `clock_in`, `clock_out`, `mode`, `quick_clockout_reason` |

Then run these SQL files **in order** in the Supabase SQL editor:

1. `supabase/admin-audit.sql` creates the `admin_audit_log` table, locks it against updates, deletes and truncates, and adds the edit, force clock out and delete-record functions.
2. `supabase/admin-audit-employees.sql` lets the log record employee deletions and adds the delete-employee function.
3. `supabase/admin-audit-password-reset.sql` lets the log record admin password resets.
4. `supabase/time-entries-quick-clockout.sql` adds the `quick_clockout_reason` column to `time_entries`.
5. `supabase/lock-down-deletes.sql` drops the old admin delete policy and removes direct delete access for browser roles, so the logged admin actions are the only way to delete.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000/login.

To create the first admin, add a user in Supabase Authentication, then set `role = 'admin'` on their row in `profiles`.

## Project structure

```
app/
  login/page.tsx            Login page
  admin/page.tsx            Admin dashboard
  admin/actions.ts          Server actions (edit, force clock out, delete record, delete employee)
  employee/                 Employee view
components/
  time-records.tsx          Filters, records table/cards, admin actions popup
  admin-changes-log.tsx     Read-only admin changes log
  employees-manager.tsx     Employee list, add/edit/delete, working records summary
  signout-button.tsx
supabase/
  admin-audit.sql
  admin-audit-employees.sql
  admin-audit-password-reset.sql
  time-entries-quick-clockout.sql
  lock-down-deletes.sql
lib/supabase/               Supabase browser and server clients
```

## How the admin changes log works

- Every admin edit, forced clock out, record deletion and employee deletion is saved together with a log entry in a **single database transaction**. If logging fails, the change is rolled back.
- The timestamp comes from the database clock, and the admin's identity comes from the signed-in session on the server. Neither can be supplied by the browser.
- Database triggers block `UPDATE`, `DELETE` and `TRUNCATE` on the log table, even for the service role.
- Each entry stores a snapshot of the data before and after the change, plus an optional reason.

## Security notes

- The service role key (`SUPABASE_SERVICE_ROLE_KEY`) is used only in server code: Server Components (`app/admin/page.tsx`) and Server Actions (`app/admin/actions.ts`). It is never prefixed with `NEXT_PUBLIC_` and no client component reads it. The browser only ever gets the anon key.
- Add `import 'server-only'` at the top of `lib/supabase/server.ts` (`npm i server-only`). The build then fails if anything marked `'use client'` ever imports it.
- Every admin action is checked on the server (signed in, role `admin`, account active) before it runs. The admin's identity comes from the session, not from the request.
- Deletes only go through the logged admin actions. `lock-down-deletes.sql` removes the old "Admin can delete entries" policy and revokes `DELETE` on `time_entries` and `profiles` from browser roles.
- The old `/api/delete-employee` route has been removed. It accepted any user id with no sign-in check and bypassed the log. Do not add it back.
- Self-service sign-up code has been removed from the login page. Create users from the employee manager.

## Known limits

- The admin dashboard loads the latest 1,000 time records (`RECORD_LIMIT` in `app/admin/page.tsx`). Filters search only those.
- The Day filter matches the day of the month, so combine it with a month and year for a specific date.
- Adding employees and editing employee profiles (including role changes) are not yet written to the admin changes log.

## License

Internal project of Waho Solutions Inc. By Alistair Rosales
