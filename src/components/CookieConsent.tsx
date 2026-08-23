import { useState, useEffect } from "react";
import { Link } from "@/lib/router-compat";
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
          className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-border/50 bg-background/80 px-3 py-2.5 shadow-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
        >
          <div className="container flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 text-xs text-muted-foreground sm:max-w-3xl">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden="true" />
              <p className="leading-snug">
                <span className="font-medium text-foreground">Sua privacidade importa.</span>{" "}
                Usamos cookies essenciais e, com seu consentimento, funcionais, analíticos e de marketing.{" "}
                <Link to="/cookies" className="text-accent hover:underline">Cookies</Link>
                {" · "}
                <Link to="/privacidade" className="text-accent hover:underline">Privacidade</Link>
                {" · "}
                <Link to="/termos" className="text-accent hover:underline">Termos</Link>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setOpenPrefs(true)}>
                Preferências
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={handleRejectAll}>
                Recusar
              </Button>
              <Button variant="accent" size="sm" className="h-8 px-3 text-xs" onClick={handleAcceptAll}>
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
