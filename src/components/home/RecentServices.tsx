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

const RecentServices = ({ services }: Props) => (
  <section className="bg-muted/50 py-10">
    <div className="container">
      <div className="mb-8 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
          Serviços Recentes na Plataforma
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Últimos serviços cadastrados por profissionais
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => {
          const location = s.provider?.city
            ? `${s.provider.city} - ${s.provider.state}`
            : s.service_area || 'Brasil';

          return (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-sm font-semibold text-foreground leading-tight">{s.service_name}</p>
                <p className="truncate text-xs text-muted-foreground">{location}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

export default RecentServices;
