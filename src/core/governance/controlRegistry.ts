/**
 * Control Registry v1
 *
 * Central registry of all governable dimensions in the platform.
 * Every tunable parameter, weight, toggle, or strategy is registered here
 * so the Control Plane knows what it can govern.
 *
 * PRINCIPLE: If it's not registered, it can't be governed.
 */

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export type GovernableDomain =
  | 'sil'
  | 'geo'
  | 'ranking'
  | 'runtime'
  | 'ui'
  | 'storage'
  | 'auth';

export type GovernableType = 'weight' | 'threshold' | 'toggle' | 'strategy' | 'limit' | 'enum';

export interface GovernableEntry {
  domain: GovernableDomain;
  key: string;
  type: GovernableType;
  defaultValue: unknown;
  currentValue: unknown;
  description: string;
  constraints?: {
    min?: number;
    max?: number;
    enum?: string[];
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Registry Store
// ═══════════════════════════════════════════════════════════════════════

const _registry = new Map<string, GovernableEntry>();

function registryKey(domain: GovernableDomain, key: string): string {
  return `${domain}::${key}`;
}

// ═══════════════════════════════════════════════════════════════════════
// Pre-register all known governable parameters
// ═══════════════════════════════════════════════════════════════════════

const DEFAULTS: GovernableEntry[] = [
  // SIL weights
  { domain: 'sil', key: 'geoWeight', type: 'weight', defaultValue: 0.6, currentValue: 0.6, description: 'Weight applied to geo score in hybrid searches' },
  { domain: 'sil', key: 'serviceWeight', type: 'weight', defaultValue: 0.4, currentValue: 0.4, description: 'Weight applied to service relevance score' },
  { domain: 'sil', key: 'confidenceThreshold', type: 'threshold', defaultValue: 0.4, currentValue: 0.4, description: 'Minimum geo confidence before fallback to SERVICE_ONLY' },
  { domain: 'sil', key: 'enableGeoFiltering', type: 'toggle', defaultValue: true, currentValue: true, description: 'Enable geo-based filtering of providers' },
  { domain: 'sil', key: 'enableHybridBoost', type: 'toggle', defaultValue: true, currentValue: true, description: 'Boost scores in HYBRID intent mode' },
  { domain: 'sil', key: 'fallbackMode', type: 'enum', defaultValue: 'both', currentValue: 'both', description: 'Fallback mode when confidence is low', constraints: { enum: ['geo', 'service', 'both'] } },

  // GeoEngine
  { domain: 'geo', key: 'defaultRadius', type: 'limit', defaultValue: 50, currentValue: 50, description: 'Default search radius in km' },
  { domain: 'geo', key: 'overmatchProtectionLevel', type: 'enum', defaultValue: 'medium', currentValue: 'medium', description: 'Overmatch protection strictness', constraints: { enum: ['low', 'medium', 'high'] } },
  { domain: 'geo', key: 'metroExpansionEnabled', type: 'toggle', defaultValue: true, currentValue: true, description: 'Allow metro region expansion in geo resolution' },
  { domain: 'geo', key: 'ufDetectionEnabled', type: 'toggle', defaultValue: true, currentValue: true, description: 'Enable UF (state) detection from queries' },

  // Ranking
  { domain: 'ranking', key: 'sponsorBoost', type: 'weight', defaultValue: 1.5, currentValue: 1.5, description: 'Multiplier for sponsored providers in ranking' },
  { domain: 'ranking', key: 'ratingWeight', type: 'weight', defaultValue: 0.3, currentValue: 0.3, description: 'Weight of rating in final ranking score' },
  { domain: 'ranking', key: 'freshnessDecay', type: 'threshold', defaultValue: 30, currentValue: 30, description: 'Days after which freshness score decays' },

  // Runtime
  { domain: 'runtime', key: 'maxRetries', type: 'limit', defaultValue: 3, currentValue: 3, description: 'Max retries for lazy imports' },
  { domain: 'runtime', key: 'errorThresholdDegraded', type: 'threshold', defaultValue: 2, currentValue: 2, description: 'Error count to mark component degraded' },
  { domain: 'runtime', key: 'errorThresholdFailing', type: 'threshold', defaultValue: 5, currentValue: 5, description: 'Error count to mark component failing' },

  // UI
  { domain: 'ui', key: 'showErrorBoundaryRetry', type: 'toggle', defaultValue: true, currentValue: true, description: 'Show retry button in error boundaries' },
  { domain: 'ui', key: 'lazyFallbackMode', type: 'enum', defaultValue: 'skeleton', currentValue: 'skeleton', description: 'Default fallback for lazy-loaded components', constraints: { enum: ['skeleton', 'retry', 'redirect', 'null_safe'] } },
];

// Initialize registry
for (const entry of DEFAULTS) {
  _registry.set(registryKey(entry.domain, entry.key), { ...entry });
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

const ControlRegistry = {
  /**
   * Register or update a governable parameter.
   */
  register(entry: GovernableEntry): void {
    _registry.set(registryKey(entry.domain, entry.key), { ...entry });
  },

  /**
   * Get a specific entry.
   */
  get(domain: GovernableDomain, key: string): GovernableEntry | undefined {
    return _registry.get(registryKey(domain, key));
  },

  /**
   * Get current value with type safety.
   */
  getValue<T = unknown>(domain: GovernableDomain, key: string): T | undefined {
    const entry = _registry.get(registryKey(domain, key));
    return entry?.currentValue as T | undefined;
  },

  /**
   * Set current value (with constraint validation).
   */
  setValue(domain: GovernableDomain, key: string, value: unknown): boolean {
    const entry = _registry.get(registryKey(domain, key));
    if (!entry) return false;

    // Validate constraints
    if (entry.constraints) {
      if (entry.constraints.min !== undefined && typeof value === 'number' && value < entry.constraints.min) return false;
      if (entry.constraints.max !== undefined && typeof value === 'number' && value > entry.constraints.max) return false;
      if (entry.constraints.enum && !entry.constraints.enum.includes(String(value))) return false;
    }

    entry.currentValue = value;
    return true;
  },

  /**
   * Get all entries for a domain.
   */
  getByDomain(domain: GovernableDomain): GovernableEntry[] {
    return Array.from(_registry.values()).filter(e => e.domain === domain);
  },

  /**
   * Get all registered entries.
   */
  getAll(): GovernableEntry[] {
    return Array.from(_registry.values());
  },

  /**
   * Reset a domain to defaults.
   */
  resetDomain(domain: GovernableDomain): void {
    for (const def of DEFAULTS) {
      if (def.domain === domain) {
        const k = registryKey(domain, def.key);
        _registry.set(k, { ...def });
      }
    }
  },

  /**
   * Reset everything to defaults.
   */
  resetAll(): void {
    _registry.clear();
    for (const entry of DEFAULTS) {
      _registry.set(registryKey(entry.domain, entry.key), { ...entry });
    }
  },

  /**
   * Snapshot of current state (for diagnostics / governance logging).
   */
  snapshot(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of _registry.entries()) {
      out[k] = v.currentValue;
    }
    return out;
  },
};

export default ControlRegistry;
