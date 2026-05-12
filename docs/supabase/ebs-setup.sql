-- ============================================================
-- EBS Aprendiz — Setup Supabase
-- Executar no SQL Editor do Supabase
-- Projeto: qvyrwpihgrbkzncyytuu
-- ============================================================

-- ─────────────────────────────────────────
-- 1. Registrar EBS Aprendiz como cliente
-- ─────────────────────────────────────────
INSERT INTO clients (
  id,
  name,
  slug,
  instagram_handle,
  ig_user_id,
  fb_page_id,
  timezone,
  post_time,
  active,
  created_at
) VALUES (
  gen_random_uuid(),
  'EBS Aprendiz do Estúdio Black Space',
  'ebs-aprendiz',
  '@aprendiz.ebs',
  '17841459660352099',
  '329616873564067',
  'America/Sao_Paulo',
  '09:00:00',  -- horário padrão de postagem (ajustar conforme preferência)
  true,
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  ig_user_id = EXCLUDED.ig_user_id,
  fb_page_id = EXCLUDED.fb_page_id,
  active = EXCLUDED.active;

-- Verificar resultado
SELECT id, name, slug, ig_user_id, post_time FROM clients WHERE slug = 'ebs-aprendiz';


-- ─────────────────────────────────────────
-- 2. Criar bucket no Storage (via SQL)
-- ─────────────────────────────────────────
-- Nota: buckets podem ser criados via dashboard Storage
-- ou via API Management. Este SQL é para referência.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ebs-aprendiz',
  'ebs-aprendiz',
  true,  -- público para URLs diretas no Meta Graph API
  10485760,  -- 10MB max por arquivo
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────
-- 3. Política de acesso ao Storage
-- ─────────────────────────────────────────
-- Allow public read (para Meta Graph API acessar os PNGs)
CREATE POLICY "Public read ebs-aprendiz" ON storage.objects
  FOR SELECT USING (bucket_id = 'ebs-aprendiz');

-- Allow service role to insert/update
CREATE POLICY "Service role write ebs-aprendiz" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'ebs-aprendiz');


-- ─────────────────────────────────────────
-- 4. Verificar schema existente
-- ─────────────────────────────────────────
-- Verificar tabelas disponíveis
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar estrutura de content_briefs
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'content_briefs'
ORDER BY ordinal_position;
