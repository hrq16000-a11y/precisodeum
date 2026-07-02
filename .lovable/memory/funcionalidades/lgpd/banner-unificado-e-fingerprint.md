---
name: Banner LGPD glass + Device Fingerprint + Exclusão 1-clique
description: CookieConsent unificado com glassmorphism (mantém 3 botões LGPD), DeleteAccountDialog com motivo opcional, device fingerprint open-source atrás do consentimento Funcional
type: feature
---
**CookieConsent (`src/components/CookieConsent.tsx`)**
- Glassmorphism: `bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60` + ícones Lucide `ShieldCheck` (principal) e `Cookie` (badge inferior). Zero emojis.
- Mantém 3 CTAs (Preferências/Recusar/Aceitar todos) por exigência da LGPD — escolha do usuário em ask_questions.
- Copy reforça: "O uso da plataforma implica aceitação dos Termos e da Política de Privacidade".

**DeleteAccountDialog (`src/components/dashboard/DeleteAccountDialog.tsx`)**
- UX 1-clique: `canSubmit = !submitting` (motivo NÃO bloqueia mais).
- Select de motivo movido para `<details>` colapsado ("Quer nos contar o motivo? (opcional)").
- CTA: "Sim, excluir agora". Payload: `_reason: null` quando vazio (banco usa `self_request` como default).
- Redirect: `/?conta_excluida=1` para a Home aceitar mostrar toast/banner se quiser.

**Device Fingerprint (`src/lib/deviceFingerprint.ts`)**
- `@fingerprintjs/fingerprintjs` open-source (~30KB, gratuito).
- **Gate LGPD**: helper retorna `null` quando `getConsent().functional !== true`. Sem consentimento, nenhum identificador é gerado.
- Cache em `sessionStorage` (chave `device_fp_v1`) + memória — evita re-cálculo.
- Import dinâmico para não pesar no bundle inicial.
- `clearDeviceFingerprintCache()` exportado para uso em logout/exclusão.

**Integração com bloqueio (180d)**
- Migration `20260502_…` estende `check_registration_block(_email, _whatsapp, _device_fingerprint)` com novo vetor `matched_via='device'`.
- LoginPage chama `getDeviceFingerprint()` antes do RPC e humaniza o vetor "device" como "este dispositivo".

**Testes (51 verdes)**
- `src/test/device-fingerprint-and-unified-banner.test.ts` (12 testes): gate de consentimento, integração LoginPage, UX 1-clique e contrato visual do banner.
- `src/test/self-delete-e2e.test.tsx` atualizado: motivo opcional habilita o botão.
