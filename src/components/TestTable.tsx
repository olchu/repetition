"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { StudentTest, StudentTestStatus } from "@/lib/student-progress";
import { useSubjectLabel } from "./SubjectsProvider";
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
  /** The set's name under each title, linking to the set; for lists that mix sets. */
  showSet?: boolean;
  /** Filters or links that belong next to the heading. */
  toolbar?: ReactNode;
  /** Shown instead of rows; word it for why the list came back empty. */
  empty: { title: string; hint: ReactNode };
};

export function TestTable({ title, tests, showSubject = true, showSet = false, toolbar, empty }: TestTableProps) {
  const subjectLabel = useSubjectLabel();
  const headingId = `test-table-${title.replace(/\W+/g, "-").toLowerCase()}`;
  const signature = tests.map((test) => test.stableId).join("\n");
  const [position, setPosition] = useState({ signature, page: 0 });
  if (position.signature !== signature) setPosition({ signature, page: 0 });
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(tests.length / pageSize));
  const page = position.signature === signature ? Math.min(position.page, pageCount - 1) : 0;
  const shown = tests.slice(page * pageSize, (page + 1) * pageSize);

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
          shown.map((test) => (
            <article className={styles.tableRow} key={test.stableId} data-subject={test.subject}>
              <span className={styles.testName}>
                <FileText className={styles.testIcon} size={18} strokeWidth={2} aria-hidden="true" />
                <span className={styles.testTitle}>
                  {test.title}
                  {!test.rewardEligible && <small className={styles.rewardNote}>Practice · No stars</small>}
                  {showSet && test.set && (
                    <Link className={styles.setLink} href={`/dashboard/sets/${test.set.id}`}>{test.set.name}</Link>
                  )}
                </span>
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
                  rewardEligible={test.rewardEligible}
                />
              </span>
            </article>
          ))
        )}
      </div>
      {pageCount > 1 && <nav className={styles.pagination} aria-label={`${title} pages`}>
        <button type="button" disabled={page === 0} onClick={() => setPosition({ signature, page: page - 1 })}>Previous</button>
        <span role="status">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, tests.length)} of {tests.length} · Page {page + 1} of {pageCount}</span>
        <button type="button" disabled={page + 1 === pageCount} onClick={() => setPosition({ signature, page: page + 1 })}>Next</button>
      </nav>}
    </section>
  );
}
