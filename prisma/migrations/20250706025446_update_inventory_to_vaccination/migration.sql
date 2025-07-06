/*
  Warnings:

  - You are about to drop the `Inventory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Inventory" DROP CONSTRAINT "Inventory_livestockId_fkey";

-- DropForeignKey
ALTER TABLE "Inventory" DROP CONSTRAINT "Inventory_recordedById_fkey";

-- DropTable
DROP TABLE "Inventory";

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL,
    "livestockId" TEXT NOT NULL,
    "dateofVaccination" TIMESTAMP(3) NOT NULL,
    "vaccineType" TEXT NOT NULL,
    "dosage" DOUBLE PRECISION NOT NULL,
    "administeredBy" TEXT NOT NULL,
    "nextDueDate" TIMESTAMP(3),
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
