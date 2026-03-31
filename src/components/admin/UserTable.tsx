import { Edit2, Key, Ban, Shield, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface UserTableProps {
  users: any[];
  adminIds: Set<string>;
  onEdit: (u: any) => void;
  onResetPassword: (u: any) => void;
  onBlock: (u: any) => void;
  onMakeAdmin: (id: string) => void;
  onDelete: (u: any) => void;
  onViewDetails: (u: any) => void;
}

const UserTable = ({ users, adminIds, onEdit, onResetPassword, onBlock, onMakeAdmin, onDelete, onViewDetails }: UserTableProps) => (
  <div className="overflow-x-auto rounded-xl border border-border shadow-card">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Nome</th>
          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">E-mail</th>
          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Telefone</th>
          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Tipo</th>
          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Status</th>
          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Criado em</th>
          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Ações</th>
        </tr>
      </thead>
      <tbody>
        {users.map(p => {
          const isInactive = p.status === 'inactive';
          const isAdminUser = adminIds.has(p.id);
          return (
            <tr key={p.id} className={`border-b border-border bg-card hover:bg-muted/30 transition-colors ${isInactive ? 'opacity-60' : ''}`}>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {(p.full_name || '?')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate max-w-[140px]">
                      {p.full_name || '—'}
                      {isAdminUser && <Shield className="inline h-3 w-3 ml-1 text-amber-500" />}
                    </p>
                    <p className="text-[10px] text-muted-foreground sm:hidden truncate">{p.email || ''}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground text-xs truncate max-w-[200px]">{p.email || '—'}</td>
              <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground text-xs">{p.phone || p.whatsapp || '—'}</td>
              <td className="px-3 py-2.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${profileTypeBadge(p.profile_type || p.role)}`}>
                  {profileTypeLabel(p.profile_type || p.role)}
                </span>
              </td>
              <td className="px-3 py-2.5 hidden md:table-cell">
                <Badge variant={isInactive ? 'destructive' : 'default'} className="text-[10px]">
                  {isInactive ? 'Inativo' : 'Ativo'}
                </Badge>
              </td>
              <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground text-xs">
                {p.created_at ? format(new Date(p.created_at), 'dd/MM/yyyy') : '—'}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex gap-0.5 flex-wrap">
                  <Button size="sm" variant="ghost" onClick={() => onViewDetails(p)} title="Ver detalhes">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(p)} title="Editar">
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onResetPassword(p)} title="Redefinir Senha">
                    <Key className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onBlock(p)} title={isInactive ? 'Desbloquear' : 'Bloquear'}>
                    <Ban className={`h-3.5 w-3.5 ${isInactive ? 'text-green-600' : 'text-destructive'}`} />
                  </Button>
                  {!isAdminUser && (
                    <Button size="sm" variant="ghost" onClick={() => onMakeAdmin(p.id)} title="Promover a Admin">
                      <Shield className="h-3.5 w-3.5 text-amber-600" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onDelete(p)} title="Desativar">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
        {users.length === 0 && (
          <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário encontrado</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

export default UserTable;
