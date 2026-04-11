

## Plano: Validação visual nos campos obrigatórios do formulário de serviço

### O que muda

Adicionar um estado `formErrors` que rastreia campos inválidos. Ao clicar em "Publicar", se `service_name` estiver vazio, o campo recebe borda vermelha e uma mensagem de erro aparece abaixo. O erro limpa automaticamente quando o usuário digita.

### Alterações em `src/pages/DashboardServicesPage.tsx`

**1. Novo estado de erros**
```tsx
const [formErrors, setFormErrors] = useState<Record<string, string>>({});
```

**2. Limpar erro ao digitar** — no `handleChange`, limpar o erro do campo editado:
```tsx
setFormErrors(prev => ({ ...prev, [name]: '' }));
```

**3. Validação no `handleSave`** — substituir o `toast.error` por validação visual:
```tsx
if (!form.service_name.trim()) {
  setFormErrors({ service_name: 'Título é obrigatório' });
  return;
}
setFormErrors({});
```

**4. Limpar erros no `resetForm`**:
```tsx
setFormErrors({});
```

**5. Estilização condicional nos inputs** — campo Título (e Cidade, se desejado):
- Borda: `border-destructive` quando há erro
- Mensagem: `<p className="text-xs text-destructive mt-1">...</p>` abaixo do input

### Arquivo modificado
- `src/pages/DashboardServicesPage.tsx`

