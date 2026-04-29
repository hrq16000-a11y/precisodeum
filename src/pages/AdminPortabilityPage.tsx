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
  Fingerprint, AlertTriangle,
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
          <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full h-auto">
            <TabsTrigger value="bundle"><Archive className="size-4 mr-2" />ZIP único</TabsTrigger>
            <TabsTrigger value="env"><Server className="size-4 mr-2" />Variáveis</TabsTrigger>
            <TabsTrigger value="checklist"><ListChecks className="size-4 mr-2" />Checklist</TabsTrigger>
            <TabsTrigger value="snapshots"><Archive className="size-4 mr-2" />Snapshots</TabsTrigger>
            <TabsTrigger value="validate"><ShieldCheck className="size-4 mr-2" />Validação</TabsTrigger>
          </TabsList>

          <TabsContent value="bundle"><BundleTab /></TabsContent>
          <TabsContent value="env"><EnvTab /></TabsContent>
          <TabsContent value="checklist"><ChecklistTab /></TabsContent>
          <TabsContent value="snapshots"><SnapshotsTab /></TabsContent>
          <TabsContent value="validate"><ValidateTab /></TabsContent>
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
