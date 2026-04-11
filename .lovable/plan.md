

## Plan: Deep Link WhatsApp (`whatsapp://send`) com fallback

### Problema
Atualmente, `whatsappLink()` em `src/lib/whatsapp.ts` gera URLs `https://wa.me/...` que abrem o navegador primeiro, causando fricção em dispositivos mobile. O ideal e usar o deep link `whatsapp://send?phone=...` que abre a app diretamente.

### Estrategia: Deep link com fallback inteligente

Usar `whatsapp://send?phone=NUMERO&text=MENSAGEM` como esquema primario. Porem, em desktop, esse esquema pode falhar silenciosamente. A solucao e usar uma abordagem hibrida:

- **Mobile** (detectado via `navigator.userAgent` ou viewport): usar `whatsapp://send?phone=...`
- **Desktop**: manter `https://wa.me/...` como fallback seguro

### Alteracoes

**Arquivo: `src/lib/whatsapp.ts`**

1. Atualizar `whatsappLink()` para gerar `whatsapp://send?phone={canonical}&text={message}` por padrao
2. Adicionar funcao `whatsappDeepLink()` que retorna o deep link nativo
3. Adicionar funcao `whatsappWebLink()` que retorna o link wa.me (fallback)
4. Adicionar helper `isMobileDevice()` para detectar mobile
5. A funcao principal `whatsappLink()` passa a retornar automaticamente o deep link em mobile e o web link em desktop
6. A mensagem padrao continua: `"Olá, vi o seu perfil no Preciso de um e gostaria de um orçamento."`
7. O numero ja e sanitizado por `toCanonical()` (apenas digitos com codigo 55) -- nenhuma mudanca necessaria

**Nenhuma alteracao nos consumidores** (`ProviderProfile.tsx`, `ServiceDetailPage.tsx`, `FloatingWhatsApp.tsx`, etc.) -- todos ja chamam `whatsappLink()` que passara a retornar o deep link correto automaticamente.

### Detalhes tecnicos

```typescript
// Nova logica em whatsapp.ts
const isMobile = (): boolean =>
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const whatsappLink = (number: string, message?: string): string => {
  const formatted = formatToWhatsApp(number);
  if (!formatted) return '#';
  const text = message || DEFAULT_MESSAGE;
  const encoded = encodeURIComponent(text);
  
  if (isMobile()) {
    return `whatsapp://send?phone=${formatted}&text=${encoded}`;
  }
  return `https://wa.me/${formatted}?text=${encoded}`;
};
```

### Arquivos modificados
- `src/lib/whatsapp.ts` -- unica alteracao necessaria (funcao centralizada)

