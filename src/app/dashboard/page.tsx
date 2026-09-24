"use client";

import Link from "next/link";
import { ChevronRight, FileText, Rocket, Sparkles } from "lucide-react";
import { SubjectCard, subjectCardStyles } from "@/components/SubjectCard";
import { TestActionButton } from "@/components/TestActionButton";
import { TestCard, TestCardGrid } from "@/components/TestCard";
import { useSubjectLabel } from "@/components/SubjectsProvider";
import { byNewestAssignment, matchesFilter } from "@/lib/student-progress";
import { useStudentOverview } from "@/lib/use-student-overview";
import styles from "./home.module.css";

/** Home stays a short overview: four subjects at most, and the full lists
 *  live in Subjects and in the test sections it links to. */
const HOME_SUBJECT_LIMIT = 4;

/** Each test widget is one row of cards; See all opens Tests filtered to it. */
const HOME_TEST_LIMIT = 4;

const RING_RADIUS = 52;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export default function DashboardPage() {
  const { data } = useStudentOverview();
  const subjectLabel = useSubjectLabel();
  if (!data) return null;

  const passedCount = data.tests.filter((test) => test.passed).length;
  const assignedCount = data.tests.length;
  const overall = assignedCount ? Math.round((passedCount / assignedCount) * 100) : 0;
  const name = data.child.displayName;
  const continueTests = data.tests.filter((test) => test.inProgressAttemptId !== null);
  // "New" is every test the child hasn't opened yet, most recently assigned first.
  const newTests = data.tests.filter((test) => matchesFilter(test, "not_started")).sort(byNewestAssignment);
  // Phones lead with the one test to pick up; the Continue widget then only
  // repeats it, so it is dropped there when that test is the only one.
  const upNext = continueTests[0] ?? null;
  // The ring counts passed tests, so the phone card says that in words.
  const progressTitle = assignedCount === 0
    ? "Your tests will appear here"
    : passedCount === 0
      ? "Let’s get started!"
      : passedCount === assignedCount
        ? "All tests passed!"
        : "You’re making great progress!";

  return (
    <>
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
          {/* Phones only: the card turns white and explains the ring. */}
          <div className={styles.progressText}>
            <strong>{progressTitle}</strong>
            <span>{passedCount} of {assignedCount} {assignedCount === 1 ? "test" : "tests"} passed</span>
          </div>
          <Link className={styles.progressLink} href="/dashboard/tests" aria-label="All tests">
            <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </aside>
      </section>

      {upNext && (
        <section className={styles.upNext} data-subject={upNext.subject} aria-labelledby="up-next-title">
          <span className={styles.upNextIcon} aria-hidden="true">
            <FileText size={24} strokeWidth={2} />
          </span>
          <div className={styles.upNextText}>
            <p className={styles.upNextEyebrow}>Up next</p>
            <h2 id="up-next-title">{upNext.title}</h2>
            <p className={styles.upNextMeta}>
              {subjectLabel(upNext.subject)}
              <span aria-hidden="true">•</span>
              {upNext.questionCount} {upNext.questionCount === 1 ? "question" : "questions"}
            </p>
          </div>
          <div className={styles.upNextAction}>
            <TestActionButton test={upNext} />
          </div>
        </section>
      )}

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

      {continueTests.length > 0 && (
        <section
          className={`${styles.section} ${continueTests.length === 1 ? styles.hiddenOnPhone : ""}`}
          aria-labelledby="continue-title"
        >
          <div className={styles.sectionHeader}>
            <h2 id="continue-title">Continue<span className={styles.count}>{continueTests.length}</span></h2>
            {continueTests.length > HOME_TEST_LIMIT && (
              <Link className={styles.seeAll} href="/dashboard/tests?status=in_progress">See all</Link>
            )}
          </div>
          <TestCardGrid>
            {continueTests.slice(0, HOME_TEST_LIMIT).map((test) => <TestCard key={test.stableId} test={test} showSubject />)}
          </TestCardGrid>
        </section>
      )}

      <section className={styles.section} aria-labelledby="new-tests-title">
        <div className={styles.sectionHeader}>
          <h2 id="new-tests-title">New tests{newTests.length > 0 && <span className={styles.count}>{newTests.length}</span>}</h2>
          {data.tests.length > 0 && (
            newTests.length > HOME_TEST_LIMIT
              ? <Link className={styles.seeAll} href="/dashboard/tests?status=not_started">See all</Link>
              : <Link className={styles.seeAll} href="/dashboard/tests">All tests</Link>
          )}
        </div>

        {newTests.length === 0 ? (
          <div className={styles.emptyWidget}>
            <p>{data.tests.length === 0 ? "No tests assigned yet." : "No new tests right now."}</p>
            <span>{data.tests.length === 0 ? "Your administrator will add the next one here." : "You’ve opened every test assigned to you."}</span>
          </div>
        ) : (
          <TestCardGrid>
            {newTests.slice(0, HOME_TEST_LIMIT).map((test) => <TestCard key={test.stableId} test={test} showSubject />)}
          </TestCardGrid>
        )}
      </section>

      <aside className={styles.cheer} aria-label="Keep going">
        <p>
          <Sparkles className={styles.cheerSparkle} size={22} strokeWidth={2} aria-hidden="true" />
          Keep going, {name}!
        </p>
        <span>&ldquo;One step at a time.&rdquo;</span>
        <Rocket className={styles.cheerRocket} size={34} strokeWidth={1.8} aria-hidden="true" />
      </aside>
    </>
  );
}
