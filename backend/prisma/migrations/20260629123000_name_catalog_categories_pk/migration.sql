DO $$
DECLARE
  current_pk_name text;
BEGIN
  SELECT conname
  INTO current_pk_name
  FROM pg_constraint
  WHERE conrelid = '"catalog_categories"'::regclass
    AND contype = 'p';

  IF current_pk_name IS NOT NULL
     AND current_pk_name <> 'PK_catalog_categories_id' THEN
    EXECUTE format(
      'ALTER TABLE "catalog_categories" RENAME CONSTRAINT %I TO "PK_catalog_categories_id"',
      current_pk_name
    );
  END IF;
END $$;
