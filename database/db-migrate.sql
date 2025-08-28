-- Weekly Report Site Complete Database Schema and Migrations
-- Run this script in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE SCHEMA
-- =====================================================

-- Residents table
CREATE TABLE IF NOT EXISTS residents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empl_id VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  room VARCHAR(100),  -- Expanded to handle longer room numbers like TKRB-0123-A1
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interactions table
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  resident_empl_id VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  summary TEXT NOT NULL,
  details TEXT,
  is_submitted BOOLEAN DEFAULT FALSE,
  week_starting DATE NOT NULL,
  "column" INTEGER,  -- Column tracking for Excel-like behavior
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- AUTHENTICATION SCHEMA
-- =====================================================

-- Users table with personal information and role-based access
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_residents_empl_id ON residents(empl_id);
CREATE INDEX IF NOT EXISTS idx_interactions_resident_id ON interactions(resident_id);
CREATE INDEX IF NOT EXISTS idx_interactions_resident_empl_id ON interactions(resident_empl_id);
CREATE INDEX IF NOT EXISTS idx_interactions_week_starting ON interactions(week_starting);
CREATE INDEX IF NOT EXISTS idx_interactions_date ON interactions(date);
CREATE INDEX IF NOT EXISTS idx_interactions_is_submitted ON interactions(is_submitted);
CREATE INDEX IF NOT EXISTS idx_interactions_column ON interactions("column");

-- Authentication indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_asu_id ON users(asu_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
CREATE INDEX IF NOT EXISTS idx_users_last_name ON users(last_name);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Core table policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON residents;
CREATE POLICY "Allow all operations for authenticated users" ON residents
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON interactions;
CREATE POLICY "Allow all operations for authenticated users" ON interactions
  FOR ALL USING (auth.role() = 'authenticated');

-- Authentication table policies
DROP POLICY IF EXISTS "Users can read their own data" ON users;
CREATE POLICY "Users can read their own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Service role can manage all users" ON users;
CREATE POLICY "Service role can manage all users" ON users
  FOR ALL USING (auth.role() = 'service_role');


DROP POLICY IF EXISTS "Service role can manage all sessions" ON user_sessions;
CREATE POLICY "Service role can manage all sessions" ON user_sessions
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
DROP TRIGGER IF EXISTS update_residents_updated_at ON residents;
CREATE TRIGGER update_residents_updated_at BEFORE UPDATE ON residents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_interactions_updated_at ON interactions;
CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_sessions_updated_at ON user_sessions;
CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_auth()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- =====================================================
-- DATA MIGRATIONS
-- =====================================================

-- Update existing room data to be uppercase for consistency
UPDATE residents 
SET room = UPPER(TRIM(room)) 
WHERE room IS NOT NULL AND room != '';

-- Update existing interactions to have column numbers based on their order
-- This assigns column numbers to existing interactions for backward compatibility
WITH resident_interactions AS (
  SELECT 
    id,
    resident_id,
    ROW_NUMBER() OVER (PARTITION BY resident_id ORDER BY created_at) as row_num
  FROM interactions
  WHERE "column" IS NULL
)
UPDATE interactions
SET "column" = LEAST(resident_interactions.row_num, 3) -- Limit to 3 columns
FROM resident_interactions
WHERE interactions.id = resident_interactions.id;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Create default admin user (password: 'admin123')
-- Note: In production, change this password immediately after first login
INSERT INTO users (username, password_hash, first_name, last_name, email, asu_id, role, is_active) 
VALUES (
  'admin',
  '$2a$12$LQv3c1yqBw0HRUqb8PNPk.Qz5V8.9F8Q9rRfZ8cJqJn5Zz6vhRgYu', -- bcrypt hash of 'admin123'
  'System',
  'Administrator',
  'admin@asu.edu',
  '1000000001',
  'admin',
  true
) ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify schema creation
-- Add migration for existing users table if it exists without new columns
DO $$ 
BEGIN
    -- Check if first_name column exists, if not add new columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'first_name') THEN
        
        -- Add new columns
        ALTER TABLE users 
        ADD COLUMN first_name VARCHAR(100),
        ADD COLUMN last_name VARCHAR(100),
        ADD COLUMN asu_id VARCHAR(10),
        ADD COLUMN role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user'));
        
        -- Update existing users with placeholder data
        UPDATE users SET 
            first_name = CASE 
                WHEN name IS NOT NULL THEN SPLIT_PART(name, ' ', 1)
                ELSE 'Unknown'
            END,
            last_name = CASE 
                WHEN name IS NOT NULL AND array_length(string_to_array(name, ' '), 1) > 1 
                THEN SPLIT_PART(name, ' ', -1)
                ELSE 'User'
            END,
            asu_id = CASE 
                WHEN username = 'admin' THEN '1000000001'
                ELSE LPAD((ROW_NUMBER() OVER ())::text, 10, '0')
            END,
            role = CASE 
                WHEN username = 'admin' THEN 'admin'
                ELSE 'user'
            END;
        
        -- Add constraints after data migration
        ALTER TABLE users 
        ALTER COLUMN first_name SET NOT NULL,
        ALTER COLUMN last_name SET NOT NULL,
        ALTER COLUMN asu_id SET NOT NULL,
        ALTER COLUMN role SET NOT NULL,
        ADD CONSTRAINT users_asu_id_unique UNIQUE (asu_id);
        
        -- Update email constraint if needed
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_check;
        ALTER TABLE users ADD CONSTRAINT users_email_check CHECK (email LIKE '%@asu.edu');
        
        -- Add new indexes
        CREATE INDEX IF NOT EXISTS idx_users_asu_id ON users(asu_id);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
        CREATE INDEX IF NOT EXISTS idx_users_last_name ON users(last_name);
        
        RAISE NOTICE 'Users table migrated to include personal information fields';
    ELSE
        RAISE NOTICE 'Users table already has personal information fields';
    END IF;
END $$;

-- Verify schema creation
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('residents', 'interactions', 'users', 'user_sessions')
ORDER BY table_name, ordinal_position;