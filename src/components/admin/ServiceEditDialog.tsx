import { useState, useEffect } from 'react';
import { Save, Zap, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import SmartCategoryPicker from '@/components/SmartCategoryPicker';

interface ServiceEditDialogProps {
  service: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const ServiceEditDialog = ({ service, onClose, onSaved }: ServiceEditDialogProps) => {
  const [form, setForm] = useState({
    service_name: '',
    description: '',
    price: '',
    whatsapp: '',
    service_area: '',
    working_hours: '',
    address: '',
    category_id: '',
    provider_id: '',
    instagram_url: '',
    facebook_url: '',
    youtube_url: '',
  });
  const [isEmergency, setIsEmergency] = useState(false);
  const [serviceRadius, setServiceRadius] = useState('city');
  const [seoTags, setSeoTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (service) {
      setForm({
        service_name: service.service_name || '',
        description: service.description || '',
        price: service.price || '',
        whatsapp: service.whatsapp || '',
        service_area: service.service_area || '',
        working_hours: service.working_hours || '',
        address: service.address || '',
        category_id: service.category_id || '',
        provider_id: service.provider_id || '',
        instagram_url: service.instagram_url || '',
        facebook_url: service.facebook_url || '',
        youtube_url: service.youtube_url || '',
      });
      setIsEmergency(service.is_emergency || false);
      setServiceRadius(service.service_radius || 'city');
      setSeoTags(service.seo_tags || []);
      setTagInput('');
    }
  }, [service]);

  useEffect(() => {
    supabase.from('categories').select('id, name').is('deleted_at', null).order('name')
      .then(({ data }) => setCategories(data || []));
    supabase.from('providers').select('id, business_name').eq('status', 'approved').order('business_name')
      .then(({ data }) => setProviders(data || []));
  }, []);

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (!tag || seoTags.includes(tag)) { setTagInput(''); return; }
    if (seoTags.length >= 10) { toast.error('Máximo de 10 tags'); return; }
    setSeoTags(prev => [...prev, tag]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setSeoTags(prev => prev.filter(t => t !== tag));

  const handleSave = async () => {
    if (!service) return;
    setSaving(true);

    const updateData: any = {
      service_name: form.service_name,
      description: form.description,
      price: form.price,
      whatsapp: form.whatsapp,
      service_area: form.service_area,
      working_hours: form.working_hours,
      address: form.address,
      provider_id: form.provider_id,
      instagram_url: form.instagram_url,
      facebook_url: form.facebook_url,
      youtube_url: form.youtube_url,
      is_emergency: isEmergency,
      service_radius: serviceRadius,
      seo_tags: seoTags,
    };
    if (form.category_id) updateData.category_id = form.category_id;

    const { error } = await supabase.from('services').update(updateData).eq('id', service.id);
    setSaving(false);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      await logAuditAction({
        action: 'update',
        resource_type: 'service',
        resource_id: service.id,
        details: { changes: { ...form, is_emergency: isEmergency, service_radius: serviceRadius, seo_tags: seoTags } },
      });
      toast.success('Serviço atualizado!');
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog open={!!service} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Serviço</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label>Nome do serviço</Label>
            <Input value={form.service_name} onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preço</Label>
              <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="A partir de R$ ..." />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Área de atuação</Label>
              <Input value={form.service_area} onChange={e => setForm(f => ({ ...f, service_area: e.target.value }))} />
            </div>
            <div>
              <Label>Horário</Label>
              <Input value={form.working_hours} onChange={e => setForm(f => ({ ...f, working_hours: e.target.value }))} />
            </div>
          </div>

          {/* ── New: Radius & Emergency ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Raio de Atendimento</Label>
              <Select value={serviceRadius} onValueChange={setServiceRadius}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">No local</SelectItem>
                  <SelectItem value="city">Toda a cidade</SelectItem>
                  <SelectItem value="metro">Região Metropolitana</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> Emergência 24h</Label>
              <div className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 ${isEmergency ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-muted/50'}`}>
                <Switch checked={isEmergency} onCheckedChange={setIsEmergency} />
                <span className="text-xs text-muted-foreground">{isEmergency ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
          </div>

          {/* ── New: SEO Tags ── */}
          <div>
            <Label className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Tags / Palavras-chave</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Ex: reformas, elétrica"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>+</Button>
            </div>
            {seoTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {seoTags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-0.5 text-xs font-medium">
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Instagram</Label>
            <Input value={form.instagram_url} onChange={e => setForm(f => ({ ...f, instagram_url: e.target.value }))} placeholder="https://instagram.com/..." />
          </div>
          <div>
            <Label>Facebook</Label>
            <Input value={form.facebook_url} onChange={e => setForm(f => ({ ...f, facebook_url: e.target.value }))} placeholder="https://facebook.com/..." />
          </div>
          <div>
            <Label>YouTube</Label>
            <Input value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <SmartCategoryPicker
                categories={categories}
                selectedIds={form.category_id ? [form.category_id] : []}
                onToggle={(id) => setForm(f => ({ ...f, category_id: f.category_id === id ? '' : id }))}
                maxSelections={1}
              />
            </div>
            <div>
              <Label>Prestador (reatribuir)</Label>
              <Select value={form.provider_id} onValueChange={v => setForm(f => ({ ...f, provider_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {providers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.business_name || p.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceEditDialog;
