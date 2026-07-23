ALTER TABLE "orders"
  ADD COLUMN "ga_client_id" VARCHAR(128),
  ADD COLUMN "ga_session_id" VARCHAR(20);

CREATE TYPE "ga4_event_outbox_status_enum" AS ENUM (
  'pending',
  'processing',
  'sent',
  'dead_letter'
);

CREATE TABLE "ga4_event_outbox" (
  "id" SERIAL NOT NULL,
  "order_id" INTEGER NOT NULL,
  "event_name" VARCHAR(64) NOT NULL,
  "encrypted_payload" TEXT,
  "status" "ga4_event_outbox_status_enum" NOT NULL DEFAULT 'pending',
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

  CONSTRAINT "PK_ga4_event_outbox_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_ga4_event_outbox_order"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "UQ_ga4_event_outbox_order_event"
  ON "ga4_event_outbox"("order_id", "event_name");

CREATE INDEX "IDX_ga4_event_outbox_status_next_attempt"
  ON "ga4_event_outbox"("status", "next_attempt_at");

CREATE INDEX "IDX_ga4_event_outbox_locked_at"
  ON "ga4_event_outbox"("locked_at");

CREATE INDEX "IDX_ga4_event_outbox_terminal_at"
  ON "ga4_event_outbox"("terminal_at");
