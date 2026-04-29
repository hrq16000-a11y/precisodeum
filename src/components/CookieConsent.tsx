import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
    const current = getConsent();
    if (!current) {
      setVisible(true);
    } else {
      setPrefs({
        functional: current.functional,
        analytics: current.analytics,
        marketing: current.marketing,
      });
    }
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

  const handleAcceptAll = () => close(acceptAll());
  const handleRejectAll = () => close(rejectAll());
  const handleSavePrefs = () => close(saveConsent(prefs));

  if (!visible && !openPrefs) return null;

  return (
    <>
      {visible && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Consentimento de cookies"
          className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-border bg-card/95 p-4 shadow-lg backdrop-blur-lg"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}
        >
          <div className="container flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Sua privacidade importa</p>
              <p className="mt-1">
                Usamos cookies essenciais para o funcionamento do site e, com seu consentimento,
                cookies funcionais, analíticos e de marketing. Você pode escolher por categoria.
                Saiba mais na{" "}
                <Link to="/cookies" className="font-medium text-accent hover:underline">
                  Política de Cookies
                </Link>{" "}
                e na{" "}
                <Link to="/privacidade" className="font-medium text-accent hover:underline">
                  Política de Privacidade
                </Link>
                .
              </p>
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
              Escolha quais categorias deseja permitir. Você pode alterar a qualquer momento em{" "}
              <Link to="/cookies" className="text-accent hover:underline">
                /cookies
              </Link>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <CategoryRow
              title="Essenciais"
              description="Necessários para autenticação, segurança e funcionamento básico. Não podem ser desativados."
              checked
              disabled
            />
            <CategoryRow
              title="Funcionais"
              description="Lembram preferências como cidade detectada, idioma e tema."
              checked={prefs.functional}
              onChange={(v) => setPrefs((p) => ({ ...p, functional: v }))}
            />
            <CategoryRow
              title="Analíticos"
              description="Nos ajudam a entender o uso da plataforma de forma agregada e anônima."
              checked={prefs.analytics}
              onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
            />
            <CategoryRow
              title="Marketing"
              description="Permitem mensurar campanhas e exibir conteúdo de patrocinadores relevantes."
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
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
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
