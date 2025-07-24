-- CreateTable
CREATE TABLE "TaskObservation" (
    "id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "mediaUrls" TEXT[],
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskObservation_taskId_idx" ON "TaskObservation"("taskId");

-- CreateIndex
CREATE INDEX "TaskObservation_reportedById_idx" ON "TaskObservation"("reportedById");

-- AddForeignKey
ALTER TABLE "TaskObservation" ADD CONSTRAINT "TaskObservation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskObservation" ADD CONSTRAINT "TaskObservation_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
