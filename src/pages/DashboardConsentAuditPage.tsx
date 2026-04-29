import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, ArrowLeft, Filter, Calendar, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSeoHead, SITE_BASE_URL } from "@/hooks/useSeoHead";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DashboardGroupNav from "@/components/dashboard/DashboardGroupNav";

interface ConsentLogRow {
  id: string;
  version: number | null;
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  source: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

const formatDateTime = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const yesNo = (v: boolean) => (v ? "Ativo" : "Desativado");

const SOURCE_LABEL: Record<string, string> = {
  banner: "Banner",
  pagina_cookies: "Página /cookies",
  api: "API",
};

const DashboardConsentAuditPage = () => {
  useSeoHead({
    title: "Auditoria de consentimentos | Preciso de Um",
    description:
      "Histórico completo de aceites e mudanças de preferências de cookies e privacidade do seu cadastro.",
    canonical: `${SITE_BASE_URL}/dashboard/auditoria-consentimentos`,
  });

  const { user } = useAuth();
  const [rows, setRows] = useState<ConsentLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [versionFilter, setVersionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [versionsAvailable, setVersionsAvailable] = useState<number[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const filtersKey = useMemo(
    () => `${versionFilter}|${dateFrom}|${dateTo}`,
    [versionFilter, dateFrom, dateTo],
  );

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filtersKey]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user?.id) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        let q = supabase
          .from("cookie_consent_log" as any)
          .select("id, version, essential, functional, analytics, marketing, source, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

        if (versionFilter !== "all") q = q.eq("version", Number(versionFilter));
        if (dateFrom) q = q.gte("created_at", new Date(`${dateFrom}T00:00:00`).toISOString());
        if (dateTo) q = q.lte("created_at", new Date(`${dateTo}T23:59:59`).toISOString());

        const { data, error } = await q;
        if (!active) return;
        if (error) throw error;
        const list = (data || []) as unknown as ConsentLogRow[];
        const slice = list.slice(0, PAGE_SIZE);
        setRows(slice);
        setHasMore(list.length > PAGE_SIZE);
      } catch (e) {
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user?.id, page, versionFilter, dateFrom, dateTo]);

  // Carrega versões disponíveis
  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("cookie_consent_log" as any)
        .select("version")
        .eq("user_id", user.id)
        .limit(200);
      if (!active) return;
      const set = new Set<number>();
      (data || []).forEach((r: any) => { if (typeof r.version === "number") set.add(r.version); });
      setVersionsAvailable(Array.from(set).sort((a, b) => a - b));
    })();
    return () => { active = false; };
  }, [user?.id]);

  const clearFilters = () => {
    setVersionFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <DashboardGroupNav />

        <div className="space-y-1">
          <Link
            to="/dashboard/privacidade"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para Privacidade
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Auditoria de consentimentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico de cada vez que você aceitou ou mudou suas preferências de cookies. Útil
            para conferir o que está ativo e quando foi alterado, em conformidade com a LGPD.
          </p>
        </div>

        {/* Filtros */}
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-4 w-4" /> Filtros
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Versão do consentimento</label>
              <Select value={versionFilter} onValueChange={setVersionFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {versionsAvailable.map((v) => (
                    <SelectItem key={v} value={String(v)}>{`v${v}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> De
              </label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Até
              </label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        </section>

        {/* Tabela */}
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Cookie className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Eventos registrados</h2>
          </div>
          {loading ? (
            <div className="px-4 py-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
              Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum registro encontrado para os filtros selecionados.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-3 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {formatDateTime(r.created_at)}
                    </span>
                    <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      v{r.version ?? "—"} · {SOURCE_LABEL[r.source || ""] || r.source || "—"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                    <span><strong>Essenciais:</strong> {yesNo(r.essential)}</span>
                    <span><strong>Funcionais:</strong> {yesNo(r.functional)}</span>
                    <span><strong>Analytics:</strong> {yesNo(r.analytics)}</span>
                    <span><strong>Marketing:</strong> {yesNo(r.marketing)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-muted/30">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">Página {page + 1}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasMore || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default DashboardConsentAuditPage;
