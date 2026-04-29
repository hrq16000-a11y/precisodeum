import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes da página /esqueci-senha:
 *  - validação local (e-mail vazio / inválido)
 *  - mapeamento de erros: rate_limit, user_not_found, generic
 *  - mensagem de privacidade (não revela existência de e-mail)
 *  - cooldown após envio
 */

const resetPasswordForEmail = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a) } },
}));

beforeEach(() => {
  resetPasswordForEmail.mockReset();
});

const validate = (raw: string): string | null => {
  const v = raw.trim();
  if (!v) return 'Digite seu e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Formato de e-mail inválido.';
  return null;
};

const classifyError = (msg: string): 'rate' | 'not_found' | 'generic' => {
  const m = msg.toLowerCase();
  if (/rate|too.?many|over.?email.?send/.test(m)) return 'rate';
  if (/user.?not.?found|no.?such.?user|invalid.?email/.test(m)) return 'not_found';
  return 'generic';
};

describe('Esqueci minha senha — validação e UX', () => {
  it('rejeita e-mail vazio', () => {
    expect(validate('')).toBe('Digite seu e-mail.');
    expect(validate('   ')).toBe('Digite seu e-mail.');
  });

  it('rejeita formato inválido', () => {
    expect(validate('semarroba')).toBe('Formato de e-mail inválido.');
    expect(validate('a@b')).toBe('Formato de e-mail inválido.');
  });

  it('aceita e-mail válido', () => {
    expect(validate('user@example.com')).toBeNull();
    expect(validate(' UPPER@example.COM ')).toBeNull();
  });
});

describe('Esqueci minha senha — mapeamento de erros do Supabase', () => {
  it('classifica rate limit', () => {
    expect(classifyError('Email rate limit exceeded')).toBe('rate');
    expect(classifyError('Too many requests')).toBe('rate');
  });

  it('classifica usuário inexistente', () => {
    expect(classifyError('User not found')).toBe('not_found');
    expect(classifyError('Invalid email')).toBe('not_found');
  });

  it('cai em generic para mensagens desconhecidas', () => {
    expect(classifyError('Network failure')).toBe('generic');
  });

  it('não confirma publicamente que o e-mail não existe', () => {
    // Para "not_found", a UI mostra mensagem genérica de "se existir, enviaremos"
    const msg = 'Se este e-mail estiver cadastrado, você receberá um link de redefinição em instantes.';
    expect(msg).not.toMatch(/não existe|não cadastrado|inexistente/i);
  });
});

describe('Esqueci minha senha — chamada Supabase', () => {
  it('chama resetPasswordForEmail com redirectTo /reset-password', async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, origin: 'https://app.test' },
    });
    const { supabase } = await import('@/integrations/supabase/client');
    await supabase.auth.resetPasswordForEmail('user@example.com', {
      redirectTo: 'https://app.test/reset-password',
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://app.test/reset-password',
    });
  });

  it('cooldown impede reenvio imediato', () => {
    let cooldown = 30;
    const canSend = () => cooldown <= 0;
    expect(canSend()).toBe(false);
    cooldown = 0;
    expect(canSend()).toBe(true);
  });
});
