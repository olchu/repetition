-- Administrator-made groups of tests. Membership is keyed by Test.stableId
-- (every version of a test), so a test belongs to at most one set. Deleting a
-- set removes its memberships only; tests and assignments stay.
CREATE TABLE "TestSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TestSetItem" (
    "stableId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSetItem_pkey" PRIMARY KEY ("stableId")
);

CREATE UNIQUE INDEX "TestSet_name_key" ON "TestSet"("name");

CREATE INDEX "TestSetItem_setId_idx" ON "TestSetItem"("setId");

ALTER TABLE "TestSetItem" ADD CONSTRAINT "TestSetItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "TestSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
