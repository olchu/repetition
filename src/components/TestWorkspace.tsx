import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { getCurrentUser } from "@/lib/auth";
import styles from "./TestWorkspace.module.css";

export async function TestWorkspace({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className={styles.shell}>
      <DashboardSidebar userName={user?.childProfile?.displayName ?? user?.login ?? "Student"} active="tests" />
      <div className={styles.main}>
        <div className={styles.columns}>
          <div className={styles.content}>{children}</div>
          <div className={styles.reserved} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
