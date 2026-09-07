import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAttemptForChild } from "@/lib/attempts";
import { withChildAttemptLock } from "@/lib/attempt-lock";
import { readTestContent } from "@/lib/test-content";

type Context = { params: Promise<{ attemptId: string; questionId: string }> };

export async function POST(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Child access required." } }, { status: user ? 403 : 401 });
  }
  const { attemptId, questionId } = await context.params;
  return withChildAttemptLock(user.id, async (transaction) => {
    const attempt = await findAttemptForChild(attemptId, user.id, transaction);
    if (!attempt) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    const question = readTestContent(attempt.assignment.test.content).questions.find((item) => item.id === questionId);
    if (!question?.hint) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    // Reviewing a checked answer must not retroactively reduce its reward.
    const used = attempt.hintQuestionIds.includes(questionId);
    const markUsed = !used && attempt.status === "IN_PROGRESS" && !attempt.answers.some((answer) => answer.questionId === questionId);
    if (markUsed) {
      await transaction.attempt.update({ where: { id: attemptId }, data: { hintQuestionIds: { push: questionId } } });
    }
    return NextResponse.json({ hint: question.hint, hintUsed: used || markUsed });
  });
}
