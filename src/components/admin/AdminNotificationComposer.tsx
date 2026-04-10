import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Send, Image, Video, Users, Loader2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const TARGET_OPTIONS = [
  { value: 'all', label: 'Todos os usuários' },
  { value: 'client', label: 'Apenas Clientes' },
  { value: 'provider', label: 'Apenas Prestadores' },
  { value: 'rh', label: 'Apenas RH' },
];

const TYPE_OPTIONS = [
  { value: 'system', label: '🔔 Sistema' },
  { value: 'message', label: '💬 Mensagem' },
  { value: 'job', label: '💼 Vaga' },
  { value: 'lead', label: '📩 Lead' },
  { value: 'approval', label: '✅ Aprovação' },
];

const AdminNotificationComposer = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('system');
  const [targetGroup, setTargetGroup] = useState('all');
  const [link, setLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [showMedia, setShowMedia] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
  };

  const sendNotification = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Título é obrigatório');

      // Upload image if file selected
      let finalImageUrl = imageUrl;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `notifications/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('service-images')
          .upload(path, imageFile, { contentType: imageFile.type });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('service-images').getPublicUrl(path);
        finalImageUrl = urlData.publicUrl;
      }

      // Get target users
      let query = supabase.from('profiles').select('id');
      if (targetGroup !== 'all') {
        query = query.eq('profile_type', targetGroup);
      }
      const { data: users, error: usersErr } = await query;
      if (usersErr) throw usersErr;
      if (!users || users.length === 0) throw new Error('Nenhum usuário encontrado para o grupo selecionado');

      // Insert notifications in batches
      const batch = users.map((u: any) => ({
        user_id: u.id,
        title: title.trim(),
        message: message.trim(),
        type,
        link: link.trim() || null,
        image_url: finalImageUrl || null,
        video_url: videoUrl.trim() || null,
        target_group: targetGroup,
        sent_by: user?.id || null,
      }));

      // Supabase insert limit is 1000 rows at a time
      for (let i = 0; i < batch.length; i += 500) {
        const chunk = batch.slice(i, i + 500);
        const { error } = await supabase.from('notifications').insert(chunk as any);
        if (error) throw error;
      }

      return batch.length;
    },
    onSuccess: (count) => {
      toast.success(`Notificação enviada para ${count} usuário(s)!`);
      setTitle('');
      setMessage('');
      setLink('');
      setImageUrl('');
      setVideoUrl('');
      setImageFile(null);
      setImagePreview('');
      setShowMedia(false);
      qc.invalidateQueries({ queryKey: ['admin-sent-notifications'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao enviar notificação');
    },
  });

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" /> Enviar Notificação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Destinatários</Label>
            <Select value={targetGroup} onValueChange={setTargetGroup}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs">Título *</Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título da notificação"
            className="h-9 text-sm"
            maxLength={120}
          />
        </div>

        <div>
          <Label className="text-xs">Mensagem</Label>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Corpo da mensagem (opcional)"
            className="text-sm min-h-[60px]"
            maxLength={500}
          />
        </div>

        <div>
          <Label className="text-xs">Link (opcional)</Label>
          <Input
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="/dashboard ou https://..."
            className="h-9 text-sm"
          />
        </div>

        {/* Media toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={showMedia ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowMedia(!showMedia)}
            className="text-xs gap-1"
          >
            <Image className="h-3.5 w-3.5" /> Mídia
          </Button>
        </div>

        {showMedia && (
          <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30">
            <div>
              <Label className="text-xs">Imagem</Label>
              {imagePreview ? (
                <div className="relative mt-1 w-fit">
                  <img src={imagePreview} alt="Preview" className="h-20 rounded-md object-cover" />
                  <button
                    onClick={removeImage}
                    className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mt-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="h-9 text-xs flex-1"
                  />
                  <Input
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="ou cole URL da imagem"
                    className="h-9 text-xs flex-1"
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs flex items-center gap-1">
                <Video className="h-3.5 w-3.5" /> URL do Vídeo
              </Label>
              <Input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... ou URL de vídeo"
                className="h-9 text-xs mt-1"
              />
            </div>
          </div>
        )}

        <Button
          onClick={() => sendNotification.mutate()}
          disabled={!title.trim() || sendNotification.isPending}
          className="w-full gap-2"
          size="sm"
        >
          {sendNotification.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enviar Notificação
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminNotificationComposer;
