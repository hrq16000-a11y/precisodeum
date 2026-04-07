import { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ServiceImageUpload from '@/components/ServiceImageUpload';
import PhoneMaskedInput from '@/components/PhoneMaskedInput';
import {
  ArrowRight, ArrowLeft, Store, Phone, ImagePlus,
  CheckCircle2, Copy, ExternalLink, Share2, Sparkles, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ───── Types ───── */
interface ServiceWizardProps {
  providerId: string;
  userId: string;
  provider: any;
  categories: any[];
  onComplete: (serviceId: string) => void;
  onCancel: () => void;
}

const STEPS = [
  { key: 'identity', label: 'Identidade', icon: Store },
  { key: 'details', label: 'Detalhes', icon: Phone },
  { key: 'photos', label: 'Fotos', icon: ImagePlus },
] as const;

/* ───── Component ───── */
const ServiceWizard = ({ providerId, userId, provider, categories, onComplete, onCancel }: ServiceWizardProps) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [createdServiceId, setCreatedServiceId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Step 1 — Identity
  const [serviceName, setServiceName] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    provider?.category_id ? [provider.category_id] : []
  );
  const [categorySearch, setCategorySearch] = useState('');
  const [showCatDrop, setShowCatDrop] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  // Step 2 — Details (contact + description)
  const [whatsapp, setWhatsapp] = useState(provider?.whatsapp || '');
  const [description, setDescription] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [workingHours, setWorkingHours] = useState(provider?.working_hours || '');
  const [website, setWebsite] = useState(provider?.website || '');

  // Outside click for category dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setShowCatDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredCats = useMemo(() => {
    return categories.filter(c =>
      !selectedCategoryIds.includes(c.id) &&
      (!categorySearch || c.name.toLowerCase().includes(categorySearch.toLowerCase()))
    ).slice(0, 20);
  }, [categories, selectedCategoryIds, categorySearch]);

  const providerCity = provider?.city || '';
  const providerSlug = provider?.slug || '';
  const profileUrl = `${window.location.origin}/profissional/${providerSlug}`;

  const canNext = () => {
    if (step === 0) return serviceName.trim().length > 0;
    return true;
  };

  /* ──── Save service (called when moving from step 2 → step 3) ──── */
  const handleCreate = async (): Promise<boolean> => {
    if (!serviceName.trim()) { toast.error('Nome do serviço é obrigatório'); return false; }
    setSaving(true);

    try {
      const address = [provider?.neighborhood, provider?.city, provider?.state].filter(Boolean).join(', ');
      const { data, error } = await supabase
        .from('services')
        .insert({
          provider_id: providerId,
          service_name: serviceName,
          description,
          whatsapp: whatsapp || provider?.whatsapp || '',
          service_area: serviceArea,
          address,
          working_hours: workingHours,
          website,
        })
        .select('id')
        .single();

      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return false; }

      if (selectedCategoryIds.length > 0 && data) {
        await supabase.from('service_categories').insert(
          selectedCategoryIds.map(catId => ({ service_id: data.id, category_id: catId }))
        );
      }

      setCreatedServiceId(data.id);
      toast.success('Serviço criado! Agora adicione fotos.');
      return true;
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === 1 && !createdServiceId) {
      // Save the service before going to photos
      const ok = await handleCreate();
      if (!ok) return;
    }
    setStep(step + 1);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setLinkCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Confira meu perfil profissional: ${profileUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const isPhotosStep = step === 2;

  /* ──── Wizard ──── */
  return (
    <div className="mx-auto max-w-lg space-y-5 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-accent" />
          <span className="font-display text-sm font-bold text-foreground">Cadastro Express</span>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="text-center">
        <h1 className="font-display text-xl font-bold text-foreground">
          Seu serviço pronto em <span className="text-accent italic">2 minutos</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          3 passos rápidos para criar seu anúncio profissional.
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between text-xs">
        {STEPS.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <button
              key={s.key}
              onClick={() => i < step && !isPhotosStep && setStep(i)}
              disabled={isPhotosStep}
              className={`flex items-center gap-1.5 transition-colors ${active ? 'text-accent font-bold' : done ? 'text-accent/70' : 'text-muted-foreground'} ${i < step && !isPhotosStep ? 'cursor-pointer' : ''}`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-accent text-accent-foreground' : done ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'}`}>
                {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">

            {/* ──── STEP 1: Identity ──── */}
            {step === 0 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <Store className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">Identidade do Serviço</h3>
                    <p className="text-xs text-muted-foreground">Nome, categoria e localização</p>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Nome do Serviço *</label>
                  <Input
                    placeholder="Ex: Assistência Técnica, Pintura Residencial..."
                    value={serviceName}
                    onChange={e => setServiceName(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Category multi-select */}
                <div ref={catRef}>
                  <label className="mb-1 block text-sm font-medium text-foreground">Categoria *</label>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 min-h-[40px]">
                    {selectedCategoryIds.map(catId => {
                      const cat = categories.find((c: any) => c.id === catId);
                      if (!cat) return null;
                      return (
                        <span key={catId} className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                          {cat.icon} {cat.name}
                          <button onClick={() => setSelectedCategoryIds(prev => prev.filter(id => id !== catId))} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                    <div className="relative flex-1 min-w-[120px]">
                      <input
                        value={categorySearch}
                        onChange={e => { setCategorySearch(e.target.value); setShowCatDrop(true); }}
                        onFocus={() => setShowCatDrop(true)}
                        placeholder={selectedCategoryIds.length === 0 ? 'Buscar categoria...' : 'Adicionar...'}
                        className="w-full border-0 bg-transparent px-1 py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                  {showCatDrop && filteredCats.length > 0 && (
                    <div className="relative">
                      <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                        {filteredCats.map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setSelectedCategoryIds(prev => [...prev, c.id]); setCategorySearch(''); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent/10"
                          >
                            <span>{c.icon}</span> {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* City display */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Cidade</label>
                  <Input value={providerCity} readOnly className="bg-muted/50 text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground mt-1">Herdado do seu perfil. Altere em "Editar Perfil".</p>
                </div>
              </>
            )}

            {/* ──── STEP 2: Details (Contact + Description) ──── */}
            {step === 1 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <Phone className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">Detalhes do Serviço</h3>
                    <p className="text-xs text-muted-foreground">Descrição, WhatsApp e horários</p>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">📝 Descrição do serviço</label>
                  <Textarea
                    placeholder="Descreva seus serviços, diferenciais e horário de funcionamento..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">{description.length}/500 caracteres</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">📱 WhatsApp</label>
                  <PhoneMaskedInput
                    name="whatsapp"
                    value={whatsapp}
                    onChange={(_, val) => setWhatsapp(val)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">🗺️ Área de atendimento</label>
                    <Input
                      placeholder="Ex: Zona Sul, Grande SP"
                      value={serviceArea}
                      onChange={e => setServiceArea(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">🕐 Horário</label>
                    <Input
                      placeholder="Ex: Seg-Sex, 8h-18h"
                      value={workingHours}
                      onChange={e => setWorkingHours(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">🌐 Site / Rede Social</label>
                  <Input
                    placeholder="https://instagram.com/sualoja"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* ──── STEP 3: Photos ──── */}
            {step === 2 && createdServiceId && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <ImagePlus className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">Fotos do Serviço</h3>
                    <p className="text-xs text-muted-foreground">Lojas com fotos recebem 3x mais visualizações</p>
                  </div>
                </div>

                <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                  <span><strong>{serviceName}</strong> foi criado com sucesso! Adicione fotos abaixo.</span>
                </div>

                <ServiceImageUpload serviceId={createdServiceId} userId={userId} />
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        {isPhotosStep ? (
          <>
            <Button variant="outline" onClick={() => onComplete(createdServiceId!)}>
              Pular →
            </Button>
            <Button variant="accent" onClick={() => onComplete(createdServiceId!)}>
              Concluir <Sparkles className="h-4 w-4 ml-1" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => step === 0 ? onCancel() : setStep(step - 1)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {step === 0 ? 'Cancelar' : 'Voltar'}
            </Button>

            <Button
              variant="accent"
              disabled={!canNext() || saving}
              onClick={handleNext}
            >
              {saving ? 'Salvando...' : step === 1 ? 'Salvar e adicionar fotos' : 'Próximo'}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </>
        )}
      </div>

      {/* Share section (only on photos step) */}
      {isPhotosStep && createdServiceId && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-card space-y-3">
          <p className="text-sm font-medium text-foreground">🔗 Compartilhe seu perfil</p>
          <div className="flex items-center gap-2">
            <Input value={profileUrl} readOnly className="text-xs flex-1" />
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="h-4 w-4 mr-1" /> {linkCopied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="accent" size="sm" className="flex-1" onClick={handleShareWhatsApp}>
              <Share2 className="h-4 w-4 mr-1" /> WhatsApp
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(profileUrl, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-1" /> Ver loja
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceWizard;
