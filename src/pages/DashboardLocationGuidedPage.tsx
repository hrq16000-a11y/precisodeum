/**
 * DashboardLocationGuidedPage — Fluxo guiado de 3 passos para completar
 * Cidade/UF → Bairro → GPS, com geocoding assistido e confirmação final.
 *
 * Acessível a partir do checklist do dashboard e do banner de cadastro
 * incompleto. Também serve como "etapa opcional pós-onboarding" para
 * quem fechou o wizard sem cidade ou sem coordenadas.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, MapPin, Navigation, Building2, Sparkles } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { geocodeAddress } from '@/lib/geocodeAddress';
import { normalizeProviderPayload } from '@/lib/providerPayload';

type Step = 1 | 2 | 3 | 4;

export default function DashboardLocationGuidedPage() {
  const { provider, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = 'Atualizar localização | Preciso de Um'; }, []);

  // Pré-preenche com dados do provider quando carrega
  useEffect(() => {
    if (!provider) return;
    const p: any = provider;
    setCity((c) => c || p.city || '');
    setState((s) => s || p.state || '');
    setNeighborhood((n) => n || (p.neighborhood_source === 'user' ? p.neighborhood : '') || '');
    setLatitude((l) => l ?? (typeof p.latitude === 'number' ? p.latitude : null));
    setLongitude((l) => l ?? (typeof p.longitude === 'number' ? p.longitude : null));
  }, [provider]);

  const canStep1 = city.trim().length >= 2 && state.trim().length === 2;
  const canStep2 = neighborhood.trim().length >= 2;
  const canStep3 = latitude != null && longitude != null;

  const useGps = () => {
    if (!('geolocation' in navigator)) {
      toast.error('GPS indisponível neste dispositivo.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsLoading(false);
        toast.success('Localização GPS capturada.');
      },
      (err) => {
        setGpsLoading(false);
        toast.error('Não foi possível capturar GPS', {
          description: err.message || 'Verifique a permissão de localização.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const tryGeocodeFromAddress = async () => {
    if (!city || !state) {
      toast.error('Preencha cidade e UF antes.');
      return;
    }
    setGeoLoading(true);
    try {
      const r = await geocodeAddress({
        city, state, neighborhood: neighborhood || null,
      });
      if (r.latitude && r.longitude) {
        setLatitude(r.latitude);
        setLongitude(r.longitude);
        toast.success('Coordenadas estimadas pelo endereço.', {
          description: 'Para precisão máxima, use o GPS.',
        });
      } else {
        toast.warning('Não foi possível geocodificar', {
          description: 'Tente o GPS para localização precisa.',
        });
      }
    } finally {
      setGeoLoading(false);
    }
  };

  const handleSave = async () => {
    if (!provider?.id) return;
    setSaving(true);
    try {
      const payload = normalizeProviderPayload({
        city: city.trim(),
        state: state.trim().toUpperCase(),
        neighborhood: neighborhood.trim(),
        latitude,
        longitude,
      });
      const { error } = await supabase
        .from('providers')
        .update(payload as any)
        .eq('id', provider.id);
      if (error) throw error;
      toast.success('Localização atualizada com sucesso!', {
        description: 'Seu perfil já reflete os novos dados.',
      });
      await refetchProfile?.();
      navigate('/dashboard/auditoria-bairro');
    } catch (e: any) {
      toast.error('Erro ao salvar', { description: e?.message || 'Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const progressPct = useMemo(() => Math.round(((step - 1) / 3) * 100), [step]);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
        <header className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3 w-3" /> Fluxo guiado
          </div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Atualizar minha localização
          </h1>
          <p className="text-sm text-muted-foreground">
            Em 3 passos rápidos você desbloqueia o selo "Atende no seu bairro" e o ranking por proximidade.
          </p>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-2">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </header>

        {/* Passo 1: Cidade/UF */}
        {step === 1 && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="font-bold">Passo 1 — Cidade e estado</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_120px]">
              <div className="space-y-1">
                <Label htmlFor="city">Cidade onde atende</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: Curitiba" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="uf">UF</Label>
                <Input id="uf" value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="PR" maxLength={2} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button disabled={!canStep1} onClick={() => setStep(2)}>
                Próximo <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Passo 2: Bairro */}
        {step === 2 && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="font-bold">Passo 2 — Bairro real</h2>
            </div>
            <div className="space-y-1">
              <Label htmlFor="neigh">Bairro onde você atende</Label>
              <Input id="neigh" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Ex: Batel, Centro, Boa Vista..." />
              <p className="text-xs text-muted-foreground">
                Evite manter "Centro" automático — informe o bairro real para liberar o selo.
              </p>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
              </Button>
              <Button disabled={!canStep2} onClick={() => setStep(3)}>
                Próximo <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Passo 3: GPS */}
        {step === 3 && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              <h2 className="font-bold">Passo 3 — Coordenadas GPS</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Use o GPS do dispositivo (mais preciso) ou estime pelo endereço informado.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={useGps} disabled={gpsLoading} variant="default">
                {gpsLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Navigation className="mr-1.5 h-4 w-4" />}
                Usar meu GPS
              </Button>
              <Button onClick={tryGeocodeFromAddress} disabled={geoLoading} variant="outline">
                {geoLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MapPin className="mr-1.5 h-4 w-4" />}
                Estimar pelo endereço
              </Button>
            </div>
            {canStep3 && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                <p className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Coordenadas capturadas
                </p>
                <p className="text-muted-foreground mt-0.5 font-mono">
                  {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
                </p>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
              </Button>
              <Button disabled={!canStep3} onClick={() => setStep(4)}>
                Revisar <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Passo 4: Confirmação */}
        {step === 4 && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h2 className="font-bold">Confirme e salve</h2>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Cidade / UF</span>
                <strong className="text-foreground">{city}/{state}</strong>
              </li>
              <li className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Bairro</span>
                <strong className="text-foreground">{neighborhood}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">GPS</span>
                <strong className="text-foreground font-mono text-xs">{latitude?.toFixed(5)}, {longitude?.toFixed(5)}</strong>
              </li>
            </ul>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)} disabled={saving}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                Confirmar e salvar
              </Button>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
