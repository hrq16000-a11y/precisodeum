import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  acceptAll,
  rejectAll,
  saveConsent,
  getConsent,
  hydrateConsentFromServer,
  type ConsentState,
} from "@/lib/cookieConsent";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [openPrefs, setOpenPrefs] = useState(false);
  const [prefs, setPrefs] = useState({
    functional: false,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const current = getConsent();
      if (current) {
        setPrefs({
          functional: current.functional,
          analytics: current.analytics,
          marketing: current.marketing,
        });
        return;
      }
      // Tenta restaurar do servidor (logado em outro device/depois de limpeza
      // de cache). Se houver log anterior, NÃO mostramos o banner novamente.
      const restored = await hydrateConsentFromServer();
      if (cancelled) return;
      if (restored) {
        setPrefs({
          functional: restored.functional,
          analytics: restored.analytics,
          marketing: restored.marketing,
        });
        return;
      }
      setVisible(true);
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const close = (state: ConsentState) => {
    setPrefs({
      functional: state.functional,
      analytics: state.analytics,
      marketing: state.marketing,
    });
    setVisible(false);
    setOpenPrefs(false);
  };

  const handleAcceptAll = () => close(acceptAll("banner"));
  const handleRejectAll = () => close(rejectAll("banner"));
  const handleSavePrefs = () => close(saveConsent(prefs, "banner"));

  if (!visible && !openPrefs) return null;

  return (
    <>
      {visible && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Consentimento de cookies e privacidade"
          className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-border/50 bg-background/70 p-4 shadow-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}
        >
          <div className="container flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-3 text-sm text-muted-foreground lg:max-w-2xl">
              <div className="hidden shrink-0 items-start pt-1 sm:flex" aria-hidden="true">
                <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
                  <Cookie className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-background p-0.5 text-foreground/80" strokeWidth={1.75} />
                </span>
              </div>
              <div>
                <p className="flex items-center gap-2 font-medium text-foreground sm:gap-0">
                  <ShieldCheck className="h-4 w-4 text-accent sm:hidden" strokeWidth={1.75} />
                  Sua privacidade importa
                </p>
                <p className="mt-1">
                  Usamos cookies essenciais para o funcionamento do site e, com seu consentimento,
                  cookies funcionais, analíticos e de marketing. Você pode escolher por categoria
                  a qualquer momento. O uso da plataforma implica aceitação dos Termos e da
                  Política de Privacidade.
                </p>
                <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                  <li>
                    <strong className="text-foreground">Essenciais:</strong> sempre ativos — login, segurança e roteamento.
                  </li>
                  <li>
                    <strong className="text-foreground">Funcionais:</strong> cidade detectada, tema, suporte offline.
                  </li>
                  <li>
                    <strong className="text-foreground">Analíticos:</strong> métricas agregadas e anônimas de uso.
                  </li>
                  <li>
                    <strong className="text-foreground">Marketing:</strong> mensuração de campanhas e patrocinadores.
                  </li>
                </ul>
                <p className="mt-2 text-xs">
                  Detalhes na{" "}
                  <Link to="/cookies" className="font-medium text-accent hover:underline">
                    Política de Cookies
                  </Link>
                  ,{" "}
                  <Link to="/privacidade" className="font-medium text-accent hover:underline">
                    Política de Privacidade
                  </Link>{" "}
                  e{" "}
                  <Link to="/termos" className="font-medium text-accent hover:underline">
                    Termos de Uso
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpenPrefs(true)}>
                Preferências
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRejectAll}>
                Recusar
              </Button>
              <Button variant="accent" size="sm" onClick={handleAcceptAll}>
                Aceitar todos
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={openPrefs} onOpenChange={setOpenPrefs}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Preferências de cookies</DialogTitle>
            <DialogDescription>
              Escolha quais categorias deseja permitir. As mudanças são aplicadas imediatamente,
              sem precisar recarregar a página. Veja a{" "}
              <Link to="/cookies" className="text-accent hover:underline">
                Política de Cookies
              </Link>{" "}
              completa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <CategoryRow
              title="Essenciais"
              activatesWhenOn="Login, segurança e funcionamento do site"
              deactivatesWhenOff="Não pode ser desativado"
              checked
              disabled
            />
            <CategoryRow
              title="Funcionais"
              activatesWhenOn="Lembrar cidade, tema e rascunhos; suporte offline"
              deactivatesWhenOff="Você precisará reconfigurar preferências a cada visita"
              checked={prefs.functional}
              onChange={(v) => setPrefs((p) => ({ ...p, functional: v }))}
            />
            <CategoryRow
              title="Analíticos"
              activatesWhenOn="Métricas agregadas e anônimas que orientam melhorias"
              deactivatesWhenOff="Sua sessão não conta para estatísticas internas"
              checked={prefs.analytics}
              onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
            />
            <CategoryRow
              title="Marketing"
              activatesWhenOn="Mensuração de campanhas e exibição de patrocinadores relevantes"
              deactivatesWhenOff="Pixels de marketing são bloqueados imediatamente"
              checked={prefs.marketing}
              onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={handleRejectAll}>
              Recusar todos
            </Button>
            <Button variant="outline" onClick={handleSavePrefs}>
              Salvar preferências
            </Button>
            <Button variant="accent" onClick={handleAcceptAll}>
              Aceitar todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

function CategoryRow({
  title,
  activatesWhenOn,
  deactivatesWhenOff,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  activatesWhenOn: string;
  deactivatesWhenOff: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex-1 space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          <strong>Ao ativar:</strong> {activatesWhenOn}
        </p>
        <p className="text-xs text-muted-foreground">
          <strong>Ao desativar:</strong> {deactivatesWhenOff}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={`Ativar categoria ${title}`}
      />
    </div>
  );
}

export default CookieConsent;
