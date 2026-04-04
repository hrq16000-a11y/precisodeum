
-- 1. PROVIDERS: restrict public SELECT to approved, non-deleted only
DROP POLICY IF EXISTS "Providers are viewable by everyone" ON public.providers;
CREATE POLICY "Providers are viewable by everyone"
  ON public.providers FOR SELECT
  TO public
  USING (status = 'approved' AND deleted_at IS NULL);

-- Admin override to see all providers
CREATE POLICY "Admins can view all providers"
  ON public.providers FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Provider can still see own record
CREATE POLICY "Users can view own provider"
  ON public.providers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. JOBS: restrict public SELECT to active, non-deleted only
DROP POLICY IF EXISTS "Jobs viewable by everyone" ON public.jobs;
CREATE POLICY "Jobs viewable by everyone"
  ON public.jobs FOR SELECT
  TO public
  USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY "Admins can view all jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. BLOG POSTS: restrict public SELECT to published, non-deleted
DROP POLICY IF EXISTS "Blog posts viewable by everyone" ON public.blog_posts;
CREATE POLICY "Published blog posts viewable by everyone"
  ON public.blog_posts FOR SELECT
  TO public
  USING (published = true AND deleted_at IS NULL);

CREATE POLICY "Admins can view all blog posts"
  ON public.blog_posts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. PROFILE TYPE ESCALATION: prevent users from changing profile_type or role
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND profile_type = (SELECT p.profile_type FROM public.profiles p WHERE p.id = auth.uid())
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 5. STORAGE: drop overly broad INSERT policy on service-images
DROP POLICY IF EXISTS "Auth users can upload service images" ON storage.objects;
