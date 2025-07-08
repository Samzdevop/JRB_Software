-- AlterTable
ALTER TABLE "Livestock" ADD COLUMN     "isSick" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTreatment" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Sickness" (
    "id" TEXT NOT NULL,
    "livestockId" TEXT NOT NULL,
    "dateOfObservation" TIMESTAMP(3) NOT NULL,
    "observedSymptoms" TEXT NOT NULL,
    "suspectedCause" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sickness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treatment" (
    "id" TEXT NOT NULL,
    "sicknessId" TEXT,
    "livestockId" TEXT NOT NULL,
    "dateOfTreatment" TIMESTAMP(3) NOT NULL,
    "treatmentType" TEXT NOT NULL,
    "dosage" DOUBLE PRECISION NOT NULL,
    "cause" TEXT NOT NULL,
    "administeredBy" TEXT NOT NULL,
    "nextDueDate" TIMESTAMP(3),
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Sickness" ADD CONSTRAINT "Sickness_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sickness" ADD CONSTRAINT "Sickness_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_sicknessId_fkey" FOREIGN KEY ("sicknessId") REFERENCES "Sickness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
