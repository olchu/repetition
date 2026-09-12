"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import type { StudentSetSummary } from "@/lib/student-progress";
import { useSubjectLabel } from "./SubjectsProvider";
import styles from "./SetCard.module.css";

/** A set on Tests: what it covers, how far the child is, and the way in. A set
 *  of one subject wears that subject's colours; a mixed one stays neutral. */
export function SetCard({ set }: { set: StudentSetSummary }) {
  const subjectLabel = useSubjectLabel();

  return (
    <article className={styles.card} data-subject={set.subjects.length === 1 ? set.subjects[0] : undefined}>
      <div className={styles.top}>
        <span className={styles.icon} aria-hidden="true">
          <Layers size={22} strokeWidth={2.2} />
        </span>
        <div>
          <h3>{set.name}</h3>
          <p className={styles.subjects}>{set.subjects.map(subjectLabel).join(" · ")}</p>
        </div>
      </div>

      {set.description && <p className={styles.description}>{set.description}</p>}

      <p className={styles.counts}>
        <span><strong>{set.passed}</strong> of {set.assigned} passed</span>
        {set.inProgress > 0 && <span className={styles.inProgress}>{set.inProgress} in progress</span>}
        {set.notStarted > 0 && <span className={styles.newCount}>{set.notStarted} new</span>}
      </p>

      <div
        className={styles.track}
        role="progressbar"
        aria-label={`${set.name} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={set.progress}
      >
        <span style={{ width: `${set.progress}%` }} />
      </div>

      <Link className={styles.action} href={`/dashboard/sets/${set.id}`}>
        Open set
        <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
      </Link>
    </article>
  );
}

export function SetCardGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
