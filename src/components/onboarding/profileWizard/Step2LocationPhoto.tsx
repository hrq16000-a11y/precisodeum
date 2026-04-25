import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGeoCity } from '@/hooks/useGeoCity';
import { Step2Location } from '@/components/onboarding/SmartOnboardingWizard';
import type { ProfileWizardData } from './types';

interface Step2LocationPhotoProps {
  data: ProfileWizardData;
  onChange: (patch: Partial<ProfileWizardData>) => void;
  /** Avança para o próximo passo (chamado quando o usuário clica em "Continuar"). */
  onNext: () => void;
  /** Volta ao passo anterior. */
  onBack: () => void;
  /** Permite "pular" a foto/localização. */
  onSkip?: () => void;
  /** Foto vinda do provedor social (Google) — usada para resync. */
  socialAvatarUrl?: string | null;
  /** Dispara validação/auto-save quando algum campo perder o foco. */
  onFieldBlur?: () => void;
}

/**
 * Step 2 do ProfileWizard refatorado — Localização e Foto.
 *
 * Reusa o componente `Step2Location` original do SmartOnboardingWizard
 * para garantir paridade visual e funcional 1:1 (mesmos campos: cidade,
 * estado, avatar; mesma integração com GPS via `useGeoCity`; mesmas
 * mensagens de status).
 *
 * O wrapper conecta as props ao estado central do ProfileWizard e ao
 * usuário autenticado (necessário para upload/sync de foto).
 */
const Step2LocationPhoto = ({
  data,
  onChange,
  onNext,
  onBack,
  onSkip,
  socialAvatarUrl,
  onFieldBlur,
}: Step2LocationPhotoProps) => {
  const { user } = useAuth();
  const [editingCity, setEditingCity] = useState(false);

  const {
    requestingGps,
    requestPreciseGps,
    precise: geoPrecise,
    failed: geoFailed,
    source: geoSource,
    city: geoCity,
    state: geoState,
  } = useGeoCity();

  // Texto de status simples (o original calcula numa memo gigante; aqui
  // mantemos uma versão funcional equivalente).
  const geoStatusText = (() => {
    if (requestingGps) return 'Detectando sua localização precisa via GPS...';
    if (geoPrecise && geoCity) return `Localização precisa ativa: ${geoCity} • ${geoState}`;
    if (geoFailed) return 'Não foi possível obter GPS. Você pode informar a cidade manualmente.';
    if (data.city) return `Cidade definida: ${data.city}${data.state ? ` • ${data.state}` : ''}`;
    return 'Toque em "Usar minha localização" ou edite manualmente.';
  })();

  // Garante UF válida ao alterar cidade (Step2Location original chama
  // onCityChange(city, state)).
  const handleCityChange = (city: string, state?: string) => {
    onChange({
      city: city || '',
      state: state ? state.toUpperCase().slice(0, 2) : data.state,
    });
  };

  const handleAvatarChange = (url: string | null) => {
    onChange({ avatar_url: url });
  };

  const canAdvance = !!data.city && !!data.state;

  return (
    <Step2Location
      city={data.city}
      state={data.state}
      avatarUrl={data.avatar_url}
      editingCity={editingCity}
      onEditCity={() => setEditingCity(true)}
      onCloseEditing={() => setEditingCity(false)}
      onCityChange={handleCityChange}
      onAvatarChange={handleAvatarChange}
      userId={user?.id}
      onBack={onBack}
      onNext={onNext}
      onSkip={onSkip}
      canAdvance={canAdvance}
      onFieldBlur={onFieldBlur ?? (() => {})}
      fullName={data.full_name}
      socialAvatarUrl={socialAvatarUrl ?? null}
      onUsePreciseLocation={requestPreciseGps}
      gpsLoading={requestingGps}
      geoStatusText={geoStatusText}
      geoPrecise={geoPrecise}
      geoFailed={geoFailed}
      geoSource={geoSource}
    />
  );
};

export default Step2LocationPhoto;
