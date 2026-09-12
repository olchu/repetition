"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSubjects } from "@/components/SubjectsProvider";
import { getApiError } from "@/lib/api-error";
import admin from "@/app/admin/page.module.css";
import styles from "./AssignmentPlanner.module.css";

type Child = { id: string; login: string; displayName: string | null; grade: string | null; status: string; subjects: string[] };
type Group = { id: string; name: string; status: string; memberCount: number };
type PublishedTest = { id: string; stableId: string; title: string; subject: string; grade: string | null; version: number; questionCount: number; passPercentage: number };
type AssignmentSource = { id: string; testId: string; version: number; groupId: string | null; groupName: string | null; assignedAt: string };
type TestStatus = "not_started" | "in_progress" | "completed" | "passed";
/** A row of `GET /api/v1/admin/assignments`: the test as the child sees it, plus the assignments behind it. */
type PlannedTest = {
  id: string;
  stableId: string;
  version: number;
  title: string;
  subject: string;
  questionCount: number;
  passPercentage: number;
  status: TestStatus;
  attemptCount: number;
  inProgressAttemptId: string | null;
  inProgressAnswered: number | null;
  bestPercentage: number;
  latestSubmittedAt: string | null;
  assignedAt: string;
  assignments: AssignmentSource[];
};
type Notice = { tone: "success" | "error"; text: string } | null;

const statusLabels: Record<TestStatus, string> = { not_started: "Not started", in_progress: "In progress", completed: "Completed", passed: "Passed" };
const statusClasses: Record<TestStatus, string> = { not_started: styles.statusNotStarted, in_progress: styles.statusInProgress, completed: styles.statusCompleted, passed: styles.statusPassed };
const jsonHeaders = { "Content-Type": "application/json" };

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** One line under the status: where the child is with this test. */
function progressLine(test: PlannedTest) {
  const parts: string[] = [];
  if (test.inProgressAttemptId) parts.push(`${test.inProgressAnswered ?? 0} of ${test.questionCount} answered now`);
  if (test.attemptCount > 0 && test.status !== "in_progress") parts.push(`best ${test.bestPercentage}% (pass ${test.passPercentage}%)`);
  if (test.attemptCount > 0) parts.push(plural(test.attemptCount, "attempt"));
  if (test.latestSubmittedAt) parts.push(`last on ${new Date(test.latestSubmittedAt).toLocaleDateString()}`);
  return parts.length > 0 ? parts.join(" · ") : "Not opened yet";
}

function childSummary(tests: readonly PlannedTest[]) {
  if (tests.length === 0) return "No tests yet";
  const inProgress = tests.filter((test) => test.inProgressAttemptId).length;
  const passed = tests.filter((test) => test.status === "passed").length;
  return [plural(tests.length, "test"), inProgress && `${inProgress} in progress`, passed && `${passed} passed`].filter(Boolean).join(" · ");
}

/** Personal assignments and group assignments of one row, grouped for their buttons. */
function sourcesOf(test: PlannedTest) {
  const personal = test.assignments.filter((source) => source.groupId === null).map((source) => source.id);
  const groups = new Map<string, { name: string; ids: string[] }>();
  for (const source of test.assignments) {
    if (source.groupId === null) continue;
    const entry = groups.get(source.groupId) ?? { name: source.groupName ?? "group", ids: [] };
    entry.ids.push(source.id);
    groups.set(source.groupId, entry);
  }
  return { personal, groups: [...groups.entries()].map(([id, entry]) => ({ id, ...entry })) };
}

export function AssignmentPlanner({ childAccounts, groups, onRefresh }: { childAccounts: Child[]; groups: Group[]; onRefresh: () => Promise<void> }) {
  const { subjectLabels } = useSubjects();
  const children = childAccounts.filter((child) => child.status === "active");
  const activeGroups = groups.filter((group) => group.status === "active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, PlannedTest[]> | null>(null);
  const [publishedTests, setPublishedTests] = useState<PublishedTest[] | null>(null);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groupTestId, setGroupTestId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const subjectName = (slug: string) => subjectLabels[slug] ?? slug;

  const loadPlans = useCallback(async () => {
    const response = await fetch("/api/v1/admin/assignments", { cache: "no-store" });
    if (!response.ok) throw new Error(await getApiError(response, "Unable to load assignments."));
    const payload = (await response.json()) as { plans: Array<{ childId: string; tests: PlannedTest[] }> };
    setPlans(Object.fromEntries(payload.plans.map((plan) => [plan.childId, plan.tests])));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const [, testsResponse] = await Promise.all([loadPlans(), fetch("/api/v1/admin/tests?status=published&all=true", { cache: "no-store" })]);
        if (!testsResponse.ok) throw new Error(await getApiError(testsResponse, "Unable to load published tests."));
        const payload = (await testsResponse.json()) as { tests: PublishedTest[] };
        if (!cancelled) setPublishedTests(payload.tests);
      } catch (error) {
        if (!cancelled) setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load assignments." });
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadPlans]);

  /** Only the newest published version of each test is offered. */
  const latestTests = useMemo(() => {
    const newest = new Map<string, PublishedTest>();
    for (const test of publishedTests ?? []) {
      const current = newest.get(test.stableId);
      if (!current || test.version > current.version) newest.set(test.stableId, test);
    }
    return [...newest.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [publishedTests]);

  const child = children.find((item) => item.id === selectedId) ?? children[0] ?? null;
  const childName = child ? child.displayName ?? child.login : "";
  const plan = child && plans ? plans[child.id] ?? [] : [];
  const assignedByStableId = new Map(plan.map((test) => [test.stableId, test]));
  // Personal assignments require the child's grade; other grades go through groups.
  const gradeTests = child ? latestTests.filter((test) => test.grade === child.grade) : [];
  const subjectOptions = [...new Set(gradeTests.map((test) => test.subject))].sort((a, b) => subjectName(a).localeCompare(subjectName(b)));
  const query = search.trim().toLowerCase();
  const catalog = gradeTests
    .filter((test) => (!subject || test.subject === subject) && (!query || test.title.toLowerCase().includes(query)))
    .sort((a, b) => subjectName(a.subject).localeCompare(subjectName(b.subject)) || a.title.localeCompare(b.title));

  async function run(key: string, action: () => Promise<Response>, success: (response: Response) => Promise<string>, fallback: string) {
    setBusy(key);
    setNotice(null);
    try {
      const response = await action();
      if (!response.ok) {
        setNotice({ tone: "error", text: await getApiError(response, fallback) });
        return;
      }
      const text = await success(response);
      await Promise.all([loadPlans(), onRefresh()]);
      setNotice({ tone: "success", text });
    } catch {
      setNotice({ tone: "error", text: fallback });
    } finally {
      setBusy(null);
    }
  }

  /** Cancels every assignment in `ids`, stopping at the first failure. */
  async function cancelAll(ids: string[]) {
    for (const id of ids) {
      const response = await fetch(`/api/v1/admin/assignments/${id}`, { method: "DELETE" });
      if (!response.ok) return response;
    }
    return new Response(null, { status: 204 });
  }

  function assignToChild(test: PublishedTest) {
    if (!child) return;
    void run(
      `assign-${test.id}`,
      () => fetch("/api/v1/admin/assignments", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ testId: test.id, childIds: [child.id] }) }),
      async () => `“${test.title}” (v${test.version}) assigned to ${childName}.`,
      "Unable to assign the test.",
    );
  }

  function unassignPersonal(test: PlannedTest, ids: string[], groupNames: string[]) {
    void run(
      `unassign-${test.stableId}`,
      () => cancelAll(ids),
      async () => `“${test.title}” removed from ${childName}’s tests; attempts are kept.${groupNames.length > 0 ? ` It stays assigned through ${groupNames.join(", ")}.` : ""}`,
      "Unable to remove the test.",
    );
  }

  function removeFromGroup(test: PlannedTest, group: { id: string; name: string; ids: string[] }) {
    if (!window.confirm(`Remove “${test.title}” from group “${group.name}”? Every member of the group loses it.`)) return;
    void run(`group-${group.id}-${test.stableId}`, () => cancelAll(group.ids), async () => `“${test.title}” removed from group “${group.name}”.`, "Unable to remove the group assignment.");
  }

  function assignToGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const group = activeGroups.find((item) => item.id === groupId);
    const test = latestTests.find((item) => item.id === groupTestId);
    if (!group || !test) {
      setNotice({ tone: "error", text: "Choose a group and a published test." });
      return;
    }
    void run(
      "group-form",
      () => fetch("/api/v1/admin/assignments", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ testId: test.id, groupId: group.id }) }),
      async (response) => {
        const payload = (await response.json()) as { skipped?: number };
        setGroupTestId("");
        return payload.skipped ? `Group “${group.name}” already has “${test.title}”.` : `“${test.title}” assigned to group “${group.name}”.`;
      },
      "Unable to assign the test to the group.",
    );
  }

  function selectChild(id: string) {
    setSelectedId(id);
    setSearch("");
    setSubject("");
    setNotice(null);
  }

  const subjectWarning = (slug: string) =>
    child && !child.subjects.includes(slug) ? <em className={styles.warning}>{subjectName(slug)} isn’t in {childName}’s subjects — add it in Children so it shows on the dashboard</em> : null;

  return (
    <section className={admin.controlSection} aria-labelledby="assignments-heading">
      <div className={admin.controlHeader}>
        <div><p className={admin.eyebrow}>Learning plan</p><h1 id="assignments-heading">Assignments</h1></div>
        <span>Pick a child to see their tests and add new ones</span>
      </div>

      {notice && <p className={`${admin.notice} ${notice.tone === "error" ? admin.noticeError : ""}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}

      {children.length === 0 ? (
        <p className={`${admin.empty} ${styles.spaced}`}>No active child accounts yet. Create one in Children.</p>
      ) : (
        <div className={styles.layout}>
          <nav className={styles.childList} aria-label="Children">
            {children.map((item) => (
              <button className={`${styles.childItem} ${item.id === child?.id ? styles.childItemActive : ""}`} key={item.id} type="button" aria-pressed={item.id === child?.id} onClick={() => selectChild(item.id)}>
                <strong>{item.displayName ?? item.login}</strong>
                <span>Grade {item.grade ?? "—"}</span>
                <span>{plans ? childSummary(plans[item.id] ?? []) : "Loading…"}</span>
              </button>
            ))}
          </nav>

          {child && (
            <div className={styles.planPanel}>
              <header className={styles.planHeader}>
                <div>
                  <p className={admin.meta}>Grade {child.grade ?? "—"} · {child.subjects.length > 0 ? child.subjects.map(subjectName).join(", ") : "no subjects yet"}</p>
                  <h2>{childName}</h2>
                </div>
                <dl className={styles.planStats}>
                  <div><dt>Assigned</dt><dd>{plan.length}</dd></div>
                  <div><dt>Not started</dt><dd>{plan.filter((test) => test.status === "not_started").length}</dd></div>
                  <div><dt>In progress</dt><dd>{plan.filter((test) => test.inProgressAttemptId).length}</dd></div>
                  <div><dt>Completed</dt><dd>{plan.filter((test) => test.attemptCount > 0 && test.status !== "in_progress").length}</dd></div>
                  <div><dt>Passed</dt><dd>{plan.filter((test) => test.status === "passed").length}</dd></div>
                </dl>
              </header>

              <section aria-labelledby="assigned-heading">
                <h3 className={styles.blockTitle} id="assigned-heading">Assigned tests</h3>
                {plans === null ? (
                  <p className={admin.empty}>Loading assignments…</p>
                ) : plan.length === 0 ? (
                  <p className={admin.empty}>Nothing assigned yet. Add tests below.</p>
                ) : (
                  <ul className={styles.rows}>
                    {plan.map((test) => {
                      const sources = sourcesOf(test);
                      return (
                        <li className={styles.planRow} key={test.stableId}>
                          <div className={styles.testInfo}>
                            <strong>{test.title}</strong>
                            <span>{subjectName(test.subject)} · v{test.version} · {plural(test.questionCount, "question")} · assigned {new Date(test.assignedAt).toLocaleDateString()}</span>
                            {subjectWarning(test.subject)}
                          </div>
                          <div className={styles.progress}>
                            <span className={`${styles.status} ${statusClasses[test.status]}`}>{statusLabels[test.status]}</span>
                            <span>{progressLine(test)}</span>
                          </div>
                          <div className={styles.sources}>
                            {sources.personal.length > 0 && (
                              <span>
                                Personal
                                <button className={admin.textButton} type="button" disabled={busy !== null} onClick={() => unassignPersonal(test, sources.personal, sources.groups.map((group) => `“${group.name}”`))}>
                                  {busy === `unassign-${test.stableId}` ? "Removing…" : "Unassign"}
                                </button>
                              </span>
                            )}
                            {sources.groups.map((group) => (
                              <span key={group.id}>
                                Group “{group.name}”
                                <button className={admin.textButton} type="button" disabled={busy !== null} onClick={() => removeFromGroup(test, group)}>
                                  {busy === `group-${group.id}-${test.stableId}` ? "Removing…" : "Remove"}
                                </button>
                              </span>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section aria-labelledby="catalog-heading">
                <div className={styles.catalogHeader}>
                  <h3 className={styles.blockTitle} id="catalog-heading">Add tests</h3>
                  <span className={admin.meta}>
                    {plural(gradeTests.length, "published test")} for grade {child.grade ?? "—"}
                    {latestTests.length > gradeTests.length && ` · other grades can be assigned through a group`}
                  </span>
                </div>
                <div className={styles.catalogFilters}>
                  <label>Search<input type="search" value={search} placeholder="Test title" onChange={(event) => setSearch(event.target.value)} /></label>
                  <label>Subject<select value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">All subjects</option>{subjectOptions.map((slug) => <option key={slug} value={slug}>{subjectName(slug)}</option>)}</select></label>
                </div>
                {publishedTests === null ? (
                  <p className={admin.empty}>Loading published tests…</p>
                ) : catalog.length === 0 ? (
                  <p className={admin.empty}>{gradeTests.length === 0 ? `No published tests for grade ${child.grade ?? "—"} yet.` : "No tests match these filters."}</p>
                ) : (
                  <ul className={styles.rows}>
                    {catalog.map((test) => {
                      const assigned = assignedByStableId.get(test.stableId);
                      return (
                        <li className={styles.catalogRow} key={test.id}>
                          <div className={styles.testInfo}>
                            <strong>{test.title}</strong>
                            <span>{subjectName(test.subject)} · v{test.version} · {plural(test.questionCount, "question")} · pass {test.passPercentage}%</span>
                            {!assigned && subjectWarning(test.subject)}
                          </div>
                          {!assigned ? (
                            <button className={styles.assignButton} type="button" disabled={busy !== null} onClick={() => assignToChild(test)}>
                              {busy === `assign-${test.id}` ? "Assigning…" : "Assign"}
                            </button>
                          ) : assigned.version < test.version ? (
                            <span className={styles.update}>
                              Has v{assigned.version}
                              <button className={admin.textButton} type="button" disabled={busy !== null} onClick={() => assignToChild(test)}>
                                {busy === `assign-${test.id}` ? "Assigning…" : `Assign v${test.version}`}
                              </button>
                            </span>
                          ) : (
                            <span className={styles.assigned}>✓ Assigned</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      <form className={styles.groupForm} onSubmit={assignToGroup}>
        <h2>Assign to a group</h2>
        <p>Groups may mix grades, so any published test can go to a group. Every member sees it.</p>
        <label>Group<select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">Choose a group</option>{activeGroups.map((group) => <option key={group.id} value={group.id}>{group.name} · {plural(group.memberCount, "child")}</option>)}</select></label>
        <label>Published test<select value={groupTestId} onChange={(event) => setGroupTestId(event.target.value)} disabled={publishedTests === null}><option value="">{publishedTests === null ? "Loading tests…" : "Choose a test"}</option>{latestTests.map((test) => <option key={test.id} value={test.id}>{test.title} · Grade {test.grade ?? "—"} · {subjectName(test.subject)}</option>)}</select></label>
        <button className={admin.action} type="submit" disabled={busy !== null}>{busy === "group-form" ? "Assigning…" : "Assign"}<span aria-hidden="true">↗</span></button>
      </form>
    </section>
  );
}
