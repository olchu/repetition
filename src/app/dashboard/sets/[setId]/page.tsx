"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Circle, CircleCheck, CirclePlay, Layers } from "lucide-react";
import {
  DashboardStateCard,
  shellStyles,
} from "@/components/DashboardShell";
import { useSubjectLabel } from "@/components/SubjectsProvider";
import { TestCard, TestCardGrid } from "@/components/TestCard";
import { TestFilters } from "@/components/TestFilters";
import { TestTable } from "@/components/TestTable";
import { matchesFilter, type TestFilter } from "@/lib/student-progress";
import { useStudentOverview } from "@/lib/use-student-overview";
import styles from "./set.module.css";

/** The grid fits four; the rest of the set is in the table below. */
const PICK_UP_LIMIT = 4;

/** One set of tests: its progress, what to pick up, and every test in it. */
export default function SetPage({ params }: PageProps<"/dashboard/sets/[setId]">) {
  const { setId } = use(params);
  const subjectLabel = useSubjectLabel();
  const { data } = useStudentOverview();
  const [filter, setFilter] = useState<TestFilter>("all");
  if (!data) return null;

  const summary = data.sets.find((set) => set.id === setId);

  // A set with none of the child's tests reveals nothing, whether it exists or not.
  if (!summary) {
    return (
      <DashboardStateCard
        title="This set is unavailable."
        description="None of its tests are assigned to you."
        action={<Link className={shellStyles.stateAction} href="/dashboard/tests">Back to tests</Link>}
        embedded
      />
    );
  }

  const singleSubject = summary.subjects.length === 1 ? summary.subjects[0] : undefined;
  const tests = data.tests.filter((test) => test.set?.id === setId);
  const inProgress = tests.filter((test) => test.inProgressAttemptId !== null);
  const notStarted = tests.filter((test) => matchesFilter(test, "not_started"));
  // Completed below the pass mark is still work left to do; passed tests have nothing to pick up.
  const notPassed = tests.filter((test) => test.completed && !test.passed && test.inProgressAttemptId === null);
  const pickUp = [...inProgress, ...notStarted, ...notPassed].slice(0, PICK_UP_LIMIT);
  const visible = tests.filter((test) => matchesFilter(test, filter));

  return (
    <>
      <section className={styles.hero} aria-labelledby="set-title">
        <div className={styles.intro}>
          <span className={styles.badge} aria-hidden="true">
            <Layers size={40} strokeWidth={2} />
          </span>
          <div>
            <p className={styles.eyebrow}>Set · {summary.subjects.map(subjectLabel).join(" · ")}</p>
            <h1 id="set-title">{summary.name}</h1>
            {summary.description && <p className={styles.introCopy}>{summary.description}</p>}
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
            aria-label={`${summary.name} tests passed`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.progress}
          >
            <span style={{ width: `${summary.progress}%` }} />
          </div>
          <dl className={styles.stats}>
            {([
              { key: "completed", label: "Completed", count: summary.completed, Icon: CircleCheck, tone: styles.statCompleted },
              { key: "inProgress", label: "In progress", count: summary.inProgress, Icon: CirclePlay, tone: styles.statInProgress },
              { key: "notStarted", label: "Not started", count: summary.notStarted, Icon: Circle, tone: styles.statNotStarted },
            ] as const).map(({ key, label, count, Icon, tone }) => (
              <div className={`${styles.stat} ${tone}`} key={key}>
                <Icon strokeWidth={2.2} aria-hidden="true" />
                <dt>{label}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="set-pick-up-title">
        <div className={styles.sectionHeader}>
          <h2 id="set-pick-up-title">Continue learning</h2>
          <p>Pick up where you left off</p>
        </div>
        {pickUp.length === 0 ? (
          <div className={styles.emptyPanel}>
            <p>Every test in this set is passed.</p>
            <span>Open one below to practise it again.</span>
          </div>
        ) : (
          <TestCardGrid>
            {pickUp.map((test) => <TestCard key={test.stableId} test={test} showSubject={!singleSubject} showSet={false} />)}
          </TestCardGrid>
        )}
      </section>

      <TestTable
        title="All tests in this set"
        tests={visible}
        showSubject={!singleSubject}
        toolbar={<TestFilters value={filter} onChange={setFilter} tests={tests} />}
        empty={{
          title: "Nothing matches this filter.",
          hint: <button className={shellStyles.backLink} type="button" onClick={() => setFilter("all")}>Show all tests</button>,
        }}
      />
    </>
  );
}
