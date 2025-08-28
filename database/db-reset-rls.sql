-- Complete reset of permissions and RLS
-- Run this entire script in Supabase SQL Editor

-- 1. First, check what role we're running as
SELECT current_user, current_setting('role') as current_role;

-- 2. Check current RLS status
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled,
  case when rowsecurity then 'RLS ON' else 'RLS OFF' end as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'user_sessions', 'residents', 'interactions');

-- 3. Drop ALL policies completely
DROP POLICY IF EXISTS "Service role can manage residents" ON residents;
DROP POLICY IF EXISTS "Allow public access to residents" ON residents;
DROP POLICY IF EXISTS "Service role can manage interactions" ON interactions;
DROP POLICY IF EXISTS "Allow public access to interactions" ON interactions;
DROP POLICY IF EXISTS "Service role can manage users" ON users;
DROP POLICY IF EXISTS "Allow public read access to users" ON users;
DROP POLICY IF EXISTS "Service role can manage sessions" ON user_sessions;
DROP POLICY IF EXISTS "Allow public access to sessions" ON user_sessions;

-- Drop any other policies that might exist
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('residents', 'interactions', 'users', 'user_sessions')
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.schemaname || '.' || r.tablename;
    END LOOP;
END $$;

-- 4. Force disable RLS
ALTER TABLE public.residents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions DISABLE ROW LEVEL SECURITY; 
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;

-- 5. Grant explicit permissions to service_role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- 6. Also grant to anon role just in case
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- 7. Verify everything is working
SELECT 'After reset - RLS status' as test;
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled,
  case when rowsecurity then 'RLS ON' else 'RLS OFF' end as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'user_sessions', 'residents', 'interactions');

-- 8. Test direct access
SELECT 'Direct table access test' as test, count(*) as total_users FROM users;
SELECT 'Admin user test' as test, username, first_name, last_name, email, asu_id, role, is_active FROM users WHERE username = 'admin';

-- 9. Show remaining policies (should be empty)
SELECT 'Remaining policies (should be empty)' as info;
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('residents', 'interactions', 'users', 'user_sessions');