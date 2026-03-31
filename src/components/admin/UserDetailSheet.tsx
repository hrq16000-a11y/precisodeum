import { format } from 'date-fns';
import { Shield, Mail, Phone, Calendar, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface UserDetailSheetProps {
  user: any | null;
  isAdmin: boolean;
  onClose: () => void;
}

const UserDetailSheet = ({ user, isAdmin, onClose }: UserDetailSheetProps) => (
  <Sheet open={!!user} onOpenChange={open => !open && onClose()}>
    <SheetContent className="sm:max-w-md overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Detalhes do Usuário</SheetTitle>
      </SheetHeader>
      {user && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
              {(user.full_name || '?')[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-display font-bold text-foreground text-lg">{user.full_name || '—'}</p>
              <div className="flex items-center gap-2 mt-1">
                {isAdmin && (
                  <Badge className="bg-amber-100 text-amber-800 text-[10px]"><Shield className="h-3 w-3 mr-1" /> Admin</Badge>
                )}
                <Badge variant={user.status === 'inactive' ? 'destructive' : 'default'} className="text-[10px]">
                  {user.status === 'inactive' ? 'Inativo' : 'Ativo'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground break-all">{user.email || '—'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">{user.phone || user.whatsapp || '—'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground capitalize">{user.profile_type || user.role || 'client'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">
                Criado em {user.created_at ? format(new Date(user.created_at), 'dd/MM/yyyy HH:mm') : '—'}
              </span>
            </div>
            {user.updated_at && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground text-xs">
                  Atualizado em {format(new Date(user.updated_at), 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
            )}
          </div>

          {user.whatsapp && (
            <a
              href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              <Phone className="h-4 w-4" /> Chamar no WhatsApp
            </a>
          )}
        </div>
      )}
    </SheetContent>
  </Sheet>
);

export default UserDetailSheet;
