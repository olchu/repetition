import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { readTestContent } from "./test-content";

const attemptInclude = {
  answers: true,
  result: true,
  assignment: { include: { test: true } },
} as const;

export type AttemptWithTest = Prisma.AttemptGetPayload<{ include: typeof attemptInclude }>;

export async function findAccessibleAssignment(testId: string, childId: string) {
  return prisma.assignment.findFirst({
    where: {
      testId,
      status: "ACTIVE",
      OR: [
        { childId },
        { group: { members: { some: { childId } } } },
      ],
    },
    include: { test: true },
  });
}

export async function findAttemptForChild(attemptId: string, childId: string) {
  return prisma.attempt.findFirst({
    where: { id: attemptId, childId },
    include: attemptInclude,
  });
}

export function serializeAttempt(attempt: AttemptWithTest) {
  const revealAnswers = attempt.status === "SUBMITTED";
  const answeredQuestionIds = new Set(attempt.answers.map((answer) => answer.questionId));
  const { questions } = readTestContent(attempt.assignment.test.content);

  return {
    id: attempt.id,
    status: attempt.status.toLowerCase(),
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    test: {
      id: attempt.assignment.test.id,
      title: attempt.assignment.test.title,
      subject: attempt.assignment.test.subject.toLowerCase(),
      passPercentage: attempt.assignment.test.passPercentage,
      questions: questions.map((question) => ({
        id: question.id,
        text: question.text,
        points: question.points,
        // The hint gives nothing away, so it travels with the open question.
        hint: question.hint,
        options: question.options.map((option) => ({
          id: option.id,
          text: option.text,
        })),
        ...(revealAnswers || answeredQuestionIds.has(question.id)
          ? {
              correctOptionId: question.correctOptionId,
              explanation: question.explanation,
            }
          : {}),
      })),
    },
    answers: attempt.answers.map((answer) => ({
      questionId: answer.questionId,
      optionId: answer.optionId,
    })),
    result: attempt.result
      ? {
          earnedPoints: attempt.result.earnedPoints,
          totalPoints: attempt.result.totalPoints,
          percentage: attempt.result.percentage,
          passed: attempt.result.passed,
        }
      : null,
  };
}
