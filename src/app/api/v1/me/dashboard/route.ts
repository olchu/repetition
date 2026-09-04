import { NextResponse } from "next/server";
import { Subject } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const subjectOrder: Subject[] = ["SCIENCE", "GEOGRAPHY", "HISTORY", "MATHEMATICS"];

type DashboardTest = {
  id: string;
  title: string;
  subject: string;
  grade: string | null;
  passPercentage: number;
  attempts: Array<{
    status: string;
    startedAt: Date;
    submittedAt: Date | null;
    result: { percentage: number; passed: boolean } | null;
  }>;
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "CHILD") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Child access required." } },
      { status: user ? 403 : 401 },
    );
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { childId: user.id },
        { group: { members: { some: { childId: user.id } } } },
      ],
      test: { status: "PUBLISHED" },
    },
    include: {
      test: {
        select: {
          id: true,
          title: true,
          subject: true,
          grade: true,
          passPercentage: true,
        },
      },
      attempts: {
        where: { childId: user.id },
        include: { result: true },
        orderBy: { startedAt: "desc" },
      },
    },
  });

  const testsById = new Map<string, DashboardTest>();

  for (const assignment of assignments) {
    const existing = testsById.get(assignment.test.id);
    const test = existing ?? {
      ...assignment.test,
      attempts: [],
    };
    test.attempts.push(...assignment.attempts);
    testsById.set(assignment.test.id, test);
  }

  const tests = [...testsById.values()].map((test) => {
    const submitted = test.attempts.filter((attempt) => attempt.result !== null);
    const latest = submitted[0] ?? null;
    const bestPercentage = submitted.reduce(
      (best, attempt) => Math.max(best, attempt.result?.percentage ?? 0),
      0,
    );
    const status = submitted.some((attempt) => attempt.result?.passed)
      ? "passed"
      : test.attempts.some((attempt) => attempt.status === "IN_PROGRESS")
        ? "in_progress"
        : submitted.length > 0
          ? "completed"
          : "not_started";

    return {
      id: test.id,
      title: test.title,
      subject: test.subject.toLowerCase(),
      grade: test.grade,
      passPercentage: test.passPercentage,
      status,
      attemptCount: test.attempts.length,
      bestPercentage,
      latestPercentage: latest?.result?.percentage ?? null,
      latestSubmittedAt: latest?.submittedAt ?? null,
    };
  });

  const summaries: Record<Subject, { assigned: number; passed: number }> = {
    SCIENCE: { assigned: 0, passed: 0 },
    GEOGRAPHY: { assigned: 0, passed: 0 },
    HISTORY: { assigned: 0, passed: 0 },
    MATHEMATICS: { assigned: 0, passed: 0 },
  };

  for (const test of tests) {
    const subject = test.subject.toUpperCase() as Subject;
    summaries[subject].assigned += 1;
    if (test.status === "passed") {
      summaries[subject].passed += 1;
    }
  }

  return NextResponse.json({
    child: { id: user.id, displayName: user.childProfile?.displayName ?? user.login },
    subjects: subjectOrder.map((subject) => ({
      subject: subject.toLowerCase(),
      assigned: summaries[subject].assigned,
      passed: summaries[subject].passed,
      progress: summaries[subject].assigned
        ? Math.round((summaries[subject].passed / summaries[subject].assigned) * 100)
        : 0,
    })),
    tests,
  });
}
