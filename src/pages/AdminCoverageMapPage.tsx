import { useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Search, Loader2, Target } from 'lucide-react';
import { toast } from 'sonner';
import CoverageSearchStatsWidget from '@/components/admin/CoverageSearchStatsWidget';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface NearbyRow {
  id: string;
  slug: string;
  business_name: string;
  category_name: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  distance_m: number;
  service_radius?: number | null;
}

const RecenterMap = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom); }, [center, zoom, map]);
  return null;
};

const AdminCoverageMapPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [lat, setLat] = useState<string>('-25.5163');
  const [lng, setLng] = useState<string>('-49.2003');
  const [radiusKm, setRadiusKm] = useState<string>('15');
  const [category, setCategory] = useState<string>('');
  const [results, setResults] = useState<NearbyRow[]>([]);
  const [searching, setSearching] = useState(false);

  const center = useMemo<[number, number]>(() => {
    const la = Number(lat); const lo = Number(lng);
    return [Number.isFinite(la) ? la : -15.79, Number.isFinite(lo) ? lo : -47.88];
  }, [lat, lng]);

  const radiusMeters = Math.max(1, Number(radiusKm) || 0) * 1000;

  const runSearch = async () => {
    setSearching(true);
    try {
      const { data, error } = await supabase.rpc('nearby_providers', {
        _lat: center[0],
        _lng: center[1],
        _radius_m: radiusMeters,
        _category_slug: category || null,
        _limit: 200,
      });
      if (error) throw error;
      // join service_radius from providers
      const ids = (data || []).map((r: any) => r.id);
      let radiusMap: Record<string, number | null> = {};
      if (ids.length) {
        const { data: extra } = await supabase
          .from('providers').select('id, service_radius').in('id', ids);
        radiusMap = Object.fromEntries((extra || []).map((p: any) => [p.id, p.service_radius]));
      }
      const merged = (data || []).map((r: any) => ({ ...r, service_radius: radiusMap[r.id] ?? null })) as NearbyRow[];
      setResults(merged);
      toast.success(`${merged.length} profissionais encontrados em ${radiusKm} km`);
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || e));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => { if (isAdmin) runSearch(); /* eslint-disable-next-line */ }, [isAdmin]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error('Geolocalização indisponível');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(String(pos.coords.latitude)); setLng(String(pos.coords.longitude)); },
      () => toast.error('Não foi possível obter sua localização'),
    );
  };

  if (loading) return <AdminLayout><div className="animate-pulse h-96 bg-muted rounded-2xl" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mapa de Cobertura</h1>
            <p className="text-sm text-muted-foreground">Visualize profissionais e raios de atendimento usando geog/geom (PostGIS)</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Parâmetros de busca</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div><Label className="text-xs">Latitude</Label><Input value={lat} onChange={(e) => setLat(e.target.value)} /></div>
            <div><Label className="text-xs">Longitude</Label><Input value={lng} onChange={(e) => setLng(e.target.value)} /></div>
            <div><Label className="text-xs">Raio (km)</Label><Input type="number" min={1} value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} /></div>
            <div><Label className="text-xs">Categoria (slug, opcional)</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ex: eletricista" /></div>
            <div className="flex items-end gap-2">
              <Button onClick={runSearch} disabled={searching} className="flex-1 gap-2">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
              </Button>
              <Button variant="outline" onClick={useMyLocation} title="Usar minha localização"><Target className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl overflow-hidden border border-border" style={{ height: 560 }}>
            <MapContainer center={center} zoom={11} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
              <RecenterMap center={center} zoom={11} />
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Circle center={center} radius={radiusMeters} pathOptions={{ color: 'hsl(var(--primary))', fillOpacity: 0.08 }} />
              {results.map((r) => (
                <div key={r.id}>
                  <Marker position={[Number(r.latitude), Number(r.longitude)]}>
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold">{r.business_name}</div>
                        <div className="text-muted-foreground text-xs">{r.category_name || '—'}</div>
                        <div className="text-xs mt-1">{r.city}{r.state ? ` - ${r.state}` : ''}</div>
                        <div className="text-xs">Distância: {(r.distance_m / 1000).toFixed(1)} km</div>
                        {r.service_radius ? <div className="text-xs">Cobertura: {r.service_radius} km</div> : null}
                      </div>
                    </Popup>
                  </Marker>
                  {r.service_radius ? (
                    <Circle
                      center={[Number(r.latitude), Number(r.longitude)]}
                      radius={Number(r.service_radius) * 1000}
                      pathOptions={{ color: 'hsl(var(--accent))', weight: 1, fillOpacity: 0.04 }}
                    />
                  ) : null}
                </div>
              ))}
            </MapContainer>
          </div>

          <Card className="lg:col-span-1">
            <CardHeader className="pb-2"><CardTitle className="text-base">Resultados ({results.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[520px] overflow-auto">
              {results.length === 0 && <p className="text-xs text-muted-foreground">Nenhum profissional no raio.</p>}
              {results.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-2 text-sm hover:bg-muted/40">
                  <div className="font-semibold text-foreground">{r.business_name}</div>
                  <div className="text-xs text-muted-foreground">{r.category_name || '—'} · {r.city}{r.state ? `/${r.state}` : ''}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {(r.distance_m / 1000).toFixed(1)} km {r.service_radius ? `· cobre ${r.service_radius} km` : ''}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <CoverageSearchStatsWidget />
      </div>
    </AdminLayout>
  );
};

export default AdminCoverageMapPage;
