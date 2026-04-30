/**
 * Wizard V2 — Design tokens & componentes compartilhados.
 *
 * Padroniza todas as fases do Wizard V2 com o mesmo visual do
 * Bet Mode V3 (/cadastro-bet): cards arredondados, CTA gradiente
 * âmbar→laranja→rosa, header tipográfico forte com chip de contexto.
 *
 * Use estas classes para evitar drift visual entre fases.
 */

export const wizardStyles = {
  /** Container externo de cada fase — denso, sem scroll desnecessário em mobile. */
  container: 'mx-auto w-full max-w-md space-y-2.5 px-4 py-2',
  /** Header centralizado com título e subtítulo. */
  headerWrap: 'space-y-0.5 text-center',
  /** Chip pequeno acima do título (ex.: "Cadastro express"). */
  chip:
    'mx-auto inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  /** Título principal (h1). */
  title: 'font-display text-lg font-extrabold leading-tight text-foreground',
  /** Subtítulo abaixo do título. */
  subtitle: 'text-xs text-muted-foreground',
  /** Card padronizado para agrupar inputs. */
  card: 'space-y-2 rounded-xl border border-border bg-card p-3 shadow-card',
  /** Label de campo (uppercase, ícone à esquerda, slot para badge à direita). */
  fieldLabel:
    'mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground',
  /** Input/textarea base. */
  input:
    'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/40',
  /** Input com brilho verde quando válido. */
  inputValid:
    'w-full rounded-lg border border-emerald-500 bg-background px-3 py-2.5 text-base text-foreground outline-none ring-2 ring-emerald-300/50 shadow-[0_0_14px_rgba(16,185,129,0.35)] transition focus:border-emerald-500 focus:ring-emerald-300/50',
  /** CTA principal — gradiente âmbar→rosa com glow. */
  cta:
    'group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95 disabled:opacity-50',
  /** CTA secundário — outline neutro. */
  ctaGhost:
    'h-12 w-full text-muted-foreground hover:bg-muted hover:text-foreground',
  /** CTA verde (ex.: WhatsApp). */
  ctaGreen:
    'h-12 w-full bg-emerald-500/5 border border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10',
  /** Botão "voltar" minimalista no topo da fase. */
  backBtn:
    'inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition',
  /** Linha de pontos ganhos. */
  pointsBadge:
    'ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  /** Card de seleção (opções tipo "PF / PJ", "Sou profissional / cliente"). */
  selectCard:
    'group rounded-2xl border-2 border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-[0_0_24px_rgba(251,146,60,0.35)]',
  /** Ícone circular do select card (gradiente). */
  selectIcon:
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-[0_0_18px_rgba(251,146,60,0.4)]',
};

/** Animação de entrada padrão para cada fase (usar com framer-motion). */
export const wizardEnter = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};
