/**
 * /admin/security-findings — Relatório consolidado de findings de segurança.
 *
 * Combina:
 *   • Catálogo estático de findings auditados (status fixed/ignored + justificativa
 *     + migration/policy relacionada) — fonte: .lovable/audit/auditoria-360-2026-06.md
 *   • Drift alerts em tempo real da tabela `rls_drift_alerts` (cron diário às 04:00 UTC).
 *
 * Apenas admin (rota envelopada por AdminGuard). Read/Ack via RLS na tabela.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, ShieldAlert, EyeOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Status = "fixed" | "ignored" | "open";

interface CatalogItem {
  id: string;
  title: string;
  status: Status;
  severity: "low" | "medium" | "high" | "critical";
  area: string;
  justification: string;
  migration?: string;
  policy?: string;
}

// Catálogo estático — atualizado a cada rodada de hardening de segurança.
const CATALOG: CatalogItem[] = [
  {
    id: "agencies-pii-anon",
    title: "agencies expunha colunas sensíveis a anon",
    status: "fixed",
    severity: "high",
    area: "PII / Data API",
    justification: "Revogado SELECT de anon e regrant column-level apenas com campos públicos.",
    migration: "20260610051151_873f9344-b052-4815-bb72-b474f84cfe4c.sql",
  },
  {
    id: "providers-pii-anon",
    title: "providers expunha CPF/CNPJ/birth_date a anon",
    status: "fixed",
    severity: "critical",
    area: "PII / Data API",
    justification: "Revogado SELECT de anon e regrant column-level. CPF/CNPJ/birth_date/legal_name/content_flags fora da grant pública.",
    migration: "20260610051151_873f9344-b052-4815-bb72-b474f84cfe4c.sql",
  },
  {
    id: "sponsor-leads-update-anon",
    title: "sponsor_leads aceitava UPDATE público overbroad",
    status: "fixed",
    severity: "high",
    area: "RLS",
    justification: "UPDATE de anon restrito a colunas cnpj_document_url e banner_url (column-level grant).",
    migration: "20260610051151_873f9344-b052-4815-bb72-b474f84cfe4c.sql",
  },
  {
    id: "system-audit-logs-open-insert",
    title: "system_audit_logs aceitava INSERT aberto",
    status: "fixed",
    severity: "high",
    area: "Audit",
    justification: "Nova policy INSERT exige has_role(admin) AND staff_id=auth.uid(). Triggers SECURITY DEFINER seguem funcionando.",
    migration: "20260610051151_873f9344-b052-4815-bb72-b474f84cfe4c.sql",
    policy: "audit_log_insert_admin",
  },
  {
    id: "admin-funcs-secdef-anon",
    title: "Funções admin_*/staff_* SECURITY DEFINER executáveis por anon",
    status: "fixed",
    severity: "medium",
    area: "Functions",
    justification: "REVOKE EXECUTE de anon em todas as funções admin_*/staff_* e em detectors críticos. authenticated mantém acesso (RPC valida has_role).",
    migration: "20260610063323_capture-rls-drift + revoke admin funcs",
  },
  {
    id: "public-secdef-funcs",
    title: "Funções públicas SECURITY DEFINER (search/SEO/CEP)",
    status: "ignored",
    severity: "low",
    area: "Functions",
    justification: "Padrão arquitetural: SECURITY DEFINER com RLS + has_role internos. Necessário para RPCs públicas (nearby_providers, search_user_notifications, has_role, etc.) que precisam de bypass controlado.",
  },
  {
    id: "extension-in-public",
    title: "Extensões instaladas no schema public",
    status: "ignored",
    severity: "low",
    area: "Schema",
    justification: "pgcrypto/postgis/pg_cron/pg_net são padrão do Supabase no schema public. Move-las quebra integrações.",
  },
  {
    id: "jobs-services-public-contact",
    title: "jobs/services expõem whatsapp/phone publicamente",
    status: "ignored",
    severity: "low",
    area: "Marketplace",
    justification: "WhatsApp/telefone são CTAs públicos intencionais do marketplace — sem eles o lead não acontece.",
  },
];

const SEVERITY_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

const STATUS_ICON: Record<Status, JSX.Element> = {
  fixed: <ShieldCheck className="h-4 w-4 text-emerald-600" />,
  ignored: <EyeOff className="h-4 w-4 text-muted-foreground" />,
  open: <ShieldAlert className="h-4 w-4 text-destructive" />,
};

interface DriftAlert {
  id: string;
  detected_at: string;
  category: string;
  object_kind: string;
  object_name: string;
  role_name: string | null;
  severity: string;
  acknowledged: boolean;
  notes: string | null;
}

export default function AdminSecurityFindingsPage() {
  const [drift, setDrift] = useState<DriftAlert[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("rls_drift_alerts")
      .select("id, detected_at, category, object_kind, object_name, role_name, severity, acknowledged, notes")
      .order("detected_at", { ascending: false })
      .limit(200);
    if (error) toast.error("Falha ao carregar drift alerts");
    setDrift((data ?? []) as DriftAlert[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function ack(id: string) {
    const { error } = await supabase
      .from("rls_drift_alerts")
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Falha ao reconhecer alerta"); return; }
    toast.success("Alerta reconhecido");
    void load();
  }

  const stats = useMemo(() => ({
    fixed: CATALOG.filter(c => c.status === "fixed").length,
    ignored: CATALOG.filter(c => c.status === "ignored").length,
    driftOpen: drift.filter(d => !d.acknowledged).length,
  }), [drift]);

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Findings de Segurança</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo auditado + drift watch automático (cron diário 04:00 UTC).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <div className="text-xs text-muted-foreground">Corrigidos</div>
          <div className="text-2xl font-bold text-emerald-600">{stats.fixed}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-xs text-muted-foreground">Risco aceito</div>
          <div className="text-2xl font-bold text-muted-foreground">{stats.ignored}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-xs text-muted-foreground">Drift não reconhecido</div>
          <div className={`text-2xl font-bold ${stats.driftOpen > 0 ? "text-destructive" : "text-emerald-600"}`}>
            {stats.driftOpen}
          </div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catálogo auditado ({CATALOG.length})</TabsTrigger>
          <TabsTrigger value="drift">Drift alerts ({drift.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-3">
          {CATALOG.map(item => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {STATUS_ICON[item.status]}
                  {item.title}
                  <Badge variant={SEVERITY_VARIANT[item.severity]} className="ml-auto capitalize">
                    {item.severity}
                  </Badge>
                  <Badge variant="outline" className="capitalize">{item.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div><span className="font-medium">Área:</span> {item.area}</div>
                <div><span className="font-medium">Justificativa:</span> {item.justification}</div>
                {item.migration && (
                  <div className="text-xs text-muted-foreground font-mono">
                    Migration: {item.migration}
                  </div>
                )}
                {item.policy && (
                  <div className="text-xs text-muted-foreground font-mono">Policy: {item.policy}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="drift" className="space-y-3">
          {drift.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              Nenhum drift detectado. Próximo snapshot às 04:00 UTC.
            </CardContent></Card>
          )}
          {drift.map(d => (
            <Card key={d.id} className={d.acknowledged ? "opacity-60" : ""}>
              <CardContent className="pt-4 flex items-center gap-3">
                <ShieldAlert className={`h-5 w-5 ${d.severity === "high" ? "text-destructive" : "text-amber-600"}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {d.category} · {d.object_kind} · <span className="font-mono">{d.object_name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(d.detected_at).toLocaleString("pt-BR")}
                    {d.role_name ? ` · role: ${d.role_name}` : ""}
                  </div>
                </div>
                <Badge variant={d.severity === "high" ? "destructive" : "default"}>{d.severity}</Badge>
                {!d.acknowledged && (
                  <Button size="sm" variant="ghost" onClick={() => void ack(d.id)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> OK
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
