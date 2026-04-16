import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Shield, Mail, Phone, Calendar, UserCheck, Briefcase, FileText, History,
  ImageIcon, Settings, Camera, Loader2, Trash2, Plus, ExternalLink,
  Eye, MapPin, Globe, MessageCircle, ArrowUp, Upload, Key, Lock,
  Tag, Ban, AlertTriangle, X, Clock, Copy, ChevronDown, Search, BarChart3,
  Navigation, Building2, Wrench, Activity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import { handleImageError } from '@/lib/imageResolver';
import PhoneMaskedInput from '@/components/PhoneMaskedInput';
import { sanitizePhone, formatPhoneDisplay } from '@/lib/whatsapp';

interface UserDetailSheetProps {
  user: any | null;
  isAdmin: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

const PRESET_TAGS = [
  { name: 'VIP', color: '#f59e0b' },
  { name: 'Inadimplente', color: '#ef4444' },
  { name: 'Teste', color: '#8b5cf6' },
  { name: 'Parceiro', color: '#10b981' },
  { name: 'Prioritário', color: '#3b82f6' },
  { name: 'Inativo', color: '#6b7280' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo', color: 'bg-emerald-500' },
  { value: 'inactive', label: 'Inativo', color: 'bg-red-500' },
  { value: 'suspended', label: 'Suspenso', color: 'bg-amber-500' },
  { value: 'banned', label: 'Banido', color: 'bg-destructive' },
];

const PROFILE_TYPE_OPTIONS = [
  { value: 'client', label: 'Cliente' },
  { value: 'provider', label: 'Profissional' },
  { value: 'rh', label: 'Agência / RH' },
];

const UserDetailSheet = ({ user, isAdmin, onClose, onRefresh }: UserDetailSheetProps) => {
  const [services, setServices] = useState<any[]>([]);
  const [serviceImages, setServiceImages] = useState<Record<string, any[]>>({});
  const [leads, setLeads] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [contactClicks, setContactClicks] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<{ id: string; name: string; photos: { id: string; image_url: string; name: string }[] }[]>([]);
  const [pageSettings, setPageSettings] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [tab, setTab] = useState('summary');
  const [settingsForm, setSettingsForm] = useState<any>({});
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState('');
  const avatarRef = useRef<HTMLInputElement>(null);

  // Unified form state
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState<any>({});
  const [providerForm, setProviderForm] = useState<any>({});

  // Permissions state
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [userIsModerator, setUserIsModerator] = useState(false);
  const [userIsSponsor, setUserIsSponsor] = useState(false);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [selectedSponsorId, setSelectedSponsorId] = useState('');
  const [permLoading, setPermLoading] = useState(false);

  // Levels & Account Types
  const [levels, setLevels] = useState<any[]>([]);
  const [accountTypes, setAccountTypes] = useState<any[]>([]);
  const [profileTypeSettings, setProfileTypeSettings] = useState<any[]>([]);

  // Password reset
  const [showResetPw, setShowResetPw] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPw, setResettingPw] = useState(false);

  // Tags
  const [userTags, setUserTags] = useState<any[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [tagsLoading, setTagsLoading] = useState(false);

  // Moderation
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);

  // Timeline
  const [activityTimeline, setActivityTimeline] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    setTab('summary');
    setPageSettings(null);
    setProvider(null);
    setCurrentAvatar(user.avatar_url || '');
    setEditing(false);
    setShowResetPw(false);
    setNewPassword('');
    setSuspendReason('');
    setProfileForm({
      full_name: user.full_name || '',
      phone: user.phone || '',
      whatsapp: user.whatsapp || '',
      profile_type: user.profile_type || user.role || 'client',
      status: user.status || 'active',
      level_id: user.level_id || '',
      account_type_id: user.account_type_id || '',
      department: user.department || '',
    });

    // Parallel fetches
    supabase.from('user_roles').select('id, role').eq('user_id', user.id)
      .then(({ data }) => {
        const roles = (data || []).map((r: any) => r.role);
        setUserIsAdmin(roles.includes('admin'));
        setUserIsModerator(roles.includes('moderator'));
      });
    supabase.from('sponsor_contacts').select('id, sponsor_id').eq('user_id', user.id)
      .then(({ data }) => {
        setUserIsSponsor((data || []).length > 0);
        setSelectedSponsorId((data || [])[0]?.sponsor_id || '');
      });
    supabase.from('sponsors').select('id, title').eq('active', true).order('title')
      .then(({ data }) => setSponsors(data || []));
    supabase.from('user_levels').select('id, name, color').order('priority', { ascending: false })
      .then(({ data }) => setLevels(data || []));
    supabase.from('account_types').select('id, name, color').order('display_order')
      .then(({ data }) => setAccountTypes(data || []));
    supabase.from('profile_type_settings' as any).select('profile_key, label, color, icon, active').eq('active', true).order('display_order')
      .then(({ data }) => setProfileTypeSettings((data as any[]) || []));

    fetchTags(user.id);

    // Provider + related
    supabase.from('providers').select('*, categories(name, icon)').eq('user_id', user.id).maybeSingle().then(({ data: prov }) => {
      setProvider(prov);
      if (prov) {
        setProviderForm({
          business_name: prov.business_name || '',
          description: prov.description || '',
          city: prov.city || '',
          state: prov.state || '',
          neighborhood: prov.neighborhood || '',
          whatsapp: prov.whatsapp || '',
          phone: prov.phone || '',
          website: prov.website || '',
          working_hours: prov.working_hours || '',
          years_experience: prov.years_experience || 0,
          service_radius: prov.service_radius || '',
          cnpj: prov.cnpj || '',
          meta_title: (prov as any).meta_title || '',
          meta_description: (prov as any).meta_description || '',
          slug: prov.slug || '',
        });

        // Fetch contact clicks
        supabase.from('contact_clicks' as any).select('id, contact_type, page_path, created_at')
          .eq('provider_id', prov.id).order('created_at', { ascending: false }).limit(100)
          .then(({ data }) => setContactClicks((data as any[]) || []));

        supabase.from('services').select('id, service_name, description, price, view_count, created_at, deleted_at, whatsapp, service_area, working_hours')
          .eq('provider_id', prov.id).order('created_at', { ascending: false }).limit(50)
          .then(({ data }) => {
            setServices(data || []);
            if (data?.length) {
              const svcIds = data.map(s => s.id);
              supabase.from('service_images').select('*').in('service_id', svcIds).order('display_order')
                .then(({ data: imgs }) => {
                  const map: Record<string, any[]> = {};
                  (imgs || []).forEach(img => {
                    if (!map[img.service_id]) map[img.service_id] = [];
                    map[img.service_id].push(img);
                  });
                  setServiceImages(map);
                });
            }
          });

        supabase.from('leads').select('id, client_name, status, created_at, service_needed, phone, message')
          .eq('provider_id', prov.id).order('created_at', { ascending: false }).limit(50)
          .then(({ data }) => setLeads(data || []));

        supabase.from('provider_page_settings').select('*').eq('provider_id', prov.id).maybeSingle()
          .then(({ data }) => {
            setPageSettings(data);
            if (data) setSettingsForm({
              headline: data.headline || '', tagline: data.tagline || '',
              cta_text: data.cta_text || '', theme: (data as any).theme || 'default',
              accent_color: data.accent_color || '',
            });
          });

        // Portfolio
        supabase.from('portfolio_albums').select('id, name')
          .eq('provider_id', prov.id).order('display_order')
          .then(async ({ data: albums }) => {
            if (albums && albums.length > 0) {
              const albumIds = albums.map(a => a.id);
              const { data: photos } = await supabase.from('portfolio_photos')
                .select('id, album_id, image_url, original_name')
                .in('album_id', albumIds).order('display_order');
              setPortfolio(albums.map(a => ({
                id: a.id,
                name: a.name,
                photos: (photos || []).filter(p => p.album_id === a.id).map(p => ({
                  id: p.id, image_url: p.image_url, name: p.original_name || '',
                })),
              })));
            } else {
              const { data: files } = await supabase.storage.from('portfolio').list(user.id, { limit: 100 });
              if (files) {
                const filtered = files.filter(f => f.name !== '.emptyFolderPlaceholder');
                setPortfolio([{
                  id: 'legacy', name: 'Portfólio',
                  photos: filtered.map(f => ({
                    id: f.name,
                    image_url: supabase.storage.from('portfolio').getPublicUrl(`${user.id}/${f.name}`).data.publicUrl,
                    name: f.name,
                  })),
                }]);
              } else setPortfolio([]);
            }
          });
      } else {
        setServices([]);
        setLeads([]);
        setPortfolio([]);
      }
    });

    // Media
    if (user.user_ref) {
      supabase.from('media').select('id, original_name, public_url, entity_type, mime_type, created_at, is_active')
        .eq('user_ref', user.user_ref).order('created_at', { ascending: false }).limit(100)
        .then(({ data }) => setMedia(data || []));
    } else setMedia([]);

    fetchActivityTimeline(user.id);
  }, [user?.id]);

  // === Tags ===
  const fetchTags = async (userId: string) => {
    const { data } = await supabase.from('user_tags').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setUserTags(data || []);
  };

  const addTag = async (tagName?: string, tagColor?: string) => {
    if (!user) return;
    const name = (tagName || newTagName).trim();
    if (!name) return;
    setTagsLoading(true);
    const { error } = await supabase.from('user_tags').insert({ user_id: user.id, tag_name: name, color: tagColor || newTagColor } as any);
    if (error) { error.code === '23505' ? toast.error('Tag já existe') : toast.error('Erro: ' + error.message); }
    else {
      await logAuditAction({ action: 'tag_added', resource_type: 'user', resource_id: user.id, details: { tag: name } });
      toast.success(`Tag "${name}" adicionada`);
      setNewTagName('');
      fetchTags(user.id);
    }
    setTagsLoading(false);
  };

  const removeTag = async (tagId: string, tagName: string) => {
    if (!user) return;
    await supabase.from('user_tags').delete().eq('id', tagId);
    await logAuditAction({ action: 'tag_removed', resource_type: 'user', resource_id: user.id, details: { tag: tagName } });
    toast.success(`Tag "${tagName}" removida`);
    fetchTags(user.id);
  };

  // === Moderation ===
  const suspendUser = async () => {
    if (!user || !suspendReason.trim()) { toast.error('Informe o motivo'); return; }
    setSuspendLoading(true);
    const { error } = await supabase.from('profiles').update({
      status: 'suspended', suspended_at: new Date().toISOString(),
      suspended_reason: suspendReason.trim(),
      suspended_by: (await supabase.auth.getUser()).data.user?.id,
    } as any).eq('id', user.id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'suspend', resource_type: 'user', resource_id: user.id, details: { reason: suspendReason } });
      await supabase.from('notifications').insert({ user_id: user.id, title: 'Conta Suspensa', message: `Motivo: ${suspendReason}`, type: 'system' });
      toast.success('Usuário suspenso');
      setSuspendReason('');
      onRefresh?.();
    }
    setSuspendLoading(false);
  };

  const banUser = async () => {
    if (!user) return;
    setSuspendLoading(true);
    const { error } = await supabase.from('profiles').update({
      status: 'banned', suspended_at: new Date().toISOString(),
      suspended_reason: suspendReason.trim() || 'Banido pelo administrador',
      suspended_by: (await supabase.auth.getUser()).data.user?.id,
    } as any).eq('id', user.id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'ban', resource_type: 'user', resource_id: user.id, details: { reason: suspendReason || 'Banido' } });
      await supabase.from('notifications').insert({ user_id: user.id, title: 'Conta Banida', message: 'Sua conta foi banida permanentemente.', type: 'system' });
      toast.success('Usuário banido');
      onRefresh?.();
    }
    setSuspendLoading(false);
  };

  const reactivateUser = async () => {
    if (!user) return;
    setSuspendLoading(true);
    const { error } = await supabase.from('profiles').update({
      status: 'active', suspended_at: null, suspended_reason: '', suspended_by: null,
    } as any).eq('id', user.id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'reactivate', resource_type: 'user', resource_id: user.id });
      await supabase.from('notifications').insert({ user_id: user.id, title: 'Conta Reativada', message: 'Sua conta foi reativada.', type: 'system' });
      toast.success('Reativado');
      onRefresh?.();
    }
    setSuspendLoading(false);
  };

  // === Timeline ===
  const fetchActivityTimeline = async (userId: string) => {
    const timeline: any[] = [];
    const { data: userActions } = await supabase.from('audit_log')
      .select('id, action, resource_type, resource_id, details, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
    (userActions || []).forEach(a => timeline.push({ ...a, source: 'audit', type: 'action' }));
    const { data: onUser } = await supabase.from('audit_log')
      .select('id, action, resource_type, resource_id, details, created_at, user_id')
      .eq('resource_id', userId).eq('resource_type', 'user')
      .order('created_at', { ascending: false }).limit(20);
    (onUser || []).forEach(a => {
      if (!timeline.find(t => t.id === a.id)) timeline.push({ ...a, source: 'audit', type: 'admin_action' });
    });
    timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setActivityTimeline(timeline.slice(0, 50));
  };

  // === Avatar ===
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return; }
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      setCurrentAvatar(publicUrl);
      toast.success('Avatar atualizado!');
      onRefresh?.();
    } catch { toast.error('Erro ao enviar avatar'); }
    setAvatarUploading(false);
  };

  // === Inline header status change ===
  const updateField = async (field: string, value: any) => {
    if (!user) return;
    const updateData: any = { [field]: value };
    // If changing profile_type, also sync role
    if (field === 'profile_type') {
      updateData.role = value === 'rh' ? 'client' : value;
    }
    const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: { [field]: value } } });
    toast.success('Atualizado!');
    onRefresh?.();
  };

  // === Save Profile ===
  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      full_name: profileForm.full_name,
      phone: profileForm.phone,
      whatsapp: sanitizePhone(profileForm.whatsapp || ''),
      profile_type: profileForm.profile_type,
      role: profileForm.profile_type === 'rh' ? 'client' : profileForm.profile_type,
      status: profileForm.status,
      level_id: profileForm.level_id || null,
      account_type_id: profileForm.account_type_id || null,
      department: profileForm.department || '',
    }).eq('id', user.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: profileForm } });
    toast.success('Perfil salvo!');
    setEditing(false);
    onRefresh?.();
  };

  // === Save Provider ===
  const saveProvider = async () => {
    if (!provider) return;
    const { error } = await supabase.from('providers').update({
      ...providerForm,
      whatsapp: sanitizePhone(providerForm.whatsapp || ''),
      phone: sanitizePhone(providerForm.phone || ''),
    }).eq('id', provider.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Dados profissionais salvos!');
    setEditing(false);
    onRefresh?.();
  };

  // === Save Page Settings ===
  const savePageSettings = async () => {
    if (!provider) return;
    const payload = { ...settingsForm, provider_id: provider.id };
    let error;
    if (pageSettings?.id) ({ error } = await supabase.from('provider_page_settings').update(payload).eq('id', pageSettings.id));
    else ({ error } = await supabase.from('provider_page_settings').insert(payload));
    if (error) toast.error('Erro: ' + error.message);
    else toast.success('Configurações salvas!');
  };

  // === Password Reset ===
  const handleResetPassword = async () => {
    if (!user || !newPassword) return;
    if (newPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    setResettingPw(true);
    try {
      const res = await supabase.functions.invoke('admin-reset-password', { body: { user_id: user.id, new_password: newPassword } });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: { password: { from: '***', to: '***' } } } });
      toast.success('Senha redefinida!');
      setShowResetPw(false);
      setNewPassword('');
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'Falha')); }
    setResettingPw(false);
  };

  // === Phone → WhatsApp auto-sync ===
  const handlePhoneChange = useCallback((name: string, rawValue: string) => {
    setProfileForm((prev: any) => {
      const next = { ...prev, [name]: rawValue };
      // Auto-copy phone → whatsapp if whatsapp is empty
      if (name === 'phone' && (!prev.whatsapp || prev.whatsapp === prev.phone)) {
        next.whatsapp = rawValue;
      }
      return next;
    });
  }, []);

  const handleProviderPhoneChange = useCallback((name: string, rawValue: string) => {
    setProviderForm((prev: any) => {
      const next = { ...prev, [name]: rawValue };
      if (name === 'phone' && (!prev.whatsapp || prev.whatsapp === prev.phone)) {
        next.whatsapp = rawValue;
      }
      return next;
    });
  }, []);

  // === Service image delete ===
  const deleteServiceImage = async (img: any) => {
    const urlParts = img.image_url.split('/service-images/');
    if (urlParts[1]) await supabase.storage.from('service-images').remove([decodeURIComponent(urlParts[1])]);
    await supabase.from('service_images').delete().eq('id', img.id);
    setServiceImages(prev => {
      const copy = { ...prev };
      copy[img.service_id] = (copy[img.service_id] || []).filter((i: any) => i.id !== img.id);
      return copy;
    });
    toast.success('Imagem removida');
  };

  // === Permissions toggles ===
  const toggleAdmin = async () => {
    if (!user) return;
    setPermLoading(true);
    if (userIsAdmin) {
      await supabase.from('user_roles').delete().eq('user_id', user.id).eq('role', 'admin');
      toast.success('Admin removido');
      setUserIsAdmin(false);
    } else {
      await supabase.from('user_roles').insert({ user_id: user.id, role: 'admin' } as any);
      toast.success('Admin concedido');
      setUserIsAdmin(true);
    }
    await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: { admin: !userIsAdmin } } });
    setPermLoading(false);
    onRefresh?.();
  };

  const toggleModerator = async () => {
    if (!user) return;
    setPermLoading(true);
    if (userIsModerator) {
      await supabase.from('user_roles').delete().eq('user_id', user.id).eq('role', 'moderator');
      toast.success('Moderador removido');
      setUserIsModerator(false);
    } else {
      await supabase.from('user_roles').insert({ user_id: user.id, role: 'moderator' } as any);
      toast.success('Moderador concedido');
      setUserIsModerator(true);
    }
    await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: { moderator: !userIsModerator } } });
    setPermLoading(false);
    onRefresh?.();
  };

  const toggleSponsor = async () => {
    if (!user) return;
    setPermLoading(true);
    if (userIsSponsor) {
      await supabase.from('sponsor_contacts').delete().eq('user_id', user.id);
      toast.success('Patrocinador removido');
      setUserIsSponsor(false);
      setSelectedSponsorId('');
    } else {
      if (!selectedSponsorId) { toast.error('Selecione um patrocinador'); setPermLoading(false); return; }
      await supabase.from('sponsor_contacts').insert({ user_id: user.id, sponsor_id: selectedSponsorId, contact_name: user.full_name || '', email: user.email || '' });
      toast.success('Patrocinador concedido');
      setUserIsSponsor(true);
    }
    await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: { sponsor: !userIsSponsor } } });
    setPermLoading(false);
    onRefresh?.();
  };

  if (!user) return null;

  const totalPortfolioPhotos = portfolio.reduce((acc, a) => acc + a.photos.length, 0);
  const initials = (user.full_name || '?')[0]?.toUpperCase();
  const levelObj = levels.find(l => l.id === user.level_id);
  const accountTypeObj = accountTypes.find(a => a.id === user.account_type_id);
  const isSuspended = user.status === 'suspended';
  const isBanned = user.status === 'banned';

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      update: 'Editado', create: 'Criado', suspend: 'Suspenso', ban: 'Banido',
      reactivate: 'Reativado', tag_added: 'Tag', tag_removed: 'Tag removida',
      update_permissions: 'Permissões', plan_synced: 'Plano sync',
      soft_delete_service: 'Serviço excluído', restore_service: 'Serviço restaurado',
      media_deleted: 'Mídia excluída',
    };
    return map[action] || action;
  };

  return (
    <Sheet open={!!user} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {/* ===== HERO HEADER ===== */}
        <div className={`relative px-3 sm:px-6 pt-5 pb-4 ${isBanned ? 'bg-gradient-to-r from-destructive/15 to-destructive/5' : isSuspended ? 'bg-gradient-to-r from-amber-500/15 to-amber-500/5' : 'bg-gradient-to-r from-primary/10 to-accent/10'}`}>
          {/* Creation date prominent */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Conta criada em {user.created_at ? format(new Date(user.created_at), 'dd/MM/yyyy HH:mm') : '—'}
            </div>
            {user.user_ref && (
              <button
                onClick={() => { navigator.clipboard.writeText(user.user_ref); toast.success('user_ref copiado!'); }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground hover:bg-accent transition-colors"
                title="Copiar user_ref"
              >
                {user.user_ref} <Copy className="h-2.5 w-2.5" />
              </button>
            )}
          </div>

          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <Avatar className={`h-14 w-14 sm:h-16 sm:w-16 border-3 shadow-lg ${isBanned ? 'border-destructive/50' : isSuspended ? 'border-amber-400/50' : 'border-background'}`}>
                <AvatarImage src={currentAvatar || undefined} alt={user.full_name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg sm:text-xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <button onClick={() => avatarRef.current?.click()} disabled={avatarUploading}
                className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md hover:bg-accent/90 transition-colors">
                {avatarUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold text-foreground truncate">{user.full_name || '—'}</h2>
              <p className="text-xs text-muted-foreground truncate">{user.email || ''}</p>

              {/* ===== INTERACTIVE GOVERNANCE BADGES (Step 4) ===== */}
              <div className="flex flex-wrap items-center gap-1 mt-2">
                {/* Status dropdown */}
                <Select value={user.status || 'active'} onValueChange={v => updateField('status', v)}>
                  <SelectTrigger className="h-6 w-auto min-w-0 px-2 py-0 text-[10px] font-medium border-0 bg-transparent gap-0.5 [&>svg]:h-3 [&>svg]:w-3">
                    <span>{STATUS_OPTIONS.find(s => s.value === user.status)?.label || 'Ativo'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Profile type dropdown */}
                <Select value={user.profile_type || 'client'} onValueChange={v => updateField('profile_type', v)}>
                  <SelectTrigger className="h-6 w-auto min-w-0 px-2 py-0 text-[10px] font-medium border-0 bg-transparent gap-0.5 [&>svg]:h-3 [&>svg]:w-3">
                    <span>{PROFILE_TYPE_OPTIONS.find(p => p.value === user.profile_type)?.label || 'Cliente'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {(profileTypeSettings.length > 0 ? profileTypeSettings : PROFILE_TYPE_OPTIONS.map(p => ({ profile_key: p.value, label: p.label, icon: '' }))).map((p: any) => (
                      <SelectItem key={p.profile_key || p.value} value={p.profile_key || p.value} className="text-xs">
                        {p.icon} {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Level dropdown */}
                <Select value={user.level_id || 'none'} onValueChange={v => updateField('level_id', v === 'none' ? null : v)}>
                  <SelectTrigger className="h-6 w-auto min-w-0 px-2 py-0 text-[10px] font-medium border-0 bg-transparent gap-0.5 [&>svg]:h-3 [&>svg]:w-3"
                    style={levelObj ? { color: levelObj.color, borderColor: levelObj.color } : undefined}>
                    <span>{levelObj?.name || 'Nível'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Nenhum</SelectItem>
                    {levels.map(l => (
                      <SelectItem key={l.id} value={l.id} className="text-xs">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: l.color }} />{l.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Account type dropdown */}
                <Select value={user.account_type_id || 'none'} onValueChange={v => updateField('account_type_id', v === 'none' ? null : v)}>
                  <SelectTrigger className="h-6 w-auto min-w-0 px-2 py-0 text-[10px] font-medium border-0 bg-transparent gap-0.5 [&>svg]:h-3 [&>svg]:w-3"
                    style={accountTypeObj ? { color: accountTypeObj.color } : undefined}>
                    <span>{accountTypeObj?.name || 'Plano'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Nenhum</SelectItem>
                    {accountTypes.map(a => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: a.color }} />{a.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Provider plan badge (read-only indicator) */}
                {provider?.plan && (
                  <Badge variant="outline" className="text-[10px] h-6">{provider.plan}</Badge>
                )}

                {userIsAdmin && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] h-6">Admin</Badge>}
                {userIsModerator && <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] h-6">Mod</Badge>}
              </div>

              {/* User Tags */}
              {userTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {userTags.map(t => (
                    <Badge key={t.id} className="text-[9px] text-white h-5" style={{ backgroundColor: t.color }}>{t.tag_name}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Suspension banner */}
          {(isSuspended || isBanned) && (
            <div className={`mt-3 rounded-lg p-2.5 text-xs ${isBanned ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
              <div className="flex items-center gap-2 font-medium">
                {isBanned ? <Ban className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {isBanned ? 'Conta banida' : 'Conta suspensa'}
              </div>
              {user.suspended_reason && <p className="mt-1 opacity-80">Motivo: {user.suspended_reason}</p>}
              {user.suspended_at && <p className="mt-0.5 opacity-60">Em: {format(new Date(user.suspended_at), 'dd/MM/yyyy HH:mm')}</p>}
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={reactivateUser} disabled={suspendLoading}>Reativar</Button>
            </div>
          )}

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-3">
            {(user.whatsapp || provider?.whatsapp) && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
                <a href={`https://wa.me/${sanitizePhone(user.whatsapp || provider?.whatsapp || '')}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
              </Button>
            )}
            {provider?.slug && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
                <a href={`/profissional/${provider.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" /> Ver Página
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* ===== TABS ===== */}
        <div className="px-3 sm:px-6 pt-3 pb-6">
          <Tabs value={tab} onValueChange={setTab}>
            {/* Responsive tab rows */}
            <TabsList className="w-full flex flex-wrap gap-0.5 mb-4 h-auto bg-muted/50 p-1 rounded-lg">
              <TabsTrigger value="summary" className="text-[11px] gap-1 px-2 py-1.5 flex-1 min-w-[60px]"><UserCheck className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Resumo</span></TabsTrigger>
              <TabsTrigger value="services" className="text-[11px] gap-1 px-2 py-1.5 flex-1 min-w-[60px]"><FileText className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Serviços</span></TabsTrigger>
              <TabsTrigger value="portfolio" className="text-[11px] gap-1 px-2 py-1.5 flex-1 min-w-[60px]"><ImageIcon className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Fotos</span></TabsTrigger>
              <TabsTrigger value="leads" className="text-[11px] gap-1 px-2 py-1.5 flex-1 min-w-[60px]"><MessageCircle className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Leads</span></TabsTrigger>
              {provider && <TabsTrigger value="seo" className="text-[11px] gap-1 px-2 py-1.5 flex-1 min-w-[60px]"><Search className="h-3.5 w-3.5" /> <span className="hidden xs:inline">SEO</span></TabsTrigger>}
              {provider && <TabsTrigger value="audience" className="text-[11px] gap-1 px-2 py-1.5 flex-1 min-w-[60px]"><BarChart3 className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Audiência</span></TabsTrigger>}
              <TabsTrigger value="tags" className="text-[11px] gap-1 px-2 py-1.5 flex-1 min-w-[60px]"><Tag className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Tags</span></TabsTrigger>
              <TabsTrigger value="moderation" className="text-[11px] gap-1 px-2 py-1.5 flex-1 min-w-[60px]"><Ban className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Mod.</span></TabsTrigger>
              <TabsTrigger value="perms" className="text-[11px] gap-1 px-2 py-1.5 flex-1 min-w-[60px]"><Lock className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Perm.</span></TabsTrigger>
              <TabsTrigger value="page" className="text-[11px] gap-1 px-2 py-1.5 flex-1 min-w-[60px]"><Settings className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Página</span></TabsTrigger>
              <TabsTrigger value="timeline" className="text-[11px] gap-1 px-2 py-1.5 flex-1 min-w-[60px]"><Clock className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Timeline</span></TabsTrigger>
            </TabsList>

            {/* ====== SUMMARY TAB (Unified Profile + Provider) ====== */}
            <TabsContent value="summary" className="space-y-4 mt-0">
              {/* Personal Data */}
              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm">Dados Pessoais</h3>
                  <Button size="sm" variant={editing ? 'accent' : 'outline'} className="h-7 text-xs" onClick={() => setEditing(!editing)}>
                    {editing ? 'Cancelar' : 'Editar'}
                  </Button>
                </div>
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Nome completo</Label>
                      <Input value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">E-mail</Label>
                      <Input value={user.email || ''} disabled className="h-8 text-sm opacity-60" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Telefone</Label>
                        <PhoneMaskedInput name="phone" value={profileForm.phone || ''} onChange={handlePhoneChange}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                      </div>
                      <div>
                        <Label className="text-xs">WhatsApp</Label>
                        <PhoneMaskedInput name="whatsapp" value={profileForm.whatsapp || ''} onChange={handlePhoneChange}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                        <p className="text-[9px] text-muted-foreground mt-0.5">Auto-preenchido do Telefone</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Departamento</Label>
                      <Input value={profileForm.department} onChange={e => setProfileForm({ ...profileForm, department: e.target.value })} className="h-8 text-sm" placeholder="Ex: TI, Vendas..." />
                    </div>
                    <Button size="sm" onClick={saveProfile} className="w-full">Salvar Dados Pessoais</Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <InfoRow icon={<Mail className="h-4 w-4" />} label="E-mail" value={user.email || '—'} />
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={user.phone ? formatPhoneDisplay(user.phone) : '—'} />
                    <InfoRow icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" value={user.whatsapp ? formatPhoneDisplay(user.whatsapp) : '—'} />
                    {user.department && <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Depto" value={user.department} />}
                    <InfoRow icon={<ArrowUp className="h-4 w-4" />} label="Pontos" value={String(user.engagement_points || 0)} />
                  </div>
                )}
              </div>

              {/* Provider Data — Organized Blocks */}
              {provider && (
                <div className="space-y-3">
                  {/* Block 1: Identidade do Negócio (Blue) */}
                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/10 p-3 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"><Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" /></span>
                        Identidade do Negocio
                      </h3>
                      <Button size="sm" variant={editing ? 'accent' : 'outline'} className="h-7 text-xs" onClick={() => setEditing(!editing)}>
                        {editing ? 'Cancelar' : 'Editar'}
                      </Button>
                    </div>
                    {editing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div><Label className="text-xs">Nome Fantasia</Label><Input value={providerForm.business_name} onChange={e => setProviderForm({ ...providerForm, business_name: e.target.value })} className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">CNPJ</Label><Input value={providerForm.cnpj} onChange={e => setProviderForm({ ...providerForm, cnpj: e.target.value })} className="h-8 text-sm" /></div>
                        </div>
                        <div><Label className="text-xs">Descricao</Label><Textarea value={providerForm.description} onChange={e => setProviderForm({ ...providerForm, description: e.target.value })} className="text-sm min-h-[60px]" /></div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Empresa" value={provider.business_name || '—'} />
                        <InfoRow icon={<FileText className="h-4 w-4" />} label="CNPJ" value={provider.cnpj || '—'} />
                        {provider.description && <InfoRow icon={<FileText className="h-4 w-4" />} label="Descricao" value={provider.description.slice(0, 120) + (provider.description.length > 120 ? '...' : '')} />}
                        {provider.categories && <InfoRow icon={<FileText className="h-4 w-4" />} label="Categoria" value={(provider.categories as any)?.name || '—'} />}
                        {provider.slug && (
                          <a href={`/profissional/${provider.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1 pt-1">
                            <ExternalLink className="h-3 w-3" /> /profissional/{provider.slug}
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Block 2: Dados Geograficos (Green) */}
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 sm:p-4 space-y-3">
                    <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30"><Navigation className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></span>
                      Dados Geograficos (PostGIS)
                    </h3>
                    {editing ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div><Label className="text-xs">Cidade</Label><Input value={providerForm.city} onChange={e => setProviderForm({ ...providerForm, city: e.target.value })} className="h-8 text-sm" /></div>
                        <div><Label className="text-xs">Estado</Label><Input value={providerForm.state} onChange={e => setProviderForm({ ...providerForm, state: e.target.value })} className="h-8 text-sm" maxLength={2} /></div>
                        <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Bairro</Label><Input value={providerForm.neighborhood} onChange={e => setProviderForm({ ...providerForm, neighborhood: e.target.value })} className="h-8 text-sm" /></div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <InfoRow icon={<MapPin className="h-4 w-4" />} label="Local" value={[provider.neighborhood, provider.city, provider.state].filter(Boolean).join(', ') || '—'} />
                        <InfoRow icon={<Globe className="h-4 w-4" />} label="Lat/Lng" value={provider.latitude && provider.longitude ? `${provider.latitude}, ${provider.longitude}` : '—'} />
                        <InfoRow icon={<MapPin className="h-4 w-4" />} label="Raio" value={provider.service_radius || '—'} />
                        {(!provider.latitude || !provider.longitude) && (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/10 rounded-lg px-2 py-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" /> Erro de Localizacao: coordenadas ausentes
                          </div>
                        )}
                        {(provider as any).content_flags?.geo_error && (
                          <div className="flex items-center gap-1.5 text-[10px] text-destructive font-medium bg-destructive/5 rounded-lg px-2 py-1">
                            <AlertTriangle className="h-3 w-3" /> Endereco com erro de validacao
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Block 3: Informacoes Operacionais (Orange) */}
                  <div className="rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/30 dark:bg-orange-950/10 p-3 sm:p-4 space-y-3">
                    <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30"><Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" /></span>
                      Informacoes Operacionais
                    </h3>
                    {editing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div><Label className="text-xs">Telefone Comercial</Label><PhoneMaskedInput name="phone" value={providerForm.phone || ''} onChange={handleProviderPhoneChange} className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
                          <div><Label className="text-xs">WhatsApp Comercial</Label><PhoneMaskedInput name="whatsapp" value={providerForm.whatsapp || ''} onChange={handleProviderPhoneChange} className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div><Label className="text-xs">Website</Label><Input value={providerForm.website} onChange={e => setProviderForm({ ...providerForm, website: e.target.value })} className="h-8 text-sm" placeholder="https://..." /></div>
                          <div><Label className="text-xs">Horario</Label><Input value={providerForm.working_hours} onChange={e => setProviderForm({ ...providerForm, working_hours: e.target.value })} className="h-8 text-sm" /></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div><Label className="text-xs">Experiencia (anos)</Label><Input type="number" value={providerForm.years_experience} onChange={e => setProviderForm({ ...providerForm, years_experience: parseInt(e.target.value) || 0 })} className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Raio de Atendimento</Label><Input value={providerForm.service_radius} onChange={e => setProviderForm({ ...providerForm, service_radius: e.target.value })} className="h-8 text-sm" /></div>
                        </div>
                        <Button size="sm" onClick={saveProvider} className="w-full">Salvar Dados Profissionais</Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <InfoRow icon={<Phone className="h-4 w-4" />} label="Fone" value={provider.phone ? formatPhoneDisplay(provider.phone) : '—'} />
                        <InfoRow icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" value={provider.whatsapp ? formatPhoneDisplay(provider.whatsapp) : '—'} />
                        <InfoRow icon={<Globe className="h-4 w-4" />} label="Website" value={provider.website || '—'} />
                        <InfoRow icon={<Clock className="h-4 w-4" />} label="Horario" value={provider.working_hours || '—'} />
                        <InfoRow icon={<Calendar className="h-4 w-4" />} label="Experiencia" value={`${provider.years_experience || 0} anos`} />
                      </div>
                    )}
                  </div>

                  {/* Block 4: Metricas de Performance (Purple) */}
                  <div className="rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/10 p-3 sm:p-4 space-y-3">
                    <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30"><Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" /></span>
                      Metricas de Performance
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Avaliacoes', value: String(provider.review_count || 0), sub: `Media ${provider.rating_avg?.toFixed(1) || '0.0'}`, color: 'text-amber-600 dark:text-amber-400' },
                        { label: 'Servicos', value: String(provider.services_count || 0), sub: 'cadastrados', color: 'text-blue-600 dark:text-blue-400' },
                        { label: 'Fotos', value: String(provider.portfolio_photo_count || 0), sub: `${provider.portfolio_album_count || 0} albuns`, color: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Contatos', value: String(contactClicks.length), sub: 'cliques totais', color: 'text-purple-600 dark:text-purple-400' },
                      ].map(m => (
                        <div key={m.label} className="rounded-lg bg-card border border-border/60 p-2.5 text-center shadow-sm">
                          <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                          <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">{m.label}</p>
                          <p className="text-[9px] text-muted-foreground">{m.sub}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Profile Health Footer */}
                  {(() => {
                    const checks = [
                      { ok: !!provider.photo_url, label: 'Foto de perfil' },
                      { ok: !!provider.whatsapp, label: 'WhatsApp' },
                      { ok: !!provider.city && provider.city !== 'Nao informada', label: 'Cidade' },
                      { ok: !!provider.description?.trim(), label: 'Descricao' },
                      { ok: (provider.services_count || 0) > 0, label: 'Servico' },
                      { ok: !!provider.latitude && !!provider.longitude, label: 'Coordenadas' },
                    ];
                    const filled = checks.filter(c => c.ok).length;
                    const pct = Math.round((filled / checks.length) * 100);
                    const missing = checks.filter(c => !c.ok).map(c => c.label);
                    const healthColor = pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive';
                    const healthBg = pct >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' : pct >= 50 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40';
                    return (
                      <div className={`rounded-xl border p-3 sm:p-4 space-y-2 ${healthBg}`}>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                            <Shield className="h-4 w-4" /> Saude do Perfil
                          </h3>
                          <span className={`text-sm font-bold ${healthColor}`}>{pct}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-destructive'}`} style={{ width: `${pct}%` }} />
                        </div>
                        {missing.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {missing.map(m => (
                              <span key={m} className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive bg-destructive/10 rounded-full px-2 py-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" /> Falta {m}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/40 mt-2">
                          <span>Criado: {provider.created_at ? format(new Date(provider.created_at), 'dd/MM/yyyy') : '—'}</span>
                          <span>Atualizado: {provider.updated_at ? format(new Date(provider.updated_at), 'dd/MM/yyyy') : '—'}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Password Reset */}
              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2"><Key className="h-4 w-4" /> Senha</h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowResetPw(!showResetPw)}>
                    {showResetPw ? 'Cancelar' : 'Redefinir'}
                  </Button>
                </div>
                {showResetPw && (
                  <div className="flex gap-2">
                    <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nova senha (mín. 6)" className="h-8 text-sm flex-1" />
                    <Button size="sm" className="h-8 text-xs shrink-0" onClick={handleResetPassword} disabled={resettingPw || newPassword.length < 6}>
                      {resettingPw ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3 mr-1" />}
                      Aplicar
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ====== SERVICES TAB ====== */}
            <TabsContent value="services" className="space-y-3 mt-0">
              <p className="text-xs text-muted-foreground">{services.length} serviço(s)</p>
              {services.length === 0 ? (
                <EmptyState icon={<FileText />} text="Nenhum serviço vinculado" />
              ) : (
                <div className="space-y-3">
                  {services.map(s => {
                    const imgs = serviceImages[s.id] || [];
                    const isDeleted = !!s.deleted_at;
                    return (
                      <div key={s.id} className={`rounded-xl border overflow-hidden ${isDeleted ? 'border-destructive/30 opacity-70' : 'border-border'}`}>
                        <div className="p-3 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground text-sm truncate">{s.service_name}</p>
                            {s.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{s.description}</p>}
                            <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-muted-foreground">
                              {s.price && <span>R$ {s.price}</span>}
                              <span>{s.view_count || 0} views</span>
                              <span>{s.created_at ? format(new Date(s.created_at), 'dd/MM/yy') : ''}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isDeleted ? (
                              <>
                                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
                                  onClick={async () => {
                                    const { error } = await supabase.from('services').update({ deleted_at: null }).eq('id', s.id);
                                    if (error) { toast.error('Erro: ' + error.message); return; }
                                    await logAuditAction({ action: 'restore_service', resource_type: 'service', resource_id: s.id, details: { service_name: s.service_name } });
                                    toast.success('Restaurado');
                                    setServices(prev => prev.map(sv => sv.id === s.id ? { ...sv, deleted_at: null } : sv));
                                  }}>
                                  <ArrowUp className="h-3 w-3" /> Restaurar
                                </Button>
                                <Badge variant="destructive" className="text-[10px]">Excluído</Badge>
                              </>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Excluir"
                                onClick={async () => {
                                  const { error } = await supabase.from('services').update({ deleted_at: new Date().toISOString() }).eq('id', s.id);
                                  if (error) { toast.error('Erro: ' + error.message); return; }
                                  await logAuditAction({ action: 'soft_delete_service', resource_type: 'service', resource_id: s.id, details: { service_name: s.service_name } });
                                  toast.success('Excluído (soft)');
                                  setServices(prev => prev.map(sv => sv.id === s.id ? { ...sv, deleted_at: new Date().toISOString() } : sv));
                                }}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {imgs.length > 0 && (
                          <div className="border-t border-border p-2">
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                              {imgs.map((img: any) => (
                                <div key={img.id} className="relative group rounded-md overflow-hidden aspect-square">
                                  <img src={img.image_url} alt="" className="h-full w-full object-cover" loading="lazy" onError={handleImageError} />
                                  <button onClick={() => deleteServiceImage(img)}
                                    className="absolute inset-0 bg-destructive/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Trash2 className="h-4 w-4 text-white" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ====== PORTFOLIO / MEDIA TAB ====== */}
            <TabsContent value="portfolio" className="space-y-4 mt-0">
              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-sm">Portfólio ({portfolio.length} álbuns • {totalPortfolioPhotos} fotos)</h3>
                {portfolio.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum álbum</p>
                ) : (
                  <div className="space-y-4">
                    {portfolio.map(album => (
                      <div key={album.id}>
                        <p className="text-xs font-medium text-foreground mb-1.5">{album.name} ({album.photos.length})</p>
                        {album.photos.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sem fotos</p>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {album.photos.map(photo => (
                              <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                                <img src={photo.image_url} alt={photo.name} className="h-full w-full object-cover" loading="lazy" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-sm">Mídias ({media.length})</h3>
                {media.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhuma mídia</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {media.map(m => (
                      <div key={m.id} className="relative group rounded-lg border border-border overflow-hidden">
                        {m.mime_type?.startsWith('image/') ? (
                          <img src={m.public_url} alt={m.original_name} className="w-full aspect-square object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full aspect-square bg-muted flex items-center justify-center text-xs text-muted-foreground">
                            {m.mime_type?.split('/')[1] || 'file'}
                          </div>
                        )}
                        <button
                          onClick={async () => {
                            const { error } = await supabase.from('media').update({ is_active: false }).eq('id', m.id);
                            if (error) { toast.error('Erro: ' + error.message); return; }
                            await logAuditAction({ action: 'media_deleted', resource_type: 'media', resource_id: m.id, details: { name: m.original_name } });
                            setMedia(prev => prev.filter(x => x.id !== m.id));
                            toast.success('Mídia desativada');
                          }}
                          className="absolute top-1 right-1 bg-destructive/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-1.5 py-1">
                          <p className="text-[9px] text-foreground truncate">{m.original_name}</p>
                          <Badge variant="outline" className="text-[8px]">{m.entity_type}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ====== SEO TAB ====== */}
            <TabsContent value="seo" className="space-y-4 mt-0">
              {provider ? (
                <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2"><Search className="h-4 w-4 text-primary" /> Metadados de SEO</h3>
                  <p className="text-[10px] text-muted-foreground">Edite como este perfil aparece nos resultados do Google.</p>
                  <div>
                    <Label className="text-xs">Slug Personalizado</Label>
                    <Input value={providerForm.slug || ''} onChange={e => setProviderForm({ ...providerForm, slug: e.target.value })} className="h-8 text-sm" placeholder="ex: joao-encanador-sp" />
                    <p className="text-[9px] text-muted-foreground mt-0.5">URL: /profissional/{providerForm.slug || '...'}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Meta Title <span className="text-muted-foreground">({(providerForm.meta_title || '').length}/60)</span></Label>
                    <Input value={providerForm.meta_title || ''} onChange={e => setProviderForm({ ...providerForm, meta_title: e.target.value })} className="h-8 text-sm" maxLength={60} placeholder="Título para o Google..." />
                  </div>
                  <div>
                    <Label className="text-xs">Meta Description <span className="text-muted-foreground">({(providerForm.meta_description || '').length}/160)</span></Label>
                    <Textarea value={providerForm.meta_description || ''} onChange={e => setProviderForm({ ...providerForm, meta_description: e.target.value })} className="text-sm min-h-[60px]" maxLength={160} placeholder="Descrição para o Google..." />
                  </div>
                  {/* Preview */}
                  <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Preview no Google</p>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400 truncate">{providerForm.meta_title || provider.business_name || 'Título do perfil'}</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-500 truncate">precisodeum.com.br/profissional/{providerForm.slug || '...'}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{providerForm.meta_description || 'Descrição do perfil...'}</p>
                  </div>
                  <Button size="sm" onClick={saveProvider} className="w-full">Salvar SEO</Button>
                </div>
              ) : (
                <EmptyState icon={<Search />} text="Sem perfil profissional" />
              )}
            </TabsContent>

            {/* ====== AUDIENCE TAB (Contact Clicks) ====== */}
            <TabsContent value="audience" className="space-y-4 mt-0">
              {provider ? (
                <div className="rounded-xl border border-border p-3 sm:p-4 space-y-4">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Dados de Audiência</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-muted/40 border border-border/50 p-2.5 text-center">
                      <p className="text-lg font-bold text-foreground">{contactClicks.length}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Cliques</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 border border-border/50 p-2.5 text-center">
                      <p className="text-lg font-bold text-foreground">{contactClicks.filter((c: any) => c.contact_type === 'whatsapp').length}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">WhatsApp</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 border border-border/50 p-2.5 text-center">
                      <p className="text-lg font-bold text-foreground">{contactClicks.filter((c: any) => c.contact_type === 'phone').length}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Telefone</p>
                    </div>
                  </div>
                  {contactClicks.length > 0 ? (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Últimos cliques</p>
                      {contactClicks.slice(0, 30).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            {c.contact_type === 'whatsapp' ? <MessageCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Phone className="h-3.5 w-3.5 text-blue-500" />}
                            <span className="font-medium capitalize">{c.contact_type}</span>
                          </div>
                          <span className="text-muted-foreground">{c.created_at ? format(new Date(c.created_at), 'dd/MM/yy HH:mm') : ''}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum clique registrado ainda</p>
                  )}
                </div>
              ) : (
                <EmptyState icon={<BarChart3 />} text="Sem perfil profissional" />
              )}
            </TabsContent>

            {/* ====== TAGS TAB ====== */}
            <TabsContent value="tags" className="space-y-4 mt-0">
              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-4">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> Tags</h3>
                {userTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {userTags.map(t => (
                      <div key={t.id} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-white" style={{ backgroundColor: t.color }}>
                        {t.tag_name}
                        <button onClick={() => removeTag(t.id, t.tag_name)} className="ml-1 hover:bg-white/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Rápidas:</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_TAGS.filter(pt => !userTags.find(ut => ut.tag_name === pt.name)).map(pt => (
                      <button key={pt.name} onClick={() => addTag(pt.name, pt.color)} disabled={tagsLoading}
                        className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted transition-colors">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pt.color }} />{pt.name}<Plus className="h-3 w-3 ml-0.5" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Tag personalizada..." className="h-8 text-sm flex-1" onKeyDown={e => e.key === 'Enter' && addTag()} />
                  <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="h-8 w-8 rounded border border-border cursor-pointer" />
                  <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => addTag()} disabled={!newTagName.trim() || tagsLoading}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ====== LEADS TAB ====== */}
            <TabsContent value="leads" className="space-y-3 mt-0">
              <p className="text-xs text-muted-foreground">{leads.length} lead(s)</p>
              {leads.length === 0 ? (
                <EmptyState icon={<MessageCircle />} text="Nenhum lead" />
              ) : (
                <div className="space-y-2">
                  {leads.map(l => (
                    <div key={l.id} className="rounded-lg border border-border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">{l.client_name}</p>
                        <Badge variant="outline" className="text-[10px] capitalize">{l.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{l.service_needed || ''}</p>
                      {l.message && <p className="text-xs text-muted-foreground italic">"{l.message}"</p>}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span><Phone className="h-3 w-3 inline mr-0.5" />{l.phone}</span>
                        <span>{l.created_at ? format(new Date(l.created_at), 'dd/MM/yy HH:mm') : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ====== MODERATION TAB ====== */}
            <TabsContent value="moderation" className="space-y-4 mt-0">
              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-4">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2"><Ban className="h-4 w-4" /> Moderação</h3>
                {(isSuspended || isBanned) ? (
                  <div className={`rounded-lg p-4 space-y-3 ${isBanned ? 'bg-destructive/5 border border-destructive/20' : 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800'}`}>
                    <div className="flex items-center gap-2">
                      {isBanned ? <Ban className="h-5 w-5 text-destructive" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                      <span className="font-medium text-sm">{isBanned ? 'Banido' : 'Suspenso'}</span>
                    </div>
                    {user.suspended_reason && <p className="text-xs text-muted-foreground">Motivo: {user.suspended_reason}</p>}
                    {user.suspended_at && <p className="text-xs text-muted-foreground">Data: {format(new Date(user.suspended_at), 'dd/MM/yyyy HH:mm')}</p>}
                    <Button size="sm" onClick={reactivateUser} disabled={suspendLoading} className="w-full">Reativar</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Motivo</Label>
                      <Textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="Ex: Violação dos termos..." className="text-sm min-h-[60px]" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button size="sm" variant="outline" className="h-9 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300"
                        onClick={suspendUser} disabled={suspendLoading || !suspendReason.trim()}>
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Suspender
                      </Button>
                      <Button size="sm" variant="destructive" className="h-9 text-xs" onClick={banUser} disabled={suspendLoading}>
                        <Ban className="h-3.5 w-3.5 mr-1" /> Banir
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Suspensão é reversível. Banimento é permanente.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ====== PERMISSIONS TAB ====== */}
            <TabsContent value="perms" className="space-y-4 mt-0">
              {/* Roles */}
              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Roles</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div><p className="text-sm font-medium">Admin</p><p className="text-xs text-muted-foreground">Acesso total</p></div>
                    <Button size="sm" variant={userIsAdmin ? 'destructive' : 'default'} className="h-8 text-xs shrink-0" onClick={toggleAdmin} disabled={permLoading}>
                      {userIsAdmin ? 'Revogar' : 'Conceder'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div><p className="text-sm font-medium flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Moderador</p><p className="text-xs text-muted-foreground">Moderação</p></div>
                    <Button size="sm" variant={userIsModerator ? 'destructive' : 'default'} className="h-8 text-xs shrink-0" onClick={toggleModerator} disabled={permLoading}>
                      {userIsModerator ? 'Revogar' : 'Conceder'}
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm font-medium">Patrocinador</p></div>
                      <Button size="sm" variant={userIsSponsor ? 'destructive' : 'default'} className="h-8 text-xs shrink-0" onClick={toggleSponsor} disabled={permLoading}>
                        {userIsSponsor ? 'Revogar' : 'Conceder'}
                      </Button>
                    </div>
                    {!userIsSponsor && (
                      <Select value={selectedSponsorId} onValueChange={setSelectedSponsorId}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {sponsors.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>

              {/* Granular permissions */}
              <UserPermissionsPanel user={user} onRefresh={onRefresh} />
            </TabsContent>

            {/* ====== PAGE SETTINGS TAB ====== */}
            <TabsContent value="page" className="space-y-3 mt-0">
              {!provider ? (
                <EmptyState icon={<Settings />} text="Sem perfil profissional" />
              ) : (
                <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-1"><Settings className="h-4 w-4" /> Página</h3>
                  <div className="space-y-3">
                    <div><Label className="text-xs">Headline</Label><Input value={settingsForm.headline || ''} onChange={e => setSettingsForm({ ...settingsForm, headline: e.target.value })} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">Tagline</Label><Input value={settingsForm.tagline || ''} onChange={e => setSettingsForm({ ...settingsForm, tagline: e.target.value })} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">CTA</Label><Input value={settingsForm.cta_text || ''} onChange={e => setSettingsForm({ ...settingsForm, cta_text: e.target.value })} className="h-8 text-sm" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Tema</Label>
                        <Select value={settingsForm.theme || 'default'} onValueChange={v => setSettingsForm({ ...settingsForm, theme: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['default', 'moderno', 'classico', 'minimalista', 'dark', 'neon', 'vintage', 'natureza'].map(t => (
                              <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Cor Accent</Label>
                        <Input value={settingsForm.accent_color || ''} onChange={e => setSettingsForm({ ...settingsForm, accent_color: e.target.value })} className="h-8 text-sm" placeholder="217 91% 50%" />
                      </div>
                    </div>
                    <Button size="sm" onClick={savePageSettings} className="w-full">Salvar</Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ====== TIMELINE TAB ====== */}
            <TabsContent value="timeline" className="space-y-2 mt-0">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-3"><Clock className="h-4 w-4" /> Histórico</h3>
              {activityTimeline.length === 0 ? (
                <EmptyState icon={<History />} text="Sem atividade" />
              ) : (
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-0">
                    {activityTimeline.map((item, idx) => (
                      <div key={item.id + '-' + idx} className="relative pl-8 pb-4">
                        <div className={`absolute left-1.5 top-1 h-3 w-3 rounded-full border-2 border-background ${item.type === 'admin_action' ? 'bg-amber-400' : 'bg-primary'}`} />
                        <div className="rounded-lg border border-border p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="outline" className="text-[10px] shrink-0">{actionLabel(item.action)}</Badge>
                              <span className="text-[10px] text-muted-foreground capitalize">{item.resource_type}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {item.created_at ? format(new Date(item.created_at), 'dd/MM/yy HH:mm') : ''}
                            </span>
                          </div>
                          {item.type === 'admin_action' && item.user_id !== user.id && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400">Ação admin</p>
                          )}
                          {item.details?.changes && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {Object.entries(item.details.changes as Record<string, any>).slice(0, 3).map(([field, val]) => (
                                <p key={field}>
                                  <span className="font-medium">{field}:</span>{' '}
                                  {typeof val === 'object' && val?.from !== undefined ? `${String(val.from)} → ${String(val.to)}` : String(val)}
                                </p>
                              ))}
                            </div>
                          )}
                          {item.details?.reason && <p className="text-xs text-muted-foreground">Motivo: {item.details.reason}</p>}
                          {item.details?.tag && <p className="text-xs text-muted-foreground">Tag: {item.details.tag}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Helper components
const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-2 sm:gap-3 text-sm">
    <span className="text-muted-foreground shrink-0">{icon}</span>
    <span className="text-muted-foreground text-xs w-16 sm:w-20 shrink-0">{label}</span>
    <span className="text-foreground text-xs break-all min-w-0">{value}</span>
  </div>
);

const EmptyState = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="text-center py-8 text-muted-foreground text-sm">
    <div className="mx-auto mb-2 opacity-30 [&>svg]:h-8 [&>svg]:w-8 [&>svg]:mx-auto">{icon}</div>
    {text}
  </div>
);

// Granular permissions panel
const PERM_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', profile: 'Perfil', services: 'Serviços', my_page: 'Minha Página',
  jobs: 'Vagas', community: 'Comunidade', notifications: 'Notificações', leads: 'Leads',
  plan: 'Plano', reviews: 'Avaliações', admin_panel: 'Admin', sponsor_panel: 'Patrocinador',
};

const DEFAULT_USER_PERMS: Record<string, boolean> = {
  dashboard: true, profile: true, services: true, my_page: true,
  jobs: true, community: true, notifications: true, leads: true,
  plan: true, reviews: true, admin_panel: true, sponsor_panel: true,
};

const UserPermissionsPanel = ({ user, onRefresh }: { user: any; onRefresh?: () => void }) => {
  const [perms, setPerms] = useState<Record<string, boolean>>(DEFAULT_USER_PERMS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setPerms({ ...DEFAULT_USER_PERMS, ...(user.permissions as Record<string, boolean> || {}) });
  }, [user?.id, user?.permissions]);

  const toggle = (key: string) => setPerms(prev => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ permissions: perms } as any).eq('id', user.id);
    if (error) toast.error('Erro');
    else {
      toast.success('Permissões salvas');
      await logAuditAction({ action: 'update_permissions', resource_type: 'user', resource_id: user.id, details: { permissions: perms } });
      onRefresh?.();
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-border p-3 sm:p-4 space-y-4">
      <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /><h3 className="font-semibold text-foreground text-sm">Permissões</h3></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(PERM_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm text-foreground">{label}</span>
            <Switch checked={perms[key] ?? true} onCheckedChange={() => toggle(key)} />
          </div>
        ))}
      </div>
      <Button size="sm" onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Salvar Permissões
      </Button>
    </div>
  );
};

export default UserDetailSheet;
