"use client";

import type { ReactNode } from "react";
import type { StudentTest } from "@/lib/student-progress";
import { useSubjectLabel } from "./SubjectsProvider";
import { TestActionButton } from "./TestActionButton";
import styles from "./TestCard.module.css";

/** What the card's bar counts, and the line that names it. A test can sit at
 *  three different points, and each measures something else — so no number is
 *  shown without saying what it is. */
function cardProgress(test: StudentTest) {
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

type TestCardProps = {
  test: StudentTest;
  /** On Home, where cards from every subject sit together. */
  showSubject?: boolean;
};

/** A test to pick up: the Home widgets and a subject's "Continue learning". */
export function TestCard({ test, showSubject = false }: TestCardProps) {
  const subjectLabel = useSubjectLabel();
  const progress = cardProgress(test);
  const isNew = !test.completed && test.inProgressAttemptId === null;

  return (
    <article className={styles.card} data-subject={showSubject ? test.subject : undefined}>
      {(showSubject || test.set || isNew) && (
        <p className={styles.context}>
          {showSubject && <span className={styles.subject}>{subjectLabel(test.subject)}</span>}
          {test.set && <span className={styles.set}>{test.set.name}</span>}
          {isNew && <span className={styles.newBadge}>New</span>}
        </p>
      )}
      <h3>{test.title}</h3>
      <p className={styles.meta}>
        <span>{progress.end}</span>
        <span>{progress.start}</span>
      </p>

      <div className={styles.progress}>
        <div
          className={styles.bar}
          role="progressbar"
          aria-label={progress.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
        >
          <span style={{ width: `${progress.percent}%` }} />
        </div>
        <span className={styles.percent}>{progress.percent}%</span>
      </div>

      <div className={styles.action}>
        <TestActionButton test={test} />
      </div>
    </article>
  );
}

export function TestCardGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
