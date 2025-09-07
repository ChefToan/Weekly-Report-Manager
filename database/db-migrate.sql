-- Database Migration: Per-user Residents and Interactions Ownership
-- This migration adds user association to residents and reaffirms interactions policies
-- Safe migration - only adds what doesn't exist or replaces policies conditionally

-- 1) Add user_id column to residents if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'residents' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE residents ADD COLUMN user_id UUID;
    RAISE NOTICE 'Added user_id column to residents table';
  ELSE
    RAISE NOTICE 'user_id column already exists on residents';
  END IF;
END $$;

-- 2) Add FK constraint from residents.user_id -> users(id) if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'residents_user_id_fkey'
  ) THEN
    ALTER TABLE residents
      ADD CONSTRAINT residents_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK residents_user_id_fkey';
  ELSE
    RAISE NOTICE 'FK residents_user_id_fkey already exists';
  END IF;
END $$;

-- 3) Create index on residents.user_id for performance
CREATE INDEX IF NOT EXISTS idx_residents_user_id ON residents(user_id);

-- 4) Drop any existing UNIQUE on residents(empl_id) and replace with UNIQUE(user_id, empl_id)
DO $$
DECLARE idxname text;
BEGIN
  -- Drop common default constraint name if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'residents'::regclass
      AND contype = 'u'
      AND conname = 'residents_empl_id_key'
  ) THEN
    ALTER TABLE residents DROP CONSTRAINT residents_empl_id_key;
    RAISE NOTICE 'Dropped unique constraint residents_empl_id_key';
  END IF;

  -- Drop any unique index directly on empl_id
  FOR idxname IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'residents'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(empl_id%'
  LOOP
    EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(idxname);
    RAISE NOTICE 'Dropped unique index %', idxname;
  END LOOP;
END $$;

-- 5) Add new unique constraint on (user_id, empl_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'residents'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(user_id, empl_id%'
  ) THEN
    ALTER TABLE residents ADD CONSTRAINT residents_user_empl_unique UNIQUE (user_id, empl_id);
    RAISE NOTICE 'Added UNIQUE (user_id, empl_id) constraint';
  ELSE
    RAISE NOTICE 'UNIQUE (user_id, empl_id) already exists';
  END IF;
END $$;

-- 6) Create helper function/trigger to auto-assign user_id from auth.uid()
CREATE OR REPLACE FUNCTION set_resident_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid()::uuid;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_residents_user_id ON residents;
CREATE TRIGGER set_residents_user_id BEFORE INSERT ON residents
  FOR EACH ROW EXECUTE FUNCTION set_resident_user_id();

-- 7) Optionally enforce NOT NULL if every row has user_id set
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM residents WHERE user_id IS NULL) THEN
    ALTER TABLE residents ALTER COLUMN user_id SET NOT NULL;
    RAISE NOTICE 'Set residents.user_id to NOT NULL';
  ELSE
    RAISE NOTICE 'Skipped NOT NULL on residents.user_id (NULLs exist)';
  END IF;
END $$;

-- 8) Ensure interactions.user_id exists (legacy migration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'interactions' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE interactions 
        ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id);
        RAISE NOTICE 'Added user_id column and index to interactions table';
    ELSE
        RAISE NOTICE 'user_id column already exists in interactions table';
    END IF;
END $$;

-- 9) Reset RLS policies for residents and interactions to be user-scoped
-- Drop residents policies
DROP POLICY IF EXISTS "Users can only see their own residents" ON residents;
DROP POLICY IF EXISTS "Users can only create their own residents" ON residents;
DROP POLICY IF EXISTS "Users can only update their own residents" ON residents;
DROP POLICY IF EXISTS "Users can only delete their own residents" ON residents;

-- Create residents policies
CREATE POLICY "Users can only see their own residents" ON residents
  FOR SELECT USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only create their own residents" ON residents
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only update their own residents" ON residents
  FOR UPDATE USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only delete their own residents" ON residents
  FOR DELETE USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

-- Drop interactions policies and recreate
DROP POLICY IF EXISTS "Users can only see their own interactions" ON interactions;
DROP POLICY IF EXISTS "Users can only create their own interactions" ON interactions;
DROP POLICY IF EXISTS "Users can only update their own interactions" ON interactions;
DROP POLICY IF EXISTS "Users can only delete their own interactions" ON interactions;

CREATE POLICY "Users can only see their own interactions" ON interactions
  FOR SELECT USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only create their own interactions" ON interactions
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only update their own interactions" ON interactions
  FOR UPDATE USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

CREATE POLICY "Users can only delete their own interactions" ON interactions
  FOR DELETE USING (auth.role() = 'service_role' OR user_id = auth.uid()::uuid);

-- 10) Verification
SELECT
  'Migration check' as section,
  (SELECT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='residents' AND column_name='user_id'
  )) AS residents_has_user_id,
  (SELECT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname='residents_user_id_fkey'
  )) AS residents_user_fk,
  (SELECT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='residents' AND indexdef ILIKE '%(user_id, empl_id%'
  )) AS residents_unique,
  (SELECT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='interactions' AND column_name='user_id'
  )) AS interactions_has_user_id;
