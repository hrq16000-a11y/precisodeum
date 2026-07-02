import { describe, it, expect } from 'vitest';
import { canUserSend, userRemainingMessages, type SupportTicket } from '@/hooks/useSupportTicket';

const baseTicket = (over: Partial<SupportTicket> = {}): SupportTicket => ({
  id: 't1',
  user_id: 'u1',
  subject: 'Suporte',
  status: 'open_user',
  consecutive_user_msgs: 0,
  user_city: 'São Paulo',
  user_full_name: 'Fulano',
  last_message_text: null,
  last_message_at: null,
  unread_admin: 0,
  unread_user: 0,
  blocked: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...over,
});

describe('Regra das 3 mensagens — canUserSend', () => {
  it('permite enviar quando status=open_user e contador <3', () => {
    expect(canUserSend(baseTicket({ consecutive_user_msgs: 0 }))).toBe(true);
    expect(canUserSend(baseTicket({ consecutive_user_msgs: 1 }))).toBe(true);
    expect(canUserSend(baseTicket({ consecutive_user_msgs: 2 }))).toBe(true);
  });

  it('bloqueia ao atingir 3 mensagens consecutivas', () => {
    expect(canUserSend(baseTicket({ consecutive_user_msgs: 3 }))).toBe(false);
  });

  it('bloqueia quando status=open_admin (aguardando admin)', () => {
    expect(canUserSend(baseTicket({ status: 'open_admin', consecutive_user_msgs: 3 }))).toBe(false);
  });

  it('bloqueia quando status=closed', () => {
    expect(canUserSend(baseTicket({ status: 'closed' }))).toBe(false);
  });

  it('bloqueia quando ticket está bloqueado pelo admin', () => {
    expect(canUserSend(baseTicket({ blocked: true }))).toBe(false);
  });

  it('retorna false para ticket inexistente', () => {
    expect(canUserSend(null)).toBe(false);
    expect(canUserSend(undefined)).toBe(false);
  });
});

describe('userRemainingMessages', () => {
  it('conta mensagens restantes em open_user', () => {
    expect(userRemainingMessages(baseTicket({ consecutive_user_msgs: 0 }))).toBe(3);
    expect(userRemainingMessages(baseTicket({ consecutive_user_msgs: 1 }))).toBe(2);
    expect(userRemainingMessages(baseTicket({ consecutive_user_msgs: 2 }))).toBe(1);
    expect(userRemainingMessages(baseTicket({ consecutive_user_msgs: 3 }))).toBe(0);
  });

  it('retorna 0 fora de open_user', () => {
    expect(userRemainingMessages(baseTicket({ status: 'open_admin' }))).toBe(0);
    expect(userRemainingMessages(baseTicket({ status: 'closed' }))).toBe(0);
    expect(userRemainingMessages(null)).toBe(0);
  });
});
