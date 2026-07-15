CREATE TYPE "meta_conversion_outbox_status_enum" AS ENUM (
  'pending',
  'processing',
  'sent',
  'dead_letter'
);

CREATE TABLE "meta_conversion_outbox" (
  "id" SERIAL NOT NULL,
  "order_id" INTEGER NOT NULL,
  "event_id" VARCHAR(128) NOT NULL,
  "event_name" VARCHAR(64) NOT NULL,
  "encrypted_payload" TEXT,
  "status" "meta_conversion_outbox_status_enum" NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(6),
  "locked_by" VARCHAR(160),
  "last_error_code" VARCHAR(64),
  "last_error_message" TEXT,
  "sent_at" TIMESTAMPTZ(6),
  "terminal_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PK_meta_conversion_outbox_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_meta_conversion_outbox_order"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "UQ_meta_conversion_outbox_order_id"
  ON "meta_conversion_outbox"("order_id");

CREATE UNIQUE INDEX "UQ_meta_conversion_outbox_event_id"
  ON "meta_conversion_outbox"("event_id");

CREATE INDEX "IDX_meta_conversion_outbox_status_next_attempt"
  ON "meta_conversion_outbox"("status", "next_attempt_at");

CREATE INDEX "IDX_meta_conversion_outbox_locked_at"
  ON "meta_conversion_outbox"("locked_at");

CREATE INDEX "IDX_meta_conversion_outbox_terminal_at"
  ON "meta_conversion_outbox"("terminal_at");
