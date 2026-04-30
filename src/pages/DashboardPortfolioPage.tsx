import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import LazyImage from '@/components/ui/LazyImage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Loader2, ArrowLeft, ImagePlus, Pencil, AlertTriangle, Camera, Info, Image as ImageIcon } from 'lucide-react';
import { trackAction } from '@/lib/errorReporter';
import { showSaveError } from '@/components/SaveErrorToast';
import { motion, AnimatePresence } from 'framer-motion';
import { upsertMedia, deactivateMedia, resolveIdentity } from '@/lib/mediaUtils';
import { useSettingValue } from '@/hooks/useSiteSettings';
import NextStepPrompt from '@/components/dashboard/NextStepPrompt';
import LockedSlotCard from '@/components/dashboard/LockedSlotCard';
import { CELEBRATION_IDS, celebrate } from '@/lib/celebrate';

// Defaults — overridden by site_settings (`portfolio_max_albums`, `portfolio_max_photos_per_album`)
const DEFAULT_MAX_ALBUMS = 4;
const DEFAULT_MAX_PHOTOS_PER_ALBUM = 20;

interface Album {
  id: string;
  name: string;
  description: string;
  cover_image_url: string | null;
  display_order: number;
  photo_count?: number;
}

interface Photo {
  id: string;
  image_url: string;
  storage_path: string;
  original_name: string;
  display_order: number;
}

const DashboardPortfolioPage = () => {
  const { user, provider } = useAuth();
  const albumsLimitRaw = useSettingValue('portfolio_max_albums');
  const photosLimitRaw = useSettingValue('portfolio_max_photos_per_album');
  const MAX_ALBUMS = useMemo(() => {
    const n = Number(String(albumsLimitRaw ?? '').replace(/[^0-9]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_ALBUMS;
  }, [albumsLimitRaw]);
  const MAX_PHOTOS_PER_ALBUM = useMemo(() => {
    const n = Number(String(photosLimitRaw ?? '').replace(/[^0-9]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_PHOTOS_PER_ALBUM;
  }, [photosLimitRaw]);

  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [nextStep, setNextStep] = useState<null | 'album' | 'photo'>(null);

  // Album dialog
  const [albumDialogOpen, setAlbumDialogOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [albumName, setAlbumName] = useState('');
  const [albumDesc, setAlbumDesc] = useState('');
  const [albumSaving, setAlbumSaving] = useState(false);

  // Caption dialog
  const [captionPhoto, setCaptionPhoto] = useState<Photo | null>(null);
  const [captionValue, setCaptionValue] = useState('');
  const [captionSaving, setCaptionSaving] = useState(false);

  const loadAlbums = async () => {
    if (!provider) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('portfolio_albums')
        .select('*')
        .eq('provider_id', provider.id)
        .order('display_order');

      if (error) throw error;

      if (data) {
        const albumIds = data.map(a => a.id);
        const counts: Record<string, number> = {};
        if (albumIds.length > 0) {
          const { data: photosData } = await supabase
            .from('portfolio_photos')
            .select('album_id')
            .in('album_id', albumIds);
          (photosData || []).forEach(p => {
            counts[p.album_id] = (counts[p.album_id] || 0) + 1;
          });
        }
        setAlbums(data.map(a => ({ ...a, photo_count: counts[a.id] || 0 })));
      }
    } catch (err: any) {
      toast.error('Erro ao carregar álbuns: ' + (err.message || 'desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlbums();
  }, [provider]);

  const loadPhotos = async (albumId: string) => {
    setPhotosLoading(true);
    const { data } = await supabase
      .from('portfolio_photos')
      .select('*')
      .eq('album_id', albumId)
      .order('display_order');
    setPhotos(data || []);
    setPhotosLoading(false);
  };

  const handleOpenAlbum = (album: Album) => {
    setSelectedAlbum(album);
    loadPhotos(album.id);
  };

  const handleCreateAlbum = () => {
    setEditingAlbum(null);
    setAlbumName('');
    setAlbumDesc('');
    setAlbumDialogOpen(true);
  };

  const handleEditAlbum = (album: Album) => {
    setEditingAlbum(album);
    setAlbumName(album.name);
    setAlbumDesc(album.description);
    setAlbumDialogOpen(true);
  };

  const handleSaveAlbum = async () => {
    if (albumSaving) {
      toast.info('🚀 Calma, mestre! Já estamos salvando seu talento, só um segundo...', { duration: 2500 });
      return;
    }
    if (!albumName.trim()) { toast.error('Nome do álbum é obrigatório'); return; }
    if (!provider || !user) return;
    setAlbumSaving(true);
    trackAction('album_save_start', editingAlbum ? 'Editando álbum' : 'Criando álbum');

    try {
      if (editingAlbum) {
        const { error } = await (supabase.rpc as any)('update_album_atomic', {
          p_album_id: editingAlbum.id,
          p_data: { name: albumName.trim(), description: albumDesc.trim() },
        });
        if (error) {
          await showSaveError({ actionContext: 'Atualizar álbum', componentName: 'DashboardPortfolioPage', errorMessage: error.message, retryFn: handleSaveAlbum });
          setAlbumSaving(false); return;
        }
        toast.success('Álbum atualizado!');
      } else {
        // Atomic RPC — guarantees provider_id + user_ref are written together
        const { data, error } = await supabase.rpc('create_album_atomic' as any, {
          _name: albumName.trim(),
          _description: albumDesc.trim(),
        });
        if (error) {
          await showSaveError({ actionContext: 'Criar álbum', componentName: 'DashboardPortfolioPage', errorMessage: error.message, retryFn: handleSaveAlbum });
          setAlbumSaving(false); return;
        }
        const newCount = albums.length + 1;
        const unlockedNext = newCount < MAX_ALBUMS;
        celebrate({ intensity: 'mini', id: CELEBRATION_IDS.portfolioAlbum(data?.id ?? String(newCount)) });
        toast.success('🎉 Você ganhou um novo slot!', {
          description: unlockedNext
            ? `Seu ${newCount + 1}º álbum já está liberado na vitrine.`
            : 'Você atingiu o limite máximo de álbuns. Que portfólio! 🚀',
          duration: 5000,
        });
        setNextStep('album');
      }

      trackAction('album_save_success', 'Álbum salvo');
      setAlbumDialogOpen(false);
      setAlbumSaving(false);
      await loadAlbums();
    } catch (err: any) {
      await showSaveError({
        actionContext: 'Salvar álbum (erro inesperado)',
        componentName: 'DashboardPortfolioPage',
        errorMessage: err.message || 'Erro desconhecido',
        errorStack: err.stack,
        retryFn: handleSaveAlbum,
      });
      setAlbumSaving(false);
    }
  };

  const handleDeleteAlbum = async (album: Album) => {
    if (!confirm(`Excluir o álbum "${album.name}" e todas as fotos?`)) return;

    // Delete storage files first
    const { data: photosData } = await supabase
      .from('portfolio_photos')
      .select('storage_path')
      .eq('album_id', album.id);

    if (photosData?.length) {
      const paths = photosData.map(p => p.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('portfolio').remove(paths);
      }
    }

    await supabase.from('portfolio_albums').delete().eq('id', album.id);
    toast.success('Álbum excluído');
    setSelectedAlbum(null);
    await loadAlbums();
  };

  const handleUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !selectedAlbum || !user) return;

    const remaining = MAX_PHOTOS_PER_ALBUM - photos.length;
    if (remaining <= 0) {
      toast.error(`Limite de ${MAX_PHOTOS_PER_ALBUM} fotos por álbum atingido.`);
      e.target.value = '';
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    if (filesToUpload.length < files.length) {
      toast.info(`Apenas ${filesToUpload.length} fotos serão enviadas (limite: ${MAX_PHOTOS_PER_ALBUM}).`);
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: filesToUpload.length });
    let successCount = 0;
    let failCount = 0;
    const { userRef } = await resolveIdentity(user.id);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: { session } } = await supabase.auth.getSession();

    for (let idx = 0; idx < filesToUpload.length; idx++) {
      const file = filesToUpload[idx];
      setUploadProgress({ current: idx + 1, total: filesToUpload.length });
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: máximo 5MB`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucket', 'portfolio');
        formData.append('folder', `${user.id}/${selectedAlbum.id}`);

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/optimize-image`,
          {
            method: 'POST',
            body: formData,
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${session?.access_token}`,
            },
          }
        );

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const publicUrl = data.url;
        const storagePath = data.path;

        if (data.deduplicated) {
          toast.info(`${file.name}: imagem reutilizada (duplicada)`);
        } else if (data.savings_percent > 0) {
          const origKB = Math.round((data.original_size || 0) / 1024);
          const optKB = Math.round((data.optimized_size || 0) / 1024);
          const origLabel = origKB >= 1024 ? `${(origKB / 1024).toFixed(1)}MB` : `${origKB}KB`;
          const optLabel = optKB >= 1024 ? `${(optKB / 1024).toFixed(1)}MB` : `${optKB}KB`;
          toast.success(`Imagem otimizada: ${origLabel} → ${optLabel} (-${data.savings_percent}%)`);
        }

        // Atomic insert — guarantees user_ref alignment with the album's provider
        const { error: rpcErr } = await supabase.rpc('add_portfolio_photo_atomic' as any, {
          _album_id: selectedAlbum.id,
          _image_url: publicUrl,
          _storage_path: storagePath,
          _original_name: file.name,
        });
        if (rpcErr) throw rpcErr;

        if (userRef) {
          await upsertMedia({
            storagePath: `portfolio/${storagePath}`,
            publicUrl,
            originalName: file.name,
            mimeType: file.type || 'image/jpeg',
            entityType: 'portfolio',
            entityRef: selectedAlbum.id,
            userRef,
            sizeOriginal: file.size,
          });
        }

        successCount++;
      } catch (err: any) {
        failCount++;
        await showSaveError({
          actionContext: `Upload de foto: ${file.name}`,
          componentName: 'DashboardPortfolioPage',
          errorMessage: err.message || `Erro ao enviar: ${file.name}`,
        });
      }
    }

    await loadPhotos(selectedAlbum.id);
    await loadAlbums();
    setUploading(false);
    setUploadProgress(null);
    if (successCount > 0) {
      const newPhotoTotal = photos.length + successCount;
      const unlockedNext = newPhotoTotal < MAX_PHOTOS_PER_ALBUM;
      celebrate({ intensity: 'mini', id: CELEBRATION_IDS.portfolioPhoto(selectedAlbum.id, newPhotoTotal) });
      toast.success(`🎉 ${successCount} foto${successCount > 1 ? 's' : ''} desbloqueada${successCount > 1 ? 's' : ''}!`, {
        description: unlockedNext
          ? `Você tem mais ${MAX_PHOTOS_PER_ALBUM - newPhotoTotal} slots disponíveis neste álbum.`
          : 'Álbum no limite máximo. Visual matador!',
        duration: 5000,
      });
      setNextStep('photo');
    } else if (failCount > 0) {
      toast.error('Nenhuma foto foi enviada. Verifique os erros acima.');
    }
    e.target.value = '';
  };

  const handleDeletePhoto = async (photo: Photo) => {
    if (!selectedAlbum) return;
    if (photo.storage_path) {
      await supabase.storage.from('portfolio').remove([photo.storage_path]);
      await deactivateMedia(`portfolio/${photo.storage_path}`, 'portfolio');
    }
    await supabase.from('portfolio_photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    toast.success('Foto removida');
  };

  const handleOpenCaption = (photo: Photo) => {
    setCaptionPhoto(photo);
    setCaptionValue(photo.original_name || '');
  };

  const handleSaveCaption = async () => {
    if (!captionPhoto) return;
    setCaptionSaving(true);
    const newName = captionValue.trim().slice(0, 140);
    const { error } = await supabase
      .from('portfolio_photos')
      .update({ original_name: newName } as any)
      .eq('id', captionPhoto.id);
    if (error) {
      toast.error('Erro ao salvar legenda: ' + error.message);
      setCaptionSaving(false);
      return;
    }
    setPhotos(prev => prev.map(p => p.id === captionPhoto.id ? { ...p, original_name: newName } : p));
    toast.success('Legenda salva');
    setCaptionPhoto(null);
    setCaptionSaving(false);
  };

  // ── Album detail view ──
  if (selectedAlbum) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedAlbum(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <div className="flex-1">
              <h1 className="font-display text-xl font-bold text-foreground">{selectedAlbum.name}</h1>
              {selectedAlbum.description && (
                <p className="text-sm text-muted-foreground">{selectedAlbum.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleEditAlbum(selectedAlbum)}>
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteAlbum(selectedAlbum)}>
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <p className="text-sm font-medium text-foreground">{photos.length}/{MAX_PHOTOS_PER_ALBUM} fotos usadas</p>
                <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${photos.length >= MAX_PHOTOS_PER_ALBUM ? 'bg-destructive' : photos.length / MAX_PHOTOS_PER_ALBUM >= 0.8 ? 'bg-amber-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(100, (photos.length / MAX_PHOTOS_PER_ALBUM) * 100)}%` }}
                  />
                </div>
              </div>
              <label className="cursor-pointer">
                <Button variant="accent" size="sm" asChild disabled={uploading || photos.length >= MAX_PHOTOS_PER_ALBUM}>
                  <span>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Adicionar fotos
                  </span>
                </Button>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUploadPhotos} disabled={uploading || photos.length >= MAX_PHOTOS_PER_ALBUM} />
              </label>
            </div>

            {uploading && uploadProgress && (
              <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-xs font-medium text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Enviando fotos…
                  </span>
                  <span className="tabular-nums">{uploadProgress.current} / {uploadProgress.total}</span>
                </div>
                <Progress value={(uploadProgress.current / uploadProgress.total) * 100} className="h-1.5" />
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <span><strong className="text-foreground">Dica:</strong> clique em uma foto para adicionar uma legenda descrevendo o trabalho realizado — isso melhora seu SEO e autoridade.</span>
            </div>

            {photos.length >= MAX_PHOTOS_PER_ALBUM && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Álbum cheio! Remova uma foto antiga para adicionar novas.</span>
              </div>
            )}

            {photosLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : photos.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                <Camera className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
                <h3 className="font-display text-base font-bold text-foreground">Sem fotos neste álbum</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs mx-auto">
                  Adicione fotos dos seus trabalhos para mostrar sua qualidade aos clientes.
                </p>
                <label className="cursor-pointer inline-block">
                  <Button variant="accent" size="sm" asChild disabled={uploading}>
                    <span><Plus className="h-4 w-4 mr-1" /> Adicionar primeira foto</span>
                  </Button>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleUploadPhotos} disabled={uploading} />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map(photo => (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted cursor-pointer"
                    onClick={() => handleOpenCaption(photo)}
                  >
                    <LazyImage src={photo.image_url} alt={photo.original_name || 'Trabalho do portfólio'} width={400} height={400} sizesPreset="gallery-thumb" surface="portfolio-grid" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />

                    {/* Hover overlay com legenda */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/80 via-foreground/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[11px] font-medium text-background line-clamp-2 leading-tight">
                        {photo.original_name?.trim() ? photo.original_name : 'Toque para adicionar legenda'}
                      </p>
                    </div>

                    {/* Botão excluir */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo); }}
                      aria-label="Excluir foto"
                      className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Indicador de legenda existente */}
                    {photo.original_name?.trim() && (
                      <span className="absolute left-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil className="h-3 w-3" />
                      </span>
                    )}
                  </motion.div>
                ))}
                {photos.length > 0 && photos.length < MAX_PHOTOS_PER_ALBUM && (
                  <div className="aspect-square">
                    <LockedSlotCard label={`Foto ${photos.length + 1}`} variant="compact" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Album edit dialog */}
        <Dialog open={albumDialogOpen} onOpenChange={setAlbumDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAlbum ? 'Editar Álbum' : 'Novo Álbum'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Nome do álbum *</label>
                <Input value={albumName} onChange={e => setAlbumName(e.target.value)} placeholder="Ex: Cozinhas, Banheiros..." autoFocus />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Descrição</label>
                <Textarea value={albumDesc} onChange={e => setAlbumDesc(e.target.value)} placeholder="Descrição opcional do álbum" rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAlbumDialogOpen(false)}>Cancelar</Button>
                <Button variant="accent" onClick={handleSaveAlbum} disabled={albumSaving}>
                  {albumSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {editingAlbum ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Caption dialog */}
        <Dialog open={!!captionPhoto} onOpenChange={(o) => !o && setCaptionPhoto(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Legenda da foto</DialogTitle>
              <DialogDescription>
                Descreva o trabalho realizado para melhorar seu SEO e autoridade.
              </DialogDescription>
            </DialogHeader>
            {captionPhoto && (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-lg border border-border bg-muted" style={{ aspectRatio: '16/9', maxHeight: '16rem' }}>
                  <LazyImage src={captionPhoto.image_url} alt="" width={600} height={256} sizesPreset="card-wide" surface="portfolio-caption" className="h-full w-full object-contain bg-foreground/5" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Descrição</label>
                  <Textarea
                    value={captionValue}
                    onChange={(e) => setCaptionValue(e.target.value.slice(0, 140))}
                    placeholder="Ex: Reforma completa de cozinha planejada em MDF, com bancada em granito preto."
                    rows={3}
                    autoFocus
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground text-right tabular-nums">{captionValue.length}/140</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCaptionPhoto(null)} disabled={captionSaving}>Cancelar</Button>
              <Button variant="accent" onClick={handleSaveCaption} disabled={captionSaving}>
                {captionSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar legenda
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <NextStepPrompt
          open={!!nextStep}
          onClose={() => setNextStep(null)}
          context={nextStep === 'photo' ? 'photo' : 'album'}
          providerSlug={provider?.slug ?? null}
        />
      </DashboardLayout>
    );
  }

  // ── Albums list view ──
  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ImageIcon className="h-4.5 w-4.5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">Meu Portfólio</h1>
              <p className="text-sm text-muted-foreground">Organize seus trabalhos em até {MAX_ALBUMS} álbuns temáticos</p>
            </div>
          </div>
          {albums.length < MAX_ALBUMS && (
            <Button variant="accent" size="sm" onClick={handleCreateAlbum}>
              <Plus className="h-4 w-4 mr-1" /> Novo Álbum
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : albums.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border bg-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Camera className="h-8 w-8" strokeWidth={1.8} />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">Ainda sem álbuns</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5 max-w-sm mx-auto">
              Crie álbuns temáticos (ex: "Cozinhas", "Banheiros") para organizar seus trabalhos e impressionar clientes.
            </p>
            <Button variant="accent" onClick={handleCreateAlbum}>
              <Plus className="h-4 w-4 mr-1" /> Criar meu primeiro álbum
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence>
              {albums.map((album, i) => (
                <motion.div
                  key={album.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleOpenAlbum(album)}
                  className="group cursor-pointer rounded-xl border border-border bg-card shadow-card overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {album.cover_image_url ? (
                      <LazyImage src={album.cover_image_url} alt={album.name} width={400} height={300} priority={i < 2} sizesPreset="card-wide" surface="portfolio-album-cover" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImagePlus className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur-sm">
                      {album.photo_count || 0} fotos
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-display text-sm font-bold text-foreground truncate">{album.name || 'Sem nome'}</h3>
                    {album.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{album.description}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {albums.length > 0 && albums.length < MAX_ALBUMS && (
              <LockedSlotCard label={`Álbum ${albums.length + 1}`} />
            )}
          </div>
        )}

        {albums.length > 0 && albums.length < MAX_ALBUMS && (
          <p className="text-xs text-muted-foreground text-center">
            {albums.length}/{MAX_ALBUMS} álbuns • Cada álbum pode ter até {MAX_PHOTOS_PER_ALBUM} fotos
          </p>
        )}
      </div>

      {/* Album create/edit dialog */}
      <Dialog open={albumDialogOpen} onOpenChange={setAlbumDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAlbum ? 'Editar Álbum' : 'Novo Álbum'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Nome do álbum *</label>
              <Input value={albumName} onChange={e => setAlbumName(e.target.value)} placeholder="Ex: Cozinhas, Banheiros, Reformas..." autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Descrição</label>
              <Textarea value={albumDesc} onChange={e => setAlbumDesc(e.target.value)} placeholder="Descrição opcional do álbum" rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAlbumDialogOpen(false)}>Cancelar</Button>
              <Button variant="accent" onClick={handleSaveAlbum} disabled={albumSaving}>
                {albumSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editingAlbum ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <NextStepPrompt
        open={!!nextStep}
        onClose={() => setNextStep(null)}
        context={nextStep === 'photo' ? 'photo' : 'album'}
        providerSlug={provider?.slug ?? null}
      />
    </DashboardLayout>
  );
};

export default DashboardPortfolioPage;
