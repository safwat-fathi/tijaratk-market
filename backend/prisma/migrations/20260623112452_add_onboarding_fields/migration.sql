-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboarding_step" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "delivery_fee" SET DEFAULT 20;
