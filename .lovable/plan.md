

## Plano: Corrigir campos não editáveis e upload de foto no cadastro de serviço

### Problemas identificados

**1. Campos Preço, WhatsApp e Cidade não editáveis**

O bug está nas linhas 461 e 471 do `DashboardServicesPage.tsx`. Os inputs usam o padrão `value={form.whatsapp || provider?.whatsapp}`. Quando o formulário abre para um novo serviço, `form.whatsapp` é `''` (string vazia), e `'' || provider.whatsapp` resulta no valor do provider. O input mostra o valor do provider, mas o `onChange` atualiza `form.whatsapp` a partir de uma string vazia — causando comportamento estranho onde o campo parece travado.

O mesmo acontece com `form.service_area || provider.city` (linha 461).

**Solução**: Ao abrir o diálogo para novo serviço, inicializar o form com os valores do provider (cidade, whatsapp). Remover os fallbacks `||` dos `value` dos inputs.

**2. Upload de foto não funciona**

A função `uploadPhoto` (linha 145-157) faz upload direto via `supabase.storage.upload` sem passar pela Edge Function `optimize-image`, e não exibe erros ao usuário (`error` é ignorado silenciosamente na linha 150). Além disso, não há feedback visual durante o upload.

**Solução**: Adicionar toast de erro quando o upload falha e garantir que o processo funcione corretamente. Também adicionar estado de loading durante o upload.

---

### Alterações em `src/pages/DashboardServicesPage.tsx`

**A. Inicializar form com valores do provider ao abrir novo serviço**

Na função `resetForm` e no `onClick` do botão "Novo Serviço", pré-preencher `service_area`, `whatsapp` e `address` com valores do provider:

```tsx
const resetForm = () => {
  setForm({
    service_name: '',
    description: '',
    price: '',
    whatsapp: provider?.whatsapp?.replace(/^55/, '') || '',
    service_area: provider?.city || '',
    address: provider ? [provider.neighborhood, provider.city, provider.state].filter(Boolean).join(', ') : '',
    working_hours: '',
    website: provider?.website || '',
  });
  // ...rest stays the same
};
```

**B. Remover fallbacks `||` dos inputs**

- Linha 461: `value={form.service_area}` (remover `|| provider.city`)
- Linha 471: `value={form.whatsapp}` (remover `|| provider?.whatsapp...`)

**C. Corrigir upload de foto com feedback de erro**

Na função `uploadPhoto`, adicionar `toast.error` quando o upload falha, e no `handleSave`, adicionar estado de saving para feedback visual:

```tsx
const uploadPhoto = async (serviceId: string): Promise<void> => {
  if (!newServicePhoto || !user) return;
  const ext = newServicePhoto.name.split('.').pop();
  const path = `${user.id}/${serviceId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('service-images').upload(path, newServicePhoto);
  if (error) {
    toast.error('Erro ao enviar foto: ' + error.message);
    return;
  }
  const { data: urlData } = supabase.storage.from('service-images').getPublicUrl(path);
  await supabase.from('service_images').insert({
    service_id: serviceId,
    image_url: urlData.publicUrl,
    display_order: 0,
  });
};
```

### Arquivo modificado
- `src/pages/DashboardServicesPage.tsx`

