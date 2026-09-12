-- Input questions store what the child typed instead of an option id.
-- Existing rows all answer choice questions and keep their optionId.
ALTER TABLE "Answer" ALTER COLUMN "optionId" DROP NOT NULL;
ALTER TABLE "Answer" ADD COLUMN "value" TEXT;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_option_or_value_check"
  CHECK (("optionId" IS NULL) <> ("value" IS NULL));
