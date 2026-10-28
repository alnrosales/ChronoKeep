-- ChronoKeep Production Schema
-- Run this in Supabase SQL Editor
-- Generated from schema exports - 2024-10-29

-- 1. Enable UUID
create extension if not exists "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- 2. Profiles (linked to auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('admin','employee')),
  work_type text not null check (work_type in ('Hybrid','Remote','Onsite')) default 'Hybrid',
  shift_start time not null default '09:00:00',
  department text,
  avatar_initials text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3. Company settings (single row)
create table public.company_settings (
  id uuid primary key default uuid_generate_v4(),
  start_time time not null default '09:00:00',
  grace_minutes int not null default 15,
  work_hours_per_day int not null default 8,
  overtime_threshold int not null default 8,
  work_week text[] not null default array['Mon'::text, 'Tue'::text, 'Wed'::text, 'Thu'::text, 'Fri'::text],
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
  quick_clockout_reason text default '',
  unique(employee_id, date)
);
create index idx_time_entries_employee_date on public.time_entries(employee_id, date desc);
create index idx_time_entries_date on public.time_entries(date desc);

-- 5. Admin audit log (append-only, immutable - for administrative actions)
create table public.admin_audit_log (
  id bigint primary key generated always as identity,
  created_at timestamptz default now(),
  actor_id uuid not null references public.profiles(id),
  actor_name text,
  actor_email text,
  action text not null,
  entry_id text,
  employee_id uuid references public.profiles(id),
  employee_name text,
  before_data jsonb,
  after_data jsonb,
  reason text
);
create index idx_admin_audit_employee on public.admin_audit_log(employee_id);
create index idx_admin_audit_timestamp on public.admin_audit_log(created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - ENABLED ON ALL TABLES
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.time_entries enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.company_settings enable row level security;

-- -----------------------------------------------------------------------------
-- Profiles RLS Policies
-- -----------------------------------------------------------------------------
create policy "Allow all for authenticated" on public.profiles for all to authenticated using (true) with check (true);
create policy "Allow all read for authenticated" on public.profiles for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- Time Entries RLS Policies
-- -----------------------------------------------------------------------------
create policy "Allow all for authenticated" on public.time_entries for all to authenticated using (true) with check (true);

-- -----------------------------------------------------------------------------
-- Company Settings RLS Policies
-- -----------------------------------------------------------------------------
create policy "Admin can update settings" on public.company_settings for update to authenticated
  using (EXISTS ( SELECT 1 FROM profiles WHERE (profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)));
create policy "All can read settings" on public.company_settings for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- Admin Audit Log RLS Policies
-- -----------------------------------------------------------------------------
create policy "Allow all for authenticated" on public.admin_audit_log for all to authenticated using (true) with check (true);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- 6. Trigger: Create profile from auth.users signup
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

-- 7. Function: Admin audit writer (centralized logging for all admin actions)
create or replace function public.admin_audit_write(p_actor uuid, p_action text, p_entry_id text, p_employee uuid, p_before jsonb, p_after jsonb, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_actor_name text; 
  v_actor_email text; 
  v_emp_name text;
begin
  select full_name, email into v_actor_name, v_actor_email from public.profiles where id = p_actor;
  select full_name into v_emp_name from public.profiles where id = p_employee;
  insert into public.admin_audit_log
    (actor_id, actor_name, actor_email, action, entry_id, employee_id, employee_name, before_data, after_data, reason)
  values
    (p_actor, v_actor_name, v_actor_email, p_action, p_entry_id, p_employee, v_emp_name, p_before, p_after, nullif(trim(p_reason), ''));
end;
$$;

-- 8. Function: Admin delete employee (protected from self-deletion)
create or replace function public.admin_delete_employee(p_employee_id uuid, p_actor uuid, p_reason text default null::text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_before jsonb; 
  v_count bigint;
begin
  if p_employee_id = p_actor then
    raise exception 'You cannot delete your own account';
  end if;

  select to_jsonb(p) into v_before from public.profiles p where p.id = p_employee_id for update;
  if v_before is null then raise exception 'Employee not found'; end if;

  select count(*) into v_count from public.time_entries where employee_id = p_employee_id;
  v_before := v_before || jsonb_build_object('time_entries_count', v_count);

  perform public.admin_audit_write(p_actor, 'delete_employee', null, p_employee_id, v_before, null, p_reason);

  delete from public.profiles where id = p_employee_id;
  delete from auth.users where id = p_employee_id;   -- removes their sign-in too
end;
$$;

-- 9. Function: Admin delete time entry
create or replace function public.admin_delete_time_entry(p_entry_id text, p_actor uuid, p_reason text default null::text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_before jsonb; 
  v_emp uuid;
begin
  delete from public.time_entries where id::text = p_entry_id
  returning to_jsonb(time_entries.*), employee_id into v_before, v_emp;
  if v_before is null then raise exception 'Time record not found'; end if;

  perform public.admin_audit_write(p_actor, 'delete', p_entry_id, v_emp, v_before, null, p_reason);
end;
$$;

-- 10. Function: Admin edit time entry (syncs Manila timezone)
create or replace function public.admin_edit_time_entry(p_entry_id text, p_actor uuid, p_clock_in timestamptz, p_clock_out timestamptz, p_reason text default null::text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_before jsonb; 
  v_after jsonb; 
  v_emp uuid;
begin
  select to_jsonb(t), t.employee_id into v_before, v_emp
    from public.time_entries t where t.id::text = p_entry_id for update;
  if v_before is null then raise exception 'Time record not found'; end if;
  if p_clock_in is null then raise exception 'Clock in is required'; end if;
  if p_clock_out is not null and p_clock_out <= p_clock_in then
    raise exception 'Clock out must be after clock in';
  end if;

  update public.time_entries
     set clock_in = p_clock_in,
         clock_out = p_clock_out,
         date = (p_clock_in at time zone 'Asia/Manila')::date   -- keep the Manila work date in sync
   where id::text = p_entry_id
  returning to_jsonb(time_entries.*) into v_after;

  perform public.admin_audit_write(p_actor, 'edit', p_entry_id, v_emp, v_before, v_after, p_reason);
end;
$$;

-- 11. Function: Admin force clock out (after current time)
create or replace function public.admin_force_clock_out(p_entry_id text, p_actor uuid, p_reason text default null::text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_before jsonb; 
  v_after jsonb; 
  v_emp uuid; 
  v_in timestamptz; 
  v_out timestamptz;
begin
  select to_jsonb(t), t.employee_id, t.clock_in, t.clock_out into v_before, v_emp, v_in, v_out
    from public.time_entries t where t.id::text = p_entry_id for update;
  if v_before is null then raise exception 'Time record not found'; end if;
  if v_out is not null then raise exception 'This employee is already clocked out'; end if;
  if v_in is null or now() <= v_in then raise exception 'Clock out must be after clock in'; end if;

  update public.time_entries set clock_out = now()
   where id::text = p_entry_id
  returning to_jsonb(time_entries.*) into v_after;

  perform public.admin_audit_write(p_actor, 'force_clock_out', p_entry_id, v_emp, v_before, v_after, p_reason);
end;
$$;

-- 12. Function: Admin log password reset
create or replace function public.admin_log_password_reset(p_employee_id uuid, p_actor uuid, p_reason text default null::text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.profiles where id = p_employee_id) then
    raise exception 'Employee not found';
  end if;
  perform public.admin_audit_write(p_actor, 'reset_password', null, p_employee_id, null, null, p_reason);
end;
$$;

-- 13. Function: Protect kulbakaayo.com profile from editing/deletion
create or replace function public.protect_kulbakaayo_profile()
returns trigger language plpgsql as $$
begin
  if lower(old.email) = 'al@kulbakaayo.com' then
    raise exception 'This employee account is protected from editing and deletion.';
  end if;

  if tg_op = 'DELETE' then
    return old;   -- let the delete go ahead
  end if;
  return new;     -- let the update go ahead with the new values
end;
$$;

-- ============================================================================
-- EVENT TRIGGERS & OTHER SYSTEM FUNCTIONS
-- ============================================================================

-- 14. Event trigger: Automatically enable RLS on newly created tables
create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- REALTIME PUBLICATIONS
-- ============================================================================

alter publication supabase_realtime add table public.time_entries;
alter publication supabase_realtime add table public.admin_audit_log;
