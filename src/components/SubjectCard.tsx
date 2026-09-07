"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import { isSubjectId, subjectLabels, subjects } from "@/lib/subjects";
import type { StudentSubjectSummary } from "@/lib/student-progress";
import styles from "./SubjectCard.module.css";

export { styles as subjectCardStyles };

export function subjectLabel(subject: string) {
  return subjectLabels[subject] ?? subject;
}

export function SubjectIcon({ subject, size }: { subject: string; size: number }) {
  const icon = isSubjectId(subject) ? subjects[subject].icon : null;

  return icon ? (
    <Image src={icon} alt="" width={size} height={size} style={{ objectFit: "contain", maxWidth: "100%", height: "auto" }} />
  ) : (
    <BookOpen size={size} aria-hidden="true" />
  );
}

type SubjectCardProps = {
  summary: StudentSubjectSummary;
  /** The one line under the title; sections word it for their own purpose. */
  meta: ReactNode;
};

/** A subject as Home and Subjects both draw it: white card, tinted icon and
 *  action, progress bar over passed tests. A subject with no tests still
 *  belongs on the grid, so the bar is replaced by an empty band. */
export function SubjectCard({ summary, meta }: SubjectCardProps) {
  const label = subjectLabel(summary.subject);

  return (
    <article className={styles.card} data-subject={summary.subject}>
      <div className={styles.top}>
        <span className={styles.icon} aria-hidden="true">
          <SubjectIcon subject={summary.subject} size={34} />
        </span>
        <h3>{label}</h3>
        <ChevronRight className={styles.chevron} size={18} strokeWidth={2.2} aria-hidden="true" />
        {meta}
      </div>

      {summary.assigned > 0 ? (
        <div
          className={styles.track}
          role="progressbar"
          aria-label={`${label} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.progress}
        >
          <span style={{ width: `${summary.progress}%` }} />
        </div>
      ) : (
        <div className={styles.emptyTrack} aria-hidden="true" />
      )}

      <Link className={styles.action} href={`/dashboard/subjects/${summary.subject}`}>
        Open subject
        <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
      </Link>
    </article>
  );
}
