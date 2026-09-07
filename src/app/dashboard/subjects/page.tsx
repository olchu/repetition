"use client";

import {
  DashboardLoading,
  DashboardShell,
  DashboardUnauthorized,
  DashboardUnavailable,
  shellStyles,
} from "@/components/DashboardShell";
import { SubjectCard, subjectCardStyles } from "@/components/SubjectCard";
import { useStudentOverview } from "@/lib/use-student-overview";
import styles from "./subjects.module.css";

/** Every subject assigned to the child — including ones the administrator has
 *  not put tests in yet, which stay visible so the child knows they exist. */
export default function SubjectsPage() {
  const { data, error, isLoading, reload } = useStudentOverview();

  if (isLoading) {
    return <DashboardLoading label="Loading your subjects…" />;
  }

  if (error === "unauthorized") {
    return <DashboardUnauthorized />;
  }

  if (error === "unavailable" || !data) {
    return <DashboardUnavailable onRetry={() => void reload()} />;
  }

  return (
    <DashboardShell userName={data.child.displayName} stars={data.stars} active="subjects">
      <header className={shellStyles.pageHead}>
        <h1>Subjects</h1>
        <p>Everything you have been assigned. Open a subject to see its tests.</p>
      </header>

      {data.subjects.length === 0 ? (
        <div className={styles.emptyPanel}>
          <p>No subjects assigned yet.</p>
          <span>Your administrator will add your subjects here.</span>
        </div>
      ) : (
        <div className={subjectCardStyles.grid}>
          {data.subjects.map((subject) => (
            <SubjectCard
              key={subject.subject}
              summary={subject}
              meta={
                <p
                  className={`${subjectCardStyles.meta} ${
                    subject.assigned === 0 ? subjectCardStyles.waiting : ""
                  }`}
                >
                  {subject.assigned === 0 ? (
                    "No tests assigned yet"
                  ) : (
                    <>
                      <strong>{subject.assigned}</strong> assigned · <strong>{subject.completed}</strong> completed ·{" "}
                      <strong>{subject.passed}</strong> passed
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
