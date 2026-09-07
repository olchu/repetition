ALTER TABLE "Attempt" ADD COLUMN "hintQuestionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "TestReward" (
  "childId" TEXT NOT NULL,
  "stableId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "units" INTEGER NOT NULL DEFAULT 0 CHECK ("units" >= 0),
  "creditedAt" TIMESTAMP(3),
  CONSTRAINT "TestReward_pkey" PRIMARY KEY ("childId", "stableId"),
  CONSTRAINT "TestReward_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TestReward_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TestReward_attemptId_key" ON "TestReward"("attemptId");
