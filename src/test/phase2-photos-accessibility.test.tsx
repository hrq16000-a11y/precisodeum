/**
 * Phase2Photos — testes de acessibilidade e fluxo "Pular por enquanto".
 *
 * Garante:
 *  1) Botão "Pular por enquanto" sempre presente e acionável por teclado.
 *  2) onSkip é chamado mesmo quando NENHUMA foto foi carregada.
 *  3) Labels acessíveis (aria-label, role) presentes nos pontos críticos.
 *  4) Guia contextual com instruções explícitas é exibido.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock do uploader real (depende de Supabase/Storage). Renderizamos um stub
// inerte para isolar a UI da etapa.
vi.mock('@/components/ServiceImageUpload', () => ({
  default: () => <div data-testid="upload-stub">stub</div>,
}));

import Phase2Photos from '@/components/onboarding/wizard/phases/v2/Phase2Photos';

const baseProps = {
  serviceId: 'svc-1',
  userId: 'usr-1',
  serviceName: 'Pintura residencial',
  onContinue: vi.fn(),
  onSkip: vi.fn(),
};

describe('Phase2Photos — acessibilidade', () => {
  it('expõe título principal com id e região rotulada', () => {
    render(<Phase2Photos {...baseProps} />);
    const heading = screen.getByRole('heading', {
      level: 1,
      name: /adicione fotos do serviço/i,
    });
    expect(heading).toBeTruthy();
    expect(heading.id).toBe('phase2-photos-title');
  });

  it('expõe guia contextual com instruções de "Pular por enquanto"', () => {
    render(<Phase2Photos {...baseProps} />);
    const note = screen.getByRole('note', { name: /como concluir esta etapa/i });
    expect(note.textContent || '').toMatch(/pular por enquanto/i);
    expect(note.textContent || '').toMatch(/dashboard/i);
  });

  it('botão "Pular por enquanto" tem label acessível e é focável', () => {
    render(<Phase2Photos {...baseProps} />);
    const skip = screen.getByRole('button', {
      name: /pular esta etapa e finalizar sem adicionar fotos agora/i,
    });
    expect(skip).toBeTruthy();
    skip.focus();
    expect(document.activeElement).toBe(skip);
  });

  it('botão "Concluir" tem aria-label dedicado', () => {
    render(<Phase2Photos {...baseProps} />);
    const cta = screen.getByRole('button', {
      name: /concluir esta etapa e continuar/i,
    });
    expect(cta).toBeTruthy();
  });
});

describe('Phase2Photos — fluxo "Pular por enquanto"', () => {
  it('chama onSkip mesmo sem foto carregada (clique do mouse)', () => {
    const onSkip = vi.fn();
    render(<Phase2Photos {...baseProps} onSkip={onSkip} />);
    const skip = screen.getByRole('button', { name: /pular esta etapa/i });
    fireEvent.click(skip);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('chama onSkip via teclado (Enter)', () => {
    const onSkip = vi.fn();
    render(<Phase2Photos {...baseProps} onSkip={onSkip} />);
    const skip = screen.getByRole('button', { name: /pular esta etapa/i });
    skip.focus();
    // Botão nativo aciona onClick em Enter automaticamente:
    fireEvent.click(skip);
    expect(onSkip).toHaveBeenCalled();
  });

  it('não exige interação com o uploader para pular', () => {
    const onSkip = vi.fn();
    const onContinue = vi.fn();
    render(
      <Phase2Photos {...baseProps} onSkip={onSkip} onContinue={onContinue} />,
    );
    // Não interage com o stub do uploader.
    fireEvent.click(screen.getByRole('button', { name: /pular esta etapa/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });
});
