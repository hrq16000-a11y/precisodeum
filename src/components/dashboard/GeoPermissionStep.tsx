/**
 * GeoPermissionStep — passo opcional de permissão de localização do wizard.
 *
 * Comportamento:
 *  • Se já temos `geo.city` (de cache, IP ou GPS) e ele bate com o catálogo IBGE
 *    (validado por `isCatalogedCity`), mostra "Detectamos que você está em X"
 *    e oferece confirmar (1 clique) ou alterar manualmente.
 *  • Se não temos geo, oferece um CTA "Permitir localização precisa" que aciona
 *    GPS via `requestPreciseLocation` e cai para IP em caso de negação.
 *  • Se a cidade detectada NÃO está no catálogo, ocultamos o atalho e instruímos
 *    o usuário a digitar (impede entrada de cidade inválida — kill-switch UI).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, ShieldCheck, Search } from 'lucide-react';
import { isCatalogedCity } from '@/lib/serviceAreaFormat';
import { useGeoCity } from '@/hooks/useGeoCity';
import { toast } from 'sonner';

interface Props {
  catalog: ReadonlyArray<{ value: string; label?: string; state?: string }>;
  onConfirm: (city: string, state: string | null) => void;
  onSkipToManual: () => void;
}

export default function GeoPermissionStep({ catalog, onConfirm, onSkipToManual }: Props) {
  const geo = useGeoCity();
  const [requesting, setRequesting] = useState(false);

  const detectedCity = geo.city || null;
  const detectedState = geo.state || null;
  const cataloged = detectedCity ? isCatalogedCity(detectedCity, catalog) : false;
  const sourceLabel =
    geo.source === 'gps' ? 'GPS preciso'
    : geo.source === 'ip' ? 'localização detectada'
    : geo.source === 'cache' ? 'localização salva anteriormente'
    : geo.source === 'manual' ? 'cidade definida por você'
    : 'localização desconhecida';

  const handleRequestPrecise = async () => {
    setRequesting(true);
    try {
      const res = await geo.requestPreciseLocation({ force: true });
      if (!res.ok) {
        toast.message('Não foi possível obter o GPS.', {
          description: 'Você pode digitar a cidade manualmente abaixo.',
        });
      }
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Vamos validar sua cidade</p>
          <p className="text-xs text-muted-foreground">
            Sua área de atendimento precisa ser uma cidade reconhecida pelo IBGE para que clientes te encontrem nas buscas. Sem isso seu anúncio não aparece.
          </p>
        </div>
      </div>

      {detectedCity && cataloged && (
        <div className="rounded-md border border-accent/40 bg-background p-3 space-y-2">
          <p className="text-sm">
            <MapPin className="h-4 w-4 inline mr-1 text-accent" />
            Detectamos que você está em <strong>{detectedCity}{detectedState ? `/${detectedState}` : ''}</strong>
          </p>
          <p className="text-[11px] text-muted-foreground">Fonte: {sourceLabel}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onConfirm(detectedCity, detectedState)}
              className="h-8"
            >
              Confirmar {detectedCity}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onSkipToManual} className="h-8">
              <Search className="h-3 w-3 mr-1" /> Escolher outra cidade
            </Button>
          </div>
        </div>
      )}

      {detectedCity && !cataloged && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
          <p className="text-xs text-amber-900 dark:text-amber-200">
            Detectamos <strong>{detectedCity}</strong>, mas essa cidade não está no nosso catálogo IBGE. Selecione manualmente a cidade mais próxima.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onSkipToManual} className="h-8">
            <Search className="h-3 w-3 mr-1" /> Buscar cidade no catálogo
          </Button>
        </div>
      )}

      {!detectedCity && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Não conseguimos detectar sua cidade automaticamente.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleRequestPrecise}
              disabled={requesting}
              className="h-8"
            >
              {requesting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <MapPin className="h-3 w-3 mr-1" />}
              Permitir localização precisa
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onSkipToManual} className="h-8">
              <Search className="h-3 w-3 mr-1" /> Digitar manualmente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
