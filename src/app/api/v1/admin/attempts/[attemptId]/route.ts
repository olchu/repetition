import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAttemptForAdmin, reviewAttemptQuestions } from "@/lib/attempt-review";

type RouteContext = { params: Promise<{ attemptId: string }> };

/**
 * Per-question breakdown of one attempt, for the administrator: what the child
 * picked, what was correct, and how the points were earned. Unlike the child's
 * own view this never hides the answer key.
 */
export async function GET(_request: Request, context: RouteContext) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const { attemptId } = await context.params;
  const attempt = await findAttemptForAdmin(attemptId);

  if (!attempt) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Attempt not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      status: attempt.status.toLowerCase(),
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      child: {
        id: attempt.child.id,
        login: attempt.child.login,
        displayName: attempt.child.childProfile?.displayName ?? attempt.child.login,
      },
      test: {
        id: attempt.assignment.test.id,
        title: attempt.assignment.test.title,
        subject: attempt.assignment.test.subject.slug,
        version: attempt.assignment.test.version,
        passPercentage: attempt.assignment.test.passPercentage,
      },
      result: attempt.result
        ? {
            earnedPoints: attempt.result.earnedPoints,
            totalPoints: attempt.result.totalPoints,
            percentage: attempt.result.percentage,
            passed: attempt.result.passed,
          }
        : null,
      questions: reviewAttemptQuestions(attempt).map(({ question, answer, isCorrect, hintUsed, earnedPoints }) => {
        const chosenOptionId = answer?.optionId ?? null;

        return {
          id: question.id,
          type: question.type,
          text: question.text,
          points: question.points,
          earnedPoints,
          answered: answer !== null,
          isCorrect,
          /** The child opened the hint before answering. */
          hintUsed,
          chosenOptionId,
          correctOptionId: question.type === "choice" ? question.correctOptionId : null,
          /** What the child typed for an input question. */
          value: answer?.value ?? null,
          correctAnswers: question.type === "input" ? question.correctAnswers : [],
          hint: question.hint,
          explanation: question.explanation,
          options: question.type === "choice"
            ? question.options.map((option) => ({
                id: option.id,
                text: option.text,
                isChosen: option.id === chosenOptionId,
                isCorrect: option.id === question.correctOptionId,
              }))
            : [],
        };
      }),
    },
  });
}
