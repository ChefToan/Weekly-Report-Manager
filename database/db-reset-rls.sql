-- Reset RLS and policies to the canonical configuration
-- Run this in Supabase SQL editor

-- 1) Who am I
SELECT current_user, current_setting('role') as current_role;

-- 2) Drop ALL existing policies on relevant tables
DO $$
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('residents', 'interactions', 'users', 'user_sessions', 'registration_codes', 'password_reset_tokens')
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 3) Ensure RLS is enabled on all tables
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registration_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- 4) Recreate canonical policies
-- Residents: user-scoped CRUD
CREATE POLICY "Users can only see their own residents" ON residents
  FOR SELECT USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only create their own residents" ON residents
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only update their own residents" ON residents
  FOR UPDATE USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only delete their own residents" ON residents
  FOR DELETE USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

-- Interactions: user-scoped CRUD
CREATE POLICY "Users can only see their own interactions" ON interactions
  FOR SELECT USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only create their own interactions" ON interactions
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only update their own interactions" ON interactions
  FOR UPDATE USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only delete their own interactions" ON interactions
  FOR DELETE USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

-- Users: self-read + service role full
CREATE POLICY "Users can read their own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Service role can manage all users" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- Sessions: service role full
CREATE POLICY "Service role can manage all sessions" ON user_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Registration codes: service role full
CREATE POLICY "Service role can manage all registration codes" ON registration_codes
  FOR ALL USING (auth.role() = 'service_role');

-- Password reset tokens: service role full
CREATE POLICY "Service role can manage all password reset tokens" ON password_reset_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- 5) Optional grants (roles permissions)
GRANT USAGE ON SCHEMA public TO service_role, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 6) Verify
SELECT 'After reset - RLS status' as test;
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled,
  case when rowsecurity then 'RLS ON' else 'RLS OFF' end as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'user_sessions', 'residents', 'interactions', 'registration_codes', 'password_reset_tokens')
ORDER BY tablename;

SELECT 'Policies per table' as info;
SELECT schemaname, tablename, policyname, permissive, roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('residents', 'interactions', 'users', 'user_sessions', 'registration_codes', 'password_reset_tokens')
ORDER BY tablename, policyname;
