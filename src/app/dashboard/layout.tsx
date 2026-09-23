"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  DashboardLoading,
  DashboardShell,
  DashboardUnauthorized,
  DashboardUnavailable,
  shellStyles,
} from "@/components/DashboardShell";
import type { DashboardSection } from "@/components/DashboardSidebar";
import { SubjectsProvider } from "@/components/SubjectsProvider";
import { StudentOverviewProvider, useStudentOverview } from "@/lib/use-student-overview";

function isWorkspacePath(pathname: string) {
  return pathname.startsWith("/dashboard/attempts/")
    || (pathname.startsWith("/dashboard/tests/") && pathname !== "/dashboard/tests");
}

function DashboardFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data, error, isLoading, reload } = useStudentOverview();
  const workspace = isWorkspacePath(pathname);
  const wasWorkspace = useRef(workspace);

  useEffect(() => {
    if (wasWorkspace.current && !workspace) void reload();
    wasWorkspace.current = workspace;
  }, [reload, workspace]);

  // Test-taking and attempt routes provide their own distraction-free frame.
  if (workspace) return children;

  // Background refreshes keep the existing frame and data visible.
  if (isLoading && !data) return <DashboardLoading label="Loading your learning room…" />;
  if (error === "unauthorized") return <DashboardUnauthorized />;
  if (!data) return <DashboardUnavailable onRetry={() => void reload()} />;

  let active: DashboardSection = "home";
  let leading: ReactNode;
  let subject: string | undefined;

  if (pathname.startsWith("/dashboard/subjects")) {
    active = "subjects";
    const subjectSlug = pathname.split("/")[3];
    if (subjectSlug) {
      subject = decodeURIComponent(subjectSlug);
      leading = (
        <Link className={shellStyles.backLink} href="/dashboard/subjects">
          <ChevronLeft size={16} strokeWidth={2.6} aria-hidden="true" />
          All subjects
        </Link>
      );
    } else {
      leading = <p className={shellStyles.topBarEyebrow}>Your learning room</p>;
    }
  } else if (pathname.startsWith("/dashboard/tests") || pathname.startsWith("/dashboard/sets/")) {
    active = "tests";
    const setId = pathname.startsWith("/dashboard/sets/") ? pathname.split("/")[3] : undefined;
    if (setId) {
      const set = data.sets.find((item) => item.id === decodeURIComponent(setId));
      subject = set?.subjects.length === 1 ? set.subjects[0] : undefined;
      leading = (
        <Link className={shellStyles.backLink} href="/dashboard/tests">
          <ChevronLeft size={16} strokeWidth={2.6} aria-hidden="true" />
          All tests
        </Link>
      );
    }
  }

  return (
    <DashboardShell
      userName={data.child.displayName}
      stars={data.stars}
      active={active}
      leading={leading}
      subject={subject}
    >
      {children}
    </DashboardShell>
  );
}

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <SubjectsProvider>
      <StudentOverviewProvider>
        <DashboardFrame>{children}</DashboardFrame>
      </StudentOverviewProvider>
    </SubjectsProvider>
  );
}
