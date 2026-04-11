import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fallback list used only while DB data loads
const FALLBACK_SERVICES = [
  'técnico em informática', 'eletricista', 'encanador', 'pedreiro', 'pintor',
  'marido de aluguel', 'instalador de ar-condicionado', 'diarista', 'jardineiro',
  'marceneiro', 'serralheiro', 'gesseiro', 'azulejista', 'desentupidor',
  'chaveiro', 'vidraceiro', 'carpinteiro', 'mecânico', 'personal trainer',
  'fotógrafo', 'designer gráfico', 'professor particular', 'cuidador de idosos',
  'babá', 'pet sitter', 'veterinário', 'nutricionista', 'contador',
  'advogado', 'arquiteto', 'engenheiro civil', 'técnico em celular',
  'montador de móveis', 'tapeceiro', 'dedetizador', 'piscineiro',
  'eletricista automotivo', 'soldador', 'cozinheiro particular', 'costureira',
  'manicure', 'cabeleireiro', 'maquiador', 'motorista particular', 'frete e mudança',
];

type AnimationType = 'fade' | 'slideUp' | 'typing';
type MotionProps = { opacity?: number; y?: number; width?: number | string };

const animations: Record<AnimationType, { initial: MotionProps; animate: MotionProps; exit: MotionProps }> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -24 },
  },
  typing: {
    initial: { opacity: 0, width: 0 },
    animate: { opacity: 1, width: 'auto' },
    exit: { opacity: 0, width: 0 },
  },
};

const ANIMATION_TYPES: AnimationType[] = ['fade', 'slideUp', 'typing'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const RotatingServiceText = () => {
  // Pull service names from popular_services table (admin-managed)
  const { data: dbServices } = useQuery({
    queryKey: ['rotating-service-names'],
    queryFn: async () => {
      const { data } = await supabase
        .from('popular_services')
        .select('name')
        .eq('active', true)
        .order('display_order');
      return (data || []).map((s: any) => s.name.toLowerCase());
    },
    staleTime: 1000 * 60 * 10,
  });

  const serviceList = dbServices && dbServices.length > 0 ? dbServices : FALLBACK_SERVICES;
  const shuffled = useMemo(() => shuffle(serviceList), [serviceList]);

  const [index, setIndex] = useState(0);
  const [animType, setAnimType] = useState<AnimationType>(() =>
    ANIMATION_TYPES[Math.floor(Math.random() * ANIMATION_TYPES.length)]
  );

  const rotate = useCallback(() => {
    setIndex((prev) => (prev + 1) % shuffled.length);
    setAnimType(ANIMATION_TYPES[Math.floor(Math.random() * ANIMATION_TYPES.length)]);
  }, [shuffled.length]);

  useEffect(() => {
    const id = setInterval(rotate, 2500);
    return () => clearInterval(id);
  }, [rotate]);

  const anim = animations[animType];

  return (
    <>
      <span className="relative inline-block min-w-[180px] sm:min-w-[260px] text-left align-bottom" style={{ height: '1.2em' }}>
        <AnimatePresence mode="wait">
          <motion.span
            key={`${index}-${animType}`}
            initial={anim.initial}
            animate={anim.animate}
            exit={anim.exit}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="text-secondary inline-block whitespace-nowrap"
          >
            {shuffled[index]}
          </motion.span>
        </AnimatePresence>
        <motion.span
          className="absolute -bottom-1 left-0 h-1 rounded-full bg-secondary/60"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
          key={index}
        />
      </span>

      {/* Hidden SEO block with all services */}
      <span className="sr-only" aria-hidden="false">
        {serviceList.map((s) => (
          <span key={s}>{s}, </span>
        ))}
      </span>
    </>
  );
};

export default RotatingServiceText;
