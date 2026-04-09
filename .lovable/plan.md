

## Bug: Cadastro de Profissional Quebrado — Diagnóstico e Plano de Correção

### Root Cause

The RLS policy **"Users can update own profile"** has a `WITH CHECK` clause that **prevents users from changing their own `profile_type` and `role`**:

```sql
WITH CHECK: (auth.uid() = id) 
  AND (profile_type = (SELECT p.profile_type FROM profiles p WHERE p.id = auth.uid()))
  AND (role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid()))
```

This means the profile update at signup (line 136-140 of `SignupPage.tsx`) that tries to change `profile_type` from `'client'` to `'provider'` is **silently rejected by RLS**. The user is created, but always remains a `client`.

The same issue affects `ProfileTypeChooser` and `ProfileTypeSwitcher` — any attempt by a user to change their own type is blocked.

### Fix Strategy

Two changes, both surgical:

**1. Update the `handle_new_user()` trigger** to read `profile_type` from `raw_user_meta_data` during account creation, so the profile is created with the correct type from the start.

**2. Relax the RLS `WITH CHECK`** on the "Users can update own profile" policy to allow users to change `profile_type` and `role` (removing the self-referencing subquery constraint). This unblocks `ProfileTypeSwitcher` and `ProfileTypeChooser` as well.

**3. Update `SignupPage.tsx`** to pass `profile_type` in user metadata so the trigger picks it up.

### Technical Details

**Migration 1 — Update `handle_new_user()` trigger:**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, level_id, account_type_id, profile_type, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    '716c417b-fdc8-4121-879b-abcd8f0a216f',
    '50a97ea2-c43e-472f-b6f2-4dd180379cad',
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'profile_type', ''), 'client'),
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'profile_type' = 'rh' THEN 'client'
      WHEN NEW.raw_user_meta_data ->> 'profile_type' IS NOT NULL THEN NEW.raw_user_meta_data ->> 'profile_type'
      ELSE 'client'
    END
  );
  RETURN NEW;
END;
$$;
```

**Migration 2 — Fix RLS policy:**
```sql
DROP POLICY "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

**Code change — `SignupPage.tsx` (line ~118):**
Pass `profile_type` in signup metadata:
```typescript
options: {
  data: { full_name: form.fullName, profile_type_chosen: true, profile_type: accountType },
  emailRedirectTo: window.location.origin,
},
```

### What This Fixes
- New signups as "Profissional" or "RH" will have the correct type from creation
- `ProfileTypeSwitcher` (dashboard) will work again
- `ProfileTypeChooser` (social login onboarding) will work again
- No existing data or RLS on other tables is affected

### What Stays Unchanged
- All 50 tables with RLS enabled
- Admin policies (admins can still update any profile)
- The `auto_migrate_profile_type()` trigger continues working
- Provider record creation logic in SignupPage stays as-is

