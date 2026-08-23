import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildPhrase,
  commitHistory,
  markShown,
  pickNextOrder,
  type HeroCategory,
  type HeroCategoryInput,
} from '@/lib/heroPhraseGenerator';

/**
 * HeroRotator — frases com nexo, gênero correto e anti-repetição.
 *
 * - Combina "Preciso de um/uma" → "Encontre um/uma" para a MESMA categoria.
 * - Gênero/artigo definidos pelo gerador (`heroPhraseGenerator`).
 * - Cooldown sincronizado com localStorage a CADA troca de frase, para
 *   variar entre visitas curtas (recarregar/voltar à home).
 * - SSR-safe: gerador usa random determinístico quando window inexistente.
 * - Animação CSS sutil (sem glitch), GPU friendly.
 */

const HERO_CATEGORY_POOL: HeroCategoryInput[] = [
  // Construção / reformas
  { slug: 'eletricista', label: 'eletricista', gender: 'm' },
  { slug: 'encanador', label: 'encanador' },
  { slug: 'pintor', label: 'pintor' },
  { slug: 'pedreiro', label: 'pedreiro' },
  { slug: 'carpinteiro', label: 'carpinteiro' },
  { slug: 'gesseiro', label: 'gesseiro' },
  { slug: 'azulejista', label: 'azulejista', gender: 'm' },
  { slug: 'marceneiro', label: 'marceneiro' },
  { slug: 'serralheiro', label: 'serralheiro' },
  { slug: 'vidraceiro', label: 'vidraceiro' },
  { slug: 'soldador', label: 'soldador' },
  { slug: 'marmorista', label: 'marmorista', gender: 'm' },
  { slug: 'instalador-de-ar-condicionado', label: 'instalador de ar-condicionado' },
  // Casa / serviços domésticos
  { slug: 'chaveiro', label: 'chaveiro' },
  { slug: 'jardineiro', label: 'jardineiro' },
  { slug: 'diarista', label: 'diarista', gender: 'f' },
  { slug: 'passadeira', label: 'passadeira', gender: 'f' },
  { slug: 'baba', label: 'babá', gender: 'f' },
  { slug: 'cuidador-de-idosos', label: 'cuidador de idosos' },
  { slug: 'dog-walker', label: 'dog walker', gender: 'm' },
  { slug: 'adestrador', label: 'adestrador' },
  // Beleza / bem-estar
  { slug: 'cabeleireiro', label: 'cabeleireiro' },
  { slug: 'barbeiro', label: 'barbeiro' },
  { slug: 'manicure', label: 'manicure', gender: 'f' },
  { slug: 'esteticista', label: 'esteticista', gender: 'f' },
  { slug: 'massagista', label: 'massagista', gender: 'f' },
  { slug: 'maquiador', label: 'maquiador' },
  { slug: 'personal-trainer', label: 'personal trainer', gender: 'm' },
  { slug: 'nutricionista', label: 'nutricionista', gender: 'f' },
  // Tech / criativos
  { slug: 'tecnico-em-informatica', label: 'técnico em informática' },
  { slug: 'designer-grafico', label: 'designer gráfico', gender: 'm' },
  { slug: 'fotografo', label: 'fotógrafo' },
  { slug: 'videomaker', label: 'videomaker', gender: 'm' },
  { slug: 'desenvolvedor', label: 'desenvolvedor' },
  // Profissões liberais
  { slug: 'advogado', label: 'advogado' },
  { slug: 'contador', label: 'contador' },
  { slug: 'arquiteto', label: 'arquiteto' },
  { slug: 'engenheiro', label: 'engenheiro' },
  { slug: 'corretor', label: 'corretor' },
  // Auto
  { slug: 'mecanico', label: 'mecânico' },
  { slug: 'eletricista-automotivo', label: 'eletricista automotivo', gender: 'm' },
  { slug: 'guincheiro', label: 'guincheiro' },
  // Eventos
  { slug: 'dj', label: 'DJ', gender: 'm' },
  { slug: 'musico', label: 'músico' },
  { slug: 'buffet', label: 'buffet', gender: 'm' },
  // Outros
  { slug: 'professor-particular', label: 'professor particular' },
  { slug: 'tradutor', label: 'tradutor' },
  { slug: 'costureira', label: 'costureira', gender: 'f' },
];

const POOL_SLUGS = HERO_CATEGORY_POOL.map((c) => c.slug);
const POOL_BY_SLUG = new Map(HERO_CATEGORY_POOL.map((c) => [c.slug, c]));

interface Props {
  onServiceChange?: (service: string) => void;
  /**
   * Notificado a cada troca de frase com a categoria atual e o tipo de
   * prefixo ("need" ou "find"). Usado pelo HeroBanner para registrar
   * analytics da CTA "Buscar profissional" sob a frase visível.
   */
  onPhraseChange?: (info: { slug: string; label: string; prefix: 'need' | 'find' }) => void;
}

const HOLD_MS = 3200;
const FADE_OUT_MS = 700;
const FADE_IN_MS = 900;
const FADE_MS = FADE_OUT_MS + FADE_IN_MS;

const RotatingServiceText = ({ onServiceChange, onPhraseChange }: Props) => {
  const { data: dbCategories } = useQuery({
    queryKey: ['hero-rotating-categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('slug')
        .in('slug', POOL_SLUGS)
        .is('deleted_at', null);

      const mapped = (data || [])
        .map((item: { slug: string | null }) => (item.slug ? POOL_BY_SLUG.get(item.slug) : null))
        .filter((item): item is HeroCategoryInput => Boolean(item));

      const seen = new Set<string>();
      return mapped.filter((c) => {
        if (seen.has(c.label)) return false;
        seen.add(c.label);
        return true;
      });
    },
    staleTime: 1000 * 60 * 10,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const categories = dbCategories && dbCategories.length > 0 ? dbCategories : HERO_CATEGORY_POOL;

  // Primeiro render (SSR + hidratação) usa ordem DETERMINÍSTICA para não
  // gerar mismatch de hidratação. A ordem aleatória é aplicada logo após a
  // montagem pelo effect abaixo (já em ambiente cliente).
  const orderRef = useRef<HeroCategory[]>([]);
  if (orderRef.current.length === 0) {
    orderRef.current = categories.slice(0, 8) as HeroCategory[];
  }


  const [serviceIdx, setServiceIdx] = useState(0);
  const [prefixIdx, setPrefixIdx] = useState<0 | 1>(0);

  // Frase anterior mantida no DOM brevemente para crossfade (fade-out suave).
  const [prevPhrase, setPrevPhrase] = useState<{
    key: string;
    prefix: string;
    service: string;
    isCallout: boolean;
  } | null>(null);

  useEffect(() => {
    const { order, nextHistory } = pickNextOrder(categories);
    if (order.length === 0) return;
    orderRef.current = order;
    commitHistory(nextHistory);
    setServiceIdx(0);
    setPrefixIdx(0);
  }, [categories]);

  useEffect(() => {
    const current = orderRef.current[serviceIdx];
    if (!current) return;
    onServiceChange?.(current.label);
    markShown(current.slug);
  }, [serviceIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const current = orderRef.current[serviceIdx];
    if (!current) return;
    onPhraseChange?.({
      slug: current.slug,
      label: current.label,
      prefix: prefixIdx === 0 ? 'need' : 'find',
    });
  }, [serviceIdx, prefixIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => {
      // captura frase atual para fade-out antes de trocar
      const cur = orderRef.current[serviceIdx];
      if (cur) {
        const ph = buildPhrase(cur, prefixIdx === 0 ? 'need' : 'find');
        setPrevPhrase({
          key: `${serviceIdx}-${prefixIdx}`,
          prefix: ph.prefix,
          service: ph.service,
          isCallout: ph.isCallout,
        });
      }
      setPrefixIdx((p) => {
        if (p === 0) return 1;
        setServiceIdx((idx) => {
          const next = idx + 1;
          if (next >= orderRef.current.length) {
            const { order, nextHistory } = pickNextOrder(categories);
            orderRef.current = order;
            commitHistory(nextHistory);
            return 0;
          }
          return next;
        });
        return 0;
      });
    }, HOLD_MS);

    return () => clearTimeout(timer);
  }, [serviceIdx, prefixIdx, categories]);

  // Limpa frase anterior depois do fade-out terminar
  useEffect(() => {
    if (!prevPhrase) return;
    const t = setTimeout(() => setPrevPhrase(null), FADE_OUT_MS + 80);
    return () => clearTimeout(t);
  }, [prevPhrase]);

  const current = orderRef.current[serviceIdx];
  if (!current) return null;

  const phrase = buildPhrase(current, prefixIdx === 0 ? 'need' : 'find');
  const animKey = `${serviceIdx}-${prefixIdx}`;

  return (
    <span
      data-testid="hero-rotating-text"
      data-current-slug={current.slug}
      data-current-prefix={phrase.prefixKind}
      data-current-article={phrase.category.article}
      className="relative inline-grid place-items-center w-full max-w-full whitespace-nowrap"
      aria-live="polite"
    >
      <span
        key={`cur-${animKey}`}
        style={{ gridArea: '1 / 1' }}
        className="animate-hero-fade-in inline-flex flex-nowrap items-baseline justify-center gap-x-[0.35em] whitespace-nowrap"
      >
        <span className="animate-hero-prefix text-primary-foreground">{phrase.prefix}</span>
        {' '}
        <span className="animate-hero-service text-secondary">
          {phrase.service}
          {phrase.isCallout ? '!' : ''}
        </span>
      </span>
      {prevPhrase && (
        <span
          key={`prev-${prevPhrase.key}`}
          style={{ gridArea: '1 / 1' }}
          aria-hidden="true"
          className="animate-hero-fade-out inline-flex flex-nowrap items-baseline justify-center gap-x-[0.35em] whitespace-nowrap pointer-events-none"
        >
          <span className="text-primary-foreground">{prevPhrase.prefix}</span>
          {' '}
          <span className="text-secondary">
            {prevPhrase.service}
            {prevPhrase.isCallout ? '!' : ''}
          </span>
        </span>
      )}
    </span>
  );
};

export default RotatingServiceText;

export { FADE_MS, FADE_OUT_MS, FADE_IN_MS, HOLD_MS, HERO_CATEGORY_POOL };
