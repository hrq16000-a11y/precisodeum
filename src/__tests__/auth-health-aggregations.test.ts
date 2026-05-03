import { describe, it, expect } from "vitest";
import {
  aggregateByTime,
  buildSelfHealFunnel,
  pickBucketForPeriod,
  truncateToBucket,
  type AuthEventRow,
} from "@/lib/authHealthAggregations";

function row(code: string, iso: string, id = code + iso): AuthEventRow {
  return {
    id,
    user_id: "u",
    phase: "unknown",
    event: "error",
    meta: { error_code: code },
    created_at: iso,
  };
}

describe("authHealthAggregations · funil", () => {
  it("constrói Detectado → Tentativa → Sucesso com drop-off", () => {
    const rows = [
      row("B_PROFILE_NULL", "2026-05-03T10:00:00Z"),
      row("B_PROFILE_NULL", "2026-05-03T10:01:00Z"),
      row("B_PROFILE_NULL", "2026-05-03T10:02:00Z"),
      row("B_PROFILE_NULL", "2026-05-03T10:03:00Z"),
      row("B_PROFILE_NULL_HEALED", "2026-05-03T10:00:30Z"),
      row("B_PROFILE_NULL_HEALED", "2026-05-03T10:01:30Z"),
      row("B_PROFILE_NULL_HEAL_FAIL", "2026-05-03T10:02:30Z"),
    ];
    const f = buildSelfHealFunnel(rows);
    expect(f.map((s) => s.count)).toEqual([4, 3, 2]);
    expect(f[0].dropFromPrev).toBe(0);
    expect(f[1].dropFromPrev).toBe(1); // 4→3
    expect(Math.round(f[1].dropPct)).toBe(25);
    expect(f[2].dropFromPrev).toBe(1); // 3→2
    expect(Math.round(f[2].dropPct)).toBe(33);
  });

  it("retorna zeros quando não há eventos relevantes", () => {
    const f = buildSelfHealFunnel([]);
    expect(f.every((s) => s.count === 0 && s.dropPct === 0)).toBe(true);
  });
});

describe("authHealthAggregations · série temporal", () => {
  it("trunca para hora preservando UTC", () => {
    const out = truncateToBucket("2026-05-03T14:37:42.123Z", "hour");
    expect(out).toBe("2026-05-03T14:00:00.000Z");
  });

  it("trunca para dia preservando UTC", () => {
    const out = truncateToBucket("2026-05-03T14:37:42.123Z", "day");
    expect(out).toBe("2026-05-03T00:00:00.000Z");
  });

  it("agrupa eventos por hora e por código rastreado", () => {
    const rows: AuthEventRow[] = [
      row("B_PROFILE_NULL", "2026-05-03T10:05:00Z"),
      row("B_PROFILE_NULL", "2026-05-03T10:45:00Z"),
      row("C_RLS_403", "2026-05-03T10:55:00Z"),
      row("B_PROFILE_NULL", "2026-05-03T11:10:00Z"),
      row("A_AUTH_FAIL", "2026-05-03T11:20:00Z"),
      // Códigos não rastreados pela série são ignorados:
      row("B_PROFILE_NULL_HEALED", "2026-05-03T11:30:00Z"),
    ];
    const out = aggregateByTime(rows, "hour");
    expect(out).toHaveLength(2);
    expect(out[0].bucket).toBe("2026-05-03T10:00:00.000Z");
    expect(out[0].B_PROFILE_NULL).toBe(2);
    expect(out[0].C_RLS_403).toBe(1);
    expect(out[0].A_AUTH_FAIL).toBe(0);
    expect(out[0].total).toBe(3);
    expect(out[1].bucket).toBe("2026-05-03T11:00:00.000Z");
    expect(out[1].B_PROFILE_NULL).toBe(1);
    expect(out[1].A_AUTH_FAIL).toBe(1);
    expect(out[1].total).toBe(2);
  });

  it("agrupa por dia em períodos longos", () => {
    const rows: AuthEventRow[] = [
      row("C_RLS_403", "2026-05-01T10:00:00Z"),
      row("C_RLS_403", "2026-05-01T22:00:00Z"),
      row("C_RLS_403", "2026-05-02T03:00:00Z"),
    ];
    const out = aggregateByTime(rows, "day");
    expect(out).toHaveLength(2);
    expect(out[0].C_RLS_403).toBe(2);
    expect(out[1].C_RLS_403).toBe(1);
  });

  it("retorna ordem cronológica", () => {
    const rows: AuthEventRow[] = [
      row("C_RLS_403", "2026-05-03T11:00:00Z"),
      row("C_RLS_403", "2026-05-03T09:00:00Z"),
      row("C_RLS_403", "2026-05-03T10:00:00Z"),
    ];
    const out = aggregateByTime(rows, "hour").map((p) => p.bucket);
    expect(out).toEqual([...out].sort());
  });

  it("pickBucketForPeriod: 24h→hour, 7d/30d→day", () => {
    expect(pickBucketForPeriod("24h")).toBe("hour");
    expect(pickBucketForPeriod("7d")).toBe("day");
    expect(pickBucketForPeriod("30d")).toBe("day");
  });
});
