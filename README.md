# ChronoKeep

Timekeeper for distributed teams. Employees clock in and out, and admins manage people, review time records, correct mistakes, and keep an audit trail of every sensitive change.

Built for **Waho Solutions Inc.** by Alistair Rosales. Current version: **6.1 Beta**.

## Features

### Sign in
- Email and password sign in with Supabase Auth
- Role-based redirect: admins go to `/admin`, employees go to `/employee`
- Deactivated accounts (`is_active = false`) are signed out right after login and blocked
- Unauthenticated visitors are redirected to `/login` by middleware
- Live analog clock and world clocks (Manila, Sydney, London) on the login screen
- Mobile keyboard handling so the focused field is never hidden

### Employee view (`/employee`)
- **Time clock** with a live Manila clock, the employee's shift hours, and Remote or Onsite work mode
- The work mode locks once you clock in and unlocks after you clock out
- Clocking out within one minute of clocking in asks for a reason (pick a common one or type your own)
- Quick clock-out reasons are saved in `time_entries.quick_clockout_reason` and shown in the employee's history and in the admin Time records
- **Today's status** and **Latest shift** overview cards
- **My shift summary**: your own shifts for any From and To date, with presets (This month, Last 7 days, Last 30 days) and totals (total hours, shifts, days worked, average hours per shift)
- **My shift history**: your latest 30 records

### Admin dashboard (`/admin`)
- Stats: active and total employees, present today, shifts today, total records
- **Time records** table (cards on phones) with:
  - Search by name or email (debounced, updates the URL)
  - Year, month and day filters
  - Server-side pagination with 100, 500 or 1,000 rows per page
  - Total hours per shift and a highlight for today's rows
- **Admin actions** popup on every record: edit clock in/out, force clock out, delete record
- **Admin changes log** under the table: an append-only history of the latest 200 admin changes

### Employee manager (click the Employees card)
- Search employees by name, email, role, work type or group
- Add employees with a 12-hour shift time picker
- Edit employees (name, email, role, work type, shift times, group, active status). Changing the email also updates the sign-in email in Supabase Auth
- **Reset password** with a generator (8 characters, no look-alike characters) and a copy button. The password is never stored in the log
- Delete employees through the logged server action
- Per-employee working records summary with a month filter and total hours

### Everywhere
- Mobile friendly: bottom-sheet popups and card layouts on small screens
- All times are shown in Manila time (`Asia/Manila`, UTC+8)

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router, Server Components and Server Actions)
- [Supabase](https://supabase.com/) (Auth and Postgres) with `@supabase/ssr`
- [Tailwind CSS](https://tailwindcss.com/)
- `next/font/google` (Bricolage Grotesque for headings)
- Vercel Analytics and Speed Insights

## Getting started

### 1. Requirements

- Node.js **22 or newer** (required by the current `@supabase/*` packages)
- A Supabase project

### 2. Install

```bash
npm install
```

### 3. Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# Server-only. Never prefix it with NEXT_PUBLIC_ and never import it in a client component.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Database

Run the SQL in the Supabase SQL editor.

**Tables the app uses**

| Table | Columns used |
| --- | --- |
| `profiles` | `id` (matches the auth user id), `full_name`, `email`, `role` (`admin` or `employee`), `work_type` (`Hybrid`, `Remote`, `Onsite`), `shift_start`, `shift_ends`, `department` (shown as "Group"), `is_active` |
| `time_entries` | `id`, `employee_id` (references `profiles.id`), `date` (Manila work date), `clock_in`, `clock_out`, `mode`, `status`, `notes`, `quick_clockout_reason` |
| `company_settings` | One settings row, read on the employee page |
| `admin_audit_log` | Written only by the admin functions below |

**SQL files, in order**

1. `supabase/schema.sql` is the base schema export (tables, indexes, RLS, and the admin audit functions).
2. `supabase/admin-audit.sql` creates the `admin_audit_log` table, locks it against updates, deletes and truncates, and adds the edit, force clock out and delete-record functions.
3. `supabase/admin-audit-employees.sql` lets the log record employee deletions and adds the delete-employee function.
4. `supabase/admin-audit-password-reset.sql` lets the log record admin password resets.
5. `supabase/time-entries-quick-clockout.sql` adds the `quick_clockout_reason` column to `time_entries`.
6. `supabase/lock-down-deletes.sql` drops the old admin delete policy and removes direct delete access for browser roles, so the logged admin actions are the only way to delete.

> `schema.sql` already contains the objects from steps 2 to 5. If you start from a fresh project, check it against the step files before running both, and make sure `profiles` has the `shift_ends` column.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000/login.

To create the first admin, add a user in Supabase Authentication, then set `role = 'admin'` on their row in `profiles`.

## Project structure

```
app/
  page.tsx                  Redirects by sign-in state and role
  layout.tsx                Root layout, Speed Insights and Analytics
  login/page.tsx            Login page
  admin/page.tsx            Admin dashboard (server component)
  admin/actions.ts          Server actions (edit, force clock out, delete record,
                            delete employee, reset password, update employee)
  employee/page.tsx         Employee view
  auth/signout/route.ts     Server-side sign out
components/
  clock-card.tsx            Time clock and quick clock-out prompt
  shift-summary.tsx         Employee shift summary with date range
  time-records.tsx          Filters, pagination, records table/cards, admin actions popup
  admin-changes-log.tsx     Read-only admin changes log
  employees-manager.tsx     Employee list, add/edit/delete, reset password, records summary
  signout-button.tsx
  delete-button.tsx         Legacy direct delete button (no longer used, safe to remove)
lib/
  supabase/client.ts        Browser client (anon key)
  supabase/server.ts        Server client and service-role client
  supabase/middleware.ts    Session refresh and redirect to /login
  utils.ts                  Small time helpers
middleware.ts               Runs the session refresh on every request
supabase/                   SQL files (see Database)
```

## How the admin changes log works

- Every admin edit, forced clock out, record deletion, employee deletion and password reset is saved together with a log entry in a **single database transaction**. If logging fails, the change is rolled back.
- The timestamp comes from the database clock, and the admin's identity comes from the signed-in session on the server. Neither can be supplied by the browser.
- Database triggers block `UPDATE`, `DELETE` and `TRUNCATE` on the log table, even for the service role.
- Each entry stores a snapshot of the data before and after the change, plus an optional reason.
- Password resets are logged, but the password itself never is.

## Security notes

- The service role key (`SUPABASE_SERVICE_ROLE_KEY`) is used only in server code: Server Components (`app/admin/page.tsx`) and Server Actions (`app/admin/actions.ts`). It is never prefixed with `NEXT_PUBLIC_` and no client component reads it. The browser only ever gets the anon key.
- Add `import 'server-only'` at the top of `lib/supabase/server.ts` (`npm i server-only`). The build then fails if anything marked `'use client'` ever imports it.
- Every admin action is checked on the server (signed in, role `admin`, account active) before it runs. The admin's identity comes from the session, not from the request.
- Admins can't delete their own account, remove their own admin role, or deactivate themselves.
- Deletes only go through the logged admin actions. `lock-down-deletes.sql` removes the old "Admin can delete entries" policy and revokes `DELETE` on `time_entries` and `profiles` from browser roles.
- The old `/api/delete-employee` route has been removed. It accepted any user id with no sign-in check and bypassed the log. Do not add it back.
- Self-service sign-up code has been removed from the login page. Create users from the employee manager.

## Known limits

- The Day filter matches the day of the month, so combine it with a month and year for a specific date.
- The admin changes log shows the latest 200 entries. Older entries stay in the database.
- Adding employees and editing employee profiles (including role changes) are not yet written to the admin changes log.
- Adding an employee currently runs in the browser with the anon key. Moving it to a server action would let it use the same admin checks and logging as the other actions.
- The deactivated-account check happens at sign in only. An already signed-in user stays signed in until their session ends or they sign out.
- `schema.sql` ships broad "Allow all for authenticated" RLS policies on `profiles`, `time_entries` and `admin_audit_log`. Tighten them before relying on RLS as a security boundary.

## Deployment

The app is built for [Vercel](https://vercel.com/). Set the three environment variables in the project settings, use Node 22 or newer, and deploy with `npm run build`.

## License

Internal project of Waho Solutions Inc. By Alistair Rosales
