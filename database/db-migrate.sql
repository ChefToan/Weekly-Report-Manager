-- Migration: Remove summary column from interactions table
-- The summary column is redundant as it just contains truncated details

-- Step 1: Check if summary column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interactions' AND column_name = 'summary'
  ) THEN
    -- Step 2: Drop the summary column
ALTER TABLE interactions DROP COLUMN summary;
RAISE NOTICE 'Successfully removed summary column from interactions table';
ELSE
    RAISE NOTICE 'Summary column does not exist in interactions table';
END IF;
END $$;

-- Verification: Show the current structure of interactions table
SELECT
    'Interactions table structure after migration:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'interactions'
ORDER BY ordinal_position;