/**
 * AdminDashboardLayoutPage — controle de ordem e visibilidade das seções
 * do Dashboard por tipo de cadastro (provider / rh / client / sponser).
 *
 * Persistência: `site_settings` (chaves `dashboard_layout_<type>`) — valor
 * é um JSON serializado de DashboardLayoutItem[].
 *
 * DnD: @dnd-kit (já presente no projeto). Visibilidade: switch por linha.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCcw, Save, Layout } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { logAuditAction } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import {
  DASHBOARD_LAYOUT_KEYS,
  DEFAULT_DASHBOARD_LAYOUTS,
  DashboardLayoutItem,
  DashboardProfileType,
  mergeWithDefaults,
} from '@/lib/dashboardLayoutDefaults';

const TYPES: { key: DashboardProfileType; label: string }[] = [
  { key: 'provider', label: 'Prestador' },
  { key: 'rh', label: 'RH/Agência' },
  { key: 'client', label: 'Cliente' },
  { key: 'sponser', label: 'Patrocinador' },
];

function SortableRow({
  item,
  onToggle,
}: {
  item: DashboardLayoutItem;
  onToggle: (id: string, visible: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-xs hover:shadow-md transition-shadow"
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="Arrastar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.label}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">{item.id}</div>
      </div>
      <Badge variant="outline" className="text-xs">#{item.order}</Badge>
      <Switch
        checked={item.visible}
        onCheckedChange={(v) => onToggle(item.id, v)}
        aria-label={`Tornar ${item.label} ${item.visible ? 'invisível' : 'visível'}`}
      />
    </div>
  );
}

function LayoutEditor({ type }: { type: DashboardProfileType }) {
  const qc = useQueryClient();
  const key = DASHBOARD_LAYOUT_KEYS[type];

  const { data: savedRaw, isLoading } = useQuery({
    queryKey: ['admin-dashboard-layout', key],
    queryFn: async () => {
      const { data } = await supabase
        .from('site_settings' as any)
        .select('value')
        .eq('key', key)
        .maybeSingle();
      return (data as any)?.value as string | undefined;
    },
    staleTime: 0,
  });

  const initial = useMemo(() => {
    let parsed: DashboardLayoutItem[] | null = null;
    if (savedRaw) {
      try {
        const arr = JSON.parse(savedRaw);
        if (Array.isArray(arr)) parsed = arr;
      } catch { /* falha-soft */ }
    }
    return mergeWithDefaults(type, parsed);
  }, [savedRaw, type]);

  const [items, setItems] = useState<DashboardLayoutItem[]>(initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setItems(initial);
    setDirty(false);
  }, [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((curr) => {
      const oldIdx = curr.findIndex((i) => i.id === active.id);
      const newIdx = curr.findIndex((i) => i.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return curr;
      const moved = arrayMove(curr, oldIdx, newIdx);
      return moved.map((it, idx) => ({ ...it, order: idx + 1 }));
    });
    setDirty(true);
  };

  const handleToggle = (id: string, visible: boolean) => {
    setItems((curr) => curr.map((it) => (it.id === id ? { ...it, visible } : it)));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = items.map((it, idx) => ({ ...it, order: idx + 1 }));
      const { error } = await supabase
        .from('site_settings' as any)
        .upsert(
          {
            key,
            value: JSON.stringify(payload),
            label: `Layout do Dashboard — ${type}`,
            description: 'Ordem e visibilidade das seções do dashboard. Gerenciado em /admin/dashboard-layout.',
            is_public: true,
          },
          { onConflict: 'key' },
        );
      if (error) throw error;
      await logAuditAction({
        action: 'setting_updated',
        resource_type: 'site_settings',
        resource_id: key,
        details: {
          scope: 'dashboard_layout',
          type,
          count: payload.length,
          visible_count: payload.filter((p) => p.visible).length,
        },
      });
    },
    onSuccess: () => {
      toast.success('Layout salvo com sucesso.');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['admin-dashboard-layout', key] });
      qc.invalidateQueries({ queryKey: ['dashboard-layout', key] });
      qc.invalidateQueries({ queryKey: ['site-settings'] });
    },
    onError: (err: any) => {
      toast.error('Falha ao salvar layout', { description: err?.message ?? 'Tente novamente.' });
    },
  });

  const handleRestore = () => {
    if (!window.confirm('Restaurar o layout padrão deste tipo? As alterações locais não salvas serão perdidas.')) return;
    const defaults = DEFAULT_DASHBOARD_LAYOUTS[type].map((d, idx) => ({ ...d, order: idx + 1 }));
    setItems(defaults);
    setDirty(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const visibleCount = items.filter((i) => i.visible).length;

  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">{items.length}</strong> seções —{' '}
          <strong className="text-foreground">{visibleCount}</strong> visíveis
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRestore}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Restaurar padrão
          </Button>
          <Button
            size="sm"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </Card>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((it) => (
              <SortableRow key={it.id} item={it} onToggle={handleToggle} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

const AdminDashboardLayoutPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [tab, setTab] = useState<DashboardProfileType>('provider');

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6">Carregando…</div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="p-6 text-sm text-muted-foreground">Acesso restrito a administradores.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <header className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Layout className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Layout do Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Configure ordem e visibilidade das seções do dashboard por tipo de cadastro.
              Alterações afetam todos os usuários daquele tipo após salvar.
            </p>
          </div>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as DashboardProfileType)}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            {TYPES.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {TYPES.map((t) => (
            <TabsContent key={t.key} value={t.key} className="mt-4">
              <LayoutEditor type={t.key} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardLayoutPage;
