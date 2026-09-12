"use client";

import { useState } from "react";
import { BookOpen, FileText } from "lucide-react";
import {
  DashboardLoading,
  DashboardShell,
  DashboardUnauthorized,
  DashboardUnavailable,
} from "@/components/DashboardShell";
import { SubjectCard, subjectCardStyles, subjectLabel } from "@/components/SubjectCard";
import type { StudentSubjectSummary } from "@/lib/student-progress";
import { useStudentOverview } from "@/lib/use-student-overview";
import styles from "./subjects.module.css";

type SortOrder = "assigned" | "progress" | "name";

const sortOrders: ReadonlyArray<{ value: SortOrder; label: string }> = [
  { value: "assigned", label: "Your order" },
  { value: "progress", label: "Progress" },
  { value: "name", label: "Name" },
];

const RING_RADIUS = 20;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** The administrator's order is the default; the others are the child's own
 *  way of looking at the same list. */
function sortSubjects(subjects: readonly StudentSubjectSummary[], order: SortOrder) {
  if (order === "assigned") return [...subjects];
  if (order === "name") {
    return [...subjects].sort((a, b) => subjectLabel(a.subject).localeCompare(subjectLabel(b.subject)));
  }
  return [...subjects].sort((a, b) => b.progress - a.progress || subjectLabel(a.subject).localeCompare(subjectLabel(b.subject)));
}

/** Every subject assigned to the child — including ones the administrator has
 *  not put tests in yet, which stay visible so the child knows they exist. */
export default function SubjectsPage() {
  const { data, error, isLoading, reload } = useStudentOverview();
  const [order, setOrder] = useState<SortOrder>("assigned");

  if (isLoading) {
    return <DashboardLoading label="Loading your subjects…" />;
  }

  if (error === "unauthorized") {
    return <DashboardUnauthorized />;
  }

  if (error === "unavailable" || !data) {
    return <DashboardUnavailable onRetry={() => void reload()} />;
  }

  const assignedTests = data.tests.length;
  const passedTests = data.tests.filter((test) => test.passed).length;
  const overall = assignedTests ? Math.round((passedTests / assignedTests) * 100) : 0;

  return (
    <DashboardShell
      userName={data.child.displayName}
      stars={data.stars}
      active="subjects"
      leading={<p className={styles.eyebrow}>Your learning room</p>}
    >
      <header className={styles.head}>
        <h1>Your <span className={styles.headAccent}>subjects</span></h1>
        <p>Choose a subject to continue learning and review assigned tests.</p>
      </header>

      <section className={styles.stats} aria-label="Summary">
        <article className={styles.stat}>
          <span className={`${styles.statIcon} ${styles.statSubjects}`} aria-hidden="true">
            <BookOpen size={24} strokeWidth={2.2} />
          </span>
          <p className={styles.statText}>
            <strong>{data.subjects.length}</strong>
            <span>{data.subjects.length === 1 ? "subject" : "subjects"}</span>
          </p>
        </article>

        <article className={styles.stat}>
          <span className={`${styles.statIcon} ${styles.statTests}`} aria-hidden="true">
            <FileText size={24} strokeWidth={2.2} />
          </span>
          <p className={styles.statText}>
            <strong>{assignedTests}</strong>
            <span>{assignedTests === 1 ? "assigned test" : "assigned tests"}</span>
          </p>
        </article>

        <article className={styles.stat}>
          <span className={styles.statRing} aria-hidden="true">
            <svg viewBox="0 0 52 52">
              <circle className={styles.ringTrack} cx="26" cy="26" r={RING_RADIUS} />
              <circle
                className={styles.ringValue}
                cx="26"
                cy="26"
                r={RING_RADIUS}
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH * (1 - overall / 100)}
              />
            </svg>
          </span>
          <p className={styles.statText}>
            <strong>{overall}%</strong>
            <span>of assigned tests passed</span>
          </p>
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
          {sortSubjects(data.subjects, order).map((subject) => (
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
    </DashboardShell>
  );
}
