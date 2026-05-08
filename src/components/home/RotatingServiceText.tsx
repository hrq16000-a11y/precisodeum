import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * HeroRotator — duplo encadeado, suave e elegante.
 *
 * Cada ciclo mostra a MESMA palavra de serviço com dois prefixos em
 * sequência, criando narrativa: "Preciso de um pintor" → "Encontre um pintor!".
 * Depois sorteia o próximo serviço (sem repetir até o ciclo terminar).
 *
 * - Sem glitch/scanline. Apenas fade + slide curto (CSS, GPU friendly).
 * - Quebra em duas linhas em telas pequenas (text-balance + break-words).
 * - Notifica o pai a cada troca de serviço para sincronizar background.
 */

const FALLBACK_SERVICES = [
  'eletricista', 'encanador', 'pedreiro', 'pintor', 'gesseiro',
  'marido de aluguel', 'instalador de ar-condicionado', 'jardineiro',
  'marceneiro', 'serralheiro', 'azulejista', 'desentupidor',
  'chaveiro', 'vidraceiro', 'carpinteiro', 'mecânico', 'personal trainer',
  'fotógrafo', 'designer gráfico', 'professor particular', 'cuidador de idosos',
  'veterinário', 'nutricionista', 'contador', 'advogado', 'arquiteto',
  'engenheiro civil', 'técnico em celular', 'montador de móveis',
  'tapeceiro', 'dedetizador', 'piscineiro', 'eletricista automotivo',
  'soldador', 'técnico em informática', 'profissional de beleza',
  'motorista particular', 'profissional de limpeza',
];

const PREFIX_PAIR = ['Preciso de um', 'Encontre um'] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Props {
  onServiceChange?: (service: string) => void;
}

const HOLD_MS = 2600; // tempo de leitura por frase
const FADE_MS = 420;  // duração do crossfade

const RotatingServiceText = ({ onServiceChange }: Props) => {
  const { data: dbServices } = useQuery({
    queryKey: ['rotating-service-names'],
    queryFn: async () => {
      const { data } = await supabase
        .from('popular_services')
        .select('name')
        .eq('active', true)
        .order('display_order');
      return (data || []).map((s: any) => String(s.name).toLowerCase());
    },
    staleTime: 1000 * 60 * 10,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const services = dbServices && dbServices.length > 0 ? dbServices : FALLBACK_SERVICES;

  const orderRef = useRef<string[]>([]);
  if (orderRef.current.length === 0) orderRef.current = shuffle(services);

  const [serviceIdx, setServiceIdx] = useState(0);
  const [prefixIdx, setPrefixIdx] = useState(0); // 0 = "Preciso de um", 1 = "Encontre um"
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    onServiceChange?.(orderRef.current[serviceIdx]);
  }, [serviceIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout>;
    const holdTimer = setTimeout(() => {
      setVisible(false);
      fadeTimer = setTimeout(() => {
        setPrefixIdx((p) => {
          if (p === 0) return 1;
          // Trocou para o próximo serviço — sorteia novamente se acabou.
          setServiceIdx((idx) => {
            const next = idx + 1;
            if (next >= orderRef.current.length) {
              const last = orderRef.current[orderRef.current.length - 1];
              let reshuffled = shuffle(services);
              if (reshuffled[0] === last && reshuffled.length > 1) {
                [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
              }
              orderRef.current = reshuffled;
              return 0;
            }
            return next;
          });
          return 0;
        });
        setVisible(true);
      }, FADE_MS);
    }, HOLD_MS);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(fadeTimer!);
    };
  }, [serviceIdx, prefixIdx, services]);

  const prefix = PREFIX_PAIR[prefixIdx];
  const service = orderRef.current[serviceIdx] ?? '';
  const isCallout = prefixIdx === 1;

  return (
    <span
      className="inline-block w-full max-w-full text-balance"
      aria-live="polite"
    >
      <span
        className="inline-block transition-all ease-out will-change-[opacity,transform]"
        style={{
          transitionDuration: `${FADE_MS}ms`,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-6px)',
        }}
      >
        <span className="text-primary-foreground">{prefix}</span>{' '}
        <span className="text-secondary">
          {service}
          {isCallout ? '!' : ''}
        </span>
      </span>

      {/* SEO — todas as combinações relevantes em uma string compacta */}
      <span className="sr-only">
        {services.slice(0, 12).map((s) => `Preciso de um ${s}. Encontre um ${s}.`).join(' ')}
      </span>
    </span>
  );
};

export default RotatingServiceText;
