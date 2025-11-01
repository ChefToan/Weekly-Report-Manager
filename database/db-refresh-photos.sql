-- Refresh Photos Table - Keep Supabase Database Active
-- This table stores daily fetched photos to prevent database inactivity pause (7-day rule)
-- Replaces the old dog_photos table

-- Drop old table if exists
DROP TABLE IF EXISTS dog_photos CASCADE;
DROP TABLE IF EXISTS refresh_photos CASCADE;

-- Create refresh_photos table
CREATE TABLE refresh_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_url TEXT NOT NULL,
  source_name VARCHAR(100) NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_refresh_photos_fetched_at ON refresh_photos(fetched_at DESC);
CREATE INDEX idx_refresh_photos_source ON refresh_photos(source_name);

-- Grant all permissions to service_role (CRITICAL FOR FIXING PERMISSION ERRORS)
GRANT ALL PRIVILEGES ON TABLE refresh_photos TO service_role;

-- Disable RLS (this table is only accessed by service role)
ALTER TABLE refresh_photos DISABLE ROW LEVEL SECURITY;

-- Function to clean up old refresh photos (keep only the last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_refresh_photos()
RETURNS void AS $$
BEGIN
  DELETE FROM refresh_photos
  WHERE fetched_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION cleanup_old_refresh_photos() TO service_role;

-- Verify table creation
SELECT
  'Refresh photos table created successfully!' as status,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'refresh_photos';