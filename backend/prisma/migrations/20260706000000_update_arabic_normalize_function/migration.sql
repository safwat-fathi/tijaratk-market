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
                  '[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭـ]',
                  '',
                  'g'
                )
              ),
              '\([^)]*\)',
              ' ',
              'g'
            ),
            '(\m\d+\s*(جم|جرام|كجم|كيلو|ك|g|kg)\M)|(\m(جم|جرام|كجم|كيلو|ك|g|kg)\s*\d+\M)',
            ' ',
            'gi'
          ),
          '[^[:alnum:][:space:]ء-ي٠-٩۰-۹]',
          ' ',
          'g'
        ),
        '(^|[[:space:]])ال([[:alpha:]ء-ي])',
        '\1\2',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

ALTER TABLE "products" DISABLE ROW LEVEL SECURITY;

UPDATE "products"
SET "name" = "name"
WHERE "name" IS NOT NULL;

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
