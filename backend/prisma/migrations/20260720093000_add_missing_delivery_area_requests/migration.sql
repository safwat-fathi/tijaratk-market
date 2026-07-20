CREATE TYPE "missing_delivery_area_requests_status_enum" AS ENUM ('pending', 'resolved');

CREATE TABLE "missing_delivery_area_requests" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "main_area_id" INTEGER NOT NULL,
  "requested_area_name" VARCHAR(120) NOT NULL,
  "note" VARCHAR(500),
  "status" "missing_delivery_area_requests_status_enum" NOT NULL DEFAULT 'pending',
  "resolved_area_id" INTEGER,
  "resolved_by_admin_id" INTEGER,
  "resolved_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "PK_missing_delivery_area_requests_id" PRIMARY KEY ("id")
);

ALTER TABLE "missing_delivery_area_requests" ADD CONSTRAINT "FK_missing_delivery_area_requests_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "missing_delivery_area_requests" ADD CONSTRAINT "FK_missing_delivery_area_requests_main_area" FOREIGN KEY ("main_area_id") REFERENCES "directory_areas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "missing_delivery_area_requests" ADD CONSTRAINT "FK_missing_delivery_area_requests_resolved_area" FOREIGN KEY ("resolved_area_id") REFERENCES "directory_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "missing_delivery_area_requests" ADD CONSTRAINT "FK_missing_delivery_area_requests_resolved_by" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX "IDX_missing_delivery_area_requests_status_created" ON "missing_delivery_area_requests"("status", "created_at");
CREATE INDEX "IDX_missing_delivery_area_requests_tenant_main" ON "missing_delivery_area_requests"("tenant_id", "main_area_id");
CREATE UNIQUE INDEX "UQ_missing_delivery_area_requests_pending_tenant_main" ON "missing_delivery_area_requests"("tenant_id", "main_area_id") WHERE "status" = 'pending';
