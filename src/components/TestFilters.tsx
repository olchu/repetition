"use client";

import { matchesFilter, testFilters, type StudentTest, type TestFilter } from "@/lib/student-progress";
import styles from "./TestFilters.module.css";

type TestFiltersProps = {
  value: TestFilter;
  onChange: (filter: TestFilter) => void;
  /** Counted before filtering, so each button shows what it would reveal. */
  tests: readonly StudentTest[];
};

export function TestFilters({ value, onChange, tests }: TestFiltersProps) {
  return (
    <div className={styles.filters} role="group" aria-label="Filter tests">
      {testFilters.map((filter) => (
        <button
          className={`${styles.filter} ${filter.value === value ? styles.filterActive : ""}`}
          key={filter.value}
          type="button"
          aria-pressed={filter.value === value}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
          <span className={styles.count}>{tests.filter((test) => matchesFilter(test, filter.value)).length}</span>
        </button>
      ))}
    </div>
  );
}
