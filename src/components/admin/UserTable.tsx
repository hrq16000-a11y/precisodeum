import { useState } from 'react';
import { Edit2, Key, Ban, Shield, Trash2, Eye, MoreHorizontal, Phone, Mail, Calendar, Briefcase, MapPin, Star, ExternalLink, Zap, RotateCcw, Plus, Minus } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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

const profileTypeIcon = (t: string) => {
  if (t === 'rh') return 'RH';
  if (t === 'provider') return 'PRO';
  return 'USR';
};

const providerStatusBadge: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Rejeitado', cls: 'bg-destructive/10 text-destructive' },
};

interface UserTableProps {
  users: any[];
  adminIds: Set<string>;
  levels?: any[];
  accountTypes?: any[];
  providersMap?: Record<string, any>;
  onEdit: (u: any) => void;
  onResetPassword: (u: any) => void;
  onBlock: (u: any) => void;
  onMakeAdmin: (id: string) => void;
  onRemoveAdmin?: (id: string) => void;
  onDelete: (u: any) => void;
  onViewDetails: (u: any) => void;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
}

const UserTable = ({ users, adminIds, levels = [], accountTypes = [], providersMap = {}, onEdit, onResetPassword, onBlock, onMakeAdmin, onRemoveAdmin, onDelete, onViewDetails, selectedIds, onToggleSelection }: UserTableProps) => {
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
      toast.success(reset ? 'Pontos zerados!' : `Pontos ${delta > 0 ? 'adicionados' : 'removidos'}! Novo total: ${data}`);
      // Force re-render by triggering parent refresh
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
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {users.map(p => {
        const isInactive = p.status === 'inactive';
        const isAdminUser = adminIds.has(p.id);
        const type = p.profile_type || p.role || 'client';
        const phone = p.phone || p.whatsapp || '';
        const userLevel = levels.find((l: any) => l.id === p.level_id);
        const userAccType = accountTypes.find((a: any) => a.id === p.account_type_id);
        const provider = providersMap[p.id];

        return (
          <div
            key={p.id}
            className={`group relative rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md ${
              isInactive ? 'opacity-60 border-red-200 dark:border-red-500/20' : 'border-border/60'
            } ${selectedIds?.has(p.id) ? 'ring-2 ring-accent' : ''}`}
          >
            {/* Selection & Menu */}
            <div className="absolute top-3 left-3 z-10">
              {onToggleSelection && (
                <Checkbox
                  checked={selectedIds?.has(p.id) || false}
                  onCheckedChange={() => onToggleSelection(p.id)}
                  className="bg-background"
                />
              )}
            </div>
            <div className="absolute top-3 right-3 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onViewDetails(p)}>
                    <Eye className="h-3.5 w-3.5 mr-2" /> Ver Detalhes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(p)}>
                    <Edit2 className="h-3.5 w-3.5 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onResetPassword(p)}>
                    <Key className="h-3.5 w-3.5 mr-2" /> Redefinir Senha
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onBlock(p)}>
                    <Ban className={`h-3.5 w-3.5 mr-2 ${isInactive ? 'text-green-600' : 'text-destructive'}`} />
                    {isInactive ? 'Desbloquear' : 'Bloquear'}
                  </DropdownMenuItem>
                  {isAdminUser ? (
                    onRemoveAdmin && (
                      <DropdownMenuItem onClick={() => onRemoveAdmin(p.id)}>
                        <Shield className="h-3.5 w-3.5 mr-2 text-destructive" /> Remover Admin
                      </DropdownMenuItem>
                    )
                  ) : (
                    <DropdownMenuItem onClick={() => onMakeAdmin(p.id)}>
                      <Shield className="h-3.5 w-3.5 mr-2 text-amber-600" /> Promover Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(p)} className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Desativar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Card Content */}
            <div className="p-5 cursor-pointer" onClick={() => onViewDetails(p)}>
              {/* Avatar + Name */}
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={p.avatar_url || undefined} alt={p.full_name} />
                  <AvatarFallback className="bg-primary/10 text-lg font-bold">
                    {(p.full_name || '?')[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display font-bold text-foreground truncate text-sm">
                      {p.full_name || '—'}
                    </p>
                    {isAdminUser && <Shield className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="h-3 w-3 shrink-0" />
                    {p.email || '—'}
                  </p>
                  {p.user_ref && (
                    <p className="text-[10px] font-mono text-muted-foreground/70 truncate">{p.user_ref}</p>
                  )}
                </div>
              </div>

              {/* Provider info */}
              {provider && (
                <div className="mt-2 rounded-lg bg-accent/10 border border-accent/20 px-2.5 py-1.5 space-y-1">
                  {provider.business_name && (
                    <p className="text-xs font-semibold text-foreground truncate flex items-center gap-1">
                      <Briefcase className="h-3 w-3 text-accent shrink-0" />
                      {provider.business_name}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    {(provider.city || provider.state) && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        {[provider.city, provider.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {provider.plan && (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-2.5 w-2.5 shrink-0 text-amber-500" />
                        {provider.plan}
                      </span>
                    )}
                    {provider.categories && (
                      <span className="truncate">
                        <CategoryIcon icon={(provider.categories as any)?.icon} size={14} className="text-muted-foreground" />
                        {(provider.categories as any)?.name}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Level & Account Type */}
              <div className="mt-2 space-y-1 text-xs">
                {userLevel && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Nível:</span>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: userLevel.color }} />
                      {userLevel.name}
                    </span>
                  </div>
                )}
                {userAccType && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Categoria:</span>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: userAccType.color }} />
                      {userAccType.name}
                    </span>
                  </div>
                )}
                {p.department && (
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{p.department}</span>
                  </div>
                )}
              </div>

              {/* Engagement Points */}
              {(() => {
                const pts = p.engagement_points || 0;
                const tier = getEngagementTier(pts);
                return (
                  <div className="mt-2 rounded-lg bg-muted/50 border border-border px-2.5 py-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-accent" />
                        <span className="text-xs font-semibold">{pts} pts</span>
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tier.badgeClass}`}>
                          {tier.icon} {tier.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 w-6 p-0 text-xs"
                          disabled={adjustingId === p.id}
                          onClick={(e) => { e.stopPropagation(); handleAdjustPoints(p.id, 10); }}
                          title="Adicionar 10 pontos"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 w-6 p-0 text-xs"
                          disabled={adjustingId === p.id || pts === 0}
                          onClick={(e) => { e.stopPropagation(); handleAdjustPoints(p.id, -10); }}
                          title="Remover 10 pontos"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 w-6 p-0 text-xs text-destructive"
                          disabled={adjustingId === p.id || pts === 0}
                          onClick={(e) => { e.stopPropagation(); handleAdjustPoints(p.id, 0, true); }}
                          title="Zerar pontos"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Badges */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {isAdminUser && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">
                    Admin
                  </Badge>
                )}
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${profileTypeBadge(type)}`}>
                  {profileTypeIcon(type)} {profileTypeLabel(type)}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isInactive
                    ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isInactive ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  {isInactive ? 'Inativo' : 'Ativo'}
                </span>
                {provider && providerStatusBadge[provider.status] && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${providerStatusBadge[provider.status].cls}`}>
                    {providerStatusBadge[provider.status].label}
                  </span>
                )}
              </div>

              {/* Info Row */}
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                {phone && (
                  <span className="flex items-center gap-1 truncate">
                    <Phone className="h-3 w-3 shrink-0" /> {phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {p.created_at ? format(new Date(p.created_at), 'dd/MM/yyyy') : '—'}
                </span>
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="border-t border-border/40 px-4 py-2.5 flex items-center gap-1.5 flex-wrap bg-muted/20">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1" onClick={() => onEdit(p)}>
                <Edit2 className="h-3 w-3" /> Editar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1" onClick={() => onBlock(p)}>
                <Ban className={`h-3 w-3 ${isInactive ? 'text-emerald-600' : 'text-destructive'}`} />
                {isInactive ? 'Ativar' : 'Bloquear'}
              </Button>
              {provider && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-accent" asChild>
                  <Link to="/admin/prestadores">
                    <ExternalLink className="h-3 w-3" /> Gerenciar
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={() => onDelete(p)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UserTable;
