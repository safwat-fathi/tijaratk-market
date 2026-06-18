ALTER TABLE "orders"
  ADD COLUMN "merchant_cancellation_reason" TEXT,
  ADD COLUMN "merchant_cancelled_at" TIMESTAMPTZ(6);

CREATE TABLE "password_reset_otps" (
  "id" SERIAL NOT NULL,
  "phone" VARCHAR NOT NULL,
  "otp_hash" VARCHAR NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PK_password_reset_otps_id" PRIMARY KEY ("id")
);

CREATE INDEX "IDX_password_reset_otps_phone_created"
  ON "password_reset_otps"("phone", "created_at");

CREATE INDEX "IDX_password_reset_otps_phone_active"
  ON "password_reset_otps"("phone", "consumed_at", "expires_at");
