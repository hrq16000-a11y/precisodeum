import { Link } from 'react-router-dom';
import { BarChart3, ArrowRight, Eye, MessageSquare, Percent } from 'lucide-react';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

interface MetricsPreviewCardProps {
  viewsTotal: number;
  leadsCount: number;
  contactClicks?: number;
}

/**
 * Prévia compacta das métricas exibida na home do Dashboard.
 * Todos os gráficos e widgets detalhados vivem em /dashboard/metricas —
 * este card é apenas um resumo enxuto com link para o painel completo.
 */
const MetricsPreviewCard = ({
  viewsTotal,
  leadsCount,
  contactClicks = 0,
}: MetricsPreviewCardProps) => {
  const conversion = viewsTotal > 0 ? Math.round((leadsCount / viewsTotal) * 100) : 0;

  const items = [
    { icon: Eye, label: 'Visualizações', value: viewsTotal, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { icon: MessageSquare, label: 'Leads', value: leadsCount, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { icon: Percent, label: 'Conversão', value: conversion, suffix: '%', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <Link
      to="/dashboard/metricas"
      className="group block rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-md sm:p-5"
      aria-label="Ver métricas completas"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Suas métricas</h3>
            <p className="text-[11px] text-muted-foreground">Prévia rápida — toque para ver tudo</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
          Ver completo <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.label} className="rounded-xl border border-border/60 bg-background/40 p-2.5 text-center">
              <div className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-md ${it.bg}`}>
                <Icon className={`h-3.5 w-3.5 ${it.color}`} />
              </div>
              <div className="flex items-baseline justify-center gap-0.5">
                <AnimatedCounter value={it.value} className="font-display text-lg font-bold leading-none text-foreground" />
                {it.suffix && <span className="font-display text-xs font-bold text-foreground">{it.suffix}</span>}
              </div>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{it.label}</p>
            </div>
          );
        })}
      </div>

      {contactClicks > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{contactClicks}</span> cliques de contato no período
        </p>
      )}
    </Link>
  );
};

export default MetricsPreviewCard;
