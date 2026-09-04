import Ajv2020, { ErrorObject } from "ajv/dist/2020";
import testSchema from "../../docs/test.schema.json";
import { Prisma, Subject } from "@prisma/client";
import { prisma } from "./prisma";

export type TestOptionInput = {
  id: string;
  text: string;
};

export type TestQuestionInput = {
  id: string;
  text: string;
  points?: number;
  options: TestOptionInput[];
  correctOptionId: string;
  explanation?: string;
};

export type TestDocument = {
  schemaVersion: "1.0";
  id: string;
  title: string;
  description?: string;
  subject: "science" | "geography" | "history" | "mathematics";
  grade?: string;
  passPercentage?: number;
  questions: TestQuestionInput[];
};

export type TestValidationError = {
  path: string;
  code: string;
  message: string;
};

const validator = new Ajv2020({ allErrors: true, useDefaults: true }).compile(testSchema);

function formatSchemaError(error: ErrorObject): TestValidationError {
  const path = error.instancePath || "$";
  return {
    path,
    code: error.keyword,
    message: error.message ?? "Value is invalid.",
  };
}

function duplicateIds(ids: string[]) {
  return ids.filter((id, index) => ids.indexOf(id) !== index);
}

export function validateTestDocument(input: unknown):
  | { ok: true; value: TestDocument }
  | { ok: false; errors: TestValidationError[] } {
  if (!validator(input)) {
    return {
      ok: false,
      errors: (validator.errors ?? []).map(formatSchemaError),
    };
  }

  const document = input as TestDocument;
  const errors: TestValidationError[] = [];
  const questionDuplicates = duplicateIds(document.questions.map((question) => question.id));

  for (const duplicateId of questionDuplicates) {
    errors.push({
      path: "questions",
      code: "DUPLICATE_QUESTION_ID",
      message: `Question id "${duplicateId}" is repeated.`,
    });
  }

  document.questions.forEach((question, questionIndex) => {
    const optionIds = question.options.map((option) => option.id);
    const optionDuplicates = duplicateIds(optionIds);

    for (const duplicateId of optionDuplicates) {
      errors.push({
        path: `questions[${questionIndex}].options`,
        code: "DUPLICATE_OPTION_ID",
        message: `Option id "${duplicateId}" is repeated.`,
      });
    }

    if (!optionIds.includes(question.correctOptionId)) {
      errors.push({
        path: `questions[${questionIndex}].correctOptionId`,
        code: "UNKNOWN_OPTION",
        message: "Correct option id does not exist in this question.",
      });
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: document };
}

export async function createTestDraft(document: TestDocument) {
  const latest = await prisma.test.findFirst({
    where: { stableId: document.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;
  const subject = document.subject.toUpperCase() as Subject;

  return prisma.test.create({
    data: {
      stableId: document.id,
      version,
      title: document.title,
      description: document.description,
      subject,
      grade: document.grade,
      passPercentage: document.passPercentage ?? 70,
      sourceJson: document as unknown as Prisma.InputJsonValue,
      questions: {
        create: document.questions.map((question, position) => ({
          externalId: question.id,
          position,
          text: question.text,
          points: question.points ?? 1,
          explanation: question.explanation,
          options: {
            create: question.options.map((option, optionPosition) => ({
              externalId: option.id,
              position: optionPosition,
              text: option.text,
              isCorrect: option.id === question.correctOptionId,
            })),
          },
        })),
      },
    },
    include: { questions: { include: { options: true }, orderBy: { position: "asc" } } },
  });
}
