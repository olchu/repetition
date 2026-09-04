"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SignOutButton } from "@/components/SignOutButton";
import styles from "./page.module.css";

type Child = { id: string; login: string; displayName: string | null; grade: string | null; status: string };
type Test = { id: string; title: string; subject: string; status: string; questionCount: number; assignmentCount: number };
type Result = { attemptId: string; child: { displayName: string }; test: { title: string; subject: string }; percentage: number; passed: boolean; submittedAt: string | null };
type AdminData = { children: Child[]; tests: Test[]; results: Result[] };

const subjectLabels: Record<string, string> = { science: "Science", geography: "Geography", history: "History", mathematics: "Mathematics" };

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [state, setState] = useState<"loading" | "unauthorized" | "error">("loading");

  const loadAdmin = useCallback(async () => {
    setState("loading");
    try {
      const responses = await Promise.all([
        fetch("/api/v1/admin/children", { cache: "no-store" }),
        fetch("/api/v1/admin/tests", { cache: "no-store" }),
        fetch("/api/v1/admin/results", { cache: "no-store" }),
      ]);
      if (responses.some((response) => response.status === 401 || response.status === 403)) {
        setState("unauthorized");
        return;
      }
      if (responses.some((response) => !response.ok)) {
        setState("error");
        return;
      }
      const [children, tests, results] = await Promise.all(responses.map((response) => response.json()));
      setData({ children: children.children, tests: tests.tests, results: results.results });
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAdmin(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAdmin]);

  if (state === "loading") return <main className={styles.statePage}>Loading overview…</main>;
  if (state === "unauthorized") {
    return <main className={styles.statePage}><div className={styles.stateCard}><span className={styles.brandSmall}>repetition</span><h1>Administrator access required.</h1><p>Sign in with the administrator account to open this room.</p><Link className={styles.action} href="/">Go to sign in</Link></div></main>;
  }
  if (state === "error" || !data) {
    return <main className={styles.statePage}><div className={styles.stateCard}><span className={styles.brandSmall}>repetition</span><h1>The overview is unavailable.</h1><p>Try loading the administrator view again.</p><button className={styles.action} type="button" onClick={() => void loadAdmin()}>Try again</button></div></main>;
  }

  const activeChildren = data.children.filter((child) => child.status === "active").length;
  const publishedTests = data.tests.filter((test) => test.status === "published").length;
  const passedResults = data.results.filter((result) => result.passed).length;
  const average = data.results.length ? Math.round(data.results.reduce((sum, result) => sum + result.percentage, 0) / data.results.length) : 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Repetition home"><span className={styles.brandMark} aria-hidden="true"><span /><span /><span /></span>repetition</Link>
        <nav className={styles.nav} aria-label="Admin navigation"><span className={styles.navActive}>Overview</span><SignOutButton className={styles.navLink} /></nav>
      </header>

      <section className={styles.hero} aria-labelledby="admin-title">
        <div><p className={styles.eyebrow}>Administrator overview</p><h1 id="admin-title">Keep learning moving.</h1><p className={styles.heroCopy}>A clear view of who is practicing, what is ready, and where progress is building.</p></div>
        <div className={styles.heroMark} aria-hidden="true">↗</div>
      </section>

      <section className={styles.metrics} aria-label="Overview metrics">
        <article><span>Active children</span><strong>{activeChildren}</strong></article>
        <article><span>Published tests</span><strong>{publishedTests}</strong></article>
        <article><span>Average score</span><strong>{average}%</strong></article>
        <article><span>Passed attempts</span><strong>{passedResults}</strong></article>
      </section>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="tests-title"><div className={styles.sectionHeader}><h2 id="tests-title">Test library</h2><span>{data.tests.length} total</span></div>{data.tests.length === 0 ? <p className={styles.empty}>No tests uploaded yet.</p> : <div className={styles.list}>{data.tests.slice(0, 6).map((test) => <div className={styles.listRow} key={test.id}><div><span className={styles.meta}>{subjectLabels[test.subject] ?? test.subject}</span><h3>{test.title}</h3></div><span className={styles.detail}>{test.questionCount} questions<br />{test.assignmentCount} assigned</span><span className={`${styles.pill} ${test.status === "published" ? styles.pillGood : ""}`}>{test.status}</span></div>)}</div>}</section>
        <section className={styles.panel} aria-labelledby="children-title"><div className={styles.sectionHeader}><h2 id="children-title">Children</h2><span>{activeChildren} active</span></div>{data.children.length === 0 ? <p className={styles.empty}>No child accounts yet.</p> : <div className={styles.list}>{data.children.slice(0, 6).map((child) => <div className={styles.listRow} key={child.id}><div><h3>{child.displayName ?? child.login}</h3><span className={styles.meta}>{child.login} · Grade {child.grade ?? "—"}</span></div><span className={`${styles.pill} ${child.status === "active" ? styles.pillGood : ""}`}>{child.status}</span></div>)}</div>}</section>
      </div>

      <section className={styles.panel} aria-labelledby="results-title"><div className={styles.sectionHeader}><h2 id="results-title">Recent results</h2><span>{data.results.length} submitted</span></div>{data.results.length === 0 ? <p className={styles.empty}>Completed attempts will appear here.</p> : <div className={styles.resultTable}><div className={styles.tableHeader}><span>Child</span><span>Test</span><span>Score</span><span>Status</span></div>{data.results.slice(0, 8).map((result) => <div className={styles.resultRow} key={result.attemptId}><span>{result.child.displayName}</span><span>{result.test.title}</span><strong>{result.percentage}%</strong><span className={result.passed ? styles.resultPassed : styles.resultKeep}>{result.passed ? "Passed" : "Keep practicing"}</span></div>)}</div>}</section>
    </main>
  );
}
