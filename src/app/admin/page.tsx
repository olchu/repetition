"use client";

import Link from "next/link";
import { subjectLabels, subjectIds } from "@/lib/subjects";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { SignOutButton } from "@/components/SignOutButton";
import styles from "./page.module.css";

type Child = { id: string; login: string; displayName: string | null; grade: string | null; status: string; subjects: string[] };
type Test = { id: string; title: string; subject: string; grade: string | null; status: string; version: number; stableId: string; createdAt: string; questionCount: number; assignmentCount: number; passPercentage: number };
type Result = { attemptId: string; child: { id: string; displayName: string }; test: { id: string; title: string; subject: string; version: number }; percentage: number; passed: boolean; submittedAt: string | null };
type Group = { id: string; name: string; status: string; memberCount: number; activeAssignmentCount: number };
type AdminData = { children: Child[]; tests: Test[]; publishedTestCount: number; results: Result[]; groups: Group[] };
type TestPagination = { page: number; pageSize: number; totalItems: number; totalPages: number };
type TestListPayload = { tests: Test[]; pagination: TestPagination; filters: { grades: string[] }; summary: { publishedItems: number } };
type AttemptOption = { id: string; text: string; isChosen: boolean; isCorrect: boolean };
type AttemptQuestion = {
  id: string;
  text: string;
  points: number;
  earnedPoints: number;
  answered: boolean;
  isCorrect: boolean;
  explanation: string | null;
  options: AttemptOption[];
};
type AttemptDetail = {
  id: string;
  status: string;
  submittedAt: string | null;
  child: { displayName: string };
  test: { title: string; subject: string; version: number; passPercentage: number };
  result: { earnedPoints: number; totalPoints: number; percentage: number; passed: boolean } | null;
  questions: AttemptQuestion[];
};
type View = "overview" | "children" | "groups" | "tests" | "assignments" | "results";
type Notice = { tone: "success" | "error"; text: string } | null;



async function getApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string; details?: Array<{ path?: string; message?: string }> };
  } | null;
  const details = payload?.error?.details?.map((detail) => `${detail.path ?? "$"}: ${detail.message ?? "Invalid value."}`).join(" ");
  return details ? `${payload?.error?.message ?? fallback} ${details}` : payload?.error?.message ?? fallback;
}

function AdminNavigation({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <nav className={styles.nav} aria-label="Admin navigation">
      {(["overview", "children", "groups", "tests", "assignments", "results"] as View[]).map((item) => (
        <button className={`${styles.navButton} ${view === item ? styles.navActive : ""}`} key={item} type="button" onClick={() => onChange(item)}>
          {item === "overview" ? "Overview" : item === "children" ? "Children" : item === "groups" ? "Groups" : item === "tests" ? "Tests" : item === "assignments" ? "Assignments" : "Results"}
        </button>
      ))}
      <SignOutButton className={styles.navLink} />
    </nav>
  );
}

function ChildSubjects({ child, onRefresh }: { child: Child; onRefresh: () => Promise<void> }) {
  const [selected, setSelected] = useState(child.subjects);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/children/${child.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjects: selected }),
      });
      if (!response.ok) throw new Error(await getApiError(response, "Unable to save subjects."));
      await onRefresh();
      setMessage("Subjects saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save subjects.");
    } finally { setSaving(false); }
  }
  return <details className={styles.subjectEditor}><summary>Subjects ({child.subjects.length})</summary>
    <form onSubmit={save}><fieldset disabled={saving}><legend>Subjects for {child.displayName ?? child.login}</legend>
      <div className={styles.childChoices}>{subjectIds.map((id) => <label key={id}>
        <input type="checkbox" checked={selected.includes(id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, id] : current.filter((item) => item !== id))} />
        {subjectLabels[id]}
      </label>)}</div></fieldset><button className={styles.textButton} disabled={saving} type="submit">{saving ? "Saving…" : "Save subjects"}</button>
      {message && <p role="status">{message}</p>}
    </form>
  </details>;
}

function ChildrenManager({ childAccounts, onRefresh }: { childAccounts: Child[]; onRefresh: () => Promise<void> }) { const [form, setForm] = useState({ displayName: "", login: "", grade: "", password: "" });
const [notice, setNotice] = useState<Notice>(null);
const [isSaving, setIsSaving] = useState(false);

async function createChild(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setIsSaving(true);
  setNotice(null);
  const response = await fetch("/api/v1/admin/children", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
  if (!response.ok) {
    setNotice({ tone: "error", text: await getApiError(response, "Unable to create child.") });
    setIsSaving(false);
    return;
  }
  setForm({ displayName: "", login: "", grade: "", password: "" });
  setNotice({ tone: "success", text: "Child account created." });
  setIsSaving(false);
  await onRefresh();
}

async function toggleStatus(child: Child) {
  const nextStatus = child.status === "active" ? "blocked" : "active";
  const response = await fetch(`/api/v1/admin/children/${child.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
  setNotice(response.ok ? { tone: "success", text: `${child.displayName ?? child.login} is now ${nextStatus}.` } : { tone: "error", text: await getApiError(response, "Unable to update account.") });
  if (response.ok) await onRefresh();
}

return (
  <section className={styles.controlSection} aria-labelledby="children-heading">
    <div className={styles.controlHeader}><div><p className={styles.eyebrow}>Account management</p><h1 id="children-heading">Children</h1></div><span>{childAccounts.length} accounts</span></div>
    <form className={styles.createForm} onSubmit={createChild}>
      <h2>Create a child account</h2>
      <div className={styles.formGrid}>
        <label>Display name<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required /></label>
        <label>Username<input value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} required /></label>
        <label>Grade<input value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} placeholder="e.g. 5" required /></label>
        <label>Permanent password<input type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>
      </div>
      <button className={styles.action} type="submit" disabled={isSaving}>{isSaving ? "Creating…" : "Create account"}<span aria-hidden="true">↗</span></button>
    </form>
    {notice && <p className={`${styles.notice} ${notice.tone === "error" ? styles.noticeError : ""}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
    <div className={styles.controlList}>
      <div className={styles.controlListHeader}><span>Name</span><span>Grade</span><span>Status</span><span>Action</span></div>
      {childAccounts.length === 0 ? <p className={styles.empty}>No child accounts yet.</p> : childAccounts.map((child) => <div className={styles.controlRow} key={child.id}><div><strong>{child.displayName ?? child.login}</strong><span>{child.login}</span><ChildSubjects child={child} onRefresh={onRefresh} /></div><span>{child.grade ?? "—"}</span><span className={`${styles.pill} ${child.status === "active" ? styles.pillGood : ""}`}>{child.status}</span><button className={styles.textButton} type="button" onClick={() => void toggleStatus(child)}>{child.status === "active" ? "Block" : "Restore"}</button></div>)}
    </div>
  </section>
); }

function GroupsManager({ childAccounts, groups, onRefresh }: { childAccounts: Child[]; groups: Group[]; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [selectedChildren, setSelectedChildren] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<Notice>(null);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const childIds = Object.entries(selectedChildren).filter(([, selected]) => selected).map(([id]) => id);
    if (!name.trim() || childIds.length === 0) {
      setNotice({ tone: "error", text: "A group name and at least one child are required." });
      return;
    }
    const response = await fetch("/api/v1/admin/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, childIds }) });
    setNotice(response.ok ? { tone: "success", text: "Group created." } : { tone: "error", text: await getApiError(response, "Unable to create group.") });
    if (response.ok) {
      setName("");
      setSelectedChildren({});
      await onRefresh();
    }
  }

  return (
    <section className={styles.controlSection} aria-labelledby="groups-heading">
      <div className={styles.controlHeader}><div><p className={styles.eyebrow}>Learning plan</p><h1 id="groups-heading">Groups</h1></div><span>{groups.length} groups</span></div>
      <form className={styles.assignmentForm} onSubmit={createGroup}>
        <label>Group name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Grade 5" /></label>
        <fieldset><legend>Add active children</legend><div className={styles.childChoices}>{childAccounts.filter((child) => child.status === "active").map((child) => <label key={child.id}><input type="checkbox" checked={Boolean(selectedChildren[child.id])} onChange={() => setSelectedChildren((current) => ({ ...current, [child.id]: !current[child.id] }))} />{child.displayName ?? child.login}<span>{child.grade ?? "—"}</span></label>)}</div></fieldset>
        <button className={styles.action} type="submit">Create group<span aria-hidden="true">↗</span></button>
      </form>
      {notice && <p className={`${styles.notice} ${notice.tone === "error" ? styles.noticeError : ""}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
      <div className={styles.controlList}><div className={styles.controlListHeader}><span>Group</span><span>Members</span><span>Assignments</span><span>Status</span></div>{groups.length === 0 ? <p className={styles.empty}>No groups created yet.</p> : groups.map((group) => <div className={styles.controlRow} key={group.id}><strong>{group.name}</strong><span>{group.memberCount}</span><span>{group.activeAssignmentCount}</span><span className={`${styles.pill} ${group.status === "active" ? styles.pillGood : ""}`}>{group.status}</span></div>)}</div>
    </section>
  );
}

function TestsManager({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [tests, setTests] = useState<Test[]>([]);
  const [pagination, setPagination] = useState<TestPagination>({ page: 1, pageSize: 10, totalItems: 0, totalPages: 1 });
  const [grades, setGrades] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<{ title: string; subject: string; passPercentage: number; questions: Array<{ id: string; text: string; options: Array<{ id: string; text: string; isCorrect: boolean }> }> } | null>(null);

  const loadTests = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (search) params.set("search", search);
    if (grade) params.set("grade", grade);

    try {
      const response = await fetch(`/api/v1/admin/tests?${params}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error(await getApiError(response, "Unable to load tests."));
      const payload = (await response.json()) as TestListPayload;
      setTests(payload.tests);
      setPagination(payload.pagination);
      setGrades(payload.filters.grades);
      setPage(payload.pagination.page);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load tests." });
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [grade, page, search]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadTests(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadTests]);

  async function refreshTests() {
    await Promise.all([loadTests(), onRefresh()]);
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearch = searchInput.trim();
    setPage(1);
    setSearch(nextSearch);
    if (nextSearch === search && page === 1) void loadTests();
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setGrade("");
    setPage(1);
  }

  async function uploadTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file");
    if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) {
      setNotice({ tone: "error", text: "Choose a JSON file first." });
      return;
    }
    setIsUploading(true);
    setNotice(null);
    const body = new FormData();
    body.append("file", fileInput.files[0]);
    const response = await fetch("/api/v1/admin/tests/import", { method: "POST", body });
    if (!response.ok) {
      setNotice({ tone: "error", text: await getApiError(response, "Unable to import test.") });
      setIsUploading(false);
      return;
    }
    setNotice({ tone: "success", text: "Test imported as a draft." });
    form.reset();
    setIsUploading(false);
    await refreshTests();
  }

  async function publishTest(test: Test) {
    const response = await fetch(`/api/v1/admin/tests/${test.id}/publish`, { method: "POST" });
    setNotice(response.ok ? { tone: "success", text: `${test.title} is now published.` } : { tone: "error", text: await getApiError(response, "Unable to publish test.") });
    if (response.ok) await refreshTests();
  }

  async function previewTest(test: Test) {
    const response = await fetch(`/api/v1/admin/tests/${test.id}`);
    if (!response.ok) {
      setNotice({ tone: "error", text: await getApiError(response, "Unable to load test preview.") });
      return;
    }
    const payload = (await response.json()) as { test: NonNullable<typeof preview> };
    setPreview(payload.test);
  }

  async function archiveTest(test: Test) {
    const response = await fetch(`/api/v1/admin/tests/${test.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive" }) });
    setNotice(response.ok ? { tone: "success", text: `${test.title} is archived.` } : { tone: "error", text: await getApiError(response, "Unable to archive test.") });
    if (response.ok) await refreshTests();
  }

  async function restoreTest(test: Test) {
    const response = await fetch(`/api/v1/admin/tests/${test.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore" }) });
    setNotice(response.ok ? { tone: "success", text: `${test.title} is published again.` } : { tone: "error", text: await getApiError(response, "Unable to restore test.") });
    if (response.ok) await refreshTests();
  }

  async function deleteTest(test: Test) {
    if (!window.confirm(`Delete "${test.title}" permanently? This cannot be undone.`)) return;
    const response = await fetch(`/api/v1/admin/tests/${test.id}`, { method: "DELETE" });
    setNotice(response.ok ? { tone: "success", text: `${test.title} was deleted.` } : { tone: "error", text: await getApiError(response, "Unable to delete test.") });
    if (response.ok) {
      if (preview?.title === test.title) setPreview(null);
      await refreshTests();
    }
  }

  return (
    <section className={styles.controlSection} aria-labelledby="tests-heading">
      <div className={styles.controlHeader}><div><p className={styles.eyebrow}>Content library</p><h1 id="tests-heading">Tests</h1></div><span>{pagination.totalItems} versions</span></div>
      <form className={styles.uploadForm} onSubmit={uploadTest}><div><h2>Upload a JSON test</h2><p>Validated against the Repetition 1.0 format. New versions start as drafts.</p></div><label className={styles.fileInput}>Choose JSON file<input name="file" type="file" accept=".json,application/json" /></label><button className={styles.action} type="submit" disabled={isUploading}>{isUploading ? "Uploading…" : "Upload test"}<span aria-hidden="true">↗</span></button></form>
      {notice && <p className={`${styles.notice} ${notice.tone === "error" ? styles.noticeError : ""}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
      <form className={styles.testFilters} onSubmit={applySearch} role="search">
        <label>Search by title<input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Enter test title" /></label>
        <label>Grade<select value={grade} onChange={(event) => { setGrade(event.target.value); setPage(1); }}><option value="">All grades</option>{grades.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <div className={styles.filterActions}><button className={styles.action} type="submit">Search</button><button className={styles.textButton} type="button" onClick={clearFilters} disabled={!search && !grade}>Clear</button></div>
      </form>
      <div className={styles.controlList}>
        <div className={styles.controlListHeader}><span>Test</span><span>Subject</span><span>Status</span><span>Action</span></div>
        {isLoading && tests.length === 0 ? <p className={styles.empty}>Loading tests…</p> : tests.length === 0 ? <p className={styles.empty}>{search || grade ? "No tests match these filters." : "No tests uploaded yet."}</p> : tests.map((test) => <div className={styles.controlRow} key={test.id}><div><strong>{test.title}</strong><span>{test.stableId} · v{test.version} · Grade {test.grade ?? "—"} · {test.questionCount} questions</span></div><span>{subjectLabels[test.subject] ?? test.subject}</span><span className={`${styles.pill} ${test.status === "published" ? styles.pillGood : ""}`}>{test.status}</span><span className={styles.rowActions}><button className={styles.textButton} type="button" onClick={() => void previewTest(test)}>Preview</button>{test.status === "draft" && <><button className={styles.textButton} type="button" onClick={() => void publishTest(test)}>Publish</button><button className={styles.textButton} type="button" onClick={() => void deleteTest(test)}>Delete</button></>}{test.status === "published" && <button className={styles.textButton} type="button" onClick={() => void archiveTest(test)}>Archive</button>}{test.status === "archived" && <><button className={styles.textButton} type="button" onClick={() => void restoreTest(test)}>Restore</button><button className={styles.textButton} type="button" onClick={() => void deleteTest(test)}>Delete</button></>}</span></div>)}
      </div>
      {pagination.totalItems > 0 && <nav className={styles.pagination} aria-label="Test list pages"><button className={styles.textButton} type="button" disabled={pagination.page <= 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {pagination.page} of {pagination.totalPages} · {pagination.totalItems} tests</span><button className={styles.textButton} type="button" disabled={pagination.page >= pagination.totalPages || isLoading} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}>Next</button></nav>}
      {preview && <section className={styles.preview} aria-label="Test preview"><div className={styles.sectionHeader}><div><span className={styles.meta}>{subjectLabels[preview.subject] ?? preview.subject}</span><h2>{preview.title}</h2></div><button className={styles.textButton} type="button" onClick={() => setPreview(null)}>Close preview</button></div><p>Pass at {preview.passPercentage}%</p>{preview.questions.map((question, index) => <article key={question.id}><span>0{index + 1}</span><div><h3>{question.text}</h3>{question.options.map((option) => <p className={option.isCorrect ? styles.correctOption : ""} key={option.id}>{option.isCorrect ? "✓ " : ""}{option.text}</p>)}</div></article>)}</section>}
    </section>
  );
}

function AssignmentManager({ childAccounts, groups, onRefresh }: { childAccounts: Child[]; groups: Group[]; onRefresh: () => Promise<void> }) {
  const [testId, setTestId] = useState("");
  const [target, setTarget] = useState<"children" | "group">("children");
  const [groupId, setGroupId] = useState("");
  const [selectedChildren, setSelectedChildren] = useState<Record<string, boolean>>({});
  const [publishedTests, setPublishedTests] = useState<Test[]>([]);
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const selectedGrades = new Set(childAccounts.filter((child) => selectedChildren[child.id]).map((child) => child.grade).filter((grade): grade is string => grade !== null));
  const selectedGrade = selectedGrades.size === 1 ? [...selectedGrades][0] : null;
  const availableTests = target === "children"
    ? selectedGrade ? publishedTests.filter((test) => test.grade === selectedGrade) : []
    : publishedTests;

useEffect(() => {
  const controller = new AbortController();
  const timer = window.setTimeout(async () => {
    try {
      const response = await fetch("/api/v1/admin/tests?status=published&all=true", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(await getApiError(response, "Unable to load published tests."));
      const payload = (await response.json()) as TestListPayload;
      setPublishedTests(payload.tests);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load published tests." });
      }
    } finally {
      if (!controller.signal.aborted) setIsLoadingTests(false);
    }
  }, 0);
  return () => {
    window.clearTimeout(timer);
    controller.abort();
  };
}, []);

function toggleChild(id: string) {
  setSelectedChildren((current) => ({ ...current, [id]: !current[id] }));
  setTestId("");
}

async function assignTest(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const childIds = Object.entries(selectedChildren).filter(([, selected]) => selected).map(([id]) => id);
  if (!testId || (target === "children" && childIds.length === 0) || (target === "group" && !groupId)) {
    setNotice({ tone: "error", text: target === "children" ? "Choose a published test and at least one child." : "Choose a published test and a group." });
    return;
  }
  const response = await fetch("/api/v1/admin/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target === "children" ? { testId, childIds } : { testId, groupId }),
  });
  setNotice(response.ok ? { tone: "success", text: "Test assignment saved." } : { tone: "error", text: await getApiError(response, "Unable to assign test.") });
  if (response.ok) {
    setSelectedChildren({});
    setGroupId("");
    await onRefresh();
  }
}

return (
  <section className={styles.controlSection} aria-labelledby="assignments-heading">
    <div className={styles.controlHeader}><div><p className={styles.eyebrow}>Learning plan</p><h1 id="assignments-heading">Assignments</h1></div><span>Children or groups</span></div>
    <form className={styles.assignmentForm} onSubmit={assignTest}>
      <fieldset><legend>Assign to</legend><div className={styles.targetSwitch}><label><input type="radio" name="target" checked={target === "children"} onChange={() => { setTarget("children"); setTestId(""); }} />Children</label><label><input type="radio" name="target" checked={target === "group"} onChange={() => { setTarget("group"); setTestId(""); }} />Group</label></div>{target === "children" ? <><div className={styles.childChoices}>{childAccounts.filter((child) => child.status === "active").map((child) => <label key={child.id}><input type="checkbox" checked={Boolean(selectedChildren[child.id])} onChange={() => toggleChild(child.id)} />{child.displayName ?? child.login}<span>{child.grade ?? "—"}</span></label>)}</div><p className={styles.gradeHint}>{selectedGrade ? `Showing tests for grade ${selectedGrade}.` : selectedGrades.size > 1 ? "Choose children from one grade." : "Choose a child to see matching tests."}</p></> : <><select value={groupId} onChange={(event) => { setGroupId(event.target.value); setTestId(""); }}><option value="">Choose a group</option>{groups.filter((group) => group.status === "active").map((group) => <option key={group.id} value={group.id}>{group.name} · {group.memberCount} children</option>)}</select><p className={styles.gradeHint}>Groups may mix grades. All published tests are available.</p></>}</fieldset>
      <label>Published test<select value={testId} onChange={(event) => setTestId(event.target.value)} disabled={isLoadingTests || (target === "children" && !selectedGrade)}><option value="">{isLoadingTests ? "Loading tests…" : target === "children" && !selectedGrade ? "Choose recipient first" : "Choose a test"}</option>{availableTests.map((test) => <option value={test.id} key={test.id}>{test.title} · Grade {test.grade} · {subjectLabels[test.subject] ?? test.subject}</option>)}</select></label>
      <button className={styles.action} type="submit">Assign test<span aria-hidden="true">↗</span></button>
    </form>
    {notice && <p className={`${styles.notice} ${notice.tone === "error" ? styles.noticeError : ""}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
  </section>
); }

function ResultsExplorer({ childAccounts, results }: { childAccounts: Child[]; results: Result[] }) {
  const [childId, setChildId] = useState("");
  const [testId, setTestId] = useState("");
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const tests = [...new Map(results.map((result) => [result.test.id, result.test])).values()]
    .sort((first, second) => first.title.localeCompare(second.title));

  const visible = results.filter((result) =>
    (!childId || result.child.id === childId) && (!testId || result.test.id === testId));

  async function openAttempt(attemptId: string) {
    setLoadingId(attemptId);
    setNotice(null);
    const response = await fetch(`/api/v1/admin/attempts/${attemptId}`, { cache: "no-store" });
    setLoadingId(null);
    if (!response.ok) {
      setNotice({ tone: "error", text: await getApiError(response, "Unable to load these answers.") });
      return;
    }
    const payload = (await response.json()) as { attempt: AttemptDetail };
    setDetail(payload.attempt);
  }

  return (
    <section className={styles.controlSection} aria-labelledby="results-heading">
      <div className={styles.controlHeader}>
        <div><p className={styles.eyebrow}>Answers</p><h1 id="results-heading">Results</h1></div>
        <span>{visible.length} of {results.length} submitted attempts</span>
      </div>

      <div className={styles.filters}>
        <label>
          Child
          <select value={childId} onChange={(event) => { setChildId(event.target.value); setDetail(null); }}>
            <option value="">All children</option>
            {childAccounts.map((child) => <option key={child.id} value={child.id}>{child.displayName ?? child.login}</option>)}
          </select>
        </label>
        <label>
          Test
          <select value={testId} onChange={(event) => { setTestId(event.target.value); setDetail(null); }}>
            <option value="">All tests</option>
            {tests.map((test) => <option key={test.id} value={test.id}>{test.title} · v{test.version}</option>)}
          </select>
        </label>
      </div>

      {notice && <p className={`${styles.notice} ${notice.tone === "error" ? styles.noticeError : ""}`} role="status">{notice.text}</p>}

      {visible.length === 0 ? (
        <p className={styles.empty}>No submitted attempts match these filters.</p>
      ) : (
        <div className={`${styles.controlList} ${styles.attemptList}`}>
          <div className={styles.controlListHeader}><span>Child</span><span>Test</span><span>Submitted</span><span>Score</span><span /></div>
          {visible.map((result) => (
            <div className={styles.controlRow} key={result.attemptId}>
              <div><strong>{result.child.displayName}</strong><span>{subjectLabels[result.test.subject] ?? result.test.subject}</span></div>
              <span>{result.test.title}</span>
              <span>{result.submittedAt ? new Date(result.submittedAt).toLocaleDateString() : "—"}</span>
              <span className={result.passed ? styles.resultPassed : styles.resultKeep}>{result.percentage}% · {result.passed ? "Passed" : "Keep practicing"}</span>
              <span className={styles.rowActions}>
                <button className={styles.textButton} type="button" disabled={loadingId === result.attemptId} onClick={() => void openAttempt(result.attemptId)}>
                  {loadingId === result.attemptId ? "Loading…" : "View answers"}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <section className={styles.preview} aria-label="Attempt answers">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.meta}>{detail.child.displayName} · {subjectLabels[detail.test.subject] ?? detail.test.subject}</span>
              <h2>{detail.test.title}</h2>
            </div>
            <button className={styles.textButton} type="button" onClick={() => setDetail(null)}>Close</button>
          </div>
          <p>
            {detail.result
              ? <>Scored <strong>{detail.result.percentage}%</strong> — {detail.result.earnedPoints} of {detail.result.totalPoints} points, pass mark {detail.test.passPercentage}%. </>
              : <>Not submitted yet. </>}
            Test version {detail.test.version}
            {detail.submittedAt ? ` · ${new Date(detail.submittedAt).toLocaleString()}` : ""}
          </p>

          {detail.questions.map((question, index) => (
            <article key={question.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{question.text}</h3>
                <p className={question.answered ? (question.isCorrect ? styles.correctOption : styles.wrongOption) : styles.mutedAction}>
                  {question.answered ? (question.isCorrect ? "Answered correctly" : "Answered incorrectly") : "Not answered"}
                  {" · "}{question.earnedPoints} / {question.points} {question.points === 1 ? "point" : "points"}
                </p>
                <ul className={styles.answerList}>
                  {question.options.map((option) => (
                    <li
                      className={option.isCorrect ? styles.correctOption : option.isChosen ? styles.wrongOption : undefined}
                      key={option.id}
                    >
                      <span aria-hidden="true">{option.isCorrect ? "✓" : option.isChosen ? "✗" : "·"}</span>
                      {option.text}
                      {option.isChosen && <em className={styles.answerTag}>chose this</em>}
                    </li>
                  ))}
                </ul>
                {question.explanation && <div className={styles.answerExplanation}><Markdown>{question.explanation}</Markdown></div>}
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unauthorized" | "error">("loading");
  const [view, setView] = useState<View>("overview");

  const loadAdmin = useCallback(async () => {
    try {
      const responses = await Promise.all(["children", "groups", "tests?page=1&pageSize=6", "results"].map((resource) => fetch(`/api/v1/admin/${resource}`, { cache: "no-store" })));
      if (responses.some((response) => response.status === 401 || response.status === 403)) {
        setState("unauthorized");
        return;
      }
      if (responses.some((response) => !response.ok)) {
        setState("error");
        return;
      }
      const [children, groups, tests, results] = await Promise.all(responses.map((response) => response.json()));
      setData({ children: children.children, groups: groups.groups, tests: tests.tests, publishedTestCount: tests.summary.publishedItems, results: results.results });
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAdmin(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAdmin]);

  if (state === "loading") return <main className={styles.statePage}>Loading overview…</main>;
  if (state === "unauthorized") return <main className={styles.statePage}><div className={styles.stateCard}><span className={styles.brandSmall}>repetition</span><h1>Administrator access required.</h1><p>Sign in with the administrator account to open this room.</p><Link className={styles.action} href="/">Go to sign in</Link></div></main>;
  if (state === "error" || !data) return <main className={styles.statePage}><div className={styles.stateCard}><span className={styles.brandSmall}>repetition</span><h1>The overview is unavailable.</h1><p>Try loading the administrator view again.</p><button className={styles.action} type="button" onClick={() => void loadAdmin()}>Try again</button></div></main>;

  const activeChildren = data.children.filter((child) => child.status === "active").length;
  const publishedTests = data.publishedTestCount;
  const passedResults = data.results.filter((result) => result.passed).length;
  const average = data.results.length ? Math.round(data.results.reduce((sum, result) => sum + result.percentage, 0) / data.results.length) : 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}><Link className={styles.brand} href="/" aria-label="Repetition home"><span className={styles.brandMark} aria-hidden="true"><span /><span /><span /></span>repetition</Link><AdminNavigation view={view} onChange={setView} /></header>
      {view === "children" && <ChildrenManager childAccounts={data.children} onRefresh={loadAdmin} />}
      {view === "groups" && <GroupsManager childAccounts={data.children} groups={data.groups} onRefresh={loadAdmin} />}
      {view === "tests" && <TestsManager onRefresh={loadAdmin} />}
      {view === "assignments" && <AssignmentManager childAccounts={data.children} groups={data.groups} onRefresh={loadAdmin} />}
      {view === "results" && <ResultsExplorer childAccounts={data.children} results={data.results} />}
      {view === "overview" && <>
        <section className={styles.hero} aria-labelledby="admin-title"><div><p className={styles.eyebrow}>Administrator overview</p><h1 id="admin-title">Keep learning moving.</h1><p className={styles.heroCopy}>A clear view of who is practicing, what is ready, and where progress is building.</p></div><div className={styles.heroMark} aria-hidden="true">↗</div></section>
        <section className={styles.metrics} aria-label="Overview metrics"><article><span>Active children</span><strong>{activeChildren}</strong></article><article><span>Published tests</span><strong>{publishedTests}</strong></article><article><span>Average score</span><strong>{average}%</strong></article><article><span>Passed attempts</span><strong>{passedResults}</strong></article></section>
        <div className={styles.columns}><section className={styles.panel} aria-labelledby="tests-title"><div className={styles.sectionHeader}><h2 id="tests-title">Test library</h2><button className={styles.textButton} type="button" onClick={() => setView("tests")}>Manage tests</button></div>{data.tests.length === 0 ? <p className={styles.empty}>No tests uploaded yet.</p> : <div className={styles.list}>{data.tests.slice(0, 6).map((test) => <div className={styles.listRow} key={test.id}><div><span className={styles.meta}>{subjectLabels[test.subject] ?? test.subject}</span><h3>{test.title}</h3></div><span className={styles.detail}>{test.questionCount} questions<br />{test.assignmentCount ?? 0} assigned</span><span className={`${styles.pill} ${test.status === "published" ? styles.pillGood : ""}`}>{test.status}</span></div>)}</div>}</section><section className={styles.panel} aria-labelledby="children-title"><div className={styles.sectionHeader}><h2 id="children-title">Children</h2><button className={styles.textButton} type="button" onClick={() => setView("children")}>Manage children</button></div>{data.children.length === 0 ? <p className={styles.empty}>No child accounts yet.</p> : <div className={styles.list}>{data.children.slice(0, 6).map((child) => <div className={styles.listRow} key={child.id}><div><h3>{child.displayName ?? child.login}</h3><span className={styles.meta}>{child.login} · Grade {child.grade ?? "—"}</span></div><span className={`${styles.pill} ${child.status === "active" ? styles.pillGood : ""}`}>{child.status}</span></div>)}</div>}</section></div>
        <section className={styles.panel} aria-labelledby="results-title"><div className={styles.sectionHeader}><h2 id="results-title">Recent results</h2><button className={styles.textButton} type="button" onClick={() => setView("results")}>See all answers</button></div>{data.results.length === 0 ? <p className={styles.empty}>Completed attempts will appear here.</p> : <div className={styles.resultTable}><div className={styles.tableHeader}><span>Child</span><span>Test</span><span>Score</span><span>Status</span></div>{data.results.slice(0, 8).map((result) => <div className={styles.resultRow} key={result.attemptId}><span>{result.child.displayName}</span><span>{result.test.title}</span><strong>{result.percentage}%</strong><span className={result.passed ? styles.resultPassed : styles.resultKeep}>{result.passed ? "Passed" : "Keep practicing"}</span></div>)}</div>}</section>
      </>}
    </main>
  );
}
