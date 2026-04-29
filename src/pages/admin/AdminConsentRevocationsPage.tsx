import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldOff, MailX, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface RevocationRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  anon_id: string | null;
  version: number;
  revoked_categories: string[];
  current_state: { functional?: boolean; analytics?: boolean; marketing?: boolean } | null;
  source: string;
  read_by_admin: boolean;
  created_at: string;
  total_count: number;
}

const PAGE_SIZE = 25;

const formatDateTime = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const AdminConsentRevocationsPage = () => {
  const { loading, isAdmin } = useAdmin();
  const [rows, setRows] = useState<RevocationRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [page, setPage] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(true);

  useEffect(() => { document.title = "Revogações de consentimento | Admin"; }, []);

  const total = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useMemo(
    () => async () => {
      if (!isAdmin) return;
      setFetching(true);
      try {
        const { data, error } = await (supabase as any).rpc("list_consent_revocations", {
          _limit: PAGE_SIZE,
          _offset: page * PAGE_SIZE,
          _only_unread: onlyUnread,
        });
        if (error) throw error;
        setRows((data || []) as RevocationRow[]);
      } catch (e: any) {
        toast.error("Falha ao carregar revogações", { description: e?.message?.slice?.(0, 160) });
      } finally {
        setFetching(false);
      }
    },
    [isAdmin, page, onlyUnread],
  );

  useEffect(() => { void load(); }, [load]);

  const markRead = async (ids: string[]) => {
    try {
      const { error } = await (supabase as any).rpc("mark_consent_revocations_read", { _ids: ids });
      if (error) throw error;
      toast.success(`${ids.length} marcada${ids.length > 1 ? "s" : ""} como lida${ids.length > 1 ? "s" : ""}.`);
      void load();
    } catch (e: any) {
      toast.error("Falha ao marcar como lidas", { description: e?.message?.slice?.(0, 160) });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Acesso restrito.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldOff className="h-6 w-6 text-destructive" />
            Revogações de consentimento
          </h1>
          <p className="text-sm text-muted-foreground">
            Eventos em que usuários (ou anônimos) revogaram permissões de
            <strong> marketing</strong>, <strong>analytics</strong> ou <strong>funcionais</strong>.
            Use para auditoria LGPD e ajuste de campanhas.
          </p>
        </header>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={onlyUnread ? "default" : "outline"}
            onClick={() => { setPage(0); setOnlyUnread((v) => !v); }}
          >
            {onlyUnread ? "Mostrando: não lidas" : "Mostrando: todas"}
          </Button>
          {rows.some((r) => !r.read_by_admin) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => markRead(rows.filter((r) => !r.read_by_admin).map((r) => r.id))}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar todas como lidas
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {fetching ? (
            <div className="px-4 py-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-600" />
              Nenhuma revogação {onlyUnread ? "não lida " : ""}registrada.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-3 text-sm space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="font-medium truncate">
                        {r.user_email || (r.user_id ? `User ${r.user_id.slice(0, 8)}…` : "Anônimo")}
                      </span>
                      {!r.read_by_admin && (
                        <Badge variant="destructive" className="text-[10px]">novo</Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      v{r.version} · {r.source} · {formatDateTime(r.created_at)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(r.revoked_categories || []).map((cat) => (
                      <Badge key={cat} variant="outline" className="text-[11px]">
                        <MailX className="h-3 w-3 mr-1" /> revogou {cat}
                      </Badge>
                    ))}
                  </div>
                  {!r.read_by_admin && (
                    <div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => markRead([r.id])}
                      >
                        Marcar como lida
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-muted/30">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 0 || fetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages} · {total} registro{total === 1 ? "" : "s"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= total || fetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminConsentRevocationsPage;
