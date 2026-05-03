import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, ShieldAlert, Zap, RefreshCcw, CheckCircle2 } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeoHead } from "@/hooks/useSeoHead";
import { supabase } from "@/integrations/supabase/client";

type Period = "24h" | "7d" | "30d";

const PERIOD_HOURS: Record<Period, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };
const PAGE_SIZE = 100;
const MAX_ROWS = 2000;

function safeMeta(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  return meta as Record<string, unknown>;
}

/**
 * Sanitiza mensagens de erro vindas de meta para evitar exibir
 * tokens, hashes, e-mails ou JWTs no painel.
 */
const SENSITIVE_KEY_RE = /\b(password|senha|token|access_token|refresh_token|secret|api[_-]?key|authorization|bearer|hash)\b\s*[:=]\s*\S+/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

function sanitizeMessage(input: unknown): string {
  if (input == null) return "—";
  let s = typeof input === "string" ? input : String(input);
  s = s.replace(JWT_RE, "[token]");
  s = s.replace(SENSITIVE_KEY_RE, (m) => m.split(/[:=]/)[0] + "=[redacted]");
  s = s.replace(EMAIL_RE, "[email]");
  if (s.length > 280) s = s.slice(0, 280) + "…";
  return s || "—";
}


function toCsv(rows: EventRow[]): string {
  const header = ["created_at", "user_id", "phase", "event", "error_code", "error_message", "raw_meta"];
  const escape = (v: unknown) => {
    const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    return `"${String(s).replace(/"/g, '""')}"`;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    const m = safeMeta(r.meta);
    lines.push([
      escape(r.created_at),
      escape(r.user_id ?? ""),
      escape(r.phase ?? ""),
      escape(r.event ?? ""),
      escape(m.error_code ?? m.reason ?? ""),
      escape(m.error_message ?? ""),
      escape(r.meta ?? ""),
    ].join(","));
  }
  return lines.join("\n");
}

/** Códigos rastreados pela telemetria de auth/self-heal (em meta.error_code). */
const TRACKED_CODES = [
  "B_PROFILE_NULL",
  "B_PROFILE_NULL_HEALED",
  "B_PROFILE_NULL_HEAL_FAIL",
  "B_PROFILE_NULL_LOOP_GUARD",
  "C_RLS_403",
  "A_AUTH_FAIL",
  "AUTH_SESSION_EXPIRED",
] as const;

const CODE_LABEL: Record<string, string> = {
  B_PROFILE_NULL: "Perfil ausente (detectado)",
  B_PROFILE_NULL_HEALED: "Self-heal OK",
  B_PROFILE_NULL_HEAL_FAIL: "Self-heal FALHOU",
  B_PROFILE_NULL_LOOP_GUARD: "Loop Guard disparado",
  C_RLS_403: "RLS 403",
  A_AUTH_FAIL: "Falha de autenticação",
  AUTH_SESSION_EXPIRED: "Sessão expirada",
};

const CODE_COLOR: Record<string, string> = {
  B_PROFILE_NULL: "hsl(var(--bet-amber))",
  B_PROFILE_NULL_HEALED: "hsl(var(--bet-green))",
  B_PROFILE_NULL_HEAL_FAIL: "hsl(var(--bet-error))",
  B_PROFILE_NULL_LOOP_GUARD: "hsl(var(--bet-error))",
  C_RLS_403: "hsl(var(--bet-error))",
  A_AUTH_FAIL: "hsl(var(--bet-orange))",
  AUTH_SESSION_EXPIRED: "hsl(var(--bet-orange))",
};

interface EventRow {
  id: string;
  user_id: string | null;
  phase: string | null;
  event: string | null;
  meta: any;
  created_at: string;
}

export default function AdminAuthHealthPage() {
  useSeoHead({
    title: "Saúde da Autenticação · Admin",
    description: "Monitoramento de falhas de perfil, self-heal e RLS no fluxo de auth.",
    noindex: true,
  });

  const [period, setPeriod] = useState<Period>("24h");

  const sinceISO = useMemo(() => {
    const d = new Date(Date.now() - PERIOD_HOURS[period] * 3600 * 1000);
    return d.toISOString();
  }, [period]);

  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);

  const { data, isLoading, isFetching, refetch, error: queryError } = useQuery({
    queryKey: ["admin-auth-health", period, pageSize],
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("onboarding_events")
        .select("id, user_id, phase, event, meta, created_at")
        .eq("event", "error")
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(pageSize);
      if (error) throw error;
      return (data || []) as EventRow[];
    },
    staleTime: 30_000,
    retry: false,
  });

  // Detecta bloqueio de RLS / permissão sem expor detalhes técnicos
  const isAccessDenied = useMemo(() => {
    if (!queryError) return false;
    const msg = String((queryError as Error)?.message || "").toLowerCase();
    return msg.includes("permission") || msg.includes("denied") || msg.includes("rls") || msg.includes("403");
  }, [queryError]);


  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    const uniqueLoopUsers = new Set<string>();
    for (const row of data || []) {
      const m = safeMeta(row.meta);
      const code = (m.error_code as string) || (m.reason as string) || "OUTRO";
      counts[code] = (counts[code] || 0) + 1;
      if (code === "B_PROFILE_NULL_LOOP_GUARD" && row.user_id) uniqueLoopUsers.add(row.user_id);
    }
    const profileNull =
      (counts.B_PROFILE_NULL_HEALED || 0) +
      (counts.B_PROFILE_NULL_HEAL_FAIL || 0) +
      (counts.B_PROFILE_NULL || 0);
    const healed = counts.B_PROFILE_NULL_HEALED || 0;
    const failed = counts.B_PROFILE_NULL_HEAL_FAIL || 0;
    const totalHeal = healed + failed;
    const healRate = totalHeal === 0 ? null : (healed / totalHeal) * 100;
    const rls = counts.C_RLS_403 || 0;
    const loopGuard = uniqueLoopUsers.size;

    const chartData = TRACKED_CODES
      .map((code) => ({ code, label: CODE_LABEL[code], count: counts[code] || 0 }))
      .filter((d) => d.count > 0);

    return { counts, profileNull, healRate, rls, loopGuard, chartData };
  }, [data]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Saúde da Autenticação
            </h1>
            <p className="text-sm text-muted-foreground">
              Falhas de perfil, self-heal e bloqueios de RLS no fluxo de onboarding.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList>
                <TabsTrigger value="24h">24h</TabsTrigger>
                <TabsTrigger value="7d">7 dias</TabsTrigger>
                <TabsTrigger value="30d">30 dias</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const csv = toCsv(data || []);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `auth-health-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={!data || data.length === 0}
            >
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Recarregar"
            >
              <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            icon={<AlertTriangle className="h-5 w-5 text-bet-amber" aria-hidden />}
            label="Perfis ausentes detectados"
            value={isLoading ? null : stats.profileNull}
            hint="Eventos B_PROFILE_NULL* no período"
          />
          <Kpi
            icon={<CheckCircle2 className="h-5 w-5 text-bet-green" aria-hidden />}
            label="Taxa de Self-Heal"
            value={isLoading ? null : stats.healRate === null ? "—" : `${stats.healRate.toFixed(0)}%`}
            hint={
              stats.healRate === null
                ? "Sem tentativas de self-heal"
                : `${stats.counts.B_PROFILE_NULL_HEALED || 0} OK · ${stats.counts.B_PROFILE_NULL_HEAL_FAIL || 0} falhas`
            }
          />
          <Kpi
            icon={<ShieldAlert className="h-5 w-5 text-bet-error" aria-hidden />}
            label="Erros de RLS (403)"
            value={isLoading ? null : stats.rls}
            hint="C_RLS_403 ao ler profiles"
          />
          <Kpi
            icon={<Zap className="h-5 w-5 text-bet-orange" aria-hidden />}
            label="Usuários no Loop Guard"
            value={isLoading ? null : stats.loopGuard}
            hint="Bateram no disjuntor anti-loop"
          />
        </div>

        {/* Distribuição */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" aria-hidden />
              Distribuição por categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : stats.chartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum erro registrado no período. Saúde OK.
              </p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stats.chartData.map((entry) => (
                        <Cell key={entry.code} fill={CODE_COLOR[entry.code] || "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs recentes */}
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Logs recentes ({data?.length ?? 0} de até {pageSize})
            </CardTitle>
            {pageSize < MAX_ROWS && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPageSize((s) => Math.min(s + PAGE_SIZE, MAX_ROWS))}
                disabled={isFetching}
              >
                Carregar mais
              </Button>
            )}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (data?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum log no período selecionado.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Quando</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data || []).map((row) => {
                    const m = safeMeta(row.meta);
                    const code =
                      (m.error_code as string) ||
                      (m.reason as string) ||
                      "OUTRO";
                    const message =
                      (m.error_message as string) ||
                      (m.reason as string) ||
                      "—";
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {new Date(row.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: CODE_COLOR[code] || "hsl(var(--border))",
                              color: CODE_COLOR[code] || "hsl(var(--foreground))",
                            }}
                          >
                            {CODE_LABEL[code] || code}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">
                          {row.user_id ? row.user_id.slice(0, 8) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{row.phase || "—"}</TableCell>
                        <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={message}>
                          {message}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="mt-2 text-2xl font-bold text-foreground">
          {value === null ? <Skeleton className="h-7 w-16" /> : value}
        </div>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
