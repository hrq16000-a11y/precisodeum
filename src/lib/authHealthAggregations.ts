/**
 * Helpers de agregação para o painel /admin/health-check.
 * Mantidos puros (sem React) para facilitar testes Vitest.
 */

export type AuthEventRow = {
  id: string;
  user_id: string | null;
  phase: string | null;
  event: string | null;
  meta: any;
  created_at: string;
};

export type FunnelRow = {
  stage: "Detectado" | "Tentativa" | "Sucesso";
  count: number;
  dropFromPrev: number;
  dropPct: number; // 0..100, % de queda em relação à etapa anterior
};

export type TimeBucket = "hour" | "day";

export type TimeSeriesPoint = {
  bucket: string; // ISO truncado
  label: string;  // legível em pt-BR
  B_PROFILE_NULL: number;
  C_RLS_403: number;
  A_AUTH_FAIL: number;
  total: number;
};

const KNOWN_CODES = ["B_PROFILE_NULL", "C_RLS_403", "A_AUTH_FAIL"] as const;

function safeMeta(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  return meta as Record<string, unknown>;
}

function getCode(row: AuthEventRow): string {
  const m = safeMeta(row.meta);
  return (m.error_code as string) || (m.reason as string) || "OUTRO";
}

/**
 * Constrói o funil Detectado → Tentativa → Sucesso.
 * - Detectado  = eventos B_PROFILE_NULL (emitidos antes do INSERT)
 * - Tentativa  = HEALED + HEAL_FAIL (toda execução de INSERT teve telemetria)
 * - Sucesso    = HEALED
 */
export function buildSelfHealFunnel(rows: AuthEventRow[]): FunnelRow[] {
  let detected = 0;
  let healed = 0;
  let failed = 0;
  for (const r of rows) {
    const c = getCode(r);
    if (c === "B_PROFILE_NULL") detected++;
    else if (c === "B_PROFILE_NULL_HEALED") healed++;
    else if (c === "B_PROFILE_NULL_HEAL_FAIL") failed++;
  }
  const attempted = healed + failed;
  const stages: Array<{ stage: FunnelRow["stage"]; count: number }> = [
    { stage: "Detectado", count: detected },
    { stage: "Tentativa", count: attempted },
    { stage: "Sucesso", count: healed },
  ];
  return stages.map((s, i) => {
    const prev = i === 0 ? s.count : stages[i - 1].count;
    const drop = Math.max(0, prev - s.count);
    const pct = prev === 0 ? 0 : (drop / prev) * 100;
    return { stage: s.stage, count: s.count, dropFromPrev: drop, dropPct: pct };
  });
}

/**
 * Trunca uma data ISO para o início do bucket (hora ou dia).
 * Usa UTC para evitar problemas de DST e manter agregação determinística.
 */
export function truncateToBucket(iso: string, bucket: TimeBucket): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const out = new Date(d);
  out.setUTCMinutes(0, 0, 0);
  if (bucket === "day") out.setUTCHours(0);
  return out.toISOString();
}

function formatBucketLabel(iso: string, bucket: TimeBucket): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (bucket === "day") {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Agrupa logs por intervalo (hora/dia) e conta os 3 códigos rastreados pela
 * série temporal. Retorna ordenado cronologicamente.
 */
export function aggregateByTime(
  rows: AuthEventRow[],
  bucket: TimeBucket,
): TimeSeriesPoint[] {
  const map = new Map<string, TimeSeriesPoint>();
  for (const r of rows) {
    const code = getCode(r);
    if (!KNOWN_CODES.includes(code as any)) continue;
    const b = truncateToBucket(r.created_at, bucket);
    let point = map.get(b);
    if (!point) {
      point = {
        bucket: b,
        label: formatBucketLabel(b, bucket),
        B_PROFILE_NULL: 0,
        C_RLS_403: 0,
        A_AUTH_FAIL: 0,
        total: 0,
      };
      map.set(b, point);
    }
    (point as any)[code]++;
    point.total++;
  }
  return Array.from(map.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/**
 * Heurística: para 24h usa hora, para 7d/30d usa dia.
 */
export function pickBucketForPeriod(period: "24h" | "7d" | "30d"): TimeBucket {
  return period === "24h" ? "hour" : "day";
}
