
-- Add unique constraint on providers.user_id to prevent duplicate provider records
-- First verify no remaining duplicates
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT user_id FROM providers GROUP BY user_id HAVING COUNT(*) > 1
  ) t;
  IF dup_count > 0 THEN
    RAISE NOTICE 'Found % users with duplicate providers - keeping best record for each', dup_count;
    -- Delete duplicates keeping the one with most data
    DELETE FROM providers WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY user_id 
          ORDER BY 
            CASE WHEN city != '' AND description != '' THEN 0 ELSE 1 END,
            created_at ASC
        ) as rn
        FROM providers
      ) ranked WHERE rn > 1
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS providers_user_id_unique ON providers(user_id);
