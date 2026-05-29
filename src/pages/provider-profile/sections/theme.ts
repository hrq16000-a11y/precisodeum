/**
 * Theme tokens compartilhados entre o orquestrador `ProviderProfile` e as
 * sections extraídas via lazy load. Mantém o contrato visual idêntico ao
 * monólito original — qualquer mudança aqui afeta todas as seções.
 */

export interface ThemeConfig {
  card: string;
  section: string;
  page: string;
  heading: string;
  button: string;
  buttonOutline: string;
  fontBody: string;
  fontHeading: string;
  badge: string;
  input: string;
}

export const THEME_CLASSES: Record<string, ThemeConfig> = {
  default: {
    card: 'rounded-xl border border-border bg-card shadow-card',
    section: 'rounded-xl border border-border bg-card p-6 shadow-card',
    page: '',
    heading: 'font-display',
    button: 'rounded-md',
    buttonOutline: 'rounded-md border border-input',
    fontBody: 'font-sans',
    fontHeading: "font-['Plus_Jakarta_Sans']",
    badge: 'rounded-full',
    input: 'rounded-md border border-input',
  },
  moderno: {
    card: 'rounded-2xl border-0 bg-gradient-to-br from-card to-accent/5 shadow-lg',
    section: 'rounded-2xl border-0 bg-gradient-to-br from-card to-accent/5 p-6 shadow-lg',
    page: 'bg-gradient-to-b from-background to-accent/5',
    heading: "font-['Space_Grotesk'] tracking-tight",
    button: 'rounded-xl shadow-lg',
    buttonOutline: 'rounded-xl border-2 border-primary/20',
    fontBody: "font-['DM_Sans']",
    fontHeading: "font-['Space_Grotesk']",
    badge: 'rounded-xl',
    input: 'rounded-xl border-0 bg-muted/50 shadow-inner',
  },
  classico: {
    card: 'rounded-lg border-2 border-amber-200/60 bg-amber-50/30 shadow-sm',
    section: 'rounded-lg border-2 border-amber-200/60 bg-amber-50/30 p-6 shadow-sm',
    page: 'bg-amber-50/20',
    heading: "font-['Playfair_Display'] italic",
    button: 'rounded-lg border-2',
    buttonOutline: 'rounded-lg border-2 border-amber-300/60',
    fontBody: "font-['DM_Sans']",
    fontHeading: "font-['Playfair_Display']",
    badge: 'rounded-lg border border-amber-200/60',
    input: 'rounded-lg border-2 border-amber-200/40',
  },
  minimalista: {
    card: 'rounded-none border-0 border-b border-border/30 bg-transparent shadow-none',
    section: 'rounded-none border-0 border-b border-border/30 bg-transparent p-6 shadow-none',
    page: 'bg-background',
    heading: "font-['Space_Grotesk'] font-light tracking-[0.2em] uppercase text-sm",
    button: 'rounded-none border-b-2 border-foreground bg-transparent text-foreground shadow-none hover:bg-foreground hover:text-background',
    buttonOutline: 'rounded-none border-b border-border/50',
    fontBody: "font-['DM_Sans'] font-light",
    fontHeading: "font-['Space_Grotesk']",
    badge: 'rounded-none border border-border/40 bg-transparent',
    input: 'rounded-none border-0 border-b border-border/40 bg-transparent',
  },
};
