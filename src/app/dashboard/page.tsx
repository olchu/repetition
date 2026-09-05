"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  FileText,
  FlaskConical,
  Globe2,
  Landmark,
  LogOut,
  Ruler,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { SignOutButton } from "@/components/SignOutButton";
import styles from "./home.module.css";

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
  inProgressAttemptId: string | null;
  bestPercentage: number;
  latestPercentage: number | null;
  latestSubmittedAt: string | null;
};

type DashboardData = {
  child: { displayName: string };
  subjects: SubjectSummary[];
  tests: DashboardTest[];
};

type SubjectTone = "science" | "geography" | "history" | "mathematics";

const subjectMeta: Record<SubjectTone, { label: string; Icon: LucideIcon }> = {
  science: { label: "Science", Icon: FlaskConical },
  geography: { label: "Geography", Icon: Globe2 },
  history: { label: "History", Icon: Landmark },
  mathematics: { label: "Mathematics", Icon: Ruler },
};

const toneClass: Record<SubjectTone, string> = {
  science: styles.toneScience,
  geography: styles.toneGeography,
  history: styles.toneHistory,
  mathematics: styles.toneMathematics,
};

const statusLabels: Record<DashboardTest["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Keep practicing",
  passed: "Passed",
};

const statusClass: Record<DashboardTest["status"], string> = {
  not_started: styles.statusNotStarted,
  in_progress: styles.statusInProgress,
  completed: styles.statusCompleted,
  passed: styles.statusPassed,
};

const actionLabels: Record<DashboardTest["status"], string> = {
  not_started: "Start test",
  in_progress: "Continue",
  completed: "Try again",
  passed: "Review",
};

function isSubjectTone(value: string): value is SubjectTone {
  return value in subjectMeta;
}

function subjectLabel(subject: string) {
  return isSubjectTone(subject) ? subjectMeta[subject].label : subject;
}

const RING_RADIUS = 52;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

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
          <h1>Your learning room is private.</h1>
          <p>Sign in as a child to see assigned tests and progress.</p>
          <Link className={styles.stateAction} href="/">Go to sign in</Link>
        </div>
      </main>
    );
  }

  if (error === "unavailable" || !data) {
    return (
      <main className={styles.statePage}>
        <div className={styles.stateCard}>
          <h1>We couldn&apos;t load your progress.</h1>
          <p>The learning room is unavailable right now. Try again in a moment.</p>
          <button className={styles.stateAction} type="button" onClick={() => void loadDashboard()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  const passedCount = data.subjects.reduce((total, subject) => total + subject.passed, 0);
  const assignedCount = data.subjects.reduce((total, subject) => total + subject.assigned, 0);
  const overall = assignedCount ? Math.round((passedCount / assignedCount) * 100) : 0;
  const name = data.child.displayName;

  return (
    <div className={styles.shell}>
      <DashboardSidebar userName={name} active="home" />

      <main className={styles.main}>
        <div className={styles.topBar}>
          <SignOutButton className={styles.signOut}>
            <LogOut size={18} strokeWidth={2} aria-hidden="true" />
            Sign out
          </SignOutButton>
        </div>

        <section className={styles.hero} aria-labelledby="dashboard-title">
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>Your learning room</p>
            <h1 id="dashboard-title">
              Good to see you,{" "}
              <span className={styles.heroName}><span className={styles.heroNameGradient}>{name}</span>.</span>
            </h1>
            <p className={styles.heroCopy}>
              Keep learning at your own pace. Every completed test helps you understand more and grow further.
            </p>
          </div>

          <div className={styles.heroArt} aria-hidden="true" />

          <aside className={styles.progressCard} aria-label="Overall progress">
            <p className={styles.visuallyHidden}>Keep going!</p>
            <div className={styles.ring}>
              <svg viewBox="0 0 120 120" role="img" aria-label={`${overall}% overall progress`}>
                <defs>
                  <linearGradient id="ringGradient" gradientUnits="userSpaceOnUse" x1="112" y1="35" x2="8" y2="85">
                    <stop offset="0%" stopColor="#38ffc4" />
                    <stop offset="48%" stopColor="#28f2d5" />
                    <stop offset="100%" stopColor="#a4edff" />
                  </linearGradient>
                </defs>
                <circle className={styles.ringTrack} cx="60" cy="60" r={RING_RADIUS} />
                <circle
                  className={styles.ringValue}
                  cx="60"
                  cy="60"
                  r={RING_RADIUS}
                  stroke="url(#ringGradient)"
                  strokeDasharray={RING_LENGTH}
                  strokeDashoffset={RING_LENGTH * (1 - overall / 100)}
                />
              </svg>
              <span className={styles.ringLabel}>
                <strong>{overall}<small>%</small></strong>
                <span>overall</span>
              </span>
            </div>
            <p className={styles.visuallyHidden}>&ldquo;One step at a time.&rdquo;</p>
          </aside>
        </section>

        <section className={styles.section} aria-labelledby="subjects-title">
          <div className={styles.sectionHeader}>
            <h2 id="subjects-title">Your subjects</h2>
          </div>
          <div className={styles.subjectGrid}>
            {data.subjects.map((subject) => {
              const tone = isSubjectTone(subject.subject) ? subject.subject : null;
              const Icon = tone ? subjectMeta[tone].Icon : BookOpen;
              const hasTests = subject.assigned > 0;
              const remaining = Math.max(0, subject.assigned - subject.passed);
              const allPassed = hasTests && remaining === 0;

              return (
                <article
                  className={`${styles.subjectCard} ${tone ? toneClass[tone] : ""}`}
                  key={subject.subject}
                >
                  <div className={styles.subjectTop}>
                    <span className={styles.subjectIcon} aria-hidden="true">
                      <Icon size={24} strokeWidth={2} />
                    </span>
                    <h3>{subjectLabel(subject.subject)}</h3>
                    <ChevronRight className={styles.subjectChevron} size={18} strokeWidth={2.2} aria-hidden="true" />
                    <p className={`${styles.subjectMeta} ${!hasTests ? styles.subjectWaiting : allPassed ? styles.subjectPassed : styles.subjectPending}`}>
                      {!hasTests ? (
                        "Waiting for tests"
                      ) : allPassed ? (
                        <><strong>100%</strong> · All tests passed</>
                      ) : (
                        <>{remaining} {remaining === 1 ? "test" : "tests"} to pass{subject.progress > 0 && <> · <strong>{subject.progress}%</strong></>}</>
                      )}
                    </p>
                  </div>

                  {hasTests ? <div
                    className={styles.track}
                    role="progressbar"
                    aria-label={`${subjectLabel(subject.subject)} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={subject.progress}
                  >
                    <span style={{ width: `${subject.progress}%` }} />
                  </div> : <div className={styles.emptyTrack} aria-hidden="true" />}

                  <Link className={styles.subjectAction} href={`/dashboard/subjects/${subject.subject}`}>
                    Open subject
                    <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="tests-title">
          <div className={styles.panelHeader}>
            <div>
              <h2 id="tests-title">Assigned tests</h2>
              <p>Your teacher has added these tests for you to review and build your understanding.</p>
            </div>
          </div>

          {data.tests.length === 0 ? (
            <div className={styles.empty}>
              <p>No tests assigned yet.</p>
              <span>Your administrator will add the next one here.</span>
            </div>
          ) : (
            <div className={styles.table}>
              <div className={styles.tableHead} role="presentation">
                <span>Test name</span>
                <span>Subject</span>
                <span>Status</span>
                <span />
              </div>
              {data.tests.map((test) => {
                const tone = isSubjectTone(test.subject) ? test.subject : null;
                const Icon = tone ? subjectMeta[tone].Icon : BookOpen;

                return (
                  <article className={styles.tableRow} key={test.id}>
                    <span className={styles.testName}>
                      <FileText className={styles.testIcon} size={18} strokeWidth={2} aria-hidden="true" />
                      {test.title}
                    </span>
                    <span className={`${styles.subjectChip} ${tone ? toneClass[tone] : ""}`}>
                      <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
                      {subjectLabel(test.subject)}
                    </span>
                    <span className={`${styles.status} ${statusClass[test.status]}`}>
                      <span className={styles.statusDot} aria-hidden="true" />
                      {statusLabels[test.status]}
                    </span>
                    <Link
                      className={styles.rowAction}
                      href={
                        test.status === "in_progress" && test.inProgressAttemptId
                          ? `/dashboard/attempts/${test.inProgressAttemptId}`
                          : `/dashboard/tests/${test.id}`
                      }
                    >
                      {actionLabels[test.status]}
                      <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
