import { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ServiceImageUpload from '@/components/ServiceImageUpload';
import PhoneMaskedInput from '@/components/PhoneMaskedInput';
import {
  ArrowRight, ArrowLeft, Store, Camera, Phone, Upload,
  CheckCircle2, Copy, ExternalLink, Share2, Sparkles, X, Search,
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

/* ───── Hardcoded avatars ───── */
const AVATARS = [
  { id: 'jovem', label: 'Jovem Empreendedor', emoji: '👨‍💼', gender: 'M' },
  { id: 'empresario', label: 'Empresário', emoji: '🧑‍💼', gender: 'M' },
  { id: 'vendedor', label: 'Vendedor', emoji: '🤝', gender: 'M' },
  { id: 'experiente', label: 'Experiente', emoji: '👨‍🔧', gender: 'M' },
  { id: 'consultor', label: 'Consultor', emoji: '💼', gender: 'M' },
  { id: 'corretor', label: 'Corretor', emoji: '🏠', gender: 'M' },
  { id: 'medico', label: 'Médico', emoji: '👨‍⚕️', gender: 'M' },
  { id: 'tech', label: 'Tech', emoji: '💻', gender: 'M' },
  { id: 'construtor', label: 'Construtor', emoji: '👷', gender: 'M' },
  { id: 'agro', label: 'Agro', emoji: '🌾', gender: 'M' },
  { id: 'empreendedora', label: 'Empreendedora', emoji: '👩‍💼', gender: 'F' },
  { id: 'executiva', label: 'Executiva', emoji: '👩‍💻', gender: 'F' },
  { id: 'vendedora', label: 'Vendedora', emoji: '🛍️', gender: 'F' },
  { id: 'consultora', label: 'Consultora', emoji: '📊', gender: 'F' },
  { id: 'educadora', label: 'Educadora', emoji: '👩‍🏫', gender: 'F' },
];

/* ───── Hardcoded cover images by category ───── */
const COVERS = [
  { id: 'tech-1', label: 'Futurista', category: 'Tech', gradient: 'from-violet-600 via-purple-600 to-indigo-800' },
  { id: 'tech-2', label: 'Eletrônicos', category: 'Tech', gradient: 'from-cyan-600 via-blue-600 to-indigo-700' },
  { id: 'tech-3', label: 'Coworking', category: 'Tech', gradient: 'from-slate-700 via-blue-800 to-slate-900' },
  { id: 'servicos-1', label: 'Profissional', category: 'Serviços', gradient: 'from-amber-500 via-orange-500 to-red-500' },
  { id: 'servicos-2', label: 'Oficina', category: 'Serviços', gradient: 'from-stone-600 via-amber-700 to-stone-800' },
  { id: 'servicos-3', label: 'Ferramentas', category: 'Serviços', gradient: 'from-emerald-600 via-teal-600 to-cyan-700' },
  { id: 'gastro-1', label: 'Restaurante', category: 'Gastro', gradient: 'from-red-600 via-orange-500 to-yellow-500' },
  { id: 'gastro-2', label: 'Bebidas', category: 'Gastro', gradient: 'from-pink-500 via-rose-500 to-red-500' },
  { id: 'moda-1', label: 'Boutique', category: 'Moda', gradient: 'from-fuchsia-500 via-pink-500 to-rose-400' },
  { id: 'moda-2', label: 'Ateliê', category: 'Moda', gradient: 'from-violet-400 via-purple-400 to-fuchsia-400' },
  { id: 'saude-1', label: 'Clínica', category: 'Saúde', gradient: 'from-teal-400 via-emerald-400 to-green-500' },
  { id: 'saude-2', label: 'Bem-estar', category: 'Saúde', gradient: 'from-sky-400 via-cyan-400 to-teal-400' },
  { id: 'edu-1', label: 'Educação', category: 'Educação', gradient: 'from-blue-500 via-indigo-500 to-violet-500' },
  { id: 'obras-1', label: 'Construção', category: 'Obras', gradient: 'from-yellow-600 via-amber-600 to-orange-600' },
  { id: 'obras-2', label: 'Reforma', category: 'Obras', gradient: 'from-stone-500 via-zinc-500 to-stone-700' },
  { id: 'eventos-1', label: 'Eventos', category: 'Eventos', gradient: 'from-pink-500 via-purple-500 to-indigo-500' },
  { id: 'veiculos-1', label: 'Veículos', category: 'Veículos', gradient: 'from-gray-700 via-zinc-600 to-gray-800' },
  { id: 'imoveis-1', label: 'Imóveis', category: 'Imóveis', gradient: 'from-emerald-700 via-green-600 to-lime-500' },
  { id: 'agro-1', label: 'Agro', category: 'Agro & Pet', gradient: 'from-lime-600 via-green-600 to-emerald-700' },
  { id: 'agro-2', label: 'Pet', category: 'Agro & Pet', gradient: 'from-amber-400 via-orange-400 to-yellow-400' },
];

const COVER_CATEGORIES = ['Todos', 'Moda', 'Gastro', 'Tech', 'Serviços', 'Veículos', 'Imóveis', 'Saúde', 'Educação', 'Eventos', 'Obras', 'Agro & Pet'];

const STEPS = [
  { key: 'identity', label: 'Identidade', icon: Store },
  { key: 'visual', label: 'Visual', icon: Camera },
  { key: 'contact', label: 'Contato', icon: Phone },
] as const;

/* ───── Component ───── */
const ServiceWizard = ({ providerId, userId, provider, categories, onComplete, onCancel }: ServiceWizardProps) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [createdServiceId, setCreatedServiceId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Step 1 — Identity
  const [serviceName, setServiceName] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    provider?.category_id ? [provider.category_id] : []
  );
  const [categorySearch, setCategorySearch] = useState('');
  const [showCatDrop, setShowCatDrop] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  // Step 2 — Visual
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [avatarFilter, setAvatarFilter] = useState<'Todos' | 'Masculino' | 'Feminino'>('Todos');
  const [selectedCover, setSelectedCover] = useState<string | null>(null);
  const [coverFilter, setCoverFilter] = useState('Todos');

  // Step 3 — Contact
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

  const filteredAvatars = AVATARS.filter(a =>
    avatarFilter === 'Todos' ? true : avatarFilter === 'Masculino' ? a.gender === 'M' : a.gender === 'F'
  );

  const filteredCovers = COVERS.filter(c => coverFilter === 'Todos' || c.category === coverFilter);

  const selectedCatName = useMemo(() => {
    const cat = categories.find(c => selectedCategoryIds.includes(c.id));
    return cat?.name || '';
  }, [categories, selectedCategoryIds]);

  const providerCity = provider?.city || '';
  const providerSlug = provider?.slug || '';
  const profileUrl = `${window.location.origin}/profissional/${providerSlug}`;

  /* ──── Step validation ──── */
  const canNext = () => {
    if (step === 0) return serviceName.trim().length > 0;
    if (step === 1) return true; // visual is optional
    if (step === 2) return true; // contact is optional
    return true;
  };

  /* ──── Save ──── */
  const handleCreate = async () => {
    if (!serviceName.trim()) { toast.error('Nome do serviço é obrigatório'); return; }
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

      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }

      // Save categories
      if (selectedCategoryIds.length > 0 && data) {
        await supabase.from('service_categories').insert(
          selectedCategoryIds.map(catId => ({ service_id: data.id, category_id: catId }))
        );
      }

      setCreatedServiceId(data.id);
      setShowSuccess(true);
      toast.success('Serviço criado com sucesso!');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSaving(false);
    }
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

  const progress = showSuccess ? 100 : ((step + 1) / STEPS.length) * 100;

  /* ──── Success Screen ──── */
  if (showSuccess && createdServiceId) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-4">
        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: '100%' }} />
        </div>

        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <Sparkles className="h-8 w-8 text-accent" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">Tudo pronto! 🚀</h2>
          <p className="text-muted-foreground text-sm">
            <strong>{serviceName}</strong> foi publicado. Agora adicione fotos para atrair mais clientes!
          </p>
        </div>

        {/* Photo upload */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <ServiceImageUpload serviceId={createdServiceId} userId={userId} />
        </div>

        {/* Share link */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
          <p className="text-sm font-medium text-foreground">Link da sua loja</p>
          <div className="flex items-center gap-2">
            <Input value={profileUrl} readOnly className="text-xs flex-1" />
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="h-4 w-4 mr-1" /> {linkCopied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="accent" className="flex-1" onClick={handleShareWhatsApp}>
              <Share2 className="h-4 w-4 mr-1" /> Compartilhar no WhatsApp
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => window.open(profileUrl, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-1" /> Ver minha loja
            </Button>
          </div>
        </div>

        <Button variant="accent" className="w-full" onClick={() => onComplete(createdServiceId)}>
          Ir para o Painel da Loja →
        </Button>
      </div>
    );
  }

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
          {step + 1} passos rápidos para criar seu anúncio profissional.
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
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <button
              key={s.key}
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-1.5 transition-colors ${active ? 'text-accent font-bold' : done ? 'text-accent/70 cursor-pointer' : 'text-muted-foreground'}`}
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

            {/* ──── STEP 2: Visual ──── */}
            {step === 1 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <Camera className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">Visual do Serviço</h3>
                    <p className="text-xs text-muted-foreground">Capa premium + ícone</p>
                  </div>
                </div>

                {/* Preview card */}
                <div className={`relative rounded-lg overflow-hidden h-24 ${selectedCover ? '' : 'bg-muted'}`}>
                  {selectedCover && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${COVERS.find(c => c.id === selectedCover)?.gradient || 'from-primary to-accent'}`} />
                  )}
                  <div className="absolute inset-0 flex items-end p-3">
                    <div className="flex items-center gap-2">
                      {selectedAvatar ? (
                        <span className="text-3xl">{AVATARS.find(a => a.id === selectedAvatar)?.emoji || '🔧'}</span>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-background/80 flex items-center justify-center">
                          <Store className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-white drop-shadow">{serviceName || 'Meu Serviço'}</p>
                        <p className="text-[11px] text-white/80 drop-shadow">📍 {providerCity || 'Sua cidade'}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">👁 Preview ao vivo — como seus clientes verão</p>

                {/* Avatar selector */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Ícone do serviço</p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-muted-foreground">Filtrar:</span>
                    {(['Todos', 'Masculino', 'Feminino'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setAvatarFilter(f)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${avatarFilter === f ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {filteredAvatars.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAvatar(selectedAvatar === a.id ? null : a.id)}
                        className={`relative flex flex-col items-center gap-1 rounded-lg p-2 transition-all ${selectedAvatar === a.id ? 'ring-2 ring-accent bg-accent/10 scale-105' : 'hover:bg-muted/50'}`}
                      >
                        <span className="text-2xl">{a.emoji}</span>
                        <span className="text-[9px] text-muted-foreground text-center leading-tight">{a.label}</span>
                        {selectedAvatar === a.id && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground">
                            <CheckCircle2 className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cover selector */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    Escolha uma capa premium ({COVERS.length} opções)
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {COVER_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCoverFilter(cat)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${coverFilter === cat ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {filteredCovers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCover(selectedCover === c.id ? null : c.id)}
                        className={`relative rounded-lg overflow-hidden h-20 transition-all ${selectedCover === c.id ? 'ring-2 ring-accent scale-[1.02]' : 'hover:scale-[1.01]'}`}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-r ${c.gradient}`} />
                        <div className="absolute bottom-1.5 left-2">
                          <p className="text-xs font-bold text-white drop-shadow">{c.label}</p>
                          <p className="text-[9px] text-white/70">{c.category}</p>
                        </div>
                        {selectedCover === c.id && (
                          <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ──── STEP 3: Contact ──── */}
            {step === 2 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <Phone className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">Contato & Detalhes</h3>
                    <p className="text-xs text-muted-foreground">WhatsApp e informações adicionais</p>
                  </div>
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

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">📝 Descrição do serviço</label>
                  <Textarea
                    placeholder="Descreva seus produtos, serviços, diferenciais e horário de funcionamento..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">{description.length}/500 caracteres — mínimo recomendado: 50</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">🗺️ Área de atendimento</label>
                    <Input
                      placeholder="Ex: Zona Sul, Grande São Paulo"
                      value={serviceArea}
                      onChange={e => setServiceArea(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">🕐 Horário</label>
                    <Input
                      placeholder="Ex: Seg a Sex, 8h às 18h"
                      value={workingHours}
                      onChange={e => setWorkingHours(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">🌐 Link de Rede Social</label>
                  <Input
                    placeholder="https://instagram.com/sualoja"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Instagram, Facebook ou site</p>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => step === 0 ? onCancel() : setStep(step - 1)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {step === 0 ? 'Cancelar' : 'Voltar'}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            variant="accent"
            disabled={!canNext()}
            onClick={() => setStep(step + 1)}
          >
            Próximo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            variant="accent"
            disabled={saving || !serviceName.trim()}
            onClick={handleCreate}
          >
            {saving ? 'Criando...' : 'Criar Meu Serviço'} <Sparkles className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ServiceWizard;
