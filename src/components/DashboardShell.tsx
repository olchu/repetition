"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { DashboardSidebar, type DashboardSection } from "./DashboardSidebar";
import { SignOutButton } from "./SignOutButton";
import styles from "./DashboardShell.module.css";

export { styles as shellStyles };

type DashboardShellProps = {
  userName: string;
  /** Credited stars; shown left of Sign out on every section. */
  stars: number;
  active: DashboardSection;
  children: ReactNode;
};

/** The frame around every learning-room section. It is a component rather than
 *  a route layout on purpose: the test and attempt pages live under
 *  /dashboard too and render their own workspace instead. */
export function DashboardShell({ userName, stars, active, children }: DashboardShellProps) {
  return (
    <div className={styles.shell}>
      <DashboardSidebar userName={userName} active={active} />

      <main className={styles.main}>
        <div className={styles.topBar}>
          <p className={styles.starBalance} aria-label={`${stars} stars earned`}>⭐ {stars} stars</p>
          <SignOutButton className={styles.signOut}>
            <LogOut size={18} strokeWidth={2} aria-hidden="true" />
            Sign out
          </SignOutButton>
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
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <main className={styles.statePage}>
      <div className={styles.stateCard}>
        <h1>{title}</h1>
        <p>{description}</p>
        {action}
      </div>
    </main>
  );
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
