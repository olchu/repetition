import type { Prisma } from "@prisma/client";
import { isAnswerCorrect } from "./grading";
import { prisma } from "./prisma";
import { readTestContent } from "./test-content";

const adminAttemptInclude = {
  answers: true,
  result: true,
  child: { select: { id: true, login: true, childProfile: { select: { displayName: true, grade: true } } } },
  assignment: { include: { test: { include: { subject: true } } } },
} as const;

export type AdminAttempt = Prisma.AttemptGetPayload<{ include: typeof adminAttemptInclude }>;

/** Any child's attempt with its answers and test. Callers must check for an administrator. */
export function findAttemptForAdmin(attemptId: string) {
  return prisma.attempt.findUnique({ where: { id: attemptId }, include: adminAttemptInclude });
}

/** A child's submitted attempts of every version of one test, oldest first. Admin-only, like the above. */
export function findSubmittedAttemptsForTest(childId: string, stableId: string) {
  return prisma.attempt.findMany({
    where: { childId, status: "SUBMITTED", assignment: { test: { stableId } } },
    include: adminAttemptInclude,
    orderBy: [{ submittedAt: "asc" }, { startedAt: "asc" }],
  });
}

/**
 * Outcome of every question of an attempt, answer key included. `hintUsed`
 * means the hint was opened before answering; reviewing it afterwards is not recorded.
 */
export function reviewAttemptQuestions(attempt: AdminAttempt) {
  const { questions } = readTestContent(attempt.assignment.test.content);
  const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  const hinted = new Set(attempt.hintQuestionIds);

  return questions.map((question) => {
    const answer = answersByQuestion.get(question.id);
    const isCorrect = isAnswerCorrect(question, answer);
    return {
      question,
      answer: answer ?? null,
      isCorrect,
      hintUsed: hinted.has(question.id),
      earnedPoints: isCorrect ? question.points : 0,
    };
  });
}
