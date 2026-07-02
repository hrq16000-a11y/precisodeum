CREATE OR REPLACE VIEW public.provider_health_view AS
SELECT
  p.id,
  p.business_name,
  p.status,
  p.city,
  p.state,
  p.user_id,
  p.photo_url,
  p.services_count,
  p.portfolio_album_count,
  p.portfolio_photo_count,
  p.review_count,
  p.rating_avg,
  p.plan,
  p.featured,
  p.created_at,
  pr.full_name,
  pr.email,
  pr.avatar_url,
  pr.engagement_points,
  ROUND(
    (
      (CASE WHEN pr.full_name IS NOT NULL AND TRIM(pr.full_name) != '' THEN 1 ELSE 0 END) +
      (CASE WHEN p.photo_url IS NOT NULL AND p.photo_url != '' THEN 1 ELSE 0 END) +
      (CASE WHEN p.city IS NOT NULL AND p.city != '' AND p.city != 'Não informada' THEN 1 ELSE 0 END) +
      (CASE WHEN p.state IS NOT NULL AND p.state != '' THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(p.phone, p.whatsapp, '') != '' THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(p.services_count, 0) > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN p.description IS NOT NULL AND TRIM(p.description) != '' THEN 1 ELSE 0 END) +
      (CASE WHEN p.working_hours IS NOT NULL AND p.working_hours != '' THEN 1 ELSE 0 END)
    )::numeric / 8 * 100
  )::integer AS completion_score,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN pr.full_name IS NULL OR TRIM(pr.full_name) = '' THEN 'Nome' END,
    CASE WHEN p.photo_url IS NULL OR p.photo_url = '' THEN 'Foto de perfil' END,
    CASE WHEN p.city IS NULL OR p.city = '' OR p.city = 'Não informada' THEN 'Cidade' END,
    CASE WHEN p.state IS NULL OR p.state = '' THEN 'Estado' END,
    CASE WHEN COALESCE(p.phone, p.whatsapp, '') = '' THEN 'Telefone' END,
    CASE WHEN COALESCE(p.services_count, 0) = 0 THEN 'Serviço cadastrado' END,
    CASE WHEN p.description IS NULL OR TRIM(p.description) = '' THEN 'Descrição' END,
    CASE WHEN p.working_hours IS NULL OR p.working_hours = '' THEN 'Horário de funcionamento' END
  ], NULL) AS missing_fields,
  CASE
    WHEN ROUND(
      (
        (CASE WHEN pr.full_name IS NOT NULL AND TRIM(pr.full_name) != '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.photo_url IS NOT NULL AND p.photo_url != '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.city IS NOT NULL AND p.city != '' AND p.city != 'Não informada' THEN 1 ELSE 0 END) +
        (CASE WHEN p.state IS NOT NULL AND p.state != '' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(p.phone, p.whatsapp, '') != '' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(p.services_count, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN p.description IS NOT NULL AND TRIM(p.description) != '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.working_hours IS NOT NULL AND p.working_hours != '' THEN 1 ELSE 0 END)
      )::numeric / 8 * 100
    ) >= 100 THEN 'Completo'
    WHEN ROUND(
      (
        (CASE WHEN pr.full_name IS NOT NULL AND TRIM(pr.full_name) != '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.photo_url IS NOT NULL AND p.photo_url != '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.city IS NOT NULL AND p.city != '' AND p.city != 'Não informada' THEN 1 ELSE 0 END) +
        (CASE WHEN p.state IS NOT NULL AND p.state != '' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(p.phone, p.whatsapp, '') != '' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(p.services_count, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN p.description IS NOT NULL AND TRIM(p.description) != '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.working_hours IS NOT NULL AND p.working_hours != '' THEN 1 ELSE 0 END)
      )::numeric / 8 * 100
    ) >= 75 THEN 'Bom'
    WHEN ROUND(
      (
        (CASE WHEN pr.full_name IS NOT NULL AND TRIM(pr.full_name) != '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.photo_url IS NOT NULL AND p.photo_url != '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.city IS NOT NULL AND p.city != '' AND p.city != 'Não informada' THEN 1 ELSE 0 END) +
        (CASE WHEN p.state IS NOT NULL AND p.state != '' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(p.phone, p.whatsapp, '') != '' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(p.services_count, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN p.description IS NOT NULL AND TRIM(p.description) != '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.working_hours IS NOT NULL AND p.working_hours != '' THEN 1 ELSE 0 END)
      )::numeric / 8 * 100
    ) >= 50 THEN 'Regular'
    ELSE 'Incompleto'
  END AS health_label
FROM providers p
LEFT JOIN profiles pr ON pr.id = p.user_id
WHERE p.deleted_at IS NULL;