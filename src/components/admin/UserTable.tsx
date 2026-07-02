import { useState } from 'react';
import {
  Edit2, Key, Ban, Shield, Trash2, Eye, MoreHorizontal, Mail, Calendar,
  Briefcase, MapPin, ExternalLink, Zap, RotateCcw, Plus, Minus, Camera,
  User, Building2, Wifi, ArrowUp, ArrowDown, ArrowUpDown, EyeOff
} from 'lucide-react';
import { startImpersonation } from '@/hooks/useImpersonation';
import SuspiciousBadge from '@/components/admin/SuspiciousBadge';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getEngagementTier } from '@/lib/engagementTiers';

const profileTypeLabel = (t: string) => {
  if (t === 'rh') return 'Agência/RH';
  if (t === 'provider') return 'Profissional';
  return 'Cliente';
};

const profileTypeBadge = (t: string) => {
  if (t === 'rh') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
  if (t === 'provider') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  return 'bg-muted text-muted-foreground';
};

const providerStatusBadge: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'OK', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Rejeitado', cls: 'bg-destructive/10 text-destructive' },
};

interface UserTableProps {
  users: any[];
  adminIds: Set<string>;
  levels?: any[];
  accountTypes?: any[];
  providersMap?: Record<string, any>;
  accessLogsMap?: Record<string, any>;
  onEdit: (u: any) => void;
  onResetPassword: (u: any) => void;
  onBlock: (u: any) => void;
  onMakeAdmin: (id: string) => void;
  onRemoveAdmin?: (id: string) => void;
  onDelete: (u: any) => void;
  onViewDetails: (u: any) => void;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (key: string) => void;
}

const SortableHeader = ({
  label, sortKey, currentKey, dir, onClick,
}: { label: string; sortKey: string; currentKey?: string; dir?: 'asc' | 'desc'; onClick?: (k: string) => void }) => {
  const active = currentKey === sortKey;
  if (!onClick) return <span>{label}</span>;
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${active ? 'text-foreground' : ''}`}
    >
      {label}
      {active ? (dir === 'asc' ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />}
    </button>
  );
};

const UserTable = ({
  users, adminIds, levels = [], accountTypes = [], providersMap = {},
  accessLogsMap = {}, onEdit, onResetPassword, onBlock, onMakeAdmin,
  onRemoveAdmin, onDelete, onViewDetails, selectedIds, onToggleSelection,
  sortBy, sortDir, onSortChange,
}: UserTableProps) => {
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const handleAdjustPoints = async (userId: string, delta: number, reset = false) => {
    setAdjustingId(userId);
    try {
      const { data, error } = await supabase.rpc('admin_adjust_points', {
        target_user_id: userId,
        point_delta: delta,
        reset_to_zero: reset,
      });
      if (error) throw error;
      toast.success(reset ? 'Pontos zerados!' : `Pontos ajustados! Total: ${data}`);
      window.dispatchEvent(new CustomEvent('engagement-points-updated'));
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Falha ao ajustar pontos'));
    }
    setAdjustingId(null);
  };

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">Nenhum usuário encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      {/* Table header */}
      <div className="hidden md:grid grid-cols-[28px_minmax(220px,2fr)_minmax(180px,1.5fr)_140px_120px_120px_90px_44px] gap-2 items-center border-b border-border/60 bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span />
        <SortableHeader label="Usuário" sortKey="name" currentKey={sortBy} dir={sortDir} onClick={onSortChange} />
        <SortableHeader label="Empresa / Local" sortKey="business" currentKey={sortBy} dir={sortDir} onClick={onSortChange} />
        <SortableHeader label="Tipo" sortKey="type" currentKey={sortBy} dir={sortDir} onClick={onSortChange} />
        <SortableHeader label="Nível / Pts" sortKey="points" currentKey={sortBy} dir={sortDir} onClick={onSortChange} />
        <SortableHeader label="Status" sortKey="status" currentKey={sortBy} dir={sortDir} onClick={onSortChange} />
        <SortableHeader label="Cadastro" sortKey="created" currentKey={sortBy} dir={sortDir} onClick={onSortChange} />
        <span className="text-right">Ações</span>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-border/40">
        {users.map(p => {
          const isInactive = p.status === 'inactive';
          const isAdminUser = adminIds.has(p.id);
          const type = p.profile_type || p.role || 'client';
          const userLevel = levels.find((l: any) => l.id === p.level_id);
          const userAccType = accountTypes.find((a: any) => a.id === p.account_type_id);
          const provider = providersMap[p.id];
          const accessLog = accessLogsMap[p.id];
          const isProvider = type === 'provider';
          const isCompany = !!provider?.cnpj;
          const hasNoPhotos = isProvider && !provider?.photo_url;
          const pts = p.engagement_points || 0;
          const tier = getEngagementTier(pts);
          const isSelected = selectedIds?.has(p.id);

          return (
            <li
              key={p.id}
              className={`group relative grid grid-cols-1 md:grid-cols-[28px_minmax(220px,2fr)_minmax(180px,1.5fr)_140px_120px_120px_90px_44px] gap-2 items-center px-3 py-2 transition-colors hover:bg-muted/40 ${
                p.is_suspicious ? 'bg-destructive/5' :
                isInactive ? 'opacity-60' :
                isSelected ? 'bg-accent/10' : ''
              }`}
            >
              {/* Checkbox */}
              <div className="flex items-center justify-center">
                {onToggleSelection && (
                  <Checkbox
                    checked={isSelected || false}
                    onCheckedChange={() => onToggleSelection(p.id)}
                  />
                )}
              </div>

              {/* User: Avatar + name + email */}
              <button
                type="button"
                onClick={() => onViewDetails(p)}
                className="flex items-center gap-2.5 min-w-0 text-left"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={p.avatar_url || undefined} alt={p.full_name} />
                  <AvatarFallback className="bg-primary/10 text-xs font-bold">
                    {(p.full_name || '?')[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {p.full_name || '—'}
                    </span>
                    {isAdminUser && <Shield className="h-3 w-3 text-amber-500 shrink-0" />}
                    {p.is_suspicious && <SuspiciousBadge reason={p.suspicious_reason} ip={p.suspicious_ip} />}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                    <Mail className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{p.email || '—'}</span>
                  </div>
                  {accessLog?.ip_address && (
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground/70 truncate font-mono">
                      <Wifi className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                      {accessLog.ip_address}
                    </div>
                  )}
                </div>
              </button>

              {/* Empresa / Local */}
              <div className="min-w-0 text-xs">
                {provider?.business_name ? (
                  <div className="flex items-center gap-1 font-medium text-foreground truncate">
                    {isCompany ? <Building2 className="h-3 w-3 text-indigo-600 shrink-0" /> : <User className="h-3 w-3 text-teal-600 shrink-0" />}
                    <span className="truncate">{provider.business_name}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground/60 italic">Sem empresa</span>
                )}
                {(provider?.city || provider?.state) && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {[provider?.city, provider?.state].filter(Boolean).join(', ')}
                  </div>
                )}
                {hasNoPhotos && (
                  <span className="inline-flex items-center gap-0.5 mt-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 py-0 text-[9px] font-medium">
                    <Camera className="h-2 w-2" /> sem foto
                  </span>
                )}
              </div>

              {/* Tipo */}
              <div className="flex flex-col gap-0.5">
                <span className={`inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${profileTypeBadge(type)}`}>
                  {profileTypeLabel(type)}
                </span>
                {userAccType && (
                  <span className="text-[9px] text-muted-foreground truncate">{userAccType.name}</span>
                )}
              </div>

              {/* Nível / Pontos */}
              <div className="flex flex-col gap-0.5 min-w-0">
                {userLevel ? (
                  <span
                    className="inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                    style={{
                      backgroundColor: `${userLevel.color}1a`,
                      color: userLevel.color,
                      border: `1px solid ${userLevel.color}40`,
                    }}
                  >
                    <span className="h-1 w-1 rounded-full" style={{ backgroundColor: userLevel.color }} />
                    {userLevel.name}
                  </span>
                ) : (
                  <span className="text-[9px] text-muted-foreground/60">—</span>
                )}
                <div className="flex items-center gap-1">
                  <Zap className="h-2.5 w-2.5 text-accent" />
                  <span className="text-[10px] font-semibold">{pts}</span>
                  <span className={`inline-flex items-center rounded-full px-1 py-0 text-[8px] font-bold ${tier.badgeClass}`}>
                    {tier.label}
                  </span>
                </div>
              </div>

              {/* Status (perfil + provider) */}
              <div className="flex flex-col gap-0.5">
                <span className={`inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                  isInactive
                    ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                }`}>
                  <span className={`h-1 w-1 rounded-full ${isInactive ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  {isInactive ? 'Inativo' : 'Ativo'}
                </span>
                {provider && providerStatusBadge[provider.status] && (
                  <span className={`inline-flex w-fit items-center rounded-full px-1.5 py-0 text-[9px] font-medium ${providerStatusBadge[provider.status].cls}`}>
                    {providerStatusBadge[provider.status].label}
                  </span>
                )}
              </div>

              {/* Cadastro */}
              <div className="text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" />
                  {p.created_at ? format(new Date(p.created_at), 'dd/MM/yy') : '—'}
                </div>
              </div>

              {/* Actions menu */}
              <div className="flex items-center justify-end gap-0.5">
                {/* Quick adjust points */}
                <Button
                  size="sm" variant="ghost"
                  className="h-6 w-6 p-0 hidden xl:inline-flex"
                  disabled={adjustingId === p.id}
                  onClick={(e) => { e.stopPropagation(); handleAdjustPoints(p.id, 10); }}
                  title="Adicionar 10 pontos"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => onViewDetails(p)}>
                      <Eye className="h-3.5 w-3.5 mr-2" /> Ver detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(p)}>
                      <Edit2 className="h-3.5 w-3.5 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onResetPassword(p)}>
                      <Key className="h-3.5 w-3.5 mr-2" /> Redefinir senha
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => startImpersonation({
                        targetUserId: p.id,
                        targetEmail: p.email,
                        targetName: p.full_name,
                      })}
                    >
                      <EyeOff className="h-3.5 w-3.5 mr-2 text-amber-600" /> Acessar como
                    </DropdownMenuItem>
                    {provider && (
                      <DropdownMenuItem asChild>
                        <Link to="/admin/prestadores">
                          <ExternalLink className="h-3.5 w-3.5 mr-2" /> Gerenciar prestador
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleAdjustPoints(p.id, 10)}>
                      <Plus className="h-3.5 w-3.5 mr-2" /> +10 pontos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAdjustPoints(p.id, -10)} disabled={pts === 0}>
                      <Minus className="h-3.5 w-3.5 mr-2" /> -10 pontos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAdjustPoints(p.id, 0, true)} disabled={pts === 0} className="text-destructive">
                      <RotateCcw className="h-3.5 w-3.5 mr-2" /> Zerar pontos
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onBlock(p)}>
                      <Ban className={`h-3.5 w-3.5 mr-2 ${isInactive ? 'text-emerald-600' : 'text-destructive'}`} />
                      {isInactive ? 'Desbloquear' : 'Bloquear'}
                    </DropdownMenuItem>
                    {isAdminUser ? (
                      onRemoveAdmin && (
                        <DropdownMenuItem onClick={() => onRemoveAdmin(p.id)}>
                          <Shield className="h-3.5 w-3.5 mr-2 text-destructive" /> Remover admin
                        </DropdownMenuItem>
                      )
                    ) : (
                      <DropdownMenuItem onClick={() => onMakeAdmin(p.id)}>
                        <Shield className="h-3.5 w-3.5 mr-2 text-amber-600" /> Promover admin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(p)} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Desativar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default UserTable;
