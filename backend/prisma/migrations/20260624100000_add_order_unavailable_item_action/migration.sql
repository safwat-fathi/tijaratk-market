ALTER TABLE "orders"
  ADD COLUMN "unavailable_item_action" VARCHAR(64) NOT NULL DEFAULT 'suggest_replacement';
