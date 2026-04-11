

# Correção: Texto genérico na descrição do profissional

## Problema

Alguns profissionais têm a descrição salva no banco de dados como "Profissional cadastrado na plataforma Preciso de um. Entre em contato para mais informações." — um texto genérico/placeholder que não agrega valor. Esse texto aparece nos cards e no perfil.

## Solução

Tratar esse texto como se fosse uma descrição vazia. Nos dois lugares que exibem `provider.description`:

### 1. `src/components/ProviderCard.tsx` (linha 166-169)

Criar uma função helper que detecta descrições genéricas (contendo "cadastrado na plataforma" ou "entre em contato para mais informações") e retorna `null` nesses casos. O card simplesmente não mostra a descrição — mesmo comportamento de quando está vazia.

### 2. `src/pages/ProviderProfile.tsx` (linha 657)

Já tem o fallback correto ("Este profissional ainda não adicionou uma descrição."). Só precisa aplicar o mesmo filtro para que, se a descrição for o texto genérico, exiba o fallback em vez do boilerplate.

### Helper

```ts
const isBoilerplateDescription = (desc?: string | null) =>
  !desc?.trim() || /cadastrado na plataforma|entre em contato para mais informa/i.test(desc);
```

Nenhuma mudança de banco — apenas filtragem client-side.

