import 'leaflet/dist/leaflet.css';
import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Star, Circle, Phone, Clock } from 'lucide-react';
import { whatsappLink } from '@/lib/whatsapp';
import type { DbProvider } from '@/hooks/useProviders';
import { Link } from '@/lib/router-compat';

// Fix default marker icon issue with webpack/vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Marker colorido (CSS) por status — sem novos assets
const buildIcon = (color: string, pulse = false) =>
  L.divIcon({
    className: 'custom-provider-marker',
    html: `
      <span style="
        position: relative;
        display: block;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      ">
        ${pulse ? `<span style="
          position: absolute; inset: -4px;
          border-radius: 50%;
          border: 2px solid ${color};
          opacity: 0.6;
          animation: pdu-pulse 1.6s infinite;
        "></span>` : ''}
      </span>
      <style>
        @keyframes pdu-pulse {
          0%   { transform: scale(0.85); opacity: 0.7; }
          70%  { transform: scale(1.6);  opacity: 0;   }
          100% { transform: scale(1.6);  opacity: 0;   }
        }
      </style>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10],
  });

interface ProvidersMapProps {
  providers: DbProvider[];
  userLat?: number | null;
  userLon?: number | null;
  className?: string;
  /** Conjunto de userIds online em tempo real — pinta o marker em verde com pulso. */
  onlineSet?: Set<string>;
  /** Conjunto de userIds com sinal de "Ativo hoje" — pinta o marker em âmbar. */
  activeTodaySet?: Set<string>;
}

const ProvidersMap = ({
  providers,
  userLat,
  userLon,
  className = '',
  onlineSet,
  activeTodaySet,
}: ProvidersMapProps) => {
  const mappable = useMemo(
    () => providers.filter((p) => p.latitude != null && p.longitude != null),
    [providers]
  );

  const center = useMemo<[number, number]>(() => {
    if (userLat != null && userLon != null) return [userLat, userLon];
    if (mappable.length > 0) return [mappable[0].latitude!, mappable[0].longitude!];
    return [-15.79, -47.88]; // Brasília fallback
  }, [userLat, userLon, mappable]);

  const zoom = userLat != null ? 12 : 5;

  const onlineIcon = useMemo(() => buildIcon('#10b981', true), []);
  const activeTodayIcon = useMemo(() => buildIcon('#f59e0b'), []);
  const defaultIcon = useMemo(() => buildIcon('hsl(var(--primary))'), []);

  if (mappable.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-muted/50 p-8 text-center">
        <div>
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Nenhum profissional com localização disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-border shadow-card ${className}`}>
      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/80 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" /> Online agora
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Circle className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Ativo hoje
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Circle className="h-2.5 w-2.5 fill-primary text-primary" /> Cadastrado
        </span>
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '60vh', minHeight: '320px', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mappable.map((p) => {
          const isOnline = onlineSet?.has(p.userId);
          const isActiveToday = !isOnline && activeTodaySet?.has(p.userId);
          const icon = isOnline ? onlineIcon : isActiveToday ? activeTodayIcon : defaultIcon;
          return (
            <Marker key={p.id} position={[p.latitude!, p.longitude!]} icon={icon}>
              <Popup maxWidth={280} minWidth={220}>
                <div className="space-y-1.5 text-sm">
                  <p className="font-bold text-foreground leading-tight">
                    {p.name || p.businessName || 'Profissional'}
                  </p>
                  {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                  {(isOnline || isActiveToday) && (
                    <p className={`flex items-center gap-1 text-[11px] font-semibold ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
                      <Clock className="h-3 w-3" />
                      {isOnline ? 'Trabalhando agora' : 'Ativo nas últimas 24h'}
                    </p>
                  )}
                  {p.distanceKm != null && (
                    <p className="text-xs font-medium text-primary">
                      {p.distanceKm < 1 ? '< 1' : p.distanceKm.toFixed(1)} km de você
                    </p>
                  )}
                  {p.rating > 0 && (
                    <p className="text-xs flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      {p.rating.toFixed(1)} ({p.reviewCount})
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/50 mt-1.5">
                    {p.whatsapp && (
                      <a
                        href={whatsappLink(p.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-green-700"
                      >
                        WhatsApp
                      </a>
                    )}
                    {(p.phone || p.whatsapp) && (
                      <a
                        href={`tel:${(p.phone || p.whatsapp).replace(/\D/g, '')}`}
                        className="inline-flex items-center gap-1 rounded bg-foreground px-2 py-1 text-[11px] font-medium text-background hover:opacity-90"
                      >
                        <Phone className="h-3 w-3" /> Ligar
                      </a>
                    )}
                    <Link
                      to={`/profissional/${p.slug}`}
                      className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Ver Perfil
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default ProvidersMap;
