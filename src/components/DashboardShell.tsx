"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { DashboardSidebar, type DashboardSection } from "./DashboardSidebar";
import styles from "./DashboardShell.module.css";

export { styles as shellStyles };

type DashboardShellProps = {
  userName: string;
  /** Credited stars; shown in the top bar on every browsing section. */
  stars: number;
  active: DashboardSection;
  /** Left of the top bar — a back link on the sections that have a parent. */
  leading?: ReactNode;
  /** Puts the whole content column in one subject's palette; the tokens are
   *  defined by [data-subject] in globals.css. */
  subject?: string;
  children: ReactNode;
};

/** The frame around every browsing section of the learning room. Its route
 *  layout keeps this component mounted while the page child changes. */
export function DashboardShell({ userName, stars, active, leading, subject, children }: DashboardShellProps) {
  return (
    <div className={styles.shell}>
      <DashboardSidebar userName={userName} active={active} />

      <main className={styles.main} data-subject={subject}>
        <div className={styles.topBar}>
          <div className={styles.topBarLeading}>{leading}</div>
          <p className={styles.starBalance} aria-label={`${stars} stars earned`}>⭐ {stars} stars</p>
        </div>

        {children}
      </main>
    </div>
  );
}

export function DashboardLoading({ label }: { label: string }) {
  return <main className={styles.statePage}>{label}</main>;
}

/** Sign-in and load failures look the same in every section. */
export function DashboardStateCard({
  title,
  description,
  action,
  embedded = false,
}: {
  title: string;
  description: string;
  action: ReactNode;
  embedded?: boolean;
}) {
  const card = (
    <div className={styles.stateCard}>
      <h1>{title}</h1>
      <p>{description}</p>
      {action}
    </div>
  );

  if (embedded) return <section className={styles.statePageEmbedded}>{card}</section>;
  return <main className={styles.statePage}>{card}</main>;
}

export function DashboardUnauthorized() {
  return (
    <DashboardStateCard
      title="Your learning room is private."
      description="Sign in as a child to see assigned tests and progress."
      action={<Link className={styles.stateAction} href="/">Go to sign in</Link>}
    />
  );
}

export function DashboardUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <DashboardStateCard
      title="We couldn’t load your progress."
      description="The learning room is unavailable right now. Try again in a moment."
      action={
        <button className={styles.stateAction} type="button" onClick={onRetry}>
          Try again
        </button>
      }
    />
  );
}
