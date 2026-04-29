import { describe, it, expect, beforeEach } from 'vitest';
import {
  markLeadFormStarted,
  readLeadFormMark,
  markLeadFormSubmitted,
  clearLeadFormMark,
} from '@/lib/leadConversionTelemetry';

describe('leadConversionTelemetry', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('persiste e lê marca do funil de lead', () => {
    markLeadFormStarted({ providerId: 'p-1', source: 'profile', serviceId: 's-1' });
    const mark = readLeadFormMark('p-1');
    expect(mark).toBeTruthy();
    expect(mark!.providerId).toBe('p-1');
    expect(mark!.source).toBe('profile');
    expect(typeof mark!.startedAt).toBe('number');
  });

  it('retorna null quando não há marca', () => {
    expect(readLeadFormMark('inexistente')).toBeNull();
  });

  it('mede tempo entre clique e envio e limpa a marca', async () => {
    markLeadFormStarted({ providerId: 'p-2', source: 'card' });
    await new Promise((r) => setTimeout(r, 5));
    const elapsed = markLeadFormSubmitted('p-2');
    expect(elapsed).not.toBeNull();
    expect(elapsed!).toBeGreaterThanOrEqual(0);
    // marca deve ter sido limpa
    expect(readLeadFormMark('p-2')).toBeNull();
  });

  it('markLeadFormSubmitted retorna null sem marca prévia', () => {
    expect(markLeadFormSubmitted('sem-marca')).toBeNull();
  });

  it('clearLeadFormMark remove explicitamente', () => {
    markLeadFormStarted({ providerId: 'p-3' });
    clearLeadFormMark('p-3');
    expect(readLeadFormMark('p-3')).toBeNull();
  });
});
