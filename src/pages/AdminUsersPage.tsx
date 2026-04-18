import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users, Key, Trash2, Download, CheckSquare, UserCog, Shield, UserPlus,
  BarChart3, Target, Briefcase, TrendingUp, Send, Tag, X, Plus,
  Activity, Filter, Search, ChevronDown, FileText, AlertTriangle,
  CheckCircle, XCircle, User, Wrench, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PaginationControls from '@/components/PaginationControls';
import UserFilters from '@/components/admin/UserFilters';
import UserTable from '@/components/admin/UserTable';
import LevelDistributionBar from '@/components/admin/LevelDistributionBar';
import UserEditDialog from '@/components/admin/UserEditDialog';
import UserDetailSheet from '@/components/admin/UserDetailSheet';
import { logAuditAction } from '@/hooks/useAuditLog';
import { exportCrmPdf } from '@/lib/exportCrmPdf';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, subDays, subMonths, startOfDay, parseISO, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 20;

const FUNNEL_STAGES = [
  { key: 'registered', label: 'Cadastrado', color: 'bg-blue-500' },
  { key: 'profile_complete', label: 'Perfil Completo', color: 'bg-cyan-500' },
  { key: 'active_provider', label: 'Profissional Ativo', color: 'bg-emerald-500' },
  { key: 'elite', label: 'Nível Ouro+', color: 'bg-amber-500' },
];

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

const TAG_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
];

const AdminUsersPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [levels, setLevels] = useState<any[]>([]);
  const [accountTypes, setAccountTypes] = useState<any[]>([]);
  const [providersMap, setProvidersMap] = useState<Record<string, any>>({});
  const [providersRaw, setProvidersRaw] = useState<any[]>([]);
  const [accessLogsMap, setAccessLogsMap] = useState<Record<string, any>>({});
  const [userTags, setUserTags] = useState<any[]>([]);
  const [sponsorUserIds, setSponsorUserIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProviderStatus, setFilterProviderStatus] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);

  const [editUser, setEditUser] = useState<any | null>(null);
  const [pwUser, setPwUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPw, setResettingPw] = useState(false);
  const [deleteUser, setDeleteUser] = useState<any | null>(null);
  const [detailUser, setDetailUser] = useState<any | null>(null);

  // Create user
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('client');
  const [createAccountTypeId, setCreateAccountTypeId] = useState<string>('');
  const [createLevelId, setCreateLevelId] = useState<string>('');
  const [createStaffRole, setCreateStaffRole] = useState<string>('none');
  const [accountTypeOptions, setAccountTypeOptions] = useState<{ id: string; name: string }[]>([]);
  const [levelOptions, setLevelOptions] = useState<{ id: string; name: string; min_points: number }[]>([]);
  const [creating, setCreating] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkTypeTarget, setBulkTypeTarget] = useState('');

  // Metrics tab state
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [tagTargetIds, setTagTargetIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    const allPageIds = paginated.map(p => p.id);
    const allSelected = allPageIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allPageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allPageIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map(p => p.id)));
  };

  const fetchProfiles = useCallback(() => {
    Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('providers').select('id, user_id, business_name, city, state, plan, status, slug, categories(name, icon), created_at, cnpj, photo_url, whatsapp, phone, description, services_count, latitude, longitude').is('deleted_at', null),
      supabase.from('user_tags').select('*'),
      supabase.from('sponsor_contacts' as any).select('user_id'),
      supabase.rpc('get_latest_user_access_logs' as any),
    ]).then(([pRes, prRes, tRes, scRes, alRes]) => {
      setProfiles(pRes.data || []);
      const provs = prRes.data || [];
      setProvidersRaw(provs);
      const map: Record<string, any> = {};
      provs.forEach((p: any) => { map[p.user_id] = p; });
      setProvidersMap(map);
      setUserTags(tRes.data || []);
      setSponsorUserIds(new Set((scRes.data || []).map((r: any) => r.user_id)));
      const logsMap: Record<string, any> = {};
      ((alRes as any)?.data || []).forEach((row: any) => { logsMap[row.user_id] = row; });
      setAccessLogsMap(logsMap);
    });
  }, []);

  const fetchAdmins = () => {
    supabase.from('user_roles').select('user_id').eq('role', 'admin')
      .then(({ data }) => setAdminIds(new Set((data || []).map((r: any) => r.user_id))));
  };

  const fetchLevels = () => {
    supabase.from('user_levels').select('*').order('priority', { ascending: false })
      .then(({ data }) => setLevels(data || []));
  };
  const fetchAccountTypes = () => {
    supabase.from('account_types').select('*').order('display_order')
      .then(({ data }) => setAccountTypes(data || []));
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchProfiles();
    fetchAdmins();
    fetchLevels();
    fetchAccountTypes();
  }, [isAdmin]);

  // ── Real KPIs ──
  const realKpis = useMemo(() => {
    const total = profiles.length;
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30).toISOString();
    const sevenDaysAgo = subDays(now, 7).toISOString();
    const new30d = profiles.filter(p => p.created_at >= thirtyDaysAgo).length;
    const new7d = profiles.filter(p => p.created_at >= sevenDaysAgo).length;
    const activeProviders = providersRaw.filter(p => p.status === 'approved').length;
    const suspended = profiles.filter(p => p.status === 'suspended').length;
    const banned = profiles.filter(p => p.status === 'banned').length;
    return { total, new30d, new7d, activeProviders, suspended, banned };
  }, [profiles, providersRaw]);

  // ── Metrics data ──
  // Service/lead counts are now available from providers.services_count
  const servicesByProvider = useMemo(() => {
    const map: Record<string, number> = {};
    providersRaw.forEach(p => { if (p.services_count) map[p.id] = p.services_count; });
    return map;
  }, [providersRaw]);

  const leadsByProvider = useMemo(() => {
    const map: Record<string, number> = {};
    // Leads count is not pre-aggregated; will be fetched on-demand in detail view
    return map;
  }, []);

  const tagsByUser = useMemo(() => {
    const map: Record<string, any[]> = {};
    userTags.forEach(t => {
      if (!map[t.user_id]) map[t.user_id] = [];
      map[t.user_id].push(t);
    });
    return map;
  }, [userTags]);

  const allTagNames = useMemo(() => {
    const set = new Set<string>();
    userTags.forEach(t => set.add(t.tag_name));
    return Array.from(set).sort();
  }, [userTags]);

  const funnelData = useMemo(() => {
    const total = profiles.length;
    const withProfile = profiles.filter(p => p.full_name && p.full_name.trim().length > 2).length;
    const activeProviders = providersRaw.filter(p => p.status === 'approved').length;
    // Elite = engagement_points >= 700 (Nível Ouro+)
    const elite = profiles.filter(p => (p.engagement_points || 0) >= 700).length;
    return [
      { ...FUNNEL_STAGES[0], count: total, pct: 100 },
      { ...FUNNEL_STAGES[1], count: withProfile, pct: total ? Math.round((withProfile / total) * 100) : 0 },
      { ...FUNNEL_STAGES[2], count: activeProviders, pct: total ? Math.round((activeProviders / total) * 100) : 0 },
      { ...FUNNEL_STAGES[3], count: elite, pct: total ? Math.round((elite / total) * 100) : 0 },
    ];
  }, [profiles, providersRaw]);

  const growthData = useMemo(() => {
    const days: { date: string; users: number; providers: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const dayStr = format(day, 'yyyy-MM-dd');
      const label = format(day, 'dd/MM');
      const usersCount = profiles.filter(p => format(parseISO(p.created_at), 'yyyy-MM-dd') === dayStr).length;
      const provsCount = providersRaw.filter(p => format(parseISO(p.created_at), 'yyyy-MM-dd') === dayStr).length;
      days.push({ date: label, users: usersCount, providers: provsCount });
    }
    return days;
  }, [profiles, providersRaw]);

  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = { client: 0, provider: 0, rh: 0 };
    profiles.forEach(p => {
      const t = p.profile_type || 'client';
      counts[t] = (counts[t] || 0) + 1;
    });
    return [
      { name: 'Clientes', value: counts.client },
      { name: 'Profissionais', value: counts.provider },
      { name: 'Agências/RH', value: counts.rh },
    ].filter(d => d.value > 0);
  }, [profiles]);

  const retentionData = useMemo(() => {
    const now = new Date();
    const months = eachMonthOfInterval({ start: subMonths(now, 11), end: now });
    return months.map(month => {
      const monthStr = format(month, 'yyyy-MM');
      const label = format(month, 'MMM/yy', { locale: ptBR });
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
      const totalByMonth = profiles.filter(p => parseISO(p.created_at) <= endOfMonth).length;
      const activeByMonth = profiles.filter(p => parseISO(p.created_at) <= endOfMonth && p.status !== 'inactive' && p.status !== 'suspended' && p.status !== 'banned').length;
      const inactiveByMonth = totalByMonth - activeByMonth;
      const newInMonth = profiles.filter(p => format(parseISO(p.created_at), 'yyyy-MM') === monthStr).length;
      return {
        month: label,
        total: totalByMonth,
        ativos: activeByMonth,
        inativos: inactiveByMonth,
        novos: newInMonth,
        retentionRate: totalByMonth > 0 ? Math.round((activeByMonth / totalByMonth) * 100) : 0,
      };
    });
  }, [profiles]);

  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    let list = profiles;

    // Tab-based filtering
    if (activeTab === 'clientes') list = list.filter(p => (p.profile_type || 'client') === 'client');
    else if (activeTab === 'prestadores') list = list.filter(p => (p.profile_type || 'client') === 'provider' && !providersMap[p.id]?.cnpj);
    else if (activeTab === 'empresas') list = list.filter(p => !!providersMap[p.id]?.cnpj);
    else if (activeTab === 'agencias') list = list.filter(p => (p.profile_type || 'client') === 'rh');
    else if (activeTab === 'patrocinadores') list = list.filter(p => sponsorUserIds.has(p.id));
    else if (activeTab === 'staff') list = list.filter(p => adminIds.has(p.id));
    else if (activeTab === 'criticos') list = list.filter(p => {
      const prov = providersMap[p.id];
      if (!prov) return false;
      const checks = [
        !!prov.photo_url, !!(prov.whatsapp || prov.phone), !!prov.city,
        !!(prov.description && prov.description.length >= 20),
        !!(prov.services_count > 0),
        !!(prov.latitude && prov.longitude),
      ];
      const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
      return pct < 30;
    });

    if (filterType !== 'all') list = list.filter(p => (p.profile_type || p.role) === filterType);
    if (filterStatus !== 'all') list = list.filter(p => (p.status || 'active') === filterStatus);
    if (filterProviderStatus !== 'all') {
      list = list.filter(p => {
        const prov = providersMap[p.id];
        return prov && prov.status === filterProviderStatus;
      });
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(p =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.whatsapp || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q) ||
        (p.user_ref || '').toLowerCase().includes(q)
      );
    }

    // Quality filter
    if (qualityFilter !== 'all') {
      list = list.filter(p => {
        const prov = providersMap[p.id];
        if (!prov) return false;
        if (qualityFilter === 'no_photo') return !prov.photo_url;
        if (qualityFilter === 'company_no_cnpj') return !!prov.business_name && !prov.cnpj;
        if (qualityFilter === 'no_location') return !prov.city && !prov.state;
        if (qualityFilter === 'no_whatsapp') return !prov.whatsapp && !prov.phone;
        return true;
      });
    }

    // Sorting
    if (sortBy === 'oldest') {
      list = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === 'ranking') {
      list = [...list].sort((a, b) => (b.engagement_points || 0) - (a.engagement_points || 0));
    }
    // 'recent' is already the default order from DB

    return list;
  }, [profiles, debouncedSearch, filterType, filterStatus, filterProviderStatus, providersMap, activeTab, adminIds, sponsorUserIds, sortBy, qualityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Bulk actions ──
  const bulkSetStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('profiles').update({ status }).in('id', ids);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: status === 'active' ? 'bulk_active' : 'bulk_inactive', resource_type: 'user', details: { ids, count: ids.length } });
      toast.success(`${ids.length} usuário(s) ${status === 'active' ? 'ativado(s)' : 'desativado(s)'}`);
      setSelectedIds(new Set());
      fetchProfiles();
    }
    setBulkLoading(false);
  };

  const bulkChangeType = async (profileType: string) => {
    if (selectedIds.size === 0 || !profileType) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const role = profileType === 'rh' ? 'client' : profileType;
    const { error } = await supabase.from('profiles').update({ profile_type: profileType, role }).in('id', ids);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'bulk_update', resource_type: 'user', details: { ids, count: ids.length, changes: { profile_type: profileType } } });
      toast.success(`${ids.length} usuário(s) alterado(s)`);
      setSelectedIds(new Set());
      fetchProfiles();
    }
    setBulkLoading(false);
    setBulkTypeTarget('');
  };

  const bulkMakeAdmin = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds).filter(id => !adminIds.has(id));
    if (ids.length === 0) { toast.info('Todos já são admins'); setBulkLoading(false); return; }
    let count = 0;
    for (const id of ids) {
      const { error } = await supabase.from('user_roles').insert({ user_id: id, role: 'admin' } as any);
      if (!error) count++;
    }
    await logAuditAction({ action: 'bulk_update', resource_type: 'user', details: { ids, count, changes: { role: 'admin' } } });
    toast.success(`${count} usuário(s) promovido(s) a admin`);
    setSelectedIds(new Set());
    fetchAdmins();
    setBulkLoading(false);
  };

  const bulkSoftDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('profiles').update({ status: 'inactive' }).in('id', ids);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'bulk_delete', resource_type: 'user', details: { ids, count: ids.length } });
      toast.success(`${ids.length} usuário(s) desativado(s)`);
      setSelectedIds(new Set());
      fetchProfiles();
    }
    setBulkLoading(false);
  };

  const handleResetPassword = async () => {
    if (!pwUser || !newPassword) return;
    if (newPassword.length < 6) { toast.error('A senha deve ter no mínimo 6 caracteres'); return; }
    setResettingPw(true);
    try {
      const res = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: pwUser.id, new_password: newPassword },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      await logAuditAction({
        action: 'update', resource_type: 'user', resource_id: pwUser.id,
        details: { target_user_id: pwUser.id, changes: { password: { from: '***', to: '***' } } },
      });
      toast.success('Senha redefinida com sucesso!');
      setPwUser(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Falha ao redefinir senha'));
    }
    setResettingPw(false);
  };

  const handleBlock = async (p: any) => {
    const prevStatus = p.status || 'active';
    const newStatus = prevStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', p.id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({
        action: newStatus === 'inactive' ? 'block' : 'unblock', resource_type: 'user', resource_id: p.id,
        details: { target_user_id: p.id, changes: { status: { from: prevStatus, to: newStatus } } },
      });
      toast.success(newStatus === 'active' ? 'Usuário desbloqueado!' : 'Usuário bloqueado!');
      fetchProfiles();
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const { error } = await supabase.from('profiles').update({ status: 'inactive' }).eq('id', deleteUser.id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'soft_delete', resource_type: 'user', resource_id: deleteUser.id, details: { target_user_id: deleteUser.id } });
      toast.success('Usuário desativado!');
      setDeleteUser(null);
      fetchProfiles();
    }
  };

  const makeAdmin = async (userId: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' } as any);
    if (error) {
      if (error.code === '23505') toast.info('Usuário já é admin');
      else toast.error('Erro: ' + error.message);
    } else {
      await logAuditAction({ action: 'update', resource_type: 'user', resource_id: userId, details: { changes: { role: { from: 'user', to: 'admin' } } } });
      toast.success('Usuário promovido a admin!');
      fetchAdmins();
    }
  };

  const removeAdmin = async (userId: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
    if (error) toast.error('Erro: ' + error.message);
    else {
      await logAuditAction({ action: 'update', resource_type: 'user', resource_id: userId, details: { changes: { role: { from: 'admin', to: 'user' } } } });
      toast.success('Permissão de admin removida!');
      fetchAdmins();
    }
  };

  const handleExport = () => {
    const csvHeader = 'Nome,Email,Telefone,WhatsApp,Tipo,Status,Criado em\n';
    const source = selectedIds.size > 0 ? filtered.filter(p => selectedIds.has(p.id)) : filtered;
    const csvRows = source.map(p =>
      `"${p.full_name || ''}","${p.email || ''}","${p.phone || ''}","${p.whatsapp || ''}","${p.profile_type || p.role || ''}","${p.status || 'active'}","${p.created_at || ''}"`
    ).join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logAuditAction({ action: 'export', resource_type: 'user', details: { count: source.length } });
    toast.success(`${source.length} usuário(s) exportado(s)!`);
  };

  const openCreateDialog = async () => {
    setShowCreateDialog(true);
    if (accountTypeOptions.length === 0) {
      const { data: ats } = await supabase.from('account_types').select('id, name').eq('active', true).order('display_order');
      setAccountTypeOptions(ats || []);
    }
    if (levelOptions.length === 0) {
      const { data: lvls } = await supabase.from('gamification_levels').select('id, name, min_points').eq('active', true).order('min_points');
      setLevelOptions(lvls || []);
    }
  };

  const handleCreateUser = async () => {
    if (!createEmail.includes('@')) { toast.error('Email inválido'); return; }
    if (createPassword.length < 6) { toast.error('Senha mínima: 6 caracteres'); return; }
    if (createName.trim().length < 2) { toast.error('Nome mínimo: 2 caracteres'); return; }
    setCreating(true);
    try {
      const res = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: createEmail,
          password: createPassword,
          full_name: createName,
          profile_type: createType,
          account_type_id: createAccountTypeId || null,
          level_id: createLevelId || null,
          staff_role: createStaffRole !== 'none' ? createStaffRole : null,
        },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      await logAuditAction({ action: 'create', resource_type: 'user', resource_id: res.data?.user_id, details: { email: createEmail, profile_type: createType, staff_role: createStaffRole } });
      toast.success('Usuário criado com sucesso!');
      setShowCreateDialog(false);
      setCreateEmail(''); setCreatePassword(''); setCreateName(''); setCreateType('client');
      setCreateAccountTypeId(''); setCreateLevelId(''); setCreateStaffRole('none');
      fetchProfiles();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Falha ao criar usuário'));
    }
    setCreating(false);
  };

  // ── Metrics exports ──
  const downloadCsv = (filename: string, headers: string[], rows: (string | number | null | undefined)[][]) => {
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return rows.length;
  };

  const exportMetricsCsv = () => {
    const lines: string[][] = [];
    lines.push(['=== FUNIL DE CONVERSÃO ===', '', '']);
    lines.push(['Etapa', 'Total', 'Porcentagem']);
    funnelData.forEach(s => lines.push([s.label, String(s.count), s.pct + '%']));
    lines.push(['', '', '']);
    lines.push(['=== CRESCIMENTO (30 DIAS) ===', '', '']);
    lines.push(['Data', 'Novos Usuários', 'Novos Profissionais']);
    growthData.forEach(d => lines.push([d.date, String(d.users), String(d.providers)]));
    lines.push(['', '', '']);
    lines.push(['=== RETENÇÃO (12 MESES) ===', '', '', '', '']);
    lines.push(['Mês', 'Total', 'Ativos', 'Inativos', 'Novos', 'Taxa Retenção']);
    retentionData.forEach(r => lines.push([r.month, String(r.total), String(r.ativos), String(r.inativos), String(r.novos), r.retentionRate + '%']));
    const maxCols = Math.max(...lines.map(l => l.length));
    const padded = lines.map(l => [...l, ...Array(maxCols - l.length).fill('')]);
    const csv = padded.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-metricas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Métricas exportadas');
  };

  // ── Tags ──
  const handleAddTag = async () => {
    if (!newTagName.trim()) { toast.error('Digite o nome da tag'); return; }
    const ids = tagTargetIds.length > 0 ? tagTargetIds : Array.from(selectedIds);
    if (ids.length === 0) { toast.error('Selecione pelo menos um usuário'); return; }
    const rows = ids.map(uid => ({ user_id: uid, tag_name: newTagName.trim(), color: newTagColor }));
    const { error } = await supabase.from('user_tags').upsert(rows, { onConflict: 'user_id,tag_name' });
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(`Tag "${newTagName}" aplicada a ${ids.length} usuário(s)`);
    setShowTagDialog(false);
    setNewTagName('');
    setTagTargetIds([]);
    fetchProfiles();
  };

  // ── Notifications ──
  const handleSendNotification = async () => {
    if (!notifyTitle.trim() || !notifyMessage.trim()) { toast.error('Preencha título e mensagem'); return; }
    setSending(true);
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : filtered.map(p => p.id);
    const rows = ids.map(uid => ({ user_id: uid, title: notifyTitle, message: notifyMessage, type: 'crm' }));
    const batchSize = 100;
    let sent = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from('notifications').insert(batch);
      if (error) { toast.error('Erro ao enviar: ' + error.message); break; }
      sent += batch.length;
    }
    toast.success(`${sent} notificação(ões) enviada(s)`);
    setSending(false);
    setShowNotifyDialog(false);
    setNotifyTitle('');
    setNotifyMessage('');
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  const allPageSelected = paginated.length > 0 && paginated.every(p => selectedIds.has(p.id));

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6" /> Central de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão unificada — usuários, métricas e segmentação</p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <UserPlus className="h-4 w-4 mr-1" /> Criar Usuário
        </Button>
      </div>

      {/* KPI Cards — Modern Dashboard */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Total de Usuários', value: realKpis.total, icon: Users,
            iconBg: 'bg-blue-50 dark:bg-blue-500/10', iconColor: 'text-blue-600',
            trend: null as string | null, trendUp: true,
          },
          {
            label: 'Novos (30 dias)', value: realKpis.new30d, icon: UserPlus,
            iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', iconColor: 'text-emerald-600',
            trend: realKpis.new7d > 0 ? `+${realKpis.new7d} esta semana` : null, trendUp: true,
          },
          {
            label: 'Profissionais Ativos', value: realKpis.activeProviders, icon: Briefcase,
            iconBg: 'bg-violet-50 dark:bg-violet-500/10', iconColor: 'text-violet-600',
            trend: null, trendUp: true,
          },
          {
            label: 'Suspensos / Banidos', value: realKpis.suspended + realKpis.banned, icon: AlertTriangle,
            iconBg: 'bg-red-50 dark:bg-red-500/10', iconColor: 'text-red-500',
            trend: realKpis.banned > 0 ? `${realKpis.banned} banido(s)` : null, trendUp: false,
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                  <Icon className={`h-4 w-4 ${kpi.iconColor}`} />
                </div>
                {kpi.trend && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    kpi.trendUp
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                  }`}>
                    {kpi.trendUp ? <TrendingUp className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {kpi.trend}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground tracking-tight">{kpi.value}</p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wide">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Distribuição por Nível — Gestão 360 */}
      <LevelDistributionBar profiles={profiles} />

      {/* Main Tabs: Segmented by type + Métricas */}
      <Tabs value={activeTab === 'all' ? 'users' : activeTab === 'metrics' ? 'metrics' : 'users'} onValueChange={v => { if (v === 'metrics') setActiveTab('metrics'); else if (activeTab === 'metrics') setActiveTab('all'); }} className="mt-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" /> Usuários</TabsTrigger>
          <TabsTrigger value="metrics" onClick={() => setActiveTab('metrics')}><BarChart3 className="h-4 w-4 mr-1.5" /> Métricas</TabsTrigger>
        </TabsList>

        {/* ═══ Users Tab ═══ */}
        <TabsContent value="users" className="space-y-4 mt-4">
          {/* Sub-tabs by user type */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'all', label: 'Todos', icon: Users },
              { key: 'clientes', label: 'Clientes', icon: User },
              { key: 'prestadores', label: 'Prestadores', icon: Wrench },
              { key: 'empresas', label: 'Empresas', icon: Building2 },
              { key: 'agencias', label: 'Agências', icon: Briefcase },
              { key: 'patrocinadores', label: 'Patrocinadores', icon: TrendingUp },
              { key: 'staff', label: 'Staff', icon: Shield },
              { key: 'criticos', label: 'Críticos', icon: AlertTriangle },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <Button
                  key={tab.key}
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  className="h-8 text-xs gap-1.5"
                  onClick={() => { setActiveTab(tab.key); setPage(1); }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          <UserFilters
            search={search}
            onSearchChange={v => { setSearch(v); setPage(1); }}
            filterType={filterType}
            onFilterTypeChange={v => { setFilterType(v); setPage(1); }}
            filterStatus={filterStatus}
            onFilterStatusChange={v => { setFilterStatus(v); setPage(1); }}
            filterProviderStatus={filterProviderStatus}
            onFilterProviderStatusChange={v => { setFilterProviderStatus(v); setPage(1); }}
            sortBy={sortBy}
            onSortChange={v => { setSortBy(v); setPage(1); }}
            qualityFilter={qualityFilter}
            onQualityFilterChange={v => { setQualityFilter(v); setPage(1); }}
            totalResults={filtered.length}
            onExport={handleExport}
          />

          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={selectAllOnPage}>
              <CheckSquare className="h-3.5 w-3.5" />
              {allPageSelected ? 'Desmarcar Página' : 'Selecionar Página'}
            </Button>
            {filtered.length > PAGE_SIZE && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={selectAllFiltered}>
                <CheckSquare className="h-3.5 w-3.5" />
                Selecionar Todos ({filtered.length})
              </Button>
            )}
            {selectedIds.size > 0 && (
              <span className="text-xs text-muted-foreground">{selectedIds.size} selecionado(s)</span>
            )}
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 shadow-sm">
              <span className="text-sm font-medium text-foreground mr-2">{selectedIds.size} selecionado(s)</span>
              <Button size="sm" variant="outline" onClick={() => bulkSetStatus('active')} disabled={bulkLoading} className="text-green-600 border-green-200 h-7 text-xs gap-1">
                <CheckCircle className="h-3 w-3" /> Ativar
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSetStatus('inactive')} disabled={bulkLoading} className="text-destructive border-destructive/30 h-7 text-xs gap-1">
                <XCircle className="h-3 w-3" /> Desativar
              </Button>
              <div className="flex items-center gap-1">
                <Select value={bulkTypeTarget} onValueChange={setBulkTypeTarget}>
                  <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue placeholder="Mudar tipo..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client"><span className="flex items-center gap-1.5"><User className="h-3 w-3" /> Cliente</span></SelectItem>
                    <SelectItem value="provider"><span className="flex items-center gap-1.5"><Wrench className="h-3 w-3" /> Profissional</span></SelectItem>
                    <SelectItem value="rh"><span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Agência/RH</span></SelectItem>
                  </SelectContent>
                </Select>
                {bulkTypeTarget && (
                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => bulkChangeType(bulkTypeTarget)} disabled={bulkLoading}>
                    <UserCog className="h-3 w-3 mr-1" /> Aplicar
                  </Button>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={bulkMakeAdmin} disabled={bulkLoading} className="h-7 text-xs text-amber-600 border-amber-200">
                <Shield className="h-3 w-3 mr-1" /> Promover Admin
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setTagTargetIds(Array.from(selectedIds)); setShowTagDialog(true); }} disabled={bulkLoading} className="h-7 text-xs">
                <Tag className="h-3 w-3 mr-1" /> Tag ({selectedIds.size})
              </Button>
              <Button size="sm" variant="outline" onClick={handleExport} disabled={bulkLoading} className="h-7 text-xs">
                <Download className="h-3 w-3 mr-1" /> Exportar
              </Button>
              <Button size="sm" variant="destructive" onClick={bulkSoftDelete} disabled={bulkLoading} className="h-7 text-xs">
                <Trash2 className="h-3 w-3 mr-1" /> Desativar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-7 text-xs ml-auto gap-1">
                <X className="h-3 w-3" /> Limpar
              </Button>
            </div>
          )}

          <UserTable
            users={paginated}
            adminIds={adminIds}
            levels={levels}
            accountTypes={accountTypes}
            providersMap={providersMap}
            accessLogsMap={accessLogsMap}
            onEdit={setEditUser}
            onResetPassword={setPwUser}
            onBlock={handleBlock}
            onMakeAdmin={makeAdmin}
            onRemoveAdmin={removeAdmin}
            onDelete={setDeleteUser}
            onViewDetails={setDetailUser}
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
          />

          {totalPages > 1 && (
            <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
          )}
        </TabsContent>

        {/* ═══ Metrics Tab ═══ */}
        <TabsContent value="metrics" className="space-y-6 mt-4">
          {/* Actions bar */}
          <div className="flex flex-wrap gap-2 justify-end">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" /> Exportar <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                <button onClick={handleExport} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent/10 text-foreground">
                  <Users className="h-4 w-4" /> Usuários (CSV)
                </button>
                <button onClick={exportMetricsCsv} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent/10 text-foreground">
                  <BarChart3 className="h-4 w-4" /> Métricas (CSV)
                </button>
                <div className="border-t border-border my-1" />
                <button onClick={() => {
                  const stats = { total: realKpis.total, new7d: realKpis.new7d, new30d: realKpis.new30d, activeProviders: realKpis.activeProviders };
                  exportCrmPdf({ stats, funnelData, growthData, retentionData, typeDistribution, totalLeads: 0 });
                  toast.success('PDF gerado — use Ctrl+P para salvar');
                }} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent/10 text-foreground">
                  <FileText className="h-4 w-4" /> Relatório (PDF)
                </button>
              </PopoverContent>
            </Popover>
            <Button size="sm" onClick={() => setShowNotifyDialog(true)}>
              <Send className="h-4 w-4 mr-1" /> Enviar Notificação
            </Button>
          </div>

          {/* Metrics sub-tabs */}
          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
              <TabsTrigger value="funnel"><Target className="h-4 w-4 mr-1" /> Funil</TabsTrigger>
              <TabsTrigger value="retention"><Activity className="h-4 w-4 mr-1" /> Retenção</TabsTrigger>
            </TabsList>

            {/* Dashboard */}
            <TabsContent value="dashboard" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Crescimento (30 dias)</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={growthData}>
                        <defs>
                          <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorProvs" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                        <Tooltip />
                        <Area type="monotone" dataKey="users" name="Usuários" stroke="hsl(var(--primary))" fill="url(#colorUsers)" strokeWidth={2} />
                        <Area type="monotone" dataKey="providers" name="Profissionais" stroke="hsl(var(--chart-2))" fill="url(#colorProvs)" strokeWidth={2} />
                        <Legend />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Distribuição por Tipo</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={typeDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {typeDistribution.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Top cities */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Top Cidades (Profissionais)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={(() => {
                      const cityCount: Record<string, number> = {};
                      providersRaw.forEach(p => { if (p.city) cityCount[p.city] = (cityCount[p.city] || 0) + 1; });
                      return Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([city, count]) => ({ city, count }));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="city" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Profissionais" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Funnel */}
            <TabsContent value="funnel" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Funil de Conversão</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {funnelData.map((stage) => (
                    <div key={stage.key} className="flex items-center gap-3">
                      <div className="w-32 text-sm font-medium text-foreground shrink-0">{stage.label}</div>
                      <div className="flex-1 relative">
                        <div className="h-10 rounded-lg bg-muted overflow-hidden">
                          <div className={`h-full ${stage.color} rounded-lg transition-all duration-700 flex items-center px-3`} style={{ width: `${Math.max(stage.pct, 5)}%` }}>
                            <span className="text-xs font-bold text-white whitespace-nowrap">{stage.count} ({stage.pct}%)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                {[
                  { label: 'Cadastro → Perfil', from: funnelData[0].count, to: funnelData[1].count },
                  { label: 'Perfil → Profissional', from: funnelData[1].count, to: funnelData[2].count },
                  { label: 'Profissional → Premium', from: funnelData[2].count, to: funnelData[3].count },
                ].map(conv => (
                  <Card key={conv.label}>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{conv.label}</p>
                      <p className="font-display text-3xl font-bold text-primary">{conv.from > 0 ? Math.round((conv.to / conv.from) * 100) : 0}%</p>
                      <p className="text-xs text-muted-foreground">{conv.to} de {conv.from}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Retention */}
            <TabsContent value="retention" className="space-y-4">
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Taxa de Retenção Atual</p>
                    <p className="font-display text-3xl font-bold text-emerald-600">{retentionData.length > 0 ? retentionData[retentionData.length - 1].retentionRate : 0}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Ativos</p>
                    <p className="font-display text-3xl font-bold text-primary">{profiles.filter(p => p.status !== 'inactive' && p.status !== 'suspended' && p.status !== 'banned').length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Inativos</p>
                    <p className="font-display text-3xl font-bold text-destructive">{profiles.filter(p => p.status === 'inactive').length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Churn</p>
                    <p className="font-display text-3xl font-bold text-amber-600">{profiles.length > 0 ? Math.round((profiles.filter(p => p.status === 'inactive').length / profiles.length) * 100) : 0}%</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ativos vs Inativos (12 meses)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={retentionData}>
                      <defs>
                        <linearGradient id="colorAtivos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorInativos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="ativos" name="Ativos" stroke="#10b981" fill="url(#colorAtivos)" strokeWidth={2} />
                      <Area type="monotone" dataKey="inativos" name="Inativos" stroke="#ef4444" fill="url(#colorInativos)" strokeWidth={2} />
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Retenção (%)</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={retentionData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => `${v}%`} />
                        <Line type="monotone" dataKey="retentionRate" name="Retenção" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Novos Cadastros por Mês</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={retentionData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="novos" name="Novos" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {editUser && <UserEditDialog user={editUser} onClose={() => setEditUser(null)} onSaved={fetchProfiles} />}
      <UserDetailSheet user={detailUser} isAdmin={adminIds.has(detailUser?.id)} onClose={() => setDetailUser(null)} onRefresh={fetchProfiles} />

      {/* Password Reset */}
      <Dialog open={!!pwUser} onOpenChange={open => !open && setPwUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Redefinir Senha</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Redefinir senha de <strong>{pwUser?.full_name || pwUser?.email}</strong></p>
          <div><Label>Nova senha (mín. 6 caracteres)</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nova senha" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwUser(null); setNewPassword(''); }}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={resettingPw || newPassword.length < 6}><Key className="h-4 w-4 mr-1" /> {resettingPw ? 'Redefinindo...' : 'Redefinir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteUser} onOpenChange={open => !open && setDeleteUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Desativar Usuário</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Deseja realmente desativar <strong>{deleteUser?.full_name || deleteUser?.email}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-1" /> Desativar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Criar Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome completo</Label><Input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Nome do usuário" /></div>
            <div><Label>Email</Label><Input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
            <div><Label>Senha (mín. 6 caracteres)</Label><Input type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} placeholder="Senha inicial" /></div>
            <div><Label>Tipo de conta</Label>
              <Select value={createType} onValueChange={setCreateType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="client">Cliente</SelectItem><SelectItem value="provider">Profissional</SelectItem><SelectItem value="rh">Agência/RH</SelectItem>
              </SelectContent></Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={creating}>{creating ? 'Criando...' : 'Criar Usuário'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Aplicar Tag</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Aplicar a {tagTargetIds.length || selectedIds.size} usuário(s).</p>
            <div>
              <Label>Nome da Tag</Label>
              <Input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Ex: VIP, Leads Quentes..." list="existing-tags" />
              <datalist id="existing-tags">{allTagNames.map(t => <option key={t} value={t} />)}</datalist>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {TAG_COLORS.map(color => (
                  <button key={color} className={`h-7 w-7 rounded-full border-2 transition-transform ${newTagColor === color ? 'border-foreground scale-110' : 'border-transparent'}`} style={{ backgroundColor: color }} onClick={() => setNewTagColor(color)} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddTag}>Aplicar Tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification Dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar Notificação em Massa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Será enviada para {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : `${filtered.length} usuário(s)`}.</p>
            <div><Label>Título</Label><Input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="Título da notificação" /></div>
            <div><Label>Mensagem</Label><Textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} placeholder="Escreva a mensagem..." rows={4} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyDialog(false)}>Cancelar</Button>
            <Button onClick={handleSendNotification} disabled={sending}>{sending ? 'Enviando...' : 'Enviar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsersPage;
