import { Star, MessageCircle, MapPin, Phone, Crown } from 'lucide-react';

interface ThemeConfig {
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

const THEME_CLASSES: Record<string, ThemeConfig> = {
  default: {
    card: 'rounded-xl border border-border bg-card shadow-card',
    section: 'rounded-xl border border-border bg-card p-4 shadow-card',
    page: 'bg-background',
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
    section: 'rounded-2xl border-0 bg-gradient-to-br from-card to-accent/5 p-4 shadow-lg',
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
    section: 'rounded-lg border-2 border-amber-200/60 bg-amber-50/30 p-4 shadow-sm',
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
    section: 'rounded-none border-0 border-b border-border/30 bg-transparent p-4 shadow-none',
    page: 'bg-background',
    heading: "font-['Space_Grotesk'] font-light tracking-[0.2em] uppercase text-xs",
    button: 'rounded-none border-b-2 border-foreground bg-transparent text-foreground shadow-none',
    buttonOutline: 'rounded-none border-b border-border/50',
    fontBody: "font-['DM_Sans'] font-light",
    fontHeading: "font-['Space_Grotesk']",
    badge: 'rounded-none border-b border-border/30',
    input: 'rounded-none border-0 border-b border-border/50 bg-transparent',
  },
};

interface ThemePreviewProps {
  theme: string;
  accentColor: string;
  headline: string;
  tagline: string;
  ctaText: string;
  ctaWhatsappText: string;
  coverImageUrl: string;
}

const ThemePreview = ({ theme, accentColor, headline, tagline, ctaText, ctaWhatsappText, coverImageUrl }: ThemePreviewProps) => {
  const tc = THEME_CLASSES[theme] || THEME_CLASSES.default;
  const accentBg = accentColor ? `hsl(${accentColor})` : undefined;

  return (
    <div className={`${tc.page} ${tc.fontBody} rounded-xl border border-border overflow-hidden`} style={{ fontSize: '11px' }}>
      {/* Mini cover */}
      {coverImageUrl ? (
        <div className="relative w-full h-20 overflow-hidden">
          <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-3 text-white">
            <p className={`${tc.fontHeading} text-xs font-bold drop-shadow`}>{headline || 'Sua headline aqui'}</p>
            {tagline && <p className="text-[9px] opacity-80">{tagline}</p>}
          </div>
        </div>
      ) : (
        <div className="px-3 pt-3">
          {(headline || tagline) && (
            <div className="mb-2">
              <p className={`${tc.fontHeading} text-xs font-bold text-foreground`}>{headline || 'Sua headline aqui'}</p>
              {tagline && <p className="text-[9px] text-muted-foreground">{tagline}</p>}
            </div>
          )}
        </div>
      )}

      <div className="p-3 space-y-2">
        {/* Profile card mini */}
        <div className={`${tc.card} p-3`}>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px] font-bold shrink-0">JP</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={`${tc.fontHeading} text-xs font-bold text-foreground truncate`}>João Profissional</span>
                <span className={`${tc.badge} px-1 py-0.5 text-[8px] font-semibold`} style={{ backgroundColor: accentBg || 'hsl(var(--accent))', color: 'white' }}>
                  <Crown className="h-2 w-2 inline" />
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" /> São Paulo - SP
              </div>
              <div className="flex items-center gap-0.5 mt-0.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} className="h-2.5 w-2.5" fill={i <= 4 ? 'hsl(var(--accent))' : 'none'} stroke={i <= 4 ? 'hsl(var(--accent))' : 'currentColor'} />
                ))}
                <span className="text-[8px] text-muted-foreground ml-0.5">(12)</span>
              </div>
            </div>
          </div>
          <div className="mt-2 flex gap-1.5">
            <button className={`${tc.button} px-2 py-1 text-[9px] font-semibold text-white flex items-center gap-0.5`} style={{ backgroundColor: accentBg || 'hsl(var(--accent))' }}>
              <MessageCircle className="h-2.5 w-2.5" /> {ctaWhatsappText || 'WhatsApp'}
            </button>
            <button className={`${tc.buttonOutline} px-2 py-1 text-[9px] text-foreground flex items-center gap-0.5 bg-background`}>
              <Phone className="h-2.5 w-2.5" /> Ligar
            </button>
          </div>
        </div>

        {/* About mini */}
        <div className={`${tc.section}`}>
          <h3 className={`${tc.heading} text-[10px] font-bold text-foreground`}>Sobre o profissional</h3>
          <p className="mt-1 text-[9px] text-muted-foreground leading-relaxed">Profissional com mais de 10 anos de experiência...</p>
        </div>

        {/* Services mini */}
        <div className={`${tc.section}`}>
          <h3 className={`${tc.heading} text-[10px] font-bold text-foreground`}>Serviços</h3>
          <div className="mt-1 space-y-1">
            <div className={`${tc.input} p-1.5 bg-background`}>
              <span className="text-[9px] font-semibold text-foreground">Instalação Elétrica</span>
              <span className="text-[8px] text-muted-foreground block">💰 A partir de R$ 150</span>
            </div>
            <div className={`${tc.input} p-1.5 bg-background`}>
              <span className="text-[9px] font-semibold text-foreground">Manutenção Geral</span>
              <span className="text-[8px] text-muted-foreground block">💰 A partir de R$ 80</span>
            </div>
          </div>
        </div>

        {/* Lead form mini */}
        <div className={`${tc.section}`}>
          <h3 className={`${tc.heading} text-[10px] font-bold text-foreground`}>{ctaText || 'Solicitar Orçamento'}</h3>
          <div className="mt-1 space-y-1">
            <div className={`${tc.input} h-5 bg-background px-1.5 text-[8px] text-muted-foreground flex items-center`}>Seu nome</div>
            <div className={`${tc.input} h-5 bg-background px-1.5 text-[8px] text-muted-foreground flex items-center`}>Seu telefone</div>
            <button className={`${tc.button} w-full py-1 text-[9px] font-semibold text-white`} style={{ backgroundColor: accentBg || 'hsl(var(--accent))' }}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemePreview;
