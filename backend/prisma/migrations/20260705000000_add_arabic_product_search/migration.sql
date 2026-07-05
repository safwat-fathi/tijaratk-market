CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION arabic_normalize(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT BTRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              LOWER(
                REGEXP_REPLACE(
                  TRANSLATE(input, 'أإآٱىة', 'اااايه'),
                  '[ًٌٍَُِّْـ]',
                  '',
                  'g'
                )
              ),
              '\([^)]*\)',
              ' ',
              'g'
            ),
            '(^|\s)(ال)([[:alpha:]])',
            '\1\3',
            'g'
          ),
          '(\m\d+\s*(جم|جرام|كجم|كيلو|ك|g|kg)\M)|(\m(جم|جرام|كجم|كيلو|ك|g|kg)\s*\d+\M)',
          ' ',
          'gi'
        ),
        '[^[:alnum:][:space:]]',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "name_normalized" text
  GENERATED ALWAYS AS (arabic_normalize("name")) STORED;

CREATE INDEX IF NOT EXISTS "IDX_products_name_normalized_trgm_active"
  ON "products" USING GIN ("name_normalized" gin_trgm_ops)
  WHERE "status" = 'active' AND "deleted_at" IS NULL;
