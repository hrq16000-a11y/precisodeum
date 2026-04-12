import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RouteSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRouteReady: (corridor: RouteCorridor) => void;
}

export interface RouteCorridor {
  homeLat: number;
  homeLon: number;
  workLat: number;
  workLon: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  midLat: number;
  midLon: number;
}

const CORRIDOR_KM = 3;
const KM_TO_DEG = 1 / 111;

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Brasil')}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export function isInsideCorridor(lat: number, lon: number, corridor: RouteCorridor): boolean {
  return lat >= corridor.minLat && lat <= corridor.maxLat && lon >= corridor.minLon && lon <= corridor.maxLon;
}

const RouteSearchModal = ({ open, onOpenChange, onRouteReady }: RouteSearchModalProps) => {
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!homeAddress.trim() || !workAddress.trim()) {
      toast.error('Preencha os dois endereços.');
      return;
    }
    setLoading(true);
    try {
      const [home, work] = await Promise.all([
        geocodeAddress(homeAddress),
        geocodeAddress(workAddress),
      ]);
      if (!home) { toast.error('Não foi possível encontrar o endereço de Casa.'); return; }
      if (!work) { toast.error('Não foi possível encontrar o endereço de Trabalho.'); return; }

      const expand = CORRIDOR_KM * KM_TO_DEG;
      const corridor: RouteCorridor = {
        homeLat: home.lat, homeLon: home.lon,
        workLat: work.lat, workLon: work.lon,
        minLat: Math.min(home.lat, work.lat) - expand,
        maxLat: Math.max(home.lat, work.lat) + expand,
        minLon: Math.min(home.lon, work.lon) - expand,
        maxLon: Math.max(home.lon, work.lon) + expand,
        midLat: (home.lat + work.lat) / 2,
        midLon: (home.lon + work.lon) / 2,
      };
      onRouteReady(corridor);
      onOpenChange(false);
      toast.success('Mostrando profissionais no seu trajeto Casa → Trabalho!');
    } catch {
      toast.error('Erro ao buscar endereços. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [homeAddress, workAddress, onRouteReady, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-accent" />
            Buscar no Caminho Casa → Trabalho
          </DialogTitle>
          <DialogDescription>
            Encontre profissionais no trajeto entre dois endereços. Ideal para agendar serviços no caminho!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-emerald-500" /> Endereço de Casa
            </Label>
            <Input
              className="mt-1"
              placeholder="Ex: Rua das Flores 123, São Paulo"
              value={homeAddress}
              onChange={e => setHomeAddress(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" /> Endereço do Trabalho
            </Label>
            <Input
              className="mt-1"
              placeholder="Ex: Av. Paulista 1000, São Paulo"
              value={workAddress}
              onChange={e => setWorkAddress(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button onClick={handleSearch} disabled={loading} className="w-full" variant="accent">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Navigation className="h-4 w-4 mr-2" />}
            {loading ? 'Buscando endereços...' : 'Buscar Profissionais no Trajeto'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteSearchModal;
