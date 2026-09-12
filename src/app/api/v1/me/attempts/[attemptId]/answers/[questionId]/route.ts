import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAttemptForChild, revealedAnswerKey, serializeAnswer, serializeAttempt } from "@/lib/attempts";
import { MAX_ANSWER_LENGTH, type SubmittedAnswer } from "@/lib/grading";
import { readTestContent, type StoredQuestion } from "@/lib/test-content";
import { withChildAttemptLock } from "@/lib/attempt-lock";

type RouteContext = { params: Promise<{ attemptId: string; questionId: string }> };

/** `{ optionId }` for a choice question, `{ value }` for an input question. */
type AnswerBody = { optionId?: unknown; value?: unknown };

function readSubmittedAnswer(question: StoredQuestion, body: AnswerBody | null): SubmittedAnswer | null {
  if (question.type === "input") {
    const value = typeof body?.value === "string" ? body.value.trim() : "";
    return value && value.length <= MAX_ANSWER_LENGTH ? { optionId: null, value } : null;
  }

  const optionId = typeof body?.optionId === "string" ? body.optionId : "";
  return question.options.some((option) => option.id === optionId) ? { optionId, value: null } : null;
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CHILD") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Child access required." } },
      { status: user ? 403 : 401 },
    );
  }

  const { attemptId, questionId } = await context.params;
  const body = (await request.json().catch(() => null)) as AnswerBody | null;
  return withChildAttemptLock(user.id, async (transaction) => {
    const attempt = await findAttemptForChild(attemptId, user.id, transaction);

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

    const { questions } = readTestContent(attempt.assignment.test.content);
    const question = questions.find((item) => item.id === questionId);
    const submitted = question ? readSubmittedAnswer(question, body) : null;

    if (!question || !submitted) {
      return NextResponse.json(
        { error: { code: "INVALID_ANSWER", message: "Question or answer does not belong to this test." } },
        { status: 422 },
      );
    }

    const existing = attempt.answers.find((answer) => answer.questionId === questionId);
    if (existing && (existing.optionId !== submitted.optionId || existing.value !== submitted.value)) {
      return NextResponse.json({ error: { code: "ANSWER_LOCKED", message: "Checked answers cannot be changed." } }, { status: 409 });
    }
    await transaction.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: {},
      create: { attemptId, questionId, ...submitted },
    });
    const saved = existing ?? { attemptId, questionId, ...submitted, updatedAt: new Date() };

    return NextResponse.json({
      reward: serializeAttempt({ ...attempt, answers: existing ? attempt.answers : [...attempt.answers, saved] }).reward,
      answer: serializeAnswer(question, saved),
      feedback: {
        hintUsed: attempt.hintQuestionIds.includes(questionId),
        ...revealedAnswerKey(question),
      },
    });
  });
}
