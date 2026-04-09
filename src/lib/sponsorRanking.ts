/**
 * Sponsor Ranking Engine
 *
 * Pure functions for scoring, ranking, frequency capping and fallback.
 * Sits between the data layer (useSponsors) and the display layer (components).
 *
 * Design goals:
 *  - Combine tier weight with real CTR performance
 *  - Prevent cold-start penalty for new sponsors
 *  - Anti-dominance: cap max share of impressions per sponsor
 *  - Frequency capping: limit repeated exposure per session
 *  - Slot fallback: fill empty positions from global pool
 *  - Extensible for future eCPM / auction / conversion signals
 */

import type { SponsorFull } from '@/hooks/useSponsors';

// ---------------------------------------------------------------------------
// 1. Configuration constants
// ---------------------------------------------------------------------------

/** Base weight per tier (existing logic preserved) */
const TIER_WEIGHT: Record<string, number> = {
  premium: 5,
  destaque: 3,
  basic: 1,
};

/** How much CTR influences the final score (0 = pure tier, 1 = equal influence) */
const CTR_FACTOR = 0.3;

/** Minimum impressions before CTR is considered reliable */
const MIN_IMPRESSIONS_FOR_CTR = 100;

/** Default CTR assumed for new sponsors (cold-start floor) */
const COLD_START_CTR = 0.01;

/** Maximum effective CTR used in scoring (prevents outlier CTR from dominating) */
const MAX_EFFECTIVE_CTR = 0.15;

/** Maximum share of total display slots a single sponsor can take (0-1) */
const MAX_DOMINANCE_SHARE = 0.5;

/** Session frequency cap: max times same sponsor shown per session */
const SESSION_FREQ_CAP = 10;

/** LocalStorage key prefix for frequency tracking */
const FREQ_STORAGE_KEY = 'sp_freq_';

// ---------------------------------------------------------------------------
// 2. Scoring
// ---------------------------------------------------------------------------

export interface ScoredSponsor extends SponsorFull {
  /** Computed dynamic score */
  _score: number;
  /** Computed CTR (clicks / impressions) */
  _ctr: number;
}

/**
 * Compute a dynamic score for a sponsor.
 *
 * score = tierWeight + (effectiveCTR * CTR_FACTOR * 10)
 *
 * The "* 10" normalises CTR (typically 0.01-0.10) to a range
 * comparable with tier weights (1-5).
 *
 * Future extension points (not implemented yet):
 *  - eCPM multiplier
 *  - Conversion bonus
 *  - Auction bid overlay
 */
export function computeScore(s: SponsorFull): ScoredSponsor {
  const tierWeight = TIER_WEIGHT[s.tier] ?? TIER_WEIGHT[s.plan_tier] ?? 1;
  const impressions = s.impressions ?? 0;
  const clicks = s.clicks ?? 0;

  const rawCtr = impressions > 0 ? clicks / impressions : 0;
  const effectiveCtr =
    impressions >= MIN_IMPRESSIONS_FOR_CTR ? rawCtr : COLD_START_CTR;

  const score = tierWeight + effectiveCtr * CTR_FACTOR * 10;

  return { ...s, _score: score, _ctr: effectiveCtr };
}

// ---------------------------------------------------------------------------
// 3. Ranking with weighted randomisation
// ---------------------------------------------------------------------------

/**
 * Rank sponsors by score with controlled randomness.
 *
 * Uses a "softmax-like" weighted random pick without replacement so that
 * higher-scored sponsors appear more often but lower-scored ones still
 * get exposure (anti cold-start + diversity).
 */
export function rankSponsors(sponsors: SponsorFull[]): ScoredSponsor[] {
  if (sponsors.length === 0) return [];

  const scored = sponsors.map(computeScore);

  // Weighted shuffle without replacement
  const result: ScoredSponsor[] = [];
  const pool = [...scored];

  while (pool.length > 0) {
    const totalWeight = pool.reduce((sum, s) => sum + s._score, 0);
    let r = Math.random() * totalWeight;
    let picked = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i]._score;
      if (r <= 0) {
        picked = i;
        break;
      }
    }
    result.push(pool[picked]);
    pool.splice(picked, 1);
  }

  return result;
}

// ---------------------------------------------------------------------------
// 4. Anti-dominance filter
// ---------------------------------------------------------------------------

/**
 * Ensure no single sponsor takes more than MAX_DOMINANCE_SHARE of the
 * display slots. When displaying N items, each sponsor can appear at most
 * ceil(N * MAX_DOMINANCE_SHARE) times (in practice sponsors are unique per
 * query, so this guards against future repeated entries or multi-slot fills).
 */
export function applyAntiDominance(
  ranked: ScoredSponsor[],
  totalSlots: number,
): ScoredSponsor[] {
  const maxPerSponsor = Math.max(1, Math.ceil(totalSlots * MAX_DOMINANCE_SHARE));
  const counts = new Map<string, number>();

  return ranked.filter((s) => {
    const count = counts.get(s.id) ?? 0;
    if (count >= maxPerSponsor) return false;
    counts.set(s.id, count + 1);
    return true;
  });
}

// ---------------------------------------------------------------------------
// 5. Frequency capping (session + localStorage)
// ---------------------------------------------------------------------------

function getSessionKey(): string {
  try {
    let key = sessionStorage.getItem('sp_session_id');
    if (!key) {
      key = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('sp_session_id', key);
    }
    return key;
  } catch {
    return 'default';
  }
}

function getFreqMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(FREQ_STORAGE_KEY + getSessionKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFreqMap(map: Record<string, number>) {
  try {
    localStorage.setItem(FREQ_STORAGE_KEY + getSessionKey(), JSON.stringify(map));
  } catch {
    // storage full or unavailable — degrade gracefully
  }
}

/** Record that a sponsor was shown */
export function recordImpression(sponsorId: string) {
  const map = getFreqMap();
  map[sponsorId] = (map[sponsorId] ?? 0) + 1;
  saveFreqMap(map);
}

/** Check if a sponsor has exceeded the session frequency cap */
export function isFreqCapped(sponsorId: string): boolean {
  const map = getFreqMap();
  return (map[sponsorId] ?? 0) >= SESSION_FREQ_CAP;
}

/** Filter out frequency-capped sponsors (keeps at least 1 if all are capped) */
export function applyFrequencyCap(sponsors: ScoredSponsor[]): ScoredSponsor[] {
  const uncapped = sponsors.filter((s) => !isFreqCapped(s.id));
  return uncapped.length > 0 ? uncapped : sponsors;
}

// ---------------------------------------------------------------------------
// 6. Fallback: fill empty slots from a global pool
// ---------------------------------------------------------------------------

/**
 * If `primary` has fewer items than `desiredCount`, pad with items from
 * `fallback` that aren't already in primary, preserving ranked order.
 */
export function fillWithFallback(
  primary: ScoredSponsor[],
  fallback: ScoredSponsor[],
  desiredCount: number,
): ScoredSponsor[] {
  if (primary.length >= desiredCount) return primary.slice(0, desiredCount);

  const usedIds = new Set(primary.map((s) => s.id));
  const extras = fallback.filter((s) => !usedIds.has(s.id));
  return [...primary, ...extras].slice(0, desiredCount);
}

// ---------------------------------------------------------------------------
// 7. Full pipeline — single entry point for components
// ---------------------------------------------------------------------------

export interface RankOptions {
  /** Max items to return (from POSITION_CONFIG.maxItems) */
  maxItems: number;
  /** Optional fallback pool (e.g. global sponsors) */
  fallbackPool?: SponsorFull[];
}

/**
 * Full ranking pipeline:
 *  1. Score all sponsors
 *  2. Weighted-random rank
 *  3. Anti-dominance filter
 *  4. Frequency cap
 *  5. Fallback fill
 *
 * Returns a ready-to-display ordered array.
 */
export function rankAndOptimise(
  sponsors: SponsorFull[],
  options: RankOptions,
): ScoredSponsor[] {
  const { maxItems, fallbackPool } = options;

  // 1-2. Score + rank
  let ranked = rankSponsors(sponsors);

  // 3. Anti-dominance
  ranked = applyAntiDominance(ranked, maxItems);

  // 4. Frequency cap
  ranked = applyFrequencyCap(ranked);

  // 5. Fallback
  if (fallbackPool && ranked.length < maxItems) {
    const fallbackRanked = rankSponsors(fallbackPool);
    ranked = fillWithFallback(ranked, fallbackRanked, maxItems);
  }

  return ranked.slice(0, maxItems);
}

// ---------------------------------------------------------------------------
// 8. Cleanup — remove stale frequency data
// ---------------------------------------------------------------------------

/** Call on app init to clean up old session frequency data (> 24h) */
export function cleanupFrequencyData() {
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(FREQ_STORAGE_KEY)) {
        // Simple approach: remove if older than current session
        const sessionKey = getSessionKey();
        if (!key.endsWith(sessionKey)) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // ignore
  }
}
