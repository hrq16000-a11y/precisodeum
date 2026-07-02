import { Link } from 'react-router-dom';
import { Mail, MapPin, Building2, User, Shield, Zap, Calendar, MoreHorizontal, Eye, Edit2, Key, Ban, Trash2, ExternalLink } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SuspiciousBadge from '@/components/admin/SuspiciousBadge';
import { getEngagementTier } from '@/lib/engagementTiers';
import { format } from 'date-fns';

const profileTypeLabel = (t: string) => t === 'rh' ? 'Agência/RH' : t === 'provider' ? 'Profissional' : 'Cliente';
const profileTypeBadge = (t: string) => {
  if (t === 'rh') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
  if (t === 'provider') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  return 'bg-muted text-muted-foreground';
};

interface Props {
  users: any[];
  adminIds: Set<string>;
  levels?: any[];
  providersMap?: Record<string, any>;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onViewDetails: (u: any) => void;
  onEdit: (u: any) => void;
  onResetPassword: (u: any) => void;
  onBlock: (u: any) => void;
  onDelete: (u: any) => void;
}

const UserGrid = ({
  users, adminIds, levels = [], providersMap = {},
  selectedIds, onToggleSelection,
  onViewDetails, onEdit, onResetPassword, onBlock, onDelete,
}: Props) => {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">Nenhum usuário encontrado</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {users.map(p => {
        const isInactive = p.status === 'inactive';
        const isAdminUser = adminIds.has(p.id);
        const type = p.profile_type || p.role || 'client';
        const userLevel = levels.find((l: any) => l.id === p.level_id);
        const provider = providersMap[p.id];
        const isCompany = !!provider?.cnpj;
        const pts = p.engagement_points || 0;
        const tier = getEngagementTier(pts);
        const isSelected = selectedIds?.has(p.id);

        return (
          <div
            key={p.id}
            className={`group relative rounded-xl border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/40 ${
              p.is_suspicious ? 'border-destructive/40 bg-destructive/5' :
              isInactive ? 'opacity-60' :
              isSelected ? 'border-accent bg-accent/5' : 'border-border/60'
            }`}
          >
            {/* Top row: checkbox + actions */}
            <div className="absolute left-2 top-2 z-10">
              {onToggleSelection && (
                <Checkbox
                  checked={isSelected || false}
                  onCheckedChange={() => onToggleSelection(p.id)}
                  className="bg-background/80 backdrop-blur"
                />
              )}
            </div>
            <div className="absolute right-1 top-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 bg-background/80 backdrop-blur">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onViewDetails(p)}><Eye className="h-3.5 w-3.5 mr-2" /> Ver detalhes</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(p)}><Edit2 className="h-3.5 w-3.5 mr-2" /> Editar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onResetPassword(p)}><Key className="h-3.5 w-3.5 mr-2" /> Redefinir senha</DropdownMenuItem>
                  {provider && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin/prestadores"><ExternalLink className="h-3.5 w-3.5 mr-2" /> Prestador</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onBlock(p)}>
                    <Ban className={`h-3.5 w-3.5 mr-2 ${isInactive ? 'text-emerald-600' : 'text-destructive'}`} />
                    {isInactive ? 'Desbloquear' : 'Bloquear'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(p)} className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Desativar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <button type="button" onClick={() => onViewDetails(p)} className="flex flex-col items-center text-center w-full">
              <Avatar className="h-16 w-16 mb-2 ring-2 ring-border/40">
                <AvatarImage src={p.avatar_url || undefined} alt={p.full_name} />
                <AvatarFallback className="bg-primary/10 text-base font-bold">
                  {(p.full_name || '?')[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1 max-w-full">
                <span className="text-xs font-semibold text-foreground truncate">{p.full_name || '—'}</span>
                {isAdminUser && <Shield className="h-3 w-3 text-amber-500 shrink-0" />}
              </div>
              {p.is_suspicious && <SuspiciousBadge reason={p.suspicious_reason} ip={p.suspicious_ip} />}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-full mt-0.5">
                <Mail className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{p.email || '—'}</span>
              </div>

              {provider?.business_name && (
                <div className="flex items-center gap-1 text-[10px] font-medium text-foreground truncate max-w-full mt-1.5">
                  {isCompany ? <Building2 className="h-3 w-3 text-indigo-600 shrink-0" /> : <User className="h-3 w-3 text-teal-600 shrink-0" />}
                  <span className="truncate">{provider.business_name}</span>
                </div>
              )}
              {(provider?.city || provider?.state) && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-full">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{[provider?.city, provider?.state].filter(Boolean).join(', ')}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-1 mt-2">
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${profileTypeBadge(type)}`}>
                  {profileTypeLabel(type)}
                </span>
                {userLevel && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ backgroundColor: `${userLevel.color}1a`, color: userLevel.color, border: `1px solid ${userLevel.color}40` }}
                  >
                    {userLevel.name}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 w-full mt-2 pt-2 border-t border-border/40 text-[10px]">
                <span className="flex items-center gap-1 text-foreground font-semibold">
                  <Zap className="h-2.5 w-2.5 text-accent" /> {pts}
                  <span className={`inline-flex items-center rounded-full px-1 py-0 text-[8px] font-bold ${tier.badgeClass}`}>{tier.label}</span>
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-2.5 w-2.5" />
                  {p.created_at ? format(new Date(p.created_at), 'dd/MM/yy') : '—'}
                </span>
              </div>
              <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                isInactive ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              }`}>
                <span className={`h-1 w-1 rounded-full ${isInactive ? 'bg-red-500' : 'bg-emerald-500'}`} />
                {isInactive ? 'Inativo' : 'Ativo'}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default UserGrid;
