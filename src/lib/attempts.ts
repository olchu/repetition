import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const attemptInclude = {
  answers: true,
  result: true,
  assignment: {
    include: {
      test: {
        include: {
          questions: {
            include: { options: true },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  },
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
    include: {
      test: {
        include: {
          questions: {
            include: { options: true },
            orderBy: { position: "asc" },
          },
        },
      },
    },
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
      questions: attempt.assignment.test.questions.map((question) => ({
        id: question.externalId,
        text: question.text,
        points: question.points,
        // The hint gives nothing away, so it travels with the open question.
        hint: question.hint,
        options: question.options.map((option) => ({
          id: option.externalId,
          text: option.text,
        })),
        ...(revealAnswers || attempt.answers.some((answer) => answer.questionId === question.id)
          ? {
              correctOptionId: question.options.find((option) => option.isCorrect)?.externalId ?? null,
              explanation: question.explanation,
            }
          : {}),
      })),
    },
    answers: attempt.answers.map((answer) => ({
      questionId:
        attempt.assignment.test.questions.find((question) => question.id === answer.questionId)?.externalId ??
        answer.questionId,
      optionId:
        attempt.assignment.test.questions
          .flatMap((question) => question.options)
          .find((option) => option.id === answer.optionId)?.externalId ?? answer.optionId,
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
