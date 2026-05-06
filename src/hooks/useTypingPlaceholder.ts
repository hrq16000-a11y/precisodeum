import { useState, useEffect, useRef } from 'react';

const SERVICES = [
  'eletricista',
  'encanador',
  'pedreiro',
  'pintor',
  'marido de aluguel',
  'técnico em informática',
  'instalador de ar-condicionado',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useTypingPlaceholder(city: string | null) {
  const [placeholder, setPlaceholder] = useState('');
  const shuffledRef = useRef(shuffle(SERVICES));
  const indexRef = useRef(0);

  useEffect(() => {
    const cityText = city || 'sua cidade';
    let charIdx = 0;
    let deleting = false;
    let pauseTimer: ReturnType<typeof setTimeout> | null = null;
    let frameId: ReturnType<typeof setTimeout> | null = null;

    const getFullText = () => {
      const svc = shuffledRef.current[indexRef.current % shuffledRef.current.length];
      return `Preciso de um ${svc} em ${cityText}`;
    };

    const tick = () => {
      const full = getFullText();

      if (!deleting) {
        charIdx++;
        setPlaceholder(full.slice(0, charIdx));
        if (charIdx >= full.length) {
          // Pause then start deleting
          pauseTimer = setTimeout(() => {
            deleting = true;
            frameId = setTimeout(tick, 40);
          }, 1800);
          return;
        }
        frameId = setTimeout(tick, 55 + Math.random() * 35);
      } else {
        charIdx--;
        setPlaceholder(full.slice(0, charIdx));
        if (charIdx <= 0) {
          deleting = false;
          indexRef.current++;
          // Small pause before next word
          pauseTimer = setTimeout(() => {
            frameId = setTimeout(tick, 55);
          }, 400);
          return;
        }
        frameId = setTimeout(tick, 30);
      }
    };

    frameId = setTimeout(tick, 600);

    return () => {
      if (frameId) clearTimeout(frameId);
      if (pauseTimer) clearTimeout(pauseTimer);
    };
  }, [city]);

  return placeholder;
}
