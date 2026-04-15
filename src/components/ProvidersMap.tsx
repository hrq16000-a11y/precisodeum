import 'leaflet/dist/leaflet.css';
import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappLink } from '@/lib/whatsapp';
import type { DbProvider } from '@/hooks/useProviders';
import { Link } from 'react-router-dom';

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

interface ProvidersMapProps {
  providers: DbProvider[];
  userLat?: number | null;
  userLon?: number | null;
  className?: string;
}

const ProvidersMap = ({ providers, userLat, userLon, className = '' }: ProvidersMapProps) => {
  const mappable = useMemo(
    () => providers.filter(p => p.latitude != null && p.longitude != null),
    [providers]
  );

  const center = useMemo<[number, number]>(() => {
    if (userLat != null && userLon != null) return [userLat, userLon];
    if (mappable.length > 0) return [mappable[0].latitude!, mappable[0].longitude!];
    return [-15.79, -47.88]; // Brasília fallback
  }, [userLat, userLon, mappable]);

  const zoom = userLat != null ? 12 : 5;

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
        {mappable.map(p => (
          <Marker key={p.id} position={[p.latitude!, p.longitude!]}>
            <Popup maxWidth={260} minWidth={200}>
              <div className="space-y-1.5 text-sm">
                <p className="font-bold text-foreground leading-tight">{p.name || p.businessName || 'Profissional'}</p>
                {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
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
                <div className="flex gap-1.5 pt-1">
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
        ))}
      </MapContainer>
    </div>
  );
};

export default ProvidersMap;
