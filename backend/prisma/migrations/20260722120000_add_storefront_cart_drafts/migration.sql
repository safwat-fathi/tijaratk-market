CREATE TABLE "storefront_cart_drafts" (
  "id" SERIAL NOT NULL,
  "token" VARCHAR(64) NOT NULL DEFAULT (gen_random_uuid())::text,
  "tenant_id" INTEGER NOT NULL,
  "delivery_area_id" INTEGER,
  "free_text_payload" TEXT,
  "unavailable_item_action" VARCHAR(64) NOT NULL DEFAULT 'suggest_replacement',
  "order_source" "orders_source_enum" NOT NULL DEFAULT 'storefront',
  "source_metadata" JSONB,
  "prescription_file_path" TEXT,
  "prescription_original_filename" VARCHAR(255),
  "prescription_mime_type" VARCHAR(120),
  "prescription_unavailability_action" VARCHAR(64),
  "checkout_started_at" TIMESTAMPTZ(6),
  "completed_order_id" INTEGER,
  "expires_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "storefront_cart_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "storefront_cart_draft_items" (
  "id" SERIAL NOT NULL,
  "draft_id" INTEGER NOT NULL,
  "product_id" INTEGER NOT NULL,
  "selection_mode" "order_items_selection_mode_enum" NOT NULL,
  "selection_quantity" DECIMAL(10,3),
  "selection_grams" INTEGER,
  "selection_amount_egp" DECIMAL(10,2),
  "unit_option_id" VARCHAR(64),
  "item_note" VARCHAR(255),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "storefront_cart_draft_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "storefront_cart_drafts_token_key" ON "storefront_cart_drafts"("token");
CREATE UNIQUE INDEX "storefront_cart_drafts_completed_order_id_key" ON "storefront_cart_drafts"("completed_order_id");
CREATE INDEX "IDX_storefront_cart_drafts_tenant_expires" ON "storefront_cart_drafts"("tenant_id", "expires_at");
CREATE INDEX "IDX_storefront_cart_drafts_expires" ON "storefront_cart_drafts"("expires_at");
CREATE UNIQUE INDEX "UQ_storefront_cart_draft_items_draft_product" ON "storefront_cart_draft_items"("draft_id", "product_id");
CREATE INDEX "IDX_storefront_cart_draft_items_product" ON "storefront_cart_draft_items"("product_id");

ALTER TABLE "storefront_cart_drafts" ADD CONSTRAINT "FK_storefront_cart_drafts_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "storefront_cart_drafts" ADD CONSTRAINT "FK_storefront_cart_drafts_delivery_area" FOREIGN KEY ("delivery_area_id") REFERENCES "directory_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "storefront_cart_drafts" ADD CONSTRAINT "FK_storefront_cart_drafts_completed_order" FOREIGN KEY ("completed_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "storefront_cart_draft_items" ADD CONSTRAINT "FK_storefront_cart_draft_items_draft" FOREIGN KEY ("draft_id") REFERENCES "storefront_cart_drafts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "storefront_cart_draft_items" ADD CONSTRAINT "FK_storefront_cart_draft_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "storefront_cart_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "storefront_cart_drafts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_storefront_cart_drafts" ON "storefront_cart_drafts"
USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
CREATE POLICY "expired_storefront_cart_draft_cleanup" ON "storefront_cart_drafts"
USING (current_setting('app.storefront_cart_cleanup', true) = '1' AND expires_at <= CURRENT_TIMESTAMP);

ALTER TABLE "storefront_cart_draft_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "storefront_cart_draft_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_storefront_cart_draft_items" ON "storefront_cart_draft_items"
USING (EXISTS (
  SELECT 1 FROM "storefront_cart_drafts" draft
  WHERE draft.id = draft_id AND draft.tenant_id = app.current_tenant_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM "storefront_cart_drafts" draft
  WHERE draft.id = draft_id AND draft.tenant_id = app.current_tenant_id()
));
