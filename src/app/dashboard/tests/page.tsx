"use client";

import { use, useState } from "react";
import { Search } from "lucide-react";
import {
  DashboardLoading,
  DashboardShell,
  DashboardUnauthorized,
  DashboardUnavailable,
  shellStyles,
} from "@/components/DashboardShell";
import { useSubjectLabel } from "@/components/SubjectsProvider";
import { TestFilters } from "@/components/TestFilters";
import { TestTable } from "@/components/TestTable";
import { groupBySet, matchesFilter, testFilters, type TestFilter } from "@/lib/student-progress";
import { useStudentOverview } from "@/lib/use-student-overview";
import styles from "./tests.module.css";

/** `?status=` opens the page on one filter; Home's See all links use it. */
function readFilter(value: string | string[] | undefined): TestFilter {
  return testFilters.find((filter) => filter.value === value)?.value ?? "all";
}

/** Every assigned test in one place, one table per set of the administrator. */
export default function TestsPage({ searchParams }: PageProps<"/dashboard/tests">) {
  const { status } = use(searchParams);
  const subjectLabel = useSubjectLabel();
  const { data, error, isLoading, reload } = useStudentOverview();
  const [filter, setFilter] = useState<TestFilter>(() => readFilter(status));
  const [subject, setSubject] = useState("");
  const [search, setSearch] = useState("");

  if (isLoading) {
    return <DashboardLoading label="Loading your tests…" />;
  }

  if (error === "unauthorized") {
    return <DashboardUnauthorized />;
  }

  if (error === "unavailable" || !data) {
    return <DashboardUnavailable onRetry={() => void reload()} />;
  }

  const query = search.trim().toLowerCase();
  const subjects = [...new Set(data.tests.map((test) => test.subject))].sort((a, b) => subjectLabel(a).localeCompare(subjectLabel(b)));
  // Counted before the state filter, so each filter button shows what it would reveal.
  const scoped = data.tests.filter((test) =>
    (!subject || test.subject === subject)
    && (!query || test.title.toLowerCase().includes(query) || Boolean(test.set?.name.toLowerCase().includes(query))));
  const visible = scoped.filter((test) => matchesFilter(test, filter));
  const groups = groupBySet(visible);
  const hasSets = data.tests.some((test) => test.set !== null);

  function resetFilters() {
    setFilter("all");
    setSubject("");
    setSearch("");
  }

  return (
    <DashboardShell userName={data.child.displayName} stars={data.stars} active="tests">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Tests</p>
        <h1>All your tests</h1>
        <p className={styles.copy}>{hasSets ? "Grouped into sets by your administrator." : "Everything assigned to you, in one place."}</p>
      </header>

      {data.tests.length > 0 && (
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={16} strokeWidth={2.2} aria-hidden="true" />
            <span className={styles.visuallyHidden}>Search tests</span>
            <input type="search" value={search} placeholder={hasSets ? "Search tests or sets" : "Search tests"} onChange={(event) => setSearch(event.target.value)} />
          </label>
          {subjects.length > 1 && (
            <label className={styles.subjectFilter}>
              <span className={styles.visuallyHidden}>Subject</span>
              <select value={subject} onChange={(event) => setSubject(event.target.value)}>
                <option value="">All subjects</option>
                {subjects.map((slug) => <option key={slug} value={slug}>{subjectLabel(slug)}</option>)}
              </select>
            </label>
          )}
          <TestFilters value={filter} onChange={setFilter} tests={scoped} />
        </div>
      )}

      {data.tests.length === 0 ? (
        <div className={styles.emptyPanel}>
          <p>No tests assigned yet.</p>
          <span>Your administrator will add them here.</span>
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.emptyPanel}>
          <p>Nothing matches these filters.</p>
          <span>
            <button className={shellStyles.backLink} type="button" onClick={resetFilters}>Show all tests</button>
          </span>
        </div>
      ) : (
        <div className={styles.groups}>
          {groups.map((group) => (
            <TestTable
              key={group.set?.id ?? "no-set"}
              title={group.set?.name ?? (hasSets ? "Other tests" : "All tests")}
              tests={group.tests}
              empty={{ title: "Nothing here.", hint: "" }}
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
