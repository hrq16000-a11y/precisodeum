/**
 * Wizard V2 — Design tokens & componentes compartilhados.
 *
 * Padroniza todas as fases do Wizard V2 com o mesmo visual do
 * Bet Mode V3 (/cadastro-bet): cards arredondados, CTA gradiente
 * âmbar→laranja→verde, header tipográfico forte com chip de contexto.
 *
 * IMPORTANTE: Estas classes consomem os tokens `bet-*`
 * (definidos em src/index.css + tailwind.config.ts) e os presets
 * de src/lib/betPalette.ts. Para qualquer NOVA tela, prefira importar
 * diretamente `bet` de '@/lib/betPalette'.
 *
 * NUNCA use cores Tailwind cruas (bg-amber-500, bg-blue-600, etc.)
 * — sempre passe pelos tokens semânticos.
 */

export const wizardStyles = {
  /** Container externo de cada fase — denso, sem scroll desnecessário em mobile. */
  container: 'mx-auto w-full max-w-md space-y-2.5 px-4 py-2',
  /** Header centralizado com título e subtítulo. */
  headerWrap: 'space-y-0.5 text-center',
  /** Chip pequeno acima do título (ex.: "Cadastro express"). */
  chip:
    'mx-auto inline-flex items-center gap-2 rounded-full bg-bet-amber-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bet-amber-fg border border-bet-amber-border',
  /** Título principal (h1). */
  title: 'font-display text-lg font-extrabold leading-tight text-foreground',
  /** Subtítulo abaixo do título. */
  subtitle: 'text-xs text-muted-foreground',
  /** Card padronizado para agrupar inputs. */
  card: 'space-y-2 rounded-xl border border-border bg-card p-3 shadow-card',
  /** Label de campo (uppercase, ícone à esquerda, slot para badge à direita). */
  fieldLabel:
    'mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground',
  /** Input/textarea base — hover/focus/disabled padronizados via tokens Bet Mode. */
  input:
    'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground outline-hidden transition-colors hover:border-bet-orange-border focus:border-bet-orange focus:ring-2 focus:ring-bet-orange/30 disabled:bg-bet-disabled-bg disabled:text-bet-disabled-fg disabled:cursor-not-allowed',
  /** Input com brilho verde quando válido (estado de sucesso). */
  inputValid:
    'w-full rounded-lg border border-bet-green bg-background px-3 py-2.5 text-base text-foreground outline-hidden ring-2 ring-bet-green/40 shadow-[0_0_14px_hsl(var(--bet-green)/0.35)] transition focus:border-bet-green focus:ring-bet-green/40',
  /** Input com erro (estado de erro). */
  inputError:
    'w-full rounded-lg border border-bet-error bg-bet-error-soft px-3 py-2.5 text-base text-foreground outline-hidden ring-2 ring-bet-error/30 transition focus:border-bet-error focus:ring-bet-error/40',
  /** CTA principal — gradiente Bet Mode (âmbar→laranja→verde) com glow. */
  cta:
    'group h-12 w-full bg-gradient-to-r from-bet-amber via-bet-orange to-bet-green text-base font-bold text-white shadow-[var(--bet-glow)] transition-all hover:from-bet-amber-hover hover:via-bet-orange-hover hover:to-bet-green-hover hover:scale-[1.01] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-bet-orange focus-visible:ring-offset-2 active:scale-[0.99] disabled:bg-bet-disabled-bg disabled:bg-none disabled:text-bet-disabled-fg disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed',
  /** CTA secundário — outline neutro com hover âmbar. */
  ctaGhost:
    'h-12 w-full text-muted-foreground hover:bg-bet-amber-soft hover:text-bet-orange-fg focus-visible:ring-2 focus-visible:ring-bet-orange',
  /** CTA verde (ex.: WhatsApp / sucesso). */
  ctaGreen:
    'h-12 w-full bg-bet-green-soft border border-bet-green-border text-bet-green-fg hover:bg-bet-green/10 focus-visible:ring-2 focus-visible:ring-bet-green',
  /** Botão "voltar" minimalista no topo da fase. */
  backBtn:
    'inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bet-orange-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-bet-orange rounded-md px-1 transition-colors',
  /** Linha de pontos ganhos. */
  pointsBadge:
    'ml-auto rounded-full bg-bet-green-soft px-2 py-0.5 text-[10px] font-bold text-bet-green-fg border border-bet-green-border',
  /** Card de seleção (opções tipo "PF / PJ", "Sou profissional / cliente"). */
  selectCard:
    'group rounded-2xl border-2 border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-bet-orange hover:shadow-[0_0_24px_hsl(var(--bet-orange)/0.35)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-bet-orange',
  /** Card de seleção em estado SELECIONADO. */
  selectCardActive:
    'border-bet-orange bg-bet-amber-soft ring-2 ring-bet-orange/30',
  /** Ícone circular do select card (gradiente Bet Mode). */
  selectIcon:
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-bet-amber to-bet-green text-white shadow-[0_0_18px_hsl(var(--bet-orange)/0.4)]',
};

/** Animação de entrada padrão para cada fase (usar com framer-motion). */
export const wizardEnter = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};
