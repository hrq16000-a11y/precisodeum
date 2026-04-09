

Plano de Correção — Etapas Detalhadas

Etapa 1 — Sincronizar user_ref dos providers e services

Objetivo: Corrigir divergências de user_ref e preencher valores ausentes.

SQL sugerido com validação:

SQL

-- Verificar providers divergentes

SELECT [p.id](http://p.id) AS provider_id, p.user_ref AS provider_ref, pr.user_ref AS profile_ref

FROM providers p

JOIN profiles pr ON [pr.id](http://pr.id) = p.user_id

WHERE p.user_ref != pr.user_ref;

-- Atualizar providers

UPDATE providers p

SET user_ref = pr.user_ref

FROM profiles pr

WHERE [pr.id](http://pr.id) = p.user_id AND p.user_ref != pr.user_ref;

-- Verificar services sem user_ref

SELECT [s.id](http://s.id) AS service_id

FROM services s

WHERE s.user_ref IS NULL;

-- Atualizar services

UPDATE services s

SET user_ref = pr.user_ref

FROM providers p

JOIN profiles pr ON [pr.id](http://pr.id) = p.user_id

WHERE s.provider_id = [p.id](http://p.id) AND s.user_ref IS NULL;

Melhoria sugerida: Rodar SELECT antes do UPDATE para validação e prevenção de erros.

Etapa 2 — Adicionar triggers na tabela media

Objetivo: Garantir consistência automática de user_ref na tabela media.

Sugestão de triggers:

SQL

CREATE OR REPLACE FUNCTION set_user_ref_media()

RETURNS trigger AS $$

BEGIN

    IF NEW.user_ref IS NULL THEN

        SELECT pr.user_ref INTO NEW.user_ref

        FROM profiles pr

        WHERE [pr.id](http://pr.id) = NEW.user_id;

    END IF;

    RETURN NEW;

END;

$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_user_ref_media

BEFORE INSERT ON media

FOR EACH ROW

EXECUTE FUNCTION set_user_ref_media();

CREATE TRIGGER trg_prevent_user_ref_update_media

BEFORE UPDATE OF user_ref ON media

FOR EACH ROW

EXECUTE FUNCTION prevent_user_ref_update();

Etapa 3 — Melhorar o trigger set_user_ref nos providers

Problema atual: Cada tabela gera user_ref independente, quebrando a identidade global.

Solução: Criar função padronizada copy_user_ref_from_profile() para copiar o user_ref do profile via user_id e atualizar triggers de providers, services e leads.

SQL

CREATE OR REPLACE FUNCTION copy_user_ref_from_profile()

RETURNS trigger AS $$

BEGIN

    SELECT pr.user_ref INTO NEW.user_ref

    FROM profiles pr

    WHERE [pr.id](http://pr.id) = NEW.user_id;

    IF NEW.user_ref IS NULL THEN

        RAISE EXCEPTION 'user_ref não encontrado para user_id %', NEW.user_id;

    END IF;

    RETURN NEW;

END;

$$ LANGUAGE plpgsql;

-- Exemplo: trigger providers

CREATE TRIGGER trg_set_user_ref_providers

BEFORE INSERT ON providers

FOR EACH ROW

EXECUTE FUNCTION copy_user_ref_from_profile();

Melhorias adicionais:

Substituir triggers atuais em services e leads para usar a mesma função.

Garantir que novos registros não gerem user_ref aleatório.

Detalhes técnicos finais

Migração 1 — Correção de dados existentes: UPDATE nos 7 providers + 2 services.

Migração 2 — Novos triggers:

trg_set_user_ref_media e trg_prevent_user_ref_update_media na tabela media.

Função copy_user_ref_from_profile() para triggers de providers, services e leads.

Arquivos a editar: Nenhum — todas correções via SQL.

Recomendações:

Rodar backup completo antes de aplicar.

Validar após migração com SELECTs de conferência.

Testar inserções novas para garantir consistência.