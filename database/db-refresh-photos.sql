-- Refresh Photos Table - Keep Supabase Database Active
-- This table stores daily fetched photos to prevent database inactivity pause (7-day rule)
-- Replaces the old dog_photos table

-- Drop old table if exists
DROP TABLE IF EXISTS dog_photos CASCADE;

-- Create refresh_photos table
CREATE TABLE IF NOT EXISTS refresh_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_url TEXT NOT NULL,
  source_name VARCHAR(100) NOT NULL, -- API source name (e.g., 'Dog CEO', 'Random Fox', 'The Cat API')
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_refresh_photos_fetched_at ON refresh_photos(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_photos_source ON refresh_photos(source_name);

-- Enable RLS (Row Level Security)
ALTER TABLE refresh_photos ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage refresh photos
CREATE POLICY "Service role can manage all refresh photos" ON refresh_photos
  FOR ALL USING (auth.role() = 'service_role');

-- Function to clean up old refresh photos (keep only the last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_refresh_photos()
RETURNS void AS $$
BEGIN
  DELETE FROM refresh_photos
  WHERE fetched_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Verify table creation
SELECT
  'Refresh photos table created successfully!' as status,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'refresh_photos';