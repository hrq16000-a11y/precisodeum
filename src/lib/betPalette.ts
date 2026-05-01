/**
 * Bet Mode Palette — fonte única de tokens de cor para o Wizard e o Dashboard.
 *
 * REGRA: Qualquer nova tela DEVE consumir destes presets em vez de classes
 * Tailwind cruas (bg-amber-500, bg-blue-600, etc.). Isso garante:
 *   - Consistência da paleta âmbar → laranja → verde.
 *   - Estados padronizados (hover/focus/active/disabled/error/success).
 *   - Tema editável centralmente via tokens HSL em src/index.css.
 *
 * Uso:
 *   import { bet } from '@/lib/betPalette';
 *   <button className={cn(bet.button.primary)}>Avançar</button>
 *   <input className={cn(bet.input.base, hasError && bet.input.error)} />
 *   <div className={bet.surface.softAmber}>...</div>
 */

export const bet = {
  // ── Botões ──
  button: {
    /** CTA primário Bet Mode (gradiente âmbar → laranja → verde) */
    primary: [
      'inline-flex items-center justify-center gap-2',
      'bg-gradient-to-r from-bet-amber via-bet-orange to-bet-green',
      'text-white font-semibold',
      'rounded-xl px-5 py-3',
      'shadow-[var(--bet-glow)]',
      'transition-all duration-200',
      'hover:from-bet-amber-hover hover:via-bet-orange-hover hover:to-bet-green-hover hover:scale-[1.02]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bet-orange focus-visible:ring-offset-2',
      'active:scale-[0.98]',
      'disabled:bg-bet-disabled-bg disabled:bg-none disabled:text-bet-disabled-fg disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100',
    ].join(' '),

    /** Secundário (somente borda âmbar) */
    secondary: [
      'inline-flex items-center justify-center gap-2',
      'bg-white text-bet-orange-fg border border-bet-orange-border',
      'rounded-xl px-4 py-2.5 font-medium',
      'transition-colors duration-200',
      'hover:bg-bet-orange-soft hover:border-bet-orange',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bet-orange focus-visible:ring-offset-1',
      'active:bg-bet-amber-soft',
      'disabled:bg-bet-disabled-bg disabled:text-bet-disabled-fg disabled:border-transparent disabled:cursor-not-allowed',
    ].join(' '),

    /** Ghost (texto âmbar, sem fundo) — usado no botão Voltar */
    ghost: [
      'inline-flex items-center gap-1.5 text-bet-orange-fg',
      'hover:text-bet-orange-active hover:bg-bet-orange-soft',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bet-orange focus-visible:ring-offset-1',
      'rounded-lg px-3 py-1.5 transition-colors duration-150',
      'disabled:text-bet-disabled-fg disabled:cursor-not-allowed',
    ].join(' '),

    /** Destrutivo (vermelho semântico, mantém paleta global) */
    destructive: [
      'inline-flex items-center justify-center gap-2',
      'bg-bet-error text-white rounded-xl px-4 py-2.5 font-medium',
      'transition-colors duration-200',
      'hover:bg-bet-error/90',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bet-error focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
    ].join(' '),
  },

  // ── Inputs / selects ──
  input: {
    base: [
      'w-full rounded-xl border border-input bg-white px-4 py-3',
      'text-foreground placeholder:text-muted-foreground',
      'transition-colors duration-150',
      'hover:border-bet-orange-border',
      'focus:outline-none focus:ring-2 focus:ring-bet-orange focus:border-bet-orange',
      'disabled:bg-bet-disabled-bg disabled:text-bet-disabled-fg disabled:cursor-not-allowed',
    ].join(' '),
    /** Estado de erro — aplique junto com input.base */
    error: 'border-bet-error bg-bet-error-soft focus:ring-bet-error focus:border-bet-error',
    /** Estado válido / sucesso — verde Bet Mode */
    success: 'border-bet-green bg-bet-green-soft focus:ring-bet-green focus:border-bet-green',
  },

  // ── Superfícies / cards ──
  surface: {
    /** Card padrão branco com hover suave âmbar */
    card: 'rounded-2xl bg-card border border-border shadow-sm transition-all duration-200 hover:border-bet-orange-border hover:shadow-md',
    /** Card selecionável (ex.: select de serviço) */
    selectable:
      'rounded-2xl border bg-card p-4 cursor-pointer transition-all duration-200 hover:border-bet-orange hover:bg-bet-amber-soft/50 focus-within:ring-2 focus-within:ring-bet-orange',
    /** Card selecionado (estado ativo) */
    selected: 'border-bet-orange bg-bet-amber-soft ring-2 ring-bet-orange/30',
    /** Surface âmbar suave (banners informativos) */
    softAmber: 'bg-bet-amber-soft border border-bet-amber-border text-bet-amber-fg rounded-xl',
    /** Surface laranja suave (CTAs/atenção) */
    softOrange: 'bg-bet-orange-soft border border-bet-orange-border text-bet-orange-fg rounded-xl',
    /** Surface verde suave (sucesso/confirmação) */
    softGreen: 'bg-bet-green-soft border border-bet-green-border text-bet-green-fg rounded-xl',
    /** Surface erro suave */
    softError: 'bg-bet-error-soft border border-bet-error-border text-bet-error rounded-xl',
  },

  // ── Texto / tipografia semântica ──
  text: {
    primary: 'text-bet-orange-fg',
    accent: 'text-bet-orange',
    success: 'text-bet-green-fg',
    error: 'text-bet-error',
    muted: 'text-muted-foreground',
    label: 'text-sm font-medium text-foreground',
  },

  // ── Badges / pills ──
  badge: {
    amber: 'inline-flex items-center gap-1 rounded-full bg-bet-amber-soft text-bet-amber-fg border border-bet-amber-border px-2.5 py-0.5 text-xs font-medium',
    orange: 'inline-flex items-center gap-1 rounded-full bg-bet-orange-soft text-bet-orange-fg border border-bet-orange-border px-2.5 py-0.5 text-xs font-medium',
    green: 'inline-flex items-center gap-1 rounded-full bg-bet-green-soft text-bet-green-fg border border-bet-green-border px-2.5 py-0.5 text-xs font-medium',
    error: 'inline-flex items-center gap-1 rounded-full bg-bet-error-soft text-bet-error border border-bet-error-border px-2.5 py-0.5 text-xs font-medium',
  },

  // ── Estados de foco/seleção (utilitários soltos) ──
  state: {
    focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bet-orange focus-visible:ring-offset-2',
    hoverLift: 'transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]',
    disabled: 'disabled:bg-bet-disabled-bg disabled:text-bet-disabled-fg disabled:cursor-not-allowed disabled:hover:scale-100',
  },

  // ── Gradientes oficiais (via classes utilitárias) ──
  gradient: {
    /** Gradiente CTA (idêntico ao botão primário) */
    cta: 'bg-gradient-to-r from-bet-amber via-bet-orange to-bet-green',
    /** Gradiente vertical para cabeçalhos */
    heroVertical: 'bg-gradient-to-b from-bet-amber-soft via-bet-orange-soft to-bet-green-soft',
    /** Gradiente de texto (use com bg-clip-text text-transparent) */
    text: 'bg-gradient-to-r from-bet-amber via-bet-orange to-bet-green bg-clip-text text-transparent',
  },
} as const;

export type BetPalette = typeof bet;
