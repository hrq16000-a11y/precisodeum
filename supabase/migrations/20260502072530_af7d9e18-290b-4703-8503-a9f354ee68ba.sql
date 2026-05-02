-- Normaliza cta_text legados em provider_page_settings:
-- Diretriz: nunca usar "Orçamento" — sempre "Solicitar Contato" /
-- "Falar com o profissional" para reforçar negociação direta e
-- valorização da mão de obra (anti-leilão de preços).
UPDATE public.provider_page_settings
SET cta_text = 'Solicitar Contato',
    updated_at = NOW()
WHERE cta_text ILIKE '%or%amento%';