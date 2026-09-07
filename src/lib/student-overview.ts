import { prisma } from "./prisma";
import {
  byAttention,
  statusOf,
  summarizeSubjects,
  type StudentOverview,
  type StudentTest,
} from "./student-progress";

type OverviewChild = {
  id: string;
  displayName: string;
  /** Subjects assigned to the child, independent of any test assignment. */
  subjects: readonly string[];
};

/** Everything the learning room shows about one child, counted once.
 *
 * Assignments are collapsed by `Test.stableId`, so a personal and a group
 * assignment of the same test — or two versions of it — stay one row with one
 * merged attempt history. The newest assigned version supplies the title and
 * the id actions post to. Only the child's own attempts are ever read. */
export async function loadStudentOverview(child: OverviewChild): Promise<StudentOverview> {
  const assignments = await prisma.assignment.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { childId: child.id },
        { group: { members: { some: { childId: child.id } } } },
      ],
      test: { status: "PUBLISHED" },
    },
    include: {
      test: {
        select: {
          id: true,
          stableId: true,
          version: true,
          title: true,
          subject: true,
          grade: true,
          passPercentage: true,
          questionCount: true,
        },
      },
      attempts: {
        where: { childId: child.id },
        include: { result: true },
        orderBy: { startedAt: "desc" },
      },
    },
  });

  type Group = {
    test: (typeof assignments)[number]["test"];
    assignedAt: Date;
    attempts: (typeof assignments)[number]["attempts"];
  };
  const groups = new Map<string, Group>();

  for (const assignment of assignments) {
    const group = groups.get(assignment.test.stableId);

    if (!group) {
      groups.set(assignment.test.stableId, {
        test: assignment.test,
        assignedAt: assignment.createdAt,
        attempts: [...assignment.attempts],
      });
      continue;
    }

    if (assignment.test.version > group.test.version) {
      group.test = assignment.test;
    }
    if (assignment.createdAt < group.assignedAt) {
      group.assignedAt = assignment.createdAt;
    }
    group.attempts.push(...assignment.attempts);
  }

  const tests: StudentTest[] = [...groups.values()].map((group) => {
    const attempts = [...group.attempts].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const submitted = attempts.filter((attempt) => attempt.result !== null);
    const latest = submitted[0] ?? null;
    const facts = {
      completed: submitted.length > 0,
      passed: submitted.some((attempt) => attempt.result?.passed === true),
      inProgressAttemptId: attempts.find((attempt) => attempt.status === "IN_PROGRESS")?.id ?? null,
    };

    return {
      id: group.test.id,
      stableId: group.test.stableId,
      title: group.test.title,
      subject: group.test.subject.toLowerCase(),
      grade: group.test.grade,
      passPercentage: group.test.passPercentage,
      questionCount: group.test.questionCount,
      status: statusOf(facts),
      ...facts,
      attemptCount: attempts.length,
      bestPercentage: submitted.reduce((best, attempt) => Math.max(best, attempt.result?.percentage ?? 0), 0),
      latestPercentage: latest?.result?.percentage ?? null,
      latestSubmittedAt: latest?.submittedAt?.toISOString() ?? null,
      assignedAt: group.assignedAt.toISOString(),
    };
  });

  tests.sort(byAttention);

  // Rewards outlive their assignment, so the balance is read on its own.
  const rewards = await prisma.testReward.aggregate({
    where: { childId: child.id, creditedAt: { not: null } },
    _sum: { units: true },
  });

  return {
    stars: (rewards._sum.units ?? 0) / 2,
    child: { id: child.id, displayName: child.displayName },
    subjects: summarizeSubjects(child.subjects, tests),
    tests,
  };
}
