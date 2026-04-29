import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "@/hooks/useAdmin";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthHealthPanel from "@/components/admin/AuthHealthPanel";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Activity, ShieldAlert, MailWarning, Clock4, KeyRound, UserPlus } from "lucide-react";

interface ErrorReportRow {
  action_context: string | null;
  error_message: string | null;
  created_at: string;
  page_path: string | null;
}

const AUTH_PATTERNS: Array<{ key: string; label: string; rx: RegExp; icon: React.ComponentType<{ className?: string }>; tone: string }> = [
  { key: "rate_limit",         label: "Rate limit",            rx: /rate.?limit|too.?many|email rate/i,        icon: Clock4,       tone: "text-amber-600" },
  { key: "email_not_confirmed",label: "E-mail não confirmado", rx: /email.?not.?confirmed|confirme.?seu.?e/i,   icon: MailWarning,  tone: "text-amber-600" },
  { key: "invalid_credentials",label: "Senha incorreta",       rx: /invalid.?login|invalid.?credentials|senha.?incorreta/i, icon: KeyRound, tone: "text-red-600" },
  { key: "user_already",       label: "Conta já existente",    rx: /already.?registered|conta existente|user.?already/i, icon: UserPlus, tone: "text-blue-600" },
  { key: "signup_failed",      label: "Falha em signup",       rx: /signup|sign[_-]?up|cadastro/i,             icon: ShieldAlert,  tone: "text-red-600" },
  { key: "login_failed",       label: "Falha em login",        rx: /signin|sign[_-]?in|login/i,                icon: ShieldAlert,  tone: "text-red-600" },
];

const AdminAuthMetricsPage = () => {
  const { loading, isAdmin } = useAdmin();
  const since24h = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), []);

  useEffect(() => { document.title = "Métricas de Autenticação | Admin"; }, []);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["auth-error-reports-24h"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("error_reports" as any) as any)
        .select("action_context, error_message, created_at, page_path")
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as ErrorReportRow[];
    },
    enabled: !!isAdmin,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const buckets = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const ctx = `${r.action_context || ""} ${r.error_message || ""} ${r.page_path || ""}`;
      for (const p of AUTH_PATTERNS) {
        if (p.rx.test(ctx)) {
          map.set(p.key, (map.get(p.key) || 0) + 1);
        }
      }
    }
    return map;
  }, [rows]);

  const authRelated = useMemo(() => rows.filter(r => /auth|login|signup|cadastro|reset|recovery|password/i.test(`${r.action_context || ""} ${r.page_path || ""}`)), [rows]);

  if (loading) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  if (!isAdmin) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container mx-auto max-w-6xl flex-1 px-4 py-8 space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Métricas de Autenticação</h1>
          <p className="text-sm text-muted-foreground">
            Sinais agregados do error sink nas últimas 24h: signup/login, erros mapeados, rate limit e e-mails não confirmados.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Erros de autenticação mapeados</h3>
                <p className="text-[11px] text-muted-foreground">
                  {isLoading ? "Carregando..." : `${authRelated.length} eventos relacionados a auth nas últimas 24h`}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">{rows.length} eventos totais</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {AUTH_PATTERNS.map((p) => {
              const Icon = p.icon;
              const n = buckets.get(p.key) || 0;
              return (
                <div key={p.key} className="rounded-xl border border-border/40 bg-background/50 p-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${p.tone}`} />
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{p.label}</p>
                  </div>
                  <p className={`mt-1 text-xl font-bold tabular-nums ${n > 0 ? p.tone : "text-foreground"}`}>{n}</p>
                </div>
              );
            })}
          </div>
        </div>

        <AuthHealthPanel />
      </main>
      <Footer />
    </div>
  );
};

export default AdminAuthMetricsPage;
