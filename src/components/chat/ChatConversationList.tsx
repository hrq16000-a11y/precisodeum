import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare } from 'lucide-react';

interface Props {
  selectedId?: string;
  onSelect: (conversationId: string) => void;
}

export default function ChatConversationList({ selectedId, onSelect }: Props) {
  const { user } = useAuth();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['chat-conversations', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase
        .from('chat_conversations' as any)
        .select('*')
        .or(`participant_a.eq.${user!.id},participant_b.eq.${user!.id}`)
        .order('last_message_at', { ascending: false }) as any);
      return (data || []) as any[];
    },
  });

  // Get profiles for conversation partners
  const partnerIds = conversations.map((c: any) =>
    c.participant_a === user?.id ? c.participant_b : c.participant_a
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ['chat-partner-profiles', partnerIds.join(',')],
    enabled: partnerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, profile_type')
        .in('id', partnerIds);
      return (data || []) as any[];
    },
  });

  const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Inicie uma conversa pelo perfil de um prestador</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {conversations.map((conv: any) => {
        const partnerId = conv.participant_a === user?.id ? conv.participant_b : conv.participant_a;
        const partner = profileMap.get(partnerId);
        const unread = conv.participant_a === user?.id ? conv.unread_count_a : conv.unread_count_b;
        const isSelected = selectedId === conv.id;

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
              isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted'
            }`}
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={partner?.avatar_url} />
              <AvatarFallback className="text-xs">
                {(partner?.full_name || '?').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{partner?.full_name || 'Usuário'}</span>
                {unread > 0 && (
                  <Badge className="h-5 min-w-5 flex items-center justify-center rounded-full text-[10px] px-1">
                    {unread}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message_text || '...'}</p>
              {conv.last_message_at && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR })}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
