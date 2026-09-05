-- A test version is an immutable document, so its questions and options move
-- out of the normalised TestQuestion / TestOption tables into a single
-- Test.content JSON column.
--
-- Answer.questionId / Answer.optionId now hold the author's own ids from the
-- uploaded file ("q1", "a") instead of database ids. Rows written before this
-- migration point at ids that no longer exist, and there is no mapping left
-- once the tables are gone, so the recorded attempts are cleared with the
-- tests they belong to. Tests are re-imported from their JSON files.
DELETE FROM "Result";
DELETE FROM "Answer";
DELETE FROM "Attempt";
DELETE FROM "Assignment";
DELETE FROM "Test";

DROP TABLE "TestOption";
DROP TABLE "TestQuestion";

ALTER TABLE "Test" DROP COLUMN "sourceJson";
ALTER TABLE "Test" ADD COLUMN "content" JSONB NOT NULL;
ALTER TABLE "Test" ADD COLUMN "questionCount" INTEGER NOT NULL DEFAULT 0;
