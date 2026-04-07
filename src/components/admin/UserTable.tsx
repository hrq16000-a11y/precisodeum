import { Edit2, Key, Ban, Shield, Trash2, Eye, MoreHorizontal, Phone, Mail, Calendar, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

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
  if (t === 'rh') return '🏢';
  if (t === 'provider') return '🔧';
  return '👤';
};

interface UserTableProps {
  users: any[];
  adminIds: Set<string>;
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

const UserTable = ({ users, adminIds, onEdit, onResetPassword, onBlock, onMakeAdmin, onRemoveAdmin, onDelete, onViewDetails, selectedIds, onToggleSelection }: UserTableProps) => {
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

        return (
          <div
            key={p.id}
            className={`group relative rounded-xl border bg-card shadow-card transition-all hover:shadow-card-hover ${
              isInactive ? 'opacity-60 border-destructive/30' : 'border-border'
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
            <div className="p-4 pt-5 cursor-pointer" onClick={() => onViewDetails(p)}>
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
                </div>
              </div>

              {/* Badges */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {isAdminUser && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">
                    👑 Admin
                  </Badge>
                )}
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${profileTypeBadge(type)}`}>
                  {profileTypeIcon(type)} {profileTypeLabel(type)}
                </span>
                <Badge variant={isInactive ? 'destructive' : 'default'} className="text-[10px]">
                  {isInactive ? '🔴 Inativo' : '🟢 Ativo'}
                </Badge>
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
            <div className="border-t border-border px-4 py-2 flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1" onClick={() => onEdit(p)}>
                <Edit2 className="h-3 w-3" /> Editar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1" onClick={() => onBlock(p)}>
                <Ban className={`h-3 w-3 ${isInactive ? 'text-green-600' : 'text-destructive'}`} />
                {isInactive ? 'Ativar' : 'Bloquear'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1 text-destructive" onClick={() => onDelete(p)}>
                <Trash2 className="h-3 w-3" /> Excluir
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UserTable;
