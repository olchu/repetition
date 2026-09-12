BEGIN;
ALTER TYPE "Subject" RENAME TO "LegacySubject";
CREATE TABLE "Subject" (
 "id" TEXT PRIMARY KEY, "slug" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL,
 "icon" TEXT, "color" TEXT NOT NULL, "backgroundColor" TEXT NOT NULL, "textColor" TEXT NOT NULL,
 "sortOrder" INTEGER NOT NULL DEFAULT 0, "archived" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "Subject" ("id","slug","name","icon","color","backgroundColor","textColor","sortOrder") VALUES
('subject-biology','biology','Biology','/icons/biology.png','#22c55e','#d4f8df','#15803d',0),
('subject-chemistry','chemistry','Chemistry','/icons/chemistry.png','#22c55e','#d2f7e1','#047857',1),
('subject-geography','geography','Geography','/icons/geography.png','#00bfe7','#d6f1fa','#0369a1',2),
('subject-ict','ict','ICT','/icons/ict.png','#ec4899','#d2f3fb','#0e7490',3),
('subject-mathematics','mathematics','Mathematics','/icons/math.png','#ec4899','#ffd9e5','#be185d',4),
('subject-physics','physics','Physics','/icons/phisics.png','#22c55e','#dde0ff','#4f46e5',5),
('subject-psychology','psychology','Psychology','/icons/psychology.png','#f59e0b','#e9deff','#7e22ce',6),
('subject-sociology','sociology','Sociology','/icons/sociology.png','#f59e0b','#d2f6ea','#0f766e',7),
('subject-spanish','spanish','Spanish','/icons/spain.png','#00bfe7','#ffe6c2','#b45309',8),
('subject-science','science','Science',NULL,'#22c55e','#e8f9ee','#15803d',9),
('subject-history','history','History',NULL,'#f59e0b','#fdf3e2','#b45309',10);
CREATE TABLE "ChildSubject" (
 "childId" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0,
 "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("childId","subjectId"),
 FOREIGN KEY ("childId") REFERENCES "ChildProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ChildSubject_subjectId_idx" ON "ChildSubject"("subjectId");
INSERT INTO "ChildSubject" ("childId","subjectId","sortOrder")
 SELECT p."userId", s."id", (item.ordinality - 1)::integer
 FROM "ChildProfile" p CROSS JOIN LATERAL unnest(p."subjects") WITH ORDINALITY AS item(value, ordinality)
 JOIN "Subject" s ON s."slug" = lower(item.value::text);
ALTER TABLE "Test" ADD COLUMN "subjectId" TEXT;
UPDATE "Test" t SET "subjectId" = s."id" FROM "Subject" s WHERE s."slug" = lower(t."subject"::text);
ALTER TABLE "Test" ALTER COLUMN "subjectId" SET NOT NULL;
ALTER TABLE "Test" ADD CONSTRAINT "Test_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Test_subjectId_status_idx" ON "Test"("subjectId","status");
-- Verify the backfill before removing the enum and array.
DO $$ BEGIN
 IF (SELECT count(*) FROM "ChildSubject") <> (SELECT coalesce(sum(cardinality("subjects")),0) FROM "ChildProfile") THEN
  RAISE EXCEPTION 'Subject assignment backfill mismatch';
 END IF;
END $$;
ALTER TABLE "Test" DROP COLUMN "subject";
ALTER TABLE "ChildProfile" DROP COLUMN "subjects";
DROP TYPE "LegacySubject";
COMMIT;

