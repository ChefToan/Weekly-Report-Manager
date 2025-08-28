-- Drop all tables and schema
-- WARNING: This will permanently delete ALL data

-- Drop tables in correct order (foreign keys first)
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS registration_codes CASCADE;
DROP TABLE IF EXISTS interactions CASCADE;
DROP TABLE IF EXISTS residents CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_auth() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_codes() CASCADE;

-- Drop extensions (optional)
-- DROP EXTENSION IF EXISTS "uuid-ossp";

SELECT 'All tables and functions dropped successfully' as result;