

# Fix: `profile_type` Column Error in Service Creation

## Root Cause

The database trigger function `auto_migrate_profile_type()` has a SQL bug on line 27. It executes:

```sql
SELECT profile_type, COALESCE(...)
INTO v_current_type, v_fixed;
```

This is **missing the `FROM profiles WHERE id = v_user_id` clause**. PostgreSQL cannot resolve `profile_type` without knowing which table to read from, so it throws "column 'profile_type' does not exist".

This trigger fires AFTER INSERT on the `services` table, which means every time a user adds a service, it fails.

The `profile_type` column itself **already exists** in the `profiles` table (added in migration `20260320034226`). The column is fine — only the trigger function has the bug.

## Fix Plan

### Step 1: Fix the trigger function (migration)

Create a new migration that replaces the `auto_migrate_profile_type()` function with the corrected SQL:

```sql
SELECT profile_type,
       COALESCE((SELECT true FROM public.site_settings
                 WHERE key = 'locked_profile_' || v_user_id::text LIMIT 1), false)
INTO v_current_type, v_fixed
FROM profiles WHERE id = v_user_id;
```

Add a guard: if no profile row is found (`v_current_type IS NULL`), return early.

### Step 2: Frontend robustness

No frontend changes needed — the code already handles `profile_type` correctly with fallbacks (`profile?.profile_type || profile?.role || 'client'`). The error originates entirely from the database trigger.

## Files Changed

| Location | Change |
|---|---|
| New migration SQL | Fix `auto_migrate_profile_type()` — add missing `FROM profiles WHERE id = v_user_id` |

Single migration, no frontend changes required. The fix is surgical — one missing SQL clause.

