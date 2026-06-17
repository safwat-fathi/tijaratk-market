ALTER TABLE "tenants"
  ADD COLUMN "ewallet_provider" VARCHAR(32);

ALTER TABLE "orders"
  ADD COLUMN "card_on_delivery_requested" BOOLEAN NOT NULL DEFAULT false;
