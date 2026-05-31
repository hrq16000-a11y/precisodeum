/**
 * Garante que o atributo `data-seo-ready` do ProviderProfile NUNCA dispara
 * quando o provider ainda está em loading, ausente ou em fallback de erro.
 *
 * Como o ProviderProfile real é gigante (~2.4k linhas) e depende de N hooks
 * externos, validamos aqui a EXPRESSÃO exata aplicada ao atributo via wrapper
 * mínimo que replica a forma usada em `src/pages/ProviderProfile.tsx`.
 * O teste estático `seo-ready-marker.test.tsx` garante que a expressão em
 * produção continua igual à validada aqui — qualquer divergência quebra um
 * dos dois testes.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Espelho EXATO da expressão usada em src/pages/ProviderProfile.tsx (linha do return).
// Se essa string mudar, o teste estático em seo-ready-marker.test.tsx também alerta.
function ProviderShell({ loading, provider }: { loading: boolean; provider: unknown }) {
  return (
    <div data-testid="root" data-seo-ready={!loading && !!provider ? 'true' : undefined}>
      perfil
    </div>
  );
}

describe('ProviderProfile · data-seo-ready (gate do prerender)', () => {
  it('não aplica o atributo enquanto loading=true (mesmo com provider em cache)', () => {
    const { getByTestId } = render(
      <ProviderShell loading={true} provider={{ id: 'p1' }} />,
    );
    expect(getByTestId('root').hasAttribute('data-seo-ready')).toBe(false);
  });

  it('não aplica quando provider é null (fallback "não encontrado")', () => {
    const { getByTestId } = render(<ProviderShell loading={false} provider={null} />);
    expect(getByTestId('root').hasAttribute('data-seo-ready')).toBe(false);
  });

  it('não aplica quando provider é undefined (erro silencioso/try-catch)', () => {
    const { getByTestId } = render(
      <ProviderShell loading={false} provider={undefined} />,
    );
    expect(getByTestId('root').hasAttribute('data-seo-ready')).toBe(false);
  });

  it('aplica "true" SOMENTE quando loading=false E provider presente', () => {
    const { getByTestId } = render(
      <ProviderShell loading={false} provider={{ id: 'p1' }} />,
    );
    expect(getByTestId('root').getAttribute('data-seo-ready')).toBe('true');
  });

  it('source real de ProviderProfile usa exatamente !loading && !!provider', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/pages/ProviderProfile.tsx'),
      'utf-8',
    );
    // Procura o atributo data-seo-ready com a condição esperada.
    expect(src).toMatch(
      /data-seo-ready=\{!loading\s*&&\s*!!provider\s*\?\s*['"]true['"]\s*:\s*undefined\}/,
    );
  });
});
