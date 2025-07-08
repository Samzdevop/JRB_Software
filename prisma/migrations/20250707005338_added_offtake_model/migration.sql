-- CreateEnum
CREATE TYPE "Offtake" AS ENUM ('SALE', 'DEATH', 'MISSING');

-- DropEnum
DROP TYPE "InventoryAction";

-- CreateTable
CREATE TABLE "OfftakeRecord" (
    "id" TEXT NOT NULL,
    "livestockId" TEXT NOT NULL,
    "type" "Offtake" NOT NULL,
    "dateOfEvent" TIMESTAMP(3) NOT NULL,
    "destination" TEXT,
    "price" DOUBLE PRECISION,
    "causeOfDeath" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfftakeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfftakeRecord_livestockId_idx" ON "OfftakeRecord"("livestockId");

-- CreateIndex
CREATE INDEX "OfftakeRecord_type_idx" ON "OfftakeRecord"("type");

-- AddForeignKey
ALTER TABLE "OfftakeRecord" ADD CONSTRAINT "OfftakeRecord_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfftakeRecord" ADD CONSTRAINT "OfftakeRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
