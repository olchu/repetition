"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "../../page.module.css";

type Test = { id: string; title: string; subject: string; status: "not_started" | "in_progress" | "completed" | "passed"; inProgressAttemptId: string | null; bestPercentage: number; latestPercentage: number | null };
type Dashboard = { subjects: Array<{ subject: string; assigned: number; passed: number; progress: number }>; tests: Test[] };
type RouteContext = { params: Promise<{ subject: string }> };

const labels: Record<string, string> = { science: "Science", geography: "Geography", history: "History", mathematics: "Mathematics" };

export default function SubjectPage({ params }: RouteContext) {
  const [subject, setSubject] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState(false);

  const loadSubject = useCallback(async () => {
    const { subject: requestedSubject } = await params;
    if (!labels[requestedSubject]) {
      setError(true);
      return;
    }
    setSubject(requestedSubject);
    const response = await fetch("/api/v1/me/dashboard", { cache: "no-store" });
    if (!response.ok) {
      setError(true);
      return;
    }
    setDashboard((await response.json()) as Dashboard);
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSubject(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSubject]);

  if (error) return <main className={styles.statePage}><div className={styles.stateCard}><h1>This subject is unavailable.</h1><Link className={styles.primaryAction} href="/dashboard">Back to progress</Link></div></main>;
  if (!dashboard) return <main className={styles.statePage}>Loading subject…</main>;

  const summary = dashboard.subjects.find((item) => item.subject === subject);
  const tests = dashboard.tests.filter((test) => test.subject === subject);
  return <main className={styles.detailPage}><Link className={styles.backLink} href="/dashboard">← Back to progress</Link><p className={styles.eyebrow}>Subject progress</p><h1>{labels[subject]}</h1><p className={styles.detailCopy}>{summary?.passed ?? 0} of {summary?.assigned ?? 0} tests passed — {summary?.progress ?? 0}% complete.</p><div className={styles.progressTrack} role="progressbar" aria-label={`${labels[subject]} progress`} aria-valuenow={summary?.progress ?? 0} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${summary?.progress ?? 0}%` }} /></div><div className={styles.subjectTestList}>{tests.length === 0 ? <p>No tests assigned for this subject yet.</p> : tests.map((test) => <article key={test.id}><div><h2>{test.title}</h2><span>{test.latestPercentage !== null ? `Best score ${test.bestPercentage}%` : "Not started"}</span></div><Link className={styles.secondaryAction} href={test.status === "in_progress" && test.inProgressAttemptId ? `/dashboard/attempts/${test.inProgressAttemptId}` : `/dashboard/tests/${test.id}`}>{test.status === "in_progress" ? "Continue" : "Open"}</Link></article>)}</div></main>;
}
