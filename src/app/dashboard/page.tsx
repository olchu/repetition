"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SignOutButton } from "@/components/SignOutButton";
import styles from "./page.module.css";

type SubjectSummary = {
  subject: string;
  assigned: number;
  passed: number;
  progress: number;
};

type DashboardTest = {
  id: string;
  title: string;
  subject: string;
  status: "not_started" | "in_progress" | "completed" | "passed";
  attemptCount: number;
  bestPercentage: number;
  latestPercentage: number | null;
  latestSubmittedAt: string | null;
};

type DashboardData = {
  child: { displayName: string };
  subjects: SubjectSummary[];
  tests: DashboardTest[];
};

const subjectLabels: Record<string, string> = {
  science: "Science",
  geography: "Geography",
  history: "History",
  mathematics: "Mathematics",
};

const statusLabels: Record<DashboardTest["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Keep practicing",
  passed: "Passed",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<"unauthorized" | "unavailable" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/me/dashboard", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setError("unauthorized");
        return;
      }
      if (!response.ok) {
        setError("unavailable");
        return;
      }
      setData((await response.json()) as DashboardData);
    } catch {
      setError("unavailable");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  if (isLoading) {
    return <main className={styles.statePage}>Loading your learning room…</main>;
  }

  if (error === "unauthorized") {
    return (
      <main className={styles.statePage}>
        <div className={styles.stateCard}>
          <span className={styles.brandSmall}>repetition</span>
          <h1>Your learning room is private.</h1>
          <p>Sign in as a child to see assigned tests and progress.</p>
          <Link className={styles.primaryAction} href="/">Go to sign in</Link>
        </div>
      </main>
    );
  }

  if (error === "unavailable" || !data) {
    return (
      <main className={styles.statePage}>
        <div className={styles.stateCard}>
          <span className={styles.brandSmall}>repetition</span>
          <h1>We couldn&apos;t load your progress.</h1>
          <p>The learning room is unavailable right now. Try again in a moment.</p>
          <button className={styles.primaryAction} type="button" onClick={() => void loadDashboard()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  const passedCount = data.subjects.reduce((total, subject) => total + subject.passed, 0);
  const assignedCount = data.subjects.reduce((total, subject) => total + subject.assigned, 0);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Repetition home">
          <span className={styles.brandMark} aria-hidden="true"><span /><span /><span /></span>
          repetition
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          <SignOutButton className={styles.navLink} />
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="dashboard-title">
        <div>
          <p className={styles.eyebrow}>Your learning room</p>
          <h1 id="dashboard-title">Good to see you, {data.child.displayName}.</h1>
          <p className={styles.heroCopy}>Keep going at your own pace. Every completed test adds up.</p>
        </div>
        <div className={styles.overallScore}>
          <strong>{passedCount}<span>/{assignedCount}</span></strong>
          <span>tests passed</span>
        </div>
      </section>

      <section className={styles.subjectSection} aria-labelledby="subjects-title">
        <div className={styles.sectionHeader}>
          <h2 id="subjects-title">Your subjects</h2>
          <span>{passedCount === assignedCount && assignedCount > 0 ? "Everything is complete" : "One step at a time"}</span>
        </div>
        <div className={styles.subjectGrid}>
          {data.subjects.map((subject) => (
            <article className={styles.subjectRow} key={subject.subject}>
              <div className={styles.subjectHeading}>
                <h3>{subjectLabels[subject.subject] ?? subject.subject}</h3>
                <strong>{subject.progress}%</strong>
              </div>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label={`${subjectLabels[subject.subject] ?? subject.subject} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={subject.progress}
              >
                <span style={{ width: `${subject.progress}%` }} />
              </div>
              <p>{subject.passed} of {subject.assigned} tests passed</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.testsSection} aria-labelledby="tests-title">
        <div className={styles.sectionHeader}>
          <h2 id="tests-title">Assigned tests</h2>
          <span>{data.tests.length} {data.tests.length === 1 ? "test" : "tests"}</span>
        </div>
        {data.tests.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No tests assigned yet.</p>
            <span>Your administrator will add the next one here.</span>
          </div>
        ) : (
          <div className={styles.testList}>
            {data.tests.map((test) => (
              <article className={styles.testRow} key={test.id}>
                <div className={styles.testTitle}>
                  <span>{subjectLabels[test.subject] ?? test.subject}</span>
                  <h3>{test.title}</h3>
                </div>
                <div className={styles.testMetric}>
                  <strong>{test.latestPercentage !== null ? `${test.bestPercentage}%` : "—"}</strong>
                  <span>best score</span>
                </div>
                <div className={`${styles.status} ${styles[`status_${test.status}`]}`}>
                  <span className={styles.statusDot} aria-hidden="true" />
                  {statusLabels[test.status]}
                </div>
                <Link className={styles.testAction} href={`/dashboard/tests/${test.id}`}>
                  {test.status === "passed" ? "Review" : test.status === "in_progress" ? "Continue" : "Start"}
                  <span aria-hidden="true">↗</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
