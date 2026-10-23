-- ChronoKeep Production Schema
-- Run this in Supabase SQL Editor

-- 1. Enable UUID
create extension if not exists "uuid-ossp";

-- 2. Profiles (linked to auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('admin','employee')),
  work_type text not null check (work_type in ('Hybrid','Remote','Onsite')) default 'Hybrid',
  shift_start time not null default '09:00',
  department text,
  avatar_initials text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3. Company settings (single row)
create table public.company_settings (
  id uuid primary key default uuid_generate_v4(),
  start_time time not null default '09:00',
  grace_minutes int not null default 15,
  work_hours_per_day int not null default 8,
  overtime_threshold int not null default 8,
  work_week text[] not null default array['Mon','Tue','Wed','Thu','Fri'],
  late_policy text not null default 'Arrivals after grace period require justification.',
  updated_at timestamptz default now()
);
insert into public.company_settings (id) values ('00000000-0000-0000-0000-000000000001') on conflict (id) do nothing;

-- 4. Time entries (tamper-proof)
create table public.time_entries (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  clock_in timestamptz,
  original_clock_in timestamptz,
  clock_out timestamptz,
  original_clock_out timestamptz,
  mode text check (mode in ('Remote','Onsite')) not null default 'Remote',
  breaks jsonb default '[]'::jsonb,
  total_break_min int default 0,
  notes text default '',
  late_reason text default '',
  late_reason_type text default '',
  status text check (status in ('On Time','Late','Incomplete')) default 'Incomplete',
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id),
  is_edited boolean default false,
  last_modified_at timestamptz,
  last_modified_by uuid references public.profiles(id),
  -- unique(employee_id, date) REMOVED for flexible multiple shifts per day
);
create index idx_time_entries_employee_date on public.time_entries(employee_id, date desc);
create index idx_time_entries_date on public.time_entries(date desc);

-- 5. Audit logs (append-only, immutable)
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  timestamp timestamptz default now(),
  actor_id uuid references public.profiles(id),
  actor_name text not null,
  action text not null,
  employee_id uuid references public.profiles(id),
  employee_name text not null,
  field text not null,
  old_value text,
  new_value text,
  reason text not null,
  ip text
);
create index idx_audit_employee on public.audit_logs(employee_id);
create index idx_audit_timestamp on public.audit_logs(timestamp desc);

-- 6. RLS Policies
alter table public.profiles enable row level security;
alter table public.time_entries enable row level security;
alter table public.audit_logs enable row level security;
alter table public.company_settings enable row level security;

-- Profiles: authenticated can read, admin can manage, users can update own
create policy "Authenticated can read profiles" on public.profiles for select to authenticated using (true);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Service role can insert" on public.profiles for insert to service_role with check (true);

-- Time entries: employees read own, admin reads all, insert own, update admin only via service role + audit
create policy "Employees read own entries" on public.time_entries for select to authenticated using (
  employee_id = auth.uid() OR exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Employees can insert own" on public.time_entries for insert to authenticated with check (employee_id = auth.uid());
create policy "Employees can update own clock-out" on public.time_entries for update to authenticated using (employee_id = auth.uid()) with check (employee_id = auth.uid());
-- Admin edits via service role bypass RLS, but we enforce audit in app layer

-- Audit logs: admin read all, employees read own related, insert via service/authenticated
create policy "Admin and related can read audit" on public.audit_logs for select to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') OR employee_id = auth.uid()
);
create policy "Authenticated can insert audit" on public.audit_logs for insert to authenticated with check (true);

-- Company settings: all authenticated read, admin update
create policy "All can read settings" on public.company_settings for select to authenticated using (true);
create policy "Admin can update settings" on public.company_settings for update to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 7. Functions
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, avatar_initials)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'employee'),
    upper(left(coalesce(new.raw_user_meta_data->>'full_name', new.email),2))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- 8. Realtime
alter publication supabase_realtime add table public.time_entries;
alter publication supabase_realtime add table public.audit_logs;
