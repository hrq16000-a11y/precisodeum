import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, FolderOpen, ArrowLeft, ImagePlus, Pencil } from 'lucide-react';
import { trackAction } from '@/lib/errorReporter';
import { showSaveError } from '@/components/SaveErrorToast';
import { motion, AnimatePresence } from 'framer-motion';
import { upsertMedia, deactivateMedia, resolveIdentity } from '@/lib/mediaUtils';

const MAX_ALBUMS = 4;
const MAX_PHOTOS_PER_ALBUM = 20;

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
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Album dialog
  const [albumDialogOpen, setAlbumDialogOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [albumName, setAlbumName] = useState('');
  const [albumDesc, setAlbumDesc] = useState('');
  const [albumSaving, setAlbumSaving] = useState(false);

  const loadAlbums = async () => {
    if (!provider) return;
    const { data } = await supabase
      .from('portfolio_albums')
      .select('*')
      .eq('provider_id', provider.id)
      .order('display_order');

    if (data) {
      // Get photo counts
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
    setLoading(false);
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
    if (!albumName.trim()) { toast.error('Nome do álbum é obrigatório'); return; }
    if (!provider || !user) return;
    setAlbumSaving(true);
    trackAction('album_save_start', editingAlbum ? 'Editando álbum' : 'Criando álbum');

    try {
      if (editingAlbum) {
        const { error } = await supabase
          .from('portfolio_albums')
          .update({ name: albumName.trim(), description: albumDesc.trim() })
          .eq('id', editingAlbum.id);
        if (error) {
          await showSaveError({ actionContext: 'Atualizar álbum', componentName: 'DashboardPortfolioPage', errorMessage: error.message, retryFn: handleSaveAlbum });
          setAlbumSaving(false); return;
        }
        toast.success('Álbum atualizado!');
      } else {
        const { error } = await supabase
          .from('portfolio_albums')
          .insert({
            provider_id: provider.id,
            user_id: user.id,
            name: albumName.trim(),
            description: albumDesc.trim(),
            display_order: albums.length,
          });
        if (error) {
          await showSaveError({ actionContext: 'Criar álbum', componentName: 'DashboardPortfolioPage', errorMessage: error.message, retryFn: handleSaveAlbum });
          setAlbumSaving(false); return;
        }
        toast.success('Álbum criado!');
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
    const { userRef } = await resolveIdentity(user.id);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: { session } } = await supabase.auth.getSession();

    for (const file of filesToUpload) {
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

        await supabase.from('portfolio_photos').insert({
          album_id: selectedAlbum.id,
          user_id: user.id,
          image_url: publicUrl,
          storage_path: storagePath,
          original_name: file.name,
          display_order: photos.length,
        });

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

        // Set first photo as cover if no cover
        if (!selectedAlbum.cover_image_url && photos.length === 0) {
          await supabase.from('portfolio_albums').update({ cover_image_url: publicUrl }).eq('id', selectedAlbum.id);
        }
      } catch (err) {
        toast.error(`Erro ao enviar: ${file.name}`);
      }
    }

    await loadPhotos(selectedAlbum.id);
    await loadAlbums();
    setUploading(false);
    toast.success('Fotos enviadas!');
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{photos.length}/{MAX_PHOTOS_PER_ALBUM} fotos</p>
              <label className="cursor-pointer">
                <Button variant="accent" size="sm" asChild disabled={uploading || photos.length >= MAX_PHOTOS_PER_ALBUM}>
                  <span>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Adicionar fotos
                  </span>
                </Button>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUploadPhotos} disabled={photos.length >= MAX_PHOTOS_PER_ALBUM} />
              </label>
            </div>

            {photosLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : photos.length === 0 ? (
              <div className="text-center py-8">
                <ImagePlus className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma foto neste álbum. Adicione fotos dos seus trabalhos!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map(photo => (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border"
                  >
                    <img src={photo.image_url} alt="Portfolio" loading="lazy" className="h-full w-full object-cover" />
                    <button
                      onClick={() => handleDeletePhoto(photo)}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
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
      </DashboardLayout>
    );
  }

  // ── Albums list view ──
  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">📸 Meu Portfólio</h1>
            <p className="text-sm text-muted-foreground">Organize seus trabalhos em até {MAX_ALBUMS} álbuns temáticos</p>
          </div>
          {albums.length < MAX_ALBUMS && (
            <Button variant="accent" size="sm" onClick={handleCreateAlbum}>
              <Plus className="h-4 w-4 mr-1" /> Novo Álbum
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : albums.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border bg-card p-10 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-foreground">Nenhum álbum ainda</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Crie álbuns para organizar fotos dos seus trabalhos por categoria.
            </p>
            <Button variant="accent" onClick={handleCreateAlbum}>
              <Plus className="h-4 w-4 mr-1" /> Criar primeiro álbum
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
                      <img src={album.cover_image_url} alt={album.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
    </DashboardLayout>
  );
};

export default DashboardPortfolioPage;
