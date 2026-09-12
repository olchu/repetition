import type { Prisma } from "@prisma/client";

/**
 * A published test is an immutable document, so its questions live in a single
 * `Test.content` JSON column rather than in normalised tables. Ids inside it are
 * the author's own ids from the uploaded file ("q1", "a"), and `Answer` rows
 * reference those same ids — nothing has to be translated on the way out.
 */
export const CONTENT_VERSION = "1.0";

export type StoredOption = {
  id: string;
  text: string;
};

type StoredQuestionBase = {
  id: string;
  text: string;
  points: number;
  /** Markdown revealed on demand while the question is still open. */
  hint: string | null;
  /** Markdown revealed once the answer has been checked. */
  explanation: string | null;
};

/** The child picks one of the options. */
export type StoredChoiceQuestion = StoredQuestionBase & {
  type: "choice";
  options: StoredOption[];
  correctOptionId: string;
};

/** The child types the answer; any of `correctAnswers` is accepted, see `lib/grading`. */
export type StoredInputQuestion = StoredQuestionBase & {
  type: "input";
  /** The first one is shown to the child as "the correct answer". */
  correctAnswers: string[];
};

export type StoredQuestion = StoredChoiceQuestion | StoredInputQuestion;

export type TestContent = {
  schemaVersion: string;
  questions: StoredQuestion[];
};

/** Shape `buildTestContent` needs; `TestQuestionInput` satisfies it structurally. */
type QuestionSource = {
  id: string;
  text: string;
  points?: number;
  hint?: string;
  explanation?: string;
} & (
  | { type?: "choice"; options: Array<{ id: string; text: string }>; correctOptionId: string }
  | { type: "input"; correctAnswers: string[] }
);

/** Normalises a validated upload into the shape stored in `Test.content`. */
export function buildTestContent(questions: QuestionSource[]): TestContent {
  return {
    schemaVersion: CONTENT_VERSION,
    questions: questions.map((question): StoredQuestion => {
      const base = {
        id: question.id,
        text: question.text,
        points: question.points ?? 1,
        hint: question.hint ?? null,
        explanation: question.explanation ?? null,
      };

      return question.type === "input"
        ? { ...base, type: "input", correctAnswers: question.correctAnswers.map((answer) => answer.trim()) }
        : {
            ...base,
            type: "choice",
            options: question.options.map((option) => ({ id: option.id, text: option.text })),
            correctOptionId: question.correctOptionId,
          };
    }),
  };
}

/**
 * Reads a stored `Test.content` column. The value was written by
 * `buildTestContent` after schema validation, so this only guards the shape
 * rather than re-validating every field: a row that somehow lost its questions
 * degrades to an empty test instead of throwing mid-request.
 */
export function readTestContent(value: Prisma.JsonValue | null | undefined): TestContent {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as { schemaVersion?: unknown; questions?: unknown };

    if (Array.isArray(record.questions)) {
      return {
        schemaVersion: typeof record.schemaVersion === "string" ? record.schemaVersion : CONTENT_VERSION,
        // Content stored before input questions existed has no `type`: every such question is a choice.
        questions: (record.questions as Array<{ type?: unknown }>).map(
          (question) => ({ ...question, type: question.type === "input" ? "input" : "choice" }) as StoredQuestion,
        ),
      };
    }
  }

  return { schemaVersion: CONTENT_VERSION, questions: [] };
}

/** Serialises content back to the JSON column type Prisma expects on write. */
export function toJsonColumn(content: TestContent): Prisma.InputJsonValue {
  return content as unknown as Prisma.InputJsonValue;
}
