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

/** One active assignment behind an assigned test; personal when `groupId` is null. */
export type AssignmentSource = {
  id: string;
  testId: string;
  version: number;
  groupId: string | null;
  groupName: string | null;
  assignedAt: string;
};

type AssignedTest = { test: StudentTest; version: number; assignments: AssignmentSource[] };

/** Every published test assigned to one child, counted once.
 *
 * Assignments are collapsed by `Test.stableId`, so a personal and a group
 * assignment of the same test — or two versions of it — stay one row with one
 * merged attempt history. The newest assigned version supplies the title and
 * the id actions post to. Only the child's own attempts are ever read. */
async function collectAssignedTests(childId: string): Promise<AssignedTest[]> {
  const assignments = await prisma.assignment.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { childId },
        { group: { members: { some: { childId } } } },
      ],
      test: { status: "PUBLISHED" },
    },
    include: {
      group: { select: { id: true, name: true } },
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
        where: { childId },
        include: { result: true, _count: { select: { answers: true } } },
        orderBy: { startedAt: "desc" },
      },
    },
  });

  type Collected = {
    test: (typeof assignments)[number]["test"];
    assignedAt: Date;
    attempts: (typeof assignments)[number]["attempts"];
    assignments: AssignmentSource[];
  };
  const collected = new Map<string, Collected>();

  for (const assignment of assignments) {
    const source: AssignmentSource = {
      id: assignment.id,
      testId: assignment.test.id,
      version: assignment.test.version,
      groupId: assignment.group?.id ?? null,
      groupName: assignment.group?.name ?? null,
      assignedAt: assignment.createdAt.toISOString(),
    };
    const entry = collected.get(assignment.test.stableId);

    if (!entry) {
      collected.set(assignment.test.stableId, {
        test: assignment.test,
        assignedAt: assignment.createdAt,
        attempts: [...assignment.attempts],
        assignments: [source],
      });
      continue;
    }

    if (assignment.test.version > entry.test.version) {
      entry.test = assignment.test;
    }
    if (assignment.createdAt < entry.assignedAt) {
      entry.assignedAt = assignment.createdAt;
    }
    entry.attempts.push(...assignment.attempts);
    entry.assignments.push(source);
  }

  const setItems = await prisma.testSetItem.findMany({
    where: { stableId: { in: [...collected.keys()] } },
    select: { stableId: true, set: { select: { id: true, name: true } } },
  });
  const setByStableId = new Map(setItems.map((item) => [item.stableId, item.set]));

  const rows = [...collected.values()].map((entry): AssignedTest => {
    const attempts = [...entry.attempts].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const submitted = attempts.filter((attempt) => attempt.result !== null);
    const latest = submitted[0] ?? null;
    const unfinished = attempts.find((attempt) => attempt.status === "IN_PROGRESS") ?? null;
    const facts = {
      completed: submitted.length > 0,
      passed: submitted.some((attempt) => attempt.result?.passed === true),
      inProgressAttemptId: unfinished?.id ?? null,
      inProgressAnswered: unfinished?._count.answers ?? null,
    };

    return {
      test: {
        id: entry.test.id,
        stableId: entry.test.stableId,
        title: entry.test.title,
        subject: entry.test.subject.slug,
        grade: entry.test.grade,
        passPercentage: entry.test.passPercentage,
        questionCount: entry.test.questionCount,
        set: setByStableId.get(entry.test.stableId) ?? null,
        status: statusOf(facts),
        ...facts,
        attemptCount: attempts.length,
        bestPercentage: submitted.reduce((best, attempt) => Math.max(best, attempt.result?.percentage ?? 0), 0),
        latestPercentage: latest?.result?.percentage ?? null,
        latestSubmittedAt: latest?.submittedAt?.toISOString() ?? null,
        assignedAt: entry.assignedAt.toISOString(),
      },
      version: entry.test.version,
      assignments: entry.assignments,
    };
  });

  return rows.sort((a, b) => byAttention(a.test, b.test));
}

/** Everything the learning room shows about one child. */
export async function loadStudentOverview(child: OverviewChild): Promise<StudentOverview> {
  const tests = (await collectAssignedTests(child.id)).map((row) => row.test);

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

/** The same rows the child sees, for the administrator: plus the newest
 *  assigned version and the assignments behind each row, so they can be cancelled. */
export async function loadAssignedTests(childId: string) {
  return (await collectAssignedTests(childId)).map(({ test, version, assignments }) => ({ ...test, version, assignments }));
}
