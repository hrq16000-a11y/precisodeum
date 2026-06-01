import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Send,
  Plus,
  Link as LinkIcon,
  ExternalLink,
  AlertCircle,
  History,
  Bell,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const DEFAULT_SITE = "https://www.precisodeum.com.br/";
const DEFAULT_SITEMAP = "https://www.precisodeum.com.br/sitemap.xml";

type GscStatus = {
  connected: boolean;
  site?: string;
  owned?: boolean;
  verified?: { siteUrl: string; permissionLevel: string } | null;
  sites?: Array<{ siteUrl: string; permissionLevel: string }>;
  error?: string;
  detail?: string;
};

type SitemapEntry = {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  type?: string;
  warnings?: string | number;
  errors?: string | number;
  contents?: Array<{ type: string; submitted: string; indexed: string }>;
};

type AuditRow = {
  id: number;
  action: string;
  site: string | null;
  sitemap: string | null;
  status: number | null;
  ok: boolean;
  response: unknown;
  error: string | null;
  created_at: string;
};

export type SitemapFilter = "all" | "errors" | "warnings" | "recent";

// Pure filter used by tests + UI.
export function filterSitemaps(rows: SitemapEntry[], filter: SitemapFilter): SitemapEntry[] {
  switch (filter) {
    case "errors":
      return rows.filter((r) => Number(r.errors ?? 0) > 0);
    case "warnings":
      return rows.filter((r) => Number(r.warnings ?? 0) > 0);
    case "recent":
      return [...rows].sort((a, b) =>
        (b.lastSubmitted ?? "").localeCompare(a.lastSubmitted ?? ""),
      );
    case "all":
    default:
      return rows;
  }
}

// Pure: should the admin badge alert that the sitemap needs to be resubmitted?
export function shouldResubmit(
  lastSubmittedAt: string | null,
  lastSeoChangeAt: string | null,
): boolean {
  if (!lastSeoChangeAt) return false;
  if (!lastSubmittedAt) return true;
  return new Date(lastSeoChangeAt).getTime() > new Date(lastSubmittedAt).getTime();
}

const callGsc = async (action: string, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams({ action, ...extra });
  const { data, error } = await supabase.functions.invoke(
    `gsc-verify?${params.toString()}`,
    { method: "GET" },
  );
  if (error) throw error;
  return data;
};

const AdminSeoGscPage = () => {
  const [status, setStatus] = useState<GscStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [sitemaps, setSitemaps] = useState<SitemapEntry[] | null>(null);
  const [loadingSitemaps, setLoadingSitemaps] = useState(false);
  const [site, setSite] = useState(DEFAULT_SITE);
  const [sitemapUrl, setSitemapUrl] = useState(DEFAULT_SITEMAP);
  const [busy, setBusy] = useState<string | null>(null);
  const [metaToken, setMetaToken] = useState<string | null>(null);
  const [sitemapFilter, setSitemapFilter] = useState<SitemapFilter>("all");
  const [selected, setSelected] = useState<SitemapEntry | AuditRow | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditFilter, setAuditFilter] = useState<"all" | "errors" | "verify" | "submit">("all");
  const [newSeoCount, setNewSeoCount] = useState(0);
  const [needsResubmit, setNeedsResubmit] = useState(false);
  const [lastSeoChange, setLastSeoChange] = useState<string | null>(null);

  // --- loaders -----------------------------------------------------------
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await callGsc("status", { site });
      setStatus(data as GscStatus);
    } catch (err) {
      setStatus({ connected: false, error: "request_failed", detail: String(err) });
    } finally {
      setLoadingStatus(false);
    }
  }, [site]);

  const loadSitemaps = useCallback(async () => {
    if (!status?.owned) return;
    setLoadingSitemaps(true);
    try {
      const data = await callGsc("list-sitemaps", { site });
      setSitemaps(((data as any)?.sitemap as SitemapEntry[]) ?? []);
    } catch (err) {
      toast.error("Falha ao listar sitemaps", { description: String(err) });
    } finally {
      setLoadingSitemaps(false);
    }
  }, [site, status?.owned]);

  const loadAudit = useCallback(async () => {
    const { data, error } = await supabase
      .from("gsc_audit_log")
      .select("id,action,site,sitemap,status,ok,response,error,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Falha ao carregar log", { description: error.message });
      return;
    }
    setAudit((data ?? []) as AuditRow[]);
  }, []);

  const loadResubmitSignal = useCallback(async () => {
    // Latest content-change signal: newest service updated_at.
    const { data: svc } = await supabase
      .from("services")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);
    const lastChange = svc?.[0]?.updated_at ?? null;
    setLastSeoChange(lastChange);

    // Latest successful sitemap submission from the audit log.
    const { data: lastSubmit } = await supabase
      .from("gsc_audit_log")
      .select("created_at")
      .eq("action", "submit-sitemap")
      .eq("ok", true)
      .order("created_at", { ascending: false })
      .limit(1);
    const lastSubmittedAt = lastSubmit?.[0]?.created_at ?? null;

    const need = shouldResubmit(lastSubmittedAt, lastChange);
    setNeedsResubmit(need);

    // Count of SEO content changes since last successful submit (badge count).
    if (lastSubmittedAt) {
      const { count } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .gt("updated_at", lastSubmittedAt);
      setNewSeoCount(count ?? 0);
    } else {
      const { count } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true });
      setNewSeoCount(count ?? 0);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadAudit();
    loadResubmitSignal();
  }, [loadStatus, loadAudit, loadResubmitSignal]);

  useEffect(() => {
    if (status?.owned) loadSitemaps();
  }, [status?.owned, loadSitemaps]);

  // Surface "need to resubmit" once per session.
  useEffect(() => {
    if (!needsResubmit) return;
    const key = "gsc-resubmit-toast-shown";
    if (sessionStorage.getItem(key)) return;
    toast("Novas páginas SEO detectadas", {
      description: `${newSeoCount} serviço(s) mudaram desde o último envio do sitemap.`,
      icon: <Bell className="h-4 w-4" />,
    });
    sessionStorage.setItem(key, "1");
  }, [needsResubmit, newSeoCount]);

  // --- actions -----------------------------------------------------------
  const run = async (
    label: string,
    action: string,
    extra: Record<string, string> = {},
    onSuccess?: (data: any) => void,
  ) => {
    setBusy(action);
    try {
      const data = await callGsc(action, extra);
      toast.success(label);
      onSuccess?.(data);
    } catch (err) {
      toast.error(`Falha: ${label}`, { description: String(err) });
    } finally {
      setBusy(null);
      loadAudit();
      loadResubmitSignal();
    }
  };

  // --- derived -----------------------------------------------------------
  const filteredSitemaps = useMemo(
    () => filterSitemaps(sitemaps ?? [], sitemapFilter),
    [sitemaps, sitemapFilter],
  );

  const filteredAudit = useMemo(() => {
    if (auditFilter === "all") return audit;
    if (auditFilter === "errors") return audit.filter((a) => !a.ok);
    if (auditFilter === "verify") return audit.filter((a) => a.action === "verify");
    if (auditFilter === "submit")
      return audit.filter((a) => a.action === "submit-sitemap");
    return audit;
  }, [audit, auditFilter]);

  const verifyHistory = useMemo(
    () => audit.filter((a) => a.action === "verify").slice(0, 10),
    [audit],
  );

  const notConnected = !status?.connected || status?.error === "missing_credentials";

  if (loadingStatus) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando status do Google Search Console…
      </div>
    );
  }

  // --- render ------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Resubmit alert */}
      {needsResubmit && (
        <Alert className="border-amber-500/50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="flex items-center gap-2">
            Sitemap desatualizado
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              {newSeoCount} novas
            </Badge>
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>
              Há páginas SEO mais recentes que o último envio bem-sucedido ao GSC
              {lastSeoChange
                ? ` (${new Date(lastSeoChange).toLocaleString("pt-BR")})`
                : ""}
              .
            </span>
            <Button
              size="sm"
              disabled={!status?.owned || !!busy}
              onClick={() =>
                run("Sitemap reenviado", "submit-sitemap", { site, sitemap: sitemapUrl })
              }
            >
              <Send className="h-3.5 w-3.5 mr-1.5" /> Reenviar agora
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Connection status */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {notConnected ? (
                <>
                  <ShieldAlert className="h-5 w-5 text-destructive" /> Conexão não aprovada
                </>
              ) : status?.owned ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-green-600" /> Conectado e verificado
                </>
              ) : (
                <>
                  <ShieldAlert className="h-5 w-5 text-amber-600" /> Conectado — domínio não verificado
                </>
              )}
            </CardTitle>
            <CardDescription>
              {notConnected
                ? status?.detail ?? "Aprove o conector Google Search Console em Conectores."
                : `Conta autorizada, ${status?.sites?.length ?? 0} site(s) na conta.`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadStatus}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">Site (com barra final)</span>
              <Input value={site} onChange={(e) => setSite(e.target.value)} />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">URL do sitemap</span>
              <Input value={sitemapUrl} onChange={(e) => setSitemapUrl(e.target.value)} />
            </label>
          </div>

          {notConnected && (
            <Alert variant="destructive">
              <AlertTitle>Conexão GSC necessária</AlertTitle>
              <AlertDescription>
                Vá em <strong>Conectores → Google Search Console</strong> e autorize a conta
                antes de continuar.
              </AlertDescription>
            </Alert>
          )}

          {!notConnected && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  run("Token META gerado", "get-token", { site }, (data) => {
                    setMetaToken((data?.token as string) ?? null);
                  })
                }
              >
                {busy === "get-token" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                )}
                Obter token META
              </Button>
              <Button
                size="sm"
                disabled={!!busy}
                onClick={() =>
                  run("Verificação solicitada", "verify", { site }, async () => {
                    await loadStatus();
                    try {
                      await callGsc("add", { site });
                      await callGsc("submit-sitemap", { site, sitemap: sitemapUrl });
                      toast.success("Sitemap enviado após verificação");
                    } catch {
                      /* silent */
                    }
                  })
                }
                data-testid="gsc-verify-btn"
              >
                {busy === "verify" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                )}
                Re-testar posse
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() => run("Site adicionado", "add", { site }, () => loadStatus())}
              >
                {busy === "add" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="h-4 w-4 mr-1.5" />
                )}
                Adicionar site
              </Button>
              <Button asChild size="sm" variant="ghost">
                <a
                  href="https://search.google.com/search-console"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir Search Console
                </a>
              </Button>
            </div>
          )}

          {metaToken && (
            <Alert>
              <AlertTitle>Meta tag de verificação</AlertTitle>
              <AlertDescription className="space-y-2">
                <code className="block p-2 bg-muted rounded text-xs break-all">
                  {`<meta name="google-site-verification" content="${metaToken}" />`}
                </code>
              </AlertDescription>
            </Alert>
          )}

          {status?.sites && status.sites.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="font-medium">Sites na conta:</div>
              <ul className="space-y-0.5">
                {status.sites.map((s) => (
                  <li key={s.siteUrl} className="flex items-center gap-2">
                    <LinkIcon className="h-3 w-3" />
                    <span className="font-mono">{s.siteUrl}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {s.permissionLevel}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verify history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico de verificação de posse
          </CardTitle>
          <CardDescription>
            Últimas 10 tentativas. Aprovado = HTTP 200, Pendente = 202/empty, Recusado = erro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verifyHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma verificação registrada ainda.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {verifyHistory.map((row) => {
                const verdict = row.ok
                  ? { label: "Aprovado", cls: "bg-green-100 text-green-800" }
                  : row.status === 202
                    ? { label: "Pendente", cls: "bg-amber-100 text-amber-800" }
                    : { label: "Recusado", cls: "bg-red-100 text-red-800" };
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-2 border-b py-1.5 last:border-0"
                  >
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${verdict.cls}`}
                      data-testid="gsc-verify-verdict"
                    >
                      {verdict.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString("pt-BR")}
                    </span>
                    <span className="text-xs">HTTP {row.status ?? "—"}</span>
                    {row.error && (
                      <span className="text-xs text-destructive truncate max-w-[320px]">
                        {row.error}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-7"
                      onClick={() => setSelected(row)}
                    >
                      Detalhes
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Sitemaps */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Sitemaps submetidos</CardTitle>
            <CardDescription>
              {status?.owned
                ? "Lista direta do Search Console com erros, avisos e último envio."
                : "Verifique a posse do domínio para ver os sitemaps."}
            </CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={sitemapFilter}
              onValueChange={(v) => setSitemapFilter(v as SitemapFilter)}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="errors">Com erros</SelectItem>
                <SelectItem value="warnings">Com avisos</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={loadSitemaps}
              disabled={!status?.owned || loadingSitemaps}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" /> Recarregar
            </Button>
            <Button
              size="sm"
              disabled={!status?.owned || !!busy}
              onClick={() =>
                run("Sitemap reenviado", "submit-sitemap", { site, sitemap: sitemapUrl })
              }
            >
              {busy === "submit-sitemap" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Reenviar sitemap
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSitemaps ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : !status?.owned ? (
            <p className="text-sm text-muted-foreground">
              Indisponível enquanto a posse não estiver verificada.
            </p>
          ) : filteredSitemaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum sitemap correspondente ao filtro.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3">URL</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Último envio</th>
                    <th className="py-2 pr-3">Erros</th>
                    <th className="py-2 pr-3">Avisos</th>
                    <th className="py-2 pr-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSitemaps.map((sm) => (
                    <tr key={sm.path} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs break-all max-w-[320px]">
                        {sm.path}
                      </td>
                      <td className="py-2 pr-3">
                        {sm.isSitemapsIndex ? (
                          <Badge variant="secondary">index</Badge>
                        ) : (
                          sm.type ?? "—"
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {sm.lastSubmitted
                          ? new Date(sm.lastSubmitted).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {Number(sm.errors ?? 0) > 0 ? (
                          <Badge variant="destructive">{sm.errors}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">0</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {Number(sm.warnings ?? 0) > 0 ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            {sm.warnings}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">0</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setSelected(sm)}
                        >
                          Detalhes
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          disabled={!!busy}
                          onClick={() =>
                            run("Sitemap reenviado", "submit-sitemap", {
                              site,
                              sitemap: sm.path,
                            })
                          }
                        >
                          <Send className="h-3.5 w-3.5 mr-1" /> Reenviar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Log de integração</CardTitle>
            <CardDescription>
              Tentativas detalhadas — autorização, verificação, envio de sitemap e respostas da
              API.
            </CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={auditFilter} onValueChange={(v) => setAuditFilter(v as any)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="errors">Falhas</SelectItem>
                <SelectItem value="verify">Verificações</SelectItem>
                <SelectItem value="submit">Envios de sitemap</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadAudit}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Recarregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3">Quando</th>
                    <th className="py-2 pr-3">Ação</th>
                    <th className="py-2 pr-3">HTTP</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Erro</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-xs">
                        {new Date(row.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2 pr-3 text-xs font-mono">{row.action}</td>
                      <td className="py-2 pr-3 text-xs">{row.status ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {row.ok ? (
                          <Badge variant="outline" className="border-green-500 text-green-700">
                            ok
                          </Badge>
                        ) : (
                          <Badge variant="destructive">erro</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs text-destructive truncate max-w-[260px]">
                        {row.error ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setSelected(row)}
                        >
                          Detalhes
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-submit hint */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envio automático</CardTitle>
          <CardDescription>
            O sitemap <code>/sitemap.xml</code> é dinâmico e sempre reflete novas páginas SEO. Após
            a verificação de posse, o sistema reenvia automaticamente. Use{" "}
            <strong>Reenviar sitemap</strong> para forçar uma nova leitura imediata.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Details dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes</DialogTitle>
            <DialogDescription>Resposta completa da API.</DialogDescription>
          </DialogHeader>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-[60vh]">
            {selected ? JSON.stringify(selected, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSeoGscPage;
