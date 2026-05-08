import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildPhrase,
  commitHistory,
  pickNextOrder,
  type HeroCategory,
  type HeroCategoryInput,
} from '@/lib/heroPhraseGenerator';

/**
 * HeroRotator — frases com nexo, gênero correto e anti-repetição.
 *
 * - Combina "Preciso de um/uma" → "Encontre um/uma" para a MESMA categoria.
 * - Gênero/artigo definidos pelo gerador (`heroPhraseGenerator`).
 * - Algoritmo de cooldown evita repetir categorias entre visitas/ciclos.
 * - Animação CSS sutil (sem glitch), GPU friendly.
 */

const HERO_CATEGORY_POOL: HeroCategoryInput[] = [
  { slug: 'eletricista', label: 'eletricista', gender: 'm' },
  { slug: 'encanador', label: 'encanador' },
  { slug: 'pintor', label: 'pintor' },
  { slug: 'pedreiro', label: 'pedreiro' },
  { slug: 'carpinteiro', label: 'carpinteiro' },
  { slug: 'gesseiro', label: 'gesseiro' },
  { slug: 'azulejista', label: 'azulejista', gender: 'm' },
  { slug: 'marceneiro', label: 'marceneiro' },
  { slug: 'serralheiro', label: 'serralheiro' },
  { slug: 'chaveiro', label: 'chaveiro' },
  { slug: 'jardineiro', label: 'jardineiro' },
  { slug: 'cabeleireiro', label: 'cabeleireiro' },
  { slug: 'barbeiro', label: 'barbeiro' },
  { slug: 'baba', label: 'babá', gender: 'f' },
  { slug: 'cuidador-de-idosos', label: 'cuidador de idosos' },
  { slug: 'designer-grafico', label: 'designer gráfico', gender: 'm' },
  { slug: 'fotografo', label: 'fotógrafo' },
  { slug: 'advogado', label: 'advogado' },
  { slug: 'contador', label: 'contador' },
  { slug: 'arquiteto', label: 'arquiteto' },
  { slug: 'mecanico', label: 'mecânico' },
  { slug: 'tecnico-em-informatica', label: 'técnico em informática' },
  { slug: 'diarista', label: 'diarista', gender: 'f' },
  { slug: 'manicure', label: 'manicure', gender: 'f' },
];

const POOL_SLUGS = HERO_CATEGORY_POOL.map((c) => c.slug);
const POOL_BY_SLUG = new Map(HERO_CATEGORY_POOL.map((c) => [c.slug, c]));

interface Props {
  onServiceChange?: (service: string) => void;
}

const HOLD_MS = 2600;
const FADE_MS = 420;

const RotatingServiceText = ({ onServiceChange }: Props) => {
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

      // Dedup por label
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

  const orderRef = useRef<HeroCategory[]>([]);
  if (orderRef.current.length === 0) {
    const { order, nextHistory } = pickNextOrder(categories);
    orderRef.current = order;
    commitHistory(nextHistory);
  }

  const [serviceIdx, setServiceIdx] = useState(0);
  const [prefixIdx, setPrefixIdx] = useState<0 | 1>(0);

  // Quando a lista do banco muda, recalcula uma nova ordem com cooldown.
  useEffect(() => {
    const { order, nextHistory } = pickNextOrder(categories);
    if (order.length === 0) return;
    orderRef.current = order;
    commitHistory(nextHistory);
    setServiceIdx(0);
    setPrefixIdx(0);
  }, [categories]);

  useEffect(() => {
    const label = orderRef.current[serviceIdx]?.label ?? 'eletricista';
    onServiceChange?.(label);
  }, [serviceIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => {
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

  const current = orderRef.current[serviceIdx];
  if (!current) return null;

  const phrase = buildPhrase(current, prefixIdx === 0 ? 'need' : 'find');
  const animKey = `${serviceIdx}-${prefixIdx}`;

  return (
    <span
      className="inline-flex flex-nowrap items-baseline justify-center gap-x-[0.35em] w-full max-w-full whitespace-nowrap"
      aria-live="polite"
    >
      <span
        key={`prefix-${animKey}`}
        className="animate-hero-prefix text-primary-foreground"
      >
        {phrase.prefix}
      </span>
      <span
        key={`service-${animKey}`}
        className="animate-hero-service text-secondary"
      >
        {phrase.service}
        {phrase.isCallout ? '!' : ''}
      </span>
    </span>
  );
};

export default RotatingServiceText;

export { FADE_MS, HOLD_MS };
