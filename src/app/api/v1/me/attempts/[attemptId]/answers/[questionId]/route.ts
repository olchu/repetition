import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAttemptForChild } from "@/lib/attempts";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ attemptId: string; questionId: string }> };

type AnswerBody = { optionId?: unknown };

export async function PUT(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CHILD") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Child access required." } },
      { status: user ? 403 : 401 },
    );
  }

  const { attemptId, questionId } = await context.params;
  const attempt = await findAttemptForChild(attemptId, user.id);

  if (!attempt) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Attempt not found." } },
      { status: 404 },
    );
  }

  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: { code: "ATTEMPT_SUBMITTED", message: "Submitted attempts cannot be changed." } },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as AnswerBody | null;
  const optionId = typeof body?.optionId === "string" ? body.optionId : "";
  const question = attempt.assignment.test.questions.find((item) => item.externalId === questionId);
  const option = question?.options.find((item) => item.externalId === optionId);

  if (!question || !option) {
    return NextResponse.json(
      { error: { code: "INVALID_ANSWER", message: "Question or option does not belong to this test." } },
      { status: 422 },
    );
  }

  await prisma.answer.upsert({
    where: { attemptId_questionId: { attemptId, questionId: question.id } },
    update: { optionId: option.id },
    create: { attemptId, questionId: question.id, optionId: option.id },
  });

  return NextResponse.json({
    answer: { questionId, optionId },
    feedback: {
      correctOptionId: question.options.find((item) => item.isCorrect)?.externalId ?? null,
      explanation: question.explanation,
    },
  });
}
