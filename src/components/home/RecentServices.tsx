import { useMemo } from 'react';
import { MapPin } from 'lucide-react';

interface RecentService {
  id: string;
  service_name: string;
  service_area: string;
  provider?: { city?: string; state?: string } | null;
}

interface Props {
  services: RecentService[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const RecentServices = ({ services }: Props) => {
  // Show 4 random items max
  const displayed = useMemo(() => shuffle(services).slice(0, 4), [services]);

  if (displayed.length === 0) return null;

  return (
    <section className="bg-muted/50 py-8">
      <div className="container">
        <div className="mb-5 text-center">
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Serviços Recentes
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Últimos serviços cadastrados por profissionais
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {displayed.map((s) => {
            const location = s.provider?.city
              ? `${s.provider.city} - ${s.provider.state}`
              : s.service_area || 'Brasil';

            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-sm font-semibold text-foreground leading-tight break-words line-clamp-1">{s.service_name}</p>
                  <p className="text-[11px] text-muted-foreground break-words">{location}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default RecentServices;
