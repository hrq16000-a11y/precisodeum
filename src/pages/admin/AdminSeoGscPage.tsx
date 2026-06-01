import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, ShieldCheck, ShieldAlert, Send, Plus, Link as LinkIcon, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

const callGsc = async (action: string, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams({ action, ...extra });
  const { data, error } = await supabase.functions.invoke(`gsc-verify?${params.toString()}`, {
    method: "GET",
  });
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

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (status?.owned) loadSitemaps();
  }, [status?.owned, loadSitemaps]);

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
    }
  };

  // --- Render ---
  if (loadingStatus) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando status do Google Search Console…
      </div>
    );
  }

  const notConnected = !status?.connected || status?.error === "missing_credentials";

  return (
    <div className="space-y-4">
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
          <Button variant="outline" size="sm" onClick={loadStatus} disabled={loadingStatus}>
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
                Vá em <strong>Conectores → Google Search Console</strong> e autorize a conta antes
                de continuar.
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
                {busy === "get-token" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
                Obter token META
              </Button>
              <Button
                size="sm"
                disabled={!!busy}
                onClick={() => run("Verificação solicitada", "verify", { site }, () => loadStatus())}
              >
                {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
                Verificar posse
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() => run("Site adicionado", "add", { site }, () => loadStatus())}
              >
                {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Adicionar site
              </Button>
              <Button asChild size="sm" variant="ghost">
                <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir Search Console
                </a>
              </Button>
            </div>
          )}

          {metaToken && (
            <Alert>
              <AlertTitle>Meta tag de verificação</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-xs">
                  Já está embutida em <code>index.html</code> via configuração do app. Se precisar
                  injetar manualmente, use:
                </p>
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
                    <Badge variant="outline" className="text-[10px]">{s.permissionLevel}</Badge>
                  </li>
                ))}
              </ul>
            </div>
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadSitemaps} disabled={!status?.owned || loadingSitemaps}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Recarregar
            </Button>
            <Button
              size="sm"
              disabled={!status?.owned || !!busy}
              onClick={() =>
                run("Sitemap reenviado", "submit-sitemap", { site, sitemap: sitemapUrl }, () => loadSitemaps())
              }
            >
              {busy === "submit-sitemap" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
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
            <p className="text-sm text-muted-foreground">Indisponível enquanto a posse não estiver verificada.</p>
          ) : !sitemaps || sitemaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum sitemap submetido ainda. Use o botão <strong>Reenviar sitemap</strong> para
              começar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3">URL</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Último envio</th>
                    <th className="py-2 pr-3">Último download</th>
                    <th className="py-2 pr-3">Erros</th>
                    <th className="py-2 pr-3">Avisos</th>
                    <th className="py-2 pr-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sitemaps.map((sm) => (
                    <tr key={sm.path} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs break-all max-w-[320px]">{sm.path}</td>
                      <td className="py-2 pr-3">
                        {sm.isSitemapsIndex ? <Badge variant="secondary">index</Badge> : sm.type ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {sm.lastSubmitted ? new Date(sm.lastSubmitted).toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {sm.lastDownloaded ? new Date(sm.lastDownloaded).toLocaleString("pt-BR") : "—"}
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
                      <td className="py-2 pr-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!busy}
                          onClick={() =>
                            run("Sitemap reenviado", "submit-sitemap", { site, sitemap: sm.path }, () =>
                              loadSitemaps(),
                            )
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

      {/* Auto-submit hint */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envio automático</CardTitle>
          <CardDescription>
            O sitemap <code>/sitemap.xml</code> é dinâmico (edge function) e sempre reflete novas
            páginas SEO criadas — não precisa regerar. Após verificar a posse do domínio, o sistema
            faz uma submissão inicial ao Search Console; o Google passa a fazer crawl periódico
            automaticamente. Use <strong>Reenviar sitemap</strong> quando quiser forçar uma nova
            leitura imediata.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};

export default AdminSeoGscPage;
