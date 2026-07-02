import { memo, useMemo } from 'react';

interface StateData {
  uf: string;
  providers: number;
}

interface Props {
  stateStats: StateData[];
  onStateClick: (uf: string) => void;
  highlightState?: string | null;
}

// Simplified Brazil SVG paths per state (geographic approximation)
const STATE_PATHS: Record<string, { d: string; cx: number; cy: number }> = {
  AC: { d: 'M95,280 L120,275 L125,295 L100,300Z', cx: 110, cy: 288 },
  AM: { d: 'M110,220 L200,200 L210,250 L190,270 L130,280 L105,260Z', cx: 160, cy: 240 },
  RR: { d: 'M170,160 L200,155 L210,185 L185,195 L165,185Z', cx: 188, cy: 175 },
  AP: { d: 'M260,175 L285,165 L290,195 L265,200Z', cx: 275, cy: 183 },
  PA: { d: 'M210,195 L300,190 L310,240 L280,270 L220,265 L200,240Z', cx: 255, cy: 230 },
  MA: { d: 'M300,230 L340,220 L350,260 L310,265Z', cx: 325, cy: 243 },
  PI: { d: 'M330,260 L355,250 L365,300 L340,310Z', cx: 348, cy: 280 },
  CE: { d: 'M360,235 L390,230 L395,260 L370,265Z', cx: 378, cy: 248 },
  RN: { d: 'M395,245 L415,240 L418,258 L398,260Z', cx: 407, cy: 250 },
  PB: { d: 'M395,260 L420,258 L422,275 L398,278Z', cx: 408, cy: 268 },
  PE: { d: 'M375,278 L425,275 L428,295 L378,298Z', cx: 400, cy: 286 },
  AL: { d: 'M400,298 L425,295 L428,310 L403,313Z', cx: 414, cy: 304 },
  SE: { d: 'M395,313 L415,310 L418,325 L398,328Z', cx: 407, cy: 319 },
  BA: { d: 'M310,270 L395,265 L400,330 L380,370 L310,360 L300,310Z', cx: 350, cy: 315 },
  TO: { d: 'M270,265 L310,260 L315,330 L275,335Z', cx: 292, cy: 298 },
  GO: { d: 'M265,335 L320,330 L330,380 L275,385Z', cx: 298, cy: 358 },
  DF: { d: 'M305,355 L318,352 L320,365 L307,368Z', cx: 312, cy: 360 },
  MT: { d: 'M180,280 L265,270 L270,340 L235,370 L175,350Z', cx: 223, cy: 310 },
  MS: { d: 'M215,370 L270,365 L280,420 L235,435 L210,410Z', cx: 248, cy: 398 },
  MG: { d: 'M310,350 L385,345 L395,410 L340,420 L305,395Z', cx: 350, cy: 380 },
  ES: { d: 'M395,380 L420,375 L425,405 L400,410Z', cx: 410, cy: 393 },
  RJ: { d: 'M365,415 L400,410 L405,435 L370,440Z', cx: 385, cy: 425 },
  SP: { d: 'M280,395 L360,390 L370,430 L320,445 L275,430Z', cx: 320, cy: 415 },
  PR: { d: 'M255,430 L325,425 L335,460 L260,465Z', cx: 293, cy: 448 },
  SC: { d: 'M280,465 L330,460 L338,488 L285,493Z', cx: 308, cy: 477 },
  RS: { d: 'M260,490 L325,485 L330,540 L280,550 L255,520Z', cx: 293, cy: 515 },
  RO: { d: 'M130,280 L185,275 L190,325 L145,330Z', cx: 160, cy: 303 },
};

const getColor = (count: number, isHighlight: boolean) => {
  if (isHighlight) return 'hsl(25 95% 53%)'; // accent
  if (count === 0) return 'hsl(210 20% 90%)';
  if (count < 5) return 'hsl(215 50% 70%)';
  if (count < 20) return 'hsl(215 65% 55%)';
  if (count < 50) return 'hsl(215 75% 40%)';
  return 'hsl(215 80% 25%)';
};

const BrazilMapSVG = memo(({ stateStats, onStateClick, highlightState }: Props) => {
  const statsMap = useMemo(() => {
    const m = new Map<string, number>();
    stateStats.forEach(s => m.set(s.uf, s.providers));
    return m;
  }, [stateStats]);

  return (
    <svg viewBox="80 140 370 430" className="w-full max-w-md mx-auto" role="img" aria-label="Mapa do Brasil por estado">
      {Object.entries(STATE_PATHS).map(([uf, { d, cx, cy }]) => {
        const count = statsMap.get(uf) || 0;
        const isHl = highlightState === uf;
        return (
          <g key={uf} className="cursor-pointer" onClick={() => onStateClick(uf)}>
            <path
              d={d}
              fill={getColor(count, isHl)}
              stroke="hsl(0 0% 100%)"
              strokeWidth={1.5}
              className="transition-all duration-300 hover:brightness-110 hover:scale-[1.03]"
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none select-none"
              fill={count > 10 ? '#fff' : 'hsl(215 40% 20%)'}
              fontSize={10}
              fontWeight={700}
            >
              {uf}
            </text>
            {count > 0 && (
              <text
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none select-none"
                fill={count > 10 ? 'hsl(0 0% 90%)' : 'hsl(215 15% 50%)'}
                fontSize={7}
              >
                {count} prof.
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
});

BrazilMapSVG.displayName = 'BrazilMapSVG';
export default BrazilMapSVG;
