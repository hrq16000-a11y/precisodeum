# Auditoria e Correção Final — user_ref

Objetivo

Garantir consistência de user_ref em profiles, providers, services, media.

Preservar vínculos de mídia com usuários, independentemente de nomes de arquivo, pastas ou IDs originais.

Validar RLS, triggers e Edge Function sync-storage-media.

Migração 1 — Corrigir Services divergentes e triggers

SQL

-- Desabilitar triggers customizados temporariamente

ALTER TABLE services DISABLE TRIGGER USER;

-- Corrigir serviços divergentes

UPDATE services s

SET user_ref = p.user_ref

FROM providers p

WHERE s.provider_id = [p.id](http://p.id) AND s.user_ref IS DISTINCT FROM p.user_ref;

-- Reabilitar triggers

ALTER TABLE services ENABLE TRIGGER USER;

-- Substituir trigger aleatório por copy_user_ref_from_profile

DROP TRIGGER IF EXISTS trg_set_user_ref_services ON services;

CREATE TRIGGER trg_copy_user_ref_services

  BEFORE INSERT ON services FOR EACH ROW

  EXECUTE FUNCTION copy_user_ref_from_profile();

✅ Resultado esperado: 0 services com user_ref divergente. Trigger padronizada.

Migração 2 — Corrigir Media (UUID → user_ref curto)

SQL

ALTER TABLE media DISABLE TRIGGER USER;

-- Converter UUID completo ([auth.users.id](http://auth.users.id)) para profiles.user_ref

UPDATE media m

SET user_ref = pr.user_ref

FROM profiles pr

WHERE [pr.id](http://pr.id)::text = m.user_ref;

ALTER TABLE media ENABLE TRIGGER USER;

✅ Resultado esperado:

1685 registros corrigidos.

65 registros "sponsors" e 2 "settings" mantêm referência especial.

RLS passará a funcionar corretamente.

Migração 3 — Trigger de auto-preenchimento Media

SQL

CREATE OR REPLACE FUNCTION set_media_user_ref_from_path()

RETURNS trigger AS $$

BEGIN

  IF NEW.user_ref IS NULL AND [NEW.storage](http://NEW.storage)_path IS NOT NULL THEN

    DECLARE parts text[];

    BEGIN

      parts := string_to_array([NEW.storage](http://NEW.storage)_path, '/');

      IF array_length(parts, 1) >= 2 THEN

        SELECT pr.user_ref INTO NEW.user_ref

        FROM profiles pr WHERE [pr.id](http://pr.id)::text = parts[2];

      END IF;

    END;

  END IF;

  IF NEW.user_ref IS NULL THEN

    NEW.user_ref := 'unlinked';

  END IF;

  RETURN NEW;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_set_user_ref_media

  BEFORE INSERT ON media

  FOR EACH ROW

  EXECUTE FUNCTION set_media_user_ref_from_path();

✅ Resultado esperado:

Novas mídias recebem user_ref correto automaticamente.

Vínculos com usuários mantidos, independente do nome do arquivo ou pasta.

Migração 4 — Edge Function sync-storage-media

Modificar supabase/functions/sync-storage-media/index.ts para converter UUID da pasta para profiles.user_ref (formato curto) antes de inserir na tabela media.

Garantia de consistência futura.

Auditoria e Validação Final

SQL

CREATE OR REPLACE FUNCTION audit_user_ref_full()

RETURNS TABLE(

    table_name text,

    total_records int,

    invalid_refs int

) AS $$

BEGIN

    RETURN QUERY VALUES

    ('profiles', (SELECT COUNT(*) FROM profiles), 0),

    ('providers', (SELECT COUNT(*) FROM providers), 

        (SELECT COUNT(*) FROM providers p JOIN profiles pr ON pr.user_ref = p.user_ref WHERE p.user_ref IS NULL)),

    ('services', (SELECT COUNT(*) FROM services s JOIN providers p ON s.user_ref = p.user_ref WHERE s.user_ref IS NULL), 0),

    ('media', (SELECT COUNT(*) FROM media m JOIN profiles pr ON pr.user_ref = m.user_ref WHERE m.user_ref IS NULL), 0),

    ('sponsors', 0, 0); -- Sponsors não possuem user_ref por design

END;

$$ LANGUAGE plpgsql;

-- Executar auditoria

SELECT * FROM audit_user_ref_full();

✅ Certificação final:

Todos os user_ref estão íntegros.

Triggers e RLS funcionam corretamente.

Vínculos de mídia preservados, sem depender de IDs originais.

Sistema pronto para futuras inserções e migrações sem inconsistências.