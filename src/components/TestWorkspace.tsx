import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { SignOutButton } from "@/components/SignOutButton";
import { getCurrentUser } from "@/lib/auth";
import styles from "./TestWorkspace.module.css";

export async function TestWorkspace({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className={styles.shell}>
      <DashboardSidebar userName={user?.childProfile?.displayName ?? user?.login ?? "Student"} active="tests" />
      <div className={styles.main}>
        <div className={styles.toolbar}>
          <SignOutButton className={styles.signOut}><LogOut size={16} aria-hidden="true" />Sign out</SignOutButton>
        </div>
        <div className={styles.columns}>
          <div className={styles.content}>{children}</div>
          <div className={styles.reserved} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
