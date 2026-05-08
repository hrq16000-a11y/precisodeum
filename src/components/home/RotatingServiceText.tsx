import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * HeroRotator — frases com nexo e animação sutil.
 *
 * Cada ciclo mostra a MESMA categoria com dois prefixos em sequência,
 * preservando sentido: "Preciso de um pintor" → "Encontre um pintor!".
 * Os termos vêm de categorias compatíveis com esse formato gramatical.
 *
 * - Sem glitch. Apenas fade + slide curto (CSS, GPU friendly).
 * - Mobile: quebra elegante em duas linhas; desktop: frase corrida.
 * - Notifica o pai a cada troca de termo para sincronizar background.
 */

type HeroCategory = {
  slug: string;
  label: string;
  article: 'um' | 'uma';
};

const HERO_CATEGORY_POOL: HeroCategory[] = [
  { slug: 'eletricista', label: 'eletricista', article: 'um' },
  { slug: 'encanador', label: 'encanador', article: 'um' },
  { slug: 'pintor', label: 'pintor', article: 'um' },
  { slug: 'pedreiro', label: 'pedreiro', article: 'um' },
  { slug: 'carpinteiro', label: 'carpinteiro', article: 'um' },
  { slug: 'gesseiro', label: 'gesseiro', article: 'um' },
  { slug: 'azulejista', label: 'azulejista', article: 'um' },
  { slug: 'marceneiro', label: 'marceneiro', article: 'um' },
  { slug: 'serralheiro', label: 'serralheiro', article: 'um' },
  { slug: 'chaveiro', label: 'chaveiro', article: 'um' },
  { slug: 'jardineiro', label: 'jardineiro', article: 'um' },
  { slug: 'cabeleireiro', label: 'cabeleireiro', article: 'um' },
  { slug: 'barbeiro', label: 'barbeiro', article: 'um' },
  { slug: 'babá', label: 'babá', article: 'uma' },
  { slug: 'baba', label: 'babá', article: 'uma' },
  { slug: 'cuidador-de-idosos', label: 'cuidador de idosos', article: 'um' },
  { slug: 'designer-grafico', label: 'designer gráfico', article: 'um' },
  { slug: 'fotografo', label: 'fotógrafo', article: 'um' },
  { slug: 'advogado', label: 'advogado', article: 'um' },
  { slug: 'contador', label: 'contador', article: 'um' },
  { slug: 'arquiteto', label: 'arquiteto', article: 'um' },
  { slug: 'mecanico', label: 'mecânico', article: 'um' },
  { slug: 'técnico-em-informática', label: 'técnico em informática', article: 'um' },
  { slug: 'tecnico-em-informatica', label: 'técnico em informática', article: 'um' },
];

const HERO_CATEGORY_BY_SLUG = new Map(HERO_CATEGORY_POOL.map((item) => [item.slug, item]));

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleCategories(categories: HeroCategory[], avoidSlug?: string) {
  const shuffled = shuffle(categories);
  if (avoidSlug && shuffled.length > 1 && shuffled[0]?.slug === avoidSlug) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled;
}

interface Props {
  onServiceChange?: (service: string) => void;
}

const HOLD_MS = 2600; // tempo de leitura por frase
const FADE_MS = 420;  // duração do crossfade

const RotatingServiceText = ({ onServiceChange }: Props) => {
  const { data: dbCategories } = useQuery({
    queryKey: ['hero-rotating-categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('slug')
        .in('slug', HERO_CATEGORY_POOL.map((item) => item.slug))
        .is('deleted_at', null);

      const mapped = (data || [])
        .map((item: { slug: string | null }) => (item.slug ? HERO_CATEGORY_BY_SLUG.get(item.slug) : null))
        .filter((item): item is HeroCategory => Boolean(item));

      const deduped = mapped.filter((item, index, arr) => arr.findIndex((entry) => entry.label === item.label) === index);
      return deduped;
    },
    staleTime: 1000 * 60 * 10,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const categories = dbCategories && dbCategories.length > 0 ? dbCategories : HERO_CATEGORY_POOL;

  const orderRef = useRef<HeroCategory[]>(shuffleCategories(categories));

  const [serviceIdx, setServiceIdx] = useState(0);
  const [prefixIdx, setPrefixIdx] = useState(0);

  useEffect(() => {
    const currentSlug = orderRef.current[serviceIdx]?.slug;
    orderRef.current = shuffleCategories(categories, currentSlug);
    setServiceIdx(0);
    setPrefixIdx(0);
  }, [categories]);

  useEffect(() => {
    onServiceChange?.(orderRef.current[serviceIdx]?.label ?? 'eletricista');
  }, [serviceIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => {
      setPrefixIdx((p) => {
        if (p === 0) return 1;
        setServiceIdx((idx) => {
          const next = idx + 1;
          if (next >= orderRef.current.length) {
            const last = orderRef.current[orderRef.current.length - 1]?.slug;
            orderRef.current = shuffleCategories(categories, last);
            return 0;
          }
          return next;
        });
        return 0;
      });
    }, HOLD_MS);

    return () => clearTimeout(timer);
  }, [serviceIdx, prefixIdx, categories]);

  const current = orderRef.current[serviceIdx] ?? HERO_CATEGORY_POOL[0];
  const prefix = prefixIdx === 0 ? `Preciso de ${current.article}` : `Encontre ${current.article}`;
  const service = current.label;
  const isCallout = prefixIdx === 1;

  // Key muda a cada troca → reinicia animação CSS de cada palavra.
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
        {prefix}
      </span>
      <span
        key={`service-${animKey}`}
        className="animate-hero-service text-secondary"
      >
        {service}
        {isCallout ? '!' : ''}
      </span>
    </span>
  );
};

export default RotatingServiceText;
