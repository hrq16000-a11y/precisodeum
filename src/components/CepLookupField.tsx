/**
 * CepLookupField — campo de busca por CEP com validação, retry e fallback rico.
 *
 * - Aceita máscara 00000-000 (digitos puros também).
 * - Em CEP inválido (≠ 8 dígitos), mostra erro inline e NÃO chama API.
 * - Em CEP não encontrado, sugere cidades/UF baseado no prefixo (modo
 *   `suggestCitiesFromCep`) e oferece atalho para usar essa sugestão.
 * - Em sucesso, dispara onResolved com { city, state, neighborhood, address }.
 */
import { useState } from 'react';
import { Loader2, MapPin, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { lookupCep, formatCep, onlyDigits, type CepResult } from '@/lib/cepLookup';
import { suggestCitiesFromCep, type CitySuggestion } from '@/lib/citySuggestions';

interface CepLookupFieldProps {
  onResolved: (result: CepResult) => void;
  /** Texto auxiliar opcional abaixo do campo. */
  helper?: string;
  /** Quando o usuário pede para usar cidade (fallback). */
  onFallbackCity?: () => void;
  /** Disparado quando usuário aceita uma sugestão (cidade/UF). */
  onUseSuggestion?: (s: CitySuggestion) => void;
}

const CepLookupField = ({ onResolved, helper, onFallbackCity, onUseSuggestion }: CepLookupFieldProps) => {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);

  const handleChange = (raw: string) => {
    const digits = onlyDigits(raw).slice(0, 8);
    const masked = digits.length > 5 ? formatCep(digits) : digits;
    setValue(masked);
    if (error) setError(null);
    if (success) setSuccess(null);
    if (notFound) setNotFound(false);
    if (suggestions.length) setSuggestions([]);
  };

  const handleSearch = async () => {
    setError(null);
    setSuccess(null);
    setNotFound(false);
    setSuggestions([]);
    setLoading(true);
    try {
      const r = await lookupCep(value);
      if (r.ok === true) {
        setSuccess(`${r.city} • ${r.state}${r.neighborhood ? ` — ${r.neighborhood}` : ''}`);
        onResolved(r);
      } else {
        if (r.reason === 'invalid_format') {
          setError(r.message);
        } else {
          setNotFound(true);
          setError(r.message);
          // Tenta sugerir cidades a partir do prefixo do CEP
          const sug = await suggestCitiesFromCep(value);
          if (sug.length) setSuggestions(sug);
        }
      }
    } catch {
      setError('Falha ao consultar o CEP. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const digits = onlyDigits(value);
  // Detecta CEP incompleto (informa visualmente sem bloquear o botão)
  const incomplete = digits.length > 0 && digits.length < 8;

  return (
    <div>
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="h-3 w-3" /> Buscar por CEP
      </Label>
      <div className="mt-1 flex gap-2">
        <Input
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          maxLength={9}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (digits.length === 8) void handleSearch();
            }
          }}
          aria-invalid={!!error}
          aria-describedby="cep-helper"
          disabled={loading}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleSearch()}
          disabled={loading || digits.length !== 8}
          aria-label="Buscar CEP"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
        </Button>
      </div>

      {incomplete && !loading && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-amber-600">
          <AlertCircle className="h-3 w-3" /> CEP incompleto ({digits.length}/8 dígitos)
        </p>
      )}

      {success && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-emerald-600">
          <CheckCircle2 className="h-3 w-3" /> {success}
        </p>
      )}

      {error && !success && !incomplete && (
        <p id="cep-helper" className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}

      {notFound && suggestions.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-300/50 bg-amber-50/60 p-2 dark:bg-amber-500/5">
          <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Talvez você queria dizer:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {suggestions.map((s, i) => (
              <button
                key={`${s.city}-${s.state}-${i}`}
                type="button"
                onClick={() => onUseSuggestion?.(s)}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {s.city} • {s.state}
              </button>
            ))}
          </div>
        </div>
      )}

      {notFound && onFallbackCity && (
        <button
          type="button"
          onClick={onFallbackCity}
          className="mt-1 text-[11px] underline text-primary hover:text-primary/80"
        >
          Buscar por cidade
        </button>
      )}

      {!error && !success && !incomplete && helper && (
        <p id="cep-helper" className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
      )}
    </div>
  );
};

export default CepLookupField;
