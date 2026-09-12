"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Circle, CircleCheck, CirclePlay } from "lucide-react";
import {
  DashboardLoading,
  DashboardShell,
  DashboardStateCard,
  DashboardUnauthorized,
  DashboardUnavailable,
  shellStyles,
} from "@/components/DashboardShell";
import { SubjectIcon } from "@/components/SubjectCard";
import { useSubjectLabel } from "@/components/SubjectsProvider";
import { TestActionButton } from "@/components/TestActionButton";
import { TestActionsMenu } from "@/components/TestActionsMenu";
import { TestFilters } from "@/components/TestFilters";
import { matchesFilter, type StudentTest, type StudentTestStatus, type TestFilter } from "@/lib/student-progress";
import { useStudentOverview } from "@/lib/use-student-overview";
import styles from "./subject.module.css";

/** The grid fits four; the rest of the subject is in "All tests" below. */
const PICK_UP_LIMIT = 4;

const statusLabels: Record<StudentTestStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Keep practicing",
  passed: "Passed",
};

const statusClass: Record<StudentTestStatus, string> = {
  not_started: styles.statusNotStarted,
  in_progress: styles.statusInProgress,
  completed: styles.statusCompleted,
  passed: styles.statusPassed,
};

/** What the card's bar counts, and the line that names it. A test can sit at
 *  three different points, and each measures something else — so no number is
 *  shown without saying what it is. */
function pickUpProgress(test: StudentTest) {
  const passMark = `${test.passPercentage}% to pass`;

  if (test.inProgressAttemptId) {
    const answered = test.inProgressAnswered ?? 0;
    return {
      percent: test.questionCount ? Math.min(100, Math.round((answered / test.questionCount) * 100)) : 0,
      start: `${answered} of ${test.questionCount} answered`,
      end: passMark,
      label: `${test.title} answered`,
    };
  }

  if (test.completed) {
    return {
      percent: Math.round(test.bestPercentage),
      start: `Best ${Math.round(test.bestPercentage)}%`,
      end: passMark,
      label: `${test.title} best result`,
    };
  }

  return {
    percent: 0,
    start: `${test.questionCount} ${test.questionCount === 1 ? "question" : "questions"}`,
    end: passMark,
    label: `${test.title} answered`,
  };
}

export default function SubjectPage({ params }: PageProps<"/dashboard/subjects/[subject]">) {
  const subjectLabel = useSubjectLabel();
  const { subject } = use(params);
  const { data, error, isLoading, reload } = useStudentOverview();
  const [filter, setFilter] = useState<TestFilter>("all");

  if (isLoading) {
    return <DashboardLoading label="Loading subject…" />;
  }

  if (error === "unauthorized") {
    return <DashboardUnauthorized />;
  }

  if (error === "unavailable" || !data) {
    return <DashboardUnavailable onRetry={() => void reload()} />;
  }

  const summary = data.subjects.find((item) => item.subject === subject);

  // A subject the child is not assigned reveals nothing, whether it exists or
  // not — the same answer either way.
  if (!summary) {
    return (
      <DashboardStateCard
        title="This subject is unavailable."
        description="It is not one of your assigned subjects."
        action={<Link className={shellStyles.stateAction} href="/dashboard/subjects">Back to subjects</Link>}
      />
    );
  }

  const label = subjectLabel(subject);
  const tests = data.tests.filter((test) => test.subject === subject);
  const inProgress = tests.filter((test) => test.inProgressAttemptId !== null);
  const notStarted = tests.filter((test) => !test.completed && test.inProgressAttemptId === null);
  // Completed below the pass mark is still work left to do, so it belongs here
  // after the untouched tests. A passed test has nothing to pick up.
  const notPassed = tests.filter((test) => test.completed && !test.passed && test.inProgressAttemptId === null);
  const pickUp = [...inProgress, ...notStarted, ...notPassed].slice(0, PICK_UP_LIMIT);
  const visible = tests.filter((test) => matchesFilter(test, filter));

  return (
    <DashboardShell
      userName={data.child.displayName}
      stars={data.stars}
      active="subjects"
      subject={subject}
      leading={
        <Link className={shellStyles.backLink} href="/dashboard/subjects">
          <ChevronLeft size={16} strokeWidth={2.6} aria-hidden="true" />
          All subjects
        </Link>
      }
    >
      <section className={styles.hero} aria-labelledby="subject-title">
        <div>
          <div className={styles.intro}>
            <span className={styles.badge} aria-hidden="true">
              <SubjectIcon subject={subject} size={82} />
            </span>
            <div>
              <p className={styles.eyebrow}>Subject</p>
              <h1 id="subject-title"><span className={styles.titleGradient}>{label}</span></h1>
              <p className={styles.introCopy}>Build your skills. Solve real problems. See your progress.</p>
            </div>
          </div>

          <div className={styles.summary}>
            <div className={styles.summaryTop}>
              <h2>Your progress</h2>
              <p className={styles.summaryShare}>
                <strong>{summary.passed}</strong> of {summary.assigned} passed
              </p>
            </div>

            <div
              className={styles.bar}
              role="progressbar"
              aria-label={`${label} tests passed`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={summary.progress}
            >
              <span style={{ width: `${summary.progress}%` }} />
            </div>
          </div>

          <dl className={styles.stats}>
            {([
              { key: "completed", label: "Tests completed", count: summary.completed, Icon: CircleCheck, tone: styles.statCompleted },
              { key: "inProgress", label: "In progress", count: inProgress.length, Icon: CirclePlay, tone: styles.statInProgress },
              { key: "notStarted", label: "Not started", count: notStarted.length, Icon: Circle, tone: styles.statNotStarted },
            ] as const).map(({ key, label: name, count, Icon, tone }) => (
              <div className={styles.stat} key={key}>
                <span className={`${styles.statIcon} ${tone}`} aria-hidden="true">
                  <Icon strokeWidth={2.2} />
                </span>
                <dt>{name}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.art} aria-hidden="true" />
      </section>

      {tests.length > 0 && (
        <section className={styles.section} aria-labelledby="pick-up-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="pick-up-title">Continue learning</h2>
              <p>Pick up where you left off</p>
            </div>
          </div>

          {pickUp.length === 0 ? (
            <div className={styles.emptyPanel}>
              <p>Every test here is passed.</p>
              <span>Open one from All tests to practise it again.</span>
            </div>
          ) : (
          <div className={styles.pickUpGrid}>
            {pickUp.map((test) => {
              const progress = pickUpProgress(test);

              return (
                <article className={styles.pickUpCard} key={test.stableId}>
                  <h3>{test.title}</h3>
                  <p className={styles.pickUpMeta}>
                    <span>{progress.end}</span>
                    <span>{progress.start}</span>
                  </p>

                  <div className={styles.pickUpProgress}>
                    <div
                      className={styles.pickUpBar}
                      role="progressbar"
                      aria-label={progress.label}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress.percent}
                    >
                      <span style={{ width: `${progress.percent}%` }} />
                    </div>
                    <span className={styles.pickUpPercent}>{progress.percent}%</span>
                  </div>

                  <div className={styles.pickUpAction}>
                    <TestActionButton test={test} />
                  </div>
                </article>
              );
            })}
          </div>
          )}
        </section>
      )}

      <section className={styles.section} aria-labelledby="all-tests-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="all-tests-title">All tests</h2>
            <p>Choose a test to start a new attempt</p>
          </div>
          {tests.length > 0 && <TestFilters value={filter} onChange={setFilter} tests={tests} />}
        </div>

        {visible.length === 0 ? (
          <div className={styles.emptyPanel}>
            {tests.length === 0 ? (
              <>
                <p>No tests assigned yet.</p>
                <span>Your administrator will add them here.</span>
              </>
            ) : (
              <>
                <p>Nothing matches this filter.</p>
                <span>
                  <button className={shellStyles.backLink} type="button" onClick={() => setFilter("all")}>
                    Show all tests
                  </button>
                </span>
              </>
            )}
          </div>
        ) : (
          <div className={styles.testGrid}>
            {visible.map((test) => (
              <article className={styles.testRow} key={test.stableId}>
                <div>
                  <h3>{test.title}</h3>
                  <p className={styles.testMeta}>
                    <span>{test.questionCount} {test.questionCount === 1 ? "question" : "questions"}</span>
                    <span aria-hidden="true">·</span>
                    <span>{test.passPercentage}% to pass</span>
                    <span aria-hidden="true">·</span>
                    <span className={`${styles.status} ${statusClass[test.status]}`}>
                      <span className={styles.statusDot} aria-hidden="true" />
                      {statusLabels[test.status]}
                      {test.completed && ` · best ${test.bestPercentage}%`}
                    </span>
                  </p>
                </div>
                <TestActionsMenu
                  testId={test.id}
                  attemptCount={test.attemptCount}
                  inProgressAttemptId={test.inProgressAttemptId}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
