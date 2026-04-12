import { useState, useRef } from 'react';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SponsorImage } from '@/components/SponsorImage';
import { toast } from 'sonner';
import { Upload, Link2, Save, Eye, MousePointerClick, Image, ExternalLink, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const SponsorBannersPage = () => {
  const { sponsor, loading, refetch } = useSponsorAuth();
  const [linkUrl, setLinkUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkInit, setLinkInit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!linkInit && sponsor) {
    setLinkUrl(sponsor.link_url || '');
    setLinkInit(true);
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sponsor) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máximo 5MB)');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${sponsor.id}/banner_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('sponsors').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('sponsors').getPublicUrl(path);

      const { error: dbErr } = await supabase
        .from('sponsors')
        .update({ image_url: urlData.publicUrl })
        .eq('id', sponsor.id);
      if (dbErr) throw dbErr;

      toast.success('Banner atualizado com sucesso!');
      await refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSaveLink = async () => {
    if (!sponsor) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sponsors')
        .update({ link_url: linkUrl.trim() || null })
        .eq('id', sponsor.id);
      if (error) throw error;
      toast.success('Link de destino salvo!');
      await refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SponsorLayout>
        <div className="space-y-4">
          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </SponsorLayout>
    );
  }

  const ctr = sponsor?.impressions && sponsor.impressions > 0
    ? ((sponsor.clicks / sponsor.impressions) * 100).toFixed(2)
    : '0.00';

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <motion.h1
          className="text-2xl font-bold text-foreground"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          Meus Banners
        </motion.h1>

        {/* Banner stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Impressões', value: (sponsor?.impressions || 0).toLocaleString('pt-BR'), icon: Eye },
            { label: 'Cliques', value: (sponsor?.clicks || 0).toLocaleString('pt-BR'), icon: MousePointerClick },
            { label: 'CTR', value: `${ctr}%`, icon: Image },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card>
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Banner preview + upload */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Image className="h-4 w-4" /> Banner Atual
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={sponsor?.active ? 'default' : 'secondary'}>
                    {sponsor?.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <Badge variant="outline" className="capitalize">{sponsor?.position || '—'}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {sponsor?.image_url ? (
                <div className="flex justify-center bg-muted/30 rounded-xl p-4">
                  <SponsorImage src={sponsor.image_url} alt={sponsor.title} className="rounded-xl max-h-48" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 bg-muted/30 rounded-xl border-2 border-dashed border-border">
                  <Image className="w-10 h-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum banner cadastrado</p>
                </div>
              )}

              {/* Upload */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" /> {sponsor?.image_url ? 'Trocar Banner' : 'Enviar Banner'}</>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG, WebP. Tamanho máximo: 5MB. Resolução recomendada: 1600×200px (proporção 8:1).
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Link de destino */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4" /> Link de Destino
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL do link (ao clicar no banner)</Label>
                <div className="flex gap-2">
                  <Input
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://suaempresa.com.br"
                    className="flex-1"
                  />
                  <Button onClick={handleSaveLink} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {sponsor?.link_url && (
                <a
                  href={sponsor.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> Abrir link atual
                </a>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Info */}
        <Card>
          <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="grid gap-2 sm:grid-cols-3 text-sm flex-1 w-full">
              <div>
                <span className="text-muted-foreground">Posição:</span>{' '}
                <Badge variant="outline" className="ml-1">{sponsor?.position}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Plano:</span>{' '}
                <Badge variant="outline" className="ml-1 capitalize">{sponsor?.tier}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Período:</span>{' '}
                <span className="text-xs text-muted-foreground ml-1">
                  {sponsor?.start_date ? new Date(sponsor.start_date).toLocaleDateString('pt-BR') : '—'} —{' '}
                  {sponsor?.end_date ? new Date(sponsor.end_date).toLocaleDateString('pt-BR') : 'Indefinido'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <a
              href="/pagina/diretrizes-banner-hero"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              📐 Ver diretrizes de formato e boas práticas para banners
            </a>
          </CardContent>
        </Card>
      </div>
    </SponsorLayout>
  );
};

export default SponsorBannersPage;
