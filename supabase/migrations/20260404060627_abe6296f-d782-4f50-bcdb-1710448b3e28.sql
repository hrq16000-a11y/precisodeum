-- Performance indexes (IF NOT EXISTS to avoid errors on existing)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone);
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp ON public.profiles (whatsapp);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts (published, deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_entity ON public.media (entity_type, entity_ref);
CREATE INDEX IF NOT EXISTS idx_media_user_ref ON public.media (user_ref);
CREATE INDEX IF NOT EXISTS idx_media_active ON public.media (is_active);
CREATE INDEX IF NOT EXISTS idx_services_provider ON public.services (provider_id);
CREATE INDEX IF NOT EXISTS idx_service_images_service ON public.service_images (service_id);
CREATE INDEX IF NOT EXISTS idx_providers_status ON public.providers (status);
CREATE INDEX IF NOT EXISTS idx_providers_slug ON public.providers (slug);
CREATE INDEX IF NOT EXISTS idx_providers_category ON public.providers (category_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_provider ON public.leads (provider_id);