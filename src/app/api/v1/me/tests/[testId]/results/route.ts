import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAccessibleAssignment } from "@/lib/attempts";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ testId: string }> };

export async function GET(_request: Request, context: RouteContext) {
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

  const attempts = await prisma.attempt.findMany({
    where: {
      childId: user.id,
      assignment: { testId, status: "ACTIVE" },
      status: "SUBMITTED",
    },
    include: { result: true },
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json({
    test: { id: assignment.test.id, title: assignment.test.title, subject: assignment.test.subject.slug },
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      submittedAt: attempt.submittedAt,
      earnedPoints: attempt.result?.earnedPoints ?? 0,
      totalPoints: attempt.result?.totalPoints ?? 0,
      percentage: attempt.result?.percentage ?? 0,
      passed: attempt.result?.passed ?? false,
    })),
  });
}
