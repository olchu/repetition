"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSubjects } from "@/components/SubjectsProvider";
import { getApiError } from "@/lib/api-error";
import admin from "@/app/admin/page.module.css";
import styles from "./TestSetManager.module.css";

type SetTest = { stableId: string; title: string; subject: string; grade: string | null; version: number; status: string; questionCount: number; publishedTestId: string | null };
type TestSet = { id: string; name: string; description: string | null; tests: SetTest[] };
type LibraryTest = { id: string; stableId: string; title: string; subject: string; grade: string | null; version: number; status: string; questionCount: number };
type Notice = { tone: "success" | "error"; text: string } | null;

const jsonHeaders = { "Content-Type": "application/json" };

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Admin "Sets": named groups of tests. Children see their lists grouped by set. */
export function TestSetManager() {
  const { subjectLabels } = useSubjects();
  const [sets, setSets] = useState<TestSet[] | null>(null);
  const [library, setLibrary] = useState<LibraryTest[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [editing, setEditing] = useState<{ id: string; name: string; description: string } | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const subjectName = (slug: string) => subjectLabels[slug] ?? slug;

  const loadSets = useCallback(async () => {
    const response = await fetch("/api/v1/admin/test-sets", { cache: "no-store" });
    if (!response.ok) throw new Error(await getApiError(response, "Unable to load sets."));
    setSets(((await response.json()) as { sets: TestSet[] }).sets);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const [, testsResponse] = await Promise.all([loadSets(), fetch("/api/v1/admin/tests?all=true", { cache: "no-store" })]);
        if (!testsResponse.ok) throw new Error(await getApiError(testsResponse, "Unable to load the test library."));
        const payload = (await testsResponse.json()) as { tests: LibraryTest[] };
        if (!cancelled) setLibrary(payload.tests);
      } catch (error) {
        if (!cancelled) setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load sets." });
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadSets]);

  /** The newest version of each test stands for all of them. */
  const latest = useMemo(() => {
    const newest = new Map<string, LibraryTest>();
    for (const test of library ?? []) {
      const current = newest.get(test.stableId);
      if (!current || test.version > current.version) newest.set(test.stableId, test);
    }
    return [...newest.values()];
  }, [library]);

  const setOf = new Map((sets ?? []).flatMap((set) => set.tests.map((test) => [test.stableId, set] as const)));
  const selected = sets?.find((set) => set.id === selectedId) ?? sets?.[0] ?? null;
  const query = search.trim().toLowerCase();
  const candidates = selected
    ? latest
        .filter((test) => test.status !== "archived" && setOf.get(test.stableId)?.id !== selected.id && (!query || test.title.toLowerCase().includes(query)))
        .sort((a, b) => subjectName(a.subject).localeCompare(subjectName(b.subject)) || a.title.localeCompare(b.title))
    : [];

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
      await loadSets();
      setNotice({ tone: "success", text });
    } catch {
      setNotice({ tone: "error", text: fallback });
    } finally {
      setBusy(null);
    }
  }

  function createSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(
      "create",
      () => fetch("/api/v1/admin/test-sets", { method: "POST", headers: jsonHeaders, body: JSON.stringify(draft) }),
      async (response) => {
        const payload = (await response.json()) as { set: TestSet };
        setSelectedId(payload.set.id);
        setDraft({ name: "", description: "" });
        return `Set “${payload.set.name}” created. Add tests to it below.`;
      },
      "Unable to create the set.",
    );
  }

  function saveSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    void run(
      "save",
      () => fetch(`/api/v1/admin/test-sets/${editing.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ name: editing.name, description: editing.description }) }),
      async () => {
        setEditing(null);
        return "Set saved.";
      },
      "Unable to save the set.",
    );
  }

  function deleteSet(set: TestSet) {
    if (!window.confirm(`Delete set “${set.name}”? Its tests stay in the library and stay assigned; they are just no longer grouped.`)) return;
    void run(
      "delete",
      () => fetch(`/api/v1/admin/test-sets/${set.id}`, { method: "DELETE" }),
      async () => {
        setSelectedId(null);
        return `Set “${set.name}” deleted.`;
      },
      "Unable to delete the set.",
    );
  }

  function addTest(set: TestSet, test: LibraryTest) {
    void run(
      `add-${test.stableId}`,
      () => fetch(`/api/v1/admin/test-sets/${set.id}/tests/${encodeURIComponent(test.stableId)}`, { method: "PUT" }),
      async (response) => {
        const { movedFrom } = (await response.json()) as { movedFrom: string | null };
        return `“${test.title}” added to “${set.name}”${movedFrom ? ` (moved from “${movedFrom}”)` : ""}.`;
      },
      "Unable to add the test.",
    );
  }

  function removeTest(set: TestSet, test: SetTest) {
    void run(
      `remove-${test.stableId}`,
      () => fetch(`/api/v1/admin/test-sets/${set.id}/tests/${encodeURIComponent(test.stableId)}`, { method: "DELETE" }),
      async () => `“${test.title}” removed from “${set.name}”.`,
      "Unable to remove the test.",
    );
  }

  return (
    <section className={admin.controlSection} aria-labelledby="sets-heading">
      <div className={admin.controlHeader}>
        <div><p className={admin.eyebrow}>Library</p><h1 id="sets-heading">Test sets</h1></div>
        <span>Group tests so children see them together</span>
      </div>

      <form className={styles.createForm} onSubmit={createSet}>
        <label>Set name<input value={draft.name} maxLength={100} placeholder="Fractions, Week 1…" required onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
        <label>Description (optional)<input value={draft.description} maxLength={500} placeholder="What the set practises" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
        <button className={admin.action} type="submit" disabled={busy !== null}>{busy === "create" ? "Creating…" : "Create set"}<span aria-hidden="true">+</span></button>
      </form>

      {notice && <p className={`${admin.notice} ${notice.tone === "error" ? admin.noticeError : ""}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}

      {sets === null ? (
        <p className={`${admin.empty} ${styles.spaced}`}>Loading sets…</p>
      ) : sets.length === 0 || !selected ? (
        <p className={`${admin.empty} ${styles.spaced}`}>No sets yet. Create the first one above, then add tests to it.</p>
      ) : (
        <div className={styles.layout}>
          <nav className={styles.setList} aria-label="Test sets">
            {sets.map((set) => (
              <button className={`${styles.setItem} ${set.id === selected.id ? styles.setItemActive : ""}`} key={set.id} type="button" aria-pressed={set.id === selected.id} onClick={() => { setSelectedId(set.id); setEditing(null); setSearch(""); setNotice(null); }}>
                <strong>{set.name}</strong>
                <span>{plural(set.tests.length, "test")}</span>
              </button>
            ))}
          </nav>

          <div className={styles.panel}>
            {editing?.id === selected.id ? (
              <form className={styles.editForm} onSubmit={saveSet}>
                <label>Name<input value={editing.name} maxLength={100} required onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
                <label>Description<input value={editing.description} maxLength={500} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label>
                <div className={styles.editActions}>
                  <button className={admin.action} type="submit" disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save"}</button>
                  <button className={admin.textButton} type="button" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <header className={styles.panelHeader}>
                <div>
                  <h2>{selected.name}</h2>
                  {selected.description && <p>{selected.description}</p>}
                </div>
                <span className={styles.headerActions}>
                  <button className={admin.textButton} type="button" onClick={() => setEditing({ id: selected.id, name: selected.name, description: selected.description ?? "" })}>Rename</button>
                  <button className={admin.textButton} type="button" disabled={busy !== null} onClick={() => deleteSet(selected)}>Delete set</button>
                </span>
              </header>
            )}

            <h3 className={styles.blockTitle}>Tests in this set</h3>
            {selected.tests.length === 0 ? (
              <p className={admin.empty}>No tests yet. Add them from the library below.</p>
            ) : (
              <ul className={styles.rows}>
                {selected.tests.map((test) => (
                  <li className={styles.row} key={test.stableId}>
                    <div className={styles.testInfo}>
                      <strong>{test.title}</strong>
                      <span>{subjectName(test.subject)} · Grade {test.grade ?? "—"} · v{test.version} · {plural(test.questionCount, "question")}{test.status !== "published" && ` · ${test.status}`}</span>
                      {!test.publishedTestId && <em className={styles.warning}>Not published yet, so it can’t be assigned</em>}
                    </div>
                    <button className={admin.textButton} type="button" disabled={busy !== null} onClick={() => removeTest(selected, test)}>
                      {busy === `remove-${test.stableId}` ? "Removing…" : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.libraryHeader}>
              <h3 className={styles.blockTitle}>Add from the library</h3>
              <label className={styles.search}>Search<input type="search" value={search} placeholder="Test title" onChange={(event) => setSearch(event.target.value)} /></label>
            </div>
            {library === null ? (
              <p className={admin.empty}>Loading the library…</p>
            ) : candidates.length === 0 ? (
              <p className={admin.empty}>{query ? "No tests match this search." : "Every test in the library is already in this set."}</p>
            ) : (
              <ul className={styles.rows}>
                {candidates.map((test) => {
                  const current = setOf.get(test.stableId);
                  return (
                    <li className={styles.row} key={test.stableId}>
                      <div className={styles.testInfo}>
                        <strong>{test.title}</strong>
                        <span>{subjectName(test.subject)} · Grade {test.grade ?? "—"} · v{test.version} · {test.status}</span>
                        {current && <em className={styles.note}>Now in “{current.name}” — adding moves it here</em>}
                      </div>
                      <button className={styles.addButton} type="button" disabled={busy !== null} onClick={() => addTest(selected, test)}>
                        {busy === `add-${test.stableId}` ? "Adding…" : current ? "Move here" : "Add"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
