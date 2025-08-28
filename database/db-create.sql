-- Weekly Report Site Database Schema - Complete Setup
-- Run this script in your Supabase SQL editor to initialize the database from scratch

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE SCHEMA
-- =====================================================

-- Residents table
CREATE TABLE residents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empl_id VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  room VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interactions table
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  resident_empl_id VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  summary TEXT NOT NULL,
  details TEXT,
  is_submitted BOOLEAN DEFAULT FALSE,
  week_starting DATE NOT NULL,
  "column" INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- AUTHENTICATION SCHEMA
-- =====================================================

-- Users table with role-based access and personal information
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL CHECK (email LIKE '%@asu.edu'),
  asu_id VARCHAR(10) UNIQUE NOT NULL,
  role VARCHAR(20) DEFAULT 'user' NOT NULL CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions for tracking active logins
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One-time registration codes table
CREATE TABLE registration_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Password reset tokens table
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Core table indexes
CREATE INDEX idx_residents_empl_id ON residents(empl_id);
CREATE INDEX idx_residents_room ON residents(room);
CREATE INDEX idx_interactions_resident_id ON interactions(resident_id);
CREATE INDEX idx_interactions_resident_empl_id ON interactions(resident_empl_id);
CREATE INDEX idx_interactions_week_starting ON interactions(week_starting);
CREATE INDEX idx_interactions_date ON interactions(date);
CREATE INDEX idx_interactions_is_submitted ON interactions(is_submitted);
CREATE INDEX idx_interactions_column ON interactions("column");

-- Authentication indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_asu_id ON users(asu_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_first_name ON users(first_name);
CREATE INDEX idx_users_last_name ON users(last_name);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Registration codes indexes
CREATE INDEX idx_registration_codes_code ON registration_codes(code);
CREATE INDEX idx_registration_codes_created_by ON registration_codes(created_by);
CREATE INDEX idx_registration_codes_used_by ON registration_codes(used_by);
CREATE INDEX idx_registration_codes_is_used ON registration_codes(is_used);
CREATE INDEX idx_registration_codes_expires_at ON registration_codes(expires_at);

-- Password reset tokens indexes
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Core table policies - Allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON residents
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON interactions
  FOR ALL USING (auth.role() = 'authenticated');

-- Authentication table policies
CREATE POLICY "Users can read their own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Service role can manage all users" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all sessions" ON user_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Registration codes policies
CREATE POLICY "Service role can manage all registration codes" ON registration_codes
  FOR ALL USING (auth.role() = 'service_role');

-- Password reset tokens policies
CREATE POLICY "Service role can manage all password reset tokens" ON password_reset_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_residents_updated_at BEFORE UPDATE ON residents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registration_codes_updated_at BEFORE UPDATE ON registration_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: password_reset_tokens doesn't have updated_at column since tokens are immutable

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_auth()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- Function to clean up expired registration codes
CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM registration_codes WHERE expires_at < NOW() AND is_used = FALSE;
END;
$$ language 'plpgsql';

-- Function to clean up expired password reset tokens
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- Function to generate random registration codes
CREATE OR REPLACE FUNCTION generate_registration_code()
RETURNS varchar AS $$
DECLARE
  code_length INTEGER := 16;
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result VARCHAR := '';
  i INTEGER;
BEGIN
  FOR i IN 1..code_length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ language 'plpgsql';

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Create default admin user (password: 'admin123')
-- Password hash generated with bcrypt, cost factor 12
INSERT INTO users (username, password_hash, first_name, last_name, email, asu_id, role, is_active) 
VALUES (
  'admin',
  '$2b$12$VV52fTMw1o5Ws6WIN47TBuX2f7OOq49.UT20bXbxuZhmrfxB02aFG',
  'System',
  'Administrator',
  'admin@asu.edu',
  '1000000001',
  'admin',
  true
) ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- SAMPLE DATA (OPTIONAL)
-- =====================================================

-- Insert sample residents (uncomment if you want test data)
/*
INSERT INTO residents (empl_id, name, email, room) VALUES
  ('1234567890', 'John Smith', 'john.smith@asu.edu', 'TKRB-0101-A1'),
  ('0987654321', 'Jane Doe', 'jane.doe@asu.edu', 'TKRB-0102-B2'),
  ('1122334455', 'Mike Johnson', 'mike.johnson@asu.edu', 'TKRB-0103-C3')
ON CONFLICT (empl_id) DO NOTHING;
*/

-- Create a sample registration code for testing (expires in 24 hours)
-- INSERT INTO registration_codes (
--   code,
--   created_by,
--   expires_at
-- )
-- SELECT
--   'sample-test-code-123',
--   u.id,
--   NOW() + INTERVAL '24 hours'
-- FROM users u
-- WHERE u.username = 'admin'
-- ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Show created tables and their columns
SELECT 
  'Database Schema Created Successfully' as status,
  table_name,
  COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('residents', 'interactions', 'users', 'user_sessions', 'registration_codes')
GROUP BY table_name
ORDER BY table_name;

-- Show user count
SELECT 'Users created:' as info, COUNT(*) as count FROM users;

-- Show registration codes
SELECT 'Registration codes:' as info, COUNT(*) as count FROM registration_codes;

-- Show indexes created
SELECT 
  'Indexes created:' as info,
  COUNT(*) as total_indexes
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('residents', 'interactions', 'users', 'user_sessions', 'registration_codes');

-- Test admin user
SELECT 
  'Admin user verification:' as test,
  username, 
  first_name,
  last_name,
  email,
  asu_id,
  role, 
  is_active,
  created_at
FROM users 
WHERE username = 'admin';

-- Cleanup functions test
SELECT 
  'Available functions:' as info,
  proname as function_name
FROM pg_proc 
WHERE proname IN ('cleanup_expired_auth', 'cleanup_expired_codes', 'generate_registration_code', 'update_updated_at_column');

-- Final status
SELECT 
  '✅ Database initialization complete!' as status,
  'Ready for application use' as message;