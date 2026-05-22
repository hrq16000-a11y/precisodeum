import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import CityAutocomplete from '@/components/CityAutocomplete';
import CategoryCombobox from '@/components/admin/CategoryCombobox';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeSlug } from '@/lib/slugify';
import { logAuditAction } from '@/hooks/useAuditLog';

/**
 * Picker controlado para escopo do sponsor (cidade / categoria).
 * - Reutiliza CityAutocomplete (dataset oficial `cities` IBGE).
 * - Reutiliza CategoryCombobox (lista canônica de `categories`).
 * - Sempre que o admin seleciona pelo picker, slug oficial é aplicado client-side.
 * - "Modo manual" libera input livre para casos excepcionais, registra audit log.
 */
interface Props {
  sponsorType: 'global' | 'city' | 'category' | string;
  linkedCity: string;
  linkedCategory: string;
  sponsorId?: string | null;
  onChange: (patch: {
    linked_city?: string;
    linked_city_slug?: string;
    linked_category?: string;
    linked_category_slug?: string;
  }) => void;
}

const SponsorScopePicker = ({
  sponsorType,
  linkedCity,
  linkedCategory,
  sponsorId,
  onChange,
}: Props) => {
  const [manual, setManual] = useState(false);
  const [cityState, setCityState] = useState<{ city: string; state: string }>({
    city: linkedCity || '',
    state: '',
  });

  // Atualiza estado interno quando o form externo muda
  useEffect(() => {
    setCityState((prev) => (prev.city === linkedCity ? prev : { city: linkedCity || '', state: prev.state }));
  }, [linkedCity]);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-sponsor-categories-canonical'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories' as any)
        .select('id, name, slug, icon')
        .is('deleted_at', null)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
    staleTime: 5 * 60_000,
    enabled: sponsorType === 'category',
  });

  if (sponsorType !== 'city' && sponsorType !== 'category') return null;

  const handleManualToggle = async (next: boolean) => {
    setManual(next);
    if (next) {
      await logAuditAction({
        action: 'update',
        resource_type: 'sponsor_scope_override',
        resource_id: sponsorId || undefined,
        details: {
          sponsor_type: sponsorType,
          linked_city: linkedCity,
          linked_category: linkedCategory,
          reason: 'admin_enabled_manual_override',
        },
      });
    }
  };

  // ─── Cidade ───
  if (sponsorType === 'city') {
    return (
      <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-1.5 text-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Cidade {manual ? '(manual)' : '(canônica)'}
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Modo manual</span>
            <Switch checked={manual} onCheckedChange={handleManualToggle} />
          </div>
        </div>

        {manual ? (
          <>
            <Input
              value={linkedCity}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ linked_city: v, linked_city_slug: sanitizeSlug(v) });
              }}
              placeholder="Digite a cidade exatamente como deve aparecer"
            />
            <div className="flex items-start gap-1.5 text-[10px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                Override manual ativo — slug normalizado automaticamente:
                <Badge variant="outline" className="ml-1 text-[10px] font-mono">
                  {sanitizeSlug(linkedCity) || '—'}
                </Badge>
              </span>
            </div>
          </>
        ) : (
          <>
            <CityAutocomplete
              value={cityState}
              onChange={(next) => {
                setCityState(next);
                onChange({
                  linked_city: next.city,
                  linked_city_slug: sanitizeSlug(next.city),
                });
              }}
              placeholder="Buscar cidade canônica..."
            />
            {linkedCity && (
              <p className="text-[10px] text-muted-foreground">
                Slug: <span className="font-mono">{sanitizeSlug(linkedCity)}</span>
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // ─── Categoria ───
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5 text-sm">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Categoria {manual ? '(manual)' : '(canônica)'}
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Modo manual</span>
          <Switch checked={manual} onCheckedChange={handleManualToggle} />
        </div>
      </div>

      {manual ? (
        <>
          <Input
            value={linkedCategory}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ linked_category: v, linked_category_slug: sanitizeSlug(v) });
            }}
            placeholder="Slug da categoria (ex: eletricista)"
          />
          <div className="flex items-start gap-1.5 text-[10px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              Override manual — preferível escolher da lista oficial. Slug aplicado:
              <Badge variant="outline" className="ml-1 text-[10px] font-mono">
                {sanitizeSlug(linkedCategory) || '—'}
              </Badge>
            </span>
          </div>
        </>
      ) : (
        <>
          <CategoryCombobox
            categories={categories.map((c) => ({ id: c.slug || c.id, name: c.name, icon: c.icon }))}
            value={
              categories.find(
                (c) => (c.slug || c.id) === linkedCategory || c.slug === sanitizeSlug(linkedCategory),
              )?.slug ?? null
            }
            onChange={(id) => {
              const picked = categories.find((c) => (c.slug || c.id) === id);
              const name = picked?.name || '';
              const slug = picked?.slug || (id ? sanitizeSlug(id) : '');
              onChange({
                linked_category: slug || '',
                linked_category_slug: slug || '',
              });
            }}
            placeholder="Buscar categoria canônica..."
          />
          {linkedCategory && (
            <p className="text-[10px] text-muted-foreground">
              Slug: <span className="font-mono">{sanitizeSlug(linkedCategory)}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default SponsorScopePicker;
