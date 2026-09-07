import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  findAccessibleAssignment,
  findAttemptForChild,
  serializeAttempt,
} from "@/lib/attempts";
import { withChildAttemptLock } from "@/lib/attempt-lock";

type RouteContext = { params: Promise<{ testId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CHILD") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Child access required." } },
      { status: user ? 403 : 401 },
    );
  }

  const { testId } = await context.params;
  const assignment = await findAccessibleAssignment(testId, user.id);

  if (!assignment || assignment.test.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Assigned test not found." } },
      { status: 404 },
    );
  }

  return withChildAttemptLock(user.id, async (transaction) => {
    const resumable = await transaction.attempt.findFirst({
      where: {
        childId: user.id,
        status: "IN_PROGRESS",
        assignment: { test: { stableId: assignment.test.stableId } },
      },
      orderBy: { startedAt: "desc" },
    });

    if (resumable) {
      const savedAttempt = await findAttemptForChild(resumable.id, user.id, transaction);

      if (savedAttempt) {
        return NextResponse.json({ attempt: serializeAttempt(savedAttempt), resumed: true });
      }
    }

    const previousAttempts = await transaction.attempt.count({
      where: { childId: user.id, assignment: { test: { stableId: assignment.test.stableId } } },
    });
    const attempt = await transaction.attempt.create({
      data: {
        assignmentId: assignment.id,
        childId: user.id,
        testVersion: assignment.test.version,
        ...(previousAttempts === 0 ? { reward: { create: { childId: user.id, stableId: assignment.test.stableId } } } : {}),
      },
    });
    const savedAttempt = await findAttemptForChild(attempt.id, user.id, transaction);

    if (!savedAttempt) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Unable to load new attempt." } },
        { status: 500 },
      );
    }

    return NextResponse.json({ attempt: serializeAttempt(savedAttempt) }, { status: 201 });
  });
}
