-- Dog Photos Table - Keep Supabase Active
-- This table stores daily dog photos to prevent database inactivity pause (7-day rule)

-- Create dog_photos table
CREATE TABLE IF NOT EXISTS dog_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_url TEXT NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_dog_photos_fetched_at ON dog_photos(fetched_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE dog_photos ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage dog photos
CREATE POLICY "Service role can manage all dog photos" ON dog_photos
  FOR ALL USING (auth.role() = 'service_role');

-- Function to clean up old dog photos (keep only the last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_dog_photos()
RETURNS void AS $$
BEGIN
  DELETE FROM dog_photos
  WHERE fetched_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Verify table creation
SELECT
  'Dog photos table created successfully!' as status,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'dog_photos';
