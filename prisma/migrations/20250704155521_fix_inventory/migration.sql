/*
  Warnings:

  - You are about to drop the column `notes` on the `Inventory` table. All the data in the column will be lost.
  - Added the required column `administeredBy` to the `Inventory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dosage` to the `Inventory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vaccineType` to the `Inventory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Inventory" DROP COLUMN "notes",
ADD COLUMN     "administeredBy" TEXT NOT NULL,
ADD COLUMN     "dateofVaccination" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dosage" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "nextDueDate" TIMESTAMP(3),
ADD COLUMN     "vaccineType" TEXT NOT NULL;
