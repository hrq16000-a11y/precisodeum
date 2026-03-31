import { useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import { Download, Database, Loader2, FileJson, FileSpreadsheet, Copy, Code, ChevronDown, ChevronUp, Image, FolderOpen, ExternalLink, Upload, Archive, ShieldCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MODULE_GROUPS = [
  {
    label: 'Database (Tabelas)',
    modules: [
      { table: 'profiles', label: 'Perfis / Users', icon: '👤' },
      { table: 'user_roles', label: 'Roles (Permissões)', icon: '🔐' },
      { table: 'providers', label: 'Prestadores', icon: '👷' },
      { table: 'services', label: 'Serviços', icon: '🔧' },
      { table: 'service_categories', label: 'Serviço ↔ Categorias', icon: '🏷️' },
      { table: 'service_images', label: 'Imagens de Serviços', icon: '🖼️' },
      { table: 'provider_page_settings', label: 'Config. Página Prestador', icon: '⚙️' },
      { table: 'jobs', label: 'Vagas', icon: '📋' },
      { table: 'blog_posts', label: 'Blog / Notícias', icon: '📰' },
      { table: 'sponsors', label: 'Patrocinadores', icon: '📢' },
      { table: 'sponsor_campaigns', label: 'Campanhas', icon: '🎯' },
      { table: 'sponsor_contacts', label: 'Contatos Sponsor', icon: '📇' },
      { table: 'sponsor_contracts', label: 'Contratos', icon: '📄' },
      { table: 'sponsor_metrics', label: 'Métricas Sponsor', icon: '📈' },
      { table: 'sponsor_notes', label: 'Notas Sponsor', icon: '📝' },
      { table: 'sponsor_notifications', label: 'Notif. Sponsor', icon: '🔔' },
      { table: 'categories', label: 'Categorias', icon: '📂' },
      { table: 'cities', label: 'Cidades', icon: '🏙️' },
      { table: 'neighborhoods', label: 'Bairros', icon: '🏘️' },
      { table: 'reviews', label: 'Avaliações', icon: '⭐' },
      { table: 'leads', label: 'Leads', icon: '📩' },
      { table: 'subscriptions', label: 'Assinaturas', icon: '💳' },
      { table: 'notifications', label: 'Notificações', icon: '🔔' },
      { table: 'faqs', label: 'FAQs', icon: '❓' },
      { table: 'highlights', label: 'Destaques', icon: '✨' },
      { table: 'popular_services', label: 'Serv. Populares', icon: '🔥' },
      { table: 'community_links', label: 'Links Comunidade', icon: '🤝' },
      { table: 'hero_banners', label: 'Hero Banners', icon: '🎨' },
      { table: 'site_settings', label: 'Configurações do Site', icon: '⚙️' },
    ],
  },
  {
    label: 'Anúncios',
    modules: [
      { table: 'ad_slots', label: 'Slots de Anúncios', icon: '📐' },
      { table: 'ad_slot_assignments', label: 'Atribuições de Slots', icon: '🔗' },
    ],
  },
  {
    label: 'Logs & Auditoria',
    modules: [
      { table: 'audit_log', label: 'Trilha de Auditoria', icon: '📜' },
    ],
  },
  {
    label: 'PWA & Push',
    modules: [
      { table: 'pwa_install_settings', label: 'PWA Configurações', icon: '📱' },
      { table: 'pwa_install_events', label: 'PWA Eventos', icon: '📊' },
      { table: 'push_subscriptions', label: 'Push Inscrições', icon: '🔔' },
    ],
  },
];

const ALL_MODULES = MODULE_GROUPS.flatMap(g => g.modules);

type Format = 'csv' | 'json';

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const toCsv = (data: any[]): string => {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  return [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const v = row[h];
        if (v === null || v === undefined) return '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      }).join(',')
    ),
  ].join('\n');
};

const FULL_SCHEMA_SQL = `-- ============================================
-- SQL COMPLETO DE MIGRAÇÃO — Preciso de Um
-- Gerado automaticamente pelo painel admin
-- ============================================

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUM
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Evita erro de validação de dependências durante criação das funções
SET check_function_bodies = off;

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_sponsor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.sponsor_contacts WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.get_user_sponsor_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sponsor_id FROM public.sponsor_contacts WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.increment_sponsor_impression(sponsor_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.sponsors SET impressions = impressions + 1 WHERE id = sponsor_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_sponsor_click(sponsor_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.sponsors SET clicks = clicks + 1 WHERE id = sponsor_id;
$$;

CREATE OR REPLACE FUNCTION public.track_sponsor_metric(_sponsor_id uuid, _slot_slug text, _event_type text, _page_path text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.sponsor_metrics (sponsor_id, slot_slug, event_type, page_path, event_date, count)
  VALUES (_sponsor_id, _slot_slug, _event_type, _page_path, CURRENT_DATE, 1)
  ON CONFLICT DO NOTHING;
  IF _event_type = 'impression' THEN
    UPDATE public.sponsors SET impressions = impressions + 1 WHERE id = _sponsor_id;
  ELSIF _event_type = 'click' THEN
    UPDATE public.sponsors SET clicks = clicks + 1 WHERE id = _sponsor_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_provider_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.whatsapp IS NOT NULL THEN
    NEW.whatsapp := REGEXP_REPLACE(NEW.whatsapp, '[^0-9]', '', 'g');
    NEW.whatsapp := REGEXP_REPLACE(NEW.whatsapp, '^0+', '');
    IF LENGTH(NEW.whatsapp) >= 10 AND LENGTH(NEW.whatsapp) <= 11 AND NEW.whatsapp NOT LIKE '55%' THEN
      NEW.whatsapp := '55' || NEW.whatsapp;
    END IF;
  END IF;
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g');
    NEW.phone := REGEXP_REPLACE(NEW.phone, '^0+', '');
    IF LENGTH(NEW.phone) >= 10 AND LENGTH(NEW.phone) <= 11 AND NEW.phone NOT LIKE '55%' THEN
      NEW.phone := '55' || NEW.phone;
    END IF;
  END IF;
  IF (NEW.whatsapp IS NULL OR NEW.whatsapp = '') AND NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.whatsapp := NEW.phone;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_provider_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    NEW.slug := LOWER(NEW.slug);
    NEW.slug := TRANSLATE(NEW.slug, 'àáâãäåèéêëìíîïòóôõöùúûüýñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ', 'aaaaaaeeeeiiiioooooouuuuyncAAAAAAEEEEIIIIOOOOOUUUUYNC');
    NEW.slug := REGEXP_REPLACE(NEW.slug, '[_\\s]+', '-', 'g');
    NEW.slug := REGEXP_REPLACE(NEW.slug, '[^a-z0-9-]', '', 'g');
    NEW.slug := REGEXP_REPLACE(NEW.slug, '-{2,}', '-', 'g');
    NEW.slug := TRIM(BOTH '-' FROM NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_approve_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    IF EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'auto_approve_providers' AND value = 'true') THEN
      NEW.status := 'approved';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_premium_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total_providers INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_providers FROM public.providers WHERE status = 'approved';
  IF total_providers <= 500 OR NEW.created_at <= '2027-06-30T23:59:59Z'::timestamptz THEN
    NEW.plan := 'premium';
    NEW.featured := true;
  END IF;
  RETURN NEW;
END;
$$;

-- TABLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  whatsapp text DEFAULT '',
  avatar_url text,
  role text NOT NULL DEFAULT 'client',
  profile_type text NOT NULL DEFAULT 'client',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  icon text NOT NULL DEFAULT '🔧',
  parent_id uuid REFERENCES public.categories(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  state text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  city_id uuid NOT NULL REFERENCES public.cities(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_name text,
  description text NOT NULL DEFAULT '',
  photo_url text,
  phone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  neighborhood text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.categories(id),
  slug text,
  website text,
  plan text NOT NULL DEFAULT 'premium',
  status text NOT NULL DEFAULT 'pending',
  featured boolean NOT NULL DEFAULT true,
  rating_avg numeric NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  years_experience integer NOT NULL DEFAULT 0,
  response_time text,
  service_radius text,
  working_hours text,
  latitude numeric,
  longitude numeric,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  service_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price text,
  whatsapp text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  service_area text NOT NULL DEFAULT '',
  working_hours text NOT NULL DEFAULT '',
  website text DEFAULT '',
  category_id uuid REFERENCES public.categories(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id),
  category_id uuid NOT NULL REFERENCES public.categories(id)
);

CREATE TABLE IF NOT EXISTS public.service_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id),
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_page_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL UNIQUE REFERENCES public.providers(id),
  theme text DEFAULT 'default',
  headline text DEFAULT '',
  tagline text DEFAULT '',
  accent_color text DEFAULT '',
  cover_image_url text DEFAULT '',
  cta_text text DEFAULT 'Solicitar Orçamento',
  cta_whatsapp_text text DEFAULT 'Chamar no WhatsApp',
  instagram_url text DEFAULT '',
  facebook_url text DEFAULT '',
  youtube_url text DEFAULT '',
  tiktok_url text DEFAULT '',
  sections_order jsonb NOT NULL DEFAULT '["about","portfolio","services","reviews","lead_form"]',
  hidden_sections jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  user_id uuid NOT NULL,
  rating integer NOT NULL DEFAULT 5,
  quality_rating integer NOT NULL DEFAULT 5,
  punctuality_rating integer NOT NULL DEFAULT 5,
  service_rating integer NOT NULL DEFAULT 5,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  client_name text NOT NULL,
  phone text NOT NULL,
  message text,
  service_needed text,
  status text NOT NULL DEFAULT 'new',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  subtitle text DEFAULT '',
  slug text,
  description text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  neighborhood text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  job_type text NOT NULL DEFAULT '',
  work_model text NOT NULL DEFAULT '',
  opportunity_type text NOT NULL DEFAULT 'servico',
  status text NOT NULL DEFAULT 'active',
  approval_status text NOT NULL DEFAULT 'approved',
  salary text DEFAULT '',
  benefits text DEFAULT '',
  requirements text DEFAULT '',
  activities text DEFAULT '',
  schedule text DEFAULT '',
  deadline text,
  cover_image_url text,
  category_id uuid REFERENCES public.categories(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT 'Equipe Preciso de um',
  cover_image_url text,
  source_url text,
  published boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text,
  link_url text,
  position text NOT NULL DEFAULT 'sidebar',
  tier text NOT NULL DEFAULT 'bronze',
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id),
  user_id uuid NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsor_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  budget numeric DEFAULT 0,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsor_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id),
  contract_number text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  value numeric DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsor_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id),
  slot_slug text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT 'impression',
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 1,
  page_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id),
  author_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsor_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id),
  user_id uuid,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ad_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  page_type text NOT NULL DEFAULT 'global',
  description text NOT NULL DEFAULT '',
  max_ads integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ad_slot_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.ad_slots(id),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id),
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  start_date date,
  end_date date,
  target_category text,
  target_city text,
  target_state text,
  target_keywords text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'system',
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  link_url text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.popular_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🔧',
  category_name text NOT NULL DEFAULT '',
  category_slug text,
  min_price numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🔗',
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hero_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  image_url text,
  cta_text text NOT NULL DEFAULT 'Cadastrar agora',
  cta_link text NOT NULL DEFAULT '/cadastro',
  text_alignment text NOT NULL DEFAULT 'center',
  overlay_opacity numeric NOT NULL DEFAULT 0.8,
  animation_type text NOT NULL DEFAULT 'fade',
  animation_duration numeric NOT NULL DEFAULT 500,
  animation_delay numeric NOT NULL DEFAULT 0,
  target_device text NOT NULL DEFAULT 'all',
  target_city text,
  target_state text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT 'true',
  label text NOT NULL DEFAULT '',
  description text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pwa_install_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  device_type text NOT NULL DEFAULT 'unknown',
  source text NOT NULL DEFAULT 'banner',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pwa_install_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  title text NOT NULL DEFAULT 'Instale o App',
  subtitle text NOT NULL DEFAULT 'Acesse mais rápido direto da tela inicial',
  cta_text text NOT NULL DEFAULT 'Instalar App',
  dismiss_text text NOT NULL DEFAULT 'Agora não',
  ios_instruction text NOT NULL DEFAULT 'Toque em compartilhar e depois em "Adicionar à Tela de Início"',
  accent_color text NOT NULL DEFAULT '#F97316',
  animation_type text NOT NULL DEFAULT 'slide-up',
  animation_duration integer NOT NULL DEFAULT 300,
  show_delay_seconds integer NOT NULL DEFAULT 5,
  min_visits integer NOT NULL DEFAULT 1,
  max_impressions integer NOT NULL DEFAULT 0,
  dismiss_cooldown_days integer NOT NULL DEFAULT 7,
  show_on_mobile boolean NOT NULL DEFAULT true,
  show_on_desktop boolean NOT NULL DEFAULT true,
  show_for_visitors boolean NOT NULL DEFAULT true,
  show_for_logged_in boolean NOT NULL DEFAULT true,
  show_floating_banner boolean NOT NULL DEFAULT true,
  show_homepage_section boolean NOT NULL DEFAULT true,
  show_in_footer boolean NOT NULL DEFAULT true,
  footer_cta_text text NOT NULL DEFAULT 'Instalar App',
  homepage_section_title text NOT NULL DEFAULT 'Tenha o app na palma da mão',
  homepage_section_subtitle text NOT NULL DEFAULT 'Instale gratuitamente e acesse profissionais, serviços e vagas com um toque.',
  homepage_section_cta text NOT NULL DEFAULT 'Instalar Agora',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- VIEW
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, full_name, avatar_url FROM public.profiles;

-- TRIGGERS
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE TRIGGER sanitize_provider_phone_trigger
  BEFORE INSERT OR UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_provider_phone();

CREATE OR REPLACE TRIGGER sanitize_provider_slug_trigger
  BEFORE INSERT OR UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_provider_slug();

CREATE OR REPLACE TRIGGER auto_approve_provider_trigger
  BEFORE INSERT ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.auto_approve_provider();

CREATE OR REPLACE TRIGGER auto_premium_provider_trigger
  BEFORE INSERT ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.auto_premium_provider();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_page_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_slot_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popular_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pwa_install_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pwa_install_settings ENABLE ROW LEVEL SECURITY;

-- POLICIES (com DROP IF EXISTS para idempotência)
-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- providers
DROP POLICY IF EXISTS "Providers are viewable by everyone" ON public.providers;
CREATE POLICY "Providers are viewable by everyone" ON public.providers FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Users can insert own provider" ON public.providers;
CREATE POLICY "Users can insert own provider" ON public.providers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own provider" ON public.providers;
CREATE POLICY "Users can update own provider" ON public.providers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can update all providers" ON public.providers;
CREATE POLICY "Admins can update all providers" ON public.providers FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can delete providers" ON public.providers;
CREATE POLICY "Admins can delete providers" ON public.providers FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- services
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;
CREATE POLICY "Services are viewable by everyone" ON public.services FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Provider can manage own services" ON public.services;
CREATE POLICY "Provider can manage own services" ON public.services FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM providers WHERE providers.id = services.provider_id AND providers.user_id = auth.uid()));
DROP POLICY IF EXISTS "Provider can update own services" ON public.services;
CREATE POLICY "Provider can update own services" ON public.services FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM providers WHERE providers.id = services.provider_id AND providers.user_id = auth.uid()));
DROP POLICY IF EXISTS "Provider can delete own services" ON public.services;
CREATE POLICY "Provider can delete own services" ON public.services FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM providers WHERE providers.id = services.provider_id AND providers.user_id = auth.uid()));

-- public tables (SELECT)
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Cities are viewable by everyone" ON public.cities;
CREATE POLICY "Cities are viewable by everyone" ON public.cities FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Neighborhoods are viewable by everyone" ON public.neighborhoods;
CREATE POLICY "Neighborhoods are viewable by everyone" ON public.neighborhoods FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Jobs viewable by everyone" ON public.jobs;
CREATE POLICY "Jobs viewable by everyone" ON public.jobs FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Blog posts viewable by everyone" ON public.blog_posts;
CREATE POLICY "Blog posts viewable by everyone" ON public.blog_posts FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "FAQs viewable by everyone" ON public.faqs;
CREATE POLICY "FAQs viewable by everyone" ON public.faqs FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Highlights viewable by everyone" ON public.highlights;
CREATE POLICY "Highlights viewable by everyone" ON public.highlights FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Popular services viewable by everyone" ON public.popular_services;
CREATE POLICY "Popular services viewable by everyone" ON public.popular_services FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Site settings viewable by everyone" ON public.site_settings;
CREATE POLICY "Site settings viewable by everyone" ON public.site_settings FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Ad slots viewable by everyone" ON public.ad_slots;
CREATE POLICY "Ad slots viewable by everyone" ON public.ad_slots FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Assignments viewable by everyone" ON public.ad_slot_assignments;
CREATE POLICY "Assignments viewable by everyone" ON public.ad_slot_assignments FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Page settings viewable by everyone" ON public.provider_page_settings;
CREATE POLICY "Page settings viewable by everyone" ON public.provider_page_settings FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Service categories viewable by everyone" ON public.service_categories;
CREATE POLICY "Service categories viewable by everyone" ON public.service_categories FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Service images viewable by everyone" ON public.service_images;
CREATE POLICY "Service images viewable by everyone" ON public.service_images FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Anyone can view active hero banners" ON public.hero_banners;
CREATE POLICY "Anyone can view active hero banners" ON public.hero_banners FOR SELECT TO anon, authenticated USING (active = true);
DROP POLICY IF EXISTS "Anyone can read pwa settings" ON public.pwa_install_settings;
CREATE POLICY "Anyone can read pwa settings" ON public.pwa_install_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Anyone can insert pwa events" ON public.pwa_install_events;
CREATE POLICY "Anyone can insert pwa events" ON public.pwa_install_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can create leads" ON public.leads;
CREATE POLICY "Anyone can create leads" ON public.leads FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM providers WHERE providers.id = leads.provider_id AND providers.status = 'approved'));

-- notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- admin CRUD pattern (categories, cities, faqs, highlights, popular_services, blog_posts, sponsors, etc.)
-- Replicate for each table: INSERT/UPDATE/DELETE with has_role(auth.uid(), 'admin')

-- Reativa validação de corpo das funções
SET check_function_bodies = on;
`;

const escapeSQL = (val: any): string => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
};

// Tables that reference auth.users directly — need special handling
const AUTH_DEPENDENT_TABLES = ['user_roles', 'profiles', 'push_subscriptions'];

const generateInsertSQL = (table: string, rows: any[]): string => {
  if (!rows || rows.length === 0) return '';

  const cols = Object.keys(rows[0]);
  const onConflict = ' ON CONFLICT DO NOTHING';

  const lines = rows.map(row => {
    const vals = cols.map(c => escapeSQL(row[c]));

    // Avoid FK error when target DB does not have that auth user yet
    const userIdCol = table === 'profiles' ? 'id' : 'user_id';
    if (AUTH_DEPENDENT_TABLES.includes(table) && row[userIdCol]) {
      return `INSERT INTO public.${table} (${cols.join(', ')}) SELECT ${vals.join(', ')} WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ${escapeSQL(row[userIdCol])}::uuid)${onConflict};`;
    }

    return `INSERT INTO public.${table} (${cols.join(', ')}) VALUES (${vals.join(', ')})${onConflict};`;
  });

  let header = `-- ${table} (${rows.length} registros)`;
  if (AUTH_DEPENDENT_TABLES.includes(table)) {
    header += `\n-- ⚠️ ATENÇÃO: Esta tabela referencia auth.users; registros sem usuário correspondente no destino serão ignorados.`;
  }

  return `${header}\n${lines.join('\n')}`;
};

const STORAGE_BUCKETS = [
  { id: 'avatars', label: 'Avatares', icon: '👤' },
  { id: 'portfolio', label: 'Portfólio', icon: '🖼️' },
  { id: 'service-images', label: 'Imagens de Serviços', icon: '📸' },
];

interface StorageFile {
  bucket: string;
  folder: string;
  name: string;
  size: number;
  url: string;
}

const StorageBackupSection = () => {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [scanned, setScanned] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [zipExporting, setZipExporting] = useState(false);
  const [zipBucket, setZipBucket] = useState<string>('all');
  const [zipImporting, setZipImporting] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'preserve'>('replace');
  const [zipProgress, setZipProgress] = useState<{ processed: number; total: number; status?: string } | null>(null);

  const scanBuckets = async () => {
    setLoading(true);
    const allFiles: StorageFile[] = [];
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    for (const bucket of STORAGE_BUCKETS) {
      try {
        const { data: topLevel } = await supabase.storage.from(bucket.id).list('', { limit: 500 });
        if (!topLevel) continue;

        for (const item of topLevel) {
          if (item.id === null) {
            const { data: subFiles } = await supabase.storage.from(bucket.id).list(item.name, { limit: 500 });
            if (subFiles) {
              for (const sf of subFiles) {
                if (!sf.name || sf.name === '.emptyFolderPlaceholder') continue;
                if (sf.id === null) {
                  const { data: deepFiles } = await supabase.storage.from(bucket.id).list(`${item.name}/${sf.name}`, { limit: 500 });
                  if (deepFiles) {
                    for (const df of deepFiles) {
                      if (!df.name || df.name === '.emptyFolderPlaceholder' || df.id === null) continue;
                      const path = `${item.name}/${sf.name}/${df.name}`;
                      allFiles.push({
                        bucket: bucket.id,
                        folder: `${item.name}/${sf.name}`,
                        name: df.name,
                        size: (df.metadata as any)?.size || 0,
                        url: `${supabaseUrl}/storage/v1/object/public/${bucket.id}/${path}`,
                      });
                    }
                  }
                } else {
                  const path = `${item.name}/${sf.name}`;
                  allFiles.push({
                    bucket: bucket.id,
                    folder: item.name,
                    name: sf.name,
                    size: (sf.metadata as any)?.size || 0,
                    url: `${supabaseUrl}/storage/v1/object/public/${bucket.id}/${path}`,
                  });
                }
              }
            }
          } else {
            if (!item.name || item.name === '.emptyFolderPlaceholder') continue;
            allFiles.push({
              bucket: bucket.id,
              folder: '/',
              name: item.name,
              size: (item.metadata as any)?.size || 0,
              url: `${supabaseUrl}/storage/v1/object/public/${bucket.id}/${item.name}`,
            });
          }
        }
      } catch (err) {
        console.error(`Error scanning bucket ${bucket.id}:`, err);
      }
    }

    setFiles(allFiles);
    setScanned(true);
    setLoading(false);
    toast.success(`${allFiles.length} arquivos encontrados em ${STORAGE_BUCKETS.length} buckets`);
  };

  const toggleFolder = (key: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportUrlList = () => {
    const lines = files.map(f => f.url);
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storage-backup-urls-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Lista de URLs exportada!');
  };

  const exportJson = () => {
    const hierarchy: Record<string, Record<string, { name: string; size: number; url: string }[]>> = {};
    for (const f of files) {
      if (!hierarchy[f.bucket]) hierarchy[f.bucket] = {};
      if (!hierarchy[f.bucket][f.folder]) hierarchy[f.bucket][f.folder] = [];
      hierarchy[f.bucket][f.folder].push({ name: f.name, size: f.size, url: f.url });
    }
    const content = JSON.stringify(hierarchy, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storage-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup JSON exportado!');
  };

  const copyAllUrls = () => {
    navigator.clipboard.writeText(files.map(f => f.url).join('\n'));
    toast.success('URLs copiadas para a área de transferência!');
  };

  const exportZip = async () => {
    setZipExporting(true);
    setZipProgress(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const params = new URLSearchParams({ action: 'export' });
      if (zipBucket !== 'all') params.set('bucket', zipBucket);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/storage-backup?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Erro ao exportar');
      }

      // Read streaming NDJSON response
      const reader = res.body?.getReader();
      if (!reader) throw new Error('Streaming não suportado');

      const decoder = new TextDecoder();
      let buffer = '';
      let zipFilename = 'storage-backup.zip';
      let zipBase64 = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'progress') {
              setZipProgress({ processed: msg.processed, total: msg.total });
            } else if (msg.type === 'status') {
              setZipProgress(prev => prev ? { ...prev, status: msg.message } : { processed: 0, total: 0, status: msg.message });
            } else if (msg.type === 'complete') {
              zipFilename = msg.filename;
              zipBase64 = msg.data;
            }
          } catch {}
        }
      }

      if (!zipBase64) throw new Error('Nenhum dado recebido');

      // Convert base64 to blob and download
      const binaryString = atob(zipBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFilename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('ZIP baixado com sucesso!');
      await logAuditAction({ action: 'export_storage_zip', resource_type: 'storage', details: { bucket: zipBucket } });
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
    setZipExporting(false);
    setZipProgress(null);
  };

  const importZip = async (file: File) => {
    setZipImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const params = new URLSearchParams({ action: 'import', mode: importMode });

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/storage-backup?${params}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao importar');

      toast.success(`Importação concluída: ${result.imported} arquivos importados, ${result.skipped} ignorados`);
      if (result.errors?.length > 0) {
        toast.error(`${result.errors.length} erros: ${result.errors[0]}`);
      }
      await logAuditAction({ action: 'import_storage_zip', resource_type: 'storage', details: result });
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
    setZipImporting(false);
  };

  // Build hierarchy for display
  const hierarchy: Record<string, Record<string, StorageFile[]>> = {};
  for (const f of files) {
    if (!hierarchy[f.bucket]) hierarchy[f.bucket] = {};
    if (!hierarchy[f.bucket][f.folder]) hierarchy[f.bucket][f.folder] = [];
    hierarchy[f.bucket][f.folder].push(f);
  }

  const totalSizeKB = Math.round(files.reduce((s, f) => s + f.size, 0) / 1024);

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
        <Image className="h-5 w-5" /> Backup de Imagens (Storage)
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Escaneia todos os buckets de armazenamento e lista arquivos com URLs públicas para download
      </p>

      <div className="mt-4 flex gap-2 flex-wrap">
        <Button variant="accent" onClick={scanBuckets} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Database className="mr-1 h-4 w-4" />}
          {scanned ? 'Reescanear' : 'Escanear Buckets'}
        </Button>
        {scanned && files.length > 0 && (
          <>
            <Button variant="outline" onClick={exportJson}>
              <FileJson className="mr-1 h-4 w-4" /> Exportar JSON
            </Button>
            <Button variant="outline" onClick={exportUrlList}>
              <Download className="mr-1 h-4 w-4" /> Lista de URLs
            </Button>
            <Button variant="outline" onClick={copyAllUrls}>
              <Copy className="mr-1 h-4 w-4" /> Copiar URLs
            </Button>
          </>
        )}
      </div>

      {/* ZIP Export */}
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Archive className="h-4 w-4" /> Exportar ZIP (Download direto dos arquivos)
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Baixa todos os arquivos binários do Storage e compacta em um .zip mantendo a hierarquia bucket/pasta/arquivo
        </p>
        <div className="mt-3 flex gap-2 items-center flex-wrap">
          <Select value={zipBucket} onValueChange={setZipBucket}>
            <SelectTrigger className="w-[200px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os buckets</SelectItem>
              {STORAGE_BUCKETS.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.icon} {b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="accent" onClick={exportZip} disabled={zipExporting}>
            {zipExporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Archive className="mr-1 h-4 w-4" />}
            Baixar .ZIP
          </Button>
        </div>
        {zipProgress && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{zipProgress.status || `Processando arquivos...`}</span>
              <span>{zipProgress.total > 0 ? `${zipProgress.processed}/${zipProgress.total}` : ''}</span>
            </div>
            <Progress value={zipProgress.total > 0 ? (zipProgress.processed / zipProgress.total) * 100 : 0} className="h-2" />
          </div>
        )}
      </div>

      {/* ZIP Import */}
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Upload className="h-4 w-4" /> Importar ZIP (Restaurar Storage)
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Faça upload de um .zip exportado anteriormente. A hierarquia bucket/pasta/arquivo será recriada automaticamente.
        </p>
        <div className="mt-3 flex gap-2 items-center flex-wrap">
          <Select value={importMode} onValueChange={(v) => setImportMode(v as 'replace' | 'preserve')}>
            <SelectTrigger className="w-[220px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="replace">
                <span className="flex items-center gap-1">🔄 Substituir existentes</span>
              </SelectItem>
              <SelectItem value="preserve">
                <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Preservar existentes</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importZip(file);
                e.target.value = '';
              }}
              disabled={zipImporting}
            />
            <Button variant="outline" asChild disabled={zipImporting}>
              <span>
                {zipImporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                Selecionar .ZIP
              </span>
            </Button>
          </label>
        </div>
      </div>

      {scanned && (
        <div className="mt-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{files.length}</span> arquivos encontrados
          {' · '}
          <span className="font-semibold text-foreground">{totalSizeKB > 1024 ? `${(totalSizeKB / 1024).toFixed(1)} MB` : `${totalSizeKB} KB`}</span> total
        </div>
      )}

      {scanned && Object.keys(hierarchy).length > 0 && (
        <div className="mt-4 space-y-3">
          {STORAGE_BUCKETS.map(bucket => {
            const bucketFiles = hierarchy[bucket.id];
            if (!bucketFiles) return null;
            const bucketKey = `bucket-${bucket.id}`;
            const isExpanded = expandedFolders.has(bucketKey);
            const fileCount = Object.values(bucketFiles).reduce((s, arr) => s + arr.length, 0);

            return (
              <div key={bucket.id} className="rounded-lg border border-border bg-background">
                <button
                  onClick={() => toggleFolder(bucketKey)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{bucket.icon}</span>
                    <span className="font-bold text-sm text-foreground">{bucket.label}</span>
                    <span className="text-xs text-muted-foreground">({fileCount} arquivos)</span>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {Object.entries(bucketFiles).sort(([a], [b]) => a.localeCompare(b)).map(([folder, folderFiles]) => {
                      const folderKey = `${bucket.id}/${folder}`;
                      const isFolderExpanded = expandedFolders.has(folderKey);

                      return (
                        <div key={folderKey} className="rounded-md border border-border/50 bg-muted/30">
                          <button
                            onClick={() => toggleFolder(folderKey)}
                            className="w-full flex items-center justify-between p-2 hover:bg-muted/50 transition-colors rounded-md"
                          >
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs font-medium text-foreground">{folder === '/' ? '(raiz)' : folder}</span>
                              <span className="text-xs text-muted-foreground">({folderFiles.length})</span>
                            </div>
                            {isFolderExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>

                          {isFolderExpanded && (
                            <div className="px-2 pb-2 space-y-1">
                              {folderFiles.map((f, i) => (
                                <div key={i} className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-background transition-colors">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <img src={f.url} alt="" className="h-8 w-8 rounded object-cover shrink-0 border border-border" onError={e => (e.currentTarget.style.display = 'none')} />
                                    <span className="truncate text-foreground">{f.name}</span>
                                    <span className="text-muted-foreground shrink-0">{f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)}MB` : `${Math.round(f.size / 1024)}KB`}</span>
                                  </div>
                                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0 ml-2 text-accent hover:text-accent/80">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AdminBackupPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [exporting, setExporting] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [showDataSql, setShowDataSql] = useState(false);
  const [dataSql, setDataSql] = useState('');
  const [generatingData, setGeneratingData] = useState(false);

  const exportModule = async (table: string, label: string, format: Format) => {
    setExporting(table + format);
    try {
      const { data, error } = await supabase.from(table as any).select('*').limit(10000);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info(`${label}: nenhum registro encontrado`);
        setExporting(null);
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      if (format === 'json') {
        downloadFile(JSON.stringify(data, null, 2), `${table}_${date}.json`, 'application/json');
      } else {
        downloadFile(toCsv(data), `${table}_${date}.csv`, 'text/csv;charset=utf-8;');
      }
      await logAuditAction({ action: 'export_backup', resource_type: table, details: { format, count: data.length } });
      toast.success(`${label}: ${data.length} registros exportados (${format.toUpperCase()})`);
    } catch (err: any) {
      toast.error(`Erro ao exportar ${label}: ${err.message}`);
    }
    setExporting(null);
  };

  const exportAll = async (format: Format) => {
    setExporting('all' + format);
    const allData: Record<string, any[]> = {};
    for (const mod of ALL_MODULES) {
      const { data } = await supabase.from(mod.table as any).select('*').limit(10000);
      allData[mod.table] = data || [];
    }
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      downloadFile(JSON.stringify(allData, null, 2), `backup_completo_${date}.json`, 'application/json');
    } else {
      let combined = '';
      for (const [table, rows] of Object.entries(allData)) {
        if (rows.length === 0) continue;
        combined += `\n--- ${table} (${rows.length} registros) ---\n`;
        combined += toCsv(rows) + '\n';
      }
      downloadFile(combined, `backup_completo_${date}.csv`, 'text/csv;charset=utf-8;');
    }
    await logAuditAction({ action: 'export_backup_full', resource_type: 'system', details: { format, modules: ALL_MODULES.length } });
    toast.success(`Backup completo exportado (${format.toUpperCase()})`);
    setExporting(null);
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-6 w-6" /> Backup & Exportação Completa
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Exporte todos os dados do sistema — {ALL_MODULES.length} tabelas disponíveis</p>
        </div>
      </div>

      {/* SQL Schema for Migration */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Code className="h-5 w-5" /> SQL de Migração (Schema Completo)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Copie este SQL para recriar todas as tabelas, funções, triggers e RLS em outro projeto
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(FULL_SCHEMA_SQL);
                toast.success('SQL copiado para a área de transferência!');
              }}
            >
              <Copy className="mr-1 h-4 w-4" /> Copiar SQL
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSql(!showSql)}
            >
              {showSql ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              {showSql ? 'Ocultar' : 'Visualizar'}
            </Button>
          </div>
        </div>
        {showSql && (
          <pre className="mt-4 max-h-[500px] overflow-auto rounded-lg bg-muted p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap border border-border">
            {FULL_SCHEMA_SQL}
          </pre>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              downloadFile(FULL_SCHEMA_SQL, `schema_migracao_${new Date().toISOString().slice(0, 10)}.sql`, 'text/sql');
              toast.success('Arquivo SQL baixado!');
            }}
          >
            <Download className="mr-1 h-4 w-4" /> Baixar .sql
          </Button>
        </div>
      </div>

      {/* SQL de Dados (INSERT statements) */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Database className="h-5 w-5" /> SQL de Dados (INSERT)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Gera INSERTs de todas as tabelas para migrar os dados para outro projeto
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="accent"
              size="sm"
              disabled={generatingData}
              onClick={async () => {
                setGeneratingData(true);
                try {
                  const parts: string[] = [
                    '-- ============================================',
                    '-- SQL DE DADOS — Preciso de Um',
                    `-- Gerado em: ${new Date().toISOString()}`,
                    '-- ============================================',
                    '',
                  ];
                  // Order tables to respect FK dependencies
                  const orderedTables = [
                    'categories', 'cities', 'neighborhoods', 'site_settings', 'faqs',
                    'highlights', 'popular_services', 'community_links', 'hero_banners',
                    'profiles', 'user_roles', 'providers', 'provider_page_settings',
                    'services', 'service_categories', 'service_images',
                    'reviews', 'leads', 'jobs', 'blog_posts',
                    'sponsors', 'sponsor_contacts', 'sponsor_campaigns',
                    'sponsor_contracts', 'sponsor_metrics', 'sponsor_notes', 'sponsor_notifications',
                    'ad_slots', 'ad_slot_assignments',
                    'notifications', 'subscriptions',
                    'pwa_install_settings', 'pwa_install_events', 'push_subscriptions',
                    'audit_log',
                  ];
                  for (const table of orderedTables) {
                    const { data } = await supabase.from(table as any).select('*').limit(10000);
                    if (data && data.length > 0) {
                      parts.push('');
                      parts.push(generateInsertSQL(table, data));
                    }
                  }
                  const sql = parts.join('\n');
                  setDataSql(sql);
                  setShowDataSql(true);
                  toast.success('SQL de dados gerado com sucesso!');
                } catch (err: any) {
                  toast.error(`Erro: ${err.message}`);
                }
                setGeneratingData(false);
              }}
            >
              {generatingData ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Code className="mr-1 h-4 w-4" />}
              Gerar SQL de Dados
            </Button>
            {dataSql && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(dataSql);
                    toast.success('SQL de dados copiado!');
                  }}
                >
                  <Copy className="mr-1 h-4 w-4" /> Copiar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    downloadFile(dataSql, `dados_migracao_${new Date().toISOString().slice(0, 10)}.sql`, 'text/sql');
                    toast.success('Arquivo SQL de dados baixado!');
                  }}
                >
                  <Download className="mr-1 h-4 w-4" /> Baixar .sql
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDataSql(!showDataSql)}
                >
                  {showDataSql ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                  {showDataSql ? 'Ocultar' : 'Visualizar'}
                </Button>
              </>
            )}
          </div>
        </div>
        {showDataSql && dataSql && (
          <pre className="mt-4 max-h-[500px] overflow-auto rounded-lg bg-muted p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap border border-border">
            {dataSql}
          </pre>
        )}
      </div>

      {/* Full backup */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-bold text-foreground">Backup Completo</h2>
        <p className="text-sm text-muted-foreground mt-1">Exporta todas as {ALL_MODULES.length} tabelas em um único arquivo</p>
        <div className="mt-4 flex gap-2">
          <Button variant="accent" onClick={() => exportAll('json')} disabled={!!exporting}>
            {exporting === 'alljson' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileJson className="mr-1 h-4 w-4" />}
            Exportar JSON
          </Button>
          <Button variant="outline" onClick={() => exportAll('csv')} disabled={!!exporting}>
            {exporting === 'allcsv' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Storage / Images Backup */}
      <StorageBackupSection />

      {/* Grouped per-module export */}
      {MODULE_GROUPS.map(group => (
        <div key={group.label} className="mt-6">
          <h2 className="font-display text-base font-bold text-foreground mb-3">{group.label}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.modules.map(mod => (
              <div key={mod.table} className="rounded-xl border border-border bg-card p-4 shadow-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{mod.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{mod.label}</h3>
                    <p className="text-xs text-muted-foreground">{mod.table}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => exportModule(mod.table, mod.label, 'json')} disabled={!!exporting} title="JSON">
                    {exporting === mod.table + 'json' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => exportModule(mod.table, mod.label, 'csv')} disabled={!!exporting} title="CSV">
                    {exporting === mod.table + 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </AdminLayout>
  );
};

export default AdminBackupPage;
