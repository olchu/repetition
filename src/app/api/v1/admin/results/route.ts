import { Subject } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Administrator access required." } },
      { status: admin ? 403 : 401 },
    );
  }

  const params = new URL(request.url).searchParams;
  const childId = params.get("childId") || undefined;
  const testId = params.get("testId") || undefined;
  const groupId = params.get("groupId") || undefined;
  const subjectParam = params.get("subject")?.toUpperCase();
  const passedParam = params.get("passed");
  const subject =
    subjectParam === "SCIENCE" ||
    subjectParam === "GEOGRAPHY" ||
    subjectParam === "HISTORY" ||
    subjectParam === "MATHEMATICS"
      ? (subjectParam as Subject)
      : undefined;
  const passed = passedParam === "true" ? true : passedParam === "false" ? false : undefined;

  const results = await prisma.result.findMany({
    where: {
      passed,
      attempt: {
        childId,
        assignment: {
          testId,
          groupId,
          test: subject ? { subject } : undefined,
        },
      },
    },
    include: {
      attempt: {
        select: {
          id: true,
          submittedAt: true,
          child: { select: { id: true, login: true, childProfile: true } },
          assignment: {
            select: {
              id: true,
              test: { select: { id: true, title: true, subject: true, version: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    results: results.map((result) => ({
      attemptId: result.attemptId,
      child: {
        id: result.attempt.child.id,
        login: result.attempt.child.login,
        displayName: result.attempt.child.childProfile?.displayName ?? result.attempt.child.login,
      },
      test: {
        ...result.attempt.assignment.test,
        subject: result.attempt.assignment.test.subject.toLowerCase(),
      },
      earnedPoints: result.earnedPoints,
      totalPoints: result.totalPoints,
      percentage: result.percentage,
      passed: result.passed,
      submittedAt: result.attempt.submittedAt,
    })),
  });
}
