"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import { useSubjectLabel, useSubjects } from "./SubjectsProvider";
import type { StudentSubjectSummary } from "@/lib/student-progress";
import styles from "./SubjectCard.module.css";

export { styles as subjectCardStyles };

export function SubjectIcon({ subject, size }: { subject: string; size: number }) {
  const { subjects } = useSubjects();
  const icon = subjects.find((item) => item.slug === subject)?.icon;

  return icon ? (
    <Image src={icon} alt="" width={size} height={size} style={{ objectFit: "contain", maxWidth: "100%", height: "auto" }} />
  ) : (
    <BookOpen size={size} aria-hidden="true" />
  );
}

type SubjectCardProps = {
  summary: StudentSubjectSummary;
  /** The line under the title; sections word it for their own purpose. */
  meta: ReactNode;
  /** "compact" packs four across on Home; "wide" fills the Subjects grid. */
  variant?: "compact" | "wide";
};

/** A subject as Home and Subjects both draw it: white card, tinted icon and
 *  action, progress bar over passed tests. A subject with no tests still
 *  belongs on the grid, so the bar is replaced by an empty band. */
export function SubjectCard({ summary, meta, variant = "compact" }: SubjectCardProps) {
  const subjectLabel = useSubjectLabel();
  const label = subjectLabel(summary.subject);
  const wide = variant === "wide";

  return (
    <article
      className={`${styles.card} ${wide ? styles.cardWide : ""}`}
      data-subject={summary.subject}
    >
      <div className={styles.top}>
        <span className={styles.icon} aria-hidden="true">
          <SubjectIcon subject={summary.subject} size={wide ? 40 : 34} />
        </span>
        <h3>{label}</h3>
        {/* The whole card links onward; the chevron only hints at it, and the
            wider card is legible enough without it. */}
        {!wide && <ChevronRight className={styles.chevron} size={18} strokeWidth={2.2} aria-hidden="true" />}
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
