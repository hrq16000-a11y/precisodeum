import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  Shield, Mail, Phone, Calendar, UserCheck, Briefcase, FileText, History,
  ImageIcon, Settings, Camera, Loader2, Trash2, Plus, ExternalLink,
  Eye, MapPin, Globe, MessageCircle, ArrowUp, ArrowDown, Upload, Key, Lock,
  Tag, Ban, AlertTriangle, X, Clock
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

const UserDetailSheet = ({ user, isAdmin, onClose, onRefresh }: UserDetailSheetProps) => {
  const [services, setServices] = useState<any[]>([]);
  const [serviceImages, setServiceImages] = useState<Record<string, any[]>>({});
  const [leads, setLeads] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<{ id: string; name: string; photos: { id: string; image_url: string; name: string }[] }[]>([]);
  const [pageSettings, setPageSettings] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [tab, setTab] = useState('profile');
  const [settingsForm, setSettingsForm] = useState<any>({});
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState('');
  const avatarRef = useRef<HTMLInputElement>(null);

  // Editable profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<any>({});

  // Editable provider state
  const [editingProvider, setEditingProvider] = useState(false);
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

  // Password reset inline
  const [showResetPw, setShowResetPw] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPw, setResettingPw] = useState(false);

  // Tags state
  const [userTags, setUserTags] = useState<any[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [tagsLoading, setTagsLoading] = useState(false);

  // Suspension state
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);

  // Activity timeline
  const [activityTimeline, setActivityTimeline] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    setTab('profile');
    setPageSettings(null);
    setProvider(null);
    setCurrentAvatar(user.avatar_url || '');
    setEditingProfile(false);
    setEditingProvider(false);
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

    // Fetch permissions
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

    // Levels & Account Types
    supabase.from('user_levels').select('id, name, color').order('priority', { ascending: false })
      .then(({ data }) => setLevels(data || []));
    supabase.from('account_types').select('id, name, color').order('display_order')
      .then(({ data }) => setAccountTypes(data || []));

    // Fetch tags
    fetchTags(user.id);

    // Fetch provider + related data
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
        });

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

        // Fetch portfolio albums + photos
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
                  id: p.id,
                  image_url: p.image_url,
                  name: p.original_name || '',
                })),
              })));
            } else {
              const { data: files } = await supabase.storage.from('portfolio').list(user.id, { limit: 100 });
              if (files) {
                const filtered = files.filter(f => f.name !== '.emptyFolderPlaceholder');
                setPortfolio([{
                  id: 'legacy',
                  name: 'Portfólio',
                  photos: filtered.map(f => ({
                    id: f.name,
                    image_url: supabase.storage.from('portfolio').getPublicUrl(`${user.id}/${f.name}`).data.publicUrl,
                    name: f.name,
                  })),
                }]);
              } else {
                setPortfolio([]);
              }
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
    } else {
      setMedia([]);
    }

    // Audit (both by user_id and resource_id for comprehensive timeline)
    fetchActivityTimeline(user.id);

    supabase.from('audit_log').select('*').eq('resource_id', user.id).eq('resource_type', 'user')
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setAuditLogs(data || []));
  }, [user?.id]);

  // === Fetch Tags ===
  const fetchTags = async (userId: string) => {
    const { data } = await supabase.from('user_tags').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setUserTags(data || []);
  };

  // === Add Tag ===
  const addTag = async (tagName?: string, tagColor?: string) => {
    if (!user) return;
    const name = (tagName || newTagName).trim();
    if (!name) return;
    setTagsLoading(true);
    const { error } = await supabase.from('user_tags').insert({
      user_id: user.id,
      tag_name: name,
      color: tagColor || newTagColor,
    } as any);
    if (error) {
      if (error.code === '23505') toast.error('Tag já existe para este usuário');
      else toast.error('Erro: ' + error.message);
    } else {
      await logAuditAction({ action: 'tag_added', resource_type: 'user', resource_id: user.id, details: { tag: name } });
      toast.success(`Tag "${name}" adicionada`);
      setNewTagName('');
      fetchTags(user.id);
    }
    setTagsLoading(false);
  };

  // === Remove Tag ===
  const removeTag = async (tagId: string, tagName: string) => {
    if (!user) return;
    await supabase.from('user_tags').delete().eq('id', tagId);
    await logAuditAction({ action: 'tag_removed', resource_type: 'user', resource_id: user.id, details: { tag: tagName } });
    toast.success(`Tag "${tagName}" removida`);
    fetchTags(user.id);
  };

  // === Suspend User ===
  const suspendUser = async () => {
    if (!user || !suspendReason.trim()) {
      toast.error('Informe o motivo da suspensão');
      return;
    }
    setSuspendLoading(true);
    const { error } = await supabase.from('profiles').update({
      status: 'suspended',
      suspended_at: new Date().toISOString(),
      suspended_reason: suspendReason.trim(),
      suspended_by: (await supabase.auth.getUser()).data.user?.id,
    } as any).eq('id', user.id);
    if (error) { toast.error('Erro: ' + error.message); }
    else {
      await logAuditAction({ action: 'suspend', resource_type: 'user', resource_id: user.id, details: { reason: suspendReason } });
      // Send notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: '⚠️ Conta Suspensa',
        message: `Sua conta foi suspensa. Motivo: ${suspendReason}`,
        type: 'system',
      });
      toast.success('Usuário suspenso');
      setSuspendReason('');
      onRefresh?.();
    }
    setSuspendLoading(false);
  };

  // === Ban User ===
  const banUser = async () => {
    if (!user) return;
    setSuspendLoading(true);
    const { error } = await supabase.from('profiles').update({
      status: 'banned',
      suspended_at: new Date().toISOString(),
      suspended_reason: suspendReason.trim() || 'Banido pelo administrador',
      suspended_by: (await supabase.auth.getUser()).data.user?.id,
    } as any).eq('id', user.id);
    if (error) { toast.error('Erro: ' + error.message); }
    else {
      await logAuditAction({ action: 'ban', resource_type: 'user', resource_id: user.id, details: { reason: suspendReason || 'Banido' } });
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: '🚫 Conta Banida',
        message: `Sua conta foi banida permanentemente.`,
        type: 'system',
      });
      toast.success('Usuário banido');
      onRefresh?.();
    }
    setSuspendLoading(false);
  };

  // === Reactivate User ===
  const reactivateUser = async () => {
    if (!user) return;
    setSuspendLoading(true);
    const { error } = await supabase.from('profiles').update({
      status: 'active',
      suspended_at: null,
      suspended_reason: '',
      suspended_by: null,
    } as any).eq('id', user.id);
    if (error) { toast.error('Erro: ' + error.message); }
    else {
      await logAuditAction({ action: 'reactivate', resource_type: 'user', resource_id: user.id, details: {} });
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: '✅ Conta Reativada',
        message: 'Sua conta foi reativada pelo administrador.',
        type: 'system',
      });
      toast.success('Usuário reativado');
      onRefresh?.();
    }
    setSuspendLoading(false);
  };

  // === Activity Timeline ===
  const fetchActivityTimeline = async (userId: string) => {
    // Combine multiple sources into a single timeline
    const timeline: any[] = [];

    // Audit actions by this user
    const { data: userActions } = await supabase.from('audit_log')
      .select('id, action, resource_type, resource_id, details, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    (userActions || []).forEach(a => timeline.push({ ...a, source: 'audit', type: 'action' }));

    // Audit actions on this user
    const { data: onUser } = await supabase.from('audit_log')
      .select('id, action, resource_type, resource_id, details, created_at, user_id')
      .eq('resource_id', userId).eq('resource_type', 'user')
      .order('created_at', { ascending: false })
      .limit(20);
    (onUser || []).forEach(a => {
      if (!timeline.find(t => t.id === a.id)) {
        timeline.push({ ...a, source: 'audit', type: 'admin_action' });
      }
    });

    // Sort by date desc
    timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setActivityTimeline(timeline.slice(0, 50));
  };

  // === Avatar Upload ===
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

  // === Save Profile (with level, account_type, department) ===
  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      full_name: profileForm.full_name,
      phone: profileForm.phone,
      whatsapp: (profileForm.whatsapp || '').replace(/\D/g, ''),
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
    setEditingProfile(false);
    onRefresh?.();
  };

  // === Save Provider ===
  const saveProvider = async () => {
    if (!provider) return;
    const { error } = await supabase.from('providers').update(providerForm).eq('id', provider.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Dados profissionais salvos!');
    setEditingProvider(false);
  };

  // === Save Page Settings ===
  const savePageSettings = async () => {
    if (!provider) return;
    const payload = { ...settingsForm, provider_id: provider.id };
    let error;
    if (pageSettings?.id) {
      ({ error } = await supabase.from('provider_page_settings').update(payload).eq('id', pageSettings.id));
    } else {
      ({ error } = await supabase.from('provider_page_settings').insert(payload));
    }
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Configurações salvas!'); }
  };

  // === Password Reset Inline ===
  const handleResetPassword = async () => {
    if (!user || !newPassword) return;
    if (newPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    setResettingPw(true);
    try {
      const res = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: user.id, new_password: newPassword },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      await logAuditAction({
        action: 'update', resource_type: 'user', resource_id: user.id,
        details: { target_user_id: user.id, changes: { password: { from: '***', to: '***' } } },
      });
      toast.success('Senha redefinida!');
      setShowResetPw(false);
      setNewPassword('');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Falha ao redefinir'));
    }
    setResettingPw(false);
  };

  // Portfolio is now read-only in admin — managed via dashboard/portfolio
  const totalPortfolioPhotos = portfolio.reduce((acc, a) => acc + a.photos.length, 0);

  const deleteServiceImage = async (img: any) => {
    const urlParts = img.image_url.split('/service-images/');
    if (urlParts[1]) await supabase.storage.from('service-images').remove([decodeURIComponent(urlParts[1])]);
    await supabase.from('service_images').delete().eq('id', img.id);
    setServiceImages(prev => {
      const copy = { ...prev };
      copy[img.service_id] = (copy[img.service_id] || []).filter(i => i.id !== img.id);
      return copy;
    });
    toast.success('Imagem removida');
  };

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      update: 'Editado', deactivate: 'Desativado', activate: 'Ativado',
      block: 'Bloqueado', unblock: 'Desbloqueado', make_admin: 'Promovido',
      reset_password: 'Senha redefinida', soft_delete: 'Soft-deleted',
      bulk_active: 'Ativação em massa', bulk_inactive: 'Desativação em massa',
      export: 'Exportação', create: 'Criado',
      suspend: '⛔ Suspenso', ban: '🚫 Banido', reactivate: '✅ Reativado',
      tag_added: '🏷️ Tag adicionada', tag_removed: '🏷️ Tag removida',
      update_permissions: '🔐 Permissões',
      plan_synced: '📦 Plano sincronizado',
    };
    return map[action] || action;
  };

  // === Toggle Admin ===
  const toggleAdmin = async () => {
    if (!user) return;
    setPermLoading(true);
    if (userIsAdmin) {
      await supabase.from('user_roles').delete().eq('user_id', user.id).eq('role', 'admin');
      await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: { admin: { from: true, to: false } } } });
      toast.success('Permissão de admin removida');
      setUserIsAdmin(false);
    } else {
      await supabase.from('user_roles').insert({ user_id: user.id, role: 'admin' } as any);
      await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: { admin: { from: false, to: true } } } });
      toast.success('Usuário promovido a admin');
      setUserIsAdmin(true);
    }
    setPermLoading(false);
    onRefresh?.();
  };

  // === Toggle Moderator ===
  const toggleModerator = async () => {
    if (!user) return;
    setPermLoading(true);
    if (userIsModerator) {
      await supabase.from('user_roles').delete().eq('user_id', user.id).eq('role', 'moderator');
      await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: { moderator: { from: true, to: false } } } });
      toast.success('Permissão de moderador removida');
      setUserIsModerator(false);
    } else {
      await supabase.from('user_roles').insert({ user_id: user.id, role: 'moderator' } as any);
      await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: { moderator: { from: false, to: true } } } });
      toast.success('Usuário promovido a moderador');
      setUserIsModerator(true);
    }
    setPermLoading(false);
    onRefresh?.();
  };

  // === Toggle Sponsor ===
  const toggleSponsor = async () => {
    if (!user) return;
    setPermLoading(true);
    if (userIsSponsor) {
      await supabase.from('sponsor_contacts').delete().eq('user_id', user.id);
      await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: { sponsor: { from: true, to: false } } } });
      toast.success('Acesso de patrocinador removido');
      setUserIsSponsor(false);
      setSelectedSponsorId('');
    } else {
      if (!selectedSponsorId) { toast.error('Selecione um patrocinador'); setPermLoading(false); return; }
      await supabase.from('sponsor_contacts').insert({
        user_id: user.id,
        sponsor_id: selectedSponsorId,
        contact_name: user.full_name || '',
        email: user.email || '',
      });
      await logAuditAction({ action: 'update', resource_type: 'user', resource_id: user.id, details: { changes: { sponsor: { from: false, to: true }, sponsor_id: selectedSponsorId } } });
      toast.success('Acesso de patrocinador concedido');
      setUserIsSponsor(true);
    }
    setPermLoading(false);
    onRefresh?.();
  };

  if (!user) return null;

  const initials = (user.full_name || '?')[0]?.toUpperCase();
  const levelName = levels.find(l => l.id === user.level_id)?.name;
  const levelColor = levels.find(l => l.id === user.level_id)?.color;
  const accountTypeName = accountTypes.find(a => a.id === user.account_type_id)?.name;
  const accountTypeColor = accountTypes.find(a => a.id === user.account_type_id)?.color;
  const isSuspended = user.status === 'suspended';
  const isBanned = user.status === 'banned';

  return (
    <Sheet open={!!user} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {/* Hero Header */}
        <div className={`relative px-4 sm:px-6 pt-6 pb-4 ${isBanned ? 'bg-gradient-to-r from-destructive/15 to-destructive/5' : isSuspended ? 'bg-gradient-to-r from-amber-500/15 to-amber-500/5' : 'bg-gradient-to-r from-primary/10 to-accent/10'}`}>
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="relative shrink-0">
              <Avatar className={`h-16 w-16 sm:h-20 sm:w-20 border-4 shadow-lg ${isBanned ? 'border-destructive/50' : isSuspended ? 'border-amber-400/50' : 'border-background'}`}>
                <AvatarImage src={currentAvatar || undefined} alt={user.full_name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl sm:text-2xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => avatarRef.current?.click()}
                disabled={avatarUploading}
                className="absolute bottom-0 right-0 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md hover:bg-accent/90 transition-colors"
              >
                {avatarUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-bold text-foreground truncate">{user.full_name || '—'}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{user.email || ''}</p>
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                {isAdmin && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">👑 Admin</Badge>}
                {userIsModerator && <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-[10px]">🛡️ Mod</Badge>}
                {isBanned ? (
                  <Badge variant="destructive" className="text-[10px]">🚫 Banido</Badge>
                ) : isSuspended ? (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">⛔ Suspenso</Badge>
                ) : (
                  <Badge variant={user.status === 'inactive' ? 'destructive' : 'default'} className="text-[10px]">
                    {user.status === 'inactive' ? '🔴 Inativo' : '🟢 Ativo'}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] capitalize">
                  {user.profile_type === 'provider' ? '🔧 Profissional' : user.profile_type === 'rh' ? '🏢 Agência' : '👤 Cliente'}
                </Badge>
                {provider?.plan && <Badge variant="outline" className="text-[10px]">⭐ {provider.plan}</Badge>}
                {levelName && (
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: levelColor, color: levelColor }}>
                    {levelName}
                  </Badge>
                )}
                {accountTypeName && (
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: accountTypeColor, color: accountTypeColor }}>
                    {accountTypeName}
                  </Badge>
                )}
              </div>
              {/* User Tags in header */}
              {userTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {userTags.map(t => (
                    <Badge key={t.id} className="text-[9px] text-white" style={{ backgroundColor: t.color }}>
                      {t.tag_name}
                    </Badge>
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
                {isBanned ? 'Conta banida permanentemente' : 'Conta suspensa temporariamente'}
              </div>
              {user.suspended_reason && <p className="mt-1 opacity-80">Motivo: {user.suspended_reason}</p>}
              {user.suspended_at && <p className="mt-0.5 opacity-60">Em: {format(new Date(user.suspended_at), 'dd/MM/yyyy HH:mm')}</p>}
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={reactivateUser} disabled={suspendLoading}>
                ✅ Reativar Conta
              </Button>
            </div>
          )}
          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-3">
            {user.whatsapp && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
                <a href={`https://wa.me/${(user.whatsapp || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
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
            {user.user_ref && (
              <Badge variant="secondary" className="text-[10px] font-mono">{user.user_ref}</Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-6 pt-4 pb-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full grid grid-cols-5 sm:grid-cols-10 mb-4 h-auto">
              <TabsTrigger value="profile" className="text-xs gap-1 px-1"><UserCheck className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Perfil</span></TabsTrigger>
              <TabsTrigger value="provider" className="text-xs gap-1 px-1"><Briefcase className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Negócio</span></TabsTrigger>
              <TabsTrigger value="services" className="text-xs gap-1 px-1"><FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Serviços</span></TabsTrigger>
              <TabsTrigger value="portfolio" className="text-xs gap-1 px-1"><ImageIcon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Fotos</span></TabsTrigger>
              <TabsTrigger value="tags" className="text-xs gap-1 px-1"><Tag className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Tags</span></TabsTrigger>
              <TabsTrigger value="leads" className="text-xs gap-1 px-1 hidden sm:flex"><MessageCircle className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Leads</span></TabsTrigger>
              <TabsTrigger value="moderation" className="text-xs gap-1 px-1 hidden sm:flex"><Ban className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Moderação</span></TabsTrigger>
              <TabsTrigger value="perms" className="text-xs gap-1 px-1 hidden sm:flex"><Lock className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Permissões</span></TabsTrigger>
              <TabsTrigger value="page" className="text-xs gap-1 px-1 hidden sm:flex"><Settings className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Página</span></TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs gap-1 px-1 hidden sm:flex"><Clock className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Timeline</span></TabsTrigger>
            </TabsList>
            {/* Mobile extra tabs row */}
            <div className="sm:hidden mb-4">
              <TabsList className="w-full grid grid-cols-5 h-auto">
                <TabsTrigger value="leads" className="text-xs gap-1 px-1"><MessageCircle className="h-3.5 w-3.5" /> Leads</TabsTrigger>
                <TabsTrigger value="moderation" className="text-xs gap-1 px-1"><Ban className="h-3.5 w-3.5" /> Mod.</TabsTrigger>
                <TabsTrigger value="perms" className="text-xs gap-1 px-1"><Lock className="h-3.5 w-3.5" /> Perm.</TabsTrigger>
                <TabsTrigger value="page" className="text-xs gap-1 px-1"><Settings className="h-3.5 w-3.5" /> Página</TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs gap-1 px-1"><Clock className="h-3.5 w-3.5" /> Timeline</TabsTrigger>
              </TabsList>
            </div>

            {/* ====== PROFILE TAB ====== */}
            <TabsContent value="profile" className="space-y-4 mt-0">
              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm">Dados Pessoais</h3>
                  <Button size="sm" variant={editingProfile ? 'accent' : 'outline'} className="h-7 text-xs" onClick={() => setEditingProfile(!editingProfile)}>
                    {editingProfile ? 'Cancelar' : 'Editar'}
                  </Button>
                </div>
                {editingProfile ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Nome completo</Label>
                      <Input value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">E-mail</Label>
                      <Input value={user.email || ''} disabled className="h-8 text-sm opacity-60" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Telefone</Label>
                        <Input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">WhatsApp</Label>
                        <Input value={profileForm.whatsapp} onChange={e => setProfileForm({ ...profileForm, whatsapp: e.target.value })} className="h-8 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Tipo de Conta</Label>
                        <Select value={profileForm.profile_type} onValueChange={v => setProfileForm({ ...profileForm, profile_type: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="client">Cliente</SelectItem>
                            <SelectItem value="provider">Profissional</SelectItem>
                            <SelectItem value="rh">Agência / RH</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Status</Label>
                        <Select value={profileForm.status} onValueChange={v => setProfileForm({ ...profileForm, status: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="inactive">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Nível</Label>
                        <Select value={profileForm.level_id || 'none'} onValueChange={v => setProfileForm({ ...profileForm, level_id: v === 'none' ? '' : v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {levels.map(l => (
                              <SelectItem key={l.id} value={l.id}>
                                <div className="flex items-center gap-2">
                                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                                  {l.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Tipo de Plano</Label>
                        <Select value={profileForm.account_type_id || 'none'} onValueChange={v => setProfileForm({ ...profileForm, account_type_id: v === 'none' ? '' : v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {accountTypes.map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                <div className="flex items-center gap-2">
                                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                                  {a.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Departamento</Label>
                      <Input value={profileForm.department} onChange={e => setProfileForm({ ...profileForm, department: e.target.value })} className="h-8 text-sm" placeholder="Ex: TI, Vendas..." />
                    </div>
                    <Button size="sm" onClick={saveProfile} className="w-full">💾 Salvar Alterações</Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <InfoRow icon={<Mail className="h-4 w-4" />} label="E-mail" value={user.email || '—'} />
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={user.phone || '—'} />
                    <InfoRow icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" value={user.whatsapp || '—'} />
                    <InfoRow icon={<UserCheck className="h-4 w-4" />} label="Tipo" value={user.profile_type === 'provider' ? 'Profissional' : user.profile_type === 'rh' ? 'Agência/RH' : 'Cliente'} />
                    <InfoRow icon={<Shield className="h-4 w-4" />} label="Status" value={isBanned ? '🚫 Banido' : isSuspended ? '⛔ Suspenso' : user.status === 'inactive' ? '🔴 Inativo' : '🟢 Ativo'} />
                    <InfoRow icon={<Calendar className="h-4 w-4" />} label="Cadastro" value={user.created_at ? format(new Date(user.created_at), 'dd/MM/yyyy HH:mm') : '—'} />
                    {user.user_ref && <InfoRow icon={<Shield className="h-4 w-4" />} label="Ref" value={user.user_ref} />}
                    {user.department && <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Depto" value={user.department} />}
                    {provider?.plan && <InfoRow icon={<Eye className="h-4 w-4" />} label="Plano" value={provider.plan} />}
                    {levelName && <InfoRow icon={<ArrowUp className="h-4 w-4" />} label="Nível" value={levelName} />}
                    {accountTypeName && <InfoRow icon={<Shield className="h-4 w-4" />} label="Tipo Conta" value={accountTypeName} />}
                    <InfoRow icon={<ArrowUp className="h-4 w-4" />} label="Pontos" value={String(user.engagement_points || 0)} />
                  </div>
                )}
              </div>

              {/* Password Reset Section */}
              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <Key className="h-4 w-4" /> Senha
                  </h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowResetPw(!showResetPw)}>
                    {showResetPw ? 'Cancelar' : 'Redefinir Senha'}
                  </Button>
                </div>
                {showResetPw && (
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Nova senha (mín. 6 chars)"
                      className="h-8 text-sm flex-1"
                    />
                    <Button size="sm" className="h-8 text-xs shrink-0" onClick={handleResetPassword} disabled={resettingPw || newPassword.length < 6}>
                      {resettingPw ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3 mr-1" />}
                      {resettingPw ? '...' : 'Aplicar'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Permissions Section */}
              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Permissões & Roles
                </h3>
                <div className="space-y-3">
                  {/* Admin Toggle */}
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">👑 Administrador</p>
                      <p className="text-xs text-muted-foreground">Acesso total ao painel</p>
                    </div>
                    <Button
                      size="sm"
                      variant={userIsAdmin ? 'destructive' : 'default'}
                      className="h-8 text-xs shrink-0"
                      onClick={toggleAdmin}
                      disabled={permLoading}
                    >
                      {userIsAdmin ? 'Revogar' : 'Conceder'}
                    </Button>
                  </div>

                  {/* Moderator Toggle */}
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">🛡️ Moderador</p>
                      <p className="text-xs text-muted-foreground">Moderação de conteúdo e usuários</p>
                    </div>
                    <Button
                      size="sm"
                      variant={userIsModerator ? 'destructive' : 'default'}
                      className="h-8 text-xs shrink-0"
                      onClick={toggleModerator}
                      disabled={permLoading}
                    >
                      {userIsModerator ? 'Revogar' : 'Conceder'}
                    </Button>
                  </div>

                  {/* Sponsor Toggle */}
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">📢 Patrocinador</p>
                        <p className="text-xs text-muted-foreground">Acesso ao painel de patrocinadores</p>
                      </div>
                      <Button
                        size="sm"
                        variant={userIsSponsor ? 'destructive' : 'default'}
                        className="h-8 text-xs shrink-0"
                        onClick={toggleSponsor}
                        disabled={permLoading}
                      >
                        {userIsSponsor ? 'Revogar' : 'Conceder'}
                      </Button>
                    </div>
                    {!userIsSponsor && (
                      <div>
                        <Label className="text-xs">Vincular a</Label>
                        <Select value={selectedSponsorId} onValueChange={setSelectedSponsorId}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione patrocinador..." /></SelectTrigger>
                          <SelectContent>
                            {sponsors.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ====== PROVIDER TAB ====== */}
            <TabsContent value="provider" className="space-y-4 mt-0">
              {!provider ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Este usuário não possui perfil profissional
                </div>
              ) : (
                <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground text-sm">Dados do Negócio</h3>
                    <Button size="sm" variant={editingProvider ? 'accent' : 'outline'} className="h-7 text-xs" onClick={() => setEditingProvider(!editingProvider)}>
                      {editingProvider ? 'Cancelar' : 'Editar'}
                    </Button>
                  </div>
                  {editingProvider ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Nome da Empresa</Label>
                        <Input value={providerForm.business_name} onChange={e => setProviderForm({ ...providerForm, business_name: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">Descrição</Label>
                        <Textarea value={providerForm.description} onChange={e => setProviderForm({ ...providerForm, description: e.target.value })} className="text-sm min-h-[60px]" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Cidade</Label>
                          <Input value={providerForm.city} onChange={e => setProviderForm({ ...providerForm, city: e.target.value })} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Estado</Label>
                          <Input value={providerForm.state} onChange={e => setProviderForm({ ...providerForm, state: e.target.value })} className="h-8 text-sm" />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <Label className="text-xs">Bairro</Label>
                          <Input value={providerForm.neighborhood} onChange={e => setProviderForm({ ...providerForm, neighborhood: e.target.value })} className="h-8 text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">WhatsApp</Label>
                          <Input value={providerForm.whatsapp} onChange={e => setProviderForm({ ...providerForm, whatsapp: e.target.value })} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Telefone</Label>
                          <Input value={providerForm.phone} onChange={e => setProviderForm({ ...providerForm, phone: e.target.value })} className="h-8 text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Website</Label>
                          <Input value={providerForm.website} onChange={e => setProviderForm({ ...providerForm, website: e.target.value })} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Horário</Label>
                          <Input value={providerForm.working_hours} onChange={e => setProviderForm({ ...providerForm, working_hours: e.target.value })} className="h-8 text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Experiência (anos)</Label>
                          <Input type="number" value={providerForm.years_experience} onChange={e => setProviderForm({ ...providerForm, years_experience: parseInt(e.target.value) || 0 })} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Raio de Atendimento</Label>
                          <Input value={providerForm.service_radius} onChange={e => setProviderForm({ ...providerForm, service_radius: e.target.value })} className="h-8 text-sm" />
                        </div>
                      </div>
                      <Button size="sm" onClick={saveProvider} className="w-full">💾 Salvar Dados do Negócio</Button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Empresa" value={provider.business_name || '—'} />
                      <InfoRow icon={<MapPin className="h-4 w-4" />} label="Local" value={[provider.neighborhood, provider.city, provider.state].filter(Boolean).join(', ') || '—'} />
                      <InfoRow icon={<Phone className="h-4 w-4" />} label="Fone" value={provider.phone || '—'} />
                      <InfoRow icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" value={provider.whatsapp || '—'} />
                      <InfoRow icon={<Globe className="h-4 w-4" />} label="Website" value={provider.website || '—'} />
                      <InfoRow icon={<Calendar className="h-4 w-4" />} label="Experiência" value={`${provider.years_experience} anos`} />
                      {provider.categories && <InfoRow icon={<FileText className="h-4 w-4" />} label="Categoria" value={`${(provider.categories as any)?.icon || ''} ${(provider.categories as any)?.name || ''}`} />}
                      <InfoRow icon={<Eye className="h-4 w-4" />} label="Avaliações" value={`${provider.rating_avg?.toFixed(1) || '0'} ⭐ (${provider.review_count || 0})`} />
                      {provider.slug && (
                        <div className="pt-2">
                          <a href={`/profissional/${provider.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> /profissional/{provider.slug}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ====== SERVICES TAB ====== */}
            <TabsContent value="services" className="space-y-3 mt-0">
              <p className="text-xs text-muted-foreground">{services.length} serviço(s) cadastrado(s)</p>
              {services.length === 0 ? (
                <EmptyState icon={<FileText />} text="Nenhum serviço vinculado" />
              ) : (
                <div className="space-y-3">
                  {services.map(s => {
                    const imgs = serviceImages[s.id] || [];
                    return (
                      <div key={s.id} className="rounded-xl border border-border overflow-hidden">
                        <div className="p-3 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground text-sm truncate">{s.service_name}</p>
                            {s.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{s.description}</p>}
                            <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-muted-foreground">
                              {s.price && <span>💰 {s.price}</span>}
                              <span>👁️ {s.view_count || 0} views</span>
                              <span>📅 {s.created_at ? format(new Date(s.created_at), 'dd/MM/yy') : ''}</span>
                            </div>
                          </div>
                          {s.deleted_at && <Badge variant="destructive" className="text-[10px] shrink-0">Excluído</Badge>}
                        </div>
                        {imgs.length > 0 && (
                          <div className="border-t border-border p-2">
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                              {imgs.map(img => (
                                <div key={img.id} className="relative group rounded-md overflow-hidden aspect-square">
                                  <img src={img.image_url} alt="" className="h-full w-full object-cover" loading="lazy" onError={handleImageError} />
                                  <button
                                    onClick={() => deleteServiceImage(img)}
                                    className="absolute inset-0 bg-destructive/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                  >
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
                <h3 className="font-semibold text-foreground text-sm">📸 Portfólio ({portfolio.length} {portfolio.length === 1 ? 'álbum' : 'álbuns'} • {totalPortfolioPhotos} fotos)</h3>
                {portfolio.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum álbum no portfólio</p>
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
                <p className="text-[10px] text-muted-foreground">Gerenciado pelo profissional em Dashboard → Portfólio</p>
              </div>

              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-sm">🗂️ Mídias ({media.length})</h3>
                {media.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhuma mídia</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {media.map(m => (
                      <div key={m.id} className="relative rounded-lg border border-border overflow-hidden">
                        {m.mime_type?.startsWith('image/') ? (
                          <img src={m.public_url} alt={m.original_name} className="w-full aspect-square object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full aspect-square bg-muted flex items-center justify-center text-xs text-muted-foreground">
                            {m.mime_type?.split('/')[1] || 'file'}
                          </div>
                        )}
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

            {/* ====== TAGS TAB ====== */}
            <TabsContent value="tags" className="space-y-4 mt-0">
              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-4">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Tags de Segmentação
                </h3>
                <p className="text-xs text-muted-foreground">Adicione tags para classificar e filtrar este usuário em campanhas.</p>

                {/* Current tags */}
                {userTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {userTags.map(t => (
                      <div key={t.id} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-white" style={{ backgroundColor: t.color }}>
                        {t.tag_name}
                        <button onClick={() => removeTag(t.id, t.tag_name)} className="ml-1 hover:bg-white/20 rounded-full p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Preset tags */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Tags rápidas:</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_TAGS.filter(pt => !userTags.find(ut => ut.tag_name === pt.name)).map(pt => (
                      <button
                        key={pt.name}
                        onClick={() => addTag(pt.name, pt.color)}
                        disabled={tagsLoading}
                        className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted transition-colors"
                      >
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pt.color }} />
                        {pt.name}
                        <Plus className="h-3 w-3 ml-0.5" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom tag */}
                <div className="flex gap-2">
                  <Input
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    placeholder="Tag personalizada..."
                    className="h-8 text-sm flex-1"
                    onKeyDown={e => e.key === 'Enter' && addTag()}
                  />
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={e => setNewTagColor(e.target.value)}
                    className="h-8 w-8 rounded border border-border cursor-pointer"
                  />
                  <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => addTag()} disabled={!newTagName.trim() || tagsLoading}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ====== LEADS TAB ====== */}
            <TabsContent value="leads" className="space-y-3 mt-0">
              <p className="text-xs text-muted-foreground">{leads.length} lead(s)</p>
              {leads.length === 0 ? (
                <EmptyState icon={<MessageCircle />} text="Nenhum lead recebido" />
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
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Ban className="h-4 w-4" /> Moderação de Conta
                </h3>

                {(isSuspended || isBanned) ? (
                  <div className={`rounded-lg p-4 space-y-3 ${isBanned ? 'bg-destructive/5 border border-destructive/20' : 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800'}`}>
                    <div className="flex items-center gap-2">
                      {isBanned ? <Ban className="h-5 w-5 text-destructive" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                      <span className="font-medium text-sm">{isBanned ? 'Usuário Banido' : 'Usuário Suspenso'}</span>
                    </div>
                    {user.suspended_reason && <p className="text-xs text-muted-foreground">Motivo: {user.suspended_reason}</p>}
                    {user.suspended_at && <p className="text-xs text-muted-foreground">Data: {format(new Date(user.suspended_at), 'dd/MM/yyyy HH:mm')}</p>}
                    <Button size="sm" onClick={reactivateUser} disabled={suspendLoading} className="w-full">
                      ✅ Reativar Conta
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Motivo (obrigatório para suspensão)</Label>
                        <Textarea
                          value={suspendReason}
                          onChange={e => setSuspendReason(e.target.value)}
                          placeholder="Ex: Violação dos termos de uso, spam, conteúdo impróprio..."
                          className="text-sm min-h-[60px]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20"
                          onClick={suspendUser}
                          disabled={suspendLoading || !suspendReason.trim()}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                          Suspender
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-9 text-xs"
                          onClick={banUser}
                          disabled={suspendLoading}
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          Banir Permanente
                        </Button>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      ⚠️ A suspensão é temporária e reversível. O banimento é permanente e notifica o usuário automaticamente.
                    </p>
                  </>
                )}
              </div>
            </TabsContent>

            {/* ====== PAGE SETTINGS TAB ====== */}
            <TabsContent value="page" className="space-y-3 mt-0">
              {!provider ? (
                <EmptyState icon={<Settings />} text="Usuário não é prestador" />
              ) : (
                <div className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
                  <h3 className="font-semibold text-foreground text-sm">⚙️ Configurações da Página</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Headline</Label>
                      <Input value={settingsForm.headline || ''} onChange={e => setSettingsForm({ ...settingsForm, headline: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Tagline</Label>
                      <Input value={settingsForm.tagline || ''} onChange={e => setSettingsForm({ ...settingsForm, tagline: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Texto do CTA</Label>
                      <Input value={settingsForm.cta_text || ''} onChange={e => setSettingsForm({ ...settingsForm, cta_text: e.target.value })} className="h-8 text-sm" />
                    </div>
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
                        <Label className="text-xs">Cor Accent (HSL)</Label>
                        <Input value={settingsForm.accent_color || ''} onChange={e => setSettingsForm({ ...settingsForm, accent_color: e.target.value })} className="h-8 text-sm" placeholder="217 91% 50%" />
                      </div>
                    </div>
                    <Button size="sm" onClick={savePageSettings} className="w-full">💾 Salvar Configurações</Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ====== PERMISSIONS TAB ====== */}
            <TabsContent value="perms" className="space-y-4 mt-0">
              <UserPermissionsPanel user={user} onRefresh={onRefresh} />
            </TabsContent>

            {/* ====== TIMELINE TAB ====== */}
            <TabsContent value="timeline" className="space-y-2 mt-0">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4" /> Histórico de Atividade
              </h3>
              {activityTimeline.length === 0 ? (
                <EmptyState icon={<History />} text="Nenhuma atividade registrada" />
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-0">
                    {activityTimeline.map((item, idx) => (
                      <div key={item.id + '-' + idx} className="relative pl-8 pb-4">
                        {/* Dot */}
                        <div className={`absolute left-1.5 top-1 h-3 w-3 rounded-full border-2 border-background ${
                          item.type === 'admin_action' ? 'bg-amber-400' : 'bg-primary'
                        }`} />
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
                            <p className="text-[10px] text-amber-600 dark:text-amber-400">Ação administrativa</p>
                          )}
                          {item.details?.changes && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {Object.entries(item.details.changes as Record<string, any>).slice(0, 3).map(([field, val]) => (
                                <p key={field}>
                                  <span className="font-medium">{field}:</span>{' '}
                                  {typeof val === 'object' && val?.from !== undefined
                                    ? `${String(val.from)} → ${String(val.to)}`
                                    : String(val)
                                  }
                                </p>
                              ))}
                            </div>
                          )}
                          {item.details?.reason && (
                            <p className="text-xs text-muted-foreground">Motivo: {item.details.reason}</p>
                          )}
                          {item.details?.tag && (
                            <p className="text-xs text-muted-foreground">Tag: {item.details.tag}</p>
                          )}
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

// ====== Per-user permissions panel ======
const PERM_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  profile: 'Meu Perfil',
  services: 'Serviços',
  my_page: 'Minha Página',
  jobs: 'Vagas',
  community: 'Comunidade',
  notifications: 'Notificações',
  leads: 'Leads',
  plan: 'Plano',
  reviews: 'Avaliações',
  admin_panel: 'Painel Admin',
  sponsor_panel: 'Painel Patrocinador',
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
    const p = user.permissions as Record<string, boolean> | null;
    setPerms({ ...DEFAULT_USER_PERMS, ...(p || {}) });
  }, [user?.id, user?.permissions]);

  const toggle = (key: string) => setPerms(prev => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ permissions: perms } as any).eq('id', user.id);
    if (error) toast.error('Erro ao salvar permissões');
    else {
      toast.success('Permissões atualizadas');
      await logAuditAction({ action: 'update_permissions', resource_type: 'user', resource_id: user.id, details: { permissions: perms } });
      onRefresh?.();
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-border p-3 sm:p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-foreground text-sm">Permissões de Acesso</h3>
      </div>
      <p className="text-xs text-muted-foreground">Controle quais seções este usuário pode acessar no painel.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(PERM_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm text-foreground">{label}</span>
            <Switch checked={perms[key] ?? true} onCheckedChange={() => toggle(key)} />
          </div>
        ))}
      </div>
      <Button size="sm" onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        💾 Salvar Permissões
      </Button>
    </div>
  );
};

export default UserDetailSheet;
