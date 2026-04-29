import { describe, it, expect } from 'vitest';

/**
 * Contrato da RPC search_user_notifications:
 *  - aceita _query (texto livre), _status ('all'|'unread'|'read'),
 *    _order ('date'|'relevance'), _limit, _offset
 *  - retorna total_count na primeira coluna agregada
 *  - quando _query é vazio, ordena sempre por created_at desc (relevance ignorado)
 */

type RpcArgs = {
  _query: string | null;
  _status: 'all' | 'unread' | 'read';
  _order: 'date' | 'relevance';
  _limit: number;
  _offset: number;
};

const buildArgs = (search: string, filter: 'all' | 'unread' | 'read', order: 'date' | 'relevance', page: number, pageSize = 50): RpcArgs => {
  const trimmed = search.trim();
  return {
    _query: trimmed || null,
    _status: filter,
    _order: trimmed ? order : 'date',
    _limit: pageSize,
    _offset: page * pageSize,
  };
};

describe('AdminInbox — busca full-text', () => {
  it('envia _query=null quando a busca está vazia', () => {
    const a = buildArgs('   ', 'unread', 'relevance', 0);
    expect(a._query).toBeNull();
    expect(a._order).toBe('date'); // sem query, força date
  });

  it('preserva _order=relevance quando há texto', () => {
    const a = buildArgs('integridade', 'all', 'relevance', 0);
    expect(a._query).toBe('integridade');
    expect(a._order).toBe('relevance');
  });

  it('calcula offset corretamente para paginação', () => {
    expect(buildArgs('', 'unread', 'date', 0)._offset).toBe(0);
    expect(buildArgs('', 'unread', 'date', 2)._offset).toBe(100);
    expect(buildArgs('', 'unread', 'date', 5, 25)._offset).toBe(125);
  });

  it('respeita filtro de status', () => {
    expect(buildArgs('x', 'read', 'date', 0)._status).toBe('read');
    expect(buildArgs('x', 'unread', 'date', 0)._status).toBe('unread');
    expect(buildArgs('x', 'all', 'date', 0)._status).toBe('all');
  });
});
