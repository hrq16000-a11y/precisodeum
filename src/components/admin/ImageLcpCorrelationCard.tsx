/**
 * ImageLcpCorrelationCard — cruza falhas/degradações de imagem (AVIF/WebP,
 * srcSet, sizes, blur-up) com picos de LCP por rota, para identificar
 * regressões visuais rapidamente.
 */
import { useMemo } from 'react';
import { AlertTriangle, ImageOff, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMetric, type VitalSample } from '@/lib/webVitals/summary';
import {
  correlateImagesWithLcp,
  imageLcpDaily,
  pearsonImageLcp,
  type CorrelationVerdict,
} from '@/lib/webVitals/imageCorrelation';

const VERDICT_LABEL: Record<CorrelationVerdict, string> = {
  ok: 'Sem sinal',
  suspeita: 'Suspeita',
  provavel_causa: 'Provável causa',
};

const VerdictBadge = ({ verdict }: { verdict: CorrelationVerdict }) => (
  <Badge
    variant={verdict === 'provavel_causa' ? 'destructive' : verdict === 'suspeita' ? 'outline' : 'secondary'}
    className="text-[10px]"
  >
    {VERDICT_LABEL[verdict]}
  </Badge>
);

const ImageLcpCorrelationCard = ({ samples }: { samples: VitalSample[] }) => {
  const rows = useMemo(() => correlateImagesWithLcp(samples, 3).slice(0, 20), [samples]);
  const daily = useMemo(() => imageLcpDaily(samples), [samples]);
  const pearson = useMemo(() => pearsonImageLcp(daily), [daily]);
  const maxLcp = Math.max(1, ...daily.map((d) => d.lcpP75 ?? 0));
  const maxIssues = Math.max(1, ...daily.map((d) => d.errors + d.degraded));

  return (
    <Card className="motion-enter">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <ImageOff className="h-4 w-4 text-muted-foreground" aria-hidden />
          Imagens × LCP
        </CardTitle>
        <CardDescription className="text-xs">
          Cruza falhas de carregamento e imagens fora do contrato (AVIF/WebP, srcSet, sizes,
          blur-up) com o p75 de LCP da mesma visita.
          {pearson !== null && (
            <span className="ml-1 inline-flex items-center gap-1 font-medium text-foreground">
              <TrendingUp className="h-3 w-3" aria-hidden />
              correlação diária {pearson.toFixed(2)}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {daily.length > 0 && (
          <div className="space-y-1.5" aria-label="Série diária de LCP e problemas de imagem">
            {daily.map((d) => (
              <div key={d.day} className="flex items-center gap-2 text-[11px]">
                <span className="w-20 shrink-0 text-muted-foreground">{d.day.slice(5)}</span>
                <div className="flex h-2 flex-1 items-center gap-1">
                  <div
                    className="h-2 rounded-full bg-primary/70 transition-all duration-500"
                    style={{ width: `${((d.lcpP75 ?? 0) / maxLcp) * 100}%` }}
                    title={`LCP p75 ${formatMetric('LCP', d.lcpP75)}`}
                  />
                  <div
                    className="h-2 rounded-full bg-destructive/70 transition-all duration-500"
                    style={{ width: `${((d.errors + d.degraded) / maxIssues) * 60}%` }}
                    title={`${d.errors} erros · ${d.degraded} degradadas`}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-muted-foreground">
                  {formatMetric('LCP', d.lcpP75)}
                </span>
              </div>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sem volume suficiente para correlacionar (mínimo de 3 visitas com LCP por rota).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1.5 text-left font-medium">Rota</th>
                  <th className="py-1.5 text-right font-medium">LCP p75</th>
                  <th className="py-1.5 text-right font-medium">Erros/visita</th>
                  <th className="py-1.5 text-right font-medium">Degradadas/visita</th>
                  <th className="py-1.5 text-right font-medium">Visitas afetadas</th>
                  <th className="py-1.5 text-right font-medium">Δ LCP</th>
                  <th className="py-1.5 text-right font-medium">Diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.route} className="border-b last:border-0">
                    <td className="max-w-[220px] truncate py-1.5 font-mono">{r.route}</td>
                    <td className="py-1.5 text-right">{formatMetric('LCP', r.lcpP75)}</td>
                    <td className="py-1.5 text-right">{r.errorsPerView}</td>
                    <td className="py-1.5 text-right">{r.degradedPerView}</td>
                    <td className="py-1.5 text-right">{r.affectedRate}%</td>
                    <td className="py-1.5 text-right">
                      {r.lcpDeltaMs === null ? '—' : (
                        <span className={r.lcpDeltaMs > 0 ? 'text-destructive' : ''}>
                          {r.lcpDeltaMs > 0 ? '+' : ''}{r.lcpDeltaMs} ms
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      <span className="inline-flex items-center gap-1">
                        {r.verdict === 'provavel_causa' && (
                          <AlertTriangle className="h-3 w-3 text-destructive" aria-hidden />
                        )}
                        <VerdictBadge verdict={r.verdict} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImageLcpCorrelationCard;
