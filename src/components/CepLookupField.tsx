/**
 * CepLookupField — campo de busca por CEP com validação e fallback automático.
 *
 * - Aceita máscara 00000-000 (digitos puros também).
 * - Em CEP inválido (≠ 8 dígitos), mostra erro inline e NÃO chama API.
 * - Em CEP não encontrado, sugere usar o filtro por cidade (fallback).
 * - Em sucesso, dispara onResolved com { city, state, neighborhood, address }.
 */
import { useState } from 'react';
import { Loader2, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { lookupCep, formatCep, onlyDigits, type CepResult } from '@/lib/cepLookup';

interface CepLookupFieldProps {
  onResolved: (result: CepResult) => void;
  /** Texto auxiliar opcional abaixo do campo. */
  helper?: string;
  /** Quando o usuário pede para usar cidade (fallback). */
  onFallbackCity?: () => void;
}

const CepLookupField = ({ onResolved, helper, onFallbackCity }: CepLookupFieldProps) => {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleChange = (raw: string) => {
    const digits = onlyDigits(raw).slice(0, 8);
    const masked = digits.length > 5 ? formatCep(digits) : digits;
    setValue(masked);
    if (error) setError(null);
    if (success) setSuccess(null);
    if (notFound) setNotFound(false);
  };

  const handleSearch = async () => {
    setError(null);
    setSuccess(null);
    setNotFound(false);
    setLoading(true);
    try {
      const r = await lookupCep(value);
      if (r.ok) {
        setSuccess(`${r.city} • ${r.state}${r.neighborhood ? ` — ${r.neighborhood}` : ''}`);
        onResolved(r);
      } else if (r.reason === 'invalid_format') {
        setError(r.message);
      } else {
        setNotFound(true);
        setError(r.message);
      }
    } catch {
      setError('Falha ao consultar o CEP. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

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
              void handleSearch();
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
          disabled={loading || onlyDigits(value).length !== 8}
          aria-label="Buscar CEP"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
        </Button>
      </div>

      {success && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-emerald-600">
          <CheckCircle2 className="h-3 w-3" /> {success}
        </p>
      )}

      {error && (
        <p id="cep-helper" className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
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

      {!error && !success && helper && (
        <p id="cep-helper" className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
      )}
    </div>
  );
};

export default CepLookupField;
