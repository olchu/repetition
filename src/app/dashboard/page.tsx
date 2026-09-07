"use client";

import Link from "next/link";
import {
  DashboardLoading,
  DashboardShell,
  DashboardUnauthorized,
  DashboardUnavailable,
} from "@/components/DashboardShell";
import { SubjectCard, subjectCardStyles } from "@/components/SubjectCard";
import { TestTable } from "@/components/TestTable";
import { useStudentOverview } from "@/lib/use-student-overview";
import styles from "./home.module.css";

/** Home stays a short overview: four subjects at most, and the full lists
 *  live in Subjects and in the test sections it links to. */
const HOME_SUBJECT_LIMIT = 4;

const RING_RADIUS = 52;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export default function DashboardPage() {
  const { data, error, isLoading, reload } = useStudentOverview();

  if (isLoading) {
    return <DashboardLoading label="Loading your learning room…" />;
  }

  if (error === "unauthorized") {
    return <DashboardUnauthorized />;
  }

  if (error === "unavailable" || !data) {
    return <DashboardUnavailable onRetry={() => void reload()} />;
  }

  const passedCount = data.tests.filter((test) => test.passed).length;
  const assignedCount = data.tests.length;
  const overall = assignedCount ? Math.round((passedCount / assignedCount) * 100) : 0;
  const name = data.child.displayName;

  return (
    <DashboardShell userName={name} stars={data.stars} active="home">
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
          <h2 id="subjects-title">Subjects</h2>
          {data.subjects.length > 0 && (
            <Link className={styles.seeAll} href="/dashboard/subjects">See all</Link>
          )}
        </div>

        {data.subjects.length === 0 ? (
          <p className={styles.emptySubjects}>No subjects assigned yet.</p>
        ) : (
          <div className={subjectCardStyles.grid}>
            {data.subjects.slice(0, HOME_SUBJECT_LIMIT).map((subject) => {
              const remaining = Math.max(0, subject.assigned - subject.passed);
              const allPassed = subject.assigned > 0 && remaining === 0;

              return (
                <SubjectCard
                  key={subject.subject}
                  summary={subject}
                  meta={
                    <p
                      className={`${subjectCardStyles.meta} ${
                        subject.assigned === 0
                          ? subjectCardStyles.waiting
                          : allPassed
                            ? subjectCardStyles.passed
                            : subjectCardStyles.pending
                      }`}
                    >
                      {subject.assigned === 0 ? (
                        "Waiting for tests"
                      ) : allPassed ? (
                        <><strong>100%</strong> · All tests passed</>
                      ) : (
                        <>{remaining} {remaining === 1 ? "test" : "tests"} to pass{subject.progress > 0 && <> · <strong>{subject.progress}%</strong></>}</>
                      )}
                    </p>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <TestTable
        title="Assigned tests"
        tests={data.tests}
        empty={{
          title: "No tests assigned yet.",
          hint: "Your administrator will add the next one here.",
        }}
      />
    </DashboardShell>
  );
}
