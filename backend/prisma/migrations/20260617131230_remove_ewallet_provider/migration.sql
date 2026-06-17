/*
  Warnings:

  - You are about to drop the column `ewallet_provider` on the `tenants` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tenants" DROP COLUMN "ewallet_provider";
