"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  DashboardLoading,
  DashboardShell,
  DashboardStateCard,
  DashboardUnauthorized,
  DashboardUnavailable,
  shellStyles,
} from "@/components/DashboardShell";
import { subjectLabel } from "@/components/SubjectCard";
import { TestFilters } from "@/components/TestFilters";
import { TestTable } from "@/components/TestTable";
import { matchesFilter, type TestFilter } from "@/lib/student-progress";
import { useStudentOverview } from "@/lib/use-student-overview";
import styles from "../subjects.module.css";

export default function SubjectPage({ params }: PageProps<"/dashboard/subjects/[subject]">) {
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
  const visible = tests.filter((test) => matchesFilter(test, filter));

  return (
    <DashboardShell userName={data.child.displayName} stars={data.stars} active="subjects">
      <Link className={shellStyles.backLink} href="/dashboard/subjects">
        <ArrowLeft size={15} strokeWidth={2.4} aria-hidden="true" />
        All subjects
      </Link>

      <header className={shellStyles.pageHead}>
        <h1>{label}</h1>
      </header>

      <p className={styles.summary} data-subject={subject}>
        <span><strong>{summary.assigned}</strong> assigned</span>
        <span><strong>{summary.completed}</strong> completed</span>
        <span><strong>{summary.passed}</strong> passed</span>
      </p>

      {summary.assigned > 0 && (
        <div
          className={styles.subjectProgress}
          data-subject={subject}
          role="progressbar"
          aria-label={`${label} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.progress}
        >
          <span style={{ width: `${summary.progress}%` }} />
        </div>
      )}

      <TestTable
        title="Tests"
        tests={visible}
        showSubject={false}
        toolbar={tests.length > 0 ? <TestFilters value={filter} onChange={setFilter} tests={tests} /> : undefined}
        empty={
          tests.length === 0
            ? { title: "No tests assigned yet.", hint: "Your administrator will add them here." }
            : {
                title: "Nothing matches this filter.",
                hint: (
                  <button className={shellStyles.backLink} type="button" onClick={() => setFilter("all")}>
                    Show all tests
                  </button>
                ),
              }
        }
      />
    </DashboardShell>
  );
}
