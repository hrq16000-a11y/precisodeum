import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fallback list used only while DB data loads
const FALLBACK_SERVICES = [
  'eletricista', 'encanador', 'pedreiro', 'pintor',
  'marido de aluguel', 'instalador de ar-condicionado', 'jardineiro',
  'marceneiro', 'serralheiro', 'gesseiro', 'azulejista', 'desentupidor',
  'chaveiro', 'vidraceiro', 'carpinteiro', 'mecânico', 'personal trainer',
  'fotógrafo', 'designer gráfico', 'professor particular', 'cuidador de idosos',
  'veterinário', 'nutricionista', 'contador',
  'advogado', 'arquiteto', 'engenheiro civil', 'técnico em celular',
  'montador de móveis', 'tapeceiro', 'dedetizador', 'piscineiro',
  'eletricista automotivo', 'soldador', 'técnico em informática',
  'profissional de beleza', 'motorista particular', 'profissional de limpeza',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface RotatingServiceTextProps {
  onServiceChange?: (service: string) => void;
}

const RotatingServiceText = ({ onServiceChange }: RotatingServiceTextProps) => {
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
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Notify parent whenever the displayed service changes
  useEffect(() => {
    if (shuffled.length > 0) {
      onServiceChange?.(shuffled[index]);
    }
  }, [index, shuffled]); // eslint-disable-line react-hooks/exhaustive-deps

  const rotate = useCallback(() => {
    setPhase('out');
    timerRef.current = setTimeout(() => {
      setIndex((prev) => (prev + 1) % shuffled.length);
      setPhase('in');
    }, 400);
  }, [shuffled]);

  useEffect(() => {
    const id = setInterval(rotate, 4000);
    return () => {
      clearInterval(id);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [rotate]);

  return (
    <>
      <span
        className="relative inline-block w-full max-w-full min-w-0 text-left align-bottom"
        style={{ minHeight: '1.2em' }}
      >
        <span
          className="text-secondary inline-block sm:whitespace-nowrap transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] break-words"
          style={{
            opacity: phase === 'in' ? 1 : 0,
            transform: phase === 'in' ? 'translateY(0)' : 'translateY(-20px)',
          }}
        >
          {shuffled[index]}
        </span>
        <span
          className="absolute -bottom-1 left-0 h-1 rounded-full bg-secondary/60 transition-[width] duration-500 ease-out"
          style={{
            width: phase === 'in' ? '100%' : '0%',
            transitionDelay: phase === 'in' ? '200ms' : '0ms',
          }}
        />
      </span>

      {/* Hidden SEO block — single string to reduce DOM nodes */}
      <span className="sr-only" aria-hidden="false">
        {serviceList.join(', ')}
      </span>
    </>
  );
};

export default RotatingServiceText;
