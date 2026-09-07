"use client";

import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import type { StudentTest, StudentTestStatus } from "@/lib/student-progress";
import { subjectLabel } from "./SubjectCard";
import { TestActionsMenu } from "./TestActionsMenu";
import styles from "./TestTable.module.css";

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

type TestTableProps = {
  title: string;
  tests: readonly StudentTest[];
  /** Hidden inside a single subject, where it would repeat the page title. */
  showSubject?: boolean;
  /** Filters or links that belong next to the heading. */
  toolbar?: ReactNode;
  /** Shown instead of rows; word it for why the list came back empty. */
  empty: { title: string; hint: ReactNode };
};

export function TestTable({ title, tests, showSubject = true, toolbar, empty }: TestTableProps) {
  const headingId = `test-table-${title.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <section
      className={`${styles.panel} ${showSubject ? "" : styles.withoutSubject}`}
      aria-labelledby={headingId}
    >
      <div className={styles.panelHeader}>
        <h2 id={headingId}>{title}</h2>
        {toolbar}
      </div>

      <div className={styles.table}>
        <div className={styles.tableHead} role="presentation">
          <span>Test name</span>
          {showSubject && <span>Subject</span>}
          <span className={styles.headNumber}>Questions</span>
          <span className={styles.headNumber}>Pass mark</span>
          <span>Status</span>
          <span />
        </div>

        {tests.length === 0 ? (
          <div className={styles.emptyTable}>
            <p>{empty.title}</p>
            <span>{empty.hint}</span>
          </div>
        ) : (
          tests.map((test) => (
            <article className={styles.tableRow} key={test.stableId} data-subject={test.subject}>
              <span className={styles.testName}>
                <FileText className={styles.testIcon} size={18} strokeWidth={2} aria-hidden="true" />
                {test.title}
              </span>
              {showSubject && <span className={styles.subjectChip}>{subjectLabel(test.subject)}</span>}
              <span className={styles.cellNumber}>
                <b>{test.questionCount}</b>
                <i>{test.questionCount === 1 ? "question" : "questions"}</i>
              </span>
              <span className={styles.cellNumber}>
                <b>{test.passPercentage}%</b>
                <i>to pass</i>
              </span>
              <span className={`${styles.status} ${statusClass[test.status]}`}>
                <span className={styles.statusDot} aria-hidden="true" />
                {statusLabels[test.status]}
              </span>
              <span className={styles.rowMenu}>
                <TestActionsMenu
                  testId={test.id}
                  attemptCount={test.attemptCount}
                  inProgressAttemptId={test.inProgressAttemptId}
                />
              </span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
