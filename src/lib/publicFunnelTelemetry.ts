/**
 * FASE 2.1 — Telemetria do funil público.
 *
 * Eventos:
 *  - public_search   (busca executada: termo + categoria + cidade + result_count)
 *  - category_view   (landing de categoria visualizada)
 *  - city_view       (landing de cidade visualizada)
 *
 * Reusa a RPC `record_public_funnel_event` (fire-and-forget) que grava em
 * `audit_log` com `resource_type='public_funnel'`. A RPC já faz dedup
 * server-side de 10 min. Aqui adicionamos um dedup client-side (mesma janela)
 * via sessionStorage para evitar trip de rede em refresh/back-forward.
 *
 * Sem PII: termos que parecem telefone (>=8 dígitos) ou email são rejeitados
 * pelo servidor; aqui também filtramos curto-circuito.
 */

import { supabase } from '@/integrations/supabase/client';
import { getActiveSponsorRef } from '@/lib/sponsorAttribution';

export type PublicFunnelAction =
  | 'public_search'
  | 'category_view'
  | 'city_view'
  | 'profile_view'
  | 'lead_submit'
  | 'internal_link_click';

export type InternalLinkAnchorType =
  | 'related_category'
  | 'related_city'
  | 'nearby_city'
  | 'neighborhood'
  | 'provider'
  | 'trending'
  | 'urgency'
  | 'faq'
  | 'other';

interface BaseEvent {
  source?: string;
  pathname?: string;
}

interface PublicSearchEvent extends BaseEvent {
  term?: string | null;
  category?: string | null;
  city?: string | null;
  resultCount: number;
}

interface CategoryViewEvent extends BaseEvent {
  category: string;
  city?: string | null;
}

interface CityViewEvent extends BaseEvent {
  city: string;
  category?: string | null;
}

const TTL_MS = 10 * 60 * 1000;
const PII_RE = /(\d{8,}|@)/;

function getPath(p?: string): string {
  if (p) return p;
  try { return window.location.pathname + window.location.search; } catch { return '/'; }
}

function sanitizeTerm(t?: string | null): string | null {
  if (!t) return null;
  const trimmed = t.trim().slice(0, 80);
  if (!trimmed) return null;
  if (PII_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function shouldSend(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const k = `pft:${key}`;
    const raw = sessionStorage.getItem(k);
    const now = Date.now();
    if (raw) {
      const t = Number(raw);
      if (Number.isFinite(t) && now - t < TTL_MS) return false;
    }
    sessionStorage.setItem(k, String(now));
    return true;
  } catch {
    return false;
  }
}

function fire(action: PublicFunnelAction, payload: Record<string, unknown>) {
  // Atribuição leve: anexa sponsor_ref se houver clique sponsor recente
  // (apenas para eventos de conversão — search/category/city não atribuem).
  const wantsAttr = action === 'profile_view' || action === 'lead_submit';
  const sponsorRef = wantsAttr ? getActiveSponsorRef() : null;
  void supabase.rpc('record_public_funnel_event' as any, {
    _action: action,
    ...payload,
    ...(sponsorRef ? { _sponsor_ref: sponsorRef } : {}),
  } as any).then(() => {}, () => {});
}

/** Registra uma busca (com cardinalidade dos resultados — alimenta zero-result insights). */
export function trackPublicSearch(ev: PublicSearchEvent): void {
  if (typeof window === 'undefined') return;
  const term = sanitizeTerm(ev.term);
  const category = ev.category?.toLowerCase() || null;
  const city = ev.city?.toLowerCase() || null;
  const path = getPath(ev.pathname);
  const key = `s|${term ?? ''}|${category ?? ''}|${city ?? ''}|${path}`;
  if (!shouldSend(key)) return;
  fire('public_search', {
    _term: term,
    _category: category,
    _city: city,
    _result_count: Math.max(0, Math.floor(ev.resultCount)),
    _source: ev.source || null,
    _pathname: path,
  });
}

/** Registra visualização de página de categoria (landing SEO). */
export function trackCategoryView(ev: CategoryViewEvent): void {
  if (typeof window === 'undefined') return;
  const category = ev.category?.toLowerCase();
  if (!category) return;
  const city = ev.city?.toLowerCase() || null;
  const path = getPath(ev.pathname);
  const key = `c|${category}|${city ?? ''}|${path}`;
  if (!shouldSend(key)) return;
  fire('category_view', {
    _category: category,
    _city: city,
    _resource_id: category,
    _source: ev.source || null,
    _pathname: path,
  });
}

/** Registra visualização de página de cidade (landing SEO). */
export function trackCityView(ev: CityViewEvent): void {
  if (typeof window === 'undefined') return;
  const city = ev.city?.toLowerCase();
  if (!city) return;
  const category = ev.category?.toLowerCase() || null;
  const path = getPath(ev.pathname);
  const key = `ci|${city}|${category ?? ''}|${path}`;
  if (!shouldSend(key)) return;
  fire('city_view', {
    _city: city,
    _category: category,
    _resource_id: city,
    _source: ev.source || null,
    _pathname: path,
  });
}

interface ProfileViewEvent extends BaseEvent {
  providerId: string;
  category?: string | null;
  city?: string | null;
}

interface LeadSubmitEvent extends BaseEvent {
  providerId: string;
  category?: string | null;
  city?: string | null;
}

/**
 * Registra visualização de perfil/empresa (fechamento do funil busca→perfil).
 * Dedupado por sessão para evitar inflar contagem em refresh/back-forward.
 */
export function trackProfileView(ev: ProfileViewEvent): void {
  if (typeof window === 'undefined') return;
  const providerId = ev.providerId?.trim();
  if (!providerId) return;
  const category = ev.category?.toLowerCase() || null;
  const city = ev.city?.toLowerCase() || null;
  const path = getPath(ev.pathname);
  const key = `pv|${providerId}|${path}`;
  if (!shouldSend(key)) return;
  fire('profile_view', {
    _category: category,
    _city: city,
    _resource_id: providerId,
    _source: ev.source || null,
    _pathname: path,
  });
}

interface InternalLinkClickEvent {
  sourcePath?: string;
  targetPath: string;
  anchorType: InternalLinkAnchorType;
  positionIndex: number;
  category?: string | null;
  city?: string | null;
}

/**
 * Registra clique em link interno renderizado pelos blocos SEO
 * (SeoRelatedLinks). Fire-and-forget, sem await, sem bloquear navegação.
 * Dedup client-side 10min por (source→target). Apenas links SEO — não
 * instrumentar navbar/footer/menu global.
 */
export function trackInternalLinkClick(ev: InternalLinkClickEvent): void {
  if (typeof window === 'undefined') return;
  const target = ev.targetPath?.trim();
  if (!target) return;
  const source = getPath(ev.sourcePath);
  const anchor = ev.anchorType || 'other';
  const pos = Math.max(0, Math.floor(ev.positionIndex ?? 0));
  const key = `il|${source}|${target}|${anchor}`;
  if (!shouldSend(key)) return;
  fire('internal_link_click', {
    _category: ev.category?.toLowerCase() || null,
    _city: ev.city?.toLowerCase() || null,
    _resource_id: target,
    _source: `${anchor}:${pos}`,
    _pathname: source,
  });
}

/**
 * Registra envio confirmado de lead (fechamento perfil→lead).
 * Server-side, fire-and-forget, sem PII.
 */
export function trackLeadSubmit(ev: LeadSubmitEvent): void {
  if (typeof window === 'undefined') return;
  const providerId = ev.providerId?.trim();
  if (!providerId) return;
  const category = ev.category?.toLowerCase() || null;
  const city = ev.city?.toLowerCase() || null;
  const path = getPath(ev.pathname);
  const key = `ls|${providerId}|${path}`;
  if (!shouldSend(key)) return;
  fire('lead_submit', {
    _category: category,
    _city: city,
    _resource_id: providerId,
    _source: ev.source || null,
    _pathname: path,
  });
}
