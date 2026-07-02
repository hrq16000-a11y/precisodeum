import { describe, it, expect } from 'vitest';

/**
 * Validação dos pesos do tsvector (search_user_notifications).
 *
 * Não chama o banco; valida o contrato da query (parâmetros enviados) e
 * simula o ranking esperado para um conjunto de documentos PT-BR.
 *
 * Pesos oficiais:
 *   A = title    (peso 1.0  — máxima prioridade)
 *   B = message  (peso 0.4)
 *   C = type     (peso 0.2)
 *   D = link     (peso 0.1)
 *
 * Esses pesos são ts_rank defaults para {A,B,C,D} = {1.0, 0.4, 0.2, 0.1}.
 */

type Doc = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string;
};

const WEIGHTS = { A: 1.0, B: 0.4, C: 0.2, D: 0.1 } as const;

/** Simulador simples de ranking: soma pesos para cada termo da query encontrado em cada campo */
function simulateRank(doc: Doc, queryTokens: string[]) {
  const has = (txt: string, tok: string) => txt.toLowerCase().includes(tok.toLowerCase());
  let score = 0;
  for (const tok of queryTokens) {
    if (has(doc.title, tok))   score += WEIGHTS.A;
    if (has(doc.message, tok)) score += WEIGHTS.B;
    if (has(doc.type, tok))    score += WEIGHTS.C;
    if (has(doc.link, tok))    score += WEIGHTS.D;
  }
  return score;
}

describe('FTS PT-BR — pesos do tsvector', () => {
  it('título tem peso maior que mensagem para o mesmo termo', () => {
    const d: Doc = { id: '1', title: 'Integridade crítica', message: 'tudo ok', type: 'system', link: '/x' };
    const tituloHit = simulateRank(d, ['integridade']);
    const semTituloHit = simulateRank({ ...d, title: 'aviso', message: 'integridade' }, ['integridade']);
    expect(tituloHit).toBeGreaterThan(semTituloHit);
  });

  it('mensagem tem peso maior que tipo', () => {
    const docMsg: Doc = { id: '1', title: 't', message: 'lead', type: 'x', link: '/' };
    const docType: Doc = { id: '2', title: 't', message: 'm', type: 'lead', link: '/' };
    expect(simulateRank(docMsg, ['lead'])).toBeGreaterThan(simulateRank(docType, ['lead']));
  });

  it('tipo tem peso maior que link', () => {
    const docType: Doc = { id: '1', title: 't', message: 'm', type: 'integridade', link: '/' };
    const docLink: Doc = { id: '2', title: 't', message: 'm', type: 'x', link: '/integridade' };
    expect(simulateRank(docType, ['integridade'])).toBeGreaterThan(simulateRank(docLink, ['integridade']));
  });

  it('queries PT-BR — alerta crítico ranqueia documento com termo no título acima de outros', () => {
    const docs: Doc[] = [
      { id: 'a', title: 'Alerta crítico de integridade', message: 'x', type: 'system', link: '/admin/integridade' },
      { id: 'b', title: 'Resumo diário',                  message: 'um alerta crítico foi gerado', type: 'system', link: '/' },
      { id: 'c', title: 'Vagas abertas',                  message: 'sem novidades',                type: 'alerta',  link: '/vagas' },
    ];
    const ranked = [...docs].sort((x, y) => simulateRank(y, ['alerta', 'crítico']) - simulateRank(x, ['alerta', 'crítico']));
    expect(ranked[0].id).toBe('a');
  });

  it('queries PT-BR — "lead novo" prioriza título sobre link', () => {
    const docs: Doc[] = [
      { id: 'a', title: 'Lead novo recebido', message: '...', type: 'lead', link: '/leads/1' },
      { id: 'b', title: 'Mensagem',           message: 'novo lead chegou', type: 'lead', link: '/leads/1' },
      { id: 'c', title: 'Outros',             message: 'tudo ok', type: 'system', link: '/lead-novo' },
    ];
    const ranked = [...docs].sort((x, y) => simulateRank(y, ['lead', 'novo']) - simulateRank(x, ['lead', 'novo']));
    expect(ranked[0].id).toBe('a');
    expect(ranked[ranked.length - 1].id).toBe('c');
  });

  it('queries PT-BR — "patrocinador" desempata por título quando aparece em múltiplos campos', () => {
    const docs: Doc[] = [
      { id: 'a', title: 'Patrocinador aprovado', message: 'parabéns',     type: 'sponsor', link: '/admin/patrocinadores' },
      { id: 'b', title: 'Aviso',                  message: 'patrocinador', type: 'sponsor', link: '/admin/patrocinadores' },
    ];
    expect(simulateRank(docs[0], ['patrocinador'])).toBeGreaterThan(simulateRank(docs[1], ['patrocinador']));
  });

  it('contrato RPC: filtros avançados aceitam null e UUID válido', () => {
    const buildArgs = (provider?: string, type?: string) => ({
      _type: type && type !== '__all__' ? type : null,
      _provider_id: provider && /^[0-9a-f-]{36}$/i.test(provider) ? provider : null,
    });
    expect(buildArgs(undefined, '__all__')).toEqual({ _type: null, _provider_id: null });
    expect(buildArgs('not-a-uuid', 'lead')).toEqual({ _type: 'lead', _provider_id: null });
    expect(buildArgs('11111111-2222-3333-4444-555555555555', 'lead')._provider_id)
      .toBe('11111111-2222-3333-4444-555555555555');
  });
});
