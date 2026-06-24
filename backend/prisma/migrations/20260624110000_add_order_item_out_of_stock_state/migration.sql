ALTER TABLE "order_items"
  ADD COLUMN "is_out_of_stock" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "out_of_stock_at" TIMESTAMPTZ;
