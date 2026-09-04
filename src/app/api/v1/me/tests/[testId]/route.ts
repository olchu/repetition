import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAccessibleAssignment } from "@/lib/attempts";

type RouteContext = { params: Promise<{ testId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CHILD") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Child access required." } },
      { status: user ? 403 : 401 },
    );
  }

  const assignment = await findAccessibleAssignment((await context.params).testId, user.id);

  if (!assignment || assignment.test.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Assigned test not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    test: {
      id: assignment.test.id,
      title: assignment.test.title,
      description: assignment.test.description,
      subject: assignment.test.subject.toLowerCase(),
      grade: assignment.test.grade,
      passPercentage: assignment.test.passPercentage,
      questionCount: assignment.test.questions.length,
      questions: assignment.test.questions.map((question) => ({
        id: question.externalId,
        text: question.text,
        points: question.points,
        options: question.options.map((option) => ({
          id: option.externalId,
          text: option.text,
        })),
      })),
    },
  });
}
