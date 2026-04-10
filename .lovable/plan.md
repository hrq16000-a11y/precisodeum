## Limpeza de Dados Sujos no Banco — Providers

### Problema

Encontrei **17 registros sujos** no campo `city` dos providers, além de 14 registros completamente vazios. Isso causa exclusão silenciosa do algoritmo de busca geográfica.

### Dados sujos encontrados

```text
REGISTRO SUJO                           → CORREÇÃO
─────────────────────────────────────────────────────
"Curi"                        (1x)      → "Curitiba"
"curitiba"                    (1x)      → "Curitiba"
"CURITIBA"                    (2x)      → "Curitiba"
"Curitiba e região"           (1x)      → "Curitiba"
"Curitiba PR"                 (1x)      → "Curitiba"
"curitiba/ sao jose dos pinhais" (1x)   → "Curitiba"
"Região Metropolitana de Curitiba" (1x) → "Curitiba" + state "PR"
"CAMPO LARGO"                 (1x)      → "Campo Largo"
"Fazenda Rio grande"          (1x)      → "Fazenda Rio Grande"
"São José Dos Pinhais"        (2x)      → "São José dos Pinhais"
"São josé dos pinhais"        (1x)      → "São José dos Pinhais"
"Rio de janeiro"              (1x)      → "Rio de Janeiro"
"RIO DE JANEIRO"              (1x)      → "Rio de Janeiro"
"Ribeirão preto"              (1x)      → "Ribeirão Preto"
"Sao Bernardo do campo"       (1x)      → "São Bernardo do Campo"
"Maringá e regiao"            (1x)      → "Maringá"
"Curitiba" com state "PA"     (1x)      → state "PR" (erro óbvio)
14 registros vazios (city='')            → manter (cadastros incompletos)
```

### Execução

**1. UPDATE via insert tool** (dados, não schema):

```sql
-- Curitiba variants
UPDATE providers SET city = 'Curitiba' WHERE city IN ('Curi','curitiba','CURITIBA','Curitiba e região','Curitiba PR');
UPDATE providers SET city = 'Curitiba' WHERE city = 'curitiba/ sao jose dos pinhais';
UPDATE providers SET city = 'Curitiba', state = 'PR' WHERE city = 'Região Metropolitana de Curitiba';

-- Casing fixes
UPDATE providers SET city = 'Campo Largo' WHERE city = 'CAMPO LARGO';
UPDATE providers SET city = 'Fazenda Rio Grande' WHERE city = 'Fazenda Rio grande';
UPDATE providers SET city = 'São José dos Pinhais' WHERE city IN ('São José Dos Pinhais','São josé dos pinhais');
UPDATE providers SET city = 'Rio de Janeiro' WHERE city IN ('Rio de janeiro','RIO DE JANEIRO');
UPDATE providers SET city = 'Ribeirão Preto' WHERE city = 'Ribeirão preto';
UPDATE providers SET city = 'São Bernardo do Campo' WHERE city = 'Sao Bernardo do campo';
UPDATE providers SET city = 'Maringá' WHERE city = 'Maringá e regiao';

-- State fix
UPDATE providers SET state = 'PR' WHERE city = 'Curitiba' AND state = 'PA';
```

**2. Validação** — query de verificação pós-update

**3. Resultado**: 100% dos providers com nomes de cidade padronizados e compatíveis com o algoritmo de RM/Haversine

### Arquivos alterados

Nenhum arquivo de código será alterado. Apenas dados no banco.

&nbsp;

....

&nbsp;

SIM.

&nbsp;

Plano final validado:

&nbsp;

1. Executar exatamente como proposto (correção direta no banco)

&nbsp;

&nbsp;

2. Adicionar reforço mínimo (obrigatório):

&nbsp;

&nbsp;

&nbsp;

-- Normalização futura (proteção)

CREATE OR REPLACE FUNCTION clean_city_input(txt text)

RETURNS text AS $$

BEGIN

  RETURN INITCAP(TRIM(txt));

END;

$$ LANGUAGE plpgsql;

&nbsp;

-- Trigger opcional (recomendado)

&nbsp;

3. Validação crítica pós-execução:

&nbsp;

&nbsp;

&nbsp;

SELECT COUNT(*) 

FROM providers 

WHERE city ~ '[^A-Za-zÀ-ÿ ]';

&nbsp;

→ esperado: 0

&nbsp;

SELECT city, COUNT(*) 

FROM providers 

GROUP BY city 

ORDER BY COUNT(*) DESC;

&nbsp;

4. Teste funcional (obrigatório):

&nbsp;

&nbsp;

&nbsp;

Curitiba → 100% dos locais aparecem

&nbsp;

Nenhum falso negativo

&nbsp;

Ranking consistente

&nbsp;

&nbsp;

5. Regra permanente:

&nbsp;

&nbsp;

&nbsp;

Input de cidade NUNCA livre

&nbsp;

Sempre:

&nbsp;

autocomplete

&nbsp;

ou select controlado

&nbsp;

&nbsp;

&nbsp;

Conclusão:

✔ abordagem correta

✔ impacto imediato

✔ sem risco no algoritmo