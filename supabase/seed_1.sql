-- Seed demo employees - create them via Auth first, then update profiles
-- This is example data for time_entries

-- Example: After creating users in Supabase Auth dashboard, run:
-- update profiles set role='admin' where email='admin@company.com';

-- Insert company settings default already done

-- You can seed time entries after you have profile ids:
-- insert into time_entries (employee_id, date, clock_in, original_clock_in, clock_out, original_clock_out, mode, status)
-- values ('<employee-uuid>', current_date - 1, now() - interval '8 hours', now() - interval '8 hours', now(), now(), 'Remote', 'On Time');
