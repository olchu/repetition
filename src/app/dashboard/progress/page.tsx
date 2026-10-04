"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ClipboardCheck, Star } from "lucide-react";
import { DashboardStateCard, shellStyles } from "@/components/DashboardShell";
import { useSubjectLabel } from "@/components/SubjectsProvider";
import type { StudentHistory } from "@/lib/student-history";
import styles from "./progress.module.css";

export default function ProgressPage() {
  const subjectLabel = useSubjectLabel();
  const [history, setHistory] = useState<StudentHistory | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/v1/me/progress", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403
          ? "Sign in as a child to see your progress." : "We couldn’t load your progress.");
        const payload = await response.json() as StudentHistory;
        if (!controller.signal.aborted) { setHistory(payload); setError(""); }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "We couldn’t load your progress.");
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  async function loadMore() {
    if (!history?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/me/progress?cursor=${encodeURIComponent(history.nextCursor)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("We couldn’t load more attempts. Please try again.");
      const page = await response.json() as StudentHistory;
      setHistory((previous) => previous ? { ...page, attempts: [
        ...previous.attempts,
        ...page.attempts.filter((attempt) => !previous.attempts.some((item) => item.id === attempt.id)),
      ] } : page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t load more attempts.");
    } finally { setLoadingMore(false); }
  }

  if (!history) {
    if (error) return <DashboardStateCard embedded title={error} description="Your results will still be here when you return." action={
      <button className={shellStyles.stateAction} onClick={() => { setError(""); setReload((value) => value + 1); }}>Try again</button>
    } />;
    return <p className={styles.message} role="status">Loading your progress…</p>;
  }

  const { summary } = history;
  return <>
    <header className={styles.header}>
      <p className={styles.eyebrow}>Progress</p>
      <h1>Your learning so far</h1>
      <p>Every completed test counts. Your results stay here, even when a test is no longer assigned.</p>
    </header>

    <section className={styles.stats} aria-label="Lifetime progress">
      <article><ClipboardCheck aria-hidden="true" /><strong>{summary.completed}</strong><span>Tests completed</span></article>
      <article><Check aria-hidden="true" /><strong>{summary.passed}</strong><span>Tests passed</span></article>
      <article><Star aria-hidden="true" /><strong>{summary.stars}</strong><span>Stars earned</span></article>
    </section>
    <p className={styles.note}>Each test counts once across versions and retries. Completed means you finished a test; passed means you reached its pass mark.</p>

    <section className={styles.section} aria-labelledby="subject-progress-title">
      <h2 id="subject-progress-title">By subject</h2>
      {summary.subjects.length === 0 ? <p className={styles.message}>Finish your first test to see your results here.</p> : (
        <div className={styles.subjects}>
          {summary.subjects.map((subject) => <details className={styles.subject} key={subject.subject} data-subject={subject.subject}>
            <summary><strong>{subjectLabel(subject.subject)}</strong><span>{subject.completed} completed · {subject.passed} passed</span></summary>
            <ul>{subject.tests.map((test) => <li key={test.stableId}>
              <strong>{test.title}</strong><span>Best result {Math.round(test.bestPercentage)}% · {test.passed ? "Passed" : "Not passed yet"}</span>
            </li>)}</ul>
          </details>)}
        </div>
      )}
    </section>

    <section className={styles.section} aria-labelledby="attempt-history-title">
      <h2 id="attempt-history-title">Attempt history</h2>
      {history.attempts.length === 0 ? <div className={styles.empty}>
        <p>No completed attempts yet.</p><Link href="/dashboard/tests">Explore your tests</Link>
      </div> : <div className={styles.history}>
        {history.attempts.map((attempt) => <article className={styles.attempt} key={attempt.id} data-subject={attempt.subject}>
          <div className={styles.attemptName}>
            <span className={styles.subjectName}>{subjectLabel(attempt.subject)}</span>
            <h3>{attempt.title}</h3>
            <p><time dateTime={attempt.submittedAt}>{new Date(attempt.submittedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time> · Version {attempt.version}</p>
            {(attempt.archived || attempt.unassigned) && <p className={styles.note}>{[attempt.archived ? "Archived version" : "", attempt.unassigned ? "No longer assigned" : ""].filter(Boolean).join(" · ")}</p>}
          </div>
          <div className={styles.result}>
            <strong>{Math.round(attempt.percentage)}%</strong><span>{attempt.earnedPoints} / {attempt.totalPoints} points</span>
            <span className={attempt.passed ? styles.passed : styles.practice}>{attempt.passed ? "Passed" : "Completed · Not passed"}</span>
          </div>
          <div className={styles.reward}>
            <span>{attempt.reward.kind === "earned" ? `${attempt.reward.stars} stars earned`
              : attempt.reward.kind === "training" ? "Practice · No stars" : "Before stars were introduced"}</span>
            <Link href={`/dashboard/attempts/${attempt.id}`} aria-label={`Review answers: ${attempt.title}`}>Review answers →</Link>
          </div>
        </article>)}
      </div>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {history.nextCursor && <button className={styles.loadMore} disabled={loadingMore} onClick={() => void loadMore()}>
        {loadingMore ? "Loading…" : "Load more attempts"}
      </button>}
    </section>
  </>;
}
