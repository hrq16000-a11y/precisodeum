-- Clean existing blog posts: strip HTML from content and excerpt
UPDATE public.blog_posts
SET 
  content = REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(content, '<[^>]*>', '', 'g'),
            '&nbsp;', ' ', 'g'),
          '&amp;', '&', 'g'),
        '&lt;', '<', 'g'),
      '&gt;', '>', 'g'),
    '&quot;', '"', 'g'),
  excerpt = REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(excerpt, '<[^>]*>', '', 'g'),
            '&nbsp;', ' ', 'g'),
          '&amp;', '&', 'g'),
        '&lt;', '<', 'g'),
      '&gt;', '>', 'g'),
    '&quot;', '"', 'g')
WHERE content ~ '<[^>]+>' OR excerpt ~ '<[^>]+>';