-- Índice para consultas hierárquicas (drill-down de subcategorias)
CREATE INDEX IF NOT EXISTS idx_categories_parent_id
ON categories(parent_id) WHERE parent_id IS NOT NULL;

-- Índice para SEO (lookup de slug ignorando deletados)
CREATE INDEX IF NOT EXISTS idx_categories_slug_active
ON categories(slug) WHERE deleted_at IS NULL;

-- Índice para ordenação alfabética em listagens
CREATE INDEX IF NOT EXISTS idx_categories_order_name
ON categories(name ASC);