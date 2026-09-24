"use client";

import { useState } from "react";
import { BookOpen, Check, FileText, Sparkles } from "lucide-react";
import { SubjectCard, subjectCardStyles } from "@/components/SubjectCard";
import { useSubjectLabel } from "@/components/SubjectsProvider";
import type { StudentSubjectSummary } from "@/lib/student-progress";
import { useStudentOverview } from "@/lib/use-student-overview";
import styles from "./subjects.module.css";

type SortOrder = "assigned" | "progress" | "name";

const sortOrders: ReadonlyArray<{ value: SortOrder; label: string }> = [
  { value: "assigned", label: "Your order" },
  { value: "progress", label: "Progress" },
  { value: "name", label: "Name" },
];

/** The administrator's order is the default; the others are the child's own
 *  way of looking at the same list. */
function sortSubjects(subjects: readonly StudentSubjectSummary[], order: SortOrder, subjectLabel: (slug: string) => string) {
  if (order === "assigned") return [...subjects];
  if (order === "name") {
    return [...subjects].sort((a, b) => subjectLabel(a.subject).localeCompare(subjectLabel(b.subject)));
  }
  return [...subjects].sort((a, b) => b.progress - a.progress || subjectLabel(a.subject).localeCompare(subjectLabel(b.subject)));
}

/** Every subject assigned to the child — including ones the administrator has
 *  not put tests in yet, which stay visible so the child knows they exist. */
export default function SubjectsPage() {
  const subjectLabel = useSubjectLabel();
  const { data } = useStudentOverview();
  const [order, setOrder] = useState<SortOrder>("assigned");
  if (!data) return null;

  const assignedTests = data.tests.length;
  const passedTests = data.tests.filter((test) => test.passed).length;
  const overall = assignedTests ? Math.round((passedTests / assignedTests) * 100) : 0;
  const testsToPass = Math.max(assignedTests - passedTests, 0);

  return (
    <>
      <header className={styles.head}>
        <h1>Your <span className={styles.headAccent}>subjects</span></h1>
        <p>Choose a subject to continue learning and review assigned tests.</p>
      </header>

      <section className={styles.stats} aria-label="Your learning snapshot">
        <article className={styles.progressSummary}>
          <div className={styles.summaryCopy}>
            <span className={styles.summaryEyebrow}>
              <Sparkles size={15} strokeWidth={2.4} aria-hidden="true" />
              Overall progress
            </span>
            <p className={styles.summaryLead}>
              <strong>{passedTests}<span>/{assignedTests}</span></strong>
              tests passed
            </p>
            <p className={styles.summaryHint}>
              {assignedTests === 0
                ? "Your tests will appear here once they are assigned."
                : testsToPass === 0
                  ? "Everything assigned is passed — brilliant work!"
                  : `${testsToPass} ${testsToPass === 1 ? "test" : "tests"} left to complete your goal.`}
            </p>
          </div>

          <div className={styles.progressVisual}>
            <span className={styles.progressPercent}>{overall}%</span>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label="Assigned tests passed"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={overall}
            >
              <span style={{ width: `${overall}%` }} />
            </div>
            <span className={styles.progressCaption}>
              <Check size={14} strokeWidth={2.8} aria-hidden="true" />
              {assignedTests === 0 ? "Ready when you are" : "Keep moving forward"}
            </span>
          </div>
        </article>

        <article className={styles.stat}>
          <span className={`${styles.statIcon} ${styles.statSubjects}`} aria-hidden="true">
            <BookOpen size={24} strokeWidth={2.2} />
          </span>
          <p className={styles.statText}>
            <strong>{data.subjects.length}</strong>
            <span>{data.subjects.length === 1 ? "subject" : "subjects"}</span>
          </p>
          <span className={styles.statNote}>in your learning plan</span>
        </article>

        <article className={styles.stat}>
          <span className={`${styles.statIcon} ${styles.statTests}`} aria-hidden="true">
            <FileText size={24} strokeWidth={2.2} />
          </span>
          <p className={styles.statText}>
            <strong>{assignedTests}</strong>
            <span>{assignedTests === 1 ? "assigned test" : "assigned tests"}</span>
          </p>
          <span className={styles.statNote}>ready to work through</span>
        </article>
      </section>

      <div className={styles.sectionHeader}>
        <h2>All subjects</h2>
        {data.subjects.length > 1 && (
          <label className={styles.sort}>
            Sort by
            <select value={order} onChange={(event) => setOrder(event.target.value as SortOrder)}>
              {sortOrders.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {data.subjects.length === 0 ? (
        <div className={styles.emptyPanel}>
          <p>No subjects assigned yet.</p>
          <span>Your administrator will add your subjects here.</span>
        </div>
      ) : (
        <div className={subjectCardStyles.gridWide}>
          {sortSubjects(data.subjects, order, subjectLabel).map((subject) => (
            <SubjectCard
              key={subject.subject}
              summary={subject}
              variant="wide"
              meta={
                <p className={`${subjectCardStyles.meta} ${styles.cardMeta}`}>
                  {subject.assigned === 0 ? (
                    <span className={subjectCardStyles.waiting}>No tests assigned yet</span>
                  ) : (
                    <>
                      <span>
                        {subject.assigned} {subject.assigned === 1 ? "test" : "tests"} · {subject.completed} completed
                      </span>
                      <span className={styles.cardShare}>{subject.progress}% passed</span>
                    </>
                  )}
                </p>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
