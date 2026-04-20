import { useEffect, useState } from 'react';
import { Briefcase, Building2, MapPin, Sparkles, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeoCity } from '@/hooks/useGeoCity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SmartCategoryPicker from '@/components/SmartCategoryPicker';
import { useCategoriesWithCount } from '@/hooks/useProviders';

type ProfileType = 'provider' | 'rh' | 'client';

const CATEGORY_ICON_MAP: Record<string, string> = {
  eletricista: 'Zap', eletrica: 'Zap',
  encanador: 'Wrench', hidraulica: 'Wrench', encanamento: 'Wrench',
  pintor: 'Paintbrush', pintura: 'Paintbrush',
  pedreiro: 'Hammer', alvenaria: 'Hammer', construcao: 'Hammer',
  marceneiro: 'Hammer', marcenaria: 'Hammer',
  mecanico: 'Car', automotivo: 'Car',
  diarista: 'Sparkles', limpeza: 'Sparkles', faxina: 'Sparkles',
  cabeleireiro: 'Scissors', barbeiro: 'Scissors',
  jardineiro: 'Briefcase', jardinagem: 'Briefcase',
  frete: 'Truck', mudanca: 'Truck',
  ar: 'Snowflake', refrigeracao: 'Snowflake',
  dedetizador: 'Bug', dedetizacao: 'Bug',
  chaveiro: 'KeyRound',
};

function pickIconForCategory(name?: string | null): string {
  if (!name) return 'Sparkles';
  const norm = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const key of Object.keys(CATEGORY_ICON_MAP)) {
    if (norm.includes(key)) return CATEGORY_ICON_MAP[key];
  }
  return 'Briefcase';
}

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const SmartOnboardingWizard = () => {
  const { user, refetchProfile } = useAuth();
  const { city: geoCity, state: geoState } = useGeoCity();
  const { data: categoriesData = [] } = useCategoriesWithCount();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const [city, setCity] = useState(geoCity || '');
  const [state, setState] = useState(geoState || '');
  const [editingCity, setEditingCity] = useState(false);
  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || ''
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Sync geo
  useEffect(() => {
    if (!editingCity && geoCity && !city) setCity(geoCity);
    if (geoState && !state) setState(geoState);
  }, [geoCity, geoState, editingCity, city, state]);

  const categoriesForPicker = categoriesData.map((c: any) => ({
    id: c.id, name: c.name, icon: c.icon, slug: c.slug, parent_id: c.parent_id,
  }));

  const selectedCategory = categoriesForPicker.find(c => c.id === selectedCategoryIds[0]);

  const handleToggleCategory = (id: string) => {
    setSelectedCategoryIds(prev => prev.includes(id) ? [] : [id]);
  };

  const handleConfirm = async () => {
    if (!user?.id) {
      toast.error('Sessão expirada. Faça login novamente.');
      return;
    }
    if (!profileType) return;
    setSaving(true);
    try {
      // 1. Update profile
      const profileRole = profileType === 'rh' ? 'client' : profileType;
      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          profile_type: profileType,
          role: profileRole,
          full_name: fullName.trim() || undefined,
        } as any)
        .eq('id', user.id);
      if (profErr) throw profErr;

      // 2. Mark metadata
      const { error: metaErr } = await supabase.auth.updateUser({
        data: { profile_type_chosen: true },
      });
      if (metaErr) throw metaErr;

      // 3. If provider/rh → create provider row (must wait for id)
      if (profileType === 'provider' || profileType === 'rh') {
        const { data: existing } = await supabase
          .from('providers')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
        if (!existing || existing.length === 0) {
          const baseSlug = slugify(fullName || user.email?.split('@')[0] || 'profissional');
          const uniqueSlug = `${baseSlug}-${user.id.slice(0, 6)}`;
          const { error: provErr } = await supabase.from('providers').insert({
            user_id: user.id,
            slug: uniqueSlug,
            city: city || null,
            state: state || null,
            category_id: selectedCategoryIds[0] || null,
            status: 'pending',
          });
          if (provErr) throw provErr;
        }
      }

      // 4. Public activity (social proof)
      const firstName = (fullName.trim().split(' ')[0] || 'Mestre');
      const initial = firstName.charAt(0).toUpperCase();
      const alias = profileType === 'rh' ? `Empresa ${firstName}` : `Mestre ${initial}.`;
      const action =
        profileType === 'rh' ? 'acaba de abrir uma agência' : 'acaba de se cadastrar';
      await supabase.from('public_activities').insert({
        actor_alias: alias,
        action_text: action,
        icon: pickIconForCategory(selectedCategory?.name),
        city: city || null,
        profile_type: profileType,
        category_name: selectedCategory?.name || null,
        is_seed: false,
      });

      // 5. Refresh profile context
      await refetchProfile();

      // 6. Party!
      try {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
        setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.5 } }), 250);
      } catch {/* noop */}
      toast.success('Parabéns, Mestre! Você já está na vitrine. 🎉');

      // 7. Redirect
      if (profileType === 'client') navigate('/', { replace: true });
      else if (profileType === 'rh') navigate('/dashboard/vagas?new=1', { replace: true });
      else navigate('/dashboard?wizard=1', { replace: true });
    } catch (err) {
      console.error('[Onboarding]', err);
      toast.error('Não conseguimos salvar. Tente novamente em instantes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Loading overlay (3G safety) */}
      {saving && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-background/90 backdrop-blur-md gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
          <p className="text-base font-bold text-foreground text-center px-6">
            Segura as ferramentas, Mestre!
          </p>
          <p className="text-sm text-muted-foreground text-center px-6 max-w-sm">
            Estamos preparando seu espaço na vitrine...
          </p>
        </div>
      )}

      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300 my-auto">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {[1, 2, 3].map(n => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                step === n ? 'w-8 bg-accent' : step > n ? 'w-4 bg-accent/60' : 'w-4 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* STEP 1 — Identidade */}
        {step === 1 && (
          <>
            <h1 className="text-center font-display text-2xl font-bold text-foreground">
              Bem-vindo, Mestre!
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Como você vai usar a plataforma?
            </p>

            <div className="mt-6 grid gap-3">
              <button
                onClick={() => { setProfileType('provider'); setStep(2); }}
                className="group rounded-2xl border-2 border-accent/30 bg-accent/5 p-5 text-left transition-all hover:border-accent hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Briefcase className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-bold text-foreground">Sou Autônomo</h3>
                    <p className="text-xs text-muted-foreground">Quero divulgar meu serviço</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => { setProfileType('rh'); setStep(2); }}
                className="group rounded-2xl border-2 border-purple-500/30 bg-purple-500/5 p-5 text-left transition-all hover:border-purple-500 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white">
                    <Building2 className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-bold text-foreground">Sou Empresa / RH</h3>
                    <p className="text-xs text-muted-foreground">Publico vagas e recruto</p>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => { setProfileType('client'); setStep(2); }}
              className="mt-6 w-full text-xs text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Só quero contratar um profissional
            </button>
          </>
        )}

        {/* STEP 2 — Geo silenciosa */}
        {step === 2 && (
          <>
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <div className="flex justify-center mb-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                <MapPin className="h-7 w-7 text-accent" />
              </div>
            </div>
            <h1 className="text-center font-display text-xl font-bold text-foreground">
              Onde você atua?
            </h1>

            {!editingCity && city ? (
              <>
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Vimos que você está em
                </p>
                <p className="mt-1 text-center text-2xl font-bold text-accent">
                  {city}{state ? ` • ${state}` : ''}
                </p>
                <p className="mt-2 text-center text-xs text-muted-foreground">Está correto?</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => setEditingCity(true)}>
                    Outra cidade
                  </Button>
                  <Button variant="accent" onClick={() => setStep(3)}>
                    SIM, está certo
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Digite sua cidade e estado:
                </p>
                <div className="mt-4 space-y-2">
                  <Input
                    placeholder="Cidade"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    autoFocus
                  />
                  <Input
                    placeholder="UF (ex: SP, RJ)"
                    value={state}
                    onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))}
                    maxLength={2}
                  />
                </div>
                <Button
                  variant="accent"
                  className="mt-4 w-full"
                  disabled={!city.trim()}
                  onClick={() => { setEditingCity(false); setStep(3); }}
                >
                  Confirmar e continuar
                </Button>
              </>
            )}
          </>
        )}

        {/* STEP 3 — Gancho */}
        {step === 3 && (
          <>
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <div className="flex justify-center mb-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-amber-500 text-white">
                <Sparkles className="h-7 w-7" />
              </div>
            </div>
            <h1 className="text-center font-display text-xl font-bold text-foreground">
              Quase lá!
            </h1>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Só faltam estas informações:
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Seu nome completo
                </label>
                <Input
                  placeholder="Ex: João Silva"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>

              {profileType !== 'client' && (
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    {profileType === 'rh' ? 'Área principal de recrutamento' : 'Sua ferramenta principal'}
                  </label>
                  <SmartCategoryPicker
                    categories={categoriesForPicker}
                    selectedIds={selectedCategoryIds}
                    onToggle={handleToggleCategory}
                    maxSelections={1}
                    placeholder={profileType === 'rh' ? 'Buscar área...' : 'Ex: Eletricista, Pintor...'}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
                <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                <p className="text-xs text-foreground">
                  Você ganhou <span className="font-bold text-accent">+20 pontos de confiança!</span>
                </p>
              </div>
            </div>

            <Button
              variant="accent"
              className="mt-5 w-full"
              disabled={saving || !fullName.trim() || (profileType !== 'client' && selectedCategoryIds.length === 0)}
              onClick={handleConfirm}
            >
              {saving ? 'Salvando...' : 'Entrar na vitrine 🚀'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default SmartOnboardingWizard;
