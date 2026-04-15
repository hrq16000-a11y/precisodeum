import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CategoryIcon from '@/components/CategoryIcon';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import { fetchAllMunicipalities, geocodeCity, normalize, type CityResult } from '@/lib/geoUtils';
import { Search, Loader2, MapPin } from 'lucide-react';
import PhoneMaskedInput from '@/components/PhoneMaskedInput';
import { sanitizePhone } from '@/lib/whatsapp';

interface Props {
  provider: any;
  onClose: () => void;
  onSaved: () => void;
}

const ProviderEditDialog = ({ provider, onClose, onSaved }: Props) => {
  const [form, setForm] = useState({
    business_name: provider.business_name || '',
    city: provider.city || '',
    state: provider.state || '',
    neighborhood: provider.neighborhood || '',
    cnpj: provider.cnpj || '',
    phone: provider.phone || '',
    whatsapp: provider.whatsapp || '',
    description: provider.description || '',
    category_id: provider.category_id || '',
    website: provider.website || '',
    working_hours: provider.working_hours || '',
    years_experience: provider.years_experience || 0,
    latitude: provider.latitude ?? null as number | null,
    longitude: provider.longitude ?? null as number | null,
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // City autocomplete
  const [citySearch, setCitySearch] = useState(
    provider.city ? (provider.state ? `${provider.city}, ${provider.state}` : provider.city) : ''
  );
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [allCities, setAllCities] = useState<CityResult[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('categories').select('id, name, icon').is('deleted_at', null).order('name')
      .then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) setShowCitySuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadCities = useCallback(() => {
    if (allCities.length > 0) return;
    setCitiesLoading(true);
    fetchAllMunicipalities().then((cities) => { setAllCities(cities); setCitiesLoading(false); });
  }, [allCities.length]);

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return allCities.slice(0, 10);
    const q = normalize(citySearch);
    const terms = q.split(/\s+/).filter(Boolean);
    return allCities.filter(c => {
      const cn = normalize(c.name);
      const sn = normalize(c.state);
      return terms.every(t => cn.includes(t) || sn.includes(t));
    }).slice(0, 10);
  }, [citySearch, allCities]);

  const handleCitySelect = async (c: CityResult) => {
    setForm(prev => ({ ...prev, city: c.name, state: c.state }));
    setCitySearch(`${c.name}, ${c.state}`);
    setShowCitySuggestions(false);
    const { latitude, longitude } = await geocodeCity(c.name, c.state);
    setForm(prev => ({ ...prev, latitude, longitude }));
  };

  // Phone → WhatsApp auto-sync
  const handlePhoneChange = useCallback((name: string, rawValue: string) => {
    setForm(prev => {
      const next = { ...prev, [name]: rawValue };
      if (name === 'phone' && (!prev.whatsapp || prev.whatsapp === prev.phone)) {
        next.whatsapp = rawValue;
      }
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!form.city || !form.state) { toast.error('Selecione uma cidade válida'); return; }
    setSaving(true);
    const { error } = await supabase.from('providers').update({
      business_name: form.business_name || null,
      city: form.city,
      state: form.state,
      neighborhood: form.neighborhood,
      cnpj: form.cnpj || null,
      phone: sanitizePhone(form.phone),
      whatsapp: sanitizePhone(form.whatsapp),
      description: form.description,
      category_id: form.category_id || null,
      website: form.website || null,
      working_hours: form.working_hours || null,
      years_experience: Number(form.years_experience) || 0,
      latitude: form.latitude,
      longitude: form.longitude,
    }).eq('id', provider.id);

    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'update', resource_type: 'provider', resource_id: provider.id });
      toast.success('Prestador atualizado!');
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Prestador</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome Fantasia</Label>
              <Input value={form.business_name} onChange={e => update('business_name', e.target.value)} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={e => update('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
          </div>

          {/* City autocomplete */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative" ref={cityDropdownRef}>
              <Label>Cidade</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={citySearch}
                  onChange={e => { setCitySearch(e.target.value); setShowCitySuggestions(true); loadCities(); }}
                  onFocus={() => { setShowCitySuggestions(true); loadCities(); }}
                  placeholder="Buscar cidade..."
                  className="pl-8"
                />
              </div>
              {showCitySuggestions && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {citiesLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...</div>
                  ) : filteredCities.length > 0 ? (
                    filteredCities.map((c, i) => (
                      <button key={`${c.name}-${c.state}-${i}`} type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex items-center gap-2"
                        onClick={() => handleCitySelect(c)}>
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span>{c.name}</span>
                        <span className="text-muted-foreground text-xs ml-auto">{c.state}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma cidade encontrada</p>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={form.state} readOnly className="bg-muted" />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <PhoneMaskedInput
                name="phone"
                value={form.phone}
                onChange={handlePhoneChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <PhoneMaskedInput
                name="whatsapp"
                value={form.whatsapp}
                onChange={handlePhoneChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Auto-preenchido do Telefone se vazio</p>
            </div>
          </div>

          <div>
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={v => update('category_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-1.5">
                      <CategoryIcon icon={c.icon} size={14} /> {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={e => update('website', e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Experiência (anos)</Label>
              <Input type="number" value={form.years_experience} onChange={e => update('years_experience', e.target.value)} min={0} />
            </div>
          </div>

          <div>
            <Label>Horário de Funcionamento</Label>
            <Input value={form.working_hours} onChange={e => update('working_hours', e.target.value)} placeholder="Seg-Sex 8h-18h" />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProviderEditDialog;
