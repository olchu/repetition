import { prisma } from "./prisma";
import type { ProgressTest, StudentHistory } from "./student-history";

export const HISTORY_PAGE_SIZE = 20;
type HistoryCursor = { submittedAt: string; id: string };

export function parseHistoryCursor(value: string): HistoryCursor | null {
  try {
    if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof cursor.id !== "string" || !cursor.id || cursor.id.length > 128
      || typeof cursor.submittedAt !== "string"
      || !Number.isFinite(Date.parse(cursor.submittedAt))) return null;
    return { id: cursor.id, submittedAt: new Date(cursor.submittedAt).toISOString() };
  } catch { return null; }
}

/** Reads scalar results only; questions and answers never enter list responses. */
export async function loadStudentHistory(childId: string, cursor: HistoryCursor | null): Promise<StudentHistory> {
  const [results, balance, page, activeAssignments] = await Promise.all([
    prisma.attempt.findMany({
      where: { childId, status: "SUBMITTED", result: { isNot: null } },
      select: {
        result: { select: { percentage: true, passed: true } },
        assignment: { select: { test: { select: { stableId: true, title: true, version: true, subject: { select: { slug: true } } } } } },
      },
    }),
    prisma.testReward.aggregate({ where: { childId, creditedAt: { not: null } }, _sum: { units: true } }),
    prisma.attempt.findMany({
      where: {
        childId, status: "SUBMITTED", result: { isNot: null }, submittedAt: { not: null },
        ...(cursor ? { OR: [
          { submittedAt: { lt: new Date(cursor.submittedAt) } },
          { submittedAt: new Date(cursor.submittedAt), id: { lt: cursor.id } },
        ] } : {}),
      },
      select: {
        id: true, submittedAt: true, result: true,
        reward: { select: { units: true, creditedAt: true } },
        assignment: { select: { test: { select: {
          stableId: true, title: true, version: true, status: true, subject: { select: { slug: true } },
        } } } },
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: HISTORY_PAGE_SIZE + 1,
    }),
    prisma.assignment.findMany({
      where: { status: "ACTIVE", test: { status: "PUBLISHED" }, OR: [
        { childId }, { group: { members: { some: { childId } } } },
      ] },
      select: { test: { select: { stableId: true } } },
    }),
  ]);

  const unique = new Map<string, ProgressTest & { version: number }>();
  for (const attempt of results) {
    const test = attempt.assignment.test;
    const previous = unique.get(test.stableId);
    unique.set(test.stableId, {
      stableId: test.stableId,
      title: !previous || test.version > previous.version ? test.title : previous.title,
      subject: !previous || test.version > previous.version ? test.subject.slug : previous.subject,
      version: Math.max(previous?.version ?? 0, test.version),
      bestPercentage: Math.max(previous?.bestPercentage ?? 0, attempt.result!.percentage),
      passed: Boolean(previous?.passed || attempt.result!.passed),
    });
  }
  const tests = [...unique.values()].sort((a, b) => a.title.localeCompare(b.title) || a.stableId.localeCompare(b.stableId));
  const subjects = [...new Set(tests.map((test) => test.subject))].sort().map((subject) => {
    const own = tests.filter((test) => test.subject === subject);
    return { subject, completed: own.length, passed: own.filter((test) => test.passed).length,
      tests: own.map((test) => ({ stableId: test.stableId, title: test.title, subject: test.subject,
        bestPercentage: test.bestPercentage, passed: test.passed })) };
  });
  const active = new Set(activeAssignments.map((item) => item.test.stableId));
  const shown = page.slice(0, HISTORY_PAGE_SIZE);

  // A missing reward on the first historical attempt means the test predates
  // rewards. Subsequent attempts are training, including repeats of old tests.
  const starts = await prisma.attempt.findMany({
    where: { childId, assignment: { test: { stableId: { in: shown.map((item) => item.assignment.test.stableId) } } } },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: { id: true, assignment: { select: { test: { select: { stableId: true } } } } },
  });
  const firstByTest = new Map<string, string>();
  for (const attempt of starts) {
    if (!firstByTest.has(attempt.assignment.test.stableId)) firstByTest.set(attempt.assignment.test.stableId, attempt.id);
  }
  const firstIds = new Set(firstByTest.values());
  const last = shown.at(-1);
  return {
    summary: { completed: tests.length, passed: tests.filter((test) => test.passed).length,
      stars: (balance._sum.units ?? 0) / 2, subjects },
    attempts: shown.map((attempt) => ({
      id: attempt.id, title: attempt.assignment.test.title, subject: attempt.assignment.test.subject.slug,
      version: attempt.assignment.test.version, submittedAt: attempt.submittedAt!.toISOString(),
      earnedPoints: attempt.result!.earnedPoints, totalPoints: attempt.result!.totalPoints,
      percentage: attempt.result!.percentage, passed: attempt.result!.passed,
      archived: attempt.assignment.test.status === "ARCHIVED",
      unassigned: !active.has(attempt.assignment.test.stableId),
      reward: { kind: attempt.reward ? "earned" : firstIds.has(attempt.id) ? "legacy" : "training",
        stars: attempt.reward?.creditedAt ? attempt.reward.units / 2 : 0 },
    })),
    nextCursor: page.length > HISTORY_PAGE_SIZE && last
      ? Buffer.from(JSON.stringify({ submittedAt: last.submittedAt!.toISOString(), id: last.id })).toString("base64url") : null,
  };
}
