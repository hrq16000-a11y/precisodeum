/**
 * Camada de motion do sistema (Design Motion Principles).
 *
 * Regras:
 *  - toda tela assíncrona usa <AsyncBoundary> com skeleton — nunca tela branca;
 *  - toda imagem fora da dobra usa <LazyImage> (lazy + shimmer + fade/blur-up);
 *  - entradas de seção usam <Reveal> (ou a classe .motion-stagger em grids);
 *  - progresso usa <ProgressIndicator> (determinado ou indeterminado);
 *  - durações 140/220/320ms, easing ease-out, deslocamento ≤ 8px, sem CLS;
 *  - `prefers-reduced-motion` neutraliza todas as animações.
 */
export { default as AsyncBoundary, isPermissionError } from './AsyncBoundary';
export { default as LazyImage } from './LazyImage';
export { default as ProgressIndicator } from './ProgressIndicator';
export { default as Reveal } from './Reveal';
export { default as RouteMotion } from './RouteMotion';
export { default as RouteSkeleton } from './RouteSkeleton';
export {
  SkeletonCard,
  SkeletonCardGrid,
  SkeletonForm,
  SkeletonList,
  SkeletonTable,
  SkeletonText,
} from './Skeletons';
