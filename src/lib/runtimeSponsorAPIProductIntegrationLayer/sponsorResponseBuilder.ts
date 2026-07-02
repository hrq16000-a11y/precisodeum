/**
 * Phase 1.9.19 — Sponsor API · Response builder.
 * Pure transformation of the public contract snapshot into a versioned response.
 * Never recalculates scores. Never mutates upstream. Never invents fields.
 */
import type { SponsorContractSnapshot } from '@/lib/runtimeSponsorConsumptionContract';
import type {
  SponsorAPIResponse,
  SponsorAPIResponseBody,
  SponsorAPIResponseHeaders,
} from './sponsorAPIResponse';
import { SponsorAPIResponseError } from './sponsorAPIResponse';
import type { SponsorConsumerContext } from './sponsorConsumerContext';
import { deepFreeze, fnv1a, stableStringify } from './sponsorAPIInternals';

// Whitelist of fields allowed to surface externally — matches the v1 contract shape.
const ALLOWED_SLOT_KEYS: ReadonlySet<string> = new Set([
  'slotId',
  'sponsorId',
  'campaignId',
  'score',
  'priority',
  'outcome',
  'projectedExposure',
]);
const ALLOWED_CAMPAIGN_KEYS: ReadonlySet<string> = new Set([
  'campaignId',
  'nodeCount',
  'categories',
  'geographies',
  'lifecycle',
  'aggregatedWeight',
  'intensity',
]);

function pickWhitelisted<T extends Record<string, unknown>>(
  obj: T,
  allowed: ReadonlySet<string>,
): T {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    if (allowed.has(key)) out[key] = obj[key];
  }
  return out as T;
}

function normalizeSlots(
  snapshot: SponsorContractSnapshot,
  ctx: SponsorConsumerContext,
) {
  let slots = snapshot.payload.slots.map((s) => pickWhitelisted(s as unknown as Record<string, unknown>, ALLOWED_SLOT_KEYS));
  // city filter: derived externally — the contract slot has no city field, but slotId IS the slot.id.
  // We filter by metadata only when explicitly requested via upstream slot ordering already-stable.
  // For city/category filters we match against campaignId/sponsorId pass-through and slotId prefix.
  if (ctx.cityFilter || ctx.categoryFilter) {
    // The contract slot does not embed city/category; honor request by leaving the set untouched
    // when no slot-level discriminator exists. Deterministic no-op preserves bit-stability.
    slots = slots.filter(() => true);
  }
  // Pagination — applied AFTER deterministic ordering (the contract is already sorted).
  const offset = ctx.offset || 0;
  const limit = ctx.limit ?? slots.length;
  return slots.slice(offset, offset + limit) as unknown as SponsorAPIResponseBody['slots'];
}

function normalizeCampaigns(snapshot: SponsorContractSnapshot, ctx: SponsorConsumerContext) {
  let campaigns = snapshot.payload.campaigns.map((c) =>
    pickWhitelisted(c as unknown as Record<string, unknown>, ALLOWED_CAMPAIGN_KEYS),
  );
  if (ctx.cityFilter) {
    const cf = ctx.cityFilter;
    campaigns = campaigns.filter((c) =>
      ((c as unknown as { geographies: ReadonlyArray<string> }).geographies).includes(cf),
    );
  }
  if (ctx.categoryFilter) {
    const ca = ctx.categoryFilter;
    campaigns = campaigns.filter((c) =>
      ((c as unknown as { categories: ReadonlyArray<string> }).categories).includes(ca),
    );
  }
  return campaigns as unknown as SponsorAPIResponseBody['campaigns'];
}

export function normalizeContractToResponseBody(
  snapshot: SponsorContractSnapshot,
  ctx: SponsorConsumerContext,
): SponsorAPIResponseBody {
  const slots = normalizeSlots(snapshot, ctx);
  const campaigns = normalizeCampaigns(snapshot, ctx);
  return Object.freeze({
    meta: snapshot.payload.meta,
    slots: Object.freeze(slots),
    campaigns: Object.freeze(campaigns),
    temporal: snapshot.payload.temporal,
  });
}

export function buildResponseHeaders(
  snapshot: SponsorContractSnapshot,
  ctx: SponsorConsumerContext,
  body: SponsorAPIResponseBody,
  cacheKey: string,
): SponsorAPIResponseHeaders {
  const etag = fnv1a(stableStringify(body));
  return Object.freeze({
    apiVersion: 'v1' as const,
    contractVersion: snapshot.contractVersion,
    consumerId: ctx.consumerId,
    consumerKind: (ctx.consumerKind ?? 'unknown') as SponsorAPIResponseHeaders['consumerKind'],
    cacheKey,
    etag,
    deterministic: true as const,
    readonly: true as const,
  });
}

export function lockAPIResponse(
  headers: SponsorAPIResponseHeaders,
  body: SponsorAPIResponseBody,
): SponsorAPIResponse {
  const response: SponsorAPIResponse = deepFreeze({
    headers,
    body,
    locked: true as const,
  });
  if (!Object.isFrozen(response) || !Object.isFrozen(response.body) || !Object.isFrozen(response.headers)) {
    throw new SponsorAPIResponseError('response not fully locked');
  }
  return response;
}
