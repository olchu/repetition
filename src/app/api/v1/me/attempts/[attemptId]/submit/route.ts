import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAttemptForChild, serializeAttempt } from "@/lib/attempts";
import { readTestContent } from "@/lib/test-content";
import { prisma } from "@/lib/prisma";

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
  const attempt = await findAttemptForChild(attemptId, user.id);

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
  const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer.optionId]));
  const earnedPoints = questions.reduce((total, question) => {
    const selectedOptionId = answersByQuestion.get(question.id);
    return total + (selectedOptionId === question.correctOptionId ? question.points : 0);
  }, 0);
  const percentage = totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 10000) / 100;
  const passed = percentage >= attempt.assignment.test.passPercentage;

  try {
    await prisma.$transaction(async (transaction) => {
      const transition = await transaction.attempt.updateMany({
        where: { id: attemptId, childId: user.id, status: "IN_PROGRESS" },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });

      if (transition.count === 0) {
        return;
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
    });
  } catch {
    const current = await findAttemptForChild(attemptId, user.id);

    if (current?.status === "SUBMITTED") {
      return NextResponse.json({ attempt: serializeAttempt(current) });
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to submit attempt." } },
      { status: 500 },
    );
  }

  const submitted = await findAttemptForChild(attemptId, user.id);

  if (!submitted) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to load submitted attempt." } },
      { status: 500 },
    );
  }

  return NextResponse.json({ attempt: serializeAttempt(submitted) });
}
