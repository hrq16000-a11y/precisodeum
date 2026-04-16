import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChatEligibility } from '@/hooks/useChatEligibility';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Image, ArrowLeft, Loader2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { compressImage } from '@/lib/compressImage';

interface Props {
  conversationId: string;
  onBack?: () => void;
}

export default function ChatMessageView({ conversationId, onBack }: Props) {
  const { user } = useAuth();
  const { settings } = useChatEligibility();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversation } = useQuery({
    queryKey: ['chat-conversation', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data } = await (supabase.from('chat_conversations' as any).select('*').eq('id', conversationId).single() as any);
      return data as any;
    },
  });

  const partnerId = conversation
    ? conversation.participant_a === user?.id ? conversation.participant_b : conversation.participant_a
    : null;

  const { data: partner } = useQuery({
    queryKey: ['chat-partner', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', partnerId!).single();
      return data;
    },
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data } = await (supabase
        .from('chat_messages' as any)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200) as any);
      return (data || []) as any[];
    },
  });

  // Mark as read
  useEffect(() => {
    if (!conversation || !user?.id) return;
    const isA = conversation.participant_a === user.id;
    const unread = isA ? conversation.unread_count_a : conversation.unread_count_b;
    if (unread > 0) {
      const updateField = isA ? { unread_count_a: 0 } : { unread_count_b: 0 };
      (supabase.from('chat_conversations' as any).update(updateField as any).eq('id', conversationId) as any).then(() => {
        qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      });
      // Mark individual messages as read
      (supabase.from('chat_messages' as any).update({ read: true } as any)
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('read', false) as any).then(() => {});
    }
  }, [conversation, conversationId, user?.id, qc]);

  // Realtime
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
        qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, qc]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!text.trim() && !imageFile) return;
      let imageUrl: string | null = null;

      if (imageFile) {
        const compressed = await compressImage(imageFile, { maxDimension: 1280, targetKB: 300 });
        const ext = compressed.name.split('.').pop();
        const path = `chat/${user!.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('service-images').upload(path, compressed, { contentType: compressed.type });
        if (error) throw error;
        const { data } = supabase.storage.from('service-images').getPublicUrl(path);
        imageUrl = data.publicUrl;
      }

      const maxLen = settings?.max_message_length || 1000;
      const { error } = await (supabase.from('chat_messages' as any).insert({
        conversation_id: conversationId,
        sender_id: user!.id,
        content: text.trim().slice(0, maxLen),
        image_url: imageUrl,
      } as any) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setText('');
      setImageFile(null);
      setImagePreview('');
      qc.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !imageFile) return;
    sendMessage.mutate();
  };

  if (conversation?.blocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-sm text-destructive font-medium">Esta conversa foi bloqueada.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border p-3">
        {onBack && (
          <button onClick={onBack} className="p-1 rounded hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <Avatar className="h-8 w-8">
          <AvatarImage src={partner?.avatar_url || ''} />
          <AvatarFallback className="text-xs">{(partner?.full_name || '?')[0]}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{partner?.full_name || 'Carregando...'}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">Envie a primeira mensagem!</p>
        ) : (
          messages.map((msg: any) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted text-foreground rounded-bl-md'
                }`}>
                  {msg.image_url && (
                    <img src={msg.image_url} alt="" className="rounded-lg mb-1 max-h-40 object-cover" />
                  )}
                  {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                  <p className={`text-[9px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground/60'}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="px-3 pb-1">
          <div className="relative w-fit">
            <img src={imagePreview} alt="" className="h-16 rounded-md object-cover" />
            <button onClick={() => { setImageFile(null); setImagePreview(''); }} className="absolute -top-1 -right-1 bg-destructive rounded-full p-0.5 text-destructive-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border p-3">
        {settings?.allow_images && (
          <label className="cursor-pointer shrink-0 p-2 rounded hover:bg-muted text-muted-foreground">
            <Image className="h-4 w-4" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </label>
        )}
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Digite uma mensagem..."
          className="flex-1 h-9 text-sm"
          maxLength={settings?.max_message_length || 1000}
        />
        <Button type="submit" size="sm" disabled={(!text.trim() && !imageFile) || sendMessage.isPending}>
          {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
