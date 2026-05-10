import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Trash2, Pencil, GripVertical } from 'lucide-react';
import LazyImage from '@/components/ui/LazyImage';

interface SortablePhotoTileProps {
  id: string;
  imageUrl: string;
  caption: string;
  hasCaption: boolean;
  onOpenCaption: () => void;
  onDelete: () => void;
  /** When true, drag-handle is highlighted to teach the gesture. */
  showHint?: boolean;
}

/**
 * Tile arrastável (dnd-kit). O handle dedicado evita que cliques no thumb
 * sejam confundidos com drag (importante para o dialog de legenda).
 * A11y: o handle tem role implícito de button; teclado é coberto pelo
 * KeyboardSensor configurado no DndContext do pai.
 */
export function SortablePhotoTile({
  id,
  imageUrl,
  caption,
  hasCaption,
  onOpenCaption,
  onDelete,
  showHint,
}: SortablePhotoTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      data-testid="portfolio-photo-tile"
      data-photo-id={id}
      className={`group relative aspect-square overflow-hidden rounded-lg border bg-muted ${
        isDragging ? 'border-accent shadow-lg ring-2 ring-accent/40' : 'border-border'
      }`}
    >
      <button
        type="button"
        onClick={onOpenCaption}
        aria-label="Abrir legenda da foto"
        className="absolute inset-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <LazyImage
          src={imageUrl}
          alt={caption || 'Trabalho do portfólio'}
          width={400}
          height={400}
          sizesPreset="gallery-thumb"
          surface="portfolio-grid"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </button>

      {/* Hover overlay com legenda */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/80 via-foreground/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[11px] font-medium text-background line-clamp-2 leading-tight">
          {caption?.trim() ? caption : 'Toque para adicionar legenda'}
        </p>
      </div>

      {/* Drag handle — sempre visível em mobile pra ensinar o gesto */}
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        className={`absolute left-1.5 bottom-1.5 flex h-9 w-9 cursor-grab touch-none items-center justify-center rounded-full bg-background/85 text-foreground shadow-md backdrop-blur-sm transition-opacity active:cursor-grabbing ${
          showHint ? 'opacity-100 ring-2 ring-accent/50 animate-pulse' : 'opacity-80 group-hover:opacity-100'
        }`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Botão excluir */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Excluir foto"
        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Indicador de legenda existente */}
      {hasCaption && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil className="h-3 w-3" />
        </span>
      )}
    </motion.div>
  );
}
