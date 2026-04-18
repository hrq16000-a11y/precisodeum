-- ============================================================
-- FASE 1: RBAC (Staff Roles) + Plano Comercial + Modal Inteligente
-- ============================================================

-- 1) Estender enum app_role com cargos de staff
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'analista';