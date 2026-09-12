/** Shared shapes and counting rules for everything a student sees.
 *
 * Home, Subjects, Tests and Progress must never disagree on a number, so the
 * definitions live here once:
 *
 * - *completed* — the child has at least one submitted attempt;
 * - *passed* — at least one submitted attempt reached the pass mark;
 * - *best result* — the highest percentage; *latest* — the most recent one.
 *
 * The two are independent: a completed test below the pass mark still counts
 * as work done, and a passed test can carry an unfinished retry. When it does,
 * `inProgressAttemptId` is set and the primary action stays "continue".
 *
 * The unit of a *unique test* is `stableId`, not `Test.id`: versions of one
 * test, and a personal plus a group assignment of it, count once. That matches
 * how attempts resume and how rewards are granted (see docs/REWARDS.md).
 */

export type StudentTestStatus = "not_started" | "in_progress" | "completed" | "passed";

/** An administrator's set of tests ("Fractions", "Week 1"); see docs/TEST-SETS.md. */
export type TestSetRef = { id: string; name: string };

export type StudentTest = {
  /** Newest assigned version of this test — the id every action posts to. */
  id: string;
  /** Identity across versions and assignments; the unit of every statistic. */
  stableId: string;
  title: string;
  subject: string;
  grade: string | null;
  passPercentage: number;
  questionCount: number;
  /** The set the administrator put this test in; lists group by it. */
  set: TestSetRef | null;
  /** Headline label. Actions read the booleans below, not this. */
  status: StudentTestStatus;
  completed: boolean;
  passed: boolean;
  attemptCount: number;
  /** Set while a first try or a retry is unfinished. */
  inProgressAttemptId: string | null;
  /** Answers saved in that unfinished attempt — "where you left off". */
  inProgressAnswered: number | null;
  bestPercentage: number;
  latestPercentage: number | null;
  latestSubmittedAt: string | null;
  /** Earliest assignment of this test — the tie-break for a stable order. */
  assignedAt: string;
};

export type StudentSubjectSummary = {
  subject: string;
  assigned: number;
  completed: number;
  passed: number;
  /** Share of assigned tests that are passed, as a whole percent. */
  progress: number;
};

export type StudentOverview = {
  stars: number;
  child: { id: string; displayName: string };
  /** Every subject assigned to the child, including ones without tests. */
  subjects: StudentSubjectSummary[];
  tests: StudentTest[];
};

export type TestFilter = "all" | "not_started" | "in_progress" | "completed";

export const testFilters: ReadonlyArray<{ value: TestFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

/** Filters overlap on purpose: an unfinished retry of a completed test is
 *  reachable both as "in progress" and as "completed". */
export function matchesFilter(test: StudentTest, filter: TestFilter) {
  switch (filter) {
    case "not_started":
      return !test.completed && test.inProgressAttemptId === null;
    case "in_progress":
      return test.inProgressAttemptId !== null;
    case "completed":
      return test.completed;
    default:
      return true;
  }
}

export function statusOf(test: { completed: boolean; passed: boolean; inProgressAttemptId: string | null }): StudentTestStatus {
  if (test.passed) return "passed";
  if (test.inProgressAttemptId) return "in_progress";
  return test.completed ? "completed" : "not_started";
}

/** Counts every assigned subject, so a subject without tests stays visible. */
export function summarizeSubjects(
  assignedSubjects: readonly string[],
  tests: readonly StudentTest[],
): StudentSubjectSummary[] {
  return assignedSubjects.map((subject) => {
    const own = tests.filter((test) => test.subject === subject);
    const passed = own.filter((test) => test.passed).length;

    return {
      subject,
      assigned: own.length,
      completed: own.filter((test) => test.completed).length,
      passed,
      progress: own.length ? Math.round((passed / own.length) * 100) : 0,
    };
  });
}

/** Unfinished first, then untouched, then everything worked on; oldest
 *  assignment first inside each group so the order never shuffles. */
export function byAttention(a: StudentTest, b: StudentTest) {
  const rank = (test: StudentTest) => (test.inProgressAttemptId ? 0 : test.completed ? 2 : 1);
  return rank(a) - rank(b)
    || a.assignedAt.localeCompare(b.assignedAt)
    || a.id.localeCompare(b.id);
}

/** Most recently assigned first: the order of "New tests" on Home. */
export function byNewestAssignment(a: StudentTest, b: StudentTest) {
  return b.assignedAt.localeCompare(a.assignedAt) || a.id.localeCompare(b.id);
}

export type TestGroup = { set: TestSetRef | null; tests: StudentTest[] };

/** Splits a list by set, keeping each test's place within its set. Sets sort
 *  by name with numbers compared naturally ("Week 2" before "Week 10"); tests
 *  outside any set come last. */
export function groupBySet(tests: readonly StudentTest[]): TestGroup[] {
  const groups = new Map<string, TestGroup>();

  for (const test of tests) {
    const key = test.set?.id ?? "";
    const group = groups.get(key) ?? { set: test.set, tests: [] };
    group.tests.push(test);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) =>
    a.set === null ? 1 : b.set === null ? -1 : a.set.name.localeCompare(b.set.name, undefined, { numeric: true }));
}
