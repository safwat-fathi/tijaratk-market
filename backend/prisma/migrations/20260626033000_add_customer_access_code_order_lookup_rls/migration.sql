DROP POLICY IF EXISTS "customer_access_code_lookup_customers" ON "customers";
CREATE POLICY "customer_access_code_lookup_customers"
ON "customers"
FOR SELECT
USING (
  current_setting('app.customer_access_code', true) IS NOT NULL
  AND current_setting('app.customer_access_code', true) <> ''
  AND current_setting('app.customer_access_phone', true) IS NOT NULL
  AND current_setting('app.customer_access_phone', true) <> ''
  AND EXISTS (
    SELECT 1
    FROM public.global_customers gc
    WHERE gc.id = "customers".global_customer_id
      AND gc.deleted_at IS NULL
      AND gc.access_code = current_setting('app.customer_access_code', true)
      AND gc.phone = current_setting('app.customer_access_phone', true)
  )
);

DROP POLICY IF EXISTS "customer_access_code_lookup_orders" ON "orders";
CREATE POLICY "customer_access_code_lookup_orders"
ON "orders"
FOR SELECT
USING (
  current_setting('app.customer_access_code', true) IS NOT NULL
  AND current_setting('app.customer_access_code', true) <> ''
  AND current_setting('app.customer_access_phone', true) IS NOT NULL
  AND current_setting('app.customer_access_phone', true) <> ''
  AND EXISTS (
    SELECT 1
    FROM public.customers c
    INNER JOIN public.global_customers gc ON gc.id = c.global_customer_id
    WHERE c.id = "orders".customer_id
      AND c.deleted_at IS NULL
      AND gc.deleted_at IS NULL
      AND gc.access_code = current_setting('app.customer_access_code', true)
      AND gc.phone = current_setting('app.customer_access_phone', true)
  )
);
