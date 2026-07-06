-- Drop the generated expression so it becomes a normal text column (safe for Prisma diffing)
ALTER TABLE "products" ALTER COLUMN "name_normalized" DROP EXPRESSION IF EXISTS;

-- Create the trigger function to update the normalized name automatically
CREATE OR REPLACE FUNCTION trigger_update_name_normalized()
RETURNS trigger AS $$
BEGIN
  NEW.name_normalized := arabic_normalize(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and recreate it
DROP TRIGGER IF EXISTS products_name_normalized_trigger ON "products";

CREATE TRIGGER products_name_normalized_trigger
BEFORE INSERT OR UPDATE OF "name" ON "products"
FOR EACH ROW EXECUTE FUNCTION trigger_update_name_normalized();
