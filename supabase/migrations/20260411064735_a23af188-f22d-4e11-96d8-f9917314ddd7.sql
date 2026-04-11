-- Fix "SANTA CATARINA" → "SC"
UPDATE public.providers SET state = 'SC' WHERE state = 'SANTA CATARINA' AND deleted_at IS NULL;

-- Fix empty states by inferring from city where possible
-- For now, set providers with empty state to have their state normalized by the trigger
-- The clean_city_input trigger already handles state normalization on INSERT/UPDATE
-- Force a no-op update to trigger normalization on providers with empty state
UPDATE public.providers SET state = state WHERE state = '' AND deleted_at IS NULL;