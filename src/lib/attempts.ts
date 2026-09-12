import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { isAnswerCorrect, type SubmittedAnswer } from "./grading";
import { readTestContent, type StoredQuestion } from "./test-content";
import { rewardUnits } from "./rewards";

const attemptInclude = {
  answers: true,
  result: true,
  reward: true,
  assignment: { include: { test: { include: { subject: true } } } },
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
    include: { test: { include: { subject: true } } },
  });
}

export async function findAttemptForChild(attemptId: string, childId: string, client: Prisma.TransactionClient = prisma) {
  return client.attempt.findFirst({
    where: { id: attemptId, childId },
    include: attemptInclude,
  });
}

/** Answer key of one question; revealed only once it is checked or the attempt is submitted. */
export function revealedAnswerKey(question: StoredQuestion) {
  return {
    ...(question.type === "input"
      ? { correctAnswer: question.correctAnswers[0] ?? null }
      : { correctOptionId: question.correctOptionId }),
    explanation: question.explanation,
  };
}

/** A saved answer with the server's verdict, so the client never grades typed values itself. */
export function serializeAnswer(question: StoredQuestion | undefined, answer: SubmittedAnswer & { questionId: string }) {
  return {
    questionId: answer.questionId,
    optionId: answer.optionId,
    value: answer.value,
    isCorrect: question ? isAnswerCorrect(question, answer) : false,
  };
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
    reward: {
      eligible: attempt.reward !== null,
      pendingStars: attempt.reward && !attempt.reward.creditedAt ? rewardUnits(questions, attempt.answers, attempt.hintQuestionIds) / 2 : 0,
      earnedStars: (attempt.reward?.units ?? 0) / 2,
    },
    test: {
      id: attempt.assignment.test.id,
      title: attempt.assignment.test.title,
      subject: attempt.assignment.test.subject.slug,
      passPercentage: attempt.assignment.test.passPercentage,
      questions: questions.map((question) => ({
        id: question.id,
        type: question.type,
        text: question.text,
        points: question.points,
        hasHint: Boolean(question.hint),
        hintUsed: attempt.hintQuestionIds.includes(question.id),
        hint: revealAnswers || answeredQuestionIds.has(question.id) || attempt.hintQuestionIds.includes(question.id) ? question.hint : null,
        options: question.type === "choice"
          ? question.options.map((option) => ({ id: option.id, text: option.text }))
          : [],
        ...(revealAnswers || answeredQuestionIds.has(question.id) ? revealedAnswerKey(question) : {}),
      })),
    },
    answers: attempt.answers.map((answer) => serializeAnswer(questions.find((question) => question.id === answer.questionId), answer)),
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
