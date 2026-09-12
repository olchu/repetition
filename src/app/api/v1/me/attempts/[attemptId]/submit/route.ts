import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAttemptForChild, serializeAttempt } from "@/lib/attempts";
import { readTestContent } from "@/lib/test-content";
import { withChildAttemptLock } from "@/lib/attempt-lock";
import { rewardUnits } from "@/lib/rewards";
import { isAnswerCorrect } from "@/lib/grading";

type RouteContext = { params: Promise<{ attemptId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CHILD") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Child access required." } },
      { status: user ? 403 : 401 },
    );
  }

  const { attemptId } = await context.params;
  return withChildAttemptLock(user.id, async (transaction) => {
    const attempt = await findAttemptForChild(attemptId, user.id, transaction);

    if (!attempt) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Attempt not found." } },
        { status: 404 },
      );
    }

    if (attempt.status === "SUBMITTED") {
      return NextResponse.json({ attempt: serializeAttempt(attempt) });
    }

    const { questions } = readTestContent(attempt.assignment.test.content);
    const totalPoints = questions.reduce((total, question) => total + question.points, 0);
    const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const earnedPoints = questions.reduce(
      (total, question) => total + (isAnswerCorrect(question, answersByQuestion.get(question.id)) ? question.points : 0),
      0,
    );
    const percentage = totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 10000) / 100;
    const passed = percentage >= attempt.assignment.test.passPercentage;

    const transition = await transaction.attempt.updateMany({
      where: { id: attemptId, childId: user.id, status: "IN_PROGRESS" },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    if (transition.count === 0) {
      return NextResponse.json({ error: { code: "CONFLICT" } }, { status: 409 });
    }

    await transaction.result.create({
      data: {
        attemptId,
        earnedPoints,
        totalPoints,
        percentage,
        passed,
      },
    });
    if (attempt.reward && !attempt.reward.creditedAt) {
      await transaction.testReward.update({
        where: { attemptId },
        data: { units: rewardUnits(questions, attempt.answers, attempt.hintQuestionIds), creditedAt: new Date() },
      });
    }

    const submitted = await findAttemptForChild(attemptId, user.id, transaction);

    if (!submitted) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Unable to load submitted attempt." } },
        { status: 500 },
      );
    }

    return NextResponse.json({ attempt: serializeAttempt(submitted) });
  });
}
