import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Archive, Download, ShieldCheck, Loader2, FileText,
  CheckCircle2, Circle, Eye, EyeOff, Trash2, RefreshCw, ListChecks, Server, Webhook,
  Fingerprint, AlertTriangle, KeyRound, Rocket, PlayCircle, XCircle,
} from "lucide-react";

// ---------------- Helpers ----------------

const FUNCTION_URL = (name: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToBlob(b64: string, type = "application/zip") {
  const byteChars = atob(b64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type });
}

// ---------------- ENV vars catalog ----------------

type EnvVar = {
  name: string;
  required: boolean;
  scope: "frontend" | "backend";
  description: string;
  whereToFind: string;
};

const ENV_VARS: EnvVar[] = [
  { name: "VITE_SUPABASE_URL", required: true, scope: "frontend",
    description: "URL pública do backend Lovable Cloud.",
    whereToFind: "Já preenchida automaticamente pelo Lovable Cloud no .env do projeto." },
  { name: "VITE_SUPABASE_PUBLISHABLE_KEY", required: true, scope: "frontend",
    description: "Chave anon pública (pode ficar no código).",
    whereToFind: "Lovable Cloud → Configurações → API." },
  { name: "VITE_SUPABASE_PROJECT_ID", required: true, scope: "frontend",
    description: "Identificador do projeto Cloud.",
    whereToFind: "Lovable Cloud → Configurações." },
  { name: "SUPABASE_URL", required: true, scope: "backend",
    description: "Mesma URL acima, para edge functions.",
    whereToFind: "Auto-injetada nas edge functions." },
  { name: "SUPABASE_ANON_KEY", required: true, scope: "backend",
    description: "Chave anon usada por edge functions.",
    whereToFind: "Auto-injetada." },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, scope: "backend",
    description: "Chave de serviço (NUNCA exponha no frontend).",
    whereToFind: "Lovable Cloud → API → Service Role." },
  { name: "CRON_SECRET", required: true, scope: "backend",
    description: "Token usado para autenticar chamadas de cron.",
    whereToFind: "Configurado em Secrets do projeto." },
  { name: "VAPID_PUBLIC_KEY", required: false, scope: "backend",
    description: "Web Push — chave pública.",
    whereToFind: "Gerar com `npx web-push generate-vapid-keys`." },
  { name: "VAPID_PRIVATE_KEY", required: false, scope: "backend",
    description: "Web Push — chave privada.",
    whereToFind: "Mesmo comando acima." },
  { name: "LOVABLE_API_KEY", required: false, scope: "backend",
    description: "Gateway Lovable AI (não usado neste projeto).",
    whereToFind: "Lovable → Workspace → AI Gateway." },
];

const WEBHOOKS_INFO = [
  { name: "process-lead-followups", desc: "Cron horário — envia lembretes de follow-up de leads. Requer header x-cron-secret." },
  { name: "expire-sponsors", desc: "Cron diário — expira anúncios de patrocinadores fora do prazo." },
  { name: "notify-lead-performance", desc: "Cron 6h — notifica prestadores com leads de alto engajamento." },
  { name: "sync-service-areas-cron", desc: "Cron diário — recalcula áreas de atendimento." },
  { name: "import-rss / import-jobs-rss", desc: "Importação de notícias e vagas externas (cron + manual)." },
  { name: "storage-backup", desc: "Backup completo do Storage (acionado pelo painel ou cron)." },
];

// ---------------- Page ----------------

export default function AdminPortabilityPage() {
  return (
    <AdminLayout>
      <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-6xl">
        <header className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Portabilidade & Migração</h1>
          <p className="text-sm text-muted-foreground">
            ZIP único, .env.example, checklist passo a passo, snapshots versionados e validação de integridade.
          </p>
        </header>

        <Tabs defaultValue="bundle" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 w-full h-auto">
            <TabsTrigger value="bundle"><Archive className="size-4 mr-2" />ZIP único</TabsTrigger>
            <TabsTrigger value="env"><Server className="size-4 mr-2" />Variáveis</TabsTrigger>
            <TabsTrigger value="secrets"><KeyRound className="size-4 mr-2" />Secrets</TabsTrigger>
            <TabsTrigger value="checklist"><ListChecks className="size-4 mr-2" />Checklist</TabsTrigger>
            <TabsTrigger value="snapshots"><Archive className="size-4 mr-2" />Snapshots</TabsTrigger>
            <TabsTrigger value="validate"><ShieldCheck className="size-4 mr-2" />Validação</TabsTrigger>
            <TabsTrigger value="userref"><Fingerprint className="size-4 mr-2" />user_ref</TabsTrigger>
            <TabsTrigger value="restore"><Rocket className="size-4 mr-2" />Restaurar</TabsTrigger>
          </TabsList>

          <TabsContent value="bundle"><BundleTab /></TabsContent>
          <TabsContent value="env"><EnvTab /></TabsContent>
          <TabsContent value="secrets"><SecretsTab /></TabsContent>
          <TabsContent value="checklist"><ChecklistTab /></TabsContent>
          <TabsContent value="snapshots"><SnapshotsTab /></TabsContent>
          <TabsContent value="validate"><ValidateTab /></TabsContent>
          <TabsContent value="userref"><UserRefAuditTab /></TabsContent>
          <TabsContent value="restore"><RestoreTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

// ---------------- Bundle Tab ----------------

function BundleTab() {
  const [storage, setStorage] = useState(true);
  const [persist, setPersist] = useState(true);
  const [label, setLabel] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");

  const generate = useCallback(async () => {
    setRunning(true); setProgress(0); setTotal(0); setStatus("Iniciando...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const params = new URLSearchParams({
        storage: String(storage),
        persist: String(persist),
        ...(label ? { label } : {}),
      });
      const res = await fetch(`${FUNCTION_URL("portability-bundle")}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === "progress") {
              setProgress(ev.processed); setTotal(ev.total);
            } else if (ev.type === "status") {
              setStatus(ev.message);
            } else if (ev.type === "complete") {
              const blob = base64ToBlob(ev.data);
              downloadBlob(blob, ev.filename);
              toast.success(`Bundle gerado (${(ev.size_bytes / 1024 / 1024).toFixed(2)} MB, ${ev.file_count} arquivos)`);
              setStatus("Concluído.");
            } else if (ev.type === "warning") {
              toast.warning(ev.message);
            }
          } catch { /* ignore parse */ }
        }
      }
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }, [storage, persist, label]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerar bundle ZIP único</CardTitle>
        <CardDescription>
          Compacta manifesto, .env.example, RESTORE.md e arquivos do Storage.
          O dump SQL completo (schema+dados) deve ser exportado em <strong>Admin → Backup</strong> e adicionado dentro do ZIP em <code>db/dump.sql</code> antes da restauração.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Rótulo (opcional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={running}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={storage} onCheckedChange={(v) => setStorage(!!v)} disabled={running} />
            Incluir arquivos do Storage
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={persist} onCheckedChange={(v) => setPersist(!!v)} disabled={running} />
            Salvar como snapshot versionado
          </label>
        </div>
        {running && (
          <div className="space-y-2">
            <Progress value={total > 0 ? (progress / total) * 100 : 0} />
            <p className="text-xs text-muted-foreground">
              {status} {total > 0 && `${progress}/${total}`}
            </p>
          </div>
        )}
        <Button onClick={generate} disabled={running} size="lg">
          {running ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Archive className="size-4 mr-2" />}
          Gerar e baixar ZIP
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------- ENV Tab ----------------

function EnvTab() {
  const [showSecrets, setShowSecrets] = useState(false);
  const generateExample = () => {
    const lines = [
      "# Arquivo .env.example gerado automaticamente",
      "# NÃO contém valores reais — preencha após copiar para .env",
      "",
    ];
    let lastScope = "";
    for (const v of ENV_VARS) {
      if (v.scope !== lastScope) {
        lines.push(`# ====== ${v.scope === "frontend" ? "Frontend (Vite)" : "Backend / Edge Functions"} ======`);
        lastScope = v.scope;
      }
      lines.push(`# ${v.description}`);
      lines.push(`${v.name}=${v.required ? "" : ""}`);
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    downloadBlob(blob, ".env.example");
    toast.success(".env.example baixado");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Variáveis de ambiente</CardTitle>
            <CardDescription>
              Lista completa de variáveis necessárias. Os valores ficam ocultos por segurança.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSecrets(s => !s)}>
              {showSecrets ? <EyeOff className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
              {showSecrets ? "Ocultar" : "Mostrar nomes"}
            </Button>
            <Button onClick={generateExample} size="sm">
              <Download className="size-4 mr-2" />Baixar .env.example
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {ENV_VARS.map((v) => (
            <div key={v.name} className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="font-mono text-sm font-semibold">
                  {showSecrets ? v.name : v.name.replace(/./g, (c, i) => i < 4 ? c : "•")}
                </code>
                <Badge variant={v.required ? "default" : "secondary"}>
                  {v.required ? "obrigatória" : "opcional"}
                </Badge>
                <Badge variant="outline">{v.scope}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{v.description}</p>
              <p className="text-xs text-muted-foreground">
                <strong>Onde encontrar:</strong> {v.whereToFind}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="size-5" />Webhooks e Crons
          </CardTitle>
          <CardDescription>Reconfigure estes endpoints em um novo servidor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {WEBHOOKS_INFO.map((w) => (
            <div key={w.name} className="flex items-start gap-3 text-sm">
              <Server className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <code className="font-mono font-semibold">{w.name}</code>
                <p className="text-muted-foreground">{w.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Checklist Tab ----------------

const CHECKLIST_KEY = "portability_checklist_v1";
const STEPS = [
  { id: "code", label: "Código sincronizado no GitHub", hint: "Verifique o último commit em Settings → GitHub." },
  { id: "schema", label: "Schema SQL exportado", hint: "Admin → Backup → Exportar schema (estrutura)." },
  { id: "data", label: "Dump completo (schema + dados) gerado", hint: "Admin → Backup → Exportar SQL completo." },
  { id: "storage", label: "Backup do Storage gerado", hint: "Use o ZIP único nesta tela ou Admin → Backup." },
  { id: "env", label: ".env.example baixado e documentado", hint: "Aba Variáveis." },
  { id: "webhooks", label: "Webhooks/crons documentados", hint: "Aba Variáveis → Webhooks e Crons." },
  { id: "snapshot", label: "Snapshot versionado salvo", hint: "Marque ‘Salvar como snapshot’ ao gerar o ZIP." },
  { id: "validate", label: "Bundle validado (checksum + tamanho)", hint: "Aba Validação." },
  { id: "restore_test", label: "Restauração testada em ambiente espelho", hint: "Importe o ZIP em projeto novo antes de migrar produção." },
];

function ChecklistTab() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { setDone(JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "{}")); } catch { /* noop */ }
  }, []);
  const toggle = (id: string) => {
    setDone((d) => {
      const next = { ...d, [id]: !d[id] };
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
      return next;
    });
  };
  const completed = STEPS.filter(s => done[s.id]).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist guiado de portabilidade</CardTitle>
        <CardDescription>{completed}/{STEPS.length} etapas concluídas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress value={(completed / STEPS.length) * 100} className="mb-3" />
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className="w-full text-left flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition"
          >
            {done[s.id]
              ? <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
              : <Circle className="size-5 text-muted-foreground shrink-0 mt-0.5" />}
            <div className="flex-1">
              <div className="font-medium text-sm">
                {i + 1}. {s.label}
              </div>
              <div className="text-xs text-muted-foreground">{s.hint}</div>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------- Snapshots Tab ----------------

type Snapshot = {
  id: string;
  label: string;
  kind: string;
  storage_path: string;
  size_bytes: number;
  file_count: number;
  checksum_sha256: string | null;
  status: string;
  created_at: string;
  validated_at: string | null;
};

function SnapshotsTab() {
  const [items, setItems] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${FUNCTION_URL("portability-snapshot")}?action=list`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      setItems(json.snapshots ?? []);
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const download = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${FUNCTION_URL("portability-snapshot")}?action=download&id=${id}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const j = await res.json();
    if (j.url) window.open(j.url, "_blank");
    else toast.error(j.error || "Falhou");
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este snapshot?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${FUNCTION_URL("portability-snapshot")}?action=delete&id=${id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    toast.success("Removido");
    reload();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Snapshots versionados</CardTitle>
          <CardDescription>Bundles persistidos com checksum SHA-256.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />Recarregar
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0
          ? <p className="text-sm text-muted-foreground">Nenhum snapshot ainda. Gere um na aba "ZIP único" com a opção "Salvar como snapshot".</p>
          : (
            <div className="space-y-2">
              {items.map((s) => (
                <div key={s.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{s.label}</span>
                      <Badge variant={s.status === "ready" ? "default" : s.status === "failed" ? "destructive" : "secondary"}>
                        {s.status}
                      </Badge>
                      <Badge variant="outline">{s.kind}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString("pt-BR")} ·{" "}
                      {(s.size_bytes / 1024 / 1024).toFixed(2)} MB · {s.file_count} arquivos
                    </div>
                    {s.checksum_sha256 && (
                      <code className="text-[10px] text-muted-foreground block truncate">
                        sha256: {s.checksum_sha256}
                      </code>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => download(s.id)}>
                      <Download className="size-4 mr-1" />Baixar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}

// ---------------- Validate Tab ----------------

function ValidateTab() {
  const [items, setItems] = useState<Snapshot[]>([]);
  const [validating, setValidating] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const reload = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${FUNCTION_URL("portability-snapshot")}?action=list`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const json = await res.json();
    setItems(json.snapshots ?? []);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const validate = async (id: string) => {
    setValidating(id); setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${FUNCTION_URL("portability-snapshot")}?action=validate&id=${id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      setResult({ id, ...json });
      if (json.ok) toast.success("Bundle íntegro ✔");
      else toast.error("Falha de integridade");
      reload();
    } finally { setValidating(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validação de integridade</CardTitle>
        <CardDescription>
          Recalcula SHA-256 e tamanho do bundle salvo no Storage e compara com o registro original.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0
          ? <p className="text-sm text-muted-foreground">Sem snapshots para validar.</p>
          : items.map((s) => (
            <div key={s.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm">{s.label}</div>
                <div className="text-xs text-muted-foreground">
                  {s.validated_at ? `Última validação: ${new Date(s.validated_at).toLocaleString("pt-BR")}` : "Nunca validado"}
                </div>
              </div>
              <Button size="sm" onClick={() => validate(s.id)} disabled={validating === s.id}>
                {validating === s.id
                  ? <Loader2 className="size-4 mr-2 animate-spin" />
                  : <ShieldCheck className="size-4 mr-2" />}
                Validar
              </Button>
            </div>
          ))}

        {result && (
          <div className={`mt-4 p-3 rounded-lg border ${result.ok ? "bg-green-50 border-green-200 dark:bg-green-950/40" : "bg-destructive/10 border-destructive/40"}`}>
            <div className="font-semibold text-sm mb-1 flex items-center gap-2">
              {result.ok
                ? <><CheckCircle2 className="size-4 text-green-600" />Bundle íntegro</>
                : <><FileText className="size-4 text-destructive" />Falha de integridade</>}
            </div>
            <ul className="text-xs space-y-0.5 font-mono">
              <li>checksum esperado: {result.expected_checksum}</li>
              <li>checksum real:     {result.actual_checksum}</li>
              <li>tamanho esperado:  {result.expected_size}</li>
              <li>tamanho real:      {result.actual_size}</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- user_ref Audit Tab ----------------

type UserRefRow = {
  table_name: string;
  total_rows: number;
  filled: number;
  missing: number;
  has_index: boolean;
  data_type: string;
};

type UserRefDetailRow = {
  table_name: string;
  data_type: string;
  total_rows: number;
  filled: number;
  missing: number;
  coverage_pct: number | null;
  has_index: boolean;
  sample_missing_ids: string[];
  is_sponsor_table: boolean;
};

function UserRefAuditTab() {
  const [rows, setRows] = useState<UserRefRow[]>([]);
  const [detail, setDetail] = useState<UserRefDetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState<number>(95);
  const [strict, setStrict] = useState<boolean>(true);
  const [savingCfg, setSavingCfg] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: basic, error: e1 }, { data: full, error: e2 }] =
        await Promise.all([
          supabase.rpc("audit_user_ref_health" as never),
          supabase.rpc("audit_user_ref_full_detailed" as never),
        ]);
      if (e1) throw e1;
      setRows((basic as UserRefRow[]) ?? []);
      if (!e2) setDetail((full as UserRefDetailRow[]) ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", ["restore_min_user_ref_coverage_pct", "restore_strict_mode"]);
    if (data) {
      for (const r of data as Array<{ key: string; value: unknown }>) {
        if (r.key === "restore_min_user_ref_coverage_pct") {
          setThreshold(Number(r.value) || 95);
        }
        if (r.key === "restore_strict_mode") setStrict(Boolean(r.value));
      }
    }
  }, []);

  const saveConfig = useCallback(async () => {
    setSavingCfg(true);
    try {
      const updates: Array<{ key: string; value: unknown }> = [
        { key: "restore_min_user_ref_coverage_pct", value: threshold },
        { key: "restore_strict_mode", value: strict },
      ];
      for (const u of updates) {
        const { error } = await supabase
          .from("site_settings")
          // value column is jsonb at the DB level; the generated TS type is narrow
          .upsert(u as never, { onConflict: "key" });
        if (error) throw error;
      }
      toast.success("Regra de cobertura salva.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro: ${msg}`);
    } finally {
      setSavingCfg(false);
    }
  }, [threshold, strict]);

  useEffect(() => { reload(); loadConfig(); }, [reload, loadConfig]);

  const totals = rows.reduce(
    (acc, r) => {
      acc.tables += 1;
      acc.total += Number(r.total_rows) || 0;
      acc.filled += Number(r.filled) || 0;
      acc.missing += Number(r.missing) || 0;
      if (!r.has_index) acc.noIndex += 1;
      return acc;
    },
    { tables: 0, total: 0, filled: 0, missing: 0, noIndex: 0 },
  );

  const coverage = totals.total > 0
    ? ((totals.filled / totals.total) * 100).toFixed(1)
    : "—";
  const coverageNum = totals.total > 0
    ? (totals.filled / totals.total) * 100
    : 100;
  const belowThreshold = coverageNum < threshold;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />Regra de cobertura mínima (pós-restore)
          </CardTitle>
          <CardDescription>
            Define o percentual mínimo de cobertura de <code>user_ref</code> para
            marcar a validação pós-restore como bem-sucedida.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium">Cobertura mínima (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={strict} onCheckedChange={(v) => setStrict(!!v)} />
            Modo estrito (falhar restore se abaixo)
          </label>
          <Button onClick={saveConfig} disabled={savingCfg}>
            {savingCfg
              ? <Loader2 className="size-4 mr-2 animate-spin" />
              : <CheckCircle2 className="size-4 mr-2" />}
            Salvar regra
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="size-5" />Auditoria global do user_ref
            </CardTitle>
            <CardDescription>
              Cobertura, índices e evidências de backfill.
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => exportUserRefCsv(rows, detail)} disabled={rows.length === 0}>
              <Download className="size-4 mr-2" />Exportar CSV detalhado
            </Button>
            <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Recarregar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Tabelas</div>
              <div className="text-2xl font-bold">{totals.tables}</div>
            </div>
            <div className={`border rounded-lg p-3 ${belowThreshold ? "border-destructive" : ""}`}>
              <div className="text-xs text-muted-foreground">Cobertura</div>
              <div className={`text-2xl font-bold ${belowThreshold ? "text-destructive" : "text-green-600"}`}>
                {coverage}%
              </div>
              <div className="text-[10px] text-muted-foreground">mínimo: {threshold}%</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Sem user_ref</div>
              <div className="text-2xl font-bold text-destructive">{totals.missing}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Sem índice</div>
              <div className="text-2xl font-bold text-amber-600">{totals.noIndex}</div>
            </div>
          </div>

          {belowThreshold && (
            <div className="text-xs p-3 rounded-lg border border-destructive/40 bg-destructive/5 text-destructive">
              <AlertTriangle className="size-4 inline mr-1" />
              Cobertura abaixo do limite configurado ({threshold}%). O modo estrito
              {strict ? " irá falhar" : " NÃO falhará"} a validação pós-restore.
            </div>
          )}

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2">Tabela</th>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-right p-2">Linhas</th>
                  <th className="text-right p-2">Preenchidas</th>
                  <th className="text-right p-2">Faltando</th>
                  <th className="text-center p-2">Índice</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.table_name} className="border-t">
                    <td className="p-2 font-mono text-xs">{r.table_name}</td>
                    <td className="p-2">
                      <Badge variant={r.data_type === "text" ? "outline" : "destructive"}>
                        {r.data_type}
                      </Badge>
                    </td>
                    <td className="p-2 text-right">{r.total_rows}</td>
                    <td className="p-2 text-right">{r.filled}</td>
                    <td className="p-2 text-right">
                      {r.missing > 0
                        ? <span className="text-destructive font-semibold">{r.missing}</span>
                        : "0"}
                    </td>
                    <td className="p-2 text-center">
                      {r.has_index
                        ? <CheckCircle2 className="size-4 text-green-600 inline" />
                        : <AlertTriangle className="size-4 text-amber-600 inline" />}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      Sem dados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- user_ref CSV export (detailed + sponsor evidence) ----------------

function exportUserRefCsv(rows: UserRefRow[], detail: UserRefDetailRow[]) {
  const detailMap = new Map(detail.map((d) => [d.table_name, d]));
  const header = [
    "table_name", "data_type", "total_rows", "filled", "missing",
    "coverage_pct", "has_index", "is_sponsor_table", "sample_missing_ids",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const d = detailMap.get(r.table_name);
    const samples = (d?.sample_missing_ids ?? []).join("|");
    const cov = d?.coverage_pct ?? (r.total_rows > 0
      ? ((r.filled / r.total_rows) * 100).toFixed(2)
      : "");
    lines.push([
      r.table_name,
      r.data_type,
      r.total_rows,
      r.filled,
      r.missing,
      cov,
      r.has_index ? "yes" : "no",
      d?.is_sponsor_table ? "yes" : "no",
      `"${samples}"`,
    ].join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `user-ref-audit-${new Date().toISOString().slice(0, 10)}.csv`);
  toast.success("Relatório CSV detalhado gerado");
}


// ---------------- Secrets Tab ----------------

type SecretRow = {
  name: string;
  required: boolean;
  group: string;
  status: "configured" | "pending" | "optional";
  length: number;
};

function SecretsTab() {
  const [data, setData] = useState<{ summary: any; secrets: SecretRow[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${FUNCTION_URL("portability-restore")}?action=secrets-checklist`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />Checklist de Secrets do novo host
          </CardTitle>
          <CardDescription>
            Status (configurado / pendente) com base nas variáveis declaradas em <code>.env.example</code>.
            Consultado em tempo real na edge function.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />Recarregar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data && (
          <div className="grid grid-cols-3 gap-3">
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Configurados</div>
              <div className="text-2xl font-bold text-green-600">{data.summary.configured}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Pendentes</div>
              <div className="text-2xl font-bold text-destructive">{data.summary.pending}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Opcionais</div>
              <div className="text-2xl font-bold text-muted-foreground">{data.summary.optional}</div>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {data?.secrets.map((s) => (
            <div key={s.name} className="border rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <code className="font-mono text-sm font-semibold">{s.name}</code>
                <div className="text-xs text-muted-foreground">grupo: {s.group} · {s.required ? "obrigatória" : "opcional"}</div>
              </div>
              {s.status === "configured" && <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="size-3 mr-1" />configurado ({s.length}c)</Badge>}
              {s.status === "pending" && <Badge variant="destructive"><AlertTriangle className="size-3 mr-1" />pendente</Badge>}
              {s.status === "optional" && <Badge variant="secondary">opcional</Badge>}
            </div>
          ))}
          {!data && !loading && <p className="text-sm text-muted-foreground">Sem dados.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- Restore Tab ----------------

type RestoreStep = {
  id: string;
  title: string;
  hint: string;
  action: "schema-integrity" | "storage-checksums" | "smoke-tests" | "manifest-compare" | "manual";
  manualText?: string;
};

const RESTORE_STEPS: RestoreStep[] = [
  { id: "create_db", title: "1. Criar banco de dados no novo host", hint: "Postgres 15+ com pgcrypto, pg_trgm, unaccent, pg_cron, pg_net, postgis.", action: "manual",
    manualText: "psql -c \"CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net; CREATE EXTENSION IF NOT EXISTS postgis;\"" },
  { id: "apply_schema", title: "2. Aplicar schema (estrutura, RLS, triggers)", hint: "psql -v ON_ERROR_STOP=1 -f db/01-schema.sql", action: "manual",
    manualText: "psql \"$NEW_DB\" -v ON_ERROR_STOP=1 -f db/01-schema.sql" },
  { id: "import_data", title: "3. Importar dados (data-only, ordem das dependências)", hint: "Use db/per-table/*.sql ou 02-data.sql.", action: "manual",
    manualText: "psql \"$NEW_DB\" -c \"SET session_replication_role = replica;\"\nfor f in db/per-table/*.sql; do psql \"$NEW_DB\" -v ON_ERROR_STOP=1 -f \"$f\"; done\npsql \"$NEW_DB\" -c \"SET session_replication_role = DEFAULT;\"" },
  { id: "schema_integrity", title: "4. Validar integridade do schema (cobertura user_ref)", hint: "Aplica a regra de cobertura mínima configurada na aba user_ref.", action: "schema-integrity" },
  { id: "recreate_cron", title: "5. Recriar cron jobs", hint: "psql -f cron/recreate-cron-jobs.sql", action: "manual",
    manualText: "psql \"$NEW_DB\" -f cron/recreate-cron-jobs.sql" },
  { id: "download_media", title: "6. Subir mídia do Storage", hint: "node scripts/download-storage.mjs --upload ./storage", action: "manual",
    manualText: "node scripts/download-storage.mjs --upload ./storage" },
  { id: "storage_checksums", title: "7. Recalcular checksums dos buckets restaurados", hint: "SHA-256 de cada arquivo (amostragem).", action: "storage-checksums" },
  { id: "manifest_compare", title: "8. Comparar com manifest do ZIP original", hint: "Carregue storage-manifest.json (vindo do ZIP) e compare divergências.", action: "manifest-compare" },
  { id: "smoke_tests", title: "9. Smoke tests estendidos (RPCs + busca)", hint: "Inclui /buscar por categoria e cidade com dados de exemplo.", action: "smoke-tests" },
];

function RestoreTab() {
  const [logs, setLogs] = useState<{ step: string; ts: string; level: "info" | "ok" | "error"; msg: string; data?: unknown }[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, "ok" | "error" | "pending">>({});
  const [manifest, setManifest] = useState<unknown | null>(null);
  const [manifestName, setManifestName] = useState<string>("");
  const [finalSummary, setFinalSummary] = useState<{ ok: number; failed: number; failures: string[] } | null>(null);

  const log = (step: string, level: "info" | "ok" | "error", msg: string, data?: unknown) => {
    setLogs((l) => [...l, { step, ts: new Date().toISOString(), level, msg, data }]);
  };

  const onManifestUpload = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setManifest(json);
      setManifestName(file.name);
      toast.success(`Manifest carregado: ${file.name}`);
      log("manifest_compare", "info", `Manifest carregado: ${file.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Manifest inválido: ${msg}`);
    }
  };

  const runAction = async (step: RestoreStep) => {
    if (step.action === "manual") return;
    if (step.action === "manifest-compare" && !manifest) {
      toast.error("Carregue o storage-manifest.json antes de comparar.");
      return;
    }
    setRunning(step.id);
    log(step.id, "info", `Iniciando "${step.title}"...`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const isPost = step.action === "manifest-compare";
      const actionParam = step.action === "manifest-compare"
        ? "storage-checksums-compare"
        : step.action;
      const res = await fetch(`${FUNCTION_URL("portability-restore")}?action=${actionParam}`, {
        method: isPost ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          ...(isPost ? { "Content-Type": "application/json" } : {}),
        },
        body: isPost ? JSON.stringify({ manifest }) : undefined,
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const ok = json.ok !== false;
      log(step.id, ok ? "ok" : "error", ok ? "Etapa concluída com sucesso." : "Falha detectada.", json);
      setResults((r) => ({ ...r, [step.id]: ok ? "ok" : "error" }));
      if (ok) toast.success(`${step.title} OK`);
      else toast.error(`Falha em: ${step.title}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(step.id, "error", msg);
      setResults((r) => ({ ...r, [step.id]: "error" }));
      toast.error(msg);
    } finally {
      setRunning(null);
    }
  };

  const runAll = async () => {
    setFinalSummary(null);
    for (const s of RESTORE_STEPS) {
      if (s.action !== "manual") {
        if (s.action === "manifest-compare" && !manifest) {
          log(s.id, "info", "Etapa pulada: nenhum manifest carregado.");
          continue;
        }
        await runAction(s);
      }
    }
    // build final summary
    setResults((current) => {
      const failed = Object.entries(current).filter(([, v]) => v === "error").map(([k]) => k);
      const ok = Object.values(current).filter((v) => v === "ok").length;
      setFinalSummary({ ok, failed: failed.length, failures: failed });
      return current;
    });
  };

  const exportLogs = () => {
    const text = logs.map((l) => `[${l.ts}] [${l.level.toUpperCase()}] ${l.step}: ${l.msg}${l.data ? "\n  " + JSON.stringify(l.data) : ""}`).join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `restore-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" />Manifest do Storage (do ZIP original)
          </CardTitle>
          <CardDescription>
            Necessário para a etapa 8 (comparação de divergências). Gerado pelo
            bundle ou pelo passo 7 do host original (<code>storage-manifest.json</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 items-start">
          <Input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onManifestUpload(f);
            }}
          />
          {manifestName && (
            <Badge variant="secondary">
              <CheckCircle2 className="size-3 mr-1" />{manifestName}
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><Rocket className="size-5" />Restaurar em novo host</CardTitle>
            <CardDescription>
              Fluxo sequencial. O pacote só deve ser marcado como "pronto" quando todas as etapas automáticas passarem.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportLogs} disabled={logs.length === 0}>
              <Download className="size-4 mr-2" />Exportar logs
            </Button>
            <Button size="sm" onClick={runAll} disabled={!!running}>
              <PlayCircle className="size-4 mr-2" />Rodar todas as automáticas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {RESTORE_STEPS.map((s) => {
            const r = results[s.id];
            return (
              <div key={s.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.title}</span>
                      {r === "ok" && <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="size-3 mr-1" />OK</Badge>}
                      {r === "error" && <Badge variant="destructive"><XCircle className="size-3 mr-1" />Falhou</Badge>}
                      {s.action === "manual" && <Badge variant="outline">manual</Badge>}
                      {s.action !== "manual" && <Badge variant="secondary">automática</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.hint}</p>
                  </div>
                  {s.action !== "manual" && (
                    <Button size="sm" onClick={() => runAction(s)} disabled={running === s.id}>
                      {running === s.id ? <Loader2 className="size-4 mr-2 animate-spin" /> : <PlayCircle className="size-4 mr-2" />}
                      Executar
                    </Button>
                  )}
                </div>
                {s.manualText && (
                  <pre className="text-[11px] bg-muted/50 rounded p-2 overflow-x-auto font-mono">{s.manualText}</pre>
                )}
              </div>
            );
          })}

          {finalSummary && (
            <div className={`mt-3 border rounded-lg p-3 ${finalSummary.failed === 0 ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5"}`}>
              <div className="font-semibold text-sm flex items-center gap-2">
                {finalSummary.failed === 0
                  ? <><CheckCircle2 className="size-4 text-green-600" />Restore validado — pacote pronto.</>
                  : <><XCircle className="size-4 text-destructive" />Restore com divergências.</>}
              </div>
              <div className="text-xs mt-1">
                Etapas OK: {finalSummary.ok} · Falhas: {finalSummary.failed}
                {finalSummary.failures.length > 0 && (
                  <span className="ml-2">({finalSummary.failures.join(", ")})</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logs detalhados</CardTitle>
          <CardDescription>{logs.length} entrada(s).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 rounded-lg p-3 max-h-96 overflow-auto font-mono text-[11px] space-y-1">
            {logs.length === 0 && <p className="text-muted-foreground">Nenhum log ainda. Execute uma etapa automática.</p>}
            {logs.map((l, i) => (
              <div key={i} className={l.level === "error" ? "text-destructive" : l.level === "ok" ? "text-green-600" : ""}>
                <span className="opacity-60">[{l.ts.slice(11, 19)}]</span>{" "}
                <span className="font-semibold">{l.step}</span>{" "}
                {l.msg}
                {l.data ? (
                  <pre className="ml-4 opacity-80 whitespace-pre-wrap">{JSON.stringify(l.data, null, 2).slice(0, 800)}{JSON.stringify(l.data).length > 800 ? "…" : ""}</pre>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

