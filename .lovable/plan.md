# Perfeito. Aqui está a **versão final do plano de reestruturação de categorias**, já com todas as melhorias aplicadas, pronta para execução:

---

# **Reestruturação Hierárquica de Categorias – Versão Final**

## **Situação Atual**

- 159 categorias ativas, quase todas sem `parent_id` (flat).
- Apenas 1 subcategoria existente (“Segurança eletrônica”).
- Nenhuma categoria-pai (macro) existe no banco.
- Sistema suporta hierarquia via `parent_id` sem alterações de código.

---

## **Fase 1 — Criar 7 Categorias Macro (Parent)**


| Macro                  | Slug                   | Ícone | Status |
| ---------------------- | ---------------------- | ----- | ------ |
| Serviços Domésticos    | servicos-domesticos    | 🏠    | Ativo  |
| Serviços Técnicos      | servicos-tecnicos      | ⚡     | Ativo  |
| Construção e Reforma   | construcao-e-reforma   | 🏗️   | Ativo  |
| Saúde e Estética       | saude-e-estetica       | 💆    | Ativo  |
| Transporte e Logística | transporte-e-logistica | 🚚    | Ativo  |
| Alimentação e Eventos  | alimentacao-e-eventos  | 🍽️   | Ativo  |
| Negócios e Consultoria | negocios-e-consultoria | 💼    | Ativo  |


---

## **Fase 2 — Vincular Subcategorias Existentes às Macros**

Atualizar `parent_id` das categorias existentes para apontar à macro correspondente.  
**Observações:** subdivisão refinada para SEO e filtros internos.

**Serviços Domésticos:**

- Marido de Aluguel, Cozinheira, Babá, Cuidador de Idosos, Diarista, Limpeza Residencial, Passadeira

**Serviços Técnicos:**

- Eletricista: Residencial / Comercial
- Encanador: Hidráulico / Industrial
- Assistência Técnica, Ar-condicionado, Antenista, Técnico em Celular, Informática / Suporte TI

**Construção e Reforma:**

- Carpinteiro, Pintor, Gesseiro, Azulejista, Pedreiro, Construção Civil, Impermeabilização, Drywall

**Saúde e Estética:**

- Dentista, Fisioterapeuta, Esteticista, Acupunturista, Cabeleireiro, Barbeiro, Manicure

**Transporte e Logística:**

- Entregador, Caminhoneiro, Fretista, Guincheiro, Motorista, Motoboy

**Alimentação e Eventos:**

- Buffet: Casamento / Corporativo, Churrasqueiro, Confeiteiro, Bartender, Cerimonialista, Decorador de Festas, DJ: Casamento / Festa / Corporativo, Chef / Cozinheiro

**Negócios e Consultoria:**

- Advogado, Contador, Consultor de RH, Consultoria Empresarial, Marketing Digital

---

## **Fase 3 — Atualizar Ícones das Categorias Existentes**

- Padronizar ícones das subcategorias:
  - Eletricista → ⚡
  - Acupunturista → 🪡
  - Cabeleireiro / Esteticista → 💇 / 💆
  - Chef / Cozinheiro → 👨‍🍳
  - Guincheiro → 🚚
- Garantir ícones únicos e consistentes para UX.

---

## **Fase 4 — Criar Categorias Novas que Não Existem**


| Categoria                | Slug                    | Ícone | Macro                  | Status |
| ------------------------ | ----------------------- | ----- | ---------------------- | ------ |
| Eletricista Residencial  | eletricista-residencial | ⚡     | Serviços Técnicos      | Ativo  |
| Eletricista Comercial    | eletricista-comercial   | ⚡     | Serviços Técnicos      | Ativo  |
| Informática / Suporte TI | informatica-suporte-ti  | 💻    | Serviços Técnicos      | Ativo  |
| Esteticista              | esteticista             | 💆    | Saúde e Estética       | Ativo  |
| Decorador de Festas      | decorador-de-festas     | 🎉    | Alimentação e Eventos  | Ativo  |
| Guincheiro               | guincheiro              | 🚚    | Transporte e Logística | Ativo  |
| Chef / Cozinheiro        | chef-cozinheiro         | 👨‍🍳 | Alimentação e Eventos  | Ativo  |
| Consultor de RH          | consultor-de-rh         | 💼    | Negócios e Consultoria | Ativo  |
| Cozinheiro Profissional  | cozinheiro-profissional | 👨‍🍳 | Alimentação e Eventos  | Ativo  |


---

## **Fase 5 — Renomeações e Ajustes SEO**


| Atual                    | Novo                     | Slug Atualizado        |
| ------------------------ | ------------------------ | ---------------------- |
| Consultoria de Marketing | Marketing Digital        | marketing-digital      |
| Suporte de TI            | Informática / Suporte TI | informatica-suporte-ti |


---

## **Fase 6 — Auditoria e Observações**

- Verificar categorias órfãs ou redundantes antes de updates.
- Cada categoria/subcategoria terá **status e observação** para manutenção futura.
- Todos os slugs e ícones padronizados para consistência visual e SEO.
- Inclusão de subdivisões estratégicas para filtros e palavras-chave.

---

## **Fase 7 — Impacto no Código**

- Nenhuma alteração de código necessária.
- `AdminCategoriesPage` já suporta macro → sub.
- `CategoriesListPage` e `CategoryCard` funcionam normalmente.

---

## **Fase 8 — Execução Estimada**

- **INSERTs Macros:** 7
- **INSERTs Novas Categorias:** 9
- **UPDATE parent_id:** ~150
- **UPDATE Ícones/Nomes/Slugs:** ~30

**Todos via ferramenta de dados**, sem migração de schema.

---

✅ **Resultado Final:** Sistema hierárquico completo, padronizado, SEO-friendly, pronto para operação e manutenção futura.

---

Se você quiser, posso já gerar **uma tabela completa pronta para importar no banco**, incluindo **parent_id, slug, ícone, status e observações** para todas as 159 categorias existentes + novas, tudo padronizado.

Quer que eu faça isso agora?