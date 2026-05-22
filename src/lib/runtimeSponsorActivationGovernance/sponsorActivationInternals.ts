export const SPONSOR_ACTIVATION_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  activationMode: 'TERMINAL_READINESS_ONLY' as const,
  upstreamMutationAllowed: false,
  deterministicRollbackRequired: true,
  postLockMutationAllowed: false,
  runtimeActivationAllowed: false,
  billingActivationAllowed: false,
  schedulingActivationAllowed: false,
  networkingActivationAllowed: false,
});

export const UPSTREAM_LAYERS = Object.freeze([
  '1.9.14', '1.9.15', '1.9.16', '1.9.17', '1.9.18', '1.9.19', '1.9.20',
  '1.9.21', '1.9.22', '1.9.23', '1.9.24', '1.9.25', '1.9.26', '1.9.27',
  '1.9.28', '1.9.29', '1.9.30', '1.9.31', '1.9.32', '1.9.33', '1.9.34',
  '1.9.35', '1.9.36', '1.9.37', '1.9.38', '1.9.39', '1.9.40', '1.9.41',
  '1.9.42', '1.9.43', '1.9.44',
] as const);

export type SponsorUpstreamLayerId = typeof UPSTREAM_LAYERS[number];

export function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`).join(',')}}`;
}
