import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isValidRoute } from "@/lib/routeValidator";

type PathRow = {
  path: string;
  hits: number;
  distinct_users: number;
  last_seen: string;
  top_referrer: string | null;
};

type ReferrerRow = {
  referrer: string;
  hits: number;
  distinct_paths: number;
  last_seen: string;
};

const RANGES = [
  { label: "24h", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
];

export default function AdminBrokenLinksPage() {
  const [days, setDays] = useState(7);

  const pathsQ = useQuery({
    queryKey: ["admin-broken-links-paths", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_broken_links_stats" as any, { _days: days });
      if (error) throw error;
      return (data as PathRow[]) || [];
    },
  });

  const refsQ = useQuery({
    queryKey: ["admin-broken-links-referrers", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_broken_links_by_referrer" as any, { _days: days });
      if (error) throw error;
      return (data as ReferrerRow[]) || [];
    },
  });

  const totalHits = (pathsQ.data || []).reduce((s, r) => s + Number(r.hits || 0), 0);
  const internalRefs = (refsQ.data || []).filter((r) => {
    if (!r.referrer || r.referrer === "(direct)") return false;
    try {
      const u = new URL(r.referrer);
      return typeof window !== "undefined" && u.host === window.location.host;
    } catch {
      return false;
    }
  });

  const refresh = () => {
    void pathsQ.refetch();
    void refsQ.refetch();
  };

  return (
    <div className="container max-w-6xl py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link to="/admin"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao admin</Link>
          </Button>
          <h1 className="text-2xl font-bold">Links quebrados (404)</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento em tempo real de URLs inválidas acessadas por usuários reais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <Button
              key={r.days}
              size="sm"
              variant={days === r.days ? "default" : "outline"}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={refresh} aria-label="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total de 404s</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{totalHits.toLocaleString("pt-BR")}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Paths únicos</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{(pathsQ.data || []).length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Referrers internos quebrados</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-amber-600">{internalRefs.length}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="paths">
        <TabsList>
          <TabsTrigger value="paths">URLs inválidas</TabsTrigger>
          <TabsTrigger value="refs">Referrers</TabsTrigger>
        </TabsList>

        <TabsContent value="paths" className="mt-4">
          {pathsQ.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {pathsQ.error && <p className="text-sm text-destructive">Erro ao carregar.</p>}
          {pathsQ.data && pathsQ.data.length === 0 && (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum 404 registrado no período.
            </CardContent></Card>
          )}
          <div className="space-y-2">
            {(pathsQ.data || []).map((row) => {
              const isLikelyInternalLink =
                row.top_referrer && row.top_referrer !== "(direct)" &&
                (() => { try { return new URL(row.top_referrer!).host === window.location.host; } catch { return false; } })();
              const isFalsePositive = isValidRoute(row.path);
              return (
                <Card key={row.path} className={isLikelyInternalLink ? "border-amber-500/40" : ""}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="truncate text-sm font-medium">{row.path}</code>
                        {isLikelyInternalLink && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            <AlertTriangle className="h-3 w-3" /> Link interno
                          </span>
                        )}
                        {isFalsePositive && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-900">
                            rota válida (revisar)
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        Origem: {row.top_referrer || "(direto)"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right text-sm">
                      <div>
                        <div className="font-bold">{Number(row.hits).toLocaleString("pt-BR")}</div>
                        <div className="text-xs text-muted-foreground">hits</div>
                      </div>
                      <div>
                        <div className="font-bold">{Number(row.distinct_users).toLocaleString("pt-BR")}</div>
                        <div className="text-xs text-muted-foreground">usuários</div>
                      </div>
                      <div className="hidden text-xs text-muted-foreground sm:block">
                        {new Date(row.last_seen).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="refs" className="mt-4">
          {refsQ.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          <div className="space-y-2">
            {(refsQ.data || []).map((row) => (
              <Card key={row.referrer}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="truncate text-sm">{row.referrer}</code>
                      {row.referrer !== "(direct)" && (
                        <a href={row.referrer} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right text-sm">
                    <div><div className="font-bold">{Number(row.hits).toLocaleString("pt-BR")}</div><div className="text-xs text-muted-foreground">hits</div></div>
                    <div><div className="font-bold">{Number(row.distinct_paths).toLocaleString("pt-BR")}</div><div className="text-xs text-muted-foreground">paths</div></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
