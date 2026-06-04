-- Allow public token lookup policies to run before tenant context is set.
-- Tenant-scoped policies still deny access because `tenant_id = NULL` is not true.
CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tenant_value text;
BEGIN
  tenant_value := current_setting('app.tenant_id', true);

  IF tenant_value IS NULL OR tenant_value = '' THEN
    RETURN NULL;
  END IF;

  RETURN tenant_value::integer;
END;
$$;

-- Keep public tracking tenant resolution independent from caller search_path.
CREATE OR REPLACE FUNCTION app.resolve_tenant_id_by_order_token(p_token text)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_tenant_id integer;
BEGIN
  PERFORM set_config('app.lookup_order_token', p_token, true);

  SELECT o.tenant_id
  INTO v_tenant_id
  FROM public.orders o
  WHERE o.public_token = p_token
    AND o.deleted_at IS NULL
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$;
